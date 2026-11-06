"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { postgresClientConfig } = require("./lib/secure-postgres");
const { assertBusinessBeforeState } = require("./automation-review-zero-business-closeout");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "tmp", "automation-review-execution");
const REQUEST_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const RUN_PATTERN = /^[1-9][0-9]*$/;
const REPOSITORY = "SupplementScout/supplementscout";
const WORKFLOW_PATH = ".github/workflows/automation-review-queue-worker.yml";
const WORKFLOW_NAME = "Automation Review Queue Worker";
const JOB_NAME = "execute-next-approved-review";
const EXECUTION_STEP = "Execute oldest approved queue request";
const CLOSEOUT_CHECKPOINT = "VERIFIED_CANCELLED_BEFORE_EXECUTION";
const CLOSEOUT_KIND = "automation-review-verified-cancelled-dispatch-closeout-v1";
const ERROR_CODE = "WORKFLOW_CANCELLED_BEFORE_EXECUTION";
const ERROR_MESSAGE = "Verified cancelled GitHub run before the protected execution checkpoint; no business writes detected.";
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
  invariant(argv.length === 1, "CANCELLED_DISPATCH_CLOSEOUT_ARGUMENT_INVALID");
  const match = argv[0].match(/^--execution-request-id=(.+)$/);
  invariant(match && REQUEST_PATTERN.test(match[1]), "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_ID_INVALID");
  return { executionRequestId: match[1] };
}

function assertContext(options, env = process.env) {
  invariant(
    env.GITHUB_ACTIONS === "true"
      && env.GITHUB_EVENT_NAME === "workflow_dispatch"
      && env.GITHUB_REF === "refs/heads/main"
      && env.GITHUB_REPOSITORY === REPOSITORY,
    "CANCELLED_DISPATCH_CLOSEOUT_CONTEXT_INVALID",
  );
  invariant(
    env.AUTOMATION_REVIEW_CANCELLED_DISPATCH_CLOSEOUT_REQUEST_ID === options.executionRequestId,
    "CANCELLED_DISPATCH_CLOSEOUT_CONTEXT_REQUEST_DRIFT",
  );
  invariant(
    env.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL
      && env.NEXT_PUBLIC_SUPABASE_URL
      && env.SUPABASE_SERVICE_ROLE_KEY
      && env.GITHUB_TOKEN,
    "CANCELLED_DISPATCH_CLOSEOUT_CREDENTIAL_MISSING",
  );
  invariant(RUN_PATTERN.test(String(env.GITHUB_RUN_ID || ""))
    && COMMIT_PATTERN.test(String(env.GITHUB_SHA || "")), "CANCELLED_DISPATCH_CLOSEOUT_RUN_IDENTITY_INVALID");
  invariant(!env.SAFE_UPDATE, "CANCELLED_DISPATCH_CLOSEOUT_SAFE_UPDATE_FORBIDDEN");
}

function ownerClient(env = process.env) {
  return new Client(postgresClientConfig({
    connectionString: env.SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL,
    applicationName: "automation-review-cancelled-dispatch-closeout",
    defaultReadOnly: true,
  }));
}

function controlClient(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "SupplementScout-Automation-Review-Cancelled-Closeout/1.0",
    },
  });
  invariant(response.ok, "CANCELLED_DISPATCH_CLOSEOUT_GITHUB_READ_FAILED");
  return response.json();
}

function verifyCancelledRun(run, jobsPayload, request) {
  invariant(String(run?.id) === String(request.run_id)
    && run.name === WORKFLOW_NAME
    && String(run.path || "").split("@")[0] === WORKFLOW_PATH,
  "CANCELLED_DISPATCH_CLOSEOUT_WORKFLOW_BINDING_INVALID");
  invariant(run.event === "workflow_dispatch"
    && run.head_branch === "main"
    && run.head_sha === request.commit_sha,
  "CANCELLED_DISPATCH_CLOSEOUT_RUN_SOURCE_INVALID");
  invariant(run.status === "completed" && run.conclusion === "cancelled",
    "CANCELLED_DISPATCH_CLOSEOUT_RUN_NOT_CANCELLED");
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  invariant(jobs.length === 1, "CANCELLED_DISPATCH_CLOSEOUT_JOB_SCOPE_INVALID");
  const job = jobs[0];
  invariant(job.name === JOB_NAME && job.status === "completed" && job.conclusion === "cancelled",
    "CANCELLED_DISPATCH_CLOSEOUT_JOB_NOT_CANCELLED");
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const execution = steps.find((step) => step.name === EXECUTION_STEP);
  invariant(execution?.status === "completed" && execution.conclusion === "cancelled"
    && Date.parse(execution.started_at) > 0 && Date.parse(execution.completed_at) > Date.parse(execution.started_at),
  "CANCELLED_DISPATCH_CLOSEOUT_EXECUTION_STEP_INVALID");
  for (const name of ["Test queue worker without production credentials", "Remove test-only execution evidence", "Audit owner decisions read-only"]) {
    const step = steps.find((candidate) => candidate.name === name);
    invariant(step?.conclusion === "success", "CANCELLED_DISPATCH_CLOSEOUT_PREFLIGHT_INCOMPLETE");
  }
  return {
    runId: String(run.id),
    runUrl: run.html_url,
    workflowPath: String(run.path).split("@")[0],
    workflowName: run.name,
    jobId: String(job.id),
    jobUrl: job.html_url,
    executionStartedAt: execution.started_at,
    executionCompletedAt: execution.completed_at,
  };
}

