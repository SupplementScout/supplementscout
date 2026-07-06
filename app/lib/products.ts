import {
  getDeliveredPrice,
  getVerifiedCostPer5gCreatine,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
  getVerifiedPricePerServing,
  type DeliveredPrice,
} from "./pricing";
import { supabase } from "./supabase";

export type SearchSort = "relevance" | "price_asc" | "price_desc";

export const SEARCH_PAGE_SIZE = 24;
export const SEARCH_RESULT_LOAD_LIMIT = 1000;

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
  serving_size_ml: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  serving_count_verified: number | string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
  cheapestOffer: SearchOffer;
  validOffers: SearchOffer[];
  availableOfferCount: number;
  verifiedCostPer5gCreatine: number | null;
  verifiedCostPer25gProtein: number | null;
  verifiedPricePerKg: number | null;
  verifiedPricePerLitre: number | null;
  verifiedPricePerServing: number | null;
  relevanceScore: number;
};

type RawRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
  logo?: string | null;
};

type RawOffer = {
  id: number | string;
  price: number | string | null;
  shipping_cost: number | string | null;
  url: string | null;
  in_stock: boolean | null;
  retailer: RawRetailer | RawRetailer[] | null;
};

type RawProduct = {
  id: number | string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  product_format: string | null;
  serving_size_ml: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  serving_count_verified: number | string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
  offers?: RawOffer[] | null;
};

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

  if (sort === "price_asc" || sort === "price_desc") {
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

function searchQueryVariants(query: string) {
  return Array.from(
    new Set([query, normalizeWhitespace(query)].filter((value) => value.length > 0))
  );
}

function buildSearchFilter(query: string) {
  return searchQueryVariants(query)
    .flatMap((variant) => [
      `name.ilike.%${variant}%`,
      `brand.ilike.%${variant}%`,
      `category.ilike.%${variant}%`,
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

function normalizeProduct(
  product: RawProduct,
  query: string,
  filters: SearchFilters
): ProductSearchResult | null {
  const validOffers = (product.offers || [])
    .filter((offer) => offer.in_stock === true)
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
        deliveredPrice,
      };
    })
    .filter((offer): offer is SearchOffer => offer !== null)
    .sort(
      (left, right) =>
        left.deliveredPrice.totalPrice - right.deliveredPrice.totalPrice ||
        left.id.localeCompare(right.id)
    );

  const matchingRetailerOffers = filters.retailer
    ? validOffers.filter(
        (offer) => retailerFilterValue(offer.retailer) === filters.retailer
      )
    : validOffers;

  const cheapestOffer = matchingRetailerOffers[0] || null;

  if (!cheapestOffer) {
    return null;
  }

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    image: product.image,
    net_weight_g: product.net_weight_g,
    net_volume_ml: product.net_volume_ml,
    product_format: product.product_format,
    serving_size_ml: product.serving_size_ml,
    protein_per_serving_g: product.protein_per_serving_g,
    creatine_per_serving_g: product.creatine_per_serving_g,
    serving_count_verified: product.serving_count_verified,
    nutrition_verified: product.nutrition_verified,
    unit_pricing_verified: product.unit_pricing_verified,
    cheapestOffer,
    validOffers,
    availableOfferCount: validOffers.length,
    verifiedCostPer5gCreatine: getVerifiedCostPer5gCreatine(
      cheapestOffer.deliveredPrice,
      product.serving_count_verified,
      product.creatine_per_serving_g,
      product.unit_pricing_verified,
      product.nutrition_verified
    ),
    verifiedCostPer25gProtein: getVerifiedCostPer25gProtein(
      cheapestOffer.deliveredPrice,
      product.serving_count_verified,
      product.protein_per_serving_g,
      product.unit_pricing_verified,
      product.nutrition_verified
    ),
    verifiedPricePerKg: getVerifiedPricePerKg(
      cheapestOffer.deliveredPrice,
      product.net_weight_g,
      product.product_format,
      product.unit_pricing_verified
    ),
    verifiedPricePerLitre: getVerifiedPricePerLitre(
      cheapestOffer.deliveredPrice,
      product.net_volume_ml,
      product.product_format,
      product.unit_pricing_verified
    ),
    verifiedPricePerServing: getVerifiedPricePerServing(
      cheapestOffer.deliveredPrice,
      product.serving_count_verified,
      product.unit_pricing_verified
    ),
    relevanceScore: scoreProduct(product, query),
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

    if (sort === "price_asc") {
      return (
        left.cheapestOffer.deliveredPrice.totalPrice -
          right.cheapestOffer.deliveredPrice.totalPrice || fallback
      );
    }

    if (sort === "price_desc") {
      return (
        right.cheapestOffer.deliveredPrice.totalPrice -
          left.cheapestOffer.deliveredPrice.totalPrice || fallback
      );
    }

    return (
      right.relevanceScore - left.relevanceScore ||
      left.cheapestOffer.deliveredPrice.totalPrice -
        right.cheapestOffer.deliveredPrice.totalPrice ||
      fallback
    );
  });
}

export async function searchProducts(
  query: string,
  sort: SearchSort,
  filters: SearchFilters = { category: "", brand: "", retailer: "" },
  requestedPage = 1
) {
  const sanitizedQuery = sanitizeSupabaseOrTerm(query);

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
        serving_size_ml,
        protein_per_serving_g,
        creatine_per_serving_g,
        serving_count_verified,
        nutrition_verified,
        unit_pricing_verified,
        offers!inner (
          id,
          price,
          shipping_cost,
          url,
          in_stock,
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
      error,
    };
  }

  const baseResults = ((data || []) as RawProduct[])
    .map((product) =>
      normalizeProduct(product, sanitizedQuery, {
        category: "",
        brand: "",
        retailer: "",
      })
    )
    .filter((product): product is ProductSearchResult => product !== null);
  const facets = buildFacets(baseResults);
  const filteredResults = filters.retailer
    ? ((data || []) as RawProduct[])
        .map((product) => normalizeProduct(product, sanitizedQuery, filters))
        .filter((product): product is ProductSearchResult => product !== null)
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
    error: null,
  };
}
