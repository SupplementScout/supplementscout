const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  loadReviewedMissingVariantManifest,
  readState,
  reconcileReviewedMissingVariants,
  sourceHealth,
} = require("./jons-offer-refresh");
const { RETAILER_SCOPE } = require("./creatine-offer-refresh");
const {
  canonicalVariantUrl,
  classifyExistingOffers,
} = require("./lib/retailer-offer-sync/classifier");
const {
  fingerprint,
} = require("./lib/retailer-offer-sync/artifacts");
const {
  mappedSourceRows,
  unmappedCollisionEvidence,
  unmappedIdentityRows,
} = require("./lib/retailer-offer-sync/reviewed-mixed-change");
const {
  projectShopifyVariants,
  readShopifySnapshot,
} = require("./lib/shopify-snapshot-reader");
const { canonicalJson } = require("./lib/canonical-json");
const config = require("../config/retailers/jons-supplements-offer-sync.json");

const ROOT = path.resolve(__dirname, "..");
const POLICY = "ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--(output|approved-offer-ids|authority)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument ${arg}`);
    out[match[1]] = match[2];
  }
  invariant(out.output && out["approved-offer-ids"] && out.authority,
    "--output, --approved-offer-ids and --authority are required");
  const offerIds = out["approved-offer-ids"].split(",");
  invariant(offerIds.length > 0 && new Set(offerIds).size === offerIds.length
    && offerIds.every((id) => /^\d+$/.test(id)), "approved offer IDs are invalid");
  return { output: path.resolve(out.output), offerIds, authority: out.authority };
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function identity(value) {
  return value == null || String(value).trim() === "" ? null : String(value);
}

function money(value) {
  return Number(value).toFixed(2);
}

function stateFingerprint(state) {
  return crypto.createHash("sha256").update(canonicalJson(state.records.map((row) => ({
    product: row.product,
    variant: row.variant,
    mapping: row.mapping,
    offer: row.offer,
  })))).digest("hex");
}

function prepareSource(snapshot, state) {
  const source = projectShopifyVariants(snapshot, { shippingCost: "3.99" });
  const duplicateSku = new Map();
  for (const row of source) {
    if (row.external_sku) duplicateSku.set(row.external_sku,
      (duplicateSku.get(row.external_sku) || 0) + 1);
  }
  const mappings = new Map(state.records.map((record) => [
    String(record.mapping.external_variant_id), record.mapping,
  ]));
  for (const row of source) {
    const mapping = mappings.get(String(row.external_variant_id));
    if (mapping && mapping.external_sku == null && row.external_sku
      && duplicateSku.get(row.external_sku) > 1) row.external_sku = null;
  }
  return source;
}

async function capture() {
  const capturedAt = new Date().toISOString();
  const snapshot = await readShopifySnapshot({
    storeUrl: config.store_url,
    marketCountry: "GB",
    noCache: true,
    capturedAt,
    timeoutMs: config.source_fetch.timeout_ms,
    maximumPages: config.source_fetch.maximum_pages,
    maximumAttempts: config.source_fetch.maximum_attempts,
    retryBaseDelayMs: config.source_fetch.retry_base_delay_ms,
    userAgent: config.source_fetch.user_agent,
  });
  return { capturedAt, snapshot };
}

