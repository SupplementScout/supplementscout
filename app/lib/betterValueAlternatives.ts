import "server-only";

import { cache } from "react";
import {
  normalizeCategoryComparison,
  type CategoryComparisonRow,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { supabase } from "./supabase";

const BETTER_VALUE_PAGE_SIZE = 200;
const MAX_ALTERNATIVES = 3;

export type BetterValueBasis =
  | "cost_per_25g_protein"
  | "price_per_serving"
  | "price_per_kg"
  | "price_per_unit";

export const BETTER_VALUE_BASIS_LABELS: Record<BetterValueBasis, string> = {
  cost_per_25g_protein: "per 25 g protein",
  price_per_serving: "per serving",
  price_per_kg: "per kg",
  price_per_unit: "per unit",
};

export type BetterValueAlternative = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  productUrl: string;
  value: number;
  savingPercent: number;
};

export type BetterValueAlternativesResult = {
  basis: BetterValueBasis | null;
  currentValue: number | null;
  rows: BetterValueAlternative[];
};

const EMPTY_RESULT: BetterValueAlternativesResult = {
  basis: null,
  currentValue: null,
  rows: [],
};

function normalizedIdentity(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function metricValue(row: CategoryComparisonRow, basis: BetterValueBasis) {
  if (basis === "cost_per_25g_protein") return row.costPer25gProtein;
  if (basis === "price_per_serving") return row.pricePerServing;
  if (basis === "price_per_kg") return row.pricePerKg;
  return row.pricePerUnit?.price ?? null;
}

function hasResolvedCurrentOffer(row: CategoryComparisonRow) {
  return (
    row.presentationState === "LIVE" &&
    row.bestOffer !== null &&
    row.bestOffer.variantResolution === "resolved" &&
    row.bestOffer.deliveredPrice !== null
  );
}

function sharesUnitBasis(
  current: CategoryComparisonRow,
  candidate: CategoryComparisonRow,
  basis: BetterValueBasis
) {
  return (
    basis !== "price_per_unit" ||
    (current.pricePerUnit !== null &&
      candidate.pricePerUnit !== null &&
      current.pricePerUnit.unitType === candidate.pricePerUnit.unitType)
  );
}

export function selectBetterValueAlternatives(
  rows: CategoryComparisonRow[],
  options: {
    currentProductId: string;
    category: string;
    productFormat: string;
  }
): BetterValueAlternativesResult {
  const category = normalizedIdentity(options.category);
  const productFormat = normalizedIdentity(options.productFormat);
  if (!category || !productFormat) return EMPTY_RESULT;

  const current = rows.find(
    (row) => String(row.id) === String(options.currentProductId)
  );
  if (!current || !hasResolvedCurrentOffer(current)) return EMPTY_RESULT;

  const candidates = rows.filter(
    (row) =>
      row.id !== current.id &&
      normalizedIdentity(row.category) === category &&
      normalizedIdentity(row.productFormat) === productFormat &&
      hasResolvedCurrentOffer(row)
  );

  const basisPriority: BetterValueBasis[] = [
    "cost_per_25g_protein",
    "price_per_serving",
    "price_per_kg",
    "price_per_unit",
  ];

  for (const basis of basisPriority) {
    const currentValue = metricValue(current, basis);
    if (currentValue === null || !Number.isFinite(currentValue) || currentValue <= 0) {
      continue;
    }

    const comparable = candidates
      .map((candidate) => ({
        candidate,
        value: metricValue(candidate, basis),
      }))
      .filter(
        (entry): entry is { candidate: CategoryComparisonRow; value: number } =>
          entry.value !== null &&
          Number.isFinite(entry.value) &&
          entry.value > 0 &&
          entry.value < currentValue &&
          sharesUnitBasis(current, entry.candidate, basis)
      )
      .sort(
        (left, right) =>
          left.value - right.value ||
          left.candidate.name.localeCompare(right.candidate.name) ||
          left.candidate.id.localeCompare(right.candidate.id)
      )
      .slice(0, MAX_ALTERNATIVES);

    if (comparable.length > 0) {
      return {
        basis,
        currentValue,
        rows: comparable.map(({ candidate, value }) => ({
          id: candidate.id,
          name: candidate.name,
          brand: candidate.brand,
          image: candidate.image,
          productUrl: candidate.productUrl,
          value,
          savingPercent: ((currentValue - value) / currentValue) * 100,
        })),
      };
    }
  }

  return EMPTY_RESULT;
}

async function loadBetterValueAlternatives(
  currentProductId: string,
  category: string | null,
  productFormat: string | null
): Promise<BetterValueAlternativesResult> {
  if (!category?.trim() || !productFormat?.trim()) return EMPTY_RESULT;

  const products: RawCategoryComparisonProduct[] = [];
  let expectedCount: number | null = null;

  for (let from = 0; ; from += BETTER_VALUE_PAGE_SIZE) {
    const { data, error, count } = await supabase
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
        `,
        { count: "exact" }
      )
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .is("merged_at", null)
      .eq("category", category)
      .eq("product_format", productFormat)
      .order("id", { ascending: true })
      .range(from, from + BETTER_VALUE_PAGE_SIZE - 1);

    if (error || count === null) {
      console.error("Unable to load better-value alternatives.");
      return EMPTY_RESULT;
    }
    if (expectedCount === null) expectedCount = count;
    if (count !== expectedCount) {
      console.error("Better-value candidate set changed during pagination.");
      return EMPTY_RESULT;
    }

    const page = (data || []) as RawCategoryComparisonProduct[];
    try {
      products.push(
        ...(await resolveCategoryComparisonVariants(page, { failOnError: true }))
      );
    } catch {
      console.error("Unable to resolve exact variants for better-value alternatives.");
      return EMPTY_RESULT;
    }
    if (page.length < BETTER_VALUE_PAGE_SIZE) break;
  }

  if (expectedCount === null || products.length !== expectedCount) {
    console.error("Better-value candidate set is incomplete.");
    return EMPTY_RESULT;
  }

  const normalized = normalizeCategoryComparison(products, {
    isProductInScope: (product) =>
      product.is_active === true &&
      product.merged_into_product_id === null &&
      product.merged_at === null &&
      normalizedIdentity(product.category) === normalizedIdentity(category) &&
      normalizedIdentity(product.product_format) === normalizedIdentity(productFormat),
    resolveNutritionMetrics: getEffectiveNutritionMetrics,
  });

  return selectBetterValueAlternatives(normalized.rows, {
    currentProductId,
    category,
    productFormat,
  });
}

export const getBetterValueAlternatives = cache(loadBetterValueAlternatives);
