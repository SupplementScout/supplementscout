import { NextResponse, type NextRequest } from "next/server";
import {
  isCrawlerUserAgent,
  resolveOutboundRedirect,
  type OutboundClickDataSource,
} from "../../lib/outboundClickRedirect";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const ROBOTS_HEADER_VALUE = "noindex, nofollow, noarchive";

function withRobotsHeader<T extends Response>(response: T) {
  response.headers.set("X-Robots-Tag", ROBOTS_HEADER_VALUE);

  return response;
}

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
    return withRobotsHeader(
      NextResponse.redirect(new URL(result.productPath, request.url))
    );
  }

  return withRobotsHeader(new Response(result.message, { status: result.status }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  if (isCrawlerUserAgent(request.headers.get("user-agent"))) {
    return withRobotsHeader(new Response(null, { status: 204 }));
  }

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

  return withRobotsHeader(NextResponse.redirect(result.destinationUrl));
}
