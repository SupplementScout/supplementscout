import { isCreatineOfferFresh } from "./creatineLaunch";
import {
  getDeliveredPrice,
  getKnownProductPrice,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerServing,
  type DeliveredPrice,
} from "./pricing";

export type RawComparisonRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
};

export type RawComparisonOffer = {
  id: number | string;
  retailer_product_id: number | string | null;
  price: number | string | null;
  shipping_cost: number | string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  url: string | null;
  retailer:
    | RawComparisonRetailer
    | RawComparisonRetailer[]
    | null;
};

export type RawCategoryComparisonProduct = {
  id: number | string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  product_format?: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  unit_count: number | string | null;
  unit_type: string | null;
  serving_count_verified: number | string | null;
  serving_size_g?: number | string | null;
  protein_per_serving_g?: number | string | null;
  unit_pricing_verified?: boolean | null;
  nutrition_verified?: boolean | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
  merged_at: string | null;
  offers?: RawComparisonOffer[] | null;
};

export type CategoryComparisonOffer = {
  id: string;
  retailer: { id: string; name: string; slug: string | null };
  productPrice: number;
  shippingCost: number | null;
  deliveredPrice: DeliveredPrice | null;
  lastCheckedAt: string;
};

export type CategoryComparisonRow = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  productUrl: string;
  productFormat: string | null;
  netWeightG: number | null;
  netVolumeMl: number | null;
  unitCount: number | null;
  unitType: string | null;
  verifiedServingCount: number | null;
  servingSizeG: number | null;
  proteinPerServingG: number | null;
  nutritionVerified: boolean;
  unitPricingVerified: boolean;
  offers: CategoryComparisonOffer[];
  bestOffer: CategoryComparisonOffer;
  offerCount: number;
  retailerCount: number;
  lastCheckedAt: string;
  pricePerKg: number | null;
  pricePerServing: number | null;
  costPer25gProtein: number | null;
};

export type CategoryComparisonSummary = {
  scopedProducts: number;
  visibleProducts: number;
  freshOffers: number;
  freshRetailers: number;
  productsWithOneFreshRetailer: number;
  productsWithMultipleFreshRetailers: number;
  freshRetailersAcrossComparisons: number;
  staleOrUnusableOffersExcluded: number;
  latestOfferCheckedAt: string | null;
};

export type CategoryComparisonResult = {
  rows: CategoryComparisonRow[];
  summary: CategoryComparisonSummary;
  error: boolean;
};

