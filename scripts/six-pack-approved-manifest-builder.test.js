const test = require("node:test");
const assert = require("node:assert/strict");
const { buildManifest, parseArgs } = require("./six-pack-approved-manifest-builder");

const retailer = {
  id: 11,
  name: "6 Pack Supplements",
  slug: "6-pack-supplements",
  website: "https://6pack-supplements.co.uk"
};

test("builds a complete manifest and enforces shipping on both sides of threshold", () => {
  const manifest = buildManifest({
    retailer,
    mappings: [
      { id: 1, product_id: 10, product_variant_id: 11, external_product_id: "100", external_variant_id: "101" },
      { id: 2, product_id: 20, product_variant_id: 21, external_product_id: "200", external_variant_id: "201" }
    ],
    offers: [
      { id: 3, retailer_product_id: 1, product_id: 10, product_variant_id: 11, price: 20, shipping_cost: 4.99, total_price: 24.99 },
      { id: 4, retailer_product_id: 2, product_id: 20, product_variant_id: 21, price: 100, shipping_cost: 0, total_price: 100 }
    ]
  });
  assert.equal(manifest.approved_mapping_count, 2);
  assert.deepEqual(manifest.rows.map((row) => row.mapping_id), ["1", "2"]);
});

test("blocks incomplete offer scope and shipping drift", () => {
  assert.throws(() => buildManifest({ retailer, mappings: [{ id: 1 }], offers: [] }), /scope mismatch/);
  assert.throws(() => buildManifest({
    retailer,
    mappings: [{ id: 1, product_id: 10, product_variant_id: 11, external_product_id: "100", external_variant_id: "101" }],
    offers: [{ id: 3, retailer_product_id: 1, product_id: 10, product_variant_id: 11, price: 20, shipping_cost: 0, total_price: 20 }]
  }), /shipping drift/);
});

test("builder output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-approved-offer-manifest-expanded\.json$/);
  assert.match(
    parseArgs([
      "--output=config/retailers/six-pack-approved-offer-manifest.json",
    ]).output,
    /six-pack-approved-offer-manifest\.json$/
  );
  assert.throws(
    () => parseArgs(["--output=config/no.json"]),
    /inside repository tmp or the approved manifest path/
  );
});

test("owner withdrawal proposal accounts for every binding without changing or activating approved scope", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { createHash } = require("node:crypto");
  const { canonicalJson } = require("./lib/canonical-json");
  const { cataloguePolicyDecision } = require("./lib/feed-variant-guards");
  const root = path.resolve(__dirname, "..");
  const evidence = require("../docs/retailer-automation/evidence/OWNER-CATALOGUE-EXCLUSION-2026-11-08.json");
  const hash = value => createHash("sha256").update(value).digest("hex");
  assert.equal(evidence.status, "READY_FOR_REVIEW_DEPLOYMENT_BLOCKED");
  assert.equal(evidence.approved_for_production_writes, false);
  assert.equal(evidence.approved_for_scope_activation, false);
  for (const proposal of evidence.retailer_scope_proposals) {
    const bytes = fs.readFileSync(path.join(root, proposal.current_manifest_path));
    assert.equal(hash(bytes), proposal.current_manifest_sha256);
    const rows = JSON.parse(bytes).rows;
    const keys = new Set(proposal.withdrawn_bindings.map(row => `${row.external_product_id}|${row.external_variant_id}`));
    const withdrawn = rows.filter(row => keys.has(`${row.external_product_id}|${row.external_variant_id}`));
    const retained = rows.filter(row => !keys.has(`${row.external_product_id}|${row.external_variant_id}`));
    assert.equal(rows.length, proposal.current_approved_mappings);
    assert.equal(withdrawn.length, proposal.withdrawn_bindings.length);
    assert.equal(rows.length, withdrawn.length + retained.length);
    assert.equal(retained.length, proposal.candidate_approved_mappings);
    assert.equal(new Set(retained.map(row => row.external_product_id)).size, proposal.candidate_approved_source_products);
    assert.equal(hash(canonicalJson(retained)), proposal.candidate_scope_rows_sha256);
    assert.equal(proposal.candidate_approved, false);
    assert.equal(proposal.physical_mappings_deleted + proposal.physical_offers_deleted, 0);
  }
  for (const product of evidence.products) {
    assert.equal(cataloguePolicyDecision({ product_name: product.name }).state, product.decision);
  }
  for (const product of evidence.unchanged_nutrition_controls) {
    assert.equal(cataloguePolicyDecision({ product_name: product.name }), null);
  }
  assert.equal(evidence.dependencies.history.reduce((count, row) => count + row.count, 0), 5);
  assert.equal(evidence.dependencies.cross_retailer_shared_variant.offer_ids.length, 2);
});
