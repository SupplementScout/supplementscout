const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson, normalizeDecimalString } = require("./lib/canonical-json");
const { canonicalTimestamp, canonicalizeTimestamps } = require("./lib/canonical-timestamp");
const { buildSemanticSourceRows, canonicalHash } = require("./lib/ebay-artifact-bound-contract");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { executePlan } = require("./ebay-offer-canary-executor");
const { SCOPES, actionForPlan, buildSource, classifyContinuity, prepareScope } = require("./ebay-offer-refresh");
const { run: runPostflight } = require("./retailer-offer-refresh-postflight");
const { checkpoint, claimDispatched, controlClient, loadControlState: loadBoundControlState } = require("./lib/automation-review-worker-control");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "automation-review-execution");
const WORKER_KIND = "automation-review-ebay-single-offer-v2";
const ALLOWED_OPERATIONS = new Set(["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK"]);

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}
function hash(value) { return crypto.createHash("sha256").update(canonicalJson(canonicalizeTimestamps(JSON.parse(JSON.stringify(value))))).digest("hex"); }
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
  invariant(env.GITHUB_ACTIONS === "true" && ["workflow_dispatch", "schedule"].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout", "WORKER_CONTEXT_INVALID");
  invariant(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL, "WORKER_CONTROL_CREDENTIAL_MISSING");
  invariant(env.EBAY_CANARY_APPROVER_DATABASE_URL && env.EBAY_CANARY_EXECUTOR_DATABASE_URL && env.EBAY_REFRESH_VALIDATOR_DATABASE_URL, "WORKER_ROLE_CREDENTIAL_MISSING");
}
async function loadControlState(client, options, env = process.env) {
  return loadBoundControlState(client, options, { retailerId: "12", retailerSlug: "ebay-uk", operations: ALLOWED_OPERATIONS, workflowName: "automation-review-queue-worker.yml", environment: "production-readonly" }, env);
}
function executionEvidence(review, approved, postflight, idempotency, baseline) {
  const plan = approved.entry.resolved_plan;
  return {
    run_id: String(process.env.GITHUB_RUN_ID), run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    commit_sha: process.env.GITHUB_SHA, manifest_sha256: approved.loaded.artifactSha256, before_state_hash: hash(review.before_state), postflight_hash: postflight.postflight_hash,
    executed_offer_ids: [String(review.offer_id)], failed_offer_ids: [], remaining_offer_ids: [], expected_deltas: plan.expected_deltas || { price_history: 0 },
    actual_deltas: { freshness: postflight.freshness_change_count, price: postflight.price_change_count, stock: postflight.stock_change_count, shipping: postflight.shipping_change_count, total: postflight.total_change_count, offer_url: postflight.offer_url_change_count, mapping_url: postflight.mapping_url_change_count },
    price_history_delta: postflight.price_history_delta, database_writes: 1, idempotency_result: idempotency,
    baseline_hash: baseline.evidence_hash, source_fingerprint: review.source_row_fingerprint,
    full_capture_fingerprint: review.source_row_fingerprint, executable_source_fingerprint: review.source_row_fingerprint,
    review_scope_fingerprint: hash([]), source_row_fingerprints: [{ offer_id: String(review.offer_id), semantic_fingerprint: review.source_row_fingerprint, scope: "EXECUTABLE" }],
    executable_offer_ids: [String(review.offer_id)], review_offer_ids: [], plan_fingerprint: approved.entry.plan_fingerprint,
  };
}
function expectedDeltas(plan) {
  const before = plan.expected_state.offer, after = plan.offer.values;
  const changed = (left, right) => Number(left) !== Number(right);
  const price = changed(before.price, after.price), stock = before.in_stock !== after.in_stock;
  const shipping = changed(before.shipping_cost, after.shipping_cost), total = changed(before.total_price, after.total_price);
  return {
    logical_field_deltas: {
      offer_price_updates: Number(price), offer_stock_updates: Number(stock), offer_shipping_updates: Number(shipping),
      offer_total_updates: Number(total), offer_url_updates: Number(before.url !== after.url), mapping_url_updates: 0, last_checked_at_updates: 1,
    },
    row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: Number(price) },
  };
}
function assertDatabaseBeforeState(databaseOffer, expectedOffer) {
  invariant(databaseOffer, "DATABASE_BASELINE_MISSING");
  for (const field of ["price", "shipping_cost", "total_price"]) invariant(normalizeDecimalString(databaseOffer[field], field) === normalizeDecimalString(expectedOffer[field], field), `DATABASE_BEFORE_STATE_DRIFT_${field.toUpperCase()}`);
  for (const field of ["in_stock", "url"]) invariant(canonicalJson(databaseOffer[field]) === canonicalJson(expectedOffer[field]), `DATABASE_BEFORE_STATE_DRIFT_${field.toUpperCase()}`);
  invariant(canonicalTimestamp(databaseOffer.last_checked_at, "database.last_checked_at") === canonicalTimestamp(expectedOffer.last_checked_at, "plan.last_checked_at"), "DATABASE_BEFORE_STATE_DRIFT_LAST_CHECKED_AT");
}
function assertCommercialEvidence(review, plan, evaluation) {
  const evidence = review.source_evidence || {};
  for (const field of ["workflow_run_id", "artifact_id", "artifact_digest", "contract_sha256", "report_sha256", "artifact_content_sha256", "source_fingerprint", "review_scope_fingerprint"]) invariant(evidence[field], "COMMERCIAL_SOURCE_EVIDENCE_MISSING");
  invariant(review.review_kind === "COMMERCIAL_CHANGE", "COMMERCIAL_REVIEW_KIND_INVALID");
  invariant(String(review.source_price) === Number(plan.offer.values.price).toFixed(2), "APPROVED_PRICE_DRIFT");
  const semantic = buildSemanticSourceRows([SCOPES.find((scope) => scope.offer_id === String(review.offer_id))], [evaluation])[0];
  invariant(canonicalHash(semantic) === review.source_row_fingerprint, "SOURCE_FINGERPRINT_DRIFT");
}
async function executeWithSeparatedCredentials(executor, approved, kind, env = process.env) {
  const controlCredential = env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(controlCredential, "WORKER_CONTROL_CREDENTIAL_MISSING");
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    return await executor(approved, kind);
  } finally {
    env.SUPABASE_SERVICE_ROLE_KEY = controlCredential;
  }
}
async function run(options, dependencies = {}) {
  assertContext(dependencies.env || process.env);
  fs.mkdirSync(OUT, { recursive: true });
  const client = dependencies.client || controlClient(dependencies.env || process.env);
  let state, databaseWrites = 0;
  try {
    state = await loadControlState(client, options, dependencies.env || process.env);
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
    const operation = actionForPlan(plan);
    invariant(operation === state.review.operation_type, "OPERATION_REVALIDATION_FAILED");
    if (operation === "VERIFY_NO_CHANGE") {
      invariant(plan.offer.action === "verify_no_change" && plan.price_history.action === "noop", "OPERATION_REVALIDATION_FAILED");
      invariant(approved.entry.source_row_fingerprint === state.review.source_row_fingerprint, "SOURCE_FINGERPRINT_DRIFT");
      invariant(approved.entry.plan_fingerprint === state.review.plan_fingerprint, "PLAN_FINGERPRINT_DRIFT");
      invariant(hash(plan.expected_state) === hash(state.review.before_state), "DATABASE_BEFORE_STATE_DRIFT");
      invariant(hash(plan.offer.values) === hash(state.review.proposed_state.offer || state.review.proposed_state), "PROPOSED_STATE_DRIFT");
    } else assertCommercialEvidence(state.review, plan, evaluation);

    const baselinePath = path.join(OUT, `${options.executionRequestId}-baseline.json`), executionPath = path.join(OUT, `${options.executionRequestId}-execution.json`), postflightPath = path.join(OUT, `${options.executionRequestId}-postflight.json`);
    const baseline = await (dependencies.runPostflight || runPostflight)({ profile: "ebay-uk", mode: "baseline", baseline: null, execution: null, output: baselinePath }, dependencies);
    const baselineOffer = baseline.snapshot.rows.find((row) => String(row.offer_id) === scope.offer_id);
    assertDatabaseBeforeState(baselineOffer, plan.expected_state.offer);
    await checkpoint(client, options.executionRequestId, "EXECUTING", "REVALIDATION_PASSED", { run_id: String(process.env.GITHUB_RUN_ID), run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, commit_sha: process.env.GITHUB_SHA, before_state_hash: baseline.evidence_hash });
    const applied = await executeWithSeparatedCredentials(dependencies.executePlan || executePlan, approved, WORKER_KIND, dependencies.env || process.env);
    databaseWrites = 1;
    invariant(String(applied?.offer_id) === scope.offer_id && (operation === "UPDATE_PRICE" ? applied?.price_history_id != null : applied?.price_history_id == null), "APPLY_RESULT_SCOPE_DRIFT");
    const reviewRows = SCOPES.filter((candidate) => candidate.offer_id !== scope.offer_id).map((candidate) => ({ offer_id: candidate.offer_id, review_type: "NOT_SELECTED_BY_EXECUTION_REQUEST" }));
    const execution = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 1, executed_plan_count: 1, review_row_count: 236, blocked_row_count: 0, execution_offer_ids: [scope.offer_id], review_rows: reviewRows, full_capture_fingerprint: state.review.source_row_fingerprint, executable_source_fingerprint: state.review.source_row_fingerprint, review_scope_fingerprint: hash(reviewRows), source_row_fingerprints: [{ offer_id: scope.offer_id, semantic_fingerprint: state.review.source_row_fingerprint, scope: "EXECUTABLE" }], expected_deltas: expectedDeltas(plan) };
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
module.exports = { WORKER_KIND, assertCommercialEvidence, assertContext, assertDatabaseBeforeState, executeWithSeparatedCredentials, executionEvidence, expectedDeltas, hash, loadControlState, parseArgs, run, claimDispatched };
