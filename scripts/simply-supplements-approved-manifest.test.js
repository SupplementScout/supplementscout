const assert = require("node:assert/strict");
const test = require("node:test");
const { actionFor, buildDryRunGuard, buildManifest, parseArgs } = require("./simply-supplements-approved-manifest");

function source(overrides = {}) {
  return {
    status: "READY_OWNER_APPROVED_AWIN_REKEY",
    merchant_product_id: "C1", aw_product_id: "AW1",
    current_awin_rekey: { merchant_product_id: "E1", aw_product_id: "NEW-AW1", affiliate_url: "https://www.awin1.com/pclick.php?p=NEW-AW1&a=1&m=5959" },
    external_product_id: "100", external_variant_id: "101", external_sku: "SKU", handle: "product", external_gtin: "5050000000001",
    external_url: "https://www.simplysupplements.co.uk/products/product?variant=101",
    affiliate_url: "https://www.awin1.com/pclick.php?p=AW1&a=1&m=5959",
    price: "9.99", shipping_cost: "1.99", total_price: "11.98", in_stock: false,
    ...overrides,
  };
}

function database(overrides = {}) {
  return { mapping_id: 1, offer_id: 2, product_id: 3, product_variant_id: 4, external_url: source().external_url, price: "8.99", shipping_cost: "1.99", total_price: "10.98", in_stock: true, url: source().affiliate_url, ...overrides };
}

test("classifies exact existing-offer changes without creating catalogue rows", () => {
  assert.deepEqual(actionFor(source(), database()).changed_fields, ["price", "total_price", "in_stock"]);
  assert.equal(actionFor(source(), database({ price: "9.99", total_price: "11.98", in_stock: false })).action, "VERIFY_NO_CHANGE");
});

test("builds a sealed exact manifest from ready source and production state", () => {
  const report = { approved_scope_state: "READY_FOR_MANIFEST", counts: { approved_scope_total: 1, approved_scope_ready: 1, approved_scope_blocked: 0 }, approved_scope: [source()], sources: { shopify: { semantic_source_fingerprint: "a".repeat(64) } }, report_fingerprint: "b".repeat(64) };
  const manifest = buildManifest(report, [database()], 1, 1);
  assert.equal(manifest.rows.length, 1);
  assert.equal(manifest.rows[0].awin_presence_policy, "APPROVED_REKEY");
  assert.equal(manifest.rows[0].action, "UPDATE_EXISTING_OFFER");
  assert.equal(manifest.database_writes, 0);
  assert.equal(manifest.dry_run.state, "BLOCKED");
  assert.match(manifest.manifest_fingerprint, /^[0-9a-f]{64}$/);
});

test("reuses shared mass-change guards for the approved scope", () => {
  const rows = [
    { ...buildManifest({ approved_scope_state: "READY_FOR_MANIFEST", counts: { approved_scope_total: 1, approved_scope_ready: 1, approved_scope_blocked: 0 }, approved_scope: [source()], sources: {}, report_fingerprint: "x" }, [database()], 1, 1).rows[0] },
  ];
  const guard = buildDryRunGuard(rows, { maximum_changed_record_ratio: 0.25, mass_price_change_block_ratio: 0.2, mass_oos_block_count: 4, maximum_total_oos_ratio: 0.35, maximum_oos_increase_percentage_points: 0.15, per_row_price_hard_block_ratio: 0.6, per_row_price_hard_block_absolute_gbp: "20.00" });
  assert.equal(guard.state, "BLOCKED");
  assert.equal(guard.blockers.includes("MASS_CHANGE"), true);
  assert.equal(guard.blockers.includes("MASS_PRICE"), true);
});

test("manifest fails closed on missing mappings and blocked source", () => {
  const report = { approved_scope_state: "BLOCKED", counts: { approved_scope_total: 1, approved_scope_ready: 0, approved_scope_blocked: 1 }, approved_scope: [source({ status: "BLOCKED" })] };
  assert.throws(() => buildManifest(report, [database()], 1), /not ready/);
  const ready = { ...report, approved_scope_state: "READY_FOR_MANIFEST", counts: { approved_scope_total: 1, approved_scope_ready: 1, approved_scope_blocked: 0 }, approved_scope: [source()], sources: {}, report_fingerprint: "x" };
  assert.throws(() => buildManifest(ready, [], 1), /coverage mismatch/);
});

test("CLI paths are restricted to tmp", () => {
  assert.throws(() => parseArgs(["--report=data/a.json", "--output=tmp/m.json"]), /inside tmp/);
  const parsed = parseArgs(["--report=tmp/a.json", "--output=tmp/m.json"]);
  assert.match(parsed.output, /tmp[\\/]m\.json$/);
});
