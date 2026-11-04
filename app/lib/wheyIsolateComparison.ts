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
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { isProteinCandidateEligible } from "./proteinEligibility";
import { evaluateProteinTaxonomy } from "./proteinTaxonomy";

const QUERY_PAGE_SIZE = 1000;
const ISOLATE_CANDIDATE_FILTER = [
  "name.ilike.%isolate%",
  "name.ilike.%iso%",
  "name.ilike.%wpi%",
  "name.ilike.%iso-xp%",
  "name.ilike.%iso 100%",
  "name.ilike.%iso pro%",
  "name.ilike.%iso whey%",
  "name.ilike.%clear whey%",
  "description.ilike.%whey protein isolate%",
].join(",");

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
  return (
    isProteinCandidateEligible(product) &&
    evaluateProteinTaxonomy(product).isolate.state === "INCLUDE_STRONG"
  );
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
  const candidates: RawWheyIsolateProduct[] = [];

  for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
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
          retailer:retailers (id, name, slug)
        )
        `
      )
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .is("merged_at", null)
      .or(ISOLATE_CANDIDATE_FILTER)
      .order("name")
      .order("id")
      .range(offset, offset + QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error("Unable to load the Whey Isolate comparison.");
      return emptyCategoryComparisonResult();
    }

    const page = (data || []) as RawWheyIsolateProduct[];
    candidates.push(...page);
    if (page.length < QUERY_PAGE_SIZE) break;
  }

  const products = await resolveCategoryComparisonVariants(
    candidates
  );

  return {
    ...normalizeWheyIsolateComparison(products),
    error: false,
  };
}

export const getWheyIsolateComparison = cache(loadWheyIsolateComparison);
