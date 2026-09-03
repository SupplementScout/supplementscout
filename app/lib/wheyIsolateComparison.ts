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
import { supabase } from "./supabase";
import { hasReviewedWheyIsolateIdentity } from "./proteinSubtypes";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";

const QUERY_LIMIT = 1000;

export const WHEY_ISOLATE_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

export type RawWheyIsolateProduct = RawCategoryComparisonProduct;
export type WheyIsolateComparisonRow = CategoryComparisonRow;
export type WheyIsolateComparisonSummary = CategoryComparisonSummary;
export type WheyIsolateComparisonResult = CategoryComparisonResult;

export function isWheyIsolateProduct(product: RawWheyIsolateProduct) {
  if (
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    product.merged_at !== null ||
    product.category?.trim().toLowerCase() !== "whey protein"
  ) {
    return false;
  }

  return hasReviewedWheyIsolateIdentity(product);
}

export function normalizeWheyIsolateComparison(
  products: RawWheyIsolateProduct[],
  options: { now?: Date } = {}
): Omit<WheyIsolateComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isWheyIsolateProduct,
    resolveNutritionMetrics: getEffectiveNutritionMetrics,
    now: options.now,
  });
}

export function evaluateWheyIsolateIndexability(
  summary: WheyIsolateComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    WHEY_ISOLATE_INDEX_GATE,
    structuredDataValid
  );
}

async function loadWheyIsolateComparison(): Promise<WheyIsolateComparisonResult> {
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
          retailer:retailers (id, name, slug)
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("category", "Whey Protein")
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Whey Isolate comparison.");
    return emptyCategoryComparisonResult();
  }

  const products = await resolveCategoryComparisonVariants(
    (data || []) as RawWheyIsolateProduct[]
  );

  return {
    ...normalizeWheyIsolateComparison(products),
    error: false,
  };
}

export const getWheyIsolateComparison = cache(loadWheyIsolateComparison);
