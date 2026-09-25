const crypto = require("node:crypto");

const API_HOST = "hxnrsyyqffztlvcrtgbf.supabase.co";
const BUCKET = "ra004-staging-preflight-evidence";
const allowedNames = new Set([
  "preflight-report.json",
  "preflight-revoke.json",
  "control-state-canary.json",
  "control-state-revoke.json",
  "policy-attestation.json",
  "closeout.json",
]);

let accessToken;
let activationId;
let subject;
let expiresAt;

function fail(code) { throw new Error(code); }
function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) fail("RA004_STORAGE_SESSION_INVALID");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}
function assertPublicApiKey(key) {
  if (String(key).startsWith("sb_publishable_")) return;
  const claims = decodeJwt(key);
  if (claims.role !== "anon") fail("RA004_STORAGE_PUBLIC_KEY_REQUIRED");
}
function objectUrl(name) {
  if (!allowedNames.has(name)) fail("RA004_STORAGE_OBJECT_NOT_ALLOWED");
  return `https://${API_HOST}/storage/v1/object/${BUCKET}/${activationId}/${name}`;
}
async function request(url, options, code) {
  const response = await fetch(url, { ...options, redirect: "error" });
  if (!response.ok) fail(`${code}_${response.status}`);
  return response;
}
async function init() {
  const anonKey = process.env.RA004_STORAGE_ANON_KEY;
  const email = process.env.RA004_STORAGE_EMAIL;
  const authSecret = process.env.RA004_STORAGE_PASSWORD;
  activationId = process.env.RA004_STORAGE_ACTIVATION_ID;
  expiresAt = new Date(process.env.RA004_STORAGE_WINDOW_EXPIRES_AT);
  if (!anonKey || !email || !authSecret || !/^ra004-staging-\d{13}$/.test(activationId)
      || !Number.isFinite(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) {
    fail("RA004_STORAGE_AUTHENTICATION_MISSING");
  }
  assertPublicApiKey(anonKey);
  const response = await request(`https://${API_HOST}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password: authSecret }),
  }, "RA004_STORAGE_LOGIN_FAILED");
  const payload = await response.json();
  const claims = decodeJwt(payload.access_token);
  if (claims.iss !== `https://${API_HOST}/auth/v1` || claims.role !== "authenticated"
      || typeof claims.sub !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.sub)
      || Number(claims.exp) * 1000 <= Date.now()) fail("RA004_STORAGE_SESSION_SCOPE_INVALID");
  accessToken = payload.access_token;
  subject = claims.sub;
  process.env.RA004_STORAGE_ANON_KEY = "";
  process.env.RA004_STORAGE_EMAIL = "";
  process.env.RA004_STORAGE_PASSWORD = "";
  return { subject, jwt_expires_at: new Date(Number(claims.exp) * 1000).toISOString() };
}
async function put(name, json) {
  if (!accessToken || Date.now() >= expiresAt.getTime()) fail("RA004_WINDOW_EXPIRED");
  const bytes = Buffer.from(`${JSON.stringify(json, null, 2)}\n`);
  if (bytes.length > 2 * 1024 * 1024) fail("RA004_EVIDENCE_TOO_LARGE");
  const anonKey = process.env.RA004_STORAGE_RUNTIME_ANON_KEY;
  if (!anonKey) fail("RA004_STORAGE_RUNTIME_KEY_MISSING");
  const url = objectUrl(name);
  await request(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      "cache-control": "no-store",
      "content-type": "application/json",
    },
    body: bytes,
  }, "RA004_EVIDENCE_UPLOAD_FAILED");
  const readbackResponse = await request(url, {
    method: "GET",
    headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
  }, "RA004_EVIDENCE_READBACK_FAILED");
  const readback = Buffer.from(await readbackResponse.arrayBuffer());
  const expected = crypto.createHash("sha256").update(bytes).digest("hex");
  const actual = crypto.createHash("sha256").update(readback).digest("hex");
  if (actual !== expected) fail("RA004_EVIDENCE_READBACK_HASH_MISMATCH");
  return {
    object: `${activationId}/${name}`,
    sha256: expected,
    bytes: bytes.length,
    upload_attempts: 1,
    readback_attempts: 1,
    overwrite_requested: false,
  };
}
async function close() {
  let logoutVerified = false;
  try {
    if (accessToken) {
      const anonKey = process.env.RA004_STORAGE_RUNTIME_ANON_KEY;
      const response = await fetch(`https://${API_HOST}/auth/v1/logout?scope=global`, {
        method: "POST",
        headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
        redirect: "error",
      });
      logoutVerified = response.ok;
    }
  } finally {
    accessToken = undefined;
    process.env.RA004_STORAGE_RUNTIME_ANON_KEY = "";
  }
  if (!logoutVerified) fail("RA004_STORAGE_LOGOUT_UNVERIFIED");
  return { session_revoked: true, subject };
}

process.on("message", async (message) => {
  try {
    const result = message.action === "init"
      ? await init()
      : message.action === "put"
        ? await put(message.name, message.value)
        : await close();
    process.send({ request_id: message.request_id, ok: true, result });
  } catch (error) {
    process.send({ request_id: message.request_id, ok: false, error: String(error.message).slice(0, 160) });
  }
});
