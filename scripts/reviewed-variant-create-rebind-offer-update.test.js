const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { canonicalJson } = require("./lib/canonical-json");
const {
  APPROVAL_TYPE,
  OPERATION_TYPE,
  buildReviewedVariantCreateRebindPlan,
} = require("./lib/reviewed-variant-create-rebind-offer-update");
const { approveArtifactPlan, loadDryRunArtifact, planFingerprint, setSupabaseForTests, writeDryRunArtifact } = require("./import-products");

function fixture() {
  const state = {
    product: { id: 69, name: "Efectiv Nutrition Vegan Protein 908g", slug: "efectiv-nutrition-vegan-protein-908g", brand: "Efectiv", category: "Whey Protein", net_weight_g: 900, product_format: "powder", is_active: true, merged_into_product_id: null },
    variant: { id: 64, product_id: 69, variant_key: "default", display_name: "Default", flavour_code: null, flavour_label: null, size_value: null, size_unit: null, pack_count: null, product_format: null, gtin: null, is_active: true, is_default: true },
    retailer: { id: 3, name: "Whey Okay", slug: "whey-okay", website: "https://wheyokay.com" },
    mapping: { id: 65, retailer_id: 3, product_id: 69, product_variant_id: 64, external_product_id: null, external_variant_id: null, external_sku: null, external_options: null, external_name: "Efectiv Nutrition Vegan Protein 908g", external_slug: "efectiv-nutrition-vegan-protein-908g", external_gtin: null, external_url: "https://wheyokay.com/efectiv-nutrition-vegan-protein-908g-300-p.asp", match_method: "existing_offer", match_confidence: 100, updated_at: "2026-06-30T19:40:13.950723Z" },
    offer: { id: 73, product_id: 69, retailer_id: 3, product_variant_id: 64, retailer_product_id: 65, price: 24.99, shipping_cost: 3.99, total_price: null, in_stock: false, url: "https://wheyokay.com/efectiv-nutrition-vegan-protein-908g-300-p.asp", last_checked_at: "2026-06-29T12:32:18.530Z" },
  };
  const source = { external_product_id: "300", external_variant_id: "301", title: "Efectiv Nutrition Vegan Protein 908g - Biscuit Spread", flavour: "Biscuit Spread", weight_value: "908", weight_unit: "g", price: "22.70", shipping_cost: "3.99", in_stock: true, url: state.offer.url, source_url: `${state.offer.url}?_=&variantid=301`, gtin: null, mpn: null };
  const captures = [
    { captured_at: "2026-09-01T12:00:00.000Z", semantic_fingerprint: "a".repeat(64) },
    { captured_at: "2026-09-01T12:00:01.000Z", semantic_fingerprint: "a".repeat(64) },
  ];
  return { state, source, captures, expiresAt: "2026-09-01T12:15:00.000Z" };
}

