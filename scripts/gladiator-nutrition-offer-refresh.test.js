const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildExistingOfferUpdatePlan } = require("./lib/retailer-offer-sync/existing-offer-plan");
const { buildRowManifestStateRequests, readRowManifestState } = require("./lib/reviewed-catalogue-state");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");

process.env.RETAILER_REFRESH_PROFILE = "gladiator-nutrition";
const engine = require("./fit-house-offer-refresh");
const config = require("../config/retailers/gladiator-nutrition-offer-sync.json");
const manifest = require("../config/retailers/gladiator-nutrition-approved-offer-manifest.json");
const stagingConfig = require("../config/retailers/gladiator-nutrition-staging-offer-sync.json");
const stagingManifest = require("../config/retailers/gladiator-nutrition-staging-approved-offer-manifest.json");
const tenRepsConfig = require("../config/retailers/10reps-offer-sync.json");
const simplyConfig = require("../config/retailers/simply-supplements-offer-sync.json");

const ROOT = path.resolve(__dirname, "..");
const FORWARD = "20261027130000_add_gladiator_nutrition_offer_sync_registration.sql";
const ROLLBACK = "20261027130000_add_gladiator_nutrition_offer_sync_registration_rollback.sql";
const CLEAN_URL = "https://gladiatornutrition.co.uk/products/test?variant=57417961800054";
const AFFILIATE_URL = `${CLEAN_URL}&sca_ref=11968733.U3nlV04VwN4S`;
const CAPTURED_AT = "2026-10-26T12:00:00.000Z";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sha256Text(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n")).digest("hex");
}

function state({ price = "75.00", shipping = "0.00", total = "75.00", inStock = true } = {}) {
  return {
    product: { id: 1400, name: "Test Product", is_active: true, merged_into_product_id: null, product_format: "powder" },
    variant: { id: 4300, product_id: 1400, variant_key: "test", display_name: "Test", flavour_code: "test", flavour_label: "Test", size_value: "500", size_unit: "g", pack_count: null, product_format: "powder", is_active: true, is_default: false },
    retailer: { id: 15, name: "Gladiator Nutrition", slug: "gladiator-nutrition", website: "https://gladiatornutrition.co.uk" },
    mapping: { id: 5000, retailer_id: 15, product_id: 1400, product_variant_id: 4300, external_product_id: "15640537334134", external_variant_id: "57417961800054", external_sku: "TEST", external_options: { Flavour: "Test" }, external_name: "Test", external_slug: "test", external_gtin: null, external_url: CLEAN_URL, match_method: "EXACT", match_confidence: "1", updated_at: "2026-10-26T11:00:00.000000Z" },
    offer: { id: 6000, product_id: 1400, retailer_id: 15, product_variant_id: 4300, retailer_product_id: 5000, price, shipping_cost: shipping, total_price: total, in_stock: inStock, url: AFFILIATE_URL, last_checked_at: "2026-10-26T11:00:00.000000Z" },
  };
}

function source(values) {
  return {
    external_product_id: values.externalProductId || "15640537334134",
    external_variant_id: "57417961800054",
    price: values.price,
    shipping_cost: values.shipping,
    total_price: values.total,
    in_stock: values.inStock,
    url: AFFILIATE_URL,
  };
}

