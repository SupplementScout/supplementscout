// HISTORICAL ONE-TIME BUILDER: retained as audit evidence, never scheduled.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  loadAuditedMissingVariantManifest,
  projectSourceVariants,
  readState,
  reconcileAuditedMissingVariants,
  reconcileOwnerApprovedMissingVariant,
  sourceHealth,
} = require("./fit-house-offer-refresh");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { canonicalJson } = require("./lib/canonical-json");
const { readShopifySnapshot } = require("./lib/shopify-snapshot-reader");
const config = require("../config/retailers/fit-house-offer-sync.json");

const ROOT = path.resolve(__dirname, "..");
const APPROVED_OFFER_IDS = Object.freeze([
  "689", "691", "712", "713", "717", "723", "729", "730", "735", "737", "743", "750",
  "751", "758", "908", "911", "912", "914", "915", "917", "928", "936", "937", "939",
  "957", "985", "1857", "1877", "1896", "1897", "1910", "1915", "1921", "1927", "1928",
  "1933", "1934", "1935", "1941", "1946", "1953", "1954", "1955", "1963", "1973", "1978", "1979",
]);
const AUTHORITY = "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes";
const OFFER_697_AUTHORITY = "owner-approved-chat-2026-08-18-mutant-creakong-offer-697-oos";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  invariant((argv.length === 1 || argv.length === 2) && /^--output=.+/.test(argv[0])
    && (argv.length === 1 || argv[1] === "--approved-offer-697"),
  "exactly --output and optional --approved-offer-697 are required");
  return { output: path.resolve(argv[0].slice("--output=".length)), offer697: argv.length === 2 };
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function money(value) {
  return Number(value).toFixed(2);
}

function identity(value) {
  return value == null || String(value).trim() === "" ? null : String(value);
}

function stateFingerprint(state) {
  return crypto.createHash("sha256").update(canonicalJson(state.records.map((row) => ({
    product: row.product, variant: row.variant, mapping: row.mapping, offer: row.offer,
  })))).digest("hex");
}

async function capture() {
  const capturedAt = new Date().toISOString();
  const snapshot = await readShopifySnapshot({
    storeUrl: config.store_url, marketCountry: "GB", noCache: true, capturedAt,
    timeoutMs: config.source_fetch.timeout_ms, maximumPages: config.source_fetch.maximum_pages,
    maximumAttempts: config.source_fetch.maximum_attempts,
    retryBaseDelayMs: config.source_fetch.retry_base_delay_ms,
    userAgent: config.source_fetch.user_agent,
  });
  return { capturedAt, snapshot };
}

function prepareSource(snapshot, state) {
  const source = projectSourceVariants(snapshot);
  const duplicateSku = new Map();
  for (const row of source) if (row.external_sku) duplicateSku.set(row.external_sku, (duplicateSku.get(row.external_sku) || 0) + 1);
  const mappings = new Map(state.records.map((record) => [String(record.mapping.external_variant_id), record.mapping]));
  for (const row of source) {
    const mapping = mappings.get(String(row.external_variant_id));
    if (mapping && mapping.external_sku == null && row.external_sku && duplicateSku.get(row.external_sku) > 1) row.external_sku = null;
  }
  return source;
}

