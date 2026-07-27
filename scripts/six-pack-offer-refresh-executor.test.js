const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const { validateArtifactScope } = require("./six-pack-offer-refresh-executor");

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

test("executor accepts only the exact approved existing-offer scope", () => {
  assert.equal(validateArtifactScope(artifact(), manifest).length, manifest.rows.length);
  const changed = artifact();
  changed.plans[0].resolved_plan.product.id = "999";
  assert.throws(() => validateArtifactScope(changed, manifest), /Unsafe or mismatched/);
});

test("scheduled workflow always preflights, applies through split roles and verifies idempotency", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "six-pack-offer-refresh.yml"), "utf8");
  assert.match(workflow, /cron: "17 3 \* \* \*"/);
  assert.match(workflow, /Fresh live-source dry-run/);
  assert.match(workflow, /SIX_PACK_SYNC_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /SIX_PACK_SYNC_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /--require-no-change=true/);
  const testsStep = workflow.match(/- name: Test 6 Pack refresh contracts[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.doesNotMatch(testsStep, /SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/);
});
