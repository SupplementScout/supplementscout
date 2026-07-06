import { NextResponse, type NextRequest } from "next/server";
import {
  resolveOutboundRedirect,
  type OutboundClickDataSource,
} from "../../lib/outboundClickRedirect";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function createDataSource(): OutboundClickDataSource {
  return {
    async fetchOffer(offerId) {
      const { data, error } = await supabaseAdmin
        .from("offers")
        .select("id, product_id, retailer_id, url, in_stock")
        .eq("id", offerId)
        .maybeSingle();

      return { data, error };
    },
    async fetchProduct(productId) {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("id, slug, is_active, merged_into_product_id")
        .eq("id", productId)
        .maybeSingle();

      return { data, error };
    },
    async insertClick(click) {
      const { error } = await supabaseAdmin.from("outbound_clicks").insert(click);

      return { error };
    },
  };
}

function unavailableResponse(
  result: Extract<Awaited<ReturnType<typeof resolveOutboundRedirect>>, { ok: false }>,
  request: NextRequest
) {
  if (result.productPath) {
    return NextResponse.redirect(new URL(result.productPath, request.url));
  }

  return new Response(result.message, { status: result.status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const { offerId } = await params;
  const result = await resolveOutboundRedirect({
    offerId,
    source: request.nextUrl.searchParams.get("source"),
    dataSource: createDataSource(),
    log: console,
  });

  if (!result.ok) {
    return unavailableResponse(result, request);
  }

  return NextResponse.redirect(result.destinationUrl);
}