function stagingBoundedState(request) {
  const byExternalVariant = new Map(stagingManifest.rows.map(row => [String(row.external_variant_id), row]));
  const selected = request.rows.map(row => byExternalVariant.get(String(row.external_variant_id)));
  const productIds = [...new Set(selected.map(row => String(row.canonical_product_id)))];
  return {
    schema_version: 1,
    target_environment: request.target_environment,
    target_project_ref: request.target_project_ref,
    retailer: { id: 12, name: "Gladiator Nutrition", slug: "gladiator-nutrition", website: "https://gladiatornutrition.co.uk", created_at: CAPTURED_AT },
    products: productIds.map(id => ({ id, name: `Product ${id}`, is_active: true, merged_into_product_id: null, product_format: "powder", description: "bounded extra" })),
    product_variants: selected.map(row => ({ id: String(row.canonical_variant_id), product_id: String(row.canonical_product_id), variant_key: `variant-${row.canonical_variant_id}`, display_name: "Test", flavour_code: "test", flavour_label: "Test", size_value: "500", size_unit: "g", pack_count: 1, product_format: "powder", is_active: true, is_default: false, gtin: null })),
    retailer_products: selected.map(row => ({ id: String(row.mapping_id), retailer_id: 12, product_id: String(row.canonical_product_id), product_variant_id: String(row.canonical_variant_id), external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), external_sku: `SKU-${row.external_variant_id}`, external_options: { Flavour: "Test" }, external_name: "Test", external_slug: "test", external_gtin: null, external_url: `https://gladiatornutrition.co.uk/products/test?variant=${row.external_variant_id}`, match_method: "EXACT", match_confidence: "1", updated_at: CAPTURED_AT, created_at: CAPTURED_AT })),
    offers: selected.map(row => ({ id: String(row.offer_id), product_id: String(row.canonical_product_id), retailer_id: 12, product_variant_id: String(row.canonical_variant_id), retailer_product_id: String(row.mapping_id), price: "75.00", shipping_cost: "0.00", total_price: "75.00", in_stock: true, url: `https://gladiatornutrition.co.uk/products/test?variant=${row.external_variant_id}&sca_ref=11968733.U3nlV04VwN4S`, last_checked_at: "2026-10-26T11:00:00.000Z", created_at: CAPTURED_AT })),
    price_history: selected.map(row => ({ id: String(9000 + Number(row.offer_id)), offer_id: String(row.offer_id), price: "75.00" })),
    counts: { products: 995, product_variants: 2020, retailer_products: 46, offers: 46, price_history: 46 },
  };
}

function updatePlan(current, next) {
  return buildExistingOfferUpdatePlan({
    ...current,
    source: source(next),
    sourceCapturedAt: CAPTURED_AT,
    sourceSnapshotFingerprint: "a".repeat(64),
  });
}

test("Gladiator adopts the shared row-manifest profile with exactly 603 existing identities", () => {
  const manifestFile = path.join(ROOT, config.manifest_path);
  assert.equal(config.schema_version, 1);
  assert.equal(config.retailer_id, 15);
  assert.equal(config.source_platform, "SHOPIFY");
  assert.equal(config.manifest_mode, "row_manifest");
  assert.equal(config.approved_mapping_count, 603);
  assert.equal(config.manifest_sha256, "f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078");
  assert.equal(sha256(manifestFile), config.manifest_sha256);
  assert.equal(manifest.approved_mapping_count, 603);
  assert.equal(manifest.rows.length, 603);
  for (const field of ["mapping_id", "offer_id", "canonical_variant_id", "external_variant_id"]) {
    assert.equal(new Set(manifest.rows.map((row) => String(row[field]))).size, 603, `${field} must cover 603 distinct approved identities`);
  }
  assert.equal(new Set(manifest.rows.map((row) => String(row.canonical_product_id))).size, 90);
  assert.equal(new Set(manifest.rows.map((row) => String(row.external_product_id))).size, 94);
  assert.deepEqual(engine.loadApprovedManifest().manifest, manifest);
  assert.equal(config.policy.existing_identity_only, true);
  assert.equal(config.policy.catalogue_creates, false);
  assert.equal(config.policy.mapping_creates, false);
  assert.deepEqual(config.policy.allowed_fields, ["price", "in_stock", "last_checked_at"]);
  assert.equal(config.discovery_policy.mode, "report_only");
  assert.equal(config.schedule, undefined);
});

test("Gladiator registry keeps exact and isolated STAGING 12 and PRODUCTION 15 profiles", () => {
  const runtime = fs.readFileSync(path.join(ROOT, "scripts/fit-house-offer-refresh.js"), "utf8");
  assert.match(runtime, /"gladiator-nutrition-staging":"\.\.\/config\/retailers\/gladiator-nutrition-staging-offer-sync\.json"/);
  assert.equal(stagingConfig.retailer_id, 12);
  assert.equal(stagingConfig.retailer_slug, "gladiator-nutrition");
  assert.equal(stagingConfig.approved_mapping_count, 46);
  assert.equal(stagingConfig.manifest_path, "config/retailers/gladiator-nutrition-staging-approved-offer-manifest.json");
  assert.equal(stagingConfig.manifest_sha256, "fbee4533e7ea70948a1b229154222200e5275cba6388aea98c0d1d88cf285343");
  assert.equal(sha256(path.join(ROOT, stagingConfig.manifest_path)), stagingConfig.manifest_sha256);
  assert.equal(stagingManifest.retailer.id, 12);
  assert.equal(stagingManifest.approved_mapping_count, 46);
  assert.equal(stagingManifest.rows.length, 46);
  for (const field of ["mapping_id", "offer_id", "canonical_variant_id", "external_variant_id"])
    assert.equal(new Set(stagingManifest.rows.map((row) => String(row[field]))).size, 46, `${field} must cover 46 distinct STAGING identities`);
  assert.equal(config.retailer_id, 15);
  assert.equal(config.approved_mapping_count, 603);
  assert.equal(config.manifest_sha256, "f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078");
});

