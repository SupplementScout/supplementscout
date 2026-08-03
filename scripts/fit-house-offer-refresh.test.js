const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/fit-house-offer-sync.json");
const {
  authorizeReviewedMassOos,
  balancedExecutionBatches,
  loadReviewedMassOosManifest,
  parseArgs,
  reconcileMissingMappedVariants,
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

test("missing approved Shopify variants become bounded unavailable evidence", () => {
  const targets = [
    {
      external_product_id: "8147819069680",
      external_variant_id: "44818828853424",
      external_sku: "FH-OLD",
      price: "36.99",
      shipping_cost: "3.99",
      total_price: "40.98",
      in_stock: true,
      url: "https://fithouse.uk/products/7nutrition-whey-isolate-90-1kg?variant=44818828853424",
      external_url: "https://fithouse.uk/products/7nutrition-whey-isolate-90-1kg?variant=44818828853424",
    },
  ];
  const result = reconcileMissingMappedVariants(targets, [], {
    missing_mapped_variant_mode: "MARK_UNAVAILABLE",
    maximum_missing_mapped_variants: 1,
    maximum_missing_mapped_variant_ratio: 1,
  });
  assert.equal(result.newUnavailableCount, 1);
  assert.deepEqual(result.missingVariantIds, ["44818828853424"]);
  assert.equal(result.sourceVariants[0].in_stock, false);
  assert.equal(result.sourceVariants[0].price, "36.99");
  assert.equal(result.sourceVariants[0].product_handle, "7nutrition-whey-isolate-90-1kg");
});

test("missing mapped variant reconciliation fails closed outside its exact limits", () => {
  const target = {
    external_product_id: "8147819069680",
    external_variant_id: "44818828853424",
    price: "36.99",
    shipping_cost: "3.99",
    total_price: "40.98",
    in_stock: true,
    url: "https://fithouse.uk/products/7nutrition-whey-isolate-90-1kg?variant=44818828853424",
  };
  assert.throws(() => reconcileMissingMappedVariants([target], [], {
    missing_mapped_variant_mode: "MARK_UNAVAILABLE",
    maximum_missing_mapped_variants: 0,
    maximum_missing_mapped_variant_ratio: 0,
  }), /safety limit exceeded/);
  assert.throws(() => reconcileMissingMappedVariants([{...target,url:"https://example.com/products/wrong"}], [], {
    missing_mapped_variant_mode: "MARK_UNAVAILABLE",
    maximum_missing_mapped_variants: 1,
    maximum_missing_mapped_variant_ratio: 1,
  }), /URL domain drift/);
});

test("reviewed mass OOS authorization is hash-bound to the exact source and rows", () => {
  const reviewed = loadReviewedMassOosManifest();
  assert.equal(reviewed.sha256, config.discovery_policy.reviewed_mass_oos_manifest_sha256);
  assert.equal(reviewed.manifest.row_count, 18);
  const rows = reviewed.manifest.rows.map((row) => ({
    offer_id: row.offer_id,
    retailer_product_id: row.mapping_id,
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    action: row.action,
    target: { price: row.old_price, in_stock: row.old_stock },
    source: { price: row.new_price, in_stock: row.new_stock },
  }));
  const classification = { state: "BLOCKED", reason: "MASS_OOS", rows };
  const authorized = authorizeReviewedMassOos(
    classification,
    reviewed.manifest.source_snapshot_fingerprint,
  );
  assert.equal(authorized.classification.state, "DRY_RUN_READY");
  assert.equal(authorized.review.row_count, 18);
  assert.throws(
    () => authorizeReviewedMassOos(classification, "0".repeat(64)),
    /source fingerprint drift/,
  );
  const drifted = structuredClone(classification);
  drifted.rows[0].source.price = "6.99";
  assert.throws(
    () => authorizeReviewedMassOos(
      drifted,
      reviewed.manifest.source_snapshot_fingerprint,
    ),
    /scope drift/,
  );
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

test("new unavailable rows are split within the database validator limit", () => {
  const rows = Array.from({ length: 286 }, (_, index) => ({
    offer_id: String(index + 1),
    atomic_plan: {
      expected_state: { offer: { in_stock: true } },
      offer: { values: { in_stock: index >= 20 } },
    },
  }));
  const batches = balancedExecutionBatches(rows, 50, 3);
  assert.equal(batches.length, 7);
  assert.equal(batches.flat().length, 286);
  assert.ok(batches.every((batch) =>
    batch.filter((row) =>
      row.atomic_plan.expected_state.offer.in_stock &&
      !row.atomic_plan.offer.values.in_stock
    ).length <= 3));
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
  assert.match(automation, /config\.retailer_id/);
  assert.match(automation, /config\.approved_mapping_count/);
  assert.match(automation, /missing_mapped_variant_mode/);
  assert.doesNotMatch(automation, /missing mapped source identity/);
  assert.doesNotMatch(automation, /set_config\('app\.safe_update'/);
  assert.doesNotMatch(automation, /register_jons_offer_sync_control_plan/);
  assert.match(automation, /config\.registration_rpc/);
  assert.match(automation, /manifest_sha256\.toUpperCase\(\)/);
  assert.equal(config.shipping_policy.cost_gbp, "3.99");
  assert.equal(config.guardrails.ignore_source_sku, true);
});
