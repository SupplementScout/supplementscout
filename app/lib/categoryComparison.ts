import { isCreatineOfferFresh } from "./creatineLaunch";
import {
  classifyOfferCollection,
  type OfferPresentationState,
} from "./offerFreshness";
import {
  getDeliveredPrice,
  getKnownProductPrice,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerServing,
  getVerifiedPricePerUnit,
  type DeliveredPrice,
} from "./pricing";

type NutritionScalar = number | string | null;
type EffectiveComparisonNutrition = {
  net_weight_g: NutritionScalar;
  serving_count_verified: NutritionScalar;
  serving_size_g: NutritionScalar;
  protein_per_serving_g: NutritionScalar;
  creatine_per_serving_g: NutritionScalar;
  product_format: string | null;
  unit_pricing_verified: boolean | null;
  nutrition_verified: boolean | null;
};
export type ComparisonNutritionVariant = {
  id?: number | string;
  display_name?: string | null;
  flavour_label?: string | null;
  pack_count?: NutritionScalar;
  size_value?: NutritionScalar;
  size_unit?: string | null;
  product_format?: string | null;
  nutrition_override?: Record<string, unknown> | null;
  is_active?: boolean | null;
} | null;

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
  product_variant?: ComparisonNutritionVariant | ComparisonNutritionVariant[];
  variant_resolution?: "resolved" | "unresolved";
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
  nutritionVariant: ComparisonNutritionVariant;
  variantResolution: "legacy" | "resolved" | "unresolved";
};

export type CategoryComparisonRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
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
  bestOffer: CategoryComparisonOffer | null;
  referenceVariant: ComparisonNutritionVariant;
  offerCount: number;
  retailerCount: number;
  observedRetailerCount: number;
  lastCheckedAt: string | null;
  presentationState: OfferPresentationState;
  pricePerKg: number | null;
  pricePerServing: number | null;
  pricePerUnit: {
    price: number;
    unitType: "capsule" | "tablet";
  } | null;
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
  now: Date,
  isOfferFresh: (checkedAt: string | null, now: Date) => boolean =
    isCreatineOfferFresh
): CategoryComparisonOffer | null {
  const retailer = relationOne(offer.retailer);
  const productPrice = getKnownProductPrice(offer.price);
  const checkedAt = Date.parse(offer.last_checked_at || "");
  const deliveredPrice = getDeliveredPrice(offer);

  if (
    offer.in_stock !== true ||
    productPrice === null ||
    !isOfferFresh(offer.last_checked_at, now) ||
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
    nutritionVariant: relationOne(offer.product_variant),
    variantResolution: offer.variant_resolution || "legacy",
  };
}

