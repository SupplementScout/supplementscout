import { NextResponse, type NextRequest } from "next/server";
import { getDuplicatePairIds } from "../../../lib/duplicates";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdminRoute } from "../../../lib/adminAuth";

const MERGE_FAMILY_NOTE =
  "MERGE FAMILY – ten sam produkt, różne smaki/rozmiary/kolory";

function isPositiveInteger(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function badRequestResponse(message: string) {
  return new NextResponse(message, { status: 400 });
}

function reviewNote(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);

  if (unauthorized) {
    return unauthorized;
  }

  const formData = await request.formData();
  const productAIdValue = formData.get("productAId");
  const productBIdValue = formData.get("productBId");

  if (
    !isPositiveInteger(productAIdValue) ||
    !isPositiveInteger(productBIdValue)
  ) {
    return badRequestResponse("Product IDs must be positive integers.");
  }

  const rawProductAId = String(productAIdValue);
  const rawProductBId = String(productBIdValue);

  if (rawProductAId === rawProductBId) {
    return badRequestResponse("Product IDs must be different.");
  }

  const [productAId, productBId] = getDuplicatePairIds(
    rawProductAId,
    rawProductBId
  );
  const { error } = await supabaseAdmin
    .from("ignored_duplicate_product_pairs")
    .upsert(
      {
        product_a_id: productAId,
        product_b_id: productBId,
        decision: "deferred",
        note: reviewNote(formData.get("note")) || MERGE_FAMILY_NOTE,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "product_a_id,product_b_id",
      }
    );

  if (error) {
    return new NextResponse("Unable to defer duplicate pair.", {
      status: 500,
    });
  }

  const redirectUrl = new URL("/admin/duplicates", request.url);
  redirectUrl.searchParams.set("saved", "deferred");

  return NextResponse.redirect(redirectUrl, 303);
}
