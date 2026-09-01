const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");
const { canonicalTimestamp } = require("./canonical-timestamp");
const { normalizeSourceRow, planFingerprint, sourceRowFingerprint } = require("../import-products");

const OPERATION_TYPE = "reviewed_variant_create_rebind_offer_update";
const APPROVAL_TYPE = "owner_reviewed_variant_create_rebind_offer_update";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function text(value) {
  return value == null || String(value).trim() === "" ? null : String(value).trim();
}

function decimal(value, field) {
  const result = Number(value);
  invariant(Number.isFinite(result), `${field} must be numeric`);
  return result.toFixed(2);
}

function integerText(value, field) {
  invariant(/^\d+$/.test(String(value)), `${field} must be an integer`);
  return String(value);
}

function timestamp(value, field) {
  return canonicalTimestamp(value, field);
}

function productState(row) {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    net_weight_g: row.net_weight_g == null ? null : String(row.net_weight_g),
    product_format: row.product_format,
    is_active: row.is_active,
    merged_into_product_id: row.merged_into_product_id == null ? null : String(row.merged_into_product_id),
  };
}

function variantState(row) {
  return {
    id: String(row.id), product_id: String(row.product_id), variant_key: row.variant_key,
    display_name: row.display_name, flavour_code: row.flavour_code, flavour_label: row.flavour_label,
    size_value: row.size_value == null ? null : String(row.size_value), size_unit: row.size_unit,
    pack_count: row.pack_count == null ? null : String(row.pack_count), product_format: row.product_format,
    gtin: row.gtin, is_active: row.is_active, is_default: row.is_default,
  };
}

function retailerState(row) {
  return { id: String(row.id), name: row.name, slug: row.slug, website: row.website };
}

function mappingState(row) {
  return {
    id: String(row.id), retailer_id: String(row.retailer_id), product_id: String(row.product_id),
    product_variant_id: String(row.product_variant_id), external_product_id: text(row.external_product_id),
    external_variant_id: text(row.external_variant_id), external_sku: text(row.external_sku),
    external_options: row.external_options ?? null, external_name: row.external_name,
    external_slug: row.external_slug, external_gtin: text(row.external_gtin), external_url: row.external_url,
    match_method: row.match_method, match_confidence: String(row.match_confidence),
    updated_at: timestamp(row.updated_at, "mapping.updated_at"),
  };
}

function offerState(row) {
  return {
    id: String(row.id), product_id: String(row.product_id), retailer_id: String(row.retailer_id),
    product_variant_id: String(row.product_variant_id), retailer_product_id: String(row.retailer_product_id),
    price: decimal(row.price, "offer.price"), shipping_cost: decimal(row.shipping_cost, "offer.shipping_cost"),
    total_price: row.total_price == null ? null : decimal(row.total_price, "offer.total_price"),
    in_stock: row.in_stock, url: row.url, last_checked_at: timestamp(row.last_checked_at, "offer.last_checked_at"),
  };
}

function buildSourceRecord({ retailerSlug, source, captures }) {
  invariant(Array.isArray(captures) && captures.length === 2, "exactly two captures are required");
  const normalizedCaptures = captures.map((capture) => ({
    captured_at: timestamp(capture.captured_at, "capture.captured_at"),
    semantic_fingerprint: text(capture.semantic_fingerprint),
  }));
  invariant(normalizedCaptures[0].semantic_fingerprint === normalizedCaptures[1].semantic_fingerprint,
    "two source captures must be semantically identical");
  invariant(/^[0-9a-f]{64}$/.test(normalizedCaptures[0].semantic_fingerprint || ""), "source fingerprint is invalid");
  const record = {
    schema_version: "1",
    retailer_slug: text(retailerSlug),
    source_product_id: text(source.external_product_id),
    source_variant_id: text(source.external_variant_id),
    exact_title: text(source.title),
    option_name: "Flavour",
    option_value: text(source.flavour || String(source.title || "").split(" - ").at(-1)),
    weight_value: integerText(source.weight_value, "source.weight_value"),
    weight_unit: text(source.weight_unit)?.toLowerCase(),
    price: decimal(source.price, "source.price"),
    shipping_cost: decimal(source.shipping_cost, "source.shipping_cost"),
    in_stock: source.in_stock,
    url: text(source.url),
    source_url: text(source.source_url),
    gtin: text(source.gtin),
    mpn: text(source.mpn),
    captures: normalizedCaptures,
  };
  invariant(record.retailer_slug && record.source_product_id && record.source_variant_id && record.exact_title,
    "source identity is incomplete");
  invariant(record.option_value && record.weight_unit === "g" && record.in_stock === true, "reviewed source semantics are incomplete");
  return normalizeSourceRow(record);
}

