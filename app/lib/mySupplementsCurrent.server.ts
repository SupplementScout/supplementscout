import "server-only";

import { classifyOfferCollection, isOfferFresh } from "./offerFreshness";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { getDeliveredPrice } from "./pricing";
import { supabaseAdmin } from "./supabaseAdmin";
import { selectMySupplementPack } from "./mySupplementsPack";

export type MySupplementsCurrentRequestItem = {
  productId: string;
  variantId: string;
};

export type MySupplementsCurrentSnapshot = {
  key: string;
  productId: string;
  variantId: string;
  exactMatch: boolean;
  canonicalPath: string | null;
  name: string | null;
  brand: string | null;
  packLabel: string | null;
  packAmount: number | null;
  packUnit: "unit" | "gram" | "serving" | "pack" | null;
  presentation: "LIVE" | "RECENT" | "OUT_OF_STOCK" | "UNVERIFIED" | "REVIEW";
  currentPrice: {
    productPrice: number;
    shippingCost: number;
    deliveredTotal: number;
    retailerName: string;
    retailerCount: number;
    checkedAt: string;
  } | null;
};

type ProductRow = {
  id: number | string;
  name: string;
  slug: string | null;
  brand: string | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
  net_weight_g: number | string | null;
  product_format: string | null;
  unit_count: number | string | null;
  unit_type: string | null;
  serving_count_verified: number | string | null;
  serving_size_g: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  unit_pricing_verified: boolean | null;
  nutrition_verified: boolean | null;
};

type VariantRow = {
  id: number | string;
  product_id: number | string;
  display_name: string | null;
  size_value: number | string | null;
  size_unit: string | null;
  product_format: string | null;
  nutrition_override: Record<string, unknown> | null;
  is_active: boolean | null;
};

type OfferRow = {
  id: number | string;
  product_id: number | string;
  product_variant_id: number | string | null;
  retailer_id: number | string;
  price: number | string | null;
  shipping_cost: number | string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  retailer: { id: number | string; name: string } | { id: number | string; name: string }[] | null;
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function packDetails(product: ProductRow, variant: VariantRow) {
  const effective = getEffectiveNutritionMetrics(product, variant);
  return selectMySupplementPack({
    unitCount: product.unit_count,
    unitType: product.unit_type,
    netWeightG: effective.net_weight_g,
    servingCount: effective.serving_count_verified,
    unitPricingVerified: effective.unit_pricing_verified,
    variantLabel: variant.display_name || null,
  });
}

export async function loadMySupplementsCurrent(
  items: MySupplementsCurrentRequestItem[],
  now = new Date()
): Promise<MySupplementsCurrentSnapshot[]> {
  if (items.length === 0) return [];
  const productIds = [...new Set(items.map((item) => item.productId))];
  const variantIds = [...new Set(items.map((item) => item.variantId))];

  const [productsResult, variantsResult, offersResult] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,name,slug,brand,is_active,merged_into_product_id,net_weight_g,product_format,unit_count,unit_type,serving_count_verified,serving_size_g,protein_per_serving_g,creatine_per_serving_g,unit_pricing_verified,nutrition_verified")
      .in("id", productIds),
    supabaseAdmin
      .from("product_variants")
      .select("id,product_id,display_name,size_value,size_unit,product_format,nutrition_override,is_active")
      .in("id", variantIds),
    supabaseAdmin
      .from("offers")
      .select("id,product_id,product_variant_id,retailer_id,price,shipping_cost,in_stock,last_checked_at,retailer:retailers(id,name)")
      .in("product_id", productIds),
  ]);

  if (productsResult.error || variantsResult.error || offersResult.error) {
    throw new Error("Unable to load current supplement data.");
  }

  const products = new Map(((productsResult.data || []) as unknown as ProductRow[]).map((row) => [String(row.id), row]));
  const variants = new Map(((variantsResult.data || []) as unknown as VariantRow[]).map((row) => [String(row.id), row]));
  const offers = (offersResult.data || []) as unknown as OfferRow[];

  return items.map((item) => {
    const key = `${item.productId}:${item.variantId}`;
    const product = products.get(item.productId) || null;
    const variant = variants.get(item.variantId) || null;
    const exactMatch = Boolean(
      product &&
      variant &&
      product.is_active !== false &&
      product.merged_into_product_id === null &&
      variant.is_active !== false &&
      String(variant.product_id) === item.productId
    );
    if (!product || !variant || !exactMatch) {
      return {
        key,
        productId: item.productId,
        variantId: item.variantId,
        exactMatch: false,
        canonicalPath: null,
        name: null,
        brand: null,
        packLabel: null,
        packAmount: null,
        packUnit: null,
        presentation: "UNVERIFIED" as const,
        currentPrice: null,
      };
    }

    const matchingOffers = offers.filter((offer) =>
      String(offer.product_id) === item.productId && String(offer.product_variant_id) === item.variantId
    );
    const presentation = classifyOfferCollection(matchingOffers, now).state;
    const currentOffers = matchingOffers
      .filter((offer) => offer.in_stock === true && isOfferFresh(offer.last_checked_at, now))
      .map((offer) => ({ offer, delivered: getDeliveredPrice(offer) }))
      .filter((row): row is { offer: OfferRow; delivered: NonNullable<ReturnType<typeof getDeliveredPrice>> } => row.delivered !== null)
      .sort((left, right) => left.delivered.totalPrice - right.delivered.totalPrice || String(left.offer.id).localeCompare(String(right.offer.id), "en", { numeric: true }));
    const best = currentOffers[0] || null;
    const retailerCount = new Set(currentOffers.map((row) => String(row.offer.retailer_id))).size;
    const pack = packDetails(product, variant);

    return {
      key,
      productId: item.productId,
      variantId: item.variantId,
      exactMatch: true,
      canonicalPath: `/product/${product.slug || product.id}?variant=${encodeURIComponent(item.variantId)}`,
      name: product.name,
      brand: product.brand,
      ...pack,
      presentation,
      currentPrice: best && best.offer.last_checked_at
        ? {
          productPrice: best.delivered.productPrice,
          shippingCost: best.delivered.shippingCost,
          deliveredTotal: best.delivered.totalPrice,
          retailerName: relationOne(best.offer.retailer)?.name || "Unknown retailer",
          retailerCount,
          checkedAt: best.offer.last_checked_at,
        }
        : null,
    };
  });
}

