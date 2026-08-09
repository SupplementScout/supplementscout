import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  parseNutritionCandidateBulkReviewInput,
  validateNutritionCandidateBulkSelection,
} from "../../lib/nutritionCandidateReview";

function redirectToReview(request: NextRequest, saved: string) {
  const url = new URL("/admin/nutrition-candidates", request.url);
  url.searchParams.set("saved", saved);
  const run = request.nextUrl.searchParams.get("run");
  if (run && /^[A-Za-z0-9._:-]{1,200}$/.test(run)) url.searchParams.set("run", run);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const input = parseNutritionCandidateBulkReviewInput({
    candidateIds: formData.getAll("candidateId"),
    productId: formData.get("productId"),
    runId: formData.get("runId"),
  });
  if (!input) return new NextResponse("Invalid bulk nutrition review.", { status: 400 });

  const { data: candidates, error: loadError } = await supabaseAdmin
    .from("nutrition_candidates")
    .select("id,product_id,proposed_field,proposed_value,warning_flags,status,run_id")
    .in("id", input.candidateIds)
    .eq("status", "pending");
  if (loadError || !validateNutritionCandidateBulkSelection(input, candidates || [])) {
    return new NextResponse("Bulk review was blocked because the candidate set is unsafe or changed.", { status: 409 });
  }

  const reviewedAt = new Date().toISOString();
  const { data: reviewed, error: reviewError } = await supabaseAdmin
    .from("nutrition_candidates")
    .update({
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: "admin-panel-bulk",
      review_note: "Bulk accepted proposed values after product-level review.",
    })
    .in("id", input.candidateIds)
    .eq("status", "pending")
    .select("id");
  if (reviewError || reviewed?.length !== input.candidateIds.length) {
    return new NextResponse("Bulk review was not saved because the candidate set changed.", { status: 409 });
  }

  return redirectToReview(request, `bulk-${reviewed.length}`);
}
