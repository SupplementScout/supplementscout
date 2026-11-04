export type ProteinEligibilityInput = {
  is_active?: boolean | null;
  merged_into_product_id?: number | string | null;
  merged_at?: string | null;
};

export function isProteinCandidateEligible(input: ProteinEligibilityInput) {
  return (
    input.is_active === true &&
    input.merged_into_product_id == null &&
    input.merged_at == null
  );
}