export type CategoryIndexGate = {
  minimumProductsWithMultipleFreshRetailers: number;
  minimumFreshRetailersAcrossComparisons: number;
  minimumFreshOffers: number;
};

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function positiveNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: number | string | null | undefined) {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function validHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeOffer(
  offer: RawComparisonOffer,
  now: Date
): CategoryComparisonOffer | null {
  const retailer = relationOne(offer.retailer);
  const productPrice = getKnownProductPrice(offer.price);
  const checkedAt = Date.parse(offer.last_checked_at || "");
  const deliveredPrice = getDeliveredPrice(offer);

  if (
    offer.in_stock !== true ||
    productPrice === null ||
    !isCreatineOfferFresh(offer.last_checked_at, now) ||
    !Number.isFinite(checkedAt) ||
    offer.retailer_product_id === null ||
    !validHttpUrl(offer.url) ||
    !retailer?.id ||
    !retailer.name?.trim()
  ) {
    return null;
  }

  return {
    id: String(offer.id),
    retailer: {
      id: String(retailer.id),
      name: retailer.name.trim(),
      slug: retailer.slug,
    },
    productPrice,
    shippingCost: deliveredPrice?.shippingCost ?? null,
    deliveredPrice,
    lastCheckedAt: offer.last_checked_at as string,
  };
}

function offerSort(
  left: CategoryComparisonOffer,
  right: CategoryComparisonOffer
) {
  const leftTotal = left.deliveredPrice?.totalPrice ?? Number.POSITIVE_INFINITY;
  const rightTotal =
    right.deliveredPrice?.totalPrice ?? Number.POSITIVE_INFINITY;

  return (
    leftTotal - rightTotal ||
    left.productPrice - right.productPrice ||
    left.id.localeCompare(right.id)
  );
}

function completenessScore(row: CategoryComparisonRow) {
  return [
    row.brand,
    row.image,
    row.netWeightG || row.netVolumeMl || row.unitCount,
    row.verifiedServingCount,
    row.proteinPerServingG,
  ].filter(Boolean).length;
}

export function categoryComparisonRowSort(
  left: CategoryComparisonRow,
  right: CategoryComparisonRow
) {
  return (
    right.retailerCount - left.retailerCount ||
    right.offerCount - left.offerCount ||
    completenessScore(right) - completenessScore(left) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function normalizeCategoryComparison(
  products: RawCategoryComparisonProduct[],
  options: {
    isProductInScope: (product: RawCategoryComparisonProduct) => boolean;
    now?: Date;
  }
): Omit<CategoryComparisonResult, "error"> {
  const now = options.now || new Date();
  const scopedProducts = products.filter(options.isProductInScope);
  let staleOrUnusableOffersExcluded = 0;

  const rows = scopedProducts
    .map((product): CategoryComparisonRow | null => {
      const rawOffers = product.offers || [];
      const offers = rawOffers
        .map((offer) => normalizeOffer(offer, now))
        .filter((offer): offer is CategoryComparisonOffer => offer !== null)
        .sort(offerSort);

      staleOrUnusableOffersExcluded += rawOffers.filter(
        (offer) =>
          offer.in_stock === true &&
          getKnownProductPrice(offer.price) !== null &&
          normalizeOffer(offer, now) === null
      ).length;

      if (offers.length === 0) return null;

      const bestOffer = offers[0];
      const netWeightG = positiveNumber(product.net_weight_g);
      const verifiedServingCount = positiveInteger(
        product.serving_count_verified
      );
      const servingSizeG = positiveNumber(product.serving_size_g);
      const proteinPerServingG = positiveNumber(
        product.protein_per_serving_g
      );
      const productFormat = product.product_format || null;
      const unitPricingVerified = product.unit_pricing_verified === true;
      const nutritionVerified = product.nutrition_verified === true;

      return {
        id: String(product.id),
        name: product.name,
        brand: product.brand,
        image: product.image,
        productUrl: `/product/${product.slug || product.id}`,
        productFormat,
        netWeightG,
        netVolumeMl: positiveNumber(product.net_volume_ml),
        unitCount: positiveInteger(product.unit_count),
        unitType: product.unit_type,
        verifiedServingCount,
        servingSizeG,
        proteinPerServingG,
        nutritionVerified,
        unitPricingVerified,
        offers,
        bestOffer,
        offerCount: offers.length,
        retailerCount: new Set(offers.map((offer) => offer.retailer.id)).size,
        lastCheckedAt: offers
          .map((offer) => offer.lastCheckedAt)
          .sort()
          .at(-1) as string,
        pricePerKg: getVerifiedPricePerKg(
          bestOffer.deliveredPrice,
          netWeightG,
          productFormat,
          unitPricingVerified
        ),
        pricePerServing: getVerifiedPricePerServing(
          bestOffer.deliveredPrice,
          verifiedServingCount
        ),
        costPer25gProtein: getVerifiedCostPer25gProtein(
          bestOffer.deliveredPrice,
          verifiedServingCount,
          proteinPerServingG,
          unitPricingVerified,
          nutritionVerified,
          netWeightG,
          servingSizeG,
          productFormat
        ),
      };
    })
    .filter((row): row is CategoryComparisonRow => row !== null)
    .sort(categoryComparisonRowSort);

  const offers = rows.flatMap((row) => row.offers);
  const comparisonRows = rows.filter((row) => row.retailerCount >= 2);

  return {
    rows,
    summary: {
      scopedProducts: scopedProducts.length,
      visibleProducts: rows.length,
      freshOffers: offers.length,
      freshRetailers: new Set(offers.map((offer) => offer.retailer.id)).size,
      productsWithOneFreshRetailer: rows.filter(
        (row) => row.retailerCount === 1
      ).length,
      productsWithMultipleFreshRetailers: comparisonRows.length,
      freshRetailersAcrossComparisons: new Set(
        comparisonRows.flatMap((row) =>
          row.offers.map((offer) => offer.retailer.id)
        )
      ).size,
      staleOrUnusableOffersExcluded,
      latestOfferCheckedAt:
        offers.map((offer) => offer.lastCheckedAt).sort().at(-1) || null,
    },
  };
}

export function evaluateCategoryIndexability(
  summary: CategoryComparisonSummary,
  gate: CategoryIndexGate,
  structuredDataValid: boolean
) {
  const blockers: string[] = [];

  if (
    summary.productsWithMultipleFreshRetailers <
    gate.minimumProductsWithMultipleFreshRetailers
  ) {
    blockers.push("insufficient_multi_retailer_products");
  }
  if (
    summary.freshRetailersAcrossComparisons <
    gate.minimumFreshRetailersAcrossComparisons
  ) {
    blockers.push("insufficient_comparison_retailers");
  }
  if (summary.freshOffers < gate.minimumFreshOffers) {
    blockers.push("insufficient_fresh_offers");
  }
  if (!structuredDataValid) blockers.push("structured_data_invalid");

  return { indexable: blockers.length === 0, blockers };
}

export function emptyCategoryComparisonResult(): CategoryComparisonResult {
  return {
    rows: [],
    summary: {
      scopedProducts: 0,
      visibleProducts: 0,
      freshOffers: 0,
      freshRetailers: 0,
      productsWithOneFreshRetailer: 0,
      productsWithMultipleFreshRetailers: 0,
      freshRetailersAcrossComparisons: 0,
      staleOrUnusableOffersExcluded: 0,
      latestOfferCheckedAt: null,
    },
    error: true,
  };
}
