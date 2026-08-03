const assert = require("node:assert/strict");
const test = require("node:test");
const authorization = require("../config/retailers/simply-supplements-reviewed-change-authorization-2026-08-03.json");
const { AUTHORIZATION_ID, expectedDeltas, loadReviewedBaseline, rowDeltas } = require("./simply-supplements-reviewed-offer-apply");

test("reviewed Simply baseline is byte-bound to the exact owner approval", () => {
  const reviewed = loadReviewedBaseline();
  assert.equal(reviewed.sha256, authorization.manifest_file_sha256);
  assert.equal(reviewed.manifest.source_capture_sha256, authorization.source_semantic_fingerprint);
  assert.equal(reviewed.reviewed_rows.length, 49);
  assert.equal(AUTHORIZATION_ID, "simply-49-2bc798f9fb7db4af-production");
});

test("reviewed Simply deltas include the six threshold-shipping changes", () => {
  const deltas = expectedDeltas();
  assert.deepEqual(deltas.row_count_deltas, { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 43 });
  assert.equal(deltas.logical_field_deltas.offer_price_updates, 43);
  assert.equal(deltas.logical_field_deltas.offer_shipping_updates, 6);
  assert.equal(deltas.logical_field_deltas.offer_stock_updates, 6);
  assert.equal(deltas.logical_field_deltas.offer_url_updates, 0);
  assert.equal(deltas.logical_field_deltas.mapping_url_updates, 0);
});

test("reviewed Simply rows preserve Awin URLs and contain exact delivery totals", () => {
  const reviewed = loadReviewedBaseline();
  assert.ok(reviewed.reviewed_rows.every((row) => row.before.url === row.after.url && /awin1\.com/.test(row.after.url)));
  assert.equal(reviewed.reviewed_rows.filter((row) => row.before.shipping_cost !== row.after.shipping_cost).length, 6);
  assert.ok(reviewed.reviewed_rows.every((row) => Number(row.after.total_price).toFixed(2) === (Number(row.after.price) + Number(row.after.shipping_cost)).toFixed(2)));
});

test("row deltas distinguish item price, threshold delivery and stock", () => {
  const reviewed = loadReviewedBaseline();
  const shipping = reviewed.reviewed_rows.find((row) => row.before.shipping_cost !== row.after.shipping_cost);
  const approved = require("../tmp/simply-supplements/approved-existing-offers-manifest.json").rows.find((row) => String(row.external_variant_id) === shipping.external_variant_id);
  const delta = rowDeltas(approved);
  assert.equal(delta.row_count_deltas.price_history, 1);
  assert.equal(delta.logical_field_deltas.offer_price_updates, 1);
  assert.equal(delta.logical_field_deltas.offer_shipping_updates, 1);
  assert.equal(delta.logical_field_deltas.offer_total_updates, 1);
  assert.equal(delta.logical_field_deltas.offer_stock_updates, 0);
});