test("builds the exact atomic create/rebind/commercial reviewed plan", () => {
  const plan = buildReviewedVariantCreateRebindPlan(fixture());
  assert.equal(plan.meta.operation_type, OPERATION_TYPE);
  assert.equal(plan.meta.version, "3");
  assert.match(plan.meta.source_row_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(plan.meta.plan_fingerprint, /^[0-9a-f]{32}$/);
  assert.match(plan.meta.approval_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(plan.meta.idempotency_key, /^[0-9a-f]{64}$/);
  assert.equal(plan.product.action, "existing");
  assert.equal(plan.product.id, "69");
  assert.deepEqual(plan.product_variant.values, {
    variant_key: "biscuit-spread-908g", display_name: "Biscuit Spread / 908g",
    flavour_code: "biscuit-spread", flavour_label: "Biscuit Spread", size_value: "908",
    size_unit: "g", pack_count: "1", product_format: "powder",
  });
  assert.equal(plan.retailer_product.action, "update");
  assert.equal(plan.retailer_product.id, "65");
  assert.equal(plan.retailer_product.values.product_variant_id, null);
  assert.equal(plan.offer.action, "update");
  assert.equal(plan.offer.id, "73");
  assert.deepEqual(plan.offer.values, { product_variant_id: null, price: "22.70", shipping_cost: "3.99", total_price: "26.69", in_stock: true, url: fixture().state.offer.url, last_checked_at: "2026-09-01T12:00:01.000Z" });
  assert.equal(plan.price_history.action, "create");
  assert.equal(plan.approval.approval_type, APPROVAL_TYPE);
  assert.equal(plan.expected_state.product.net_weight_g, "900");
  assert.equal(plan.expected_deltas.row_count_deltas.product_variants, "1");
  assert.equal(plan.expected_deltas.row_count_deltas.price_history, "1");
  assert.equal(planFingerprint(plan), plan.meta.plan_fingerprint);
});

test("requires two matching captures and exact current identity", () => {
  const mismatch = fixture();
  mismatch.captures[1].semantic_fingerprint = "b".repeat(64);
  assert.throws(() => buildReviewedVariantCreateRebindPlan(mismatch), /semantically identical/);
  const wrongVariant = fixture();
  wrongVariant.state.offer.product_variant_id = 999;
  assert.throws(() => buildReviewedVariantCreateRebindPlan(wrongVariant), /offer identity mismatch/);
  const changedUrl = fixture();
  changedUrl.source.url = "https://wheyokay.com/other";
  assert.throws(() => buildReviewedVariantCreateRebindPlan(changedUrl), /preserve mapping and offer URL/);
});

test("reviewed operation uses the immutable existing import artifact and per-row approval lifecycle", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reviewed-variant-rebind-"));
  try {
    const plan = buildReviewedVariantCreateRebindPlan(fixture());
    const row = plan.source_record;
    const result = { skipped: 0, blockedRows: [], report: { approvedRows: [{ rowNumber: 2, row, importPlan: plan }], blockedRows: [] } };
    const written = writeDryRunArtifact([row], result, { artifactPath: path.join(directory, "plan.json"), runId: "reviewed-plan-test", sourceContent: canonicalJson(row), sourceFileName: "source.json", environmentMarker: "test" });
    const loaded = loadDryRunArtifact(written.artifactPath);
    assert.equal(loaded.artifact.plans.length, 1);
    assert.equal(loaded.artifact.plans[0].operation_type, OPERATION_TYPE);
    let approvalArgs;
    setSupabaseForTests({ rpc: async (name, args) => {
      assert.equal(name, "approve_product_import_plan");
      approvalArgs = args;
      return { data: {
        approval_id: "approval-1", expires_at: args.p_expires_at,
        artifact_sha256: written.artifactSha256, run_id: loaded.artifact.run_id,
        plan_fingerprint: plan.meta.plan_fingerprint, source_row_fingerprint: plan.meta.source_row_fingerprint,
        retailer_id: "3", plan_kind: "feed",
      }, error: null };
    } });
    await approveArtifactPlan({ artifactPath: written.artifactPath, planFingerprint: plan.meta.plan_fingerprint, approvalExpiresAt: "2099-01-01T00:00:00.000Z" });
    assert.equal(approvalArgs.p_expires_at, plan.meta.expires_at, "reviewed approval must use its fingerprint-bound expiry");
    const tampered = structuredClone(loaded.artifact);
    tampered.plans[0].resolved_plan.offer.values.total_price = "26.68";
    const bytes = Buffer.from(`${JSON.stringify(tampered, null, 2)}\n`);
    const tamperedPath = path.join(directory, "tampered.json");
    fs.writeFileSync(tamperedPath, bytes);
    fs.writeFileSync(`${tamperedPath}.sha256`, `${crypto.createHash("sha256").update(bytes).digest("hex")}\n`);
    assert.throws(() => loadDryRunArtifact(tamperedPath), /plan metadata mismatch/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
