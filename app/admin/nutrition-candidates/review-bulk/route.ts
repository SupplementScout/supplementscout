import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { addNutritionCandidateReturnTarget } from "../../lib/nutritionCandidateNavigation";
import {
  type BulkReviewCandidate,
  parseNutritionCandidateBulkReviewInput,
  validateNutritionCandidateBulkSelection,
} from "../../lib/nutritionCandidateReview";
import {
  NutritionVariantProvenanceMigrationRequiredError,
  readNutritionCandidatesWithSchemaCompatibility,
} from "../../lib/nutritionCandidateSchemaCompatibility";

function redirectToReview(request: NextRequest, saved: string, returnTo: FormDataEntryValue | null) {
  const url = new URL("/admin/nutrition-candidates", request.url);
  url.searchParams.set("saved", saved);
  const run = request.nextUrl.searchParams.get("run");
  if (run && /^[A-Za-z0-9._:-]{1,200}$/.test(run)) url.searchParams.set("run", run);
  return NextResponse.redirect(addNutritionCandidateReturnTarget(url, returnTo), 303);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const input = parseNutritionCandidateBulkReviewInput({
    candidateIds: formData.getAll("candidateId"),
    productId: formData.get("productId"),
    productVariantId: formData.get("productVariantId"),
    runId: formData.get("runId"),
  });
  if (!input) return new NextResponse("Invalid bulk nutrition review.", { status: 400 });

  const read = async (columns: string) => {
    const result = await supabaseAdmin.from("nutrition_candidates")
      .select(columns)
      .in("id", input.candidateIds)
      .eq("status", "pending");
    return {
      data: result.data as unknown as BulkReviewCandidate[] | null,
      error: result.error,
    };
  };
  let candidates: BulkReviewCandidate[];
  try {
    const result = await readNutritionCandidatesWithSchemaCompatibility(
      () => read("id,product_id,product_variant_id,proposed_field,proposed_value,warning_flags,status,run_id"),
      () => read("id,product_id,proposed_field,proposed_value,warning_flags,status,run_id"),
      input.productVariantId === null
    );
    candidates = result.rows as BulkReviewCandidate[];
  } catch (error) {
    if (error instanceof NutritionVariantProvenanceMigrationRequiredError) {
      return new NextResponse("Variant nutrition review requires the pending provenance migration.", { status: 409 });
    }
    return new NextResponse("Bulk review was blocked because the candidate set could not be read.", { status: 409 });
  }
  if (!validateNutritionCandidateBulkSelection(input, candidates)) {
    return new NextResponse("Bulk review was blocked because the candidate set is unsafe or changed.", { status: 409 });
  }

  const reviewedAt = new Date().toISOString();
  const { data: reviewed, error: reviewError } = await supabaseAdmin
    .from("nutrition_candidates")
    .update({
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: "admin-panel-bulk",
      review_note: "Bulk accepted proposed values after exact product/variant review.",
    })
    .in("id", input.candidateIds)
    .eq("status", "pending")
    .select("id");
  if (reviewError || reviewed?.length !== input.candidateIds.length) {
    return new NextResponse("Bulk review was not saved because the candidate set changed.", { status: 409 });
  }

  return redirectToReview(request, `bulk-${reviewed.length}`, formData.get("returnTo"));
}
