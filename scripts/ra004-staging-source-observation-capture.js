const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fork, spawnSync } = require("node:child_process");
const { Client } = require("pg");
const selector = require("./supabase-migration-selector");
const { verifyRevokedCredential } = require("./ra004-staging-revocation-verifier");

const ROOT = path.resolve(__dirname, "..");
const BASELINE = "67159bb5a1f8802f017d05dea518400908bc0f61";
const PROJECT_REF = "hxnrsyyqffztlvcrtgbf";
const EXPECTED_HOST = "aws-0-eu-west-3.pooler.supabase.com";
const RETAILER_ID = "11";
const EXPECTED_LEDGER_COUNT = 98;
const EXPECTED_LEDGER_FINGERPRINT = "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307";
const SOURCES = Object.freeze(["sessions", "locks", "postflight_state", "watchdog_state", "global_conflicts"]);
const OBSERVATION_LIFETIME_MS = 20 * 60_000;
const OUTPUT_DIR = path.join(ROOT, "tmp", "ra004-source-observation-20260928");
const SOURCE_INVENTORY_SQL = `select jsonb_build_object(
  'sessions',count(*) filter (where event_type in ('SESSION_STARTED','SESSION_HEARTBEAT','SESSION_COMPLETED','SESSION_FAILED')),
  'locks',count(*) filter (where event_type in ('LOCK_OBSERVED','LOCK_ACQUIRED','LOCK_RENEWED','LOCK_RELEASED','LOCK_EXPIRED')),
  'postflight_state',count(*) filter (where event_type in ('POSTFLIGHT_COMPLETED','POSTFLIGHT_FAILED')),
  'watchdog_state',count(*) filter (where event_type='WATCHDOG_OBSERVED'),
  'global_conflicts',count(*) filter (where event_type='GLOBAL_CONFLICT_OBSERVED')
) as inventory from public.retailer_control_state_evidence_v1 where retailer_id=$1 or global_scope`;
const WRITE_SQL = `with p as (select
  $1::uuid event_id,1::integer event_version,'SOURCE_OBSERVED'::text event_type,
  $2::bigint retailer_id,false::boolean global_scope,$3::text scope_fingerprint,
  'RA004_BOUNDED_SOURCE_OBSERVER_V1'::text source_system,$4::text source_run_id,
  null::text parent_id,$5::timestamptz occurred_at,$5::timestamptz observed_at,
  $6::timestamptz expires_at,'CURRENT'::text status,'RCSE_SOURCE_CLEAR'::text reason_code,
  $7::jsonb metadata,$8::text idempotency_key
), sealed as (select *,encode(pg_catalog.sha256(convert_to(jsonb_build_object(
  'event_id',event_id,'event_version',event_version,'event_type',event_type,
  'retailer_id',retailer_id,'global_scope',global_scope,'scope_fingerprint',scope_fingerprint,
  'source_system',source_system,'source_run_id',source_run_id,'parent_id',parent_id,
  'occurred_at',occurred_at,'observed_at',observed_at,'expires_at',expires_at,
  'status',status,'reason_code',reason_code,'metadata',metadata
)::text,'UTF8')),'hex') payload_fingerprint from p)
select public.write_retailer_control_state_evidence_v1(
  event_id,event_version,event_type,retailer_id,global_scope,scope_fingerprint,
  source_system,source_run_id,parent_id,occurred_at,observed_at,expires_at,
  status,reason_code,metadata,payload_fingerprint,idempotency_key
) as receipt from sealed`;
const READBACK_SQL = `select metadata->>'logical_source' logical_source,count(*)::integer row_count
from public.retailer_control_state_evidence_v1
where retailer_id=$1 and source_system='RA004_BOUNDED_SOURCE_OBSERVER_V1' and source_run_id=$2
  and event_type='SOURCE_OBSERVED' and status='CURRENT' and expires_at>statement_timestamp()
group by metadata->>'logical_source' order by metadata->>'logical_source'`;

