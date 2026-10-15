export type CategoryDecisionReasonType =
  | "lowest_delivered_total"
  | "best_verified_value"
  | "broadest_retailer_coverage";

export type CategoryDecisionValueBasis =
  | "cost_per_25g_protein"
  | "cost_per_5g_creatine";

export type CategoryDecisionCandidate = {
  id: string;
  name: string;
  brand: string | null;
  productUrl: string;
  deliveredTotal: number | null;
  verifiedValue: number | null;
  valueBasis: CategoryDecisionValueBasis | null;
  retailerCount: number;
  offerCount: number;
  lastCheckedAt: string | null;
};

export type CategoryDecisionReason = {
  type: CategoryDecisionReasonType;
  value: number;
  valueBasis: CategoryDecisionValueBasis | null;
};

export type CategoryDecisionAnswer = CategoryDecisionCandidate & {
  reasons: CategoryDecisionReason[];
};

type SharedCategoryDecisionRow = {
  id: string;
  name: string;
  brand: string | null;
  productUrl: string;
  bestOffer: {
    deliveredPrice: { totalPrice: number } | null;
  } | null;
  retailerCount: number;
  offerCount: number;
  lastCheckedAt: string | null;
  costPer25gProtein: number | null;
};

type CreatineDecisionRow = {
  id: string;
  name: string;
  brand: string | null;
  productUrl: string;
  bestOffer: {
    deliveredPrice: { totalPrice: number } | null;
  } | null;
  retailerCount: number;
  offerCount: number;
  lastCheckedAt: string | null;
  verifiedCostPer5g: number | null;
};

function positiveFinite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function categoryDecisionCandidates(
  rows: SharedCategoryDecisionRow[],
  options: { valueBasis?: "cost_per_25g_protein" } = {}
): CategoryDecisionCandidate[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    productUrl: row.productUrl,
    deliveredTotal: positiveFinite(
      row.bestOffer?.deliveredPrice?.totalPrice
    ),
    verifiedValue:
      options.valueBasis === "cost_per_25g_protein"
        ? positiveFinite(row.costPer25gProtein)
        : null,
    valueBasis: options.valueBasis || null,
    retailerCount: Math.max(0, Math.trunc(row.retailerCount)),
    offerCount: Math.max(0, Math.trunc(row.offerCount)),
    lastCheckedAt: row.lastCheckedAt,
  }));
}

export function creatineDecisionCandidates(
  rows: CreatineDecisionRow[]
): CategoryDecisionCandidate[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    productUrl: row.productUrl,
    deliveredTotal: positiveFinite(
      row.bestOffer?.deliveredPrice?.totalPrice
    ),
    verifiedValue: positiveFinite(row.verifiedCostPer5g),
    valueBasis: "cost_per_5g_creatine",
    retailerCount: Math.max(0, Math.trunc(row.retailerCount)),
    offerCount: Math.max(0, Math.trunc(row.offerCount)),
    lastCheckedAt: row.lastCheckedAt,
  }));
}

function stableIdentitySort(
  left: CategoryDecisionCandidate,
  right: CategoryDecisionCandidate
) {
  return left.id.localeCompare(right.id, "en", { numeric: true });
}

function knownDeliveredTotal(candidate: CategoryDecisionCandidate) {
  return candidate.deliveredTotal ?? Number.POSITIVE_INFINITY;
}

export function selectCategoryDecisionAnswers(
  candidates: CategoryDecisionCandidate[]
): CategoryDecisionAnswer[] {
  const reasons: Array<{
    candidate: CategoryDecisionCandidate;
    reason: CategoryDecisionReason;
  }> = [];

  const lowestDelivered = candidates
    .filter((candidate) => candidate.deliveredTotal !== null)
    .sort(
      (left, right) =>
        knownDeliveredTotal(left) - knownDeliveredTotal(right) ||
        stableIdentitySort(left, right)
    )[0];

  if (lowestDelivered && lowestDelivered.deliveredTotal !== null) {
    reasons.push({
      candidate: lowestDelivered,
      reason: {
        type: "lowest_delivered_total",
        value: lowestDelivered.deliveredTotal,
        valueBasis: null,
      },
    });
  }

  const bestVerifiedValue = candidates
    .filter(
      (candidate) =>
        candidate.verifiedValue !== null && candidate.valueBasis !== null
    )
    .sort(
      (left, right) =>
        (left.verifiedValue as number) - (right.verifiedValue as number) ||
        stableIdentitySort(left, right)
    )[0];

  if (
    bestVerifiedValue &&
    bestVerifiedValue.verifiedValue !== null &&
    bestVerifiedValue.valueBasis
  ) {
    reasons.push({
      candidate: bestVerifiedValue,
      reason: {
        type: "best_verified_value",
        value: bestVerifiedValue.verifiedValue,
        valueBasis: bestVerifiedValue.valueBasis,
      },
    });
  }

  const broadestCoverage = candidates
    .filter((candidate) => candidate.retailerCount >= 2)
    .sort(
      (left, right) =>
        right.retailerCount - left.retailerCount ||
        right.offerCount - left.offerCount ||
        knownDeliveredTotal(left) - knownDeliveredTotal(right) ||
        stableIdentitySort(left, right)
    )[0];

  if (broadestCoverage) {
    reasons.push({
      candidate: broadestCoverage,
      reason: {
        type: "broadest_retailer_coverage",
        value: broadestCoverage.retailerCount,
        valueBasis: null,
      },
    });
  }

  const answers = new Map<string, CategoryDecisionAnswer>();

  for (const { candidate, reason } of reasons) {
    const existing = answers.get(candidate.id);
    if (existing) {
      existing.reasons.push(reason);
    } else {
      answers.set(candidate.id, { ...candidate, reasons: [reason] });
    }
  }

  return [...answers.values()];
}
