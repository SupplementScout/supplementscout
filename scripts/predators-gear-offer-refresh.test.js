const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = require("../config/retailers/predators-gear-offer-sync.json");
const manifest = require("../config/retailers/predators-gear-approved-offer-manifest.json");
const engine = require("./predators-gear-offer-refresh");
const { readWooCommerceMappedSnapshot } = require("./lib/woocommerce-mapped-snapshot-reader");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");

const ROOT = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/predators-gear-offer-refresh.yml"), "utf8");

function groups() {
  const result = new Map();
  for (const row of manifest.rows) {
    const id = String(row.external_product_id);
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(row);
  }
  return result;
}

function fixtureHtml(productId, rows, canonicalUrl, { identity = productId } = {}) {
  if (rows.length === 1 && String(rows[0].external_variant_id) === productId) {
    return `<body class="postid-${identity}"><script type="application/ld+json">${JSON.stringify({
      "@type": "Product", name: `Product ${productId}`, offers: { "@type": "Offer", price: "19.99", priceCurrency: "GBP", availability: "https://schema.org/InStock", url: canonicalUrl },
    })}</script></body>`;
  }
  const payload = JSON.stringify(rows.map((row, index) => ({ variation_id: Number(row.external_variant_id), attributes: {}, display_price: 20 + index, display_regular_price: 20 + index, is_in_stock: true, is_purchasable: true, variation_is_active: true }))).replaceAll('"', "&quot;");
  return `<body class="postid-${identity}"><form data-product_id="${productId}" data-product_variations="${payload}"></form></body>`;
}

function fixtureFetch({ failProductId = null, driftProductId = null } = {}) {
  const byUrl = new Map();
  for (const [productId, rows] of groups()) for (const row of rows) byUrl.set(row.external_url, { productId, rows });
  return async (url) => {
    const group = byUrl.get(String(url));
    assert.ok(group, `unexpected fixture URL ${url}`);
    if (group.productId === failProductId) return { status: 403, url: String(url), headers: { get: () => null } };
    const finalUrl = `https://predatorsgear.co.uk/supplements-vitamins-shop/fixture-${group.productId}/`;
    const html = fixtureHtml(group.productId, group.rows, finalUrl, { identity: group.productId === driftProductId ? "999" : group.productId });
    return { status: 200, url: finalUrl, headers: { get: (name) => name === "content-type" ? "text/html; charset=UTF-8" : null }, body: null, text: async () => html };
  };
}

function classifierScenario() {
  const targets = manifest.rows.map((row) => ({ offer_id: row.offer_id, retailer_product_id: row.mapping_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, price: "20.00", shipping_cost: "0.00", total_price: "20.00", in_stock: true, url: row.external_url, external_url: row.external_url }));
  const sourceVariants = targets.map((row) => ({ external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, price: "20.00", shipping_cost: "0.00", total_price: "20.00", in_stock: true }));
  return { targets, sourceVariants, policy: { ...config.guardrails, store_url: config.store_url }, sourceCapturedAt: "2026-09-03T09:00:00.000Z", now: new Date("2026-09-03T09:00:01.000Z"), sourceProductCount: 29, previousSourceProductCount: 29, guardScope: { name: config.guard_scope_name, retailer: config.retailer_name } };
}

test("Predators Gear automation is frozen to the exact 47 existing mappings and creates nothing", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path), "utf8").replace(/\r\n/g, "\n");
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), config.manifest_sha256);
  assert.equal(config.retailer_id, 13);
  assert.equal(manifest.rows.length, 47);
  assert.equal(new Set(manifest.rows.map((row) => row.mapping_id)).size, 47);
  assert.equal(new Set(manifest.rows.map((row) => row.offer_id)).size, 47);
  assert.equal(new Set(manifest.rows.map((row) => row.external_variant_id)).size, 47);
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.policy.catalogue_creates, false);
  assert.equal(config.policy.mapping_creates, false);
});

test("Predators Gear exact scope fingerprint detects mapping and canonical drift", () => {
  const approved = engine.normalizeExactScopeRows(manifest.rows);
  const drifted = approved.map((row, index) => index === 0
    ? { ...row, canonical_product_id: String(Number(row.canonical_product_id) + 1) }
    : row);
  assert.notEqual(engine.canonicalHash(drifted), engine.canonicalHash(approved));
  const runtime = fs.readFileSync(path.join(ROOT, "scripts/fit-house-offer-refresh.js"), "utf8");
  assert.match(runtime, /exact mapping and offer scope drift/);
});

test("Predators Gear proof workflow is manual, validator-only and cannot apply or schedule", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: production-readonly/);
  assert.match(workflow, /PREDATORS_GEAR_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /--target=production --mode=dry-run --isolate-unsafe=true/);
  assert.doesNotMatch(workflow, /\bschedule:/);
  assert.doesNotMatch(workflow, /--mode=apply|APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL/);
});

test("mapped WooCommerce capture reads only approved identities and reports discoveries without creating them", async () => {
  const snapshot = await readWooCommerceMappedSnapshot({ storeUrl: config.store_url, manifestRows: manifest.rows, expectedCount: 47, fetchImpl: fixtureFetch(), capturedAt: "2026-09-03T09:00:00.000Z", maximumAttempts: 1, allowedPathPrefixes: config.source_fetch.allowed_path_prefixes });
  assert.equal(snapshot.products.length, 29);
  assert.equal(snapshot.source_variants.length, 47);
  assert.equal(snapshot.issues.length, 0);
  assert.deepEqual(snapshot.discovered_variant_ids, []);
  assert.match(snapshot.semantic_source_fingerprint, /^[0-9a-f]{64}$/);
});

test("source HTTP failures and product identity drift are isolated as read-only review evidence", async () => {
  const firstProduct = String(manifest.rows[0].external_product_id);
  for (const options of [{ failProductId: firstProduct }, { driftProductId: firstProduct }]) {
    const snapshot = await readWooCommerceMappedSnapshot({ storeUrl: config.store_url, manifestRows: manifest.rows, expectedCount: 47, fetchImpl: fixtureFetch(options), capturedAt: "2026-09-03T09:00:00.000Z", maximumAttempts: 1, allowedPathPrefixes: config.source_fetch.allowed_path_prefixes });
    assert.equal(snapshot.products.length, 28);
    assert.ok(snapshot.issues.some((issue) => issue.external_product_id === firstProduct));
    assert.ok(snapshot.issues.some((issue) => issue.code === "SOURCE_VARIANT_MISSING"));
  }
});

test("shared commercial guards quarantine a hard price row and block mass OOS", () => {
  const price = classifierScenario();
  price.sourceVariants[0].price = "99.00";
  price.sourceVariants[0].total_price = "99.00";
  price.quarantineUnsafeRows = true;
  const isolated = classifyExistingOffers(price);
  assert.equal(isolated.state, "DRY_RUN_READY_WITH_REVIEW");
  assert.deepEqual(isolated.quarantined_rows.map((row) => row.reason), ["HARD_PRICE_ANOMALY"]);
  assert.equal(isolated.rows.length, 46);

  const stock = classifierScenario();
  for (const row of stock.sourceVariants.slice(0, 4)) row.in_stock = false;
  const blocked = classifyExistingOffers(stock);
  assert.equal(blocked.state, "BLOCKED");
  assert.equal(blocked.reason, "MASS_OOS");
});
