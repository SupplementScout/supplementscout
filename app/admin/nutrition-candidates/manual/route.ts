import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  buildManualCandidateRows,
  parseManualNutritionCandidateInput,
  type NutritionBatchWorkItemForManualCandidate,
} from "../../lib/nutritionCandidateManual";

function redirectToRun(request: NextRequest, runId: string) {
  const url = new URL("/admin/nutrition-candidates", request.url);
  url.searchParams.set("run", runId);
  url.searchParams.set("saved", "pending");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const input = parseManualNutritionCandidateInput(await request.formData());
  if (!input) return new NextResponse("Invalid manual nutrition candidate.", { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("nutrition_candidate_batch_items")
    .select("id,run_id,product_id,product_name,brand,source_url,source_domain,official_domains,missing_fields,current_values,page_status,source_file_sha256,source_snapshot_ref,source_context_sha256")
    .eq("id", input.workItemId)
    .eq("run_id", input.runId)
    .maybeSingle();
  if (error || !data) return new NextResponse("Batch work item was not found.", { status: 404 });

  let rows;
  try {
    rows = buildManualCandidateRows(input, data as NutritionBatchWorkItemForManualCandidate);
  } catch {
    return new NextResponse("Manual values failed nutrition safety validation.", { status: 400 });
  }
  const { error: insertError } = await supabaseAdmin
    .from("nutrition_candidates")
    .upsert(rows, { onConflict: "candidate_fingerprint", ignoreDuplicates: true });
  if (insertError) return new NextResponse("Pending candidates were not stored.", { status: 409 });
  return redirectToRun(request, input.runId);
}
