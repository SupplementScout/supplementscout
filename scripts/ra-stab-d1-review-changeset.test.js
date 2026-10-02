const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  buildBundle,
  flattenTenRepsRows,
  parseArgs,
} = require("./ra-stab-d1-review-changeset");

const ROOT = path.resolve(__dirname, "..");
const decisionPack = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/retailer-automation/evidence/RA-STAB-01-BACKLOG-OWNER-DECISION-PACK-2026-10-02.json"), "utf8"));
const identityAudit = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/retailer-automation/evidence/RA-STAB-01-10REPS-IDENTITY-AUDIT-2026-10-02.json"), "utf8"));

function state() {
  const rows = [
    ...decisionPack.fit_house_decision.rows.map((row) => ({ ...row, retailer_id: "9" })),
    ...flattenTenRepsRows(decisionPack).map((row) => ({ ...row, retailer_id: "14" })),
  ];
  const products = new Map();
  const variants = new Map();
  for (const row of rows) {
    products.set(String(row.canonical_product_id), { id: row.canonical_product_id, name: `Product ${row.canonical_product_id}` });
    variants.set(String(row.canonical_variant_id), { id: row.canonical_variant_id, product_id: row.canonical_product_id, display_name: `Variant ${row.canonical_variant_id}` });
  }
  return {
    captured_at: "2026-10-02T14:57:07.242Z",
    retailers: [{ id: "9", name: "Fit House" }, { id: "14", name: "10 Reps" }],
    offers: rows.map((row) => ({
      id: row.offer_id,
      retailer_id: row.retailer_id,
      retailer_product_id: row.mapping_id,
      product_id: row.canonical_product_id,
      product_variant_id: row.canonical_variant_id,
      price: row.price_gbp,
      shipping_cost: "3.99",
      total_price: String((Number(row.price_gbp) + 3.99).toFixed(2)),
      in_stock: row.database_in_stock,
      url: row.url,
    })),
    mappings: rows.map((row) => ({
      id: row.mapping_id,
      retailer_id: row.retailer_id,
      product_id: row.canonical_product_id,
      product_variant_id: row.canonical_variant_id,
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      external_sku: null,
      external_gtin: null,
      external_url: row.url,
    })),
    products: [...products.values()],
    variants: [...variants.values()],
    active_rows: [],
    catalogue_counts: {
      products: 1337,
      product_variants: 3632,
      retailer_products: 3758,
      offers: 3758,
      price_history: 25746,
    },
  };
}

test("builds one read-only D1 bundle with two common publisher changesets and exactly 30 creates", () => {
  const output = buildBundle(decisionPack, identityAudit, state());
  assert.equal(output.result, "PASS_READ_ONLY_CHANGESET_PREPARED");
  assert.deepEqual(output.scope, { total_rows: 30, fit_house_rows: 14, ten_reps_rows: 16, unique_offer_ids: 30 });
  assert.equal(output.retailer_changesets.length, 2);
  assert.deepEqual(output.retailer_changesets.map((item) => [item.retailer_id, item.manifest_summary.row_count]), [["9", 14], ["14", 16]]);
  assert.equal(output.totals.preview_operations, 30);
  assert.equal(output.totals.create, 30);
  assert.equal(output.totals.refresh, 0);
  assert.equal(output.totals.supersede, 0);
  assert.equal(output.totals.performed_database_writes, 0);
  assert.equal(output.authority.review_queue_publication_authorized, false);
  assert.equal(output.next_gate, "SEPARATE_IMPLEMENTATION_REVIEW_AND_OWNER_CONTROL_WRITE_AUTHORIZATION_REQUIRED_BEFORE_ANY_PUBLICATION");
  const fit = output.retailer_changesets[0].preview_request.operations.map((operation) => operation.row);
  const ten = output.retailer_changesets[1].preview_request.operations.map((operation) => operation.row);
  assert.ok(fit.every((row) => row.operation_type === "UPDATE_STOCK" && row.impact_summary.catalogue_writes === 0));
  assert.ok(ten.every((row) => row.operation_type === "MANUAL_REVIEW_IDENTITY" && row.proposed_state.catalogue_action === "KEEP_UNCHANGED"));
  assert.equal(ten.find((row) => row.offer_id === "3388").canonical_candidates[0].status, "READ_ONLY_CANDIDATE_NOT_AUTHORIZED");
  assert.equal(ten.find((row) => row.offer_id === "3627").canonical_candidates.length, 0);
});

test("uses the common lifecycle planner for an existing exact active row without widening scope", () => {
  const first = buildBundle(decisionPack, identityAudit, state());
  const row = first.retailer_changesets[0].preview_request.operations[0].row;
  const current = state();
  current.active_rows = [{ id: "9001", retailer_id: "9", retailer: "Fit House", offer_id: row.offer_id, review_status: "PENDING", source_row_fingerprint: row.source_row_fingerprint }];
  const output = buildBundle(decisionPack, identityAudit, current);
  assert.equal(output.totals.create, 29);
  assert.equal(output.totals.refresh, 1);
  assert.equal(output.totals.preview_operations, 30);
  assert.equal(output.retailer_changesets[0].preview_request.expected_baseline.active_review_count, 1);
  assert.equal(output.totals.performed_database_writes, 0);
});

test("fails closed on catalogue drift, scope drift and any apply-shaped CLI argument", () => {
  const changed = state();
  changed.offers[0].price = "999.99";
  assert.throws(() => buildBundle(decisionPack, identityAudit, changed), /price drift/);
  const missing = state();
  missing.mappings.pop();
  assert.throws(() => buildBundle(decisionPack, identityAudit, missing), /exactly 30 offers and 30 mappings/);
  assert.throws(() => parseArgs(["--apply=true"]), /no apply mode/);
  assert.throws(() => parseArgs(["--output=docs/changeset.json"]), /exact sealed D1 evidence path/);
});

test("the production reader exposes no write or RPC method", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts/ra-stab-d1-review-changeset.js"), "utf8");
  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /\.update\s*\(/);
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.doesNotMatch(source, /\.rpc\s*\(/);
  assert.doesNotMatch(source, /publishReviewManifestViaRpc/);
});
