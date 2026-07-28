import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const SIMPLE_DECISIONS = new Set([
  "APPROVE_NEW_PRODUCT",
  "DEFER_POLICY",
  "REJECT_IDENTITY",
]);

function isPositiveInteger(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function redirectToQueue(request: NextRequest, saved: string) {
  const url = new URL("/admin/product-matching", request.url);
  url.searchParams.set("saved", saved);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const idValue = formData.get("id");
  const sourceFingerprint = formData.get("sourceFingerprint");
  const decisionValue = formData.get("decision");
  const bindingValue = formData.get("binding");
  const notesValue = formData.get("notes");

  if (
    !isPositiveInteger(idValue) ||
    typeof sourceFingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(sourceFingerprint) ||
    typeof decisionValue !== "string"
  ) {
    return new NextResponse("Invalid review decision.", { status: 400 });
  }

  let selectedProductId: string | null = null;
  let selectedVariantId: string | null = null;
  const { data: reviewItem, error: reviewItemError } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("id, canonical_candidates")
    .eq("id", String(idValue))
    .eq("source_row_fingerprint", sourceFingerprint)
    .eq("decision", "PENDING")
    .is("consumed_at", null)
    .maybeSingle();

  if (reviewItemError || !reviewItem) {
    return new NextResponse(
      "Decision was not saved because the review item changed.",
      { status: 409 }
    );
  }

  if (decisionValue === "APPROVE_EXISTING_VARIANT") {
    if (typeof bindingValue !== "string") {
      return new NextResponse("Select a canonical product variant.", {
        status: 400,
      });
    }
    const binding = bindingValue.match(/^([1-9]\d*):([1-9]\d*)$/);
    if (!binding) {
      return new NextResponse("Invalid canonical product variant.", {
        status: 400,
      });
    }
    selectedProductId = binding[1];
    selectedVariantId = binding[2];
    const candidates = Array.isArray(reviewItem.canonical_candidates)
      ? reviewItem.canonical_candidates
      : [];
    const productWasSuggested = candidates.some(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        "product_id" in candidate &&
        String(candidate.product_id) === selectedProductId
    );

    if (!productWasSuggested) {
      return new NextResponse(
        "The selected product is not part of this reviewed suggestion.",
        { status: 409 }
      );
    }

    const [
      { data: product, error: productError },
      { data: variant, error: variantError },
    ] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, is_active, merged_into_product_id")
        .eq("id", selectedProductId)
        .maybeSingle(),
      supabaseAdmin
        .from("product_variants")
        .select("id, product_id, is_active")
        .eq("id", selectedVariantId)
        .maybeSingle(),
    ]);

    if (
      productError ||
      variantError ||
      !product ||
      !variant ||
      product.is_active !== true ||
      product.merged_into_product_id !== null ||
      variant.is_active !== true ||
      String(variant.product_id) !== selectedProductId
    ) {
      return new NextResponse("Canonical selection is no longer valid.", {
        status: 409,
      });
    }
  } else if (!SIMPLE_DECISIONS.has(decisionValue)) {
    return new NextResponse("Unsupported review decision.", { status: 400 });
  }

  const notes =
    typeof notesValue === "string" && notesValue.trim()
      ? notesValue.trim().slice(0, 1000)
      : null;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .update({
      decision: decisionValue,
      selected_canonical_product_id: selectedProductId,
      selected_canonical_variant_id: selectedVariantId,
      reviewer_notes: notes,
      reviewed_by: "admin-panel",
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", String(idValue))
    .eq("source_row_fingerprint", sourceFingerprint)
    .eq("decision", "PENDING")
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(
      "Decision was not saved because the review item changed.",
      { status: 409 }
    );
  }

  return redirectToQueue(request, "decision");
}
