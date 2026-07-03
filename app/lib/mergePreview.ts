import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

type BigintId = number | string;

export type MergeProduct = {
  id: BigintId;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  servings: number | null;
  description: string | null;
  image: string | null;
  price: number | null;
  is_active: boolean | null;
  merged_into_product_id: BigintId | null;
  merged_at: string | null;
};

export type MergeOffer = {
  id: BigintId;
  product_id: BigintId;
  retailer_id: BigintId | null;
  price: number | null;
  shipping_cost: number | null;
  url: string | null;
  in_stock: boolean | null;
  retailer: { name: string | null } | null;
};

export type MergeOfferWithPriceHistoryCount = MergeOffer & {
  priceHistoryCount: number;
};

type RawMergeOffer = Omit<MergeOffer, "retailer"> & {
  retailer: { name: string | null } | { name: string | null }[] | null;
};

export type RetailerProductMapping = {
  id: BigintId;
  retailer_id: BigintId;
  product_id: BigintId;
  external_name: string;
  external_slug: string | null;
  external_gtin: string | null;
  external_url: string | null;
  match_method: string | null;
  match_confidence: number | null;
  retailer?: { name: string | null } | null;
};

type RawRetailerProductMapping = Omit<RetailerProductMapping, "retailer"> & {
  retailer?: { name: string | null } | { name: string | null }[] | null;
};

export type ProductMergeDetails = {
  product: MergeProduct;
  offers: MergeOffer[];
  retailerProducts: RetailerProductMapping[];
  priceHistoryCount: number;
};

export type MergeConflict = {
  type: string;
  label: string;
  detail: string;
};

export type MergePlanStatus = "safe" | "warning" | "blocked";

export type MergePlanItem = {
  id: string;
  status: MergePlanStatus;
  subject: string;
  reason: string;
  offerId?: BigintId;
  mappingId?: BigintId;
  retailer?: string;
  retailerId?: BigintId | null;
  url?: string | null;
  externalUrl?: string | null;
  externalGtin?: string | null;
  price?: number | null;
  shippingCost?: number | null;
  priceHistoryCount?: number;
};

export type MergePlan = {
  recommendation: "Blocked" | "Review required" | "Looks safe";
  summary: Record<MergePlanStatus, number>;
  productConflicts: MergePlanItem[];
  offers: MergePlanItem[];
  retailerProducts: MergePlanItem[];
  priceHistory: MergePlanItem[];
  transactionOrder: string[];
};

export type MergeDecisionValue = "keep_canonical" | "keep_candidate";

export type OfferDecisionConflict = {
  canonicalOffer: MergeOfferWithPriceHistoryCount;
  candidateOffer: MergeOfferWithPriceHistoryCount;
  retailerId: string;
  retailer: string;
};

export type RetailerProductDecisionConflict = {
  canonicalMapping: RetailerProductMapping;
  candidateMapping: RetailerProductMapping;
  retailerId: string;
  retailer: string;
};

export type MergeDecisionConflicts = {
  offerConflicts: OfferDecisionConflict[];
  retailerProductConflicts: RetailerProductDecisionConflict[];
};

export type MergeReadiness =
  | "blocked"
  | "review_required"
  | "ready"
  | "ready_with_decisions";

export type MergePreview = {
  canonical: ProductMergeDetails;
  candidate: ProductMergeDetails;
  conflicts: MergeConflict[];
  decisionConflicts: MergeDecisionConflicts;
  mergePlan: MergePlan;
  readiness: MergeReadiness;
};

type ComparableSize = {
  value: number;
  dimension: "mass" | "volume";
};

function normalizeText(value: string | null) {
  return String(value || "").trim().toLowerCase();
}

function idValue(value: BigintId) {
  return String(value);
}

function compareBigintStrings(left: string, right: string) {
  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return left.localeCompare(right);
}

function nonEmpty(value: string | null) {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function extractComparableSize(name = ""): ComparableSize | null {
  const match = String(name)
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "kg") {
    return { value: value * 1000, dimension: "mass" };
  }

  if (unit === "g") {
    return { value, dimension: "mass" };
  }

  if (unit === "l") {
    return { value: value * 1000, dimension: "volume" };
  }

  return { value, dimension: "volume" };
}

