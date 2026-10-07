import {
  capabilityForReview,
  confidenceForReview,
  decisionGroupForReview,
} from "../../lib/automationReviewCapabilityMatrix";

export const REVIEW_QUEUE_PAGE_SIZE = 50;
export const REVIEW_QUEUE_WORK_PAGE_SIZE = 1;
export const REVIEW_QUEUE_READ_BATCH_SIZE = 1000;
export const REVIEW_QUEUE_MAX_ROWS = 5000;

export type ReviewQueueScope = "DECISIONS" | "ALL";
export type ReviewQueueWorkBucket = "DECIDE" | "EXECUTE" | "PROCESSING" | "TECHNICAL" | "COMPLETED" | "ALL";
export type ReviewQueueDisplay = "WORK" | "LIST";

export type ReviewQueueFilters = {
  status: string;
  retailer: string;
  kind: string;
  group: string;
  confidence: string;
  capability: string;
  query: string;
  scope: ReviewQueueScope;
  bucket?: ReviewQueueWorkBucket;
  display?: ReviewQueueDisplay;
  history?: boolean;
};

export type ReviewQueueFilterableRow = {
  id?: string | number;
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
  review_status?: string;
  expires_at?: string | null;
  plan_fingerprint?: string | null;
  superseded_by_review_id?: string | number | null;
  updated_at?: string | null;
  current_product_id?: string | number | null;
  current_variant_id?: string | number | null;
  execution_status?: string | null;
  execution_requested_at?: string | null;
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
    row.id,
    row.retailer,
    row.product_title,
    row.variant_title,
    row.offer_id,
    row.current_product_id,
    row.current_variant_id,
    row.operation_type,
    row.reason_codes,
    JSON.stringify(row.source_evidence || {}),
  ].join(" ").toLocaleLowerCase("pl-PL");
}

export function attachReviewExecutionState<T extends ReviewQueueRow>(rows: readonly T[], requests: readonly { review_id: string | number; review_fingerprint: string; plan_fingerprint: string; status: string; requested_at: string }[]) {
  const newest = new Map<string, typeof requests[number]>();
  for (const request of requests) {
    const key = String(request.review_id), previous = newest.get(key);
    if (!previous || Date.parse(request.requested_at) > Date.parse(previous.requested_at)) newest.set(key, request);
  }
  return rows.map((row) => {
    const request = newest.get(String(row.id));
    const matches = request?.review_fingerprint === row.source_row_fingerprint && request?.plan_fingerprint === row.plan_fingerprint;
    return { ...row, execution_status: request ? matches ? request.status : "EVIDENCE_CHANGED" : null, execution_requested_at: request?.requested_at || null };
  });
}

export function currentReviewRows<T extends ReviewQueueFilterableRow>(rows: readonly T[]) {
  const current = new Map<string, T>();
  for (const row of rows) {
    if (row.superseded_by_review_id) continue;
    const key = row.offer_id == null ? `review:${row.id}` : `offer:${row.retailer_id}:${row.offer_id}`;
    const previous = current.get(key);
    const rowUpdatedAt = Date.parse(row.updated_at || "") || 0;
    const previousUpdatedAt = Date.parse(previous?.updated_at || "") || 0;
    if (!previous || rowUpdatedAt > previousUpdatedAt || (rowUpdatedAt === previousUpdatedAt && Number(row.id || 0) > Number(previous.id || 0))) current.set(key, row);
  }
  return [...current.values()];
}

export function normalizeReviewQueueScope(input: string): ReviewQueueScope {
  return input === "ALL" ? "ALL" : "DECISIONS";
}

export function normalizeReviewQueueWorkBucket(input: string): ReviewQueueWorkBucket {
  return ["DECIDE", "EXECUTE", "PROCESSING", "TECHNICAL", "COMPLETED", "ALL"].includes(input) ? input as ReviewQueueWorkBucket : "DECIDE";
}

export function normalizeReviewQueueDisplay(input: string): ReviewQueueDisplay {
  return input === "LIST" ? "LIST" : "WORK";
}

export function reviewQueueLifecycle(row: ReviewQueueFilterableRow, now = Date.now()) {
  if (row.execution_status === "EVIDENCE_CHANGED") return "EVIDENCE_CHANGED";
  if (["QUEUED", "DISPATCHED", "EXECUTING"].includes(row.execution_status || "") && !["EXECUTED", "REJECTED", "IGNORED"].includes(row.review_status || "")) return row.execution_status!;
  return row.expires_at && new Date(row.expires_at).getTime() <= now && ["PENDING", "APPROVED"].includes(row.review_status || "") ? "EXPIRED" : String(row.review_status || "PENDING");
}

