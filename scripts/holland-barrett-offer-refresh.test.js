const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const test = require("node:test");
const { digest } = require("./lib/partnerize-product-feed-projector");
const config = require("../config/retailers/holland-barrett-offer-sync.json");
const manifest = require("../config/retailers/holland-barrett-existing-offer-manifest.json");
const ROOT = path.resolve(__dirname, "..");
const identities = new Map(manifest.source_identity_baseline.map(row => [row.external_variant_id, row]));

function records() {
  return manifest.rows.map(row => {
    const identity = identities.get(row.external_variant_id).identity;
    return {
      product: { id: row.canonical_product_id, name: `Fixture ${row.canonical_product_id}`, is_active: true, merged_into_product_id: null, product_format: "capsule" },
      variant: { id: row.canonical_variant_id, product_id: row.canonical_product_id, variant_key: `fixture-${row.canonical_variant_id}`, display_name: "Fixture", flavour_code: null, flavour_label: null, size_value: "60", size_unit: "capsules", pack_count: null, product_format: "capsule", is_active: true, is_default: false },
      retailer: { id: 16, name: config.retailer_name, slug: config.retailer_slug, website: config.store_url },
      mapping: { id: row.mapping_id, retailer_id: 16, product_id: row.canonical_product_id, product_variant_id: row.canonical_variant_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: identity.sku, external_options: null, external_name: identity.product_name, external_slug: null, external_gtin: identity.gtin, external_url: identity.merchant_url, match_method: "reviewed", match_confidence: "100", updated_at: "2026-11-16T01:00:00Z" },
      offer: { id: row.offer_id, product_id: row.canonical_product_id, retailer_id: 16, product_variant_id: row.canonical_variant_id, retailer_product_id: row.mapping_id, price: "10.00", shipping_cost: "3.49", total_price: "13.49", in_stock: true, url: `https://prf.hn/click/camref:fixture/destination:${encodeURIComponent(identity.merchant_url)}`, last_checked_at: "2026-11-16T01:00:00Z" },
    };
  });
}

function snapshot() {
  const rows = manifest.rows.map(row => {
    const proof = identities.get(row.external_variant_id);
    return { external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
      external_sku: proof.identity.sku, external_gtin: proof.identity.gtin, source_identity: structuredClone(proof.identity),
      product_handle: new URL(proof.identity.merchant_url).pathname.slice(1), url: proof.identity.merchant_url,
      price: "10.00", shipping_cost: "3.49", total_price: "13.49", in_stock: true,
      source_validation: { status: "VALID", errors: [], identity_status: "VERIFIED", expected_identity_sha256: proof.sha256,
        observed_identity_sha256: proof.sha256, changed_identity_fields: [] } };
  });
  for (let index = rows.length; index < 4732; index += 1) rows.push({ external_product_id: `fixture-new-${index}`, external_variant_id: `fixture-new-${index}`, external_sku: `fixture-new-${index}`, price: "10.00", in_stock: true, source_validation: { status: "VALID", errors: [], identity_status: "UNREVIEWED" } });
  return { schema_version: 1, captured_at: new Date().toISOString(), products: rows.map(row => ({ external_product_id: row.external_product_id, variants: [{ external_variant_id: row.external_variant_id }] })),
    source_variants: rows, issues: [], raw_source_fingerprint: digest("synthetic fixture source"), semantic_source_fingerprint: digest(rows),
    source_diagnostic: { pagination_completed: true, final_http_status: 200, row_count: rows.length, supplier_generated_at: null, http_last_modified: new Date(Date.now() - 3600000).toISOString() } };
}

// Substitute only the read-only connector, never an approval, validator or executor.
function loadEngine(source) {
  const filename = path.join(ROOT, "scripts/fit-house-offer-refresh.js");
  const localRequire = createRequire(filename);
  const fixtureModule = { exports: {} };
  const context = { module: fixtureModule, exports: fixtureModule.exports, __dirname: path.dirname(filename), __filename: filename,
    require(name) { return name === "./lib/partnerize-product-feed-reader" ? { async readPartnerizeProductFeed(options) {
      assert.equal(options.feedUrlSha256, config.source_url_sha256);
      assert.equal(options.reviewedIdentities.length, 219);
      assert.equal(options.maximumBytes, 12000000);
      return source;
    } } : localRequire(name); },
    process: { ...process, env: { ...process.env, RETAILER_REFRESH_PROFILE: "holland-barrett", HOLLAND_BARRETT_PARTNERIZE_FEED_URL: "https://feeds.performancehorizon.com/fixture" } },
    URL, Date, Buffer, console, setTimeout, clearTimeout, AbortController };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return fixtureModule.exports;
}

