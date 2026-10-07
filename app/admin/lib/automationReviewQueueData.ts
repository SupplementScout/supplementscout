import "server-only";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  REVIEW_QUEUE_MAX_ROWS,
  REVIEW_QUEUE_READ_BATCH_SIZE,
  type ReviewQueueRow,
} from "./automationReviewQueue";

export type ReviewExecutionRow = { id: string; review_id: string | number; review_fingerprint: string; plan_fingerprint: string; status: string; requested_at: string; run_url: string | null; last_checkpoint: string | null; error_code: string | null; error_message: string | null; postflight_hash: string | null; idempotency_result: string | null; database_writes: number | null };

// Read execution state before filtering: QUEUED requests must leave owner work immediately.
export async function loadCompleteReviewExecutions() {
  const rows: ReviewExecutionRow[] = [];
  const seen = new Set<string>();
  let expectedCount: number | null = null;
  for (let offset = 0; offset < REVIEW_QUEUE_MAX_ROWS; offset += REVIEW_QUEUE_READ_BATCH_SIZE) {
    const result = await supabaseAdmin.from("automation_review_execution_requests")
      .select("id,review_id,review_fingerprint,plan_fingerprint,status,requested_at,run_url,last_checkpoint,error_code,error_message,postflight_hash,idempotency_result,database_writes", { count: "exact" })
      .order("requested_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + REVIEW_QUEUE_READ_BATCH_SIZE - 1);
    if (result.error) return { rows: [] as ReviewExecutionRow[], error: result.error };
    if (expectedCount === null) {
      if (!Number.isSafeInteger(result.count) || Number(result.count) < 0 || Number(result.count) > REVIEW_QUEUE_MAX_ROWS) return { rows: [] as ReviewExecutionRow[], error: new Error("Execution count exceeds the complete-read contract") };
      expectedCount = Number(result.count);
    } else if (result.count !== expectedCount) return { rows: [] as ReviewExecutionRow[], error: new Error("Executions changed during read") };
    const batch = (result.data || []) as ReviewExecutionRow[];
    if (batch.some((row) => seen.has(row.id))) return { rows: [] as ReviewExecutionRow[], error: new Error("Duplicate execution in complete read") };
    for (const row of batch) seen.add(row.id);
    rows.push(...batch);
    if (rows.length >= expectedCount) return { rows, error: null };
    if (batch.length !== REVIEW_QUEUE_READ_BATCH_SIZE) break;
  }
  return { rows: [] as ReviewExecutionRow[], error: new Error("Execution read was incomplete") };
}

const REVIEW_QUEUE_COLUMNS = "id,retailer,retailer_id,offer_id,product_title,variant_title,source_price,source_url,current_product_id,current_variant_id,review_status,review_kind,operation_type,reason_codes,before_state,proposed_state,impact_summary,source_evidence,source_captured_at,expires_at,source_row_fingerprint,plan_fingerprint,workflow_run_url,artifact_url,superseded_by_review_id,execution_error_code,execution_error_message,updated_at";

export async function loadCompleteReviewQueue(status: string) {
  const rows: ReviewQueueRow[] = [];
  const seenIds = new Set<string>();
  let expectedCount: number | null = null;
  for (let offset = 0; offset < REVIEW_QUEUE_MAX_ROWS; offset += REVIEW_QUEUE_READ_BATCH_SIZE) {
    let request = supabaseAdmin.from("product_match_review_queue").select(REVIEW_QUEUE_COLUMNS, { count: "exact" }).not("review_status", "is", null).order("updated_at", { ascending: false }).order("id", { ascending: false });
    if (status !== "ALL") request = request.eq("review_status", status);
    if (["PENDING", "APPROVED"].includes(status)) request = request.gt("expires_at", new Date().toISOString());
    const result = await request.range(offset, offset + REVIEW_QUEUE_READ_BATCH_SIZE - 1);
    if (result.error) return { rows: [] as ReviewQueueRow[], error: result.error };
    if (expectedCount === null) {
      if (!Number.isSafeInteger(result.count) || Number(result.count) < 0) return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue count is unavailable") };
      expectedCount = Number(result.count);
      if (expectedCount > REVIEW_QUEUE_MAX_ROWS) return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue exceeds the bounded complete-read limit") };
    } else if (result.count !== expectedCount) {
      return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue changed during the complete read") };
    }
    const batch = (result.data || []) as ReviewQueueRow[];
    if (batch.some((row) => seenIds.has(String(row.id)))) return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue complete read contained a duplicate row") };
    for (const row of batch) seenIds.add(String(row.id));
    rows.push(...batch);
    if (rows.length >= expectedCount) return { rows, error: null };
    if (batch.length !== REVIEW_QUEUE_READ_BATCH_SIZE) return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue complete read was truncated") };
  }
  return { rows: [] as ReviewQueueRow[], error: new Error("Review Queue complete read did not terminate") };
}
