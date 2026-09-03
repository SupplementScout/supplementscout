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

const AMINO_ACIDS_QUERY_LIMIT = 1000;

export const AMINO_ACIDS_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

// The category also contains opaque blends and amino-acid derivatives. Keep the
// public boundary auditable by requiring the canonical name to identify the
// amino product explicitly and by excluding bundles and adjacent derivatives.
const EXPLICIT_AMINO_PRODUCT =
  /\b(amino(?:s|x)?|bcaas?|eaas?|glutamine|arginine|aakg|beta[ -]?alanine|citrulline|carnitine|glycine|taurine|tyrosine|leucine|isoleucine|valine|lysine|hmb)\b/i;
const NON_COMPARABLE_AMINO_PRODUCT =
  /\b(5-?htp|nac|glutathione|bundle|\d+-pack)\b/i;

export type RawAminoAcidsProduct = RawCategoryComparisonProduct;
export type AminoAcidsComparisonRow = CategoryComparisonRow;
export type AminoAcidsComparisonSummary = CategoryComparisonSummary;
export type AminoAcidsComparisonResult = CategoryComparisonResult;

export function isAminoAcidsProduct(product: RawAminoAcidsProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.category?.trim().toLowerCase() === "amino acids" &&
    EXPLICIT_AMINO_PRODUCT.test(product.name) &&
    !NON_COMPARABLE_AMINO_PRODUCT.test(product.name)
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
    .eq("category", "Amino Acids")
    .order("name")
    .range(0, AMINO_ACIDS_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Amino Acids comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeAminoAcidsComparison((data || []) as RawAminoAcidsProduct[]),
    error: false,
  };
}

export const getAminoAcidsComparison = cache(loadAminoAcidsComparison);
