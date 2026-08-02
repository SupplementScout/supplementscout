export const NUTRITION_CANDIDATE_REVIEW_STATUSES = [
  "approved",
  "rejected",
] as const;

export type NutritionCandidateReviewStatus =
  (typeof NUTRITION_CANDIDATE_REVIEW_STATUSES)[number];

export type NutritionCandidateReviewInput = {
  id: string;
  status: NutritionCandidateReviewStatus;
  reviewNote: string | null;
};

export function parseNutritionCandidateReviewInput(input: {
  id: FormDataEntryValue | null;
  status: FormDataEntryValue | null;
  reviewNote: FormDataEntryValue | null;
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
  const note = input.reviewNote?.trim() || null;
  if (note && note.length > 1000) return null;
  return {
    id: input.id,
    status: input.status as NutritionCandidateReviewStatus,
    reviewNote: note,
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
    review_note: input.reviewNote,
  };
}
