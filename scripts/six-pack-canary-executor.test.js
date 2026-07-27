const assert = require("node:assert/strict");
const test = require("node:test");
const { parseArgs, plansForMode } = require("./six-pack-canary-executor");

function artifact(action) {
  return {
    plans: Array.from({ length: 6 }, (_, index) => ({
      row_number: String(index + 2),
      resolved_plan: {
        retailer: action === "create"
          ? { action, values: { slug: "6-pack-supplements" } }
          : { action, id: "10" },
      },
    })),
  };
}

test("bootstrap executes only the first create plan and becomes a no-op after bootstrap", () => {
  assert.equal(plansForMode(artifact("create"), "bootstrap").length, 1);
  assert.equal(plansForMode(artifact("existing"), "bootstrap").length, 0);
});

test("full execution requires all six plans to bind the existing retailer", () => {
  assert.equal(plansForMode(artifact("existing"), "all").length, 6);
  assert.throws(() => plansForMode(artifact("create"), "all"), /retailer already present/);
  const mixed = artifact("existing");
  mixed.plans[2].resolved_plan.retailer = { action: "create", values: { slug: "6-pack-supplements" } };
  assert.throws(() => plansForMode(mixed, "all"), /retailer already present/);
});

test("CLI confines execution evidence to tmp", () => {
  assert.throws(() => parseArgs([]), /Required --mode/);
  assert.throws(
    () => parseArgs(["--mode=all", "--artifact=a", "--csv=b", "--rollout=c", "--output=outside.json"]),
    /inside repository tmp/
  );
});
