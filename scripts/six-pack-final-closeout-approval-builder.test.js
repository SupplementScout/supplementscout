const assert = require("node:assert/strict");
const test = require("node:test");
const {
  EXPECTED_DECISIONS,
  FAMILY_SPECS,
  SOURCE_ALIASES,
  parseArgs,
} = require("./six-pack-final-closeout-approval-builder");

test("final closeout specification is exact and collision-free", () => {
  const ids = FAMILY_SPECS.flatMap((family) => family.rows.map((row) => row.id));
  assert.equal(FAMILY_SPECS.length, 38);
  assert.equal(FAMILY_SPECS.filter((family) => !family.product_id).length, 21);
  assert.equal(ids.length, 69);
  assert.equal(new Set(ids).size, 69);
  assert.equal(EXPECTED_DECISIONS.size, 68);
  assert.equal(SOURCE_ALIASES.length, 3);
});

test("final closeout output remains inside tmp", () => {
  assert.throws(() => parseArgs(["--output=../outside.json"]), /inside repository tmp/);
  assert.match(parseArgs([]).output, /six-pack-reviewed-large-family-batch-v15\.json$/);
});
