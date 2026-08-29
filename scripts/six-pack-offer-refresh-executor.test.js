const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const { loadReviewedMassOosManifest } = require("./six-pack-offer-refresh");
const {
  executeApprovedPlans,
  executionCounts,
  parseArgs,
  validateArtifactScope,
} = require("./six-pack-offer-refresh-executor");

function artifact() {
  const createdAt = new Date().toISOString();
  const previousCheckedAt = new Date(Date.parse(createdAt) - 86400000).toISOString();
  const sourceHash = "a".repeat(64);
  return {
    environment_marker: "production",
    created_at: createdAt,
    blocked_rows: [],
    source_rows: manifest.rows.map((row, index) => ({
      row_number: String(index + 2),
      normalized_source_row: { source: { external_product_id: row.external_product_id, external_variant_id: row.external_variant_id } },
    })),
    plans: manifest.rows.map((row, index) => ({
      row_number: String(index + 2),
      resolved_plan: {
        meta: { operation_type: "verify_offer_no_change", source_captured_at: createdAt, source_snapshot_sha256: sourceHash },
        product: { action: "existing", id: row.canonical_product_id },
        product_variant: { action: "existing", id: row.canonical_variant_id },
        retailer: { action: "existing", id: "11" },
        retailer_product: { action: "noop", id: row.mapping_id },
        offer: { action: "verify_no_change", id: row.offer_id, values: { price: "10.00", shipping_cost: "4.99", total_price: "14.99", in_stock: true, url: "https://6pack-supplements.co.uk/product/test/", last_checked_at: createdAt } },
        price_history: { action: "noop" },
        expected_state: { offer: { price: "10.00", shipping_cost: "4.99", total_price: "14.99", in_stock: true, url: "https://6pack-supplements.co.uk/product/test/", last_checked_at: previousCheckedAt } },
      },
    })),
  };
}

function reviewedArtifact() {
  const value = artifact();
  const reviewed = loadReviewedMassOosManifest(
    "2026-08-11-whey-isolate-stock",
    manifest
  );
  value.run_id = `six-pack-reviewed-mass-oos-${reviewed.sha256}-fixture`;
  for (const reviewedRow of reviewed.manifest.rows) {
    const index = manifest.rows.findIndex((row) => row.offer_id === reviewedRow.offer_id);
    const plan = value.plans[index].resolved_plan;
    plan.meta.operation_type = "standard_import";
    plan.offer.action = "update";
    plan.offer.values.price = reviewedRow.new_price;
    plan.offer.values.shipping_cost = "4.99";
    plan.offer.values.total_price = "46.98";
    plan.offer.values.in_stock = false;
    plan.expected_state.offer.price = reviewedRow.old_price;
    plan.expected_state.offer.shipping_cost = "4.99";
    plan.expected_state.offer.total_price = "46.98";
    plan.expected_state.offer.in_stock = true;
  }
  return { value, reviewed };
}

test("executor accepts only the exact approved existing-offer scope", () => {
  assert.equal(validateArtifactScope(artifact(), manifest).length, manifest.rows.length);
  const changed = artifact();
  changed.plans[0].resolved_plan.product.id = "999";
  assert.throws(() => validateArtifactScope(changed, manifest), /Unsafe or mismatched/);
});

test("executor accepts a unique safe subset from the immutable manifest", () => {
  const subset = artifact();
  subset.plans = subset.plans.slice(0, 25);
  subset.source_rows = subset.source_rows.slice(0, 25);
  assert.equal(validateArtifactScope(subset, manifest).length, 25);

  subset.plans[0].resolved_plan.product.id = "999";
  assert.throws(() => validateArtifactScope(subset, manifest), /Unsafe or mismatched/);
});

test("full approved freshness plan executes every one of the 506 verified rows", async () => {
  const plans = validateArtifactScope(artifact(), manifest);
  const executed = await executeApprovedPlans(plans, async (entry) => ({
    row_number: entry.row_number,
    operation_type: entry.operation_type,
  }));

  assert.deepEqual(executionCounts(plans, executed), {
    verified_plan_count: manifest.approved_mapping_count,
    executed_plan_count: manifest.approved_mapping_count,
  });
});

test("6 Pack verified no-change contract permits only a newer last_checked_at", () => {
  const valid = artifact();
  assert.equal(validateArtifactScope(valid, manifest).length, 506);
  const before = valid.plans[0].resolved_plan.expected_state.offer;
  const after = valid.plans[0].resolved_plan.offer.values;
  assert.deepEqual(
    { ...after, last_checked_at: undefined },
    { ...before, last_checked_at: undefined }
  );
  assert.notEqual(after.last_checked_at, before.last_checked_at);

  for (const [field, value] of [
    ["price", "11.00"],
    ["shipping_cost", "0.00"],
    ["total_price", "15.99"],
    ["in_stock", false],
    ["url", "https://6pack-supplements.co.uk/product/changed/"],
  ]) {
    const changed = artifact();
    changed.plans[0].resolved_plan.offer.values[field] = value;
    assert.throws(() => validateArtifactScope(changed, manifest));
  }

  const mappingChange = artifact();
  mappingChange.plans[0].resolved_plan.retailer_product.action = "update";
  assert.throws(
    () => validateArtifactScope(mappingChange, manifest),
    /may update only last_checked_at/
  );

  const historyChange = artifact();
  historyChange.plans[0].resolved_plan.price_history.action = "create";
  assert.throws(() => validateArtifactScope(historyChange, manifest));

  const unchangedTimestamp = artifact();
  unchangedTimestamp.plans[0].resolved_plan.offer.values.last_checked_at =
    unchangedTimestamp.plans[0].resolved_plan.expected_state.offer.last_checked_at;
  assert.throws(
    () => validateArtifactScope(unchangedTimestamp, manifest),
    /may update only last_checked_at/
  );
});

