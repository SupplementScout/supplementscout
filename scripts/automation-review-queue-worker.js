const { createClient } = require("@supabase/supabase-js");
const { run: runEbay } = require("./automation-review-ebay-worker");
const { run: runSharedRetailer } = require("./automation-review-shared-retailer-worker");

const WORKERS = Object.freeze({
  "ebay-uk": Object.freeze({ workflow: "automation-review-queue-worker.yml", run: runEbay }),
  "fit-house": Object.freeze({ workflow: "automation-review-queue-worker.yml", run: runSharedRetailer }),
});

function invariant(condition, code) {
  if (!condition) { const error = new Error(code); error.code = code; throw error; }
}

function assertContext(env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true", "QUEUE_WORKER_CONTEXT_INVALID");
  invariant(["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME), "QUEUE_WORKER_EVENT_INVALID");
  invariant(env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === "SupplementScout/supplementscout", "QUEUE_WORKER_REPOSITORY_INVALID");
  invariant(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "QUEUE_WORKER_CONTROL_CREDENTIAL_MISSING");
}

function client(env = process.env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function run(dependencies = {}) {
  const env = dependencies.env || process.env;
  assertContext(env);
  const db = dependencies.client || client(env);
  const { data, error } = await db
    .from("automation_review_execution_requests")
    .select("id,review_id,retailer_slug,workflow_name,review_fingerprint,plan_fingerprint,idempotency_key,status")
    .eq("status", "QUEUED")
    .order("requested_at", { ascending: true })
    .limit(5);
  invariant(!error, "QUEUE_WORKER_READ_FAILED");
  if (!data?.length) return { result: "PASS", processed: 0, database_writes: 0 };
  const completed = [], failed = [];
  for (const request of data) {
    try {
      const adapter = WORKERS[request.retailer_slug];
      invariant(adapter && request.workflow_name === adapter.workflow, "QUEUE_WORKER_ADAPTER_UNSUPPORTED");
      const worker = request.retailer_slug === "ebay-uk" ? (dependencies.runEbay || adapter.run) : (dependencies.runSharedRetailer || adapter.run);
      const result = await worker({ reviewItemId: String(request.review_id), executionRequestId: request.id, retailer: request.retailer_slug, reviewFingerprint: request.review_fingerprint, reviewPlanFingerprint: request.plan_fingerprint, executionIdempotencyKey: request.idempotency_key, mode: "review-queue" }, { ...dependencies, client: db, env });
      completed.push({ execution_request_id: request.id, worker_result: result.result, database_writes: result.database_writes });
    } catch (error) {
      failed.push({ execution_request_id: request.id, error_code: error.code || error.message });
    }
  }
  const output = { result: failed.length ? "FAIL" : "PASS", processed: data.length, completed, failed, database_writes: completed.reduce((sum, row) => sum + Number(row.database_writes || 0), 0) };
  if (failed.length) { const error = new Error(`QUEUE_WORKER_BATCH_FAILED:${failed.length}`); error.report = output; throw error; }
  return output;
}

if (require.main === module) run().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { WORKERS, assertContext, run };