test("Gladiator STAGING exact 46-row manifest builds one bounded validator request", () => {
  const built = buildRowManifestStateRequests({
    targetEnvironment: "STAGING",
    targetProjectRef: "hxnrsyyqffztlvcrtgbf",
    retailer: stagingManifest.retailer,
    rows: stagingManifest.rows,
  });
  assert.equal(built.requests.length, 1);
  assert.equal(built.requests[0].rows.length, 46);
  assert.deepEqual(
    built.requests[0].rows.map((row) => row.external_variant_id).sort(),
    stagingManifest.rows.map((row) => String(row.external_variant_id)).sort(),
  );
  assert.ok(built.requests[0].rows.every((row) => row.product_id && row.product_variant_id));
});

test("Gladiator STAGING full bounded rows project into 46 closed verified-no-change plans", async () => {
  const client = { query: async (_sql, values) => ({ rows: [{ state: stagingBoundedState(values[0]) }] }) };
  const state = await readRowManifestState(client, {
    targetEnvironment: "STAGING",
    targetProjectRef: "hxnrsyyqffztlvcrtgbf",
    retailer: stagingManifest.retailer,
    rows: stagingManifest.rows,
  });
  const products = new Map(state.products.map(row => [String(row.id), row]));
  const variants = new Map(state.product_variants.map(row => [String(row.id), row]));
  const offers = new Map(state.offers.map(row => [String(row.retailer_product_id), row]));
  const snapshotHash = "a".repeat(64);
  const records = state.retailer_products.map(mapping => {
    const offer = offers.get(String(mapping.id));
    return engine.verificationRecord({
      product: products.get(String(mapping.product_id)),
      variant: variants.get(String(mapping.product_variant_id)),
      retailer: state.retailer,
      mapping,
      offer,
    }, {
      external_product_id: String(mapping.external_product_id),
      external_variant_id: String(mapping.external_variant_id),
      price: offer.price,
      shipping_cost: offer.shipping_cost,
      total_price: offer.total_price,
      in_stock: offer.in_stock,
      url: offer.url,
      external_url: mapping.external_url,
    }, snapshotHash, CAPTURED_AT);
  });
  const dryRun = buildVerifiedNoChangeDryRun(records, {
    expectedCount: 46,
    targetEnvironment: "STAGING",
    targetProjectRef: "hxnrsyyqffztlvcrtgbf",
    sourceSnapshotSha256s: [snapshotHash],
    now: new Date(CAPTURED_AT),
  });
  assert.equal(dryRun.result.planned, 46);
  assert.equal(dryRun.result.report.blockedRows.length, 0);
  for (const { importPlan, offerPlan } of dryRun.result.report.approvedRows) {
    assert.equal(importPlan.product.action, "existing");
    assert.equal(importPlan.product_variant.action, "existing");
    assert.equal(importPlan.retailer_product.action, "noop");
    assert.equal(importPlan.offer.action, "verify_no_change");
    assert.equal(importPlan.price_history.action, "noop");
    assert.equal(offerPlan.createsPriceHistory, false);
  }
});

