import {
  getDeliveredPrice,
  getVerifiedCostPer5gCreatine,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
  getVerifiedPricePerServing,
  type DeliveredPrice,
} from "./pricing";
import {
  getEffectiveNutritionMetrics,
} from "./nutritionMetrics";
import { isOfferFresh } from "./offerFreshness";
import { supabase } from "./supabase";

export type SearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "price_per_serving_asc";

export const SEARCH_PAGE_SIZE = 24;
export const SEARCH_RESULT_LOAD_LIMIT = 1000;
export const SEARCH_SUGGESTION_DEFAULT_LIMIT = 10;
export const SEARCH_SUGGESTION_LOAD_LIMIT = 50;

const SEARCH_SUGGESTION_CATEGORY_LIMIT = 3;
const SEARCH_SUGGESTION_BRAND_LIMIT = 2;
const SEARCH_SUGGESTION_PRODUCT_LIMIT = 5;
const SEARCH_SUGGESTION_MIN_QUERY_LENGTH = 2;

export type SearchFilters = {
  category: string;
  brand: string;
  retailer: string;
};

export type SearchRetailer = {
  id: string;
  name: string | null;
  slug: string | null;
  logo: string | null;
};

export type SearchOffer = {
  id: string;
  price: number | string | null;
  shipping_cost: number | string | null;
  url: string | null;
  in_stock: boolean | null;
  retailer: SearchRetailer | null;
  product_variant: RawProductVariant | null;
  deliveredPrice: DeliveredPrice;
};

export type SearchFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type SearchFacets = {
  categories: SearchFacetOption[];
  brands: SearchFacetOption[];
  retailers: SearchFacetOption[];
};

export type SearchMatchStatus = "exact" | "corrected" | "none";

export type SearchMode = "standard_ilike" | "goal_mapped_ilike";

export type SearchMetadata = {
  originalQuery: string;
  appliedQuery: string;
  correctedQuery: string | null;
  queryVariants: string[];
  matchStatus: SearchMatchStatus;
  searchMode: SearchMode;
};

export type SearchIntent = {
  textQuery: string;
  maxDeliveredPrice: number | null;
};

export type SearchSuggestionType = "category" | "brand" | "product";

export type SearchSuggestion = {
  id: string;
  type: SearchSuggestionType;
  label: string;
  href: string;
  matchText: string;
  score: number;
};

export type SearchSuggestionsResult = {
  query: string;
  appliedQuery: string;
  correctedQuery: string | null;
  suggestions: SearchSuggestion[];
};

export type ProductSearchResult = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  product_format: string | null;
  serving_size_g: number | string | null;
  serving_size_ml: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  serving_count_verified: number | string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
  cheapestOffer: SearchOffer;
  validOffers: SearchOffer[];
  availableOfferCount: number;
  availableRetailerCount: number;
  verifiedCostPer5gCreatine: number | null;
  verifiedCostPer25gProtein: number | null;
  verifiedPricePerKg: number | null;
  verifiedPricePerLitre: number | null;
  verifiedPricePerServing: number | null;
  relevanceScore: number;
};

export type RawRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
  logo?: string | null;
};

export type RawOffer = {
  id: number | string;
  product_variant_id?: number | string | null;
  price: number | string | null;
  shipping_cost: number | string | null;
  url: string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  retailer: RawRetailer | RawRetailer[] | null;
  product_variant?: RawProductVariant | RawProductVariant[] | null;
};

type RawProductVariant = {
  id?: number | string;
  size_value: number | string | null;
  size_unit: string | null;
  product_format: string | null;
  nutrition_override: Record<string, unknown> | null;
};

type RawProduct = {
  id: number | string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  image: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  product_format: string | null;
  serving_size_g: number | string | null;
  serving_size_ml: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  serving_count_verified: number | string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
  offers?: RawOffer[] | null;
};

export function attachProductVariants(
  products: RawProduct[],
  variants: RawProductVariant[]
) {
  const variantsById = new Map(
    variants
      .filter((variant) => variant.id !== undefined)
      .map((variant) => [String(variant.id), variant])
  );

  return products.map((product) => ({
    ...product,
    offers: (product.offers || []).map((offer) => ({
      ...offer,
      product_variant:
        offer.product_variant_id === null ||
        offer.product_variant_id === undefined
          ? null
          : variantsById.get(String(offer.product_variant_id)) || null,
    })),
  }));
}

async function loadProductVariants(products: RawProduct[]) {
  const variantIds = Array.from(
    new Set(
      products.flatMap((product) =>
        (product.offers || [])
          .map((offer) => offer.product_variant_id)
          .filter(
            (id): id is number | string => id !== null && id !== undefined
          )
          .map(String)
      )
    )
  );

  if (variantIds.length === 0) return products;

  const { data, error } = await supabase
    .from("product_variants")
    .select("id,size_value,size_unit,product_format,nutrition_override")
    .eq("is_active", true)
    .in("id", variantIds);

  if (error) return products;

  return attachProductVariants(
    products,
    (data || []) as RawProductVariant[]
  );
}

type RawSuggestionProduct = Pick<
  RawProduct,
  "id" | "slug" | "name" | "brand" | "category"
> & {
  offers?: Array<Pick<RawOffer, "id" | "in_stock" | "price" | "last_checked_at">> | null;
};

export type LandingProductMatchInput = Pick<
  RawProduct,
  "name" | "brand" | "category" | "description"
>;

