const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { authorizationFingerprint, validateAuthorization } = require("./lib/retailer-offer-sync/control-state-export-v1/authorization");
const { createReadOnlyCapability, exportControlState, redact, writeArtifact } = require("./lib/retailer-offer-sync/control-state-export-v1/exporter");
const { FixtureControlStateProvider, createLiveReadOnlyProvider } = require("./lib/retailer-offer-sync/control-state-export-v1/providers");
const { PROHIBITED_OPERATIONS, SOURCE_NAMES, SOURCE_REGISTRY } = require("./lib/retailer-offer-sync/control-state-export-v1/schema");
const { run: runCli } = require("./retailer-control-state-export");

const ROOT = path.resolve(__dirname, "..");
const BASELINE = "843ed987ff99a781ca04e16b2461a9eb4aa37b4e";
const NOW = "2026-09-24T12:00:00.000Z";
const FIXTURE_PATH = path.join(__dirname, "test-fixtures/retailer-control-state-export-v1/complete-clear.json");
const baseFixture = () => JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
function authorization(overrides = {}) {
  const value = {
    version: "control-state-export-authorization-v1",
    status: "TEST_ONLY",
    retailer_id: "14",
    retailer_name: "10 Reps",
    allowed_scope: [...SOURCE_NAMES],
    baseline_sha: BASELINE,
    task_id: "RA-004-FIXTURE-TEST",
    valid_from: "2026-09-24T11:00:00.000Z",
    expires_at: "2026-09-24T13:00:00.000Z",
    operation: "READ_ONLY_CONTROL_STATE_EXPORT",
    prohibited_operations: [...PROHIBITED_OPERATIONS],
    owner_consent: "TEST_ONLY_FIXTURE",
    ...overrides,
  };
  value.authorization_fingerprint = authorizationFingerprint(value);
  return value;
}
function liveAuthorization(overrides = {}) {
  return authorization({ status: "AUTHORIZED", owner_consent: "OWNER_APPROVED", task_id: "RA-004-LOCAL-CONTRACT-TEST", ...overrides });
}
const liveConfiguration = (overrides = {}) => ({
  provider_id: "transactional-rpc-v1",
  credential_type: "DEDICATED_CONTROL_STATE_EXPORTER",
  rpc_name: "public.read_retailer_control_state_v1",
  expected_session_user: "retailer_control_state_exporter_login",
  ...overrides,
});
function request(overrides = {}) {
  return { retailer_id: "14", retailer_name: "10 Reps", baseline_sha: BASELINE, provider_mode: "fixture", now: NOW, ...overrides };
}
async function run(fixture = baseFixture(), options = {}) {
  return exportControlState({ provider: new FixtureControlStateProvider(fixture, options.faults), authorization: options.authorization || authorization(), ...request(options.request) });
}
function add(source, record, fixture = baseFixture()) { fixture.sources[source].push(record); return fixture; }
const scoped = (id, extra = {}) => ({ id, scope: "RETAILER", retailer_ids: ["14"], ...extra });