function formatComparableSize(size: ComparableSize) {
  return `${size.value} ${size.dimension}`;
}

function retailerLabel(offer: MergeOffer) {
  return offer.retailer?.name || `Retailer ${offer.retailer_id}`;
}

function getStatus(
  reasons: { status: MergePlanStatus; reason: string }[]
): MergePlanStatus {
  if (reasons.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  if (reasons.some((item) => item.status === "warning")) {
    return "warning";
  }

  return "safe";
}

function joinReasons(reasons: { reason: string }[], fallback: string) {
  if (reasons.length === 0) {
    return fallback;
  }

  return reasons.map((item) => item.reason).join(" ");
}

function normalizeOffer(offer: RawMergeOffer): MergeOffer {
  const retailer = Array.isArray(offer.retailer)
    ? offer.retailer[0] || null
    : offer.retailer;

  return {
    ...offer,
    retailer,
  };
}

function normalizeRetailerProductMapping(
  mapping: RawRetailerProductMapping
): RetailerProductMapping {
  const retailer = Array.isArray(mapping.retailer)
    ? mapping.retailer[0] || null
    : mapping.retailer || null;

  return {
    ...mapping,
    retailer,
  };
}

async function getPriceHistoryCounts(offerIds: BigintId[]) {
  const counts = new Map<string, number>();

  if (offerIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabaseAdmin
    .from("price_history")
    .select("offer_id")
    .in("offer_id", offerIds);

  if (error) {
    throw error;
  }

  for (const record of data || []) {
    const offerId = idValue(record.offer_id);
    counts.set(offerId, (counts.get(offerId) || 0) + 1);
  }

  return counts;
}

function repeatedBigintStrings(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts)
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort(compareBigintStrings);
}

function buildDecisionConflicts(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails,
  priceHistoryCounts: Map<string, number>
): MergeDecisionConflicts {
  const offerConflicts = canonical.offers.flatMap((canonicalOffer) => {
    if (canonicalOffer.retailer_id === null) {
      return [];
    }

    const retailerId = idValue(canonicalOffer.retailer_id);

    return candidate.offers
      .filter(
        (candidateOffer) =>
          candidateOffer.retailer_id !== null &&
          idValue(candidateOffer.retailer_id) === retailerId
      )
      .map((candidateOffer) => ({
        canonicalOffer: {
          ...canonicalOffer,
          priceHistoryCount: priceHistoryCounts.get(idValue(canonicalOffer.id)) || 0,
        },
        candidateOffer: {
          ...candidateOffer,
          priceHistoryCount: priceHistoryCounts.get(idValue(candidateOffer.id)) || 0,
        },
        retailerId,
        retailer:
          canonicalOffer.retailer?.name ||
          candidateOffer.retailer?.name ||
          `Retailer ${retailerId}`,
      }));
  });

  offerConflicts.sort(
    (left, right) =>
      compareBigintStrings(left.retailerId, right.retailerId) ||
      compareBigintStrings(
        idValue(left.canonicalOffer.id),
        idValue(right.canonicalOffer.id)
      ) ||
      compareBigintStrings(
        idValue(left.candidateOffer.id),
        idValue(right.candidateOffer.id)
      )
  );

  const retailerProductConflicts = canonical.retailerProducts.flatMap(
    (canonicalMapping) => {
      const retailerId = idValue(canonicalMapping.retailer_id);

      return candidate.retailerProducts
        .filter(
          (candidateMapping) =>
            idValue(candidateMapping.retailer_id) === retailerId
        )
        .map((candidateMapping) => ({
          canonicalMapping,
          candidateMapping,
          retailerId,
          retailer:
            canonicalMapping.retailer?.name ||
            candidateMapping.retailer?.name ||
            `Retailer ${retailerId}`,
        }));
    }
  );

  retailerProductConflicts.sort(
    (left, right) =>
      compareBigintStrings(left.retailerId, right.retailerId) ||
      compareBigintStrings(
        idValue(left.canonicalMapping.id),
        idValue(right.canonicalMapping.id)
      ) ||
      compareBigintStrings(
        idValue(left.candidateMapping.id),
        idValue(right.candidateMapping.id)
      )
  );

  return {
    offerConflicts,
    retailerProductConflicts,
  };
}

function getMergeReadiness(
  mergePlan: MergePlan,
  decisionConflicts: MergeDecisionConflicts
): MergeReadiness {
  if (mergePlan.summary.blocked > 0) {
    return "blocked";
  }

  if (
    decisionConflicts.offerConflicts.length > 0 ||
    decisionConflicts.retailerProductConflicts.length > 0 ||
    mergePlan.summary.warning > 0
  ) {
    return "review_required";
  }

  return "ready";
}

function buildConflicts(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails,
  decisionConflicts: MergeDecisionConflicts
) {
  const conflicts: MergeConflict[] = [];

  if (
    canonical.product.is_active === false ||
    canonical.product.merged_into_product_id !== null
  ) {
    conflicts.push({
      type: "canonical_merged_or_inactive",
      label: "Canonical product is already merged or inactive",
      detail: canonical.product.merged_into_product_id
        ? `Merged into product ${canonical.product.merged_into_product_id}`
        : "Canonical product is inactive.",
    });
  }

  if (
    candidate.product.is_active === false ||
    candidate.product.merged_into_product_id !== null
  ) {
    conflicts.push({
      type: "candidate_merged_or_inactive",
      label: "Candidate product is already merged or inactive",
      detail: candidate.product.merged_into_product_id
        ? `Merged into product ${candidate.product.merged_into_product_id}`
        : "Candidate product is inactive.",
    });
  }

  const decisionOfferPairs = new Set(
    decisionConflicts.offerConflicts.map(
      (conflict) =>
        `${idValue(conflict.canonicalOffer.id)}:${idValue(conflict.candidateOffer.id)}`
    )
  );
  const decisionMappingPairs = new Set(
    decisionConflicts.retailerProductConflicts.map(
      (conflict) =>
        `${idValue(conflict.canonicalMapping.id)}:${idValue(conflict.candidateMapping.id)}`
    )
  );
  const duplicateCanonicalOfferIds = repeatedBigintStrings(
    decisionConflicts.offerConflicts.map((conflict) =>
      idValue(conflict.canonicalOffer.id)
    )
  );
  const duplicateCandidateOfferIds = repeatedBigintStrings(
    decisionConflicts.offerConflicts.map((conflict) =>
      idValue(conflict.candidateOffer.id)
    )
  );
  const duplicateCanonicalMappingIds = repeatedBigintStrings(
    decisionConflicts.retailerProductConflicts.map((conflict) =>
      idValue(conflict.canonicalMapping.id)
    )
  );
  const duplicateCandidateMappingIds = repeatedBigintStrings(
    decisionConflicts.retailerProductConflicts.map((conflict) =>
      idValue(conflict.candidateMapping.id)
    )
  );

  if (duplicateCanonicalOfferIds.length > 0) {
    conflicts.push({
      type: "canonical_offer_multiple_decision_conflicts",
      label: "Canonical offer appears in multiple decision conflicts",
      detail: `Offer IDs: ${duplicateCanonicalOfferIds.join(", ")}`,
    });
  }

  if (duplicateCandidateOfferIds.length > 0) {
    conflicts.push({
      type: "candidate_offer_multiple_decision_conflicts",
      label: "Candidate offer appears in multiple decision conflicts",
      detail: `Offer IDs: ${duplicateCandidateOfferIds.join(", ")}`,
    });
  }

  if (duplicateCanonicalMappingIds.length > 0) {
    conflicts.push({
      type: "canonical_mapping_multiple_decision_conflicts",
      label: "Canonical retailer_products mapping appears in multiple decision conflicts",
      detail: `Mapping IDs: ${duplicateCanonicalMappingIds.join(", ")}`,
    });
  }

  if (duplicateCandidateMappingIds.length > 0) {
    conflicts.push({
      type: "candidate_mapping_multiple_decision_conflicts",
      label: "Candidate retailer_products mapping appears in multiple decision conflicts",
      detail: `Mapping IDs: ${duplicateCandidateMappingIds.join(", ")}`,
    });
  }

  const sharedOfferUrls = Array.from(
    new Set(
      canonical.offers.flatMap((canonicalOffer) => {
        const canonicalUrl = nonEmpty(canonicalOffer.url);

        if (!canonicalUrl) {
          return [];
        }

        const hasUnresolvedUrlConflict = candidate.offers.some(
          (candidateOffer) =>
            nonEmpty(candidateOffer.url) === canonicalUrl &&
            !decisionOfferPairs.has(
              `${idValue(canonicalOffer.id)}:${idValue(candidateOffer.id)}`
            )
        );

        return hasUnresolvedUrlConflict ? [canonicalUrl] : [];
      })
    )
  );

  if (sharedOfferUrls.length > 0) {
    conflicts.push({
      type: "same_offer_url",
      label: "Same offer URL",
      detail: sharedOfferUrls.join(", "),
    });
  }

  const sharedExternalUrls = Array.from(
    new Set(
      canonical.retailerProducts.flatMap((canonicalMapping) => {
        const canonicalUrl = nonEmpty(canonicalMapping.external_url);

        if (!canonicalUrl) {
          return [];
        }

        const hasUnresolvedUrlConflict = candidate.retailerProducts.some(
          (candidateMapping) =>
            nonEmpty(candidateMapping.external_url) === canonicalUrl &&
            !decisionMappingPairs.has(
              `${idValue(canonicalMapping.id)}:${idValue(candidateMapping.id)}`
            )
        );

        return hasUnresolvedUrlConflict ? [canonicalUrl] : [];
      })
    )
  );

  if (sharedExternalUrls.length > 0) {
    conflicts.push({
      type: "same_external_url",
      label: "Same retailer_products external URL",
      detail: sharedExternalUrls.join(", "),
    });
  }

  const canonicalGtin = nonEmpty(canonical.product.gtin);
  const candidateGtin = nonEmpty(candidate.product.gtin);

  if (canonicalGtin && candidateGtin && canonicalGtin !== candidateGtin) {
    conflicts.push({
      type: "different_gtin",
      label: "Different non-empty GTINs",
      detail: `${canonicalGtin} vs ${candidateGtin}`,
    });
  }

  const canonicalSize = extractComparableSize(canonical.product.name);
  const candidateSize = extractComparableSize(candidate.product.name);

  if (
    canonicalSize &&
    candidateSize &&
    (canonicalSize.value !== candidateSize.value ||
      canonicalSize.dimension !== candidateSize.dimension)
  ) {
    conflicts.push({
      type: "different_size",
      label: "Different detected sizes",
      detail: `${formatComparableSize(canonicalSize)} vs ${formatComparableSize(
        candidateSize
      )}`,
    });
  }

  if (
    normalizeText(canonical.product.brand) !==
    normalizeText(candidate.product.brand)
  ) {
    conflicts.push({
      type: "different_brand",
      label: "Different brands",
      detail: `${canonical.product.brand || "Missing"} vs ${
        candidate.product.brand || "Missing"
      }`,
    });
  }

  if (
    normalizeText(canonical.product.category) !==
    normalizeText(candidate.product.category)
  ) {
    conflicts.push({
      type: "different_category",
      label: "Different categories",
      detail: `${canonical.product.category || "Missing"} vs ${
        candidate.product.category || "Missing"
      }`,
    });
  }

  if (
    canonical.product.servings !== null &&
    candidate.product.servings !== null &&
    Number(canonical.product.servings) !== Number(candidate.product.servings)
  ) {
    conflicts.push({
      type: "different_servings",
      label: "Different servings",
      detail: `${canonical.product.servings} vs ${candidate.product.servings}`,
    });
  }

  return conflicts;
}

function buildMergePlan(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails,
  conflicts: MergeConflict[],
  priceHistoryCounts: Map<string, number>,
  decisionConflicts: MergeDecisionConflicts
): MergePlan {
  const productConflictStatusByType: Record<string, MergePlanStatus> = {
    different_gtin: "blocked",
    different_size: "blocked",
    different_brand: "blocked",
    different_category: "blocked",
    different_servings: "warning",
    canonical_merged_or_inactive: "blocked",
    candidate_merged_or_inactive: "blocked",
    canonical_offer_multiple_decision_conflicts: "blocked",
    candidate_offer_multiple_decision_conflicts: "blocked",
    canonical_mapping_multiple_decision_conflicts: "blocked",
    candidate_mapping_multiple_decision_conflicts: "blocked",
  };
  const productConflicts: MergePlanItem[] = conflicts
    .filter((conflict) => conflict.type in productConflictStatusByType)
    .map((conflict) => ({
      id: `product-conflict-${conflict.type}`,
      status: productConflictStatusByType[conflict.type],
      subject: conflict.label,
      reason: conflict.detail,
    }));
  const hasDecisionConflicts =
    decisionConflicts.offerConflicts.length > 0 ||
    decisionConflicts.retailerProductConflicts.length > 0;

  if (hasDecisionConflicts) {
    productConflicts.push({
      id: "product-conflict-merge-requires-decisions",
      status: "blocked",
      subject: "Merge requires administrator decisions",
      reason:
        "Merge requires administrator decisions and cannot use the simple merge path.",
    });
  }
  const canonicalRetailerIds = new Set(
    canonical.offers
      .map((offer) => offer.retailer_id)
      .filter((id): id is BigintId => id !== null)
      .map(idValue)
  );
  const canonicalMappingKeys = new Set(
    canonical.retailerProducts
      .map((mapping) => {
        const externalUrl = nonEmpty(mapping.external_url);
        return externalUrl
          ? `${idValue(mapping.retailer_id)}:${externalUrl}`
          : null;
      })
      .filter((key): key is string => Boolean(key))
  );
  const canonicalMappingRetailerIds = new Set(
    canonical.retailerProducts.map((mapping) => idValue(mapping.retailer_id))
  );
  const decisionCandidateOfferIds = new Set(
    decisionConflicts.offerConflicts.map((conflict) =>
      idValue(conflict.candidateOffer.id)
    )
  );
  const decisionCandidateMappingIds = new Set(
    decisionConflicts.retailerProductConflicts.map((conflict) =>
      idValue(conflict.candidateMapping.id)
    )
  );
  const offers: MergePlanItem[] = candidate.offers.map((offer) => {
    const reasons: { status: MergePlanStatus; reason: string }[] = [];
    const offerUrl = nonEmpty(offer.url);
    const offerId = idValue(offer.id);
    const isDecisionOffer = decisionCandidateOfferIds.has(idValue(offer.id));
    const hasBlockingOfferUrlConflict =
      offerUrl !== null &&
      canonical.offers.some(
        (canonicalOffer) =>
          nonEmpty(canonicalOffer.url) === offerUrl &&
          !decisionConflicts.offerConflicts.some(
            (conflict) =>
              idValue(conflict.canonicalOffer.id) ===
                idValue(canonicalOffer.id) &&
              idValue(conflict.candidateOffer.id) === offerId
          )
      );

    if (offer.retailer_id === null) {
      reasons.push({
        status: "warning",
        reason: "Missing retailer_id, so retailer uniqueness cannot be checked.",
      });
    } else if (
      !isDecisionOffer &&
      canonicalRetailerIds.has(idValue(offer.retailer_id))
    ) {
      reasons.push({
        status: "blocked",
        reason: "Canonical already has an offer for this retailer.",
      });
    }

    if (!offerUrl) {
      reasons.push({
        status: "warning",
        reason: "Missing offer URL, so URL uniqueness cannot be checked.",
      });
    } else if (hasBlockingOfferUrlConflict) {
      reasons.push({
        status: "blocked",
        reason: "Canonical already has an offer with this URL.",
      });
    }

    const status = getStatus(reasons);

    return {
      id: `offer-${offer.id}`,
      status,
      subject: `Offer ${offer.id}`,
      reason: joinReasons(reasons, "Candidate offer can be moved to canonical."),
      offerId: offer.id,
      retailer: retailerLabel(offer),
      retailerId: offer.retailer_id,
      url: offer.url,
      price: offer.price,
      shippingCost: offer.shipping_cost,
      priceHistoryCount: priceHistoryCounts.get(idValue(offer.id)) || 0,
    };
  });
  const retailerProducts: MergePlanItem[] = candidate.retailerProducts.map(
    (mapping) => {
      const reasons: { status: MergePlanStatus; reason: string }[] = [];
      const externalUrl = nonEmpty(mapping.external_url);
      const mappingId = idValue(mapping.id);
      const isDecisionMapping = decisionCandidateMappingIds.has(mappingId);
      const hasDecisionExternalUrlConflict =
        isDecisionMapping &&
        decisionConflicts.retailerProductConflicts.some(
          (conflict) =>
            idValue(conflict.candidateMapping.id) === mappingId &&
            externalUrl !== null &&
            nonEmpty(conflict.canonicalMapping.external_url) === externalUrl
        );
      const exactKey = externalUrl
        ? `${idValue(mapping.retailer_id)}:${externalUrl}`
        : null;

      if (!externalUrl) {
        reasons.push({
          status: "warning",
          reason:
            "Missing external_url, so uniqueness cannot be fully checked.",
        });
      } else if (
        exactKey &&
        canonicalMappingKeys.has(exactKey) &&
        !hasDecisionExternalUrlConflict
      ) {
        reasons.push({
          status: "blocked",
          reason:
            "Canonical already has a retailer_products mapping with the same retailer_id and external_url.",
        });
      } else if (
        !isDecisionMapping &&
        canonicalMappingRetailerIds.has(idValue(mapping.retailer_id))
      ) {
        reasons.push({
          status: "warning",
          reason:
            "Canonical has a retailer_products mapping for the same retailer with a different URL.",
        });
      }

      const candidateGtin = nonEmpty(mapping.external_gtin);
      const canonicalSameRetailerMappings = canonical.retailerProducts.filter(
        (canonicalMapping) =>
          idValue(canonicalMapping.retailer_id) === idValue(mapping.retailer_id)
      );
      const differentExternalGtins = canonicalSameRetailerMappings
        .map((canonicalMapping) => nonEmpty(canonicalMapping.external_gtin))
        .filter(
          (canonicalGtin): canonicalGtin is string =>
            Boolean(canonicalGtin) &&
            Boolean(candidateGtin) &&
            canonicalGtin !== candidateGtin
        );

      if (candidateGtin && differentExternalGtins.length > 0) {
        reasons.push({
          status: "warning",
          reason:
            "Canonical has a non-empty external_gtin for this retailer that differs from the candidate mapping.",
        });
      }

      const status = getStatus(reasons);

      return {
        id: `retailer-product-${mapping.id}`,
        status,
        subject: `Retailer product mapping ${mapping.id}`,
        reason: joinReasons(
          reasons,
          "Candidate retailer_products mapping can be moved to canonical."
        ),
        mappingId: mapping.id,
        retailerId: mapping.retailer_id,
        externalUrl: mapping.external_url,
        externalGtin: mapping.external_gtin,
      };
    }
  );
  const priceHistory: MergePlanItem[] = candidate.offers.map((offer) => {
    const offerPlan = offers.find(
      (item) =>
        item.offerId !== undefined && idValue(item.offerId) === idValue(offer.id)
    );
    const status =
      offerPlan?.status === "blocked"
        ? "blocked"
        : offerPlan?.status === "warning"
          ? "warning"
          : "safe";

    return {
      id: `price-history-${offer.id}`,
      status,
      subject: `Price history for offer ${offer.id}`,
      reason:
        status === "safe"
          ? "Price history stays attached to the existing offer_id."
          : status === "blocked"
            ? "Price history cannot be safely preserved until the offer conflict is resolved."
            : "Price history can stay attached to the offer_id, but the offer needs review first.",
      offerId: offer.id,
      retailer: retailerLabel(offer),
      retailerId: offer.retailer_id,
      url: offer.url,
      priceHistoryCount: priceHistoryCounts.get(idValue(offer.id)) || 0,
    };
  });
  const allItems: MergePlanItem[] = [
    ...productConflicts,
    ...offers,
    ...retailerProducts,
    ...priceHistory,
  ];
  const summary = allItems.reduce<Record<MergePlanStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      safe: 0,
      warning: 0,
      blocked: 0,
    }
  );
  const recommendation =
    summary.blocked > 0
      ? "Blocked"
      : summary.warning > 0
        ? "Review required"
        : "Looks safe";

  return {
    recommendation,
    summary,
    productConflicts,
    offers,
    retailerProducts,
    priceHistory,
    transactionOrder: [
      "BEGIN",
      "Re-read and lock both product rows.",
      "Resolve offer conflicts.",
      "Move safe offers from candidate to canonical.",
      "Move safe retailer_products mappings from candidate to canonical.",
      "Preserve price_history on existing offer_id records.",
      "Decide what should happen to the candidate product.",
      "COMMIT",
    ],
  };
}

