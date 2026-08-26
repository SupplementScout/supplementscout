import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import type {
  RawCategoryComparisonProduct,
  RawComparisonOffer,
} from "./categoryComparison";
import type { VariantNutritionMetrics } from "./nutritionMetrics";

type RetailerProductVariantRow = {
  id: number | string;
  product_variant: VariantNutritionMetrics | VariantNutritionMetrics[];
};

export async function resolveCategoryComparisonVariants<
  T extends RawCategoryComparisonProduct,
>(products: T[], options: { failOnError?: boolean } = {}): Promise<T[]> {
  const retailerProductIds = [
    ...new Set(
      products.flatMap((product) =>
        (product.offers || [])
          .map((offer) => offer.retailer_product_id)
          .filter((id): id is number | string => id !== null)
          .map(String)
      )
    ),
  ];

  if (retailerProductIds.length === 0) return products;

  const { data, error } = await supabaseAdmin
    .from("retailer_products")
    .select(`
      id,
      product_variant:product_variants!retailer_products_variant_product_fkey (
        id,
        display_name,
        flavour_label,
        pack_count,
        size_value,
        size_unit,
        product_format,
        nutrition_override,
        is_active
      )
    `)
    .in("id", retailerProductIds);

  if (error && options.failOnError) {
    throw new Error("Unable to resolve exact product variants for comparison.");
  }

  const variantByRetailerProductId = new Map(
    ((data || []) as unknown as RetailerProductVariantRow[]).map((row) => [
      String(row.id),
      Array.isArray(row.product_variant)
        ? row.product_variant[0] || null
        : row.product_variant || null,
    ])
  );

  return products.map((product) => ({
    ...product,
    offers: (product.offers || []).map((offer): RawComparisonOffer => {
      const variant = error
        ? null
        : variantByRetailerProductId.get(String(offer.retailer_product_id)) ||
          null;
      return {
        ...offer,
        product_variant: variant,
        variant_resolution: variant ? "resolved" : "unresolved",
      };
    }),
  }));
}
