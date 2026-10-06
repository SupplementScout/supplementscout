const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { run: runEbay } = require("./automation-review-ebay-worker");
const { run: runSharedRetailer } = require("./automation-review-shared-retailer-worker");
const { REVIEW_EXECUTION_ADAPTERS } = require("./lib/automation-review-adapter-registry");

const RUNNERS = Object.freeze({ ebay: runEbay, "shared-retailer": runSharedRetailer });
const WORKERS = Object.freeze(Object.fromEntries(REVIEW_EXECUTION_ADAPTERS.map((adapter) => [
  adapter.retailerSlug,
  Object.freeze({ workflow: adapter.workflow, workerKind: adapter.workerKind, run: RUNNERS[adapter.workerKind] }),
])));
const REPORT_DIRECTORY = path.resolve(__dirname, "..", "tmp", "automation-review-execution");
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}

function assertContext(env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true", "QUEUE_WORKER_CONTEXT_INVALID");
  invariant(["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME), "QUEUE_WORKER_EVENT_INVALID");
  invariant(env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout", "QUEUE_WORKER_REPOSITORY_INVALID");
  invariant(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "QUEUE_WORKER_CONTROL_CREDENTIAL_MISSING");
  const requestId = String(env.AUTOMATION_REVIEW_EXECUTION_REQUEST_ID || "").trim();
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") invariant(REQUEST_ID_PATTERN.test(requestId), "QUEUE_WORKER_EXACT_REQUEST_ID_INVALID");
  else invariant(requestId.length === 0, "QUEUE_WORKER_SCHEDULE_SCOPE_INVALID");
}

function client(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeErrorCode(error) {
  const value = String(error?.code || error?.message || "QUEUE_WORKER_REQUEST_FAILED");
  return /^[A-Z0-9_:.-]{1,120}$/.test(value) ? value : "QUEUE_WORKER_REQUEST_FAILED";
}

function selectCompatibleRequests(requests) {
  let sharedRetailer = null;
  const selected = [], deferred = [];
  for (const request of requests) {
    const adapter = WORKERS[request.retailer_slug];
    if (adapter?.workerKind === "shared-retailer") {
      if (sharedRetailer && sharedRetailer !== request.retailer_slug) {
        deferred.push(request);
        continue;
      }
      sharedRetailer = request.retailer_slug;
    }
    selected.push(request);
  }
  return { selected, deferred };
}

function persistReport(report, env = process.env) {
  const runId = /^[1-9][0-9]*$/.test(String(env.GITHUB_RUN_ID || "")) ? String(env.GITHUB_RUN_ID) : "local";
  fs.mkdirSync(REPORT_DIRECTORY, { recursive: true });
  const output = path.join(REPORT_DIRECTORY, `queue-worker-${runId}-batch.json`);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return output;
}

async function run(dependencies = {}) {
  const env = dependencies.env || process.env;
  assertContext(env);
  const db = dependencies.client || client(env);
  const exactRequestId = String(env.AUTOMATION_REVIEW_EXECUTION_REQUEST_ID || "").trim();
  let requestQuery = db
    .from("automation_review_execution_requests")
    .select("id,review_id,retailer_slug,workflow_name,review_fingerprint,plan_fingerprint,idempotency_key,status")
    .eq("status", "QUEUED");
  requestQuery = exactRequestId
    ? requestQuery.eq("id", exactRequestId)
    : requestQuery.order("requested_at", { ascending: true });
  const { data, error } = await requestQuery.limit(exactRequestId ? 1 : 5);
  invariant(!error, "QUEUE_WORKER_READ_FAILED");
  if (exactRequestId) invariant(data?.length === 1 && data[0].id === exactRequestId, "QUEUE_WORKER_EXACT_REQUEST_UNAVAILABLE");
  const saveReport = dependencies.persistReport || ((report) => persistReport(report, env));
  if (!data?.length) {
    const output = { result: "PASS", selection_mode: "scheduled-batch", processed: 0, deferred: [], completed: [], failed: [], database_writes: 0 };
    saveReport(output);
    return output;
  }
  const { selected, deferred } = selectCompatibleRequests(data);
  const completed = [], failed = [];
  for (const request of selected) {
    try {
      const adapter = WORKERS[request.retailer_slug];
      invariant(adapter && request.workflow_name === adapter.workflow, "QUEUE_WORKER_ADAPTER_UNSUPPORTED");
      const injected = adapter.workerKind === "ebay" ? dependencies.runEbay : dependencies.runSharedRetailer;
      const worker = injected || adapter.run;
      const result = await worker({ reviewItemId: String(request.review_id), executionRequestId: request.id, retailer: request.retailer_slug, reviewFingerprint: request.review_fingerprint, reviewPlanFingerprint: request.plan_fingerprint, executionIdempotencyKey: request.idempotency_key, mode: "review-queue" }, { ...dependencies, client: db, env });
      completed.push({ execution_request_id: request.id, worker_result: result.result, database_writes: result.database_writes });
    } catch (error) {
      const databaseWrites = Number.isSafeInteger(error?.databaseWrites) && error.databaseWrites >= 0 ? error.databaseWrites : 0;
      failed.push({ execution_request_id: request.id, retailer_slug: request.retailer_slug, review_id: String(request.review_id), error_code: safeErrorCode(error), database_writes: databaseWrites });
    }
  }
  const output = { result: failed.length ? "FAIL" : "PASS", selection_mode: exactRequestId ? "exact-request" : "scheduled-batch", processed: selected.length, deferred: deferred.map((request) => request.id), completed, failed, database_writes: [...completed, ...failed].reduce((sum, row) => sum + Number(row.database_writes || 0), 0) };
  saveReport(output);
  if (failed.length) { const error = new Error(`QUEUE_WORKER_BATCH_FAILED:${failed.length}`); error.report = output; throw error; }
  return output;
}

if (require.main === module) run().then((result) => console.log(JSON.stringify(result))).catch((error) => { if (error.report) console.error(JSON.stringify(error.report)); console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { WORKERS, assertContext, persistReport, run, safeErrorCode, selectCompatibleRequests };