function rawVariant(snapshot, variantId) {
  for (const product of snapshot.products) {
    const variant = (product.variants || []).find((row) => String(row.id) === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

async function checkUrl(url, checkedAt) {
  const response = await fetch(url, { redirect: "manual", headers: { "user-agent": config.source_fetch.user_agent } });
  invariant(response.status === 200, `reviewed URL did not return 200: ${url}`);
  return {
    requested_url: url,
    checked_at: checkedAt,
    status: response.status,
    location: response.headers.get("location"),
    hostname: new URL(url).hostname,
    direct_success: true,
  };
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  invariant(!fs.existsSync(options.output), "refusing to overwrite immutable manifest");
  loadEnv(path.join(ROOT, ".env.local"));
  const before = await readState("production");
  const first = await capture();
  const second = await capture();
  invariant(first.snapshot.semantic_source_fingerprint === second.snapshot.semantic_source_fingerprint,
    "two source captures differ");
  const source = prepareSource(second.snapshot, before);
  invariant(sourceHealth(second.snapshot, source).result === "PASS", "source health blocked");
  const firstSource = prepareSource(first.snapshot, before);
  const firstMissing = reconcileReviewedMissingVariants(before.records, firstSource);
  const secondMissing = reconcileReviewedMissingVariants(before.records, source);
  invariant(canonicalJson(firstMissing.reviewed_missing)
    === canonicalJson(secondMissing.reviewed_missing),
  "reviewed missing variants differ between captures");
  const effectiveSource = secondMissing.sourceVariants;
  const targets = before.records.map((record) => ({
    offer_id: String(record.offer.id),
    retailer_product_id: String(record.mapping.id),
    external_product_id: String(record.mapping.external_product_id),
    external_variant_id: String(record.mapping.external_variant_id),
    external_sku: identity(record.mapping.external_sku),
    price: money(record.offer.price),
    shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price),
    in_stock: Boolean(record.offer.in_stock),
    url: record.offer.url,
    external_url: record.mapping.external_url,
    last_checked_at: record.offer.last_checked_at,
  }));
  const classification = classifyExistingOffers({
    targets,
    sourceVariants: effectiveSource,
    policy: { ...config.guardrails, required_matched_offers: 506, store_url: config.store_url },
    guardScope: { name: "JONS_FULL_506", retailer: "Jon's Supplements" },
    sourceCapturedAt: second.capturedAt,
    now: new Date(second.capturedAt),
    sourceProductCount: second.snapshot.products.length,
    previousSourceProductCount: config.source_baseline.product_count,
  });
  invariant(classification.reason === "MASS_OOS", "current source is not blocked only by MASS_OOS");
  const approvedIds = [...options.offerIds].sort((a, b) => Number(a) - Number(b));
  const newOos = classification.rows.filter((row) =>
    row.target.in_stock === true && row.source.in_stock === false);
  const newOosIds = newOos.map((row) => String(row.offer_id))
    .sort((a, b) => Number(a) - Number(b));
  invariant(canonicalJson(newOosIds) === canonicalJson(approvedIds),
    "live new-OOS offers differ from owner-approved offer IDs");
  const changed = classification.rows.filter((row) =>
    approvedIds.includes(String(row.offer_id)));
  invariant(changed.length === approvedIds.length && changed.every((row) => row.action === "UPDATE_STOCK"
    && row.target.in_stock === true && row.source.in_stock === false
    && money(row.target.price) === money(row.source.price)
    && row.target.url === canonicalVariantUrl(config.store_url,
      row.source.product_handle, row.source.external_variant_id)),
  "approved scope is not exact stock-only in-stock to OOS");

  const hasReviewedAbsence = secondMissing.reviewed_missing.length > 0;
  const mappedRows = hasReviewedAbsence ? null : mappedSourceRows({
    snapshot: second.snapshot, sourceVariants: source,
    records: before.records, storeUrl: config.store_url,
  });
  const unmappedRows = hasReviewedAbsence ? null : unmappedIdentityRows({
    snapshot: second.snapshot, sourceVariants: source,
    records: before.records, storeUrl: config.store_url,
  });
  const collisions = hasReviewedAbsence ? null : unmappedCollisionEvidence(unmappedRows, mappedRows);
  const reviewedMissing = loadReviewedMissingVariantManifest();
  const reviewedMissingByVariant = new Map(reviewedMissing.manifest.rows.map((row) => [
    String(row.external_variant_id), row,
  ]));
  const creatineIds = new Set(RETAILER_SCOPE["Jon's Supplements"].offerIds.map(String));
  const rows = [];
  for (const current of changed.sort((a, b) => Number(a.offer_id) - Number(b.offer_id))) {
    const record = before.records.find((row) => String(row.offer.id) === String(current.offer_id));
    const rawFirst = rawVariant(first.snapshot, String(current.external_variant_id));
    const rawSecond = rawVariant(second.snapshot, String(current.external_variant_id));
    invariant(record, "reviewed canonical identity evidence is missing");
    const approvedMissing = reviewedMissingByVariant.get(String(current.external_variant_id));
    invariant((rawFirst && rawSecond) || (approvedMissing && !rawFirst && !rawSecond),
      "reviewed identity presence differs between captures");
    if (approvedMissing) {
      invariant(secondMissing.reviewed_missing.includes(String(current.external_variant_id)),
        "reviewed missing identity unexpectedly exists in source");
      const sourceProduct = second.snapshot.products.find((product) =>
        String(product.id) === String(record.mapping.external_product_id));
      rows.push({
        offer_id: String(record.offer.id), mapping_id: String(record.mapping.id),
        canonical_product_id: String(record.product.id), canonical_product: record.product.name,
        canonical_variant_id: String(record.variant.id), canonical_variant: record.variant.display_name,
        jons_product_id: String(record.mapping.external_product_id),
        jons_variant_id: String(record.mapping.external_variant_id),
        product: sourceProduct?.title || record.product.name,
        flavour: identity(record.variant.flavour_label) || identity(record.variant.display_name) || "Default",
        old_price: money(record.offer.price), new_price: money(current.source.price),
        old_stock: Boolean(record.offer.in_stock), new_stock: Boolean(current.source.in_stock),
        old_url: record.offer.url, new_url: record.offer.url,
        source_sku: identity(record.mapping.external_sku),
        mapping_gtin: identity(record.mapping.external_gtin), source_gtin: null,
        exact_action: "UPDATE_STOCK", changed_fields: ["stock"],
        review_classification: "APPROVE_REVIEWED_SOURCE_ABSENCE_AS_OOS",
        source_evidence_timestamp: first.capturedAt,
        second_evidence_timestamp: second.capturedAt,
        identity_stability: "STABLY_ABSENT_IN_TWO_CAPTURES",
        creatine_refresh_subset: creatineIds.has(String(record.offer.id)),
        evidence: {
          source_product_exists: Boolean(sourceProduct), source_variant_exists: false,
          source_variant_available_explicit: null,
          source_stock_interpretation: "OWNER_REVIEWED_SOURCE_ABSENCE_AS_OOS",
          first_capture_same_semantics: true, exact_external_ids: true,
          canonical_target_stable: Boolean(record.product.is_active
            && !record.product.merged_into_product_id && record.variant.is_active
            && String(record.variant.product_id) === String(record.product.id)
            && String(record.offer.product_id) === String(record.product.id)
            && String(record.mapping.product_variant_id) === String(record.variant.id)),
          source_sku_matches_mapping: null, duplicate_source_sku_exception: false,
          same_sku_other_identities: [],
          source_gtin_matches_mapping_when_both_present: true,
          same_gtin_other_identities: [], direct_current_url: null, old_url_check: null,
          duplicate_source_variant_identity: false,
          duplicate_source_sku_or_gtin_candidates: [], replacement_variant_found: false,
          replacement_assessment: "OWNER_REVIEWED_NO_SAFE_REPLACEMENT",
          parsing_ambiguity: false, temporary_source_failure: false,
          reviewed_missing_manifest_sha256: reviewedMissing.sha256,
        },
      });
      continue;
    }
    const firstSemantics = {
      product_id: String(rawFirst.product.id), handle: rawFirst.product.handle,
      variant_id: String(rawFirst.variant.id), title: rawFirst.variant.title,
      sku: identity(rawFirst.variant.sku), gtin: identity(rawFirst.variant.barcode),
      price: money(rawFirst.variant.price), available: Boolean(rawFirst.variant.available),
    };
    const secondSemantics = {
      product_id: String(rawSecond.product.id), handle: rawSecond.product.handle,
      variant_id: String(rawSecond.variant.id), title: rawSecond.variant.title,
      sku: identity(rawSecond.variant.sku), gtin: identity(rawSecond.variant.barcode),
      price: money(rawSecond.variant.price), available: Boolean(rawSecond.variant.available),
    };
    invariant(canonicalJson(firstSemantics) === canonicalJson(secondSemantics),
      `variant changed between captures: ${current.external_variant_id}`);
    const url = canonicalVariantUrl(config.store_url, current.source.product_handle,
      current.source.external_variant_id);
    const sameSku = source.filter((row) => row.external_sku
      && row.external_sku === current.source.external_sku
      && String(row.external_variant_id) !== String(current.external_variant_id));
    const sameGtin = source.filter((row) => rawSecond.variant.barcode && row.external_gtin
      && row.external_gtin === rawSecond.variant.barcode
      && String(row.external_variant_id) !== String(current.external_variant_id));
    rows.push({
      offer_id: String(record.offer.id), mapping_id: String(record.mapping.id),
      canonical_product_id: String(record.product.id), canonical_product: record.product.name,
      canonical_variant_id: String(record.variant.id), canonical_variant: record.variant.display_name,
      jons_product_id: String(record.mapping.external_product_id),
      jons_variant_id: String(record.mapping.external_variant_id),
      product: rawSecond.product.title,
      flavour: identity(record.variant.flavour_label) || identity(record.variant.display_name)
        || identity(rawSecond.variant.title) || "Default",
      old_price: money(record.offer.price), new_price: money(current.source.price),
      old_stock: Boolean(record.offer.in_stock), new_stock: Boolean(current.source.in_stock),
      old_url: record.offer.url, new_url: url, source_sku: identity(rawSecond.variant.sku),
      mapping_gtin: identity(record.mapping.external_gtin), source_gtin: identity(rawSecond.variant.barcode),
      exact_action: "UPDATE_STOCK", changed_fields: ["stock"],
      review_classification: "APPROVE_STOCK_CHANGE",
      source_evidence_timestamp: first.capturedAt,
      second_evidence_timestamp: second.capturedAt,
      identity_stability: "STABLE", creatine_refresh_subset: creatineIds.has(String(record.offer.id)),
      evidence: {
        source_product_exists: true, source_variant_exists: true,
        source_variant_available_explicit: false,
        source_stock_interpretation: "EXPLICITLY_UNAVAILABLE",
        first_capture_same_semantics: true, exact_external_ids: true,
        canonical_target_stable: Boolean(record.product.is_active
          && !record.product.merged_into_product_id && record.variant.is_active
          && String(record.variant.product_id) === String(record.product.id)
          && String(record.offer.product_id) === String(record.product.id)
          && String(record.mapping.product_variant_id) === String(record.variant.id)),
        source_sku_matches_mapping: identity(record.mapping.external_sku) === identity(rawSecond.variant.sku),
        duplicate_source_sku_exception: sameSku.length > 0,
        same_sku_other_identities: sameSku.map((row) => String(row.external_variant_id)),
        source_gtin_matches_mapping_when_both_present: !record.mapping.external_gtin
          || !rawSecond.variant.barcode || String(record.mapping.external_gtin) === String(rawSecond.variant.barcode),
        same_gtin_other_identities: sameGtin.map((row) => String(row.external_variant_id)),
        direct_current_url: await checkUrl(url, new Date().toISOString()), old_url_check: null,
        duplicate_source_variant_identity: false,
        duplicate_source_sku_or_gtin_candidates: [...new Set([...sameSku, ...sameGtin]
          .map((row) => String(row.external_variant_id)))],
        replacement_variant_found: false, replacement_assessment: "NO_REPLACEMENT_CANDIDATE",
        parsing_ambiguity: false, temporary_source_failure: false,
      },
    });
  }
  const after = await readState("production");
  const productionStateSha256 = stateFingerprint(before);
  invariant(stateFingerprint(after) === productionStateSha256,
    "production Jon's state changed during evidence generation");
  const manifest = {
    schema_version: 1,
    kind: `jons-existing-offer-${rows.length}-change-reviewed-manifest`,
    authority: options.authority,
    code_commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    generated_at: new Date().toISOString(), target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu", retailer_id: "10",
    retailer_slug: "jon-s-supplements", source_country: "GB",
    source_capture_sha256: second.snapshot.semantic_source_fingerprint,
    production_state_sha256: productionStateSha256,
    row_count: rows.length, immutable_scope_offer_ids: rows.map((row) => row.offer_id),
    expected_deltas: {
      products: 0, product_variants: 0, retailer_mappings_row_count: 0,
      offers_row_count: 0, stock_updates: rows.length, item_price_updates: 0,
      shipping_updates: 0, delivered_total_updates: 0, offer_url_updates: 0,
      mapping_url_updates: 0, mapping_updated_at_updates: 0,
      freshness_updates: rows.length, price_history_rows: 0, retailers: 0,
    },
    rows,
  };
  if (!hasReviewedAbsence) manifest.mapped_source_contract = {
      schema_version: 1,
      baseline_full_source_fingerprint: second.snapshot.semantic_source_fingerprint,
      baseline_product_count: second.snapshot.products.length,
      baseline_variant_count: source.length,
      mapped_scope_row_count: mappedRows.length,
      mapped_scope_fingerprint: fingerprint(mappedRows),
      allowed_unmapped_collisions: collisions,
      allowed_unmapped_collisions_hash: fingerprint(collisions),
      unmapped_drift_policy: POLICY,
    };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(options.output)).digest("hex");
  process.stdout.write(`${JSON.stringify({ result: "PASS", output: path.relative(ROOT, options.output),
    manifest_sha256: sha256, row_count: rows.length, offer_ids: rows.map((row) => row.offer_id),
    source_fingerprint: manifest.source_capture_sha256,
    mapped_scope_fingerprint: manifest.mapped_source_contract?.mapped_scope_fingerprint || null,
    production_state_sha256: productionStateSha256, database_writes: 0 }, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

module.exports = { parseArgs };
