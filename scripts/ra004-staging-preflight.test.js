const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CONTROL_MIGRATION, CURRENT_DECISION_FINGERPRINT, PREFLIGHT_MIGRATION, ROOT,
  authorizationFingerprint, fileSha, postgresJsonbText, redact, validateAuthorization,
  validateCounters, validateEvidenceStore, validateMetadata, validateProjectIdentity,
} = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/contract");
const { LocalFixtureTransport } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/fixture-transport");
const { createClosedProvider } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/provider");
const { runPreflight } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/runner");
const { writeOnce } = require("./lib/retailer-offer-sync/ra004-staging-preflight-v1/evidence");
const {
  createPreflightPostgresTransport,
  validateDatabaseUrl,
  validateRevokeReceipt,
} = require("./lib/retailer-offer-sync/ra004-bounded-live-transport-v1");
const { sha256 } = require("./lib/stable-json-hash");
const { parseArgs, readAuthorization, run: runCli } = require("./ra004-staging-preflight");

const NOW = "2026-09-25T12:00:00.000Z";
const BASELINE = "509ffb51079855f628fdf3dd19996021dc0d2bb9";
const PLAN = "bd5c259941997daad3755c1cb135f76f6eccaef1fb9e1ce0044939ce08439214";
const FIXTURE = path.join(__dirname, "test-fixtures/ra004-staging-preflight-v1/complete-synthetic.json");
const CURRENT_MANIFEST = path.join(ROOT, "docs/retailer-automation/evidence/RA-004-staging-preflight-authorization.json");
const clone = (value) => structuredClone(value);

function expected(overrides = {}) {
  return {
    provider_mode: "fixture", baseline_sha: BASELINE,
    decision_fingerprint: CURRENT_DECISION_FINGERPRINT, plan_fingerprint: PLAN,
    control_migration: { path: CONTROL_MIGRATION, sha256: fileSha(CONTROL_MIGRATION) },
    preflight_migration: { path: PREFLIGHT_MIGRATION, sha256: fileSha(PREFLIGHT_MIGRATION) },
    project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid",
    host_allowlist: ["ra004-local.invalid"], ...overrides,
  };
}

