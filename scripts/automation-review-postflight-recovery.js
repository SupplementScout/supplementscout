const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { adaptersForWorkerKind } = require("./lib/automation-review-adapter-registry");
const { prepareAutomationReviewIdempotencyTransition } = require("./lib/retailer-offer-sync/automation-review-decision");
const { run: runPostflight } = require("./retailer-offer-refresh-postflight");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "automation-review-execution");
const REQUEST_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADAPTERS = Object.freeze(Object.fromEntries(adaptersForWorkerKind("shared-retailer").map((entry) => [entry.retailerSlug, entry])));

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|execution-request-id|artifact-directory|github-output)=(.*)$/);
    invariant(match && values[match[1]] === undefined, "RECOVERY_ARGUMENT_INVALID");
    values[match[1]] = match[2];
  }
  invariant(["metadata", "recover"].includes(values.mode), "RECOVERY_MODE_INVALID");
  invariant(REQUEST_PATTERN.test(values["execution-request-id"] || ""), "RECOVERY_REQUEST_ID_INVALID");
  if (values.mode === "recover") invariant(Boolean(values["artifact-directory"]), "RECOVERY_ARTIFACT_DIRECTORY_REQUIRED");
  return { mode: values.mode, executionRequestId: values["execution-request-id"], artifactDirectory: values["artifact-directory"] || null, githubOutput: values["github-output"] || null };
}

function assertContext(options, env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true" && env.GITHUB_EVENT_NAME === "workflow_dispatch"
    && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout",
  "RECOVERY_CONTEXT_INVALID");
  invariant(env.AUTOMATION_REVIEW_RECOVERY_REQUEST_ID === options.executionRequestId, "RECOVERY_CONTEXT_REQUEST_DRIFT");
  invariant(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "RECOVERY_CONTROL_CREDENTIAL_MISSING");
}

function client(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadFailedState(db, requestId) {
  const requestResult = await db.from("automation_review_execution_requests").select("*").eq("id", requestId).maybeSingle();
  invariant(!requestResult.error && requestResult.data, "RECOVERY_REQUEST_READ_FAILED");
  const request = requestResult.data;
  const reviewResult = await db.from("product_match_review_queue").select("*").eq("id", String(request.review_id)).maybeSingle();
  invariant(!reviewResult.error && reviewResult.data, "RECOVERY_REVIEW_READ_FAILED");
  const review = reviewResult.data;
  invariant(request.status === "FAILED" && request.last_checkpoint === "EXECUTION_FAILED" && Number(request.database_writes) > 0, "RECOVERY_REQUEST_STATE_INVALID");
  invariant(review.review_status === "FAILED" && String(review.execution_id) === String(request.id), "RECOVERY_REVIEW_STATE_INVALID");
  invariant(request.review_fingerprint === review.source_row_fingerprint && request.plan_fingerprint === review.plan_fingerprint, "RECOVERY_FINGERPRINT_DRIFT");
  invariant(Boolean(ADAPTERS[request.retailer_slug]), "RECOVERY_ADAPTER_UNSUPPORTED");
  return { request, review };
}

function findUnique(directory, basename) {
  const matches = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.name === basename) matches.push(candidate);
    }
  };
  visit(path.resolve(directory));
  invariant(matches.length === 1, "RECOVERY_ARTIFACT_SCOPE_INVALID");
  return matches[0];
}

function recoveryTransition(review, request) {
  return prepareAutomationReviewIdempotencyTransition({
    review,
    decision: {
      kind: "automation-review-owner-decision-v1",
      execution_request_id: String(request.id),
      review_id: String(review.id),
      retailer_id: String(request.retailer_id),
      retailer_slug: request.retailer_slug,
      review_fingerprint: request.review_fingerprint,
      plan_fingerprint: request.plan_fingerprint,
      idempotency_key: request.idempotency_key,
    },
  });
}

