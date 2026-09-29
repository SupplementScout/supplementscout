const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const coordinatorPath = path.join(__dirname, "ra004-staging-execution-coordinator.js");
const launcherPath = path.join(__dirname, "ra004-run-staging-interfaces-preflight-canary.ps1");
const custodianPath = path.join(__dirname, "ra004-staging-evidence-custodian.js");
const coordinator = fs.readFileSync(coordinatorPath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const custodian = fs.readFileSync(custodianPath, "utf8");
const sourceCapture = fs.readFileSync(path.join(__dirname,
  "ra004-staging-source-observation-capture.js"), "utf8");
const values = require("./ra004-staging-execution-coordinator");
const { safeFailureCode } = require("./lib/ra004-safe-failure-code");
const { normalizeTransportFailure } = require("./lib/ra004-live-transport-failure");

test("final canary is pinned to the approved staging ledger and already-applied migrations", () => {
  assert.equal(values.REF, "hxnrsyyqffztlvcrtgbf");
  assert.equal(values.API_HOST, "hxnrsyyqffztlvcrtgbf.supabase.co");
  assert.equal(values.BASELINE, "227529abc7e3adf71dd88904d1d592f1126b4f17");
  assert.equal(values.EXPECTED_LEDGER_COUNT, 99);
  assert.equal(values.EXPECTED_LEDGER_FINGERPRINT,
    "a6e7693f964925554e807602752e4630d14f537a1d9de4fe82f8433d30c307cc");
  assert.deepEqual(values.REQUIRED_APPLIED_MIGRATIONS, [
    ["20260928100000_diagnose_ra004_preflight_acl_rls.sql",
      "58aa82b328b9bb77c09b9975892042027a493254add99fb2e1dcf045303c0b0d"],
    ["20260928101000_align_ra004_control_export_provider_identity.sql",
      "4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91"],
  ]);
  assert.match(coordinator, /remote\.remoteLedger\.length === EXPECTED_LEDGER_COUNT/);
  assert.match(coordinator, /appliedIdentifiers\.has\(file\)/);
  assert.match(coordinator, /retailer\[0\]\.id === "11"/);
});

test("v3 and both prior activations are terminal and non-replayable", () => {
  const evidence = path.join(ROOT, "docs", "retailer-automation", "evidence");
  const manifest = JSON.parse(fs.readFileSync(path.join(evidence, values.ACTIVATION_MANIFEST), "utf8"));
  const closeout = JSON.parse(fs.readFileSync(path.join(evidence, values.ACTIVATION_CLOSEOUT), "utf8"));
  const terminalV2 = JSON.parse(fs.readFileSync(path.join(evidence,
    values.TERMINAL_V2_ACTIVATION_MANIFEST), "utf8"));
  const terminal = JSON.parse(fs.readFileSync(path.join(evidence,
    values.TERMINAL_ACTIVATION_MANIFEST), "utf8"));
  assert.equal(values.validateV3TerminalActivation(manifest), manifest);
  assert.throws(() => values.assertActivationExecutable(), /RA004_ACTIVATION_TERMINAL/);
  assert.throws(() => values.validateReadOnlyActivation(manifest), /RA004_/);
  assert.equal(values.validateCurrentTerminalActivation(terminalV2), terminalV2);
  assert.throws(() => values.validateReadOnlyActivation(terminalV2), /RA004_/);
  assert.equal(values.validateTerminalActivation(terminal), terminal);
  assert.throws(() => values.validateReadOnlyActivation(terminal), /RA004_/);
  assert.equal(terminal.execution.closed, true);
  assert.equal(terminal.execution.retry_authorized, false);
  assert.equal(terminal.execution.replayable, false);
  assert.deepEqual(manifest.migrations, []);
  assert.equal(manifest.migration_attempts_authorized, 0);
  assert.equal(manifest.preflight.attempts_authorized, 0);
  assert.equal(manifest.preflight.prior_status, "VERIFIED_COMPLETE");
  assert.equal(manifest.preflight.report_fingerprint,
    "b1719dbbaad328e7bc0f0dc7b24307f3b5c828fe1af43d7cad5e98aa9599f40c");
  assert.equal(manifest.canary.maximum_attempts, 1);
  assert.equal(manifest.canary.automatic_retry, false);
  assert.equal(manifest.canary.read_only, true);
  assert.equal(manifest.source_observation.maximum_transactions, 1);
  assert.equal(manifest.source_observation.required_rows, 5);
  assert.equal(manifest.source_observation.lifetime_minutes, 20);
  assert.deepEqual(manifest.source_observation.required_sources,
    ["sessions", "locks", "postflight_state", "watchdog_state", "global_conflicts"]);
  assert.equal(manifest.source_observation.same_activation_before_canary, true);
  assert.equal(manifest.status, "ATTEMPT_CONSUMED_FAILED_TERMINAL");
  assert.equal(manifest.execution.runtime_activation_id, "ra004-staging-1790674363597");
  assert.equal(manifest.execution.execution_commit, "c57c6abbb2e0e01842dd279613b4bbc1d9344966");
  assert.equal(manifest.execution.started, true);
  assert.equal(manifest.execution.migration_attempt_count, 0);
  assert.equal(manifest.execution.preflight_attempt_count, 0);
  assert.equal(manifest.execution.source_observation_transaction_count, 1);
  assert.equal(manifest.execution.source_observation_row_count, 5);
  assert.equal(manifest.execution.canary_attempt_count, 1);
  assert.equal(manifest.execution.retry_attempt_count, 0);
  assert.equal(manifest.execution.canary_final_assessment, "BLOCKED_INCOMPLETE_EXPORT");
  assert.equal(manifest.execution.canary_completeness_status, "COMPLETE");
  assert.equal(manifest.execution.canary_sources_queried, 11);
  assert.deepEqual(manifest.execution.canary_sources_unavailable, []);
  assert.equal(manifest.execution.canary_write_attempt_count, 0);
  assert.equal(manifest.execution.canary_mutation_attempt_count, 0);
  assert.equal(manifest.execution.business_data_unchanged, true);
  assert.equal(manifest.execution.evidence_store_session, "CLOSED");
  assert.equal(manifest.execution.cleanup, "COMPLETE");
  assert.equal(manifest.execution.credentials_revoked, 2);
  assert.equal(manifest.execution.roles_absent, true);
  assert.equal(manifest.execution.memberships_absent, true);
  assert.equal(manifest.execution.active_backends_absent, true);
  assert.equal(manifest.execution.closed, true);
  assert.equal(manifest.execution.retry_authorized, false);
  assert.equal(manifest.execution.replayable, false);
  assert.equal(closeout.status, "ATTEMPT_CONSUMED_FAILED_TERMINAL");
  assert.equal(closeout.primary_failure, "RA004_CANARY_CONTROL_STATE_BLOCKED");
  assert.equal(closeout.root_cause.code, "RA004_SQL_EMPTY_QUERIED_STATE_MISCLASSIFIED_INCOMPLETE");
  assert.equal(closeout.canary_result.completeness_status, "COMPLETE");
  assert.equal(closeout.canary_result.sources_queried, 11);
  assert.deepEqual(closeout.canary_result.sources_unavailable, []);
  assert.equal(closeout.business_data.unchanged, true);
  assert.equal(closeout.selectors.staging, "CLOSED");
  assert.equal(closeout.selectors.production, "CLOSED");
  assert.equal(closeout.retry_authorized, false);
  assert.equal(closeout.replayable, false);
  for (const mutate of [
    (value) => { value.migrations.push({ filename: "forbidden.sql" }); },
    (value) => { value.execution.canary_attempt_count = 2; },
    (value) => { value.execution.retry_attempt_count = 1; },
    (value) => { value.execution.canary_completeness_status = "INCOMPLETE"; },
    (value) => { value.execution.canary_sources_unavailable.push("locks"); },
    (value) => { value.execution.canary_write_attempt_count = 1; },
    (value) => { value.execution.business_data_unchanged = false; },
    (value) => { value.execution.cleanup = "PENDING"; },
    (value) => { value.execution.roles_absent = false; },
    (value) => { value.execution.closed = false; },
    (value) => { value.production.authorized = true; },
  ]) {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() => values.validateV3TerminalActivation(changed),
      /RA004_ACTIVATION_TERMINAL_STATE_INVALID/);
  }
});

