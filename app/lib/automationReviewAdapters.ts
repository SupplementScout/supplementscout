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
};

export const REVIEW_ADAPTERS: readonly ReviewAdapter[] = Object.freeze([
  Object.freeze({
    retailerId: "12",
    retailerSlug: "ebay-uk",
    operations: Object.freeze(["VERIFY_NO_CHANGE"]),
    reasonCodes: Object.freeze(["FRESHNESS_CONFIRMATION", "STALE_OFFER", "NO_CHANGE_CONFIRMATION"]),
    workflow: "ebay-offer-refresh.yml",
    environment: "production-readonly",
    builder: "scripts/ebay-offer-refresh.js",
    approvalRpc: "approve_product_import_plan",
    applyRpc: "apply_approved_product_import_plan",
    postflight: "scripts/retailer-offer-refresh-postflight.js#ebay-uk",
    idempotency: "fresh exact-item VERIFY_NO_CHANGE rebuild",
    autonomous: true,
    ownerDecisionRequired: true,
    maximumBatch: 1,
    isolation: "per-row",
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

export function reviewDispatchConfigured() {
  return Boolean(process.env.AUTOMATION_REVIEW_GITHUB_TOKEN);
}
