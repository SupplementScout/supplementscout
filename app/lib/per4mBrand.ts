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

const BRAND = "Per4m";
const QUERY_LIMIT = 1000;

export const PER4M_INDEX_GATE = {
  minimumVisibleProducts: 20,
  minimumProductsWithMultipleFreshRetailers: 10,
  minimumFreshRetailersAcrossComparisons: 3,
  minimumFreshOffers: 50,
  minimumVisibleCategories: 5,
} as const;

const DISPLAY_CATEGORY_BY_PRODUCT_ID: Readonly<Record<string, string>> = {
  "328": "Whey Isolate",
  "1010": "Plant Protein",
};

export type Per4mCategorySummary = {
  name: string;
  products: number;
  multiRetailerProducts: number;
};

export type Per4mBrandResult = CategoryComparisonResult & {
  categories: Per4mCategorySummary[];
};

export type Per4mBrandRow = CategoryComparisonRow;
export type Per4mBrandSummary = CategoryComparisonSummary;

export function isPer4mProduct(product: RawCategoryComparisonProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.brand === BRAND
  );
}

export function per4mDisplayCategory(
  product: Pick<CategoryComparisonRow, "id" | "category">
) {
  return (
    DISPLAY_CATEGORY_BY_PRODUCT_ID[String(product.id)] ||
    product.category?.trim() ||
    "Other"
  );
}

function categorySummaries(rows: CategoryComparisonRow[]) {
  const categories = new Map<string, Per4mCategorySummary>();

  for (const row of rows) {
    const name = per4mDisplayCategory(row);
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

export function normalizePer4mBrand(
  products: RawCategoryComparisonProduct[],
  options: { now?: Date } = {}
): Omit<Per4mBrandResult, "error"> {
  const comparison = normalizeCategoryComparison(products, {
    isProductInScope: isPer4mProduct,
    now: options.now,
  });

  return {
    ...comparison,
    categories: categorySummaries(comparison.rows),
  };
}

export function evaluatePer4mIndexability(
  result: Pick<Per4mBrandResult, "summary" | "categories">,
  structuredDataValid: boolean
) {
  const coverage = evaluateCategoryIndexability(
    result.summary,
    PER4M_INDEX_GATE,
    structuredDataValid
  );
  const blockers = [...coverage.blockers];

  if (result.summary.visibleProducts < PER4M_INDEX_GATE.minimumVisibleProducts) {
    blockers.push("insufficient_visible_products");
  }
  if (result.categories.length < PER4M_INDEX_GATE.minimumVisibleCategories) {
    blockers.push("insufficient_visible_categories");
  }

  return { indexable: blockers.length === 0, blockers };
}

function emptyResult(): Per4mBrandResult {
  return { ...emptyCategoryComparisonResult(), categories: [] };
}

async function loadPer4mBrand(): Promise<Per4mBrandResult> {
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
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Per4m brand comparison.");
    return emptyResult();
  }

  return {
    ...normalizePer4mBrand((data || []) as RawCategoryComparisonProduct[]),
    error: false,
  };
}

export const getPer4mBrand = cache(loadPer4mBrand);
