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

const QUERY_LIMIT = 1000;

export const WHEY_ISOLATE_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

const EXPLICIT_ISOLATE_IDENTITY =
  /(?:\bisolate\b|\bwpi\b|\biso(?:[-\s]?(?:xp|hd|100))?\b)/i;
const EXCLUDED_IDENTITY = /(?:\bblend\b|\btri[-\s]?blend\b|\bbeef\b|\bcollagen\b)/i;

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

  return (
    EXPLICIT_ISOLATE_IDENTITY.test(product.name) &&
    !EXCLUDED_IDENTITY.test(product.name)
  );
}

export function normalizeWheyIsolateComparison(
  products: RawWheyIsolateProduct[],
  options: { now?: Date } = {}
): Omit<WheyIsolateComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isWheyIsolateProduct,
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
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Whey Isolate comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeWheyIsolateComparison((data || []) as RawWheyIsolateProduct[]),
    error: false,
  };
}

export const getWheyIsolateComparison = cache(loadWheyIsolateComparison);
