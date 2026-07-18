const fs = require("node:fs");
const path = require("node:path");

const {
  planFingerprint,
  serializeImportPlan,
  sourceRowFingerprint,
  writeDryRunArtifact,
} = require("./import-products");
const { canonicalJson, normalizeDecimalString, normalizeNumbersToDecimalStrings } = require("./lib/canonical-json");

const SHA256 = /^[0-9a-f]{64}$/;
const TARGETS = new Map([
  ["STAGING", "hxnrsyyqffztlvcrtgbf"],
  ["PRODUCTION", "aftboxmrdgyhizicfsfu"],
]);

const PRODUCT_KEYS = ["id", "name", "is_active", "merged_into_product_id", "product_format"];
const RETAILER_KEYS = ["id", "name", "slug", "website"];
const VARIANT_KEYS = ["id", "product_id", "variant_key", "display_name", "flavour_code", "flavour_label", "size_value", "size_unit", "pack_count", "product_format", "is_active", "is_default"];
const MAPPING_KEYS = ["id", "retailer_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "external_sku", "external_options", "external_name", "external_slug", "external_gtin", "external_url", "match_method", "match_confidence"];
const OFFER_KEYS = ["id", "product_id", "retailer_id", "product_variant_id", "retailer_product_id", "price", "shipping_cost", "total_price", "in_stock", "url", "last_checked_at"];
const SOURCE_KEYS = ["external_product_id", "external_variant_id", "price", "in_stock", "url"];
const RECORD_KEYS = ["source_snapshot_sha256", "source_captured_at", "source", "target"];
const TARGET_STATE_KEYS = ["product", "retailer", "product_variant", "retailer_product", "offer"];

function fail(message) { throw new Error(message); }

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(`${label} has an invalid closed schema`);
}

function requiredString(value, label) {
  const result = String(value ?? "").trim();
  if (!result) fail(`${label} is required`);
  return result;
}

function exactId(value, label) {
  const result = requiredString(value, label);
  if (!/^\d+$/.test(result)) fail(`${label} must be a positive integer ID`);
  return result;
}

function exactBoolean(value, label) {
  if (value !== true && value !== false) fail(`${label} must be boolean`);
  return value;
}

function isoTimestamp(value, label) {
  const result = requiredString(value, label);
  if (!Number.isFinite(Date.parse(result))) fail(`${label} must be an ISO timestamp`);
  return new Date(result).toISOString();
}

function databaseTimestamp(value, label) {
  const result = requiredString(value, label);
  if (!Number.isFinite(Date.parse(result))) fail(`${label} must be an ISO timestamp`);
  const fraction = result.match(/\.(\d{1,6})/)?.[1] || "";
  const milliseconds = new Date(result).toISOString();
  return `${milliseconds.slice(0, 23)}${fraction.padEnd(6, "0").slice(3, 6)}Z`;
}

function nullableDecimal(value, label) {
  if (value === null) return null;
  return normalizeDecimalString(value, label);
}

function normalizeState(value, keys) {
  return normalizeNumbersToDecimalStrings(Object.fromEntries(keys.map((key) => [key, value[key] ?? null])));
}

function validateTarget(targetEnvironment, targetProjectRef) {
  const environment = requiredString(targetEnvironment, "target_environment").toUpperCase();
  const projectRef = requiredString(targetProjectRef, "target_project_ref");
  if (TARGETS.get(environment) !== projectRef) fail("target environment/project ref mismatch");
  return { environment, projectRef };
}

