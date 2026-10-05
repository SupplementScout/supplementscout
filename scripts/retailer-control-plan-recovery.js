const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { catalogueCounts, databaseState } = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

const PRODUCTION = CONTRACTS.PRODUCTION;
const MODES = new Set(["preflight", "close"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const CONFIRMATION = "OWNER_APPROVED_EXPIRED_CONTROL_CLOSE";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function seal(value) {
  const sealed = { ...value, recovery_fingerprint: null };
  sealed.recovery_fingerprint = sha256(canonicalJson(sealed));
  return sealed;
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["mode", "parent-plan-id", "retailer-id", "expected-child-count", "input", "output", "confirm"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(match && allowed.has(match[1]) && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  const mode = values.mode || "preflight";
  invariant(MODES.has(mode), `unsupported mode ${mode}`);
  invariant(UUID.test(values["parent-plan-id"] || ""), "valid parent-plan-id is required");
  invariant(/^\d+$/.test(values["retailer-id"] || ""), "numeric retailer-id is required");
  const expectedChildCount = Number(values["expected-child-count"]);
  invariant(Number.isInteger(expectedChildCount) && expectedChildCount > 0 && expectedChildCount <= 100, "expected-child-count must be 1..100");
  invariant(values.output, "output path is required");
  if (mode === "close") {
    invariant(values.input, "close mode requires an input preflight");
    invariant(values.confirm === CONFIRMATION, `close confirmation must equal ${CONFIRMATION}`);
  } else {
    invariant(!values.input && !values.confirm, "preflight does not accept input or confirmation");
  }
  return {
    mode,
    parentPlanId: values["parent-plan-id"].toLowerCase(),
    retailerId: values["retailer-id"],
    expectedChildCount,
    input: values.input ? path.resolve(values.input) : null,
    output: path.resolve(values.output),
  };
}

function connectionString(kind) {
  const name = kind === "owner" ? "RETAILER_CONTROL_OWNER_DATABASE_URL" : "RETAILER_CONTROL_APPROVER_DATABASE_URL";
  const raw = process.env[name];
  invariant(raw, `${name} is required`);
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  invariant(url.href.includes(PRODUCTION.projectRef), `${name} target mismatch`);
  return url.href;
}

function createClient(connection, applicationName, readOnly = false) {
  return new Client({
    connectionString: connection,
    ssl: { rejectUnauthorized: false },
    application_name: applicationName,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

async function assertProduction(client) {
  const state = await databaseState(client);
  validateDatabaseOwner(PRODUCTION, state.identity);
  invariant(state.databaseTarget?.target_environment === "PRODUCTION", "database environment mismatch");
  invariant(state.databaseTarget?.project_ref === PRODUCTION.projectRef, "database project mismatch");
  invariant(state.databaseTarget?.database_identity === PRODUCTION.databaseIdentity, "database identity mismatch");
  return state;
}

function normalizeChild(row) {
  return {
    batch_index: Number(row.batch_index),
    child_plan_id: String(row.child_plan_id),
    child_plan_fingerprint: String(row.child_plan_fingerprint),
    status: String(row.child_status),
    approval_id: row.child_approval_id ? String(row.child_approval_id) : null,
    approval_expires_at: row.child_approval_expires_at ? new Date(row.child_approval_expires_at).toISOString() : null,
    approval_consumed_at: row.child_approval_consumed_at ? new Date(row.child_approval_consumed_at).toISOString() : null,
  };
}

function validateRecoverable(snapshot, expected, now = new Date()) {
  invariant(snapshot.retailer_id === expected.retailerId, "retailer binding drifted");
  invariant(snapshot.parent_plan_id === expected.parentPlanId, "parent plan binding drifted");
  invariant(snapshot.parent_status === "APPROVED", "parent plan is not APPROVED");
  invariant(HEX64.test(snapshot.parent_plan_fingerprint), "parent fingerprint is invalid");
  invariant(Date.parse(snapshot.parent_approval_expires_at) <= now.getTime(), "parent approval has not expired");
  invariant(snapshot.children.length === expected.expectedChildCount, "child count drifted");
  invariant(snapshot.children.every((child, index) => child.batch_index === index), "child batch indexes are not complete and ordered");
  invariant(new Set(snapshot.children.map((child) => child.child_plan_id)).size === snapshot.children.length, "duplicate child identity");
  invariant(snapshot.children.every((child) => UUID.test(child.child_plan_id) && HEX64.test(child.child_plan_fingerprint)), "invalid child identity");
  const approved = snapshot.children.filter((child) => child.status === "APPROVED");
  const planned = snapshot.children.filter((child) => child.status === "PLANNED");
  invariant(approved.length === 1 && planned.length === snapshot.children.length - 1, "plan is not one expired approved child plus planned remainder");
  invariant(snapshot.children.every((child) => ["APPROVED", "PLANNED"].includes(child.status)), "unexpected child state");
  invariant(planned.every((child) => !child.approval_id && !child.approval_expires_at && !child.approval_consumed_at), "planned child contains approval state");
  invariant(approved[0].approval_id && approved[0].approval_expires_at && !approved[0].approval_consumed_at, "approved child binding is incomplete or consumed");
  invariant(Date.parse(approved[0].approval_expires_at) <= now.getTime(), "child approval has not expired");
  invariant(snapshot.approval && snapshot.approval.approval_id === approved[0].approval_id, "batch approval does not bind approved child");
  invariant(snapshot.approval.child_plan_id === approved[0].child_plan_id, "batch approval child mismatch");
  invariant(!snapshot.approval.consumed_at && !snapshot.approval.closed_at && !snapshot.approval.result, "batch approval is consumed, closed or executed");
  invariant(Date.parse(snapshot.approval.expires_at) <= now.getTime(), "batch approval has not expired");
  for (const key of ["artifact_fingerprint", "execution_fingerprint", "expected_migration_fingerprint"])
    invariant(HEX64.test(snapshot.approval[key]), `approval ${key} is invalid`);
  invariant(snapshot.approval.artifact_fingerprint === approved[0].child_plan_fingerprint, "approval artifact does not match child");
  invariant(snapshot.apply_runs === 0 && snapshot.row_approvals === 0, "execution evidence exists; close is forbidden");
  invariant(snapshot.batch_approvals === 1, "unexpected batch approval count");
  invariant(snapshot.recovery_manifests === 0 && snapshot.recovery_approvals === 0 && snapshot.recovery_audit === 0, "recovery evidence exists; close is forbidden");
  invariant(snapshot.ledger.versions.length === snapshot.ledger.count && snapshot.ledger.count > 0, "migration ledger is incomplete");
  invariant(HEX64.test(snapshot.ledger.fingerprint), "migration ledger fingerprint is invalid");
  invariant(snapshot.approval.expected_migration_fingerprint === snapshot.ledger.fingerprint, "approval migration fingerprint drifted");
  return approved[0];
}

async function readSnapshot(options, dependencies) {
  const client = dependencies.createClient(dependencies.connectionString("owner"), "retailer-control-recovery-read", true);
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const db = await assertProduction(client);
    const counts = await catalogueCounts(client);
    const rows = (await client.query(`
      select p.id::text parent_plan_id,p.parent_plan_fingerprint,p.retailer_id::text retailer_id,
             p.status parent_status,p.approval_expires_at parent_approval_expires_at,
             c.batch_index,c.id::text child_plan_id,c.child_plan_fingerprint,c.status child_status,
             c.approval_id::text child_approval_id,c.approval_expires_at child_approval_expires_at,
             c.approval_consumed_at child_approval_consumed_at
      from public.retailer_catalogue_parent_plans p
      join public.retailer_catalogue_child_plans c on c.parent_plan_id=p.id
      where p.id=$1::uuid and p.retailer_id=$2::bigint
      order by c.batch_index
    `, [options.parentPlanId, options.retailerId])).rows;
    invariant(rows.length > 0, "control plan was not found");
    const approvals = (await client.query(`
      select a.id::text approval_id,a.child_plan_id::text child_plan_id,a.artifact_fingerprint,
             a.execution_fingerprint,a.expected_migration_fingerprint,a.expires_at,
             a.consumed_at,a.closed_at,a.result
      from public.retailer_offer_sync_batch_approvals a
      join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
      where c.parent_plan_id=$1::uuid
      order by a.approved_at,a.id
    `, [options.parentPlanId])).rows;
    const counters = (await client.query(`
      select
        (select count(*)::int from public.retailer_catalogue_apply_runs where parent_plan_id=$1::uuid) apply_runs,
        (select count(*)::int from public.approved_import_plans a join public.retailer_catalogue_child_plans c on c.child_plan_fingerprint=a.artifact_sha256 where c.parent_plan_id=$1::uuid and a.source='retailer_offer_mixed_batch') row_approvals,
        (select count(*)::int from public.retailer_offer_sync_batch_approvals a join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id where c.parent_plan_id=$1::uuid) batch_approvals,
        (select count(*)::int from public.retailer_catalogue_production_recovery_manifests m join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id where c.parent_plan_id=$1::uuid) recovery_manifests,
        (select count(*)::int from public.retailer_catalogue_production_recovery_approvals a join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id where c.parent_plan_id=$1::uuid) recovery_approvals,
        (select count(*)::int from public.retailer_catalogue_production_recovery_audit a join public.retailer_catalogue_production_recovery_manifests m on m.id=a.recovery_manifest_id join public.retailer_catalogue_child_plans c on c.id=m.child_plan_id where c.parent_plan_id=$1::uuid) recovery_audit
    `, [options.parentPlanId])).rows[0];
    await client.query("rollback");
    invariant(approvals.length === 1, "expected exactly one batch approval");
    const ledger = {
      count: db.remoteLedger.length,
      versions: db.remoteLedger.map(ledgerIdentifier),
      fingerprint: ledgerRowsFingerprint(db.remoteLedger, { targetEnvironment: "PRODUCTION" }),
    };
    const first = rows[0];
    return {
      retailer_id: String(first.retailer_id),
      parent_plan_id: String(first.parent_plan_id),
      parent_plan_fingerprint: String(first.parent_plan_fingerprint),
      parent_status: String(first.parent_status),
      parent_approval_expires_at: new Date(first.parent_approval_expires_at).toISOString(),
      children: rows.map(normalizeChild),
      approval: {
        ...approvals[0],
        expires_at: new Date(approvals[0].expires_at).toISOString(),
        consumed_at: approvals[0].consumed_at ? new Date(approvals[0].consumed_at).toISOString() : null,
        closed_at: approvals[0].closed_at ? new Date(approvals[0].closed_at).toISOString() : null,
      },
      ...Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, Number(value)])),
      business_counts: counts,
      ledger,
    };
  } finally {
    await client.end();
  }
}

function buildPreflight(snapshot, options, now = new Date()) {
  const approvedChild = validateRecoverable(snapshot, options, now);
  const controlStateFingerprint = sha256(canonicalJson(snapshot));
  return seal({
    schema_version: "retailer-control-plan-recovery-v1",
    kind: "EXPIRED_UNEXECUTED_SEQUENTIAL_PLAN",
    result: "READY_TO_CLOSE",
    generated_at: now.toISOString(),
    target: {
      environment: "PRODUCTION",
      project_ref: PRODUCTION.projectRef,
      database_identity: PRODUCTION.databaseIdentity,
    },
    scope: {
      retailer_id: options.retailerId,
      parent_plan_id: options.parentPlanId,
      expected_child_count: options.expectedChildCount,
      approved_child_id: approvedChild.child_plan_id,
      approval_id: snapshot.approval.approval_id,
    },
    control_state_fingerprint: controlStateFingerprint,
    snapshot,
    authorization: {
      business_writes: false,
      price_history_writes: false,
      automatic_retry: false,
      maximum_close_calls: 1,
      required_confirmation: CONFIRMATION,
    },
  });
}

function validatePreflight(preflight, options, now = new Date()) {
  invariant(exactKeys(preflight, ["schema_version", "kind", "result", "generated_at", "target", "scope", "control_state_fingerprint", "snapshot", "authorization", "recovery_fingerprint"]), "preflight keys mismatch");
  invariant(preflight.schema_version === "retailer-control-plan-recovery-v1" && preflight.kind === "EXPIRED_UNEXECUTED_SEQUENTIAL_PLAN" && preflight.result === "READY_TO_CLOSE", "preflight contract mismatch");
  invariant(preflight.recovery_fingerprint === sha256(canonicalJson({ ...preflight, recovery_fingerprint: null })), "preflight fingerprint mismatch");
  invariant(preflight.target.environment === "PRODUCTION" && preflight.target.project_ref === PRODUCTION.projectRef && preflight.target.database_identity === PRODUCTION.databaseIdentity, "preflight target mismatch");
  invariant(preflight.scope.parent_plan_id === options.parentPlanId && preflight.scope.retailer_id === options.retailerId && preflight.scope.expected_child_count === options.expectedChildCount, "preflight scope mismatch");
  invariant(now.getTime() - Date.parse(preflight.generated_at) <= 2 * 60 * 60 * 1000 && Date.parse(preflight.generated_at) <= now.getTime() + 5 * 60 * 1000, "preflight is stale or future");
  invariant(preflight.authorization.business_writes === false && preflight.authorization.price_history_writes === false && preflight.authorization.automatic_retry === false && preflight.authorization.maximum_close_calls === 1 && preflight.authorization.required_confirmation === CONFIRMATION, "preflight authorization boundary mismatch");
  validateRecoverable(preflight.snapshot, options, now);
  invariant(preflight.control_state_fingerprint === sha256(canonicalJson(preflight.snapshot)), "preflight state fingerprint mismatch");
  return preflight;
}

function closeRequest(snapshot, now = new Date()) {
  const approved = snapshot.children.find((child) => child.status === "APPROVED");
  const request = {
    schema_version: 1,
    approval_id: snapshot.approval.approval_id,
    parent_plan_id: snapshot.parent_plan_id,
    child_plan_id: approved.child_plan_id,
    parent_plan_fingerprint: snapshot.parent_plan_fingerprint,
    child_plan_fingerprint: approved.child_plan_fingerprint,
    artifact_fingerprint: snapshot.approval.artifact_fingerprint,
    execution_fingerprint: snapshot.approval.execution_fingerprint,
    approval_expected_migration_fingerprint: snapshot.approval.expected_migration_fingerprint,
    expected_migration_versions: snapshot.ledger.versions,
    expected_migration_fingerprint: snapshot.ledger.fingerprint,
    migration_fingerprint_algorithm: "SHA-256",
    migration_fingerprint_version: "RSBI-CJ1",
    target_environment: "PRODUCTION",
    production_project_ref: PRODUCTION.projectRef,
    production_database_identity: PRODUCTION.databaseIdentity,
    reason: "Close exact expired unexecuted sequential control tree; no business writes",
    closed_by: "supplementscout-owner-approved-control-recovery",
    requested_at: now.toISOString(),
    request_fingerprint: null,
  };
  request.request_fingerprint = sha256(canonicalJson(request));
  return request;
}

async function closePlan(preflight, options, dependencies) {
  const liveBefore = await readSnapshot(options, dependencies);
  validateRecoverable(liveBefore, options, dependencies.now());
  invariant(sha256(canonicalJson(liveBefore)) === preflight.control_state_fingerprint, "control state changed after preflight");
  invariant(canonicalJson(liveBefore.business_counts) === canonicalJson(preflight.snapshot.business_counts), "business counts changed after preflight");
  const request = closeRequest(liveBefore, dependencies.now());
  const client = dependencies.createClient(dependencies.connectionString("approver"), "retailer-control-recovery-close");
  await client.connect();
  let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query("set local role retailer_catalogue_production_approver");
    const result = (await client.query("select public.close_expired_retailer_offer_sync_approval($1::jsonb) result", [request])).rows[0]?.result;
    invariant(result?.status === "EXPIRED" && result.already_closed === false, "close result mismatch");
    invariant(Number(result.expired_child_count) === options.expectedChildCount && Number(result.control_writes) === options.expectedChildCount + 2, "close count mismatch");
    invariant(Number(result.business_writes) === 0 && Number(result.price_history_writes) === 0, "business write boundary violated");
    await client.query("commit"); open = false;
    return { result, request_fingerprint: request.request_fingerprint };
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function readPostflight(options, dependencies, preflight) {
  const client = dependencies.createClient(dependencies.connectionString("owner"), "retailer-control-recovery-postflight", true);
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    await assertProduction(client);
    const counts = await catalogueCounts(client);
    const parent = (await client.query("select status from public.retailer_catalogue_parent_plans where id=$1::uuid and retailer_id=$2::bigint", [options.parentPlanId, options.retailerId])).rows[0];
    const children = (await client.query("select status,count(*)::int count from public.retailer_catalogue_child_plans where parent_plan_id=$1::uuid group by status order by status", [options.parentPlanId])).rows;
    const approval = (await client.query("select closed_at,consumed_at from public.retailer_offer_sync_batch_approvals where id=$1::uuid", [preflight.scope.approval_id])).rows[0];
    const runs = Number((await client.query("select count(*)::int count from public.retailer_catalogue_apply_runs where parent_plan_id=$1::uuid", [options.parentPlanId])).rows[0].count);
    await client.query("rollback");
    invariant(parent?.status === "EXPIRED", "parent was not expired");
    invariant(children.length === 1 && children[0].status === "EXPIRED" && Number(children[0].count) === options.expectedChildCount, "children were not all expired");
    invariant(approval?.closed_at && !approval.consumed_at, "approval close evidence mismatch");
    invariant(runs === 0, "apply run appeared during close");
    invariant(canonicalJson(counts) === canonicalJson(preflight.snapshot.business_counts), "business counts changed during close");
    return { parent_status: parent.status, expired_child_count: Number(children[0].count), approval_closed: true, apply_runs: runs, business_counts: counts };
  } finally {
    await client.end();
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

async function run(argv = process.argv.slice(2), overrides = {}) {
  invariant(!process.env.SAFE_UPDATE, "SAFE_UPDATE must remain unset");
  const options = parseArgs(argv);
  const dependencies = {
    connectionString,
    createClient,
    now: () => new Date(),
    ...overrides,
  };
  if (options.mode === "preflight") {
    const snapshot = await readSnapshot(options, dependencies);
    const report = buildPreflight(snapshot, options, dependencies.now());
    writeJson(options.output, report);
    return report;
  }
  const preflight = validatePreflight(JSON.parse(fs.readFileSync(options.input, "utf8")), options, dependencies.now());
  const closed = await closePlan(preflight, options, dependencies);
  const postflight = await readPostflight(options, dependencies, preflight);
  const report = seal({
    schema_version: "retailer-control-plan-recovery-result-v1",
    result: "PASS",
    completed_at: dependencies.now().toISOString(),
    scope: preflight.scope,
    preflight_fingerprint: preflight.recovery_fingerprint,
    close: closed,
    postflight,
    accounting: { close_calls: 1, automatic_retries: 0, control_writes: options.expectedChildCount + 2, business_writes: 0, price_history_writes: 0 },
  });
  writeJson(options.output, report);
  return report;
}

if (require.main === module) run().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = {
  CONFIRMATION,
  buildPreflight,
  closeRequest,
  parseArgs,
  seal,
  validatePreflight,
  validateRecoverable,
};
