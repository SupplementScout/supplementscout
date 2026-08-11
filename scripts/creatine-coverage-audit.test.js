const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCreatineCoverageReport,
  creatineCalculationBlockers,
  creatineCoverage,
  isCreatineScopeProduct,
  suggestedCreatineFormat,
} = require("./lib/creatine-coverage");

function powder(overrides = {}) {
  return {
    id: 1, name: "Example Creatine 250g", category: "Creatine", is_active: true,
    merged_into_product_id: null, product_format: "powder", net_weight_g: 250,
    unit_count: null, unit_type: null, serving_count_verified: 50,
    serving_size_g: 5, creatine_per_serving_g: 5, nutrition_verified: true,
    unit_pricing_verified: true, ...overrides,
  };
}

test("creatine scope is exact, active and canonical", () => {
  assert.equal(isCreatineScopeProduct(powder()), true);
  assert.equal(isCreatineScopeProduct(powder({ category: "Creatine Blend" })), false);
  assert.equal(isCreatineScopeProduct(powder({ is_active: false })), false);
  assert.equal(isCreatineScopeProduct(powder({ merged_into_product_id: 2 })), false);
});

test("powder completeness requires its four source facts and verification", () => {
  assert.equal(creatineCoverage(powder()).level, "FULL_FORMAT_AWARE_FACTS");
  const coverage = creatineCoverage(powder({ serving_size_g: null, nutrition_verified: false }));
  assert.deepEqual(coverage.missing_source_fields, ["serving_size_g"]);
  assert.deepEqual(coverage.structural_blockers, ["nutrition_verified"]);
  assert.equal(coverage.level, "INCOMPLETE");
});

test("counted products use unit identity and never pretend capsule count is grams", () => {
  const coverage = creatineCoverage(powder({
    name: "Example Creatine 120 Capsules", product_format: "capsule",
    net_weight_g: null, unit_count: 120, unit_type: "capsule",
    serving_count_verified: 30, serving_size_g: null,
  }));
  assert.equal(coverage.level, "FULL_FORMAT_AWARE_FACTS");
  assert.deepEqual(coverage.missing_source_fields, []);
  assert.equal(coverage.counted_serving_size_status, "DERIVED_FROM_UNIT_COUNT_AND_SERVINGS");
});

test("calculation readiness mirrors cost-per-5g gates", () => {
  assert.deepEqual(creatineCalculationBlockers(powder()), []);
  assert.deepEqual(creatineCalculationBlockers(powder({ serving_count_verified: null })), []);
  assert.ok(creatineCalculationBlockers(powder({
    serving_count_verified: null, serving_size_g: null,
  })).includes("serving_size_g_for_powder_fallback"));
  assert.ok(creatineCalculationBlockers(powder({ unit_pricing_verified: false }))
    .includes("unit_pricing_verified"));
});

test("format suggestions are explicit and conservative", () => {
  assert.equal(suggestedCreatineFormat(powder({ product_format: null })).value, "powder");
  assert.equal(suggestedCreatineFormat(powder({
    name: "Creatine 120 Caps", product_format: null, net_weight_g: null,
  })).value, "capsule");
  assert.equal(suggestedCreatineFormat(powder({
    name: "Unknown Creatine", product_format: null, net_weight_g: null,
  })), null);
});

test("coverage report keeps completeness separate from calculation readiness", () => {
  const report = buildCreatineCoverageReport([
    powder({ id: 1 }),
    powder({ id: 2, serving_count_verified: null }),
    powder({ id: 3, creatine_per_serving_g: null, nutrition_verified: false }),
    powder({ id: 4, category: "Whey Protein" }),
  ]);
  assert.equal(report.total_creatine_products, 3);
  assert.equal(report.full_format_aware_facts, 1);
  assert.equal(report.incomplete, 2);
  assert.equal(report.calculation_ready, 2);
  assert.deepEqual(report.missing_source_fields.find((row) =>
    row.field === "serving_count_verified"), { field: "serving_count_verified", count: 1 });
});
