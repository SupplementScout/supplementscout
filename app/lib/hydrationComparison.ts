import { cache } from "react";
import { supabase } from "./supabase";
import {
  emptyCategoryComparisonResult,
  evaluateCategoryIndexability,
  normalizeCategoryComparison,
  type CategoryComparisonOffer,
  type CategoryComparisonRow,
  type CategoryComparisonSummary,
  type RawCategoryComparisonProduct,
} from "./categoryComparison";
import {
  evaluateCategoryCoverage,
  getCategoryCoverageDefinition,
  type CategoryCoverageEvaluation,
} from "./categoryCoverage";

export const HYDRATION_QUERY_PAGE_SIZE = 1000;

export const HYDRATION_INDEX_GATE = {
  minimumProductsWithMultipleFreshRetailers: 3,
  minimumFreshRetailersAcrossComparisons: 2,
  minimumFreshOffers: 8,
} as const;

function requiredCoverageDefinition(key: string) {
  const definition = getCategoryCoverageDefinition(key);
  if (!definition) {
    throw new Error(`Category Coverage definition unavailable: ${key}`);
  }
  return definition;
}

const hydrationDefinition = requiredCoverageDefinition("hydration");
const electrolytesDefinition = requiredCoverageDefinition("electrolytes");

const coreCandidateCategoryPattern =
  /^\s*(?:hydration|electrolytes|energy\s+drinks?|energy\s+supplements)\s*$/i;
const candidateNamePattern =
  /\b(?:hydration|hydrate|rehydrat(?:e|ion)|electrolytes?|isotonic|sports?\s+drinks?|oral\s+rehydration|ors|mineral\s+salts?|sodium|potassium|magnesium|intra[-\s]?workout|fluid\s+replacement)\b/i;
const candidateDescriptionPattern =
  /\b(?:hydration|hydrate|rehydrat(?:e|ion)|electrolytes?|isotonic|sports?\s+drinks?|oral\s+rehydration|ors|mineral\s+salts?|fluid\s+replacement|replace(?:s|ment)?\s+(?:fluids?|salts?|minerals?)|sweat[\s\S]{0,80}(?:sodium|potassium|magnesium|minerals?))\b/i;

const HYDRATION_CANDIDATE_OR_FILTER = [
  "category.eq.Hydration",
  "category.eq.Electrolytes",
  "category.eq.Energy Drinks",
  "category.eq.Energy Supplements",
  ...[
    "hydration",
    "hydrate",
    "rehydrate",
    "rehydration",
    "electrolyte",
    "isotonic",
    "sports drink",
    "oral rehydration",
    "mineral salt",
    "sodium",
    "potassium",
    "magnesium",
    "intra workout",
    "intra-workout",
    "fluid replacement",
  ].map((value) => `name.ilike.%${value}%`),
  ...[
    "hydration",
    "hydrate",
    "rehydrate",
    "rehydration",
    "electrolyte",
    "isotonic",
    "sports drink",
    "oral rehydration",
    "mineral salt",
    "fluid replacement",
    "replace fluids",
    "replace salts",
    "replace minerals",
    "sweat",
  ].map((value) => `description.ilike.%${value}%`),
].join(",");

export type RawHydrationProduct = RawCategoryComparisonProduct & {
  description: string | null;
  product_format: string | null;
};

export type HydrationSemanticSubtype = "electrolytes";
export type HydrationComparisonOffer = CategoryComparisonOffer;
export type HydrationComparisonRow = CategoryComparisonRow & {
  semanticSubtypes: HydrationSemanticSubtype[];
};
export type HydrationComparisonSummary = CategoryComparisonSummary;
export type HydrationComparisonResult = {
  rows: HydrationComparisonRow[];
  summary: HydrationComparisonSummary;
  error: boolean;
};

function isActiveUnmerged(product: RawHydrationProduct) {
  return (
    product.is_active === true &&
    product.merged_into_product_id === null &&
    product.merged_at === null
  );
}

export function hasHydrationCandidateEvidence(product: RawHydrationProduct) {
  return (
    coreCandidateCategoryPattern.test(product.category || "") ||
    candidateNamePattern.test(product.name) ||
    candidateDescriptionPattern.test(product.description || "")
  );
}

export function evaluateHydrationCoverage(
  product: RawHydrationProduct
): CategoryCoverageEvaluation {
  return evaluateCategoryCoverage(hydrationDefinition, product);
}

export function evaluateElectrolytesCoverage(
  product: RawHydrationProduct
): CategoryCoverageEvaluation {
  return evaluateCategoryCoverage(electrolytesDefinition, product);
}

export function normalizeHydrationComparison(
  products: RawHydrationProduct[],
  options: { now?: Date } = {}
): Omit<HydrationComparisonResult, "error"> {
  const electrolyteStrongIds = new Set(
    products
      .filter(
        (product) =>
          isActiveUnmerged(product) &&
          evaluateElectrolytesCoverage(product).classification ===
            "INCLUDE_STRONG"
      )
      .map((product) => String(product.id))
  );
  const normalized = normalizeCategoryComparison(products, {
    isProductInScope: (product) =>
      isActiveUnmerged(product as RawHydrationProduct) &&
      evaluateHydrationCoverage(product as RawHydrationProduct)
        .classification === "INCLUDE_STRONG",
    now: options.now,
  });

  return {
    ...normalized,
    rows: normalized.rows.map((row) => ({
      ...row,
      semanticSubtypes: electrolyteStrongIds.has(row.id)
        ? (["electrolytes"] as HydrationSemanticSubtype[])
        : [],
    })),
  };
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

async function loadHydrationCandidatePage(from: number, to: number) {
  return supabase
    .from("products")
    .select(
      `
        id,
        slug,
        name,
        brand,
        category,
        description,
        image,
        product_format,
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
    .or(HYDRATION_CANDIDATE_OR_FILTER)
    .order("id", { ascending: true })
    .range(from, to);
}

async function loadHydrationComparison(): Promise<HydrationComparisonResult> {
  const candidates: RawHydrationProduct[] = [];

  for (let offset = 0; ; offset += HYDRATION_QUERY_PAGE_SIZE) {
    const { data, error } = await loadHydrationCandidatePage(
      offset,
      offset + HYDRATION_QUERY_PAGE_SIZE - 1
    );

    if (error) {
      console.error("Unable to load the Hydration comparison.");
      const empty = emptyCategoryComparisonResult();
      return { ...empty, rows: [] };
    }

    const page = (data || []) as RawHydrationProduct[];
    candidates.push(...page.filter(hasHydrationCandidateEvidence));
    if (page.length < HYDRATION_QUERY_PAGE_SIZE) break;
  }

  return {
    ...normalizeHydrationComparison(candidates),
    error: false,
  };
}

export const getHydrationComparison = cache(loadHydrationComparison);