function normalizeRecord(record, options) {
  assertExactKeys(record, RECORD_KEYS, "verification record");
  assertExactKeys(record.source, SOURCE_KEYS, "verification source");
  assertExactKeys(record.target, TARGET_STATE_KEYS, "verification target");
  assertExactKeys(record.target.product, PRODUCT_KEYS, "target product");
  assertExactKeys(record.target.retailer, RETAILER_KEYS, "target retailer");
  assertExactKeys(record.target.product_variant, VARIANT_KEYS, "target product_variant");
  assertExactKeys(record.target.retailer_product, MAPPING_KEYS, "target retailer_product");
  assertExactKeys(record.target.offer, OFFER_KEYS, "target offer");

  const snapshotHash = requiredString(record.source_snapshot_sha256, "source_snapshot_sha256").toLowerCase();
  if (!SHA256.test(snapshotHash) || !options.sourceSnapshotSha256s.has(snapshotHash)) fail("source snapshot SHA-256 mismatch");
  const capturedAt = isoTimestamp(record.source_captured_at, "source_captured_at");
  const capturedMs = Date.parse(capturedAt);
  if (capturedMs > options.now.getTime() + options.futureSkewMs) fail("source capture time is in the future");
  if (capturedMs < options.now.getTime() - options.maximumSourceAgeMs) fail("source snapshot is stale");

  const product = normalizeState(record.target.product, PRODUCT_KEYS);
  const retailer = normalizeState(record.target.retailer, RETAILER_KEYS);
  const variant = normalizeState(record.target.product_variant, VARIANT_KEYS);
  const mapping = normalizeState(record.target.retailer_product, MAPPING_KEYS);
  const offer = normalizeState(record.target.offer, OFFER_KEYS);
  variant.size_value = nullableDecimal(variant.size_value, "target variant size_value");
  mapping.match_confidence = nullableDecimal(mapping.match_confidence, "target mapping match_confidence");
  offer.price = normalizeDecimalString(offer.price, "target offer price");
  offer.shipping_cost = nullableDecimal(offer.shipping_cost, "target shipping_cost");
  offer.total_price = nullableDecimal(offer.total_price, "target total_price");
  const source = {
    external_product_id: exactId(record.source.external_product_id, "source external_product_id"),
    external_variant_id: exactId(record.source.external_variant_id, "source external_variant_id"),
    price: normalizeDecimalString(record.source.price, "source price"),
    in_stock: exactBoolean(record.source.in_stock, "source in_stock"),
    url: requiredString(record.source.url, "source url"),
  };

  for (const [name, state] of [["product", product], ["retailer", retailer], ["product_variant", variant], ["retailer_product", mapping], ["offer", offer]]) {
    exactId(state.id, `${name} id`);
  }
  if (product.is_active !== true || product.merged_into_product_id !== null) fail("target product is inactive or merged");
  if (variant.is_active !== true) fail("target product variant is inactive");
  if (variant.product_id !== product.id || mapping.product_id !== product.id || offer.product_id !== product.id) fail("product identity mismatch");
  if (mapping.product_variant_id !== variant.id || offer.product_variant_id !== variant.id) fail("variant identity mismatch");
  if (mapping.retailer_id !== retailer.id || offer.retailer_id !== retailer.id) fail("retailer identity mismatch");
  if (offer.retailer_product_id !== mapping.id) fail("offer/mapping identity mismatch");
  if (mapping.external_product_id !== source.external_product_id || mapping.external_variant_id !== source.external_variant_id) fail("external identity drift");
  if (mapping.external_url !== source.url || offer.url !== source.url) fail("URL mismatch");
  if (offer.price !== source.price) fail("price drift");
  if (offer.in_stock !== source.in_stock) fail("stock drift");
  const previousCheckedAt = databaseTimestamp(offer.last_checked_at, "target last_checked_at");
  if (capturedMs <= Date.parse(previousCheckedAt)) fail("source capture is not newer than target last_checked_at");

  return normalizeNumbersToDecimalStrings({
    source_snapshot_sha256: snapshotHash,
    source_captured_at: capturedAt,
    source,
    target: { product, retailer, product_variant: variant, retailer_product: mapping, offer: { ...offer, last_checked_at: previousCheckedAt } },
  });
}

function buildVerifiedNoChangePlan(record, options = {}) {
  const { environment, projectRef } = validateTarget(options.targetEnvironment, options.targetProjectRef);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (!Number.isFinite(now.getTime())) fail("now is invalid");
  const sourceHashes = new Set(options.sourceSnapshotSha256s || []);
  const normalized = normalizeRecord(record, {
    now,
    sourceSnapshotSha256s: sourceHashes,
    maximumSourceAgeMs: Number(options.maximumSourceAgeMs ?? 24 * 60 * 60 * 1000),
    futureSkewMs: Number(options.futureSkewMs ?? 5 * 60 * 1000),
  });
  const { product, retailer, product_variant: variant, retailer_product: mapping, offer } = normalized.target;
  const plan = {
    meta: {
      version: 2,
      plan_kind: "feed",
      operation_type: "verify_offer_no_change",
      source_row_fingerprint: sourceRowFingerprint(normalized),
      plan_fingerprint: null,
      target_environment: environment,
      target_project_ref: projectRef,
      source_snapshot_sha256: normalized.source_snapshot_sha256,
      source_captured_at: normalized.source_captured_at,
    },
    product: { action: "existing", id: product.id },
    product_variant: { action: "existing", id: variant.id, evidence: {
      external_product_id: normalized.source.external_product_id,
      external_variant_id: normalized.source.external_variant_id,
    } },
    retailer: { action: "existing", id: retailer.id },
    retailer_product: { action: "noop", id: mapping.id, values: mapping },
    offer: { action: "verify_no_change", id: offer.id, values: {
      price: offer.price,
      shipping_cost: offer.shipping_cost,
      total_price: offer.total_price,
      in_stock: offer.in_stock,
      url: offer.url,
      last_checked_at: normalized.source_captured_at,
    } },
    price_history: { action: "noop" },
    approval: { approved: false, approval_type: "none" },
    expected_state: { product, retailer, product_variant: variant, retailer_product: mapping, offer },
  };
  const serialized = serializeImportPlan(plan);
  serialized.meta.plan_fingerprint = planFingerprint(serialized);
  return { record: normalized, plan: serializeImportPlan(serialized) };
}