test("live canary proves SQL empty-state classification drift against the shared exporter", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase", "migrations",
    "20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql"), "utf8");
  const exporter = fs.readFileSync(path.join(__dirname, "lib", "retailer-offer-sync",
    "control-state-export-v1", "exporter.js"), "utf8");
  assert.match(sql,
    /jsonb_array_length\(v_postflight\)=0 or jsonb_array_length\(v_watchdog\)=0 then 'BLOCKED_INCOMPLETE_EXPORT'/);
  assert.match(exporter, /if \(unavailable\.length\) return "BLOCKED_INCOMPLETE_EXPORT"/);
  assert.doesNotMatch(exporter,
    /if\s*\([^)]*(?:last_postflight|last_watchdog_result)[^)]*\)\s*return "BLOCKED_INCOMPLETE_EXPORT"/);
});

test("v2 closeout binds source unavailability to expired bounded observations", () => {
  const closeout = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "retailer-automation", "evidence",
    "RA-004-final-control-state-canary-reactivation-v2-closeout.json"), "utf8"));
  const observer = fs.readFileSync(path.join(__dirname, "ra004-staging-source-observation-capture.js"), "utf8");
  const rpc = fs.readFileSync(path.join(ROOT, "supabase", "migrations",
    "20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql"), "utf8");
  assert.equal(closeout.primary_failure, "CONTROL_EXPORT_SOURCE_UNAVAILABLE");
  assert.equal(closeout.root_cause.required_observations, 5);
  assert.equal(closeout.root_cause.observation_lifetime_minutes, 20);
  assert.ok(Date.parse(closeout.root_cause.canary_started_at)
    > Date.parse(closeout.root_cause.observer_started_at) + (20 * 60_000));
  assert.match(observer, /OBSERVATION_LIFETIME_MS = 20 \* 60_000/);
  assert.match(rpc, /if v_coverage <> 5 then/);
  assert.match(rpc, /RCSE_SOURCE_UNAVAILABLE: observation coverage is %\/5/);
  assert.deepEqual(closeout.attempt_counters,
    { evidence_auth: 1, migration: 0, preflight: 0, canary: 1, retry: 0 });
  assert.equal(closeout.ledger_readback.count, 99);
  assert.equal(closeout.evidence_store.session, "CLOSED");
  assert.equal(closeout.evidence_store.cleanup, "COMPLETE");
  assert.equal(closeout.credential_revocation.role_absent, true);
  assert.equal(closeout.credential_revocation.membership_absent, true);
  assert.equal(closeout.credential_revocation.active_backend_absent, true);
  assert.equal(closeout.selectors.staging, "CLOSED");
  assert.equal(closeout.selectors.production, "CLOSED");
  assert.equal(closeout.retry_authorized, false);
  assert.equal(closeout.replayable, false);
});

