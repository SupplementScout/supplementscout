import { cache } from "react";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawComparisonOffer,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import { supabase } from "./supabase";
import {
  ANIMAL_PROTEIN_IDENTITY,
  hasReviewedVeganProteinIdentity,
} from "./proteinSubtypes";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { isOfferFresh } from "./offerFreshness";

const QUERY_LIMIT = 1000;

export const VEGAN_PROTEIN_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

type RawRetailerProductLabel =
  | { external_name: string | null }
  | { external_name: string | null }[]
  | null;

export type RawVeganProteinOffer = RawComparisonOffer & {
  retailer_product?: RawRetailerProductLabel;
};

export type RawVeganProteinProduct = Omit<
  RawCategoryComparisonProduct,
  "offers"
> & {
  offers?: RawVeganProteinOffer[] | null;
};

export type VeganProteinComparisonRow = CategoryComparisonRow;
export type VeganProteinComparisonSummary = CategoryComparisonSummary;
export type VeganProteinComparisonResult = CategoryComparisonResult;

function retailerLabel(offer: RawVeganProteinOffer) {
  const relation = Array.isArray(offer.retailer_product)
    ? offer.retailer_product[0]
    : offer.retailer_product;
  return relation?.external_name || "";
}

export function isVeganProteinOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  return isOfferFresh(checkedAt, now);
}

export function isVeganProteinProduct(product: RawVeganProteinProduct) {
  if (
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    product.merged_at !== null ||
    !hasReviewedVeganProteinIdentity(product)
  ) {
    return false;
  }

  return !(product.offers || []).some((offer) =>
    ANIMAL_PROTEIN_IDENTITY.test(retailerLabel(offer))
  );
}

export function normalizeVeganProteinComparison(
  products: RawVeganProteinProduct[],
  options: { now?: Date } = {}
): Omit<VeganProteinComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: (product) =>
      isVeganProteinProduct(product as RawVeganProteinProduct),
    isOfferFresh: isVeganProteinOfferFresh,
    resolveNutritionMetrics: getEffectiveNutritionMetrics,
    now: options.now,
  });
}

export function evaluateVeganProteinIndexability(
  summary: VeganProteinComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    VEGAN_PROTEIN_INDEX_GATE,
    structuredDataValid
  );
}

async function loadVeganProteinComparison(): Promise<VeganProteinComparisonResult> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id, slug, name, brand, category, image, product_format,
        net_weight_g, net_volume_ml, unit_count, unit_type,
        serving_count_verified, serving_size_g, protein_per_serving_g,
        unit_pricing_verified, nutrition_verified, is_active,
        merged_into_product_id, merged_at,
        offers (
          id, retailer_product_id, price, shipping_cost, in_stock,
          last_checked_at, url,
          retailer:retailers (id, name, slug),
          retailer_product:retailer_products (external_name)
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .or("name.ilike.%vegan%,name.ilike.%plant%,name.ilike.%pea%,name.ilike.%rice%,name.ilike.%hemp%")
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Vegan Protein comparison.");
    return emptyCategoryComparisonResult();
  }

  const products = await resolveCategoryComparisonVariants(
    (data || []) as RawVeganProteinProduct[]
  );

  return {
    ...normalizeVeganProteinComparison(products),
    error: false,
  };
}

export const getVeganProteinComparison = cache(loadVeganProteinComparison);
