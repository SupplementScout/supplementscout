import "server-only";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AUTOMATION_REVIEW_CAPABILITY_MATRIX } from "../../lib/automationReviewCapabilityMatrix";
import { REVIEW_QUEUE_PAGE_SIZE, REVIEW_QUEUE_WORK_PAGE_SIZE, type ReviewQueueFilters, type ReviewQueueRow, type ReviewQueueWorkSummary } from "./automationReviewQueue";

export type ReviewExecutionRow = { id: string; review_id: string | number; review_fingerprint: string; plan_fingerprint: string; status: string; requested_at: string; run_url: string | null; last_checkpoint: string | null; error_code: string | null; error_message: string | null; postflight_hash: string | null; idempotency_result: string | null; database_writes: number | null };


type PageRow = ReviewQueueRow & { execution_request: ReviewExecutionRow | null };
export type ReviewQueuePage = { schema_version: number; revision: string; revision_changed: boolean; page: number; page_size: number; total: number; total_pages: number; rows: PageRow[]; retailers: string[]; summary: ReviewQueueWorkSummary };

// The existing capability matrix remains the sole execution-authority registry.
// The SQL reader uses its projection for presentation only, never authorization.
export async function loadReviewQueuePage(filters: ReviewQueueFilters, requestedPage: number) {
  const pageSize = filters.display === "WORK" ? REVIEW_QUEUE_WORK_PAGE_SIZE : REVIEW_QUEUE_PAGE_SIZE;
  const capabilities = Object.fromEntries(AUTOMATION_REVIEW_CAPABILITY_MATRIX.map(row => [row.retailerId,
    Object.fromEntries(Object.entries(row.operations).map(([operation, cell]) => [operation, cell.capability]))]));
  const result = await supabaseAdmin.rpc("read_automation_review_queue_page_v1", { p_request: {
    schema_version: 1, filters, capabilities, page: requestedPage, page_size: pageSize, revision: filters.revision || null,
  } });
  if (result.error) return { data: null, error: result.error };
  const data = result.data as ReviewQueuePage;
  if (data?.revision_changed) return { data: null, error: new Error("Kolejka zmieniła się podczas przeglądania. Otwórz widok ponownie, aby pobrać aktualne karty.") };
  if (data?.schema_version !== 1 || !/^[a-f0-9]{32}$/.test(data.revision || "") || !Array.isArray(data.rows)
    || !Number.isSafeInteger(data.total) || data.total < 0 || data.rows.length > pageSize || data.page_size !== pageSize
    || !Number.isSafeInteger(data.page) || data.page < 1 || !Number.isSafeInteger(data.total_pages) || data.total_pages < data.page
    || !Array.isArray(data.retailers) || !data.summary || data.rows.length !== Math.min(pageSize, Math.max(0, data.total - (data.page - 1) * pageSize))
    || new Set(data.rows.map(row => String(row.id))).size !== data.rows.length) {
    return { data: null, error: new Error("Review Queue returned an incomplete or invalid page") };
  }
  return { data, error: null };
}
