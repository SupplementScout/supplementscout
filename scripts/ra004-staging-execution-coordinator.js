const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { fork, spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { sha256 } = require("./lib/stable-json-hash");
const { safeFailureCode } = require("./lib/ra004-safe-failure-code");
const selector = require("./supabase-migration-selector");
const { createControlStatePostgresTransport } = require("./lib/retailer-offer-sync/ra004-bounded-live-transport-v1");
const { createLiveReadOnlyProvider } = require("./lib/retailer-offer-sync/control-state-export-v1/providers");
const { exportControlState, writeArtifact } = require("./lib/retailer-offer-sync/control-state-export-v1/exporter");
const controlAuth = require("./lib/retailer-offer-sync/control-state-export-v1/authorization");
const { SOURCE_NAMES, PROHIBITED_OPERATIONS } = require("./lib/retailer-offer-sync/control-state-export-v1/schema");
const { validateLocalCa } = require("./ra004-acl-rls-readonly-audit");
const sourceObservation = require("./ra004-staging-source-observation-capture");

const ROOT = path.resolve(__dirname, "..");
const REF = "hxnrsyyqffztlvcrtgbf";
const API_HOST = "hxnrsyyqffztlvcrtgbf.supabase.co";
const BASELINE = "227529abc7e3adf71dd88904d1d592f1126b4f17";
const TERMINAL_BASELINE = "453dbe67161318d1f49853e6b0f94c1a253fd66b";
const TERMINAL_V2_BASELINE = "10f8fbf1e040704a74460c0988da8ff00d092c78";
const ACL_MIGRATION_SHA = "58aa82b328b9bb77c09b9975892042027a493254add99fb2e1dcf045303c0b0d";
const PROVIDER_IDENTITY_SHA = "4454cebd1e462a20d4a612d253025c013b5c8276a4d51aa4e43016a7f248fc91";
const BUCKET = "ra004-staging-preflight-evidence";
const EXPECTED_LEDGER_COUNT = 99;
const EXPECTED_LEDGER_FINGERPRINT = "a6e7693f964925554e807602752e4630d14f537a1d9de4fe82f8433d30c307cc";
const PRIOR_PREFLIGHT_FINGERPRINT = "b1719dbbaad328e7bc0f0dc7b24307f3b5c828fe1af43d7cad5e98aa9599f40c";
const ACTIVATION_MANIFEST = "RA-004-atomic-source-observation-canary-activation-v3.json";
const TERMINAL_ACTIVATION_MANIFEST = "RA-004-final-control-state-canary-activation.json";
const TERMINAL_V2_ACTIVATION_MANIFEST = "RA-004-final-control-state-canary-reactivation-v2.json";
const REQUIRED_APPLIED_MIGRATIONS = Object.freeze([
  ["20260928100000_diagnose_ra004_preflight_acl_rls.sql", ACL_MIGRATION_SHA],
  ["20260928101000_align_ra004_control_export_provider_identity.sql", PROVIDER_IDENTITY_SHA],
]);
const EVIDENCE_NAMES = Object.freeze([
  "source-observation.json", "source-observation-revoke.json",
  "control-state-canary.json", "control-state-revoke.json", "policy-attestation.json",
  "execution-report.json",
]);
const ownerUrl = process.env.RA004_OWNER_DATABASE_URL;
const outDir = path.join(ROOT, "tmp", "ra004-live-evidence-20260929-atomic-observation-canary");
fs.mkdirSync(outDir, { recursive: true });

function invariant(ok, message) { if (!ok) throw new Error(message); }
function utc(date = new Date()) { return date.toISOString().replace(/\.\d{3}Z$/, "Z"); }
function hashFile(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function jsonWrite(file, value) {
  const target = path.join(outDir, file);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  return target;
}
function buildFailureReport({ activation, executionCommit = null, primaryError, sessionState,
  operationAttempts = {}, ledgerReadback = null, cleanup, startsAt, expiresAt,
  closedAt = utc(), revoke, uploaded }) {
  invariant(cleanup.failures.length === 0
    && new Set(["COMPLETE", "ALREADY_COMPLETE", "NOT_REQUIRED"]).has(cleanup.status)
    && new Set(["COMPLETE", "ALREADY_COMPLETE", "NOT_REQUIRED"]).has(sessionState.cleanup_status),
  "RA004_TERMINAL_CLOSEOUT_CLEANUP_INCOMPLETE");
  return {
    schema_version: "ra004-staging-closeout-v2", status: "BLOCKED", activation_id: activation,
    baseline_sha: BASELINE, execution_commit: executionCommit,
    primary_failure: { code: safeFailureCode(primaryError) },
    session_creation: { state: sessionState.session_creation_state },
    cleanup: { status: cleanup.status, failures: [...cleanup.failures] },
    attempt_counters: { ...sessionState.attempt_counters, ...operationAttempts },
    ledger_readback: ledgerReadback,
    window: { started: startsAt !== null, starts_at: startsAt, expires_at: expiresAt, closed_at: closedAt },
    revoke_receipts: revoke.map((item) => ({
      credential_id: item.credential_id, access_revoked: item.access_revoked,
      revocation_verification: item.revocation_verification,
    })),
    uploaded_objects: [...uploaded],
    forbidden_operations: {
      production: 0, migration: 0, preflight: 0, feed_capture: 0, shadow_run: 0,
      control_plan: 0, approval: 0, import: 0, apply: 0, offer_writes: 0, model_b: 0,
    },
  };
}
function readExecutionCommit(spawn = spawnSync) {
  const run = (...args) => spawn("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const headResult = run("rev-parse", "HEAD");
  const mainResult = run("rev-parse", "origin/main");
  const parentResult = run("rev-parse", "HEAD^");
  const statusResult = run("status", "--porcelain", "--untracked-files=no");
  const head = String(headResult.stdout || "").trim();
  const main = String(mainResult.stdout || "").trim();
  const parent = String(parentResult.stdout || "").trim();
  invariant(headResult.status === 0 && mainResult.status === 0 && parentResult.status === 0
    && /^[0-9a-f]{40}$/.test(head),
    "RA004_EXECUTION_COMMIT_UNAVAILABLE");
  invariant(head === main, "RA004_EXECUTION_COMMIT_NOT_MERGED_MAIN");
  invariant(parent === BASELINE, "RA004_EXECUTION_BASELINE_MISMATCH");
  invariant(statusResult.status === 0 && String(statusResult.stdout || "").trim() === "",
    "RA004_EXECUTION_WORKTREE_NOT_CLEAN");
  return head;
}
function verifiedTls() {
  const hostname = new URL(ownerUrl).hostname;
  return { rejectUnauthorized: true, servername: hostname, minVersion: "TLSv1.2" };
}
async function db(text, values = []) {
  const client = new Client({ connectionString: ownerUrl, ssl: verifiedTls(),
    application_name: "ra004-final-control-state-canary-v1" });
  try { await client.connect(); return await client.query(text, values); }
  finally { await client.end(); }
}
async function businessCounts() {
  return (await db(`select
    (select count(*)::text from public.products) products,
    (select count(*)::text from public.product_variants) product_variants,
    (select count(*)::text from public.retailer_products) retailer_products,
    (select count(*)::text from public.offers) offers,
    (select count(*)::text from public.price_history) price_history`)).rows[0];
}
async function ownerTransaction(statements) {
  const client = new Client({ connectionString: ownerUrl, ssl: verifiedTls(),
    application_name: "ra004-evidence-policy-owner-v1" });
  try {
    await client.connect(); await client.query("begin");
    for (const statement of statements) await client.query(statement);
    await client.query("commit");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally { await client.end(); }
}
function credentialReader() {
  let sequence = 0;
  const pending = new Map();
  const child = fork(path.join(__dirname, "ra004-staging-credential-issuer.js"), [], {
    env: { RA004_OWNER_DATABASE_URL: ownerUrl, NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.on("message", (message) => {
    const item = pending.get(message.request_id);
    if (!item) return;
    pending.delete(message.request_id);
    if (message.ok) item.resolve(message.result); else item.reject(new Error(message.error));
  });
  return {
    call(message) { return new Promise((resolve, reject) => {
      const request_id = ++sequence; pending.set(request_id, { resolve, reject });
      child.send({ ...message, request_id });
    }); },
    close() { child.disconnect(); },
  };
}
function verifyRevokedCredential(databaseUrl, role) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, "ra004-staging-revocation-verifier.js"), [], {
      env: { RA004_REVOKED_DATABASE_URL: databaseUrl, RA004_OWNER_DATABASE_URL: ownerUrl,
        RA004_REVOKED_ROLE: role, NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    child.once("message", (message) => {
      child.disconnect(); if (message.ok) resolve(message.result); else reject(new Error(message.error));
    });
    child.once("error", reject);
  });
}
function evidenceCustodian(activation, expiresAt) {
  let sequence = 0;
  const pending = new Map();
  const storageEnvironment = {
    RA004_STORAGE_ANON_KEY: process.env.RA004_STORAGE_ANON_KEY,
    RA004_STORAGE_RUNTIME_ANON_KEY: process.env.RA004_STORAGE_ANON_KEY,
    RA004_STORAGE_EMAIL: process.env.RA004_STORAGE_EMAIL,
    RA004_STORAGE_PASSWORD: process.env.RA004_STORAGE_PASSWORD,
    RA004_STORAGE_ACTIVATION_ID: activation,
    RA004_STORAGE_WINDOW_EXPIRES_AT: expiresAt,
    NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
  };
  const child = fork(path.join(__dirname, "ra004-staging-evidence-custodian.js"), [], {
    env: storageEnvironment, stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.on("message", (message) => {
    const item = pending.get(message.request_id);
    if (!item) return;
    pending.delete(message.request_id);
    if (message.ok) item.resolve(message.result);
    else { const error = new Error(message.error); error.details = message.details; item.reject(error); }
  });
  process.env.RA004_STORAGE_ANON_KEY = "";
  process.env.RA004_STORAGE_EMAIL = "";
  process.env.RA004_STORAGE_PASSWORD = "";
  return {
    call(message) { return new Promise((resolve, reject) => {
      const request_id = ++sequence; pending.set(request_id, { resolve, reject });
      child.send({ ...message, request_id });
    }); },
    close() { child.disconnect(); },
  };
}
async function configureEvidenceStore(subject, activation) {
  invariant(/^[0-9a-f-]{36}$/i.test(subject) && /^ra004-staging-\d{13}$/.test(activation),
    "RA004_STORAGE_POLICY_INPUT_INVALID");
  const broad = (await db(`select polname from pg_policy where polrelid='storage.objects'::regclass
    and (0=any(polroles) or 'anon'::regrole::oid=any(polroles)
      or 'authenticated'::regrole::oid=any(polroles))`)).rows;
  invariant(broad.length === 0, "RA004_STORAGE_EXISTING_BROAD_POLICY");
  const suffix = activation.slice(-13);
  const insertPolicy = `ra004_ev_insert_${suffix}`;
  const selectPolicy = `ra004_ev_select_${suffix}`;
  const names = EVIDENCE_NAMES.map((name) => `'${activation}/${name}'`).join(",");
  const scope = `bucket_id='${BUCKET}' and auth.uid()='${subject}'::uuid and name=any(array[${names}]::text[])`;
  await ownerTransaction([
    `insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('${BUCKET}','${BUCKET}',false,2097152,array['application/json','text/plain']) on conflict(id) do nothing`,
    `create policy ${insertPolicy} on storage.objects for insert to authenticated with check (${scope})`,
    `create policy ${selectPolicy} on storage.objects for select to authenticated using (${scope})`,
  ]);
  return { insertPolicy, selectPolicy };
}
async function attestEvidenceStore(policies) {
  const bucket = (await db("select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id=$1", [BUCKET])).rows;
  const policyRows = (await db(`select polname,polcmd,pg_get_expr(polqual,polrelid) policy_using,
    pg_get_expr(polwithcheck,polrelid) policy_check from pg_policy
    where polrelid='storage.objects'::regclass and polname=any($1::text[]) order by polname`,
  [[policies.insertPolicy, policies.selectPolicy]])).rows;
  invariant(bucket.length === 1 && bucket[0].public === false
    && Number(bucket[0].file_size_limit) === 2097152
    && JSON.stringify(bucket[0].allowed_mime_types) === JSON.stringify(["application/json", "text/plain"]),
  "RA004_BUCKET_POLICY_MISMATCH");
  invariant(policyRows.length === 2
    && policyRows.some((row) => row.polname === policies.insertPolicy && row.polcmd === "a")
    && policyRows.some((row) => row.polname === policies.selectPolicy && row.polcmd === "r"),
  "RA004_STORAGE_POLICY_MISMATCH");
  return { bucket_id: BUCKET, private: true, file_size_limit: 2097152,
    allowed_mime_types: ["application/json", "text/plain"], insert_policy: policies.insertPolicy,
    select_policy: policies.selectPolicy, update_policy: false, delete_policy: false,
    whole_bucket_listing: false };
}
async function removeEvidencePolicies(policies) {
  if (!policies) return { policies_revoked: true };
  await ownerTransaction([
    `drop policy if exists ${policies.insertPolicy} on storage.objects`,
    `drop policy if exists ${policies.selectPolicy} on storage.objects`,
  ]);
  const remaining = (await db(`select count(*)::integer count from pg_policy
    where polrelid='storage.objects'::regclass and polname=any($1::text[])`,
  [[policies.insertPolicy, policies.selectPolicy]])).rows[0];
  invariant(remaining.count === 0, "RA004_STORAGE_POLICY_REVOKE_UNVERIFIED");
  return { policies_revoked: true };
}
function validateReadOnlyActivation(value) {
  invariant(value?.schema_version === "ra-004-atomic-source-observation-canary-activation-v1",
    "RA004_ACTIVATION_SCHEMA_MISMATCH");
  invariant(value.status === "OWNER_AUTHORIZED_PREPARED_NOT_EXECUTED" && value.baseline_sha === BASELINE,
    "RA004_ACTIVATION_NOT_AUTHORIZED");
  invariant(value.target?.environment === "STAGING" && value.target?.project_ref === REF
    && value.target?.parent_project_ref === "aftboxmrdgyhizicfsfu"
    && value.target?.database_host === "aws-0-eu-west-3.pooler.supabase.com"
    && value.target?.persistent_branch === true
    && value.target?.retailer?.id === "11" && value.target?.retailer?.slug === "10-reps",
  "RA004_ACTIVATION_TARGET_MISMATCH");
  invariant(value.production?.authorized === false && value.production?.selector_unchanged === true,
    "RA004_PRODUCTION_SELECTOR_NOT_CLOSED");
  invariant(value.ledger?.count === EXPECTED_LEDGER_COUNT
    && value.ledger?.fingerprint === EXPECTED_LEDGER_FINGERPRINT
    && value.ledger?.last_version === "20260928101000"
    && value.ledger?.last_name === "align_ra004_control_export_provider_identity",
  "RA004_ACTIVATION_LEDGER_MISMATCH");
  invariant(Array.isArray(value.migrations) && value.migrations.length === 0
    && value.migration_attempts_authorized === 0, "RA004_ACTIVATION_MIGRATION_MISMATCH");
  invariant(value.preflight?.attempts_authorized === 0
    && value.preflight?.prior_status === "VERIFIED_COMPLETE"
    && value.preflight?.report_fingerprint === PRIOR_PREFLIGHT_FINGERPRINT
    && value.source_observation?.maximum_transactions === 1
    && value.source_observation?.required_rows === sourceObservation.SOURCES.length
    && value.source_observation?.lifetime_minutes === sourceObservation.OBSERVATION_LIFETIME_MS / 60_000
    && value.source_observation?.retry_authorized === false
    && value.source_observation?.same_activation_before_canary === true
    && JSON.stringify(value.source_observation?.required_sources) === JSON.stringify(sourceObservation.SOURCES)
    && value.canary?.maximum_attempts === 1 && value.canary?.automatic_retry === false
    && value.canary?.read_only === true, "RA004_ACTIVATION_ATTEMPTS_MISMATCH");
  invariant(value.evidence_store?.session_required_before_source_observation === true
    && value.evidence_store?.session_required_before_canary === true
    && value.evidence_store?.authentication_attempts === 1, "RA004_EVIDENCE_STORE_GATE_MISMATCH");
  invariant(value.execution?.started === false && value.execution?.migration_attempt_count === 0
    && value.execution?.preflight_attempt_count === 0
    && value.execution?.source_observation_transaction_count === 0
    && value.execution?.source_observation_row_count === 0
    && value.execution?.canary_attempt_count === 0
    && value.execution?.closed === false && value.execution?.retry_authorized === false
    && value.execution?.replayable === false, "RA004_ACTIVATION_EXECUTION_STATE_MISMATCH");
  return value;
}
function validateTerminalActivation(value) {
  invariant(value?.schema_version === "ra-004-final-control-state-canary-activation-v1"
    && value.status === "ATTEMPT_CONSUMED_FAILED_TERMINAL"
    && value.baseline_sha === TERMINAL_BASELINE, "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.target?.environment === "STAGING" && value.target?.project_ref === REF
    && value.target?.parent_project_ref === "aftboxmrdgyhizicfsfu"
    && value.target?.database_host === "aws-0-eu-west-3.pooler.supabase.com"
    && value.target?.retailer?.id === "11" && value.target?.retailer?.slug === "10-reps",
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.production?.authorized === false && value.production?.selector_unchanged === true
    && Array.isArray(value.migrations) && value.migrations.length === 0
    && value.migration_attempts_authorized === 0
    && value.preflight?.attempts_authorized === 0 && value.canary?.maximum_attempts === 1
    && value.canary?.automatic_retry === false && value.canary?.read_only === true,
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.ledger?.count === EXPECTED_LEDGER_COUNT
    && value.ledger?.fingerprint === EXPECTED_LEDGER_FINGERPRINT
    && value.ledger?.last_version === "20260928101000",
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.execution?.started === true && value.execution?.canary_attempt_count === 1
    && value.execution?.migration_attempt_count === 0 && value.execution?.preflight_attempt_count === 0
    && value.execution?.closed === true && value.execution?.retry_authorized === false
    && value.execution?.replayable === false, "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  return value;
}
function validateCurrentTerminalActivation(value) {
  invariant(value?.schema_version === "ra-004-final-control-state-canary-activation-v1"
    && value.status === "ATTEMPT_CONSUMED_FAILED_TERMINAL"
    && value.activation_id === "ra004-final-control-state-canary-2026-09-29-v2"
    && value.baseline_sha === TERMINAL_V2_BASELINE, "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.target?.environment === "STAGING" && value.target?.project_ref === REF
    && value.target?.parent_project_ref === "aftboxmrdgyhizicfsfu"
    && value.target?.database_host === "aws-0-eu-west-3.pooler.supabase.com"
    && value.target?.retailer?.id === "11" && value.target?.retailer?.slug === "10-reps",
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.production?.authorized === false && value.production?.selector_unchanged === true
    && Array.isArray(value.migrations) && value.migrations.length === 0
    && value.migration_attempts_authorized === 0
    && value.preflight?.attempts_authorized === 0 && value.canary?.maximum_attempts === 1
    && value.canary?.automatic_retry === false && value.canary?.read_only === true,
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.ledger?.count === EXPECTED_LEDGER_COUNT
    && value.ledger?.fingerprint === EXPECTED_LEDGER_FINGERPRINT
    && value.ledger?.last_version === "20260928101000",
  "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  invariant(value.execution?.runtime_activation_id === "ra004-staging-1790671083395"
    && value.execution?.execution_commit === "7689eb4d7cb9619b9bc0fe10ae068599debd97bd"
    && value.execution?.started === true && value.execution?.canary_attempt_count === 1
    && value.execution?.migration_attempt_count === 0 && value.execution?.preflight_attempt_count === 0
    && value.execution?.primary_failure === "CONTROL_EXPORT_SOURCE_UNAVAILABLE"
    && value.execution?.ledger_after_failure?.count === EXPECTED_LEDGER_COUNT
    && value.execution?.ledger_after_failure?.fingerprint === EXPECTED_LEDGER_FINGERPRINT
    && value.execution?.credential_revocation?.role_absent === true
    && value.execution?.credential_revocation?.membership_absent === true
    && value.execution?.credential_revocation?.active_backend_absent === true
    && value.execution?.evidence_store_session === "CLOSED"
    && value.execution?.cleanup === "COMPLETE"
    && value.execution?.closed === true && value.execution?.retry_authorized === false
    && value.execution?.replayable === false, "RA004_ACTIVATION_TERMINAL_STATE_INVALID");
  return value;
}
function activationPath() {
  return path.join(ROOT, "docs", "retailer-automation", "evidence", ACTIVATION_MANIFEST);
}
function assertActivationExecutable() {
  const value = JSON.parse(fs.readFileSync(activationPath(), "utf8"));
  return validateReadOnlyActivation(value);
}
function assertSelectorsClosed(contracts = selector.CONTRACTS) {
  const staging = contracts.STAGING;
  const production = contracts.PRODUCTION;
  for (const [filename, sha] of REQUIRED_APPLIED_MIGRATIONS) {
    invariant(staging.appliedExcluded.includes(filename)
      && staging.excluded[filename] === sha
      && !staging.pending.some((entry) => entry.filename === filename),
    "RA004_STAGING_SELECTOR_NOT_CLOSED");
    invariant(production.excluded[filename] === sha
      && !production.pending.some((entry) => entry.filename === filename),
    "RA004_PRODUCTION_SELECTOR_NOT_CLOSED");
  }
  return true;
}
function ensureWindow(expires) { invariant(Date.now() < expires.getTime(), "RA004_WINDOW_EXPIRED"); }
function ensureObservationFresh(expiresAt, now = Date.now(), minimumRemainingMs = 5 * 60_000) {
  const expires = new Date(expiresAt).getTime();
  invariant(Number.isFinite(expires) && Number.isFinite(now)
    && expires - now >= minimumRemainingMs, "RA004_SOURCE_OBSERVATION_WINDOW_TOO_SHORT");
  return true;
}

async function main() {
  assertActivationExecutable();
  invariant(ownerUrl && process.env.RA004_STORAGE_ANON_KEY
    && process.env.RA004_STORAGE_EMAIL && process.env.RA004_STORAGE_PASSWORD,
  "RA004_AUTHENTICATION_MISSING");
  const parsed = new URL(ownerUrl);
  invariant(!`${parsed.hostname}|${parsed.username}`.match(/aftboxmrdgyhizicfsfu|prod/i),
    "RA004_PRODUCTION_TARGET_REJECTED");
  validateLocalCa(process.env.NODE_EXTRA_CA_CERTS);
  assertSelectorsClosed();
  const executionCommit = readExecutionCommit();
  const remote = await selector.readRemoteState(ownerUrl);
  const ledgerFingerprint = selector.ledgerRowsFingerprint(remote.remoteLedger, {
    contractVersion: selector.RA004_LEDGER_FINGERPRINT_VERSION,
    targetEnvironment: "STAGING",
  });
  invariant(remote.remoteLedger.length === EXPECTED_LEDGER_COUNT
    && ledgerFingerprint === EXPECTED_LEDGER_FINGERPRINT
    && remote.remoteLedger.at(-1)?.version === "20260928101000"
    && remote.remoteLedger.at(-1)?.name === "align_ra004_control_export_provider_identity",
  "RA004_LEDGER_MISMATCH");
  const activationManifest = validateReadOnlyActivation(JSON.parse(fs.readFileSync(activationPath(), "utf8")));
  const appliedIdentifiers = new Set(remote.remoteLedger.map((row) => `${row.version}_${row.name}.sql`));
  invariant(REQUIRED_APPLIED_MIGRATIONS.every(([file, hash]) => appliedIdentifiers.has(file)
    && hashFile(path.join(ROOT, "supabase", "migrations", file)) === hash),
  "RA004_APPLIED_MIGRATION_STATE_MISMATCH");
  invariant(activationManifest.migrations.length === 0, "RA004_MIGRATION_PATH_PRESENT");

  const retailer = (await db("select id::text,name,slug from public.retailers where lower(name)='10 reps' or lower(slug)='10-reps'")).rows;
  invariant(retailer.length === 1 && retailer[0].name === "10 Reps"
    && retailer[0].slug === "10-reps" && retailer[0].id === "11", "RA004_RETAILER_AMBIGUOUS");
  const interfaces = (await db(`select
    to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)') control_rpc,
    to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)') preflight_rpc`)).rows[0];
  invariant(interfaces.control_rpc !== null && interfaces.preflight_rpc !== null,
    "RA004_REQUIRED_INTERFACE_MISSING");
  const preexistingStoragePolicies = (await db(`select polname from pg_policy
    where polrelid='storage.objects'::regclass
      and (0=any(polroles) or 'anon'::regrole::oid=any(polroles)
        or 'authenticated'::regrole::oid=any(polroles))`)).rows;
  invariant(preexistingStoragePolicies.length === 0, "RA004_STORAGE_EXISTING_BROAD_POLICY");
  const businessBefore = await businessCounts();

  const activation = `ra004-staging-${Date.now()}`;
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  const expiresAt = utc(expires);
  let startsAt = null;
  let custody;
  let policies;
  let issuer;
  let observationCredential;
  let canaryCredential;
  let primaryError = null;
  let sessionState = {
    session_creation_state: "NOT_CREATED", cleanup_status: "NOT_REQUIRED",
    attempt_counters: { auth: 0, upload: 0, readback: 0, cleanup: 0 },
  };
  const operationAttempts = {
    migration: 0, preflight: 0, source_observation_transactions: 0,
    source_observation_rows: 0, canary: 0, retry: 0,
  };
  let failureLedgerReadback = null;
  const cleanup = { status: "NOT_REQUIRED", failures: [] };
  const revoke = [];
  const uploaded = [];
  let successfulExecution = null;
  const revokeOne = async (credential, runnerProcessId) => {
    const databaseUrl = credential.database_url;
    const receipt = await issuer.call({ action: "revoke", role: credential.role,
      runner_process_id: runnerProcessId });
    const verification = await verifyRevokedCredential(databaseUrl, credential.role);
    revoke.push({ ...receipt, issued_at: credential.issued_at, expires_at: credential.expires_at,
      revoked_at: utc(), revocation_verification: verification });
    return receipt;
  };

  try {
    custody = evidenceCustodian(activation, expiresAt);
    let storageSession;
    try {
      storageSession = await custody.call({ action: "init" });
      sessionState = { session_creation_state: storageSession.session_creation_state,
        cleanup_status: storageSession.cleanup_status,
        attempt_counters: { ...storageSession.attempt_counters } };
    } catch (error) {
      if (error.details) sessionState = error.details;
      throw error;
    }
    policies = await configureEvidenceStore(storageSession.subject, activation);
    const policyAttestation = await attestEvidenceStore(policies);
    startsAt = utc();
    ensureWindow(expires);
    const store = {
      schema_version: "ra-004-evidence-store-metadata-v1", store_identifier: BUCKET,
      private: true, encryption: "AT_REST_AND_IN_TRANSIT", write_once: true,
      access_audit: true, readback_supported: true, raw_retention_days: 90,
      derived_retention_days: 90, approved_by: "Marek-Kalinka", approved_at: startsAt,
      evidence_store_fingerprint: "0".repeat(64),
    };
    store.evidence_store_fingerprint = sha256(store);
    const identity = {
      schema_version: "ra-004-project-identity-v1", project_reference: REF,
      canonical_host: API_HOST, environment_label: "STAGING",
      project_identity_fingerprint: "0".repeat(64), observed_at: startsAt,
    };
    identity.project_identity_fingerprint = sha256(identity);
    uploaded.push(await custody.call({ action: "put", name: "policy-attestation.json",
      value: { ...policyAttestation, activation_id: activation, execution_commit: executionCommit,
        storage_subject_fingerprint: sha256(storageSession.subject),
        retention: { redacted_bundle_days: 90, fingerprint_receipt_years: 7 } } }));

    issuer = credentialReader();
    const observationInventory = await sourceObservation.observeSources(ownerUrl);
    const observationStarted = new Date();
    const observationExpires = new Date(observationStarted.getTime()
      + sourceObservation.OBSERVATION_LIFETIME_MS);
    const observationStartedAt = observationStarted.toISOString();
    const observationExpiresAt = observationExpires.toISOString();
    invariant(observationExpires.getTime() < expires.getTime(), "RA004_SOURCE_OBSERVATION_WINDOW_INVALID");
    const observationRunId = `${activation}-source-observation`;
    const observationEvents = sourceObservation.buildEvents({
      activationId: observationRunId,
      observedAt: observationStartedAt,
      expiresAt: observationExpiresAt,
      inventory: observationInventory,
    });
    invariant(observationEvents.length === sourceObservation.SOURCES.length,
      "RA004_SOURCE_OBSERVATION_EVENT_COUNT_MISMATCH");
    observationCredential = await issuer.call({
      action: "create", kind: "evidence", expires_at: observationExpiresAt,
    });
    operationAttempts.source_observation_transactions += 1;
    const observationReceipts = await sourceObservation.writeEvents(
      observationCredential.database_url, observationEvents);
    const observationReadback = await sourceObservation.readback(ownerUrl, observationRunId);
    invariant(observationReceipts.length === sourceObservation.SOURCES.length
      && observationReadback.row_count === sourceObservation.SOURCES.length,
    "RA004_SOURCE_OBSERVATION_COMMIT_MISMATCH");
    operationAttempts.source_observation_rows = observationReadback.row_count;
    const observationReport = {
      schema_version: "ra004-atomic-source-observation-v1",
      status: "VERIFIED_COMPLETE",
      activation_id: activation,
      source_run_id: observationRunId,
      target: { environment: "STAGING", project_ref: REF, retailer_id: retailer[0].id },
      window: { observed_at: observationStartedAt, expires_at: observationExpiresAt,
        lifetime_minutes: sourceObservation.OBSERVATION_LIFETIME_MS / 60_000 },
      inventory: observationInventory,
      sources: [...sourceObservation.SOURCES],
      readback: observationReadback,
      transaction_count: operationAttempts.source_observation_transactions,
      committed_row_count: operationAttempts.source_observation_rows,
      retry_count: operationAttempts.retry,
    };
    jsonWrite("source-observation.json", observationReport);
    uploaded.push(await custody.call({ action: "put", name: "source-observation.json",
      value: observationReport }));
    const observationRevokeReceipt = await revokeOne(observationCredential, process.pid);
    observationCredential = null;
    uploaded.push(await custody.call({ action: "put", name: "source-observation-revoke.json",
      value: { ...observationRevokeReceipt,
        revocation_verification: revoke.at(-1).revocation_verification } }));
    ensureObservationFresh(observationExpiresAt);

    canaryCredential = await issuer.call({
      action: "create", kind: "control", expires_at: observationExpiresAt,
    });
    const authorization = {
      version: "control-state-export-authorization-v1", status: "AUTHORIZED",
      retailer_id: retailer[0].id, retailer_name: "10 Reps", allowed_scope: [...SOURCE_NAMES],
      baseline_sha: BASELINE, task_id: "RA-004", valid_from: startsAt,
      expires_at: observationExpiresAt,
      operation: "READ_ONLY_CONTROL_STATE_EXPORT", prohibited_operations: [...PROHIBITED_OPERATIONS],
      owner_consent: "OWNER_APPROVED", authorization_fingerprint: "0".repeat(64),
    };
    authorization.authorization_fingerprint = controlAuth.authorizationFingerprint(authorization);
    const provider = createLiveReadOnlyProvider({ authorization,
      providerConfiguration: { provider_id:"transactional-rpc-v1",
        credential_type: "DEDICATED_CONTROL_STATE_EXPORTER",
        rpc_name: "public.read_retailer_control_state_v1",
        expected_session_user: canaryCredential.role },
      transport: createControlStatePostgresTransport({ databaseUrl: canaryCredential.database_url,
        projectReference: REF, expectedSessionUser: canaryCredential.role }) });
    operationAttempts.canary += 1;
    const canaryReport = await exportControlState({ provider, authorization,
      retailer_id: retailer[0].id, retailer_name: "10 Reps", baseline_sha: BASELINE,
      provider_mode: "live-read-only", now: utc() });
    writeArtifact(path.join(outDir, "control-state-canary.json"), canaryReport);
    uploaded.push(await custody.call({ action: "put", name: "control-state-canary.json", value: canaryReport }));
    const canaryReceipt = await revokeOne(canaryCredential, process.pid);
    canaryCredential = null;
    uploaded.push(await custody.call({ action: "put", name: "control-state-revoke.json",
      value: { ...canaryReceipt, revocation_verification: revoke.at(-1).revocation_verification } }));
    ensureWindow(expires);
    const businessAfterCanary = await businessCounts();
    invariant(JSON.stringify(businessAfterCanary) === JSON.stringify(businessBefore),
      "RA004_BUSINESS_DATA_CHANGED_DURING_READ_ONLY_EXECUTION");
    const canaryClear = canaryReport.final_assessment === "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION";
    const executionReport = {
      schema_version: "ra004-staging-execution-report-v1",
      status: canaryClear ? "VERIFIED_COMPLETE" : "BLOCKED_CONTROL_STATE",
      activation_id: activation, baseline_sha: BASELINE, execution_commit: executionCommit,
      window: { starts_at: startsAt, expires_at: expiresAt, closed_at: utc() },
      project_identity: identity,
      retailer: { id: retailer[0].id, name: retailer[0].name, slug: retailer[0].slug },
      evidence_store: { ...store, ...policyAttestation }, migration_receipts: [],
      ledger: { before_count: remote.remoteLedger.length, after_count: remote.remoteLedger.length,
        fingerprint: ledgerFingerprint,
        last_migration: "20260928101000_align_ra004_control_export_provider_identity" },
      attempt_counters: { ...sessionState.attempt_counters, ...operationAttempts },
      business_counts: { before: businessBefore, after_canary: businessAfterCanary, unchanged: true },
      source_observation: observationReport,
      preflight: { status: "VERIFIED_COMPLETE", reused_prior_evidence: true, attempts: 0,
        report_fingerprint: PRIOR_PREFLIGHT_FINGERPRINT },
      canary: { status: canaryClear ? "VERIFIED_COMPLETE" : "BLOCKED",
        final_assessment: canaryReport.final_assessment,
        export_fingerprint: canaryReport.export_fingerprint,
        read_attempt_count: canaryReport.read_attempt_count,
        write_attempt_count: canaryReport.write_attempt_count,
        mutation_attempt_count: canaryReport.mutation_attempt_count },
      revoke_receipts: revoke.map((item) => ({ credential_id: item.credential_id,
        access_revoked: item.access_revoked, revocation_verification: item.revocation_verification })),
      uploaded_objects: uploaded,
      forbidden_operations: { production: 0, migration: 0, preflight: 0, feed_capture: 0,
        shadow_run: 0, control_plan: 0, approval: 0, import: 0, apply: 0,
        offer_writes: 0, model_b: 0 },
    };
    uploaded.push(await custody.call({ action: "put", name: "execution-report.json", value: executionReport }));
    successfulExecution = executionReport;
    invariant(canaryClear, "RA004_CANARY_CONTROL_STATE_BLOCKED");
  } catch (error) {
    primaryError = error;
    if (error.details) sessionState = error.details;
  } finally {
    if (observationCredential && issuer) {
      try { await revokeOne(observationCredential, process.pid); }
      catch { cleanup.failures.push("source-observation"); }
      observationCredential = null;
    }
    if (canaryCredential && issuer) {
      try { await revokeOne(canaryCredential, process.pid); }
      catch { cleanup.failures.push("canary"); }
      canaryCredential = null;
    }
    if (issuer) issuer.close();
    if (primaryError) {
      try {
        const readback = await selector.readRemoteState(ownerUrl);
        const last = readback.remoteLedger.at(-1) || null;
        failureLedgerReadback = { count: readback.remoteLedger.length,
          fingerprint: selector.ledgerRowsFingerprint(readback.remoteLedger, { targetEnvironment: "STAGING" }),
          last_migration: last ? `${last.version}_${last.name}` : null };
      } catch { cleanup.failures.push("failure-ledger-readback"); }
      if (!successfulExecution && custody && sessionState.session_creation_state !== "NOT_CREATED") {
        try { uploaded.push(await custody.call({ action: "put", name: "execution-report.json", value: {
          schema_version: "ra004-staging-execution-report-v1", status: "FAILED_PENDING_CLEANUP",
          activation_id: activation, execution_commit: executionCommit,
          primary_failure: { code: safeFailureCode(primaryError) },
          attempt_counters: { ...sessionState.attempt_counters, ...operationAttempts },
          ledger_readback: failureLedgerReadback,
        } })); }
        catch { cleanup.failures.push("failure-evidence"); }
      }
    }
    try { await removeEvidencePolicies(policies); }
    catch { cleanup.failures.push("storage-policies"); }
    if (custody) {
      if (sessionState.session_creation_state !== "NOT_CREATED") {
        try {
          const receipt = await custody.call({ action: "close" });
          cleanup.status = receipt.cleanup_status;
          sessionState = await custody.call({ action: "status" });
        } catch (error) {
          cleanup.status = "FAILED";
          cleanup.failures.push("storage-session");
          if (error.details) sessionState = error.details;
        }
      }
      custody.close();
    }
    if (cleanup.failures.length > 0 && !primaryError) primaryError = new Error("RA004_CLEANUP_UNVERIFIED");
    process.env.RA004_OWNER_DATABASE_URL = "";
  }
  if (primaryError && cleanup.failures.length === 0) {
    const failure = buildFailureReport({ activation, executionCommit, primaryError, sessionState,
      operationAttempts, ledgerReadback: failureLedgerReadback, cleanup, startsAt, expiresAt,
      revoke, uploaded });
    try { jsonWrite("failure-closeout.json", failure); } catch {}
  }
  if (primaryError) throw primaryError;
  invariant(successfulExecution !== null && cleanup.failures.length === 0,
    "RA004_TERMINAL_CLOSEOUT_CLEANUP_INCOMPLETE");
  const closeout = { ...successfulExecution,
    cleanup: { status: cleanup.status, failures: [...cleanup.failures] },
    evidence_store_session: { state: sessionState.session_creation_state,
      cleanup_status: sessionState.cleanup_status },
    uploaded_objects: [...uploaded],
  };
  jsonWrite("closeout.json", closeout);
  process.stdout.write(`${JSON.stringify({ status: closeout.status, activation_id: activation,
    ledger_count: closeout.ledger.after_count, preflight_attempt_count: 0,
    source_observation_transaction_count: operationAttempts.source_observation_transactions,
    source_observation_row_count: operationAttempts.source_observation_rows, canary_attempt_count: 1,
    final_assessment: closeout.canary.final_assessment,
    closeout: path.join(outDir, "closeout.json") })}\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${safeFailureCode(error)}\n`); process.exitCode = 1; });
}

module.exports = {
  ACL_MIGRATION_SHA, ACTIVATION_MANIFEST, API_HOST, BASELINE, BUCKET,
  EXPECTED_LEDGER_COUNT, EXPECTED_LEDGER_FINGERPRINT, PRIOR_PREFLIGHT_FINGERPRINT,
  PROVIDER_IDENTITY_SHA, REF, REQUIRED_APPLIED_MIGRATIONS, TERMINAL_ACTIVATION_MANIFEST,
  TERMINAL_BASELINE, TERMINAL_V2_ACTIVATION_MANIFEST, TERMINAL_V2_BASELINE,
  assertSelectorsClosed, assertActivationExecutable, buildFailureReport, ensureObservationFresh,
  readExecutionCommit, safeFailureCode,
  validateCurrentTerminalActivation, validateReadOnlyActivation, validateTerminalActivation,
};
