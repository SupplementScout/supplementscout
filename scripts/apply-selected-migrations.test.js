const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseArgs,
  pendingConfirmation,
  expectedCatalogueCounts,
  unwrapTransaction,
} = require("./apply-selected-migrations");
const { CONTRACTS } = require("./supabase-migration-selector");

test("rehearsal cannot receive an apply confirmation", () => {
  const parsed = parseArgs([
    "--environment=STAGING",
    `--project-ref=${CONTRACTS.STAGING.projectRef}`,
    "--mode=rehearse",
  ]);
  assert.equal(parsed.confirm, null);
  assert.equal(parsed.mode, "rehearse");
});

test("pending confirmation is deterministic and environment-bound", () => {
  const contract = {
    pending: [
      { filename: "20260728100000_one.sql", sha256: "a".repeat(64) },
      { filename: "20260728110000_two.sql", sha256: "b".repeat(64) },
    ],
  };
  assert.match(pendingConfirmation(contract), /^[0-9a-f]{16}$/);
  assert.equal(
    pendingConfirmation(contract),
    pendingConfirmation(contract),
  );
});

test("transaction wrapper is required and removed", () => {
  assert.equal(unwrapTransaction("begin;\nselect 1;\ncommit;", "one.sql").trim(), "select 1;");
  assert.throws(() => unwrapTransaction("select 1;", "one.sql"), /explicit begin\/commit/);
  assert.throws(
    () => unwrapTransaction("begin; begin; select 1; commit; commit;", "one.sql"),
    /nested transaction/,
  );
});

test("catalogue deltas default to zero and allow only exact declared table changes", () => {
  const before = { products: "10", product_variants: "20", retailer_products: "30", offers: "40", price_history: "50" };
  assert.deepEqual(expectedCatalogueCounts(before, [{}]), before);
  assert.deepEqual(expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { product_variants: 1 } }]), {
    ...before,
    product_variants: "21",
  });
  assert.throws(() => expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { unknown: 1 } }]), /invalid expected/);
  assert.throws(() => expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { offers: 0.5 } }]), /invalid expected/);
});
