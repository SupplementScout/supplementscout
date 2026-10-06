const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson, normalizeDecimalString } = require("./lib/canonical-json");
const { checkpoint, controlClient, invariant, loadControlState } = require("./lib/automation-review-worker-control");
const { adaptersForWorkerKind } = require("./lib/automation-review-adapter-registry");
const { prepareAutomationReviewDecision, prepareAutomationReviewIdempotencyTransition } = require("./lib/retailer-offer-sync/automation-review-decision");
const { run: runPostflight } = require("./retailer-offer-refresh-postflight");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "automation-review-execution");
const WORKER_KIND = "automation-review-shared-retailer-single-decision-v1";
const ADAPTERS = Object.freeze(Object.fromEntries(adaptersForWorkerKind("shared-retailer").map((registered) => [
  registered.retailerSlug,
  Object.freeze({
    retailerId: registered.retailerId,
    retailerSlug: registered.retailerSlug,
    engineModule: registered.sharedEngine.engineModule,
    profile: registered.sharedEngine.postflightProfile,
    refreshProfile: registered.sharedEngine.profile,
    operations: registered.operationSet,
    expectedExecutionRows: registered.sharedEngine.expectedExecutionRows,
    expectedCommercialChanges: registered.sharedEngine.expectedCommercialChanges,
    freshnessConfirmationCount: registered.sharedEngine.freshnessConfirmationCount,
    rolePrefix: registered.sharedEngine.rolePrefix,
    workflowName: registered.workflow,
    environment: registered.environment,
  }),
])));

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(review-item-id|execution-request-id|retailer|review-fingerprint|review-plan-fingerprint|execution-idempotency-key|mode)=(.*)$/);
    invariant(match && values[match[1]] === undefined, "WORKER_ARGUMENT_INVALID");
    values[match[1]] = match[2];
  }
  invariant(/^[1-9]\d*$/.test(values["review-item-id"] || ""), "REVIEW_ITEM_ID_INVALID");
  invariant(/^[0-9a-f-]{36}$/.test(values["execution-request-id"] || ""), "EXECUTION_REQUEST_ID_INVALID");
  invariant(Boolean(ADAPTERS[values.retailer]), "RETAILER_BINDING_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["review-fingerprint"] || ""), "REVIEW_FINGERPRINT_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["review-plan-fingerprint"] || ""), "REVIEW_PLAN_FINGERPRINT_INVALID");
  invariant(/^[0-9a-f]{64}$/.test(values["execution-idempotency-key"] || ""), "EXECUTION_IDEMPOTENCY_KEY_INVALID");
  invariant(values.mode === "review-queue", "WORKER_MODE_INVALID");
  return { reviewItemId: values["review-item-id"], executionRequestId: values["execution-request-id"], retailer: values.retailer, reviewFingerprint: values["review-fingerprint"], reviewPlanFingerprint: values["review-plan-fingerprint"], executionIdempotencyKey: values["execution-idempotency-key"], mode: values.mode };
}

function assertContext(adapter, env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true" && ["workflow_dispatch", "schedule"].includes(env.GITHUB_EVENT_NAME)
    && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout", "WORKER_CONTEXT_INVALID");
  invariant(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL, "WORKER_CONTROL_CREDENTIAL_MISSING");
  for (const role of ["VALIDATOR", "APPROVER", "EXECUTOR"]) invariant(env[`${adapter.rolePrefix}_${role}_DATABASE_URL`], "WORKER_ROLE_CREDENTIAL_MISSING");
}

function decimalEqual(left, right, field) {
  return normalizeDecimalString(left, field) === normalizeDecimalString(right, field);
}
function same(left, right) { return canonicalJson(left ?? null) === canonicalJson(right ?? null); }

function assertReviewBeforeState(record, review) {
  const before = review.before_state;
  invariant(String(record.offer.id) === String(review.offer_id) && String(record.mapping.id) === String(review.retailer_product_id), "DATABASE_BEFORE_STATE_DRIFT_IDENTITY");
  invariant(String(record.product.id) === String(before.product_id) && String(record.variant.id) === String(before.product_variant_id), "DATABASE_BEFORE_STATE_DRIFT_CANONICAL_IDENTITY");
  invariant(String(record.mapping.external_product_id) === String(before.external_product_id) && String(record.mapping.external_variant_id) === String(before.external_variant_id), "DATABASE_BEFORE_STATE_DRIFT_SOURCE_IDENTITY");
  for (const field of ["price", "shipping_cost", "total_price"]) invariant(decimalEqual(record.offer[field], before[field], field), `DATABASE_BEFORE_STATE_DRIFT_${field.toUpperCase()}`);
  invariant(record.offer.in_stock === before.in_stock && same(record.offer.url, before.url) && same(record.mapping.external_url, before.external_url), "DATABASE_BEFORE_STATE_DRIFT_COMMERCIAL");
}