export type ReviewedLandingCategory =
  | "glucosamine"
  | "magnesium"
  | "omega-3"
  | "vitamin-d"
  | "vitamins";

type LandingProductsOptions = {
  page?: number;
  productFilter?: (product: LandingProductMatchInput) => boolean;
};

const vitaminLandingStrongPattern =
  /\b(?:multivitamins?|vitamins?|vitamin\s+(?:a|b|c|d|d2|d3|e|k|k2)|b\s*complex|biotin|calcium|chromium|copper|folic\s+acid|iodine|iron|magnesium|manganese|minerals?|potassium|selenium|zinc)\b/;

const vitaminLandingExcludedIdentityPattern =
  /\b(?:amino|bcaa|chondroitin|cod\s+liver|collagen|creatine|eaa|electrolytes?|energy\s+drinks?|fish\s+oil|glucosamine|hydration|joint|krill|mass\s+gainer|nocco|omega|pre[-\s]?workout|protein|whey)\b/;

const reviewedLandingNamePatterns: Record<
  Exclude<ReviewedLandingCategory, "vitamins">,
  RegExp
> = {
  glucosamine: /\bglucosamine\b/,
  magnesium: /\b(?:magnesium|zma(?:ttack)?|zmb|zmpro)\b/,
  "omega-3":
    /\b(?:cod\s+liver\s+oil|fish\s+oil|flaxseed\s+oil|krill\s+oil|omega[-\s]?3)\b/,
  "vitamin-d":
    /\b(?:d2|d3|vit(?:amin)?\s+d(?:2|3)?)\b/,
};

const omega3LandingExcludedIdentityPattern =
  /\b(?:cat|dog|pet|starflower|evening\s+primrose)\b/;

function firstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeSearchQuery(value: string | string[] | undefined) {
  return (firstParamValue(value) || "").trim();
}

export function normalizeSearchPage(value: string | string[] | undefined) {
  const page = firstParamValue(value);

  if (!page || !/^[1-9][0-9]*$/.test(page)) {
    return 1;
  }

  const parsedPage = Number.parseInt(page, 10);

  return Number.isSafeInteger(parsedPage) ? parsedPage : 1;
}

function normalizeFilterValue(value: string | string[] | undefined) {
  return normalizeWhitespace(firstParamValue(value) || "");
}

export function normalizeSearchFilters(values: {
  category?: string | string[];
  brand?: string | string[];
  retailer?: string | string[];
}): SearchFilters {
  return {
    category: normalizeFilterValue(values.category),
    brand: normalizeFilterValue(values.brand),
    retailer: normalizeFilterValue(values.retailer),
  };
}

export function normalizeSearchSort(
  value: string | string[] | undefined
): SearchSort {
  const sort = firstParamValue(value);

  if (
    sort === "price_asc" ||
    sort === "price_desc" ||
    sort === "price_per_serving_asc"
  ) {
    return sort;
  }

  return "relevance";
}

function sanitizeSupabaseOrTerm(query: string) {
  return query.replace(/[%_,()]/g, " ").trim();
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseSearchIntent(query: string): SearchIntent {
  const normalizedQuery = normalizeWhitespace(query);
  const budgetMatch = normalizedQuery.match(
    /^(.*?)\s+(?:under|below|up\s+to|less\s+than)\s*£?\s*(\d+(?:\.\d{1,2})?)\s*$/i
  );

  if (!budgetMatch) {
    return {
      textQuery: normalizedQuery,
      maxDeliveredPrice: null,
    };
  }

  const maxDeliveredPrice = Number(budgetMatch[2]);
  const textQuery = normalizeWhitespace(
    budgetMatch[1].replace(/^(?:best|cheapest)\s+/i, "")
  );

  if (
    !textQuery ||
    !Number.isFinite(maxDeliveredPrice) ||
    maxDeliveredPrice <= 0 ||
    maxDeliveredPrice > 1000
  ) {
    return {
      textQuery: normalizedQuery,
      maxDeliveredPrice: null,
    };
  }

  return {
    textQuery,
    maxDeliveredPrice,
  };
}

const searchQueryCorrections: Array<[RegExp, string]> = [
  [/\bvit\s+d\b/g, "vitamin d"],
  [/\bomega\s*3\b/g, "omega 3"],
  [/\bmagnesum\b/g, "magnesium"],
  [/\bprotien\b/g, "protein"],
  [/\bsupliments\b/g, "supplements"],
  [/\bcreatin\b/g, "creatine"],
  [/\bglucosamin\b/g, "glucosamine"],
  [/\bsulfate\b/g, "sulphate"],
];

const compactDosagePattern = /\b(\d{1,3})(\d{3})\s*(mg|iu)\b/gi;
const separatedDosagePattern = /\b(\d{1,3})\s+(\d{3})\s*(mg|iu)\b/gi;
const commaDosagePattern = /\b(\d{1,3}),(\d{3})\s*(mg|iu)\b/gi;

function searchableText(values: Array<string | null | undefined>) {
  return normalizeWhitespace(values.filter(Boolean).join(" ")).toLowerCase();
}

export function isVitaminLandingProductMatch(
  product: LandingProductMatchInput
) {
  return isReviewedLandingProductMatch("vitamins", product);
}

export function isReviewedLandingProductMatch(
  category: ReviewedLandingCategory,
  product: LandingProductMatchInput
) {
  const identity = searchableText([product.name]);

  if (category === "vitamins") {
    return (
      !vitaminLandingExcludedIdentityPattern.test(identity) &&
      vitaminLandingStrongPattern.test(identity)
    );
  }

  if (
    category === "omega-3" &&
    omega3LandingExcludedIdentityPattern.test(identity)
  ) {
    return false;
  }

  return reviewedLandingNamePatterns[category].test(identity);
}

function correctedSearchQuery(query: string) {
  return searchQueryCorrections.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    normalizeWhitespace(query).toLowerCase()
  );
}

