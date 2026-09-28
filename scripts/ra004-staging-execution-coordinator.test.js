const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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
  assert.equal(values.BASELINE, "11e8db1397516645b48fc9a574d23685582531df");
  assert.equal(values.CONSOLIDATED_SHA, "a240a263d7e88084171a73317db9e19f0e2c69c9b71ca84dbe788b624a22c9c4");
  assert.equal(values.BUCKET, "ra004-staging-preflight-evidence");
  assert.equal(values.EXPECTED_PRE_LEDGER_COUNT, 98);
  assert.equal(values.EXPECTED_PRE_LEDGER_FINGERPRINT, "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307");
  assert.equal(values.ACL_MIGRATION_SHA, "58aa82b328b9bb77c09b9975892042027a493254add99fb2e1dcf045303c0b0d");
  assert.equal(values.PROVIDER_IDENTITY_SHA, "4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91");
  assert.equal(values.EXPECTED_POST_LEDGER_COUNT, 99);
  assert.equal(values.EXPECTED_POST_LEDGER_FINGERPRINT, "a6e7693f964925554e807602752e4630d14f537a1d9de4fe82f8433d30c307cc");
  assert.equal(values.DEPENDENCY_CONTRACT.length, 24);
  assert.match(coordinator, /aftboxmrdgyhizicfsfu\|prod\/i/);
  assert.match(coordinator, /retailer\[0\]\.id==="11"/);
});

test("provider identity migration is the only selected migration", () => {
  assert.match(coordinator, /validateReadOnlyActivation/);
  assert.match(coordinator, /status:"APPLIED_VERIFIED",database_writes:1/);
  assert.deepEqual(require("./ra004-staging-execution-coordinator").EXPECTED_MIGRATIONS, [[
    "20260928101000_align_ra004_control_export_provider_identity.sql",
    "4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91",
  ]]);
  assert.match(coordinator, /appliedIdentifiers\.has\("20260928100000_diagnose_ra004_preflight_acl_rls\.sql"\)/);
  assert.match(coordinator, /pushSelectedMigrations\(selectedWorkdir\)/);
  assert.match(coordinator, /operationAttempts\.migration\+=1/);
  assert.match(coordinator, /\["db", "push", "--db-url", databaseUrl, "--workdir", workdir, "--yes"\]/);
  assert.doesNotMatch(coordinator, /--include-all/);
  assert.doesNotMatch(coordinator, /insert into supabase_migrations/i);
  assert.doesNotMatch(coordinator, /await db\(sql\)/);
});

test("historical activations are terminal and final read-only activation is exact", () => {
  const { validateReadOnlyActivation } = require("./ra004-staging-execution-coordinator");
  const consumed = JSON.parse(fs.readFileSync(path.join(ROOT,
    "docs/retailer-automation/evidence/RA-004-acl-rls-correction-activation.json"), "utf8"));
  assert.equal(consumed.status, "ATTEMPT_CONSUMED_FAILED_TERMINAL");
  assert.equal(consumed.execution.retry_authorized, false);
  assert.equal(consumed.execution.replayable, false);
  assert.throws(() => validateReadOnlyActivation(consumed), /RA004_ACTIVATION_SCHEMA_MISMATCH/);
  const prepared = JSON.parse(fs.readFileSync(path.join(ROOT,
    "docs/retailer-automation/evidence/RA-004-acl-rls-authenticated-reactivation.json"), "utf8"));
  assert.equal(prepared.status, "ATTEMPT_CONSUMED_FAILED_TERMINAL");
  assert.equal(prepared.execution.primary_failure, "RA004_REVOKED_CREDENTIAL_RECONNECTED");
  assert.equal(prepared.execution.role_absent, true);
  assert.equal(prepared.execution.membership_absent, true);
  assert.equal(prepared.execution.retry_authorized, false);
  assert.equal(prepared.execution.replayable, false);
  assert.throws(() => validateReadOnlyActivation(prepared), /RA004_ACTIVATION_SCHEMA_MISMATCH/);
  const priorFinal = JSON.parse(fs.readFileSync(path.join(ROOT,
    "docs/retailer-automation/evidence/RA-004-final-readonly-preflight-canary-activation.json"), "utf8"));
  assert.equal(priorFinal.status, "ATTEMPT_CONSUMED_FAILED_TERMINAL");
  assert.equal(priorFinal.execution.primary_failure, "RA004_REVOKE_CONNECTION_UNVERIFIED");
  assert.equal(priorFinal.execution.preflight_attempt_count, 1);
  assert.equal(priorFinal.execution.canary_attempt_count, 0);
  assert.equal(priorFinal.execution.retry_authorized, false);
  assert.equal(priorFinal.execution.replayable, false);
  assert.throws(() => validateReadOnlyActivation(priorFinal), /RA004_ACTIVATION_SCHEMA_MISMATCH/);
  const authorized = JSON.parse(fs.readFileSync(path.join(ROOT,
    "docs/retailer-automation/evidence/RA-004-provider-identity-staging-activation.json"), "utf8"));
  assert.equal(validateReadOnlyActivation(authorized), authorized);
  for (const mutate of [
    (value) => { value.status = "CONSUMED"; },
    (value) => { value.production.authorized = true; },
    (value) => { value.apply.maximum_attempts = 2; },
    (value) => { value.pre_activation_ledger.count = 97; },
    (value) => { value.migrations.push({ filename: "forbidden.sql", sha256: "0".repeat(64) }); },
    (value) => { value.evidence_store.session_required_before_migration = false; },
    (value) => { value.execution.started = true; },
  ]) {
    const changed = structuredClone(authorized);
    mutate(changed);
    assert.throws(() => validateReadOnlyActivation(changed), /RA004_/);
  }
});

