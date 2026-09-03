const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/simply-supplements-offer-sync.json");
const { canonicalHash, loadApprovedManifest, projectSourceVariants, reconcileMissingMappedVariants, registrationRequest } = require("./simply-supplements-offer-refresh");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { baselineHash, verifyPostflight } = require("./retailer-offer-refresh-postflight");

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

test("Simply schedule isolates unsafe rows", () => {
  assert.match(workflow, /--isolate-unsafe=true/g);
  assert.match(automation, /approved_mapping_count:config\.approved_mapping_count,.*executable_plan_count:executablePlanCount,executed_plan_count:0,review_row_count:reviewRows\.length,blocked_row_count:0/);
  assert.match(automation, /missing_variants_review_only:missingReviewOnly,missing_variants_marked_unavailable:run\.discovery\.missing_variants\.length-missingReviewOnly/);
  assert.match(automation, /executed_plan_count:appliedRows/);
});

test("Simply build start does not inherit the Fit House stable OOS exception", () => {
  const engine = require("./simply-supplements-offer-refresh");
  assert.equal(config.approved_stable_oos_baseline, undefined);
  assert.equal(engine.approvedStableOosBaseline(), null);
  const diagnostic = { guard_results: [] };
  assert.equal(engine.applyApprovedStableOosBaselineGuard({ records: [] }, diagnostic), null);
  assert.deepEqual(diagnostic.guard_results, []);
  try {
    config.approved_stable_oos_baseline = { count: 103 };
    assert.throws(() => engine.approvedStableOosBaseline(), /must not define the Fit House stable OOS baseline/);
  } finally {
    delete config.approved_stable_oos_baseline;
  }
});

test("Simply shipping follows the existing £20 threshold", () => {
  const rows = projectSourceVariants({ products: [{ id: 1, handle: "p", variants: [
    { id: 2, price: "19.99", available: true },
    { id: 3, price: "20.00", available: true },
  ] }] });
  assert.equal(rows[0].shipping_cost, "1.99");
  assert.equal(rows[1].shipping_cost, "0.00");
});