function rawVariant(snapshot, variantId) {
  for (const product of snapshot.products) {
    const variant = (product.variants || []).find((row) => String(row.id) === variantId);
    if (variant) return { product, variant };
  }
  return null;
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "SAFE_UPDATE must be unset");
  const { output, offer697 } = parseArgs(argv);
  invariant(!fs.existsSync(output), "refusing to overwrite immutable manifest");
  loadEnv(path.join(ROOT, ".env.local"));
  const before = await readState("production");
  const first = await capture();
  const second = await capture();
  invariant(first.snapshot.semantic_source_fingerprint === second.snapshot.semantic_source_fingerprint,
    "two fresh Fit House source captures differ");
  const firstSource = prepareSource(first.snapshot, before);
  const secondSource = prepareSource(second.snapshot, before);
  invariant(sourceHealth(first.snapshot, firstSource).result === "PASS"
    && sourceHealth(second.snapshot, secondSource).result === "PASS", "Fit House source health blocked");
  const audited = loadAuditedMissingVariantManifest();
  const firstOwner = offer697 ? reconcileOwnerApprovedMissingVariant(before.records, firstSource) : null;
  const secondOwner = offer697 ? reconcileOwnerApprovedMissingVariant(before.records, secondSource) : null;
  const firstEffective = reconcileAuditedMissingVariants(before.records, firstOwner?.sourceVariants || firstSource, audited);
  const secondEffective = reconcileAuditedMissingVariants(before.records, secondOwner?.sourceVariants || secondSource, audited);
  if (offer697) {
    firstEffective.missingVariantIds = [...firstOwner.missingVariantIds, ...firstEffective.missingVariantIds];
    secondEffective.missingVariantIds = [...secondOwner.missingVariantIds, ...secondEffective.missingVariantIds];
  }
  invariant(canonicalJson(firstEffective.missingVariantIds) === canonicalJson(secondEffective.missingVariantIds),
    "audited absences differ between fresh captures");
  const targets = before.records.map((record) => ({
    offer_id: String(record.offer.id), retailer_product_id: String(record.mapping.id),
    external_product_id: String(record.mapping.external_product_id),
    external_variant_id: String(record.mapping.external_variant_id), external_sku: identity(record.mapping.external_sku),
    price: money(record.offer.price), shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price), in_stock: Boolean(record.offer.in_stock),
    url: record.offer.url, external_url: record.mapping.external_url, last_checked_at: record.offer.last_checked_at,
  }));
  const classification = classifyExistingOffers({
    targets, sourceVariants: secondEffective.sourceVariants,
    policy: { ...config.guardrails, required_matched_offers: config.approved_mapping_count, store_url: config.store_url },
    guardScope: { name: config.guard_scope_name, retailer: config.retailer_name },
    sourceCapturedAt: second.capturedAt, now: new Date(second.capturedAt),
    sourceProductCount: second.snapshot.products.length,
    previousSourceProductCount: config.source_baseline.product_count,
  });
  invariant(classification.reason === "MASS_OOS", "current Fit House source is not blocked only by MASS_OOS");
  const changed = classification.rows.filter((row) => row.action !== "VERIFY_NO_CHANGE")
    .sort((left, right) => Number(left.offer_id) - Number(right.offer_id));
  const approvedOfferIds = offer697 ? ["697"] : APPROVED_OFFER_IDS;
  invariant(canonicalJson(changed.map((row) => String(row.offer_id))) === canonicalJson(approvedOfferIds),
    `live Fit House changes differ from the exact owner-approved ${offer697 ? 1 : 47} offers`);
  invariant(offer697
    ? changed.length === 1 && changed[0].action === "UPDATE_STOCK"
      && changed[0].target.in_stock === true && changed[0].source.in_stock === false
      && !changed[0].changed_fields.price && !changed[0].changed_fields.url
    : changed.filter((row) => row.target.in_stock && !row.source.in_stock).length === 36
      && changed.filter((row) => !row.target.in_stock && row.source.in_stock).length === 9
      && changed.filter((row) => row.changed_fields.price).length === 3
      && changed.filter((row) => row.changed_fields.stock).length === 45
      && changed.every((row) => !row.changed_fields.url), "approved Fit House action counts drifted");

  const missing = new Set(secondEffective.missingVariantIds);
  const rows = changed.map((current) => {
    const record = before.records.find((row) => String(row.offer.id) === String(current.offer_id));
    const rawFirst = rawVariant(first.snapshot, String(current.external_variant_id));
    const rawSecond = rawVariant(second.snapshot, String(current.external_variant_id));
    const auditedAbsent = missing.has(String(current.external_variant_id));
    invariant(record && ((auditedAbsent && !rawFirst && !rawSecond) || (!auditedAbsent && rawFirst && rawSecond)),
      `source identity evidence drift for offer ${current.offer_id}`);
    if (rawFirst && rawSecond) {
      const semantics = (raw) => ({
        product_id: String(raw.product.id), handle: raw.product.handle, title: raw.product.title,
        variant_id: String(raw.variant.id), title: raw.variant.title, sku: identity(raw.variant.sku),
        barcode: identity(raw.variant.barcode), price: money(raw.variant.price), available: Boolean(raw.variant.available),
      });
      invariant(canonicalJson(semantics(rawFirst)) === canonicalJson(semantics(rawSecond)),
        `raw variant changed between captures for offer ${current.offer_id}`);
    }
    const sourceTitle = rawSecond?.product.title || record.product.name;
    const sourceOption = rawSecond?.variant.title || record.variant.display_name || "Default";
    return {
      offer_id: String(record.offer.id), mapping_id: String(record.mapping.id),
      canonical_product_id: String(record.product.id), canonical_product: record.product.name,
      canonical_variant_id: String(record.variant.id), canonical_variant: record.variant.display_name,
      external_product_id: String(record.mapping.external_product_id),
      external_variant_id: String(record.mapping.external_variant_id),
      product: sourceTitle, option: sourceOption,
      old_price: money(record.offer.price), new_price: money(current.source.price),
      old_stock: Boolean(record.offer.in_stock), new_stock: Boolean(current.source.in_stock),
      old_url: record.offer.url, new_url: record.offer.url,
      source_sku: identity(rawSecond?.variant.sku) || identity(record.mapping.external_sku),
      mapping_gtin: identity(record.mapping.external_gtin), source_gtin: identity(rawSecond?.variant.barcode),
      exact_action: current.action,
      changed_fields: Object.entries(current.changed_fields).filter(([key, value]) => key !== "blocked" && value).map(([key]) => key).sort(),
      review_classification: offer697 ? "OWNER_APPROVED_EXACT_SOURCE_ABSENCE_AS_OOS"
        : auditedAbsent ? "OWNER_APPROVED_AUDITED_SOURCE_ABSENCE_AS_OOS" : "OWNER_APPROVED_CURRENT_SOURCE_CHANGE",
      source_evidence_timestamp: first.capturedAt, second_evidence_timestamp: second.capturedAt,
      identity_stability: auditedAbsent ? "STABLY_ABSENT_IN_TWO_CAPTURES" : "STABLE_IN_TWO_CAPTURES",
      evidence: {
        exact_external_ids: true, canonical_target_stable: Boolean(record.product.is_active
          && !record.product.merged_into_product_id && record.variant.is_active),
        source_product_exists: Boolean(rawSecond?.product), source_variant_exists: Boolean(rawSecond?.variant),
        first_capture_same_semantics: true, audited_source_absent: auditedAbsent,
        audited_missing_manifest_sha256: auditedAbsent ? audited.sha256 : null,
        owner_approved_full_47_pack: !offer697,
        owner_approved_offer_697: offer697,
      },
    };
  });
  const after = await readState("production");
  const productionStateSha256 = stateFingerprint(before);
  invariant(stateFingerprint(after) === productionStateSha256, "production Fit House state changed during evidence generation");
  const manifest = {
    schema_version: 1, kind: offer697 ? "fit-house-existing-offer-1-stock-change-reviewed-manifest" : "fit-house-existing-offer-47-change-reviewed-manifest",
    authority: offer697 ? OFFER_697_AUTHORITY : AUTHORITY, code_commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    generated_at: new Date().toISOString(), target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu", retailer_id: "9", retailer_slug: "fit-house",
    source_country: "GB", source_capture_sha256: second.snapshot.semantic_source_fingerprint,
    audited_missing_manifest_sha256: audited.sha256,
    production_state_sha256: productionStateSha256, row_count: rows.length,
    immutable_scope_offer_ids: rows.map((row) => row.offer_id),
    expected_deltas: {
      products: 0, product_variants: 0, retailer_mappings_row_count: 0, offers_row_count: 0,
      stock_updates: offer697 ? 1 : 45, item_price_updates: offer697 ? 0 : 3, shipping_updates: 0, delivered_total_updates: offer697 ? 0 : 3,
      offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0,
      freshness_updates: rows.length, price_history_rows: offer697 ? 0 : 3, retailers: 0,
    },
    rows,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  const manifestSha256 = crypto.createHash("sha256").update(fs.readFileSync(output)).digest("hex");
  process.stdout.write(`${JSON.stringify({ result: "PASS", output: path.relative(ROOT, output), manifest_sha256: manifestSha256,
    source_fingerprint: manifest.source_capture_sha256, production_state_sha256: productionStateSha256,
    row_count: rows.length, stock_updates: offer697 ? 1 : 45, price_updates: offer697 ? 0 : 3, database_writes: 0 }, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

module.exports = { APPROVED_OFFER_IDS, AUTHORITY, OFFER_697_AUTHORITY, parseArgs, stateFingerprint };
