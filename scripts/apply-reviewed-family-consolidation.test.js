const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const plan = require("../config/catalogue-reviewed-family-consolidation-v1.json");
const { confirmation, parseArgs, slugify, validatePlan } = require("./apply-reviewed-family-consolidation");

test("reviewed family plan is complete and has unique identities", () => {
  const ids = validatePlan();
  assert.equal(plan.families.length, 24);
  assert.equal(ids.candidateIds.length, 33);
  assert.equal(ids.productIds.length, 57);
  assert.equal(ids.sourceVariantIds.length, 78);
  assert.equal(plan.expected_mapping_count, 79);
  assert.equal(plan.expected_offer_count, 79);
  assert.equal(plan.expected_created_variant_count, 58);
});

test("owner decisions retain separate and family meanings", () => {
  assert.match(plan.decision_meaning.deferred, /^MERGE FAMILY/);
  assert.match(plan.decision_meaning.separate, /osobne produkty/);
  assert.deepEqual(plan.separate_decision_remaps.map((row) => [row.product_a_id, row.product_b_id]), [[310, 315], [468, 471]]);
});

test("executor has deterministic confirmation and safe modes", () => {
  assert.match(confirmation(), /^[0-9a-f]{16}$/);
  assert.deepEqual(parseArgs([]), { mode: "rehearse", confirm: null });
  assert.deepEqual(parseArgs(["--mode=apply", `--confirm=${confirmation()}`]), { mode: "apply", confirm: confirmation() });
  assert.throws(() => parseArgs(["--mode=unsafe"]), /mode must be/);
});

test("canonical slugs are stable and family executor never deletes", () => {
  assert.equal(slugify("Gold's Gym Muscle Joe Gym T-Shirt"), "gold-s-gym-muscle-joe-gym-t-shirt");
  const source = fs.readFileSync(path.join(__dirname, "apply-reviewed-family-consolidation.js"), "utf8");
  assert.match(source, /begin/);
  assert.match(source, /rollback/);
  assert.match(source, /product_merge_history/);
  assert.match(source, /outbound_clicks/);
  assert.match(source, /price history evidence changed unexpectedly/);
  assert.doesNotMatch(source, /delete\s+from/i);
});