async function build(source = snapshot()) {
  const engine = loadEngine(source);
  const state = { records: records(), counts: { products: 219, product_variants: 219, retailer_products: 219, offers: 219, price_history: 219 } };
  return { engine, state, run: await engine.buildRun("production", state, null, null, true) };
}

test("H&B candidate scope pins exactly 219 existing mappings and identity seals without authorizing writes", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path), "utf8").replaceAll("\r\n", "\n");
  assert.equal(digest(bytes), config.manifest_sha256);
  assert.equal(config.preparation_only, true);
  assert.equal(manifest.authorization.status, "OWNER_APPROVAL_REQUIRED");
  assert.equal(manifest.authorization.production_apply, false);
  assert.equal(manifest.rows.length, 219);
  assert.equal(identities.size, 219);
  assert.equal(new Set(manifest.rows.map(row => row.mapping_id)).size, 219);
  assert.equal(new Set(manifest.rows.map(row => row.offer_id)).size, 219);
  for (const row of manifest.rows) {
    assert.deepEqual(Object.keys(row).sort(), ["canonical_product_id", "canonical_variant_id", "external_product_id", "external_variant_id", "mapping_id", "offer_id"]);
    const proof = identities.get(row.external_variant_id);
    assert.match(row.external_variant_id, /^\d{6}$/);
    assert.equal(row.external_product_id, proof.identity.sku);
    assert.equal(row.external_variant_id, proof.identity.sku);
    assert.equal(digest(proof.identity), proof.sha256);
  }
});

test("H&B profile uses source delivery with immutable affiliate URLs and report-only discovery", () => {
  const engine = loadEngine(snapshot());
  const source = snapshot();
  source.source_variants[0].shipping_cost = null;
  assert.equal(engine.projectSourceVariants(source)[0].shipping_cost, null);
  assert.equal(config.guardrails.require_source_identity, true);
  assert.equal(config.guardrails.require_unchanged_shipping, true);
  assert.equal(config.guardrails.preserve_existing_urls, true);
  assert.equal(config.discovery_policy.catalogue_creates, false);
  assert.equal(config.discovery_policy.missing_mapped_variant_mode, "BLOCK");
  const targets = engine.sourceIdentityTargets(records(), manifest);
  assert.equal(targets[0].external_gtin, identities.get(targets[0].external_variant_id).identity.gtin);
  assert.equal(targets[0].source_identity_sha256, identities.get(targets[0].external_variant_id).sha256);
});

test("full shared builder accounts for 217 unchanged and two missing records without OOS or discovery plans", async () => {
  const source = snapshot();
  source.source_variants.splice(0, 2);
  source.products.splice(0, 2);
  const { run } = await build(source);
  assert.equal(run.classification.rows.length, 217);
  assert.equal(run.classification.quarantined_rows.length, 2);
  assert.ok(run.classification.quarantined_rows.every(row => row.reason === "SOURCE_VARIANT_MISSING" && row.source === null));
  const plans = run.artifacts.flatMap(artifact => artifact.rows);
  assert.equal(plans.length, 217);
  assert.equal(new Set(plans.map(row => row.offer_id)).size, 217);
  for (const row of plans) {
    assert.equal(row.action, "VERIFY_NO_CHANGE");
    assert.equal(row.atomic_plan.product.action, "existing");
    assert.equal(row.atomic_plan.product_variant.action, "existing");
    assert.equal(row.atomic_plan.retailer_product.action, "noop");
    assert.equal(row.atomic_plan.price_history.action, "noop");
    assert.equal(row.expected_deltas.logical_field_deltas.offer_stock_updates, 0);
  }
});

