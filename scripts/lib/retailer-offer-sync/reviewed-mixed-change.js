const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./artifacts");

const MANIFEST_KIND = "jons-existing-offer-15-change-reviewed-manifest";
const CONTRACT_KIND = "retailer-reviewed-mixed-change-v1";
const SHA256 = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(["UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK", "UPDATE_URL", "UPDATE_PRICE_STOCK_URL"]);
const EXPECTED_MANIFEST_KEYS = Object.freeze([
  "schema_version", "kind", "authority", "code_commit", "generated_at",
  "target_environment", "target_project_ref", "retailer_id", "retailer_slug",
  "source_country", "source_capture_sha256", "production_state_sha256",
  "row_count", "immutable_scope_offer_ids", "expected_deltas", "rows",
]);
const EXPECTED_ROW_KEYS = Object.freeze([
  "offer_id", "mapping_id", "canonical_product_id", "canonical_product",
  "canonical_variant_id", "canonical_variant", "jons_product_id",
  "jons_variant_id", "product", "flavour", "old_price", "new_price",
  "old_stock", "new_stock", "old_url", "new_url", "source_sku",
  "mapping_gtin", "source_gtin", "exact_action", "changed_fields",
  "review_classification", "source_evidence_timestamp",
  "second_evidence_timestamp", "identity_stability",
  "creatine_refresh_subset", "evidence",
]);
const EXPECTED_DELTAS = Object.freeze({
  products: 0,
  product_variants: 0,
  retailer_mappings_row_count: 0,
  offers_row_count: 0,
  stock_updates: 13,
  item_price_updates: 1,
  shipping_updates: 0,
  delivered_total_updates: 1,
  offer_url_updates: 1,
  mapping_url_updates: 1,
  mapping_updated_at_updates: 1,
  freshness_updates: 15,
  price_history_rows: 1,
  retailers: 0,
});

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function money(value, label) {
  const text = String(value ?? "");
  if (!/^\d+\.\d{2}$/.test(text)) throw new Error(`${label} must be exact GBP`);
  return text;
}

function stableReviewedRows(manifest) {
  return manifest.rows.map((row) => {
    if (!exactKeys(row, EXPECTED_ROW_KEYS)) throw new Error("reviewed manifest row keys mismatch");
    if (!/^\d+$/.test(String(row.jons_product_id)) || !/^\d+$/.test(String(row.jons_variant_id))) {
      throw new Error("reviewed manifest Shopify identity is invalid");
    }
    if (!ACTIONS.has(row.exact_action)) throw new Error("reviewed manifest action is not allowed");
    const changedFields = [...row.changed_fields].sort();
    const expectedChanged = [
      row.old_price !== row.new_price ? "price" : null,
      row.old_stock !== row.new_stock ? "stock" : null,
      row.old_url !== row.new_url ? "url" : null,
    ].filter(Boolean).sort();
    if (JSON.stringify(changedFields) !== JSON.stringify(expectedChanged) || changedFields.length === 0) {
      throw new Error("reviewed manifest changed fields mismatch");
    }
    return {
      external_product_id: String(row.jons_product_id),
      external_variant_id: String(row.jons_variant_id),
      action: row.exact_action,
      changed_fields: changedFields,
      before: {
        price: money(row.old_price, "old_price"),
        in_stock: Boolean(row.old_stock),
        url: String(row.old_url),
      },
      after: {
        price: money(row.new_price, "new_price"),
        in_stock: Boolean(row.new_stock),
        url: String(row.new_url),
      },
    };
  }).sort((left, right) => {
    const product = BigInt(left.external_product_id) - BigInt(right.external_product_id);
    if (product !== 0n) return product < 0n ? -1 : 1;
    const variant = BigInt(left.external_variant_id) - BigInt(right.external_variant_id);
    return variant < 0n ? -1 : variant > 0n ? 1 : 0;
  });
}

function loadReviewedMixedChangeManifest(file, requiredSha256) {
  if (!SHA256.test(String(requiredSha256 || ""))) throw new Error("reviewed manifest SHA-256 is required");
  const resolved = path.resolve(file);
  const bytes = fs.readFileSync(resolved);
  const actualSha256 = sha256Bytes(bytes);
  if (actualSha256 !== requiredSha256) throw new Error("reviewed manifest SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (!exactKeys(manifest, EXPECTED_MANIFEST_KEYS)
      || manifest.schema_version !== 1
      || manifest.kind !== MANIFEST_KIND
      || manifest.target_environment !== "PRODUCTION"
      || manifest.target_project_ref !== "aftboxmrdgyhizicfsfu"
      || manifest.retailer_id !== "10"
      || manifest.retailer_slug !== "jon-s-supplements"
      || manifest.source_country !== "GB"
      || !SHA256.test(manifest.source_capture_sha256)
      || manifest.row_count !== 15
      || !Array.isArray(manifest.rows)
      || manifest.rows.length !== 15
      || !Array.isArray(manifest.immutable_scope_offer_ids)
      || manifest.immutable_scope_offer_ids.length !== 15
      || JSON.stringify(manifest.expected_deltas) !== JSON.stringify(EXPECTED_DELTAS)) {
    throw new Error("reviewed manifest contract mismatch");
  }
  const reviewedRows = stableReviewedRows(manifest);
  if (new Set(reviewedRows.map((row) => row.external_variant_id)).size !== reviewedRows.length) {
    throw new Error("reviewed manifest has duplicate Shopify variant identity");
  }
  return Object.freeze({
    path: resolved,
    sha256: actualSha256,
    manifest,
    reviewed_rows: reviewedRows,
    reviewed_scope_hash: fingerprint(reviewedRows),
  });
}