const goalSearchMappings = new Map<string, string[]>([
  ["muscle gain", ["whey protein", "creatine", "mass gainer"]],
  ["strength", ["creatine", "pre workout"]],
  ["recovery", ["protein", "magnesium", "electrolytes"]],
  ["joint support", ["glucosamine", "chondroitin", "collagen", "omega 3"]],
  ["hydration", ["electrolytes"]],
]);

function goalSearchMapping(query: string) {
  const normalizedQuery = normalizeWhitespace(query).toLowerCase();
  const variants = goalSearchMappings.get(normalizedQuery);

  return variants ? { variants } : null;
}

function dosageFormatVariants(query: string) {
  const variants = new Set<string>();

  const separated = query.replace(compactDosagePattern, "$1 $2$3");
  const compact = query.replace(separatedDosagePattern, "$1$2$3");
  const normalizedSeparated = query.replace(separatedDosagePattern, "$1 $2$3");
  const commaSeparated = query.replace(commaDosagePattern, "$1 $2$3");
  const commaCompact = query.replace(commaDosagePattern, "$1$2$3");

  for (const variant of [
    separated,
    compact,
    normalizedSeparated,
    commaSeparated,
    commaCompact,
  ]) {
    if (variant !== query) {
      variants.add(variant);
    }
  }

  return Array.from(variants).map(normalizeWhitespace);
}

function orderedWildcardQueryVariants(query: string) {
  const tokens = normalizeWhitespace(
    query.toLowerCase().replace(/[^a-z0-9]+/g, " ")
  )
    .split(" ")
    .filter(Boolean);

  const compactDoseIndex = tokens.findIndex((token) =>
    /^\d{4,6}(?:mg|iu)$/.test(token)
  );
  const separatedDoseIndex = tokens.findIndex(
    (token, index) =>
      /^\d{1,3}$/.test(token) &&
      /^\d{3}(?:mg|iu)$/.test(tokens[index + 1] || "")
  );
  const doseIndex = compactDoseIndex >= 0 ? compactDoseIndex : separatedDoseIndex;
  const doseTokenCount = compactDoseIndex >= 0 ? 1 : separatedDoseIndex >= 0 ? 2 : 0;
  const hasDose = doseIndex >= 0;
  const hasGlucosamine = tokens.includes("glucosamine");
  const hasSulphate = tokens.includes("sulphate") || tokens.includes("sulfate");
  const hasTabletFormat = tokens.some((token) => /^tablets?$/.test(token));
  const hasStructuredIdentityToken =
    hasDose ||
    tokens.some((token) =>
      /^\d+(?:\.\d+)?(?:mcg|mg|iu|g|kg|ml|l)$/.test(token)
    ) ||
    tokens.some((token) =>
      /^(?:servings?|capsules?|caps|tablets?|gummies|sachets?|packs?)$/.test(token)
    );

  if (
    tokens.length === 2 &&
    !hasStructuredIdentityToken &&
    !(hasGlucosamine && hasSulphate && hasTabletFormat)
  ) {
    const containsAshwagandhaVariant = tokens.some((token) =>
      /\b(ashwagandha|ashwaganda)\b/.test(token)
    );

    if (
      tokens.every((token) => token.length >= 4) &&
      (tokens.includes("kior") || containsAshwagandhaVariant)
    ) {
      return [`${tokens[0]}%${tokens[1]}`];
    }

    return [];
  }

  if (tokens.length < 2 || tokens.length > 5) {
    return [];
  }

  if (
    !hasStructuredIdentityToken &&
    !(hasGlucosamine && hasSulphate && hasTabletFormat)
  ) {
    return [];
  }

  const variants = [tokens.join("%")];

  if (
    tokens.length === 2 &&
    /^\d+(?:\.\d+)?(?:mcg|mg|iu|g|kg|ml|l)$/.test(tokens[0])
  ) {
    variants.push([...tokens].reverse().join("%"));
  }

  if (doseIndex === 0 && doseTokenCount < tokens.length) {
    variants.push(
      [...tokens.slice(doseTokenCount), ...tokens.slice(0, doseTokenCount)].join("%")
    );
  }

  return variants;
}

function vitaminDk2SearchVariants(query: string) {
  const correctedQuery = correctedSearchQuery(query);

  if (correctedQuery === "vitamin d k2") {
    return ["vitamin d%k2", "vitamin d3%k2"];
  }

  if (correctedQuery === "vitamin d3 k2") {
    return ["vitamin d3%k2"];
  }

  if (correctedQuery === "d3 k2") {
    return ["d3%k2", "vitamin d3%k2"];
  }

  return [];
}