function assertBaselineBeforeState(row, review) {
  const before = review.before_state;
  invariant(row && String(row.offer_id) === String(review.offer_id) && String(row.mapping_id) === String(review.retailer_product_id), "DATABASE_BASELINE_DRIFT_IDENTITY");
  invariant(String(row.offer_product_id) === String(before.product_id) && String(row.offer_variant_id) === String(before.product_variant_id), "DATABASE_BASELINE_DRIFT_CANONICAL_IDENTITY");
  invariant(String(row.external_product_id) === String(before.external_product_id) && String(row.external_variant_id) === String(before.external_variant_id), "DATABASE_BASELINE_DRIFT_SOURCE_IDENTITY");
  for (const field of ["price", "shipping_cost", "total_price"]) invariant(decimalEqual(row[field], before[field], field), `DATABASE_BASELINE_DRIFT_${field.toUpperCase()}`);
  invariant(row.in_stock === before.in_stock && same(row.url, before.url) && same(row.external_url, before.external_url), "DATABASE_BASELINE_DRIFT_COMMERCIAL");
}

function assertPreparedDecision(run, review, adapter) {
  const rows = run.artifacts.flatMap((artifact) => artifact.rows);
  const changed = rows.filter((row) => row.action !== "VERIFY_NO_CHANGE");
  invariant(rows.length === adapter.expectedExecutionRows && changed.length === adapter.expectedCommercialChanges, "PROTECTED_PLAN_SCOPE_DRIFT");
  invariant(changed.length === 1 && String(changed[0].offer_id) === String(review.offer_id) && changed[0].action === review.operation_type, "PROTECTED_PLAN_DECISION_DRIFT");
  const row = changed[0], before = review.before_state, proposed = review.proposed_state;
  invariant(String(row.retailer_product_id) === String(before.retailer_product_id)
    && String(row.external_product_id) === String(before.external_product_id)
    && String(row.external_variant_id) === String(before.external_variant_id), "PROTECTED_PLAN_IDENTITY_DRIFT");
  const plannedBefore = row.atomic_plan?.expected_state?.offer;
  const plannedAfter = row.atomic_plan?.offer?.values;
  invariant(plannedBefore && plannedAfter && row.atomic_plan.offer.action === "update", "PROTECTED_PLAN_ATOMIC_CONTRACT_INVALID");
  invariant(plannedBefore.in_stock === before.in_stock && plannedAfter.in_stock === proposed.in_stock
    && decimalEqual(plannedBefore.price, before.price, "price") && decimalEqual(plannedAfter.price, proposed.price, "price"), "PROTECTED_PLAN_COMMERCIAL_DRIFT");
  invariant(before.in_stock !== proposed.in_stock
    && ["price", "shipping_cost", "total_price", "url", "external_url", "external_product_id", "external_variant_id", "product_id", "product_variant_id", "retailer_product_id", "offer_id"].every((field) => same(before[field], proposed[field])), "APPROVED_DECISION_NOT_STOCK_ONLY");
  invariant(rows.filter((candidate) => candidate.action === "VERIFY_NO_CHANGE").every((candidate) => !candidate.changed_fields?.price && !candidate.changed_fields?.stock && !candidate.changed_fields?.url), "FRESHNESS_CONFIRMATION_CHANGED_COMMERCIAL_STATE");
  return rows;
}

async function withoutControlCredential(body, env = process.env) {
  const credential = env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(credential, "WORKER_CONTROL_CREDENTIAL_MISSING");
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  try { return await body(); } finally { env.SUPABASE_SERVICE_ROLE_KEY = credential; }
}

