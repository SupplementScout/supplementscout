const PROTEIN_SCOPE = /protein|mass gainer/i;
const POWDER_CATEGORY = /whey|casein|protein powder|clear whey|isolate|vegan protein|plant protein|mass gainer/i;
const KNOWN_NON_PROTEIN_IDENTITIES = /\baxe\s*&\s*sledge\s+demo\s*day\b/i;

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isProteinScopeProduct(product) {
  return product?.is_active === true && product?.merged_into_product_id == null &&
    PROTEIN_SCOPE.test(String(product.category || "")) &&
    !KNOWN_NON_PROTEIN_IDENTITIES.test(String(product.name || ""));
}

function proteinCoverage(product) {
  const missingComparisonFields = [];
  if (positiveNumber(product.net_weight_g) === null && positiveNumber(product.net_volume_ml) === null) {
    missingComparisonFields.push("net_weight_or_volume");
  }
  if (positiveNumber(product.serving_size_g) === null && positiveNumber(product.serving_size_ml) === null) {
    missingComparisonFields.push("serving_size");
  }
  if (positiveNumber(product.protein_per_serving_g) === null) {
    missingComparisonFields.push("protein_per_serving_g");
  }
  if (!String(product.product_format || "").trim()) {
    missingComparisonFields.push("product_format");
  }
  if (product.nutrition_verified !== true) {
    missingComparisonFields.push("nutrition_verified");
  }
  const count = positiveNumber(product.serving_count_verified);
  const missingFullFields = [...missingComparisonFields];
  if (count === null || !Number.isInteger(count)) {
    missingFullFields.push("serving_count_verified");
  }
  const level = missingFullFields.length === 0
    ? "FULL_SERVING_VERIFIED"
    : missingComparisonFields.length === 0
      ? "COMPARISON_READY"
      : "INCOMPLETE";
  return {
    level,
    missing_comparison_fields: missingComparisonFields,
    missing_full_fields: missingFullFields,
    public_metric_blockers: product.unit_pricing_verified === true
      ? []
      : ["unit_pricing_verified"],
  };
}

function suggestedProteinFormat(product) {
  if (String(product.product_format || "").trim()) return null;
  if (
    POWDER_CATEGORY.test(String(product.category || "")) &&
    positiveNumber(product.net_weight_g) !== null
  ) {
    return {
      value: "powder",
      reason: "protein powder category plus gram-based pack",
    };
  }
  return null;
}

function buildProteinCoverageReport(products) {
  const scoped = products.filter(isProteinScopeProduct).map((product) => ({
    ...product,
    coverage: proteinCoverage(product),
    product_format_suggestion: suggestedProteinFormat(product),
  }));
  const counts = {
    FULL_SERVING_VERIFIED: 0,
    COMPARISON_READY: 0,
    INCOMPLETE: 0,
  };
  const missing = new Map();
  for (const product of scoped) {
    counts[product.coverage.level] += 1;
    for (const field of product.coverage.missing_full_fields) {
      missing.set(field, (missing.get(field) || 0) + 1);
    }
  }
  return {
    total_protein_products: scoped.length,
    full_serving_verified: counts.FULL_SERVING_VERIFIED,
    comparison_ready_only: counts.COMPARISON_READY,
    comparison_ready_total: counts.FULL_SERVING_VERIFIED + counts.COMPARISON_READY,
    incomplete: counts.INCOMPLETE,
    missing_fields: Array.from(missing.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((left, right) => right.count - left.count || left.field.localeCompare(right.field)),
    deterministic_product_format_suggestions: scoped.filter((product) => product.product_format_suggestion).length,
    products: scoped,
  };
}

module.exports = {
  buildProteinCoverageReport,
  isProteinScopeProduct,
  positiveNumber,
  proteinCoverage,
  suggestedProteinFormat,
};