function buildReviewedVariantCreateRebindPlan({ state, source, captures, expiresAt }) {
  const product = productState(state.product);
  const currentVariant = variantState(state.variant);
  const retailer = retailerState(state.retailer);
  const mapping = mappingState(state.mapping);
  const offer = offerState(state.offer);
  invariant(product.is_active && product.merged_into_product_id == null, "product must be active and unmerged");
  invariant(currentVariant.is_active && currentVariant.is_default, "current variant must be the active default");
  invariant(mapping.product_id === product.id && mapping.product_variant_id === currentVariant.id && mapping.retailer_id === retailer.id,
    "mapping identity mismatch");
  invariant(offer.product_id === product.id && offer.product_variant_id === currentVariant.id && offer.retailer_product_id === mapping.id && offer.retailer_id === retailer.id,
    "offer identity mismatch");

  const sourceRecord = buildSourceRecord({ retailerSlug: retailer.slug, source, captures });
  invariant(sourceRecord.url === mapping.external_url && sourceRecord.url === offer.url, "source URL must preserve mapping and offer URL");
  const sourceFingerprint = sourceRowFingerprint(sourceRecord);
  const capturedAt = sourceRecord.captures[1].captured_at;
  const expiry = timestamp(expiresAt, "expiresAt");
  invariant(Date.parse(expiry) > Date.parse(capturedAt), "approval expiry must follow source capture");
  const targetTotal = (Number(sourceRecord.price) + Number(sourceRecord.shipping_cost)).toFixed(2);
  const variantKey = `${sourceRecord.option_value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${sourceRecord.weight_value}${sourceRecord.weight_unit}`;
  const target = {
    product_id: product.id, retailer_id: retailer.id, mapping_id: mapping.id, offer_id: offer.id,
    expected_current_variant_id: currentVariant.id, source_product_id: sourceRecord.source_product_id,
    source_variant_id: sourceRecord.source_variant_id, variant_key: variantKey,
    display_name: `${sourceRecord.option_value} / ${sourceRecord.weight_value}${sourceRecord.weight_unit}`,
    price: sourceRecord.price, shipping_cost: sourceRecord.shipping_cost, total_price: targetTotal,
    in_stock: sourceRecord.in_stock, last_checked_at: capturedAt,
  };
  const beforeHash = sha256({ product, currentVariant, retailer, mapping, offer });
  const idempotencyKey = sha256({ operation_type: OPERATION_TYPE, sourceFingerprint, beforeHash, target });
  const approvalFp = sha256({ operation_type: OPERATION_TYPE, sourceFingerprint, beforeHash, target, idempotency_key: idempotencyKey, expires_at: expiry });
  const expectedDeltas = {
    row_count_deltas: { products: "0", product_variants: "1", retailer_products: "0", offers: "0", price_history: "1" },
    logical_field_deltas: {
      product_variant_creates: "1", mapping_rebinds: "1", mapping_identity_updates: "1",
      offer_rebinds: "1", offer_price_updates: "1", offer_shipping_updates: "0",
      offer_total_updates: "1", offer_stock_updates: "1", offer_url_updates: "0",
      last_checked_at_updates: "1", parent_product_updates: "0",
    },
  };
  const plan = {
    meta: {
      version: "3", plan_kind: "feed", operation_type: OPERATION_TYPE,
      source_row_fingerprint: sourceFingerprint, plan_fingerprint: null,
      source_snapshot_sha256: sourceRecord.captures[1].semantic_fingerprint,
      source_captured_at: capturedAt, approval_fingerprint: approvalFp,
      idempotency_key: idempotencyKey, expires_at: expiry,
    },
    source_record: sourceRecord,
    product: { action: "existing", id: product.id },
    product_variant: {
      action: "create_variant",
      values: {
        variant_key: variantKey, display_name: target.display_name,
        flavour_code: variantKey.replace(/-\d+g$/, ""), flavour_label: sourceRecord.option_value,
        size_value: sourceRecord.weight_value, size_unit: sourceRecord.weight_unit,
        pack_count: "1", product_format: product.product_format,
      },
      evidence: {
        external_options: { [sourceRecord.option_name]: sourceRecord.option_value },
        approved_mapping_id: mapping.id,
      },
    },
    retailer: { action: "existing", id: retailer.id },
    retailer_product: {
      action: "update", id: mapping.id,
      values: {
        external_product_id: sourceRecord.source_product_id, external_variant_id: sourceRecord.source_variant_id,
        external_sku: sourceRecord.mpn, external_options: { [sourceRecord.option_name]: sourceRecord.option_value },
        external_name: mapping.external_name, external_slug: mapping.external_slug, external_gtin: sourceRecord.gtin,
        external_url: mapping.external_url, match_method: "external_id", match_confidence: "100",
        product_variant_id: null,
      },
    },
    offer: {
      action: "update", id: offer.id,
      values: {
        product_variant_id: null, price: sourceRecord.price, shipping_cost: sourceRecord.shipping_cost,
        total_price: targetTotal, in_stock: true, url: offer.url, last_checked_at: capturedAt,
      },
    },
    price_history: { action: "create" },
    approval: { approved: false, approval_type: APPROVAL_TYPE, approval_fingerprint: approvalFp },
    expected_state: { product, product_variant: currentVariant, retailer, retailer_product: mapping, offer },
    expected_deltas: expectedDeltas,
  };
  plan.meta.plan_fingerprint = planFingerprint(plan);
  return plan;
}

module.exports = {
  APPROVAL_TYPE,
  OPERATION_TYPE,
  buildReviewedVariantCreateRebindPlan,
  buildSourceRecord,
  mappingState,
  offerState,
  productState,
  variantState,
};
