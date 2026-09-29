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
const values = require("./ra004-staging-execution-coordinator");
const { safeFailureCode } = require("./lib/ra004-safe-failure-code");

test("final canary is pinned to the approved staging ledger and already-applied migrations", () => {
  assert.equal(values.REF, "hxnrsyyqffztlvcrtgbf");
  assert.equal(values.API_HOST, "hxnrsyyqffztlvcrtgbf.supabase.co");
  assert.equal(values.BASELINE, "453dbe67161318d1f49853e6b0f94c1a253fd66b");
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

test("prepared activation permits no migration or preflight and exactly one canary", () => {
  const file = path.join(ROOT, "docs", "retailer-automation", "evidence",
    "RA-004-final-control-state-canary-activation.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(values.validateReadOnlyActivation(manifest), manifest);
  assert.deepEqual(manifest.migrations, []);
  assert.equal(manifest.migration_attempts_authorized, 0);
  assert.equal(manifest.preflight.attempts_authorized, 0);
  assert.equal(manifest.preflight.prior_status, "VERIFIED_COMPLETE");
  assert.equal(manifest.preflight.report_fingerprint,
    "b1719dbbaad328e7bc0f0dc7b24307f3b5c828fe1af43d7cad5e98aa9599f40c");
  assert.equal(manifest.canary.maximum_attempts, 1);
  assert.equal(manifest.canary.automatic_retry, false);
  assert.equal(manifest.canary.read_only, true);
  assert.deepEqual(manifest.execution, {
    started: false, migration_attempt_count: 0, preflight_attempt_count: 0,
    canary_attempt_count: 0, closed: false, retry_authorized: false, replayable: false,
  });
  for (const mutate of [
    (value) => { value.migrations.push({ filename: "forbidden.sql" }); },
    (value) => { value.migration_attempts_authorized = 1; },
    (value) => { value.preflight.attempts_authorized = 1; },
    (value) => { value.canary.maximum_attempts = 2; },
    (value) => { value.production.authorized = true; },
    (value) => { value.ledger.count = 98; },
    (value) => { value.execution.started = true; },
  ]) {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() => values.validateReadOnlyActivation(changed), /RA004_/);
  }
});

test("runtime has no migration, Supabase CLI, materialization, or preflight execution path", () => {
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
  assert.match(coordinator, /const operationAttempts = \{ migration: 0, preflight: 0, canary: 0 \}/);
  assert.equal((coordinator.match(/operationAttempts\.canary \+= 1/g) || []).length, 1);
  assert.equal((coordinator.match(/await exportControlState/g) || []).length, 1);
  assert.equal((coordinator.match(/action: "create", kind: "control"/g) || []).length, 1);
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
    sessionState: { session_creation_state: "CREATED",
      attempt_counters: { auth: 1, upload: 0, readback: 0, cleanup: 0 } },
    operationAttempts: { migration: 0, preflight: 0, canary: 1 },
    cleanup: { status: "PENDING", failures: [] }, startsAt: "2026-09-29T00:00:00Z",
    expiresAt: "2026-09-29T00:30:00Z", revoke: [], uploaded: [],
  });
  assert.equal(report.primary_failure.code, "CONTROL_EXPORT_SOURCE_INVALID");
  assert.doesNotMatch(JSON.stringify(report), /secret-password/);
});

test("selectors remain closed in staging and production", () => {
  assert.equal(values.assertSelectorsClosed(), true);
  const provider = values.REQUIRED_APPLIED_MIGRATIONS[1][0];
  const selector = require("./supabase-migration-selector");
  assert.ok(selector.CONTRACTS.STAGING.appliedExcluded.includes(provider));
  assert.equal(selector.CONTRACTS.STAGING.excluded[provider], values.PROVIDER_IDENTITY_SHA);
  assert.equal(selector.CONTRACTS.PRODUCTION.excluded[provider], values.PROVIDER_IDENTITY_SHA);
  assert.ok(!selector.CONTRACTS.STAGING.pending.some(({ filename }) => filename === provider));
  assert.ok(!selector.CONTRACTS.PRODUCTION.pending.some(({ filename }) => filename === provider));
});

test("evidence authentication and attestation precede the sole canary", () => {
  const init = coordinator.indexOf('custody.call({ action: "init" })');
  const configure = coordinator.indexOf("configureEvidenceStore(storageSession.subject", init);
  const attest = coordinator.indexOf("attestEvidenceStore(policies)", configure);
  const start = coordinator.indexOf("startsAt = utc()", attest);
  const credential = coordinator.indexOf('action: "create", kind: "control"', start);
  const canary = coordinator.indexOf("await exportControlState", credential);
  assert.ok(init > 0 && configure > init && attest > configure && start > attest
    && credential > start && canary > credential);
  assert.match(coordinator, /session_required_before_canary/);
  assert.match(coordinator, /authentication_attempts === 1/);
  assert.match(custodian, /"failure-closeout\.json"/);
  assert.match(custodian, /method: "POST"/);
  assert.match(custodian, /method: "GET"/);
  assert.doesNotMatch(custodian, /x-upsert|method: "(?:PUT|PATCH|DELETE)"|\/object\/list\//i);
});

test("one control credential is query-aware revoked and cleanup stays mandatory", () => {
  assert.match(coordinator, /await revokeOne\(canaryCredential, process\.pid\)/);
  assert.match(coordinator, /verifyRevokedCredential\(databaseUrl, credential\.role\)/);
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

test("launcher uses masked inputs, strict CA validation and no migration tooling", () => {
  assert.match(launcher, /Read-Host -Prompt \$Prompt -AsSecureString/);
  assert.match(launcher, /NODE_EXTRA_CA_CERTS/);
  assert.match(launcher, /validateLocalCa/);
  assert.match(launcher, /LAUNCHER_VALIDATION_PASS/);
  assert.match(launcher, /jeden autoryzowany read-only canary/);
  assert.doesNotMatch(launcher, /supabase|db push|include-all|RA004_SUPABASE_CLI_PATH/i);
});

test("execution is bound to a clean exact origin/main commit", () => {
  const sha = "a".repeat(40);
  const outputs = [sha, sha, ""];
  assert.equal(values.readExecutionCommit(() => ({ status: 0, stdout: outputs.shift() })), sha);
  const mismatch = ["a".repeat(40), "b".repeat(40), ""];
  assert.throws(() => values.readExecutionCommit(() => ({ status: 0, stdout: mismatch.shift() })),
    /RA004_EXECUTION_COMMIT_NOT_MERGED_MAIN/);
  const dirty = [sha, sha, " M scripts/file.js"];
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
