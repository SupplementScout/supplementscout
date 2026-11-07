import type { DealsRow } from "./dealsPriceIntelligence";
import { getEffectiveNutritionMetrics, type ProductNutritionMetrics, type VariantNutritionMetrics } from "./nutritionMetrics";
import { formatUnitPrice, getDeliveredPrice, getVerifiedCostPer25gProtein, getVerifiedCostPer5gCreatine, getVerifiedPricePerServing } from "./pricing";

export type HomepageMetric = { value: string; label: string };
export type HomepageComparisonDetails = {
  category: string | null;
  flavour: string | null;
  metrics: HomepageMetric[];
  history?: { date: string; price: number }[];
};
export type HomepageDetailProduct = ProductNutritionMetrics & { id: string; category: string | null; is_active: boolean; merged_into_product_id: string | null };
export type HomepageDetailVariant = NonNullable<VariantNutritionMetrics> & { id: string; product_id: string; pack_count: number | string | null; flavour_label: string | null; is_active: boolean };

export function buildHomepageComparisonDetails(
  row: DealsRow,
  product: HomepageDetailProduct | undefined,
  variant: HomepageDetailVariant | undefined
): HomepageComparisonDetails {
  const empty = { category: product?.category || null, flavour: null, metrics: [] };
  if (!product || !variant || String(product.id) !== row.id || String(variant.id) !== row.variantId ||
      String(variant.product_id) !== row.id || !product.is_active || product.merged_into_product_id !== null || !variant.is_active) return empty;
  const details: HomepageComparisonDetails = { ...empty, flavour: variant.flavour_label?.trim() || null };
  // Existing pack-aware rules resolve overrides. Do not apply single-pack
  // serving arithmetic to multipacks or inherit facts from a different size.
  if (Number(variant.pack_count) !== 1) return details;
  const nutrition = getEffectiveNutritionMetrics(product, variant);
  const delivered = row.bestOffer.deliveredPrice;
  const costPerServing = getVerifiedPricePerServing(delivered, nutrition.serving_count_verified);
  if (costPerServing !== null) details.metrics.push({ value: formatUnitPrice(costPerServing), label: "per serving" });
  const category = product.category?.toLowerCase() || "";
  const args = [delivered, nutrition.serving_count_verified, nutrition.protein_per_serving_g,
    nutrition.unit_pricing_verified, nutrition.nutrition_verified, nutrition.net_weight_g,
    nutrition.serving_size_g, nutrition.product_format] as const;
  const nutrientCost = /protein|whey|mass gainer/.test(category)
    ? getVerifiedCostPer25gProtein(...args)
    : category === "creatine"
      ? getVerifiedCostPer5gCreatine(delivered, nutrition.serving_count_verified, nutrition.creatine_per_serving_g,
        nutrition.unit_pricing_verified, nutrition.nutrition_verified, nutrition.net_weight_g, nutrition.serving_size_g, nutrition.product_format)
      : null;
  if (nutrientCost !== null) details.metrics.push({ value: formatUnitPrice(nutrientCost), label: category === "creatine" ? "per 5g creatine" : "per 25g protein" });
  const servings = Number(nutrition.serving_count_verified);
  if (Number.isInteger(servings) && servings > 0) details.metrics.push({ value: servings.toLocaleString("en-GB"), label: "servings" });
  return details;
}

export function orderHomepageComparisons(rows: DealsRow[], details: Record<string, HomepageComparisonDetails>) {
  // Prefer the reference's complete protein example when information coverage
  // ties; never prefer a brand, retailer or commission. Retain canonical order
  // for all remaining ties.
  const ranked = rows.map((row, index) => ({ row, index, score: Number(Boolean(row.image)) * 4 + (details[row.variantId]?.metrics.length || 0) * 3 + Number(Boolean(details[row.variantId]?.metrics.some((metric) => metric.label === "per 25g protein"))) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: DealsRow[] = [];
  const categories = new Set<string>();
  for (const { row } of ranked) {
    const category = details[row.variantId]?.category;
    if (chosen.length && (!category || categories.has(category))) continue;
    chosen.push(row);
    if (category) categories.add(category);
    if (chosen.length === 4) break;
  }
  for (const { row } of ranked) {
    if (chosen.length === 4) break;
    if (!chosen.includes(row)) chosen.push(row);
  }
  return chosen;
}

export type HomepageHistoryRecord = {
  offer_id: string; identity_series_id: string | null;
  price: number | string | null; shipping_cost: number | string | null; total_price: number | string | null;
  checked_at: string; evidence_status: string | null; currency: string | null; in_stock: boolean | null; anomaly_flags: string[] | null;
};

export function buildHomepageHistory(row: DealsRow, records: HomepageHistoryRecord[]) {
  const offer = row.bestOffer;
  const valid = records.filter((record) => {
    const delivered = getDeliveredPrice(record);
    return String(record.offer_id) === offer.id &&
      record.identity_series_id !== null && record.evidence_status === "proven" && record.currency === "GBP" && record.in_stock === true &&
      Array.isArray(record.anomaly_flags) && record.anomaly_flags.length === 0 &&
      Number.isFinite(Date.parse(record.checked_at)) && Date.parse(record.checked_at) <= Date.parse(offer.lastCheckedAt) &&
      delivered !== null && Math.abs(delivered.totalPrice - Number(record.total_price)) < 0.005;
  });
  // The exact current check/price anchors the immutable series to this current
  // eligible offer. An offer ID alone cannot prove historical variant identity.
  const anchor = valid.find((record) => Date.parse(record.checked_at) === Date.parse(offer.lastCheckedAt) &&
    Number(record.price) === offer.productPrice && Number(record.shipping_cost) === offer.shippingCost);
  if (!anchor) return [];
  const daily = new Map<string, { date: string; price: number; time: number }>();
  for (const record of valid.filter((record) => String(record.identity_series_id) === String(anchor.identity_series_id))) {
    const date = new Date(record.checked_at).toISOString().slice(0, 10);
    const time = Date.parse(record.checked_at);
    if (!daily.has(date) || time > daily.get(date)!.time) daily.set(date, { date, price: Number(record.total_price), time });
  }
  // Actual observation dates, not an invented 90-day series or an interpolated drop.
  return [...daily.values()].sort((a, b) => a.time - b.time).map(({ date, price }) => ({ date, price }));
}
