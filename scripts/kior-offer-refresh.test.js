const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/kior-offer-sync.json");
const manifest = require("../config/retailers/kior-approved-offer-manifest.json");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { baselineHash, verifyPostflight } = require("./retailer-offer-refresh-postflight");
const { canonicalHash, normalizeExactScopeRows } = require("./fit-house-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/kior-offer-refresh.yml"), "utf8");
const migration = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260830100000_add_kior_offer_sync_registration.sql"), "utf8");

function scenario() {
  const targets = manifest.rows.map((row) => ({
    offer_id: String(row.offer_id), retailer_product_id: String(row.mapping_id),
    external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
    external_sku: null, price: "10.00", shipping_cost: "3.99", total_price: "13.99",
    in_stock: true, url: `https://kior.uk/products/test-${row.mapping_id}?variant=${row.external_variant_id}`,
    external_url: `https://kior.uk/products/test-${row.mapping_id}?variant=${row.external_variant_id}`,
    last_checked_at: "2026-08-01T00:00:00.000Z",
  }));
  const sourceVariants = targets.map((row) => ({
    external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
    external_sku: null, product_handle: `test-${row.retailer_product_id}`,
    price: row.price, shipping_cost: row.shipping_cost, in_stock: row.in_stock,
  }));
  return {
    targets, sourceVariants,
    policy: { ...config.guardrails, store_url: config.store_url },
    guardScope: { name: config.guard_scope_name, retailer: config.retailer_name },
    sourceCapturedAt: "2026-08-30T09:00:00.000Z",
    now: new Date("2026-08-30T09:00:01.000Z"),
    sourceProductCount: 22, previousSourceProductCount: 22,
  };
}

test("KIOR scope is immutable to exactly eleven existing mappings and offers", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path), "utf8").replace(/\r\n/g, "\n");
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), config.manifest_sha256);
  assert.equal(config.retailer_id, 8);
  assert.equal(config.approved_mapping_count, 11);
  assert.equal(manifest.rows.length, 11);
  assert.deepEqual(manifest.rows.map((row) => Number(row.mapping_id)), [670,671,672,673,674,675,676,677,678,679,680]);
  assert.deepEqual(manifest.rows.map((row) => Number(row.offer_id)), [678,679,680,681,682,683,684,685,686,687,688]);
  assert.equal(new Set(manifest.rows.map((row) => row.external_variant_id)).size, 11);
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.policy.catalogue_creates, false);
  assert.equal(config.policy.mapping_creates, false);
});

test("KIOR exact scope hash normalizes database strings and manifest numbers", () => {
  const databaseRows = manifest.rows.map((row) => ({
    mapping_id: String(row.mapping_id), offer_id: String(row.offer_id),
    external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id),
    canonical_product_id: String(row.canonical_product_id), canonical_variant_id: String(row.canonical_variant_id),
  }));
  assert.equal(canonicalHash(databaseRows), canonicalHash(normalizeExactScopeRows(manifest.rows)));
  assert.notEqual(canonicalHash(databaseRows), canonicalHash(manifest.rows));
});

test("KIOR shared classifier supports no-change and safe price/stock actions", () => {
  const unchanged = classifyExistingOffers(scenario());
  assert.equal(unchanged.state, "DRY_RUN_READY");
  assert.equal(unchanged.rows.length, 11);
  assert.equal(unchanged.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);

  const changed = scenario();
  changed.sourceVariants[0].price = "10.50";
  changed.sourceVariants[1].in_stock = false;
  changed.sourceVariants[2].price = "10.50";
  changed.sourceVariants[2].in_stock = false;
  const classified = classifyExistingOffers(changed);
  assert.equal(classified.state, "DRY_RUN_READY");
  assert.equal(classified.rows.filter((row) => row.action === "UPDATE_PRICE").length, 1);
  assert.equal(classified.rows.filter((row) => row.action === "UPDATE_STOCK").length, 1);
  assert.equal(classified.rows.filter((row) => row.action === "UPDATE_PRICE_AND_STOCK").length, 1);
});

test("KIOR suspicious row is isolated and cannot block safe confirmations", () => {
  const input = scenario();
  input.sourceVariants[0].price = "40.00";
  input.quarantineUnsafeRows = true;
  const result = classifyExistingOffers(input);
  assert.equal(result.state, "DRY_RUN_READY_WITH_REVIEW");
  assert.equal(result.rows.length, 10);
  assert.equal(result.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);
  assert.deepEqual(result.quarantined_rows.map((row) => row.offer_id), ["678"]);
});

test("KIOR workflow reuses protected roles, DB postflight, idempotency and daily cron", () => {
  assert.match(workflow, /cron: "37 7 \* \* \*"/);
  assert.match(workflow, /node scripts\/kior-offer-refresh\.js --target=production --mode=dry-run --isolate-unsafe=true/);
  assert.match(workflow, /node scripts\/kior-offer-refresh\.js --target=production --mode=apply --isolate-unsafe=true/);
  assert.match(workflow, /Capture KIOR Health DB baseline read-only/);
  assert.match(workflow, /Verify KIOR Health DB postflight read-only/);
  assert.match(workflow, /Verify idempotency with a fresh source capture/);
  assert.match(workflow, /JONS_SYNC_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(workflow, /SAFE_UPDATE/);
});

test("KIOR registration RPC is production-only and contains no catalogue DML", () => {
  assert.match(migration, /register_kior_offer_sync_control_plan/);
  assert.match(migration, /KIOR frozen eleven-offer production scope binding/);
  assert.match(migration, /jsonb_array_length\(v_manifest\) <> 11/);
  assert.match(migration, /v_target <> 'PRODUCTION'/);
  assert.match(migration, /30e1dbc1147484a790384dd10f9fc79433ca6edd4728aab7ffbd7b4045fbef3c/);
  assert.doesNotMatch(migration, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("KIOR postflight requires timestamp-only no-change and zero history delta", () => {
  const row = (checked) => ({ mapping_id:"670",retailer_id:"8",mapping_product_id:"439",mapping_variant_id:"422",external_product_id:"6717613539421",external_variant_id:"39821206192221",external_sku:null,external_gtin:null,external_options:null,external_url:"https://kior.uk/products/astragalus?variant=39821206192221",offer_id:"678",offer_product_id:"439",offer_variant_id:"422",price:"9.99",shipping_cost:"3.99",total_price:"13.98",in_stock:true,url:"https://kior.uk/products/astragalus?variant=39821206192221",last_checked_at:checked });
  const snapshot = { row_count:1, price_history_count:2, rows:[row("2026-08-01T00:00:00Z")] };
  const baseline = { schema_version:1,kind:"retailer-offer-refresh-db-baseline",result:"PASS",profile:"kior-health",snapshot };
  baseline.evidence_hash = baselineHash(baseline);
  const execution = { result:"PASS",approved_mapping_count:1,executable_plan_count:1,executed_plan_count:1,review_row_count:0,blocked_row_count:0,review_rows:[],expected_deltas:{row_count_deltas:{price_history:0},logical_field_deltas:{last_checked_at_updates:1}} };
  const result = verifyPostflight(baseline,{row_count:1,price_history_count:2,rows:[row("2026-08-30T09:00:00Z")]},execution);
  assert.equal(result.result,"PASS");
  assert.equal(result.freshness_change_count,1);
  assert.equal(result.price_history_delta,0);
});
