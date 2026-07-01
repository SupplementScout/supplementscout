import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";

export type MergeProduct = {
  id: number;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  servings: number | null;
  description: string | null;
  image: string | null;
  price: number | null;
};

export type MergeOffer = {
  id: number;
  product_id: number;
  retailer_id: number | null;
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
  id: number;
  retailer_id: number;
  product_id: number;
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

export type MergePreview = {
  canonical: ProductMergeDetails;
  candidate: ProductMergeDetails;
  conflicts: MergeConflict[];
};

type ComparableSize = {
  value: number;
  dimension: "mass" | "volume";
};

function normalizeText(value: string | null) {
  return String(value || "").trim().toLowerCase();
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

function normalizeOffer(offer: RawMergeOffer): MergeOffer {
  const retailer = Array.isArray(offer.retailer)
    ? offer.retailer[0] || null
    : offer.retailer;

  return {
    ...offer,
    retailer,
  };
}

async function countPriceHistory(offerIds: number[]) {
  if (offerIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .in("offer_id", offerIds);

  if (error) {
    throw error;
  }

  return count || 0;
}

function buildConflicts(
  canonical: ProductMergeDetails,
  candidate: ProductMergeDetails
) {
  const conflicts: MergeConflict[] = [];

  const canonicalRetailerIds = canonical.offers
    .map((offer) => offer.retailer_id)
    .filter((id): id is number => typeof id === "number");
  const candidateRetailerIds = candidate.offers
    .map((offer) => offer.retailer_id)
    .filter((id): id is number => typeof id === "number");
  const sharedRetailers = intersection(
    canonicalRetailerIds,
    candidateRetailerIds
  );

  if (sharedRetailers.length > 0) {
    const labels = sharedRetailers.map((retailerId) => {
      const offer =
        canonical.offers.find((item) => item.retailer_id === retailerId) ||
        candidate.offers.find((item) => item.retailer_id === retailerId);

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
    canonical.retailerProducts.map((mapping) => mapping.retailer_id),
    candidate.retailerProducts.map((mapping) => mapping.retailer_id)
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

export async function getMergePreview(
  canonicalId: number,
  candidateId: number
): Promise<MergePreview | null> {
  const { data: productsData, error: productsError } = await supabaseAdmin
    .from("products")
    .select(
      "id, name, slug, gtin, brand, category, servings, description, image, price"
    )
    .in("id", [canonicalId, candidateId]);

  if (productsError) {
    throw productsError;
  }

  const products = (productsData || []) as MergeProduct[];
  const canonicalProduct = products.find(
    (product) => Number(product.id) === canonicalId
  );
  const candidateProduct = products.find(
    (product) => Number(product.id) === candidateId
  );

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
    (offer) => Number(offer.product_id) === canonicalId
  );
  const candidateOffers = offers.filter(
    (offer) => Number(offer.product_id) === candidateId
  );
  const canonicalRetailerProducts = retailerProducts.filter(
    (mapping) => Number(mapping.product_id) === canonicalId
  );
  const candidateRetailerProducts = retailerProducts.filter(
    (mapping) => Number(mapping.product_id) === candidateId
  );

  const [canonicalPriceHistoryCount, candidatePriceHistoryCount] =
    await Promise.all([
      countPriceHistory(canonicalOffers.map((offer) => Number(offer.id))),
      countPriceHistory(candidateOffers.map((offer) => Number(offer.id))),
    ]);

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

  return {
    canonical,
    candidate,
    conflicts: buildConflicts(canonical, candidate),
  };
}
