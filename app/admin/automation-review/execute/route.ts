import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { resolveReviewAdapter, reviewDispatchConfigured } from "../../../lib/automationReviewAdapters";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const REPOSITORY = "SupplementScout/supplementscout";
const ACTOR = "authenticated-admin";

function idempotencyKey(reviewId: string, fingerprint: string, workflow: string) {
  return crypto.createHash("sha256").update(`${reviewId}:${fingerprint}:${workflow}:review-queue`).digest("hex");
}

async function checkpoint(executionRequestId: string, status: string, checkpointName: string, evidence: Record<string, unknown>) {
  return supabaseAdmin.rpc("record_automation_review_execution_checkpoint", {
    p_execution_request_id: executionRequestId,
    p_actor: ACTOR,
    p_new_status: status,
    p_checkpoint: checkpointName,
    p_evidence: evidence,
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;
  const form = await request.formData();
  const selection = String(form.get("selection") || "").match(/^([1-9]\d*):([0-9a-f]{64})$/);
  if (!selection || form.get("confirmExecution") !== "yes") return new NextResponse("Exact execution preview confirmation is required.", { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("id,review_status,expires_at,source_row_fingerprint,plan_fingerprint,retailer_id,operation_type,reason_codes,decision_actor,decision_at")
    .eq("id", selection[1])
    .eq("source_row_fingerprint", selection[2])
    .maybeSingle();
  if (error || !data || data.review_status !== "APPROVED" || !data.expires_at || Date.parse(data.expires_at) <= Date.now() || !data.plan_fingerprint || !data.decision_actor || !data.decision_at) {
    return new NextResponse("Approved evidence changed, lacks a sealed plan or expired; execution was not queued.", { status: 409 });
  }
  const resolved = resolveReviewAdapter(data.retailer_id, data.operation_type, data.reason_codes);
  if (!resolved.adapter) return new NextResponse(`${resolved.code}: ${resolved.reason}`, { status: 422 });
  if (!reviewDispatchConfigured()) return new NextResponse("EXECUTION_DISPATCH_UNAVAILABLE: the protected workflow-dispatch credential is not configured.", { status: 503 });

  const key = idempotencyKey(String(data.id), data.source_row_fingerprint, resolved.adapter.workflow);
  const { data: queued, error: queueError } = await supabaseAdmin.rpc("queue_automation_review_execution", {
    p_review_id: data.id,
    p_review_fingerprint: data.source_row_fingerprint,
    p_requested_by: ACTOR,
    p_retailer_slug: resolved.adapter.retailerSlug,
    p_workflow_name: resolved.adapter.workflow,
    p_environment_name: resolved.adapter.environment,
    p_execution_mode: "review-queue",
    p_idempotency_key: key,
  });
  const executionRequestId = String(queued?.execution_request_id || "");
  if (queueError || !/^[0-9a-f-]{36}$/.test(executionRequestId)) return new NextResponse("Execution request could not be created; no workflow was dispatched.", { status: 409 });
  if (queued.already_queued === true) return NextResponse.redirect(new URL(`/admin/automation-review?status=APPROVED&execution=${executionRequestId}`, request.url), 303);

  const { error: dispatchStartedError } = await checkpoint(executionRequestId, "DISPATCHED", "DISPATCH_STARTED", { commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null, database_writes: 0 });
  if (dispatchStartedError) return new NextResponse("Execution dispatch could not be checkpointed; no workflow was dispatched.", { status: 500 });

  const token = process.env.AUTOMATION_REVIEW_GITHUB_TOKEN!;
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/${encodeURIComponent(resolved.adapter.workflow)}/dispatches`, {
      method: "POST",
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Review-Dispatcher/1.0" },
      body: JSON.stringify({ ref: "main", inputs: { operation: "apply", execution_mode: "review-queue", review_item_id: String(data.id), execution_request_id: executionRequestId, retailer: resolved.adapter.retailerSlug, review_fingerprint: data.source_row_fingerprint, review_plan_fingerprint: data.plan_fingerprint, execution_idempotency_key: key } }),
      cache: "no-store",
    });
  } catch (dispatchError) {
    await checkpoint(executionRequestId, "FAILED", "DISPATCH_FAILED", { error_code: "WORKFLOW_DISPATCH_FAILED", error_message: dispatchError instanceof Error ? dispatchError.message : "Network failure" });
    return new NextResponse("Protected workflow dispatch failed; the request is recorded as FAILED and the catalogue was not touched.", { status: 502 });
  }
  if (response.status !== 204) {
    await checkpoint(executionRequestId, "FAILED", "DISPATCH_REJECTED", { error_code: "WORKFLOW_DISPATCH_REJECTED", error_message: `GitHub API returned ${response.status}` });
    return new NextResponse("Protected workflow rejected the dispatch; the request is recorded as FAILED and the catalogue was not touched.", { status: 502 });
  }
  const { error: dispatchCheckpointError } = await checkpoint(executionRequestId, "DISPATCHED", "WORKFLOW_DISPATCHED", { commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || null, database_writes: 0 });
  if (dispatchCheckpointError) return new NextResponse("Workflow was dispatched but its checkpoint could not be recorded; automatic replay is blocked.", { status: 500 });
  return NextResponse.redirect(new URL(`/admin/automation-review?status=APPROVED&execution=${executionRequestId}`, request.url), 303);
}
