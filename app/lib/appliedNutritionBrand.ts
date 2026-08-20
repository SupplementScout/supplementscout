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

const BRAND = "Applied Nutrition";
const QUERY_LIMIT = 1000;

export const APPLIED_NUTRITION_INDEX_GATE = {
  minimumVisibleProducts: 20,
  minimumProductsWithMultipleFreshRetailers: 10,
  minimumFreshRetailersAcrossComparisons: 3,
  minimumFreshOffers: 50,
  minimumVisibleCategories: 5,
} as const;

export type AppliedNutritionCategorySummary = {
  name: string;
  products: number;
  multiRetailerProducts: number;
};

export type AppliedNutritionBrandResult = CategoryComparisonResult & {
  categories: AppliedNutritionCategorySummary[];
};

export type AppliedNutritionBrandRow = CategoryComparisonRow;
export type AppliedNutritionBrandSummary = CategoryComparisonSummary;

export function isAppliedNutritionProduct(
  product: RawCategoryComparisonProduct
) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.brand === BRAND
  );
}

function categorySummaries(rows: CategoryComparisonRow[]) {
  const categories = new Map<string, AppliedNutritionCategorySummary>();

  for (const row of rows) {
    const name = row.category?.trim() || "Other";
    const current = categories.get(name) || {
      name,
      products: 0,
      multiRetailerProducts: 0,
    };
    current.products += 1;
    if (row.retailerCount >= 2) current.multiRetailerProducts += 1;
    categories.set(name, current);
  }

  return [...categories.values()].sort(
    (left, right) =>
      right.multiRetailerProducts - left.multiRetailerProducts ||
      right.products - left.products ||
      left.name.localeCompare(right.name)
  );
}

export function normalizeAppliedNutritionBrand(
  products: RawCategoryComparisonProduct[],
  options: { now?: Date } = {}
): Omit<AppliedNutritionBrandResult, "error"> {
  const comparison = normalizeCategoryComparison(products, {
    isProductInScope: isAppliedNutritionProduct,
    now: options.now,
  });

  return {
    ...comparison,
    categories: categorySummaries(comparison.rows),
  };
}

export function evaluateAppliedNutritionIndexability(
  result: Pick<AppliedNutritionBrandResult, "summary" | "categories">,
  structuredDataValid: boolean
) {
  const coverage = evaluateCategoryIndexability(
    result.summary,
    APPLIED_NUTRITION_INDEX_GATE,
    structuredDataValid
  );
  const blockers = [...coverage.blockers];

  if (
    result.summary.visibleProducts <
    APPLIED_NUTRITION_INDEX_GATE.minimumVisibleProducts
  ) {
    blockers.push("insufficient_visible_products");
  }
  if (
    result.categories.length <
    APPLIED_NUTRITION_INDEX_GATE.minimumVisibleCategories
  ) {
    blockers.push("insufficient_visible_categories");
  }

  return { indexable: blockers.length === 0, blockers };
}

function emptyResult(): AppliedNutritionBrandResult {
  return { ...emptyCategoryComparisonResult(), categories: [] };
}

async function loadAppliedNutritionBrand(): Promise<AppliedNutritionBrandResult> {
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
    .eq("brand", BRAND)
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Applied Nutrition brand comparison.");
    return emptyResult();
  }

  return {
    ...normalizeAppliedNutritionBrand(
      (data || []) as RawCategoryComparisonProduct[]
    ),
    error: false,
  };
}

export const getAppliedNutritionBrand = cache(loadAppliedNutritionBrand);