function artifactReviewedRows(artifact) {
  return artifact.rows.map((row) => ({
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    action: row.action,
    changed_fields: Object.entries(row.changed_fields)
      .filter(([key, changed]) => key !== "blocked" && changed)
      .map(([key]) => key)
      .sort(),
    before: {
      price: String(row.atomic_plan.expected_state.offer.price),
      in_stock: Boolean(row.atomic_plan.expected_state.offer.in_stock),
      url: String(row.atomic_plan.expected_state.offer.url),
    },
    after: {
      price: String(row.atomic_plan.offer.values.price),
      in_stock: Boolean(row.atomic_plan.offer.values.in_stock),
      url: String(row.atomic_plan.offer.values.url),
    },
  })).sort((left, right) => {
    const product = BigInt(left.external_product_id) - BigInt(right.external_product_id);
    if (product !== 0n) return product < 0n ? -1 : 1;
    const variant = BigInt(left.external_variant_id) - BigInt(right.external_variant_id);
    return variant < 0n ? -1 : variant > 0n ? 1 : 0;
  });
}

function expectedArtifactDeltas(manifest) {
  const value = manifest.expected_deltas;
  return {
    row_count_deltas: {
      products: value.products,
      product_variants: value.product_variants,
      retailer_products: value.retailer_mappings_row_count,
      offers: value.offers_row_count,
      price_history: value.price_history_rows,
    },
    logical_field_deltas: {
      offer_price_updates: value.item_price_updates,
      offer_shipping_updates: value.shipping_updates,
      offer_total_updates: value.delivered_total_updates,
      offer_stock_updates: value.stock_updates,
      offer_url_updates: value.offer_url_updates,
      mapping_url_updates: value.mapping_url_updates,
      mapping_updated_at_updates: value.mapping_updated_at_updates,
      last_checked_at_updates: value.freshness_updates,
    },
  };
}

function buildReviewedMixedChangeContract({ reviewed, artifact, targetEnvironment, expiresAt }) {
  if (!["STAGING", "PRODUCTION"].includes(targetEnvironment)
      || artifact.target_environment !== targetEnvironment
      || artifact.retailer_id !== reviewed.manifest.retailer_id
      || artifact.source_snapshot_fingerprint !== reviewed.manifest.source_capture_sha256
      || artifact.rows.length !== reviewed.manifest.row_count
      || JSON.stringify(artifactReviewedRows(artifact)) !== JSON.stringify(reviewed.reviewed_rows)
      || JSON.stringify(artifact.expected_deltas) !== JSON.stringify(expectedArtifactDeltas(reviewed.manifest))) {
    throw new Error("live artifact differs from reviewed mixed-change manifest");
  }
  const expiry = new Date(expiresAt);
  const captured = new Date(artifact.source_captured_at);
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString() !== expiresAt
      || !Number.isFinite(captured.getTime()) || captured.toISOString() !== artifact.source_captured_at
      || expiry <= new Date() || expiry.getTime() > Date.now() + 15 * 60 * 1000) {
    throw new Error("reviewed mixed-change timestamps are invalid");
  }
  const core = {
    schema_version: 1,
    kind: CONTRACT_KIND,
    authorization_id: `jons-15-${reviewed.sha256.slice(0, 16)}-${targetEnvironment.toLowerCase()}`,
    target_environment: targetEnvironment,
    retailer_id: reviewed.manifest.retailer_id,
    source_country: reviewed.manifest.source_country,
    reviewed_manifest_sha256: reviewed.sha256,
    reviewed_source_fingerprint: reviewed.manifest.source_capture_sha256,
    reviewed_scope_hash: reviewed.reviewed_scope_hash,
    reviewed_rows: reviewed.reviewed_rows,
    expected_deltas: expectedArtifactDeltas(reviewed.manifest),
    source_captured_at: artifact.source_captured_at,
    expires_at: expiresAt,
    artifact_fingerprint: artifact.artifact_fingerprint,
  };
  return { ...core, reviewed_contract_hash: fingerprint(core) };
}

function bindReviewedMixedChangeContract(request, contract) {
  const bound = { ...request, reviewed_mixed_change_contract: contract, package_fingerprint: null };
  return { ...bound, package_fingerprint: fingerprint(bound) };
}

module.exports = {
  CONTRACT_KIND,
  EXPECTED_DELTAS,
  artifactReviewedRows,
  bindReviewedMixedChangeContract,
  buildReviewedMixedChangeContract,
  expectedArtifactDeltas,
  loadReviewedMixedChangeManifest,
  stableReviewedRows,
};
