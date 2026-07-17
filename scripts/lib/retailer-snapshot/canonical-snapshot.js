const { fingerprintCanonicalSnapshot } = require("./fingerprints");
const { fail } = require("./errors");

const text = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const id = (value, path) => {
  const result = String(value ?? "");
  if (!/^[0-9]+$/.test(result)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "Database ID must be a string", path);
  return result;
};
function add(index, key, value) { if (!key) return; (index[key] ||= []).push(value); }
function stableRows(rows) { return [...rows].map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, /^(?:id|.*_id)$/.test(key) && value != null ? id(value, `$.${key}`) : value]))).sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0); }

function buildCanonicalCatalogueSnapshot(input, metadata = {}) {
  const products = stableRows(input.products || []);
  const variants = stableRows(input.product_variants || input.variants || []);
  const retailers = stableRows(input.retailers || []);
  const mappings = stableRows(input.retailer_products || input.mappings || []);
  const offers = stableRows(input.offers || []);
  const indexes = { product_id: {}, variant_id: {}, product_slug: {}, variant_slug: {}, normalized_product_identity: {}, normalized_variant_identity: {}, external_product_id: {}, external_variant_id: {}, sku: {}, gtin: {}, url: {}, retailer_product_identity: {}, offer_identity: {} };
  for (const row of products) { add(indexes.product_id, row.id, row.id); add(indexes.product_slug, row.slug, row.id); add(indexes.normalized_product_identity, [text(row.brand), text(row.name), text(row.product_format), row.net_weight_g ?? "", row.unit_count ?? ""].join("|"), row.id); add(indexes.gtin, row.gtin, `product:${row.id}`); }
  for (const row of variants) { add(indexes.variant_id, row.id, row.id); add(indexes.variant_slug, row.slug || row.variant_key, row.id); add(indexes.normalized_variant_identity, [row.product_id, text(row.flavour_label), row.size_value ?? "", row.size_unit ?? "", row.pack_count ?? ""].join("|"), row.id); add(indexes.gtin, row.gtin, `variant:${row.id}`); }
  for (const row of mappings) { add(indexes.external_product_id, `${row.retailer_id}|${row.external_product_id}`, row.id); add(indexes.external_variant_id, `${row.retailer_id}|${row.external_variant_id}`, row.id); add(indexes.sku, `${row.retailer_id}|${row.external_sku}`, row.id); add(indexes.gtin, row.external_gtin, `mapping:${row.id}`); add(indexes.url, row.external_url, row.id); add(indexes.retailer_product_identity, `${row.retailer_id}|${row.product_id}|${row.product_variant_id || ""}`, row.id); }
  for (const row of offers) add(indexes.offer_identity, String(row.retailer_product_id), row.id);
  for (const index of Object.values(indexes)) for (const key of Object.keys(index)) index[key].sort((a, b) => String(a).localeCompare(String(b), "en", { numeric: true }));
  const snapshot = { schema_version: 1, snapshot_id: metadata.snapshot_id || "00000000-0000-4000-8000-000000000001", captured_at: metadata.captured_at || "1970-01-01T00:00:00.000Z", database_ref: metadata.database_ref || "read-only-fixture", products, variants, retailers, mappings, offers, counts: { products: products.length, variants: variants.length, retailers: retailers.length, mappings: mappings.length, offers: offers.length }, inactive_records: [...products, ...variants].filter((row) => row.is_active === false).map((row) => String(row.id)), merged_records: products.filter((row) => row.merged_into_product_id != null).map((row) => String(row.id)), indexes, fingerprint: null };
  snapshot.fingerprint = fingerprintCanonicalSnapshot(snapshot);
  const collisions = Object.fromEntries(Object.entries(indexes).map(([name, index]) => [name, Object.entries(index).filter(([, values]) => values.length > 1)]).filter(([, values]) => values.length));
  return { snapshot, collisions };
}

module.exports = { buildCanonicalCatalogueSnapshot };
