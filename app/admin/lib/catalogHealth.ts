import "server-only";

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  CATALOG_HEALTH_ROW_GUARD_MESSAGE,
  type CatalogHealthFilters,
  type CatalogHealthIssueType,
  type CatalogHealthStaleAge,
  getCatalogHealthLoadErrorMessage,
  normalizeCatalogHealthFilters,
} from "./catalogHealthFilters";

export const CATALOG_HEALTH_PAGE_SIZE = 25;
export {
  CATALOG_HEALTH_ROW_GUARD_MESSAGE,
  getCatalogHealthLoadErrorMessage,
  normalizeCatalogHealthFilters,
  type CatalogHealthFilters,
  type CatalogHealthIssueType,
  type CatalogHealthStaleAge,
};
const FETCH_PAGE_SIZE = 1000;
const MAX_FETCH_ROWS = 20000;
const FLAGGED_CATEGORIES = new Set([
  "Pre-Workout",
  "Health Supplements",
  "Whey Protein",
  "Protein Bars",
]);

export type ProductRow = {
  id: string | number;
  slug: string | null;
  name: string;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  image: string | null;
  is_active: boolean | null;
  merged_into_product_id: string | number | null;
  merged_at: string | null;
  unit_pricing_verified: boolean | null;
  nutrition_verified: boolean | null;
};

export type OfferRow = {
  id: string | number;
  product_id: string | number | null;
  retailer_id: string | number | null;
  price: string | number | null;
  shipping_cost: string | number | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
};

export type RetailerRow = {
  id: string | number;
  name: string | null;
  slug: string | null;
  website?: string | null;
};

export type CatalogHealthDataSource = {
  fetchActiveProductsPage: (from: number, to: number) => Promise<ProductRow[]>;
  fetchOffersPage: (from: number, to: number) => Promise<OfferRow[]>;
  fetchRetailers: () => Promise<RetailerRow[]>;
};

export type ProductOfferHealth = {
  product: ProductRow;
  totalOffers: number;
  inStockOffers: OfferRow[];
  lastOfferCheck: string | null;
};

export type ZeroOfferProduct = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  totalOffers: number;
  lastOfferCheck: string | null;
};

export type OneOfferProduct = {
  id: string;
  name: string;
  retailer: string;
  price: string | number | null;
  shipping: string | number | null;
  totalDeliveredPrice: number | null;
  lastChecked: string | null;
};

export type MissingDataProduct = {
  id: string;
  name: string;
  missingGtin: boolean;
  missingImage: boolean;
  missingBrand: boolean;
  missingCategory: boolean;
  missingVerifiedUnitOrNutritionData: boolean;
};

export type StaleOffer = {
  id: string;
  product: string;
  retailer: string;
  price: string | number | null;
  inStock: boolean | null;
  lastChecked: string | null;
  ageInDays: number | null;
};

export type CategoryQuality = {
  category: string;
  count: number;
  flagged: boolean;
};

export type RetailerOption = {
  id: string;
  name: string;
};

export type IssuePage<T> = {
  rows: T[];
  totalRows: number;
  page: number;
  totalPages: number;
};

export type CatalogHealthReport = {
  filters: CatalogHealthFilters;
  summary: {
    activeUnmergedProducts: number;
    productsWithZeroInStockOffers: number;
    productsWithOneInStockOffer: number;
    productsWithTwoOrMoreInStockOffers: number;
    productsMissingGtin: number;
    productsMissingImage: number;
    productsMissingBrand: number;
    productsMissingCategory: number;
    productsWithPotentiallyStaleOffers: number;
    retailersWithZeroInStockOffers: number;
    staleOffersOlderThan7Days: number;
    staleOffersOlderThan30Days: number;
    staleOffersNeverChecked: number;
  };
  status: "Critical" | "Needs attention" | "Healthy";
  retailers: RetailerOption[];
  categories: string[];
  zeroOfferProducts: IssuePage<ZeroOfferProduct>;
  oneOfferProducts: IssuePage<OneOfferProduct>;
  missingDataProducts: IssuePage<MissingDataProduct>;
  staleOffers: IssuePage<StaleOffer>;
  categoryQuality: IssuePage<CategoryQuality>;
};

