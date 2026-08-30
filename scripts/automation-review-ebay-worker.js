const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { executePlan } = require("./ebay-offer-canary-executor");
const { SCOPES, actionForPlan, buildSource, classifyContinuity, prepareScope } = require("./ebay-offer-refresh");
const { run: runPostflight } = require("./retailer-offer-refresh-postflight");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "automation-review-execution");
const WORKER_KIND = "automation-review-ebay-verify-no-change-v1";

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}
function hash(value) { return crypto.createHash("sha256").update(canonicalJson(JSON.parse(JSON.stringify(value)))).digest("hex"); }
function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(review-item-id|execution-request-id|retailer|review-fingerprint|review-plan-fingerprint|execution-idempotency-key|mode)=(.*)$/);
    invariant(match && values[match[1]] === undefined, "WORKER_ARGUMENT_INVALID"); values[match[1]] = match[2];
  }
  invariant(/^[1-9]\d*$/.test(values["review-item-id"] || ""), "REVIEW_ITEM_ID_INVALID");
  invariant(/^[0-9a-f-]{36}$/.test(values["execution-request-id"] || ""), "EXECUTION_REQUEST_ID_INVALID");
  invariant(values.retailer === "ebay-uk", "RETAILER_BINDING_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["review-fingerprint"] || ""), "REVIEW_FINGERPRINT_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["review-plan-fingerprint"] || ""), "REVIEW_PLAN_FINGERPRINT_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["execution-idempotency-key"] || ""), "EXECUTION_IDEMPOTENCY_KEY_INVALID");
  invariant(values.mode === "review-queue", "WORKER_MODE_INVALID");
  return { reviewItemId: values["review-item-id"], executionRequestId: values["execution-request-id"], retailer: values.retailer, reviewFingerprint: values["review-fingerprint"], reviewPlanFingerprint: values["review-plan-fingerprint"], executionIdempotencyKey: values["execution-idempotency-key"], mode: values.mode };
}
function assertContext(env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true" && env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout", "WORKER_CONTEXT_INVALID");
  invariant(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL, "WORKER_CONTROL_CREDENTIAL_MISSING");
  invariant(env.EBAY_CANARY_APPROVER_DATABASE_URL && env.EBAY_CANARY_EXECUTOR_DATABASE_URL && env.EBAY_REFRESH_VALIDATOR_DATABASE_URL, "WORKER_ROLE_CREDENTIAL_MISSING");
}
function controlClient(env = process.env) { return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function checkpoint(client, requestId, status, name, evidence = {}) {
  const { data, error } = await client.rpc("record_automation_review_execution_checkpoint", { p_execution_request_id: requestId, p_actor: `github-actions:${process.env.GITHUB_ACTOR || "unknown"}`, p_new_status: status, p_checkpoint: name, p_evidence: evidence });
  invariant(!error && data, "EXECUTION_CHECKPOINT_FAILED"); return data;
}
async function loadControlState(client, options) {
  const [{ data: review, error: reviewError }, { data: request, error: requestError }, { data: events, error: eventsError }] = await Promise.all([
    client.from("product_match_review_queue").select("*").eq("id", options.reviewItemId).maybeSingle(),
    client.from("automation_review_execution_requests").select("*").eq("id", options.executionRequestId).maybeSingle(),
    client.from("product_match_review_events").select("event_type,actor,new_status,source_row_fingerprint,plan_fingerprint,created_at").eq("review_id", options.reviewItemId).order("created_at", { ascending: false }),
  ]);
  invariant(!reviewError && review, "REVIEW_ITEM_NOT_FOUND"); invariant(!requestError && request, "EXECUTION_REQUEST_NOT_FOUND"); invariant(!eventsError && events, "APPROVAL_AUDIT_READ_FAILED");
  invariant(request.status === "DISPATCHED" && String(request.review_id) === options.reviewItemId && request.review_fingerprint === options.reviewFingerprint && request.idempotency_key === options.executionIdempotencyKey && request.retailer_slug === options.retailer && request.execution_mode === options.mode, "EXECUTION_REQUEST_BINDING_DRIFT");
  invariant(review.review_status === "APPROVED" && review.source_row_fingerprint === options.reviewFingerprint && review.plan_fingerprint === options.reviewPlanFingerprint && review.operation_type === "VERIFY_NO_CHANGE" && String(review.retailer_id) === "12", "REVIEW_BINDING_DRIFT");
  invariant(review.expires_at && Date.parse(review.expires_at) > Date.now(), "REVIEW_EVIDENCE_EXPIRED");
  invariant(review.decision_actor && review.decision_at && events.some((event) => event.new_status === "APPROVED" && event.actor === review.decision_actor && event.source_row_fingerprint === review.source_row_fingerprint && event.plan_fingerprint === review.plan_fingerprint), "APPROVAL_AUDIT_MISSING");
  invariant(review.plan_fingerprint && review.before_state && review.proposed_state && review.source_captured_at && new Date(review.source_captured_at).toISOString() === review.source_captured_at, "REVIEW_PLAN_EVIDENCE_MISSING");
  return { review, request };
}
function executionEvidence(review, approved, postflight, idempotency, baseline) {
  const plan = approved.entry.resolved_plan;
  return {
    run_id: String(process.env.GITHUB_RUN_ID), run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    commit_sha: process.env.GITHUB_SHA, manifest_sha256: approved.loaded.artifactSha256, before_state_hash: hash(review.before_state), postflight_hash: postflight.postflight_hash,
    executed_offer_ids: [String(review.offer_id)], failed_offer_ids: [], remaining_offer_ids: [], expected_deltas: plan.expected_deltas || { price_history: 0 },
    actual_deltas: { freshness: postflight.freshness_change_count, price: postflight.price_change_count, stock: postflight.stock_change_count, shipping: postflight.shipping_change_count, total: postflight.total_change_count, offer_url: postflight.offer_url_change_count, mapping_url: postflight.mapping_url_change_count },
    price_history_delta: postflight.price_history_delta, database_writes: 1, idempotency_result: idempotency,
    baseline_hash: baseline.evidence_hash, source_fingerprint: review.source_row_fingerprint, plan_fingerprint: approved.entry.plan_fingerprint,
  };
}
async function run(options, dependencies = {}) {
  assertContext(dependencies.env || process.env);
  fs.mkdirSync(OUT, { recursive: true });
  const client = dependencies.client || controlClient(dependencies.env || process.env);
  let state, databaseWrites = 0;
  try {
    state = await loadControlState(client, options);
    const scope = SCOPES.find((candidate) => candidate.offer_id === String(state.review.offer_id));
    invariant(scope, "OFFER_OUTSIDE_EBAY_SCOPE"); invariant(scope.offer_id !== "2686", "OFFER_2686_FORBIDDEN");
    const config = dependencies.config || assertConfig(dependencies.env || process.env);
    const token = dependencies.token || await getApplicationToken(config, dependencies.fetchImpl || fetch);
    const evaluation = dependencies.evaluation || await buildSource(scope, config, dependencies.fetchImpl || fetch, token);
    evaluation.continuity = evaluation.continuity || classifyContinuity(scope, evaluation);
    invariant(evaluation.continuity.eligible, "SOURCE_IDENTITY_REVALIDATION_FAILED");
    const freshCaptureAt = new Date().toISOString();
    const prepared = await prepareScope(scope, evaluation, "dry-run", dependencies, new Date().toISOString().replace(/[:.]/g, "-"), state.review.source_captured_at);
    invariant(prepared.approved, "PROTECTED_PLAN_NOT_EXECUTABLE");
    const approved = prepared.approved, plan = approved.entry.resolved_plan;
    invariant(actionForPlan(plan) === "VERIFY_NO_CHANGE" && plan.offer.action === "verify_no_change" && plan.price_history.action === "noop", "OPERATION_REVALIDATION_FAILED");
    invariant(approved.entry.source_row_fingerprint === state.review.source_row_fingerprint, "SOURCE_FINGERPRINT_DRIFT");
    invariant(approved.entry.plan_fingerprint === state.review.plan_fingerprint, "PLAN_FINGERPRINT_DRIFT");
    invariant(hash(plan.expected_state) === hash(state.review.before_state), "DATABASE_BEFORE_STATE_DRIFT");
    invariant(hash(plan.offer.values) === hash(state.review.proposed_state.offer || state.review.proposed_state), "PROPOSED_STATE_DRIFT");

    const baselinePath = path.join(OUT, `${options.executionRequestId}-baseline.json`), executionPath = path.join(OUT, `${options.executionRequestId}-execution.json`), postflightPath = path.join(OUT, `${options.executionRequestId}-postflight.json`);
    const baseline = await (dependencies.runPostflight || runPostflight)({ profile: "ebay-uk", mode: "baseline", baseline: null, execution: null, output: baselinePath }, dependencies);
    await checkpoint(client, options.executionRequestId, "EXECUTING", "REVALIDATION_PASSED", { run_id: String(process.env.GITHUB_RUN_ID), run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, commit_sha: process.env.GITHUB_SHA, before_state_hash: baseline.evidence_hash });
    const applied = await (dependencies.executePlan || executePlan)(approved, WORKER_KIND);
    databaseWrites = 1;
    invariant(String(applied?.offer_id) === scope.offer_id && applied?.price_history_id == null, "APPLY_RESULT_SCOPE_DRIFT");
    const reviewRows = SCOPES.filter((candidate) => candidate.offer_id !== scope.offer_id).map((candidate) => ({ offer_id: candidate.offer_id, review_type: "NOT_SELECTED_BY_EXECUTION_REQUEST" }));
    const execution = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 1, executed_plan_count: 1, review_row_count: 236, blocked_row_count: 0, execution_offer_ids: [scope.offer_id], review_rows: reviewRows, expected_deltas: { logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: 1 }, row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 } } };
    fs.writeFileSync(executionPath, `${JSON.stringify(execution, null, 2)}\n`);
    const postflight = await (dependencies.runPostflight || runPostflight)({ profile: "ebay-uk", mode: "postflight", baseline: baselinePath, execution: executionPath, output: postflightPath }, dependencies);
    const fresh = dependencies.idempotencyPrepared || await prepareScope(scope, dependencies.idempotencyEvaluation || await buildSource(scope, config, dependencies.fetchImpl || fetch, token), "dry-run", dependencies, `${Date.now()}-idempotency`);
    invariant(fresh.approved && actionForPlan(fresh.approved.entry.resolved_plan) === "VERIFY_NO_CHANGE", "IDEMPOTENCY_FAILED");
    const evidence = { ...executionEvidence(state.review, approved, postflight, "PASS", baseline), fresh_capture_at: freshCaptureAt };
    await checkpoint(client, options.executionRequestId, "EXECUTED", "IDEMPOTENCY_PASSED", evidence);
    const report = { schema_version: 1, kind: WORKER_KIND, result: "PASS", execution_request_id: options.executionRequestId, review_item_ids: [options.reviewItemId], retailer: options.retailer, ...evidence };
    fs.writeFileSync(path.join(OUT, `${options.executionRequestId}-result.json`), `${JSON.stringify(report, null, 2)}\n`); return report;
  } catch (error) {
    const code = error.code || error.message || "REVIEW_EXECUTION_FAILED";
    const revalidation = /(?:DRIFT|EXPIRED|REVALIDATION|BINDING|EVIDENCE|OUTSIDE|FORBIDDEN)/.test(code);
    try { await checkpoint(client, options.executionRequestId, revalidation ? "EXPIRED" : "FAILED", revalidation ? "FAILED_REVALIDATION" : "EXECUTION_FAILED", { error_code: code, error_message: error.message, run_id: String(process.env.GITHUB_RUN_ID || ""), commit_sha: process.env.GITHUB_SHA || null, database_writes: databaseWrites }); } catch {}
    throw error;
  }
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { WORKER_KIND, assertContext, executionEvidence, hash, loadControlState, parseArgs, run };
