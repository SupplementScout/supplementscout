const crypto = require("node:crypto");
const config = require("../../config/retailers/10reps-offer-sync.json");
const shadowPlan = require("../../docs/retailer-automation/evidence/RA-004-shadow-plan.json");
const { projectCsvRows, REQUIRED_COLUMNS } = require("../lib/csv-product-feed-projector");
const { classifyExistingOffers } = require("../lib/retailer-offer-sync/classifier");
const { mapLegacyStatus } = require("../lib/retailer-offer-sync/canonical-v1/legacy-compatibility-adapter");
const { runZeroWriteHarness } = require("../lib/retailer-offer-sync/canonical-v1/zero-write-harness");
const { canonicalFingerprint, deepFreeze } = require("../lib/retailer-offer-sync/canonical-v1/contract");

const DIFFERENCE_CLASSES = Object.freeze([
  "EXACT_PARITY", "SEMANTIC_PARITY", "EXPECTED_IMPROVEMENT",
  "LEGACY_DEFECT_CONFIRMED", "CANONICAL_DEFECT", "UNEXPLAINED_DIFFERENCE",
]);
const PARITY_FIELDS = Object.freeze([
  "source_fingerprint", "external_product_id", "external_variant_id", "sku", "gtin",
  "mapping_identity", "product_identity", "variant_identity", "product_name", "brand", "variant",
  "source_url", "price_minor", "currency", "stock", "availability", "provenance",
  "source_presence", "source_state", "change_classification", "price_change", "stock_change",
  "review_classification", "reason_semantics", "blocking_scope", "run_outcome_semantics",
  "alert_level", "next_action", "execution_state", "policy_authorized",
  "manifest_approved", "execution_attempted", "apply_attempted", "record_fingerprint",
]);

function rawSha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

function createDeniedCapabilities() {
  const metrics = {
    source_read_count: 0, refetch_count: 0, network_attempt_count: 0, database_attempt_count: 0,
    write_attempt_count: 0, control_plan_attempt_count: 0, approval_attempt_count: 0,
    apply_attempt_count: 0, review_queue_publish_attempt_count: 0,
  };
  const deny = (name, code = `RA004_${name.toUpperCase()}_DENIED`) => {
    metrics[`${name}_attempt_count`] += 1;
    fail(code, `RA-004 test boundary denied ${name}`);
  };
  return Object.freeze({
    metrics,
    network: () => deny("network"), database: () => deny("database"), write: () => deny("write"),
    fetch: () => deny("network", "RA004_FETCH_DENIED"), fileWrite: () => deny("write", "RA004_FILE_WRITE_DENIED"),
    controlPlan: () => deny("control_plan"), approval: () => deny("approval"),
    apply: () => deny("apply"), reviewQueuePublish: () => deny("review_queue_publish"),
    refetch: () => { metrics.refetch_count += 1; fail("RA004_REFETCH_DENIED", "RA-004 test boundary denied refetch"); },
  });
}

function validateSnapshot(bytes, contentType) {
  if (!Buffer.isBuffer(bytes)) fail("RA004_SNAPSHOT_BUFFER_REQUIRED", "Snapshot must be supplied as immutable local bytes");
  if (bytes.length === 0) fail("RA004_EMPTY_RESPONSE", "Snapshot is empty");
  if (!String(contentType || "").toLowerCase().includes("csv")) fail("RA004_UNEXPECTED_CONTENT_TYPE", "Snapshot content type is not CSV");
  if (/^\s*<(?:!doctype\s+html|html)\b/i.test(bytes.toString("utf8", 0, Math.min(bytes.length, 256)))) fail("RA004_HTML_RESPONSE", "Snapshot contains HTML");
}

