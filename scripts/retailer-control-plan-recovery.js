const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { postgresClientConfig } = require("./lib/secure-postgres");
const { catalogueCounts, databaseState } = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

const PRODUCTION = CONTRACTS.PRODUCTION;
const MODES = new Set(["discover", "preflight", "close"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const CONFIRMATION = "OWNER_APPROVED_EXPIRED_CONTROL_CLOSE";
const PLANNED_CONFIRMATION = "OWNER_APPROVED_PLANNED_CONTROL_CLOSE";
const PLANNED_KIND = "NEVER_APPROVED_PLANNED_SEQUENTIAL_PLAN";
const COUNTERS = ["apply_runs", "row_approvals", "batch_approvals", "recovery_manifests", "recovery_approvals", "recovery_audit"];

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
  const allowed = new Set(["mode", "parent-plan-id", "retailer-id", "expected-child-count", "input", "output", "confirm", "approved-state-fingerprint"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(match && allowed.has(match[1]) && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  const mode = values.mode || "preflight";
  invariant(MODES.has(mode), `unsupported mode ${mode}`);
  invariant(/^\d+$/.test(values["retailer-id"] || ""), "numeric retailer-id is required");
  invariant(values.output, "output path is required");
  if (mode === "discover") {
    invariant(!values["parent-plan-id"] && !values["expected-child-count"] && !values.input && !values.confirm && !values["approved-state-fingerprint"],
      "discover accepts only retailer-id and output");
    return {
      mode,
      parentPlanId: null,
      retailerId: values["retailer-id"],
      expectedChildCount: null,
      input: null,
      output: path.resolve(values.output),
    };
  }
  invariant(UUID.test(values["parent-plan-id"] || ""), "valid parent-plan-id is required");
  const expectedChildCount = Number(values["expected-child-count"]);
  invariant(Number.isInteger(expectedChildCount) && expectedChildCount > 0 && expectedChildCount <= 100, "expected-child-count must be 1..100");
  if (mode === "close") {
    invariant(values.input, "close mode requires an input preflight");
    invariant([CONFIRMATION, PLANNED_CONFIRMATION].includes(values.confirm), "close confirmation must match the recovery kind");
    invariant(!values["approved-state-fingerprint"] || HEX64.test(values["approved-state-fingerprint"]), "approved state fingerprint must be SHA-256");
  } else {
    invariant(!values.input && !values.confirm && !values["approved-state-fingerprint"], "preflight does not accept input or confirmation");
  }
  return {
    mode,
    parentPlanId: values["parent-plan-id"].toLowerCase(),
    retailerId: values["retailer-id"],
    expectedChildCount,
    input: values.input ? path.resolve(values.input) : null,
    confirmation: values.confirm || null,
    approvedStateFingerprint: values["approved-state-fingerprint"] || null,
    output: path.resolve(values.output),
  };
}

function buildDiscoveryReport(rows, options, databaseProof, now = new Date()) {
  invariant(options.mode === "discover" && /^\d+$/.test(options.retailerId), "discovery scope is invalid");
  invariant(Array.isArray(rows), "discovery rows are invalid");
  const candidates = rows.map((row) => {
    const candidate = {
      parent_plan_id: String(row.parent_plan_id),
      parent_plan_fingerprint: String(row.parent_plan_fingerprint),
      status: String(row.parent_status),
      approval_expires_at: row.approval_expires_at ? new Date(row.approval_expires_at).toISOString() : null,
      approval_consumed_at: row.approval_consumed_at ? new Date(row.approval_consumed_at).toISOString() : null,
      child_count: Number(row.child_count),
      planned_child_count: Number(row.planned_child_count),
      approved_child_count: Number(row.approved_child_count),
      applying_child_count: Number(row.applying_child_count),
      applied_child_count: Number(row.applied_child_count),
      apply_run_count: Number(row.apply_run_count),
    };
    invariant(UUID.test(candidate.parent_plan_id) && HEX64.test(candidate.parent_plan_fingerprint), "discovered parent identity is invalid");
    invariant(["PLANNED", "APPROVED", "PARTIALLY_APPLIED"].includes(candidate.status), "discovered parent status is invalid");
    invariant(Number.isInteger(candidate.child_count) && candidate.child_count > 0 && candidate.child_count <= 100, "discovered child count is invalid");
    for (const key of ["planned_child_count", "approved_child_count", "applying_child_count", "applied_child_count", "apply_run_count"])
      invariant(Number.isInteger(candidate[key]) && candidate[key] >= 0, `discovered ${key} is invalid`);
    invariant(candidate.planned_child_count + candidate.approved_child_count + candidate.applying_child_count + candidate.applied_child_count <= candidate.child_count,
      "discovered child status counts are invalid");
    return candidate;
  });
  invariant(new Set(candidates.map((row) => row.parent_plan_id)).size === candidates.length, "duplicate discovered parent identity");
  const exactTarget = candidates.length === 1 ? {
    retailer_id: options.retailerId,
    parent_plan_id: candidates[0].parent_plan_id,
    expected_child_count: candidates[0].child_count,
  } : null;
  return seal({
    schema_version: "retailer-control-plan-discovery-v1",
    kind: "READ_ONLY_BLOCKING_CONTROL_DISCOVERY",
    result: candidates.length === 0 ? "CLEAR" : candidates.length === 1 ? "FOUND_EXACTLY_ONE" : "AMBIGUOUS",
    generated_at: now.toISOString(),
    target: {
      environment: "PRODUCTION",
      project_ref: PRODUCTION.projectRef,
      database_identity: PRODUCTION.databaseIdentity,
    },
    scope: { retailer_id: options.retailerId },
    candidate_count: candidates.length,
    candidates,
    exact_target: exactTarget,
    database_proof: databaseProof,
    accounting: { read_transactions: 1, automatic_retries: 0, close_calls: 0, control_writes: 0, business_writes: 0, price_history_writes: 0 },
  });
}

function connectionString(kind) {
  const name = kind === "owner" ? "RETAILER_CONTROL_OWNER_DATABASE_URL" : "RETAILER_CONTROL_APPROVER_DATABASE_URL";
  const raw = process.env[name];
  invariant(raw, `${name} is required`);
  const url = new URL(raw);
  invariant(url.href.includes(PRODUCTION.projectRef), `${name} target mismatch`);
  return url.href;
}

function createClient(connection, applicationName, readOnly = false) {
  return new Client(postgresClientConfig({
    connectionString: connection,
    applicationName,
    defaultReadOnly: readOnly,
    connectionTimeoutMillis: 0,
    queryTimeoutMs: 0,
    statementTimeoutMs: 0,
  }));
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
    approved_at: row.child_approved_at ? new Date(row.child_approved_at).toISOString() : null,
    rollback_requested_at: row.rollback_requested_at ? new Date(row.rollback_requested_at).toISOString() : null,
    rollback_requested_by: row.rollback_requested_by ?? null,
    audit_log: row.child_audit_log,
    approval_expires_at: row.child_approval_expires_at ? new Date(row.child_approval_expires_at).toISOString() : null,
    approval_consumed_at: row.child_approval_consumed_at ? new Date(row.child_approval_consumed_at).toISOString() : null,
    row_count: Number(row.row_count),
    row_approvals: Number(row.row_approvals),
    batch_approvals: Number(row.batch_approvals),
    successful_apply_runs: Number(row.successful_apply_runs),
    other_apply_runs: Number(row.other_apply_runs),
    ready_recovery_manifests: Number(row.ready_recovery_manifests),
    other_recovery_manifests: Number(row.other_recovery_manifests),
  };
}

function validateRecoverable(snapshot, expected, now = new Date()) {
  invariant(snapshot.retailer_id === expected.retailerId, "retailer binding drifted");
  invariant(snapshot.parent_plan_id === expected.parentPlanId, "parent plan binding drifted");
  if (snapshot.parent_status === "PLANNED") {
    invariant(HEX64.test(snapshot.parent_plan_fingerprint), "parent fingerprint is invalid");
    invariant(HEX64.test(snapshot.planned_control_fingerprint || ""), "planned control fingerprint is invalid");
    invariant(["parent_approval_id", "parent_approved_by", "parent_approved_at", "parent_approval_expires_at", "parent_approval_consumed_at"]
      .every((key) => snapshot[key] === null) && snapshot.approval === null, "planned parent contains approval state");
    invariant(typeof snapshot.parent_plan_expires_at === "string" && Number.isFinite(Date.parse(snapshot.parent_plan_expires_at))
      && Date.parse(snapshot.parent_plan_expires_at) <= now.getTime(), "planned registration has not expired");
    invariant(snapshot.children.length === expected.expectedChildCount && snapshot.children.length > 0, "child count drifted");
    invariant(new Set(snapshot.children.map((child) => child.child_plan_id)).size === snapshot.children.length, "duplicate child identity");
    invariant(snapshot.children.every((child, index) => child.batch_index === index && UUID.test(child.child_plan_id)
      && HEX64.test(child.child_plan_fingerprint) && child.status === "PLANNED"
      && Number.isSafeInteger(child.row_count) && child.row_count > 0
      && ["approval_id", "approved_at", "approval_expires_at", "approval_consumed_at", "rollback_requested_at", "rollback_requested_by"]
        .every((key) => child[key] === null)
      && ["row_approvals", "batch_approvals", "successful_apply_runs", "other_apply_runs", "ready_recovery_manifests", "other_recovery_manifests"]
        .every((key) => child[key] === 0)), "planned child contains approval, execution, rollback or identity drift");
    invariant(COUNTERS.every((key) => snapshot[key] === 0), "planned tree contains approval or execution evidence");
    invariant(snapshot.ledger.versions.length === snapshot.ledger.count && snapshot.ledger.count > 0
      && HEX64.test(snapshot.ledger.fingerprint), "migration ledger is incomplete");
    return { kind: PLANNED_KIND, approvedChild: null, appliedChildCount: 0, pendingChildCount: snapshot.children.length };
  }
  invariant(["APPROVED", "PARTIALLY_APPLIED"].includes(snapshot.parent_status), "parent plan is not recoverable");
  invariant(HEX64.test(snapshot.parent_plan_fingerprint), "parent fingerprint is invalid");
  invariant(UUID.test(snapshot.parent_approval_id || ""), "parent approval binding is incomplete");
  invariant(Date.parse(snapshot.parent_approval_expires_at) <= now.getTime(), "parent approval has not expired");
  invariant(snapshot.children.length === expected.expectedChildCount, "child count drifted");
  invariant(snapshot.children.every((child, index) => child.batch_index === index), "child batch indexes are not complete and ordered");
  invariant(new Set(snapshot.children.map((child) => child.child_plan_id)).size === snapshot.children.length, "duplicate child identity");
  invariant(snapshot.children.every((child) => UUID.test(child.child_plan_id) && HEX64.test(child.child_plan_fingerprint)), "invalid child identity");
  const applied = snapshot.children.filter((child) => child.status === "APPLIED");
  const approved = snapshot.children.filter((child) => child.status === "APPROVED");
  const planned = snapshot.children.filter((child) => child.status === "PLANNED");
  const partial = snapshot.parent_status === "PARTIALLY_APPLIED";
  invariant(approved.length === 1, "plan does not have exactly one approved child");
  invariant(snapshot.children.every((child) => ["APPLIED", "APPROVED", "PLANNED"].includes(child.status)), "unexpected child state");
  invariant(partial ? applied.length > 0 && snapshot.parent_approval_consumed_at : applied.length === 0 && !snapshot.parent_approval_consumed_at, "parent execution state mismatch");
  invariant(planned.length === snapshot.children.length - applied.length - 1, "planned suffix count mismatch");
  invariant(approved[0].batch_index === applied.length, "approved child does not immediately follow the applied prefix");
  invariant(snapshot.children.every((child, index) => index < applied.length ? child.status === "APPLIED" : index === applied.length ? child.status === "APPROVED" : child.status === "PLANNED"), "child states are not an applied prefix, approved boundary and planned suffix");
  invariant(planned.every((child) => !child.approval_id && !child.approval_expires_at && !child.approval_consumed_at), "planned child contains approval state");
  invariant(UUID.test(approved[0].approval_id || "") && approved[0].approval_expires_at && !approved[0].approval_consumed_at, "approved child binding is incomplete or consumed");
  invariant(Date.parse(approved[0].approval_expires_at) <= now.getTime(), "child approval has not expired");
  invariant(snapshot.approval && UUID.test(snapshot.approval.approval_id || ""), "batch approval binding is incomplete");
  invariant(snapshot.approval.child_plan_id === approved[0].child_plan_id, "batch approval child mismatch");
  invariant(snapshot.approval.expires_at === approved[0].approval_expires_at, "batch and child approval expiry mismatch");
  invariant(Date.parse(snapshot.parent_approval_expires_at) >= Date.parse(snapshot.approval.expires_at), "parent approval expires before batch approval");
  invariant(snapshot.approval.target_environment === "PRODUCTION"
    && snapshot.approval.project_ref === PRODUCTION.projectRef
    && snapshot.approval.database_identity === PRODUCTION.databaseIdentity, "batch approval target mismatch");
  invariant(snapshot.approval.manifest_matches_child === true, "batch approval manifest does not bind approved child");
  invariant(!snapshot.approval.consumed_at && !snapshot.approval.closed_at && !snapshot.approval.result, "batch approval is consumed, closed or executed");
  invariant(Date.parse(snapshot.approval.expires_at) <= now.getTime(), "batch approval has not expired");
  for (const key of ["artifact_fingerprint", "execution_fingerprint", "expected_migration_fingerprint"])
    invariant(HEX64.test(snapshot.approval[key]), `approval ${key} is invalid`);
  invariant(snapshot.approval.artifact_fingerprint === approved[0].child_plan_fingerprint, "approval artifact does not match child");
  invariant(approved[0].batch_approvals === 1 && approved[0].successful_apply_runs === 0 && approved[0].other_apply_runs === 0 && approved[0].row_approvals === 0 && approved[0].ready_recovery_manifests === 0 && approved[0].other_recovery_manifests === 0, "approved boundary contains execution evidence");
  invariant(planned.every((child) => child.batch_approvals === 0 && child.successful_apply_runs === 0 && child.other_apply_runs === 0 && child.row_approvals === 0 && child.ready_recovery_manifests === 0 && child.other_recovery_manifests === 0), "planned suffix contains execution evidence");
  invariant(applied.every((child) => UUID.test(child.approval_id || "") && child.approval_consumed_at && child.batch_approvals === 1 && child.successful_apply_runs === 1 && child.other_apply_runs === 0 && child.ready_recovery_manifests === 1 && child.other_recovery_manifests === 0 && child.row_count > 0 && child.row_approvals === child.row_count), "applied prefix evidence is incomplete");
  invariant(snapshot.apply_runs === applied.length, "apply run count does not match applied prefix");
  invariant(snapshot.batch_approvals === applied.length + 1, "batch approval count does not match applied prefix and boundary");
  invariant(snapshot.recovery_manifests === applied.length && snapshot.recovery_approvals === 0 && snapshot.recovery_audit === 0, "recovery evidence does not match the preserved applied prefix");
  invariant(snapshot.row_approvals === applied.reduce((sum, child) => sum + child.row_count, 0), "row approval count does not match the preserved applied prefix");
  invariant(snapshot.ledger.versions.length === snapshot.ledger.count && snapshot.ledger.count > 0, "migration ledger is incomplete");
  invariant(HEX64.test(snapshot.ledger.fingerprint), "migration ledger fingerprint is invalid");
  return {
    kind: partial ? "EXPIRED_PARTIAL_SEQUENTIAL_PLAN" : "EXPIRED_UNEXECUTED_SEQUENTIAL_PLAN",
    approvedChild: approved[0],
    appliedChildCount: applied.length,
    pendingChildCount: planned.length + 1,
  };
}

async function readSnapshot(options, dependencies, allowTerminal = false) {
  const client = dependencies.createClient(dependencies.connectionString("owner"), "retailer-control-recovery-read", true);
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    await client.query("set local time zone 'UTC'");
    const db = await assertProduction(client);
    const counts = await catalogueCounts(client);
    const rows = (await client.query(`
      select p.id::text parent_plan_id,p.parent_plan_fingerprint,p.retailer_id::text retailer_id,
             p.approved_at parent_approved_at,p.approved_by parent_approved_by,p.plan_json->>'expires_at' parent_plan_expires_at,
             p.audit_log parent_audit_log,c.audit_log child_audit_log,
             case when c.batch_index=0 then public.retailer_catalogue_sha256_json(jsonb_build_object(
               'parent',to_jsonb(p),'children',(select jsonb_agg(to_jsonb(t) order by t.batch_index)
                 from public.retailer_catalogue_child_plans t where t.parent_plan_id=p.id)
             )) end planned_control_fingerprint,
             p.status parent_status,p.approval_id::text parent_approval_id,
             p.approval_expires_at parent_approval_expires_at,p.approval_consumed_at parent_approval_consumed_at,
             c.batch_index,c.id::text child_plan_id,c.child_plan_fingerprint,c.status child_status,
             c.approval_id::text child_approval_id,c.approval_expires_at child_approval_expires_at,
             c.approved_at child_approved_at,c.rollback_requested_at,c.rollback_requested_by,
             c.approval_consumed_at child_approval_consumed_at,
             jsonb_array_length(c.plan_json->'rows') row_count,
             (select count(*)::int from public.approved_import_plans a where a.artifact_sha256=c.child_plan_fingerprint and a.source='retailer_offer_mixed_batch') row_approvals,
             (select count(*)::int from public.retailer_offer_sync_batch_approvals a where a.child_plan_id=c.id) batch_approvals,
             (select count(*)::int from public.retailer_catalogue_apply_runs r where r.child_plan_id=c.id and r.run_type='APPLY' and r.status='SUCCEEDED') successful_apply_runs,
             (select count(*)::int from public.retailer_catalogue_apply_runs r where r.child_plan_id=c.id and (r.run_type<>'APPLY' or r.status<>'SUCCEEDED')) other_apply_runs,
             (select count(*)::int from public.retailer_catalogue_production_recovery_manifests m join public.retailer_catalogue_apply_runs r on r.id=m.apply_run_id where m.child_plan_id=c.id and r.child_plan_id=c.id and r.status='SUCCEEDED' and m.status='READY') ready_recovery_manifests,
             (select count(*)::int from public.retailer_catalogue_production_recovery_manifests m where m.child_plan_id=c.id and (m.status<>'READY' or not exists(select 1 from public.retailer_catalogue_apply_runs r where r.id=m.apply_run_id and r.child_plan_id=c.id and r.status='SUCCEEDED'))) other_recovery_manifests
      from public.retailer_catalogue_parent_plans p
      join public.retailer_catalogue_child_plans c on c.parent_plan_id=p.id
      where p.id=$1::uuid and p.retailer_id=$2::bigint
      order by c.batch_index
    `, [options.parentPlanId, options.retailerId])).rows;
    invariant(rows.length > 0, "control plan was not found");
    const approvals = (await client.query(`
      select a.id::text approval_id,a.child_plan_id::text child_plan_id,a.artifact_fingerprint,
             a.execution_fingerprint,a.expected_migration_fingerprint,a.expires_at,
             a.target_environment,a.project_ref,a.database_identity,
             (a.approved_manifest is not distinct from c.plan_json) manifest_matches_child,
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
    const activeApprovals = approvals.filter((approval) => !approval.consumed_at && !approval.closed_at);
    invariant(rows[0].parent_status === "PLANNED" || allowTerminal ? approvals.length === 0 : activeApprovals.length === 1,
      "expected exactly one active batch approval or no approvals for PLANNED");
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
      parent_audit_log: first.parent_audit_log,
      planned_control_fingerprint: first.planned_control_fingerprint,
      parent_approval_id: first.parent_approval_id ? String(first.parent_approval_id) : null,
      parent_approved_at: first.parent_approved_at ? new Date(first.parent_approved_at).toISOString() : null,
      parent_approved_by: first.parent_approved_by ?? null,
      parent_plan_expires_at: first.parent_plan_expires_at ? new Date(first.parent_plan_expires_at).toISOString() : null,
      parent_approval_expires_at: first.parent_approval_expires_at ? new Date(first.parent_approval_expires_at).toISOString() : null,
      parent_approval_consumed_at: first.parent_approval_consumed_at ? new Date(first.parent_approval_consumed_at).toISOString() : null,
      children: rows.map(normalizeChild),
      approval: activeApprovals.length === 0 ? null : {
        ...activeApprovals[0],
        expires_at: new Date(activeApprovals[0].expires_at).toISOString(),
        consumed_at: activeApprovals[0].consumed_at ? new Date(activeApprovals[0].consumed_at).toISOString() : null,
        closed_at: activeApprovals[0].closed_at ? new Date(activeApprovals[0].closed_at).toISOString() : null,
      },
      ...Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, Number(value)])),
      business_counts: counts,
      ledger,
    };
  } finally {
    await client.end();
  }
}

async function discoverBlockingControls(options, dependencies) {
  const client = dependencies.createClient(dependencies.connectionString("owner"), "retailer-control-recovery-discovery", true);
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const db = await assertProduction(client);
    const counts = await catalogueCounts(client);
    const rows = (await client.query(`
      select p.id::text parent_plan_id,p.parent_plan_fingerprint,p.status parent_status,
             p.approval_expires_at,p.approval_consumed_at,
             count(c.id)::int child_count,
             count(c.id) filter(where c.status='PLANNED')::int planned_child_count,
             count(c.id) filter(where c.status='APPROVED')::int approved_child_count,
             count(c.id) filter(where c.status='APPLYING')::int applying_child_count,
             count(c.id) filter(where c.status='APPLIED')::int applied_child_count,
             (select count(*)::int from public.retailer_catalogue_apply_runs r where r.parent_plan_id=p.id) apply_run_count
      from public.retailer_catalogue_parent_plans p
      join public.retailer_catalogue_child_plans c on c.parent_plan_id=p.id
      where p.retailer_id=$1::bigint and p.status in ('PLANNED','APPROVED','PARTIALLY_APPLIED')
      group by p.id,p.parent_plan_fingerprint,p.status,p.approval_expires_at,p.approval_consumed_at,p.created_at
      order by p.created_at,p.id
    `, [options.retailerId])).rows;
    await client.query("rollback");
    const ledger = {
      count: db.remoteLedger.length,
      fingerprint: ledgerRowsFingerprint(db.remoteLedger, { targetEnvironment: "PRODUCTION" }),
    };
    return buildDiscoveryReport(rows, options, { catalogue_counts: counts, migration_ledger: ledger }, dependencies.now());
  } finally {
    await client.end();
  }
}

function buildPreflight(snapshot, options, now = new Date()) {
  const recovery = validateRecoverable(snapshot, options, now);
  const controlStateFingerprint = sha256(canonicalJson(snapshot));
  return seal({
    schema_version: "retailer-control-plan-recovery-v2",
    kind: recovery.kind,
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
      approved_child_id: recovery.approvedChild?.child_plan_id ?? null,
      approval_id: snapshot.approval?.approval_id ?? null,
      preserved_applied_child_count: recovery.appliedChildCount,
      close_child_count: recovery.pendingChildCount,
    },
    control_state_fingerprint: controlStateFingerprint,
    snapshot,
    authorization: {
      business_writes: false,
      price_history_writes: false,
      automatic_retry: false,
      maximum_close_calls: 1,
      required_confirmation: recovery.kind === PLANNED_KIND ? PLANNED_CONFIRMATION : CONFIRMATION,
    },
  });
}

function validatePreflight(preflight, options, now = new Date()) {
  invariant(exactKeys(preflight, ["schema_version", "kind", "result", "generated_at", "target", "scope", "control_state_fingerprint", "snapshot", "authorization", "recovery_fingerprint"]), "preflight keys mismatch");
  invariant(preflight.schema_version === "retailer-control-plan-recovery-v2" && ["EXPIRED_UNEXECUTED_SEQUENTIAL_PLAN", "EXPIRED_PARTIAL_SEQUENTIAL_PLAN", PLANNED_KIND].includes(preflight.kind) && preflight.result === "READY_TO_CLOSE", "preflight contract mismatch");
  invariant(preflight.recovery_fingerprint === sha256(canonicalJson({ ...preflight, recovery_fingerprint: null })), "preflight fingerprint mismatch");
  invariant(preflight.target.environment === "PRODUCTION" && preflight.target.project_ref === PRODUCTION.projectRef && preflight.target.database_identity === PRODUCTION.databaseIdentity, "preflight target mismatch");
  invariant(preflight.scope.parent_plan_id === options.parentPlanId && preflight.scope.retailer_id === options.retailerId && preflight.scope.expected_child_count === options.expectedChildCount, "preflight scope mismatch");
  invariant(now.getTime() - Date.parse(preflight.generated_at) <= 2 * 60 * 60 * 1000 && Date.parse(preflight.generated_at) <= now.getTime() + 5 * 60 * 1000, "preflight is stale or future");
  invariant(preflight.authorization.business_writes === false && preflight.authorization.price_history_writes === false && preflight.authorization.automatic_retry === false && preflight.authorization.maximum_close_calls === 1 && preflight.authorization.required_confirmation === (preflight.kind === PLANNED_KIND ? PLANNED_CONFIRMATION : CONFIRMATION), "preflight authorization boundary mismatch");
  const recovery = validateRecoverable(preflight.snapshot, options, now);
  invariant(preflight.scope.approval_id === (preflight.snapshot.approval?.approval_id ?? null)
    && preflight.scope.approved_child_id === (recovery.approvedChild?.child_plan_id ?? null), "preflight approval scope mismatch");
  invariant(recovery.kind === preflight.kind && recovery.appliedChildCount === preflight.scope.preserved_applied_child_count && recovery.pendingChildCount === preflight.scope.close_child_count, "preflight recovery classification mismatch");
  invariant(preflight.control_state_fingerprint === sha256(canonicalJson(preflight.snapshot)), "preflight state fingerprint mismatch");
  return preflight;
}

function closeRequest(snapshot, now = new Date()) {
  if (snapshot.parent_status === "PLANNED") {
    validateRecoverable(snapshot, { retailerId: snapshot.retailer_id, parentPlanId: snapshot.parent_plan_id,
      expectedChildCount: snapshot.children.length }, now);
    const request = {
      schema_version: 2, kind: PLANNED_KIND,
      retailer_id: snapshot.retailer_id, parent_plan_id: snapshot.parent_plan_id,
      parent_plan_fingerprint: snapshot.parent_plan_fingerprint,
      expected_parent_expires_at: snapshot.parent_plan_expires_at,
      expected_children: snapshot.children.map((child) => ({ batch_index: child.batch_index,
        child_plan_id: child.child_plan_id, child_plan_fingerprint: child.child_plan_fingerprint, row_count: child.row_count })),
      control_state_fingerprint: snapshot.planned_control_fingerprint,
      expected_migration_versions: snapshot.ledger.versions, expected_migration_fingerprint: snapshot.ledger.fingerprint,
      migration_fingerprint_algorithm: "SHA-256", migration_fingerprint_version: "RSBI-CJ1",
      target_environment: "PRODUCTION", production_project_ref: PRODUCTION.projectRef,
      production_database_identity: PRODUCTION.databaseIdentity,
      reason: "Supersede exact stale never-approved sequential control tree; no business writes",
      closed_by: "supplementscout-owner-approved-control-recovery", requested_at: now.toISOString(), request_fingerprint: null,
    };
    request.request_fingerprint = sha256(canonicalJson(request));
    return request;
  }
  const approved = snapshot.children.find((child) => child.status === "APPROVED");
  const partial = snapshot.parent_status === "PARTIALLY_APPLIED";
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
    reason: partial
      ? "Preserve exact applied prefix and supersede expired unexecuted sequential suffix; no business writes"
      : "Close exact expired unexecuted sequential control tree; no business writes",
    closed_by: "supplementscout-owner-approved-control-recovery",
    requested_at: now.toISOString(),
    request_fingerprint: null,
  };
  request.request_fingerprint = sha256(canonicalJson(request));
  return request;
}

async function closePlan(preflight, options, dependencies) {
  const liveBefore = await readSnapshot(options, dependencies);
  const recovery = validateRecoverable(liveBefore, options, dependencies.now());
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
    const expectedStatus = recovery.kind === PLANNED_KIND || recovery.appliedChildCount > 0 ? "SUPERSEDED" : "EXPIRED";
    invariant(result?.status === expectedStatus && result.already_closed === false, "close result mismatch");
    invariant(Number(result.preserved_applied_child_count) === recovery.appliedChildCount && Number(result.closed_child_count) === recovery.pendingChildCount && Number(result.control_writes) === recovery.pendingChildCount + (recovery.kind === PLANNED_KIND ? 1 : 2), "close count mismatch");
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

async function readPostflight(options, dependencies, preflight, closed) {
  if (preflight.kind === PLANNED_KIND) {
    const snapshot = await readSnapshot(options, dependencies, true);
    const eventMatches = (events) => Array.isArray(events) && events.some((event) =>
      event.event === "NEVER_APPROVED_PLANNED_TREE_SUPERSEDED"
      && event.request_fingerprint === closed.request_fingerprint
      && event.control_state_fingerprint === preflight.snapshot.planned_control_fingerprint);
    invariant(snapshot.parent_status === "SUPERSEDED" && eventMatches(snapshot.parent_audit_log), "planned parent postflight audit mismatch");
    invariant(snapshot.children.length === options.expectedChildCount && snapshot.children.every((child, index) =>
      child.status === "SUPERSEDED" && child.child_plan_id === preflight.snapshot.children[index].child_plan_id
      && child.child_plan_fingerprint === preflight.snapshot.children[index].child_plan_fingerprint
      && eventMatches(child.audit_log)), "planned child postflight mismatch");
    // Reuse the strict never-approved evidence check after substituting only the expected terminal statuses.
    validateRecoverable({ ...snapshot, parent_status: "PLANNED", children: snapshot.children.map((child) => ({ ...child, status: "PLANNED" })) }, options, dependencies.now());
    invariant(canonicalJson(snapshot.business_counts) === canonicalJson(preflight.snapshot.business_counts)
      && canonicalJson(snapshot.ledger) === canonicalJson(preflight.snapshot.ledger), "business or migration state changed during close");
    return { parent_status: "SUPERSEDED", preserved_applied_child_count: 0, closed_child_count: snapshot.children.length,
      approval_closed: false, apply_runs: 0, business_counts: snapshot.business_counts };
  }
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
    const applied = preflight.scope.preserved_applied_child_count;
    const closed = preflight.scope.close_child_count;
    const terminalStatus = applied > 0 ? "SUPERSEDED" : "EXPIRED";
    const byStatus = Object.fromEntries(children.map((row) => [row.status, Number(row.count)]));
    invariant(parent?.status === terminalStatus, "parent terminal status mismatch");
    invariant((byStatus.APPLIED || 0) === applied && (byStatus[terminalStatus] || 0) === closed && Object.values(byStatus).reduce((sum, count) => sum + count, 0) === options.expectedChildCount, "child terminal status counts mismatch");
    invariant(approval?.closed_at && !approval.consumed_at, "approval close evidence mismatch");
    invariant(runs === applied, "apply run count changed during close");
    invariant(canonicalJson(counts) === canonicalJson(preflight.snapshot.business_counts), "business counts changed during close");
    return { parent_status: parent.status, preserved_applied_child_count: applied, closed_child_count: closed, approval_closed: true, apply_runs: runs, business_counts: counts };
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
  if (options.mode === "discover") {
    const report = await discoverBlockingControls(options, dependencies);
    writeJson(options.output, report);
    return report;
  }
  if (options.mode === "preflight") {
    const snapshot = await readSnapshot(options, dependencies);
    const report = buildPreflight(snapshot, options, dependencies.now());
    writeJson(options.output, report);
    return report;
  }
  const preflight = validatePreflight(JSON.parse(fs.readFileSync(options.input, "utf8")), options, dependencies.now());
  invariant(options.confirmation === preflight.authorization.required_confirmation, "close confirmation does not match the sealed recovery kind");
  if (preflight.kind === PLANNED_KIND) invariant(options.approvedStateFingerprint === preflight.snapshot.planned_control_fingerprint,
    "planned close requires separate owner approval of the exact control state fingerprint");
  const closed = await closePlan(preflight, options, dependencies);
  const postflight = await readPostflight(options, dependencies, preflight, closed);
  const report = seal({
    schema_version: "retailer-control-plan-recovery-result-v1",
    result: "PASS",
    completed_at: dependencies.now().toISOString(),
    scope: preflight.scope,
    preflight_fingerprint: preflight.recovery_fingerprint,
    close: closed,
    postflight,
    accounting: { close_calls: 1, automatic_retries: 0, control_writes: preflight.scope.close_child_count + (preflight.kind === PLANNED_KIND ? 1 : 2), business_writes: 0, price_history_writes: 0 },
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
  PLANNED_CONFIRMATION,
  buildDiscoveryReport,
  buildPreflight,
  closeRequest,
  parseArgs,
  seal,
  validatePreflight,
  validateRecoverable,
  run,
};
