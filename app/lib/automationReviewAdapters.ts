import "server-only";

export type ReviewAdapter = {
  retailerId: string;
  retailerSlug: string;
  operations: readonly string[];
  reasonCodes: readonly string[];
  workflow: string;
  environment: string;
  builder: string;
  approvalRpc: string;
  applyRpc: string;
  postflight: string;
  idempotency: string;
  autonomous: boolean;
  ownerDecisionRequired: boolean;
  maximumBatch: number;
  isolation: "per-row";
  reviewBinding: "immutable-review-record";
  manualCatalogueBinding: {
    kind: "control-plane-request";
    requiredEvidence: readonly string[];
    semanticTimestampPolicy: "capture-time-only";
  };
};

export const REVIEW_ADAPTERS: readonly ReviewAdapter[] = Object.freeze([
  Object.freeze({
    retailerId: "12",
    retailerSlug: "ebay-uk",
    operations: Object.freeze(["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK"]),
    reasonCodes: Object.freeze(["FRESHNESS_CONFIRMATION", "STALE_OFFER", "NO_CHANGE_CONFIRMATION", "PRICE_CHANGE", "STOCK_CHANGE"]),
    workflow: "automation-review-queue-worker.yml",
    environment: "production-readonly",
    builder: "scripts/ebay-offer-refresh.js",
    approvalRpc: "approve_product_import_plan",
    applyRpc: "apply_approved_product_import_plan",
    postflight: "scripts/retailer-offer-refresh-postflight.js#ebay-uk",
    idempotency: "fresh exact-item rebuild must resolve to VERIFY_NO_CHANGE after apply",
    autonomous: true,
    ownerDecisionRequired: true,
    maximumBatch: 1,
    isolation: "per-row",
    reviewBinding: "immutable-review-record",
    manualCatalogueBinding: Object.freeze({
      kind: "control-plane-request",
      requiredEvidence: Object.freeze(["execution_request_id", "review_item_id", "review_fingerprint", "review_plan_fingerprint", "execution_idempotency_key"]),
      semanticTimestampPolicy: "capture-time-only",
    }),
  }),
  Object.freeze({
    retailerId: "9",
    retailerSlug: "fit-house",
    operations: Object.freeze(["UPDATE_STOCK"]),
    reasonCodes: Object.freeze(["STOCK_CHANGE"]),
    workflow: "automation-review-queue-worker.yml",
    environment: "production-readonly",
    builder: "scripts/fit-house-offer-refresh.js#reviewQueueSelection",
    approvalRpc: "approve_retailer_offer_sync_batch",
    applyRpc: "execute_retailer_offer_sync_batch",
    postflight: "scripts/retailer-offer-refresh-postflight.js#fit-house",
    idempotency: "fresh full-scope rebuild must resolve the selected offer to VERIFY_NO_CHANGE after apply",
    autonomous: true,
    ownerDecisionRequired: true,
    maximumBatch: 1,
    isolation: "per-row",
    reviewBinding: "immutable-review-record",
    manualCatalogueBinding: Object.freeze({
      kind: "control-plane-request",
      requiredEvidence: Object.freeze(["execution_request_id", "review_item_id", "review_fingerprint", "review_plan_fingerprint", "execution_idempotency_key"]),
      semanticTimestampPolicy: "capture-time-only",
    }),
  }),
]);

function parsedReasons(value: string | null | undefined) {
  return String(value || "").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

export function resolveReviewAdapter(retailerId: string | number | null, operationType: string | null, reasonCodes: string | null) {
  const adapter = REVIEW_ADAPTERS.find((candidate) => candidate.retailerId === String(retailerId)) || null;
  if (!adapter) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: "No protected review worker is registered for this retailer." } as const;
  if (!operationType || !adapter.operations.includes(operationType)) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: `The protected adapter does not support ${operationType || "an unknown operation"}.` } as const;
  const reasons = parsedReasons(reasonCodes);
  if (!reasons.length || reasons.some((reason) => !adapter.reasonCodes.includes(reason))) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: "The review reason is not in the adapter allowlist." } as const;
  return { adapter, code: "SUPPORTED", reason: null } as const;
}

export function reviewQueueConfigured() {
  return process.env.AUTOMATION_REVIEW_QUEUE_ENABLED !== "false";
}

export function reviewDispatchConfigured() {
  return reviewQueueConfigured();
}
