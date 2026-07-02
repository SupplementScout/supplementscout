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

export type MergePreview = {
  canonical: ProductMergeDetails;
  candidate: ProductMergeDetails;
  conflicts: MergeConflict[];
  mergePlan: MergePlan;
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

function intersection<T>(left: T[], right: T[]) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((item) => rightSet.has(item))));
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

function buildConflicts(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails
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

  const canonicalRetailerIds = canonical.offers
    .map((offer) => offer.retailer_id)
    .filter((id): id is BigintId => id !== null)
    .map(idValue);
  const candidateRetailerIds = candidate.offers
    .map((offer) => offer.retailer_id)
    .filter((id): id is BigintId => id !== null)
    .map(idValue);
  const sharedRetailers = intersection(
    canonicalRetailerIds,
    candidateRetailerIds
  );

  if (sharedRetailers.length > 0) {
    const labels = sharedRetailers.map((retailerId) => {
      const offer =
        canonical.offers.find(
          (item) =>
            item.retailer_id !== null && idValue(item.retailer_id) === retailerId
        ) ||
        candidate.offers.find(
          (item) =>
            item.retailer_id !== null && idValue(item.retailer_id) === retailerId
        );

      return offer ? retailerLabel(offer) : `Retailer ${retailerId}`;
    });

    conflicts.push({
      type: "same_retailer",
      label: "Same retailer on both sides",
      detail: labels.join(", "),
    });
  }

  const sharedOfferUrls = intersection(
    canonical.offers
      .map((offer) => nonEmpty(offer.url))
      .filter((url): url is string => Boolean(url)),
    candidate.offers
      .map((offer) => nonEmpty(offer.url))
      .filter((url): url is string => Boolean(url))
  );

  if (sharedOfferUrls.length > 0) {
    conflicts.push({
      type: "same_offer_url",
      label: "Same offer URL",
      detail: sharedOfferUrls.join(", "),
    });
  }

  const sharedExternalUrls = intersection(
    canonical.retailerProducts
      .map((mapping) => nonEmpty(mapping.external_url))
      .filter((url): url is string => Boolean(url)),
    candidate.retailerProducts
      .map((mapping) => nonEmpty(mapping.external_url))
      .filter((url): url is string => Boolean(url))
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

  const sharedMappingRetailers = intersection(
    canonical.retailerProducts.map((mapping) => idValue(mapping.retailer_id)),
    candidate.retailerProducts.map((mapping) => idValue(mapping.retailer_id))
  );

  if (sharedMappingRetailers.length > 0) {
    conflicts.push({
      type: "same_retailer_product_retailer",
      label: "retailer_products mappings for the same retailer",
      detail: `Retailer IDs: ${sharedMappingRetailers.join(", ")}`,
    });
  }

  return conflicts;
}

function buildMergePlan(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails,
  conflicts: MergeConflict[],
  priceHistoryCounts: Map<string, number>
): MergePlan {
  const productConflictStatusByType: Record<string, MergePlanStatus> = {
    different_gtin: "blocked",
    different_size: "blocked",
    different_brand: "blocked",
    different_category: "blocked",
    different_servings: "warning",
    canonical_merged_or_inactive: "blocked",
    candidate_merged_or_inactive: "blocked",
  };
  const productConflicts: MergePlanItem[] = conflicts
    .filter((conflict) => conflict.type in productConflictStatusByType)
    .map((conflict) => ({
      id: `product-conflict-${conflict.type}`,
      status: productConflictStatusByType[conflict.type],
      subject: conflict.label,
      reason: conflict.detail,
    }));
  const canonicalRetailerIds = new Set(
    canonical.offers
      .map((offer) => offer.retailer_id)
      .filter((id): id is BigintId => id !== null)
      .map(idValue)
  );
  const canonicalOfferUrls = new Set(
    canonical.offers
      .map((offer) => nonEmpty(offer.url))
      .filter((url): url is string => Boolean(url))
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
  const offers: MergePlanItem[] = candidate.offers.map((offer) => {
    const reasons: { status: MergePlanStatus; reason: string }[] = [];
    const offerUrl = nonEmpty(offer.url);

    if (offer.retailer_id === null) {
      reasons.push({
        status: "warning",
        reason: "Missing retailer_id, so retailer uniqueness cannot be checked.",
      });
    } else if (canonicalRetailerIds.has(idValue(offer.retailer_id))) {
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
    } else if (canonicalOfferUrls.has(offerUrl)) {
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
      const exactKey = externalUrl
        ? `${idValue(mapping.retailer_id)}:${externalUrl}`
        : null;

      if (!externalUrl) {
        reasons.push({
          status: "warning",
          reason:
            "Missing external_url, so uniqueness cannot be fully checked.",
        });
      } else if (exactKey && canonicalMappingKeys.has(exactKey)) {
        reasons.push({
          status: "blocked",
          reason:
            "Canonical already has a retailer_products mapping with the same retailer_id and external_url.",
        });
      } else if (
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
        "id, retailer_id, product_id, external_name, external_slug, external_gtin, external_url, match_method, match_confidence"
      )
      .in("product_id", [canonicalId, candidateId])
      .order("retailer_id");

  if (retailerProductsError) {
    throw retailerProductsError;
  }

  const offers = ((offersData || []) as RawMergeOffer[]).map(normalizeOffer);
  const retailerProducts = (retailerProductsData ||
    []) as RetailerProductMapping[];
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

  const conflicts = buildConflicts(canonical, candidate);

  return {
    canonical,
    candidate,
    conflicts,
    mergePlan: buildMergePlan(
      canonical,
      candidate,
      conflicts,
      priceHistoryCounts
    ),
  };
}
