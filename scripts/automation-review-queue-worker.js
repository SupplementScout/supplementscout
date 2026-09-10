const { createClient } = require("@supabase/supabase-js");
const { run: runEbay } = require("./automation-review-ebay-worker");

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

async function checkpoint(db, requestId, status, name, evidence) {
  const { data, error } = await db.rpc("record_automation_review_execution_checkpoint", {
    p_execution_request_id: requestId,
    p_actor: `github-actions:${process.env.GITHUB_ACTOR || "automation-review-queue"}`,
    p_new_status: status,
    p_checkpoint: name,
    p_evidence: evidence,
  });
  invariant(!error && data, "QUEUE_WORKER_CHECKPOINT_FAILED");
  return data;
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
  const runUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const completed = [], failed = [];
  for (const request of data) {
    try {
      invariant(request.retailer_slug === "ebay-uk" && request.workflow_name === "ebay-offer-refresh.yml", "QUEUE_WORKER_ADAPTER_UNSUPPORTED");
      await checkpoint(db, request.id, "DISPATCHED", "SCHEDULED_WORKER_CLAIMED", { run_id: String(env.GITHUB_RUN_ID), run_url: runUrl, commit_sha: env.GITHUB_SHA, database_writes: 0 });
      const result = await (dependencies.runEbay || runEbay)({ reviewItemId: String(request.review_id), executionRequestId: request.id, retailer: request.retailer_slug, reviewFingerprint: request.review_fingerprint, reviewPlanFingerprint: request.plan_fingerprint, executionIdempotencyKey: request.idempotency_key, mode: "review-queue" }, { ...dependencies, client: db, env });
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

module.exports = { assertContext, run };
