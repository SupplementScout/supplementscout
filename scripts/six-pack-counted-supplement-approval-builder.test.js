const assert = require("node:assert/strict");
const test = require("node:test");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v9.json");
const {
  categoryFor,
  parseArgs,
  productFormat,
  unitCount,
} = require("./six-pack-counted-supplement-approval-builder");

test("counted supplement approval is the exact safe 36-row scope", () => {
  assert.equal(approval.kind, "six-pack-reviewed-large-family-batch-v9");
  assert.equal(approval.approved, true);
  assert.equal(approval.family_count, 36);
  assert.equal(approval.new_product_count, 36);
  assert.equal(approval.row_count, 36);
  assert.equal(approval.families.every((family) => family.expected_count === 1), true);
  assert.equal(approval.families.every((family) => family.unit_count > 0), true);
  assert.equal(approval.policy.food, "EXCLUDE");
  assert.equal(approval.policy.sarms, "EXCLUDE");
  assert.equal(approval.policy.peptides, "EXCLUDE");
  assert.equal(approval.policy.hormonal_and_high_risk_stimulants, "DEFER");
  assert.equal(approval.policy.one_shared_automation, true);
});

test("count and format parsing handles attached retailer units", () => {
  assert.equal(unitCount("Vitamin D3 4000 120tabs"), 120);
  assert.equal(productFormat("Vitamin D3 4000 120tabs"), "tablet");
  assert.equal(unitCount("Astaxanthin 60 softgels"), 60);
  assert.equal(productFormat("Astaxanthin 60 softgels"), "softgel");
  assert.equal(productFormat("Ashwagandha 100 vege caps"), "capsule");
});

test("category routing keeps creatine and amino acids distinct", () => {
  assert.equal(
    categoryFor({ product_name: "Creatine HCL", categories: [] }),
    "Creatine"
  );
  assert.equal(
    categoryFor({ product_name: "Beta-Alanine", categories: [] }),
    "Amino Acids"
  );
});

test("approval output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