function availability(inStock) { return inStock ? "IN_STOCK" : "OUT_OF_STOCK"; }
function value(field) { return field?.state === "PRESENT" ? field.value : null; }
function variantLabel(row) { return row.variant_name || row.flavour || row.size || null; }
function canonicalRaw(evidence) {
  return {
    source_record_id: evidence.variant_id,
    external_product_id: evidence.product_id,
    external_variant_id: evidence.variant_id,
    sku: evidence.sku || null,
    gtin: evidence.ean || null,
    product_name: evidence.product_name || null,
    brand: evidence.brand || null,
    variant: variantLabel(evidence),
    source_url: evidence.product_url,
    price: evidence.current_price,
    currency: "GBP",
    availability: evidence.stock_status === "instock" ? "IN_STOCK" : "OUT_OF_STOCK",
  };
}

function expectedState(target) {
  return {
    external_product_id: target.external_product_id,
    external_variant_id: target.external_variant_id,
    price_minor: String(Math.round(Number(target.price) * 100)),
    currency: "GBP",
    availability: availability(target.in_stock),
    product_name: target.product_name || null,
  };
}

function legacyCategory(row) {
  if (!row) return "UNCLASSIFIED";
  if (row.reason === "SOURCE_VARIANT_MISSING") return "SOURCE_MISSING";
  if (row.action === "VERIFY_NO_CHANGE") return "NO_CHANGE";
  if (row.action === "UPDATE_PRICE") return "PRICE_CHANGE";
  if (row.action === "UPDATE_STOCK") return "STOCK_CHANGE";
  if (row.action === "UPDATE_PRICE_AND_STOCK") return "PRICE_AND_STOCK";
  if (row.action?.startsWith("BLOCK_")) return "REVIEW_REQUIRED";
  return "UNCLASSIFIED";
}

