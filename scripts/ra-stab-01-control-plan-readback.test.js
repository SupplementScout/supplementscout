const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const issuer = require("./ra-stab-01-control-plan-credential-issuer");
const readback = require("./ra-stab-01-control-plan-readback");

const preparation = () => readback.validatePreparation(JSON.parse(fs.readFileSync(readback.PREPARATION_PATH, "utf8")));

function response(value = preparation()) {
  return {
    parent: { parent_plan_id: value.scope.parent_plan_id,
      parent_plan_fingerprint: value.scope.parent_plan_fingerprint, retailer_id: "14",
      target_environment: "PRODUCTION", status: "PLANNED", approval_expires_at: "2026-10-03T09:20:42.631Z" },
    children: value.scope.children.map((row, batch_index) => ({ ...row, batch_index,
      status: "PLANNED", approval_expires_at: "2026-10-03T09:20:42.631Z" })),
    runs: [],
  };
}

test("preparation binds one exact production parent and 19 children", () => {
  const value = preparation();
  assert.equal(value.scope.children.length, 19);
  assert.equal(new Set(value.scope.children.map(row => row.child_plan_id)).size, 19);
  assert.equal(value.execution.maximum_attempts, 1);
  assert.equal(value.execution.automatic_retry, false);
  assert.equal(value.execution.close_authorized, false);
  assert.equal(value.execution.control_writes_authorized, false);
  assert.equal(value.credential.sequence_privileges, false);
  assert.match(readback.confirmation(value), /^[0-9a-f]{20}$/);
});

test("status mode never needs a confirmation or production dependency", async () => {
  const result = await readback.run(["--mode=status"]);
  assert.equal(result.credential_read, false);
  assert.equal(result.production_connection, false);
  assert.equal(result.executable, false);
  assert.equal(result.confirmation, null);
});

test("TLS CA preflight requires the exact current Supabase root before execution", () => {
  const validCaPath = path.resolve("tmp", "supabase.crt");
  const wrongCaPath = path.resolve("tmp", "wrong.crt");
  const valid = {
    fingerprint256: readback.SUPABASE_ROOT_CA_FINGERPRINT,
    subject: "C=US\nO=Supabase Inc\nCN=Supabase Root 2021 CA",
    issuer: "C=US\nO=Supabase Inc\nCN=Supabase Root 2021 CA",
    validFrom: "Apr 28 10:56:53 2021 GMT",
    validTo: "Apr 26 10:56:53 2031 GMT",
  };
  class FakeCertificate { constructor() { Object.assign(this, valid); } }
  const now = () => new Date("2026-10-04T09:30:00Z");
  assert.deepEqual(readback.validateTlsCa({ env: { NODE_EXTRA_CA_CERTS: validCaPath },
    readFile: () => Buffer.from("certificate"), X509Class: FakeCertificate, now }), {
    path: validCaPath, fingerprint256: readback.SUPABASE_ROOT_CA_FINGERPRINT,
    valid_to: valid.validTo,
  });
  assert.throws(() => readback.validateTlsCa({ env: {} }), /TLS_CA_REQUIRED/);
  class WrongCertificate extends FakeCertificate { constructor() { super(); this.fingerprint256 = "00"; } }
  assert.throws(() => readback.validateTlsCa({ env: { NODE_EXTRA_CA_CERTS: wrongCaPath },
    readFile: () => Buffer.from("wrong"), X509Class: WrongCertificate, now }), /TLS_CA_INVALID/);
});

test("missing CA stops before Git, attempt marker and issuer", async () => {
  const value = JSON.parse(fs.readFileSync(readback.PREPARATION_PATH, "utf8"));
  value.status = "OWNER_AUTHORIZED_ONE_SHOT";
  value.implementation = {
    issuer_sha256: readback.sourceHash(path.join(__dirname, "ra-stab-01-control-plan-credential-issuer.js")),
    coordinator_sha256: readback.sourceHash(path.join(__dirname, "ra-stab-01-control-plan-readback.js")),
    test_sha256: readback.sourceHash(__filename),
    lifecycle_integration_sha256: readback.sourceHash(path.join(__dirname,
      "ra-stab-01-control-plan-credential-lifecycle.integration.test.js")),
    rpc_migration_sha256: readback.sourceHash(path.join(__dirname, "..", "supabase", "migrations",
      "20260719100000_add_production_retailer_sync_enablement.sql")),
  };
  const markerBefore = fs.existsSync(readback.ATTEMPT_PATH);
  let gitCalled = false;
  let issuerCalled = false;
  await assert.rejects(() => readback.execute(value, {
    tls: { env: {} },
    validateGitState: () => { gitCalled = true; return "a".repeat(40); },
    issuer: { call: async () => { issuerCalled = true; }, close() {} },
  }), /TLS_CA_REQUIRED/);
  assert.equal(gitCalled, false);
  assert.equal(issuerCalled, false);
  assert.equal(fs.existsSync(readback.ATTEMPT_PATH), markerBefore);
});

