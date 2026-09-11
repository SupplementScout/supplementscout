export type NutritionCandidateReadError = {
  code?: string;
  message?: string;
};

type NutritionCandidateReadResult<T> = {
  data: T[] | null;
  error: NutritionCandidateReadError | null;
};

const MISSING_VARIANT_PROVENANCE_COLUMN =
  /(?:column\s+(?:nutrition_candidates\.)?(?:product_variant_id|source_archive_uri)\s+does not exist|could not find the '(?:product_variant_id|source_archive_uri)' column of 'nutrition_candidates')/i;
const MISSING_PREWORKOUT_FACT_COLUMN =
  /(?:column\s+(?:nutrition_candidates\.)?(?:information_state|source_quantity_value|source_quantity_unit|quantity_basis|serving_basis_value|serving_basis_unit|serving_basis_text|ingredient_form|ingredient_ratio)\s+does not exist|could not find the '(?:information_state|source_quantity_value|source_quantity_unit|quantity_basis|serving_basis_value|serving_basis_unit|serving_basis_text|ingredient_form|ingredient_ratio)' column of 'nutrition_candidates')/i;

export class NutritionVariantProvenanceMigrationRequiredError extends Error {
  constructor() {
    super("Nutrition variant provenance migration is required for variant operations.");
    this.name = "NutritionVariantProvenanceMigrationRequiredError";
  }
}

export function isMissingNutritionVariantProvenanceColumn(
  error: NutritionCandidateReadError | null | undefined
) {
  return Boolean(
    error &&
    (error.code === "42703" || error.code === "PGRST204") &&
    MISSING_VARIANT_PROVENANCE_COLUMN.test(String(error.message || ""))
  );
}

export function isMissingNutritionPreworkoutFactColumn(
  error: NutritionCandidateReadError | null | undefined
) {
  return Boolean(
    error &&
    (error.code === "42703" || error.code === "PGRST204") &&
    MISSING_PREWORKOUT_FACT_COLUMN.test(String(error.message || ""))
  );
}

export async function readNutritionCandidatesWithSchemaCompatibility<
  T extends Record<string, unknown>,
>(
  readCurrent: () => Promise<NutritionCandidateReadResult<T>>,
  readLegacy: () => Promise<NutritionCandidateReadResult<T>>,
  allowLegacyProductRows: boolean
): Promise<{
  rows: Array<T & { product_variant_id: unknown | null; source_archive_uri: unknown | null }>;
  variantProvenanceAvailable: boolean;
}> {
  const current = await readCurrent();
  if (!current.error) {
    return {
      rows: (current.data || []) as Array<T & {
        product_variant_id: unknown | null;
        source_archive_uri: unknown | null;
      }>,
      variantProvenanceAvailable: true,
    };
  }
  if (!isMissingNutritionVariantProvenanceColumn(current.error)) {
    throw current.error;
  }
  if (!allowLegacyProductRows) {
    throw new NutritionVariantProvenanceMigrationRequiredError();
  }
  const legacy = await readLegacy();
  if (legacy.error) throw legacy.error;
  return {
    rows: (legacy.data || []).map((row) => ({
      ...row,
      product_variant_id: null,
      source_archive_uri: null,
    })),
    variantProvenanceAvailable: false,
  };
}
