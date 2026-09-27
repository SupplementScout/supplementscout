const crypto = require("node:crypto");

const API_HOST = "hxnrsyyqffztlvcrtgbf.supabase.co";
const API_ORIGIN = `https://${API_HOST}`;
const BUCKET = "ra004-staging-preflight-evidence";
const REQUEST_TIMEOUT_MS = 10_000;
const allowedNames = new Set([
  "preflight-report.json",
  "preflight-revoke.json",
  "control-state-canary.json",
  "control-state-revoke.json",
  "policy-attestation.json",
  "closeout.json",
]);
const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "ENODATA"]);
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

function fail(code, details) {
  const error = new Error(code);
  error.details = details;
  throw error;
}

function decodeJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) fail("RA004_STORAGE_SESSION_INVALID");
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    fail("RA004_STORAGE_SESSION_INVALID");
  }
}

function assertPublicApiKey(key) {
  if (String(key).startsWith("sb_publishable_")) return;
  const claims = decodeJwt(key);
  if (claims.role !== "anon") fail("RA004_STORAGE_PUBLIC_KEY_REQUIRED");
}

function transportCode(error, prefix, timedOut) {
  const cause = error?.cause || error;
  const code = String(cause?.code || error?.code || "").toUpperCase();
  const name = String(error?.name || cause?.name || "").toUpperCase();
  if (timedOut || name === "ABORTERROR" || TIMEOUT_CODES.has(code)) return `${prefix}_TIMEOUT`;
  if (DNS_CODES.has(code)) return `${prefix}_DNS_FAILED`;
  if (code.includes("TLS") || code.includes("CERT") || code.includes("SSL")) return `${prefix}_TLS_FAILED`;
  return `${prefix}_NETWORK_FAILED`;
}

function assertAllowedEndpoint(kind, rawUrl, method) {
  let url;
  try { url = new URL(rawUrl); } catch { fail(`RA004_STORAGE_${kind}_HOST_REJECTED`); }
  if (url.origin !== API_ORIGIN || url.username || url.password || url.hash) {
    fail(`RA004_STORAGE_${kind}_HOST_REJECTED`);
  }
  const expected = kind === "AUTH"
    ? method === "POST" && url.pathname === "/auth/v1/token" && url.search === "?grant_type=password"
    : kind === "LOGOUT"
      ? method === "POST" && url.pathname === "/auth/v1/logout" && url.search === "?scope=global"
      : url.pathname.startsWith(`/storage/v1/object/${BUCKET}/`) && url.search === "";
  if (!expected) fail(`RA004_STORAGE_${kind}_ENDPOINT_REJECTED`);
  return url;
}

