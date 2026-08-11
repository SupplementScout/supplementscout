const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const { loadReviewedMassOosManifest } = require("./six-pack-offer-refresh");
const { parseArgs, validateArtifactScope } = require("./six-pack-offer-refresh-executor");

function artifact() {
  const createdAt = new Date().toISOString();
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
        expected_state: { offer: { price: "10.00", shipping_cost: "4.99", total_price: "14.99", in_stock: true, url: "https://6pack-supplements.co.uk/product/test/" } },
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
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.doesNotMatch(workflow, /github\.event_name == 'push'|\bpush\|schedule\b/);
  assert.match(workflow, /github\.event_name == 'schedule' \|\| inputs\.operation == 'apply' \|\| inputs\.operation == 'reviewed-mass-oos-apply'/);
  assert.match(workflow, /Fresh live-source dry-run/);
  assert.match(workflow, /SIX_PACK_SYNC_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /SIX_PACK_SYNC_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /--require-no-change=true/);
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

test("executor reuses one approver and one executor connection for the whole manifest", () => {
  const source = fs.readFileSync(path.join(__dirname, "six-pack-offer-refresh-executor.js"), "utf8");
  assert.match(source, /clients\.approver = await openRoleClient\("approver"\)/);
  assert.match(source, /clients\.executor = await openRoleClient\("executor"\)/);
  assert.match(source, /for \(const entry of plans\) rows\.push\(await executeEntry\(entry, loaded\.artifactSha256, loaded\.artifact\.run_id, clients, approvalReason\)\)/);
  assert.match(source, /Promise\.allSettled\(Object\.values\(clients\)\.map\(\(client\) => client\.end\(\)\)\)/);
  assert.doesNotMatch(source, /async function roleCall/);
});
