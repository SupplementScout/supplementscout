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
function loadEngine(source, environment = {}, dependencies = {}) {
  const filename = path.join(ROOT, "scripts/fit-house-offer-refresh.js");
  const localRequire = createRequire(filename);
  const fixtureModule = { exports: {} };
  let readerCalls = 0;
  let readerOptions;
  const context = { module: fixtureModule, exports: fixtureModule.exports, __dirname: path.dirname(filename), __filename: filename,
    require(name) { return dependencies[name] || (name === "./lib/partnerize-product-feed-reader" ? { async readPartnerizeProductFeed(options) {
      readerCalls += 1;
      readerOptions = options;
      assert.equal(options.feedUrlSha256, config.source_url_sha256);
      assert.equal(options.reviewedIdentities.length, 219);
      assert.equal(options.maximumBytes, 12000000);
      return source;
    } } : localRequire(name)); },
    process: { ...process, env: { ...process.env, RETAILER_REFRESH_PROFILE: "holland-barrett", HOLLAND_BARRETT_PARTNERIZE_FEED_URL: "https://feeds.performancehorizon.com/fixture", ...environment } },
    URL, Date, Buffer, console, setTimeout, clearTimeout, AbortController };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return { ...fixtureModule.exports, fixtureReaderCalls: () => readerCalls, fixtureReaderOptions: () => readerOptions };
}

async function build(source = snapshot()) {
  const engine = loadEngine(source);
  const state = { records: records(), counts: { products: 219, product_variants: 219, retailer_products: 219, offers: 219, price_history: 219 } };
  return { engine, state, run: await engine.buildRun("production", state, null, null, true) };
}