function isPresentationEligibleOffer(offer: RawComparisonOffer) {
  const retailer = relationOne(offer.retailer);
  const hasRetailerIdentity = Boolean(retailer?.id && retailer.name?.trim());

  if (!hasRetailerIdentity) return false;
  if (offer.in_stock === false) return true;

  return (
    offer.in_stock === true &&
    getKnownProductPrice(offer.price) !== null &&
    offer.retailer_product_id !== null &&
    validHttpUrl(offer.url)
  );
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
    Number(right.presentationState === "LIVE") -
      Number(left.presentationState === "LIVE") ||
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
    isOfferInScope?: (
      product: RawCategoryComparisonProduct,
      offer: RawComparisonOffer
    ) => boolean;
    isOfferFresh?: (checkedAt: string | null, now: Date) => boolean;
    resolveNutritionMetrics?: (
      product: EffectiveComparisonNutrition,
      variant: ComparisonNutritionVariant
    ) => EffectiveComparisonNutrition;
    now?: Date;
  }
): Omit<CategoryComparisonResult, "error"> {
  const now = options.now || new Date();
  const scopedProducts = products.filter(options.isProductInScope);
  let staleOrUnusableOffersExcluded = 0;

  const rows = scopedProducts
    .map((product): CategoryComparisonRow | null => {
      const rawOffers = product.offers || [];
      const scopedOffers = rawOffers.filter(
        (offer) => !options.isOfferInScope || options.isOfferInScope(product, offer)
      );
      const offers = scopedOffers
        .map((offer) => normalizeOffer(offer, now, options.isOfferFresh))
        .filter((offer): offer is CategoryComparisonOffer => offer !== null)
        .sort(offerSort);
      const presentation = classifyOfferCollection(
        scopedOffers.filter(isPresentationEligibleOffer),
        now
      );
      const observedRetailerCount = new Set(
        scopedOffers
          .map((offer) => relationOne(offer.retailer)?.id)
          .filter((id): id is number | string => id !== null && id !== undefined)
          .map(String)
      ).size;

      staleOrUnusableOffersExcluded += rawOffers.filter(
        (offer) =>
          offer.in_stock === true &&
          getKnownProductPrice(offer.price) !== null &&
          (
            (options.isOfferInScope && !options.isOfferInScope(product, offer)) ||
            normalizeOffer(offer, now, options.isOfferFresh) === null
          )
      ).length;

      const bestOffer = offers[0] || null;
      const referenceVariant =
        bestOffer?.nutritionVariant ||
        relationOne(scopedOffers[0]?.product_variant) ||
        null;
      const baseNutritionMetrics = {
        net_weight_g: product.net_weight_g,
        serving_count_verified: product.serving_count_verified,
        serving_size_g: product.serving_size_g ?? null,
        protein_per_serving_g: product.protein_per_serving_g ?? null,
        creatine_per_serving_g: null,
        product_format: product.product_format ?? null,
        unit_pricing_verified: product.unit_pricing_verified ?? null,
        nutrition_verified: product.nutrition_verified ?? null,
      };
      const resolvedMetrics = options.resolveNutritionMetrics
        ? options.resolveNutritionMetrics(
            baseNutritionMetrics,
            bestOffer?.nutritionVariant || null
          )
        : baseNutritionMetrics;
      const effectiveMetrics = bestOffer?.variantResolution === "unresolved"
        ? {
            ...resolvedMetrics,
            serving_count_verified: null,
            serving_size_g: null,
            protein_per_serving_g: null,
            creatine_per_serving_g: null,
            nutrition_verified: false,
          }
        : resolvedMetrics;
      const netWeightG = positiveNumber(effectiveMetrics.net_weight_g);
      const verifiedServingCount = positiveInteger(
        effectiveMetrics.serving_count_verified
      );
      const servingSizeG = positiveNumber(effectiveMetrics.serving_size_g);
      const proteinPerServingG = positiveNumber(
        effectiveMetrics.protein_per_serving_g
      );
      const productFormat = effectiveMetrics.product_format || null;
      const unitPricingVerified = effectiveMetrics.unit_pricing_verified === true;
      const nutritionVerified = effectiveMetrics.nutrition_verified === true;

      return {
        id: String(product.id),
        name: product.name,
        brand: product.brand,
        category: product.category,
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
        referenceVariant,
        offerCount: offers.length,
        retailerCount: new Set(offers.map((offer) => offer.retailer.id)).size,
        observedRetailerCount,
        lastCheckedAt: presentation.checkedAt,
        presentationState: presentation.state,
        pricePerKg: getVerifiedPricePerKg(
          bestOffer?.deliveredPrice || null,
          netWeightG,
          productFormat,
          unitPricingVerified
        ),
        pricePerServing: getVerifiedPricePerServing(
          bestOffer?.deliveredPrice || null,
          verifiedServingCount
        ),
        pricePerUnit: getVerifiedPricePerUnit(
          bestOffer?.deliveredPrice || null,
          product.unit_count,
          product.unit_type,
          unitPricingVerified
        ),
        costPer25gProtein: getVerifiedCostPer25gProtein(
          bestOffer?.deliveredPrice || null,
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
