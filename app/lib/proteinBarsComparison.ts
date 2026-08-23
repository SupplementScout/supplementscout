import { cache } from "react";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawCategoryComparisonProduct,
  type RawComparisonOffer,
} from "./categoryComparison";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import { supabase } from "./supabase";

const QUERY_LIMIT = 1000;
export const PROTEIN_BARS_MAXIMUM_OFFER_AGE_HOURS = 24;

export const PROTEIN_BARS_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 20,
} as const;

const EXPLICIT_BAR_IDENTITY = /\b(?:protein\s+bars?|bars?|wafer|flapjack)\b/i;
const NON_BAR_FOOD =
  /\b(?:jam|sauce|spread|cookie|milkshake|pancake|liquid egg|peanut butter|porridge|oats?|cream crunch)\b/i;
const ALLOWED_FORMATS = new Set(["bar", "snack"]);

type RawProteinBarVariant = {
  id: number | string;
  size_value: number | string | null;
  size_unit: string | null;
  pack_count: number | string | null;
  product_format: string | null;
  is_active: boolean | null;
  is_default: boolean | null;
};

export type RawProteinBarsProduct = RawCategoryComparisonProduct & {
  product_variants?: RawProteinBarVariant[] | null;
};

export type ProteinBarsComparisonRow = CategoryComparisonRow & {
  packCount: number;
};

export type ProteinBarsComparisonSummary = CategoryComparisonSummary;
export type ProteinBarsComparisonResult = Omit<CategoryComparisonResult, "rows"> & {
  rows: ProteinBarsComparisonRow[];
};

function positiveInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function concreteActiveVariants(product: RawProteinBarsProduct) {
  return (product.product_variants || []).filter(
    (variant) =>
      variant.is_active === true &&
      (
        variant.is_default !== true ||
        variant.size_value !== null ||
        variant.pack_count !== null ||
        variant.product_format !== null
      )
  );
}

export function getProteinBarsPackCount(product: RawProteinBarsProduct) {
  const variants = concreteActiveVariants(product);
  if (variants.length === 0) return null;
  const packCounts = variants.map((variant) => positiveInteger(variant.pack_count));
  if (packCounts.some((packCount) => packCount === null)) return null;
  const uniquePackCounts = new Set(packCounts as number[]);
  return uniquePackCounts.size === 1 ? [...uniquePackCounts][0] : null;
}

export function isProteinBarsProduct(product: RawProteinBarsProduct) {
  const format = product.product_format?.trim().toLowerCase() || "";
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.category?.trim().toLowerCase() === "protein bars" &&
    EXPLICIT_BAR_IDENTITY.test(product.name) &&
    !NON_BAR_FOOD.test(product.name) &&
    ALLOWED_FORMATS.has(format) &&
    getProteinBarsPackCount(product) !== null
  );
}

export function isProteinBarsOfferFresh(
  checkedAt: string | null,
  now = new Date()
) {
  const checkedAtTime = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  if (!Number.isFinite(checkedAtTime)) return false;
  const ageHours = (now.getTime() - checkedAtTime) / 3_600_000;
  return ageHours >= 0 && ageHours <= PROTEIN_BARS_MAXIMUM_OFFER_AGE_HOURS;
}

export function isExactProteinBarsPackOffer(
  product: RawProteinBarsProduct,
  offer: RawComparisonOffer
) {
  const expectedPackCount = getProteinBarsPackCount(product);
  const variant = Array.isArray(offer.product_variant)
    ? offer.product_variant[0] || null
    : offer.product_variant || null;
  return (
    expectedPackCount !== null &&
    offer.variant_resolution === "resolved" &&
    variant?.is_active === true &&
    positiveInteger(variant.pack_count) === expectedPackCount
  );
}

export function normalizeProteinBarsComparison(
  products: RawProteinBarsProduct[],
  options: { now?: Date } = {}
): Omit<ProteinBarsComparisonResult, "error"> {
  const normalized = normalizeCategoryComparison(products, {
    isProductInScope: isProteinBarsProduct,
    isOfferInScope: (product, offer) =>
      isExactProteinBarsPackOffer(product as RawProteinBarsProduct, offer),
    isOfferFresh: isProteinBarsOfferFresh,
    now: options.now,
  });
  const packCountByProductId = new Map(
    products.map((product) => [String(product.id), getProteinBarsPackCount(product)])
  );
  return {
    ...normalized,
    rows: normalized.rows.map((row) => ({
      ...row,
      packCount: packCountByProductId.get(row.id) as number,
    })),
  };
}

export function evaluateProteinBarsIndexability(
  summary: ProteinBarsComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    PROTEIN_BARS_INDEX_GATE,
    structuredDataValid
  );
}

async function loadProteinBarsComparison(): Promise<ProteinBarsComparisonResult> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, slug, name, brand, category, image, product_format,
      net_weight_g, net_volume_ml, unit_count, unit_type,
      serving_count_verified, serving_size_g, protein_per_serving_g,
      unit_pricing_verified, nutrition_verified, is_active,
      merged_into_product_id, merged_at,
      product_variants (
        id, size_value, size_unit, pack_count, product_format,
        is_active, is_default
      ),
      offers (
        id, retailer_product_id, price, shipping_cost, in_stock,
        last_checked_at, url,
        retailer:retailers (id, name, slug)
      )
    `)
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("category", "Protein Bars")
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Protein Bars comparison.");
    return emptyCategoryComparisonResult() as ProteinBarsComparisonResult;
  }

  const products = await resolveCategoryComparisonVariants(
    (data || []) as RawProteinBarsProduct[]
  );
  return {
    ...normalizeProteinBarsComparison(products),
    error: false,
  };
}

export const getProteinBarsComparison = cache(loadProteinBarsComparison);