test("Gladiator OOS limits match the shared read-only validator policy", () => {
  const assertCompatible = (profile) => {
    const guardrails = profile.guardrails;
    assert.ok(guardrails.full_snapshot_minimum_source_count_ratio >= 0.9 && guardrails.full_snapshot_minimum_source_count_ratio <= 1);
    assert.ok(guardrails.mass_oos_block_count - 1 >= 0 && guardrails.mass_oos_block_count - 1 <= 3);
    assert.ok(guardrails.maximum_oos_increase_percentage_points >= 0 && guardrails.maximum_oos_increase_percentage_points <= 0.15);
    assert.ok(guardrails.maximum_total_oos_ratio >= 0 && guardrails.maximum_total_oos_ratio <= 0.35);
    assert.ok(guardrails.maximum_changed_record_ratio >= 0 && guardrails.maximum_changed_record_ratio <= 0.25);
    assert.ok(guardrails.mass_price_change_block_ratio > 0 && guardrails.mass_price_change_block_ratio <= 0.2);
    assert.ok(guardrails.per_row_price_hard_block_ratio > 0 && guardrails.per_row_price_hard_block_ratio <= 0.6);
    assert.ok(Number(guardrails.per_row_price_hard_block_absolute_gbp) > 0 && Number(guardrails.per_row_price_hard_block_absolute_gbp) <= 20);
  };
  assert.equal(config.guardrails.maximum_total_oos_ratio, 0.35);
  assert.equal(stagingConfig.guardrails.maximum_total_oos_ratio, 0.35);
  assert.equal(tenRepsConfig.guardrails.maximum_total_oos_ratio, 0.35);
  assert.equal(simplyConfig.guardrails.maximum_total_oos_ratio, 0.35);
  assertCompatible(config);
  assertCompatible(stagingConfig);
});

test("environment binding changes no classifier, Shopify reader, reviewed executor or atomic importer", () => {
  const immutable = {
    "scripts/lib/retailer-offer-sync/classifier.js": "475ed7dbe9fa73b2903e152466fbdf5085b238a69c067a9e3a0e3eea0ee613a0",
    "scripts/lib/shopify-snapshot-reader.js": "06d93e363ee95e4bbd73a17bd2292d9d258efb677634fa148685c42277811fce",
    "scripts/reviewed-catalogue-package-executor.js": "3450d4ca82784c2494ed97b1fa96147c629d2ff4b6bc51dda58a7085d4c9fc88",
    "scripts/import-products.js": "44a1039499f0db75848ee78f0358b0d73b34e58ab30cc5d8b342f8837557708d",
    "supabase/migrations/20260718170000_add_read_only_mixed_batch_validator.sql": "09ece7d68328ee7e383375f6d13f55933e7c18be88137fa0108046d69f121510",
  };
  for (const [relative, expected] of Object.entries(immutable)) assert.equal(sha256Text(path.join(ROOT, relative)), expected, relative);
});

test("Gladiator threshold shipping is exact at 74.99, 75.00 and 75.01", () => {
  const rows = engine.projectSourceVariants({ products: [{ id: "1", handle: "test", variants: [
    { id: "1", price: "74.99", available: true },
    { id: "2", price: "75.00", available: true },
    { id: "3", price: "75.01", available: true },
  ] }] });
  assert.deepEqual(rows.map((row) => ({ price: row.price, shipping: row.shipping_cost, total: (Number(row.price) + Number(row.shipping_cost)).toFixed(2) })), [
    { price: "74.99", shipping: "6.99", total: "81.98" },
    { price: "75.00", shipping: "0.00", total: "75.00" },
    { price: "75.01", shipping: "0.00", total: "75.01" },
  ]);
});

test("threshold crossings preserve shared price-history and delivered-price semantics", () => {
  const belowToAbove = updatePlan(
    state({ price: "74.99", shipping: "6.99", total: "81.98" }),
    { price: "75.00", shipping: "0.00", total: "75.00", inStock: true },
  );
  const aboveToBelow = updatePlan(
    state({ price: "75.00", shipping: "0.00", total: "75.00" }),
    { price: "74.99", shipping: "6.99", total: "81.98", inStock: true },
  );
  for (const built of [belowToAbove, aboveToBelow]) {
    assert.deepEqual(built.changed, { price: true, stock: false, url: false });
    assert.equal(built.plan.price_history.action, "create");
  }
  assert.equal(Number(belowToAbove.plan.offer.values.shipping_cost), 0);
  assert.equal(Number(belowToAbove.plan.offer.values.total_price), 75);
  assert.equal(Number(aboveToBelow.plan.offer.values.shipping_cost), 6.99);
  assert.equal(Number(aboveToBelow.plan.offer.values.total_price), 81.98);
});