test("post-migration inventory requires all 24 named dependencies before preflight", () => {
  const { DEPENDENCY_CONTRACT } = require("./ra004-staging-execution-coordinator");
  assert.equal(new Set(DEPENDENCY_CONTRACT.map(({ kind, identity }) => `${kind}:${identity}`)).size, 24);
  assert.ok(DEPENDENCY_CONTRACT.some(({ identity }) => identity === "public.read_retailer_control_state_v1(bigint,text,text,text,timestamp with time zone,text[],integer,integer)"));
  assert.ok(DEPENDENCY_CONTRACT.some(({ identity }) => identity === "public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)"));
  assert.match(coordinator, /RA004_DEPENDENCY_CONTRACT_DRIFT/);
  assert.match(coordinator, /dependency_contract:dependencyContract/);
});

test("execution is bound to a clean exact origin/main squash-merge commit", () => {
  const { readExecutionCommit } = require("./ra004-staging-execution-coordinator");
  const sha = "a".repeat(40);
  const outputs = [sha, sha, ""];
  assert.equal(readExecutionCommit(() => ({ status: 0, stdout: outputs.shift() })), sha);
  const mismatch = ["a".repeat(40), "b".repeat(40), ""];
  assert.throws(() => readExecutionCommit(() => ({ status: 0, stdout: mismatch.shift() })),
    /RA004_EXECUTION_COMMIT_NOT_MERGED_MAIN/);
  const dirty = [sha, sha, " M scripts/file.js"];
  assert.throws(() => readExecutionCommit(() => ({ status: 0, stdout: dirty.shift() })),
    /RA004_EXECUTION_WORKTREE_NOT_CLEAN/);
});

