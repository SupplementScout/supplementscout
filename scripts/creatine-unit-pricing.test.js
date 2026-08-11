const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildPlan, classifyProduct, parseArgs, runCli, validatePlan } = require("./creatine-unit-pricing");

function product(overrides = {}) {
  return {
    id: 790, name: "Per4m Creatine Sherbet 310g", category: "Creatine", product_format: "powder",
    net_weight_g: 310, serving_count_verified: 100, serving_size_g: 3.1, creatine_per_serving_g: 2.5,
    nutrition_verified: true, unit_pricing_verified: false, is_active: true, merged_into_product_id: null,
    ...overrides,
  };
}

test("classifier promotes complete verified creatine powders and counted formats", () => {
  assert.equal(classifyProduct(product()).eligible, true);
  assert.equal(classifyProduct(product({
    product_format: "capsule", net_weight_g: null, serving_size_g: null,
    unit_count: 120, unit_type: "capsule", serving_count_verified: 30,
  })).eligible, true);
  for (const value of [
    product({ category: "Pre Workout" }),
    product({ nutrition_verified: false }),
    product({ product_format: "capsule", net_weight_g: null, serving_size_g: null }),
    product({ product_format: "capsule", net_weight_g: null, serving_size_g: null, unit_count: 120, unit_type: "tablet" }),
    product({ product_format: "capsule", net_weight_g: null, serving_size_g: null, unit_count: 20, unit_type: "capsule", serving_count_verified: 30 }),
    product({ net_weight_g: null }),
    product({ serving_count_verified: 20.5 }),
    product({ creatine_per_serving_g: 3.2 }),
    product({ net_weight_g: 250, serving_count_verified: 66, serving_size_g: 5, creatine_per_serving_g: 5 }),
    product({ unit_pricing_verified: true }),
  ]) assert.equal(classifyProduct(value).eligible, false);
});

test("plan is fingerprinted and tampering fails closed", () => {
  const plan = buildPlan([product()], "2026-08-11T12:00:00.000Z");
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.equal(plan.product_updates.length, 1);
  assert.equal(validatePlan(plan), plan);
  assert.throws(() => validatePlan({ ...plan, plan_fingerprint: "f".repeat(64) }), /fingerprint/);
});

test("CLI requires explicit apply confirmation", () => {
  assert.deepEqual(parseArgs(["--mode=plan"]), { mode: "plan" });
  assert.deepEqual(parseArgs(["--mode=plan", "--product-ids=790,849"]), {
    mode: "plan", productIds: ["790", "849"],
  });
  assert.throws(() => parseArgs(["--mode=plan", "--product-ids=790,790"]), /unique/);
  assert.throws(() => parseArgs(["--mode=apply"]), /confirm-reviewed-unit-pricing/);
  assert.deepEqual(parseArgs(["--mode=apply", "--plan=tmp/p.json", "--confirm-reviewed-unit-pricing=true"]), {
    mode: "apply", plan: "tmp/p.json", confirm: true,
  });
});

test("requested product IDs constrain the sealed plan", () => {
  const plan = buildPlan([product(), product({ id: 849, name: "Efectiv Creatine 300g", net_weight_g: 300, serving_count_verified: 30, serving_size_g: 10, creatine_per_serving_g: 5 })],
    "2026-08-11T12:00:00.000Z", ["790"]);
  assert.deepEqual(plan.product_updates.map((row) => row.product_id), ["790"]);
  assert.deepEqual(plan.eligibility.requested_product_ids, ["790"]);
  assert.equal(validatePlan(plan), plan);
});

test("dry plan and explicit apply only use a sealed tmp artifact", async () => {
  const root = path.resolve(__dirname, "..");
  const planned = await runCli(["--mode=plan"], {
    cwd: root, products: [product()], generatedAt: "2026-08-11T12:00:00.000Z",
  });
  assert.equal(planned.mode, "DRY_RUN_NO_DATABASE_WRITE");
  assert.equal(planned.planned_products, 1);
  const applied = await runCli(["--mode=apply", `--plan=${planned.plan}`, "--confirm-reviewed-unit-pricing=true"], {
    cwd: root, appliedAt: "2026-08-11T13:00:00.000Z", applyPlan: async (plan) => plan.product_updates.map((row) => row.product_id),
  });
  assert.deepEqual(applied.changed_product_ids, ["790"]);
  fs.rmSync(path.resolve(root, planned.plan), { force: true });
  fs.rmSync(path.resolve(root, applied.audit), { force: true });
});