test("all shared action shapes preserve the clean mapping URL and exact affiliate offer URL", () => {
  const current = state();
  const verification = engine.verificationRecord(current, source({ price: "75.00", shipping: "0.00", total: "75.00", inStock: true }), "b".repeat(64), CAPTURED_AT);
  assert.equal(verification.target.retailer_product.external_url, CLEAN_URL);
  assert.equal(verification.target.offer.url, AFFILIATE_URL);
  assert.equal(verification.source.url, AFFILIATE_URL);

  const cases = [
    [{ price: "74.00", shipping: "6.99", total: "80.99", inStock: true }, { price: true, stock: false, url: false }],
    [{ price: "75.00", shipping: "0.00", total: "75.00", inStock: false }, { price: false, stock: true, url: false }],
    [{ price: "74.00", shipping: "6.99", total: "80.99", inStock: false }, { price: true, stock: true, url: false }],
  ];
  for (const [next, changed] of cases) {
    const built = updatePlan(current, next);
    assert.deepEqual(built.changed, changed);
    assert.equal(built.plan.expected_state.retailer_product.external_url, CLEAN_URL);
    assert.equal(built.plan.expected_state.offer.url, AFFILIATE_URL);
    assert.equal(built.plan.offer.values.url, AFFILIATE_URL);
    assert.equal(built.plan.retailer_product.action, "noop");
  }
  assert.equal(new URL(CLEAN_URL).searchParams.has("sca_ref"), false);
  assert.deepEqual(new URL(AFFILIATE_URL).searchParams.getAll("sca_ref"), ["11968733.U3nlV04VwN4S"]);
});

test("unknown, missing, identity-mismatched and collapsed sources remain isolated fail-closed", () => {
  const target = { external_product_id: "product-1", external_variant_id: "variant-1", in_stock: true, external_url: CLEAN_URL };
  const mapped = { external_product_id: "product-1", external_variant_id: "variant-1", price: "10.00", shipping_cost: "6.99", in_stock: true };
  const unknown = { external_product_id: "product-2", external_variant_id: "variant-2", price: "10.00", shipping_cost: "6.99", in_stock: true };
  const present = engine.reconcileMissingMappedVariants([target], [mapped, unknown], config.discovery_policy, { isolateUnsafe: true });
  assert.equal(present.sourceVariants.includes(unknown), true);
  assert.deepEqual(present.missingVariantIds, []);
  assert.equal(config.discovery_policy.catalogue_creates, false);

  const missing = engine.reconcileMissingMappedVariants([target], [unknown], config.discovery_policy, { isolateUnsafe: true });
  assert.deepEqual(missing.missingVariantIds, ["variant-1"]);
  assert.equal(missing.reviewOnly, true);
  assert.equal(missing.newUnavailableCount, 0);

  assert.throws(() => updatePlan(state(), { price: "75.00", shipping: "0.00", total: "75.00", inStock: false, externalProductId: "wrong" }), /identity drift/);
  const collapsedProducts = Array.from({ length: 100 }, (_, index) => ({ id: String(index), variants: Array.from({ length: 5 }, (__, variant) => ({ id: `${index}-${variant}` })) }));
  const health = engine.sourceHealth({ products: collapsedProducts }, Array.from({ length: 500 }, (_, index) => ({ external_variant_id: String(index) })));
  assert.notEqual(health.result, "PASS");
});

