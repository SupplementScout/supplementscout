const { validateContract } = require("./schemas");
const { fail } = require("./errors");
const { fingerprintSourceSnapshot } = require("./fingerprints");

function duplicates(records, getter) {
  const groups = new Map();
  for (const record of records) {
    const key = getter(record);
    if (key === null || key === undefined || key === "") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record.source_record_id);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([value, record_ids]) => ({ value, record_ids }));
}

function inspectSourceSnapshot(snapshot, { validateSchema = true } = {}) {
  if (validateSchema) validateContract("RetailerSourceSnapshot", snapshot);
  const records = snapshot.records || [];
  const productKeys = new Set(records.map((record) => record.source_product_key || record.external_product_id));
  const inStock = records.filter((record) => (record.commerce?.in_stock ?? record.in_stock) === true).length;
  const outOfStock = records.filter((record) => (record.commerce?.in_stock ?? record.in_stock) === false).length;
  const checks = { record_count: records.length, product_count: productKeys.size, variant_count: records.length, in_stock_count: inStock, out_of_stock_count: outOfStock };
  for (const [field, actual] of Object.entries(checks)) if (snapshot[field] !== actual) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `${field} mismatch`, `$.${field}`, { expected: snapshot[field], actual });
  const duplicate_record_ids = duplicates(records, (record) => record.source_record_id);
  const duplicate_external_product_ids = duplicates(records, (record) => record.external_identity?.external_product_id || record.external_product_id);
  const duplicate_external_variant_ids = duplicates(records, (record) => record.external_identity?.external_variant_id || record.external_variant_id);
  const duplicate_source_variant_keys = duplicates(records, (record) => record.source_variant_key || record.immutable_source_identity);
  if (duplicate_record_ids.length || duplicate_external_variant_ids.length || duplicate_source_variant_keys.length) fail("RSBI_DUPLICATE_IDENTITY", "Source contains duplicate stable identity", "$.records", { duplicate_record_ids, duplicate_external_variant_ids, duplicate_source_variant_keys });
  const fingerprint = fingerprintSourceSnapshot(snapshot);
  return { valid: true, checks, duplicate_external_product_ids, fingerprint };
}

function validateSourceSnapshot(snapshot, options) { return inspectSourceSnapshot(snapshot, options); }
module.exports = { duplicates, inspectSourceSnapshot, validateSourceSnapshot };
