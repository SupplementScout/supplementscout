const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PLAN,
  confirmation,
  parseArgs,
} = require("./correct-six-pack-final-closeout-decisions");

test("final correction is an exact unique 35-row plan", () => {
  assert.equal(PLAN.length, 35);
  assert.equal(new Set(PLAN.map((row) => row.sourceRecordId)).size, 35);
  assert.equal(PLAN.filter((row) => row.kind === "family-seed").length, 2);
  assert.equal(PLAN.filter((row) => row.kind === "classification").length, 4);
});

test("apply requires the sealed confirmation", () => {
  assert.equal(
    parseArgs(["--mode=apply", "--target=production", `--confirm=${confirmation()}`]).mode,
    "apply"
  );
  assert.throws(
    () => parseArgs(["--mode=apply", "--target=production", "--confirm=wrong"]),
    /confirmation/
  );
  assert.equal(
    parseArgs(["--mode=rehearse", "--target=production"]).mode,
    "rehearse"
  );
});