function idString(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function missingText(value: string | null | undefined) {
  return !value || value.trim() === "";
}

function positivePrice(value: string | number | null) {
  if (value === null || value === "") {
    return null;
  }

  const price = Number(value);

  return Number.isFinite(price) && price > 0 ? price : null;
}

function shippingPrice(value: string | number | null) {
  if (value === null || value === "") {
    return null;
  }

  const shipping = Number(value);

  return Number.isFinite(shipping) && shipping >= 0 ? shipping : null;
}

function isAvailableOffer(offer: OfferRow) {
  return offer.in_stock === true && positivePrice(offer.price) !== null;
}

function deliveredPrice(offer: OfferRow) {
  const price = positivePrice(offer.price);
  const shipping = shippingPrice(offer.shipping_cost);

  if (price === null || shipping === null) {
    return null;
  }

  return price + shipping;
}

function latestIso(values: Array<string | null>) {
  const valid = values.filter((value): value is string => Boolean(value));

  if (valid.length === 0) {
    return null;
  }

  return valid.sort(
    (left, right) => new Date(right).getTime() - new Date(left).getTime()
  )[0];
}

export function getOfferAgeInDays(offer: OfferRow, now: Date) {
  if (!offer.last_checked_at) {
    return null;
  }

  const checkedAt = new Date(offer.last_checked_at).getTime();

  if (!Number.isFinite(checkedAt)) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - checkedAt) / 86400000));
}

function isStaleOffer(offer: OfferRow, now: Date) {
  const age = getOfferAgeInDays(offer, now);

  return age === null || age > 7;
}

function pageRows<T>(rows: T[], requestedPage: number): IssuePage<T> {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / CATALOG_HEALTH_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * CATALOG_HEALTH_PAGE_SIZE;

  return {
    rows: rows.slice(start, start + CATALOG_HEALTH_PAGE_SIZE),
    totalRows,
    page,
    totalPages,
  };
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  label: string
) {
  const rows: T[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const batch = await fetchPage(from, to);

    rows.push(...batch);

    if (rows.length > MAX_FETCH_ROWS) {
      throw new Error(`${CATALOG_HEALTH_ROW_GUARD_MESSAGE} (${label})`);
    }

    if (batch.length < FETCH_PAGE_SIZE) {
      return rows;
    }
  }
}

function validateFilters(
  filters: CatalogHealthFilters,
  retailers: RetailerRow[],
  categoryCounts: Map<string, number>
): CatalogHealthFilters {
  const retailerIds = new Set(retailers.map((retailer) => idString(retailer.id)));

  return {
    ...filters,
    retailer:
      filters.retailer && !retailerIds.has(filters.retailer)
        ? ""
        : filters.retailer,
    category:
      filters.category && !categoryCounts.has(filters.category)
        ? ""
        : filters.category,
  };
}

function filterHealthRows(
  rows: ProductOfferHealth[],
  filters: CatalogHealthFilters
) {
  return rows.filter((row) => {
    if (filters.category && row.product.category !== filters.category) {
      return false;
    }

    if (
      filters.retailer &&
      !row.inStockOffers.some(
        (offer) => idString(offer.retailer_id) === filters.retailer
      )
    ) {
      return false;
    }

    return true;
  });
}

function sortByProductName<T extends { name?: string; product?: ProductRow }>(
  rows: T[]
) {
  return [...rows].sort((left, right) => {
    const leftName = left.name || left.product?.name || "";
    const rightName = right.name || right.product?.name || "";

    return leftName.localeCompare(rightName) || idString(left.product?.id).localeCompare(idString(right.product?.id));
  });
}