test("consumed authorization rejects a syntactically valid confirmation before dependencies", async () => {
  const value = { ...preparation(), status: "CONSUMED_FAILED_CAPABILITY_PROOF" };
  let dependencyCalled = false;
  await assert.rejects(() => readback.run(["--mode=execute", `--confirm=${readback.confirmation(value)}`], {
    preparation: value,
    validateGitState: () => { dependencyCalled = true; },
    issuer: { call: async () => { dependencyCalled = true; }, close() {} },
    tls: { env: { NODE_EXTRA_CA_CERTS: "C:\\tmp\\unused.crt" } },
  }), /AUTHORIZATION_NOT_EXECUTABLE/);
  assert.equal(dependencyCalled, false);
});

test("readback accepts exact identities and reports non-terminal no-run state", () => {
  const result = readback.validateReadback(response(), preparation());
  assert.equal(result.children.length, 19);
  assert.deepEqual(result.status_counts, { PLANNED: 19 });
  assert.equal(result.runs.length, 0);
  assert.equal(result.final_assessment, "REGISTRATION_NON_TERMINAL_NO_RUNS");
});

test("readback fails closed on parent, child, count and duplicate drift", () => {
  const value = preparation();
  const badParent = response(value); badParent.parent.parent_plan_fingerprint = "0".repeat(64);
  assert.throws(() => readback.validateReadback(badParent, value), /PARENT_IDENTITY_DRIFT/);
  const badChild = response(value); badChild.children[0].child_plan_fingerprint = "0".repeat(64);
  assert.throws(() => readback.validateReadback(badChild, value), /CHILD_IDENTITY_DRIFT/);
  const missing = response(value); missing.children.pop();
  assert.throws(() => readback.validateReadback(missing, value), /CHILD_COUNT_DRIFT/);
  const duplicate = response(value); duplicate.children[1] = { ...duplicate.children[0] };
  assert.throws(() => readback.validateReadback(duplicate, value), /CHILD_IDENTITY_DRIFT/);
});

test("execution evidence is exposed, never silently treated as clear", () => {
  const value = preparation();
  const data = response(value);
  data.runs.push({ run_id: "11111111-1111-4111-8111-111111111111",
    child_plan_id: value.scope.children[0].child_plan_id, run_type: "APPLY", status: "STARTED",
    started_at: "2026-10-03T08:35:00Z", completed_at: null });
  assert.equal(readback.validateReadback(data, value).final_assessment,
    "EXECUTION_EVIDENCE_PRESENT_REQUIRES_REVIEW");
});

test("transport performs one parameterized RPC inside read-only transaction", async () => {
  const value = preparation();
  const calls = [];
  class FakeClient {
    async connect() { calls.push("connect"); }
    async query(query) {
      calls.push(query);
      if (typeof query === "object") return { rowCount: 1, rows: [{ session_user: issuer.ROLE,
        current_user: issuer.ROLE, transaction_read_only: "on", data: response(value) }] };
      return { rows: [] };
    }
    async end() { calls.push("end"); }
  }
  const url = `postgresql://${issuer.ROLE}.aftboxmrdgyhizicfsfu:secret@aws-0.test.pooler.supabase.com:5432/postgres`;
  const result = await readback.oneRead(url, value, FakeClient);
  assert.equal(result.parent.parent_plan_id, value.scope.parent_plan_id);
  const rpc = calls.find(call => typeof call === "object");
  assert.match(rpc.text, /session_user[\s\S]*get_retailer_catalogue_plan_status\(\$1::uuid\)/);
  assert.deepEqual(rpc.values, [value.scope.parent_plan_id]);
  assert.ok(calls.includes("begin isolation level repeatable read read only"));
  assert.ok(calls.includes("rollback"));
});

