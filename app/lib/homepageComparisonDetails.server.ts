import "server-only";
import type { DealsRow } from "./dealsPriceIntelligence";
import { buildHomepageComparisonDetails, buildHomepageHistory, type HomepageComparisonDetails, type HomepageDetailProduct, type HomepageDetailVariant, type HomepageHistoryRecord } from "./homepageComparisonDetails";
import { supabaseAdmin } from "./supabaseAdmin";

// Enrich only the bounded shortlist from the existing deals loader. This does
// not query offers again or change its identity, delivery or freshness rules.
export async function getHomepageComparisonDetails(rows: DealsRow[]): Promise<Record<string, HomepageComparisonDetails>> {
  if (!rows.length) return {};
  const candidates = rows.slice(0, 16);
  const [products, variants] = await Promise.all([
    supabaseAdmin.from("products").select("id,category,is_active,merged_into_product_id,net_weight_g,serving_count_verified,serving_size_g,protein_per_serving_g,creatine_per_serving_g,product_format,unit_pricing_verified,nutrition_verified").in("id", candidates.map((row) => row.id)).limit(16),
    supabaseAdmin.from("product_variants").select("id,product_id,pack_count,size_value,size_unit,flavour_label,product_format,nutrition_override,is_active").in("id", candidates.map((row) => row.variantId)).limit(16),
  ]);
  if (products.error || variants.error) return {};
  const productMap = new Map(((products.data || []) as HomepageDetailProduct[]).map((row) => [String(row.id), row]));
  const variantMap = new Map(((variants.data || []) as HomepageDetailVariant[]).map((row) => [String(row.id), row]));
  return Object.fromEntries(candidates.map((row) => [row.variantId,
    buildHomepageComparisonDetails(row, productMap.get(row.id), variantMap.get(row.variantId))]));
}

export async function getHomepagePriceHistory(row: DealsRow) {
  const since = new Date(Date.parse(row.bestOffer.lastCheckedAt) - 90 * 86400_000).toISOString();
  const { data, error } = await supabaseAdmin.from("price_history")
    .select("offer_id,identity_series_id,price,shipping_cost,total_price,checked_at,evidence_status,currency,in_stock,anomaly_flags")
    .eq("offer_id", row.bestOffer.id).eq("evidence_status", "proven")
    .gte("checked_at", since).lte("checked_at", row.bestOffer.lastCheckedAt)
    .order("checked_at", { ascending: false }).limit(120);
  return error ? [] : buildHomepageHistory(row, (data || []) as HomepageHistoryRecord[]);
}
