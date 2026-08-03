const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/simply-supplements-offer-sync.json");
const { loadApprovedManifest, projectSourceVariants, reconcileMissingMappedVariants } = require("./simply-supplements-offer-refresh");

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
