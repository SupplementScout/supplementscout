const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertApproval,
  normalize,
  parseArgs,
  sourceFlavourValues,
} = require("./six-pack-reviewed-expansion-builder");

test("approved expansion contract is complete and unique", () => {
  assert.doesNotThrow(() => assertApproval());
});

test("retailer flavour evidence is normalized without becoming canonical identity", () => {
  assert.deepEqual(sourceFlavourValues({ external_options: { Flavour: "Ice Blue Raz" } }), ["ice blue raz"]);
  assert.equal(normalize("Cookies & Cream"), "cookies and cream");
});

test("builder only accepts tmp output", () => {
  assert.match(parseArgs([]).output, /six-pack-reviewed-expansion-35\.csv$/);
  assert.throws(() => parseArgs(["--output=config/no.csv"]), /inside repository tmp/);
});
