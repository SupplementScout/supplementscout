const assert = require("node:assert/strict");
const test = require("node:test");
const {
  enforceUniqueCanonicalTargets,
  brandFamily,
  matchRetailerRecords,
  productCandidates,
  signature,
} = require("./retailer-canonical-matcher");

const product = {
  id: 100,
  name: "Applied Nutrition ISO-XP Whey Protein Isolate 1kg",
  brand: "Applied Nutrition",
  product_format: "powder",
  gtin: null,
  is_active: true,
  merged_into_product_id: null,
};
const variants = [
  { id: 1001, product_id: 100, display_name: "Vanilla / 1kg", flavour_label: "Vanilla", size_value: 1000, size_unit: "g", pack_count: 1, product_format: "powder", is_active: true, is_default: false },
  { id: 1002, product_id: 100, display_name: "Strawberry / 1kg", flavour_label: "Strawberry", size_value: 1000, size_unit: "g", pack_count: 1, product_format: "powder", is_active: true, is_default: false },
];

function source(overrides = {}) {
  return {
    source_record_id: "2001",
    source_type: "variation",
    external_product_id: "2000",
    external_variant_id: "2001",
    external_gtin: null,
    product_name: "Applied Nutrition Whey Protein Isolate ISO-XP 1kg",
    variant_name: "Applied Nutrition Whey Protein Isolate ISO-XP 1kg - Vanilla",
    brand: "Applied Nutrition",
    external_options: { Flavour: "Vanilla" },
    policy_state: "ELIGIBLE",
    policy_code: "ELIGIBLE",
    ...overrides,
  };
}

test("token signature permits safe word-order differences", () => {
  assert.equal(
    signature("Applied Nutrition Whey Protein Isolate ISO-XP 1kg"),
    signature("Applied Nutrition ISO-XP Whey Protein Isolate 1kg")
  );
  assert.equal(productCandidates(source(), [product])[0].exact_signature, true);
});

test("known parent and sub-brand names share one guarded brand family", () => {
  assert.equal(brandFamily("Universal Nutrition"), brandFamily("Animal"));
  assert.equal(brandFamily("NXT"), brandFamily("NXT Nutrition"));
  assert.notEqual(brandFamily("Universal Nutrition"), brandFamily("Applied Nutrition"));
});

test("retailer aliases recover Animal Flex as a review candidate", () => {
  const animalFlex = {
    id: 956,
    name: "Animal Flex 44 packs",
    brand: "Animal",
    product_format: "pack",
    is_active: true,
    merged_into_product_id: null,
  };
  const candidates = productCandidates(
    source({
      product_name: "Universal Nutrition Animal Flex Joint Care 44 Packs",
      variant_name: "Universal Nutrition Animal Flex Joint Care 44 Packs",
      brand: "Universal Nutrition",
    }),
    [animalFlex],
    [{ product_id: 956, external_name: "Animal Flex 44 packs" }]
  );
  assert.equal(candidates[0].product.id, 956);
  assert.equal(candidates[0].brand_match, true);
  assert.equal(candidates[0].matched_name_source, "canonical");
  assert(candidates[0].score >= 45);
});

test("matches an exact product identity to the exact flavour variant", () => {
  const result = matchRetailerRecords([
    source(),
    source({ source_record_id: "2002", external_variant_id: "2002", variant_name: "Applied Nutrition Whey Protein Isolate ISO-XP 1kg - Strawberry", external_options: { Flavour: "Strawberry" } }),
  ], { products: [product], variants });
  assert.deepEqual(result.map((row) => row.status), ["SAFE_EXISTING_VARIANT", "SAFE_EXISTING_VARIANT"]);
  assert.deepEqual(result.map((row) => row.variant.id), [1001, 1002]);
});

test("never collapses multiple retailer flavours onto a default variant", () => {
  const result = matchRetailerRecords([
    source(),
    source({ source_record_id: "2002", external_variant_id: "2002", external_options: { Flavour: "Strawberry" } }),
  ], {
    products: [product],
    variants: [{ id: 1099, product_id: 100, display_name: "Default", flavour_label: null, size_value: null, size_unit: null, is_active: true, is_default: true }],
  });
  assert.deepEqual(result.map((row) => row.status), ["VARIANT_REVIEW", "VARIANT_REVIEW"]);
  assert.equal(result.every((row) => row.variant === null), true);
});

test("uses a unique verified canonical GTIN but keeps an unknown product in review", () => {
  const gtinProduct = { ...product, id: 101, gtin: "05012345678901" };
  const result = matchRetailerRecords([
    source({ source_type: "simple", external_product_id: "3000", external_variant_id: "3000", external_gtin: "05012345678901", product_name: "Retailer wording", variant_name: "Retailer wording", external_options: {} }),
    source({ source_record_id: "4000", source_type: "simple", external_product_id: "4000", external_variant_id: "4000", product_name: "Completely Unknown Formula 777g", variant_name: "Completely Unknown Formula 777g", brand: "Unknown", external_options: {} }),
  ], {
    products: [gtinProduct],
    variants: [{ id: 1011, product_id: 101, display_name: "Default", is_active: true, is_default: true }],
  });
  assert.equal(result[0].status, "SAFE_EXISTING_VARIANT");
  assert.equal(result[0].product.id, 101);
  assert.match(result[1].status, /REVIEW/);
});

test("propagates policy exclusions without considering canonical candidates", () => {
  const result = matchRetailerRecords([
    source({ policy_state: "EXCLUDED", policy_code: "EXCLUDE_SARM" }),
  ], { products: [product], variants });
  assert.equal(result[0].status, "EXCLUDED");
  assert.equal(result[0].product, null);
});

test("blocks duplicate retailer rows targeting one canonical variant", () => {
  const matches = matchRetailerRecords([
    source({ source_type: "simple", external_product_id: "5000", external_variant_id: "5000", external_options: {} }),
    source({ source_record_id: "5001", source_type: "simple", external_product_id: "5001", external_variant_id: "5001", external_options: {} }),
  ], {
    products: [product],
    variants: [{ id: 1001, product_id: 100, display_name: "Default", is_active: true, is_default: true }],
  });
  const guarded = enforceUniqueCanonicalTargets(matches);
  assert.deepEqual(guarded.map((row) => row.status), [
    "CANONICAL_TARGET_COLLISION",
    "CANONICAL_TARGET_COLLISION",
  ]);
});