function createCustodian({ fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== "function") fail("RA004_STORAGE_FETCH_UNAVAILABLE");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > REQUEST_TIMEOUT_MS) {
    fail("RA004_STORAGE_TIMEOUT_INVALID");
  }
  let accessToken;
  let activationId;
  let subject;
  let expiresAt;
  let sessionState = "NOT_CREATED";
  let cleanupStatus = "NOT_REQUIRED";
  const attempts = { auth: 0, upload: 0, readback: 0, cleanup: 0 };

  function snapshot() {
    return {
      session_creation_state: sessionState,
      cleanup_status: cleanupStatus,
      attempt_counters: { ...attempts },
    };
  }

  function objectUrl(name) {
    if (!allowedNames.has(name)) fail("RA004_STORAGE_OBJECT_NOT_ALLOWED", snapshot());
    return `${API_ORIGIN}/storage/v1/object/${BUCKET}/${activationId}/${name}`;
  }

  async function request(kind, rawUrl, options, prefix) {
    const method = String(options?.method || "GET").toUpperCase();
    assertAllowedEndpoint(kind, rawUrl, method);
    const counter = kind === "AUTH" ? "auth" : kind === "LOGOUT" ? "cleanup" : kind === "UPLOAD" ? "upload" : "readback";
    attempts[counter] += 1;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let response;
    try {
      response = await fetchImpl(rawUrl, { ...options, redirect: "error", signal: controller.signal });
    } catch (error) {
      fail(transportCode(error, prefix, timedOut), snapshot());
    } finally {
      clearTimeout(timer);
    }
    if (!response || typeof response.ok !== "boolean" || !Number.isInteger(response.status)) {
      fail(`${prefix}_INVALID_RESPONSE`, snapshot());
    }
    if (!response.ok) fail(`${prefix}_HTTP_STATUS_${response.status}`, snapshot());
    return response;
  }

  async function init(environment = process.env) {
    const anonKey = environment.RA004_STORAGE_ANON_KEY;
    const email = environment.RA004_STORAGE_EMAIL;
    const authSecret = environment.RA004_STORAGE_PASSWORD;
    activationId = environment.RA004_STORAGE_ACTIVATION_ID;
    expiresAt = new Date(environment.RA004_STORAGE_WINDOW_EXPIRES_AT);
    if (!anonKey || !email || !authSecret || !/^ra004-staging-\d{13}$/.test(activationId)
        || !Number.isFinite(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) {
      fail("RA004_STORAGE_AUTHENTICATION_MISSING", snapshot());
    }
    assertPublicApiKey(anonKey);
    const response = await request("AUTH", `${API_ORIGIN}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password: authSecret }),
    }, "RA004_STORAGE_AUTH");
    let payload;
    try { payload = await response.json(); } catch { fail("RA004_STORAGE_AUTH_INVALID_RESPONSE", snapshot()); }
    if (!payload || typeof payload.access_token !== "string" || !payload.access_token) {
      fail("RA004_STORAGE_AUTH_INVALID_RESPONSE", snapshot());
    }
    accessToken = payload.access_token;
    sessionState = "PARTIALLY_CREATED";
    const claims = decodeJwt(accessToken);
    if (claims.iss !== `${API_ORIGIN}/auth/v1` || claims.role !== "authenticated"
        || typeof claims.sub !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.sub)
        || Number(claims.exp) * 1000 <= Date.now()) {
      fail("RA004_STORAGE_SESSION_SCOPE_INVALID", snapshot());
    }
    subject = claims.sub;
    sessionState = "CREATED";
    cleanupStatus = "PENDING";
    environment.RA004_STORAGE_ANON_KEY = "";
    environment.RA004_STORAGE_EMAIL = "";
    environment.RA004_STORAGE_PASSWORD = "";
    return { subject, jwt_expires_at: new Date(Number(claims.exp) * 1000).toISOString(), ...snapshot() };
  }

  async function put(name, json, environment = process.env) {
    if (sessionState !== "CREATED" || !accessToken) fail("RA004_STORAGE_SESSION_NOT_CREATED", snapshot());
    if (Date.now() >= expiresAt.getTime()) fail("RA004_WINDOW_EXPIRED", snapshot());
    const bytes = Buffer.from(`${JSON.stringify(json, null, 2)}\n`);
    if (bytes.length > 2 * 1024 * 1024) fail("RA004_EVIDENCE_TOO_LARGE", snapshot());
    const anonKey = environment.RA004_STORAGE_RUNTIME_ANON_KEY;
    if (!anonKey) fail("RA004_STORAGE_RUNTIME_KEY_MISSING", snapshot());
    const url = objectUrl(name);
    await request("UPLOAD", url, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
        "cache-control": "no-store",
        "content-type": "application/json",
      },
      body: bytes,
    }, "RA004_EVIDENCE_UPLOAD");
    const readbackResponse = await request("READBACK", url, {
      method: "GET",
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
    }, "RA004_EVIDENCE_READBACK");
    let readback;
    try { readback = Buffer.from(await readbackResponse.arrayBuffer()); }
    catch { fail("RA004_EVIDENCE_READBACK_INVALID_RESPONSE", snapshot()); }
    const expected = crypto.createHash("sha256").update(bytes).digest("hex");
    const actual = crypto.createHash("sha256").update(readback).digest("hex");
    if (actual !== expected) fail("RA004_EVIDENCE_READBACK_HASH_MISMATCH", snapshot());
    return {
      object: `${activationId}/${name}`,
      sha256: expected,
      bytes: bytes.length,
      upload_attempts: attempts.upload,
      readback_attempts: attempts.readback,
      overwrite_requested: false,
    };
  }

  async function close(environment = process.env) {
    if (sessionState === "NOT_CREATED") return { session_created: false, cleanup_status: "NOT_REQUIRED", cleanup_attempts: 0 };
    if (sessionState === "CLOSED") return { session_created: true, cleanup_status: "ALREADY_COMPLETE", cleanup_attempts: attempts.cleanup, subject };
    if (cleanupStatus === "FAILED") fail("RA004_STORAGE_CLEANUP_ALREADY_FAILED", snapshot());
    const anonKey = environment.RA004_STORAGE_RUNTIME_ANON_KEY;
    try {
      await request("LOGOUT", `${API_ORIGIN}/auth/v1/logout?scope=global`, {
        method: "POST",
        headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
      }, "RA004_STORAGE_LOGOUT");
      sessionState = "CLOSED";
      cleanupStatus = "COMPLETE";
      return { session_created: true, session_revoked: true, subject, cleanup_status: cleanupStatus, cleanup_attempts: attempts.cleanup };
    } catch (error) {
      cleanupStatus = "FAILED";
      error.details = snapshot();
      throw error;
    } finally {
      accessToken = undefined;
      environment.RA004_STORAGE_RUNTIME_ANON_KEY = "";
    }
  }

  return { close, init, put, snapshot };
}

function attachProcessHandler(childProcess = process, custodian = createCustodian()) {
  childProcess.on("message", async (message) => {
    try {
      const result = message.action === "init"
        ? await custodian.init(childProcess.env)
        : message.action === "put"
          ? await custodian.put(message.name, message.value, childProcess.env)
          : message.action === "status"
            ? custodian.snapshot()
            : await custodian.close(childProcess.env);
      childProcess.send({ request_id: message.request_id, ok: true, result });
    } catch (error) {
      childProcess.send({
        request_id: message.request_id,
        ok: false,
        error: String(error.message).slice(0, 160),
        details: error.details || custodian.snapshot(),
      });
    }
  });
}

if (require.main === module) attachProcessHandler();

module.exports = {
  API_HOST,
  API_ORIGIN,
  REQUEST_TIMEOUT_MS,
  assertAllowedEndpoint,
  attachProcessHandler,
  createCustodian,
  transportCode,
};
