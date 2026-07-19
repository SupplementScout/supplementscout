import {
  getDeliveredPrice,
  getKnownProductPrice,
  getVerifiedCostPer5gCreatine,
  type DeliveredPrice,
} from "./pricing";
import { isCreatineOfferFresh } from "./creatineLaunch";
import { supabase } from "./supabase";

const CREATINE_QUERY_LIMIT = 1000;

type RawRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
};

type RawCreatineOffer = {
  id: number | string;
  price: number | string | null;
  shipping_cost: number | string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  retailer: RawRetailer | RawRetailer[] | null;
};

type RawCreatineProduct = {
  id: number | string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  net_weight_g: number | string | null;
  serving_count_verified: number | string | null;
  serving_size_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  product_format: string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
  offers?: RawCreatineOffer[] | null;
};

export type CreatineComparisonOffer = {
  id: string;
  retailer: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
  productPrice: number;
  shippingCost: number | null;
  deliveredPrice: DeliveredPrice | null;
  lastCheckedAt: string | null;
};

export type CreatineComparisonRow = {
  id: string;
  slug: string | null;
  productUrl: string;
  name: string;
  brand: string | null;
  image: string | null;
  netWeightG: number | null;
  verifiedServingCount: number | null;
  creatinePerServingG: number | null;
  bestOffer: CreatineComparisonOffer | null;
  offerCount: number;
  retailerCount: number;
  verifiedCostPer5g: number | null;
  lastCheckedAt: string | null;
};

export type CreatineComparisonSummary = {
  activeProducts: number;
  activeOffers: number;
  retailers: number;
  productsWithMultipleRetailers: number;
  latestOfferCheckedAt: string | null;
  staleOffersExcluded: number;
};

