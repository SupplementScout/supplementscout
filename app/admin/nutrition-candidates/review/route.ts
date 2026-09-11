import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { addNutritionCandidateReturnTarget } from "../../lib/nutritionCandidateNavigation";
import {
  buildNutritionCandidateReviewUpdate,
  parseNutritionCandidateReviewInput,
  validateNutritionCandidateReviewFact,
} from "../../lib/nutritionCandidateReview";
import { isMissingNutritionPreworkoutFactColumn } from "../../lib/nutritionCandidateSchemaCompatibility";

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
  const input = parseNutritionCandidateReviewInput({
    id: formData.get("id"),
    status: formData.get("status"),
    approvedValue: formData.get("approvedValue"),
    reviewNote: formData.get("reviewNote"),
    candidateFingerprint: formData.get("candidateFingerprint"),
    informationState: formData.get("informationState"),
  });
  if (!input) {
    return new NextResponse("Invalid nutrition candidate review.", {
      status: 400,
    });
  }

  const current = await supabaseAdmin.from("nutrition_candidates")
    .select("id,information_state,proposed_value")
    .eq("id", input.id)
    .eq("status", "pending")
    .eq("candidate_fingerprint", input.candidateFingerprint)
    .maybeSingle();
  let candidate = current.data as { information_state: unknown; proposed_value: unknown } | null;
  if (current.error && isMissingNutritionPreworkoutFactColumn(current.error)) {
    const legacy = await supabaseAdmin.from("nutrition_candidates")
      .select("id,proposed_value")
      .eq("id", input.id)
      .eq("status", "pending")
      .eq("candidate_fingerprint", input.candidateFingerprint)
      .maybeSingle();
    if (legacy.error) return new NextResponse("Candidate could not be read for review.", { status: 409 });
    candidate = legacy.data ? { ...legacy.data, information_state: null } : null;
  } else if (current.error) {
    return new NextResponse("Candidate could not be read for review.", { status: 409 });
  }
  if (!candidate || !validateNutritionCandidateReviewFact(input, candidate)) {
    return new NextResponse("Candidate review fields changed or do not match the pending fact.", { status: 409 });
  }

  const update = buildNutritionCandidateReviewUpdate(
    input,
    new Date().toISOString()
  );
  const { data, error } = await supabaseAdmin
    .from("nutrition_candidates")
    .update(update)
    .eq("id", input.id)
    .eq("status", "pending")
    .eq("candidate_fingerprint", input.candidateFingerprint)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(
      "Candidate was not reviewed because it changed or is no longer pending.",
      { status: 409 }
    );
  }

  return redirectToReview(request, input.status, formData.get("returnTo"));
}
