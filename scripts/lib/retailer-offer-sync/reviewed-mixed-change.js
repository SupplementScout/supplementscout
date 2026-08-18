const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./artifacts");
const { semanticShopifySnapshot, sha256 } = require("../shopify-snapshot-reader");

const MANIFEST_KINDS = Object.freeze({
  1: "jons-existing-offer-1-price-change-reviewed-manifest",
  10: "jons-existing-offer-10-change-reviewed-manifest",
  11: "jons-existing-offer-11-change-reviewed-manifest",
  15: "jons-existing-offer-15-change-reviewed-manifest",
  16: "jons-existing-offer-16-change-reviewed-manifest",
  23: "jons-existing-offer-23-change-reviewed-manifest",
  47: "fit-house-existing-offer-47-change-reviewed-manifest",
});
const CONTRACT_KIND = "retailer-reviewed-mixed-change-v1";
const SCOPED_CONTRACT_KIND = "retailer-reviewed-mixed-change-v2";
const MAPPED_SCOPE_CONTRACT_KIND = "retailer-reviewed-mapped-scope-v3";
const SHA256 = /^[0-9a-f]{64}$/;
const ACTIONS = new Set(["UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK", "UPDATE_URL", "UPDATE_PRICE_STOCK_URL"]);
const EXPECTED_MANIFEST_KEYS = Object.freeze([
  "schema_version", "kind", "authority", "code_commit", "generated_at",
  "target_environment", "target_project_ref", "retailer_id", "retailer_slug",
  "source_country", "source_capture_sha256", "production_state_sha256",
  "row_count", "immutable_scope_offer_ids", "expected_deltas", "rows",
]);
const EXPECTED_SCOPED_MANIFEST_KEYS = Object.freeze([...EXPECTED_MANIFEST_KEYS, "scoped_source_contract"]);
const EXPECTED_MAPPED_SCOPE_MANIFEST_KEYS = Object.freeze([
  ...EXPECTED_MANIFEST_KEYS,
  "mapped_source_contract",
]);
const EXPECTED_FIT_HOUSE_MANIFEST_KEYS = Object.freeze([
  ...EXPECTED_MANIFEST_KEYS,
  "audited_missing_manifest_sha256",
]);
const EXPECTED_SCOPED_SOURCE_KEYS = Object.freeze([
  "schema_version", "reviewed_full_source_fingerprint", "observed_full_source_fingerprint",
  "reviewed_product_count", "reviewed_variant_count", "observed_product_count",
  "observed_variant_count", "mapped_scope_row_count", "mapped_scope_fingerprint",
  "unmapped_source_delta", "unmapped_source_delta_hash",
]);
const EXPECTED_UNMAPPED_DELTA_KEYS = Object.freeze([
  "added_products", "removed_products", "added_variants", "removed_variants",
]);
const EXPECTED_MAPPED_SOURCE_KEYS = Object.freeze([
  "schema_version", "baseline_full_source_fingerprint", "baseline_product_count",
  "baseline_variant_count", "mapped_scope_row_count", "mapped_scope_fingerprint",
  "allowed_unmapped_collisions", "allowed_unmapped_collisions_hash",
  "unmapped_drift_policy",
]);
const ALLOWED_UNMAPPED_COLLISION_FIELDS = Object.freeze([
  "external_variant_id", "external_sku", "external_gtin", "url",
]);
const EXPECTED_COLLISION_KEYS = Object.freeze([
  "unmapped_external_product_id", "unmapped_external_variant_id",
  "mapped_external_product_id", "mapped_external_variant_id", "collision_fields",
]);
const UNMAPPED_DRIFT_POLICY =
  "ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS";
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
const EXPECTED_FIT_HOUSE_ROW_KEYS = Object.freeze([
  "offer_id", "mapping_id", "canonical_product_id", "canonical_product",
  "canonical_variant_id", "canonical_variant", "external_product_id",
  "external_variant_id", "product", "option", "old_price", "new_price",
  "old_stock", "new_stock", "old_url", "new_url", "source_sku",
  "mapping_gtin", "source_gtin", "exact_action", "changed_fields",
  "review_classification", "source_evidence_timestamp",
  "second_evidence_timestamp", "identity_stability", "evidence",
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
const EXPECTED_DELTAS_16 = Object.freeze({
  ...EXPECTED_DELTAS,
  stock_updates: 14,
  freshness_updates: 16,
});
const EXPECTED_DELTAS_11_STOCK_ONLY = Object.freeze({
  ...EXPECTED_DELTAS,
  stock_updates: 11,
  item_price_updates: 0,
  delivered_total_updates: 0,
  offer_url_updates: 0,
  mapping_url_updates: 0,
  mapping_updated_at_updates: 0,
  freshness_updates: 11,
  price_history_rows: 0,
});
const EXPECTED_DELTAS_10_STOCK_ONLY = Object.freeze({
  ...EXPECTED_DELTAS_11_STOCK_ONLY,
  stock_updates: 10,
  freshness_updates: 10,
});
const EXPECTED_DELTAS_1_PRICE_ONLY = Object.freeze({
  ...EXPECTED_DELTAS_11_STOCK_ONLY,
  stock_updates: 0,
  item_price_updates: 1,
  delivered_total_updates: 1,
  freshness_updates: 1,
  price_history_rows: 1,
});
const EXPECTED_DELTAS_1_STOCK_ONLY = Object.freeze({
  ...EXPECTED_DELTAS_11_STOCK_ONLY,
  stock_updates: 1,
  freshness_updates: 1,
});
const EXPECTED_DELTAS_23_STOCK_ONLY = Object.freeze({
  ...EXPECTED_DELTAS_11_STOCK_ONLY,
  stock_updates: 23,
  freshness_updates: 23,
});
const EXPECTED_DELTAS_47_FIT_HOUSE = Object.freeze({
  ...EXPECTED_DELTAS_11_STOCK_ONLY,
  stock_updates: 45,
  item_price_updates: 3,
  delivered_total_updates: 3,
  freshness_updates: 47,
  price_history_rows: 3,
});
const FIT_HOUSE_47_OFFER_IDS = Object.freeze([
  "689", "691", "712", "713", "717", "723", "729", "730", "735", "737", "743", "750",
  "751", "758", "908", "911", "912", "914", "915", "917", "928", "936", "937", "939",
  "957", "985", "1857", "1877", "1896", "1897", "1910", "1915", "1921", "1927", "1928",
  "1933", "1934", "1935", "1941", "1946", "1953", "1954", "1955", "1963", "1973", "1978", "1979",
]);
const FIT_HOUSE_AUDITED_MISSING_SHA256 = "d30eb618689228c6787df885cebc8855fa72c36cf312d25733434be98ba15aeb";
const FIT_HOUSE_47_TUPLE_HASH = "b23226d28b5da0cede2e4395bbfd35cf4ba2b66803924ebe19bb48b2321510ea";
const FIT_HOUSE_36_OOS_TUPLE_HASH = "aea97f0ade63240431dfaf837f428a78f36fcd25fe3d8d751a14205e0547c4ed";
const FIT_HOUSE_29_AUDITED_ABSENCE_TUPLE_HASH = "2dbe16d3226f089787ba70f93f1f03f63c65a6561529644e444d5f744630a2e7";

function expectedManifestDeltas(rowCount, retailerId) {
  return rowCount === 1 && retailerId === "9" ? EXPECTED_DELTAS_1_STOCK_ONLY
    : rowCount === 1 ? EXPECTED_DELTAS_1_PRICE_ONLY
    : rowCount === 10 ? EXPECTED_DELTAS_10_STOCK_ONLY
    : rowCount === 11 ? EXPECTED_DELTAS_11_STOCK_ONLY
    : rowCount === 15 ? EXPECTED_DELTAS
    : rowCount === 16 ? EXPECTED_DELTAS_16
    : rowCount === 23 ? EXPECTED_DELTAS_23_STOCK_ONLY
    : rowCount === 47 ? EXPECTED_DELTAS_47_FIT_HOUSE
      : null;
}

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
    const fitHouse = manifest.retailer_id === "9";
    const expectedKeys = fitHouse ? EXPECTED_FIT_HOUSE_ROW_KEYS : EXPECTED_ROW_KEYS;
    if (!exactKeys(row, expectedKeys)) throw new Error("reviewed manifest row keys mismatch");
    const externalProductId = fitHouse ? row.external_product_id : row.jons_product_id;
    const externalVariantId = fitHouse ? row.external_variant_id : row.jons_variant_id;
    if (!/^\d+$/.test(String(externalProductId)) || !/^\d+$/.test(String(externalVariantId))) {
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
      external_product_id: String(externalProductId),
      external_variant_id: String(externalVariantId),
      action: row.exact_action,
      changed_fields: changedFields,
      before: {
        price: fitHouse ? String(Number(money(row.old_price, "old_price"))) : money(row.old_price, "old_price"),
        in_stock: Boolean(row.old_stock),
        url: String(row.old_url),
      },
      after: {
        price: fitHouse ? String(Number(money(row.new_price, "new_price"))) : money(row.new_price, "new_price"),
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

function identity(value) {
  return value == null || String(value).trim() === "" ? null : String(value);
}

function compareShopifyIdentity(left, right) {
  const a = String(left);
  const b = String(right);
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
  }
  return a.localeCompare(b);
}

function canonicalVariantUrl(storeUrl, productHandle, variantId) {
  const url = new URL(`/products/${productHandle}`, storeUrl);
  url.searchParams.set("variant", String(variantId));
  return url.href;
}

function mappedSourceRows({ snapshot, sourceVariants, records, storeUrl }) {
  if (!snapshot || !Array.isArray(snapshot.products) || !Array.isArray(sourceVariants)
      || !Array.isArray(records) || records.length === 0) {
    throw new Error("mapped source scope inputs are required");
  }
  const rawByVariant = new Map();
  for (const product of snapshot.products) {
    for (const variant of product.variants || []) {
      const key = String(variant.id);
      if (!key || rawByVariant.has(key)) throw new Error("source parse anomaly: duplicate Shopify variant identity");
      rawByVariant.set(key, { product, variant });
    }
  }
  const sourceByVariant = new Map();
  for (const row of sourceVariants) {
    const key = String(row.external_variant_id);
    if (!key || sourceByVariant.has(key)) throw new Error("source parse anomaly: duplicate projected variant identity");
    sourceByVariant.set(key, row);
  }
  return records.map((record) => {
    const variantId = String(record.mapping.external_variant_id);
    const productId = String(record.mapping.external_product_id);
    const source = sourceByVariant.get(variantId);
    const raw = rawByVariant.get(variantId);
    if (!source || !raw || String(source.external_product_id) !== productId
        || String(raw.product.id) !== productId) {
      throw new Error("mapped Shopify identity is missing or changed");
    }
    const shipping = Number(source.shipping_cost || 0).toFixed(2);
    const price = Number(source.price).toFixed(2);
    return {
      external_product_id: productId,
      external_variant_id: variantId,
      external_sku: identity(source.external_sku),
      external_gtin: identity(raw.variant.barcode),
      price,
      shipping_cost: shipping,
      total_price: (Number(price) + Number(shipping)).toFixed(2),
      in_stock: Boolean(source.in_stock),
      url: canonicalVariantUrl(storeUrl, source.product_handle, variantId),
    };
  }).sort((left, right) => {
    const product = compareShopifyIdentity(left.external_product_id, right.external_product_id);
    return product || compareShopifyIdentity(left.external_variant_id, right.external_variant_id);
  });
}

function unmappedIdentityRows({ snapshot, sourceVariants, records, storeUrl }) {
  if (!snapshot || !Array.isArray(snapshot.products) || !Array.isArray(sourceVariants)
      || !Array.isArray(records) || records.length === 0) {
    throw new Error("unmapped source identity inputs are required");
  }
  const rawByVariant = new Map();
  for (const product of snapshot.products) {
    for (const variant of product.variants || []) {
      const key = String(variant.id);
      if (!key || rawByVariant.has(key)) {
        throw new Error("source parse anomaly: duplicate Shopify variant identity");
      }
      rawByVariant.set(key, variant);
    }
  }
  const mappedVariantIds = new Set(
    records.map((record) => String(record.mapping.external_variant_id)),
  );
  const rows = sourceVariants
    .filter((source) => !mappedVariantIds.has(String(source.external_variant_id)))
    .map((source) => {
      const variantId = String(source.external_variant_id);
      const raw = rawByVariant.get(variantId);
      if (!raw) throw new Error("unmapped projected Shopify variant is missing from raw source");
      return {
        external_product_id: String(source.external_product_id),
        external_variant_id: variantId,
        external_sku: identity(source.external_sku),
        external_gtin: identity(raw.barcode),
        url: canonicalVariantUrl(storeUrl, source.product_handle, variantId),
      };
    })
    .sort((left, right) => {
      const product = compareShopifyIdentity(left.external_product_id, right.external_product_id);
      return product || compareShopifyIdentity(left.external_variant_id, right.external_variant_id);
    });
  if (new Set(rows.map((row) => row.external_variant_id)).size !== rows.length) {
    throw new Error("unmapped Shopify identity is duplicated");
  }
  return rows;
}

function unmappedCollisionEvidence(unmappedRows, mappedRows) {
  if (!Array.isArray(unmappedRows) || !Array.isArray(mappedRows)) {
    throw new Error("mapped collision inputs are required");
  }
  const collisions = [];
  for (const unmapped of unmappedRows) {
    for (const mapped of mappedRows) {
      const collisionFields = [
        unmapped.external_variant_id === mapped.external_variant_id
          ? "external_variant_id" : null,
        unmapped.external_sku && unmapped.external_sku === mapped.external_sku
          ? "external_sku" : null,
        unmapped.external_gtin && unmapped.external_gtin === mapped.external_gtin
          ? "external_gtin" : null,
        unmapped.url === mapped.url ? "url" : null,
      ].filter(Boolean);
      if (collisionFields.length > 0) {
        collisions.push({
          unmapped_external_product_id: unmapped.external_product_id,
          unmapped_external_variant_id: unmapped.external_variant_id,
          mapped_external_product_id: mapped.external_product_id,
          mapped_external_variant_id: mapped.external_variant_id,
          collision_fields: collisionFields,
        });
      }
    }
  }
  return collisions.sort((left, right) => {
    const unmapped = compareShopifyIdentity(
      left.unmapped_external_variant_id,
      right.unmapped_external_variant_id,
    );
    if (unmapped) return unmapped;
    return compareShopifyIdentity(
      left.mapped_external_variant_id,
      right.mapped_external_variant_id,
    );
  });
}

function buildMappedScopeEvidence({ reviewed, snapshot, sourceVariants, records, storeUrl }) {
  const contract = reviewed.manifest.mapped_source_contract;
  if (!contract) throw new Error("mapped reviewed source contract is required");
  const mappedRows = mappedSourceRows({ snapshot, sourceVariants, records, storeUrl });
  const mappedFingerprint = fingerprint(mappedRows);
  if (mappedRows.length !== contract.mapped_scope_row_count
      || mappedFingerprint !== contract.mapped_scope_fingerprint) {
    throw new Error("mapped reviewed source fingerprint mismatch");
  }
  const unmappedRows = unmappedIdentityRows({
    snapshot,
    sourceVariants,
    records,
    storeUrl,
  });
  const collisions = unmappedCollisionEvidence(unmappedRows, mappedRows);
  const allowed = new Set(
    contract.allowed_unmapped_collisions.map((row) => JSON.stringify(row)),
  );
  if (collisions.some((row) => !allowed.has(JSON.stringify(row)))) {
    throw new Error("new unmapped source identity collides with mapped Shopify identity");
  }
  const fullFingerprint = sha256(semanticShopifySnapshot(snapshot));
  const productCount = snapshot.products.length;
  const variantCount = snapshot.products.reduce(
    (count, product) => count + (product.variants || []).length,
    0,
  );
  return Object.freeze({
    full_source_fingerprint: fullFingerprint,
    observed_product_count: productCount,
    observed_variant_count: variantCount,
    mapped_scope_fingerprint: mappedFingerprint,
    mapped_scope_row_count: mappedRows.length,
    unmapped_identity_rows: unmappedRows,
    unmapped_identity_rows_hash: fingerprint(unmappedRows),
    unmapped_identity_row_count: unmappedRows.length,
    unmapped_collisions: collisions,
    unmapped_collisions_hash: fingerprint(collisions),
    allowed_unmapped_collisions_hash: contract.allowed_unmapped_collisions_hash,
    unmapped_drift_policy: contract.unmapped_drift_policy,
    collision_checks: "PASS",
  });
}

function validateDeltaEntry(entry, kind) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || !/^\d+$/.test(String(entry.product_id || ""))) {
    throw new Error(`invalid unmapped ${kind} delta entry`);
  }
  if (kind === "variant" && (!/^\d+$/.test(String(entry.variant_id || ""))
      || !entry.semantic_variant || typeof entry.semantic_variant !== "object")) {
    throw new Error("invalid unmapped variant delta entry");
  }
  if (kind === "product" && (!entry.semantic_product || typeof entry.semantic_product !== "object"
      || String(entry.semantic_product.id) !== String(entry.product_id))) {
    throw new Error("invalid unmapped product delta entry");
  }
}

function reverseUnmappedSourceDelta(snapshot, delta) {
  if (!exactKeys(delta, EXPECTED_UNMAPPED_DELTA_KEYS)
      || !EXPECTED_UNMAPPED_DELTA_KEYS.every((key) => Array.isArray(delta[key]))) {
    throw new Error("unmapped source delta schema mismatch");
  }
  const semantic = structuredClone(semanticShopifySnapshot(snapshot));
  for (const entry of delta.added_products) {
    validateDeltaEntry(entry, "product");
    const index = semantic.products.findIndex((product) => String(product.id) === String(entry.product_id));
    if (index < 0 || JSON.stringify(semantic.products[index]) !== JSON.stringify(entry.semantic_product)) {
      throw new Error("declared added product does not exactly match live source");
    }
    semantic.products.splice(index, 1);
  }
  for (const entry of delta.removed_products) {
    validateDeltaEntry(entry, "product");
    if (semantic.products.some((product) => String(product.id) === String(entry.product_id))) {
      throw new Error("declared removed product still exists");
    }
    semantic.products.push(structuredClone(entry.semantic_product));
  }
  for (const entry of delta.added_variants) {
    validateDeltaEntry(entry, "variant");
    const product = semantic.products.find((row) => String(row.id) === String(entry.product_id));
    const index = product?.variants?.findIndex((variant) => String(variant.id) === String(entry.variant_id)) ?? -1;
    if (!product || index < 0 || JSON.stringify(product.variants[index]) !== JSON.stringify(entry.semantic_variant)) {
      throw new Error("declared added variant does not exactly match live source");
    }
    product.variants.splice(index, 1);
  }
  for (const entry of delta.removed_variants) {
    validateDeltaEntry(entry, "variant");
    const product = semantic.products.find((row) => String(row.id) === String(entry.product_id));
    if (!product || product.variants.some((variant) => String(variant.id) === String(entry.variant_id))) {
      throw new Error("declared removed variant cannot be restored");
    }
    product.variants.push(structuredClone(entry.semantic_variant));
  }
  semantic.products.sort((left, right) => compareShopifyIdentity(left.id, right.id));
  for (const product of semantic.products) {
    product.variants.sort((left, right) => compareShopifyIdentity(left.id, right.id));
  }
  return semantic;
}

function deltaIdentityRows(delta, storeUrl) {
  const rows = [];
  for (const entry of [...delta.added_products, ...delta.removed_products]) {
    validateDeltaEntry(entry, "product");
    for (const variant of entry.semantic_product.variants || []) rows.push({
      external_product_id: String(entry.product_id),
      external_variant_id: String(variant.id),
      external_sku: identity(variant.sku),
      external_gtin: identity(variant.barcode),
      url: canonicalVariantUrl(storeUrl, entry.semantic_product.handle, variant.id),
    });
  }
  for (const entry of [...delta.added_variants, ...delta.removed_variants]) {
    validateDeltaEntry(entry, "variant");
    rows.push({
      external_product_id: String(entry.product_id),
      external_variant_id: String(entry.variant_id),
      external_sku: identity(entry.semantic_variant.sku),
      external_gtin: identity(entry.semantic_variant.barcode),
      url: String(entry.url),
    });
  }
  return rows;
}

function assertNoMappedCollision(deltaRows, mappedRows) {
  for (const delta of deltaRows) {
    const collision = mappedRows.find((mapped) =>
      mapped.external_product_id === delta.external_product_id
      || mapped.external_variant_id === delta.external_variant_id
      || (delta.external_sku && mapped.external_sku === delta.external_sku)
      || (delta.external_gtin && mapped.external_gtin === delta.external_gtin)
      || mapped.url === delta.url);
    if (collision) throw new Error("unmapped source delta collides with mapped Shopify identity");
  }
}

function buildScopedSourceEvidence({ reviewed, snapshot, sourceVariants, records, storeUrl }) {
  const scoped = reviewed.manifest.scoped_source_contract;
  if (!scoped) throw new Error("scoped reviewed source contract is required");
  const mappedRows = mappedSourceRows({ snapshot, sourceVariants, records, storeUrl });
  const mappedFingerprint = fingerprint(mappedRows);
  const fullFingerprint = sha256(semanticShopifySnapshot(snapshot));
  const productCount = snapshot.products.length;
  const variantCount = snapshot.products.reduce((count, product) => count + (product.variants || []).length, 0);
  if (fullFingerprint !== scoped.observed_full_source_fingerprint
      || productCount !== scoped.observed_product_count
      || variantCount !== scoped.observed_variant_count
      || mappedRows.length !== scoped.mapped_scope_row_count
      || mappedFingerprint !== scoped.mapped_scope_fingerprint) {
    throw new Error("scoped reviewed source fingerprint mismatch");
  }
  const reconstructed = reverseUnmappedSourceDelta(snapshot, scoped.unmapped_source_delta);
  const reconstructedFingerprint = sha256(reconstructed);
  const reconstructedProducts = reconstructed.products.length;
  const reconstructedVariants = reconstructed.products.reduce(
    (count, product) => count + (product.variants || []).length, 0,
  );
  if (reconstructedFingerprint !== scoped.reviewed_full_source_fingerprint
      || reconstructedProducts !== scoped.reviewed_product_count
      || reconstructedVariants !== scoped.reviewed_variant_count) {
    throw new Error("unmapped source delta does not reconstruct reviewed full source");
  }
  const deltaRows = deltaIdentityRows(scoped.unmapped_source_delta, storeUrl);
  assertNoMappedCollision(deltaRows, mappedRows);
  return Object.freeze({
    full_source_fingerprint: fullFingerprint,
    reviewed_full_source_fingerprint: reconstructedFingerprint,
    mapped_scope_fingerprint: mappedFingerprint,
    mapped_scope_row_count: mappedRows.length,
    mapped_scope_rows: mappedRows,
    unmapped_source_delta: scoped.unmapped_source_delta,
    unmapped_source_delta_hash: scoped.unmapped_source_delta_hash,
    collision_checks: "PASS",
  });
}

function loadReviewedMixedChangeManifest(file, requiredSha256) {
  if (!SHA256.test(String(requiredSha256 || ""))) throw new Error("reviewed manifest SHA-256 is required");
  const resolved = path.resolve(file);
  const bytes = fs.readFileSync(resolved);
  const actualSha256 = sha256Bytes(bytes);
  if (actualSha256 !== requiredSha256) throw new Error("reviewed manifest SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  const scoped = exactKeys(manifest, EXPECTED_SCOPED_MANIFEST_KEYS);
  const mapped = exactKeys(manifest, EXPECTED_MAPPED_SCOPE_MANIFEST_KEYS);
  const fitHouse = exactKeys(manifest, EXPECTED_FIT_HOUSE_MANIFEST_KEYS);
  const expectedDeltas = expectedManifestDeltas(manifest.row_count, manifest.retailer_id);
  const expectedKind = manifest.retailer_id === "9" && manifest.row_count === 1
    ? "fit-house-existing-offer-1-stock-change-reviewed-manifest"
    : MANIFEST_KINDS[manifest.row_count];
  if (!(exactKeys(manifest, EXPECTED_MANIFEST_KEYS) || scoped || mapped || fitHouse)
      || manifest.schema_version !== 1
      || manifest.kind !== expectedKind
      || manifest.target_environment !== "PRODUCTION"
      || manifest.target_project_ref !== "aftboxmrdgyhizicfsfu"
      || !((manifest.retailer_id === "10" && manifest.retailer_slug === "jon-s-supplements")
        || (manifest.retailer_id === "9" && manifest.retailer_slug === "fit-house"
          && ((manifest.row_count === 47
            && manifest.authority === "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes")
            || (manifest.row_count === 1
              && manifest.authority === "owner-approved-chat-2026-08-18-mutant-creakong-offer-697-oos"))
          && SHA256.test(manifest.audited_missing_manifest_sha256)))
      || manifest.source_country !== "GB"
      || !SHA256.test(manifest.source_capture_sha256)
      || !expectedDeltas
      || !Array.isArray(manifest.rows)
      || manifest.rows.length !== manifest.row_count
      || !Array.isArray(manifest.immutable_scope_offer_ids)
      || manifest.immutable_scope_offer_ids.length !== manifest.row_count
      || JSON.stringify(manifest.expected_deltas) !== JSON.stringify(expectedDeltas)) {
    throw new Error("reviewed manifest contract mismatch");
  }
  if (scoped) {
    const contract = manifest.scoped_source_contract;
    if (!exactKeys(contract, EXPECTED_SCOPED_SOURCE_KEYS)
        || contract.schema_version !== 1
        || ![contract.reviewed_full_source_fingerprint, contract.observed_full_source_fingerprint,
          contract.mapped_scope_fingerprint, contract.unmapped_source_delta_hash].every((value) => SHA256.test(value))
        || contract.reviewed_full_source_fingerprint !== manifest.source_capture_sha256
        || !Number.isInteger(contract.reviewed_product_count)
        || !Number.isInteger(contract.reviewed_variant_count)
        || !Number.isInteger(contract.observed_product_count)
        || !Number.isInteger(contract.observed_variant_count)
        || !Number.isInteger(contract.mapped_scope_row_count)
        || contract.mapped_scope_row_count !== 506
        || !exactKeys(contract.unmapped_source_delta, EXPECTED_UNMAPPED_DELTA_KEYS)
        || fingerprint(contract.unmapped_source_delta) !== contract.unmapped_source_delta_hash) {
      throw new Error("scoped reviewed source contract mismatch");
    }
  }
  if (mapped) {
    const contract = manifest.mapped_source_contract;
    const collisions = contract?.allowed_unmapped_collisions;
    if (!exactKeys(contract, EXPECTED_MAPPED_SOURCE_KEYS)
        || contract.schema_version !== 1
        || ![contract.baseline_full_source_fingerprint,
          contract.mapped_scope_fingerprint,
          contract.allowed_unmapped_collisions_hash].every((value) => SHA256.test(value))
        || !Number.isInteger(contract.baseline_product_count)
        || !Number.isInteger(contract.baseline_variant_count)
        || !Number.isInteger(contract.mapped_scope_row_count)
        || contract.mapped_scope_row_count !== 506
        || !Array.isArray(collisions)
        || collisions.some((row) =>
          !exactKeys(row, EXPECTED_COLLISION_KEYS)
          || !Array.isArray(row.collision_fields)
          || row.collision_fields.length === 0
          || row.collision_fields.some((field) =>
            !ALLOWED_UNMAPPED_COLLISION_FIELDS.includes(field)))
        || fingerprint(collisions) !== contract.allowed_unmapped_collisions_hash
        || contract.unmapped_drift_policy !== UNMAPPED_DRIFT_POLICY) {
      throw new Error("mapped reviewed source contract mismatch");
    }
  }
  if (fitHouse && manifest.row_count === 47) {
    const tuples = manifest.rows.map((row) => [row.offer_id, row.mapping_id,
      row.canonical_product_id, row.canonical_variant_id,
      row.external_product_id, row.external_variant_id]);
    const newlyOos = manifest.rows.filter((row) => row.old_stock === true && row.new_stock === false);
    const restocked = manifest.rows.filter((row) => row.old_stock === false && row.new_stock === true);
    const priceChanged = manifest.rows.filter((row) => row.old_price !== row.new_price);
    const auditedAbsences = newlyOos.filter((row) => row.evidence?.audited_source_absent === true);
    const actions = manifest.rows.reduce((counts, row) => ({
      ...counts, [row.exact_action]: (counts[row.exact_action] || 0) + 1,
    }), {});
    const overlap = manifest.rows.find((row) => row.offer_id === "1910");
    if (manifest.audited_missing_manifest_sha256 !== FIT_HOUSE_AUDITED_MISSING_SHA256
        || JSON.stringify(manifest.immutable_scope_offer_ids) !== JSON.stringify(FIT_HOUSE_47_OFFER_IDS)
        || fingerprint(tuples) !== FIT_HOUSE_47_TUPLE_HASH
        || newlyOos.length !== 36 || restocked.length !== 9 || priceChanged.length !== 3
        || fingerprint(newlyOos.map((row) => [row.offer_id, row.mapping_id,
          row.canonical_product_id, row.canonical_variant_id,
          row.external_product_id, row.external_variant_id])) !== FIT_HOUSE_36_OOS_TUPLE_HASH
        || auditedAbsences.length !== 29
        || fingerprint(auditedAbsences.map((row) => [row.offer_id, row.mapping_id,
          row.canonical_product_id, row.canonical_variant_id,
          row.external_product_id, row.external_variant_id])) !== FIT_HOUSE_29_AUDITED_ABSENCE_TUPLE_HASH
        || newlyOos.some((row) => row.evidence?.audited_source_absent !== true
          && row.evidence?.audited_source_absent !== false)
        || JSON.stringify(priceChanged.map((row) => row.offer_id)) !== JSON.stringify(["691", "1910", "1935"])
        || actions.UPDATE_STOCK !== 44 || actions.UPDATE_PRICE !== 2
        || actions.UPDATE_PRICE_AND_STOCK !== 1 || Object.keys(actions).length !== 3
        || !overlap || overlap.old_stock !== false || overlap.new_stock !== true
        || overlap.old_price !== "24.99" || overlap.new_price !== "34.99"
        || overlap.exact_action !== "UPDATE_PRICE_AND_STOCK"
        || JSON.stringify([...overlap.changed_fields].sort()) !== JSON.stringify(["price", "stock"])
        || manifest.rows.some((row) => row.old_url !== row.new_url
          || row.changed_fields.includes("url"))) {
      throw new Error("Fit House reviewed 47-row owner scope mismatch");
    }
  }
  if (fitHouse && manifest.row_count === 1) {
    const row = manifest.rows[0];
    if (manifest.audited_missing_manifest_sha256 !== FIT_HOUSE_AUDITED_MISSING_SHA256
        || JSON.stringify(manifest.immutable_scope_offer_ids) !== JSON.stringify(["697"])
        || row.offer_id !== "697" || row.mapping_id !== "689"
        || row.canonical_product_id !== "679" || row.canonical_variant_id !== "532"
        || row.external_product_id !== "10028457820400"
        || row.external_variant_id !== "49744956850416"
        || row.source_sku !== null
        || row.old_price !== "26.99" || row.new_price !== "26.99"
        || row.old_stock !== true || row.new_stock !== false
        || row.old_url !== row.new_url
        || row.exact_action !== "UPDATE_STOCK"
        || JSON.stringify(row.changed_fields) !== JSON.stringify(["stock"])
        || row.review_classification !== "OWNER_APPROVED_EXACT_SOURCE_ABSENCE_AS_OOS"
        || row.identity_stability !== "STABLY_ABSENT_IN_TWO_CAPTURES"
        || row.evidence?.exact_external_ids !== true
        || row.evidence?.canonical_target_stable !== true
        || row.evidence?.source_product_exists !== false
        || row.evidence?.source_variant_exists !== false
        || row.evidence?.first_capture_same_semantics !== true
        || row.evidence?.owner_approved_offer_697 !== true) {
      throw new Error("Fit House reviewed offer 697 OOS scope mismatch");
    }
  }
  if (manifest.retailer_id === "10" && manifest.row_count === 1) {
    const row = manifest.rows[0];
    if (manifest.authority !== "owner-approved-chat-2026-08-18-offer-1098-price-9-99"
        || JSON.stringify(manifest.immutable_scope_offer_ids) !== JSON.stringify(["1098"])
        || row.offer_id !== "1098" || row.mapping_id !== "1284"
        || row.canonical_product_id !== "823" || row.canonical_variant_id !== "1170"
        || row.jons_product_id !== "10074965508434"
        || row.jons_variant_id !== "50781523575122"
        || row.source_sku !== "STM08001"
        || row.old_price !== "27.95" || row.new_price !== "9.99"
        || row.old_stock !== true || row.new_stock !== true
        || row.old_url !== row.new_url
        || row.exact_action !== "UPDATE_PRICE"
        || JSON.stringify(row.changed_fields) !== JSON.stringify(["price"])
        || row.review_classification !== "APPROVE_PRICE_CHANGE"
        || row.identity_stability !== "STABLE"
        || row.evidence?.source_product_exists !== true
        || row.evidence?.source_variant_exists !== true
        || row.evidence?.source_variant_available_explicit !== true
        || row.evidence?.first_capture_same_semantics !== true
        || row.evidence?.exact_external_ids !== true
        || row.evidence?.canonical_target_stable !== true) {
      throw new Error("Jon's reviewed offer 1098 price scope mismatch");
    }
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
    scoped,
    mapped,
  });
}

function artifactReviewedRows(artifact) {
  const artifactMoney = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error("artifact price must be exact GBP");
    return String(numeric);
  };
  return artifact.rows.map((row) => ({
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    action: row.action,
    changed_fields: Object.entries(row.changed_fields)
      .filter(([key, changed]) => key !== "blocked" && changed)
      .map(([key]) => key)
      .sort(),
    before: {
      price: artifactMoney(row.atomic_plan.expected_state.offer.price),
      in_stock: Boolean(row.atomic_plan.expected_state.offer.in_stock),
      url: String(row.atomic_plan.expected_state.offer.url),
    },
    after: {
      price: artifactMoney(row.atomic_plan.offer.values.price),
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

function reviewedExecutionPreconditions(artifact) {
  return artifact.rows.map((row) => ({
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    offer_id: String(row.offer_id),
    retailer_product_id: String(row.retailer_product_id),
    mapping_updated_at: String(row.atomic_plan.expected_state.retailer_product.updated_at),
    offer_last_checked_at: String(row.atomic_plan.expected_state.offer.last_checked_at),
  })).sort((left, right) => compareShopifyIdentity(left.external_variant_id, right.external_variant_id));
}

function buildReviewedMixedChangeContract({
  reviewed,
  artifact,
  targetEnvironment,
  expiresAt,
  scopedSourceEvidence = null,
  mappedSourceEvidence = null,
}) {
  if (!["STAGING", "PRODUCTION"].includes(targetEnvironment)
      || artifact.target_environment !== targetEnvironment
      || artifact.retailer_id !== reviewed.manifest.retailer_id
      || (!reviewed.scoped && !reviewed.mapped
        && artifact.source_snapshot_fingerprint !== reviewed.manifest.source_capture_sha256)
      || artifact.rows.length !== reviewed.manifest.row_count
      || JSON.stringify(artifactReviewedRows(artifact)) !== JSON.stringify(reviewed.reviewed_rows)
      || JSON.stringify(artifact.expected_deltas) !== JSON.stringify(expectedArtifactDeltas(reviewed.manifest))) {
    throw new Error(`live artifact differs from reviewed mixed-change manifest (target=${artifact.target_environment === targetEnvironment},retailer=${artifact.retailer_id === reviewed.manifest.retailer_id},source=${artifact.source_snapshot_fingerprint === reviewed.manifest.source_capture_sha256},rows=${artifact.rows.length === reviewed.manifest.row_count && JSON.stringify(artifactReviewedRows(artifact)) === JSON.stringify(reviewed.reviewed_rows)},deltas=${JSON.stringify(artifact.expected_deltas) === JSON.stringify(expectedArtifactDeltas(reviewed.manifest))})`);
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
    authorization_id:
      `${reviewed.manifest.retailer_id === "10" ? "jons" : reviewed.manifest.retailer_slug}-${reviewed.manifest.row_count}-${reviewed.sha256.slice(0, 16)}-${targetEnvironment.toLowerCase()}`,
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
  if (reviewed.mapped) {
    const definition = reviewed.manifest.mapped_source_contract;
    if (!mappedSourceEvidence
        || mappedSourceEvidence.full_source_fingerprint
          !== artifact.source_snapshot_fingerprint
        || mappedSourceEvidence.mapped_scope_fingerprint
          !== definition.mapped_scope_fingerprint
        || mappedSourceEvidence.mapped_scope_row_count
          !== definition.mapped_scope_row_count
        || mappedSourceEvidence.allowed_unmapped_collisions_hash
          !== definition.allowed_unmapped_collisions_hash
        || mappedSourceEvidence.unmapped_drift_policy
          !== definition.unmapped_drift_policy
        || mappedSourceEvidence.collision_checks !== "PASS") {
      throw new Error("mapped source evidence differs from reviewed mixed-change manifest");
    }
    const executionPreconditions = reviewedExecutionPreconditions(artifact);
    const reviewedChangeScope = {
      reviewed_rows: reviewed.reviewed_rows,
      execution_preconditions: executionPreconditions,
      expected_deltas: expectedArtifactDeltas(reviewed.manifest),
    };
    Object.assign(core, {
      schema_version: 3,
      kind: MAPPED_SCOPE_CONTRACT_KIND,
      full_source_fingerprint: mappedSourceEvidence.full_source_fingerprint,
      observed_product_count: mappedSourceEvidence.observed_product_count,
      observed_variant_count: mappedSourceEvidence.observed_variant_count,
      mapped_scope_fingerprint: mappedSourceEvidence.mapped_scope_fingerprint,
      mapped_scope_row_count: mappedSourceEvidence.mapped_scope_row_count,
      unmapped_identity_rows: mappedSourceEvidence.unmapped_identity_rows,
      unmapped_identity_rows_hash: mappedSourceEvidence.unmapped_identity_rows_hash,
      unmapped_identity_row_count: mappedSourceEvidence.unmapped_identity_row_count,
      unmapped_collisions: mappedSourceEvidence.unmapped_collisions,
      unmapped_collisions_hash: mappedSourceEvidence.unmapped_collisions_hash,
      allowed_unmapped_collisions_hash:
        mappedSourceEvidence.allowed_unmapped_collisions_hash,
      unmapped_drift_policy: mappedSourceEvidence.unmapped_drift_policy,
      collision_checks: mappedSourceEvidence.collision_checks,
      reviewed_change_scope_hash: fingerprint(reviewedChangeScope),
      execution_preconditions: executionPreconditions,
    });
  } else if (reviewed.scoped) {
    if (!scopedSourceEvidence
        || scopedSourceEvidence.full_source_fingerprint !== artifact.source_snapshot_fingerprint
        || scopedSourceEvidence.mapped_scope_fingerprint
          !== reviewed.manifest.scoped_source_contract.mapped_scope_fingerprint
        || scopedSourceEvidence.unmapped_source_delta_hash
          !== reviewed.manifest.scoped_source_contract.unmapped_source_delta_hash) {
      throw new Error("scoped source evidence differs from reviewed mixed-change manifest");
    }
    const executionPreconditions = reviewedExecutionPreconditions(artifact);
    const reviewedChangeScope = {
      reviewed_rows: reviewed.reviewed_rows,
      execution_preconditions: executionPreconditions,
      expected_deltas: expectedArtifactDeltas(reviewed.manifest),
    };
    Object.assign(core, {
      schema_version: 2,
      kind: SCOPED_CONTRACT_KIND,
      full_source_fingerprint: scopedSourceEvidence.full_source_fingerprint,
      reviewed_full_source_fingerprint: scopedSourceEvidence.reviewed_full_source_fingerprint,
      mapped_scope_fingerprint: scopedSourceEvidence.mapped_scope_fingerprint,
      mapped_scope_row_count: scopedSourceEvidence.mapped_scope_row_count,
      unmapped_source_delta: scopedSourceEvidence.unmapped_source_delta,
      unmapped_source_delta_hash: scopedSourceEvidence.unmapped_source_delta_hash,
      reviewed_change_scope_hash: fingerprint(reviewedChangeScope),
      execution_preconditions: executionPreconditions,
    });
  }
  return { ...core, reviewed_contract_hash: fingerprint(core) };
}

function bindReviewedMixedChangeContract(request, contract) {
  const bound = { ...request, reviewed_mixed_change_contract: contract, package_fingerprint: null };
  return { ...bound, package_fingerprint: fingerprint(bound) };
}

module.exports = {
  CONTRACT_KIND,
  MAPPED_SCOPE_CONTRACT_KIND,
  SCOPED_CONTRACT_KIND,
  EXPECTED_DELTAS,
  EXPECTED_DELTAS_10_STOCK_ONLY,
  EXPECTED_DELTAS_16,
  EXPECTED_DELTAS_47_FIT_HOUSE,
  artifactReviewedRows,
  bindReviewedMixedChangeContract,
  buildMappedScopeEvidence,
  buildScopedSourceEvidence,
  buildReviewedMixedChangeContract,
  expectedArtifactDeltas,
  loadReviewedMixedChangeManifest,
  mappedSourceRows,
  reverseUnmappedSourceDelta,
  reviewedExecutionPreconditions,
  stableReviewedRows,
  unmappedCollisionEvidence,
  unmappedIdentityRows,
};