function buildVerifiedNoChangeDryRun(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) fail("verification records are required");
  const expectedCount = Number(options.expectedCount);
  if (!Number.isInteger(expectedCount) || expectedCount <= 0 || records.length !== expectedCount) fail("source record count collapse");
  const sourceSnapshotSha256s = new Set((options.sourceSnapshotSha256s || []).map((value) => String(value).toLowerCase()));
  if (!sourceSnapshotSha256s.size || [...sourceSnapshotSha256s].some((value) => !SHA256.test(value))) fail("source snapshot SHA-256 set is invalid");
  const built = records.map((record) => buildVerifiedNoChangePlan(record, { ...options, sourceSnapshotSha256s }));
  const sourceIdentities = built.map(({ record }) => `${record.target.retailer.id}:${record.source.external_product_id}:${record.source.external_variant_id}`);
  const offers = built.map(({ record }) => record.target.offer.id);
  if (new Set(sourceIdentities).size !== built.length || new Set(offers).size !== built.length) fail("duplicate source or target offer identity");
  const usedHashes = new Set(built.map(({ record }) => record.source_snapshot_sha256));
  if (usedHashes.size !== sourceSnapshotSha256s.size || [...usedHashes].some((value) => !sourceSnapshotSha256s.has(value))) fail("source snapshot manifest contains unused or missing hashes");
  const approvedRows = built.map(({ record, plan }, index) => ({
    row: record,
    rowNumber: index + 2,
    importPlan: plan,
    offerPlan: { action: "verify_no_change", createsPriceHistory: false },
  }));
  return {
    records: built.map(({ record }) => record),
    result: {
      successful: 0,
      failed: 0,
      planned: approvedRows.length,
      skipped: 0,
      report: { approvedRows, blockedRows: [] },
      rowLevelOffers: approvedRows.map((item) => ({ rowNumber: item.rowNumber, slug: item.row.target.product.name, offerAction: "verify_no_change" })),
      successfulRows: [],
      failedRows: [],
      blockedRows: [],
    },
  };
}

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Unknown or duplicate argument: ${arg}`);
    options[match[1]] = match[2];
  }
  for (const name of ["input", "artifact", "target-environment", "target-project-ref", "expected-count"]) {
    if (!options[name]) fail(`Missing --${name}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPath = path.resolve(args.input);
  const artifactPath = path.resolve(args.artifact);
  const bytes = fs.readFileSync(inputPath);
  const input = JSON.parse(bytes.toString("utf8"));
  assertExactKeys(input, ["schema_version", "source_snapshot_sha256s", "records"], "verification input");
  if (input.schema_version !== 1 || !Array.isArray(input.source_snapshot_sha256s)) fail("verification input schema is invalid");
  const dryRun = buildVerifiedNoChangeDryRun(input.records, {
    targetEnvironment: args["target-environment"],
    targetProjectRef: args["target-project-ref"],
    expectedCount: Number(args["expected-count"]),
    sourceSnapshotSha256s: input.source_snapshot_sha256s,
  });
  const artifact = writeDryRunArtifact(dryRun.records, dryRun.result, {
    artifactPath,
    sourceBytes: bytes,
    sourceFileName: inputPath,
    environmentMarker: args["target-environment"].toLowerCase(),
  });
  const output = {
    result: "PASS",
    operation_type: "verify_offer_no_change",
    records: dryRun.records.length,
    plans: artifact.artifact.plans.length,
    artifact_path: artifact.artifactPath,
    artifact_sha256: artifact.artifactSha256,
    source_file_sha256: artifact.artifact.source_file_sha256,
    price_history_rows: 0,
    database_writes: 0,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {
  MAPPING_KEYS,
  OFFER_KEYS,
  PRODUCT_KEYS,
  RETAILER_KEYS,
  SOURCE_KEYS,
  TARGETS,
  VARIANT_KEYS,
  buildVerifiedNoChangeDryRun,
  buildVerifiedNoChangePlan,
  main,
  normalizeRecord,
  parseArgs,
};
