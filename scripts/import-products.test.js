const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeCategory,
  shouldLogCategoryNormalization,
} = require("./import-products");

test("normalizes pre-workout variants to Pre Workout", () => {
  assert.equal(normalizeCategory("Pre-Workout"), "Pre Workout");
  assert.equal(normalizeCategory("pre-workout"), "Pre Workout");
  assert.equal(normalizeCategory(" PRE-WORKOUT "), "Pre Workout");
});

test("normalizes mapped supplement category aliases", () => {
  assert.equal(normalizeCategory("Creatine Supplements"), "Creatine");
  assert.equal(normalizeCategory("Amino Acid Supplements"), "Amino Acids");
});

test("leaves product-level categories unmapped except whitespace cleanup", () => {
  assert.equal(normalizeCategory("Health Supplements"), "Health Supplements");
  assert.equal(normalizeCategory("Protein Powder"), "Protein Powder");
  assert.equal(normalizeCategory("  Whey   Protein  "), "Whey Protein");
  assert.equal(normalizeCategory(" Weight Management "), "Weight Management");
});

test("logs only when canonical mapping changes category after whitespace cleanup", () => {
  assert.equal(
    shouldLogCategoryNormalization(" Pre-Workout ", normalizeCategory(" Pre-Workout ")),
    true
  );
  assert.equal(
    shouldLogCategoryNormalization("Whey   Protein", normalizeCategory("Whey   Protein")),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization(
      "Health Supplements",
      normalizeCategory("Health Supplements")
    ),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization("pre-workout", normalizeCategory("pre-workout")),
    true
  );
});