function expandSearchTermVariants(query: string) {
  const normalized = normalizeWhitespace(query);
  const variants = new Set([normalized]);

  if (normalized.includes("ashwagandha")) {
    variants.add(normalized.replace(/ashwagandha/g, "ashwaganda"));
  }

  if (normalized.includes("ashwaganda")) {
    variants.add(normalized.replace(/ashwaganda/g, "ashwagandha"));
  }

  if (
    normalized.includes("kior") &&
    /\b(ashwagandha|ashwaganda)\b/.test(normalized)
  ) {
    variants.add("ashwaganda");
  }

  const withoutDashes = normalized.replace(/-/g, "");
  if (withoutDashes !== normalized) {
    variants.add(withoutDashes);
  }

  const compactAlphaNumericMatch = normalized.match(/^([a-z]+)(\d+)$/i);
  if (compactAlphaNumericMatch) {
    variants.add(`${compactAlphaNumericMatch[1]}-${compactAlphaNumericMatch[2]}`);
  }

  const dashedAlphaNumericMatch = normalized.match(/^([a-z]+)-(\d+)$/i);
  if (dashedAlphaNumericMatch) {
    variants.add(`${dashedAlphaNumericMatch[1]}${dashedAlphaNumericMatch[2]}`);
  }

  const spacedAlphaNumericMatch = normalized.match(/^([a-z]+)\s+(\d+)$/i);
  if (
    spacedAlphaNumericMatch &&
    !["omega", "ksm"].includes(spacedAlphaNumericMatch[1].toLowerCase())
  ) {
    variants.add(`${spacedAlphaNumericMatch[1]}-${spacedAlphaNumericMatch[2]}`);
    variants.add(`${spacedAlphaNumericMatch[1]}${spacedAlphaNumericMatch[2]}`);
  }

  return Array.from(variants);
}

export function searchQueryVariants(query: string) {
  const normalizedQuery = normalizeWhitespace(query);
  const safeNormalizedQuery = sanitizeSupabaseOrTerm(normalizedQuery);
  const safeCorrectedQuery = sanitizeSupabaseOrTerm(correctedSearchQuery(query));

  const exactVariants = [
    safeNormalizedQuery,
    safeCorrectedQuery,
    ...(goalSearchMapping(normalizedQuery)?.variants || []),
    ...vitaminDk2SearchVariants(safeNormalizedQuery),
  ]
    .filter((value) => value.length > 0)
    .flatMap(expandSearchTermVariants);
  const dosageVariants = exactVariants.flatMap(dosageFormatVariants);
  const wildcardVariants = [...exactVariants, ...dosageVariants].flatMap(
    orderedWildcardQueryVariants
  );

  return Array.from(
    new Set([...exactVariants, ...dosageVariants, ...wildcardVariants])
  );
}

export function buildSearchQueryPlan(query: string): SearchMetadata {
  const originalQuery = normalizeWhitespace(query);
  const correctedQueryValue = correctedSearchQuery(originalQuery);
  const correctedQuery =
    correctedQueryValue && correctedQueryValue !== originalQuery.toLowerCase()
      ? correctedQueryValue
      : null;
  const goalMapping = goalSearchMapping(originalQuery);

  return {
    originalQuery,
    appliedQuery: goalMapping
      ? goalMapping.variants.join(", ")
      : correctedQuery || originalQuery,
    correctedQuery: goalMapping ? null : correctedQuery,
    queryVariants: searchQueryVariants(originalQuery),
    matchStatus: "none",
    searchMode: goalMapping ? "goal_mapped_ilike" : "standard_ilike",
  };
}

function buildSearchFilter(query: string) {
  return searchQueryVariants(query)
    .flatMap((variant) => [
      `name.ilike.%${variant}%`,
      `brand.ilike.%${variant}%`,
      `category.ilike.%${variant}%`,
      `description.ilike.%${variant}%`,
    ])
    .join(",");
}

function searchUrlForSuggestion(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}

function productUrlForSuggestion(slug: string) {
  return `/product/${encodeURIComponent(slug)}`;
}

function normalizeSuggestionKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardVariantMatches(value: string, variant: string) {
  if (!variant.includes("%")) {
    return false;
  }

  const pattern = variant
    .split("%")
    .map((part) => escapeRegExp(normalizeSuggestionKey(part)))
    .join(".*");

  return new RegExp(pattern).test(normalizeSuggestionKey(value));
}

function scoreSuggestionText(
  value: string,
  plan: SearchMetadata,
  type: SearchSuggestionType,
  hasInStockOffer: boolean
) {
  const label = normalizeSuggestionKey(value);
  const appliedQuery = normalizeSuggestionKey(plan.appliedQuery);
  const correctedQuery = plan.correctedQuery
    ? normalizeSuggestionKey(plan.correctedQuery)
    : "";
  const variants = plan.queryVariants
    .map((variant) => normalizeSuggestionKey(variant.replace(/%/g, " ")))
    .filter(Boolean);
  let score = 0;

  if (label === appliedQuery || variants.some((variant) => label === variant)) {
    score += 100;
  } else if (
    label.startsWith(appliedQuery) ||
    variants.some((variant) => label.startsWith(variant))
  ) {
    score += 70;
  } else if (
    label.includes(appliedQuery) ||
    variants.some((variant) => label.includes(variant))
  ) {
    score += 35;
  } else if (
    plan.queryVariants.some((variant) => wildcardVariantMatches(value, variant))
  ) {
    score += 60;
  }

  if (score === 0) {
    return 0;
  }

  if (correctedQuery && label.includes(correctedQuery)) {
    score += 20;
  }

  if (type === "category") {
    score += 12;
  } else if (type === "brand") {
    score += 8;
  }

  if (hasInStockOffer) {
    score += 15;
  }

  return score;
}

