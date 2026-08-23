export type NutritionScalar = number | string | null;

export type ProductNutritionMetrics = {
  net_weight_g: NutritionScalar;
  serving_count_verified: NutritionScalar;
  serving_size_g: NutritionScalar;
  protein_per_serving_g: NutritionScalar;
  creatine_per_serving_g: NutritionScalar;
  product_format: string | null;
  unit_pricing_verified: boolean | null;
  nutrition_verified: boolean | null;
};

export type VariantNutritionMetrics = {
  size_value?: NutritionScalar;
  size_unit?: string | null;
  product_format?: string | null;
  nutrition_override?: Record<string, unknown> | null;
} | null;

const NUTRITION_VALUE_KEYS = new Set([
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "serving_size_g",
]);

const UNIT_VALUE_KEYS = new Set([
  "net_weight_g",
  "serving_count_verified",
  "serving_size_g",
]);

function hasOwn(object: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function overrideValue<T>(
  override: Record<string, unknown>,
  key: string,
  fallback: T
) {
  return hasOwn(override, key) ? override[key] as T : fallback;
}

function positiveNumber(value: unknown) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function variantWeightG(variant: VariantNutritionMetrics) {
  if (variant?.size_unit?.trim().toLowerCase() !== "g") return null;
  return positiveNumber(variant.size_value);
}

function overridesAny(
  override: Record<string, unknown>,
  keys: Set<string>
) {
  return Array.from(keys).some((key) => hasOwn(override, key));
}

function positiveInteger(value: unknown) {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function hasCompleteApprovedVariantNutrition(
  product: ProductNutritionMetrics,
  override: Record<string, unknown>,
  structuralVariantWeight: number
) {
  if (
    positiveNumber(override.net_weight_g) !== structuralVariantWeight ||
    positiveInteger(override.serving_count_verified) === null ||
    positiveNumber(override.serving_size_g) === null ||
    typeof override.product_format !== "string" ||
    override.product_format.trim().length === 0 ||
    override.unit_pricing_verified !== true ||
    override.nutrition_verified !== true
  ) {
    return false;
  }

  if (
    override.source_type !== "manufacturer_product_page" ||
    typeof override.source_url !== "string" ||
    !/^https:\/\//.test(override.source_url) ||
    typeof override.evidence !== "string" ||
    override.evidence.trim().length < 20
  ) {
    return false;
  }

  const servingCount = positiveInteger(override.serving_count_verified) as number;
  const servingSize = positiveNumber(override.serving_size_g) as number;
  if (
    Math.abs(structuralVariantWeight - servingCount * servingSize) > servingSize
  ) {
    return false;
  }

  if (
    positiveNumber(product.protein_per_serving_g) !== null &&
    positiveNumber(override.protein_per_serving_g) === null
  ) {
    return false;
  }

  if (
    positiveNumber(product.creatine_per_serving_g) !== null &&
    positiveNumber(override.creatine_per_serving_g) === null
  ) {
    return false;
  }

  return true;
}

export function getEffectiveNutritionMetrics(
  product: ProductNutritionMetrics,
  variant: VariantNutritionMetrics
): ProductNutritionMetrics {
  const override =
    variant?.nutrition_override &&
    typeof variant.nutrition_override === "object" &&
    !Array.isArray(variant.nutrition_override)
      ? variant.nutrition_override
      : {};
  const structuralVariantWeight = variantWeightG(variant);
  const productWeight = positiveNumber(product.net_weight_g);
  const packMismatch =
    structuralVariantWeight !== null &&
    productWeight !== null &&
    structuralVariantWeight !== productWeight;
  const failClosedForPackMismatch =
    packMismatch &&
    !hasCompleteApprovedVariantNutrition(
      product,
      override,
      structuralVariantWeight
    );
  const nutritionVerified = overridesAny(override, NUTRITION_VALUE_KEYS)
    ? override.nutrition_verified === true
    : overrideValue(
      override,
      "nutrition_verified",
      product.nutrition_verified
    ) === true;
  const unitPricingVerified = overridesAny(override, UNIT_VALUE_KEYS)
    ? override.unit_pricing_verified === true
    : overrideValue(
      override,
      "unit_pricing_verified",
      product.unit_pricing_verified
    ) === true;

  const effective = {
    net_weight_g: overrideValue(
      override,
      "net_weight_g",
      structuralVariantWeight ?? product.net_weight_g
    ) as NutritionScalar,
    serving_count_verified: overrideValue(
      override,
      "serving_count_verified",
      product.serving_count_verified
    ) as NutritionScalar,
    serving_size_g: overrideValue(
      override,
      "serving_size_g",
      product.serving_size_g
    ) as NutritionScalar,
    protein_per_serving_g: overrideValue(
      override,
      "protein_per_serving_g",
      product.protein_per_serving_g
    ) as NutritionScalar,
    creatine_per_serving_g: overrideValue(
      override,
      "creatine_per_serving_g",
      product.creatine_per_serving_g
    ) as NutritionScalar,
    product_format: overrideValue(
      override,
      "product_format",
      variant?.product_format || product.product_format
    ) as string | null,
    unit_pricing_verified: unitPricingVerified,
    nutrition_verified: nutritionVerified,
  };

  if (!failClosedForPackMismatch) return effective;

  return {
    ...effective,
    serving_count_verified: null,
    serving_size_g: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    nutrition_verified: false,
  };
}