function invariant(ok, code) { if (!ok) throw new Error(code); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function validateRemoteTarget(remote) {
  const target = remote?.databaseTarget;
  invariant(target?.target_environment === "STAGING", "RA004_SOURCE_OBSERVATION_DATABASE_ENVIRONMENT_MISMATCH");
  invariant(target?.project_ref === PROJECT_REF, "RA004_SOURCE_OBSERVATION_DATABASE_PROJECT_MISMATCH");
  invariant(target?.database_identity === selector.CONTRACTS.STAGING.databaseIdentity,
    "RA004_SOURCE_OBSERVATION_DATABASE_TARGET_MISMATCH");
  invariant(remote?.identity?.current_user === "postgres", "RA004_SOURCE_OBSERVATION_DATABASE_USER_MISMATCH");
  return remote;
}
function verifiedClient(databaseUrl, applicationName) {
  const parsed = new URL(databaseUrl);
  invariant(["postgres:", "postgresql:"].includes(parsed.protocol), "RA004_SOURCE_OBSERVATION_TARGET_INVALID");
  invariant(parsed.hostname === EXPECTED_HOST, "RA004_SOURCE_OBSERVATION_HOST_MISMATCH");
  return new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true, servername: parsed.hostname, minVersion: "TLSv1.2" },
    application_name: applicationName,
    connectionTimeoutMillis: 8_000,
    query_timeout: 15_000,
  });
}
function readExecutionCommit(spawn = spawnSync) {
  const run = (...args) => spawn("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const head = run("rev-parse", "HEAD");
  const main = run("rev-parse", "origin/main");
  const parent = run("rev-parse", "HEAD^");
  const status = run("status", "--porcelain", "--untracked-files=no");
  invariant(head.status === 0 && main.status === 0 && parent.status === 0, "RA004_SOURCE_OBSERVATION_COMMIT_UNAVAILABLE");
  invariant(String(head.stdout).trim() === String(main.stdout).trim(), "RA004_SOURCE_OBSERVATION_COMMIT_NOT_MERGED_MAIN");
  invariant(String(parent.stdout).trim() === BASELINE, "RA004_SOURCE_OBSERVATION_BASELINE_MISMATCH");
  invariant(status.status === 0 && String(status.stdout).trim() === "", "RA004_SOURCE_OBSERVATION_WORKTREE_DIRTY");
  return String(head.stdout).trim();
}
function issuerProcess() {
  const child = fork(path.join(__dirname, "ra004-staging-credential-issuer.js"), [], {
    env: { ...process.env, RA004_OWNER_DATABASE_URL: process.env.RA004_OWNER_DATABASE_URL },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let sequence = 0;
  const pending = new Map();
  child.on("message", (message) => {
    const request = pending.get(message.request_id);
    if (!request) return;
    pending.delete(message.request_id);
    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(message.error));
  });
  return {
    call(message) {
      const request_id = `source-observation-${++sequence}`;
      return new Promise((resolve, reject) => {
        pending.set(request_id, { resolve, reject });
        child.send({ ...message, request_id });
      });
    },
    close() { child.disconnect(); },
  };
}
async function queryOwner(databaseUrl, text, values = [], applicationName = "ra004-source-observation-read-v1") {
  const client = verifiedClient(databaseUrl, applicationName);
  try { await client.connect(); return await client.query(text, values); }
  finally { await client.end(); }
}
async function observeSources(databaseUrl) {
  const client = verifiedClient(databaseUrl, "ra004-source-observation-inventory-v1");
  try {
    await client.connect();
    await client.query("begin isolation level repeatable read read only");
    const result = await client.query(SOURCE_INVENTORY_SQL, [RETAILER_ID]);
    await client.query("commit");
    const inventory = result.rows[0]?.inventory;
    invariant(inventory && SOURCES.every((source) => Number.isSafeInteger(Number(inventory[source]))),
      "RA004_SOURCE_OBSERVATION_INVENTORY_INVALID");
    return Object.fromEntries(SOURCES.map((source) => [source, Number(inventory[source])]));
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally { await client.end(); }
}
function buildEvents({ activationId, observedAt, expiresAt, inventory }) {
  return SOURCES.map((source) => {
    const stable = `${activationId}|${RETAILER_ID}|${source}`;
    return {
      event_id: crypto.randomUUID(),
      source,
      scope_fingerprint: sha256(`RA004_SOURCE_SCOPE|${RETAILER_ID}|${source}`),
      source_run_id: activationId,
      occurred_at: observedAt,
      expires_at: expiresAt,
      metadata: { logical_source: source, observed_record_count: inventory[source] },
      idempotency_key: sha256(stable),
    };
  });
}
async function writeEvents(databaseUrl, events) {
  const client = verifiedClient(databaseUrl, "ra004-source-observation-writer-v1");
  const receipts = [];
  try {
    await client.connect();
    await client.query("begin");
    for (const event of events) {
      const result = await client.query(WRITE_SQL, [
        event.event_id, RETAILER_ID, event.scope_fingerprint, event.source_run_id,
        event.occurred_at, event.expires_at, JSON.stringify(event.metadata), event.idempotency_key,
      ]);
      invariant(result.rows[0]?.receipt?.inserted === true, "RA004_SOURCE_OBSERVATION_WRITE_NOT_INSERTED");
      receipts.push(result.rows[0].receipt);
    }
    await client.query("commit");
    return receipts;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally { await client.end(); }
}
async function readback(databaseUrl, activationId) {
  const result = await queryOwner(databaseUrl, READBACK_SQL, [RETAILER_ID, activationId], "ra004-source-observation-readback-v1");
  const actual = result.rows.map((row) => row.logical_source).sort();
  invariant(JSON.stringify(actual) === JSON.stringify([...SOURCES].sort())
    && result.rows.every((row) => row.row_count === 1), "RA004_SOURCE_OBSERVATION_READBACK_MISMATCH");
  return { sources: actual, row_count: result.rows.reduce((sum, row) => sum + row.row_count, 0) };
}
function writeReport(name, value) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}
async function main() {
  const ownerDatabaseUrl = process.env.RA004_OWNER_DATABASE_URL;
  invariant(Boolean(ownerDatabaseUrl), "RA004_SOURCE_OBSERVATION_DATABASE_URL_MISSING");
  const executionCommit = readExecutionCommit();
  const remote = await selector.readRemoteState(ownerDatabaseUrl);
  validateRemoteTarget(remote);
  const fingerprint = selector.ledgerRowsFingerprint(remote.remoteLedger, { targetEnvironment: "STAGING" });
  invariant(remote.remoteLedger.length === EXPECTED_LEDGER_COUNT && fingerprint === EXPECTED_LEDGER_FINGERPRINT,
    "RA004_SOURCE_OBSERVATION_LEDGER_MISMATCH");
  const inventory = await observeSources(ownerDatabaseUrl);
  const observedAt = new Date();
  const expiresAt = new Date(observedAt.getTime() + OBSERVATION_LIFETIME_MS);
  const activationId = `ra004-source-observation-${observedAt.getTime()}`;
  const events = buildEvents({ activationId, observedAt: observedAt.toISOString(), expiresAt: expiresAt.toISOString(), inventory });
  const issuer = issuerProcess();
  let credential;
  let revokeReceipt;
  let primaryError;
  let receipts = [];
  let readbackReceipt = null;
  try {
    credential = await issuer.call({ action: "create", kind: "evidence", expires_at: expiresAt.toISOString() });
    receipts = await writeEvents(credential.database_url, events);
    readbackReceipt = await readback(ownerDatabaseUrl, activationId);
  } catch (error) {
    primaryError = error;
  } finally {
    if (credential) {
      const revokedDatabaseUrl = credential.database_url;
      try {
        const issuerReceipt = await issuer.call({ action: "revoke", role: credential.role, runner_process_id: process.pid });
        const verification = await verifyRevokedCredential({ revokedDatabaseUrl, ownerDatabaseUrl, revokedRole: credential.role });
        revokeReceipt = { ...issuerReceipt, revocation_verification: verification };
      } catch (error) {
        if (!primaryError) primaryError = error;
      }
    }
    issuer.close();
    process.env.RA004_OWNER_DATABASE_URL = "";
  }
  const report = {
    schema_version: "ra004-source-observation-capture-v1",
    status: primaryError ? "FAILED" : "VERIFIED_COMPLETE",
    activation_id: activationId,
    authorized_baseline: BASELINE,
    execution_commit: executionCommit,
    target: { environment: "STAGING", project_ref: PROJECT_REF, retailer_id: RETAILER_ID },
    ledger: { count: EXPECTED_LEDGER_COUNT, fingerprint },
    inventory,
    sources: SOURCES,
    observation_window: { observed_at: observedAt.toISOString(), expires_at: expiresAt.toISOString() },
    attempt_counters: { inventory_read: 1, transaction: 1, rpc_writes: receipts.length, readback: readbackReceipt ? 1 : 0, retry: 0 },
    readback: readbackReceipt,
    revoke: revokeReceipt ? {
      access_revoked: revokeReceipt.access_revoked,
      credential_id: revokeReceipt.credential_id,
      revocation_verification: revokeReceipt.revocation_verification,
    } : null,
    forbidden_operations: { migration: 0, preflight: 0, canary: 0, production: 0, feed_capture: 0, shadow_run: 0, import: 0, apply: 0 },
    failure_code: primaryError ? String(primaryError.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED]").slice(0, 200) : null,
  };
  writeReport(primaryError ? "failure.json" : "closeout.json", report);
  if (primaryError) throw primaryError;
  process.stdout.write(`${JSON.stringify({ status: report.status, activation_id: activationId, sources: SOURCES, revoke: revokeReceipt.revocation_verification.outcome_code })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED]").slice(0, 200)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  BASELINE, EXPECTED_HOST, EXPECTED_LEDGER_COUNT, EXPECTED_LEDGER_FINGERPRINT,
  OBSERVATION_LIFETIME_MS, PROJECT_REF, READBACK_SQL, RETAILER_ID, SOURCES,
  SOURCE_INVENTORY_SQL, WRITE_SQL, buildEvents, observeSources, readExecutionCommit,
  readback, validateRemoteTarget, writeEvents,
};
