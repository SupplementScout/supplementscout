const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { postgresClientConfig } = require("./lib/secure-postgres");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "tmp", "automation-review-execution");
const REQUEST_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const CLOSEOUT_CHECKPOINT = "VERIFIED_ZERO_BUSINESS_WRITE_CLOSEOUT";
const CLOSEOUT_KIND = "automation-review-verified-zero-business-write-closeout-v1";
const PRODUCTION_TARGET = Object.freeze({
  target_environment: "PRODUCTION",
  project_ref: "aftboxmrdgyhizicfsfu",
  database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
});

function invariant(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function parseArgs(argv) {
  invariant(argv.length === 1, "ZERO_BUSINESS_CLOSEOUT_ARGUMENT_INVALID");
  const match = argv[0].match(/^--execution-request-id=(.+)$/);
  invariant(match && REQUEST_PATTERN.test(match[1]), "ZERO_BUSINESS_CLOSEOUT_REQUEST_ID_INVALID");
  return { executionRequestId: match[1] };
}

function assertContext(options, env = process.env) {
  invariant(
    env.GITHUB_ACTIONS === "true"
      && env.GITHUB_EVENT_NAME === "workflow_dispatch"
      && env.GITHUB_REF === "refs/heads/main"
      && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout",
    "ZERO_BUSINESS_CLOSEOUT_CONTEXT_INVALID",
  );
  invariant(
    env.AUTOMATION_REVIEW_ZERO_BUSINESS_CLOSEOUT_REQUEST_ID === options.executionRequestId,
    "ZERO_BUSINESS_CLOSEOUT_CONTEXT_REQUEST_DRIFT",
  );
  invariant(
    env.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL
      && env.NEXT_PUBLIC_SUPABASE_URL
      && env.SUPABASE_SERVICE_ROLE_KEY,
    "ZERO_BUSINESS_CLOSEOUT_CREDENTIAL_MISSING",
  );
  invariant(!env.SAFE_UPDATE, "ZERO_BUSINESS_CLOSEOUT_SAFE_UPDATE_FORBIDDEN");
}

function controlClient(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ownerClient(env = process.env) {
  return new Client(postgresClientConfig({
    connectionString: env.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL,
    applicationName: "automation-review-zero-business-closeout",
    defaultReadOnly: true,
  }));
}

function asString(value) {
  return value == null ? null : String(value);
}

function decimal(value) {
  invariant(value != null && /^-?\d+(?:\.\d+)?$/.test(String(value)), "ZERO_BUSINESS_CLOSEOUT_DECIMAL_INVALID");
  const [integer, fraction = ""] = String(value).split(".");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${integer}.${normalizedFraction}` : integer;
}

function containsRunId(value, runId) {
  if (Array.isArray(value)) return value.some((entry) => containsRunId(entry, runId));
  if (!value || typeof value !== "object") return false;
  if (value.workflow && typeof value.workflow === "object" && asString(value.workflow.run_id) === runId) return true;
  return Object.values(value).some((entry) => containsRunId(entry, runId));
}

function terminalZeroWriteEvidence(auditLog) {
  if (!Array.isArray(auditLog)) return null;
  return auditLog.find((event) => event && typeof event === "object"
    && /SUPERSEDED/.test(String(event.event || ""))
    && typeof event.reason === "string" && event.reason.length > 0
    && Number(event.business_writes) === 0) || null;
}

function assertFailedBindings(request, review) {
  invariant(request?.status === "FAILED" && request.last_checkpoint === "EXECUTION_FAILED", "ZERO_BUSINESS_CLOSEOUT_REQUEST_STATE_INVALID");
  invariant(Number.isInteger(Number(request.database_writes)) && Number(request.database_writes) > 0, "ZERO_BUSINESS_CLOSEOUT_WRITE_SCOPE_INVALID");
  invariant(review?.review_status === "FAILED" && asString(review.execution_id) === asString(request.id), "ZERO_BUSINESS_CLOSEOUT_REVIEW_STATE_INVALID");
  invariant(asString(request.review_id) === asString(review.id), "ZERO_BUSINESS_CLOSEOUT_REVIEW_BINDING_DRIFT");
  invariant(asString(request.retailer_id) === asString(review.retailer_id)
    && request.operation_type === review.operation_type, "ZERO_BUSINESS_CLOSEOUT_SCOPE_BINDING_DRIFT");
  invariant(request.review_fingerprint === review.source_row_fingerprint
    && request.plan_fingerprint === review.plan_fingerprint, "ZERO_BUSINESS_CLOSEOUT_FINGERPRINT_DRIFT");
  invariant(typeof request.retailer_slug === "string" && request.retailer_slug.length > 0, "ZERO_BUSINESS_CLOSEOUT_RETAILER_SLUG_MISSING");
  invariant(/^[1-9][0-9]*$/.test(String(request.run_id || ""))
    && COMMIT_PATTERN.test(String(request.commit_sha || "")), "ZERO_BUSINESS_CLOSEOUT_RUN_IDENTITY_INVALID");
  invariant(review.before_state && typeof review.before_state === "object", "ZERO_BUSINESS_CLOSEOUT_BEFORE_STATE_MISSING");
}

function assertBusinessBeforeState(review, request, offer, mapping) {
  const before = review.before_state;
  for (const key of ["offer_id", "retailer_product_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "price", "shipping_cost", "total_price", "in_stock", "url", "external_url"]) {
    invariant(Object.prototype.hasOwnProperty.call(before, key), `ZERO_BUSINESS_CLOSEOUT_BEFORE_STATE_MISSING_${key.toUpperCase()}`);
  }
  invariant(asString(offer.id) === asString(before.offer_id)
    && asString(offer.retailer_product_id) === asString(before.retailer_product_id)
    && asString(offer.product_id) === asString(before.product_id)
    && asString(offer.product_variant_id) === asString(before.product_variant_id)
    && asString(offer.retailer_id) === asString(request.retailer_id), "ZERO_BUSINESS_CLOSEOUT_OFFER_IDENTITY_DRIFT");
  invariant(decimal(offer.price) === decimal(before.price)
    && decimal(offer.shipping_cost) === decimal(before.shipping_cost)
    && decimal(offer.total_price) === decimal(before.total_price)
    && offer.in_stock === before.in_stock
    && offer.url === before.url, "ZERO_BUSINESS_CLOSEOUT_OFFER_COMMERCIAL_DRIFT");
  invariant(asString(mapping.id) === asString(before.retailer_product_id)
    && asString(mapping.retailer_id) === asString(request.retailer_id)
    && asString(mapping.product_id) === asString(before.product_id)
    && asString(mapping.product_variant_id) === asString(before.product_variant_id)
    && asString(mapping.external_product_id) === asString(before.external_product_id)
    && asString(mapping.external_variant_id) === asString(before.external_variant_id)
    && mapping.external_url === before.external_url, "ZERO_BUSINESS_CLOSEOUT_MAPPING_IDENTITY_DRIFT");
}

function verifyOwnerSnapshot(snapshot) {
  const { identity, target, request, review, parentCandidates, children, counts, offer, mapping } = snapshot;
  invariant(identity.current_user === "postgres" && identity.session_user === "postgres"
    && identity.read_only === "on" && !identity.safe_update, "ZERO_BUSINESS_CLOSEOUT_OWNER_IDENTITY_INVALID");
  invariant(Object.entries(PRODUCTION_TARGET).every(([key, value]) => target[key] === value), "ZERO_BUSINESS_CLOSEOUT_TARGET_INVALID");
  assertFailedBindings(request, review);
  invariant(Number(snapshot.existingCloseoutCount) === 0, "ZERO_BUSINESS_CLOSEOUT_ALREADY_RECORDED");

  const runId = String(request.run_id);
  const parents = parentCandidates.filter((parent) => (
    String(parent.created_by || "").startsWith(`github:SupplementScout/supplementscout:${runId}:`)
      || containsRunId(parent.audit_log, runId)
  ));
  invariant(parents.length > 0, "ZERO_BUSINESS_CLOSEOUT_PARENT_PLAN_MISSING");
  invariant(parents.every((parent) => parent.status === "SUPERSEDED"
    && asString(parent.retailer_id) === asString(request.retailer_id)
    && parent.target_environment === "PRODUCTION"
    && parent.code_commit === request.commit_sha
    && terminalZeroWriteEvidence(parent.audit_log)), "ZERO_BUSINESS_CLOSEOUT_PARENT_NOT_TERMINAL");
  const parentIds = parents.map((parent) => String(parent.id)).sort();
  const boundChildren = children.filter((child) => parentIds.includes(String(child.parent_plan_id)));
  invariant(boundChildren.length > 0, "ZERO_BUSINESS_CLOSEOUT_CHILD_PLAN_MISSING");
  invariant(boundChildren.every((child) => child.status === "SUPERSEDED"
    && asString(child.retailer_id) === asString(request.retailer_id)
    && child.target_environment === "PRODUCTION"
    && child.code_commit === request.commit_sha
    && terminalZeroWriteEvidence(child.audit_log)), "ZERO_BUSINESS_CLOSEOUT_CHILD_NOT_TERMINAL");

  invariant(Number(counts.apply_run_count) === 0, "ZERO_BUSINESS_CLOSEOUT_APPLY_RUN_PRESENT");
  invariant(Number(counts.batch_approval_count) === 0, "ZERO_BUSINESS_CLOSEOUT_BATCH_APPROVAL_PRESENT");
  invariant(Number(counts.approved_import_plan_count) === 0, "ZERO_BUSINESS_CLOSEOUT_APPROVED_IMPORT_PRESENT");
  invariant(Number(counts.recovery_execution_count) === 0, "ZERO_BUSINESS_CLOSEOUT_RECOVERY_PRESENT");
  assertBusinessBeforeState(review, request, offer.row, mapping.row);
  invariant(SHA256_PATTERN.test(offer.row_hash) && SHA256_PATTERN.test(mapping.row_hash), "ZERO_BUSINESS_CLOSEOUT_STATE_HASH_INVALID");

  return {
    request,
    review,
    parentPlanIds: parentIds,
    childPlanIds: boundChildren.map((child) => String(child.id)).sort(),
    terminalReasons: [...new Set([
      ...parents.map((parent) => terminalZeroWriteEvidence(parent.audit_log).reason),
      ...boundChildren.map((child) => terminalZeroWriteEvidence(child.audit_log).reason),
    ])].sort(),
    counts: {
      apply_run_count: Number(counts.apply_run_count),
      batch_approval_count: Number(counts.batch_approval_count),
      approved_import_plan_count: Number(counts.approved_import_plan_count),
      recovery_execution_count: Number(counts.recovery_execution_count),
    },
    offerHash: offer.row_hash,
    mappingHash: mapping.row_hash,
  };
}

async function readOwnerSnapshot(client, requestId) {
  const one = async (sql, values = []) => (await client.query(sql, values)).rows[0];
  const rows = async (sql, values = []) => (await client.query(sql, values)).rows;
  const identity = await one(`select current_user,session_user,current_role,
    current_setting('transaction_read_only') read_only,
    current_setting('app.safe_update',true) safe_update`);
  const target = (await one("select public.retailer_catalogue_actual_database_target() target")).target;
  const request = await one("select * from public.automation_review_execution_requests where id=$1::uuid", [requestId]);
  invariant(request, "ZERO_BUSINESS_CLOSEOUT_REQUEST_NOT_FOUND");
  const review = await one("select * from public.product_match_review_queue where id=$1", [request.review_id]);
  invariant(review, "ZERO_BUSINESS_CLOSEOUT_REVIEW_NOT_FOUND");
  assertFailedBindings(request, review);
  const existingCloseoutCount = (await one(`select count(*)::integer count
    from public.automation_review_execution_events
    where execution_request_id=$1::uuid and checkpoint=$2`, [requestId, CLOSEOUT_CHECKPOINT])).count;
  const parentCandidates = await rows(`select id::text,retailer_id::text,target_environment,status,created_by,code_commit,audit_log
    from public.retailer_catalogue_parent_plans
    where retailer_id=$1 and target_environment='PRODUCTION' and code_commit=$2`, [request.retailer_id, request.commit_sha]);
  const candidateParentIds = parentCandidates.map((parent) => parent.id);
  const children = candidateParentIds.length ? await rows(`select id::text,parent_plan_id::text,retailer_id::text,target_environment,status,code_commit,audit_log
    from public.retailer_catalogue_child_plans where parent_plan_id=any($1::uuid[])`, [candidateParentIds]) : [];
  const parentIds = parentCandidates
    .filter((parent) => String(parent.created_by || "").startsWith(`github:SupplementScout/supplementscout:${request.run_id}:`) || containsRunId(parent.audit_log, String(request.run_id)))
    .map((parent) => parent.id);
  const childIds = children.filter((child) => parentIds.includes(child.parent_plan_id)).map((child) => child.id);
  const counts = parentIds.length && childIds.length ? await one(`select
    (select count(*)::integer from public.retailer_catalogue_apply_runs where parent_plan_id=any($1::uuid[])) apply_run_count,
    (select count(*)::integer from public.retailer_offer_sync_batch_approvals where child_plan_id=any($2::uuid[])) batch_approval_count,
    (select count(*)::integer from public.approved_import_plans where run_id=$3 or plan_json::text like '%'||$4||'%' or authorization_envelope::text like '%'||$4||'%') approved_import_plan_count,
    ((select count(*) from public.retailer_catalogue_apply_runs where child_plan_id=any($2::uuid[]) and run_type='ROLLBACK')
      +(select count(*) from public.retailer_catalogue_production_recovery_manifests where child_plan_id=any($2::uuid[]))
      +(select count(*) from public.retailer_catalogue_production_recovery_approvals where child_plan_id=any($2::uuid[])))::integer recovery_execution_count`,
  [parentIds, childIds, String(request.run_id), String(request.id)]) : {
    apply_run_count: 0,
    batch_approval_count: 0,
    approved_import_plan_count: 0,
    recovery_execution_count: 0,
  };
  const offer = await one(`select to_jsonb(o) row,public.retailer_catalogue_sha256_json(to_jsonb(o)) row_hash
    from public.offers o where id=$1`, [review.before_state?.offer_id]);
  const mapping = await one(`select to_jsonb(rp) row,public.retailer_catalogue_sha256_json(to_jsonb(rp)) row_hash
    from public.retailer_products rp where id=$1`, [review.before_state?.retailer_product_id]);
  invariant(offer && mapping, "ZERO_BUSINESS_CLOSEOUT_BUSINESS_STATE_MISSING");
  return { identity, target, request, review, existingCloseoutCount, parentCandidates, children, counts, offer, mapping };
}

async function readPostCheckpoint(client, requestId) {
  const request = (await client.query("select * from public.automation_review_execution_requests where id=$1::uuid", [requestId])).rows[0];
  invariant(request, "ZERO_BUSINESS_CLOSEOUT_POST_REQUEST_MISSING");
  const review = (await client.query("select * from public.product_match_review_queue where id=$1", [request.review_id])).rows[0];
  const events = (await client.query(`select previous_status,new_status,checkpoint,evidence
    from public.automation_review_execution_events
    where execution_request_id=$1::uuid and checkpoint=$2 order by created_at,id`, [requestId, CLOSEOUT_CHECKPOINT])).rows;
  return { request, review, events };
}

function buildEvidence(verified, env = process.env, now = new Date()) {
  return {
    kind: CLOSEOUT_KIND,
    execution_request_id: String(verified.request.id),
    review_id: String(verified.review.id),
    retailer_id: String(verified.request.retailer_id),
    retailer_slug: verified.request.retailer_slug,
    offer_id: String(verified.review.offer_id),
    original_run_id: String(verified.request.run_id),
    original_commit_sha: verified.request.commit_sha,
    closeout_run_id: String(env.GITHUB_RUN_ID || ""),
    closeout_commit_sha: String(env.GITHUB_SHA || ""),
    possible_database_writes: Number(verified.request.database_writes),
    business_writes: 0,
    parent_plan_ids: verified.parentPlanIds,
    child_plan_ids: verified.childPlanIds,
    terminal_reasons: verified.terminalReasons,
    ...verified.counts,
    before_state_offer_hash: verified.offerHash,
    before_state_mapping_hash: verified.mappingHash,
    verified_at: now.toISOString(),
  };
}

async function run(options, dependencies = {}) {
  const env = dependencies.env || process.env;
  assertContext(options, env);
  const pg = dependencies.ownerClient || ownerClient(env);
  await pg.connect();
  let verified, evidence, checkpointResult, post;
  try {
    await pg.query("begin read only");
    const snapshot = dependencies.readOwnerSnapshot
      ? await dependencies.readOwnerSnapshot(pg, options.executionRequestId)
      : await readOwnerSnapshot(pg, options.executionRequestId);
    verified = verifyOwnerSnapshot(snapshot);
    await pg.query("rollback");

    evidence = buildEvidence(verified, env, dependencies.now || new Date());
    const db = dependencies.controlClient || controlClient(env);
    const result = await db.rpc("record_automation_review_execution_checkpoint", {
      p_execution_request_id: options.executionRequestId,
      p_actor: `github-actions:${env.GITHUB_ACTOR || "unknown"}`,
      p_new_status: "FAILED",
      p_checkpoint: CLOSEOUT_CHECKPOINT,
      p_evidence: evidence,
    });
    invariant(!result.error && result.data?.status === "FAILED"
      && result.data.last_checkpoint === CLOSEOUT_CHECKPOINT
      && Number(result.data.database_writes) === evidence.possible_database_writes,
    "ZERO_BUSINESS_CLOSEOUT_CHECKPOINT_FAILED");
    checkpointResult = result.data;

    await pg.query("begin read only");
    post = dependencies.readPostCheckpoint
      ? await dependencies.readPostCheckpoint(pg, options.executionRequestId)
      : await readPostCheckpoint(pg, options.executionRequestId);
    invariant(post.request?.status === "FAILED"
      && post.request.last_checkpoint === CLOSEOUT_CHECKPOINT
      && Number(post.request.database_writes) === evidence.possible_database_writes
      && post.request.error_code === verified.request.error_code
      && post.request.error_message === verified.request.error_message,
    "ZERO_BUSINESS_CLOSEOUT_REQUEST_HISTORY_CHANGED");
    invariant(post.review?.review_status === "FAILED"
      && String(post.review.execution_id) === options.executionRequestId,
    "ZERO_BUSINESS_CLOSEOUT_REVIEW_CHANGED");
    invariant(post.events.length === 1
      && post.events[0].previous_status === "FAILED"
      && post.events[0].new_status === "FAILED"
      && canonicalJson(post.events[0].evidence) === canonicalJson(evidence),
    "ZERO_BUSINESS_CLOSEOUT_EVENT_READBACK_FAILED");
    await pg.query("rollback");
  } catch (error) {
    try { await pg.query("rollback"); } catch {}
    throw error;
  } finally {
    await pg.end();
  }

  const report = {
    schema_version: 1,
    kind: CLOSEOUT_KIND,
    result: "PASS",
    request_status: post.request.status,
    review_status: post.review.review_status,
    database_writes_preserved: Number(checkpointResult.database_writes),
    checkpoint: checkpointResult.last_checkpoint,
    catalogue_writes: 0,
    ...evidence,
  };
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const output = path.join(OUTPUT_DIRECTORY, `${options.executionRequestId}-zero-business-closeout.json`);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify({ result: report.result, execution_request_id: report.execution_request_id, review_id: report.review_id, request_status: report.request_status, review_status: report.review_status, checkpoint: report.checkpoint, possible_database_writes: report.possible_database_writes, business_writes: report.business_writes })))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  CLOSEOUT_CHECKPOINT,
  CLOSEOUT_KIND,
  assertBusinessBeforeState,
  assertContext,
  assertFailedBindings,
  buildEvidence,
  containsRunId,
  parseArgs,
  readPostCheckpoint,
  readOwnerSnapshot,
  run,
  terminalZeroWriteEvidence,
  verifyOwnerSnapshot,
};
