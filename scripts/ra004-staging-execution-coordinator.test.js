const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const coordinatorPath = path.join(__dirname, "ra004-staging-execution-coordinator.js");
const issuerPath = path.join(__dirname, "ra004-staging-credential-issuer.js");
const custodianPath = path.join(__dirname, "ra004-staging-evidence-custodian.js");
const verifierPath = path.join(__dirname, "ra004-staging-revocation-verifier.js");
const launcherPath = path.join(__dirname, "ra004-run-staging-interfaces-preflight-canary.ps1");
const coordinator = fs.readFileSync(coordinatorPath, "utf8");
const issuer = fs.readFileSync(issuerPath, "utf8");
const custodian = fs.readFileSync(custodianPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");

test("coordinator is pinned to the owner-authorized staging identity and artifacts", () => {
  const values = require("./ra004-staging-execution-coordinator");
  assert.equal(values.REF, "hxnrsyyqffztlvcrtgbf");
  assert.equal(values.API_HOST, "hxnrsyyqffztlvcrtgbf.supabase.co");
  assert.equal(values.BASELINE, "b11dcc6518e7c6c4c363a3f149fc13342f89ca16");
  assert.equal(values.CONTROL_SHA, "cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa");
  assert.equal(values.PREFLIGHT_SHA, "9d6c1ea4df0bd86f84a4cb779a0824922f4e9bcc91681b734d5d18465a9e91be");
  assert.equal(values.BUCKET, "ra004-staging-preflight-evidence");
  assert.equal(values.EXPECTED_PRE_LEDGER_COUNT, 95);
  assert.equal(values.EXPECTED_PRE_LEDGER_FINGERPRINT, "c5bb6405d26def1834522cccaf2937fad60f44156370e5e1f8c4af3ff96d45bd");
  assert.equal(values.EXPECTED_POST_LEDGER_COUNT, 97);
  assert.equal(values.EXPECTED_POST_LEDGER_FINGERPRINT, "5d6edfca41ae7dd61043d62a6d78469d5cb1196f6ef15c7fef794e04664ee7aa");
  assert.match(coordinator, /aftboxmrdgyhizicfsfu\|prod\/i/);
});

test("migration apply consumes only the materialized guarded selector workdir", () => {
  assert.match(coordinator, /selector\.validateSelection/);
  assert.match(coordinator, /selector\.materializeSelectedWorkdir/);
  assert.match(coordinator, /pending_files\.length===2/);
  assert.match(coordinator, /\["db", "push", "--db-url", databaseUrl, "--workdir", workdir, "--yes"\]/);
  assert.doesNotMatch(coordinator, /--include-all/);
  assert.doesNotMatch(coordinator, /insert into supabase_migrations/i);
  assert.doesNotMatch(coordinator, /await db\(sql\)/);
});

test("secrets remain process-only and are not placed in CLI arguments or output", () => {
  assert.match(coordinator, /delete childEnvironment\.RA004_OWNER_DATABASE_URL/);
  assert.match(coordinator, /delete childEnvironment\.RA004_SUPABASE_ACCESS_TOKEN/);
  assert.match(coordinator, /const pushEnvironment = \{ PGPASSWORD: password \}/);
  assert.match(coordinator, /parsed\.password = ""/);
  assert.doesNotMatch(coordinator, /SUPABASE_ACCESS_TOKEN: pat|"--linked"|"--password"/);
  assert.match(coordinator, /\[REDACTED\]/);
  assert.doesNotMatch(coordinator, /console\.log\(ownerUrl|console\.log\(pat/);
  assert.match(coordinator, /process\.env\.RA004_STORAGE_ANON_KEY=""/);
  assert.doesNotMatch(custodian, /console\.(?:log|error)|process\.stdout|process\.stderr/);
});

test("evidence bucket and object writes are private, bounded and non-overwriting", () => {
  assert.match(coordinator, /insert into storage\.buckets\(id,name,public,file_size_limit,allowed_mime_types\)/);
  assert.match(coordinator, /false,2097152,array\['application\/json','text\/plain'\]/);
  assert.match(coordinator, /create policy \$\{insertPolicy\}.*for insert to authenticated with check/);
  assert.match(coordinator, /create policy \$\{selectPolicy\}.*for select to authenticated using/);
  assert.match(coordinator, /drop policy if exists \$\{policies\.insertPolicy\}/);
  assert.match(custodian, /bytes\.length > 2 \* 1024 \* 1024/);
  assert.match(custodian, /RA004_EVIDENCE_READBACK_HASH_MISMATCH/);
  assert.match(custodian, /method: "POST"/);
  assert.match(custodian, /method: "GET"/);
  assert.match(custodian, /claims\.role !== "anon"/);
  assert.doesNotMatch(custodian, /x-upsert|method: "(?:PUT|PATCH|DELETE)"|\/object\/list\//i);
  assert.doesNotMatch(coordinator + custodian, /api-keys\?reveal|storage","cp|storage rm|storage ls/);
  assert.match(coordinator, /service_role:false/);
});

test("the activation window begins only after the private evidence store is attested", () => {
  const initializeStore = coordinator.indexOf('custody.call({action:"init"})');
  const configureStore = coordinator.indexOf("configureEvidenceStore", initializeStore);
  const attestStore = coordinator.indexOf("attestEvidenceStore", configureStore);
  const startWindow = coordinator.indexOf("startsAt=utc()", attestStore);
  const push = coordinator.indexOf("pushSelectedMigrations", startWindow);
  assert.ok(initializeStore > 0);
  assert.ok(configureStore > initializeStore);
  assert.ok(attestStore > configureStore);
  assert.ok(startWindow > attestStore);
  assert.ok(push > startWindow);
});

test("business rows are counted before migration and remain unchanged after canary", () => {
  assert.match(coordinator, /async function businessCounts\(\)/);
  assert.match(coordinator, /const businessBefore=await businessCounts\(\)/);
  assert.match(coordinator, /RA004_BUSINESS_DATA_CHANGED_BY_MIGRATION/);
  assert.match(coordinator, /RA004_BUSINESS_DATA_CHANGED_DURING_READ_ONLY_EXECUTION/);
  assert.match(coordinator, /business_counts:\{before:businessBefore,after_migrations:businessAfterMigrations,after_canary:businessAfterCanary,unchanged:true\}/);
});

test("a session that never existed is not logged out and primary failure remains authoritative", () => {
  assert.match(coordinator, /if\(sessionState\.session_creation_state!=="NOT_CREATED"\)/);
  assert.doesNotMatch(coordinator, /finally\s*\{[^}]*invariant\(cleanupFailures/s);
  assert.match(coordinator, /if\(primaryError\)throw primaryError/);
  assert.match(coordinator, /primary_failure: \{ code: safeFailureCode\(primaryError\) \}/);
});

test("failure report separates primary failure, session, cleanup, counters and window state", () => {
  const { buildFailureReport } = require("./ra004-staging-execution-coordinator");
  const input = {
    activation: "ra004-staging-1790493761055",
    primaryError: new Error("RA004_STORAGE_AUTH_DNS_FAILED"),
    sessionState: {
      session_creation_state: "NOT_CREATED",
      cleanup_status: "NOT_REQUIRED",
      attempt_counters: { auth: 1, upload: 0, readback: 0, cleanup: 0 },
    },
    cleanup: { status: "NOT_REQUIRED", failures: [] },
    startsAt: null,
    expiresAt: "2099-01-01T00:00:00Z",
    closedAt: "2098-12-31T23:59:59Z",
    revoke: [],
    uploaded: [],
  };
  const first = buildFailureReport(input);
  const second = buildFailureReport(input);
  assert.deepEqual(first.primary_failure, { code: "RA004_STORAGE_AUTH_DNS_FAILED" });
  assert.deepEqual(first.session_creation, { state: "NOT_CREATED" });
  assert.deepEqual(first.cleanup, { status: "NOT_REQUIRED", failures: [] });
  assert.deepEqual(first.attempt_counters, { auth: 1, upload: 0, readback: 0, cleanup: 0 });
  assert.equal(first.window.started, false);
  assert.equal(first.window.starts_at, null);
  assert.deepEqual(first, second);
});

test("cleanup failure cannot replace the primary transport failure or leak secrets", () => {
  const { buildFailureReport } = require("./ra004-staging-execution-coordinator");
  const report = buildFailureReport({
    activation: "ra004-staging-1790493761055",
    primaryError: new Error("SENSITIVE_TEST_SENTINEL_DO_NOT_REPORT"),
    sessionState: {
      session_creation_state: "PARTIALLY_CREATED",
      cleanup_status: "FAILED",
      attempt_counters: { auth: 1, upload: 0, readback: 0, cleanup: 1 },
    },
    cleanup: { status: "FAILED", failures: ["storage-session"] },
    startsAt: null,
    expiresAt: "2099-01-01T00:00:00Z",
    closedAt: "2098-12-31T23:59:59Z",
    revoke: [],
    uploaded: [],
  });
  assert.equal(report.primary_failure.code, "RA004_UNCLASSIFIED_FAILURE");
  assert.deepEqual(report.cleanup, { status: "FAILED", failures: ["storage-session"] });
  assert.doesNotMatch(JSON.stringify(report), /SENSITIVE_TEST_SENTINEL_DO_NOT_REPORT/);
});

test("preflight gates exactly one later control-state canary and both credentials revoke in finally", () => {
  const preflight = coordinator.indexOf("await runPreflight");
  const canaryCredential = coordinator.indexOf('kind:"control"');
  const canary = coordinator.indexOf("await exportControlState");
  assert.ok(preflight > 0 && canaryCredential > preflight && canary > canaryCredential);
  assert.match(coordinator, /maximum_attempts:1/);
  assert.match(coordinator, /automatic_retry:false/);
  assert.match(coordinator, /if\(preflightCred&&issuer\).*revokeOne\(preflightCred/s);
  assert.match(coordinator, /if\(canaryCred&&issuer\).*revokeOne\(canaryCred/s);
  assert.match(coordinator, /final_assessment==="CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION"/);
  assert.doesNotMatch(coordinator, /setInterval|setTimeout|retry\s*\(/i);
});

test("credential issuer is a separate process with exact RPC-only logins", () => {
  assert.match(coordinator, /fork\(path\.join\(__dirname,"ra004-staging-credential-issuer\.js"\)/);
  assert.match(issuer, /connection limit 1/);
  assert.match(issuer, /default_transaction_read_only=on/);
  assert.match(issuer, /statement_timeout=''15s''/);
  assert.match(issuer, /grant execute on function \$\{signature\}/);
  assert.match(issuer, /alter role \$\{id\} nologin/);
  assert.match(issuer, /drop role \$\{id\}/);
  assert.match(issuer, /RA004_ROLE_REVOKE_UNVERIFIED/);
  assert.match(coordinator, /ra004-staging-revocation-verifier\.js/);
  assert.match(verifier, /RA004_REVOKED_CREDENTIAL_RECONNECTED/);
  assert.match(verifier, /28P01/);
  assert.doesNotMatch(issuer, /grant .*service_role|grant .*validator|grant .*approver|grant .*executor/i);
});

test("coordinator contains no feed, shadow, plan, approval, import, apply, offer or production executor", () => {
  for (const forbidden of [
    "TEN_REPS_FEED_URL", "import-products", "apply_approved", "create_control_plan",
    "approve_", "shadow-run", "Model B",
  ]) assert.doesNotMatch(coordinator, new RegExp(forbidden, "i"));
  assert.match(coordinator, /production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0/);
});

test("interactive launcher masks every secret, validates the pinned CLI and clears process credentials", () => {
  assert.match(launcher, /param\(\[switch\]\$ValidateOnly\)/);
  assert.match(launcher, /\$expectedVersion = '2\.111\.0'/);
  assert.equal((launcher.match(/ConvertFrom-MaskedInput '/g) || []).length, 4);
  assert.match(launcher, /LAUNCHER_VALIDATION_PASS/);
  assert.match(launcher, /Read-Host 'Wpisz START/);
  assert.match(launcher, /\$confirmation -cne 'START'/);
  assert.match(launcher, /ra004-staging-execution-coordinator\.js/);
  for (const name of [
    "RA004_OWNER_DATABASE_URL", "RA004_STORAGE_ANON_KEY", "RA004_STORAGE_EMAIL",
    ["RA004_STORAGE", "PASSWORD"].join("_"), "RA004_SUPABASE_CLI_PATH",
  ]) assert.match(launcher, new RegExp(`\\$env:${name} = ''`));
  assert.doesNotMatch(launcher, /ACCESS_TOKEN|personal access token|\bPAT\b/i);
});

test("interactive launcher trusts the Windows system CA store without disabling TLS verification", () => {
  assert.match(
    launcher,
    /& node --use-system-ca \(Join-Path \$PSScriptRoot 'ra004-staging-execution-coordinator\.js'\)/,
  );
  assert.doesNotMatch(launcher, /NODE_TLS_REJECT_UNAUTHORIZED|--tls-skip-verify|rejectUnauthorized\s*=\s*false/i);
});

test("the tracked coordinator, issuer, custodian and verifier are repository files", () => {
  assert.ok(fs.existsSync(coordinatorPath));
  assert.ok(fs.existsSync(issuerPath));
  assert.ok(fs.existsSync(custodianPath));
  assert.ok(fs.existsSync(verifierPath));
  assert.ok(fs.existsSync(launcherPath));
  assert.ok(fs.existsSync(path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-004-staging-migration-activation.json")));
});