function authorization(overrides = {}) {
  const value = {
    schema_version: "ra-004-staging-preflight-authorization-execution-v1", status: "TEST_ONLY_AUTHORIZED", task_id: "RA-004",
    baseline_sha: BASELINE, decision_fingerprint: CURRENT_DECISION_FINGERPRINT, plan_fingerprint: PLAN,
    control_migration: { path: CONTROL_MIGRATION, sha256: fileSha(CONTROL_MIGRATION) },
    preflight_migration: { path: PREFLIGHT_MIGRATION, sha256: fileSha(PREFLIGHT_MIGRATION) },
    target: { environment: "STAGING", project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid", host_allowlist: ["ra004-local.invalid"], retailer: { name: "10 Reps", slug: "10-reps" }, ledger: { count: 3, fingerprint: "a".repeat(64) } },
    operator: "fixture-operator", credential_issuer: "fixture-issuer",
    window: { starts_at: "2026-09-25T11:50:00.000Z", expires_at: "2026-09-25T12:20:00.000Z" },
    credential_design: { role_name: "ra004_local_fixture_login", environment: "STAGING_ONLY", rpc_name: "public.read_ra004_staging_preflight_v1", maximum_attempts: 1, maximum_ttl_minutes: 30, automatic_retry: false, service_role: false, table_privileges: false, sequence_privileges: false, dml: false, ddl: false, mutation_rpc: false },
    evidence_store: { store_identifier: "ra004-local-write-once-fixture", required_private: true, required_encryption: true, required_write_once: true, required_access_audit: true, required_readback: true, raw_retention_days: 90, derived_retention_days: 90 },
    authorization_fingerprint: "0".repeat(64), ...overrides,
  };
  value.authorization_fingerprint = authorizationFingerprint(value);
  return value;
}

function fixture() { return JSON.parse(fs.readFileSync(FIXTURE, "utf8")); }
function transport(overrides = {}) {
  const data = fixture();
  return {
    async readProjectIdentity() { return clone(data.project_identity); },
    async readEvidenceStoreMetadata() { return clone(data.evidence_store); },
    async callMetadataRpc(request) { return { function_name: request.function_name, session_user: "ra004_local_fixture_login", transaction_read_only: true, data: clone(data.metadata) }; },
    async revoke() { return { access_revoked: true }; },
    async close() { return { connection_closed: true }; },
    ...overrides,
  };
}
function bundle(custom = transport()) {
  return createClosedProvider({ configuration: { environment: "STAGING", project_reference: "ra004-local-synthetic", canonical_host: "ra004-local.invalid", host_allowlist: ["ra004-local.invalid"], expected_session_user: "ra004_local_fixture_login" }, transport: custom });
}
function tempOutput(label = "report.json") { const dir = fs.mkdtempSync(path.join(ROOT, "tmp", "ra004-preflight-unit-")); return { dir, output: path.join(dir, label) }; }
async function positive(options = {}) {
  const target = tempOutput(options.label); try { return await runPreflight({ authorization: options.authorization || authorization(), expected: options.expected || expected(), providerBundle: options.providerBundle || bundle(), outputPath: target.output, now: options.now || NOW, evidenceOptions: options.evidenceOptions }); }
  finally { fs.rmSync(target.dir, { recursive: true, force: true }); }
}
function reseal(value) { value.authorization_fingerprint = authorizationFingerprint(value); return value; }
function metadataReseal(value) { value.metadata_fingerprint = "0".repeat(64); value.metadata_fingerprint = sha256(postgresJsonbText(value)); return value; }

function fakeClient(response, capture = {}, failure) {
  return class FakeClient {
    constructor(options) { capture.options = options; capture.queries = []; capture.end_count = 0; }
    async connect() { capture.connect_count = (capture.connect_count || 0) + 1; }
    async query(query) {
      capture.queries.push(query);
      if (failure && typeof query === "object") throw failure;
      if (typeof query === "string") return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [response] };
    }
    async end() { capture.end_count += 1; }
  };
}

test("synthetic happy path seals report, readback and revoke receipt with full counters", async () => {
  const result = await positive();
  assert.equal(result.report.status, "METADATA_CAPTURED_PENDING_REVOKE"); assert.equal(result.receipt.status, "REVOKED_AND_CLOSED");
  assert.deepEqual(Object.keys(result.receipt.capability_counters).sort(), ["close","connection","evidence_store","metadata_rpc","prohibited","project_identity","retry","revoke"].sort());
  for (const name of ["project_identity","evidence_store","connection","metadata_rpc","revoke","close"]) assert.equal(result.receipt.capability_counters[name].performed_count, 1);
  for (const name of ["retry","prohibited"]) assert.equal(result.receipt.capability_counters[name].attempt_count, 0);
});

