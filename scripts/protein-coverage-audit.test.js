const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildProteinCoverageReport,
  isProteinScopeProduct,
  proteinCoverage,
  suggestedProteinFormat,
} = require("./lib/protein-coverage");

function product(overrides = {}) {
  return {
    id: 1, name: "Example Whey 1kg", category: "Whey Protein", is_active: true,
    merged_into_product_id: null, net_weight_g: 1000, net_volume_ml: null,
    serving_count_verified: 40, serving_size_g: 25, serving_size_ml: null,
    protein_per_serving_g: 20, product_format: "powder", nutrition_verified: true,
    unit_pricing_verified: true, ...overrides,
  };
}

test("protein coverage has comparison-ready and full-serving levels", () => {
  assert.equal(proteinCoverage(product()).level, "FULL_SERVING_VERIFIED");
  assert.deepEqual(proteinCoverage(product({ serving_count_verified: null })), {
    level: "COMPARISON_READY",
    missing_comparison_fields: [],
    missing_full_fields: ["serving_count_verified"],
    public_metric_blockers: [],
  });
  assert.equal(proteinCoverage(product({ protein_per_serving_g: null })).level, "INCOMPLETE");
});

test("protein scope excludes inactive, merged and unrelated categories", () => {
  assert.equal(isProteinScopeProduct(product()), true);
  assert.equal(isProteinScopeProduct(product({ category: "Creatine" })), false);
  assert.equal(isProteinScopeProduct(product({ is_active: false })), false);
  assert.equal(isProteinScopeProduct(product({ merged_into_product_id: 2 })), false);
  assert.equal(isProteinScopeProduct(product({ category: "Protein Bars" })), false);
  assert.equal(isProteinScopeProduct(product({ name: "Barebells Vegan Protein Bar 55g" })), false);
  assert.equal(isProteinScopeProduct(product({ name: "Whey Pro Synergy BCAA Bundle" })), false);
  assert.equal(isProteinScopeProduct(product({
    name: "Axe & Sledge DemoDay Powder 930g",
    category: "Whey Protein",
  })), false);
});

test("powder format suggestion is deterministic and conservative", () => {
  assert.deepEqual(suggestedProteinFormat(product({ product_format: null })), {
    value: "powder", reason: "protein powder category plus gram-based pack",
  });
  assert.equal(suggestedProteinFormat(product({ product_format: null, category: "Protein Bars" })), null);
  assert.equal(suggestedProteinFormat(product({ product_format: null, net_weight_g: null })), null);
});

test("coverage report counts levels and missing fields", () => {
  const report = buildProteinCoverageReport([
    product({ id: 1 }),
    product({ id: 2, serving_count_verified: null }),
    product({ id: 3, protein_per_serving_g: null, nutrition_verified: false }),
    product({ id: 4, category: "Creatine" }),
  ]);
  assert.equal(report.total_protein_products, 3);
  assert.equal(report.full_serving_verified, 1);
  assert.equal(report.comparison_ready_only, 1);
  assert.equal(report.comparison_ready_total, 2);
  assert.equal(report.incomplete, 1);
  assert.deepEqual(report.missing_fields.slice(0, 2), [
    { field: "nutrition_verified", count: 1 },
    { field: "protein_per_serving_g", count: 1 },
  ]);
});