async function readCancelledRun(request, env = process.env, fetchImpl = fetch) {
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const base = `${api}/repos/${REPOSITORY}/actions/runs/${request.run_id}`;
  const [run, jobs] = await Promise.all([
    githubJson(base, env.GITHUB_TOKEN, fetchImpl),
    githubJson(`${base}/jobs?per_page=100`, env.GITHUB_TOKEN, fetchImpl),
  ]);
  return verifyCancelledRun(run, jobs, request);
}

function asString(value) {
  return value == null ? null : String(value);
}

function verifyOwnerSnapshot(snapshot) {
  const { identity, target, request, review, events, counts, offer, mapping } = snapshot;
  invariant(identity.current_user === "postgres" && identity.session_user === "postgres"
    && identity.read_only === "on" && !identity.safe_update,
  "CANCELLED_DISPATCH_CLOSEOUT_OWNER_IDENTITY_INVALID");
  invariant(Object.entries(PRODUCTION_TARGET).every(([key, value]) => target[key] === value),
    "CANCELLED_DISPATCH_CLOSEOUT_TARGET_INVALID");
  invariant(request?.status === "DISPATCHED" && request.last_checkpoint === "WORKFLOW_DISPATCH_CLAIMED",
    "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_STATE_INVALID");
  invariant(Number(request.database_writes) === 0
    && RUN_PATTERN.test(String(request.run_id || ""))
    && COMMIT_PATTERN.test(String(request.commit_sha || "")),
  "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_EVIDENCE_INVALID");
  invariant(!request.error_code && !request.error_message && !request.completed_at
    && !request.before_state_hash && !request.postflight_hash && !request.idempotency_result,
  "CANCELLED_DISPATCH_CLOSEOUT_LATER_CHECKPOINT_PRESENT");
  invariant(!request.executed_offer_ids && !request.failed_offer_ids && !request.remaining_offer_ids
    && !request.expected_deltas && !request.actual_deltas,
  "CANCELLED_DISPATCH_CLOSEOUT_EXECUTION_RESULT_PRESENT");
  invariant(review?.review_status === "APPROVED" && !review.execution_id
    && !review.execution_started_at && !review.execution_completed_at,
  "CANCELLED_DISPATCH_CLOSEOUT_REVIEW_STATE_INVALID");
  invariant(asString(request.review_id) === asString(review.id)
    && asString(request.retailer_id) === asString(review.retailer_id)
    && request.operation_type === review.operation_type
    && request.review_fingerprint === review.source_row_fingerprint
    && request.plan_fingerprint === review.plan_fingerprint,
  "CANCELLED_DISPATCH_CLOSEOUT_REVIEW_BINDING_DRIFT");
  invariant(events.length === 2,
    "CANCELLED_DISPATCH_CLOSEOUT_EVENT_SCOPE_INVALID");
  const created = events[0], claimed = events[1];
  invariant(created.previous_status == null && created.new_status === "QUEUED" && created.checkpoint === "REQUEST_CREATED",
    "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_CREATED_EVENT_INVALID");
  invariant(claimed.previous_status === "QUEUED" && claimed.new_status === "DISPATCHED"
    && claimed.checkpoint === "WORKFLOW_DISPATCH_CLAIMED"
    && String(claimed.evidence?.run_id || "") === String(request.run_id)
    && claimed.evidence?.commit_sha === request.commit_sha
    && Number(claimed.evidence?.database_writes) === 0,
  "CANCELLED_DISPATCH_CLOSEOUT_CLAIM_EVENT_INVALID");
  invariant(Number(snapshot.existingCloseoutCount) === 0,
    "CANCELLED_DISPATCH_CLOSEOUT_ALREADY_RECORDED");
  for (const [name, value] of Object.entries(counts)) {
    invariant(Number(value) === 0, `CANCELLED_DISPATCH_CLOSEOUT_${name.toUpperCase()}_PRESENT`);
  }
  assertBusinessBeforeState(review, request, offer.row, mapping.row);
  invariant(HASH_PATTERN.test(offer.row_hash) && HASH_PATTERN.test(mapping.row_hash),
    "CANCELLED_DISPATCH_CLOSEOUT_STATE_HASH_INVALID");
  return {
    request,
    review,
    claimCreatedAt: claimed.created_at,
    counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])),
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
  invariant(request, "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_NOT_FOUND");
  const review = await one("select * from public.product_match_review_queue where id=$1", [request.review_id]);
  invariant(review, "CANCELLED_DISPATCH_CLOSEOUT_REVIEW_NOT_FOUND");
  const events = await rows(`select id,previous_status,new_status,checkpoint,evidence,created_at
    from public.automation_review_execution_events
    where execution_request_id=$1::uuid order by id`, [requestId]);
  const claim = events.find((event) => event.checkpoint === "WORKFLOW_DISPATCH_CLAIMED");
  invariant(claim, "CANCELLED_DISPATCH_CLOSEOUT_CLAIM_EVENT_MISSING");
  const existingCloseoutCount = (await one(`select count(*)::integer count
    from public.automation_review_execution_events
    where execution_request_id=$1::uuid and checkpoint=$2`, [requestId, CLOSEOUT_CHECKPOINT])).count;
  const parents = await rows(`select id::text from public.retailer_catalogue_parent_plans
    where retailer_id=$1 and target_environment='PRODUCTION'
      and (created_by like $2 or audit_log::text like $3)`, [request.retailer_id, `github:${REPOSITORY}:${request.run_id}:%`, `%${request.run_id}%`]);
  const parentIds = parents.map((row) => row.id);
  const children = parentIds.length ? await rows(`select id::text from public.retailer_catalogue_child_plans
    where parent_plan_id=any($1::uuid[])`, [parentIds]) : [];
  const childIds = children.map((row) => row.id);
  const counts = {
    parent_plan_count: parentIds.length,
    child_plan_count: childIds.length,
    apply_run_count: parentIds.length ? (await one(`select count(*)::integer count
      from public.retailer_catalogue_apply_runs where parent_plan_id=any($1::uuid[])`, [parentIds])).count : 0,
    batch_approval_count: childIds.length ? (await one(`select count(*)::integer count
      from public.retailer_offer_sync_batch_approvals where child_plan_id=any($1::uuid[])`, [childIds])).count : 0,
    approved_import_plan_count: (await one(`select count(*)::integer count from public.approved_import_plans
      where run_id=$1 or plan_json::text like $2 or authorization_envelope::text like $2`, [String(request.run_id), `%${request.id}%`])).count,
    price_history_after_claim_count: (await one(`select count(*)::integer count from public.price_history
      where offer_id=$1 and checked_at >= $2::timestamptz`, [review.offer_id, claim.created_at])).count,
  };
  const offer = await one(`select to_jsonb(o) row,public.retailer_catalogue_sha256_json(to_jsonb(o)) row_hash
    from public.offers o where id=$1`, [review.before_state?.offer_id]);
  const mapping = await one(`select to_jsonb(rp) row,public.retailer_catalogue_sha256_json(to_jsonb(rp)) row_hash
    from public.retailer_products rp where id=$1`, [review.before_state?.retailer_product_id]);
  invariant(offer && mapping, "CANCELLED_DISPATCH_CLOSEOUT_BUSINESS_STATE_MISSING");
  return { identity, target, request, review, events, existingCloseoutCount, counts, offer, mapping };
}