test("runtime has one atomic five-row observation and one canary with no migration or preflight path", () => {
  for (const forbidden of [
    /db["']?,\s*["']push/i,
    /pushSelectedMigrations/,
    /materializeSelectedWorkdir/,
    /createPreflightPostgresTransport/,
    /runPreflight/,
    /kind:\s*["']preflight["']/,
    /--include-all/,
    /RA004_SUPABASE_CLI_PATH/,
  ]) assert.doesNotMatch(coordinator, forbidden);
  assert.match(coordinator, /source_observation_transactions: 0/);
  assert.match(coordinator, /source_observation_rows: 0/);
  assert.match(coordinator, /sourceObservation\.observeSources\(ownerUrl\)/);
  assert.match(coordinator, /sourceObservation\.buildEvents/);
  assert.match(coordinator, /sourceObservation\.writeEvents/);
  assert.match(coordinator, /sourceObservation\.readback/);
  assert.match(sourceCapture, /async function writeEvents/);
  assert.doesNotMatch(coordinator, /write_retailer_control_state_evidence_v1/);
  assert.equal((coordinator.match(/operationAttempts\.source_observation_transactions \+= 1/g) || []).length, 1);
  assert.equal((coordinator.match(/operationAttempts\.canary \+= 1/g) || []).length, 1);
  assert.equal((coordinator.match(/await exportControlState/g) || []).length, 1);
  assert.equal((coordinator.match(/action: "create", kind: "control"/g) || []).length, 1);
  assert.equal((coordinator.match(/action: "create", kind: "evidence"/g) || []).length, 1);
  assert.match(coordinator, /migration_receipts: \[\]/);
  assert.match(coordinator, /attempts: 0/);
});

test("shared serializer preserves every allowlisted runtime code and never diagnostic text", () => {
  const roots = [
    path.join(ROOT, "scripts", "lib", "retailer-offer-sync", "control-state-export-v1"),
    path.join(ROOT, "scripts", "lib", "retailer-offer-sync", "ra004-bounded-live-transport-v1.js"),
  ];
  const files = roots.flatMap((item) => fs.statSync(item).isDirectory()
    ? fs.readdirSync(item).filter((name) => name.endsWith(".js")).map((name) => path.join(item, name))
    : [item]);
  const codes = new Set(files.flatMap((file) =>
    fs.readFileSync(file, "utf8").match(/(?:CONTROL_EXPORT|RA004)_[A-Z0-9_]+/g) || []));
  assert.ok(codes.size >= 20);
  for (const code of codes) {
    const structured = new Error(`${code}: secret-password postgresql://secret.example/db`);
    structured.code = code;
    assert.equal(safeFailureCode(structured), code);
    assert.equal(safeFailureCode(new Error(`${code}: private diagnostic`)), code);
  }
  assert.equal(safeFailureCode(Object.assign(new Error("secret-password"), { code: "28P01" })),
    "RA004_UNCLASSIFIED_FAILURE");
  assert.equal(safeFailureCode(new Error("CONTROL_EXPORT_BAD-code: secret")),
    "RA004_UNCLASSIFIED_FAILURE");
  const report = values.buildFailureReport({
    activation: "ra004-staging-1790493761055",
    executionCommit: "a".repeat(40),
    primaryError: Object.assign(new Error("CONTROL_EXPORT_SOURCE_INVALID: secret-password"),
      { code: "CONTROL_EXPORT_SOURCE_INVALID" }),
    sessionState: { session_creation_state: "CREATED", cleanup_status: "COMPLETE",
      attempt_counters: { auth: 1, upload: 0, readback: 0, cleanup: 0 } },
    operationAttempts: { migration: 0, preflight: 0, canary: 1 },
    cleanup: { status: "COMPLETE", failures: [] }, startsAt: "2026-09-29T00:00:00Z",
    expiresAt: "2026-09-29T00:30:00Z", revoke: [], uploaded: [],
  });
  assert.equal(report.primary_failure.code, "CONTROL_EXPORT_SOURCE_INVALID");
  assert.doesNotMatch(JSON.stringify(report), /secret-password/);
});

test("terminal closeout cannot be sealed before cleanup and session closure are final", () => {
  assert.throws(() => values.buildFailureReport({
    activation: "ra004-terminal-test", executionCommit: "a".repeat(40),
    primaryError: Object.assign(new Error("private diagnostic"), { code: "42501" }),
    sessionState: { session_creation_state: "CREATED", cleanup_status: "PENDING",
      attempt_counters: { auth: 1, upload: 1, readback: 1, cleanup: 0 } },
    operationAttempts: { migration: 0, preflight: 0, canary: 1 },
    cleanup: { status: "PENDING", failures: [] }, startsAt: "2026-09-29T00:00:00Z",
    expiresAt: "2026-09-29T00:30:00Z", revoke: [], uploaded: [],
  }), /RA004_TERMINAL_CLOSEOUT_CLEANUP_INCOMPLETE/);
});

test("every bounded transport phase has a deterministic secret-free failure code", () => {
  for (const phase of ["CONNECT", "BEGIN", "RPC", "PROOF", "ROLLBACK", "CLOSE"]) {
    const error = normalizeTransportFailure(new Error("postgresql://user:secret@example.invalid/db"), phase);
    assert.equal(error.code, `RA004_LIVE_TRANSPORT_${phase}_FAILED`);
    assert.equal(safeFailureCode(error), error.code);
    assert.equal(error.diagnostic.phase, phase);
    assert.equal(error.diagnostic.sqlstate, null);
    assert.match(error.diagnostic.fingerprint, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(error.diagnostic), /secret|postgresql:\/\//);
  }
  assert.equal(normalizeTransportFailure(Object.assign(new Error("private"), { code: "28P01" }),
    "CONNECT").code, "RA004_LIVE_TRANSPORT_AUTH_REJECTED");
  assert.equal(normalizeTransportFailure(Object.assign(new Error("private"), { code: "57014" }),
    "RPC").code, "RA004_LIVE_TRANSPORT_RPC_TIMEOUT");
});

test("selectors remain closed in staging and production", () => {
  assert.equal(values.assertSelectorsClosed(), true);
  const selector = require("./supabase-migration-selector");
  for (const [filename, sha] of values.REQUIRED_APPLIED_MIGRATIONS) {
    assert.ok(selector.CONTRACTS.STAGING.appliedExcluded.includes(filename));
    assert.equal(selector.CONTRACTS.STAGING.excluded[filename], sha);
    assert.equal(selector.CONTRACTS.PRODUCTION.excluded[filename], sha);
    assert.ok(!selector.CONTRACTS.STAGING.pending.some((entry) => entry.filename === filename));
    assert.ok(!selector.CONTRACTS.PRODUCTION.pending.some((entry) => entry.filename === filename));
  }
});

test("evidence authentication precedes fresh observations which precede the sole canary", () => {
  const init = coordinator.indexOf('custody.call({ action: "init" })');
  const configure = coordinator.indexOf("configureEvidenceStore(storageSession.subject", init);
  const attest = coordinator.indexOf("attestEvidenceStore(policies)", configure);
  const start = coordinator.indexOf("startsAt = utc()", attest);
  const observe = coordinator.indexOf("sourceObservation.observeSources(ownerUrl)", start);
  const evidenceCredential = coordinator.indexOf('action: "create", kind: "evidence"', observe);
  const write = coordinator.indexOf("sourceObservation.writeEvents", evidenceCredential);
  const readback = coordinator.indexOf("sourceObservation.readback", write);
  const freshness = coordinator.indexOf("ensureObservationFresh(observationExpiresAt)", readback);
  const credential = coordinator.indexOf('action: "create", kind: "control"', freshness);
  const canary = coordinator.indexOf("await exportControlState", credential);
  assert.ok(init > 0 && configure > init && attest > configure && start > attest
    && observe > start && evidenceCredential > observe && write > evidenceCredential
    && readback > write && freshness > readback && credential > freshness && canary > credential);
  assert.match(coordinator, /session_required_before_source_observation/);
  assert.match(coordinator, /session_required_before_canary/);
  assert.match(coordinator, /authentication_attempts === 1/);
  assert.match(custodian, /"source-observation\.json"/);
  assert.match(custodian, /"source-observation-revoke\.json"/);
  assert.match(custodian, /"execution-report\.json"/);
  assert.match(custodian, /method: "POST"/);
  assert.match(custodian, /method: "GET"/);
  assert.doesNotMatch(custodian, /x-upsert|method: "(?:PUT|PATCH|DELETE)"|\/object\/list\//i);
});

test("observation and control credentials are query-aware revoked and cleanup stays mandatory", () => {
  assert.match(coordinator, /await revokeOne\(observationCredential, process\.pid\)/);
  assert.match(coordinator, /await revokeOne\(canaryCredential, process\.pid\)/);
  assert.match(coordinator, /verifyRevokedCredential\(databaseUrl, credential\.role\)/);
  assert.match(coordinator, /if \(observationCredential && issuer\)/);
  assert.match(coordinator, /if \(canaryCredential && issuer\)/);
  assert.match(coordinator, /removeEvidencePolicies\(policies\)/);
  assert.match(coordinator, /custody\.call\(\{ action: "close" \}\)/);
  assert.match(coordinator, /process\.env\.RA004_OWNER_DATABASE_URL = ""/);
  assert.doesNotMatch(coordinator, /setInterval|retry\s*\(/i);
});

test("business rows and forbidden operations remain unchanged", () => {
  assert.match(coordinator, /const businessBefore = await businessCounts\(\)/);
  assert.match(coordinator, /const businessAfterCanary = await businessCounts\(\)/);
  assert.match(coordinator, /RA004_BUSINESS_DATA_CHANGED_DURING_READ_ONLY_EXECUTION/);
  assert.match(coordinator, /production: 0, migration: 0, preflight: 0/);
  assert.match(coordinator, /write_attempt_count: canaryReport\.write_attempt_count/);
  assert.match(coordinator, /mutation_attempt_count: canaryReport\.mutation_attempt_count/);
});

test("observation freshness is fail-closed with five minutes reserved for the canary", () => {
  const now = Date.parse("2026-09-29T10:00:00Z");
  assert.equal(values.ensureObservationFresh("2026-09-29T10:05:00Z", now), true);
  assert.throws(() => values.ensureObservationFresh("2026-09-29T10:04:59.999Z", now),
    /RA004_SOURCE_OBSERVATION_WINDOW_TOO_SHORT/);
  assert.throws(() => values.ensureObservationFresh("invalid", now),
    /RA004_SOURCE_OBSERVATION_WINDOW_TOO_SHORT/);
});

test("launcher uses masked inputs, strict CA validation and no migration tooling", () => {
  assert.match(launcher, /Read-Host -Prompt \$Prompt -AsSecureString/);
  assert.match(launcher, /NODE_EXTRA_CA_CERTS/);
  assert.match(launcher, /validateLocalCa/);
  assert.match(launcher, /LAUNCHER_VALIDATION_PASS/);
  assert.ok(launcher.indexOf("assertActivationExecutable") < launcher.indexOf("Staging database URL"));
  assert.match(launcher, /jedna atomowa obserwacje i read-only canary/);
  assert.doesNotMatch(launcher, /supabase|db push|include-all|RA004_SUPABASE_CLI_PATH/i);
});

test("execution is bound to a clean exact origin/main commit", () => {
  const sha = "a".repeat(40);
  const outputs = [sha, sha, values.BASELINE, ""];
  assert.equal(values.readExecutionCommit(() => ({ status: 0, stdout: outputs.shift() })), sha);
  const mismatch = ["a".repeat(40), "b".repeat(40), values.BASELINE, ""];
  assert.throws(() => values.readExecutionCommit(() => ({ status: 0, stdout: mismatch.shift() })),
    /RA004_EXECUTION_COMMIT_NOT_MERGED_MAIN/);
  const wrongBaseline = [sha, sha, "b".repeat(40), ""];
  assert.throws(() => values.readExecutionCommit(() => ({ status: 0, stdout: wrongBaseline.shift() })),
    /RA004_EXECUTION_BASELINE_MISMATCH/);
  const dirty = [sha, sha, values.BASELINE, " M scripts/file.js"];
  assert.throws(() => values.readExecutionCommit(() => ({ status: 0, stdout: dirty.shift() })),
    /RA004_EXECUTION_WORKTREE_NOT_CLEAN/);
});

test("historical activations remain terminal and cannot validate as the new activation", () => {
  const files = [
    "RA-004-acl-rls-correction-activation.json",
    "RA-004-acl-rls-authenticated-reactivation.json",
    "RA-004-final-readonly-preflight-canary-activation.json",
    "RA-004-provider-identity-staging-activation.json",
  ];
  for (const filename of files) {
    const value = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "retailer-automation",
      "evidence", filename), "utf8"));
    assert.match(value.status, /TERMINAL/);
    assert.equal(value.execution.retry_authorized, false);
    assert.equal(value.execution.replayable, false);
    assert.throws(() => values.validateReadOnlyActivation(value), /RA004_/);
  }
});
