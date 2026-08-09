import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  buildNutritionCandidateReviewUpdate,
  parseNutritionCandidateReviewInput,
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
  const input = parseNutritionCandidateReviewInput({
    id: formData.get("id"),
    status: formData.get("status"),
    approvedValue: formData.get("approvedValue"),
    reviewNote: formData.get("reviewNote"),
  });
  if (!input) {
    return new NextResponse("Invalid nutrition candidate review.", {
      status: 400,
    });
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
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(
      "Candidate was not reviewed because it changed or is no longer pending.",
      { status: 409 }
    );
  }

  return redirectToReview(request, input.status);
}
