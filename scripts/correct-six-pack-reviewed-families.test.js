const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PLAN,
  confirmation,
  parseArgs,
} = require("./correct-six-pack-reviewed-families");

test("review correction plan is exact, unique, and catalogue-free", () => {
  assert.equal(PLAN.length, 22);
  assert.equal(new Set(PLAN.map(({ id }) => id)).size, 22);
  assert.equal(PLAN.filter(({ kind }) => kind === "family-seed").length, 4);
  assert.equal(PLAN.filter(({ kind }) => kind === "family-variant").length, 11);
  assert.equal(
    PLAN.filter(({ kind }) => kind === "existing-product-variant").length,
    6
  );
  assert.equal(PLAN.filter(({ kind }) => kind === "existing-variant").length, 1);
  assert.match(confirmation(), /^[0-9a-f]{16}$/);
});

test("apply requires production and the exact plan confirmation", () => {
  assert.deepEqual(
    parseArgs(["--mode=rehearse", "--target=production"]),
    { mode: "rehearse", target: "production" }
  );
  assert.throws(
    () => parseArgs(["--mode=apply", "--target=production"]),
    /confirmation/
  );
  assert.equal(
    parseArgs([
      "--mode=apply",
      "--target=production",
      `--confirm=${confirmation()}`,
    ]).mode,
    "apply"
  );
});
