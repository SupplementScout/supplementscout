import { NextResponse, type NextRequest } from "next/server";
import {
  type MergeDecisionConflicts,
  type MergeDecisionValue,
  type MergePlanItem,
  type MergePreview,
  getMergePreview,
} from "../../../lib/mergePreview";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdminRoute } from "../../../lib/adminAuth";

const positiveBigintPattern = /^[1-9]\d*$/;
const compatibilityBlockerReason =
  "Merge requires administrator decisions and cannot use the simple merge path.";

type SubmittedOfferDecision = {
  canonicalOfferId: string;
  candidateOfferId: string;
  decision: MergeDecisionValue;
};

type SubmittedRetailerProductDecision = {
  canonicalMappingId: string;
  candidateMappingId: string;
  decision: MergeDecisionValue;
};

type SubmittedMergeDecisions = {
  offerConflicts: SubmittedOfferDecision[];
  retailerProductConflicts: SubmittedRetailerProductDecision[];
};

function parsePositiveBigint(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !positiveBigintPattern.test(value)) {
    return null;
  }

  return value;
}

function badRequestResponse(message: string) {
  return new NextResponse(message, { status: 400 });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function idValue(value: string | number) {
  return String(value);
}

function decisionPairKey(canonicalId: string, candidateId: string) {
  return `${canonicalId}:${candidateId}`;
}

function isMergeDecisionValue(value: unknown): value is MergeDecisionValue {
  return value === "keep_canonical" || value === "keep_candidate";
}

function hasDecisionConflicts(decisionConflicts: MergeDecisionConflicts) {
  return (
    decisionConflicts.offerConflicts.length > 0 ||
    decisionConflicts.retailerProductConflicts.length > 0
  );
}

function isCompatibilityBlocker(item: MergePlanItem) {
  return (
    item.id === "product-conflict-merge-requires-decisions" &&
    item.status === "blocked" &&
    item.subject === "Merge requires administrator decisions" &&
    item.reason === compatibilityBlockerReason
  );
}

function hasBlockedItemAfterCompatibilityFilter(preview: MergePreview) {
  const items = [
    ...preview.mergePlan.productConflicts,
    ...preview.mergePlan.offers,
    ...preview.mergePlan.retailerProducts,
    ...preview.mergePlan.priceHistory,
  ];

  return items.some(
    (item) => item.status === "blocked" && !isCompatibilityBlocker(item)
  );
}

function hasSafeProductState(preview: MergePreview) {
  return (
    preview.canonical.product.is_active === true &&
    preview.candidate.product.is_active === true &&
    preview.canonical.product.merged_into_product_id === null &&
    preview.candidate.product.merged_into_product_id === null &&
    preview.canonical.product.merged_at === null &&
    preview.candidate.product.merged_at === null
  );
}

function requireExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function validateOfferDecision(
  value: unknown,
  expectedPairs: Set<string>,
  seenPairs: Set<string>
): SubmittedOfferDecision | null {
  if (
    !isPlainObject(value) ||
    !requireExactKeys(value, [
      "canonicalOfferId",
      "candidateOfferId",
      "decision",
    ])
  ) {
    return null;
  }

  const { canonicalOfferId, candidateOfferId, decision } = value;

  if (
    typeof canonicalOfferId !== "string" ||
    typeof candidateOfferId !== "string" ||
    !positiveBigintPattern.test(canonicalOfferId) ||
    !positiveBigintPattern.test(candidateOfferId) ||
    !isMergeDecisionValue(decision)
  ) {
    return null;
  }

  const pairKey = decisionPairKey(canonicalOfferId, candidateOfferId);

  if (!expectedPairs.has(pairKey) || seenPairs.has(pairKey)) {
    return null;
  }

  seenPairs.add(pairKey);

  return {
    canonicalOfferId,
    candidateOfferId,
    decision,
  };
}

function validateRetailerProductDecision(
  value: unknown,
  expectedPairs: Set<string>,
  seenPairs: Set<string>
): SubmittedRetailerProductDecision | null {
  if (
    !isPlainObject(value) ||
    !requireExactKeys(value, [
      "canonicalMappingId",
      "candidateMappingId",
      "decision",
    ])
  ) {
    return null;
  }

  const { canonicalMappingId, candidateMappingId, decision } = value;

  if (
    typeof canonicalMappingId !== "string" ||
    typeof candidateMappingId !== "string" ||
    !positiveBigintPattern.test(canonicalMappingId) ||
    !positiveBigintPattern.test(candidateMappingId) ||
    !isMergeDecisionValue(decision)
  ) {
    return null;
  }

  const pairKey = decisionPairKey(canonicalMappingId, candidateMappingId);

  if (!expectedPairs.has(pairKey) || seenPairs.has(pairKey)) {
    return null;
  }

  seenPairs.add(pairKey);

  return {
    canonicalMappingId,
    candidateMappingId,
    decision,
  };
}

function validateSubmittedDecisions(
  value: unknown,
  preview: MergePreview
): SubmittedMergeDecisions | null {
  if (
    !isPlainObject(value) ||
    !requireExactKeys(value, ["offerConflicts", "retailerProductConflicts"]) ||
    !Array.isArray(value.offerConflicts) ||
    !Array.isArray(value.retailerProductConflicts)
  ) {
    return null;
  }

  const expectedOfferPairs = new Set(
    preview.decisionConflicts.offerConflicts.map((conflict) =>
      decisionPairKey(
        idValue(conflict.canonicalOffer.id),
        idValue(conflict.candidateOffer.id)
      )
    )
  );
  const expectedMappingPairs = new Set(
    preview.decisionConflicts.retailerProductConflicts.map((conflict) =>
      decisionPairKey(
        idValue(conflict.canonicalMapping.id),
        idValue(conflict.candidateMapping.id)
      )
    )
  );

  if (
    value.offerConflicts.length !== expectedOfferPairs.size ||
    value.retailerProductConflicts.length !== expectedMappingPairs.size
  ) {
    return null;
  }

  const seenOfferPairs = new Set<string>();
  const seenMappingPairs = new Set<string>();
  const offerConflicts: SubmittedOfferDecision[] = [];
  const retailerProductConflicts: SubmittedRetailerProductDecision[] = [];

  for (const decision of value.offerConflicts) {
    const validatedDecision = validateOfferDecision(
      decision,
      expectedOfferPairs,
      seenOfferPairs
    );

    if (!validatedDecision) {
      return null;
    }

    offerConflicts.push(validatedDecision);
  }

  for (const decision of value.retailerProductConflicts) {
    const validatedDecision = validateRetailerProductDecision(
      decision,
      expectedMappingPairs,
      seenMappingPairs
    );

    if (!validatedDecision) {
      return null;
    }

    retailerProductConflicts.push(validatedDecision);
  }

  if (
    seenOfferPairs.size !== expectedOfferPairs.size ||
    seenMappingPairs.size !== expectedMappingPairs.size
  ) {
    return null;
  }

  return {
    offerConflicts,
    retailerProductConflicts,
  };
}

function parseSubmittedDecisions(
  value: FormDataEntryValue | null,
  preview: MergePreview
) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  return validateSubmittedDecisions(parsed, preview);
}

