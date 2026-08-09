const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildPlan, classifyProduct, parseArgs, runCli, validatePlan } = require("./protein-unit-pricing");

function product(overrides = {}) {
  return {
    id: 510, name: "Example Whey 600g", category: "Whey Protein", product_format: "powder",
    net_weight_g: 600, serving_count_verified: 20, serving_size_g: 30, protein_per_serving_g: 24,
    nutrition_verified: true, unit_pricing_verified: false, is_active: true, merged_into_product_id: null,
    ...overrides,
  };
}

test("classifier promotes only complete verified mass-priced protein products", () => {
  assert.equal(classifyProduct(product()).eligible, true);
  for (const value of [
    product({ nutrition_verified: false }),
    product({ product_format: "liquid" }),
    product({ net_weight_g: null }),
    product({ serving_count_verified: 20.5 }),
    product({ protein_per_serving_g: 31 }),
    product({ net_weight_g: 400, serving_count_verified: 20, serving_size_g: 30 }),
    product({ unit_pricing_verified: true }),
    product({ name: "Axe & Sledge DemoDay Powder 930g" }),
  ]) assert.equal(classifyProduct(value).eligible, false);
});

test("plan is fingerprinted and tampering fails closed", () => {
  const plan = buildPlan([product()], "2026-08-09T12:00:00.000Z");
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.equal(plan.product_updates.length, 1);
  assert.equal(validatePlan(plan), plan);
  assert.throws(() => validatePlan({ ...plan, plan_fingerprint: "f".repeat(64) }), /fingerprint/);
});

test("CLI requires an explicit apply confirmation", () => {
  assert.deepEqual(parseArgs(["--mode=plan"]), { mode: "plan" });
  assert.throws(() => parseArgs(["--mode=apply"]), /confirm-reviewed-unit-pricing/);
  assert.deepEqual(parseArgs(["--mode=apply", "--plan=tmp/p.json", "--confirm-reviewed-unit-pricing=true"]), {
    mode: "apply", plan: "tmp/p.json", confirm: true,
  });
});

test("dry plan and explicit apply only use a sealed tmp artifact", async () => {
  const root = path.resolve(__dirname, "..");
  const planned = await runCli(["--mode=plan"], {
    cwd: root, products: [product()], generatedAt: "2026-08-09T12:00:00.000Z",
  });
  assert.equal(planned.mode, "DRY_RUN_NO_DATABASE_WRITE");
  assert.equal(planned.planned_products, 1);
  const applied = await runCli(["--mode=apply", `--plan=${planned.plan}`, "--confirm-reviewed-unit-pricing=true"], {
    cwd: root, appliedAt: "2026-08-09T13:00:00.000Z", applyPlan: async (plan) => plan.product_updates.map((row) => row.product_id),
  });
  assert.equal(applied.changed_products, 1);
  fs.rmSync(path.resolve(root, planned.plan), { force: true });
  fs.rmSync(path.resolve(root, applied.audit), { force: true });
});
