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
import {
  evaluateCategoryCoverage,
  getCategoryCoverageDefinition,
} from "./categoryCoverage";
import { supabase } from "./supabase";

export const CARBOHYDRATES_QUERY_PAGE_SIZE = 1000;

const CARBOHYDRATES_CANDIDATE_FILTER = [
  "category.eq.Carbohydrates",
  "name.ilike.%carb%",
  "name.ilike.%cream of rice%",
  "name.ilike.%cyclic dextrin%",
  "name.ilike.%cluster dextrin%",
  "name.ilike.%dextrose%",
  "name.ilike.%maltodextrin%",
  "name.ilike.%vitargo%",
  "description.ilike.%carbohydrate powder%",
  "description.ilike.%carbohydrate drink%",
  "description.ilike.%carbohydrate supplement%",
  "description.ilike.%carbohydrate formula%",
  "description.ilike.%carbohydrate source%",
  "description.ilike.%carbohydrate blend%",
  "description.ilike.%carb powder%",
  "description.ilike.%carb drink%",
  "description.ilike.%carb supplement%",
  "description.ilike.%carb formula%",
  "description.ilike.%carb source%",
  "description.ilike.%carb blend%",
  "description.ilike.%cream of rice%",
  "description.ilike.%cyclic dextrin%",
  "description.ilike.%cluster dextrin%",
  "description.ilike.%dextrose%",
  "description.ilike.%maltodextrin%",
  "description.ilike.%vitargo%",
].join(",");

const exactCarbohydratesCategoryPattern = /^\s*carbohydrates\s*$/i;
const carbohydratesCandidateNamePattern =
  /\b(?:carbohydrates?|carbo|carbs?|carb(?:max|up)|cream\s+of\s+rice|(?:cyclic|cluster)\s+dextrin|dextrose|maltodextrin|vitargo|carbofuel)\b/i;
const carbohydratesCandidateDescriptionPattern =
  /\b(?:(?:carbohydrate|carb)\s+(?:powder|drink|supplement|formula|source|blend)|cream\s+of\s+rice|(?:cluster|cyclic)\s+dextrin|maltodextrin|dextrose|vitargo)\b/i;

function requireCarbohydratesCoverageDefinition() {
  const definition = getCategoryCoverageDefinition("carbohydrates");
  if (!definition) {
    throw new Error("Missing shared Carbohydrates category coverage definition.");
  }
  return definition;
}

const carbohydratesCoverageDefinition =
  requireCarbohydratesCoverageDefinition();

export const CARBOHYDRATES_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 8,
} as const;

export type RawCarbohydratesProduct = RawCategoryComparisonProduct;
export type CarbohydratesComparisonRow = CategoryComparisonRow;
export type CarbohydratesComparisonSummary = CategoryComparisonSummary;
export type CarbohydratesComparisonResult = CategoryComparisonResult;

export function hasCarbohydratesCandidateEvidence(
  product: RawCarbohydratesProduct
) {
  return (
    exactCarbohydratesCategoryPattern.test(product.category || "") ||
    carbohydratesCandidateNamePattern.test(product.name) ||
    carbohydratesCandidateDescriptionPattern.test(product.description || "")
  );
}

export function evaluateCarbohydratesCoverage(
  product: RawCarbohydratesProduct
) {
  return evaluateCategoryCoverage(carbohydratesCoverageDefinition, product);
}

export function isCarbohydratesProduct(product: RawCarbohydratesProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    hasCarbohydratesCandidateEvidence(product) &&
    evaluateCarbohydratesCoverage(product).classification === "INCLUDE_STRONG"
  );
}

export function normalizeCarbohydratesComparison(
  products: RawCarbohydratesProduct[],
  options: { now?: Date } = {}
): Omit<CarbohydratesComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isCarbohydratesProduct,
    now: options.now,
  });
}

export function evaluateCarbohydratesIndexability(
  summary: CarbohydratesComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    CARBOHYDRATES_INDEX_GATE,
    structuredDataValid
  );
}

async function loadCarbohydratesComparison(): Promise<CarbohydratesComparisonResult> {
  const candidates: RawCarbohydratesProduct[] = [];

  for (let offset = 0; ; offset += CARBOHYDRATES_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id, slug, name, brand, category, description, image, product_format,
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
      .or(CARBOHYDRATES_CANDIDATE_FILTER)
      .order("id", { ascending: true })
      .range(offset, offset + CARBOHYDRATES_QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error("Unable to load the Carbohydrates comparison.");
      return emptyCategoryComparisonResult();
    }

    const page = (data || []) as RawCarbohydratesProduct[];
    candidates.push(...page.filter(hasCarbohydratesCandidateEvidence));
    if (page.length < CARBOHYDRATES_QUERY_PAGE_SIZE) break;
  }

  return {
    ...normalizeCarbohydratesComparison(candidates),
    error: false,
  };
}

export const getCarbohydratesComparison = cache(
  loadCarbohydratesComparison
);