function bestSuggestionMatch(
  values: string[],
  plan: SearchMetadata,
  type: SearchSuggestionType,
  hasInStockOffer: boolean
) {
  return values.reduce(
    (best, value) => {
      const score = scoreSuggestionText(value, plan, type, hasInStockOffer);

      if (score > best.score) {
        return { matchText: value, score };
      }

      return best;
    },
    { matchText: values[0] || "", score: 0 }
  );
}

function addSuggestion(
  suggestions: SearchSuggestion[],
  seen: Set<string>,
  suggestion: SearchSuggestion
) {
  const key = `${suggestion.type}:${normalizeSuggestionKey(suggestion.label)}`;

  if (seen.has(key) || suggestion.score <= 0) {
    return;
  }

  seen.add(key);
  suggestions.push(suggestion);
}

function suggestionSort(left: SearchSuggestion, right: SearchSuggestion) {
  return (
    right.score - left.score ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeSuggestionLimit(limit: number | undefined) {
  if (!limit || !Number.isSafeInteger(limit)) {
    return SEARCH_SUGGESTION_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), SEARCH_SUGGESTION_DEFAULT_LIMIT);
}

function buildLandingProductFilter(queries: string[]) {
  return Array.from(new Set(queries.flatMap(searchQueryVariants)))
    .flatMap((variant) => [
      `name.ilike.%${variant}%`,
      `category.ilike.%${variant}%`,
      `description.ilike.%${variant}%`,
    ])
    .join(",");
}

function normalizeRetailer(
  retailer: RawOffer["retailer"]
): SearchRetailer | null {
  const value = Array.isArray(retailer) ? retailer[0] || null : retailer;

  if (!value) {
    return null;
  }

  return {
    id: String(value.id),
    name: value.name,
    slug: value.slug,
    logo: value.logo || null,
  };
}

export function retailerFilterValue(retailer: SearchRetailer | null) {
  if (!retailer) {
    return "";
  }

  return normalizeWhitespace(retailer.slug || retailer.id);
}

function scoreProduct(product: RawProduct, query: string) {
  const normalizedQuery = normalizeWhitespace(query).toLowerCase();
  const name = normalizeWhitespace(product.name).toLowerCase();
  const brand = normalizeWhitespace(product.brand || "").toLowerCase();
  const category = normalizeWhitespace(product.category || "").toLowerCase();

  let score = 0;

  if (name === normalizedQuery) {
    score += 100;
  }

  if (name.startsWith(normalizedQuery)) {
    score += 60;
  }

  if (name.includes(normalizedQuery)) {
    score += 40;
  }

  if (brand === normalizedQuery) {
    score += 35;
  } else if (brand.includes(normalizedQuery)) {
    score += 20;
  }

  if (category === normalizedQuery) {
    score += 30;
  } else if (category.includes(normalizedQuery)) {
    score += 15;
  }

  for (const term of normalizedQuery.split(" ").filter(Boolean)) {
    if (name.includes(term)) {
      score += 6;
    }

    if (brand.includes(term) || category.includes(term)) {
      score += 3;
    }
  }

  return score;
}

function scoreProductForSearch(product: RawProduct, plan: SearchMetadata) {
  if (plan.searchMode !== "goal_mapped_ilike") {
    return scoreProduct(product, plan.originalQuery);
  }

  const mappedTerms = goalSearchMapping(plan.originalQuery)?.variants || [];
  const mappedScore = Math.max(
    0,
    ...mappedTerms.map((term) => scoreProduct(product, term))
  );

  if (mappedScore > 0) {
    return 1000 + mappedScore;
  }

  return scoreProduct(product, plan.originalQuery);
}

export function normalizeSearchOffers(offers: RawOffer[], now = new Date()) {
  return offers
    .filter(
      (offer) =>
        offer.in_stock === true && isOfferFresh(offer.last_checked_at, now)
    )
    .map((offer) => {
      const deliveredPrice = getDeliveredPrice(offer);

      if (!deliveredPrice) {
        return null;
      }

      return {
        id: String(offer.id),
        price: offer.price,
        shipping_cost: offer.shipping_cost,
        url: offer.url,
        in_stock: offer.in_stock,
        retailer: normalizeRetailer(offer.retailer),
        product_variant: Array.isArray(offer.product_variant)
          ? offer.product_variant[0] || null
          : offer.product_variant || null,
        deliveredPrice,
      };
    })
    .filter((offer): offer is SearchOffer => offer !== null)
    .sort(
      (left, right) =>
        left.deliveredPrice.totalPrice - right.deliveredPrice.totalPrice ||
        left.id.localeCompare(right.id)
    );
}

export function countAvailableRetailers(offers: SearchOffer[]) {
  return new Set(
    offers
      .map((offer) => offer.retailer?.id || "")
      .filter(Boolean)
  ).size;
}

function normalizeProduct(
  product: RawProduct,
  query: string,
  filters: SearchFilters,
  searchPlan?: SearchMetadata
): ProductSearchResult | null {
  const validOffers = normalizeSearchOffers(product.offers || []);

  const matchingRetailerOffers = filters.retailer
    ? validOffers.filter(
        (offer) => retailerFilterValue(offer.retailer) === filters.retailer
      )
    : validOffers;

  const cheapestOffer = matchingRetailerOffers[0] || null;

  if (!cheapestOffer) {
    return null;
  }
  const effectiveMetrics = getEffectiveNutritionMetrics(
    product,
    cheapestOffer.product_variant
  );

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image: product.image,
    net_weight_g: effectiveMetrics.net_weight_g,
    net_volume_ml: product.net_volume_ml,
    product_format: effectiveMetrics.product_format,
    serving_size_g: effectiveMetrics.serving_size_g,
    serving_size_ml: product.serving_size_ml,
    protein_per_serving_g: effectiveMetrics.protein_per_serving_g,
    creatine_per_serving_g: effectiveMetrics.creatine_per_serving_g,
    serving_count_verified: effectiveMetrics.serving_count_verified,
    nutrition_verified: effectiveMetrics.nutrition_verified,
    unit_pricing_verified: effectiveMetrics.unit_pricing_verified,
    cheapestOffer,
    validOffers,
    availableOfferCount: validOffers.length,
    availableRetailerCount: countAvailableRetailers(validOffers),
    verifiedCostPer5gCreatine: getVerifiedCostPer5gCreatine(
      cheapestOffer.deliveredPrice,
      effectiveMetrics.serving_count_verified,
      effectiveMetrics.creatine_per_serving_g,
      effectiveMetrics.unit_pricing_verified,
      effectiveMetrics.nutrition_verified,
      effectiveMetrics.net_weight_g,
      effectiveMetrics.serving_size_g,
      effectiveMetrics.product_format
    ),
    verifiedCostPer25gProtein: getVerifiedCostPer25gProtein(
      cheapestOffer.deliveredPrice,
      effectiveMetrics.serving_count_verified,
      effectiveMetrics.protein_per_serving_g,
      effectiveMetrics.unit_pricing_verified,
      effectiveMetrics.nutrition_verified,
      effectiveMetrics.net_weight_g,
      effectiveMetrics.serving_size_g,
      effectiveMetrics.product_format
    ),
    verifiedPricePerKg: getVerifiedPricePerKg(
      cheapestOffer.deliveredPrice,
      effectiveMetrics.net_weight_g,
      effectiveMetrics.product_format,
      effectiveMetrics.unit_pricing_verified
    ),
    verifiedPricePerLitre: getVerifiedPricePerLitre(
      cheapestOffer.deliveredPrice,
      product.net_volume_ml,
      effectiveMetrics.product_format,
      effectiveMetrics.unit_pricing_verified
    ),
    verifiedPricePerServing: getVerifiedPricePerServing(
      cheapestOffer.deliveredPrice,
      effectiveMetrics.serving_count_verified
    ),
    relevanceScore: searchPlan
      ? scoreProductForSearch(product, searchPlan)
      : scoreProduct(product, query),
  };
}

