const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildOfficialPlan, buildPlan, classifyProduct, explicitUnitIdentity, parseArgs, runCli, validatePlan } = require("./creatine-unit-identity");

function product(overrides = {}) {
  return { id: 86, name: "Example Creatine 240 caps", category: "Creatine", product_format: "capsule", unit_count: null, unit_type: null, is_active: true, merged_into_product_id: null, ...overrides };
}

test("unit parser accepts explicit counted identity and ignores serving or dosage numbers", () => {
  assert.deepEqual(explicitUnitIdentity("Creatine 240 caps"), { unit_count: 240, unit_type: "capsule" });
  assert.deepEqual(explicitUnitIdentity("Creatine 80 Gummies"), { unit_count: 80, unit_type: "gummy" });
  assert.equal(explicitUnitIdentity("Creatine 1250 40 Servings"), null);
});

test("classifier requires matching counted format, blank fields, and explicit name evidence", () => {
  assert.equal(classifyProduct(product()).eligible, true);
  for (const value of [product({ product_format: "powder" }), product({ unit_count: 240 }), product({ name: "Creatine 40 Servings" }), product({ name: "Creatine 90 Tablets" }), product({ is_active: false })]) assert.equal(classifyProduct(value).eligible, false);
});

test("plan is exact-scope and sealed", () => {
  const plan = buildPlan([product()], ["86"], "2026-08-11T12:00:00.000Z");
  assert.equal(plan.product_updates.length, 1); assert.equal(validatePlan(plan), plan);
  assert.throws(() => validatePlan({ ...plan, plan_fingerprint: "f".repeat(64) }), /fingerprint/);
  assert.throws(() => buildPlan([product()], ["86", "88"]), /not found/);
});

test("official evidence plan binds an owner-authorized value to an official domain", () => {
  const evidence = [{ product_id: "86", unit_count: 240, unit_type: "capsule", source_url: "https://manufacturer.example/product", official_domains: ["manufacturer.example"], evidence_type: "DIRECT", evidence_snippet: "Official label: 240 capsules.", owner_approved: true }];
  const plan = buildOfficialPlan([product({ name: "Example Creatine" })], evidence, "2026-08-11T12:00:00.000Z");
  assert.equal(validatePlan(plan), plan);
  assert.equal(plan.product_updates[0].changes.unit_count.after, 240);
  assert.throws(() => buildOfficialPlan([product()], [{ ...evidence[0], source_url: "https://retailer.example/product" }]), /outside official_domains/);
});

test("CLI requires exact IDs and explicit apply confirmation", () => {
  assert.deepEqual(parseArgs(["--mode=plan", "--product-ids=86"]), { mode: "plan", productIds: ["86"] });
  assert.throws(() => parseArgs(["--mode=plan"]), /exactly one of --product-ids or --input/);
  assert.deepEqual(parseArgs(["--mode=plan", "--input=tmp/evidence.json"]), { mode: "plan", input: "tmp/evidence.json" });
  assert.throws(() => parseArgs(["--mode=apply"]), /confirm-deterministic-creatine-unit-identity/);
});

test("dry plan and explicit apply use a sealed tmp artifact", async () => {
  const root = path.resolve(__dirname, "..");
  const planned = await runCli(["--mode=plan", "--product-ids=86"], { cwd: root, products: [product()], generatedAt: "2026-08-11T12:00:00.000Z" });
  const applied = await runCli(["--mode=apply", `--plan=${planned.plan}`, "--confirm-deterministic-creatine-unit-identity=true"], { cwd: root, appliedAt: "2026-08-11T13:00:00.000Z", applyPlan: async (plan) => plan.product_updates.map((row) => row.product_id) });
  assert.deepEqual(applied.changed_product_ids, ["86"]);
  fs.rmSync(path.resolve(root, planned.plan), { force: true }); fs.rmSync(path.resolve(root, applied.audit), { force: true });
});
