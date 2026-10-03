import {
  capabilityForReview,
  confidenceForReview,
  decisionGroupForReview,
} from "../../lib/automationReviewCapabilityMatrix";

export const REVIEW_QUEUE_PAGE_SIZE = 50;
export const REVIEW_QUEUE_READ_BATCH_SIZE = 1000;
export const REVIEW_QUEUE_MAX_ROWS = 5000;

export type ReviewQueueScope = "DECISIONS" | "ALL";

export type ReviewQueueFilters = {
  status: string;
  retailer: string;
  kind: string;
  group: string;
  confidence: string;
  capability: string;
  query: string;
  scope: ReviewQueueScope;
};

export type ReviewQueueFilterableRow = {
  retailer: string;
  retailer_id: string | number | null;
  offer_id: string | number | null;
  product_title: string;
  variant_title: string | null;
  review_kind: string | null;
  operation_type: string | null;
  reason_codes: string;
  source_evidence: Record<string, unknown>;
  impact_summary: Record<string, unknown>;
};

export type ReviewQueueRow = ReviewQueueFilterableRow & {
  id: string | number;
  source_price: string | number | null;
  source_url: string | null;
  current_product_id: string | number | null;
  current_variant_id: string | number | null;
  review_status: string;
  before_state: Record<string, unknown> | null;
  proposed_state: Record<string, unknown> | null;
  source_captured_at: string | null;
  expires_at: string | null;
  source_row_fingerprint: string;
  plan_fingerprint: string | null;
  workflow_run_url: string | null;
  artifact_url: string | null;
  superseded_by_review_id: string | number | null;
  execution_error_code: string | null;
  execution_error_message: string | null;
  updated_at: string | null;
};

function searchableText(row: ReviewQueueFilterableRow) {
  return [
    row.retailer,
    row.product_title,
    row.variant_title,
    row.offer_id,
    row.operation_type,
    row.reason_codes,
  ].join(" ").toLocaleLowerCase("pl-PL");
}

export function normalizeReviewQueueScope(input: string): ReviewQueueScope {
  return input === "ALL" ? "ALL" : "DECISIONS";
}

export function filterAndPaginateReviewRows<T extends ReviewQueueFilterableRow>(
  sourceRows: readonly T[],
  filters: ReviewQueueFilters,
  requestedPage: number,
  pageSize = REVIEW_QUEUE_PAGE_SIZE,
) {
  const query = filters.query.trim().toLocaleLowerCase("pl-PL");
  const decisionRows = sourceRows.filter((row) => {
    const rowGroup = decisionGroupForReview(row.operation_type, row.review_kind, row.reason_codes);
    const rowConfidence = confidenceForReview(row.source_evidence, row.impact_summary);
    const rowCapability = capabilityForReview(row.retailer_id, row.operation_type, row.review_kind).capability;
    return (filters.scope === "ALL" || rowCapability !== "AUTONOMOUS")
      && (!filters.kind || row.review_kind === filters.kind)
      && (!filters.group || rowGroup === filters.group)
      && (!filters.confidence || rowConfidence === filters.confidence)
      && (!filters.capability || rowCapability === filters.capability);
  });
  const retailers = Array.from(new Set(decisionRows.map((row) => row.retailer))).sort((left, right) => left.localeCompare(right, "pl"));
  const matchingRows = decisionRows.filter((row) =>
    (!filters.retailer || row.retailer === filters.retailer)
    && (!query || searchableText(row).includes(query))
  );
  const total = matchingRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * pageSize;
  return {
    rows: matchingRows.slice(start, start + pageSize),
    total,
    page,
    totalPages,
    retailers,
  };
}

export function reviewQueuePageHref(filters: ReviewQueueFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "PENDING") params.set("status", filters.status);
  if (filters.retailer) params.set("retailer", filters.retailer);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.group) params.set("group", filters.group);
  if (filters.confidence) params.set("confidence", filters.confidence);
  if (filters.capability) params.set("capability", filters.capability);
  if (filters.scope === "ALL") params.set("scope", "ALL");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "?";
}
