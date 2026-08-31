export type ReviewCapability = "AUTONOMOUS" | "REVIEW_EXECUTABLE" | "REVIEW_ONLY" | "UNSUPPORTED";
export type ReviewDecisionGroup = "Freshness-only" | "Stock and price" | "Identity" | "Source problems";

type CapabilityCell = {
  capability: ReviewCapability;
  reason: string;
  workflow?: string;
};

export type RetailerCapabilityRow = {
  retailer: string;
  retailerId: string;
  operations: Record<string, CapabilityCell>;
};

const REVIEW_ONLY = (reason: string, workflow?: string): CapabilityCell => ({ capability: "REVIEW_ONLY", reason, workflow });
const UNSUPPORTED = (reason: string): CapabilityCell => ({ capability: "UNSUPPORTED", reason });
const AUTONOMOUS = (reason: string, workflow: string): CapabilityCell => ({ capability: "AUTONOMOUS", reason, workflow });
const REVIEW_EXECUTABLE = (reason: string, workflow: string): CapabilityCell => ({ capability: "REVIEW_EXECUTABLE", reason, workflow });

const defaultOperations = {
  VERIFY_NO_CHANGE: UNSUPPORTED("No retailer-specific protected freshness workflow is registered for this retailer in the Review Queue capability map."),
  UPDATE_PRICE: UNSUPPORTED("No protected commercial-update path is registered for this retailer in Review Queue."),
  UPDATE_STOCK: UNSUPPORTED("No protected commercial-update path is registered for this retailer in Review Queue."),
  UPDATE_PRICE_AND_STOCK: UNSUPPORTED("No protected combined commercial-update path is registered for this retailer in Review Queue."),
  IDENTITY_PROMOTION: UNSUPPORTED("Identity promotion requires explicit owner evidence and a retailer-specific protected path."),
  REBIND_EXISTING_VARIANT: UNSUPPORTED("Rebinds require explicit owner evidence and a retailer-specific protected path."),
  SOURCE_MISSING: REVIEW_ONLY("Missing source evidence must remain isolated for owner review; no automatic catalogue change is allowed."),
  UNAVAILABLE_DECISION: REVIEW_ONLY("Unavailable decisions require explicit owner confirmation and must not be inferred from a missing source."),
};

export const AUTOMATION_REVIEW_CAPABILITY_MATRIX: readonly RetailerCapabilityRow[] = Object.freeze([
  {
    retailer: "eBay UK",
    retailerId: "12",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: REVIEW_EXECUTABLE("Single-row immutable Review Queue freshness execution is registered and artifact-bound.", "ebay-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Commercial eBay deltas stay in review; the registered Review Queue adapter is freshness-only."),
      IDENTITY_PROMOTION: REVIEW_ONLY("eBay identity conflicts stay in review; offer 2686 remains review-only."),
      REBIND_EXISTING_VARIANT: REVIEW_ONLY("eBay rebinds stay in review; no identity apply is authorized by the adapter."),
    },
  },
  {
    retailer: "6 Pack Supplements",
    retailerId: "11",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected 6 Pack workflow supports freshness confirmations through the atomic importer RPC.", "six-pack-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Reviewed commercial batches require an owner-bound manifest and are not executable from generic Review Queue rows."),
      UPDATE_STOCK: REVIEW_ONLY("Reviewed stock batches require an owner-bound manifest and are not executable from generic Review Queue rows."),
      UPDATE_PRICE_AND_STOCK: REVIEW_ONLY("Reviewed commercial batches require an owner-bound manifest and are not executable from generic Review Queue rows."),
    },
  },
  {
    retailer: "KIOR Health",
    retailerId: "8",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected KIOR offer-refresh workflow is freshness-safe for approved scope.", "kior-offer-refresh.yml"),
    },
  },
  {
    retailer: "Jon's Supplements",
    retailerId: "10",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected Jon's workflow supports approved freshness confirmations.", "jons-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Commercial changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_STOCK: REVIEW_ONLY("Stock changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_PRICE_AND_STOCK: REVIEW_ONLY("Combined changes require retailer-specific reviewed evidence and owner approval."),
      IDENTITY_PROMOTION: REVIEW_ONLY("Identity changes are never autonomous."),
      REBIND_EXISTING_VARIANT: REVIEW_ONLY("Rebinds are never autonomous."),
    },
  },
  {
    retailer: "Fit House",
    retailerId: "9",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected Fit House workflow supports approved freshness confirmations.", "fit-house-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Commercial changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_STOCK: REVIEW_ONLY("Stock changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_PRICE_AND_STOCK: REVIEW_ONLY("Combined changes require retailer-specific reviewed evidence and owner approval."),
    },
  },
  {
    retailer: "Simply Supplements",
    retailerId: "7",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected Simply Supplements workflow supports approved freshness confirmations.", "simply-supplements-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Commercial changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_STOCK: REVIEW_ONLY("Stock changes require retailer-specific reviewed evidence and owner approval."),
      UPDATE_PRICE_AND_STOCK: REVIEW_ONLY("Combined changes require retailer-specific reviewed evidence and owner approval."),
    },
  },
  {
    retailer: "Discount Supplements",
    retailerId: "4",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected Discount Supplements workflow supports immutable approved freshness scope.", "creatine-offer-refresh.yml"),
      UPDATE_PRICE: REVIEW_ONLY("Commercial Discount deltas require a refreshed owner-approved manifest; do not auto-extend immutable scope."),
      UPDATE_STOCK: REVIEW_ONLY("Stock Discount deltas require a refreshed owner-approved manifest; do not auto-extend immutable scope."),
      UPDATE_PRICE_AND_STOCK: REVIEW_ONLY("Combined Discount deltas require a refreshed owner-approved manifest; do not auto-extend immutable scope."),
    },
  },
  {
    retailer: "Whey Okay",
    retailerId: "3",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing protected Whey Okay workflow supports approved exact-identity freshness, but current dry-run is blocked by an active/conflicting session.", "whey-okay-offer-refresh.yml"),
      IDENTITY_PROMOTION: REVIEW_ONLY("Identity promotions require owner approval and exact evidence; no automatic catalogue change is allowed."),
      REBIND_EXISTING_VARIANT: REVIEW_ONLY("Rebinds require owner approval and exact evidence; no automatic catalogue change is allowed."),
      SOURCE_MISSING: REVIEW_ONLY("Source failures remain review-only until a fresh capture resolves or confirms the source problem."),
    },
  },
  {
    retailer: "Dolphin Fitness",
    retailerId: "5",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing Dolphin workflow supports guarded freshness-only refresh for the approved exact product.", "dolphin-vegan-protein-offer-refresh.yml"),
      IDENTITY_PROMOTION: REVIEW_ONLY("Flavour-specific identity concerns require owner review; do not create variants or rebind automatically."),
      REBIND_EXISTING_VARIANT: REVIEW_ONLY("Dolphin rebind decisions require explicit owner approval."),
    },
  },
  {
    retailer: "GYM HIGH",
    retailerId: "1",
    operations: {
      ...defaultOperations,
      VERIFY_NO_CHANGE: AUTONOMOUS("Existing full-catalogue validate/apply workflow is protected by reviewed control bindings.", "gym-high-full-catalogue-apply.yml"),
      REBIND_EXISTING_VARIANT: REVIEW_ONLY("GYM HIGH mapping drift remains owner-reviewed unless the issue is proven to be stale configuration only."),
      IDENTITY_PROMOTION: REVIEW_ONLY("Identity changes are never autonomous."),
    },
  },
]);

