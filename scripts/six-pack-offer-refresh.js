const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { buildExistingOfferUpdatePlan } = require("./lib/retailer-offer-sync/existing-offer-plan");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const { buildVerifiedNoChangePlan } = require("./verified-no-change-offer-refresh");
const { writeDryRunArtifact } = require("./import-products");
const { liveIdentityDrift } = require("./six-pack-canary-builder");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message, code = "REFRESH_BLOCKED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
}

function canonicalHash(value) {
  return sha256(canonicalJson(value));
}

function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}

function shippingForPrice(price) {
  const policy = config.shipping_policy;
  const threshold = Number(policy.free_shipping_threshold);
  const below = Number(policy.below_threshold);
  const atOrAbove = Number(policy.at_or_above_threshold);
  if (
    policy.status !== "VERIFIED" ||
    policy.currency !== "GBP" ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(below) ||
    !Number.isFinite(atOrAbove)
  ) fail("Verified shipping policy is incomplete", "SHIPPING_POLICY_DRIFT");
  return money(Number(price) < threshold ? below : atOrAbove);
}

function parseArgs(argv) {
  const out = {};
  const allowed = new Set(["target", "artifact", "report", "require-no-change", "reviewed-mass-oos"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || !allowed.has(match[1]) || out[match[1]] !== undefined) fail(`Invalid argument ${argument}`, "INVALID_ARGUMENT");
    out[match[1]] = match[2];
  }
  if (out.target !== "production") fail("Required --target=production", "INVALID_ARGUMENT");
  for (const key of ["artifact", "report"]) {
    if (!out[key]) fail(`Required --${key}=<tmp path>`, "INVALID_ARGUMENT");
    out[key] = path.resolve(out[key]);
    const relative = path.relative(path.join(ROOT, "tmp"), out[key]);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${key} must be inside repository tmp`, "INVALID_ARGUMENT");
  }
  out.requireNoChange = out["require-no-change"] === "true";
  if (out["require-no-change"] !== undefined && !["true", "false"].includes(out["require-no-change"])) {
    fail("--require-no-change must be true|false", "INVALID_ARGUMENT");
  }
  out.reviewedMassOosSelector = out["reviewed-mass-oos"] || null;
  if (
    out["reviewed-mass-oos"] !== undefined &&
    out["reviewed-mass-oos"] !== config.automation.reviewed_mass_oos_selector
  ) fail("Unknown reviewed MASS_OOS selector", "INVALID_ARGUMENT");
  return out;
}

function loadApprovedManifest() {
  const manifestPath = path.join(ROOT, config.automation.manifest_path);
  const bytes = fs.readFileSync(manifestPath);
  const actual = sha256(bytes);
  if (actual !== config.automation.manifest_sha256) fail("Approved manifest SHA mismatch", "MANIFEST_DRIFT");
  const manifest = JSON.parse(bytes);
  const rows = manifest.rows || [];
  if (
    manifest.approved !== true ||
    manifest.retailer?.id !== config.automation.retailer_id ||
    manifest.retailer?.slug !== config.retailer.slug ||
    manifest.approved_mapping_count !== config.automation.approved_mapping_count ||
    rows.length !== config.automation.approved_mapping_count ||
    new Set(rows.map((row) => row.mapping_id)).size !== rows.length ||
    new Set(rows.map((row) => row.offer_id)).size !== rows.length ||
    new Set(rows.map((row) => row.external_variant_id)).size !== rows.length
  ) fail("Approved manifest identity mismatch", "MANIFEST_DRIFT");
  return { manifest, sha256: actual };
}

function loadReviewedMassOosManifest(selector, approvedManifest) {
  if (!selector) return null;
  if (selector !== config.automation.reviewed_mass_oos_selector) {
    fail("Unknown reviewed MASS_OOS selector", "REVIEWED_MASS_OOS_SELECTOR_MISMATCH");
  }
  const manifestPath = path.join(ROOT, config.automation.reviewed_mass_oos_manifest_path);
  const bytes = fs.readFileSync(manifestPath);
  const actual = sha256(bytes);
  if (actual !== config.automation.reviewed_mass_oos_manifest_sha256) {
    fail("Reviewed MASS_OOS manifest SHA mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  }
  const manifest = JSON.parse(bytes);
  const topKeys = [
    "schema_version", "kind", "selector", "retailer_id", "retailer_slug",
    "target_environment", "authorized_by", "authorized_at", "source_capture_evidence",
    "source_semantic_fingerprint", "source_semantic_rows", "row_count", "rows",
  ].sort();
  if (
    canonicalJson(Object.keys(manifest).sort()) !== canonicalJson(topKeys) ||
    manifest.schema_version !== 1 ||
    manifest.kind !== "six-pack-reviewed-mass-oos-v1" ||
    manifest.selector !== selector ||
    manifest.retailer_id !== config.automation.retailer_id ||
    manifest.retailer_slug !== config.retailer.slug ||
    manifest.target_environment !== "PRODUCTION" ||
    typeof manifest.authorized_by !== "string" ||
    !manifest.authorized_by.startsWith("owner-instruction-") ||
    !Number.isFinite(Date.parse(manifest.authorized_at)) ||
    !/^[0-9a-f]{64}$/.test(manifest.source_semantic_fingerprint || "")
  ) fail("Reviewed MASS_OOS manifest contract mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  if (
    !Array.isArray(manifest.source_capture_evidence) ||
    manifest.source_capture_evidence.length !== 2 ||
    manifest.source_capture_evidence.some((capture) => (
      canonicalJson(Object.keys(capture).sort()) !== canonicalJson(["captured_at", "html_sha256"].sort()) ||
      !Number.isFinite(Date.parse(capture.captured_at)) ||
      !/^[0-9a-f]{64}$/.test(capture.html_sha256 || "")
    )) ||
    manifest.source_capture_evidence[0].html_sha256 !== manifest.source_capture_evidence[1].html_sha256 ||
    Date.parse(manifest.source_capture_evidence[0].captured_at) >= Date.parse(manifest.source_capture_evidence[1].captured_at)
  ) fail("Reviewed MASS_OOS requires two ordered matching source captures", "REVIEWED_MASS_OOS_EVIDENCE_DRIFT");
  if (
    !Array.isArray(manifest.source_semantic_rows) ||
    manifest.source_semantic_rows.length !== 2 ||
    canonicalHash(manifest.source_semantic_rows) !== manifest.source_semantic_fingerprint ||
    !Array.isArray(manifest.rows) ||
    manifest.row_count !== 2 ||
    manifest.rows.length !== manifest.row_count
  ) fail("Reviewed MASS_OOS source or row count mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  const rowKeys = [
    "offer_id", "mapping_id", "external_product_id", "external_variant_id",
    "canonical_product_id", "canonical_variant_id", "display_name", "action",
    "old_price", "new_price", "old_stock", "new_stock",
  ].sort();
  for (const row of manifest.rows) {
    const binding = approvedManifest.rows.find((candidate) => candidate.offer_id === row.offer_id);
    if (
      canonicalJson(Object.keys(row).sort()) !== canonicalJson(rowKeys) ||
      row.action !== "UPDATE_STOCK" ||
      row.old_stock !== true || row.new_stock !== false ||
      money(row.old_price) !== "41.99" || money(row.new_price) !== "41.99" ||
      !binding || binding.mapping_id !== row.mapping_id ||
      binding.external_product_id !== row.external_product_id ||
      binding.external_variant_id !== row.external_variant_id ||
      binding.canonical_product_id !== row.canonical_product_id ||
      binding.canonical_variant_id !== row.canonical_variant_id
    ) fail("Reviewed MASS_OOS row escaped the approved binding", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  }
  if (
    new Set(manifest.rows.map((row) => row.offer_id)).size !== 2 ||
    manifest.rows.some((row, index) => index > 0 && Number(manifest.rows[index - 1].offer_id) >= Number(row.offer_id))
  ) fail("Reviewed MASS_OOS rows must be unique and ordered", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  return { manifest, sha256: actual };
}

function reviewedSourceSemanticRows(liveByProduct, reviewed) {
  return reviewed.manifest.source_semantic_rows.map((expected) => {
    const live = liveByProduct.get(expected.external_product_id);
    const matches = (live?.variations || []).filter(
      (variation) => String(variation.external_variant_id) === expected.external_variant_id
    );
    if (matches.length !== 1) fail("Reviewed MASS_OOS live source identity drift", "REVIEWED_MASS_OOS_SOURCE_DRIFT");
    const variation = matches[0];
    return {
      external_product_id: expected.external_product_id,
      external_variant_id: String(variation.external_variant_id),
      attributes: variation.attributes || {},
      price: money(variation.price),
      in_stock: Boolean(variation.in_stock),
      purchasable: Boolean(variation.purchasable),
      active: Boolean(variation.active),
      sku: variation.sku || null,
      canonical_url: live.canonical_url,
    };
  });
}

function authorizeReviewedMassOos(classification, records, liveByProduct, reviewed) {
  if (!reviewed) return { classification, review: null };
  if (classification.state !== "BLOCKED" || classification.reason !== "MASS_OOS") {
    fail("Reviewed MASS_OOS selector is not applicable to this classification", "REVIEWED_MASS_OOS_NOT_APPLICABLE");
  }
  const semanticRows = reviewedSourceSemanticRows(liveByProduct, reviewed);
  const semanticFingerprint = canonicalHash(semanticRows);
  if (
    semanticFingerprint !== reviewed.manifest.source_semantic_fingerprint ||
    canonicalJson(semanticRows) !== canonicalJson(reviewed.manifest.source_semantic_rows)
  ) fail("Reviewed MASS_OOS live semantic source drift", "REVIEWED_MASS_OOS_SOURCE_DRIFT");
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const changedRows = classification.rows
    .filter((row) => row.action !== "VERIFY_NO_CHANGE")
    .map((row) => {
      const record = recordByOffer.get(String(row.offer_id));
      if (!record) fail("Reviewed MASS_OOS canonical record missing", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
      return {
        offer_id: String(row.offer_id),
        mapping_id: String(row.retailer_product_id),
        external_product_id: String(row.external_product_id),
        external_variant_id: String(row.external_variant_id),
        canonical_product_id: String(record.product.id),
        canonical_variant_id: String(record.variant.id),
        display_name: record.variant.display_name,
        action: row.action,
        old_price: money(row.target.price),
        new_price: money(row.source.price),
        old_stock: Boolean(row.target.in_stock),
        new_stock: Boolean(row.source.in_stock),
      };
    })
    .sort((left, right) => Number(left.offer_id) - Number(right.offer_id));
  if (canonicalJson(changedRows) !== canonicalJson(reviewed.manifest.rows)) {
    fail("Reviewed MASS_OOS changed row scope drift", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  }
  return {
    classification: {
      ...classification,
      state: "DRY_RUN_READY",
      reason: null,
      action: "REVIEWED_MASS_OOS",
    },
    review: {
      selector: reviewed.manifest.selector,
      manifest_sha256: reviewed.sha256,
      authorized_by: reviewed.manifest.authorized_by,
      authorized_at: reviewed.manifest.authorized_at,
      row_count: reviewed.manifest.row_count,
      source_semantic_fingerprint: semanticFingerprint,
    },
  };
}

async function exactRows(client, table, ids, columns) {
  const { data, error } = await client.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

async function readState(manifest, dependencies = {}) {
  if (dependencies.state) return dependencies.state;
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch", "TARGET_MISMATCH");
  const client = dependencies.client || createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const productIds = [...new Set(manifest.rows.map((row) => row.canonical_product_id))];
  const variantIds = [...new Set(manifest.rows.map((row) => row.canonical_variant_id))];
  const [retailersResult, mappingsResult, offersResult, products, variants] = await Promise.all([
    client.from("retailers").select("id,name,slug,website").eq("id", manifest.retailer.id),
    client.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,updated_at").eq("retailer_id", manifest.retailer.id),
    client.from("offers").select("id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at").eq("retailer_id", manifest.retailer.id),
    exactRows(client, "products", productIds, "id,name,is_active,merged_into_product_id,product_format"),
    exactRows(client, "product_variants", variantIds, "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),
  ]);
  for (const result of [retailersResult, mappingsResult, offersResult]) if (result.error) throw result.error;
  if (retailersResult.data.length !== 1) fail("Retailer identity missing or duplicated", "STATE_DRIFT");
  const retailer = retailersResult.data[0];
  if (retailer.slug !== config.retailer.slug || retailer.website !== config.retailer.website) fail("Retailer identity drift", "STATE_DRIFT");
  if (mappingsResult.data.length !== manifest.rows.length || offersResult.data.length !== manifest.rows.length) {
    fail("Approved manifest no longer covers the full retailer scope", "SCOPE_DRIFT");
  }
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const mappingById = new Map(mappingsResult.data.map((row) => [String(row.id), row]));
  const offerById = new Map(offersResult.data.map((row) => [String(row.id), row]));
  const records = manifest.rows.map((binding) => {
    const mapping = mappingById.get(binding.mapping_id);
    const offer = offerById.get(binding.offer_id);
    const product = productById.get(binding.canonical_product_id);
    const variant = variantById.get(binding.canonical_variant_id);
    if (
      !mapping || !offer || !product || !variant ||
      String(mapping.external_product_id) !== binding.external_product_id ||
      String(mapping.external_variant_id) !== binding.external_variant_id ||
      String(mapping.product_id) !== binding.canonical_product_id ||
      String(mapping.product_variant_id) !== binding.canonical_variant_id ||
      String(offer.retailer_product_id) !== binding.mapping_id ||
      String(offer.product_id) !== binding.canonical_product_id ||
      String(offer.product_variant_id) !== binding.canonical_variant_id ||
      product.is_active !== true || product.merged_into_product_id != null || variant.is_active !== true
    ) fail(`Approved binding drift for ${binding.external_variant_id}`, "STATE_DRIFT");
    return { product, variant, retailer, mapping, offer };
  });
  return { records };
}

function liveSourceFor(record, live) {
  const externalProductId = String(record.mapping.external_product_id);
  const externalVariantId = String(record.mapping.external_variant_id);
  let offer;
  if (externalProductId === externalVariantId) {
    if (!live.product_offer) fail(`Simple live offer missing for ${externalProductId}`, "SOURCE_SCHEMA_MISMATCH");
    offer = { ...live.product_offer, active: true, purchasable: true };
  } else {
    offer = live.variations.find((row) => row.external_variant_id === externalVariantId);
    if (!offer) fail(`Live variation ${externalVariantId} missing`, "SOURCE_IDENTITY_DRIFT");
  }
  const identityDrift = liveIdentityDrift(
    {
      source_record_id: externalVariantId,
      product_name: record.mapping.external_name || record.product.name,
    },
    live
  );
  if (identityDrift) fail(`Live commercial identity drift for ${externalVariantId}`, "SOURCE_IDENTITY_DRIFT");
  if (!offer.active || !offer.purchasable) {
    const shippingCost = shippingForPrice(offer.price);
    return {
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: record.mapping.external_sku || null,
      product_handle: new URL(live.canonical_url).pathname,
      price: money(offer.price),
      shipping_cost: shippingCost,
      total_price: money(Number(offer.price) + Number(shippingCost)),
      in_stock: false,
      url: live.canonical_url,
    };
  }
  const shippingCost = shippingForPrice(offer.price);
  return {
    external_product_id: externalProductId,
    external_variant_id: externalVariantId,
    external_sku: record.mapping.external_sku || null,
    product_handle: new URL(live.canonical_url).pathname,
    price: money(offer.price),
    shipping_cost: shippingCost,
    total_price: money(Number(offer.price) + Number(shippingCost)),
    in_stock: Boolean(offer.in_stock),
    url: live.canonical_url,
  };
}

function targetFor(record) {
  return {
    offer_id: String(record.offer.id),
    retailer_product_id: String(record.mapping.id),
    external_product_id: String(record.mapping.external_product_id),
    external_variant_id: String(record.mapping.external_variant_id),
    external_sku: record.mapping.external_sku || null,
    price: money(record.offer.price),
    shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price),
    in_stock: Boolean(record.offer.in_stock),
    url: record.offer.url,
    external_url: record.mapping.external_url,
    last_checked_at: record.offer.last_checked_at,
  };
}

function verificationRecord(record, source, snapshotFingerprint, capturedAt) {
  const mapping = { ...record.mapping };
  delete mapping.updated_at;
  return {
    source_snapshot_sha256: snapshotFingerprint,
    source_captured_at: capturedAt,
    source: {
      external_product_id: String(source.external_product_id),
      external_variant_id: String(source.external_variant_id),
      price: money(source.price),
      in_stock: Boolean(source.in_stock),
      url: source.url,
    },
    target: {
      product: { ...record.product, id: String(record.product.id), merged_into_product_id: record.product.merged_into_product_id == null ? null : String(record.product.merged_into_product_id) },
      retailer: { ...record.retailer, id: String(record.retailer.id) },
      product_variant: { ...record.variant, id: String(record.variant.id), product_id: String(record.variant.product_id), size_value: record.variant.size_value == null ? null : String(record.variant.size_value), pack_count: record.variant.pack_count == null ? null : String(record.variant.pack_count) },
      retailer_product: { ...mapping, id: String(mapping.id), retailer_id: String(mapping.retailer_id), product_id: String(mapping.product_id), product_variant_id: String(mapping.product_variant_id), match_confidence: mapping.match_confidence == null ? null : String(mapping.match_confidence) },
      offer: { ...record.offer, id: String(record.offer.id), product_id: String(record.offer.product_id), retailer_id: String(record.offer.retailer_id), product_variant_id: String(record.offer.product_variant_id), retailer_product_id: String(record.offer.retailer_product_id), price: money(record.offer.price), shipping_cost: money(record.offer.shipping_cost), total_price: money(record.offer.total_price) },
    },
  };
}

function buildArtifactRows(records, sourceRows, classification, snapshotFingerprint, capturedAt) {
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const sourceByVariant = new Map(sourceRows.map((source) => [String(source.external_variant_id), source]));
  return classification.rows.map((classified, index) => {
    const record = recordByOffer.get(String(classified.offer_id));
    const source = sourceByVariant.get(String(classified.external_variant_id));
    let built;
    if (classified.action === "VERIFY_NO_CHANGE") {
      built = buildVerifiedNoChangePlan(
        verificationRecord(record, source, snapshotFingerprint, capturedAt),
        {
          targetEnvironment: "PRODUCTION",
          targetProjectRef: PROJECT_REF,
          sourceSnapshotSha256s: new Set([snapshotFingerprint]),
          now: new Date(capturedAt),
        }
      );
    } else {
      built = buildExistingOfferUpdatePlan({
        product: record.product,
        variant: record.variant,
        retailer: record.retailer,
        mapping: record.mapping,
        offer: record.offer,
        source,
        sourceCapturedAt: capturedAt,
        sourceSnapshotFingerprint: snapshotFingerprint,
      });
      if (
        built.changed.price !== classified.changed_fields.price ||
        built.changed.stock !== classified.changed_fields.stock ||
        built.changed.url !== classified.changed_fields.url
      ) fail("Classifier and atomic plan disagree", "PLAN_DRIFT");
    }
    return {
      row: built.record,
      rowNumber: index + 2,
      importPlan: built.plan,
      offerPlan: { action: classified.action, createsPriceHistory: built.plan.price_history.action === "create" },
    };
  });
}

async function run(options, dependencies = {}) {
  const approved = loadApprovedManifest();
  const reviewed = loadReviewedMassOosManifest(options.reviewedMassOosSelector, approved.manifest);
  const state = await readState(approved.manifest, dependencies);
  const capturedAt = new Date().toISOString();
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({
    storeUrl: config.retailer.website,
    productId,
    capturedAt,
    maximumAttempts: 5,
    retryBaseDelayMs: 1_000,
  }));
  const liveByProduct = new Map();
  for (const record of state.records) {
    const productId = String(record.mapping.external_product_id);
    if (!liveByProduct.has(productId)) {
      if (!dependencies.readLive && liveByProduct.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      liveByProduct.set(productId, await readLive(productId));
    }
  }
  const sourceRows = state.records.map((record) =>
    liveSourceFor(record, liveByProduct.get(String(record.mapping.external_product_id)))
  );
  if (sourceRows.length !== approved.manifest.rows.length || new Set(sourceRows.map((row) => row.external_variant_id)).size !== sourceRows.length) {
    fail("Approved source coverage is incomplete or duplicated", "SOURCE_COLLAPSE");
  }
  const snapshotFingerprint = sha256({
    captured_at: capturedAt,
    pages: [...liveByProduct.values()].map((row) => ({
      external_product_id: row.external_product_id,
      canonical_url: row.canonical_url,
      html_sha256: row.html_sha256,
    })).sort((left, right) => Number(left.external_product_id) - Number(right.external_product_id)),
    rows: sourceRows,
  });
  const policy = {
    ...config.guardrails,
    required_matched_offers: approved.manifest.rows.length,
    store_url: config.retailer.website,
    source_url_mode: "provided",
    allowed_url_hosts: ["6pack-supplements.co.uk"],
    ignore_source_sku: true,
  };
  const initialClassification = classifyExistingOffers({
    targets: state.records.map(targetFor),
    sourceVariants: sourceRows,
    policy,
    guardScope: { name: "SIX_PACK_APPROVED_MANIFEST", retailer: config.retailer.name },
    sourceCapturedAt: capturedAt,
    now: new Date(capturedAt),
    sourceProductCount: liveByProduct.size,
    previousSourceProductCount: config.automation.approved_product_page_count,
  });
  const massOosAuthorization = authorizeReviewedMassOos(
    initialClassification,
    state.records,
    liveByProduct,
    reviewed
  );
  const classification = massOosAuthorization.classification;
  const report = {
    schema_version: 1,
    kind: "six-pack-approved-offer-refresh-dry-run",
    result: classification.state === "DRY_RUN_READY" ? "PASS" : "BLOCK",
    target_project_ref: PROJECT_REF,
    manifest_sha256: approved.sha256,
    source_snapshot_fingerprint: snapshotFingerprint,
    source_captured_at: capturedAt,
    approved_mapping_count: approved.manifest.rows.length,
    fetched_product_page_count: liveByProduct.size,
    classification_state: classification.state,
    block_reason: classification.reason || null,
    guard_evidence: classification.guard_evidence || null,
    reviewed_mass_oos: massOosAuthorization.review,
    action_counts: (classification.rows || []).reduce((counts, row) => {
      counts[row.action] = (counts[row.action] || 0) + 1;
      return counts;
    }, {}),
    database_writes: 0,
  };
  fs.mkdirSync(path.dirname(options.report), { recursive: true });
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  if (classification.state !== "DRY_RUN_READY" || classification.rows.length !== approved.manifest.rows.length) {
    fail(`Classifier blocked: ${classification.reason || classification.state}`, classification.reason || "CLASSIFIER_BLOCKED");
  }
  if (options.requireNoChange && classification.rows.some((row) => row.action !== "VERIFY_NO_CHANGE")) {
    report.result = "BLOCK";
    report.block_reason = "IDEMPOTENCY_FAILED";
    fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
    fail("Post-apply source/state is not idempotent", "IDEMPOTENCY_FAILED");
  }
  const approvedRows = buildArtifactRows(state.records, sourceRows, classification, snapshotFingerprint, capturedAt);
  const sourceRecords = approvedRows.map((row) => row.row);
  const result = {
    successful: 0,
    failed: 0,
    planned: approvedRows.length,
    skipped: 0,
    report: { approvedRows, blockedRows: [] },
    rowLevelOffers: approvedRows.map((row) => ({ rowNumber: row.rowNumber, slug: row.row.target.product.name, offerAction: row.offerPlan.action })),
    successfulRows: [],
    failedRows: [],
    blockedRows: [],
  };
  const artifact = writeDryRunArtifact(sourceRecords, result, {
    artifactPath: options.artifact,
    runId: reviewed
      ? `six-pack-reviewed-mass-oos-${reviewed.sha256}-${Date.now()}`
      : `six-pack-refresh-${Date.now()}`,
    createdAt: capturedAt,
    sourceContent: canonicalJson({ snapshot_fingerprint: snapshotFingerprint, rows: sourceRows }),
    sourceFileName: "six-pack-live-approved-scope.json",
    environmentMarker: "production",
  });
  report.artifact_sha256 = artifact.artifactSha256;
  report.artifact_path = path.relative(ROOT, artifact.artifactPath);
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  return { report, artifact };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then(({ report }) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`${error.code || "ERROR"}: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  authorizeReviewedMassOos,
  buildArtifactRows,
  canonicalHash,
  liveSourceFor,
  loadApprovedManifest,
  loadReviewedMassOosManifest,
  money,
  parseArgs,
  reviewedSourceSemanticRows,
  run,
  shippingForPrice,
  targetFor,
  verificationRecord,
};