test("executor independently accepts only the exact selected two-row MASS_OOS artifact", () => {
  const { value, reviewed } = reviewedArtifact();
  assert.throws(() => validateArtifactScope(value, manifest), /independent execution guardrails/);
  assert.equal(validateArtifactScope(value, manifest, reviewed).length, manifest.rows.length);

  const extra = reviewedArtifact();
  extra.value.plans[0].resolved_plan.meta.operation_type = "standard_import";
  extra.value.plans[0].resolved_plan.offer.action = "update";
  extra.value.plans[0].resolved_plan.offer.values.in_stock = false;
  assert.throws(
    () => validateArtifactScope(extra.value, manifest, extra.reviewed),
    /changed row scope drift/
  );

  const wrongSelector = reviewedArtifact();
  wrongSelector.value.run_id = "six-pack-refresh-unreviewed";
  assert.throws(
    () => validateArtifactScope(wrongSelector.value, manifest, wrongSelector.reviewed),
    /selector or manifest binding mismatch/
  );
});

test("executor CLI preserves the exact reviewed selector and rejects unknown selectors", () => {
  const selected = parseArgs([
    "--artifact=tmp/preflight.json",
    "--output=tmp/execution.json",
    "--reviewed-mass-oos=2026-08-11-whey-isolate-stock",
  ]);
  assert.equal(selected.reviewedMassOosSelector, "2026-08-11-whey-isolate-stock");
  assert.equal(selected["reviewed-mass-oos"], "2026-08-11-whey-isolate-stock");
  assert.throws(
    () => parseArgs([
      "--artifact=tmp/preflight.json",
      "--output=tmp/execution.json",
      "--reviewed-mass-oos=unknown",
    ]),
    /Unknown reviewed MASS_OOS selector/
  );
});

test("scheduled workflow always preflights, applies through split roles and verifies idempotency", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "six-pack-offer-refresh.yml"), "utf8");
  assert.match(workflow, /cron: "17 3 \* \* \*"/);
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.match(workflow, /operation:[\s\S]*?default: dry-run[\s\S]*?type: choice[\s\S]*?options:[\s\S]*?- dry-run/);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.doesNotMatch(workflow, /github\.event_name == 'push'|\bpush\|schedule\b/);
  const applyStep = workflow.match(/- name: Apply exact approved manifest[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.match(applyStep, /if: \$\{\{ github\.event_name == 'schedule' \|\| inputs\.operation == 'apply' \|\| inputs\.operation == 'reviewed-mass-oos-apply' \}\}/);
  assert.doesNotMatch(applyStep, /inputs\.operation == 'dry-run'|github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /Fresh live-source dry-run/);
  assert.match(workflow, /SIX_PACK_SYNC_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /SIX_PACK_SYNC_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /--require-no-change=true/);
  assert.equal((workflow.match(/--isolate-unsafe=true/g) || []).length, 2);
  assert.match(workflow, /name: Upload refresh evidence[\s\S]*?if: always\(\)[\s\S]*?tmp\/six-pack-offer-refresh\/\*\.json/);
  const testsStep = workflow.match(/- name: Test 6 Pack refresh contracts[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.doesNotMatch(testsStep, /SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/);
});

test("reviewed MASS_OOS selector is manual-only and apply needs the exact apply operation", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "six-pack-offer-refresh.yml"), "utf8");
  assert.match(workflow, /reviewed-mass-oos-dry-run\|reviewed-mass-oos-apply\)[\s\S]*reviewed_args\+=\(--reviewed-mass-oos=2026-08-11-whey-isolate-stock\)/);
  assert.match(workflow, /if \[ "\$OPERATION" = "reviewed-mass-oos-apply" \]; then[\s\S]*reviewed_args\+=\(--reviewed-mass-oos=2026-08-11-whey-isolate-stock\)/);
  assert.match(workflow, /inputs\.operation == 'reviewed-mass-oos-apply'/);
  assert.doesNotMatch(workflow, /github\.event_name == 'push'[^\n]*reviewed-mass-oos-dry-run/);
  assert.doesNotMatch(workflow, /github\.event_name == 'schedule'[^\n]*reviewed-mass-oos-dry-run/);
});

test("executor reuses role connections and executes all approved plans", () => {
  const source = fs.readFileSync(path.join(__dirname, "six-pack-offer-refresh-executor.js"), "utf8");
  assert.match(source, /clients\.approver = await openRoleClient\("approver"\)/);
  assert.match(source, /clients\.executor = await openRoleClient\("executor"\)/);
  assert.doesNotMatch(source, /skipped_verified_no_change_count|executablePlans/);
  assert.match(source, /const rows = await executeApprovedPlans\(plans/);
  assert.match(source, /if \(rows\.length !== plans\.length\) fail\("Verified and executed plan counts differ"\)/);
  assert.match(source, /Promise\.allSettled\(Object\.values\(clients\)\.map\(\(client\) => client\.end\(\)\)\)/);
  assert.doesNotMatch(source, /async function roleCall/);
});
