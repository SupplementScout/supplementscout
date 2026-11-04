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

const AMINO_ACIDS_QUERY_PAGE_SIZE = 1000;
const AMINO_ACIDS_CANDIDATE_FILTER = [
  "category.eq.Amino Acids",
  "name.ilike.%amino%",
  "name.ilike.%bcaa%",
  "name.ilike.%eaa%",
  "name.ilike.%glutamine%",
  "name.ilike.%arginine%",
  "name.ilike.%aakg%",
  "name.ilike.%beta alanine%",
  "name.ilike.%beta-alanine%",
  "name.ilike.%citrulline%",
  "name.ilike.%carnitine%",
  "name.ilike.%glycine%",
  "name.ilike.%taurine%",
  "name.ilike.%tyrosine%",
  "name.ilike.%leucine%",
  "name.ilike.%isoleucine%",
  "name.ilike.%valine%",
  "name.ilike.%lysine%",
  "name.ilike.%hmb%",
  "name.ilike.%intra workout%",
  "name.ilike.%intra-workout%",
].join(",");

function requireAminoAcidsCoverageDefinition() {
  const definition = getCategoryCoverageDefinition("amino-acids");
  if (!definition) {
    throw new Error("Missing shared Amino Acids category coverage definition.");
  }
  return definition;
}

const aminoAcidsCoverageDefinition = requireAminoAcidsCoverageDefinition();

export const AMINO_ACIDS_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

export type RawAminoAcidsProduct = RawCategoryComparisonProduct;
export type AminoAcidsComparisonRow = CategoryComparisonRow;
export type AminoAcidsComparisonSummary = CategoryComparisonSummary;
export type AminoAcidsComparisonResult = CategoryComparisonResult;

export function evaluateAminoAcidsCoverage(product: RawAminoAcidsProduct) {
  return evaluateCategoryCoverage(aminoAcidsCoverageDefinition, product);
}

export function isAminoAcidsProduct(product: RawAminoAcidsProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    evaluateAminoAcidsCoverage(product).classification === "INCLUDE_STRONG"
  );
}

export function normalizeAminoAcidsComparison(
  products: RawAminoAcidsProduct[],
  options: { now?: Date } = {}
): Omit<AminoAcidsComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isAminoAcidsProduct,
    now: options.now,
  });
}

export function evaluateAminoAcidsIndexability(
  summary: AminoAcidsComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    AMINO_ACIDS_INDEX_GATE,
    structuredDataValid
  );
}

async function loadAminoAcidsComparison(): Promise<AminoAcidsComparisonResult> {
  const candidates: RawAminoAcidsProduct[] = [];

  for (let offset = 0; ; offset += AMINO_ACIDS_QUERY_PAGE_SIZE) {
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
      .or(AMINO_ACIDS_CANDIDATE_FILTER)
      .order("id")
      .range(offset, offset + AMINO_ACIDS_QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error("Unable to load the Amino Acids comparison.");
      return emptyCategoryComparisonResult();
    }

    const page = (data || []) as RawAminoAcidsProduct[];
    candidates.push(...page);
    if (page.length < AMINO_ACIDS_QUERY_PAGE_SIZE) break;
  }

  return {
    ...normalizeAminoAcidsComparison(candidates),
    error: false,
  };
}

export const getAminoAcidsComparison = cache(loadAminoAcidsComparison);
