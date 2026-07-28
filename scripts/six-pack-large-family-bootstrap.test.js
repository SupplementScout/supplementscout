const assert = require("node:assert/strict");
const test = require("node:test");
const approval = require("../config/retailers/six-pack-reviewed-large-family-batch-v7.json");
const nextApproval = require("../config/retailers/six-pack-reviewed-large-family-batch-v8.json");
const countedApproval = require("../config/retailers/six-pack-reviewed-large-family-batch-v9.json");
const powderApproval = require("../config/retailers/six-pack-reviewed-large-family-batch-v10.json");
const {
  assertApproval,
  classifyVariants,
  intendedVariants,
  parseArgs,
  productPayload,
} = require("./six-pack-large-family-bootstrap");

test("large Six Pack approval binds eight families and 77 source variants", () => {
  assert.doesNotThrow(assertApproval);
  const intended = approval.families.flatMap((family) =>
    intendedVariants(family).filter((variant) => variant.external_variant_id)
  );
  assert.equal(intended.length, 77);
  assert.equal(
    new Set(
      intended.map(
        (variant) =>
          `${variant.external_variant_id}:${variant.variant_key}`
      )
    ).size,
    77
  );
});

test("generic bootstrap accepts the exact next 34-offer approval", () => {
  assert.doesNotThrow(() => assertApproval(nextApproval));
  const intended = nextApproval.families.flatMap((family) =>
    intendedVariants(family).filter(
      (variant) => variant.external_variant_id
    )
  );
  assert.equal(intended.length, 34);
  assert.equal(
    new Set(intended.map((variant) => variant.external_variant_id))
      .size,
    34
  );
});

test("generic bootstrap accepts 36 counted supplement families", () => {
  assert.doesNotThrow(() => assertApproval(countedApproval));
  const intended = countedApproval.families.flatMap((family) =>
    intendedVariants(family).filter(
      (variant) => variant.external_variant_id
    )
  );
  assert.equal(intended.length, 36);
  assert.equal(intended.every((variant) => variant.size_value === null), true);
  assert.equal(
    new Set(intended.map((variant) => variant.external_variant_id)).size,
    36
  );
});

test("generic bootstrap accepts 13 powder families and 32 offers", () => {
  assert.doesNotThrow(() => assertApproval(powderApproval));
  const intended = powderApproval.families.flatMap((family) =>
    intendedVariants(family).filter(
      (variant) => variant.external_variant_id
    )
  );
  assert.equal(powderApproval.family_count, 13);
  assert.equal(intended.length, 32);
  assert.equal(
    new Set(intended.map((variant) => variant.external_variant_id)).size,
    32
  );
});

test("new canonical products keep unverified metrics null", () => {
  const family = approval.families.find(
    (row) => row.kind === "NEW_CANONICAL_PRODUCT"
  );
  const product = productPayload(family);
  assert.equal(product.net_weight_g, Number(family.size));
  assert.equal(product.nutrition_verified, false);
  assert.equal(product.serving_count_verified, null);
  assert.equal(product.protein_per_serving_g, null);
  assert.equal(product.creatine_per_serving_g, null);
});

test("counted products store unit count without inventing net weight", () => {
  const family = countedApproval.families[0];
  const product = productPayload(family);
  assert.equal(product.net_weight_g, null);
  assert.equal(product.unit_count, family.unit_count);
  assert.equal(product.unit_type, family.unit_type);
  assert.equal(product.nutrition_verified, false);
});

test("large family variant classification is empty, complete or partial", () => {
  const family = approval.families.find(
    (row) => row.kind === "NEW_CANONICAL_PRODUCT"
  );
  const intended = intendedVariants(family);
  assert.equal(classifyVariants([], intended).state, "EMPTY");
  const existing = intended.map((row, index) => ({
    ...row,
    id: index + 1,
  }));
  assert.equal(classifyVariants(existing, intended).state, "COMPLETE");
  assert.equal(
    classifyVariants(existing.slice(0, -1), intended).state,
    "PARTIAL"
  );
});

test("large family bootstrap evidence is confined to tmp", () => {
  assert.throws(
    () =>
      parseArgs([
        "--mode=dry-run",
        "--output=config/retailers/unsafe.json",
      ]),
    /inside repository tmp/
  );
});