test("shared workflow routes Fit House, 10 Reps and Gladiator to their exact daily schedules", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  const fitHouseJob = workflow.match(/  fit-house-offer-refresh:[\s\S]*?(?=\n  ten-reps-offer-refresh:)/)?.[0] || "";
  const tenRepsJob = workflow.match(/  ten-reps-offer-refresh:[\s\S]*?(?=\n  gladiator-nutrition-offer-refresh:)/)?.[0] || "";
  const gladiatorJob = workflow.match(/  gladiator-nutrition-offer-refresh:[\s\S]*?(?=\n  refresh-review-queue:)/)?.[0] || "";
  assert.equal((workflow.match(/cron: "47 2 \* \* \*"/g) || []).length, 1);
  assert.equal((workflow.match(/cron: "17 8 \* \* \*"/g) || []).length, 1);
  assert.match(fitHouseJob, /github\.event_name == 'schedule' && github\.event\.schedule == '47 2 \* \* \*'/);
  assert.doesNotMatch(fitHouseJob, /github\.event\.schedule == '17 8 \* \* \*'/);
  assert.match(tenRepsJob, /github\.event_name == 'schedule' && github\.event\.schedule == '47 2 \* \* \*'/);
  assert.doesNotMatch(tenRepsJob, /github\.event\.schedule == '17 8 \* \* \*'/);
  assert.match(gladiatorJob, /github\.event_name == 'schedule' && github\.event\.schedule == '17 8 \* \* \*'/);
  assert.doesNotMatch(gladiatorJob, /github\.event\.schedule == '47 2 \* \* \*'/);
  assert.match(workflow, /group: retailer-offer-production-write[\s\S]*cancel-in-progress: false/);

  const runtimeBody = (job) => job.slice(job.indexOf("\n    runs-on:"));
  assert.equal(crypto.createHash("sha256").update(runtimeBody(fitHouseJob).replaceAll("\r\n", "\n")).digest("hex"), "4d3e118cb2151b946681cf6cacfaa0be4fe70f77688df4e1717bb6924d83db71");
  assert.equal(crypto.createHash("sha256").update(runtimeBody(tenRepsJob).replaceAll("\r\n", "\n")).digest("hex"), "9b0d7ead1f35faa61ae9efebd189bb40932c76c1dbe0092a5cfc7531f6e676eb");
});

test("Gladiator scheduled refresh reuses the shared guarded flow while manual apply stays unavailable", () => {
  const runtime = fs.readFileSync(path.join(ROOT, "scripts/fit-house-offer-refresh.js"), "utf8");
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  const gladiatorJob = workflow.match(/  gladiator-nutrition-offer-refresh:[\s\S]*?(?=\n  refresh-review-queue:)/)?.[0] || "";
  assert.equal((runtime.match(/gladiator-nutrition/g) || []).length, 4);
  assert.equal(sha256Text(path.join(ROOT, "scripts/fit-house-offer-refresh.js")), "fd0b23c0d084e38208396389bbadddb7a922e8ff0c692b67ba981b336a81573d");
  assert.doesNotMatch(runtime, /retailer_id\s*={2,3}\s*15|config\.retailer_id\s*={2,3}\s*15/);
  assert.match(gladiatorJob, /github\.event_name == 'workflow_dispatch'/);
  assert.match(gladiatorJob, /inputs\.operation == 'dry-run'[\s\S]*inputs\.operation == 'review-only'/);
  assert.match(gladiatorJob, /dry-run\|review-only/);
  assert.doesNotMatch(gladiatorJob, /inputs\.operation == 'apply'/);
  assert.match(gladiatorJob, /RETAILER_REFRESH_PROFILE: gladiator-nutrition/);
  assert.equal((gladiatorJob.match(/--mode=dry-run --isolate-unsafe=true/g) || []).length, 2);
  assert.equal((gladiatorJob.match(/--mode=apply --isolate-unsafe=true/g) || []).length, 1);
  assert.match(gladiatorJob, /--mode=baseline/);
  assert.match(gladiatorJob, /--mode=bind --profile=gladiator-nutrition/);
  assert.match(gladiatorJob, /Apply safe Gladiator Nutrition offer refresh rows[\s\S]*github\.event_name == 'schedule' && github\.event\.schedule == '17 8 \* \* \*'/);
  for (const credential of ["VALIDATOR", "APPROVER", "EXECUTOR"])
    assert.match(gladiatorJob, new RegExp(`GLADIATOR_NUTRITION_REFRESH_${credential}_DATABASE_URL: \\$\\{\\{ secrets\\.JONS_SYNC_${credential}_DATABASE_URL \\}\\}`));
  const orderedSteps = [
    "Dry-run exact approved Gladiator Nutrition offers",
    "Capture Gladiator Nutrition DB baseline read-only",
    "Validate fresh Gladiator Nutrition Review Queue binding",
    "Apply safe Gladiator Nutrition offer refresh rows",
    "Verify Gladiator Nutrition DB postflight read-only",
    "Verify Gladiator Nutrition idempotency with a fresh source capture",
    "Upload Gladiator Nutrition refresh evidence",
  ];
  for (let index = 1; index < orderedSteps.length; index += 1)
    assert.ok(gladiatorJob.indexOf(orderedSteps[index - 1]) < gladiatorJob.indexOf(orderedSteps[index]), `${orderedSteps[index]} must follow ${orderedSteps[index - 1]}`);
  assert.match(gladiatorJob, /--mode=postflight[\s\S]*production-db-postflight\.json/);
  assert.match(gladiatorJob, /actions\/upload-artifact@v7[\s\S]*gladiator-nutrition-offer-refresh-/);
  assert.doesNotMatch(gladiatorJob, /SUPABASE_SERVICE_ROLE_KEY|approve_automation_review|PENDING\s*(?:->|→)\s*APPROVED|register_gladiator/);
});