test("no active control state is clear only for separate shadow authorization", async () => {
  const report = await run();
  assert.equal(report.final_assessment, "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION");
  assert.equal(report.write_attempt_count, 0);
  assert.equal(report.mutation_attempt_count, 0);
  assert.equal(report.sources_unavailable.length, 0);
});
test("active plan blocks", async () => assert.equal((await run(add("control_plans", scoped("active", { status: "PLANNED", expires_at: "2026-09-25T00:00:00.000Z" })))).final_assessment, "BLOCKED_ACTIVE_PLAN"));
test("incomplete plan blocks", async () => assert.equal((await run(add("control_plans", scoped("incomplete", { status: "INCOMPLETE" })))).final_assessment, "BLOCKED_INCOMPLETE_STATE"));
test("expired plan is exported without becoming active", async () => { const r = await run(); assert.equal(r.expired_plans.length, 2); assert.equal(r.active_plans.length, 0); });
test("recovery plan blocks", async () => assert.equal((await run(add("recovery_state", scoped("recovery", { status: "OPEN" })))).final_assessment, "BLOCKED_RECOVERY"));
test("active session blocks", async () => assert.equal((await run(add("sessions", scoped("session-open", { status: "OPEN", heartbeat_status: "CURRENT", heartbeat_expires_at: "2026-09-25T00:00:00.000Z" })))).final_assessment, "BLOCKED_ACTIVE_SESSION"));
test("stale session is identified", async () => { const r = await run(add("sessions", scoped("session-stale", { status: "OPEN", heartbeat_status: "STALE" }))); assert.equal(r.stale_sessions[0].id, "session-stale"); });
test("active lock blocks", async () => assert.equal((await run(add("locks", scoped("lock-active", { status: "ACTIVE", expires_at: "2026-09-25T00:00:00.000Z" })))).final_assessment, "BLOCKED_LOCK"));
test("expired lock is exported", async () => assert.equal((await run()).expired_locks.length, 1));
test("orphaned lock blocks", async () => assert.equal((await run(add("locks", scoped("lock-orphan", { status: "ORPHANED" })))).final_assessment, "BLOCKED_LOCK"));
test("pending approval blocks", async () => assert.equal((await run(add("approval_contracts", scoped("approval-pending", { status: "PENDING", expires_at: "2026-09-25T00:00:00.000Z" })))).final_assessment, "BLOCKED_APPROVAL"));
test("unused approval blocks", async () => assert.equal((await run(add("approval_contracts", scoped("approval-unused", { status: "APPROVED", expires_at: "2026-09-25T00:00:00.000Z" })))).final_assessment, "BLOCKED_APPROVAL"));
test("expired approval is exported", async () => assert.equal((await run()).expired_approvals.length, 1));
test("consumed approval is exported", async () => assert.equal((await run()).consumed_approvals.length, 1));
test("revoked approval is exported", async () => assert.equal((await run()).revoked_approvals.length, 1));
test("last apply is exported", async () => assert.equal((await run()).last_apply.id, "apply-1"));
test("last postflight is exported", async () => assert.equal((await run()).last_postflight.id, "postflight-1"));
test("last watchdog result is exported", async () => assert.equal((await run()).last_watchdog_result.id, "watchdog-1"));
test("global conflict blocks with reason", async () => { const r = await run(add("global_conflicts", scoped("global", { scope: "GLOBAL", retailer_ids: [], reason_code: "GLOBAL_EXECUTOR_BUSY", source_reference: "executor:shared" }))); assert.equal(r.final_assessment, "BLOCKED_UNKNOWN"); assert.ok(r.blocking_reasons.includes("GLOBAL_EXECUTOR_BUSY")); });
test("cross-retailer conflict includes 10 Reps", async () => { const r = await run(add("global_conflicts", scoped("cross", { retailer_ids: ["7", "14"], reason_code: "CROSS_RETAILER_BATCH", source_reference: "batch:shared" }))); assert.equal(r.overlapping_scope_conflicts[0].id, "cross"); });
test("parent and child plans are preserved", async () => { const f = add("control_plans", scoped("parent", { status: "COMPLETED" })); f.sources.plan_items.push(scoped("child", { plan_id: "parent", status: "COMPLETED" })); const r = await run(f); assert.equal(r.record_counts.plan_items, 2); assert.equal(r.source_records.plan_items.some((row) => row.id === "child"), true); });
test("equivalent active plan remains blocking", async () => { const f = add("control_plans", scoped("equivalent-a", { status: "PLANNED", expires_at: "2026-09-25T00:00:00.000Z", source_fingerprint: "c".repeat(64) })); f.sources.control_plans.push(scoped("equivalent-b", { status: "PLANNED", expires_at: "2026-09-25T00:00:00.000Z", source_fingerprint: "c".repeat(64) })); const r = await run(f); assert.equal(r.active_plans.length, 2); assert.equal(r.overlapping_scope_conflicts.some((row) => row.reason_code === "EQUIVALENT_ACTIVE_PLAN"), true); });
test("pagination reads more than one page completely", async () => { const f = baseFixture(); f.sources.plan_items = Array.from({ length: 205 }, (_, i) => scoped(`item-${String(i).padStart(3, "0")}`, { plan_id: "historical", status: "COMPLETED" })); const r = await run(f); assert.equal(r.pagination_evidence.plan_items.page_count, 3); assert.equal(r.record_counts.plan_items, 205); });
test("repeated cursor fails closed", async () => { const f = baseFixture(); f.sources.plan_items = Array.from({ length: 201 }, (_, i) => scoped(`p-${i}`)); await assert.rejects(() => run(f, { faults: { repeatedCursorSource: "plan_items" } }), /CONTROL_EXPORT_CURSOR_REPEATED/); });
test("missing page fails closed", async () => { const f = baseFixture(); f.sources.plan_items = Array.from({ length: 101 }, (_, i) => scoped(`p-${i}`)); await assert.rejects(() => run(f, { faults: { missingPageSource: "plan_items" } }), /CONTROL_EXPORT_PAGE_MISSING/); });
test("changing total count fails closed", async () => { const f = baseFixture(); f.sources.plan_items = Array.from({ length: 101 }, (_, i) => scoped(`p-${i}`)); await assert.rejects(() => run(f, { faults: { totalChangeSource: "plan_items" } }), /CONTROL_EXPORT_TOTAL_COUNT_CHANGED/); });
test("duplicate record fails closed", async () => { const f = baseFixture(); f.sources.plan_items.push(clone(f.sources.plan_items[0])); await assert.rejects(() => run(f), /CONTROL_EXPORT_DUPLICATE_RECORD/); });
test("unavailable mandatory source yields incomplete export", async () => { const r = await run(baseFixture(), { faults: { unavailableSource: "locks" } }); assert.equal(r.final_assessment, "BLOCKED_INCOMPLETE_EXPORT"); assert.equal(r.completeness_status, "INCOMPLETE"); });
test("capture-window state change blocks", async () => { const r = await run(baseFixture(), { faults: { inconsistentSource: "sessions" } }); assert.equal(r.final_assessment, "BLOCKED_INCONSISTENT_SNAPSHOT"); });
test("missing authorization is rejected", async () => await assert.rejects(() => exportControlState({ provider: new FixtureControlStateProvider(baseFixture()), authorization: null, ...request() }), /CONTROL_EXPORT_UNAUTHORIZED/));
test("RA-004 NOT_AUTHORIZED shadow manifest cannot authorize exporter", () => { const shadow = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/retailer-automation/evidence/RA-004-shadow-plan.json"), "utf8")); assert.throws(() => validateAuthorization(shadow, request(), NOW), /CONTROL_EXPORT_UNAUTHORIZED/); });
test("expired authorization is rejected", async () => await assert.rejects(() => run(baseFixture(), { authorization: authorization({ expires_at: "2026-09-24T11:30:00.000Z" }) }), /CONTROL_EXPORT_UNAUTHORIZED/));
test("retailer mismatch is rejected", async () => await assert.rejects(() => run(baseFixture(), { authorization: authorization({ retailer_id: "7" }) }), /CONTROL_EXPORT_UNAUTHORIZED/));
test("baseline mismatch is rejected", async () => await assert.rejects(() => run(baseFixture(), { authorization: authorization({ baseline_sha: "1".repeat(40) }) }), /CONTROL_EXPORT_UNAUTHORIZED/));
test("authorization mutation after fingerprint is rejected", async () => { const a = authorization(); a.allowed_scope = a.allowed_scope.slice(1); await assert.rejects(() => run(baseFixture(), { authorization: a }), /CONTROL_EXPORT_UNAUTHORIZED/); });

for (const method of ["insert", "update", "upsert", "delete", "rpc"]) {
  test(`${method} capability is rejected before invocation`, () => {
    let invoked = false;
    const provider = new FixtureControlStateProvider(baseFixture());
    provider[method] = () => { invoked = true; };
    assert.throws(() => createReadOnlyCapability(provider), /CONTROL_EXPORT_PROVIDER_MUTATION_CAPABILITY/);
    assert.equal(invoked, false);
  });
}
test("service-role provider is rejected", () => { const p = new FixtureControlStateProvider(baseFixture()); p.describe = () => ({ mode: "fixture", credential_type: "NONE", service_role: true, mutation_capabilities: [] }); assert.throws(() => createReadOnlyCapability(p), /CONTROL_EXPORT_PROVIDER_MUTATION_CAPABILITY/); });
test("existing artifact path is never overwritten", async () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ra004-export-")); const file = path.join(dir, "state.json"); fs.writeFileSync(file, "owner-data"); await assert.rejects(async () => writeArtifact(file, await run()), /CONTROL_EXPORT_OUTPUT_EXISTS/); assert.equal(fs.readFileSync(file, "utf8"), "owner-data"); });
test("secret redaction removes sensitive keys and values", () => { const value = redact({ token: "abc", nested: { note: "Bearer abc.def", safe: "ok", connection_string: "postgres://user:pass@example/db" } }); assert.equal(value.token, "[REDACTED]"); assert.equal(value.nested.safe, "ok"); assert.doesNotMatch(JSON.stringify(value), /abc\.def|postgres:\/\/|user:pass/); });
test("records are sorted deterministically", async () => { const f = baseFixture(); f.sources.plan_items = [scoped("z", { plan_id: "p", status: "COMPLETED" }), scoped("a", { plan_id: "p", status: "COMPLETED" }), scoped("m", { plan_id: "p", status: "COMPLETED" })]; assert.deepEqual((await run(f)).pagination_evidence.plan_items.record_count, 3); const a = await run(f); f.sources.plan_items.reverse(); const b = await run(f); assert.equal(a.canonical_state_fingerprint, b.canonical_state_fingerprint); });
test("authorization fingerprint is stable across LF and CRLF JSON", () => { const a = authorization(); const lf = JSON.stringify(a, null, 2); const crlf = lf.replace(/\n/g, "\r\n"); assert.equal(authorizationFingerprint(JSON.parse(lf)), authorizationFingerprint(JSON.parse(crlf))); });
test("authorization and export fingerprints ignore object key order", async () => { const a = authorization(); const reversed = Object.fromEntries(Object.entries(a).reverse()); assert.equal(authorizationFingerprint(a), authorizationFingerprint(reversed)); const first = await run(); const f = baseFixture(); f.sources.apply_ledger[0] = Object.fromEntries(Object.entries(f.sources.apply_ledger[0]).reverse()); const second = await run(f); assert.equal(first.canonical_state_fingerprint, second.canonical_state_fingerprint); });
test("complete fixture export has schema v1 and safe artifact digest", async () => { const report = await run(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ra004-export-")); const result = writeArtifact(path.join(dir, "state.json"), report); assert.match(result.sha256, /^[0-9a-f]{64}$/); assert.equal(fs.statSync(result.path).size > 0, true); assert.equal(fs.readFileSync(result.sha256_path, "utf8").includes(result.sha256), true); });
test("versioned output and authorization schemas are valid closed JSON schemas", () => { for (const name of ["control-state-export-v1.schema.json", "control-state-export-authorization-v1.schema.json"]) { const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "lib/retailer-offer-sync/control-state-export-v1/schemas", name), "utf8")); assert.equal(schema.type, "object"); assert.equal(schema.additionalProperties, false); assert.ok(schema.required.length > 10); } });
test("fixture CLI writes one local artifact and detached SHA only", async () => { const parent = path.join(ROOT, "tmp", "control-state-exports"); fs.mkdirSync(parent, { recursive: true }); const dir = fs.mkdtempSync(path.join(parent, "fixture-test-")); const authPath = path.join(dir, "test-authorization.json"); const output = path.join(dir, "state.json"); fs.writeFileSync(authPath, JSON.stringify(authorization())); try { const result = await runCli(["--retailer-id=14", "--retailer-name=10 Reps", `--authorization=${authPath}`, `--output=${output}`, `--baseline=${BASELINE}`, "--provider-mode=fixture", `--fixture=${FIXTURE_PATH}`], NOW); assert.equal(fs.existsSync(result.path), true); assert.equal(fs.existsSync(result.sha256_path), true); } finally { fs.rmSync(dir, { recursive: true, force: true }); } });

test("source registry binds all eleven sources to the one approved live RPC", () => { assert.deepEqual(SOURCE_REGISTRY.map((row) => row.name), SOURCE_NAMES); assert.equal(SOURCE_REGISTRY.length, 11); assert.ok(SOURCE_REGISTRY.every((row) => row.required && row.live_interface === "public.read_retailer_control_state_v1" && row.unavailable_reason === null)); });
test("live provider cannot be constructed without authorization", () => assert.throws(() => createLiveReadOnlyProvider(), /CONTROL_EXPORT_UNAUTHORIZED/));
test("live provider requires a separately injected transport", () => assert.throws(() => createLiveReadOnlyProvider({ authorization: liveAuthorization(), providerConfiguration: liveConfiguration() }), /CONTROL_EXPORT_TRANSPORT_REQUIRED/));
test("live provider rejects service role and existing privileged role identities", () => {
  for (const credential_type of ["SERVICE_ROLE", "VALIDATOR", "APPROVER", "EXECUTOR", "DEDICATED_READ_ONLY_VALIDATOR"]) {
    assert.throws(() => createLiveReadOnlyProvider({ authorization: liveAuthorization(), providerConfiguration: liveConfiguration({ credential_type }), transport: { callReadOnlyRpc() {} } }), /CONTROL_EXPORT_PROVIDER_CONFIG_INVALID/);
  }
});
test("live provider rejects unknown RPC and broad transport capability", () => {
  assert.throws(() => createLiveReadOnlyProvider({ authorization: liveAuthorization(), providerConfiguration: liveConfiguration({ rpc_name: "public.other" }), transport: { callReadOnlyRpc() {} } }), /CONTROL_EXPORT_PROVIDER_CONFIG_INVALID/);
  assert.throws(() => createLiveReadOnlyProvider({ authorization: liveAuthorization(), providerConfiguration: liveConfiguration(), transport: { callReadOnlyRpc() {}, query() {} } }), /CONTROL_EXPORT_TRANSPORT_CAPABILITY_BLOCKED/);
});
test("live provider calls the allowlisted RPC exactly once and rejects a second read", async () => {
  let calls = 0;
  const provider = createLiveReadOnlyProvider({
    authorization: liveAuthorization(), providerConfiguration: liveConfiguration(),
    transport: { async callReadOnlyRpc(call) { calls += 1; assert.equal(call.function_name, "public.read_retailer_control_state_v1"); return { session_user: liveConfiguration().expected_session_user, transaction_read_only: true, data: {} }; } },
  });
  await provider.readSnapshot({ retailer_id: "14", retailer_name: "10 Reps", baseline_sha: BASELINE, authorization_fingerprint: "a".repeat(64), authorization_valid_until: "2026-09-24T13:00:00.000Z" });
  await assert.rejects(() => provider.readSnapshot({}), /CONTROL_EXPORT_READ_LIMIT_EXCEEDED/);
  assert.equal(calls, 1);
});
test("live exporter accepts a valid fake transactional response and fails closed on schema drift", async () => {
  const auth = liveAuthorization();
  const report = await run();
  const descriptor = {
    mode: "live-read-only", provider_id: "transactional-rpc-v1",
    credential_type: "DEDICATED_CONTROL_STATE_EXPORTER",
    session_user: liveConfiguration().expected_session_user, read_only_proven: true,
    service_role: false, mutation_capabilities: [],
    approved_interfaces: ["public.read_retailer_control_state_v1"],
  };
  const response = { ...report, authorization_fingerprint: auth.authorization_fingerprint, provider_identity: descriptor, read_attempt_count: 1 };
  const makeProvider = (data) => createLiveReadOnlyProvider({ authorization: auth, providerConfiguration: liveConfiguration(), transport: { async callReadOnlyRpc() { return { session_user: liveConfiguration().expected_session_user, transaction_read_only: true, data }; } } });
  const output = await exportControlState({ provider: makeProvider(response), authorization: auth, ...request({ provider_mode: "live-read-only" }) });
  assert.equal(output.read_attempt_count, 1);
  await assert.rejects(() => exportControlState({ provider: makeProvider({ ...response, unknown_field: true }), authorization: auth, ...request({ provider_mode: "live-read-only" }) }), /CONTROL_EXPORT_SCHEMA_INVALID/);
  await assert.rejects(() => exportControlState({ provider: makeProvider({ ...response, schema_version: "control-state-export-v2" }), authorization: auth, ...request({ provider_mode: "live-read-only" }) }), /CONTROL_EXPORT_SCHEMA_INVALID/);
});
test("prepared migration keeps read RPC static and runtime grants capability-only", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql"), "utf8");
  const body = sql.match(/create or replace function public\.read_retailer_control_state_v1[\s\S]+?\$read_state\$;\s*alter function/i)?.[0];
  assert.ok(body);
  assert.match(body, /language plpgsql\s+stable\s+security definer\s+set search_path = pg_catalog/i);
  assert.doesNotMatch(body, /\bexecute\b|\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b|\btruncate\b/i);
  assert.match(sql, /create role %I nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/i);
  assert.match(sql, /revoke all on all tables in schema public from retailer_control_state_exporter,retailer_control_state_evidence_writer/i);
  assert.match(sql, /grant execute on function public\.read_retailer_control_state_v1[\s\S]+?to retailer_control_state_exporter/i);
  assert.match(sql, /grant execute on function public\.write_retailer_control_state_evidence_v1[\s\S]+?to retailer_control_state_evidence_writer/i);
  assert.doesNotMatch(sql, /\bcreate\s+role\s+\w+\s+login\b|\bpassword\s+['"]/i);
});
test("exporter dependency closure excludes database network and production writers", () => {
  const entry = path.join(__dirname, "lib/retailer-offer-sync/control-state-export-v1/exporter.js");
  const queue = [entry]; const visited = new Set();
  while (queue.length) {
    const file = queue.pop(); if (visited.has(file)) continue; visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /require\(["'](?:pg|@supabase|node:https|node:http|node:net|node:tls)["']\)|globalThis\.fetch|process\.env|import\s*\(/);
    assert.doesNotMatch(source, /import-products|offer-refresh-postflight|approval-execution|production-role-session/);
    for (const match of source.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
      const resolved = require.resolve(path.resolve(path.dirname(file), match[1]));
      if (resolved.startsWith(path.join(__dirname, "lib"))) queue.push(resolved);
    }
  }
});
test("exporter is not wired into app workflows schedulers or production entry points", () => {
  const roots = ["app", ".github/workflows", "config"];
  for (const root of roots) {
    const directory = path.join(ROOT, root);
    const stack = [directory];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else assert.doesNotMatch(fs.readFileSync(absolute, "utf8"), /retailer-control-state-export|control-state-export-v1/);
      }
    }
  }
});