async function run(options, dependencies = {}) {
  const env = dependencies.env || process.env;
  assertContext(options, env);
  const db = dependencies.client || client(env);
  const { request, review } = await loadFailedState(db, options.executionRequestId);
  if (options.mode === "metadata") {
    invariant(/^[1-9][0-9]*$/.test(String(request.run_id || "")), "RECOVERY_ORIGINAL_RUN_ID_INVALID");
    if (options.githubOutput) fs.appendFileSync(options.githubOutput, `original_run_id=${request.run_id}\n`);
    return { result: "PASS", mode: "metadata", original_run_id: String(request.run_id), database_writes: 0 };
  }

  const adapter = ADAPTERS[request.retailer_slug];
  env.RETAILER_REFRESH_PROFILE = adapter.sharedEngine.profile;
  const engine = dependencies.engine || require(path.join(ROOT, adapter.sharedEngine.engineModule));
  const baselinePath = findUnique(options.artifactDirectory, `${request.id}-baseline.json`);
  const executionPath = findUnique(options.artifactDirectory, `${request.id}-execution.json`);
  const originalPostflightPath = findUnique(options.artifactDirectory, `${request.id}-postflight.json`);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const execution = JSON.parse(fs.readFileSync(executionPath, "utf8"));
  const originalPostflight = JSON.parse(fs.readFileSync(originalPostflightPath, "utf8"));
  invariant(baseline.result === "PASS" && baseline.evidence_hash === request.before_state_hash, "RECOVERY_BASELINE_BINDING_DRIFT");
  invariant(execution.result === "PASS_WITH_REVIEW" && execution.executed_plan_count === 20 && execution.execution_offer_ids.includes(String(review.offer_id)), "RECOVERY_EXECUTION_ARTIFACT_DRIFT");
  invariant(originalPostflight.result === "PASS" && originalPostflight.baseline_hash === baseline.evidence_hash && originalPostflight.stock_change_count === 1 && originalPostflight.freshness_change_count === 20 && originalPostflight.price_history_delta === 0, "RECOVERY_ORIGINAL_POSTFLIGHT_DRIFT");

  fs.mkdirSync(OUT, { recursive: true });
  const recoveryPostflightPath = path.join(OUT, `${request.id}-recovery-postflight.json`);
  const postflight = await (dependencies.runPostflight || runPostflight)({ profile: adapter.sharedEngine.postflightProfile, mode: "postflight", baseline: baselinePath, execution: executionPath, output: recoveryPostflightPath }, dependencies);
  invariant(postflight.result === "PASS" && postflight.stock_change_count === 1 && postflight.freshness_change_count === 20 && postflight.price_history_delta === 0, "RECOVERY_POSTFLIGHT_FAILED");

  const after = await engine.readState("production");
  const fresh = await engine.buildIdempotencyRun("production", after, recoveryTransition(review, request));
  const selectedAfter = fresh.classification.rows.find((row) => String(row.offer_id) === String(review.offer_id));
  invariant(selectedAfter?.action === "VERIFY_NO_CHANGE", "RECOVERY_IDEMPOTENCY_FAILED");
  const confirmations = execution.execution_offer_ids.filter((offerId) => String(offerId) !== String(review.offer_id));
  invariant(confirmations.length === 19, "RECOVERY_CONFIRMATION_SCOPE_DRIFT");
  const evidence = {
    kind: "automation-review-verified-postflight-recovery-v1",
    original_run_id: String(request.run_id),
    original_commit_sha: request.commit_sha,
    recovery_run_id: String(env.GITHUB_RUN_ID),
    recovery_commit_sha: env.GITHUB_SHA,
    baseline_hash: baseline.evidence_hash,
    postflight_hash: postflight.postflight_hash,
    executed_offer_ids: [String(review.offer_id)],
    freshness_confirmation_offer_ids: confirmations,
    actual_deltas: { freshness: postflight.freshness_change_count, price: postflight.price_change_count, stock: postflight.stock_change_count, shipping: postflight.shipping_change_count, total: postflight.total_change_count, offer_url: postflight.offer_url_change_count, mapping_url: postflight.mapping_url_change_count },
    price_history_delta: postflight.price_history_delta,
    database_writes: Number(request.database_writes),
    idempotency_result: "PASS",
  };
  const result = await db.rpc("reconcile_automation_review_verified_postflight", { p_execution_request_id: request.id, p_actor: `github-actions:${env.GITHUB_ACTOR || "unknown"}`, p_evidence: evidence });
  invariant(!result.error && result.data?.status === "EXECUTED", "RECOVERY_CONTROL_RECONCILIATION_FAILED");
  const report = { schema_version: 1, kind: "automation-review-verified-postflight-recovery-v1", result: "PASS", execution_request_id: request.id, review_id: String(review.id), retailer_slug: request.retailer_slug, control_status: result.data.status, catalogue_writes: 0, ...evidence };
  fs.writeFileSync(path.join(OUT, `${request.id}-recovery-result.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { ADAPTERS, assertContext, findUnique, loadFailedState, parseArgs, recoveryTransition, run };
