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
  const result = {
    id: "1",
    product_id: "337",
    proposed_field: "serving_size_g",
    proposed_value: 5,
    approved_value: 5,
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
  if (Object.prototype.hasOwnProperty.call(overrides, "proposed_value") &&
      !Object.prototype.hasOwnProperty.call(overrides, "approved_value")) {
    result.approved_value = result.proposed_value;
  }
  return result;
}

test("approved planner creates before/after product-only changes", () => {
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.deepEqual(plan.product_updates[0].changes.serving_size_g.before, null);
  assert.equal(plan.product_updates[0].changes.serving_size_g.after, 5);
  assert.equal(validatePlan(plan), plan);
  assert.equal(plan.database_writes, 0);
});

test("approved protein or creatine derives nutrition verification from reviewed evidence", () => {
  const protein = candidate({
    proposed_field: "protein_per_serving_g",
    proposed_value: 20,
    proposed_unit: "g",
  });
  const plan = buildApprovedPlan(
    [protein],
    [{ id: "337", name: "Whey", protein_per_serving_g: null, nutrition_verified: false }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.product_updates[0].changes.protein_per_serving_g.after, 20);
  const verification = plan.product_updates[0].changes.nutrition_verified;
  assert.equal(verification.before, false);
  assert.equal(verification.after, true);
  assert.equal(verification.no_change, false);
  assert.equal(verification.derived_from_reviewed_nutrition, true);
  assert.equal(verification.evidence[0].candidate_id, "1");
  assert.equal(verification.evidence[0].source_field, "protein_per_serving_g");
  assert.equal(verification.evidence[0].source_value, 20);
  assert.equal(validatePlan(plan), plan);
});

test("serving facts alone never derive nutrition verification", () => {
  const plan = buildApprovedPlan(
    [candidate()],
    [{ id: "337", name: "Creatine", serving_size_g: null, nutrition_verified: false }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal("nutrition_verified" in plan.product_updates[0].changes, false);
});

test("planner uses the explicit owner-approved value instead of the extracted proposal", () => {
  const plan = buildApprovedPlan(
    [candidate({ proposed_field: "serving_count_verified", proposed_value: 28, approved_value: 14, proposed_unit: "count" })],
    [{ id: "337", name: "Whey 400g", net_weight_g: 400, serving_size_g: 28, serving_count_verified: null }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.status, "READY_FOR_EXPLICIT_APPLY");
  const change = plan.product_updates[0].changes.serving_count_verified;
  assert.equal(change.after, 14);
  assert.equal(change.evidence[0].proposed_value, 28);
  assert.equal(change.evidence[0].source_value, 14);
  assert.equal(change.evidence[0].owner_corrected, true);
});

test("planner blocks impossible package arithmetic", () => {
  const plan = buildApprovedPlan(
    [candidate({ proposed_field: "serving_count_verified", proposed_value: 28, approved_value: 28, proposed_unit: "count" })],
    [{ id: "337", name: "Whey 400g", net_weight_g: 400, serving_size_g: 28, serving_count_verified: null }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.status, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PACKAGE_SERVING_MISMATCH"));
});

test("planner blocks even a one-serving overstatement beyond rounding tolerance", () => {
  const plan = buildApprovedPlan(
    [candidate({ proposed_field: "serving_count_verified", proposed_value: 15, approved_value: 15, proposed_unit: "count" })],
    [{ id: "337", name: "Whey 400g", net_weight_g: 400, serving_size_g: 28, serving_count_verified: null }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.status, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PACKAGE_SERVING_MISMATCH"));
});

test("planner accepts only whole verified serving counts", () => {
  const plan = buildApprovedPlan(
    [candidate({ proposed_field: "serving_count_verified", proposed_value: 14.5, approved_value: 14.5, proposed_unit: "count" })],
    [{ id: "337", name: "Whey 400g", net_weight_g: 400, serving_size_g: 28, serving_count_verified: null }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.status, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "SERVING_COUNT_MUST_BE_INTEGER"));
});

test("planner blocks overwriting an existing pack size", () => {
  const plan = buildApprovedPlan(
    [candidate({ proposed_field: "net_weight_g", proposed_value: 850, approved_value: 850 })],
    [{ id: "337", name: "Whey 1kg", net_weight_g: 1000 }],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(plan.status, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PACK_SIZE_CHANGE_REQUIRES_VARIANT_TRANSITION"));
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
  const result = await planner.runCli([`--run-id=${runId}`, "--candidate-ids=1"], {
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

test("planner requires an exact reviewed candidate subset", async () => {
  assert.throws(() => planner.parseArgs([`--run-id=${runId}`]), /Choose exactly one/);
  assert.throws(() => planner.parseArgs([`--run-id=${runId}`, "--candidate-ids=1,1"]), /unique/);
  assert.throws(() => planner.parseArgs([
    `--run-id=${runId}`, "--candidate-ids=1", "--safe-approved-for-run=true",
  ]), /Choose exactly one/);
  assert.deepEqual(planner.parseArgs([`--run-id=${runId}`, "--candidate-ids=2,1"]), {
    runId,
    candidateIds: ["2", "1"],
  });
  assert.deepEqual(planner.parseArgs([`--run-id=${runId}`, "--safe-approved-for-run=true"]), {
    runId,
    safeApprovedForRun: true,
  });
  await assert.rejects(
    planner.runCli([`--run-id=${runId}`, "--candidate-ids=1,2"], {
      loadCandidates: async () => [candidate()],
      loadProducts: async () => [{ id: "337", name: "Creatine", serving_size_g: null }],
    }),
    /absent, unapproved, or outside/,
  );
});

test("safe run planner excludes an entire blocked product and reports it", () => {
  const safe = candidate({ id: "1", product_id: "337" });
  const unsafe = candidate({
    id: "2", product_id: "338", warning_flags: ["PACKAGE_SERVING_MISMATCH"],
    candidate_fingerprint: "b".repeat(64),
  });
  const result = planner.buildSafeApprovedPlan(
    [safe, unsafe],
    [
      { id: "337", name: "Safe", serving_size_g: null },
      { id: "338", name: "Unsafe", serving_size_g: null },
    ],
    runId,
    "2026-08-02T12:00:00.000Z",
  );
  assert.equal(result.plan.status, "READY_FOR_EXPLICIT_APPLY");
  assert.deepEqual(result.plan.source_candidate_ids, ["1"]);
  assert.deepEqual(result.excludedCandidates, [
    { candidate_id: "2", reason: "UNSAFE_WARNING_FLAG" },
  ]);
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

test("v1 plans are invalidated so old plans cannot bypass pack guards", () => {
  const plan = buildApprovedPlan([candidate()], [{ id: "337", name: "Creatine", serving_size_g: null }], runId, "2026-08-02T12:00:00.000Z");
  assert.throws(() => validatePlan({ ...plan, schema_version: 1 }), /invalid or blocked/);
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
