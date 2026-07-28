import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    return new NextResponse("Invalid review item.", { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .update({
      decision: "PENDING",
      selected_canonical_product_id: null,
      selected_canonical_variant_id: null,
      reviewer_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("consumed_at", null)
    .neq("decision", "PENDING")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(
      "This decision cannot be reopened because it changed or was consumed.",
      { status: 409 }
    );
  }

  const url = new URL("/admin/product-matching", request.url);
  url.searchParams.set("saved", "reopened");
  return NextResponse.redirect(url, 303);
}
