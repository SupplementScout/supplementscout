import {
  isOfferFresh,
  MAXIMUM_CURRENT_OFFER_AGE_DAYS,
  MAXIMUM_CURRENT_OFFER_AGE_HOURS,
} from "./offerFreshness";

export const CREATINE_LAUNCH_STATUS = {
  phase: "fresh_offer_launch",
  allowIndexing: true,
  includeInSitemap: true,
  blocker: null,
} as const;

export const CREATINE_LAUNCH_THRESHOLDS = {
  minimumProducts: 10,
  minimumOffers: 8,
  minimumRetailers: 2,
  minimumProductsWithMultipleRetailers: 3,
  maximumOfferAgeDays: MAXIMUM_CURRENT_OFFER_AGE_DAYS,
  maximumOfferAgeHours: MAXIMUM_CURRENT_OFFER_AGE_HOURS,
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

export function isCreatineOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  return isOfferFresh(checkedAt, now);
}

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

  if (!input.latestOfferCheckedAt) {
    blockers.push("offer_freshness_unavailable");
  } else if (!isCreatineOfferFresh(input.latestOfferCheckedAt, input.now || new Date())) {
    blockers.push("offers_stale");
  }

  return {
    pageImplementationReady: implementationReady,
    indexLaunchAllowed: blockers.length === 0,
    blockers,
  };
}
