import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { resolveReviewAdapter, reviewDispatchConfigured } from "../../../lib/automationReviewAdapters";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ACTOR = "authenticated-admin";

function idempotencyKey(reviewId: string, fingerprint: string, workflow: string) {
  return crypto.createHash("sha256").update(`${reviewId}:${fingerprint}:${workflow}:review-queue`).digest("hex");
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
  if (error || !data || !["APPROVED", "FAILED"].includes(data.review_status) || !data.expires_at || Date.parse(data.expires_at) <= Date.now() || !data.plan_fingerprint || !data.decision_actor || !data.decision_at) {
    return new NextResponse("Approved evidence changed, lacks a sealed plan or expired; execution was not queued.", { status: 409 });
  }
  const resolved = resolveReviewAdapter(data.retailer_id, data.operation_type, data.reason_codes);
  if (!resolved.adapter) return new NextResponse(`${resolved.code}: ${resolved.reason}`, { status: 422 });
  if (!reviewDispatchConfigured()) return new NextResponse("EXECUTION_QUEUE_DISABLED: automatic review execution is disabled.", { status: 503 });

  const { data: previous } = await supabaseAdmin
    .from("automation_review_execution_requests")
    .select("id,status,database_writes")
    .eq("review_id", data.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data.review_status === "FAILED") {
    if (!previous || previous.status !== "FAILED" || Number(previous.database_writes || 0) !== 0) {
      return new NextResponse("This failed execution cannot be retried because a zero-write failure was not proved.", { status: 409 });
    }
    const { data: reopened, error: reopenError } = await supabaseAdmin
      .from("product_match_review_queue")
      .update({ review_status: "APPROVED", execution_error_code: null, execution_error_message: null, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("review_status", "FAILED")
      .eq("source_row_fingerprint", data.source_row_fingerprint)
      .select("id")
      .maybeSingle();
    if (reopenError || !reopened) return new NextResponse("Safe retry could not be prepared; nothing was queued.", { status: 409 });
  }

  const retryBinding = previous && ["FAILED", "EXPIRED"].includes(previous.status) ? previous.id : "initial";
  const key = idempotencyKey(String(data.id), data.source_row_fingerprint, `${resolved.adapter.workflow}:${retryBinding}`);
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
  return NextResponse.redirect(new URL(`/admin/automation-review?status=APPROVED&execution=${executionRequestId}`, request.url), 303);
}