function optionSort(left: SearchFacetOption, right: SearchFacetOption) {
  return right.count - left.count || left.label.localeCompare(right.label);
}

function facetOptionsFromMap(map: Map<string, SearchFacetOption>) {
  return Array.from(map.values()).sort(optionSort);
}

function buildFacets(results: ProductSearchResult[]): SearchFacets {
  const categories = new Map<string, SearchFacetOption>();
  const brands = new Map<string, SearchFacetOption>();
  const retailers = new Map<string, SearchFacetOption>();

  for (const product of results) {
    const category = normalizeWhitespace(product.category || "");

    if (category) {
      const existing = categories.get(category);
      categories.set(category, {
        value: category,
        label: category,
        count: (existing?.count || 0) + 1,
      });
    }

    const brand = normalizeWhitespace(product.brand || "");

    if (brand) {
      const existing = brands.get(brand);
      brands.set(brand, {
        value: brand,
        label: brand,
        count: (existing?.count || 0) + 1,
      });
    }

    const productRetailers = new Map<string, SearchFacetOption>();

    for (const offer of product.validOffers) {
      const value = retailerFilterValue(offer.retailer);

      if (!value) {
        continue;
      }

      productRetailers.set(value, {
        value,
        label: offer.retailer?.name || value,
        count: 1,
      });
    }

    for (const [value, option] of productRetailers) {
      const existing = retailers.get(value);
      retailers.set(value, {
        value,
        label: option.label,
        count: (existing?.count || 0) + 1,
      });
    }
  }

  return {
    categories: facetOptionsFromMap(categories),
    brands: facetOptionsFromMap(brands),
    retailers: facetOptionsFromMap(retailers),
  };
}

function applyProductFilters(
  results: ProductSearchResult[],
  filters: SearchFilters
) {
  return results.filter((product) => {
    if (
      filters.category &&
      normalizeWhitespace(product.category || "") !== filters.category
    ) {
      return false;
    }

    if (filters.brand && normalizeWhitespace(product.brand || "") !== filters.brand) {
      return false;
    }

    if (
      filters.retailer &&
      !product.validOffers.some(
        (offer) => retailerFilterValue(offer.retailer) === filters.retailer
      )
    ) {
      return false;
    }

    return true;
  });
}

function sortResults(results: ProductSearchResult[], sort: SearchSort) {
  return [...results].sort((left, right) => {
    const fallback =
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    const deliveredPriceFallback =
      left.cheapestOffer.deliveredPrice.totalPrice -
        right.cheapestOffer.deliveredPrice.totalPrice || fallback;

    if (sort === "price_asc") {
      return deliveredPriceFallback;
    }

    if (sort === "price_desc") {
      return (
        right.cheapestOffer.deliveredPrice.totalPrice -
          left.cheapestOffer.deliveredPrice.totalPrice || fallback
      );
    }

    if (sort === "price_per_serving_asc") {
      if (left.verifiedPricePerServing === null) {
        return right.verifiedPricePerServing === null ? deliveredPriceFallback : 1;
      }

      if (right.verifiedPricePerServing === null) {
        return -1;
      }

      return (
        left.verifiedPricePerServing - right.verifiedPricePerServing ||
        deliveredPriceFallback
      );
    }

    return (
      right.relevanceScore - left.relevanceScore ||
      deliveredPriceFallback
    );
  });
}

