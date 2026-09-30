const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const {
  DIAGNOSTIC_CODES,
  ENDPOINT_URL,
  PUBLIC_KEY_CACHE_MAX_ENTRIES,
  PUBLIC_KEY_BASE_URL,
  PUBLIC_KEY_TTL_MS,
  assertEndpointRequest,
  assertVerificationToken,
  decodeSignatureHeader,
  generateChallengeResponse,
  getNotificationPublicKey,
  processDeletionNotification,
  resetPublicKeyCache,
  validateDeletionPayload,
  verifiedNotificationLogContext,
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

function encodedSignature(kid = "key-1", signature = "YWJj") {
  return Buffer.from(JSON.stringify({ kid, signature })).toString("base64");
}

async function captureConsoleErrors(callback) {
  const calls = [];
  const originalError = console.error;
  console.error = (...args) => calls.push(args);
  try {
    await callback();
  } finally {
    console.error = originalError;
  }
  return calls;
}

async function captureDiagnostics(callback) {
  const errors = [];
  const infos = [];
  const originalError = console.error;
  const originalInfo = console.info;
  console.error = (...args) => errors.push(args);
  console.info = (...args) => infos.push(args);
  try {
    await callback();
  } finally {
    console.error = originalError;
    console.info = originalInfo;
  }
  return { errors, infos };
}

function diagnosticFailure(code) {
  return Object.assign(new Error(code), { diagnosticCode: code });
}

async function postNotification(route, body = payload, signature = encodedSignature()) {
  return route.POST(new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "x-ebay-signature": signature },
    body: JSON.stringify(body),
  }));
}

function loadRoute(libraryOverrides = {}) {
  const filename = path.join(process.cwd(), "app", "api", "ebay", "account-deletion", "route.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename);
  const originalLoad = Module._load;
  const scheduled = [];
  Module._load = function patched(request, parent, isMain) {
    if (request === "next/server") return { after: (callback) => scheduled.push(callback) };
    if (request === "@/lib/ebay-account-deletion") {
      return { ...require("../lib/ebay-account-deletion"), ...libraryOverrides };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return { ...mod.exports, __scheduled: scheduled };
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
  const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
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

test("OAuth failures receive the closed oauth_failed diagnostic code", async () => {
  resetPublicKeyCache();
  await assert.rejects(
    () => getNotificationPublicKey("oauth-key", { client_id: "id", client_secret: "secret" }, {
      tokenProvider: async () => { throw new Error("credential detail must not escape"); },
      fetchImpl: async () => { throw new Error("must not fetch"); },
    }),
    (error) => error.diagnosticCode === DIAGNOSTIC_CODES.OAUTH_FAILED,
  );
});

test("public-key HTTP 4xx and 5xx receive public_key_fetch_failed", async () => {
  for (const status of [404, 503]) {
    resetPublicKeyCache();
    await assert.rejects(
      () => getNotificationPublicKey(`http-${status}`, { client_id: "id", client_secret: "secret" }, {
        tokenProvider: async () => "private-token",
        fetchImpl: async () => ({ ok: false, status }),
      }),
      (error) => error.diagnosticCode === DIAGNOSTIC_CODES.PUBLIC_KEY_FETCH_FAILED,
    );
  }
});

test("invalid public-key material receives public_key_invalid", async () => {
  resetPublicKeyCache();
  await assert.rejects(
    () => getNotificationPublicKey("invalid-key", { client_id: "id", client_secret: "secret" }, {
      tokenProvider: async () => "private-token",
      fetchImpl: async () => ({ ok: true, json: async () => ({ key: "not-public-key-material" }) }),
    }),
    (error) => error.diagnosticCode === DIAGNOSTIC_CODES.PUBLIC_KEY_INVALID,
  );
});

test("public-key cache evicts the least recently used key at its fixed bound", async () => {
  resetPublicKeyCache();
  const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  let fetchCalls = 0;
  const dependencies = {
    now: 1000,
    tokenProvider: async () => "private-token",
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ key: pem }) };
    },
  };

  for (let index = 0; index <= PUBLIC_KEY_CACHE_MAX_ENTRIES; index += 1) {
    await getNotificationPublicKey(`lru-key-${index}`, { client_id: "id", client_secret: "secret" }, dependencies);
  }
  assert.equal(fetchCalls, PUBLIC_KEY_CACHE_MAX_ENTRIES + 1);

  await getNotificationPublicKey("lru-key-0", { client_id: "id", client_secret: "secret" }, dependencies);
  assert.equal(fetchCalls, PUBLIC_KEY_CACHE_MAX_ENTRIES + 2);
});

