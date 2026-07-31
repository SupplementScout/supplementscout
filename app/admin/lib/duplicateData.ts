import "server-only";

import type { DuplicateAlias } from "../../lib/duplicates";
import type {
  DuplicateMappingEvidence,
  DuplicateVariantEvidence,
} from "../../lib/duplicateReview";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export type AdminDuplicateProduct = {
  id: number | string;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  product_format: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  unit_count: number | string | null;
  unit_type: string | null;
  servings: number | string | null;
  is_active?: boolean | null;
  merged_into_product_id?: number | string | null;
};

export async function loadAllActiveProducts() {
  const rows: AdminDuplicateProduct[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, slug, gtin, brand, category, product_format, net_weight_g, net_volume_ml, unit_count, unit_type, servings, is_active, merged_into_product_id"
      )
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .order("id")
      .range(from, from + 999);

    if (error) return { data: rows, error };
    rows.push(...((data || []) as AdminDuplicateProduct[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

export async function loadAllProductAliases() {
  const rows: DuplicateAlias[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("retailer_products")
      .select("product_id, external_name, external_gtin")
      .order("id")
      .range(from, from + 999);

    if (error) return { data: rows, error };
    rows.push(...((data || []) as DuplicateAlias[]));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

export async function loadAllVariantsForProducts(productIds: string[]) {
  const rows: DuplicateVariantEvidence[] = [];

  for (let offset = 0; offset < productIds.length; offset += 100) {
    const productIdBatch = productIds.slice(offset, offset + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .select(
          "id, product_id, variant_key, display_name, flavour_label, size_value, size_unit, pack_count, product_format, is_active, is_default"
        )
        .in("product_id", productIdBatch)
        .order("id")
        .range(from, from + 999);

      if (error) return { data: rows, error };
      rows.push(...((data || []) as DuplicateVariantEvidence[]));
      if (!data || data.length < 1000) break;
    }
  }

  return { data: rows, error: null };
}

export async function loadAllMappingsForProducts(productIds: string[]) {
  const rows: DuplicateMappingEvidence[] = [];

  for (let offset = 0; offset < productIds.length; offset += 100) {
    const productIdBatch = productIds.slice(offset, offset + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("retailer_products")
        .select(
          "id, product_id, retailer_id, external_product_id, external_variant_id, external_sku, external_gtin, match_method, retailer:retailers(name)"
        )
        .in("product_id", productIdBatch)
        .order("id")
        .range(from, from + 999);

      if (error) return { data: rows, error };
      rows.push(...((data || []) as DuplicateMappingEvidence[]));
      if (!data || data.length < 1000) break;
    }
  }

  return { data: rows, error: null };
}