export async function searchProducts(
  query: string,
  sort: SearchSort,
  filters: SearchFilters = { category: "", brand: "", retailer: "" },
  requestedPage = 1
) {
  const intent = parseSearchIntent(query);
  const sanitizedQuery = sanitizeSupabaseOrTerm(intent.textQuery);
  const searchMetadata = buildSearchQueryPlan(sanitizedQuery);

  if (!sanitizedQuery) {
    return {
      results: [],
      facets: { categories: [], brands: [], retailers: [] },
      totalCount: 0,
      unfilteredCount: 0,
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
      totalPages: 1,
      startResult: 0,
      endResult: 0,
      resultLimit: SEARCH_RESULT_LOAD_LIMIT,
      maxDeliveredPrice: intent.maxDeliveredPrice,
      metadata: searchMetadata,
      error: null,
    };
  }

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
        product_format,
        serving_size_g,
        serving_size_ml,
        protein_per_serving_g,
        creatine_per_serving_g,
        serving_count_verified,
        nutrition_verified,
        unit_pricing_verified,
        offers!inner (
          id,
          product_variant_id,
          price,
          shipping_cost,
          url,
          in_stock,
          last_checked_at,
          retailer:retailers (
            id,
            name,
            slug,
            logo
          )
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .or(buildSearchFilter(sanitizedQuery))
    .order("name")
    .range(0, SEARCH_RESULT_LOAD_LIMIT - 1);

  if (error) {
    return {
      results: [],
      facets: { categories: [], brands: [], retailers: [] },
      totalCount: 0,
      unfilteredCount: 0,
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
      totalPages: 1,
      startResult: 0,
      endResult: 0,
      resultLimit: SEARCH_RESULT_LOAD_LIMIT,
      maxDeliveredPrice: intent.maxDeliveredPrice,
      metadata: searchMetadata,
      error,
    };
  }

  const enrichedProducts = await loadProductVariants(
    (data || []) as RawProduct[]
  );
  const eligibleResults = enrichedProducts
    .map((product) =>
      normalizeProduct(
        product,
        sanitizedQuery,
        {
          category: "",
          brand: "",
          retailer: "",
        },
        searchMetadata
      )
    )
    .filter((product): product is ProductSearchResult => product !== null);
  const isWithinBudget = (product: ProductSearchResult) =>
    intent.maxDeliveredPrice === null ||
    product.cheapestOffer.deliveredPrice.totalPrice <= intent.maxDeliveredPrice;
  const baseResults =
    intent.maxDeliveredPrice === null
      ? eligibleResults
      : eligibleResults.filter(isWithinBudget);
  const facets = buildFacets(baseResults);
  const filteredResults = filters.retailer
    ? enrichedProducts
        .map((product) =>
          normalizeProduct(product, sanitizedQuery, filters, searchMetadata)
        )
        .filter((product): product is ProductSearchResult => product !== null)
        .filter(isWithinBudget)
    : baseResults;
  const results = applyProductFilters(filteredResults, filters);
  const sortedResults = sortResults(results, sort);
  const totalCount = sortedResults.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / SEARCH_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * SEARCH_PAGE_SIZE;
  const endIndex =
    totalCount === 0
      ? 0
      : Math.min(startIndex + SEARCH_PAGE_SIZE, totalCount);
  const metadata: SearchMetadata = {
    ...searchMetadata,
    matchStatus:
      totalCount === 0
        ? "none"
        : searchMetadata.correctedQuery
          ? "corrected"
          : "exact",
  };

  return {
    results: sortedResults.slice(startIndex, endIndex),
    facets,
    totalCount,
    unfilteredCount: baseResults.length,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    totalPages,
    startResult: totalCount === 0 ? 0 : startIndex + 1,
    endResult: endIndex,
    resultLimit: SEARCH_RESULT_LOAD_LIMIT,
    maxDeliveredPrice: intent.maxDeliveredPrice,
    metadata,
    error: null,
  };
}

export async function getSearchSuggestions(query: string, limit?: number) {
  const intent = parseSearchIntent(query);
  const sanitizedQuery = sanitizeSupabaseOrTerm(intent.textQuery);
  const plan = buildSearchQueryPlan(sanitizedQuery);
  const resultLimit = normalizeSuggestionLimit(limit);
  const emptyResult: SearchSuggestionsResult = {
    query: plan.originalQuery,
    appliedQuery: plan.appliedQuery,
    correctedQuery: plan.correctedQuery,
    suggestions: [],
  };

  if (plan.originalQuery.length < SEARCH_SUGGESTION_MIN_QUERY_LENGTH) {
    return emptyResult;
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id,
        slug,
        name,
        brand,
        category,
        offers!inner (
          id,
          in_stock,
          price,
          last_checked_at
        )
      `
    )
    .eq("is_active", true)
    .is("merged_into_product_id", null)
    .is("merged_at", null)
    .not("slug", "is", null)
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .or(buildSearchFilter(sanitizedQuery))
    .order("name")
    .range(0, SEARCH_SUGGESTION_LOAD_LIMIT - 1);

  if (error) {
    return emptyResult;
  }

  const rows = ((data || []) as RawSuggestionProduct[]).filter(
    (product) => product.slug
  );
  const seen = new Set<string>();
  const categorySuggestions: SearchSuggestion[] = [];
  const brandSuggestions: SearchSuggestion[] = [];
  const productSuggestions: SearchSuggestion[] = [];

  for (const product of rows) {
    const hasInStockOffer = (product.offers || []).some(
      (offer) =>
        offer.in_stock === true &&
        Number(offer.price) > 0 &&
        isOfferFresh(offer.last_checked_at)
    );

    if (product.category) {
      const match = bestSuggestionMatch(
        [product.category],
        plan,
        "category",
        hasInStockOffer
      );
      addSuggestion(categorySuggestions, seen, {
        id: `category-${normalizeSuggestionKey(product.category).replace(/\s+/g, "-")}`,
        type: "category",
        label: product.category,
        href: searchUrlForSuggestion(product.category),
        matchText: match.matchText,
        score: match.score,
      });
    }

    if (product.brand) {
      const match = bestSuggestionMatch(
        [product.brand],
        plan,
        "brand",
        hasInStockOffer
      );
      addSuggestion(brandSuggestions, seen, {
        id: `brand-${normalizeSuggestionKey(product.brand).replace(/\s+/g, "-")}`,
        type: "brand",
        label: product.brand,
        href: searchUrlForSuggestion(product.brand),
        matchText: match.matchText,
        score: match.score,
      });
    }

    if (product.slug) {
      const match = bestSuggestionMatch(
        [product.name, product.brand || "", product.category || ""].filter(
          Boolean
        ),
        plan,
        "product",
        hasInStockOffer
      );
      addSuggestion(productSuggestions, seen, {
        id: `product-${String(product.id)}`,
        type: "product",
        label: product.name,
        href: productUrlForSuggestion(product.slug),
        matchText: match.matchText,
        score: match.score,
      });
    }
  }

  return {
    ...emptyResult,
    suggestions: [
      ...categorySuggestions
        .sort(suggestionSort)
        .slice(0, SEARCH_SUGGESTION_CATEGORY_LIMIT),
      ...brandSuggestions
        .sort(suggestionSort)
        .slice(0, SEARCH_SUGGESTION_BRAND_LIMIT),
      ...productSuggestions
        .sort(suggestionSort)
        .slice(0, SEARCH_SUGGESTION_PRODUCT_LIMIT),
    ]
      .sort(suggestionSort)
      .slice(0, resultLimit),
  };
}

export async function getLandingProducts(
  query: string | string[],
  limit = 24,
  options: LandingProductsOptions = {}
) {
  const sanitizedQueries = (Array.isArray(query) ? query : [query])
    .map(sanitizeSupabaseOrTerm)
    .filter((value) => value.length > 0);
  const primaryQuery = sanitizedQueries[0] || "";
  const pageSize =
    Number.isSafeInteger(limit) && limit > 0 ? limit : SEARCH_PAGE_SIZE;
  const requestedPage =
    Number.isSafeInteger(options.page) && (options.page || 0) > 0
      ? options.page!
      : 1;

  if (!primaryQuery) {
    return {
      results: [],
      error: null,
      page: 1,
      pageSize,
      totalCount: 0,
      totalPages: 1,
    };
  }

  const data: RawProduct[] = [];

  for (let from = 0; ; from += SEARCH_RESULT_LOAD_LIMIT) {
    const { data: pageData, error } = await supabase
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
        net_weight_g,
        net_volume_ml,
        product_format,
        serving_size_g,
        serving_size_ml,
        protein_per_serving_g,
        creatine_per_serving_g,
        serving_count_verified,
        nutrition_verified,
        unit_pricing_verified,
        offers!inner (
          id,
          product_variant_id,
          price,
          shipping_cost,
          url,
          in_stock,
          last_checked_at,
          retailer:retailers (
            id,
            name,
            slug,
            logo
          )
        )
      `
      )
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .is("merged_at", null)
      .eq("offers.in_stock", true)
      .gt("offers.price", 0)
      .or(buildLandingProductFilter(sanitizedQueries))
      .order("name")
      .order("id")
      .range(from, from + SEARCH_RESULT_LOAD_LIMIT - 1);

    if (error) {
      return {
        results: [],
        error,
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 1,
      };
    }

    const rows = (pageData || []) as RawProduct[];
    data.push(...rows);

    if (rows.length < SEARCH_RESULT_LOAD_LIMIT) {
      break;
    }
  }

  const enrichedProducts = await loadProductVariants(data);
  const matchingResults = enrichedProducts
    .filter((product) =>
      options.productFilter ? options.productFilter(product) : true
    )
    .map((product) =>
      normalizeProduct(product, primaryQuery, {
        category: "",
        brand: "",
        retailer: "",
      })
    )
    .filter((product): product is ProductSearchResult => product !== null)
    .sort(
      (left, right) =>
        left.cheapestOffer.deliveredPrice.totalPrice -
          right.cheapestOffer.deliveredPrice.totalPrice ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
    );
  const totalCount = matchingResults.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize;

  return {
    results: matchingResults.slice(startIndex, startIndex + pageSize),
    error: null,
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}
