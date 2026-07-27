const assert = require("node:assert/strict");
const test = require("node:test");
const {
  countBy,
  parseArgs,
  safeManifest,
} = require("./six-pack-match-report");

test("match report CLI requires an explicit target and confines outputs to tmp", () => {
  assert.throws(() => parseArgs([]), /Required --target/);
  assert.throws(() => parseArgs(["--target=production", "--output-dir=outside"]), /inside repository tmp/);
  assert.equal(parseArgs(["--target=production"]).target, "production");
  assert.equal(parseArgs(["--target=production", "--allow-existing-retailer=true"]).allowExistingRetailer, true);
});

test("draft manifest is explicitly unapproved and deterministic for fixed metadata", () => {
  const rows = [{
    status: "SAFE_EXISTING_VARIANT",
    external_product_id: "10",
    external_variant_id: "11",
    canonical_product_id: "100",
    canonical_variant_id: "101",
    source_product_name: "Product",
    source_variant_name: "Vanilla",
    source_price: "19.99",
    source_in_stock: true,
  }, {
    status: "NEW_PRODUCT_REVIEW",
    external_product_id: "20",
    external_variant_id: "20",
  }];
  const metadata = {
    target: "production",
    source_snapshot_fingerprint: "a".repeat(64),
    source_sha256: "b".repeat(64),
    generated_at: "2026-07-27T12:00:00.000Z",
  };
  const first = safeManifest(rows, metadata);
  const second = safeManifest(rows, metadata);
  assert.equal(first.approved, false);
  assert.equal(first.row_count, 1);
  assert.equal(first.manifest_fingerprint, second.manifest_fingerprint);
});

test("status counts are stable and sorted", () => {
  assert.deepEqual(countBy([
    { status: "Z" },
    { status: "A" },
    { status: "Z" },
  ], "status"), { A: 1, Z: 2 });
});
