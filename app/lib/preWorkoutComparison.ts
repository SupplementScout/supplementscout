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
import { supabase } from "./supabase";

const PRE_WORKOUT_QUERY_LIMIT = 1000;

export const PRE_WORKOUT_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

const NON_COMPARABLE_PRE_WORKOUT = /\bbundle\b/i;

export type RawPreWorkoutProduct = RawCategoryComparisonProduct;
export type PreWorkoutComparisonRow = CategoryComparisonRow;
export type PreWorkoutComparisonSummary = CategoryComparisonSummary;
export type PreWorkoutComparisonResult = CategoryComparisonResult;

export function isPreWorkoutProduct(product: RawPreWorkoutProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.category?.trim().toLowerCase() === "pre workout" &&
    !NON_COMPARABLE_PRE_WORKOUT.test(product.name)
  );
}

export function normalizePreWorkoutComparison(
  products: RawPreWorkoutProduct[],
  options: { now?: Date } = {}
): Omit<PreWorkoutComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isPreWorkoutProduct,
    now: options.now,
  });
}

export function evaluatePreWorkoutIndexability(
  summary: PreWorkoutComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    PRE_WORKOUT_INDEX_GATE,
    structuredDataValid
  );
}

async function loadPreWorkoutComparison(): Promise<PreWorkoutComparisonResult> {
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
    .eq("category", "Pre Workout")
    .order("name")
    .range(0, PRE_WORKOUT_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Pre Workout comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizePreWorkoutComparison((data || []) as RawPreWorkoutProduct[]),
    error: false,
  };
}

export const getPreWorkoutComparison = cache(loadPreWorkoutComparison);
