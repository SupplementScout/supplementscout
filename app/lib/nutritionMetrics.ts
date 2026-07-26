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

  return {
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
}