test("public-key cache refetches after the one-hour TTL expires", async () => {
  resetPublicKeyCache();
  const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  let fetchCalls = 0;
  const dependencies = (now) => ({
    now,
    tokenProvider: async () => "private-token",
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ key: pem }) };
    },
  });

  await getNotificationPublicKey("ttl-key", { client_id: "id", client_secret: "secret" }, dependencies(1000));
  await getNotificationPublicKey("ttl-key", { client_id: "id", client_secret: "secret" }, dependencies(1000 + PUBLIC_KEY_TTL_MS - 1));
  await getNotificationPublicKey("ttl-key", { client_id: "id", client_secret: "secret" }, dependencies(1000 + PUBLIC_KEY_TTL_MS));
  assert.equal(fetchCalls, 2);
});

test("official-style ECC P-256 signature accepts only the exact body, signature and key", async () => {
  resetPublicKeyCache();
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const { publicKey: wrongPublicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = JSON.stringify(payload);
  const signer = crypto.createSign("ssl3-sha1");
  signer.update(raw, "utf8");
  signer.end();
  const signature = signer.sign(privateKey);
  const header = encodedSignature("fixture-key", signature.toString("base64"));
  const modifiedSignature = Buffer.from(signature);
  modifiedSignature[modifiedSignature.length - 1] ^= 1;
  const dependencies = {
    tokenProvider: async () => "token",
    fetchImpl: async () => ({ ok: true, json: async () => ({ key: publicKey.export({ type: "spki", format: "pem" }).toString() }) }),
  };
  assert.equal(await verifyNotificationSignature(raw, header, { client_id: "id", client_secret: "secret" }, dependencies), true);
  assert.equal(await verifyNotificationSignature(`${raw} `, header, { client_id: "id", client_secret: "secret" }, dependencies), false);
  assert.equal(await verifyNotificationSignature(
    raw,
    encodedSignature("fixture-key", modifiedSignature.toString("base64")),
    { client_id: "id", client_secret: "secret" },
    dependencies,
  ), false);

  resetPublicKeyCache();
  assert.equal(await verifyNotificationSignature(
    raw,
    encodedSignature("wrong-key", signature.toString("base64")),
    { client_id: "id", client_secret: "secret" },
    {
      tokenProvider: async () => "token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ key: wrongPublicKey.export({ type: "spki", format: "pem" }).toString() }),
      }),
    },
  ), false);
});

const invalidPayloadCases = [
  {
    name: "root",
    value: null,
    code: DIAGNOSTIC_CODES.PAYLOAD_ROOT_INVALID,
    privateValue: null,
  },
  {
    name: "topic",
    value: { ...payload, metadata: { ...payload.metadata, topic: "private-invalid-topic" } },
    code: DIAGNOSTIC_CODES.PAYLOAD_TOPIC_INVALID,
    privateValue: "private-invalid-topic",
  },
  {
    name: "schema version",
    value: { ...payload, metadata: { ...payload.metadata, schemaVersion: "private-invalid-schema" } },
    code: DIAGNOSTIC_CODES.PAYLOAD_SCHEMA_VERSION_INVALID,
    privateValue: "private-invalid-schema",
  },
  {
    name: "notification",
    value: { ...payload, notification: null },
    code: DIAGNOSTIC_CODES.PAYLOAD_NOTIFICATION_MISSING,
    privateValue: null,
  },
  {
    name: "notification ID",
    value: {
      ...payload,
      notification: { ...payload.notification, notificationId: "private-invalid-id!" },
    },
    code: DIAGNOSTIC_CODES.PAYLOAD_NOTIFICATION_ID_INVALID,
    privateValue: "private-invalid-id!",
  },
  {
    name: "data",
    value: { ...payload, notification: { ...payload.notification, data: null } },
    code: DIAGNOSTIC_CODES.PAYLOAD_DATA_MISSING,
    privateValue: null,
  },
  {
    name: "identity",
    value: {
      ...payload,
      notification: { ...payload.notification, data: { privateField: "private-identity-marker" } },
    },
    code: DIAGNOSTIC_CODES.PAYLOAD_IDENTITY_MISSING,
    privateValue: "private-identity-marker",
  },
];

test("payload validator preserves its acceptance boundary and emits one closed code per rejected condition", () => {
  assert.equal(validateDeletionPayload(payload), payload);
  for (const { name, value, code, privateValue } of invalidPayloadCases) {
    assert.throws(() => validateDeletionPayload(value), (error) => {
      assert.equal(error.diagnosticCode, code, name);
      assert.equal(error.message, code, name);
      if (privateValue) assert.equal(error.message.includes(privateValue), false, name);
      return true;
    });
  }
  assert.deepEqual(processDeletionNotification(payload), { deleted_records: 0, persisted_ebay_user_data_stores: 0 });
});

