import { supabaseAdmin } from "../../lib/supabaseAdmin";

export type AutomationReviewCounts = Record<
  string,
  { pending: number; blocked: number; sourceUnavailable: number }
>;

export async function loadAutomationReviewCounts(): Promise<AutomationReviewCounts | null> {
  const { data, error, count } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("retailer_id,review_kind,review_status", { count: "exact" })
    .not("review_status", "is", null)
    .limit(1000);

  if (error || (count || 0) > 1000) {
    return null;
  }

  const result: AutomationReviewCounts = {};
  for (const row of data || []) {
    const key = String(row.retailer_id);
    result[key] ||= { pending: 0, blocked: 0, sourceUnavailable: 0 };
    if (row.review_status === "PENDING") result[key].pending += 1;
    if (row.review_status === "FAILED") result[key].blocked += 1;
    if (row.review_status === "PENDING" && row.review_kind === "SOURCE_FAILURE") {
      result[key].sourceUnavailable += 1;
    }
  }

  return result;
}
