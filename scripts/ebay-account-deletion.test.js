const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const {
  ENDPOINT_URL,
  PUBLIC_KEY_BASE_URL,
  assertEndpointRequest,
  assertVerificationToken,
  decodeSignatureHeader,
  generateChallengeResponse,
  getNotificationPublicKey,
  processDeletionNotification,
  resetPublicKeyCache,
  validateDeletionPayload,
  verifyNotificationSignature,
} = require("../lib/ebay-account-deletion");

const payload = {
  metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
  notification: {
    notificationId: "12345678-abcd-1234-abcd-123456789abc",
    eventDate: "2026-08-14T10:00:00.000Z",
    publishDate: "2026-08-14T10:00:01.000Z",
    publishAttemptCount: 1,
    data: { username: "fixture-seller", userId: "fixture-user", eiasToken: "fixture-eias" },
  },
};
const token = "fixture_verification_token_1234567890";

function loadRoute() {
  const filename = path.join(process.cwd(), "app", "api", "ebay", "account-deletion", "route.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename);
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === "@/lib/ebay-account-deletion") return require("../lib/ebay-account-deletion");
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

test("challenge response uses the exact canonical endpoint and stable eBay hash order", () => {
  const challenge = "challenge-123";
  const expected = crypto.createHash("sha256").update(challenge).update(token).update(ENDPOINT_URL).digest("hex");
  assert.equal(generateChallengeResponse(challenge, token), expected);
  assertEndpointRequest(`${ENDPOINT_URL}?challenge_code=${challenge}`);
  assert.throws(() => assertEndpointRequest("https://evil.example/api/ebay/account-deletion"), /mismatch/);
});

test("verification token gate accepts only 32-80 documented characters", () => {
  assert.equal(assertVerificationToken(token), token);
  for (const value of ["short", "a".repeat(81), "a".repeat(31), `${"a".repeat(31)}!`]) {
    assert.throws(() => assertVerificationToken(value), /32-80/);
  }
});

test("signature header decoding is strict and does not expose its value in errors", () => {
  const header = Buffer.from(JSON.stringify({ kid: "key-1", signature: "YWJj" })).toString("base64");
  assert.deepEqual(decodeSignatureHeader(header), { kid: "key-1", signature: "YWJj" });
  assert.throws(() => decodeSignatureHeader("not a signature!"), (error) => {
    assert.equal(error.message, "Invalid X-EBAY-SIGNATURE header");
    assert.doesNotMatch(error.message, /not a signature/);
    return true;
  });
});

test("official notification public-key path uses OAuth GET and one-hour memory cache", async () => {
  resetPublicKeyCache();
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  let fetchCalls = 0;
  let tokenCalls = 0;
  const dependencies = {
    now: 1000,
    tokenProvider: async () => { tokenCalls += 1; return "private-token"; },
    fetchImpl: async (url, options) => {
      fetchCalls += 1;
      assert.equal(url, `${PUBLIC_KEY_BASE_URL}key-1`);
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, "Bearer private-token");
      return { ok: true, json: async () => ({ key: pem }) };
    },
  };
  assert.match(await getNotificationPublicKey("key-1", { client_id: "id", client_secret: "secret" }, dependencies), /BEGIN PUBLIC KEY/);
  assert.match(await getNotificationPublicKey("key-1", { client_id: "id", client_secret: "secret" }, dependencies), /BEGIN PUBLIC KEY/);
  assert.equal(fetchCalls, 1);
  assert.equal(tokenCalls, 1);
});

test("valid raw notification signature passes and tampering fails", async () => {
  resetPublicKeyCache();
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const raw = JSON.stringify(payload);
  const signer = crypto.createSign("sha1");
  signer.update(raw, "utf8");
  signer.end();
  const header = Buffer.from(JSON.stringify({ kid: "fixture-key", signature: signer.sign(privateKey, "base64") })).toString("base64");
  const dependencies = {
    tokenProvider: async () => "token",
    fetchImpl: async () => ({ ok: true, json: async () => ({ key: publicKey.export({ type: "spki", format: "pem" }).toString() }) }),
  };
  assert.equal(await verifyNotificationSignature(raw, header, { client_id: "id", client_secret: "secret" }, dependencies), true);
  assert.equal(await verifyNotificationSignature(`${raw} `, header, { client_id: "id", client_secret: "secret" }, dependencies), false);
});

test("only Marketplace Account Deletion 1.0 with an identity is accepted", () => {
  assert.equal(validateDeletionPayload(payload), payload);
  assert.throws(() => validateDeletionPayload({ ...payload, metadata: { ...payload.metadata, topic: "OTHER" } }), /Unsupported/);
  assert.throws(() => validateDeletionPayload({ ...payload, notification: { ...payload.notification, data: {} } }), /identity is missing/);
  assert.deepEqual(processDeletionNotification(payload), { deleted_records: 0, persisted_ebay_user_data_stores: 0 });
});

test("GET route fails closed without secret and returns exact JSON challenge with secret", async () => {
  const route = loadRoute();
  const previous = process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
  delete process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
  assert.equal((await route.GET(new Request(`${ENDPOINT_URL}?challenge_code=x`))).status, 503);
  process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN = token;
  const response = await route.GET(new Request(`${ENDPOINT_URL}?challenge_code=challenge-123`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { challengeResponse: generateChallengeResponse("challenge-123", token) });
  if (previous === undefined) delete process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
  else process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN = previous;
});

test("POST route fails closed before network without credentials or signature", async () => {
  const route = loadRoute();
  const previousId = process.env.EBAY_CLIENT_ID;
  const previousSecret = process.env.EBAY_CLIENT_SECRET;
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
  assert.equal((await route.POST(new Request(ENDPOINT_URL, { method: "POST", body: JSON.stringify(payload) }))).status, 503);
  process.env.EBAY_CLIENT_ID = "fixture-id";
  process.env.EBAY_CLIENT_SECRET = "fixture-secret";
  assert.equal((await route.POST(new Request(ENDPOINT_URL, { method: "POST", body: JSON.stringify(payload) }))).status, 412);
  if (previousId === undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID = previousId;
  if (previousSecret === undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET = previousSecret;
});

test("endpoint contains no database mutation, user identifier logging or secret literals", () => {
  const source = [
    "app/api/ebay/account-deletion/route.ts",
    "lib/ebay-account-deletion.js",
    "lib/ebay-oauth.js",
  ].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(|supabase|createClient\s*\(/i);
  assert.doesNotMatch(source, /console\.(?:log|error)|fixture-seller|fixture-user|fixture-eias/);
  assert.match(source, /process\.env\.EBAY_NOTIFICATION_VERIFICATION_TOKEN/);
});
