const test = require("node:test");
const assert = require("node:assert/strict");
const { assertApproval, parseArgs, semanticKey, syntheticVariant } = require("./six-pack-missing-variant-builder");

test("missing-variant approval is exact", () => assert.doesNotThrow(assertApproval));
test("synthetic identity is stable", () => {
  const row = syntheticVariant({ product_id: "68", flavour: "Cookies & Cream", size: "1000", size_unit: "g", product_format: "powder" });
  assert.equal(row.display_name, "Cookies & Cream / 1kg");
  assert.equal(semanticKey(row), "68:cookies and cream:1000:g:1");
});
test("output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-missing-variants-17\.csv$/);
  assert.throws(() => parseArgs(["--output=config/no.csv"]), /inside repository tmp/);
});
