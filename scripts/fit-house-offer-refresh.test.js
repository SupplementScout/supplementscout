const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/fit-house-offer-sync.json");
const {
  approvedStableOosBaseline,
  authorizeReviewedMassOos,
  balancedExecutionBatches,
  loadAuditedMissingVariantManifest,
  loadReviewedMassOosManifest,
  parseArgs,
  reconcileAuditedMissingVariants,
  reconcileMissingMappedVariants,
  requireAuditedMissingOwnerApproval,
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

test("owner-approved stable Fit House OOS baseline is exact and does not raise generic limits", () => {
  assert.deepEqual(approvedStableOosBaseline(), {
    retailer_id: 9,
    approved_mapping_count: 286,
    count: 103,
    maximum_new_oos_count: 3,
    require_total_oos_not_above_previous: true,
    authority: "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes",
    reviewed_manifest_sha256: "168b5c604482280dc17842b93b9b27c24db42952b0873b14b0b326a6c10883f1",
  });
  assert.equal(config.guardrails.maximum_total_oos_ratio, 0.35);
  assert.equal(config.guardrails.mass_oos_block_count, 4);
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

test("audited 78-row absence manifest is immutable evidence and not owner OOS authority", () => {
  const audited = loadAuditedMissingVariantManifest();
  assert.equal(audited.sha256, config.discovery_policy.audited_missing_variant_manifest_sha256);
  assert.equal(audited.manifest.row_count, 78);
  assert.equal(audited.manifest.review_status, "OWNER_OOS_APPROVAL_REQUIRED");
  assert.equal(audited.manifest.owner_authority, "owner-approved-only-two-rebinds-2026-08-10-no-approval-for-78-oos");
  assert.equal(audited.manifest.audit.capture_a.semantic_source_fingerprint, audited.manifest.audit.capture_b.semantic_source_fingerprint);
  assert.equal(new Set(audited.manifest.rows.map((row) => row.external_variant_id)).size, 78);
  assert.ok(!audited.manifest.rows.some((row) => ["45060374167792", "48124051816688"].includes(row.external_variant_id)));
});

function auditedRecord(row, overrides = {}) {
  return {
    product: { id: row.canonical_product_id },
    variant: { id: row.canonical_variant_id },
    mapping: {
      id: row.mapping_id,
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      external_sku: row.external_sku,
      external_url: `https://fithouse.uk/products/audited-${row.mapping_id}?variant=${row.external_variant_id}`,
    },
    offer: { id: row.offer_id, price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: true },
    ...overrides,
  };
}

test("audited reconciliation synthesizes only exact absences and a returned allowlisted variant uses live source", () => {
  const audited = loadAuditedMissingVariantManifest();
  const records = audited.manifest.rows.map((row) => auditedRecord(row));
  const returned = audited.manifest.rows[0];
  const live = {
    external_product_id: returned.external_product_id,
    external_variant_id: returned.external_variant_id,
    product_handle: "returned-live",
    external_sku: returned.external_sku,
    price: "7.77",
    shipping_cost: "3.99",
    in_stock: true,
  };
  const result = reconcileAuditedMissingVariants(records, [live], audited);
  assert.equal(result.sourceVariants.length, 78);
  assert.equal(result.sourceVariants[0], live);
  assert.deepEqual(result.returnedLive, [returned.external_variant_id]);
  assert.equal(result.missingVariantIds.length, 77);
  assert.ok(result.sourceVariants.slice(1).every((row) => row.audited_source_absent === true && row.in_stock === false));
  assert.equal(result.review_status, "OWNER_OOS_APPROVAL_REQUIRED");
});

test("a 79th missing mapping and any allowlisted tuple drift fail closed", () => {
  const audited = loadAuditedMissingVariantManifest();
  const records = audited.manifest.rows.map((row) => auditedRecord(row));
  const extra = auditedRecord({
    mapping_id: "99999", offer_id: "99998", canonical_product_id: "1", canonical_variant_id: "2",
    external_product_id: "3", external_variant_id: "4", external_sku: null,
  });
  assert.throws(
    () => reconcileAuditedMissingVariants([...records, extra], [], audited),
    (error) => error.code === "IDENTITY_DRIFT" && error.detail.unallowlisted_missing_variants.length === 1,
  );
  const drifted = structuredClone(records);
  drifted[0].variant.id = "999";
  assert.throws(() => reconcileAuditedMissingVariants(drifted, [], audited), /no longer matches its canonical mapping/);
});

test("audited evidence does not weaken generic missing or MASS_OOS limits", () => {
  assert.equal(config.discovery_policy.maximum_missing_mapped_variants, 28);
  assert.equal(config.discovery_policy.maximum_missing_mapped_variant_ratio, 0.1);
  assert.equal(config.guardrails.mass_oos_block_count, 4);
  assert.doesNotMatch(automation, /mass_oos_block_count:\s*config\.guardrails\.mass_oos_block_count\s*\+/);
  assert.match(automation, /review_status:\s*reconciled\.review_status/);
  assert.match(automation, /if\(auditedMissing\)\{\s*requireAuditedMissingOwnerApproval\(auditedMissing,reconciled,classified,reviewed\);\s*massOosAuthorization=\{classification:classified,review:null\};/);
});

test("three newly absent audited rows require owner approval before artifacts or registration", () => {
  const audited = loadAuditedMissingVariantManifest();
  const records = audited.manifest.rows.map((row, index) => auditedRecord(row, {
    offer: { id: row.offer_id, price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: index >= 75 },
  }));
  const reconciled = reconcileAuditedMissingVariants(records, [], audited);
  assert.equal(reconciled.missingVariantIds.length, 78);
  assert.equal(reconciled.newUnavailableCount, 3);
  const classification = { state: "DRY_RUN_READY", reason: null, rows: [] };
  assert.throws(
    () => requireAuditedMissingOwnerApproval(audited, reconciled, classification, null),
    (error) => error.code === "OWNER_OOS_APPROVAL_REQUIRED"
      && error.stage === "OWNER_APPROVAL"
      && error.detail.new_unavailable_count === 3
      && error.detail.artifacts_created === 0
      && error.detail.registration_attempted === false,
  );
  assert.ok(automation.indexOf("requireAuditedMissingOwnerApproval(auditedMissing,reconciled,classified,reviewed)") < automation.indexOf("const artifacts=[]"));
});

test("a returned audited variant may restock but cannot become absent again without owner approval", () => {
  const audited = loadAuditedMissingVariantManifest();
  const returned = audited.manifest.rows[0];
  const initiallyOos = audited.manifest.rows.map((row) => auditedRecord(row, {
    offer: { id: row.offer_id, price: "10.00", shipping_cost: "3.99", total_price: "13.99", in_stock: false },
  }));
  const live = {
    external_product_id: returned.external_product_id,
    external_variant_id: returned.external_variant_id,
    product_handle: "returned-live",
    external_sku: returned.external_sku,
    price: "10.00",
    shipping_cost: "3.99",
    in_stock: true,
  };
  const restock = reconcileAuditedMissingVariants(initiallyOos, [live], audited);
  assert.equal(restock.newUnavailableCount, 0);
  assert.doesNotThrow(() => requireAuditedMissingOwnerApproval(audited, restock, { state: "DRY_RUN_READY", reason: null }, null));

  const afterRestock = structuredClone(initiallyOos);
  afterRestock[0].offer.in_stock = true;
  const absentAgain = reconcileAuditedMissingVariants(afterRestock, [], audited);
  assert.equal(absentAgain.newUnavailableCount, 1);
  assert.throws(
    () => requireAuditedMissingOwnerApproval(audited, absentAgain, { state: "DRY_RUN_READY", reason: null }, null),
    (error) => error.code === "OWNER_OOS_APPROVAL_REQUIRED"
      && error.detail.artifacts_created === 0
      && error.detail.registration_attempted === false,
  );
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

test("price and other changes are spread below per-child database guard ratios", () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    offer_id: String(index + 1),
    action: index < 17 ? "UPDATE_PRICE" : index < 19 ? "UPDATE_STOCK" : "VERIFY_NO_CHANGE",
    changed_fields: { price: index < 17, stock: index >= 17 && index < 19, url: false, blocked: false },
    atomic_plan: {
      expected_state: { offer: { in_stock: true } },
      offer: { values: { in_stock: true } },
    },
  }));
  const batches = balancedExecutionBatches(rows, 50, 3);
  assert.equal(batches.length, 3);
  assert.equal(batches.flat().length, 120);
  for (const batch of batches) {
    assert.ok(batch.filter((row) => row.changed_fields.price).length / batch.length < 0.2);
    assert.ok(batch.filter((row) => row.action !== "VERIFY_NO_CHANGE").length / batch.length <= 0.25);
  }
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
