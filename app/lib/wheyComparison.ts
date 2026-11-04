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
import { isProteinCandidateEligible } from "./proteinEligibility";
import { evaluateProteinTaxonomy } from "./proteinTaxonomy";
import { supabase } from "./supabase";

const WHEY_QUERY_PAGE_SIZE = 1000;
const WHEY_CANDIDATE_FILTER = [
  "category.eq.Whey Protein",
  "name.ilike.%whey%",
  "name.ilike.%isolate%",
  "name.ilike.%iso-xp%",
  "name.ilike.%iso 100%",
  "name.ilike.%iso pro%",
  "description.ilike.%whey%",
].join(",");

export const WHEY_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

export type RawWheyProduct = RawCategoryComparisonProduct;
export type WheyComparisonRow = CategoryComparisonRow;
export type WheyComparisonSummary = CategoryComparisonSummary;
export type WheyComparisonResult = CategoryComparisonResult;

export function isWheyProteinProduct(product: RawWheyProduct) {
  return (
    isProteinCandidateEligible(product) &&
    evaluateProteinTaxonomy(product).whey.state === "INCLUDE_STRONG"
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
  const candidates: RawWheyProduct[] = [];

  for (let offset = 0; ; offset += WHEY_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        slug,
        name,
        brand,
        category,
        description,
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
      .or(WHEY_CANDIDATE_FILTER)
      .order("name")
      .order("id")
      .range(offset, offset + WHEY_QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error("Unable to load the Whey Protein comparison.");
      return emptyCategoryComparisonResult();
    }

    const page = (data || []) as RawWheyProduct[];
    candidates.push(...page);
    if (page.length < WHEY_QUERY_PAGE_SIZE) break;
  }

  const products = await resolveCategoryComparisonVariants(
    candidates
  );

  return {
    ...normalizeWheyComparison(products),
    error: false,
  };
}

export const getWheyComparison = cache(loadWheyComparison);
