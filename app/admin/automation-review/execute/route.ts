import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;
  const form = await request.formData();
  const selection = String(form.get("selection") || "").match(/^([1-9]\d*):([0-9a-f]{64})$/);
  if (!selection) return new NextResponse("Invalid approved review item.", { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("id,review_status,expires_at,source_row_fingerprint,retailer_id,operation_type")
    .eq("id", selection[1])
    .eq("source_row_fingerprint", selection[2])
    .maybeSingle();
  if (error || !data || data.review_status !== "APPROVED" || !data.expires_at || Date.parse(data.expires_at) <= Date.now()) {
    return new NextResponse("Approved evidence changed or expired; execution was not queued.", { status: 409 });
  }
  return new NextResponse(
    "No protected server adapter is registered for this review item. The decision remains APPROVED and no catalogue write was attempted.",
    { status: 409 }
  );
}
