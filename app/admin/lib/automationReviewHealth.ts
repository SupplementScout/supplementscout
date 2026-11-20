import { loadReviewQueuePage } from "./automationReviewQueueData";

export type AutomationReviewCounts = Record<
  string,
  { pending: number; blocked: number; sourceUnavailable: number }
>;

const WORK_COUNTS = ["decide", "execute", "processing", "technical", "completed", "total"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export async function loadAutomationReviewCounts(): Promise<AutomationReviewCounts | null> {
  try {
    const { data, error } = await loadReviewQueuePage({
      status: "ALL", retailer: "", kind: "", group: "", confidence: "", capability: "", query: "",
      scope: "DECISIONS", bucket: "ALL", display: "WORK", history: false,
    }, 1);
    if (error || !data) return null;

    const summary: unknown = data.summary;
    if (!isRecord(summary) || !Array.isArray(summary.retailers)
      || !WORK_COUNTS.every(key => isCount(summary[key]))
      || !isCount(summary.ownerRemaining) || !isCount(summary.completedToday) || !isCount(summary.submittedToday)
      || summary.ownerRemaining !== Number(summary.decide) + Number(summary.execute)
      || summary.total !== data.total) return null;

    const result: AutomationReviewCounts = {};
    const sums = { decide: 0, execute: 0, processing: 0, technical: 0, completed: 0, total: 0 };
    for (const row of summary.retailers) {
      if (!isRecord(row) || typeof row.retailer !== "string" || !row.retailer.trim()
        || !["string", "number"].includes(typeof row.retailer_id)
        || !/^[1-9]\d*$/.test(String(row.retailer_id)) || !Number.isSafeInteger(Number(row.retailer_id))
        || !WORK_COUNTS.every(key => isCount(row[key]))
        || !isCount(row.pending) || !isCount(row.source_unavailable) || !isCount(row.blocked)
        || row.source_unavailable > row.pending || row.pending + row.blocked > Number(row.total)
        || row.pending < Number(row.decide)
        || row.pending - Number(row.decide) + row.blocked > Number(row.technical)
        || Number(row.decide) + Number(row.execute) + Number(row.processing)
          + Number(row.technical) + Number(row.completed) !== row.total) return null;

      const key = String(row.retailer_id);
      if (Object.hasOwn(result, key)) return null;
      result[key] = { pending: row.pending, blocked: row.blocked, sourceUnavailable: row.source_unavailable };
      for (const field of WORK_COUNTS) sums[field] += Number(row[field]);
    }

    if (!WORK_COUNTS.every(key => isCount(sums[key]) && sums[key] === summary[key])) return null;
    return result;
  } catch {
    return null;
  }
}