test("H&B price, stock and compound changes use the existing atomic plan and exact history deltas", async () => {
  const source = snapshot();
  source.source_variants[0].price = "11.00"; source.source_variants[0].total_price = "14.49";
  source.source_variants[1].in_stock = false;
  source.source_variants[2].price = "9.00"; source.source_variants[2].total_price = "12.49"; source.source_variants[2].in_stock = false;
  const { run, state } = await build(source);
  const rows = run.artifacts.flatMap(artifact => artifact.rows);
  const byOffer = new Map(rows.map(row => [row.offer_id, row]));
  assert.equal(rows.length, 219);
  for (const [index, action, history] of [[0, "UPDATE_PRICE", "create"], [1, "UPDATE_STOCK", "noop"], [2, "UPDATE_PRICE_AND_STOCK", "create"]]) {
    const row = byOffer.get(String(state.records[index].offer.id));
    assert.equal(row.action, action);
    assert.equal(row.atomic_plan.price_history.action, history);
    assert.equal(row.atomic_plan.offer.values.url, state.records[index].offer.url);
    assert.equal(row.atomic_plan.retailer_product.values.external_url, state.records[index].mapping.external_url);
    assert.equal(row.atomic_plan.retailer_product.values.external_gtin, state.records[index].mapping.external_gtin);
    assert.equal(row.atomic_plan.retailer_product.values.external_options, null);
    assert.equal(row.atomic_plan.approval.approved, false);
  }
  assert.equal(run.classification.expected_deltas.row_count_deltas.price_history, 2);
  assert.equal(run.classification.expected_deltas.logical_field_deltas.offer_stock_updates, 2);
});

test("full builder keeps invalid source, changed identity and delivery drift outside every child plan", async () => {
  const source = snapshot();
  source.source_variants[0].in_stock = null;
  source.source_variants[1].source_identity.product_name = "Changed formulation";
  source.source_variants[2].shipping_cost = "0.00"; source.source_variants[2].total_price = "10.00";
  const { run, engine } = await build(source);
  const held = run.classification.quarantined_rows;
  assert.deepEqual(Array.from(held, row => row.reason).sort(), ["SHIPPING_POLICY_DRIFT", "SOURCE_IDENTITY_DRIFT", "SOURCE_RECORD_INVALID"]);
  const reviewIds = new Set(held.map(row => row.offer_id));
  assert.equal(run.artifacts.flatMap(artifact => artifact.rows).length, 216);
  assert.ok(run.artifacts.every(artifact => artifact.rows.every(row => !reviewIds.has(row.offer_id))));
  for (const row of held) {
    const report = engine.reviewReportRow(row);
    assert.equal(report.new_price, null); assert.equal(report.new_stock, null); assert.equal(report.proposed_offer, null);
    assert.ok(report.source_record_evidence);
    assert.ok(report.source_record_evidence.expected_identity.sku);
    assert.ok(report.source_record_evidence.observed_identity.sku);
  }
});

test("H&B full source collapse blocks before any offer plan is available", async () => {
  const source = snapshot(); source.products.length = 2000; source.source_variants.length = 2000;
  await assert.rejects(build(source), error => error.code === "GENUINE_SOURCE_COLLAPSE");
});

test("retrieval cannot make an old, unknown or future-dated Partnerize file fresh", async () => {
  for (const [modified, code] of [
    [null, "SOURCE_FILE_FRESHNESS_UNKNOWN"], ["unknown", "SOURCE_FILE_FRESHNESS_UNKNOWN"],
    [new Date(Date.now() - 25 * 3600000).toISOString(), "SOURCE_FILE_STALE"],
    [new Date(Date.now() + 10 * 60000).toISOString(), "SOURCE_FILE_FUTURE_TIMESTAMP"],
  ]) {
    const source = snapshot(); source.source_diagnostic.http_last_modified = modified;
    await assert.rejects(build(source), error => error.code === code);
  }
  const source = snapshot(); source.source_diagnostic.http_last_modified = new Date(Date.now() - 23 * 3600000).toISOString();
  const { run } = await build(source);
  assert.equal(run.classification.rows.length, 219);
  assert.equal(run.snapshot.source_diagnostic.supplier_generated_at, null);
});

test("H&B preparation blocks control writes before credentials and still requires manifest authority if the flag changes", async () => {
  const engine = loadEngine(snapshot());
  await assert.rejects(engine.register({ target: "production" }, {}), /REFRESH_PROFILE_NOT_ACTIVATED/);
  config.preparation_only = false;
  try { await assert.rejects(engine.register({ target: "production" }, {}), /REFRESH_SOURCE_SCOPE_NOT_AUTHORIZED/); }
  finally { config.preparation_only = true; }
});
