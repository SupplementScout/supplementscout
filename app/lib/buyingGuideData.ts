import "server-only";
import { supabase } from "./supabase";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import type { RawCategoryComparisonProduct } from "./categoryComparison";

// Existing catalogue projection and resolver, bounded to the reviewed examples.
// The full whey/two-product loaders read whole categories/catalogues and compact
// away variant provenance, which these worked examples must retain.
export async function getBuyingGuideProducts(slugs: readonly string[]) {
  const { data, error, count } = await supabase.from("products").select(`
    id, slug, name, brand, category, image, product_format,
    net_weight_g, net_volume_ml, unit_count, unit_type,
    serving_count_verified, serving_size_g, protein_per_serving_g,
    creatine_per_serving_g, unit_pricing_verified, nutrition_verified,
    is_active, merged_into_product_id, merged_at,
    offers (
      id, retailer_product_id, price, shipping_cost, in_stock, last_checked_at,
      url, retailer:retailers (id, name, slug)
    )
  `, { count: "exact" })
    .in("slug", [...slugs]).eq("is_active", true)
    .is("merged_into_product_id", null).is("merged_at", null)
    .limit(slugs.length + 1);
  if (error || count === null || (data || []).length !== count || count > slugs.length) {
    return { rows: [], error: true };
  }
  try {
    const rows = await resolveCategoryComparisonVariants(
      (data || []) as RawCategoryComparisonProduct[], { failOnError: true }
    );
    return { rows, error: false };
  } catch {
    return { rows: [], error: true };
  }
}
