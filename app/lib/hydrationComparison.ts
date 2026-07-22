import { isCreatineOfferFresh } from "./creatineLaunch";
import {
  getDeliveredPrice,
  getKnownProductPrice,
  type DeliveredPrice,
} from "./pricing";
import { supabase } from "./supabase";

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

export type HydrationComparisonOffer = {
  id: string;
  retailer: { id: string; name: string; slug: string | null };
  productPrice: number;
  shippingCost: number | null;
  deliveredPrice: DeliveredPrice | null;
  lastCheckedAt: string;
};

export type HydrationComparisonRow = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  productUrl: string;
  netWeightG: number | null;
  netVolumeMl: number | null;
  unitCount: number | null;
  unitType: string | null;
  verifiedServingCount: number | null;
  offers: HydrationComparisonOffer[];
  bestOffer: HydrationComparisonOffer;
  offerCount: number;
  retailerCount: number;
  lastCheckedAt: string;
};

export type HydrationComparisonSummary = {
  scopedProducts: number;
  visibleProducts: number;
  freshOffers: number;
  freshRetailers: number;
  productsWithOneFreshRetailer: number;
  productsWithMultipleFreshRetailers: number;
  freshRetailersAcrossComparisons: number;
  staleOrUnusableOffersExcluded: number;
  latestOfferCheckedAt: string | null;
};