export type CreatineComparisonResult = {
  rows: CreatineComparisonRow[];
  summary: CreatineComparisonSummary;
  error: boolean;
};

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function positiveNumber(value: number | string | null) {
  if (value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: number | string | null) {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function timestampValue(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function latestTimestamp(values: Array<string | null>) {
  return values.reduce<string | null>((latest, value) => {
    const currentTime = timestampValue(value);
    const latestTime = timestampValue(latest);

    if (currentTime === null) {
      return latest;
    }

    return latestTime === null || currentTime > latestTime ? value : latest;
  }, null);
}

function normalizeOffer(
  offer: RawCreatineOffer,
  now = new Date()
): CreatineComparisonOffer | null {
  if (offer.in_stock !== true) {
    return null;
  }

  const productPrice = getKnownProductPrice(offer.price);

  if (productPrice === null) {
    return null;
  }

  if (!isCreatineOfferFresh(offer.last_checked_at, now)) {
    return null;
  }

  const retailer = relationOne(offer.retailer);
  const deliveredPrice = getDeliveredPrice(offer);

  return {
    id: String(offer.id),
    retailer: retailer
      ? {
          id: String(retailer.id),
          name: retailer.name,
          slug: retailer.slug,
        }
      : null,
    productPrice,
    shippingCost: deliveredPrice?.shippingCost ?? null,
    deliveredPrice,
    lastCheckedAt:
      timestampValue(offer.last_checked_at) !== null
        ? offer.last_checked_at
        : null,
  };
}

function isCurrentPriceCandidate(offer: RawCreatineOffer, now = new Date()) {
  return (
    offer.in_stock === true &&
    getKnownProductPrice(offer.price) !== null &&
    isCreatineOfferFresh(offer.last_checked_at, now)
  );
}

function offerSort(
  left: CreatineComparisonOffer,
  right: CreatineComparisonOffer
) {
  if (left.deliveredPrice === null) {
    if (right.deliveredPrice !== null) return 1;
  } else if (right.deliveredPrice === null) {
    return -1;
  } else if (left.deliveredPrice.totalPrice !== right.deliveredPrice.totalPrice) {
    return left.deliveredPrice.totalPrice - right.deliveredPrice.totalPrice;
  }

  return left.productPrice - right.productPrice || left.id.localeCompare(right.id);
}

export function creatineComparisonRowSort(
  left: CreatineComparisonRow,
  right: CreatineComparisonRow
) {
  if (left.bestOffer === null) {
    if (right.bestOffer !== null) return 1;
  } else if (right.bestOffer === null) {
    return -1;
  }

  const leftDelivered = left.bestOffer?.deliveredPrice?.totalPrice ?? null;
  const rightDelivered = right.bestOffer?.deliveredPrice?.totalPrice ?? null;

  if (leftDelivered === null) {
    if (rightDelivered !== null) return 1;
  } else if (rightDelivered === null) {
    return -1;
  } else if (leftDelivered !== rightDelivered) {
    return leftDelivered - rightDelivered;
  }

  if (left.verifiedCostPer5g === null) {
    if (right.verifiedCostPer5g !== null) return 1;
  } else if (right.verifiedCostPer5g === null) {
    return -1;
  } else if (left.verifiedCostPer5g !== right.verifiedCostPer5g) {
    return left.verifiedCostPer5g - right.verifiedCostPer5g;
  }

  return (
    right.retailerCount - left.retailerCount ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function normalizeCreatineComparison(
  products: RawCreatineProduct[],
  options: { now?: Date } = {}
): Omit<CreatineComparisonResult, "error"> {
  const now = options.now || new Date();
  const exactProducts = products.filter(
    (product) => product.category?.trim().toLowerCase() === "creatine"
  );

  const rows = exactProducts.map<CreatineComparisonRow>((product) => {
    const offers = (product.offers || [])
      .map((offer) => normalizeOffer(offer, now))
      .filter((offer): offer is CreatineComparisonOffer => offer !== null)
      .sort(offerSort);
    const bestOffer = offers[0] || null;
    const retailerCount = new Set(
      offers.map((offer) => offer.retailer?.id || "").filter(Boolean)
    ).size;
    return {
      id: String(product.id),
      slug: product.slug,
      productUrl: `/product/${product.slug || product.id}`,
      name: product.name,
      brand: product.brand,
      image: product.image,
      netWeightG: positiveNumber(product.net_weight_g),
      verifiedServingCount: positiveInteger(product.serving_count_verified),
      creatinePerServingG:
        product.nutrition_verified === true
          ? positiveNumber(product.creatine_per_serving_g)
          : null,
      bestOffer,
      offerCount: offers.length,
      retailerCount,
      verifiedCostPer5g: getVerifiedCostPer5gCreatine(
        bestOffer?.deliveredPrice || null,
        product.serving_count_verified,
        product.creatine_per_serving_g,
        product.unit_pricing_verified,
        product.nutrition_verified,
        product.net_weight_g,
        product.serving_size_g,
        product.product_format
      ),
      lastCheckedAt: bestOffer?.lastCheckedAt || null,
    };
  });

  rows.sort(creatineComparisonRowSort);

  const retailerIds = new Set<string>();
  let activeOffers = 0;
  let productsWithMultipleRetailers = 0;
  let staleOffersExcluded = 0;
  const offerCheckedAt: Array<string | null> = [];

  for (const product of exactProducts) {
    const offers = (product.offers || [])
      .map((offer) => normalizeOffer(offer, now))
      .filter((offer): offer is CreatineComparisonOffer => offer !== null);
    const staleOffers = (product.offers || []).filter(
      (offer) =>
        offer.in_stock === true &&
        getKnownProductPrice(offer.price) !== null &&
        !isCurrentPriceCandidate(offer, now)
    );
    const productRetailers = new Set<string>();

    activeOffers += offers.length;
    staleOffersExcluded += staleOffers.length;
    offerCheckedAt.push(...offers.map((offer) => offer.lastCheckedAt));

    for (const offer of offers) {
      if (offer.retailer?.id) {
        retailerIds.add(offer.retailer.id);
        productRetailers.add(offer.retailer.id);
      }
    }

    if (productRetailers.size >= 2) {
      productsWithMultipleRetailers += 1;
    }
  }

  return {
    rows,
    summary: {
      activeProducts: exactProducts.length,
      activeOffers,
      retailers: retailerIds.size,
      productsWithMultipleRetailers,
      latestOfferCheckedAt: latestTimestamp(offerCheckedAt),
      staleOffersExcluded,
    },
  };
}

export async function getCreatineComparison(): Promise<CreatineComparisonResult> {
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
        serving_count_verified,
        serving_size_g,
        creatine_per_serving_g,
        product_format,
        nutrition_verified,
        unit_pricing_verified,
        offers (
          id,
          price,
          shipping_cost,
          in_stock,
          last_checked_at,
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
    .ilike("category", "creatine")
    .eq("offers.in_stock", true)
    .gt("offers.price", 0)
    .order("name")
    .range(0, CREATINE_QUERY_LIMIT - 1);

  if (error) {
    console.error("Unable to load the Creatine comparison.");
    return {
      rows: [],
      summary: {
        activeProducts: 0,
        activeOffers: 0,
        retailers: 0,
        productsWithMultipleRetailers: 0,
        latestOfferCheckedAt: null,
        staleOffersExcluded: 0,
      },
      error: true,
    };
  }

  return {
    ...normalizeCreatineComparison((data || []) as RawCreatineProduct[]),
    error: false,
  };
}
