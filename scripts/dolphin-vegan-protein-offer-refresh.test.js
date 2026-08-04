const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.RETAILER_REFRESH_PROFILE = "dolphin-vegan-protein";
const config = require("../config/retailers/dolphin-vegan-protein-offer-sync.json");
const engine = require("./dolphin-vegan-protein-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/dolphin-vegan-protein-offer-refresh.yml"), "utf8");

test("Dolphin automation is frozen to one existing mapping and offer", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path));
  const manifest = JSON.parse(bytes);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), config.manifest_sha256);
  assert.equal(manifest.rows.length, 1);
  assert.deepEqual(manifest.rows[0], {
    mapping_id: "2676", offer_id: "2490", external_product_id: "193943",
    external_variant_id: "193943-VANILLA", canonical_product_id: "70", canonical_variant_id: "1623",
  });
  assert.equal(config.policy.catalogue_creates, false);
  assert.equal(config.policy.mapping_creates, false);
  assert.equal(config.discovery_policy.catalogue_creates, false);
});

test("Dolphin uses product-page source and the protected common executor", () => {
  assert.equal(config.source_platform, "PRODUCT_PAGE");
  assert.equal(config.approved_mapping_count, 1);
  assert.equal(engine.loadApprovedManifest().manifest.rows.length, 1);
  assert.match(workflow, /cron: "27 5 \* \* \*"/);
  assert.match(workflow, /DOLPHIN_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /--target=production --mode=apply/);
  assert.doesNotMatch(workflow, /SAFE_UPDATE/);
});