async function readPostSnapshot(client, requestId, claimCreatedAt) {
  const one = async (sql, values = []) => (await client.query(sql, values)).rows[0];
  const request = await one("select * from public.automation_review_execution_requests where id=$1::uuid", [requestId]);
  invariant(request, "CANCELLED_DISPATCH_CLOSEOUT_POST_REQUEST_MISSING");
  const review = await one("select * from public.product_match_review_queue where id=$1", [request.review_id]);
  const events = (await client.query(`select previous_status,new_status,checkpoint,evidence
    from public.automation_review_execution_events
    where execution_request_id=$1::uuid and checkpoint=$2 order by id`, [requestId, CLOSEOUT_CHECKPOINT])).rows;
  const offer = await one(`select public.retailer_catalogue_sha256_json(to_jsonb(o)) row_hash
    from public.offers o where id=$1`, [review.offer_id]);
  const mapping = await one(`select public.retailer_catalogue_sha256_json(to_jsonb(rp)) row_hash
    from public.retailer_products rp where id=$1`, [review.retailer_product_id]);
  const priceHistoryAfterClaimCount = (await one(`select count(*)::integer count from public.price_history
    where offer_id=$1 and checked_at >= $2::timestamptz`, [review.offer_id, claimCreatedAt])).count;
  return { request, review, events, offer, mapping, priceHistoryAfterClaimCount };
}

