// Keep indexing and sitemap discovery disabled until a separate offer-freshness
// review explicitly approves a small launch-only change to this central status.
export const CREATINE_LAUNCH_STATUS = {
  phase: "implemented_prelaunch",
  allowIndexing: false,
  includeInSitemap: false,
  blocker: "offer_freshness_review_required",
} as const;

export const CREATINE_LAUNCH_THRESHOLDS = {
  minimumProducts: 10,
  minimumOffers: 8,
  minimumRetailers: 2,
  minimumProductsWithMultipleRetailers: 3,
  maximumOfferAgeHours: 24,
} as const;

export type CreatineLaunchReadinessInput = {
  activeProducts: number;
  activeOffers: number;
  retailers: number;
  productsWithMultipleRetailers: number;
  latestOfferCheckedAt: string | null;
  implementationChecks: {
    metadata: boolean;
    structuredData: boolean;
    methodology: boolean;
    provenance: boolean;
  };
  now?: Date;
};

export type CreatineLaunchBlocker =
  | "manual_index_launch_disabled"
  | "implementation_contract_incomplete"
  | "insufficient_products"
  | "insufficient_offers"
  | "insufficient_retailers"
  | "insufficient_multi_retailer_coverage"
  | "offer_freshness_unavailable"
  | "offers_stale";

export function evaluateCreatineLaunchReadiness(
  input: CreatineLaunchReadinessInput
) {
  const implementationReady = Object.values(input.implementationChecks).every(Boolean);
  const blockers: CreatineLaunchBlocker[] = [];

  if (!CREATINE_LAUNCH_STATUS.allowIndexing) {
    blockers.push("manual_index_launch_disabled");
  }

  if (!implementationReady) {
    blockers.push("implementation_contract_incomplete");
  }

  if (input.activeProducts < CREATINE_LAUNCH_THRESHOLDS.minimumProducts) {
    blockers.push("insufficient_products");
  }

  if (input.activeOffers < CREATINE_LAUNCH_THRESHOLDS.minimumOffers) {
    blockers.push("insufficient_offers");
  }

  if (input.retailers < CREATINE_LAUNCH_THRESHOLDS.minimumRetailers) {
    blockers.push("insufficient_retailers");
  }

  if (
    input.productsWithMultipleRetailers <
    CREATINE_LAUNCH_THRESHOLDS.minimumProductsWithMultipleRetailers
  ) {
    blockers.push("insufficient_multi_retailer_coverage");
  }

  const latestCheckedAt = input.latestOfferCheckedAt
    ? Date.parse(input.latestOfferCheckedAt)
    : Number.NaN;

  if (!Number.isFinite(latestCheckedAt)) {
    blockers.push("offer_freshness_unavailable");
  } else {
    const now = input.now || new Date();
    const ageHours = (now.getTime() - latestCheckedAt) / 3_600_000;

    if (
      !Number.isFinite(ageHours) ||
      ageHours < 0 ||
      ageHours > CREATINE_LAUNCH_THRESHOLDS.maximumOfferAgeHours
    ) {
      blockers.push("offers_stale");
    }
  }

  return {
    pageImplementationReady: implementationReady,
    indexLaunchAllowed: blockers.length === 0,
    blockers,
  };
}
