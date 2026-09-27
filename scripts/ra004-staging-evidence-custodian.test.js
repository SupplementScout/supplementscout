const assert = require("node:assert/strict");
const test = require("node:test");

const {
  API_ORIGIN,
  assertAllowedEndpoint,
  createCustodian,
} = require("./ra004-staging-evidence-custodian");

const subject = "11111111-2222-4333-8444-555555555555";

function environment() {
  return {
    RA004_STORAGE_ANON_KEY: ["sb", "publishable", "fixture"].join("_"),
    RA004_STORAGE_RUNTIME_ANON_KEY: ["sb", "publishable", "fixture"].join("_"),
    RA004_STORAGE_EMAIL: "fixture@example.invalid",
    RA004_STORAGE_PASSWORD: "fixture-only-value",
    RA004_STORAGE_ACTIVATION_ID: "ra004-staging-1790493761055",
    RA004_STORAGE_WINDOW_EXPIRES_AT: "2099-01-01T00:00:00Z",
  };
}

function token(overrides = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    iss: `${API_ORIGIN}/auth/v1`,
    role: "authenticated",
    sub: subject,
    exp: 4_070_908_800,
    ...overrides,
  })}.fixture`;
}

function response({ status = 200, json = {}, bytes = "" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return json; },
    async arrayBuffer() { return Buffer.from(bytes); },
  };
}

function sequence(...items) {
  let index = 0;
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const item = items[index++];
    if (item instanceof Error) throw item;
    if (typeof item === "function") return item(url, options);
    return item;
  };
  return { calls, fetchImpl };
}

async function capture(operation) {
  try { await operation(); }
  catch (error) { return { code: error.message, details: error.details }; }
  assert.fail("operation unexpectedly succeeded");
}

test("creates and closes one session, then makes repeated cleanup idempotent", async () => {
  const transport = sequence(
    response({ json: { access_token: token() } }),
    response({ status: 204 }),
  );
  const env = environment();
  const custodian = createCustodian({ fetchImpl: transport.fetchImpl });
  const created = await custodian.init(env);
  assert.equal(created.session_creation_state, "CREATED");
  assert.deepEqual(created.attempt_counters, { auth: 1, upload: 0, readback: 0, cleanup: 0 });
  const closed = await custodian.close(env);
  assert.equal(closed.cleanup_status, "COMPLETE");
  assert.equal(closed.cleanup_attempts, 1);
  const repeated = await custodian.close(env);
  assert.equal(repeated.cleanup_status, "ALREADY_COMPLETE");
  assert.equal(repeated.cleanup_attempts, 1);
  assert.equal(transport.calls.length, 2);
});

test("classifies an opaque fetch failure without leaking its message", async () => {
  const secret = "do-not-leak-fixture";
  const failure = await capture(() => createCustodian({
    fetchImpl: async () => { throw new TypeError(`fetch failed ${secret}`); },
  }).init(environment()));
  assert.equal(failure.code, "RA004_STORAGE_AUTH_NETWORK_FAILED");
  assert.doesNotMatch(JSON.stringify(failure), new RegExp(secret));
  assert.deepEqual(failure.details.attempt_counters, { auth: 1, upload: 0, readback: 0, cleanup: 0 });
});

for (const [label, causeCode, expected] of [
  ["DNS", "ENOTFOUND", "RA004_STORAGE_AUTH_DNS_FAILED"],
  ["TLS", "ERR_TLS_CERT_ALTNAME_INVALID", "RA004_STORAGE_AUTH_TLS_FAILED"],
]) {
  test(`classifies ${label} failure with a stable code`, async () => {
    const error = new TypeError("fetch failed", { cause: Object.assign(new Error("private details"), { code: causeCode }) });
    const failure = await capture(() => createCustodian({ fetchImpl: async () => { throw error; } }).init(environment()));
    assert.equal(failure.code, expected);
  });
}

test("aborts a bounded auth request with an explicit timeout code", async () => {
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const failure = await capture(() => createCustodian({ fetchImpl, timeoutMs: 5 }).init(environment()));
  assert.equal(failure.code, "RA004_STORAGE_AUTH_TIMEOUT");
  assert.equal(failure.details.attempt_counters.auth, 1);
});

test("distinguishes HTTP rejection from an invalid response", async () => {
  const httpFailure = await capture(() => createCustodian({
    fetchImpl: async () => response({ status: 401 }),
  }).init(environment()));
  assert.equal(httpFailure.code, "RA004_STORAGE_AUTH_HTTP_STATUS_401");

  const invalidFailure = await capture(() => createCustodian({
    fetchImpl: async () => ({ ok: true }),
  }).init(environment()));
  assert.equal(invalidFailure.code, "RA004_STORAGE_AUTH_INVALID_RESPONSE");
});

test("rejects a malformed auth payload without creating a session", async () => {
  const custodian = createCustodian({ fetchImpl: async () => response({ json: { unexpected: true } }) });
  const failure = await capture(() => custodian.init(environment()));
  assert.equal(failure.code, "RA004_STORAGE_AUTH_INVALID_RESPONSE");
  assert.equal(custodian.snapshot().session_creation_state, "NOT_CREATED");
  assert.deepEqual(await custodian.close(environment()), {
    session_created: false,
    cleanup_status: "NOT_REQUIRED",
    cleanup_attempts: 0,
  });
});

test("a partially created session is cleaned up exactly once", async () => {
  const transport = sequence(
    response({ json: { access_token: token({ role: "anon" }) } }),
    response({ status: 204 }),
  );
  const env = environment();
  const custodian = createCustodian({ fetchImpl: transport.fetchImpl });
  const failure = await capture(() => custodian.init(env));
  assert.equal(failure.code, "RA004_STORAGE_SESSION_SCOPE_INVALID");
  assert.equal(custodian.snapshot().session_creation_state, "PARTIALLY_CREATED");
  const cleanup = await custodian.close(env);
  assert.equal(cleanup.cleanup_status, "COMPLETE");
  assert.equal(cleanup.cleanup_attempts, 1);
});

test("cleanup failure remains separate and a second cleanup makes no network retry", async () => {
  const transport = sequence(
    response({ json: { access_token: token() } }),
    new TypeError("fetch failed", { cause: Object.assign(new Error("dns private"), { code: "EAI_AGAIN" }) }),
  );
  const env = environment();
  const custodian = createCustodian({ fetchImpl: transport.fetchImpl });
  await custodian.init(env);
  const cleanupFailure = await capture(() => custodian.close(env));
  assert.equal(cleanupFailure.code, "RA004_STORAGE_LOGOUT_DNS_FAILED");
  assert.equal(cleanupFailure.details.cleanup_status, "FAILED");
  const repeated = await capture(() => custodian.close(env));
  assert.equal(repeated.code, "RA004_STORAGE_CLEANUP_ALREADY_FAILED");
  assert.equal(transport.calls.length, 2);
});

test("host and endpoint allowlist rejects every non-staging destination before fetch", () => {
  assert.throws(
    () => assertAllowedEndpoint("AUTH", "https://example.invalid/auth/v1/token?grant_type=password", "POST"),
    /RA004_STORAGE_AUTH_HOST_REJECTED/,
  );
  assert.throws(
    () => assertAllowedEndpoint("AUTH", `${API_ORIGIN}/rest/v1/anything`, "POST"),
    /RA004_STORAGE_AUTH_ENDPOINT_REJECTED/,
  );
  assert.throws(
    () => assertAllowedEndpoint("LOGOUT", `${API_ORIGIN}/auth/v1/logout?scope=global`, "GET"),
    /RA004_STORAGE_LOGOUT_ENDPOINT_REJECTED/,
  );
});

test("failure state and attempt counters are deterministic and secret-free", async () => {
  async function run() {
    const custodian = createCustodian({ fetchImpl: async () => response({ status: 503 }) });
    const failure = await capture(() => custodian.init(environment()));
    return { primary_failure: failure.code, ...custodian.snapshot(), window_started: false };
  }
  const first = await run();
  const second = await run();
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    primary_failure: "RA004_STORAGE_AUTH_HTTP_STATUS_503",
    session_creation_state: "NOT_CREATED",
    cleanup_status: "NOT_REQUIRED",
    attempt_counters: { auth: 1, upload: 0, readback: 0, cleanup: 0 },
    window_started: false,
  });
  assert.doesNotMatch(JSON.stringify(first), /fixture-only-value|fixture@example\.invalid/);
});
