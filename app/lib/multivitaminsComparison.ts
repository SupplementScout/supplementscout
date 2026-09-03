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
import { isOfferFresh } from "./offerFreshness";
import { supabase } from "./supabase";

const QUERY_LIMIT = 1000;

export const MULTIVITAMINS_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

export type RawMultivitaminsProduct = RawCategoryComparisonProduct;
export type MultivitaminsComparisonRow = CategoryComparisonRow;
export type MultivitaminsComparisonSummary = CategoryComparisonSummary;
export type MultivitaminsComparisonResult = CategoryComparisonResult;

export function isMultivitaminsOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  return isOfferFresh(checkedAt, now);
}

export function isMultivitaminsProduct(product: RawMultivitaminsProduct) {
  const name = product.name.trim();
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    ["vitamins", "health supplements"].includes(
      product.category?.trim().toLowerCase() || ""
    ) &&
    /\b(?:multi[ -]?vitamins?|multimax)\b/i.test(name)
  );
}

export function normalizeMultivitaminsComparison(
  products: RawMultivitaminsProduct[],
  options: { now?: Date } = {}
): Omit<MultivitaminsComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isMultivitaminsProduct,
    isOfferFresh: isMultivitaminsOfferFresh,
    now: options.now,
  });
}

export function evaluateMultivitaminsIndexability(
  summary: MultivitaminsComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    MULTIVITAMINS_INDEX_GATE,
    structuredDataValid
  );
}

async function loadMultivitaminsComparison(): Promise<MultivitaminsComparisonResult> {
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
          retailer:retailers (id, name, slug)
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .in("category", ["Vitamins", "Health Supplements"])
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Multivitamins comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeMultivitaminsComparison(
      (data || []) as RawMultivitaminsProduct[]
    ),
    error: false,
  };
}

export const getMultivitaminsComparison = cache(loadMultivitaminsComparison);
