const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadDryRunArtifact, writeDryRunArtifact } = require("./import-products");
const {
  buildVerifiedNoChangeDryRun,
  buildVerifiedNoChangePlan,
} = require("./verified-no-change-offer-refresh");

const HASH = "a".repeat(64);
const NOW = new Date("2026-07-18T14:00:00.000Z");
const OPTIONS = {
  targetEnvironment: "STAGING",
  targetProjectRef: "hxnrsyyqffztlvcrtgbf",
  sourceSnapshotSha256s: [HASH],
  expectedCount: 1,
  now: NOW,
};

function record() {
  return {
    source_snapshot_sha256: HASH,
    source_captured_at: "2026-07-18T13:30:00.000Z",
    source: {
      external_product_id: "9554508546288",
      external_variant_id: "47792854565104",
      price: "19.99",
      in_stock: true,
      url: "https://fithouse.uk/products/test?variant=47792854565104",
    },
    target: {
      product: { id: "769", name: "Test Creatine", is_active: true, merged_into_product_id: null, product_format: "powder" },
      retailer: { id: "2", name: "Fit House", slug: "fit-house", website: "https://fithouse.uk" },
      product_variant: {
        id: "935", product_id: "769", variant_key: "apple-500g", display_name: "Apple / 500g",
        flavour_code: "apple", flavour_label: "Apple", size_value: "500", size_unit: "g", pack_count: "1",
        product_format: "powder", is_active: true, is_default: false,
      },
      retailer_product: {
        id: "1200", retailer_id: "2", product_id: "769", product_variant_id: "935",
        external_product_id: "9554508546288", external_variant_id: "47792854565104", external_sku: null,
        external_options: { title: "Apple / 500g" }, external_name: "Test Creatine", external_slug: "test",
        external_gtin: null, external_url: "https://fithouse.uk/products/test?variant=47792854565104",
        match_method: "slug", match_confidence: "90",
      },
      offer: {
        id: "952", product_id: "769", retailer_id: "2", product_variant_id: "935", retailer_product_id: "1200",
        price: "19.99", shipping_cost: "3.99", total_price: "23.98", in_stock: true,
        url: "https://fithouse.uk/products/test?variant=47792854565104",
        last_checked_at: "2026-07-17T13:30:00.000Z",
      },
    },
  };
}

test("verified no-change plan can mutate only last_checked_at", () => {
  const { plan } = buildVerifiedNoChangePlan(record(), OPTIONS);
  assert.equal(plan.meta.operation_type, "verify_offer_no_change");
  assert.equal(plan.offer.action, "verify_no_change");
  assert.equal(plan.offer.values.last_checked_at, record().source_captured_at);
  assert.equal(plan.price_history.action, "noop");
  assert.equal(plan.retailer_product.action, "noop");
  assert.deepEqual(
    Object.keys(plan.offer.values).sort(),
    ["in_stock", "last_checked_at", "price", "shipping_cost", "total_price", "url"]
  );
});

test("planner rejects wrong target, stale source, and unbound snapshot hashes", () => {
  assert.throws(() => buildVerifiedNoChangePlan(record(), { ...OPTIONS, targetProjectRef: "aftboxmrdgyhizicfsfu" }), /target environment\/project ref mismatch/);
  assert.throws(() => buildVerifiedNoChangePlan(record(), { ...OPTIONS, now: new Date("2026-07-20T14:00:00Z") }), /stale/);
  assert.throws(() => buildVerifiedNoChangePlan(record(), { ...OPTIONS, sourceSnapshotSha256s: ["b".repeat(64)] }), /SHA-256 mismatch/);
});

test("planner rejects price, stock, URL, and external identity drift", () => {
  for (const [mutate, pattern] of [
    [(value) => { value.source.price = "20.00"; }, /price drift/],
    [(value) => { value.source.in_stock = false; }, /stock drift/],
    [(value) => { value.source.url += "&changed=1"; }, /URL mismatch/],
    [(value) => { value.source.external_variant_id = "1"; }, /external identity drift/],
  ]) {
    const value = record(); mutate(value);
    assert.throws(() => buildVerifiedNoChangePlan(value, OPTIONS), pattern);
  }
});

test("batch guard rejects count collapse and duplicate targets", () => {
  assert.throws(() => buildVerifiedNoChangeDryRun([record()], { ...OPTIONS, expectedCount: 2 }), /count collapse/);
  assert.throws(() => buildVerifiedNoChangeDryRun([record(), record()], { ...OPTIONS, expectedCount: 2 }), /duplicate source or target/);
});

test("immutable artifact loader accepts the operation and rejects tampering", () => {
  const dryRun = buildVerifiedNoChangeDryRun([record()], OPTIONS);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "verified-no-change-"));
  const artifactPath = path.join(directory, "artifact.json");
  const written = writeDryRunArtifact(dryRun.records, dryRun.result, {
    artifactPath,
    sourceContent: JSON.stringify(dryRun.records),
    sourceFileName: "fixture.json",
    environmentMarker: "staging",
  });
  assert.equal(loadDryRunArtifact(artifactPath).artifact.plans[0].operation_type, "verify_offer_no_change");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  artifact.plans[0].resolved_plan.offer.values.price = "999";
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact)}\n`);
  assert.throws(() => loadDryRunArtifact(artifactPath), /SHA-256 mismatch/);
  assert.match(written.artifactSha256, /^[0-9a-f]{64}$/);
});
