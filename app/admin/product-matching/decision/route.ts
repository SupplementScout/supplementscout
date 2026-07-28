import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "../../../lib/adminAuth";
import { findPotentialDuplicate } from "../../../lib/productMatchGuard";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const SIMPLE_DECISIONS = new Set([
  "APPROVE_NEW_PRODUCT",
  "DEFER_POLICY",
  "REJECT_IDENTITY",
]);

function isPositiveInteger(
  value: FormDataEntryValue | null
): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

function requiredText(
  value: FormDataEntryValue | null,
  maximumLength: number
) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}

function redirectToQueue(request: NextRequest, saved: string) {
  const url = new URL("/admin/product-matching", request.url);
  url.searchParams.set("saved", saved);
  return NextResponse.redirect(url, 303);
}

async function loadPotentialDuplicate(sourceName: string) {
  const products: Array<{ id: string | number; name: string }> = [];
  const aliases: Array<{
    product_id: string | number;
    external_name: string | null;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id,name")
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .range(from, from + 999);
    if (error) throw error;
    products.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("retailer_products")
      .select("product_id,external_name")
      .range(from, from + 999);
    if (error) throw error;
    aliases.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return findPotentialDuplicate(sourceName, products, aliases);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const idValue = formData.get("id");
  const sourceFingerprint = formData.get("sourceFingerprint");
  const decisionValue = formData.get("decision");
  const bindingValue = formData.get("binding");
  const manualBindingValue = formData.get("manualBinding");
  const candidateProductValue = formData.get("candidateProduct");
  const manualProductValue = formData.get("manualProduct");
  const familySeedValue = formData.get("familySeed");
  const familyNameValue = formData.get("familyName");
  const variantNameValue = formData.get("variantName");
  const confirmNewProduct = formData.get("confirmNewProduct");
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
  let selectedFamilySeedId: string | null = null;
  let proposedFamilyName: string | null = null;
  let proposedVariantName: string | null = null;
  let storedDecision = decisionValue;
  const { data: reviewItem, error: reviewItemError } = await supabaseAdmin
    .from("product_match_review_queue")
    .select("id, snapshot_id, retailer, product_title, canonical_candidates")
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

  const candidates = Array.isArray(reviewItem.canonical_candidates)
    ? reviewItem.canonical_candidates
    : [];
  const suggestedProduct = (productId: string) =>
    candidates.some(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        "product_id" in candidate &&
        String(candidate.product_id) === productId
    );
  const loadActiveProduct = async (productId: string) => {
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, is_active, merged_into_product_id")
      .eq("id", productId)
      .maybeSingle();
    return !error &&
      product?.is_active === true &&
      product.merged_into_product_id === null
      ? product
      : null;
  };

  if (
    decisionValue === "APPROVE_EXISTING_VARIANT" ||
    decisionValue === "APPROVE_EXISTING_VARIANT_MANUAL"
  ) {
    const selectedBinding =
      decisionValue === "APPROVE_EXISTING_VARIANT_MANUAL"
        ? manualBindingValue
        : bindingValue;
    if (typeof selectedBinding !== "string") {
      return new NextResponse("Select a canonical product variant.", {
        status: 400,
      });
    }
    const binding = selectedBinding.match(/^([1-9]\d*):([1-9]\d*)$/);
    if (!binding) {
      return new NextResponse("Invalid canonical product variant.", {
        status: 400,
      });
    }
    selectedProductId = binding[1];
    selectedVariantId = binding[2];
    if (
      decisionValue === "APPROVE_EXISTING_VARIANT" &&
      !suggestedProduct(selectedProductId)
    ) {
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
    storedDecision = "APPROVE_EXISTING_VARIANT";
  } else if (
    decisionValue === "APPROVE_NEW_VARIANT_SEED_EXISTING" ||
    decisionValue === "APPROVE_NEW_VARIANT_SEED_EXISTING_MANUAL"
  ) {
    const selectedProduct =
      decisionValue === "APPROVE_NEW_VARIANT_SEED_EXISTING_MANUAL"
        ? manualProductValue
        : candidateProductValue;
    if (
      !isPositiveInteger(selectedProduct) ||
      (decisionValue === "APPROVE_NEW_VARIANT_SEED_EXISTING" &&
        !suggestedProduct(selectedProduct))
    ) {
      return new NextResponse("Select a suggested canonical product.", {
        status: 400,
      });
    }
    proposedVariantName = requiredText(variantNameValue, 200);
    if (!proposedVariantName) {
      return new NextResponse("Enter the new flavour or variant name.", {
        status: 400,
      });
    }
    if (!(await loadActiveProduct(selectedProduct))) {
      return new NextResponse("Canonical product is no longer valid.", {
        status: 409,
      });
    }
    selectedProductId = selectedProduct;
    storedDecision = "APPROVE_NEW_VARIANT_SEED";
  } else if (decisionValue === "APPROVE_NEW_FAMILY_SEED") {
    proposedFamilyName = requiredText(familyNameValue, 300);
    proposedVariantName = requiredText(variantNameValue, 200);
    if (!proposedFamilyName || !proposedVariantName) {
      return new NextResponse("Enter the family and first variant names.", {
        status: 400,
      });
    }
    if (confirmNewProduct !== "yes") {
      let potential = null;
      try {
        potential = await loadPotentialDuplicate(reviewItem.product_title);
      } catch {
        return new NextResponse(
          "The full-catalog duplicate check is unavailable. Decision was not saved.",
          { status: 503 }
        );
      }
      const detail = potential
        ? ` Possible existing product: ${potential.productName} (${potential.productId}).`
        : "";
      return new NextResponse(
        `Search the full catalog and confirm the new family first.${detail}`,
        { status: 409 }
      );
    }
    selectedFamilySeedId = String(reviewItem.id);
  } else if (decisionValue === "APPROVE_NEW_VARIANT_SEED_FAMILY") {
    if (!isPositiveInteger(familySeedValue)) {
      return new NextResponse("Select a reviewed new product family.", {
        status: 400,
      });
    }
    proposedVariantName = requiredText(variantNameValue, 200);
    if (!proposedVariantName) {
      return new NextResponse("Enter the new flavour or variant name.", {
        status: 400,
      });
    }
    const { data: seed, error: seedError } = await supabaseAdmin
      .from("product_match_review_queue")
      .select("id, proposed_family_name")
      .eq("id", familySeedValue)
      .eq("snapshot_id", reviewItem.snapshot_id)
      .eq("retailer", reviewItem.retailer)
      .eq("decision", "APPROVE_NEW_FAMILY_SEED")
      .is("consumed_at", null)
      .maybeSingle();
    if (seedError || !seed || !seed.proposed_family_name) {
      return new NextResponse("Selected product family is no longer valid.", {
        status: 409,
      });
    }
    selectedFamilySeedId = String(seed.id);
    proposedFamilyName = String(seed.proposed_family_name);
    storedDecision = "APPROVE_NEW_VARIANT_SEED";
  } else if (!SIMPLE_DECISIONS.has(decisionValue)) {
    return new NextResponse("Unsupported review decision.", { status: 400 });
  }

  if (
    decisionValue === "APPROVE_NEW_PRODUCT" &&
    confirmNewProduct !== "yes"
  ) {
    let potential = null;
    try {
      potential = await loadPotentialDuplicate(reviewItem.product_title);
    } catch {
      return new NextResponse(
        "The full-catalog duplicate check is unavailable. Decision was not saved.",
        { status: 503 }
      );
    }
    const detail = potential
      ? ` Possible existing product: ${potential.productName} (${potential.productId}).`
      : "";
    return new NextResponse(
      `Search the full catalog and confirm the separate new product first.${detail}`,
      { status: 409 }
    );
  }

  const notes =
    typeof notesValue === "string" && notesValue.trim()
      ? notesValue.trim().slice(0, 1000)
      : null;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .update({
      decision: storedDecision,
      selected_canonical_product_id: selectedProductId,
      selected_canonical_variant_id: selectedVariantId,
      selected_family_seed_review_item_id: selectedFamilySeedId,
      proposed_family_name: proposedFamilyName,
      proposed_variant_name: proposedVariantName,
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