export function reviewQueueWorkBucket(row: ReviewQueueFilterableRow, now = Date.now()): Exclude<ReviewQueueWorkBucket, "ALL"> {
  const status = reviewQueueLifecycle(row, now);
  const capability = capabilityForReview(row.retailer_id, row.operation_type, row.review_kind).capability;
  if (row.execution_status === "EVIDENCE_CHANGED") return "TECHNICAL";
  if (["QUEUED", "DISPATCHED", "EXECUTING"].includes(row.execution_status || "")) return "PROCESSING";
  if (status === "APPROVED" && row.execution_status) return "TECHNICAL";
  if (status === "PENDING" && capability === "REVIEW_EXECUTABLE") return "DECIDE";
  if (status === "APPROVED" && capability === "REVIEW_EXECUTABLE" && row.plan_fingerprint) return "EXECUTE";
  if (status === "EXECUTING") return "PROCESSING";
  if (["EXECUTED", "REJECTED", "IGNORED", "EXPIRED"].includes(status)) return "COMPLETED";
  return "TECHNICAL";
}

export type ReviewQueueWorkSummary = {
  decide: number;
  execute: number;
  processing: number;
  technical: number;
  completed: number;
  completedToday: number;
  submittedToday: number;
  ownerRemaining: number;
  total: number;
  retailers: Array<{ retailer: string; decide: number; execute: number; processing: number; technical: number; completed: number; total: number }>;
};

function londonDate(input: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(input));
}

export function summarizeReviewQueue(sourceRows: readonly ReviewQueueFilterableRow[], now = Date.now()): ReviewQueueWorkSummary {
  const currentRows = sourceRows.filter((row) => !row.superseded_by_review_id && capabilityForReview(row.retailer_id, row.operation_type, row.review_kind).capability !== "AUTONOMOUS");
  const counts = { decide: 0, execute: 0, processing: 0, technical: 0, completed: 0 };
  const byRetailer = new Map<string, { retailer: string; decide: number; execute: number; processing: number; technical: number; completed: number; total: number }>();
  let completedToday = 0;
  let submittedToday = 0;
  for (const row of currentRows) {
    const bucket = reviewQueueWorkBucket(row, now);
    const key = bucket.toLocaleLowerCase("en-GB") as keyof typeof counts;
    counts[key] += 1;
    const retailer = byRetailer.get(row.retailer) || { retailer: row.retailer, decide: 0, execute: 0, processing: 0, technical: 0, completed: 0, total: 0 };
    retailer[bucket.toLocaleLowerCase("en-GB") as "decide" | "execute" | "processing" | "technical" | "completed"] += 1;
    retailer.total += 1;
    byRetailer.set(row.retailer, retailer);
    if (["EXECUTED", "REJECTED", "IGNORED"].includes(reviewQueueLifecycle(row, now)) && row.updated_at && londonDate(row.updated_at) === londonDate(now)) completedToday += 1;
    if (row.execution_requested_at && londonDate(row.execution_requested_at) === londonDate(now)) submittedToday += 1;
  }
  return {
    ...counts,
    completedToday,
    submittedToday,
    ownerRemaining: counts.decide + counts.execute,
    total: currentRows.length,
    retailers: [...byRetailer.values()].sort((left, right) => (right.decide + right.execute) - (left.decide + left.execute) || left.retailer.localeCompare(right.retailer, "pl")),
  };
}

export function filterAndPaginateReviewRows<T extends ReviewQueueFilterableRow>(
  sourceRows: readonly T[],
  filters: ReviewQueueFilters,
  requestedPage: number,
  pageSize = REVIEW_QUEUE_PAGE_SIZE,
) {
  const now = Date.now();
  const query = filters.query.trim().toLocaleLowerCase("pl-PL");
  const selectedBucket = normalizeReviewQueueWorkBucket(filters.bucket || "");
  const decisionRows = sourceRows.filter((row) => {
    const rowGroup = decisionGroupForReview(row.operation_type, row.review_kind, row.reason_codes);
    const rowConfidence = confidenceForReview(row.source_evidence, row.impact_summary);
    const rowCapability = capabilityForReview(row.retailer_id, row.operation_type, row.review_kind).capability;
    return (filters.scope === "ALL" || rowCapability !== "AUTONOMOUS")
      && (!filters.status || filters.status === "ALL" || reviewQueueLifecycle(row, now) === filters.status)
      && (selectedBucket === "ALL" || reviewQueueWorkBucket(row, now) === selectedBucket)
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
  if (filters.status && !["PENDING", "ALL"].includes(filters.status)) params.set("status", filters.status);
  if (filters.retailer) params.set("retailer", filters.retailer);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.group) params.set("group", filters.group);
  if (filters.confidence) params.set("confidence", filters.confidence);
  if (filters.capability) params.set("capability", filters.capability);
  if (filters.scope === "ALL") params.set("scope", "ALL");
  if (filters.bucket && filters.bucket !== "DECIDE") params.set("queue", filters.bucket);
  if (filters.display === "LIST") params.set("display", "LIST");
  if (filters.history) params.set("history", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "?";
}