function hasConfirmation(value: FormDataEntryValue | null, candidateId: string) {
  return typeof value === "string" && value === `MERGE ${candidateId}`;
}

function redirectToPreview({
  request,
  canonicalId,
  candidateId,
  errorCode,
}: {
  request: NextRequest;
  canonicalId: string;
  candidateId: string;
  errorCode: "unsafe" | "failed";
}) {
  const redirectUrl = new URL("/admin/duplicates/merge-preview", request.url);
  redirectUrl.searchParams.set("canonical", canonicalId);
  redirectUrl.searchParams.set("candidate", candidateId);
  redirectUrl.searchParams.set("merge_error", errorCode);

  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminRoute(request);

  if (unauthorized) {
    return unauthorized;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return badRequestResponse("Invalid merge request.");
  }

  const canonicalId = parsePositiveBigint(formData.get("canonicalId"));
  const candidateId = parsePositiveBigint(formData.get("candidateId"));
  const confirmation = formData.get("confirmation");
  const decisions = formData.get("decisions");

  if (!canonicalId || !candidateId) {
    return badRequestResponse("Product IDs must be positive bigint values.");
  }

  if (canonicalId === candidateId) {
    return badRequestResponse("Product IDs must be different.");
  }

  let preview;

  try {
    preview = await getMergePreview(canonicalId, candidateId);
  } catch (error) {
    console.error("Unable to recalculate merge preview before merge.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return redirectToPreview({
      request,
      canonicalId,
      candidateId,
      errorCode: "failed",
    });
  }

  if (!preview) {
    return redirectToPreview({
      request,
      canonicalId,
      candidateId,
      errorCode: "unsafe",
    });
  }

  const currentHasDecisionConflicts = hasDecisionConflicts(
    preview.decisionConflicts
  );

  if (!currentHasDecisionConflicts) {
    const canMerge =
      preview.mergePlan.summary.blocked === 0 &&
      preview.mergePlan.summary.warning === 0 &&
      hasSafeProductState(preview);

    if (!canMerge) {
      return redirectToPreview({
        request,
        canonicalId,
        candidateId,
        errorCode: "unsafe",
      });
    }

    const { error } = await supabaseAdmin.rpc("merge_products", {
      canonical_id: canonicalId,
      candidate_id: candidateId,
    });

    if (error) {
      console.error("Product merge RPC failed.", {
        code: error.code,
      });

      return redirectToPreview({
        request,
        canonicalId,
        candidateId,
        errorCode: "failed",
      });
    }
  } else {
    const submittedDecisions = parseSubmittedDecisions(decisions, preview);

    if (
      !submittedDecisions ||
      !hasConfirmation(confirmation, candidateId) ||
      !hasSafeProductState(preview) ||
      preview.mergePlan.summary.warning > 0 ||
      hasBlockedItemAfterCompatibilityFilter(preview)
    ) {
      return redirectToPreview({
        request,
        canonicalId,
        candidateId,
        errorCode: "unsafe",
      });
    }

    const { error } = await supabaseAdmin.rpc("merge_products_with_decisions", {
      canonical_id: canonicalId,
      candidate_id: candidateId,
      decisions: submittedDecisions,
    });

    if (error) {
      console.error("Decision-based product merge RPC failed.", {
        code: error.code,
      });

      return redirectToPreview({
        request,
        canonicalId,
        candidateId,
        errorCode: "failed",
      });
    }
  }

  const redirectUrl = new URL("/admin/duplicates", request.url);
  redirectUrl.searchParams.set("merged", "1");
  redirectUrl.searchParams.set("canonical", canonicalId);
  redirectUrl.searchParams.set("candidate", candidateId);

  return NextResponse.redirect(redirectUrl, 303);
}
