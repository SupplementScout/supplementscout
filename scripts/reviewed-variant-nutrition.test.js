const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  buildReviewedContract,
  loadReviewedManifest,
  validateReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");
const {
  parseArgs,
} = require("./reviewed-variant-nutrition");

function manifest() {
  const after = {
    net_weight_g: 1000,
    serving_count_verified: 40,
    serving_size_g: 25,
    protein_per_serving_g: 21,
    creatine_per_serving_g: null,
    product_format: "powder",
    unit_pricing_verified: true,
    nutrition_verified: true,
    source_url: "https://manufacturer.example/protein",
    source_type: "manufacturer_product_page",
    evidence: "Manufacturer confirms the exact package, serving size and protein value.",
  };
  const changes = [{
    product_id: "10",
    expected_product_name: "Example Protein",
    variant_id: "100",
    expected_variant_key: "vanilla-1000g",
    expected_display_name: "Vanilla / 1kg",
    before_nutrition_override: {},
    after_nutrition_override: after,
    source_url: after.source_url,
    evidence: after.evidence,
  }];
  return {
    schema_version: 1,
    kind: "reviewed-product-variant-nutrition-manifest-v1",
    status: "REVIEWED",
    authorized_by: "user-approved-nutrition-enrichment",
    authorized_at: "2026-07-26T18:00:00.000Z",
    source_policy: "Manufacturer product pages are authoritative.",
    reviewed_scope_hash: fingerprint(changes),
    changes,
  };
}

test("reviewed manifest validates exact schema and scope hash", () => {
  assert.equal(validateReviewedManifest(manifest()).status, "REVIEWED");
  const drift = structuredClone(manifest());
  drift.changes[0].after_nutrition_override.protein_per_serving_g = 20;
  assert.throws(() => validateReviewedManifest(drift), /scope hash mismatch/);
  const extra = structuredClone(manifest());
  extra.unreviewed = true;
  assert.throws(() => validateReviewedManifest(extra), /keys mismatch/);
});

test("reviewed manifest file is byte hash locked", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nutrition-review-"));
  const file = path.join(directory, "manifest.json");
  const bytes = `${JSON.stringify(manifest(), null, 2)}\n`;
  fs.writeFileSync(file, bytes);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(loadReviewedManifest(file, sha).sha256, sha);
  assert.throws(() => loadReviewedManifest(file, "0".repeat(64)), /SHA-256 mismatch/);
});

test("environment-specific contracts bind manifest, scope and authorization", () => {
  const value = manifest();
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  const reviewed = {
    manifest: value,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
  const contract = buildReviewedContract({
    reviewed,
    targetEnvironment: "STAGING",
    authorizationId: "nutrition-batch-1-staging",
  });
  assert.equal(contract.reviewed_scope_hash, value.reviewed_scope_hash);
  assert.equal(contract.reviewed_manifest_sha256, reviewed.sha256);
  assert.equal(
    contract.reviewed_contract_hash,
    fingerprint(Object.fromEntries(
      Object.entries(contract).filter(([key]) => key !== "reviewed_contract_hash"),
    )),
  );
});

test("CLI is closed and requires every immutable binding", () => {
  assert.deepEqual(
    parseArgs([
      "--target=staging",
      "--mode=dry-run",
      "--manifest=data/verified/example.json",
      `--manifest-sha256=${"a".repeat(64)}`,
      "--authorization-id=nutrition-batch-1-staging",
    ]).target,
    "staging",
  );
  assert.throws(() => parseArgs(["--target=staging", "--mode=dry-run"]));
  assert.throws(() => parseArgs([
    "--target=production",
    "--mode=unsafe",
    "--manifest=x",
    "--manifest-sha256=x",
    "--authorization-id=x",
  ]));
});