test("verified logging context hashes notificationId and preserves only the attempt count", () => {
  const context = verifiedNotificationLogContext(payload);
  assert.deepEqual(context, {
    notification_id_sha256: crypto.createHash("sha256").update(payload.notification.notificationId).digest("hex"),
    publish_attempt_count: 1,
  });
  assert.doesNotMatch(JSON.stringify(context), new RegExp(payload.notification.notificationId));
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

test("POST route rejects a missing signature before scheduling background work", async () => {
  const route = loadRoute();
  assert.equal((await route.POST(new Request(ENDPOINT_URL, { method: "POST", body: JSON.stringify(payload) }))).status, 412);
  assert.equal(route.__scheduled.length, 0);
});

test("POST acknowledges a valid notification immediately and emits one privacy-safe success diagnostic", async () => {
  let verified = 0;
  let processed = 0;
  const signatureMarker = "cHJpdmF0ZS1zaWduYXR1cmUtbWFya2Vy";
  const route = loadRoute({
    verifyNotificationSignature: async () => { verified += 1; return true; },
    processDeletionNotification: () => { processed += 1; },
  });
  const diagnostics = await captureDiagnostics(async () => {
    const response = await postNotification(route, payload, encodedSignature("private-kid-marker", signatureMarker));
    assert.equal(response.status, 204);
    assert.equal(verified, 0);
    assert.equal(processed, 0);
    assert.equal(route.__scheduled.length, 1);
    await route.__scheduled[0]();
  });
  assert.equal(verified, 1);
  assert.equal(processed, 1);
  assert.deepEqual(diagnostics, {
    errors: [],
    infos: [["eBay account-deletion diagnostic", {
      status: "verified",
      notification_id_sha256: crypto.createHash("sha256").update(payload.notification.notificationId).digest("hex"),
      publish_attempt_count: 1,
    }]],
  });
  const logged = JSON.stringify(diagnostics);
  for (const privateValue of [
    payload.notification.notificationId,
    payload.notification.data.username,
    payload.notification.data.userId,
    payload.notification.data.eiasToken,
    signatureMarker,
    "private-kid-marker",
  ]) {
    assert.doesNotMatch(logged, new RegExp(privateValue));
  }
});

test("no failure path emits a verified success diagnostic and HTTP acknowledgement remains unchanged", async () => {
  const cases = [
    { verifyNotificationSignature: async () => false },
    { verifyNotificationSignature: async () => { throw diagnosticFailure(DIAGNOSTIC_CODES.OAUTH_FAILED); } },
    { verifyNotificationSignature: async () => true, body: { ...payload, metadata: { ...payload.metadata, topic: "OTHER" } } },
    {
      verifyNotificationSignature: async () => true,
      processDeletionNotification: () => { throw new Error("processing failed"); },
    },
  ];
  for (const { body = payload, ...overrides } of cases) {
    const diagnostics = await captureDiagnostics(async () => {
      const route = loadRoute(overrides);
      const response = await postNotification(route, body);
      assert.equal(response.status, 204);
      await route.__scheduled[0]();
    });
    assert.equal(diagnostics.infos.length, 0);
    assert.equal(diagnostics.errors.length, 1);
    assert.doesNotMatch(JSON.stringify(diagnostics), /"status":"verified"/);
  }
});

test("background signature failure never processes deletion data", async () => {
  let processed = 0;
  const calls = await captureConsoleErrors(async () => {
    const route = loadRoute({
      verifyNotificationSignature: async () => false,
      processDeletionNotification: () => { processed += 1; },
    });
    const response = await postNotification(route);
    assert.equal(response.status, 204);
    await route.__scheduled[0]();
    assert.equal(processed, 0);
  });
  assert.deepEqual(calls, [["eBay account-deletion diagnostic", { failure_code: DIAGNOSTIC_CODES.SIGNATURE_REJECTED }]]);
});

test("verification dependency failures keep HTTP 204 and emit only their closed diagnostic code", async () => {
  for (const code of [
    DIAGNOSTIC_CODES.OAUTH_FAILED,
    DIAGNOSTIC_CODES.PUBLIC_KEY_FETCH_FAILED,
    DIAGNOSTIC_CODES.PUBLIC_KEY_INVALID,
  ]) {
    const calls = await captureConsoleErrors(async () => {
      const route = loadRoute({ verifyNotificationSignature: async () => { throw diagnosticFailure(code); } });
      const response = await postNotification(route);
      assert.equal(response.status, 204);
      await route.__scheduled[0]();
    });
    assert.deepEqual(calls, [["eBay account-deletion diagnostic", { failure_code: code }]]);
  }
});

test("verified invalid payloads log only their precise subcode and safe post-verification context", async () => {
  const signatureMarker = "cHJpdmF0ZS1zaWduYXR1cmUtbWFya2Vy";
  for (const { name, value, code, privateValue } of invalidPayloadCases) {
    const diagnostics = await captureDiagnostics(async () => {
      const route = loadRoute({ verifyNotificationSignature: async () => true });
      const response = await postNotification(
        route,
        value,
        encodedSignature("private-kid-marker", signatureMarker),
      );
      assert.equal(response.status, 204, name);
      assert.equal(route.__scheduled.length, 1, name);
      await route.__scheduled[0]();
    });
    assert.equal(diagnostics.infos.length, 0, name);
    assert.equal(diagnostics.errors.length, 1, name);
    const diagnostic = diagnostics.errors[0][1];
    assert.equal(diagnostic.failure_code, code, name);
    assert.deepEqual(
      Object.keys(diagnostic).sort(),
      [
        "failure_code",
        ...(value?.notification?.notificationId ? ["notification_id_sha256"] : []),
        ...(Number.isSafeInteger(value?.notification?.publishAttemptCount) ? ["publish_attempt_count"] : []),
      ].sort(),
      name,
    );
    const logged = JSON.stringify(diagnostics);
    assert.doesNotMatch(logged, /"status":"verified"/, name);
    for (const privateValueCandidate of [
      privateValue,
      value?.metadata?.topic,
      value?.metadata?.schemaVersion,
      value?.notification?.notificationId,
      value?.notification?.data?.username,
      value?.notification?.data?.userId,
      value?.notification?.data?.eiasToken,
      value?.notification?.data?.privateField,
      signatureMarker,
      "private-kid-marker",
    ].filter(Boolean)) {
      assert.equal(logged.includes(privateValueCandidate), false, name);
    }
  }
});

test("processing failures keep HTTP 204 and include only verified hashed context", async () => {
  const calls = await captureConsoleErrors(async () => {
    const route = loadRoute({
      verifyNotificationSignature: async () => true,
      processDeletionNotification: () => { throw new Error("private processing detail"); },
    });
    const response = await postNotification(route);
    assert.equal(response.status, 204);
    await route.__scheduled[0]();
  });
  assert.deepEqual(calls, [["eBay account-deletion diagnostic", {
    failure_code: DIAGNOSTIC_CODES.PROCESSING_FAILED,
    notification_id_sha256: crypto.createHash("sha256").update(payload.notification.notificationId).digest("hex"),
    publish_attempt_count: 1,
  }]]);
});

test("diagnostic logs never expose PII, signatures, credentials, tokens, key material or error details", async () => {
  const sensitivePayload = {
    ...payload,
    notification: {
      ...payload.notification,
      notificationId: "private-notification-id-12345678",
      data: {
        username: "private-username-marker",
        userId: "private-user-id-marker",
        eiasToken: "private-eias-token-marker",
      },
    },
  };
  const signatureMarker = "cHJpdmF0ZS1zaWduYXR1cmUtbWFya2Vy";
  const calls = await captureConsoleErrors(async () => {
    const route = loadRoute({
      verifyNotificationSignature: async () => true,
      processDeletionNotification: () => { throw new Error("private-error-detail-marker"); },
    });
    const response = await postNotification(route, sensitivePayload, encodedSignature("private-kid-marker", signatureMarker));
    assert.equal(response.status, 204);
    await route.__scheduled[0]();
  });
  const logged = JSON.stringify(calls);
  for (const secret of [
    sensitivePayload.notification.notificationId,
    sensitivePayload.notification.data.username,
    sensitivePayload.notification.data.userId,
    sensitivePayload.notification.data.eiasToken,
    signatureMarker,
    "private-kid-marker",
    "private-error-detail-marker",
  ]) {
    assert.doesNotMatch(logged, new RegExp(secret));
  }
  assert.match(logged, /processing_failed/);
});

test("malformed JSON is rejected before acknowledgement", async () => {
  const route = loadRoute();
  const signature = Buffer.from(JSON.stringify({ kid: "key-1", signature: "YWJj" })).toString("base64");
  const response = await route.POST(new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "x-ebay-signature": signature },
    body: "not-json",
  }));
  assert.equal(response.status, 400);
  assert.equal(route.__scheduled.length, 0);
});

test("endpoint contains no database mutation, user identifier logging or secret literals", () => {
  const source = [
    "app/api/ebay/account-deletion/route.ts",
    "lib/ebay-account-deletion.js",
    "lib/ebay-oauth.js",
  ].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\bsupabase\b|createClient\s*\(|\.from\s*\([^)]*\)\s*\.\s*(?:insert|upsert|delete|rpc)\s*\(/i);
  assert.doesNotMatch(source, /fixture-seller|fixture-user|fixture-eias/);
  assert.doesNotMatch(source, /console\.(?:log|error|info)\(\s*(?:payload|rawBody|signature|config|error)\b/);
  assert.match(source, /process\.env\.EBAY_NOTIFICATION_VERIFICATION_TOKEN/);
});
