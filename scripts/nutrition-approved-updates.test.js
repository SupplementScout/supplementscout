const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildApprovedPlan, validatePlan } = require("./lib/nutrition-approved-updates");
const planner = require("./nutrition-approved-plan");
const apply = require("./nutrition-approved-apply");

const root = path.resolve(__dirname, "..");
const runId = "NCR1-approved-test";

function candidate(overrides = {}) {
  return {
    id: "1",
    product_id: "337",
    proposed_field: "serving_size_g",
    proposed_value: 5,
    proposed_unit: "g",
    confidence: "LOW",
    source_url: "https://manufacturer.example/products/creatine",
    evidence_snippet: "Serving Size: 1 Scoop (5g)",
    source_locator: "ocr:line:1",
    warning_flags: ["OCR_ONLY"],
    status: "approved",
    run_id: runId,
    candidate_fingerprint: "a".repeat(64),
    ...overrides,
  };
}

test("approved planner creates before/after product-only changes", () => {
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.deepEqual(plan.product_updates[0].changes.serving_size_g.before, null);
  assert.equal(plan.product_updates[0].changes.serving_size_g.after, 5);
  assert.equal(validatePlan(plan), plan);
  assert.equal(plan.database_writes, 0);
});

test("planner blocks unmapped, unsafe and conflicting approved candidates", () => {
  const cases = [
    [candidate({ product_id: null }), "NEEDS_PRODUCT_MAPPING"],
    [candidate({ warning_flags: ["OCR_HTML_CONFLICT"] }), "UNSAFE_WARNING_FLAG"],
    [[candidate(), candidate({ id: "2", proposed_value: 10, candidate_fingerprint: "b".repeat(64) })], "CONFLICTING_APPROVED_VALUES"],
  ];
  for (const [value, code] of cases) {
    const candidates = Array.isArray(value) ? value : [value];
    const plan = buildApprovedPlan(candidates, [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
    assert.equal(plan.status, "BLOCKED");
    assert.ok(plan.blockers.some((blocker) => blocker.code === code));
    assert.throws(() => validatePlan(plan), /invalid or blocked/);
  }
});

test("planner reads approved candidates and writes a dry plan only under tmp", async () => {
  const directory = fs.mkdtempSync(path.join(root, "tmp", "approved-plan-test-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const result = await planner.runCli([`--run-id=${runId}`], {
    cwd: root,
    generatedAt: "2026-08-02T12:00:00.000Z",
    loadCandidates: async () => [candidate()],
    loadProducts: async () => [{ id: "337", name: "Creatine", serving_size_g: null }],
  });
  assert.equal(result.mode, "DRY_RUN_NO_DATABASE_WRITE");
  assert.equal(result.status, "READY_FOR_EXPLICIT_APPLY");
  assert.ok(result.plan.startsWith("tmp/nutrition-approved-plan/"));
  fs.rmSync(path.resolve(root, result.plan), { force: true });
});

test("apply requires explicit confirmation and rechecks approval before product-only update", async () => {
  assert.throws(() => apply.parseArgs(["--plan=tmp/a.json"]), /confirm-reviewed-product-update/);
  assert.throws(() => apply.parseArgs(["--plan=tmp/a.json", "--confirm-reviewed-product-update=true", "--apply-all"]), /Unknown option/);
  const directory = fs.mkdtempSync(path.join(root, "tmp", "approved-apply-test-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  const planPath = path.join(directory, "plan.json");
  fs.writeFileSync(planPath, JSON.stringify(plan));
  const updates = [];
  const result = await apply.runCli([
    `--plan=${path.relative(root, planPath)}`,
    "--confirm-reviewed-product-update=true",
  ], {
    cwd: root,
    appliedAt: "2026-08-02T13:00:00.000Z",
    applyTransaction: async (appliedPlan) => {
      updates.push(appliedPlan.product_updates[0]);
      return [{ product_id: "337", fields: ["serving_size_g"] }];
    },
  });
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0].changes), ["serving_size_g"]);
  assert.equal(result.changed_products[0].product_id, "337");
  assert.ok(result.audit.startsWith("tmp/"));
});

test("apply verification refuses pending candidates and stale product values", () => {
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  assert.throws(() => apply.verifyCandidates(plan, [candidate({ status: "pending" })]), /changed after plan generation/);
  assert.throws(() => apply.verifyProducts(plan, [{ id: "337", serving_size_g: 10 }]), /changed after plan generation/);
});

test("production apply uses one transaction and only updates whitelisted products fields", async () => {
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  const queries = [];
  const client = {
    async query(sql, values) {
      const compact = String(sql).replace(/\s+/g, " ").trim();
      queries.push({ sql: compact, values });
      if (compact.startsWith("select current_user")) return { rows: [{ current_user: "postgres", safe_update: null }] };
      if (compact.includes("retailer_catalogue_actual_database_target")) return { rows: [{ target: { target_environment: "PRODUCTION", project_ref: "aftboxmrdgyhizicfsfu", database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu" } }] };
      if (compact.includes("from public.nutrition_candidates")) return { rows: [candidate()] };
      if (compact.includes("from public.products")) return { rows: [{ id: "337", serving_size_g: null }] };
      if (compact.startsWith("update public.products")) return { rowCount: 1, rows: [{ id: "337" }] };
      return { rows: [] };
    },
  };
  const changed = await apply.applyTransaction(plan, {
    client,
    environment: {
      SUPPLEMENTSCOUT_PRODUCTION_PROJECT_REF: "aftboxmrdgyhizicfsfu",
      SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL: "redacted",
    },
  });
  assert.deepEqual(changed, [{ product_id: "337", fields: ["serving_size_g"] }]);
  assert.ok(queries.some((query) => query.sql === "commit"));
  const update = queries.find((query) => query.sql.startsWith("update public.products"));
  assert.match(update.sql, /^update public\.products set "serving_size_g"=\$1 where id=\$2 returning id$/);
  assert.doesNotMatch(queries.map((query) => query.sql).join("\n"), /update public\.(?:offers|retailer_products|nutrition_candidates)/);
});