export type HydrationComparisonResult = {
  rows: HydrationComparisonRow[];
  summary: HydrationComparisonSummary;
  error: boolean;
};

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function positiveNumber(value: number | string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: number | string | null) {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function validHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

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

function normalizeOffer(
  offer: RawHydrationOffer,
  now: Date
): HydrationComparisonOffer | null {
  const retailer = relationOne(offer.retailer);
  const productPrice = getKnownProductPrice(offer.price);
  const checkedAt = Date.parse(offer.last_checked_at || "");

  if (
    offer.in_stock !== true ||
    productPrice === null ||
    !isCreatineOfferFresh(offer.last_checked_at, now) ||
    !Number.isFinite(checkedAt) ||
    offer.retailer_product_id === null ||
    !validHttpUrl(offer.url) ||
    !retailer?.id ||
    !retailer.name?.trim()
  ) {
    return null;
  }

  return {
    id: String(offer.id),
    retailer: {
      id: String(retailer.id),
      name: retailer.name.trim(),
      slug: retailer.slug,
    },
    productPrice,
    shippingCost: getDeliveredPrice(offer)?.shippingCost ?? null,
    deliveredPrice: getDeliveredPrice(offer),
    lastCheckedAt: offer.last_checked_at as string,
  };
}

function offerSort(
  left: HydrationComparisonOffer,
  right: HydrationComparisonOffer
) {
  const leftTotal = left.deliveredPrice?.totalPrice ?? Number.POSITIVE_INFINITY;
  const rightTotal = right.deliveredPrice?.totalPrice ?? Number.POSITIVE_INFINITY;

  return (
    leftTotal - rightTotal ||
    left.productPrice - right.productPrice ||
    left.id.localeCompare(right.id)
  );
}

function completenessScore(row: HydrationComparisonRow) {
  return [
    row.brand,
    row.image,
    row.netWeightG || row.netVolumeMl || row.unitCount,
    row.verifiedServingCount,
  ].filter(Boolean).length;
}

export function hydrationComparisonRowSort(
  left: HydrationComparisonRow,
  right: HydrationComparisonRow
) {
  return (
    right.retailerCount - left.retailerCount ||
    right.offerCount - left.offerCount ||
    completenessScore(right) - completenessScore(left) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function normalizeHydrationComparison(
  products: RawHydrationProduct[],
  options: { now?: Date } = {}
): Omit<HydrationComparisonResult, "error"> {
  const now = options.now || new Date();
  const scopedProducts = products.filter(isHydrationCategoryProduct);
  let staleOrUnusableOffersExcluded = 0;

  const rows = scopedProducts
    .map((product): HydrationComparisonRow | null => {
      const rawOffers = product.offers || [];
      const offers = rawOffers
        .map((offer) => normalizeOffer(offer, now))
        .filter((offer): offer is HydrationComparisonOffer => offer !== null)
        .sort(offerSort);

      staleOrUnusableOffersExcluded += rawOffers.filter(
        (offer) =>
          offer.in_stock === true &&
          getKnownProductPrice(offer.price) !== null &&
          normalizeOffer(offer, now) === null
      ).length;

      if (offers.length === 0) return null;

      return {
        id: String(product.id),
        name: product.name,
        brand: product.brand,
        image: product.image,
        productUrl: `/product/${product.slug || product.id}`,
        netWeightG: positiveNumber(product.net_weight_g),
        netVolumeMl: positiveNumber(product.net_volume_ml),
        unitCount: positiveInteger(product.unit_count),
        unitType: product.unit_type,
        verifiedServingCount: positiveInteger(product.serving_count_verified),
        offers,
        bestOffer: offers[0],
        offerCount: offers.length,
        retailerCount: new Set(offers.map((offer) => offer.retailer.id)).size,
        lastCheckedAt: offers
          .map((offer) => offer.lastCheckedAt)
          .sort()
          .at(-1) as string,
      };
    })
    .filter((row): row is HydrationComparisonRow => row !== null)
    .sort(hydrationComparisonRowSort);

  const offers = rows.flatMap((row) => row.offers);
  const comparisonRows = rows.filter((row) => row.retailerCount >= 2);

  return {
    rows,
    summary: {
      scopedProducts: scopedProducts.length,
      visibleProducts: rows.length,
      freshOffers: offers.length,
      freshRetailers: new Set(offers.map((offer) => offer.retailer.id)).size,
      productsWithOneFreshRetailer: rows.filter(
        (row) => row.retailerCount === 1
      ).length,
      productsWithMultipleFreshRetailers: comparisonRows.length,
      freshRetailersAcrossComparisons: new Set(
        comparisonRows.flatMap((row) =>
          row.offers.map((offer) => offer.retailer.id)
        )
      ).size,
      staleOrUnusableOffersExcluded,
      latestOfferCheckedAt:
        offers.map((offer) => offer.lastCheckedAt).sort().at(-1) || null,
    },
  };
}

export function evaluateHydrationIndexability(
  summary: HydrationComparisonSummary,
  structuredDataValid: boolean
) {
  const blockers: string[] = [];

  if (
    summary.productsWithMultipleFreshRetailers <
    HYDRATION_INDEX_GATE.minimumProductsWithMultipleFreshRetailers
  ) {
    blockers.push("insufficient_multi_retailer_products");
  }
  if (
    summary.freshRetailersAcrossComparisons <
    HYDRATION_INDEX_GATE.minimumFreshRetailersAcrossComparisons
  ) {
    blockers.push("insufficient_comparison_retailers");
  }
  if (summary.freshOffers < HYDRATION_INDEX_GATE.minimumFreshOffers) {
    blockers.push("insufficient_fresh_offers");
  }
  if (!structuredDataValid) blockers.push("structured_data_invalid");

  return { indexable: blockers.length === 0, blockers };
}

export async function getHydrationComparison(): Promise<HydrationComparisonResult> {
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
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .or(
      "category.eq.Hydration,name.ilike.%hydration%,name.ilike.%electrolyte%,name.ilike.%hydrate%"
    )
    .order("name")
    .range(0, HYDRATION_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Hydration comparison.");
    return {
      rows: [],
      summary: {
        scopedProducts: 0,
        visibleProducts: 0,
        freshOffers: 0,
        freshRetailers: 0,
        productsWithOneFreshRetailer: 0,
        productsWithMultipleFreshRetailers: 0,
        freshRetailersAcrossComparisons: 0,
        staleOrUnusableOffersExcluded: 0,
        latestOfferCheckedAt: null,
      },
      error: true,
    };
  }

  return {
    ...normalizeHydrationComparison((data || []) as RawHydrationProduct[]),
    error: false,
  };
}