function executionReport(run, rows, allOfferIds) {
  const executionIds = rows.map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b));
  const reviewRows = allOfferIds.filter((offerId) => !executionIds.includes(String(offerId))).map((offerId) => ({ offer_id: String(offerId), review_type: "NOT_SELECTED_BY_EXECUTION_REQUEST" }));
  const expected = run.artifacts.reduce((total, artifact) => {
    for (const key of Object.keys(total.row_count_deltas)) total.row_count_deltas[key] += Number(artifact.expected_deltas.row_count_deltas[key] || 0);
    for (const key of Object.keys(total.logical_field_deltas)) total.logical_field_deltas[key] += Number(artifact.expected_deltas.logical_field_deltas[key] || 0);
    return total;
  }, { row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 }, logical_field_deltas: { offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 0 } });
  return { result: "PASS_WITH_REVIEW", approved_mapping_count: allOfferIds.length, executable_plan_count: rows.length, executed_plan_count: rows.length, review_row_count: reviewRows.length, blocked_row_count: 0, execution_offer_ids: executionIds, review_rows: reviewRows, expected_deltas: expected };
}

async function run(options, dependencies = {}) {
  const env = dependencies.env || process.env, adapter = ADAPTERS[options.retailer];
  assertContext(adapter, env);
  env.RETAILER_REFRESH_PROFILE = adapter.refreshProfile;
  const engine = dependencies.engine || require(path.join(ROOT, adapter.engineModule));
  for (const method of ["readState", "buildReviewQueueRun", "buildIdempotencyRun", "validate", "registrationRequest", "register", "approveAndExecute"]) invariant(typeof engine[method] === "function", "REVIEW_ENGINE_CONTRACT_INVALID");
  fs.mkdirSync(OUT, { recursive: true });
  const db = dependencies.client || controlClient(env);
  let databaseWrites = 0;
  try {
    const state = await (dependencies.loadControlState || loadControlState)(db, options, { retailerId: adapter.retailerId, retailerSlug: options.retailer, operations: adapter.operations, workflowName: adapter.workflowName, environment: adapter.environment }, env);
    const before = await engine.readState("production");
    const record = before.records.find((candidate) => String(candidate.offer.id) === String(state.review.offer_id));
    invariant(record, "DATABASE_BASELINE_MISSING");
    assertReviewBeforeState(record, state.review);
    const preparedRunPlan = await engine.buildReviewQueueRun("production", before, {
      offerId: String(state.review.offer_id),
      operation: state.review.operation_type,
      maximumCommercialChanges: adapter.expectedCommercialChanges,
      freshnessConfirmationCount: adapter.freshnessConfirmationCount,
    });
    const ownerDecision = prepareAutomationReviewDecision({ review: state.review, request: state.request, adapter });
    const runPlan = {
      ...preparedRunPlan,
      automationReviewDecision: ownerDecision,
    };
    const rows = assertPreparedDecision(runPlan, state.review, adapter);
    const validations = await engine.validate(runPlan);
    const baselinePath = path.join(OUT, `${options.executionRequestId}-baseline.json`), executionPath = path.join(OUT, `${options.executionRequestId}-execution.json`), postflightPath = path.join(OUT, `${options.executionRequestId}-postflight.json`);
    const baseline = await (dependencies.runPostflight || runPostflight)({ profile: adapter.profile, mode: "baseline", baseline: null, execution: null, output: baselinePath }, dependencies);
    const baselineRecord = baseline.snapshot.rows.find((candidate) => String(candidate.offer_id) === String(state.review.offer_id));
    assertBaselineBeforeState(baselineRecord, state.review);
    await checkpoint(db, options.executionRequestId, "EXECUTING", "REVALIDATION_PASSED", { run_id: String(env.GITHUB_RUN_ID), run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`, commit_sha: env.GITHUB_SHA, before_state_hash: baseline.evidence_hash, approved_commercial_change_count: 1, freshness_confirmation_count: rows.length - 1 }, env);
    // Once the role-separated write sequence starts, a connection failure can make
    // the outcome unknown. Record the whole bounded scope pessimistically so the
    // admin retry guard can never replay a possibly committed batch.
    databaseWrites = rows.length;
    const results = await withoutControlCredential(async () => {
      const request = engine.registrationRequest(runPlan);
      await engine.register(runPlan, request);
      if (typeof engine.prepareSequentialParentApproval === "function") await engine.prepareSequentialParentApproval(runPlan, request);
      return engine.approveAndExecute(runPlan, request, validations);
    }, env);
    invariant(results.length === runPlan.artifacts.length && results.every((result) => result.result?.status === "APPLIED"), "APPLY_RESULT_SCOPE_DRIFT");
    const execution = executionReport(runPlan, rows, before.records.map((candidate) => String(candidate.offer.id)));
    fs.writeFileSync(executionPath, `${JSON.stringify(execution, null, 2)}\n`);
    const postflight = await (dependencies.runPostflight || runPostflight)({ profile: adapter.profile, mode: "postflight", baseline: baselinePath, execution: executionPath, output: postflightPath }, dependencies);
    await checkpoint(db, options.executionRequestId, "EXECUTING", "POSTFLIGHT_PASSED", { run_id: String(env.GITHUB_RUN_ID), commit_sha: env.GITHUB_SHA, before_state_hash: baseline.evidence_hash, postflight_hash: postflight.postflight_hash, executed_offer_ids: [String(state.review.offer_id)], freshness_confirmation_offer_ids: rows.filter((row) => row.action === "VERIFY_NO_CHANGE").map((row) => String(row.offer_id)), expected_deltas: execution.expected_deltas, actual_deltas: { freshness: postflight.freshness_change_count, price: postflight.price_change_count, stock: postflight.stock_change_count, shipping: postflight.shipping_change_count, total: postflight.total_change_count, offer_url: postflight.offer_url_change_count, mapping_url: postflight.mapping_url_change_count }, price_history_delta: postflight.price_history_delta, database_writes: databaseWrites }, env);
    const after = await engine.readState("production");
    const idempotencyTransition = prepareAutomationReviewIdempotencyTransition({ review: state.review, decision: ownerDecision });
    const fresh = await engine.buildIdempotencyRun("production", after, idempotencyTransition);
    const selectedAfter = fresh.classification.rows.find((row) => String(row.offer_id) === String(state.review.offer_id));
    invariant(selectedAfter?.action === "VERIFY_NO_CHANGE", "IDEMPOTENCY_FAILED");
    const evidence = { run_id: String(env.GITHUB_RUN_ID), run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`, commit_sha: env.GITHUB_SHA, before_state_hash: baseline.evidence_hash, postflight_hash: postflight.postflight_hash, executed_offer_ids: [String(state.review.offer_id)], freshness_confirmation_offer_ids: rows.filter((row) => row.action === "VERIFY_NO_CHANGE").map((row) => String(row.offer_id)), failed_offer_ids: [], remaining_offer_ids: [], expected_deltas: execution.expected_deltas, actual_deltas: { freshness: postflight.freshness_change_count, price: postflight.price_change_count, stock: postflight.stock_change_count, shipping: postflight.shipping_change_count, total: postflight.total_change_count, offer_url: postflight.offer_url_change_count, mapping_url: postflight.mapping_url_change_count }, price_history_delta: postflight.price_history_delta, database_writes: databaseWrites, idempotency_result: "PASS", baseline_hash: baseline.evidence_hash, source_fingerprint: state.review.source_row_fingerprint, plan_fingerprint: state.review.plan_fingerprint };
    await checkpoint(db, options.executionRequestId, "EXECUTED", "IDEMPOTENCY_PASSED", evidence, env);
    const report = { schema_version: 1, kind: WORKER_KIND, result: "PASS", execution_request_id: options.executionRequestId, review_item_ids: [options.reviewItemId], retailer: options.retailer, ...evidence };
    fs.writeFileSync(path.join(OUT, `${options.executionRequestId}-result.json`), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    const code = error.code || error.message || "REVIEW_EXECUTION_FAILED";
    const revalidation = /(?:DRIFT|EXPIRED|REVALIDATION|BINDING|EVIDENCE|MISSING|SCOPE|IDEMPOTENCY)/.test(code);
    try { await checkpoint(db, options.executionRequestId, revalidation && databaseWrites === 0 ? "EXPIRED" : "FAILED", revalidation && databaseWrites === 0 ? "FAILED_REVALIDATION" : "EXECUTION_FAILED", { error_code: code, error_message: error.message, run_id: String(env.GITHUB_RUN_ID || ""), commit_sha: env.GITHUB_SHA || null, database_writes: databaseWrites }, env); } catch {}
    error.databaseWrites = databaseWrites;
    throw error;
  }
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { ADAPTERS, WORKER_KIND, assertBaselineBeforeState, assertContext, assertPreparedDecision, assertReviewBeforeState, executionReport, parseArgs, run, withoutControlCredential };
