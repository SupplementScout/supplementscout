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
export const MASS_GAINER_MAXIMUM_OFFER_AGE_HOURS = 24;

export const MASS_GAINER_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

export type RawMassGainerProduct = RawCategoryComparisonProduct;
export type MassGainerComparisonRow = CategoryComparisonRow;
export type MassGainerComparisonSummary = CategoryComparisonSummary;
export type MassGainerComparisonResult = CategoryComparisonResult;

export function isMassGainerOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!Number.isFinite(checkedAtTime)) return false;
  const ageHours = (now.getTime() - checkedAtTime) / 3_600_000;
  return ageHours >= 0 && ageHours <= MASS_GAINER_MAXIMUM_OFFER_AGE_HOURS;
}

export function isMassGainerProduct(product: RawMassGainerProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.category?.trim().toLowerCase() === "mass gainer" &&
    product.product_format === "powder"
  );
}

export function normalizeMassGainerComparison(
  products: RawMassGainerProduct[],
  options: { now?: Date } = {}
): Omit<MassGainerComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: isMassGainerProduct,
    isOfferFresh: isMassGainerOfferFresh,
    now: options.now,
  });
}

export function evaluateMassGainerIndexability(
  summary: MassGainerComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    MASS_GAINER_INDEX_GATE,
    structuredDataValid
  );
}

async function loadMassGainerComparison(): Promise<MassGainerComparisonResult> {
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
    .eq("category", "Mass Gainer")
    .eq("product_format", "powder")
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Mass Gainer comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeMassGainerComparison((data || []) as RawMassGainerProduct[]),
    error: false,
  };
}

export const getMassGainerComparison = cache(loadMassGainerComparison);
