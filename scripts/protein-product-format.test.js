const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildPlan, classifyProduct, parseArgs, runCli, validatePlan } = require("./protein-product-format");

function product(overrides = {}) {
  return {
    id: 16,
    name: "Example Whey 2.5kg",
    category: "Whey Protein",
    product_format: null,
    net_weight_g: 2500,
    is_active: true,
    merged_into_product_id: null,
    ...overrides,
  };
}

test("classifier only suggests powder for active gram-based protein powder identities", () => {
  assert.equal(classifyProduct(product()).eligible, true);
  for (const value of [
    product({ product_format: "powder" }),
    product({ net_weight_g: null }),
    product({ category: "Protein Bars" }),
    product({ is_active: false }),
    product({ merged_into_product_id: 2 }),
    product({ name: "Axe & Sledge DemoDay Powder 930g" }),
  ]) assert.equal(classifyProduct(value).eligible, false);
});

test("plan is sealed and refuses tampering", () => {
  const plan = buildPlan([product()], "2026-08-11T12:00:00.000Z");
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.equal(plan.product_updates.length, 1);
  assert.equal(validatePlan(plan), plan);
  assert.throws(() => validatePlan({ ...plan, plan_fingerprint: "f".repeat(64) }), /fingerprint/);
});

test("CLI requires explicit apply confirmation", () => {
  assert.deepEqual(parseArgs(["--mode=plan"]), { mode: "plan" });
  assert.throws(() => parseArgs(["--mode=apply"]), /confirm-deterministic-protein-format/);
  assert.deepEqual(parseArgs(["--mode=apply", "--plan=tmp/p.json", "--confirm-deterministic-protein-format=true"]), {
    mode: "apply", plan: "tmp/p.json", confirm: true,
  });
});

test("dry plan and explicit apply use only a sealed tmp artifact", async () => {
  const root = path.resolve(__dirname, "..");
  const planned = await runCli(["--mode=plan"], {
    cwd: root,
    products: [product()],
    generatedAt: "2026-08-11T12:00:00.000Z",
  });
  assert.equal(planned.mode, "DRY_RUN_NO_DATABASE_WRITE");
  assert.equal(planned.planned_products, 1);
  const applied = await runCli(["--mode=apply", `--plan=${planned.plan}`, "--confirm-deterministic-protein-format=true"], {
    cwd: root,
    appliedAt: "2026-08-11T13:00:00.000Z",
    applyPlan: async (plan) => plan.product_updates.map((row) => row.product_id),
  });
  assert.equal(applied.changed_products, 1);
  fs.rmSync(path.resolve(root, planned.plan), { force: true });
  fs.rmSync(path.resolve(root, applied.audit), { force: true });
});