export async function getMergePreview(
  canonicalId: BigintId,
  candidateId: BigintId
): Promise<MergePreview | null> {
  const canonicalIdValue = idValue(canonicalId);
  const candidateIdValue = idValue(candidateId);

  const { data: canonicalProductData, error: canonicalProductError } =
    await supabaseAdmin
      .from("products")
      .select(
        "id, name, slug, gtin, brand, category, servings, description, image, price, is_active, merged_into_product_id, merged_at"
      )
      .eq("id", canonicalId)
      .maybeSingle();

  if (canonicalProductError) {
    throw canonicalProductError;
  }

  const { data: candidateProductData, error: candidateProductError } =
    await supabaseAdmin
      .from("products")
      .select(
        "id, name, slug, gtin, brand, category, servings, description, image, price, is_active, merged_into_product_id, merged_at"
      )
      .eq("id", candidateId)
      .maybeSingle();

  if (candidateProductError) {
    throw candidateProductError;
  }

  const canonicalProduct = canonicalProductData as MergeProduct | null;
  const candidateProduct = candidateProductData as MergeProduct | null;

  if (!canonicalProduct || !candidateProduct) {
    return null;
  }

  const { data: offersData, error: offersError } = await supabaseAdmin
    .from("offers")
    .select(
      "id, product_id, retailer_id, price, shipping_cost, url, in_stock, retailer:retailers(name)"
    )
    .in("product_id", [canonicalId, candidateId])
    .order("retailer_id");

  if (offersError) {
    throw offersError;
  }

  const { data: retailerProductsData, error: retailerProductsError } =
    await supabaseAdmin
      .from("retailer_products")
      .select(
        "id, retailer_id, product_id, external_name, external_slug, external_gtin, external_url, match_method, match_confidence, retailer:retailers(name)"
      )
      .in("product_id", [canonicalId, candidateId])
      .order("retailer_id");

  if (retailerProductsError) {
    throw retailerProductsError;
  }

  const offers = ((offersData || []) as RawMergeOffer[]).map(normalizeOffer);
  const retailerProducts = (
    (retailerProductsData || []) as RawRetailerProductMapping[]
  ).map(normalizeRetailerProductMapping);
  const canonicalOffers = offers.filter(
    (offer) => idValue(offer.product_id) === canonicalIdValue
  );
  const candidateOffers = offers.filter(
    (offer) => idValue(offer.product_id) === candidateIdValue
  );
  const canonicalRetailerProducts = retailerProducts.filter(
    (mapping) => idValue(mapping.product_id) === canonicalIdValue
  );
  const candidateRetailerProducts = retailerProducts.filter(
    (mapping) => idValue(mapping.product_id) === candidateIdValue
  );

  const priceHistoryCounts = await getPriceHistoryCounts(
    [...canonicalOffers, ...candidateOffers].map((offer) => offer.id)
  );
  const canonicalPriceHistoryCount = canonicalOffers.reduce(
    (total, offer) => total + (priceHistoryCounts.get(idValue(offer.id)) || 0),
    0
  );
  const candidatePriceHistoryCount = candidateOffers.reduce(
    (total, offer) => total + (priceHistoryCounts.get(idValue(offer.id)) || 0),
    0
  );

  const canonical: ProductMergeDetails = {
    product: canonicalProduct,
    offers: canonicalOffers,
    retailerProducts: canonicalRetailerProducts,
    priceHistoryCount: canonicalPriceHistoryCount,
  };
  const candidate: ProductMergeDetails = {
    product: candidateProduct,
    offers: candidateOffers,
    retailerProducts: candidateRetailerProducts,
    priceHistoryCount: candidatePriceHistoryCount,
  };

  const decisionConflicts = buildDecisionConflicts(
    canonical,
    candidate,
    priceHistoryCounts
  );
  const conflicts = buildConflicts(canonical, candidate, decisionConflicts);
  const mergePlan = buildMergePlan(
    canonical,
    candidate,
    conflicts,
    priceHistoryCounts,
    decisionConflicts
  );

  return {
    canonical,
    candidate,
    conflicts,
    decisionConflicts,
    mergePlan,
    readiness: getMergeReadiness(mergePlan, decisionConflicts),
  };
}