test("issuer validates exact source, target and maximum credential lifetime", () => {
  assert.match(issuer.expectedRpcSource(), /jsonb_build_object/);
  const direct = issuer.validateOwnerUrl("postgresql://postgres:secret@db.aftboxmrdgyhizicfsfu.supabase.co:5432/postgres");
  assert.match(direct, /aftboxmrdgyhizicfsfu/);
  assert.throws(() => issuer.validateOwnerUrl("postgresql://postgres:secret@db.wrong.supabase.co:5432/postgres"), /OWNER_TARGET_INVALID/);
  const now = new Date("2026-10-04T12:00:00Z");
  assert.equal(issuer.validateExpiry("2026-10-04T12:09:59Z", now), "2026-10-04T12:09:59.000Z");
  assert.throws(() => issuer.validateExpiry("2026-10-04T12:10:01Z", now), /WINDOW_INVALID/);
  const verifier = issuer.scram("not-persisted", Buffer.alloc(18, 1));
  assert.match(verifier, /^SCRAM-SHA-256\$4096:/);
  assert.doesNotMatch(verifier, /not-persisted/);
});

test("issuer is generic and exposes no retailer retry, close, service-role or RA-004 writer", () => {
  const source = fs.readFileSync(path.join(__dirname, "ra-stab-01-control-plan-credential-issuer.js"), "utf8");
  assert.doesNotMatch(source, /10 Reps|06ae81b7|service_role|close_expired|write_retailer|apply_retailer/i);
  assert.match(source, /default_transaction_read_only=on/);
  assert.match(source, /revoke execute on function/);
  assert.match(source, /drop role/);
  assert.match(source, /has_sequence_privilege/);
  assert.match(source, /alter role .* nologin valid until/);
  assert.match(source, /idle_session_timeout=''1min''/);
  assert.doesNotMatch(source, /password '\$\{password\}'/);
  assert.doesNotMatch(source, /catalogueCounts|BUSINESS_COUNTS_CHANGED/);
  const disable = source.indexOf("await disableLogin(db)");
  const terminate = source.indexOf("pg_terminate_backend", disable);
  const revoke = source.indexOf("revoke execute on function", terminate);
  const revokeCommit = source.indexOf('await db.query("commit")', revoke);
  const drop = source.indexOf("drop role", revokeCommit);
  assert.ok(disable > 0 && terminate > disable && revoke > terminate
    && revokeCommit > revoke && drop > revokeCommit);
  assert.match(source, /for \(let attempt = 0; attempt < 10/);
  assert.match(source, /queue = queue\.then/);
  assert.ok(source.indexOf('custody = true', source.indexOf('process.on("message"'))
    < source.indexOf("await handle(message)", source.indexOf('process.on("message"')));
});

test("coordinator cleans the fixed role even when create never returns a credential", () => {
  const source = fs.readFileSync(path.join(__dirname, "ra-stab-01-control-plan-readback.js"), "utf8");
  assert.match(source, /finally \{[\s\S]*action: "revoke", role: ROLE/);
  assert.doesNotMatch(source, /if \(credential\)[\s\S]{0,160}action: "revoke"/);
  assert.match(source, /RA_STAB_RESIDUAL_ACCESS_CLEANUP_UNVERIFIED/);
});

test("cleanup mode is independent and can never call the read RPC", async () => {
  const calls = [];
  const fakeIssuer = { call: async value => { calls.push(value); return { access_revoked: true,
    role_absent: true, login_disabled: true, membership_absent: true, backend_absent: true }; }, close() {} };
  const result = await readback.run(["--mode=cleanup"], { issuer: fakeIssuer,
    validateGitState: () => { throw new Error("must not be called"); } });
  assert.equal(result.result, "CLEANUP_VERIFIED");
  assert.equal(result.rpc_calls, 0);
  assert.deepEqual(calls.map(value => value.action), ["revoke"]);
});

test("cleanup reports a safely disabled residual role without claiming drop", async () => {
  const fakeIssuer = { call: async () => ({ access_revoked: true, role_absent: false,
    login_disabled: true, membership_absent: true, backend_absent: true,
    target_execute_absent: true, schema_usage_direct_absent: true,
    cleanup_status: "ACCESS_REVOKED_RESIDUAL_ROLE" }), close() {} };
  const result = await readback.run(["--mode=cleanup"], { issuer: fakeIssuer });
  assert.equal(result.result, "ACCESS_REVOKED_RESIDUAL_ROLE");
  assert.equal(result.access_revoked, true);
});
