const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/fit-house-offer-sync.json");
const {
  balancedExecutionBatches,
  parseArgs,
  sourceHealth,
} = require("./fit-house-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const automation = fs.readFileSync(
  path.join(__dirname, "fit-house-offer-refresh.js"),
  "utf8",
);

test("approved manifest is immutable, unique, and bound to 286 stable Shopify variants", () => {
  const file = path.join(ROOT, config.manifest_path);
  const bytes = fs.readFileSync(file);
  const manifest = JSON.parse(bytes);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    config.manifest_sha256,
  );
  assert.equal(manifest.retailer.id, 9);
  assert.equal(manifest.retailer.slug, "fit-house");
  assert.equal(manifest.rows.length, 286);
  assert.equal(new Set(manifest.rows.map((row) => row.external_variant_id)).size, 286);
  assert.ok(manifest.rows.every((row) =>
    /^\d{10,}$/.test(row.external_product_id) &&
    /^\d{10,}$/.test(row.external_variant_id)));
});

test("source growth is healthy and does not alter the approved scope", () => {
  const snapshot = {
    products: Array.from({ length: 240 }, () => ({ variants: [{}] })),
    source_diagnostic: { pagination_completed: true },
  };
  const variants = Array.from({ length: 370 }, () => ({}));
  assert.equal(sourceHealth(snapshot, variants).result, "PASS");
  assert.equal(config.discovery_policy.catalogue_creates, false);
});

test("source collapse remains fail closed", () => {
  const snapshot = {
    products: Array.from({ length: 100 }, () => ({ variants: [{}] })),
    source_diagnostic: { pagination_completed: true },
  };
  const result = sourceHealth(snapshot, Array.from({ length: 150 }, () => ({})));
  assert.equal(result.result, "BLOCK");
  assert.equal(result.code, "GENUINE_SOURCE_COLLAPSE");
});

test("historical OOS rows are balanced across validator children without changing coverage", () => {
  const rows = Array.from({ length: 286 }, (_, index) => ({
    offer_id: String(index + 1),
    atomic_plan: {
      expected_state: { offer: { in_stock: index >= 61 } },
      offer: { values: { in_stock: index >= 61 } },
    },
  }));
  const batches = balancedExecutionBatches(rows, 50);
  assert.equal(batches.length, 6);
  assert.equal(batches.flat().length, 286);
  assert.equal(new Set(batches.flat()).size, 286);
  assert.ok(batches.every((batch) =>
    batch.filter((row) => !row.atomic_plan.offer.values.in_stock).length / batch.length < 0.35));
});

test("CLI exposes only normal dry-run and apply modes", () => {
  assert.deepEqual(parseArgs(["--target=production", "--mode=dry-run"]), {
    target: "production",
    mode: "dry-run",
  });
  assert.throws(
    () => parseArgs(["--target=production", "--mode=apply", "--reviewed-manifest=x"]),
    /invalid argument/,
  );
});

test("automation is retailer-scoped, keeps SAFE_UPDATE unset, and creates no catalogue rows", () => {
  assert.match(automation, /retailer_id=9/);
  assert.match(automation, /Fit House approved scope must be 286\/286/);
  assert.match(automation, /missing mapped source identity/);
  assert.doesNotMatch(automation, /set_config\('app\.safe_update'/);
  assert.doesNotMatch(automation, /register_jons_offer_sync_control_plan/);
  assert.match(automation, /register_retailer_offer_sync_control_plan/);
  assert.equal(config.shipping_policy.cost_gbp, "3.99");
  assert.equal(config.guardrails.ignore_source_sku, true);
});
