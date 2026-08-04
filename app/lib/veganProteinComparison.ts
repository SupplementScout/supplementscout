import { cache } from "react";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawComparisonOffer,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import { supabase } from "./supabase";

const QUERY_LIMIT = 1000;
export const VEGAN_PROTEIN_MAXIMUM_OFFER_AGE_HOURS = 24;

export const VEGAN_PROTEIN_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

const PLANT_IDENTITY = /\b(vegan|plant(?:[ -]based)?|pea|rice|hemp)\b/i;
const PROTEIN_IDENTITY = /\bprotein\b/i;
const NON_POWDER_FOOD =
  /\b(bar|bars|bite|bites|cookie|cookies|wafer|flapjack|spread|snack|brownie|drink|gel|meal)\b/i;
const ANIMAL_PROTEIN = /\b(whey|casein|collagen|beef|egg|milk protein)\b/i;

type RawRetailerProductLabel =
  | { external_name: string | null }
  | { external_name: string | null }[]
  | null;

export type RawVeganProteinOffer = RawComparisonOffer & {
  retailer_product?: RawRetailerProductLabel;
};

export type RawVeganProteinProduct = Omit<
  RawCategoryComparisonProduct,
  "offers"
> & {
  offers?: RawVeganProteinOffer[] | null;
};

export type VeganProteinComparisonRow = CategoryComparisonRow;
export type VeganProteinComparisonSummary = CategoryComparisonSummary;
export type VeganProteinComparisonResult = CategoryComparisonResult;

function retailerLabel(offer: RawVeganProteinOffer) {
  const relation = Array.isArray(offer.retailer_product)
    ? offer.retailer_product[0]
    : offer.retailer_product;
  return relation?.external_name || "";
}

export function isVeganProteinOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!Number.isFinite(checkedAtTime)) return false;
  const ageHours = (now.getTime() - checkedAtTime) / 3_600_000;
  return ageHours >= 0 && ageHours <= VEGAN_PROTEIN_MAXIMUM_OFFER_AGE_HOURS;
}

export function isVeganProteinProduct(product: RawVeganProteinProduct) {
  if (
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    product.merged_at !== null ||
    !PLANT_IDENTITY.test(product.name) ||
    !PROTEIN_IDENTITY.test(product.name) ||
    NON_POWDER_FOOD.test(product.name) ||
    ANIMAL_PROTEIN.test(product.name) ||
    (product.product_format !== null && product.product_format !== "powder")
  ) {
    return false;
  }

  return !(product.offers || []).some((offer) =>
    ANIMAL_PROTEIN.test(retailerLabel(offer))
  );
}

export function normalizeVeganProteinComparison(
  products: RawVeganProteinProduct[],
  options: { now?: Date } = {}
): Omit<VeganProteinComparisonResult, "error"> {
  return normalizeCategoryComparison(products, {
    isProductInScope: (product) =>
      isVeganProteinProduct(product as RawVeganProteinProduct),
    isOfferFresh: isVeganProteinOfferFresh,
    now: options.now,
  });
}

export function evaluateVeganProteinIndexability(
  summary: VeganProteinComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    VEGAN_PROTEIN_INDEX_GATE,
    structuredDataValid
  );
}

async function loadVeganProteinComparison(): Promise<VeganProteinComparisonResult> {
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
          retailer:retailers (id, name, slug),
          retailer_product:retailer_products (external_name)
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .or("name.ilike.%vegan%,name.ilike.%plant%,name.ilike.%pea%,name.ilike.%rice%,name.ilike.%hemp%")
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Vegan Protein comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeVeganProteinComparison((data || []) as RawVeganProteinProduct[]),
    error: false,
  };
}

export const getVeganProteinComparison = cache(loadVeganProteinComparison);
