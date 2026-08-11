const CREATINE_CATEGORY = /^creatine$/i;
const COUNTED_FORMATS = new Set(["capsule", "tablet", "gummy"]);
const MANIFEST_FIELDS = new Set([
  "net_weight_g",
  "serving_count_verified",
  "serving_size_g",
  "creatine_per_serving_g",
]);

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value) {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function normalizedFormat(value) {
  return String(value || "").trim().toLowerCase();
}

function isCreatineScopeProduct(product) {
  return product?.is_active === true && product?.merged_into_product_id == null &&
    CREATINE_CATEGORY.test(String(product.category || "").trim());
}

function creatineCalculationBlockers(product) {
  const blockers = [];
  const creatine = positiveNumber(product.creatine_per_serving_g);
  const servings = positiveInteger(product.serving_count_verified);
  const format = normalizedFormat(product.product_format);
  if (product.unit_pricing_verified !== true) blockers.push("unit_pricing_verified");
  if (product.nutrition_verified !== true) blockers.push("nutrition_verified");
  if (creatine === null) blockers.push("creatine_per_serving_g");
  if (servings === null) {
    const weight = positiveNumber(product.net_weight_g);
    const servingSize = positiveNumber(product.serving_size_g);
    if (format !== "powder") {
      blockers.push("serving_count_verified_or_powder_fallback");
    } else {
      if (weight === null) blockers.push("net_weight_g_for_powder_fallback");
      if (servingSize === null) blockers.push("serving_size_g_for_powder_fallback");
      if (creatine !== null && servingSize !== null && creatine > servingSize) {
        blockers.push("creatine_exceeds_serving_size");
      }
    }
  }
  return [...new Set(blockers)];
}

function creatineCoverage(product) {
  const format = normalizedFormat(product.product_format);
  const isCounted = COUNTED_FORMATS.has(format);
  const missingSourceFields = [];
  const structuralBlockers = [];
  if (!format) structuralBlockers.push("product_format");
  if (isCounted) {
    if (positiveInteger(product.unit_count) === null) structuralBlockers.push("unit_count");
    if (!String(product.unit_type || "").trim()) structuralBlockers.push("unit_type");
  } else if (positiveNumber(product.net_weight_g) === null) {
    missingSourceFields.push("net_weight_g");
  }
  if (positiveInteger(product.serving_count_verified) === null) {
    missingSourceFields.push("serving_count_verified");
  }
  if (!isCounted && positiveNumber(product.serving_size_g) === null) {
    missingSourceFields.push("serving_size_g");
  }
  if (positiveNumber(product.creatine_per_serving_g) === null) {
    missingSourceFields.push("creatine_per_serving_g");
  }
  if (product.nutrition_verified !== true) structuralBlockers.push("nutrition_verified");
  const unsupportedServingUnit = isCounted &&
    positiveInteger(product.unit_count) !== null &&
    positiveInteger(product.serving_count_verified) !== null
      ? "DERIVED_FROM_UNIT_COUNT_AND_SERVINGS"
      : isCounted ? "NOT_MODELLED" : null;
  return {
    level: missingSourceFields.length === 0 && structuralBlockers.length === 0
      ? "FULL_FORMAT_AWARE_FACTS"
      : "INCOMPLETE",
    missing_source_fields: missingSourceFields,
    manifest_missing_fields: missingSourceFields.filter((field) => MANIFEST_FIELDS.has(field)),
    structural_blockers: structuralBlockers,
    calculation_blockers: creatineCalculationBlockers(product),
    counted_serving_size_status: unsupportedServingUnit,
  };
}

function suggestedCreatineFormat(product) {
  if (normalizedFormat(product.product_format)) return null;
  const name = String(product.name || "");
  if (/\bgumm(?:y|ies)\b/i.test(name)) return { value: "gummy", reason: "explicit gummy identity" };
  if (/\btablets?\b/i.test(name)) return { value: "tablet", reason: "explicit tablet identity" };
  if (/\b(?:capsules?|caps)\b/i.test(name)) return { value: "capsule", reason: "explicit capsule identity" };
  if (/\bpowder\b/i.test(name) || positiveNumber(product.net_weight_g) !== null) {
    return { value: "powder", reason: "explicit powder identity or gram-based pack" };
  }
  return null;
}

function buildCreatineCoverageReport(products) {
  const scoped = products.filter(isCreatineScopeProduct).map((product) => ({
    ...product,
    coverage: creatineCoverage(product),
    product_format_suggestion: suggestedCreatineFormat(product),
  }));
  const fieldCounts = new Map();
  const blockerCounts = new Map();
  for (const product of scoped) {
    for (const field of product.coverage.missing_source_fields) {
      fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
    }
    for (const blocker of product.coverage.structural_blockers) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1);
    }
  }
  const sortedCounts = (values) => Array.from(values.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((left, right) => right.count - left.count || left.field.localeCompare(right.field));
  return {
    total_creatine_products: scoped.length,
    full_format_aware_facts: scoped.filter((row) => row.coverage.level === "FULL_FORMAT_AWARE_FACTS").length,
    incomplete: scoped.filter((row) => row.coverage.level === "INCOMPLETE").length,
    calculation_ready: scoped.filter((row) => row.coverage.calculation_blockers.length === 0).length,
    missing_source_fields: sortedCounts(fieldCounts),
    structural_blockers: sortedCounts(blockerCounts),
    deterministic_product_format_suggestions: scoped.filter((row) => row.product_format_suggestion).length,
    counted_products_without_source_serving_unit_field: scoped.filter((row) =>
      row.coverage.counted_serving_size_status !== null).length,
    products: scoped,
  };
}

module.exports = {
  buildCreatineCoverageReport,
  creatineCalculationBlockers,
  creatineCoverage,
  isCreatineScopeProduct,
  positiveNumber,
  suggestedCreatineFormat,
};
