const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildPlan, classifyProduct, parseArgs, runCli, validatePlan } = require("./creatine-product-format");

function product(overrides = {}) {
  return {
    id: 81,
    name: "Example Creatine Powder 300g",
    category: "Creatine",
    product_format: null,
    net_weight_g: 300,
    is_active: true,
    merged_into_product_id: null,
    ...overrides,
  };
}

test("classifier accepts only active creatines with a blank deterministic format", () => {
  assert.deepEqual(classifyProduct(product()).suggestion.value, "powder");
  assert.deepEqual(classifyProduct(product({ name: "Example Creatine 120 Capsules", net_weight_g: null })).suggestion.value, "capsule");
  for (const value of [
    product({ product_format: "powder" }),
    product({ category: "Pre Workout" }),
    product({ is_active: false }),
    product({ merged_into_product_id: 2 }),
    product({ name: "Example Creatine", net_weight_g: null }),
  ]) assert.equal(classifyProduct(value).eligible, false);
});

test("plan is exact-scope, sealed, and refuses an ineligible requested product", () => {
  const plan = buildPlan([product()], ["81"], "2026-08-11T12:00:00.000Z");
  assert.equal(plan.product_updates.length, 1);
  assert.equal(validatePlan(plan), plan);
  assert.throws(() => validatePlan({ ...plan, plan_fingerprint: "f".repeat(64) }), /fingerprint/);
  assert.throws(() => buildPlan([product()], ["81", "84"]), /not found/);
  assert.throws(() => buildPlan([product({ product_format: "powder" })], ["81"]), /failed format eligibility/);
});

test("CLI requires exact IDs for plan and explicit apply confirmation", () => {
  assert.deepEqual(parseArgs(["--mode=plan", "--product-ids=81,85"]), { mode: "plan", productIds: ["81", "85"] });
  assert.throws(() => parseArgs(["--mode=plan"]), /requires --product-ids/);
  assert.throws(() => parseArgs(["--mode=apply"]), /confirm-deterministic-creatine-format/);
  assert.deepEqual(parseArgs(["--mode=apply", "--plan=tmp/p.json", "--confirm-deterministic-creatine-format=true"]), {
    mode: "apply", plan: "tmp/p.json", confirm: true,
  });
});

test("dry plan and explicit apply use only a sealed tmp artifact", async () => {
  const root = path.resolve(__dirname, "..");
  const planned = await runCli(["--mode=plan", "--product-ids=81"], {
    cwd: root,
    products: [product()],
    generatedAt: "2026-08-11T12:00:00.000Z",
  });
  assert.equal(planned.mode, "DRY_RUN_NO_DATABASE_WRITE");
  assert.equal(planned.planned_products, 1);
  const applied = await runCli(["--mode=apply", `--plan=${planned.plan}`, "--confirm-deterministic-creatine-format=true"], {
    cwd: root,
    appliedAt: "2026-08-11T13:00:00.000Z",
    applyPlan: async (plan) => plan.product_updates.map((row) => row.product_id),
  });
  assert.deepEqual(applied.changed_product_ids, ["81"]);
  fs.rmSync(path.resolve(root, planned.plan), { force: true });
  fs.rmSync(path.resolve(root, applied.audit), { force: true });
});
