import "server-only";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  REVIEW_QUEUE_MAX_ROWS,
  REVIEW_QUEUE_READ_BATCH_SIZE,
  type ReviewQueueRow,
} from "./automationReviewQueue";

const REVIEW_QUEUE_COLUMNS = "id,retailer,retailer_id,offer_id,product_title,variant_title,source_price,source_url,current_product_id,current_variant_id,review_status,review_kind,operation_type,reason_codes,before_state,proposed_state,impact_summary,source_evidence,source_captured_at,expires_at,source_row_fingerprint,plan_fingerprint,workflow_run_url,artifact_url,superseded_by_review_id,execution_error_code,execution_error_message,updated_at";

export async function loadCompleteReviewQueue(status: string) {
  const rows: ReviewQueueRow[] = [];
  const seenIds = new Set<string>();
  let expectedCount: number | null = null;
  for (let offset = 0; offset < REVIEW_QUEUE_MAX_ROWS; offset += REVIEW_QUEUE_READ_BATCH_SIZE) {
    let request = supabaseAdmin.from("product_match_review_queue").select(REVIEW_QUEUE_COLUMNS, { count: "exact" }).not("review_status", "is", null).order("updated_at", { ascending: false });
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
