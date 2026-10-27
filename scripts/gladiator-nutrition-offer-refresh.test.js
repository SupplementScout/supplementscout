const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildExistingOfferUpdatePlan } = require("./lib/retailer-offer-sync/existing-offer-plan");
const { buildRowManifestStateRequests } = require("./lib/reviewed-catalogue-state");

process.env.RETAILER_REFRESH_PROFILE = "gladiator-nutrition";
const engine = require("./fit-house-offer-refresh");
const config = require("../config/retailers/gladiator-nutrition-offer-sync.json");
const manifest = require("../config/retailers/gladiator-nutrition-approved-offer-manifest.json");
const stagingConfig = require("../config/retailers/gladiator-nutrition-staging-offer-sync.json");
const stagingManifest = require("../config/retailers/gladiator-nutrition-staging-approved-offer-manifest.json");

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

test("environment binding changes no classifier, Shopify reader, reviewed executor or atomic importer", () => {
  const immutable = {
    "scripts/lib/retailer-offer-sync/classifier.js": "475ed7dbe9fa73b2903e152466fbdf5085b238a69c067a9e3a0e3eea0ee613a0",
    "scripts/lib/shopify-snapshot-reader.js": "06d93e363ee95e4bbd73a17bd2292d9d258efb677634fa148685c42277811fce",
    "scripts/reviewed-catalogue-package-executor.js": "3450d4ca82784c2494ed97b1fa96147c629d2ff4b6bc51dda58a7085d4c9fc88",
    "scripts/import-products.js": "44a1039499f0db75848ee78f0358b0d73b34e58ab30cc5d8b342f8837557708d",
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

test("Gladiator wiring is registry-only and its workflow is manual shadow with no write path", () => {
  const runtime = fs.readFileSync(path.join(ROOT, "scripts/fit-house-offer-refresh.js"), "utf8");
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  const gladiatorJob = workflow.match(/  gladiator-nutrition-shadow:[\s\S]*?(?=\n  refresh-review-queue:)/)?.[0] || "";
  assert.equal((runtime.match(/gladiator-nutrition/g) || []).length, 4);
  assert.doesNotMatch(runtime, /retailer_id\s*={2,3}\s*15|config\.retailer_id\s*={2,3}\s*15/);
  assert.match(gladiatorJob, /github\.event_name == 'workflow_dispatch'/);
  assert.match(gladiatorJob, /inputs\.operation == 'dry-run'/);
  assert.doesNotMatch(gladiatorJob, /github\.event_name == 'schedule'/);
  assert.doesNotMatch(gladiatorJob, /--mode=apply|automation-review-reconciliation-apply|register_gladiator|APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gladiatorJob, /--mode=dry-run --isolate-unsafe=true/);
  assert.match(gladiatorJob, /--mode=baseline/);
  assert.match(gladiatorJob, /--mode=bind --profile=gladiator-nutrition/);
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