test("Simply missing mapped variants stay unchanged in review while safe rows remain executable", () => {
  const missing = { offer_id: "1", retailer_product_id: "2", external_product_id: "3", external_variant_id: "4", external_sku: null, price: "10.00", shipping_cost: "1.99", total_price: "11.99", in_stock: true, url: "https://www.awin1.com/pclick.php?p=1", external_url: "https://www.simplysupplements.co.uk/products/missing?variant=4" };
  assert.throws(() => reconcileMissingMappedVariants([missing], [], config.discovery_policy), /safety limit exceeded/);
  const isolated = reconcileMissingMappedVariants([missing], [], config.discovery_policy, { isolateUnsafe: true });
  assert.deepEqual(isolated.missingVariantIds, ["4"]);
  assert.equal(isolated.sourceVariants.length, 0);
  assert.equal(isolated.newUnavailableCount, 0);
  const classification = classifyExistingOffers({
    targets: [missing], sourceVariants: isolated.sourceVariants,
    policy: { ...config.guardrails, required_matched_offers: 1, store_url: config.store_url },
    sourceCapturedAt: "2026-08-30T00:00:00.000Z", now: new Date("2026-08-30T00:00:01.000Z"),
    sourceProductCount: 269, previousSourceProductCount: 276, guardScope: { name: "SIMPLY_TEST" }, quarantineUnsafeRows: true,
  });
  assert.equal(classification.state, "DRY_RUN_READY_WITH_REVIEW");
  assert.equal(classification.rows.length, 0);
  assert.deepEqual(classification.quarantined_rows.map((row) => [row.offer_id, row.reason]), [["1", "SOURCE_VARIANT_MISSING"]]);
  assert.equal(classification.quarantined_rows[0].source, null);
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
  const baselineIndex = workflow.indexOf("Capture Simply Supplements DB baseline read-only");
  const applyIndex = workflow.indexOf("Apply approved Simply Supplements offer refresh");
  const postflightIndex = workflow.indexOf("Verify Simply Supplements DB postflight read-only");
  assert.ok(baselineIndex > -1 && applyIndex > baselineIndex && postflightIndex > applyIndex);
  for (const name of ["Capture Simply Supplements DB baseline read-only", "Verify Simply Supplements DB postflight read-only"]) {
    const step = workflow.slice(workflow.indexOf(name), workflow.indexOf("\n      - name:", workflow.indexOf(name) + 1));
    assert.match(step, /SIMPLY_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL/);
    assert.doesNotMatch(step, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("Simply DB postflight proves executable freshness, review isolation and planned stock delta", () => {
  const row = (offerId, stock, checked) => ({ mapping_id: `m${offerId}`, retailer_id: "7", mapping_product_id: "10", mapping_variant_id: "11", external_product_id: "p", external_variant_id: `v${offerId}`, external_sku: null, external_gtin: null, external_options: {}, external_url: "https://www.simplysupplements.co.uk/products/p", offer_id: String(offerId), offer_product_id: "10", offer_variant_id: "11", price: "10.00", shipping_cost: "1.99", total_price: "11.99", in_stock: stock, url: "https://www.awin1.com/pclick.php?p=1", last_checked_at: checked });
  const snapshot = { row_count: 2, price_history_count: 4, rows: [row(1, true, "2026-08-29T00:00:00Z"), row(2, true, "2026-08-29T00:00:00Z")] };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "simply-supplements", snapshot };
  baseline.evidence_hash = baselineHash(baseline);
  const execution = { result: "PASS_WITH_REVIEW", approved_mapping_count: 2, executable_plan_count: 1, executed_plan_count: 1, review_row_count: 1, blocked_row_count: 0, review_rows: [{ offer_id: "2" }], expected_deltas: { row_count_deltas: { price_history: 0 }, logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 1, last_checked_at_updates: 1 } } };
  const after = { row_count: 2, price_history_count: 4, rows: [row(1, false, "2026-08-30T00:00:00Z"), row(2, true, "2026-08-29T00:00:00Z")] };
  const result = verifyPostflight(baseline, after, execution);
  assert.equal(result.result, "PASS");
  assert.equal(result.freshness_change_count, 1);
  assert.equal(result.stock_change_count, 1);
  assert.equal(verifyPostflight(baseline, {
    ...after,
    rows: [after.rows[0], { ...after.rows[1], last_checked_at: new Date(after.rows[1].last_checked_at) }],
  }, execution).result, "PASS");
  assert.throws(() => verifyPostflight(baseline, { ...after, rows: [after.rows[0], { ...after.rows[1], last_checked_at: "2026-08-30T00:00:00Z" }] }, execution), /Review offer 2 changed/);

  const rowBoundExecution = { ...execution, review_rows: undefined, rows: [{ offer_id: "1" }] };
  assert.equal(verifyPostflight(baseline, after, rowBoundExecution).freshness_change_count, 1);
  assert.throws(
    () => verifyPostflight(baseline, after, { ...rowBoundExecution, rows: [{ offer_id: "1" }, { offer_id: "2" }] }),
    /Execution offer scope differs from executed plan count/
  );

  const freshnessOnlyExecution = { result: "PASS", approved_mapping_count: 2, executable_plan_count: 2, executed_plan_count: 2, review_row_count: 0, blocked_row_count: 0, review_rows: [] };
  const freshnessOnlyAfter = { row_count: 2, price_history_count: 4, rows: [row(1, true, "2026-08-30T00:00:00Z"), row(2, true, "2026-08-30T00:00:00Z")] };
  assert.equal(verifyPostflight(baseline, freshnessOnlyAfter, freshnessOnlyExecution).freshness_change_count, 2);
});

test("DB baseline evidence hash is stable across PostgreSQL Date serialization", () => {
  const baseline = {
    schema_version: 1,
    kind: "retailer-offer-refresh-db-baseline",
    result: "PASS",
    profile: "simply-supplements",
    snapshot: {
      captured_at: new Date("2026-08-30T05:55:33.210Z"),
      rows: [{ last_checked_at: new Date("2026-08-24T05:50:16.642Z") }],
    },
  };
  const beforeSerialization = baselineHash(baseline);
  const persisted = JSON.parse(JSON.stringify({
    ...baseline,
    evidence_hash: beforeSerialization,
  }));
  assert.equal(persisted.evidence_hash, baselineHash(persisted));
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
    manifest: [{ mapping_id: "1", offer_id: "2", external_product_id: "3", external_variant_id: "4", canonical_product_id: "5", canonical_variant_id: "6" }],
    manifestFingerprint: "b".repeat(64),
    artifacts: [{ artifact_fingerprint: "c".repeat(64) }],
    snapshot: { semantic_source_fingerprint: "d".repeat(64) },
    capturedAt: "2026-08-03T20:00:00.000Z",
    head: "e".repeat(40),
    spec: { environment: "PRODUCTION", ref: "aftboxmrdgyhizicfsfu", identity: "supplementscout-production:aftboxmrdgyhizicfsfu" },
  };
  const request = registrationRequest(run);
  const reviewedManifest = [{ mapping_id: "1", offer_id: "2", external_product_id: "3", external_variant_id: "4" }];
  const expectedManifestFingerprint = canonicalHash(reviewedManifest);
  assert.deepEqual(request.manifest, reviewedManifest);
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
