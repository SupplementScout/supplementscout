import { cache } from "react";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { supabase } from "./supabase";

const WHEY_QUERY_LIMIT = 1000;

export const WHEY_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

const NON_WHEY_EVIDENCE =
  /\b(?:beef|casein|collagen|egg white|plant|vegan)\b|\bbundle\b|\bnihpro\b/i;

const WHEY_EVIDENCE =
  /\bwhey\b|\bwhey\+|\bisolate\b|\biso[- ]?xp\b|\biso ?100\b|\biso ?pro\b/i;

const REVIEWED_WHEY_BLEND_NAMES = new Set([
  "bsn syntha-6 edge 1.87kg",
  "grenade hydra 6 protein 1.8kg",
  "pescience select protein 1.8kg",
  "pescience select protein 905g",
  "rule1 r1 protein 2.2kg",
  "rule1 r1 protein 29 servings",
  "trained by jp performance protein 1kg",
  "trained by jp performance protein 2kg",
]);

export type RawWheyProduct = RawCategoryComparisonProduct;
export type WheyComparisonRow = CategoryComparisonRow;
export type WheyComparisonSummary = CategoryComparisonSummary;
export type WheyComparisonResult = CategoryComparisonResult;

export function isWheyProteinProduct(product: RawWheyProduct) {
  if (
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    product.merged_at !== null ||
    product.category?.trim().toLowerCase() !== "whey protein"
  ) {
    return false;
  }

  const name = product.name.trim();
  const normalizedName = name.toLowerCase();

  if (NON_WHEY_EVIDENCE.test(name)) return false;

  return (
    WHEY_EVIDENCE.test(name) ||
    REVIEWED_WHEY_BLEND_NAMES.has(normalizedName)
  );
}

export function normalizeWheyComparison(
  products: RawWheyProduct[],
  options: { now?: Date } = {}
): Omit<WheyComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isWheyProteinProduct,
    resolveNutritionMetrics: getEffectiveNutritionMetrics,
    now: options.now,
  });
}

export function evaluateWheyIndexability(
  summary: WheyComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    WHEY_INDEX_GATE,
    structuredDataValid
  );
}

async function loadWheyComparison(): Promise<WheyComparisonResult> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id,
        slug,
        name,
        brand,
        category,
        image,
        product_format,
        net_weight_g,
        net_volume_ml,
        unit_count,
        unit_type,
        serving_count_verified,
        serving_size_g,
        protein_per_serving_g,
        unit_pricing_verified,
        nutrition_verified,
        is_active,
        merged_into_product_id,
        merged_at,
        offers (
          id,
          retailer_product_id,
          price,
          shipping_cost,
          in_stock,
          last_checked_at,
          url,
          retailer:retailers (
            id,
            name,
            slug
          )
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("category", "Whey Protein")
    .order("name")
    .range(0, WHEY_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Whey Protein comparison.");
    return emptyCategoryComparisonResult();
  }

  const products = await resolveCategoryComparisonVariants(
    (data || []) as RawWheyProduct[]
  );

  return {
    ...normalizeWheyComparison(products),
    error: false,
  };
}

export const getWheyComparison = cache(loadWheyComparison);
