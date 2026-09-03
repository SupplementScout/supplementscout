import { cache } from "react";
import { supabase } from "./supabase";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonOffer,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";

const HYDRATION_QUERY_LIMIT = 1000;

export const HYDRATION_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 8,
} as const;

type RawRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
};

type RawHydrationOffer = {
  id: number | string;
  retailer_product_id: number | string | null;
  price: number | string | null;
  shipping_cost: number | string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  url: string | null;
  retailer: RawRetailer | RawRetailer[] | null;
};

export type RawHydrationProduct = {
  id: number | string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  unit_count: number | string | null;
  unit_type: string | null;
  serving_count_verified: number | string | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
  merged_at: string | null;
  offers?: RawHydrationOffer[] | null;
};

export type HydrationComparisonOffer = CategoryComparisonOffer;
export type HydrationComparisonRow = CategoryComparisonRow;
export type HydrationComparisonSummary = CategoryComparisonSummary;
export type HydrationComparisonResult = CategoryComparisonResult;

export function isHydrationCategoryProduct(product: RawHydrationProduct) {
  if (
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    product.merged_at !== null
  ) {
    return false;
  }

  const category = product.category?.trim().toLowerCase() || "";
  const evidence = `${category} ${product.name}`.toLowerCase();

  return (
    category === "hydration" ||
    /\bhydration\b|\belectrolytes?\b|\bhydrate\b/.test(evidence)
  );
}

export function normalizeHydrationComparison(
  products: RawHydrationProduct[],
  options: { now?: Date } = {}
): Omit<HydrationComparisonResult, "error"> {
  const normalizedProducts = products.map((product) => ({
    ...product,
    product_format: null,
    serving_size_g: null,
    protein_per_serving_g: null,
    unit_pricing_verified: null,
    nutrition_verified: null,
  })) as RawCategoryComparisonProduct[];
  return normalizeCategoryComparison(normalizedProducts, {
    isProductInScope: (product) =>
      isHydrationCategoryProduct(product as RawHydrationProduct),
    now: options.now,
  });
}

export function evaluateHydrationIndexability(
  summary: HydrationComparisonSummary,
  structuredDataValid: boolean
) {
  return evaluateCategoryIndexability(
    summary,
    HYDRATION_INDEX_GATE,
    structuredDataValid
  );
}

async function loadHydrationComparison(): Promise<HydrationComparisonResult> {
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
        net_weight_g,
        net_volume_ml,
        unit_count,
        unit_type,
        serving_count_verified,
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
    .or(
      "category.eq.Hydration,name.ilike.%hydration%,name.ilike.%electrolyte%,name.ilike.%hydrate%"
    )
    .order("name")
    .range(0, HYDRATION_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Hydration comparison.");
    return emptyCategoryComparisonResult();
  }

  return {
    ...normalizeHydrationComparison((data || []) as RawHydrationProduct[]),
    error: false,
  };
}

export const getHydrationComparison = cache(loadHydrationComparison);