test("owner-approved H&B scope pins exactly219 existing mappings and identity seals", () => {
  const bytes = fs.readFileSync(path.join(ROOT, config.manifest_path), "utf8").replaceAll("\r\n", "\n");
  assert.equal(digest(bytes), config.manifest_sha256);
  assert.equal(config.preparation_only, false);
  assert.equal(manifest.authorization.status, "OWNER_APPROVED");
  assert.equal(manifest.authorization.production_apply, true);
  assert.equal(config.manifest_sha256, "6c0ca5ee3bba035671ef587de2b9d08ae0a96402f1364e88e413b71f73cea3b8");
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

test("H&B hard price anomalies remain read-only reviews and cannot authorize themselves by repeated capture", async () => {
  const source = snapshot(); source.source_variants[0].price = "20.00"; source.source_variants[0].total_price = "23.49";
  const { run, engine } = await build(source);
  assert.equal(config.guardrails.allow_two_capture_price_confirmation, false);
  assert.equal(run.classification.quarantined_rows[0].reason, "HARD_PRICE_ANOMALY");
  assert.equal(run.classification.quarantined_rows[0].source_record_evidence.observed_offer.price, "20.00");
  assert.equal(run.artifacts.flatMap(artifact => artifact.rows).length, 218);
  assert.equal(run.automaticPriceConfirmation, null);
  assert.equal(engine.fixtureReaderCalls(), 1);
});

test("shared confirmation fingerprint binds mapped GTIN, source validation, delivery and unknown stock", () => {
  const current = snapshot(), engine = loadEngine(current), scope = records();
  const before = engine.mappedOfferSourceFingerprint(scope, current.source_variants);
  for (const change of [row => { row.external_gtin = "changed"; }, row => { row.shipping_cost = "0.00"; },
    row => { row.in_stock = null; }, row => { row.source_validation.status = "INVALID"; },
    row => { row.source_validation.observed_identity_sha256 = "a".repeat(64); }]) {
    const next = structuredClone(current); change(next.source_variants[0]);
    assert.notEqual(engine.mappedOfferSourceFingerprint(scope, next.source_variants), before);
  }
  current.source_variants.at(-1).price = "99.00";
  assert.equal(engine.mappedOfferSourceFingerprint(scope, current.source_variants), before);
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
  const fixtureManifest = { ...manifest, authorization: { status: "OWNER_APPROVAL_REQUIRED", production_apply: false } };
  const bytes = JSON.stringify(fixtureManifest, null, 2) + "\n";
  const fixtureConfig = { ...config, preparation_only: true, manifest_sha256: digest(bytes) };
  const engine = loadEngine(snapshot(), {}, {
    "../config/retailers/holland-barrett-offer-sync.json": fixtureConfig,
    "node:fs": { ...fs, readFileSync(file, encoding) {
      if (path.resolve(file) === path.join(ROOT, config.manifest_path)) return encoding ? bytes : Buffer.from(bytes);
      if (String(file).includes("credentials")) throw new Error("UNEXPECTED_CREDENTIAL_ACCESS");
      return fs.readFileSync(file, encoding);
    } },
    pg: { Client: class { constructor() { throw new Error("UNEXPECTED_DATABASE_ACCESS"); } } },
  });
  await assert.rejects(engine.register({ target: "production" }, {}), /REFRESH_PROFILE_NOT_ACTIVATED/);
  fixtureConfig.preparation_only = false;
  await assert.rejects(engine.register({ target: "production" }, {}), /REFRESH_SOURCE_SCOPE_NOT_AUTHORIZED/);
});

test("approved H&B worker joins the existing registry with the exact stock-only postflight contract", () => {
  const registry = require("../config/automation-review-execution-adapters.json");
  const { REVIEW_EXECUTION_ADAPTERS, adaptersForWorkerKind } = require("./lib/automation-review-adapter-registry");
  const publication = require("./lib/automation-review-publication-profiles").PROFILES["holland-barrett"];
  const postflight = require("./retailer-offer-refresh-postflight").PROFILES["holland-barrett"];
  const prepared = registry.adapters.find(row => row.retailer_id === "16");
  assert.equal(prepared.enabled, true);
  assert.deepEqual(prepared.operations, ["UPDATE_STOCK"]);
  assert.deepEqual(prepared.reason_codes, ["STOCK_CHANGE"]);
  assert.equal(prepared.shared_engine.engine_module, "scripts/fit-house-offer-refresh.js");
  assert.equal(prepared.shared_engine.profile, "holland-barrett");
  assert.equal(prepared.shared_engine.expected_commercial_changes, 1);
  assert.equal(prepared.shared_engine.freshness_confirmation_count, 19);
  assert.deepEqual(REVIEW_EXECUTION_ADAPTERS.map(row => row.retailerId), ["12", "9", "14", "3", "15", "16"]);
  assert.ok(adaptersForWorkerKind("shared-retailer").some(row => row.retailerId === "16"));
  assert.equal(publication.publicationEnabled, true);
  assert.equal(publication.approvedMappingCount, config.approved_mapping_count);
  assert.equal(postflight.approvedMappingCount, config.approved_mapping_count);
  assert.equal(postflight.manifestPath, config.manifest_path);
});

test("H&B reuses the exact shared workflow steps, requires its enable variable and cannot expose manual apply", () => {
  const workflow = require("js-yaml").load(fs.readFileSync(path.join(ROOT, ".github/workflows/fit-house-offer-refresh.yml"), "utf8"));
  const hb = workflow.jobs["holland-barrett-offer-refresh"], legacy = workflow.jobs["gladiator-nutrition-offer-refresh"];
  assert.equal(hb.steps, legacy.steps, "YAML alias must reuse one step sequence");
  assert.equal(hb.outputs, legacy.outputs);
  assert.deepEqual(hb.needs, ["gladiator-nutrition-offer-refresh"], "scheduled writers must be sequential");
  assert.equal(hb.env.RETAILER_REFRESH_PROFILE, "holland-barrett");
  assert.equal(hb.env.RETAILER_SOURCE_SECRET, "HOLLAND_BARRETT_PARTNERIZE_FEED_URL");
  assert.equal(hb.env.RETAILER_REFRESH_OUTPUT_DIRECTORY, "tmp/holland-barrett-offer-refresh");
  assert.deepEqual(workflow.concurrency, { group: "retailer-offer-production-write", "cancel-in-progress": false, queue: "max" });
  const expression = hb.if.slice(3, -2).trim();
  for (const enabled of ["", "false", "true"]) for (const event of ["schedule", "workflow_dispatch", "push"]) {
    for (const operation of ["dry-run", "review-only", "apply", "control-recovery"]) for (const ref of ["refs/heads/main", "refs/heads/test"]) {
      const context = { always: () => true, vars: { HOLLAND_BARRETT_REFRESH_ENABLED: enabled }, github: { ref, event_name: event, event: { schedule: "17 8 * * *" } }, inputs: { retailer: "holland-barrett", operation } };
      const allowed = Boolean(vm.runInNewContext(expression, context));
      assert.equal(allowed, enabled === "true" && ref === "refs/heads/main" && (event === "schedule" || event === "workflow_dispatch" && ["dry-run", "review-only"].includes(operation)));
    }
  }
  const scripts = hb.steps.filter(step => step.run);
  const apply = scripts.find(step => step.run.includes("--mode=apply"));
  assert.match(apply.if, /github.event_name == 'schedule'/);
  assert.match(apply.if, /env.RETAILER_REFRESH_CRON/);
  for (const step of hb.steps.filter(step => /Install dependencies|Test .*contracts/.test(step.name || ""))) assert.equal(step.env, undefined, "dependency installation/tests receive no production credential");
  assert.ok(workflow.jobs["refresh-review-queue"].needs.includes("holland-barrett-offer-refresh"));
  const publish = workflow.jobs["refresh-review-queue"].steps.find(step => step.with?.profile === "holland-barrett");
  assert.equal(publish.uses, "./.github/actions/publish-automation-review-queue");
  assert.equal(config.preparation_only, false);
  const worker = require("js-yaml").load(fs.readFileSync(path.join(ROOT, ".github/workflows/automation-review-queue-worker.yml"), "utf8"));
  const steps = Object.values(worker.jobs).flatMap(job => job.steps || []);
  const execute = steps.find(step => step.name === "Execute oldest approved queue request");
  assert.equal(execute.env.HOLLAND_BARRETT_PARTNERIZE_FEED_URL, "${{ secrets.HOLLAND_BARRETT_PARTNERIZE_FEED_URL }}");
  for (const role of ["VALIDATOR", "APPROVER", "EXECUTOR"]) assert.equal(execute.env[`HOLLAND_BARRETT_REFRESH_${role}_DATABASE_URL`], `\u0024{{ secrets.JONS_SYNC_${role}_DATABASE_URL }}`);
});

test("shared workflow environment aliases retain profile-specific source and validator precedence", async () => {
  const source = snapshot(), alias = "https://feeds.performancehorizon.com/shared-fixture";
  const fallback = loadEngine(source, { HOLLAND_BARRETT_PARTNERIZE_FEED_URL: undefined, RETAILER_REFRESH_SOURCE_URL: alias });
  await fallback.readSourceSnapshot();
  assert.equal(fallback.fixtureReaderOptions().feedUrl, alias);
  const specific = loadEngine(source, { RETAILER_REFRESH_SOURCE_URL: alias });
  await specific.readSourceSnapshot();
  assert.equal(specific.fixtureReaderOptions().feedUrl, "https://feeds.performancehorizon.com/fixture");
  const secure = require("./lib/secure-postgres");
  for (const preferred of [false, true]) {
    let connection;
    const generic = "postgresql://fixture@database.example.invalid:5432/postgres";
    const profile = generic.replace("fixture@", "profile@");
    const engine = loadEngine(source, { RETAILER_REFRESH_VALIDATOR_DATABASE_URL: generic, HOLLAND_BARRETT_REFRESH_VALIDATOR_DATABASE_URL: preferred ? profile : undefined }, { "./lib/secure-postgres": {
      ...secure,
      postgresClientConfig: options => secure.postgresClientConfig({ ...options, tlsOptions: { env: { PGSSLROOTCERT: secure.BUNDLED_SUPABASE_CA } } }),
    }, pg: { Client: class {
      constructor(options) { connection = options.connectionString; assert.equal(options.ssl.rejectUnauthorized, true); }
      async connect() { throw new Error("FIXTURE_STOP_BEFORE_NETWORK"); }
    } } });
    await assert.rejects(engine.readState("production"), /FIXTURE_STOP_BEFORE_NETWORK/);
    assert.equal(new URL(connection).username, preferred ? "profile" : "fixture");
  }
});
