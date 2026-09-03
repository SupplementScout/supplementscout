
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

const BRAND = "BioTech USA";
const QUERY_LIMIT = 1000;

export const BIOTECH_USA_INDEX_GATE = {
  minimumVisibleProducts: 20,
  minimumProductsWithMultipleFreshRetailers: 10,
  minimumFreshRetailersAcrossComparisons: 3,
  minimumFreshOffers: 50,
  minimumVisibleCategories: 5,
} as const;

const DISPLAY_CATEGORY_BY_PRODUCT_ID: Readonly<Record<string, string>> = {
  "10": "Whey Isolate",
  "14": "Whey Isolate",
  "1014": "Whey Isolate",
  "1018": "Whey Isolate",
  "71": "Plant Protein",
  "67": "Casein Protein",
  "1119": "Food & Snacks",
  "1099": "Food & Baking Mixes",
  "1082": "Food & Snacks",
  "402": "Natural Plant Extracts",
  "365": "Amino Acids",
};

export type BioTechUSACategorySummary = {
  name: string;
  products: number;
  multiRetailerProducts: number;
};

export type BioTechUSABrandResult = CategoryComparisonResult & {
  categories: BioTechUSACategorySummary[];
};

export type BioTechUSABrandRow = CategoryComparisonRow;
export type BioTechUSABrandSummary = CategoryComparisonSummary;

export function isBioTechUSAProduct(product: RawCategoryComparisonProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null &&
    product.brand === BRAND
  );
}

export function bioTechUSADisplayCategory(
  product: Pick<CategoryComparisonRow, "id" | "category">
) {
  return (
    DISPLAY_CATEGORY_BY_PRODUCT_ID[String(product.id)] ||
    product.category?.trim() ||
    "Other"
  );
}

function categorySummaries(rows: CategoryComparisonRow[]) {
  const categories = new Map<string, BioTechUSACategorySummary>();

  for (const row of rows) {
    const name = bioTechUSADisplayCategory(row);
    const current = categories.get(name) || {
      name,
      products: 0,
      multiRetailerProducts: 0,
    };
    current.products += 1;
    if (row.retailerCount >= 2) current.multiRetailerProducts += 1;
    categories.set(name, current);
  }

  return [...categories.values()].sort(
    (left, right) =>
      right.multiRetailerProducts - left.multiRetailerProducts ||
      right.products - left.products ||
      left.name.localeCompare(right.name)
  );
}

export function normalizeBioTechUSABrand(
  products: RawCategoryComparisonProduct[],
  options: { now?: Date } = {}
): Omit<BioTechUSABrandResult, "error"> {
  const comparison = normalizeCategoryComparison(products, {
    isProductInScope: isBioTechUSAProduct,
    now: options.now,
  });

  return {
    ...comparison,
    categories: categorySummaries(comparison.rows),
  };
}

export function evaluateBioTechUSAIndexability(
  result: Pick<BioTechUSABrandResult, "summary" | "categories">,
  structuredDataValid: boolean
) {
  const coverage = evaluateCategoryIndexability(
    result.summary,
    BIOTECH_USA_INDEX_GATE,
    structuredDataValid
  );
  const blockers = [...coverage.blockers];

  if (result.summary.visibleProducts < BIOTECH_USA_INDEX_GATE.minimumVisibleProducts) {
    blockers.push("insufficient_visible_products");
  }
  if (result.categories.length < BIOTECH_USA_INDEX_GATE.minimumVisibleCategories) {
    blockers.push("insufficient_visible_categories");
  }

  return { indexable: blockers.length === 0, blockers };
}

function emptyResult(): BioTechUSABrandResult {
  return { ...emptyCategoryComparisonResult(), categories: [] };
}

async function loadBioTechUSABrand(): Promise<BioTechUSABrandResult> {
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
          retailer:retailers (
            id,
            name,
            slug
          )
        )
      `
    )
    .eq("brand", BRAND)
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the BioTech USA brand comparison.");
    return emptyResult();
  }

  return {
    ...normalizeBioTechUSABrand((data || []) as RawCategoryComparisonProduct[]),
    error: false,
  };
}

export const getBioTechUSABrand = cache(loadBioTechUSABrand);