function buildEvidence(verified, cancelledRun, env = process.env, now = new Date()) {
  return {
    kind: CLOSEOUT_KIND,
    execution_request_id: String(verified.request.id),
    review_id: String(verified.review.id),
    retailer_id: String(verified.request.retailer_id),
    retailer_slug: verified.request.retailer_slug,
    offer_id: String(verified.review.offer_id),
    original_run_id: cancelledRun.runId,
    original_run_url: cancelledRun.runUrl,
    original_commit_sha: verified.request.commit_sha,
    original_run_conclusion: "cancelled",
    workflow_name: cancelledRun.workflowName,
    workflow_path: cancelledRun.workflowPath,
    job_id: cancelledRun.jobId,
    job_url: cancelledRun.jobUrl,
    execution_step: EXECUTION_STEP,
    execution_step_started_at: cancelledRun.executionStartedAt,
    execution_step_cancelled_at: cancelledRun.executionCompletedAt,
    closeout_run_id: String(env.GITHUB_RUN_ID),
    closeout_commit_sha: env.GITHUB_SHA,
    database_writes: 0,
    business_writes: 0,
    ...verified.counts,
    before_state_offer_hash: verified.offerHash,
    before_state_mapping_hash: verified.mappingHash,
    error_code: ERROR_CODE,
    error_message: ERROR_MESSAGE,
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

    invariant(String(env.GITHUB_RUN_ID) !== String(verified.request.run_id),
      "CANCELLED_DISPATCH_CLOSEOUT_SELF_REFERENCE_FORBIDDEN");
    const cancelledRun = dependencies.readCancelledRun
      ? await dependencies.readCancelledRun(verified.request, env)
      : await readCancelledRun(verified.request, env, dependencies.fetchImpl || fetch);
    evidence = buildEvidence(verified, cancelledRun, env, dependencies.now || new Date());
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
      && result.data.error_code === ERROR_CODE
      && Number(result.data.database_writes) === 0,
    "CANCELLED_DISPATCH_CLOSEOUT_CHECKPOINT_FAILED");
    checkpointResult = result.data;

    await pg.query("begin read only");
    post = dependencies.readPostSnapshot
      ? await dependencies.readPostSnapshot(pg, options.executionRequestId, verified.claimCreatedAt)
      : await readPostSnapshot(pg, options.executionRequestId, verified.claimCreatedAt);
    invariant(post.request?.status === "FAILED"
      && post.request.last_checkpoint === CLOSEOUT_CHECKPOINT
      && post.request.error_code === ERROR_CODE
      && post.request.error_message === ERROR_MESSAGE
      && Number(post.request.database_writes) === 0
      && post.request.completed_at,
    "CANCELLED_DISPATCH_CLOSEOUT_REQUEST_READBACK_FAILED");
    invariant(post.review?.review_status === "APPROVED"
      && !post.review.execution_id && !post.review.execution_started_at && !post.review.execution_completed_at,
    "CANCELLED_DISPATCH_CLOSEOUT_REVIEW_CHANGED");
    invariant(post.events.length === 1
      && post.events[0].previous_status === "DISPATCHED"
      && post.events[0].new_status === "FAILED"
      && canonicalJson(post.events[0].evidence) === canonicalJson(evidence),
    "CANCELLED_DISPATCH_CLOSEOUT_EVENT_READBACK_FAILED");
    invariant(post.offer?.row_hash === verified.offerHash
      && post.mapping?.row_hash === verified.mappingHash
      && Number(post.priceHistoryAfterClaimCount) === 0,
    "CANCELLED_DISPATCH_CLOSEOUT_BUSINESS_STATE_CHANGED");
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
    request_status: checkpointResult.status,
    review_status: post.review.review_status,
    checkpoint: checkpointResult.last_checkpoint,
    catalogue_writes: 0,
    ...evidence,
  };
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const output = path.join(OUTPUT_DIRECTORY, `${options.executionRequestId}-cancelled-dispatch-closeout.json`);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify({
      result: report.result,
      execution_request_id: report.execution_request_id,
      review_id: report.review_id,
      request_status: report.request_status,
      review_status: report.review_status,
      checkpoint: report.checkpoint,
      business_writes: report.business_writes,
    })))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  CLOSEOUT_CHECKPOINT,
  CLOSEOUT_KIND,
  ERROR_CODE,
  ERROR_MESSAGE,
  assertContext,
  buildEvidence,
  githubJson,
  parseArgs,
  readCancelledRun,
  readOwnerSnapshot,
  readPostSnapshot,
  run,
  verifyCancelledRun,
  verifyOwnerSnapshot,
};