function canonicalCategory(row) {
  if (row.source_state === "SOURCE_MISSING") return "SOURCE_MISSING";
  if (row.change_classification === "NO_CHANGE") return "NO_CHANGE";
  const fields = new Set(row.changed_fields || []);
  if (fields.has("price") && fields.has("availability")) return "PRICE_AND_STOCK";
  if (fields.has("price")) return "PRICE_CHANGE";
  if (fields.has("availability")) return "STOCK_CHANGE";
  if (row.change_classification === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  return "UNCLASSIFIED";
}

function semantics(category) {
  if (category === "SOURCE_MISSING") return { reason_semantics: "SOURCE_MISSING_REVIEW", alert_level: "REVIEW", next_action: "REVIEW_ONLY" };
  if (category === "NO_CHANGE") return { reason_semantics: "NO_CHANGE", alert_level: "NONE", next_action: "NONE" };
  if (["PRICE_CHANGE", "STOCK_CHANGE", "PRICE_AND_STOCK"].includes(category)) return { reason_semantics: "CHANGE_NOT_AUTHORIZED", alert_level: "NONE", next_action: "OWNER_AUTHORIZATION_REQUIRED" };
  return { reason_semantics: "FAIL_CLOSED", alert_level: "REVIEW", next_action: "INVESTIGATE" };
}

function sealNormalized(row) {
  const record = { ...row, record_fingerprint: null };
  record.record_fingerprint = canonicalFingerprint("RA004-NORMALIZED-RECORD", Object.fromEntries(PARITY_FIELDS.filter((field) => field !== "record_fingerprint").map((field) => [field, record[field]])));
  return record;
}

function legacyNormalized(target, evidence, row, sourceFingerprint) {
  const missing = row?.reason === "SOURCE_VARIANT_MISSING";
  const category = legacyCategory(row);
  const compatibility = mapLegacyStatus(
    missing ? "BLOCK_SOURCE_ANOMALY" : row.action === "VERIFY_NO_CHANGE" ? "VERIFY_NO_CHANGE" : "DRY_RUN_READY",
    missing ? { context_type: "offer_action", source_reason: row.reason } : row.action === "VERIFY_NO_CHANGE" ? { context_type: "offer_action" } : { context_type: "offer_classifier" },
  );
  return sealNormalized({
    source_fingerprint: sourceFingerprint,
    external_product_id: String(target.external_product_id), external_variant_id: String(target.external_variant_id),
    mapping_identity: String(target.retailer_product_id), product_identity: String(target.external_product_id), variant_identity: String(target.external_variant_id),
    sku: missing ? target.external_sku || null : evidence.sku || null,
    gtin: missing ? target.gtin || null : evidence.ean || null,
    product_name: missing ? target.product_name || null : evidence.product_name || null,
    brand: missing ? target.brand || null : evidence.brand || null,
    variant: missing ? target.variant || null : variantLabel(evidence),
    price_minor: missing ? String(Math.round(Number(target.price) * 100)) : String(Math.round(Number(evidence.current_price) * 100)),
    source_url: missing ? target.external_url : evidence.product_url,
    currency: "GBP", stock: missing ? null : Boolean(row.source.in_stock), availability: missing ? "SOURCE_MISSING" : availability(row.source.in_stock),
    provenance: missing ? "EXPECTED_STATE" : `CSV_ROW:${evidence.row_number}`,
    source_presence: missing ? "MISSING_FROM_SOURCE" : "PRESENT", source_state: missing ? "SOURCE_MISSING" : "SOURCE_VALID", change_classification: category,
    price_change: Boolean(row.changed_fields?.price), stock_change: Boolean(row.changed_fields?.stock),
    review_classification: missing ? "REVIEW_REQUIRED" : category === "NO_CHANGE" ? "NOT_REQUIRED" : "SAFE_CANDIDATE",
    ...semantics(category), blocking_scope: missing ? "ROW" : "NONE", run_outcome_semantics: missing ? "PASS_WITH_REVIEW" : category === "NO_CHANGE" ? "PASS" : "NO_AUTHORIZED_SCOPE",
    execution_state: compatibility.canonical.execution_state,
    policy_authorized: false, manifest_approved: false, execution_attempted: false, apply_attempted: false,
    native_record_fingerprint: canonicalFingerprint("RA004-LEGACY-ROW", { target, evidence: evidence || null, action: row.action, reason: row.reason || null }),
    native_reason_codes: [compatibility.canonical.reason_code, ...(row.reason ? [row.reason] : [])],
    native_action: row.action,
  });
}

function canonicalNormalized(target, evidence, row, sourceFingerprint) {
  const record = row.canonical_record;
  const category = canonicalCategory(row);
  return sealNormalized({
    source_fingerprint: sourceFingerprint,
    external_product_id: value(record.external_product_id), external_variant_id: value(record.external_variant_id),
    mapping_identity: String(target.retailer_product_id), product_identity: value(record.external_product_id), variant_identity: value(record.external_variant_id),
    sku: value(record.sku) || target.external_sku || null, gtin: value(record.gtin) || target.gtin || null,
    product_name: value(record.product_name) || target.product_name || null,
    brand: value(record.brand) || target.brand || null, variant: value(record.variant) || target.variant || null,
    price_minor: record.source_presence === "MISSING_FROM_SOURCE" ? String(Math.round(Number(target.price) * 100)) : record.price.amount_minor,
    source_url: value(record.source_url) || target.external_url,
    currency: record.price.currency || "GBP", stock: record.availability === "SOURCE_MISSING" ? null : record.availability === "IN_STOCK", availability: record.availability,
    provenance: evidence ? `CSV_ROW:${evidence.row_number}` : "EXPECTED_STATE",
    source_presence: record.source_presence, source_state: row.source_state, change_classification: category,
    price_change: (row.changed_fields || []).includes("price"), stock_change: (row.changed_fields || []).includes("availability"),
    review_classification: category === "NO_CHANGE" ? "NOT_REQUIRED" : row.change_classification,
    ...semantics(category), blocking_scope: row.change_classification === "REVIEW_REQUIRED" ? "ROW" : "NONE",
    run_outcome_semantics: category === "SOURCE_MISSING" ? "PASS_WITH_REVIEW" : category === "NO_CHANGE" ? "PASS" : "NO_AUTHORIZED_SCOPE",
    execution_state: row.execution_state, policy_authorized: row.policy_authorized,
    manifest_approved: row.manifest_approved, execution_attempted: row.execution_attempted, apply_attempted: false,
    native_reason_codes: row.reason_codes, native_record_fingerprint: record.record_fingerprint,
  });
}

function compareParityRows(legacy, canonical) {
  const field_differences = PARITY_FIELDS.filter((field) => legacy[field] !== canonical[field]);
  const difference_class = field_differences.length === 0 ? "EXACT_PARITY" : "UNEXPLAINED_DIFFERENCE";
  return deepFreeze({
    difference_class,
    field_differences,
    legacy_record_fingerprint: legacy.record_fingerprint,
    canonical_record_fingerprint: canonical.record_fingerprint,
    parity_record_fingerprint: canonicalFingerprint("RA004-NORMALIZED-PARITY", Object.fromEntries(PARITY_FIELDS.map((field) => [field, legacy[field]]))),
  });
}

function compareParityCollections(legacyRows, canonicalRows) {
  const key = (row) => `${row.external_product_id}|${row.external_variant_id}`;
  const left = new Map(legacyRows.map((row) => [key(row), row]));
  const right = new Map(canonicalRows.map((row) => [key(row), row]));
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  return keys.map((identity) => {
    if (!left.has(identity)) return { key: identity, difference_class: "UNEXPLAINED_DIFFERENCE", side: "CANONICAL_ONLY" };
    if (!right.has(identity)) return { key: identity, difference_class: "UNEXPLAINED_DIFFERENCE", side: "LEGACY_ONLY" };
    return { key: identity, ...compareParityRows(left.get(identity), right.get(identity)) };
  });
}

function replaySingleSnapshot(bytes, state, options = {}) {
  const boundary = options.boundary || createDeniedCapabilities();
  validateSnapshot(bytes, options.contentType || "text/csv");
  if (!state || !Array.isArray(state.targets) || !state.captured_at) fail("RA004_STATE_INVALID", "A fixed test state export is required");
  const stateIdentities = state.targets.map((target) => `${target.external_product_id}|${target.external_variant_id}`);
  if (new Set(stateIdentities).size !== stateIdentities.length) fail("RA004_IDENTITY_CONFLICT", "State export contains a duplicate source identity");
  boundary.metrics.source_read_count += 1;
  if (boundary.metrics.source_read_count !== 1) fail("RA004_SOURCE_READ_COUNT", "Snapshot may be read exactly once");
  const originalFingerprint = rawSha256(bytes);
  const legacyBytes = Buffer.from(bytes), canonicalBytes = Buffer.from(bytes);
  const legacyProjected = projectCsvRows(legacyBytes, { storeUrl: config.store_url, capturedAt: state.captured_at });
  const canonicalProjected = projectCsvRows(canonicalBytes, { storeUrl: config.store_url, capturedAt: state.captured_at });
  const sourceVariants = legacyProjected.sourceVariants.map((row) => ({ ...row, shipping_cost: config.shipping_policy.cost_gbp }));
  const policy = { ...config.guardrails, required_matched_offers: state.targets.length, store_url: config.store_url };
  const legacy = classifyExistingOffers({ targets: structuredClone(state.targets), sourceVariants, policy, sourceCapturedAt: state.captured_at, now: new Date(state.captured_at), sourceProductCount: legacyProjected.products.length, guardScope: { name: "RA004_TEST_ONLY_10REPS", retailer: "10 Reps" }, quarantineUnsafeRows: true });
  const fixture = {
    fixture_id: "ra004-10reps-single-snapshot", run_id: "ra004-test-only-replay", captured_at: state.captured_at,
    source: { retailer_ref: "10-reps", source_ref: `sha256:${originalFingerprint}`, source_type: "CSV" },
    raw_records: canonicalProjected.evidenceRows.map(canonicalRaw), expected_state: state.targets.map(expectedState), controls: {},
  };
  const canonical = runZeroWriteHarness(fixture, { clock: () => state.captured_at });
  if (rawSha256(legacyBytes) !== originalFingerprint || rawSha256(canonicalBytes) !== originalFingerprint || rawSha256(bytes) !== originalFingerprint) fail("RA004_FINGERPRINT_CHANGED_DURING_RUN", "Snapshot bytes changed during replay");
  const evidenceByVariant = new Map(legacyProjected.evidenceRows.map((row) => [row.variant_id, row]));
  const legacyRows = [...(legacy.rows || []), ...(legacy.quarantined_rows || [])];
  const legacyByVariant = new Map(legacyRows.map((row) => [String(row.external_variant_id), row]));
  const canonicalByVariant = new Map(canonical.rows.map((row) => [value(row.canonical_record.external_variant_id), row]));
  const parityRows = state.targets.map((target) => {
    const key = String(target.external_variant_id), evidence = evidenceByVariant.get(key) || null;
    const left = legacyNormalized(target, evidence, legacyByVariant.get(key), originalFingerprint);
    const right = canonicalNormalized(target, evidence, canonicalByVariant.get(key), originalFingerprint);
    return { key, legacy: left, canonical: right, comparison: compareParityRows(left, right) };
  });
  const differenceCounts = Object.fromEntries(DIFFERENCE_CLASSES.map((name) => [name, parityRows.filter((row) => row.comparison.difference_class === name).length]));
  const unclassified = parityRows.filter((row) => row.legacy.change_classification === "UNCLASSIFIED" || row.canonical.change_classification === "UNCLASSIFIED").length;
  const report = {
    schema_version: 1, adapter: "RA004_TEST_ONLY_SINGLE_SNAPSHOT_V1", retailer: { id: "14", name: "10 Reps" },
    snapshot_contract: {
      contract_version: "RA004_SINGLE_SNAPSHOT_V1", retailer: { id: "14", name: "10 Reps", slug: "10-reps" },
      source_type: "CSV_PRODUCT_FEED", capture_id: "ra004-synthetic-fixture-001", capture_timestamp_utc: state.captured_at,
      content_type: options.contentType || "text/csv", byte_length: bytes.length, raw_bytes_sha256: originalFingerprint,
      issued_copy_sha256: { legacy: rawSha256(legacyBytes), canonical: rawSha256(canonicalBytes) },
      source_read_count: boundary.metrics.source_read_count,
      provenance: "scripts/test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv",
    },
    raw_snapshot_sha256: originalFingerprint, legacy_snapshot_sha256: rawSha256(legacyBytes), canonical_snapshot_sha256: rawSha256(canonicalBytes),
    required_headers: REQUIRED_COLUMNS, difference_classes: DIFFERENCE_CLASSES, parity_fields: PARITY_FIELDS,
    legacy: { state: legacy.state, action_manifest_fingerprint: legacy.action_manifest_fingerprint || null, row_count: legacyRows.length },
    canonical: { run_outcome: canonical.run_outcome, output_fingerprint: canonical.output_fingerprint, row_count: canonical.rows.length },
    parity_rows: parityRows, difference_counts: differenceCounts, unclassified_record_count: unclassified,
    semantic_mappings: [
      { field: "native_status", legacy: "offer action plus RA-003 compatibility profile", canonical: "canonical v1 classification", normalized_by: "RA-003 compatibility matrix and existing action contract" },
      { field: "native_record_fingerprint", legacy: "legacy classified row", canonical: "canonical v1 record", normalized_by: "exhaustive normalized parity record" },
      { field: "SOURCE_MISSING", legacy: "BLOCK_SOURCE_ANOMALY/SOURCE_VARIANT_MISSING", canonical: "SOURCE_MISSING/REVIEW_REQUIRED", normalized_by: "SOURCE_MISSING_REVIEW" },
    ],
    capabilities: { ...boundary.metrics },
    authorization: { adapter: "READY_FOR_VERIFICATION", ra004: "IN_PROGRESS", shadow: shadowPlan.status, production_execution_allowed: false },
  };
  report.report_fingerprint = canonicalFingerprint("RA004-SINGLE-SNAPSHOT-REPORT", report);
  return deepFreeze(report);
}

module.exports = { DIFFERENCE_CLASSES, PARITY_FIELDS, compareParityCollections, compareParityRows, createDeniedCapabilities, replaySingleSnapshot };