test("secrets remain process-only and CLI diagnostics are redacted", () => {
  assert.doesNotMatch(coordinator, /console\.log\(databaseUrl|console\.log\(password/);
  assert.match(coordinator, /delete childEnvironment\.RA004_SUPABASE_ACCESS_TOKEN/);
  assert.match(coordinator, /RA004_SUPABASE_CLI_PATH/);
  assert.match(coordinator, /PGPASSWORD/);
  assert.match(coordinator, /redactCliOutput/);
  assert.match(coordinator, /supabase-cli-failure-\$\{attempt\}\.\$\{stream\}\.txt/);
  assert.doesNotMatch(coordinator, /console\.log\(ownerUrl|console\.log\(pat/);
  assert.match(coordinator, /process\.env\.RA004_STORAGE_ANON_KEY=""/);
  assert.doesNotMatch(custodian, /console\.(?:log|error)|process\.stdout|process\.stderr/);
});

test("a failing Supabase CLI writes separate redacted stdout and stderr evidence", () => {
  const { runCli } = require("./ra004-staging-execution-coordinator");
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ra004-cli-diagnostics-"));
  const previousCli = process.env.RA004_SUPABASE_CLI_PATH;
  process.env.RA004_SUPABASE_CLI_PATH = process.execPath;
  try {
    assert.throws(() => runCli(["db", "push"], { PGPASSWORD: "secret-password" }, {
      outputDirectory,
      spawn: () => ({
        status: 1,
        stdout: "postgresql://postgres:secret-password@staging.example/db",
        stderr: "password=secret-password Bearer secret-password",
      }),
    }), (error) => {
      assert.equal(error.message, "RA004_SUPABASE_CLI_FAILED_1");
      for (const stream of ["stdout", "stderr"]) {
        const evidence = fs.readFileSync(path.join(outputDirectory,
          error.cliDiagnostics[stream].filename), "utf8");
        assert.doesNotMatch(evidence, /secret-password/);
      }
      return true;
    });
  } finally {
    process.env.RA004_SUPABASE_CLI_PATH = previousCli;
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("activation contains exactly one migration and production stays closed", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT,
    "docs/retailer-automation/evidence/RA-004-provider-identity-staging-activation.json"), "utf8"));
  assert.deepEqual(manifest.migrations, [{
    filename: "20260928101000_align_ra004_control_export_provider_identity.sql",
    sha256: "4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91",
  }]);
  assert.equal(manifest.apply.maximum_attempts, 1);
  assert.equal(manifest.apply.include_all, false);
  assert.equal(manifest.execution.migration_attempt_count, 0);
  assert.equal(manifest.production.authorized, false);
  assert.equal(manifest.production.selector_unchanged, true);
  assert.match(coordinator, /const operationAttempts=\{migration:0,preflight:0,canary:0\}/);
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
  assert.match(custodian, /supabase-cli-failure-1\.stdout\.txt/);
  assert.match(custodian, /supabase-cli-failure-1\.stderr\.txt/);
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
  const migration = coordinator.indexOf("pushSelectedMigrations(selectedWorkdir)", startWindow);
  const preflight = coordinator.indexOf("await runPreflight", startWindow);
  assert.ok(initializeStore > 0);
  assert.ok(configureStore > initializeStore);
  assert.ok(attestStore > configureStore);
  assert.ok(startWindow > attestStore);
  assert.ok(migration > startWindow);
  assert.ok(preflight > migration);
});

test("business rows are unchanged before preflight and after canary", () => {
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
  assert.equal(first.ledger_readback, null);
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

test("operation attempts are counted once and failure closeout performs read-only ledger readback", () => {
  assert.equal((coordinator.match(/operationAttempts\.migration\+=1/g) || []).length, 1);
  assert.equal((coordinator.match(/operationAttempts\.preflight\+=1/g) || []).length, 1);
  assert.equal((coordinator.match(/operationAttempts\.canary\+=1/g) || []).length, 1);
  assert.match(coordinator, /if\(primaryError\) \{\s*try \{\s*const readback=await selector\.readRemoteState\(ownerUrl\)/s);
  assert.match(coordinator, /ledgerReadback:failureLedgerReadback/);
  assert.doesNotMatch(coordinator, /failureLedgerReadback.*db push/s);

  const { buildFailureReport } = require("./ra004-staging-execution-coordinator");
  const report = buildFailureReport({
    activation: "ra004-staging-1790493761055",
    primaryError: new Error("RA004_SUPABASE_CLI_FAILED_1"),
    sessionState: {
      session_creation_state: "CREATED",
      attempt_counters: { auth: 1, upload: 2, readback: 2, cleanup: 1 },
    },
    operationAttempts: { migration: 0, preflight: 0, canary: 0 },
    ledgerReadback: {
      count: 95,
      fingerprint: "c5bb6405d26def1834522cccaf2937fad60f44156370e5e1f8c4af3ff96d45bd",
      last_migration: "20260926100000_create_ra004_staging_10reps_retailer",
    },
    cleanup: { status: "COMPLETE", failures: [] },
    startsAt: "2026-09-27T12:00:00Z",
    expiresAt: "2026-09-27T12:30:00Z",
    revoke: [],
    uploaded: [],
  });
  assert.deepEqual(report.attempt_counters, {
    auth: 1, upload: 2, readback: 2, cleanup: 1, migration: 0, preflight: 0, canary: 0,
  });
  assert.equal(report.ledger_readback.count, 95);
});

test("credential issuer is a separate process with exact RPC-only logins", () => {
  assert.match(coordinator, /fork\(path\.join\(__dirname,"ra004-staging-credential-issuer\.js"\)/);
  assert.match(issuer, /connection limit 1/);
  assert.match(issuer, /readOnly: true/);
  assert.match(issuer, /default_transaction_read_only=\$\{profile\.readOnly \? "on" : "off"\}/);
  assert.match(issuer, /statement_timeout=''15s''/);
  assert.match(issuer, /grant execute on function \$\{signature\}/);
  assert.match(issuer, /alter role \$\{id\} nologin/);
  assert.match(issuer, /drop role \$\{id\}/);
  assert.match(issuer, /RA004_ROLE_REVOKE_UNVERIFIED/);
  assert.match(coordinator, /ra004-staging-revocation-verifier\.js/);
  assert.match(verifier, /RA004_REVOKE_POOLER_HANDSHAKE_QUERY_REJECTED/);
  assert.match(verifier, /RA004_REVOKED_CREDENTIAL_QUERY_SUCCEEDED/);
  assert.match(verifier, /RA004_REVOKE_ROLE_STILL_PRESENT/);
  assert.match(verifier, /RA004_REVOKE_MEMBERSHIP_STILL_PRESENT/);
  assert.match(verifier, /RA004_REVOKE_ACTIVE_BACKEND_PRESENT/);
  assert.match(verifier, /rejectUnauthorized: true/);
  assert.match(coordinator, /RA004_OWNER_DATABASE_URL:ownerUrl,RA004_REVOKED_ROLE:role/);
  assert.doesNotMatch(issuer, /grant .*service_role|grant .*validator|grant .*approver|grant .*executor/i);
});

test("coordinator contains no feed, shadow, plan, approval, import, apply, offer or production executor", () => {
  for (const forbidden of [
    "TEN_REPS_FEED_URL", "import-products", "apply_approved", "create_control_plan",
    "approve_", "shadow-run", "Model B",
  ]) assert.doesNotMatch(coordinator, new RegExp(forbidden, "i"));
  assert.match(coordinator, /production:0,feed_capture:0,shadow_run:0,control_plan:0,approval:0,import:0,apply:0,offer_writes:0,model_b:0/);
});

test("interactive launcher masks every secret and pins the migration CLI", () => {
  assert.match(launcher, /param\(\[switch\]\$ValidateOnly\)/);
  assert.equal((launcher.match(/ConvertFrom-MaskedInput '/g) || []).length, 4);
  assert.match(launcher, /LAUNCHER_VALIDATION_PASS/);
  assert.match(launcher, /Read-Host 'Wpisz START/);
  assert.match(launcher, /\$confirmation -cne 'START'/);
  assert.match(launcher, /ra004-staging-execution-coordinator\.js/);
  for (const name of [
    "RA004_OWNER_DATABASE_URL", "RA004_STORAGE_ANON_KEY", "RA004_STORAGE_EMAIL",
    ["RA004_STORAGE", "PASSWORD"].join("_"),
  ]) assert.match(launcher, new RegExp(`\\$env:${name} = ''`));
  assert.doesNotMatch(launcher, /ACCESS_TOKEN|personal access token|\bPAT\b/i);
  assert.match(launcher, /expectedVersion = '2\.111\.0'/);
  assert.match(launcher, /Find-ExactSupabaseCli/);
  assert.match(launcher, /RA004_SUPABASE_CLI_PATH/);
  assert.doesNotMatch(launcher, /--include-all/i);
});

test("interactive launcher trusts the Windows system CA store without disabling TLS verification", () => {
  assert.match(
    launcher,
    /& node --use-system-ca \(Join-Path \$PSScriptRoot 'ra004-staging-execution-coordinator\.js'\)/,
  );
  assert.doesNotMatch(launcher, /NODE_TLS_REJECT_UNAUTHORIZED|--tls-skip-verify|rejectUnauthorized\s*=\s*false/i);
});

test("interactive launcher resolves the CA validator from its scripts directory", () => {
  assert.match(
    launcher,
    /\$caValidator = Join-Path \$PSScriptRoot 'ra004-acl-rls-readonly-audit\.js'/,
  );
  assert.match(
    launcher,
    /require\(process\.argv\[1\]\)\.validateLocalCa\(process\.env\.NODE_EXTRA_CA_CERTS\).*\$caValidator/,
  );
  assert.doesNotMatch(launcher, /require\('\.\/ra004-acl-rls-readonly-audit'\)/);
});

test("the tracked coordinator, issuer, custodian and verifier are repository files", () => {
  assert.ok(fs.existsSync(coordinatorPath));
  assert.ok(fs.existsSync(issuerPath));
  assert.ok(fs.existsSync(custodianPath));
  assert.ok(fs.existsSync(verifierPath));
  assert.ok(fs.existsSync(launcherPath));
  assert.ok(fs.existsSync(path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-004-forward-staging-migration-activation.json")));
  assert.ok(fs.existsSync(path.join(ROOT, "docs", "retailer-automation", "evidence", "RA-004-final-staging-migration-activation.json")));
});
