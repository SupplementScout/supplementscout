import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function safePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ products: [] });
  }
  const pattern = `%${safePattern(query)}%`;
  const [
    { data: namedProducts, error: productError },
    { data: aliases, error: aliasError },
  ] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,name,brand,is_active,merged_into_product_id")
      .ilike("name", pattern)
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .limit(20),
    supabaseAdmin
      .from("retailer_products")
      .select("product_id,external_name")
      .ilike("external_name", pattern)
      .limit(40),
  ]);
  if (productError || aliasError) {
    return NextResponse.json({ products: [] }, { status: 503 });
  }

  const ids = Array.from(
    new Set([
      ...(namedProducts || []).map((product) => String(product.id)),
      ...(aliases || []).map((alias) => String(alias.product_id)),
    ])
  ).slice(0, 20);
  if (!ids.length) return NextResponse.json({ products: [] });

  const [
    { data: products, error: productsError },
    { data: variants, error: variantsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id,name,brand,is_active,merged_into_product_id")
      .in("id", ids)
      .eq("is_active", true)
      .is("merged_into_product_id", null),
    supabaseAdmin
      .from("product_variants")
      .select("id,product_id,display_name,is_active")
      .in("product_id", ids)
      .eq("is_active", true),
  ]);
  if (productsError || variantsError) {
    return NextResponse.json({ products: [] }, { status: 503 });
  }
  const rows = (products || [])
    .map((product) => ({
      id: String(product.id),
      name: String(product.name),
      brand: product.brand ? String(product.brand) : null,
      variants: (variants || [])
        .filter(
          (variant) => String(variant.product_id) === String(product.id)
        )
        .map((variant) => ({
          id: String(variant.id),
          display_name: variant.display_name
            ? String(variant.display_name)
            : null,
        })),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return NextResponse.json({ products: rows });
}