export function capabilityForReview(retailerId: string | number | null, operationType: string | null, reviewKind?: string | null) {
  const normalizedOperation = normalizeOperation(operationType, reviewKind);
  const retailer = AUTOMATION_REVIEW_CAPABILITY_MATRIX.find((item) => item.retailerId === String(retailerId));
  if (!retailer) return { capability: "UNSUPPORTED" as ReviewCapability, reason: "Retailer is not present in the capability matrix.", workflow: undefined, operation: normalizedOperation };
  const cell = retailer.operations[normalizedOperation] || UNSUPPORTED(`Operation ${normalizedOperation} is not registered for this retailer.`);
  return { ...cell, operation: normalizedOperation };
}

export function decisionGroupForReview(operationType: string | null, reviewKind?: string | null, reasonCodes?: string | null): ReviewDecisionGroup {
  const operation = normalizeOperation(operationType, reviewKind);
  const reasons = String(reasonCodes || "");
  if (operation === "VERIFY_NO_CHANGE") return "Freshness-only";
  if (["UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK"].includes(operation)) return "Stock and price";
  if (["IDENTITY_PROMOTION", "REBIND_EXISTING_VARIANT"].includes(operation) || ["IDENTITY_CONFLICT", "MAPPING_DRIFT"].includes(String(reviewKind || ""))) return "Identity";
  if (["SOURCE_MISSING", "UNAVAILABLE_DECISION"].includes(operation) || String(reviewKind || "") === "SOURCE_FAILURE" || /SOURCE|UNAVAILABLE|MISSING/.test(reasons)) return "Source problems";
  return "Identity";
}

export function confidenceForReview(sourceEvidence: Record<string, unknown> | null | undefined, impactSummary: Record<string, unknown> | null | undefined) {
  const value = sourceEvidence?.confidence || sourceEvidence?.identity_confidence || impactSummary?.confidence || impactSummary?.recommendation_confidence || "RECORDED";
  return String(value).toUpperCase();
}

function normalizeOperation(operationType: string | null, reviewKind?: string | null) {
  const operation = String(operationType || "").toUpperCase();
  if (operation === "VERIFY_OFFER_NO_CHANGE") return "VERIFY_NO_CHANGE";
  if (operation) return operation;
  if (reviewKind === "SOURCE_FAILURE") return "SOURCE_MISSING";
  if (reviewKind === "MAPPING_DRIFT") return "REBIND_EXISTING_VARIANT";
  if (reviewKind === "IDENTITY_CONFLICT") return "IDENTITY_PROMOTION";
  return "UNKNOWN";
}