export async function getCatalogHealthReport(input: {
  filters: CatalogHealthFilters;
  now?: Date;
  dataSource: CatalogHealthDataSource;
}): Promise<CatalogHealthReport> {
  const now = input.now || new Date();
  const [products, offers, retailers] = await Promise.all([
    fetchAllPages(input.dataSource.fetchActiveProductsPage, "product"),
    fetchAllPages(input.dataSource.fetchOffersPage, "offer"),
    input.dataSource.fetchRetailers(),
  ]);
  const productMap = new Map(products.map((product) => [idString(product.id), product]));
  const retailerMap = new Map(
    retailers.map((retailer) => [idString(retailer.id), retailer.name || `Retailer ${retailer.id}`])
  );
  const offersByProduct = new Map<string, OfferRow[]>();

  for (const offer of offers) {
    const productId = idString(offer.product_id);

    if (!productId || !productMap.has(productId)) {
      continue;
    }

    const existing = offersByProduct.get(productId) || [];
    existing.push(offer);
    offersByProduct.set(productId, existing);
  }

  const categoryCounts = new Map<string, number>();

  for (const product of products) {
    const category = product.category || "Missing category";
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }
  const filters = validateFilters(input.filters, retailers, categoryCounts);
  const healthRows = products.map((product) => {
    const productOffers = offersByProduct.get(idString(product.id)) || [];
    const inStockOffers = productOffers.filter(isAvailableOffer);

    return {
      product,
      totalOffers: productOffers.length,
      inStockOffers,
      lastOfferCheck: latestIso(productOffers.map((offer) => offer.last_checked_at)),
    };
  });
  const filteredHealthRows = filterHealthRows(healthRows, filters);

  const staleOffers = offers
    .filter((offer) => productMap.has(idString(offer.product_id)))
    .filter((offer) => {
      if (filters.retailer && idString(offer.retailer_id) !== filters.retailer) {
        return false;
      }

      if (filters.category) {
        const product = productMap.get(idString(offer.product_id));

        if (product?.category !== filters.category) {
          return false;
        }
      }

      const age = getOfferAgeInDays(offer, now);

      if (filters.staleAge === "never") {
        return age === null;
      }

      if (filters.staleAge === "30d") {
        return age !== null && age > 30;
      }

      return isStaleOffer(offer, now);
    })
    .map((offer) => {
      const product = productMap.get(idString(offer.product_id));

      return {
        id: idString(offer.id),
        product: product?.name || `Product ${offer.product_id}`,
        retailer: retailerMap.get(idString(offer.retailer_id)) || `Retailer ${offer.retailer_id}`,
        price: offer.price,
        inStock: offer.in_stock,
        lastChecked: offer.last_checked_at,
        ageInDays: getOfferAgeInDays(offer, now),
      };
    })
    .sort((left, right) => {
      const leftAge = left.ageInDays === null ? Number.POSITIVE_INFINITY : left.ageInDays;
      const rightAge = right.ageInDays === null ? Number.POSITIVE_INFINITY : right.ageInDays;

      return rightAge - leftAge || left.product.localeCompare(right.product);
    });

  const missingDataRows = sortByProductName(
    filteredHealthRows
      .filter((row) => {
        const product = row.product;

        return (
          missingText(product.gtin) ||
          missingText(product.image) ||
          missingText(product.brand) ||
          missingText(product.category) ||
          product.unit_pricing_verified !== true ||
          product.nutrition_verified !== true
        );
      })
      .map((row) => ({
        id: idString(row.product.id),
        name: row.product.name,
        missingGtin: missingText(row.product.gtin),
        missingImage: missingText(row.product.image),
        missingBrand: missingText(row.product.brand),
        missingCategory: missingText(row.product.category),
        missingVerifiedUnitOrNutritionData:
          row.product.unit_pricing_verified !== true ||
          row.product.nutrition_verified !== true,
      }))
  );
  const zeroOfferRows = sortByProductName(
    filteredHealthRows
      .filter((row) => row.inStockOffers.length === 0)
      .map((row) => ({
        id: idString(row.product.id),
        slug: row.product.slug,
        name: row.product.name,
        brand: row.product.brand,
        category: row.product.category,
        totalOffers: row.totalOffers,
        lastOfferCheck: row.lastOfferCheck,
      }))
  );
  const oneOfferRows = sortByProductName(
    filteredHealthRows
      .filter((row) => row.inStockOffers.length === 1)
      .map((row) => {
        const offer = row.inStockOffers[0];

        return {
          id: idString(row.product.id),
          name: row.product.name,
          retailer: retailerMap.get(idString(offer.retailer_id)) || `Retailer ${offer.retailer_id}`,
          price: offer.price,
          shipping: offer.shipping_cost,
          totalDeliveredPrice: deliveredPrice(offer),
          lastChecked: offer.last_checked_at,
        };
      })
  );
  const categoryRows = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      flagged: FLAGGED_CATEGORIES.has(category),
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
  const inStockRetailerIds = new Set(
    offers
      .filter(isAvailableOffer)
      .map((offer) => idString(offer.retailer_id))
      .filter(Boolean)
  );
  const staleProductIds = new Set(
    offers
      .filter((offer) => productMap.has(idString(offer.product_id)))
      .filter((offer) => isStaleOffer(offer, now))
      .map((offer) => idString(offer.product_id))
  );
  const olderThan7Days = offers.filter((offer) => {
    const age = getOfferAgeInDays(offer, now);

    return productMap.has(idString(offer.product_id)) && age !== null && age > 7;
  }).length;
  const olderThan30Days = offers.filter((offer) => {
    const age = getOfferAgeInDays(offer, now);

    return productMap.has(idString(offer.product_id)) && age !== null && age > 30;
  }).length;
  const neverChecked = offers.filter(
    (offer) =>
      productMap.has(idString(offer.product_id)) && getOfferAgeInDays(offer, now) === null
  ).length;
  const productOfferCounts = {
    zero: 0,
    one: 0,
    multiple: 0,
    missingGtin: 0,
    missingImage: 0,
    missingBrand: 0,
    missingCategory: 0,
  };

  for (const row of healthRows) {
    if (row.inStockOffers.length === 0) {
      productOfferCounts.zero += 1;
    } else if (row.inStockOffers.length === 1) {
      productOfferCounts.one += 1;
    } else {
      productOfferCounts.multiple += 1;
    }

    productOfferCounts.missingGtin += missingText(row.product.gtin) ? 1 : 0;
    productOfferCounts.missingImage += missingText(row.product.image) ? 1 : 0;
    productOfferCounts.missingBrand += missingText(row.product.brand) ? 1 : 0;
    productOfferCounts.missingCategory += missingText(row.product.category) ? 1 : 0;
  }

  const summary = {
    activeUnmergedProducts: products.length,
    productsWithZeroInStockOffers: productOfferCounts.zero,
    productsWithOneInStockOffer: productOfferCounts.one,
    productsWithTwoOrMoreInStockOffers: productOfferCounts.multiple,
    productsMissingGtin: productOfferCounts.missingGtin,
    productsMissingImage: productOfferCounts.missingImage,
    productsMissingBrand: productOfferCounts.missingBrand,
    productsMissingCategory: productOfferCounts.missingCategory,
    productsWithPotentiallyStaleOffers: staleProductIds.size,
    retailersWithZeroInStockOffers: retailers.filter(
      (retailer) => !inStockRetailerIds.has(idString(retailer.id))
    ).length,
    staleOffersOlderThan7Days: olderThan7Days,
    staleOffersOlderThan30Days: olderThan30Days,
    staleOffersNeverChecked: neverChecked,
  };
  const status: CatalogHealthReport["status"] =
    summary.productsWithZeroInStockOffers > 0 ||
    summary.productsMissingCategory > 0 ||
    summary.productsMissingBrand > 0
      ? "Critical"
      : summary.productsWithOneInStockOffer > 0 ||
          summary.productsWithPotentiallyStaleOffers > 0 ||
          summary.productsMissingGtin > 0 ||
          summary.productsMissingImage > 0
        ? "Needs attention"
        : "Healthy";

  return {
    filters,
    summary,
    status,
    retailers: retailers
      .map((retailer) => ({
        id: idString(retailer.id),
        name: retailer.name || `Retailer ${retailer.id}`,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    categories: Array.from(categoryCounts.keys()).sort(),
    zeroOfferProducts: pageRows(zeroOfferRows, filters.page),
    oneOfferProducts: pageRows(oneOfferRows, filters.page),
    missingDataProducts: pageRows(missingDataRows, filters.page),
    staleOffers: pageRows(staleOffers, filters.page),
    categoryQuality: pageRows(categoryRows, filters.page),
  };
}

function requireNoError<T>(
  subject: string,
  result: { data: T | null; error: unknown }
) {
  if (result.error) {
    console.error(`Unable to load catalog health: ${subject}.`, {
      error: result.error,
    });
    throw new Error("Unable to load catalog health.");
  }

  return result.data || [];
}

function createSupabaseCatalogHealthDataSource(): CatalogHealthDataSource {
  return {
    async fetchActiveProductsPage(from, to) {
      return requireNoError(
        "active products",
        await supabaseAdmin
          .from("products")
          .select(
            "id, slug, name, gtin, brand, category, image, is_active, merged_into_product_id, merged_at, unit_pricing_verified, nutrition_verified"
          )
          .eq("is_active", true)
          .is("merged_into_product_id", null)
          .is("merged_at", null)
          .order("name", { ascending: true })
          .range(from, to)
      ) as ProductRow[];
    },
    async fetchOffersPage(from, to) {
      return requireNoError(
        "offers",
        await supabaseAdmin
          .from("offers")
          .select("id, product_id, retailer_id, price, shipping_cost, in_stock, last_checked_at")
          .order("id", { ascending: true })
          .range(from, to)
      ) as OfferRow[];
    },
    async fetchRetailers() {
      return requireNoError(
        "retailers",
        await supabaseAdmin
          .from("retailers")
          .select("id, name, slug, website")
          .order("name", { ascending: true })
      ) as RetailerRow[];
    },
  };
}

export async function loadCatalogHealthReport(input: {
  filters: CatalogHealthFilters;
  now?: Date;
}) {
  return getCatalogHealthReport({
    filters: input.filters,
    now: input.now,
    dataSource: createSupabaseCatalogHealthDataSource(),
  });
}
