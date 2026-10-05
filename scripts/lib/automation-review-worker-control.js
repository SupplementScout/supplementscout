const { createClient } = require("@supabase/supabase-js");
const { canonicalTimestamp } = require("./canonical-timestamp");

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}

function controlClient(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function checkpoint(client, requestId, status, name, evidence = {}, env = process.env) {
  const { data, error } = await client.rpc("record_automation_review_execution_checkpoint", {
    p_execution_request_id: requestId,
    p_actor: `github-actions:${env.GITHUB_ACTOR || "unknown"}`,
    p_new_status: status,
    p_checkpoint: name,
    p_evidence: evidence,
  });
  invariant(!error && data, "EXECUTION_CHECKPOINT_FAILED");
  return data;
}

async function claimDispatched(client, request, options, env = process.env) {
  if (request.status === "DISPATCHED") return request;
  invariant(request.status === "QUEUED", "EXECUTION_REQUEST_BINDING_DRIFT");
  return checkpoint(client, options.executionRequestId, "DISPATCHED", "WORKFLOW_DISPATCH_CLAIMED", {
    run_id: String(env.GITHUB_RUN_ID),
    run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    commit_sha: env.GITHUB_SHA,
    database_writes: 0,
  }, env);
}

async function loadControlState(client, options, contract, env = process.env) {
  const [{ data: review, error: reviewError }, { data: request, error: requestError }, { data: events, error: eventsError }] = await Promise.all([
    client.from("product_match_review_queue").select("*").eq("id", options.reviewItemId).maybeSingle(),
    client.from("automation_review_execution_requests").select("*").eq("id", options.executionRequestId).maybeSingle(),
    client.from("product_match_review_events").select("event_type,actor,previous_status,new_status,source_row_fingerprint,plan_fingerprint,created_at").eq("review_id", options.reviewItemId).order("created_at", { ascending: false }),
  ]);
  invariant(!reviewError && review, "REVIEW_ITEM_NOT_FOUND");
  invariant(!requestError && request, "EXECUTION_REQUEST_NOT_FOUND");
  invariant(!eventsError && events, "APPROVAL_AUDIT_READ_FAILED");
  invariant(String(request.review_id) === options.reviewItemId
    && request.review_fingerprint === options.reviewFingerprint
    && request.idempotency_key === options.executionIdempotencyKey
    && request.retailer_slug === options.retailer
    && request.execution_mode === options.mode,
  "EXECUTION_REQUEST_BINDING_DRIFT");
  invariant(request.plan_fingerprint === options.reviewPlanFingerprint
    && String(request.retailer_id) === String(contract.retailerId)
    && request.workflow_name === contract.workflowName
    && request.environment_name === contract.environment,
  "EXECUTION_REQUEST_BINDING_DRIFT");
  invariant(review.review_status === "APPROVED"
    && review.source_row_fingerprint === options.reviewFingerprint
    && review.plan_fingerprint === options.reviewPlanFingerprint
    && contract.operations.has(review.operation_type)
    && String(review.retailer_id) === String(contract.retailerId)
    && options.retailer === contract.retailerSlug,
  "REVIEW_BINDING_DRIFT");
  invariant(review.expires_at && Date.parse(review.expires_at) > Date.now(), "REVIEW_EVIDENCE_EXPIRED");
  invariant(review.decision_actor && review.decision_at
    && events.some((event) => event.previous_status === "PENDING" && event.new_status === "APPROVED"
      && event.actor === review.decision_actor
      && event.source_row_fingerprint === review.source_row_fingerprint
      && event.plan_fingerprint === review.plan_fingerprint),
  "APPROVAL_AUDIT_MISSING");
  let canonicalCapture = null;
  try { canonicalCapture = canonicalTimestamp(review.source_captured_at, "source_captured_at"); } catch {}
  invariant(review.plan_fingerprint && review.before_state && review.proposed_state && canonicalCapture, "REVIEW_PLAN_EVIDENCE_MISSING");
  invariant(request.operation_type === review.operation_type, "EXECUTION_REQUEST_BINDING_DRIFT");
  const claimedRequest = await claimDispatched(client, request, options, env);
  return { review, request: claimedRequest };
}

module.exports = { checkpoint, claimDispatched, controlClient, invariant, loadControlState };
