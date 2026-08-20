import { cache } from "react";
import {
  categoryComparisonRowSort,
  emptyCategoryComparisonResult,
  normalizeCategoryComparison,
  type CategoryComparisonOffer,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import { supabase } from "./supabase";

export const EBAY_UK_RETAILER_ID = "12";
const QUERY_LIMIT = 1000;
const FRESHNESS_MS = 24 * 60 * 60 * 1000;

export const EBAY_UK_INDEX_GATE = {
  minimumVisibleProducts: 20,
  minimumComparableProducts: 10,
  minimumRetailersAcrossComparisons: 3,
  minimumFreshOffersAcrossVisibleProducts: 50,
  minimumVisibleCategories: 5,
} as const;

type TargetOfferCandidate = {
  product_id: number | string | null;
  retailer_product_id: number | string | null;
  last_checked_at: string | null;
  url: string | null;
};

export type EbayUKRetailerRow = CategoryComparisonRow & {
  ebayOffers: CategoryComparisonOffer[];
  bestEbayOffer: CategoryComparisonOffer;
  bestAlternativeOffer: CategoryComparisonOffer | null;
};

export type EbayUKCategorySummary = {
  name: string;
  products: number;
  comparableProducts: number;
};

export type EbayUKRetailerSummary = CategoryComparisonSummary & {
  targetFreshOffers: number;
  visibleCategories: number;
  visibleBrands: number;
};

export type EbayUKRetailerResult = {
  rows: EbayUKRetailerRow[];
  summary: EbayUKRetailerSummary;
  categories: EbayUKCategorySummary[];
  error: boolean;
};

function validHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isFreshTargetOffer(offer: TargetOfferCandidate, now: Date) {
  const checkedAt = Date.parse(offer.last_checked_at || "");
  const age = now.getTime() - checkedAt;
  return (
    offer.product_id != null &&
    offer.retailer_product_id != null &&
    Number.isFinite(checkedAt) &&
    age >= 0 &&
    age <= FRESHNESS_MS &&
    validHttpUrl(offer.url)
  );
}

function categorySummaries(rows: EbayUKRetailerRow[]) {
  const categories = new Map<string, EbayUKCategorySummary>();

  for (const row of rows) {
    const name = row.category?.trim() || "Other";
    const current = categories.get(name) || {
      name,
      products: 0,
      comparableProducts: 0,
    };
    current.products += 1;
    if (row.bestAlternativeOffer) current.comparableProducts += 1;
    categories.set(name, current);
  }

  return [...categories.values()].sort(
    (left, right) =>
      right.comparableProducts - left.comparableProducts ||
      right.products - left.products ||
      left.name.localeCompare(right.name)
  );
}

function summarizeRows(
  rows: EbayUKRetailerRow[],
  scopedProducts: number,
  staleOrUnusableOffersExcluded: number
): EbayUKRetailerSummary {
  const offers = rows.flatMap((row) => row.offers);
  const comparisonRows = rows.filter((row) => row.bestAlternativeOffer);

  return {
    scopedProducts,
    visibleProducts: rows.length,
    freshOffers: offers.length,
    freshRetailers: new Set(offers.map((offer) => offer.retailer.id)).size,
    productsWithOneFreshRetailer: rows.filter((row) => row.retailerCount === 1).length,
    productsWithMultipleFreshRetailers: comparisonRows.length,
    freshRetailersAcrossComparisons: new Set(
      comparisonRows.flatMap((row) => row.offers.map((offer) => offer.retailer.id))
    ).size,
    staleOrUnusableOffersExcluded,
    latestOfferCheckedAt:
      offers.map((offer) => offer.lastCheckedAt).sort().at(-1) || null,
    targetFreshOffers: rows.reduce((sum, row) => sum + row.ebayOffers.length, 0),
    visibleCategories: new Set(rows.map((row) => row.category?.trim() || "Other")).size,
    visibleBrands: new Set(rows.map((row) => row.brand?.trim() || "Unknown")).size,
  };
}

export function normalizeEbayUKRetailer(
  products: RawCategoryComparisonProduct[],
  options: { now?: Date } = {}
): Omit<EbayUKRetailerResult, "error"> {
  const comparison = normalizeCategoryComparison(products, {
    isProductInScope: (product) =>
      product.is_active === true &&
      product.merged_into_product_id === null &&
      product.merged_at === null,
    now: options.now,
  });

  const rows = comparison.rows
    .map((row): EbayUKRetailerRow | null => {
      const ebayOffers = row.offers.filter(
        (offer) => offer.retailer.id === EBAY_UK_RETAILER_ID
      );
      if (!ebayOffers.length) return null;
      return {
        ...row,
        ebayOffers,
        bestEbayOffer: ebayOffers[0],
        bestAlternativeOffer:
          row.offers.find((offer) => offer.retailer.id !== EBAY_UK_RETAILER_ID) || null,
      };
    })
    .filter((row): row is EbayUKRetailerRow => row !== null)
    .sort(
      (left, right) =>
        Number(Boolean(right.bestAlternativeOffer)) -
          Number(Boolean(left.bestAlternativeOffer)) ||
        categoryComparisonRowSort(left, right)
    );
  const categories = categorySummaries(rows);

  return {
    rows,
    summary: summarizeRows(
      rows,
      products.length,
      comparison.summary.staleOrUnusableOffersExcluded
    ),
    categories,
  };
}

export function evaluateEbayUKIndexability(
  result: Pick<EbayUKRetailerResult, "summary" | "categories">,
  structuredDataValid: boolean
) {
  const blockers: string[] = [];
  if (result.summary.visibleProducts < EBAY_UK_INDEX_GATE.minimumVisibleProducts) {
    blockers.push("insufficient_visible_products");
  }
  if (
    result.summary.productsWithMultipleFreshRetailers <
    EBAY_UK_INDEX_GATE.minimumComparableProducts
  ) {
    blockers.push("insufficient_comparable_products");
  }
  if (
    result.summary.freshRetailersAcrossComparisons <
    EBAY_UK_INDEX_GATE.minimumRetailersAcrossComparisons
  ) {
    blockers.push("insufficient_retailers_across_comparisons");
  }
  if (
    result.summary.freshOffers <
    EBAY_UK_INDEX_GATE.minimumFreshOffersAcrossVisibleProducts
  ) {
    blockers.push("insufficient_fresh_offers_across_visible_products");
  }
  if (result.categories.length < EBAY_UK_INDEX_GATE.minimumVisibleCategories) {
    blockers.push("insufficient_visible_categories");
  }
  if (!structuredDataValid) blockers.push("structured_data_invalid");
  return { indexable: blockers.length === 0, blockers };
}

function emptyResult(): EbayUKRetailerResult {
  const empty = emptyCategoryComparisonResult();
  return {
    rows: [],
    categories: [],
    summary: {
      ...empty.summary,
      targetFreshOffers: 0,
      visibleCategories: 0,
      visibleBrands: 0,
    },
    error: true,
  };
}

async function loadEbayUKRetailer(): Promise<EbayUKRetailerResult> {
  const now = new Date();
  const targetResult = await supabase
    .from("offers")
    .select("product_id, retailer_product_id, last_checked_at, url", { count: "exact" })
    .eq("retailer_id", Number(EBAY_UK_RETAILER_ID))
    .eq("in_stock", true)
    .gt("price", 0)
    .order("id")
    .range(0, QUERY_LIMIT - 1);

  if (targetResult.error || (targetResult.count || 0) > QUERY_LIMIT) {
    console.error("Unable to load the bounded eBay UK offer scope.");
    return emptyResult();
  }

  const productIds = [
    ...new Set(
      ((targetResult.data || []) as TargetOfferCandidate[])
        .filter((offer) => isFreshTargetOffer(offer, now))
        .map((offer) => String(offer.product_id))
    ),
  ];
  if (!productIds.length) return { ...emptyResult(), error: false };

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
    .in("id", productIds)
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the eBay UK retailer comparison.");
    return emptyResult();
  }

  return {
    ...normalizeEbayUKRetailer((data || []) as RawCategoryComparisonProduct[], { now }),
    error: false,
  };
}

export const getEbayUKRetailer = cache(loadEbayUKRetailer);
