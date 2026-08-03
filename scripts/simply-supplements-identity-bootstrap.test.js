const assert = require("node:assert/strict");
const test = require("node:test");
const authorization = require("../config/retailers/simply-supplements-reviewed-change-authorization-2026-08-03.json");
const { buildIdentityBootstrap, parseArgs } = require("./simply-supplements-identity-bootstrap");

function manifest() {
  return { manifest_fingerprint: authorization.manifest_fingerprint, approved_mapping_count: 1, rows: [{ mapping_id: "1", offer_id: "2", canonical_product_id: "3", canonical_variant_id: "4", external_product_id: "100", external_variant_id: "101", external_sku: "SKU-1", external_url: "https://www.simplysupplements.co.uk/products/product?variant=101", affiliate_url: "https://www.awin1.com/pclick.php?p=1&a=1&m=5959" }] };
}

function state(overrides = {}) {
  return [{ mapping_id: 1, offer_id: 2, product_id: 3, product_variant_id: 4, external_product_id: null, external_variant_id: null, external_sku: null, external_url: manifest().rows[0].external_url, url: manifest().rows[0].affiliate_url, mapping_updated_at: "2026-08-03T12:00:00.000Z", ...overrides }];
}

test("builds an exact identity-only bootstrap with all commercial fields preserved", () => {
  const artifact = buildIdentityBootstrap(manifest(), state(), 1);
  assert.equal(artifact.state, "OWNER_APPROVAL_REQUIRED");
  assert.equal(artifact.identity_update_authorized, false);
  assert.equal(artifact.rows[0].action, "UPDATE_MAPPING_IDENTITY_ONLY");
  assert.equal(artifact.expected_deltas.mapping_identity_updates, 1);
  assert.equal(artifact.expected_deltas.offer_updates, 0);
  assert.match(artifact.artifact_fingerprint, /^[0-9a-f]{64}$/);
});

test("bootstrap blocks pre-existing identity, URL drift and canonical drift", () => {
  assert.throws(() => buildIdentityBootstrap(manifest(), state({ external_variant_id: "101" }), 1), /requires null legacy identity/);
  assert.throws(() => buildIdentityBootstrap(manifest(), state({ external_url: "https://example.com" }), 1), /URL split drift/);
  assert.throws(() => buildIdentityBootstrap(manifest(), state({ product_variant_id: 9 }), 1), /canonical drift/);
});

test("identity bootstrap CLI is restricted to tmp", () => {
  assert.throws(() => parseArgs(["--manifest=config/m.json", "--output=tmp/i.json"]), /inside tmp/);
  assert.match(parseArgs(["--manifest=tmp/m.json", "--output=tmp/i.json"]).output, /tmp[\\/]i\.json$/);
});
