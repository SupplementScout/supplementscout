const assert = require("node:assert/strict");
const test = require("node:test");
const { PLAN, confirmation, parseArgs } = require("./merge-creatine-84-into-1040");

test("merge plan is exact and targets the reviewed existing canonical variant", () => {
  assert.deepEqual({ canonical: PLAN.canonicalId, candidate: PLAN.candidateId, variant: PLAN.targetVariantId }, { canonical: 1040, candidate: 84, variant: 2176 });
  assert.equal(PLAN.candidateExternalGtin, "5903111089412");
});

test("merge apply requires the sealed confirmation", () => {
  assert.deepEqual(parseArgs([]), { mode: "rehearse", confirm: null });
  assert.deepEqual(parseArgs(["--mode=verify"]), { mode: "verify", confirm: null });
  assert.throws(() => parseArgs(["--mode=apply"]), /apply requires --confirm/);
  assert.deepEqual(parseArgs(["--mode=apply", `--confirm=${confirmation()}`]), { mode: "apply", confirm: confirmation() });
});