test("Gladiator scheduled and manual review evidence use the existing shared queue publisher without automatic owner approval", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  const queueJob = workflow.slice(workflow.indexOf("\n  refresh-review-queue:"), workflow.indexOf("\n  expired-control-plan-recovery:"));
  assert.match(queueJob, /inputs\.retailer == 'gladiator-nutrition'[\s\S]*inputs\.operation == 'review-only'/);
  assert.match(queueJob, /github\.event_name == 'schedule' && github\.event\.schedule == '17 8 \* \* \*'/);
  assert.match(queueJob, /profile: gladiator-nutrition/);
  assert.match(queueJob, /uses: \.\/\.github\/actions\/publish-automation-review-queue/);
  assert.doesNotMatch(queueJob, /--mode=apply|register_gladiator|APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(queueJob, /approve_automation_review|PENDING\s*(?:->|→)\s*APPROVED/);
  assert.equal(sha256Text(path.join(ROOT, ".github/workflows/automation-review-queue-worker.yml")), "0102a9f2426b478d6a4e29a12733dd3510a1f4cae7d9bb8c28b9c2fff3f89713");
});

test("registration migration is a thin exact-scope boundary and rollback is lineage-guarded", () => {
  const forwardPath = path.join(ROOT, "supabase", "migrations", FORWARD);
  const rollbackPath = path.join(ROOT, "supabase", "rollbacks", ROLLBACK);
  const forward = fs.readFileSync(forwardPath, "utf8");
  const rollback = fs.readFileSync(rollbackPath, "utf8");
  assert.equal(sha256(forwardPath), "88342c090c8c3e78d9c8413d1182972820cce5b588ed55ca4205f24a82d262c4");
  assert.equal(sha256(rollbackPath), "41ac86b81c02a831017ccd454519b3f82b6e7e8ce584ae694a8e287c00f21324");
  for (const token of ["create or replace function public.register_gladiator_nutrition_offer_sync_control_plan", "v_retailer_id:=12", "v_retailer_id:=15", "v_expected_manifest_count:=46", "v_expected_manifest_count:=603", "fbee4533e7ea70948a1b229154222200e5275cba6388aea98c0d1d88cf285343", "80a6183e2454b9ccfcfddf54680e6e3c0493f8095ce81ff01b050fcf801cb455", "f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078", "f2e46baa948348ccd92535095ad6833ee2a4b3b7a11547335c580e7a1b07962a", "retailer_catalogue_assert_migration_ledger", "security definer", "set search_path = pg_catalog, public, pg_temp"]) assert.match(forward.toLowerCase(), new RegExp(token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(forward, /where\s+(?:rp\.)?retailer_id\s*=\s*(?:12|15)\b/i);
  assert.doesNotMatch(forward, /dependency_group'\s*,\s*'retailer-offer-sync:(?:12|15):/i);
  assert.doesNotMatch(forward, /pg_get_functiondef\s*\(\s*['"]public\.register_fit_house_offer_sync_control_plan/i);
  assert.doesNotMatch(forward, /register_fit_house_offer_sync_control_plan/i);
  assert.doesNotMatch(forward, /replace\s*\(\s*v_definition\s*,/i);
  assert.doesNotMatch(forward, /overlay\s*\(/i);
  assert.doesNotMatch(forward, /execute\s+v_definition/i);
  assert.match(forward, /revoke all[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(forward, /creates no catalogue, offer, mapping, approval or price-history row/);
  assert.doesNotMatch(forward, /insert into public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/);
  assert.match(rollback, /v_sha256 <> '[0-9a-f]{64}'/);
  assert.doesNotMatch(rollback, /__GLADIATOR_REGISTRATION_FUNCTION_SHA256__/);
  assert.match(rollback, /rollback lineage or security guard failed/);
});
