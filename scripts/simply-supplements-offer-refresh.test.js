const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/simply-supplements-offer-sync.json");
const { canonicalHash, loadApprovedManifest, projectSourceVariants, reconcileMissingMappedVariants, registrationRequest } = require("./simply-supplements-offer-refresh");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");

const ROOT = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/simply-supplements-offer-refresh.yml"), "utf8");
const automation = fs.readFileSync(path.join(__dirname, "fit-house-offer-refresh.js"), "utf8");

test("Simply automation is bound to the approved 120-row identity authority", () => {
  const authority = loadApprovedManifest();
  assert.equal(authority.sha256, config.manifest_sha256);
  assert.equal(authority.manifest.artifact_fingerprint, config.authority_artifact_fingerprint);
  assert.equal(config.approved_mapping_count, 120);
  assert.match(config.approved_scope_fingerprint, /^[0-9a-f]{64}$/);
});

test("Simply shipping follows the existing £20 threshold", () => {
  const rows = projectSourceVariants({ products: [{ id: 1, handle: "p", variants: [
    { id: 2, price: "19.99", available: true },
    { id: 3, price: "20.00", available: true },
  ] }] });
  assert.equal(rows[0].shipping_cost, "1.99");
  assert.equal(rows[1].shipping_cost, "0.00");
});

test("Simply missing mapped variants block instead of being marked OOS", () => {
  assert.throws(() => reconcileMissingMappedVariants([
    { external_variant_id: "2", external_url: "https://www.simplysupplements.co.uk/products/p?variant=2" },
  ], [], config.discovery_policy), /safety limit exceeded/);
});

test("scheduled workflow reuses protected roles and contains no Awin credential", () => {
  assert.match(workflow, /cron: "7 5 \* \* \*"/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /JONS_SYNC_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /simply-supplements-offer-refresh\.js --target=production --mode=apply/);
  assert.doesNotMatch(workflow, /AWIN.*(?:SECRET|TOKEN|PASSWORD)/i);
  assert.match(automation, /config\.registration_rpc/);
  assert.doesNotMatch(automation, /set_config\('app\.safe_update'/);
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.source_fetch.pagination_completion, "empty-page");
  assert.match(automation, /paginationCompletion:config\.source_fetch\.pagination_completion\|\|"short-page"/);
});

test("authority file bytes remain frozen", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), config.manifest_sha256);
});

test("Simply preserves the Awin offer URL and direct Shopify mapping URL", () => {
  const result = classifyExistingOffers({
    targets: [{ offer_id: "1", retailer_product_id: "2", external_product_id: "3", external_variant_id: "4", external_sku: "C1", price: "10.00", shipping_cost: "1.99", total_price: "11.99", in_stock: true, url: "https://www.awin1.com/pclick.php?p=1", external_url: "https://www.simplysupplements.co.uk/products/example?variant=4" }],
    sourceVariants: [{ external_product_id: "3", external_variant_id: "4", external_sku: "C1", product_handle: "example", price: "10.00", shipping_cost: "1.99", total_price: "11.99", in_stock: true, url: "https://www.simplysupplements.co.uk/products/example?variant=4" }],
    policy: { ...config.guardrails, required_matched_offers: 1, store_url: config.store_url },
    sourceCapturedAt: "2026-08-03T18:00:00.000Z",
    now: new Date("2026-08-03T18:00:00.000Z"),
    sourceProductCount: 276,
    previousSourceProductCount: 276,
    guardScope: { name: "SIMPLY_URL_TEST", retailer: "Simply Supplements" },
  });
  assert.equal(result.state, "DRY_RUN_READY");
  assert.equal(result.rows[0].action, "VERIFY_NO_CHANGE");
  assert.equal(result.rows[0].changed_fields.url, false);
});

test("reviewed registration directly fingerprints the complete mapping manifest", () => {
  const expiresAt = "2026-08-03T20:14:00.000Z";
  const run = {
    reviewed: {},
    reviewedContract: { reviewed_contract_hash: "a".repeat(64) },
    reviewedExpiresAt: expiresAt,
    manifest: [{ mapping_id: "1", offer_id: "2", external_product_id: "3", external_variant_id: "4" }],
    manifestFingerprint: "b".repeat(64),
    artifacts: [{ artifact_fingerprint: "c".repeat(64) }],
    snapshot: { semantic_source_fingerprint: "d".repeat(64) },
    capturedAt: "2026-08-03T20:00:00.000Z",
    head: "e".repeat(40),
    spec: { environment: "PRODUCTION", ref: "aftboxmrdgyhizicfsfu", identity: "supplementscout-production:aftboxmrdgyhizicfsfu" },
  };
  const request = registrationRequest(run);
  const expectedManifestFingerprint = canonicalHash(run.manifest);
  assert.equal(request.manifest_fingerprint, expectedManifestFingerprint);
  assert.notEqual(request.manifest_fingerprint, run.manifestFingerprint);
  assert.equal(request.parent_plan_fingerprint, canonicalHash({
    schema_version: 1,
    kind: "retailer-existing-offer-sync-parent",
    parent_plan_id: request.parent_plan_id,
    target_environment: run.spec.environment,
    target_project_ref: run.spec.ref,
    target_database_identity: run.spec.identity,
    retailer_id: String(config.retailer_id),
    source_country: "GB",
    source_snapshot_fingerprint: run.snapshot.semantic_source_fingerprint,
    source_captured_at: run.capturedAt,
    manifest_fingerprint: expectedManifestFingerprint,
    child_plan_ids: request.children.map((row) => row.child_plan_id),
    child_fingerprints: request.children.map((row) => row.artifact.artifact_fingerprint),
    code_commit: run.head,
    expires_at: expiresAt,
    workflow: request.workflow,
  }));
});
