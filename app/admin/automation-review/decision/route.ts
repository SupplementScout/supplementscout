import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const ACTION_STATUS = new Map([["approve", "APPROVED"], ["reject", "REJECTED"], ["ignore", "IGNORED"], ["rebind", "APPROVED"], ["unavailable", "APPROVED"]]);
export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request); if (unauthorized) return unauthorized;
  const form = await request.formData(), targetStatus = ACTION_STATUS.get(String(form.get("action") || "")), selections = form.getAll("selection").map(String);
  if (!targetStatus || selections.length < 1 || selections.length > 100) return new NextResponse("Invalid review action.", { status: 400 });
  const parsed = selections.map((selection) => selection.match(/^([1-9]\d*):([0-9a-f]{64})$/));
  if (parsed.some((item) => !item)) return new NextResponse("Invalid review selection.", { status: 400 });
  const expected = new Map(parsed.map((item) => [item![1], item![2]]));
  if (expected.size !== parsed.length) return new NextResponse("Duplicate review selection.", { status: 400 });
  if (["rebind", "unavailable"].includes(String(form.get("action"))) && selections.length !== 1) return new NextResponse("This action requires one review row.", { status: 400 });
  const { data, error } = await supabaseAdmin.from("product_match_review_queue").select("id,retailer_id,review_kind,operation_type,review_status,expires_at,source_row_fingerprint,source_evidence").in("id", [...expected.keys()]);
  if (error || !data || data.length !== expected.size) return new NextResponse("Review rows changed; nothing was saved.", { status: 409 });
  const now = Date.now(), compatible = new Set(data.map((row) => `${row.retailer_id}:${row.review_kind}:${row.operation_type}`));
  if (compatible.size !== 1 || data.some((row) => row.review_status !== "PENDING" || !row.expires_at || new Date(row.expires_at).getTime() <= now || expected.get(String(row.id)) !== row.source_row_fingerprint)) return new NextResponse("Review rows are stale, expired or incompatible; nothing was saved.", { status: 409 });
  const action = String(form.get("action"));
  if (["approve", "rebind", "unavailable"].includes(action) && form.get("confirmImpact") !== "yes") return new NextResponse("Exact impact confirmation is required; nothing was saved.", { status: 409 });
  const changes: Record<string, unknown> = { review_status: targetStatus, updated_at: new Date().toISOString() };
  changes.decision_actor = "authenticated-admin";
  changes.decision_at = new Date().toISOString();
  if (action === "rebind") {
    const binding = String(form.get("binding") || "").match(/^([1-9]\d*):([1-9]\d*)$/);
    if (!binding || !["IDENTITY_CONFLICT", "MAPPING_DRIFT"].includes(String(data[0].review_kind))) return new NextResponse("Invalid reviewed rebind.", { status: 400 });
    const [{ data: product }, { data: variant }] = await Promise.all([
      supabaseAdmin.from("products").select("id,is_active,merged_into_product_id").eq("id", binding[1]).maybeSingle(),
      supabaseAdmin.from("product_variants").select("id,product_id,is_active").eq("id", binding[2]).maybeSingle(),
    ]);
    if (product?.is_active !== true || product.merged_into_product_id !== null || variant?.is_active !== true || String(variant.product_id) !== binding[1]) return new NextResponse("Canonical binding changed; nothing was saved.", { status: 409 });
    changes.proposed_product_id = binding[1]; changes.proposed_variant_id = binding[2];
  }
  if (action === "unavailable") {
    const evidence = data[0].source_evidence as Record<string, unknown> | null;
    if (form.get("confirmUnavailable") !== "yes" || evidence?.confirmed_unavailable !== true) return new NextResponse("Confirmed unavailable source evidence is required.", { status: 409 });
    changes.operation_type = "MARK_OOS";
  }
  for (const row of data) {
    const { data: updated, error: updateError } = await supabaseAdmin.from("product_match_review_queue").update(changes).eq("id", String(row.id)).eq("source_row_fingerprint", row.source_row_fingerprint).eq("review_status", "PENDING").select("id").maybeSingle();
    if (updateError || !updated) return new NextResponse("A row changed during review; remaining rows were not touched.", { status: 409 });
  }
  return NextResponse.redirect(new URL("/admin/automation-review", request.url), 303);
}
