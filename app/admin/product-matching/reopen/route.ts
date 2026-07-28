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

  const { data: current, error: currentError } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("id, decision")
    .eq("id", id)
    .is("consumed_at", null)
    .maybeSingle();
  if (currentError || !current || current.decision === "PENDING") {
    return new NextResponse(
      "This decision cannot be reopened because it changed or was consumed.",
      { status: 409 }
    );
  }

  if (current.decision === "APPROVE_NEW_FAMILY_SEED") {
    const { count, error: dependentError } = await supabaseAdmin
      .from("product_match_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("selected_family_seed_review_item_id", id)
      .eq("decision", "APPROVE_NEW_VARIANT_SEED")
      .is("consumed_at", null)
      .neq("id", id);
    if (dependentError || (count || 0) > 0) {
      return new NextResponse(
        "Reopen the family variants before reopening the family seed.",
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .update({
      decision: "PENDING",
      selected_canonical_product_id: null,
      selected_canonical_variant_id: null,
      selected_family_seed_review_item_id: null,
      proposed_family_name: null,
      proposed_variant_name: null,
      reviewer_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("consumed_at", null)
    .eq("decision", current.decision)
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
