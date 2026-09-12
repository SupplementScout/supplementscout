import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import {
  resolveAppliedPreWorkoutFacts,
  type AppliedPreWorkoutFacts,
  type ReviewedNutritionCandidate,
} from "./reviewedPreWorkoutFacts";

export type NutritionProofVariant = {
  id: number | string;
  product_id: number | string;
  nutrition_override?: Record<string, unknown> | null;
};

const CANDIDATE_SELECT = [
  "product_id",
  "product_variant_id",
  "proposed_field",
  "proposed_value",
  "proposed_unit",
  "approved_value",
  "status",
  "information_state",
  "source_quantity_value",
  "source_quantity_unit",
  "quantity_basis",
  "serving_basis_value",
  "serving_basis_unit",
  "serving_basis_text",
  "ingredient_form",
  "ingredient_ratio",
  "warning_flags",
  "source_locator",
].join(",");

const QUERY_BATCH_SIZE = 100;

export async function loadAppliedPreWorkoutFacts(
  variants: NutritionProofVariant[]
): Promise<Map<string, AppliedPreWorkoutFacts>> {
  const uniqueVariants = new Map(
    variants.map((variant) => [String(variant.id), variant])
  );
  const variantIds = [...uniqueVariants.keys()];
  if (variantIds.length === 0) return new Map();

  const candidates: ReviewedNutritionCandidate[] = [];
  for (let index = 0; index < variantIds.length; index += QUERY_BATCH_SIZE) {
    const batch = variantIds.slice(index, index + QUERY_BATCH_SIZE);
    const { data, error } = await supabaseAdmin
      .from("nutrition_candidates")
      .select(CANDIDATE_SELECT)
      .eq("status", "approved")
      .in("product_variant_id", batch);

    if (error) {
      console.error("Unable to verify applied pre-workout facts.");
      return new Map();
    }
    candidates.push(...((data || []) as unknown as ReviewedNutritionCandidate[]));
  }

  return new Map(
    [...uniqueVariants].map(([variantId, variant]) => [
      variantId,
      resolveAppliedPreWorkoutFacts(
        variant.product_id,
        variant.id,
        variant.nutrition_override,
        candidates
      ),
    ])
  );
}
