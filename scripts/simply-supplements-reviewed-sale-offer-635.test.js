const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  AUTHORIZATION_FILE,
  AUTHORIZATION_FILE_SHA256,
  loadReviewedSale,
} = require("./simply-supplements-reviewed-sale-offer-635");

const migration = fs.readFileSync(path.resolve(
  "supabase/migrations/20260810160000_authorize_simply_offer_635_reviewed_sale.sql",
), "utf8");
const rollback = fs.readFileSync(path.resolve(
  "supabase/rollbacks/20260810160000_authorize_simply_offer_635_reviewed_sale.sql",
), "utf8");

function target(authorization) {
  const row = authorization.row;
  return {
    offer_id: row.offer_id,
    retailer_product_id: row.mapping_id,
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    external_sku: row.external_sku,
    price: row.old_price,
    shipping_cost: row.shipping_cost,
    total_price: row.old_total_price,
    in_stock: row.old_stock,
    url: row.offer_url,
    external_url: row.mapping_url,
  };
}

function source(authorization) {
  const row = authorization.row;
  return {
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    external_sku: row.external_sku,
    price: row.new_price,
    shipping_cost: row.shipping_cost,
    in_stock: row.new_stock,
  };
}

test("reviewed sale is byte-bound to the exact owner-approved row", () => {
  const bytes = fs.readFileSync(AUTHORIZATION_FILE);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), AUTHORIZATION_FILE_SHA256);
  const reviewed = loadReviewedSale();
  assert.equal(reviewed.authorization.row.offer_id, "635");
  assert.equal(reviewed.authorization.row.mapping_id, "627");
  assert.equal(reviewed.authorization.row.external_variant_id, "64643271033181");
  assert.equal(reviewed.authorization.row.old_price, "6.41");
  assert.equal(reviewed.authorization.row.new_price, "2.13");
  assert.equal(reviewed.authorization.row.new_total_price, "4.12");
  assert.equal(reviewed.reviewed_scope_hash, "cc1cbe7bcd4b8530ab7889ca017db250690807475b75329a631538edb413f56d");
});

test("semantic edits fail even when supplied as a different valid JSON file", () => {
  const changed = JSON.parse(fs.readFileSync(AUTHORIZATION_FILE, "utf8"));
  changed.row.new_price = "2.14";
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "simply-sale-")), "authorization.json");
  fs.writeFileSync(file, `${JSON.stringify(changed, null, 2)}\n`);
  assert.throws(() => loadReviewedSale(file), /file SHA-256 mismatch/);
});

test("classifier accepts only the exact source, state and frozen source snapshot", () => {
  const reviewed = loadReviewedSale();
  const authorization = reviewed.authorization;
  const targets = Array.from({ length: 120 }, (_, index) => index === 0 ? target(authorization) : { offer_id: String(10000 + index) });
  const input = {
    targets,
    sourceVariants: [source(authorization)],
    sourceCapturedAt: new Date().toISOString(),
    sourceFingerprint: authorization.source_capture_sha256,
  };
  const result = reviewed.classify(input);
  assert.equal(result.state, "DRY_RUN_READY");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].action, "UPDATE_PRICE");
  assert.deepEqual(result.rows[0].changed_fields, { price: true, stock: false, url: false, blocked: false });
  assert.throws(() => reviewed.classify({ ...input, sourceFingerprint: "0".repeat(64) }), /source differs/);
  const wrongState = structuredClone(input);
  wrongState.targets[0].price = "6.42";
  assert.throws(() => reviewed.classify(wrongState), /prior state drift/);
  const wrongSource = structuredClone(input);
  wrongSource.sourceVariants[0].price = "2.14";
  assert.throws(() => reviewed.classify(wrongSource), /source drift/);
});

test("v4 contract binds exact before, after, deltas and production target", () => {
  const reviewed = loadReviewedSale();
  const row = reviewed.reviewed_rows[0];
  const artifactCore = {
    target_environment: "PRODUCTION",
    retailer_id: "7",
    source_snapshot_fingerprint: reviewed.authorization.source_capture_sha256,
    source_captured_at: new Date().toISOString(),
    expected_deltas: reviewed.manifest.expected_deltas,
    rows: [{
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      action: row.action,
      changed_fields: { price: true, stock: false, url: false, blocked: false },
      atomic_plan: { expected_state: { offer: row.before }, offer: { values: row.after } },
    }],
  };
  const artifact = { ...artifactCore, artifact_fingerprint: fingerprint(artifactCore) };
  const contract = reviewed.buildContract({ artifact, targetEnvironment: "PRODUCTION", expiresAt: new Date(Date.now() + 600000).toISOString() });
  assert.equal(contract.kind, "retailer-reviewed-commercial-change-v4");
  assert.equal(contract.authorization_id, "simply-offer635-sale-20260810-production");
  assert.equal(contract.reviewed_manifest_sha256, AUTHORIZATION_FILE_SHA256);
  const wrong = structuredClone(artifact);
  wrong.rows[0].atomic_plan.offer.values.total_price = "4.13";
  assert.throws(() => reviewed.buildContract({ artifact: wrong, targetEnvironment: "PRODUCTION", expiresAt: contract.expires_at }), /differs/);
  assert.throws(() => reviewed.buildContract({ artifact, targetEnvironment: "STAGING", expiresAt: contract.expires_at }), /target or source mismatch/);
});

test("authorization migration is production-only, control-only and exact", () => {
  for (const token of [
    "simply-offer635-sale-20260810-production",
    AUTHORIZATION_FILE_SHA256,
    "6db3040a902152799bd3e77334ebd32b59f5909f3f5c85902eb0f640173bf689",
    "cc1cbe7bcd4b8530ab7889ca017db250690807475b75329a631538edb413f56d",
    "owner-approved-chat-2026-08-10-after-exact-identity-and-price-review",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /target_environment'<>'PRODUCTION'/);
  assert.match(migration, /contract_version[^;]+4/s);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(rollback, /rollback is forbidden after the Simply offer 635 authorization has been bound/);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("ordinary hard-price protection remains unchanged and special apply is not scheduled", () => {
  const config = require("../config/retailers/simply-supplements-offer-sync.json");
  const ordinary = fs.readFileSync(path.resolve("scripts/lib/retailer-offer-sync/classifier.js"), "utf8");
  const workflow = fs.readFileSync(path.resolve(".github/workflows/simply-supplements-offer-refresh.yml"), "utf8");
  assert.equal(config.guardrails.per_row_price_hard_block_ratio, 0.6);
  assert.match(ordinary, /HARD_PRICE_ANOMALY/);
  assert.doesNotMatch(workflow, /reviewed-sale-offer-635/);
});
