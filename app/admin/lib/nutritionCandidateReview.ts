export const NUTRITION_CANDIDATE_REVIEW_STATUSES = [
  "approved",
  "rejected",
] as const;

export type NutritionCandidateReviewStatus =
  (typeof NUTRITION_CANDIDATE_REVIEW_STATUSES)[number];

export type NutritionCandidateReviewInput = {
  id: string;
  status: NutritionCandidateReviewStatus;
  approvedValue: number | null;
  reviewNote: string | null;
  candidateFingerprint: string;
};

export type NutritionCandidateBulkReviewInput = {
  candidateIds: string[];
  productId: string;
  productVariantId: string | null;
  runId: string;
};

export type BulkReviewCandidate = {
  id: string | number;
  product_id: string | number | null;
  product_variant_id: string | number | null;
  proposed_field: string;
  proposed_value: string | number;
  warning_flags: unknown;
  status: string;
  run_id: string;
};

const UNSAFE_BULK_WARNING = /CONFLICT|AMBIGUOUS|UNCLEAR|MISMATCH|EXCEEDS/i;
const BULK_FIELDS = new Set([
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
]);

export function parseNutritionCandidateReviewInput(input: {
  id: FormDataEntryValue | null;
  status: FormDataEntryValue | null;
  approvedValue: FormDataEntryValue | null;
  reviewNote: FormDataEntryValue | null;
  candidateFingerprint: FormDataEntryValue | null;
}): NutritionCandidateReviewInput | null {
  if (typeof input.id !== "string" || !/^[1-9]\d*$/.test(input.id)) {
    return null;
  }
  if (
    typeof input.status !== "string" ||
    !NUTRITION_CANDIDATE_REVIEW_STATUSES.includes(
      input.status as NutritionCandidateReviewStatus
    )
  ) {
    return null;
  }
  if (input.reviewNote !== null && typeof input.reviewNote !== "string") {
    return null;
  }
  if (typeof input.candidateFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(input.candidateFingerprint)) return null;
  const note = input.reviewNote?.trim() || null;
  if (note && note.length > 1000) return null;
  const approvedValueText = typeof input.approvedValue === "string"
    ? input.approvedValue.trim()
    : "";
  const approvedValue = approvedValueText === "" ? null : Number(approvedValueText);
  if (
    input.status === "approved" &&
      (!Number.isFinite(approvedValue) || approvedValue === null || approvedValue <= 0)
  ) {
    return null;
  }
  return {
    id: input.id,
    status: input.status as NutritionCandidateReviewStatus,
    approvedValue: input.status === "approved" ? approvedValue : null,
    reviewNote: note,
    candidateFingerprint: input.candidateFingerprint,
  };
}

export function canReviewNutritionCandidate(
  currentStatus: string,
  nextStatus: NutritionCandidateReviewStatus
) {
  return currentStatus === "pending" &&
    NUTRITION_CANDIDATE_REVIEW_STATUSES.includes(nextStatus);
}

export function buildNutritionCandidateReviewUpdate(
  input: NutritionCandidateReviewInput,
  reviewedAt: string
) {
  if (!Number.isFinite(Date.parse(reviewedAt))) {
    throw new Error("reviewedAt must be an ISO timestamp");
  }
  return {
    status: input.status,
    reviewed_at: new Date(reviewedAt).toISOString(),
    reviewed_by: "admin-panel",
    approved_value: input.status === "approved" ? input.approvedValue : null,
    review_note: input.reviewNote,
  };
}

export function isBulkApprovableNutritionCandidate(
  candidate: BulkReviewCandidate
) {
  const value = Number(candidate.proposed_value);
  const flags = Array.isArray(candidate.warning_flags)
    ? candidate.warning_flags.map(String)
    : [];
  return candidate.status === "pending" &&
    candidate.product_id !== null &&
    BULK_FIELDS.has(candidate.proposed_field) &&
    Number.isFinite(value) &&
    value > 0 &&
    (candidate.proposed_field !== "serving_count_verified" || Number.isInteger(value)) &&
    !flags.some((flag) => UNSAFE_BULK_WARNING.test(flag));
}

export function parseNutritionCandidateBulkReviewInput(input: {
  candidateIds: FormDataEntryValue[];
  productId: FormDataEntryValue | null;
  productVariantId: FormDataEntryValue | null;
  runId: FormDataEntryValue | null;
}): NutritionCandidateBulkReviewInput | null {
  if (
    typeof input.productId !== "string" ||
    !/^[1-9]\d*$/.test(input.productId) ||
    typeof input.runId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,200}$/.test(input.runId) ||
    input.candidateIds.length < 1 ||
    input.candidateIds.length > 50 ||
    input.candidateIds.some((id) => typeof id !== "string" || !/^[1-9]\d*$/.test(id))
  ) {
    return null;
  }
  const candidateIds = input.candidateIds.map(String);
  const productVariantId = input.productVariantId === "" || input.productVariantId === null
    ? null
    : typeof input.productVariantId === "string" && /^[1-9]\d*$/.test(input.productVariantId)
      ? input.productVariantId
      : undefined;
  if (productVariantId === undefined) return null;
  if (new Set(candidateIds).size !== candidateIds.length) return null;
  return { candidateIds, productId: input.productId, productVariantId, runId: input.runId };
}

export function validateNutritionCandidateBulkSelection(
  input: NutritionCandidateBulkReviewInput,
  candidates: BulkReviewCandidate[]
) {
  if (candidates.length !== input.candidateIds.length) return false;
  const requested = new Set(input.candidateIds);
  const valuesByField = new Map<string, Set<number>>();
  for (const candidate of candidates) {
    if (
      !requested.has(String(candidate.id)) ||
      String(candidate.product_id) !== input.productId ||
      (candidate.product_variant_id == null ? null : String(candidate.product_variant_id)) !== input.productVariantId ||
      candidate.run_id !== input.runId ||
      !isBulkApprovableNutritionCandidate(candidate)
    ) {
      return false;
    }
    const values = valuesByField.get(candidate.proposed_field) ?? new Set<number>();
    values.add(Number(candidate.proposed_value));
    valuesByField.set(candidate.proposed_field, values);
  }
  return Array.from(valuesByField.values()).every((values) => values.size === 1);
}