test("bounded live preflight transport performs one exact read-only RPC and proves separate issuer revoke", async () => {
  const data = fixture();
  const runnerProcessId = 41001;
  const issuerProcessId = 41002;
  const capture = {};
  let revokeRequest;
  const databaseUrl = "postgresql://ra004_local_fixture_login.ra004-local-synthetic:fixture-password@aws-0.test.pooler.supabase.com:5432/postgres?sslmode=require";
  const liveAuthorization = authorization({ status: "AUTHORIZED" });
  liveAuthorization.authorization_fingerprint = authorizationFingerprint(liveAuthorization);
  const liveExpected = expected({ provider_mode: "live-read-only" });
  const liveTransport = createPreflightPostgresTransport({
    databaseUrl,
    projectReference: "ra004-local-synthetic",
    canonicalHost: "ra004-local.invalid",
    expectedSessionUser: "ra004_local_fixture_login",
    credentialId: "ra004_preflight_fixture_credential",
    projectIdentity: data.project_identity,
    evidenceStoreMetadata: data.evidence_store,
    async revokeCredential(request) {
      revokeRequest = request;
      return {
        access_revoked: true,
        credential_id: request.credential_id,
        issuer_process_id: issuerProcessId,
        runner_process_id: request.runner_process_id,
      };
    },
  }, {
    ClientClass: fakeClient({
      session_user: "ra004_local_fixture_login",
      transaction_read_only: "on",
      data: data.metadata,
    }, capture),
    runnerProcessId,
  });
  const target = tempOutput("live-report.json");
  try {
    const result = await runPreflight({
      authorization: liveAuthorization,
      expected: liveExpected,
      providerBundle: bundle(liveTransport),
      outputPath: target.output,
      now: NOW,
    });
    assert.equal(result.receipt.status, "REVOKED_AND_CLOSED");
    assert.equal(capture.connect_count, 1);
    assert.equal(capture.end_count, 1);
    assert.equal(capture.queries.filter((query) => typeof query === "object").length, 1);
    assert.match(capture.queries.find((query) => typeof query === "object").text, /read_ra004_staging_preflight_v1\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
    assert.deepEqual(revokeRequest, {
      credential_id: "ra004_preflight_fixture_credential",
      expected_session_user: "ra004_local_fixture_login",
      runner_process_id: runnerProcessId,
    });
    assert.doesNotMatch(JSON.stringify(result), /fixture-password|postgresql:\/\//);
  } finally { fs.rmSync(target.dir, { recursive: true, force: true }); }
});

test("bounded live transport rejects production, cross-project and non-session endpoints before connection", () => {
  const target = { projectReference: "ra004-local-synthetic", expectedSessionUser: "ra004_local_fixture_login" };
  assert.throws(
    () => validateDatabaseUrl("postgresql://ra004_local_fixture_login.other-project:secret@aws-0.test.pooler.supabase.com:5432/postgres", target),
    /exact staging project/,
  );
  assert.throws(
    () => validateDatabaseUrl("postgresql://ra004_local_fixture_login.ra004-local-synthetic:secret@production.pooler.supabase.com:5432/postgres", target),
    /production database target/,
  );
  assert.throws(
    () => validateDatabaseUrl("postgresql://ra004_local_fixture_login.ra004-local-synthetic:secret@aws-0.test.pooler.supabase.com:6543/postgres", target),
    /closed PostgreSQL endpoint/,
  );
});

test("bounded live transport rejects a revoke claim from the runner process", () => {
  assert.throws(() => validateRevokeReceipt({
    access_revoked: true,
    credential_id: "ra004_preflight_fixture_credential",
    issuer_process_id: 41001,
    runner_process_id: 41001,
  }, { credentialId: "ra004_preflight_fixture_credential", runnerProcessId: 41001 }), /separate issuer/);
});

test("bounded live preflight transport redacts database credentials from driver failures", async () => {
  const data = fixture();
  const secret = "transport-secret-value";
  const liveTransport = createPreflightPostgresTransport({
    databaseUrl: `postgresql://ra004_local_fixture_login.ra004-local-synthetic:${secret}@aws-0.test.pooler.supabase.com:5432/postgres`,
    projectReference: "ra004-local-synthetic",
    canonicalHost: "ra004-local.invalid",
    expectedSessionUser: "ra004_local_fixture_login",
    credentialId: "ra004_preflight_fixture_credential",
    projectIdentity: data.project_identity,
    evidenceStoreMetadata: data.evidence_store,
    async revokeCredential(request) { return { access_revoked: true, credential_id: request.credential_id, issuer_process_id: 2, runner_process_id: request.runner_process_id }; },
  }, {
    ClientClass: fakeClient({}, {}, new Error(`connection failed ${`postgresql://user:${secret}@db.invalid/postgres`}`)),
    runnerProcessId: 1,
  });
  const request = {
    function_name: "public.read_ra004_staging_preflight_v1",
    parameters: {
      p_environment: "STAGING", p_retailer_name: "10 Reps", p_retailer_slug: "10-reps",
      p_expected_ledger_count: 3, p_expected_ledger_fingerprint: "a".repeat(64),
      p_expected_session_user: "ra004_local_fixture_login", p_max_bytes: 131072,
    },
  };
  await assert.rejects(() => liveTransport.callMetadataRpc(request), (error) => !error.message.includes(secret) && error.message.includes("[REDACTED]"));
});

test("bounded live transport has no environment, file, workflow or general SQL loader", () => {
  const source = fs.readFileSync(path.join(__dirname, "lib/retailer-offer-sync/ra004-bounded-live-transport-v1.js"), "utf8");
  assert.doesNotMatch(source, /process\.env|node:fs|readFile|writeFile|globalThis\.fetch|child_process|workflow|service[_-]?role/i);
  assert.doesNotMatch(source, /\.(?:insert|update|upsert|delete)\s*\(/i);
});

test("current NOT_AUTHORIZED manifest stops before the first capability attempt", async () => {
  let touched = false;
  const current = JSON.parse(fs.readFileSync(CURRENT_MANIFEST, "utf8"));
  await assert.rejects(() => runPreflight({ authorization: current, expected: expected(), providerBundle: { get provider() { touched = true; return null; } }, outputPath: "unused", now: NOW }), /RA004_PREFLIGHT_UNAUTHORIZED/);
  assert.equal(touched, false);
});

for (const [label, mutate, pattern] of [
  ["missing authorization", () => null, /UNAUTHORIZED/],
  ["expired authorization", (a) => reseal({ ...a, window: { ...a.window, expires_at: "2026-09-25T11:59:59.000Z" } }), /window/],
  ["decision fingerprint mismatch", (a) => reseal({ ...a, decision_fingerprint: "1".repeat(64) }), /decision fingerprint/],
  ["plan fingerprint mismatch", (a) => reseal({ ...a, plan_fingerprint: "2".repeat(64) }), /plan fingerprint/],
  ["baseline mismatch", (a) => reseal({ ...a, baseline_sha: "1".repeat(40) }), /baseline/],
  ["migration SHA mismatch", (a) => reseal({ ...a, control_migration: { ...a.control_migration, sha256: "3".repeat(64) } }), /migration SHA/],
  ["missing host allowlist", (a) => reseal({ ...a, target: { ...a.target, host_allowlist: [] } }), /allowlist/],
  ["production target", (a) => reseal({ ...a, target: { ...a.target, project_reference: "production-project", canonical_host: "production.invalid", host_allowlist: ["production.invalid"] } }), /production/],
  ["production host", (a) => reseal({ ...a, target: { ...a.target, canonical_host: "production.example.com", host_allowlist: ["production.example.com"] } }), /production/],
  ["localhost", (a) => reseal({ ...a, target: { ...a.target, canonical_host: "localhost.local", host_allowlist: ["localhost.local"] } }), /public DNS/],
  ["private IP", (a) => reseal({ ...a, target: { ...a.target, canonical_host: "10.0.0.1", host_allowlist: ["10.0.0.1"] } }), /public DNS/],
  ["host with protocol", (a) => reseal({ ...a, target: { ...a.target, canonical_host: "https://staging.example.com", host_allowlist: ["https://staging.example.com"] } }), /public DNS/],
  ["host with credentials", (a) => reseal({ ...a, target: { ...a.target, canonical_host: "user:pass@staging.example.com", host_allowlist: ["user:pass@staging.example.com"] } }), /public DNS/],
  ["unknown target", (a) => reseal({ ...a, target: { ...a.target, project_reference: "unknown-project" } }), /unknown target/],
  ["missing operator", (a) => reseal({ ...a, operator: "" }), /operator/],
  ["missing issuer", (a) => reseal({ ...a, credential_issuer: "" }), /issuer/],
  ["window above 30 minutes", (a) => reseal({ ...a, window: { starts_at: "2026-09-25T11:40:00.000Z", expires_at: "2026-09-25T12:20:01.000Z" } }), /window/],
  ["wide credential", (a) => reseal({ ...a, credential_design: { ...a.credential_design, table_privileges: true } }), /credential/],
  ["zero credential TTL", (a) => reseal({ ...a, credential_design: { ...a.credential_design, maximum_ttl_minutes: 0 } }), /credential/],
  ["forbidden role", (a) => reseal({ ...a, credential_design: { ...a.credential_design, role_name: "service_role" } }), /credential/],
  ["missing evidence store", (a) => { const b=clone(a); delete b.evidence_store; return b; }, /fields are not closed/],
  ["unknown authorization field", (a) => ({ ...a, extra: true }), /fields are not closed/],
  ["non-UTC authorization timezone", (a) => reseal({ ...a, window: { ...a.window, starts_at: "2026-09-25T12:50:00+01:00" } }), /UTC/],
]) test(label, () => assert.throws(() => validateAuthorization(mutate(authorization()), expected(), NOW), pattern));

test("actual migration bytes are checked after authorization and before capabilities", async () => {
  const wrongExpected = expected({ control_migration: { path: CONTROL_MIGRATION, sha256: "f".repeat(64) } });
  const auth = authorization({ control_migration: wrongExpected.control_migration }); auth.authorization_fingerprint = authorizationFingerprint(auth);
  const providerBundle = bundle();
  await assert.rejects(() => runPreflight({ authorization: auth, expected: wrongExpected, providerBundle, outputPath: tempOutput().output, now: NOW }), /MIGRATION_SHA_MISMATCH/);
  assert.equal(providerBundle.snapshotCounters().evidence_store.attempt_count, 0);
});

test("second project identity read is denied and counted", async () => { const b=bundle(); await b.provider.readProjectIdentity(); await assert.rejects(() => b.provider.readProjectIdentity(), /CAPABILITY_LIMIT/); assert.deepEqual(b.snapshotCounters().project_identity,{attempt_count:2,performed_count:1,denied_count:1}); });
test("second connection and RPC are denied and counted", async () => { const b=bundle(); const p={p_expected_session_user:"ra004_local_fixture_login"}; await b.provider.callMetadataRpc(p); await assert.rejects(() => b.provider.callMetadataRpc(p), /CONNECTION_LIMIT/); assert.equal(b.snapshotCounters().connection.denied_count,1); assert.equal(b.snapshotCounters().metadata_rpc.denied_count,1); });
test("arbitrary RPC, retry, SQL, mutation, secret loader and workflow transport methods are rejected", () => {
  for (const method of ["rpc","retry","query","insert","loadSecret","dispatchWorkflow"]) { const candidate=transport(); candidate[method]=async()=>{}; assert.throws(() => bundle(candidate), /CAPABILITY_BLOCKED/); }
});
test("provider has only the four approved methods", () => assert.deepEqual(Object.keys(bundle().provider).sort(), ["callMetadataRpc","readEvidenceStoreMetadata","readProjectIdentity","revokeAndClose"].sort()));

test("secret-shaped RPC output is rejected after fingerprint verification", async () => {
  const syntheticToken=["Bea","rer ","abcdefghijklmnop"].join("");
  const custom=transport({ async callMetadataRpc(request) { const data=fixture().metadata; data.q4_objects[0].token=syntheticToken; metadataReseal(data); return {function_name:request.function_name,session_user:"ra004_local_fixture_login",transaction_read_only:true,data}; } });
  await assert.rejects(() => positive({providerBundle:bundle(custom)}), /METADATA_INVALID/);
});
test("closed metadata schema rejects an unknown root field", () => { const data=fixture().metadata; data.extra=true; assert.throws(() => validateMetadata(data), /fields are not closed/); });
test("closed metadata runtime rejects nested drift, unsafe roles, policy drift and unsafe numbers", () => {
  for (const mutate of [
    (data)=>{data.q4_objects[0].extra=true;},
    (data)=>{data.q5_functions[0].search_path=["search_path=public"];},
    (data)=>{data.q6_roles.find((role)=>role.role_name==="ra004_staging_preflight_owner").rolsuper=true;},
    (data)=>{data.q7_acl_rls.find((row)=>row.policy_name==="ra004_staging_preflight_retailer_read_v1").policy_roles=["PUBLIC"];},
    (data)=>{data.q7_acl_rls.find((row)=>row.policy_name==="ra004_staging_preflight_retailer_read_v1").policy_using="true";},
    (data)=>{data.q3_migration_ledger.ordered_ledger_count=Number.POSITIVE_INFINITY;},
  ]) { const data=fixture().metadata; mutate(data); metadataReseal(data); assert.throws(()=>validateMetadata(data,"ra004_local_fixture_login"),/METADATA_INVALID/); }
});
test("Q1 and Q8 fingerprints are recomputed instead of trusted", () => {
  const data=fixture();
  data.project_identity.project_reference="changed-project";
  assert.throws(()=>validateProjectIdentity(data.project_identity),/identity mismatch/);
  data.evidence_store.approved_by="changed-custodian";
  assert.throws(()=>validateEvidenceStore(data.evidence_store),/not approved/);
});
test("capability counters reject NaN, infinity, unsafe ranges and forged arithmetic", () => {
  const base={project_identity:{attempt_count:0,performed_count:0,denied_count:0},evidence_store:{attempt_count:0,performed_count:0,denied_count:0},connection:{attempt_count:0,performed_count:0,denied_count:0},metadata_rpc:{attempt_count:0,performed_count:0,denied_count:0},revoke:{attempt_count:0,performed_count:0,denied_count:0},close:{attempt_count:0,performed_count:0,denied_count:0},retry:{attempt_count:0,performed_count:0,denied_count:0},prohibited:{attempt_count:0,performed_count:0,denied_count:0}};
  for(const value of [NaN,Infinity,Number.MAX_SAFE_INTEGER,2]){const changed=clone(base);changed.retry.attempt_count=value;assert.throws(()=>validateCounters(changed),/counter retry/);}
  const forged=clone(base);forged.retry.attempt_count=1;assert.throws(()=>validateCounters(forged),/counter retry/);
});
test("nested tokens, passwords, connection strings, headers and cookies are redacted or rejected", () => {
  const syntheticAuthorization=["Bea","rer ","abcdefghijklmnop"].join("");
  const value={token:"abc",nested:[{password:"def"},{authorization_header:syntheticAuthorization},{cookie:"sid=abc"},{safe:"postgres://user:pass@example.invalid/db"}]};
  const redacted=redact(value); assert.equal(redacted.token,"[REDACTED]"); assert.equal(redacted.nested[0].password,"[REDACTED]"); assert.equal(redacted.nested[1].authorization_header,"[REDACTED]"); assert.equal(redacted.nested[2].cookie,"[REDACTED]"); assert.equal(redacted.nested[3].safe,"[REDACTED]");
});
test("write-once evidence refuses overwrite", () => { const t=tempOutput(); try { writeOnce(t.output,{safe:true}); assert.throws(() => writeOnce(t.output,{safe:true}), /OUTPUT_EXISTS/); } finally { fs.rmSync(t.dir,{recursive:true,force:true}); } });
test("failed evidence readback fails closed and still revokes", async () => { const b=bundle(); await assert.rejects(() => positive({providerBundle:b,evidenceOptions:{forceReadbackFailure:true}}), /READBACK_FAILED/); assert.equal(b.snapshotCounters().revoke.performed_count,1); assert.equal(b.snapshotCounters().close.performed_count,1); });
test("missing revoke proof fails closed while close still runs and leaves no false PASS report", async () => {
  const b=bundle(transport({async revoke(){return {access_revoked:false};}})), target=tempOutput();
  try { await assert.rejects(()=>runPreflight({authorization:authorization(),expected:expected(),providerBundle:b,outputPath:target.output,now:NOW}),/REVOKE_FAILED/); const persisted=JSON.parse(fs.readFileSync(target.output,"utf8")); assert.equal(persisted.status,"METADATA_CAPTURED_PENDING_REVOKE"); assert.equal(fs.existsSync(`${target.output}.revoke.json`),false); assert.equal(b.snapshotCounters().close.performed_count,1); }
  finally { fs.rmSync(target.dir,{recursive:true,force:true}); }
});
test("an error after the RPC still revokes and closes", async () => {
  const b=bundle(transport({async callMetadataRpc(request){const data=fixture().metadata;data.q4_objects=[];metadataReseal(data);return {function_name:request.function_name,session_user:"ra004_local_fixture_login",transaction_read_only:true,data};}}));
  await assert.rejects(()=>positive({providerBundle:b}),/METADATA_INVALID/); assert.equal(b.snapshotCounters().metadata_rpc.performed_count,1); assert.equal(b.snapshotCounters().revoke.performed_count,1); assert.equal(b.snapshotCounters().close.performed_count,1);
});
test("transport errors cannot leak passwords, authorization headers or cookies", async () => {
  const syntheticAuthorization=["authorization: Bea","rer ","abcdefghijklmnop"].join("");
  for (const secret of ["password=hunter2", syntheticAuthorization, "cookie=session-secret"]) {
    const b=bundle(transport({async callMetadataRpc(){throw new Error(`source failed ${secret}`);}}));
    await assert.rejects(()=>positive({providerBundle:b}),(error)=>!String(error.message).includes(secret.split(/[=:]/).at(-1).trim())&&String(error.message).includes("[REDACTED]"));
    assert.equal(b.snapshotCounters().revoke.performed_count,1); assert.equal(b.snapshotCounters().close.performed_count,1);
  }
});
test("forged provider counters cannot be sealed", async () => {
  const b=bundle(), forged={provider:b.provider,snapshotCounters:()=>{const counters=b.snapshotCounters();counters.retry={attempt_count:1,performed_count:0,denied_count:0};return counters;}};
  await assert.rejects(()=>positive({providerBundle:forged}),/counter retry/);
});

test("canonical fingerprints ignore key order, LF and CRLF", () => {
  const auth=authorization(); const reversed=Object.fromEntries(Object.entries(auth).reverse()); assert.equal(authorizationFingerprint(auth),authorizationFingerprint(reversed));
  const lf=JSON.stringify(auth,null,2), crlf=lf.replace(/\n/g,"\r\n"); assert.equal(authorizationFingerprint(JSON.parse(lf)),authorizationFingerprint(JSON.parse(crlf)));
});
test("same injected snapshot and instant produce deterministic report fingerprints", async () => { const first=await positive(); const second=await positive(); assert.equal(first.report.report_fingerprint,second.report.report_fingerprint); assert.equal(first.receipt.receipt_fingerprint,second.receipt.receipt_fingerprint); });
test("changed metadata is not accepted under the old fingerprint", () => { const data=fixture().metadata; data.q2_retailer.id="15"; assert.throws(()=>validateMetadata(data),/fingerprint mismatch/); });

test("all six versioned JSON schemas are closed and parseable", () => {
  const schemaRoot=path.join(__dirname,"lib/retailer-offer-sync/ra004-staging-preflight-v1/schemas"); const files=fs.readdirSync(schemaRoot).filter((name)=>name.endsWith(".schema.json")); assert.equal(files.length,6);
  function inspect(node,at){if(!node||typeof node!=="object")return; if(node.type==="string"&&!Object.hasOwn(node,"const")&&!Object.hasOwn(node,"pattern"))assert.ok(Number.isSafeInteger(node.maxLength),`${at} string is unbounded`); if(node.type==="integer"&&!Object.hasOwn(node,"const")){assert.ok(Number.isSafeInteger(node.minimum),`${at} integer minimum missing`);assert.ok(Number.isSafeInteger(node.maximum),`${at} integer maximum missing`);} for(const [key,child] of Object.entries(node))inspect(child,`${at}.${key}`);}
  for(const file of files){ const schema=JSON.parse(fs.readFileSync(path.join(schemaRoot,file),"utf8")); assert.equal(schema.type,"object"); assert.equal(schema.additionalProperties,false); assert.ok(schema.required.length>0); inspect(schema,file); }
});

function cliArgs(authFile, output) { const e=expected(); return [`--authorization=${authFile}`,`--output=${output}`,`--baseline=${BASELINE}`,`--decision-fingerprint=${CURRENT_DECISION_FINGERPRINT}`,`--plan-fingerprint=${PLAN}`,`--control-migration-sha=${e.control_migration.sha256}`,`--preflight-migration-sha=${e.preflight_migration.sha256}`,"--project-reference=ra004-local-synthetic","--canonical-host=ra004-local.invalid","--host-allowlist=ra004-local.invalid","--retailer-name=10 Reps","--retailer-slug=10-reps","--provider-mode=fixture",`--fixture=${FIXTURE}`]; }
test("CLI rejects the current authorization pack before transport construction", async () => { const t=tempOutput(); try { await assert.rejects(()=>runCli(cliArgs(CURRENT_MANIFEST,t.output),{get transport(){assert.fail("transport touched");}}),/UNAUTHORIZED/); } finally { fs.rmSync(t.dir,{recursive:true,force:true}); } });
test("CLI requires an authorization manifest and explicit target values", async () => await assert.rejects(()=>runCli([]),/missing --authorization/));
test("fixture CLI writes only local ignored evidence and revoke receipt", async () => { const t=tempOutput(), authFile=path.join(t.dir,"authorization.json"); fs.writeFileSync(authFile,JSON.stringify(authorization())); try { const result=await runCli(cliArgs(authFile,t.output),{now:NOW}); assert.equal(result.receipt.status,"REVOKED_AND_CLOSED"); assert.ok(fs.existsSync(t.output)); assert.ok(fs.existsSync(`${t.output}.revoke.json`)); } finally { fs.rmSync(t.dir,{recursive:true,force:true}); } });
test("CLI help, malformed arguments and authorization paths disclose no supplied secret", () => {
  assert.throws(()=>parseArgs(["--help"]),/invalid or duplicate argument/);
  const syntheticToken=["--unknown=Bea","rer ","abcdefghijklmnop"].join("");
  assert.throws(()=>parseArgs([syntheticToken]),(error)=>!String(error.message).includes("abcdefghijklmnop"));
  assert.throws(()=>readAuthorization(path.join(os.tmpdir(),"credentials.json")),/reviewed manifest or a test file below tmp/);
});

test("fixture transport cannot escape its local tracked fixture directory", () => assert.throws(()=>new LocalFixtureTransport(path.join(os.tmpdir(),"fixture.json")),/FIXTURE_BLOCKED/));

test("only the reviewed bounded transport imports the preflight contract", () => {
  const roots=["app",".github","config","scripts"];
  const findings=[];
  function walk(directory){ if(!fs.existsSync(directory))return; for(const entry of fs.readdirSync(directory,{withFileTypes:true})){ const absolute=path.join(directory,entry.name); if(entry.isDirectory()){ if(absolute.includes(path.join("scripts","lib","retailer-offer-sync","ra004-staging-preflight-v1"))||absolute.includes(path.join("scripts","test-fixtures","ra004-staging-preflight-v1")))continue; walk(absolute); } else if(/\.(?:js|jsx|ts|tsx|yml|yaml|json)$/.test(entry.name)&&!/^ra004-staging-preflight(?:\.integration)?\.test\.js$/.test(entry.name)&&entry.name!=="ra004-staging-preflight.js"){ const body=fs.readFileSync(absolute,"utf8"); if(/(?:require\(|from\s+)["'][^"']*ra004-staging-preflight/i.test(body))findings.push(path.relative(ROOT,absolute)); } } }
  for(const root of roots)walk(path.join(ROOT,root));
  assert.deepEqual(findings,[path.join("scripts","lib","retailer-offer-sync","ra004-bounded-live-transport-v1.js")]);
});
