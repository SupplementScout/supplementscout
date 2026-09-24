const crypto = require("node:crypto");
const fs = require("node:fs");
const { isDeepStrictEqual } = require("node:util");
const config = require("../../config/retailers/10reps-offer-sync.json");
const shadowPlan = require("../../docs/retailer-automation/evidence/RA-004-shadow-plan.json");
const { projectCsvRows, REQUIRED_COLUMNS } = require("../lib/csv-product-feed-projector");
const { classifyExistingOffers } = require("../lib/retailer-offer-sync/classifier");
const { mapLegacyStatus } = require("../lib/retailer-offer-sync/canonical-v1/legacy-compatibility-adapter");
const { runZeroWriteHarness } = require("../lib/retailer-offer-sync/canonical-v1/zero-write-harness");
const { canonicalFingerprint, deepFreeze } = require("../lib/retailer-offer-sync/canonical-v1/contract");
const { connectTenRepsCsv } = require("./ra004-10reps-canonical-connector");

const DIFFERENCE_CLASSES = Object.freeze(["EXACT_PARITY", "SEMANTIC_PARITY", "EXPECTED_IMPROVEMENT", "LEGACY_DEFECT_CONFIRMED", "CANONICAL_DEFECT", "UNEXPLAINED_DIFFERENCE"]);
const PARITY_FIELDS = Object.freeze([
  "source_fingerprint", "external_product_id", "external_variant_id", "sku", "gtin", "mapping_identity", "product_identity", "variant_identity",
  "product_name", "brand", "variant", "source_url", "price_minor", "currency", "stock", "availability", "provenance", "source_presence",
  "source_state", "change_classification", "price_change", "stock_change", "review_classification", "reason_semantics", "blocking_scope",
  "run_outcome_semantics", "alert_level", "next_action", "execution_state", "policy_authorized", "manifest_approved", "execution_attempted",
  "apply_attempted", "native_action", "native_reason_codes", "native_record_fingerprint", "record_fingerprint",
]);
const NATIVE_FIELDS = new Set(["native_action", "native_reason_codes", "native_record_fingerprint", "record_fingerprint"]);
const COMPARABLE_FIELDS = PARITY_FIELDS.filter((field) => !NATIVE_FIELDS.has(field));
const CAPABILITY_FIELDS = Object.freeze([
  "source_read_attempt_count", "source_read_count", "refetch_attempt_count", "refetch_performed_count", "network_attempt_count", "network_performed_count",
  "http_attempt_count", "http_performed_count", "dns_attempt_count", "dns_performed_count", "database_attempt_count", "database_performed_count",
  "file_write_attempt_count", "file_write_performed_count", "control_plan_attempt_count", "control_plan_performed_count", "approval_attempt_count",
  "approval_performed_count", "apply_attempt_count", "apply_performed_count", "review_queue_publish_attempt_count", "review_queue_publish_performed_count",
  "workflow_dispatch_attempt_count", "workflow_dispatch_performed_count", "secret_loader_attempt_count", "secret_loader_performed_count",
]);
const REPORT_FIELDS = Object.freeze([
  "schema_version", "adapter", "retailer", "snapshot_contract", "raw_snapshot_sha256", "legacy_snapshot_sha256", "canonical_snapshot_sha256",
  "required_headers", "difference_classes", "parity_fields", "legacy", "canonical", "parity_rows", "difference_counts", "unclassified_record_count",
  "semantic_mappings", "capabilities", "authorization", "report_fingerprint",
]);
const INTEGRITY_CATEGORIES = Object.freeze(["run_level", "capability", "native_golden", "schema", "record_set", "raw_fingerprint"]);

function rawSha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function same(left, right) { return isDeepStrictEqual(left, right); }
function exactKeys(value, expected) { return value && same(Object.keys(value).sort(), [...expected].sort()); }
function emptyDifferenceCounts() {
  return {
    records: Object.fromEntries(DIFFERENCE_CLASSES.map((name) => [name, 0])),
    integrity: Object.fromEntries(INTEGRITY_CATEGORIES.map((name) => [name, 0])),
    total_mismatches: 0,
  };
}
function difference(scope, path, expected, actual, reasonCode, counterCategory) {
  return { scope, path, expected, actual, reason_code: reasonCode, counter_category: counterCategory };
}

function createDeniedCapabilities({ fixturePath, sourceReader } = {}) {
  const metrics = Object.fromEntries(CAPABILITY_FIELDS.map((field) => [field, 0]));
  const deny = (name, code) => { metrics[`${name}_attempt_count`] += 1; fail(code, `RA-004 test boundary denied ${name}`); };
  return Object.freeze({
    metrics,
    readOnce() {
      metrics.source_read_attempt_count += 1;
      if (metrics.source_read_count !== 0) fail("RA004_SOURCE_READ_COUNT", "Snapshot source may be read exactly once");
      const read = sourceReader || (fixturePath ? () => fs.readFileSync(fixturePath) : null);
      if (!read) fail("RA004_SOURCE_READER_REQUIRED", "A controlled local fixture reader is required");
      const bytes = read();
      if (!Buffer.isBuffer(bytes)) fail("RA004_SNAPSHOT_BUFFER_REQUIRED", "Source capability must return raw bytes");
      metrics.source_read_count += 1;
      return Buffer.from(bytes);
    },
    refetch: () => deny("refetch", "RA004_REFETCH_DENIED"), network: () => deny("network", "RA004_NETWORK_DENIED"),
    fetch: () => deny("network", "RA004_FETCH_DENIED"), http: () => deny("http", "RA004_HTTP_DENIED"), dns: () => deny("dns", "RA004_DNS_DENIED"),
    database: () => deny("database", "RA004_DATABASE_DENIED"), write: () => deny("file_write", "RA004_WRITE_DENIED"),
    fileWrite: () => deny("file_write", "RA004_FILE_WRITE_DENIED"), controlPlan: () => deny("control_plan", "RA004_CONTROL_PLAN_DENIED"),
    approval: () => deny("approval", "RA004_APPROVAL_DENIED"), apply: () => deny("apply", "RA004_APPLY_DENIED"),
    reviewQueuePublish: () => deny("review_queue_publish", "RA004_REVIEW_QUEUE_PUBLISH_DENIED"),
    workflowDispatch: () => deny("workflow_dispatch", "RA004_WORKFLOW_DISPATCH_DENIED"), secretLoader: () => deny("secret_loader", "RA004_SECRET_LOADER_DENIED"),
  });
}

function validateSnapshot(bytes, contentType) {
  if (!Buffer.isBuffer(bytes)) fail("RA004_SNAPSHOT_BUFFER_REQUIRED", "Snapshot must be supplied as immutable local bytes");
  if (!bytes.length) fail("RA004_EMPTY_RESPONSE", "Snapshot is empty");
  if (!String(contentType || "").toLowerCase().includes("csv")) fail("RA004_UNEXPECTED_CONTENT_TYPE", "Snapshot content type is not CSV");
  if (/^\s*<(?:!doctype\s+html|html)\b/i.test(bytes.toString("utf8", 0, Math.min(bytes.length, 256)))) fail("RA004_HTML_RESPONSE", "Snapshot contains HTML");
}
function availability(inStock) { return inStock ? "IN_STOCK" : "OUT_OF_STOCK"; }
function value(field) { return field?.state === "PRESENT" ? field.value : null; }
function variantLabel(row) { return row.variant_name || row.flavour || row.size || null; }
function expectedState(target) { return { external_product_id: target.external_product_id, external_variant_id: target.external_variant_id, price_minor: String(Math.round(Number(target.price) * 100)), currency: "GBP", availability: availability(target.in_stock), product_name: target.product_name || null }; }
function legacyCategory(row) {
  if (!row) return "UNCLASSIFIED";
  if (row.reason === "SOURCE_VARIANT_MISSING") return "SOURCE_MISSING";
  return ({ VERIFY_NO_CHANGE: "NO_CHANGE", UPDATE_PRICE: "PRICE_CHANGE", UPDATE_STOCK: "STOCK_CHANGE", UPDATE_PRICE_AND_STOCK: "PRICE_AND_STOCK" })[row.action] || (row.action?.startsWith("BLOCK_") ? "REVIEW_REQUIRED" : "UNCLASSIFIED");
}
function canonicalCategory(row) {
  if (row.source_state === "SOURCE_MISSING") return "SOURCE_MISSING";
  if (row.change_classification === "NO_CHANGE") return "NO_CHANGE";
  const fields = new Set(row.changed_fields || []);
  if (fields.has("price") && fields.has("availability")) return "PRICE_AND_STOCK";
  if (fields.has("price")) return "PRICE_CHANGE";
  if (fields.has("availability")) return "STOCK_CHANGE";
  return row.change_classification === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "UNCLASSIFIED";
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
  const compatibility = mapLegacyStatus(missing ? "BLOCK_SOURCE_ANOMALY" : row.action === "VERIFY_NO_CHANGE" ? "VERIFY_NO_CHANGE" : "DRY_RUN_READY", missing ? { context_type: "offer_action", source_reason: row.reason } : row.action === "VERIFY_NO_CHANGE" ? { context_type: "offer_action" } : { context_type: "offer_classifier" });
  return sealNormalized({
    source_fingerprint: sourceFingerprint, external_product_id: String(target.external_product_id), external_variant_id: String(target.external_variant_id), mapping_identity: String(target.retailer_product_id), product_identity: String(target.external_product_id), variant_identity: String(target.external_variant_id),
    sku: missing ? target.external_sku || null : evidence.sku || null, gtin: missing ? target.gtin || null : evidence.ean || null, product_name: missing ? target.product_name || null : evidence.product_name || null, brand: missing ? target.brand || null : evidence.brand || null, variant: missing ? target.variant || null : variantLabel(evidence),
    price_minor: missing ? String(Math.round(Number(target.price) * 100)) : String(Math.round(Number(evidence.current_price) * 100)), source_url: missing ? target.external_url : evidence.product_url, currency: "GBP", stock: missing ? null : Boolean(row.source.in_stock), availability: missing ? "SOURCE_MISSING" : availability(row.source.in_stock), provenance: missing ? "EXPECTED_STATE" : `CSV_ROW:${evidence.row_number}`,
    source_presence: missing ? "MISSING_FROM_SOURCE" : "PRESENT", source_state: missing ? "SOURCE_MISSING" : "SOURCE_VALID", change_classification: category, price_change: Boolean(row.changed_fields?.price), stock_change: Boolean(row.changed_fields?.stock), review_classification: missing ? "REVIEW_REQUIRED" : category === "NO_CHANGE" ? "NOT_REQUIRED" : "SAFE_CANDIDATE",
    ...semantics(category), blocking_scope: missing ? "ROW" : "NONE", run_outcome_semantics: missing ? "PASS_WITH_REVIEW" : category === "NO_CHANGE" ? "PASS" : "NO_AUTHORIZED_SCOPE", execution_state: compatibility.canonical.execution_state, policy_authorized: false, manifest_approved: false, execution_attempted: false, apply_attempted: false,
    native_action: row.action, native_reason_codes: [compatibility.canonical.reason_code, ...(row.reason ? [row.reason] : [])], native_record_fingerprint: canonicalFingerprint("RA004-LEGACY-ROW", { target, evidence: evidence || null, action: row.action, reason: row.reason || null }),
  });
}
function canonicalNormalized(target, evidence, row, sourceFingerprint) {
  const record = row.canonical_record;
  const category = canonicalCategory(row);
  return sealNormalized({
    source_fingerprint: sourceFingerprint, external_product_id: value(record.external_product_id), external_variant_id: value(record.external_variant_id), mapping_identity: String(target.retailer_product_id), product_identity: value(record.external_product_id), variant_identity: value(record.external_variant_id),
    sku: value(record.sku) || target.external_sku || null, gtin: value(record.gtin) || target.gtin || null, product_name: value(record.product_name) || target.product_name || null, brand: value(record.brand) || target.brand || null, variant: value(record.variant) || target.variant || null,
    price_minor: record.source_presence === "MISSING_FROM_SOURCE" ? String(Math.round(Number(target.price) * 100)) : record.price.amount_minor, source_url: value(record.source_url) || target.external_url, currency: record.price.currency || "GBP", stock: record.availability === "SOURCE_MISSING" ? null : record.availability === "IN_STOCK", availability: record.availability,
    provenance: evidence ? `CSV_ROW:${evidence.row_number}` : "EXPECTED_STATE", source_presence: record.source_presence, source_state: row.source_state, change_classification: category, price_change: (row.changed_fields || []).includes("price"), stock_change: (row.changed_fields || []).includes("availability"), review_classification: category === "NO_CHANGE" ? "NOT_REQUIRED" : row.change_classification,
    ...semantics(category), blocking_scope: row.change_classification === "REVIEW_REQUIRED" ? "ROW" : "NONE", run_outcome_semantics: category === "SOURCE_MISSING" ? "PASS_WITH_REVIEW" : category === "NO_CHANGE" ? "PASS" : "NO_AUTHORIZED_SCOPE", execution_state: row.execution_state, policy_authorized: row.policy_authorized, manifest_approved: row.manifest_approved, execution_attempted: row.execution_attempted, apply_attempted: false,
    native_action: row.change_classification, native_reason_codes: row.reason_codes, native_record_fingerprint: record.record_fingerprint,
  });
}

function nativeExpected(expected, side, field) { return !expected ? undefined : field === "record_fingerprint" ? expected[`${side}_normalized_fingerprint`] : expected[`${side}_${field}`]; }
function compareParityRows(legacy, canonical, expectedNative) {
  const differences = [];
  if (!exactKeys(legacy, PARITY_FIELDS)) differences.push("legacy.$schema");
  if (!exactKeys(canonical, PARITY_FIELDS)) differences.push("canonical.$schema");
  for (const field of COMPARABLE_FIELDS) if (!same(legacy[field], canonical[field])) differences.push(field);
  for (const field of NATIVE_FIELDS) {
    const left = nativeExpected(expectedNative, "legacy", field), right = nativeExpected(expectedNative, "canonical", field);
    if (left === undefined || !same(legacy[field], left)) differences.push(`legacy.${field}`);
    if (right === undefined || !same(canonical[field], right)) differences.push(`canonical.${field}`);
  }
  return deepFreeze({ difference_class: differences.length ? "UNEXPLAINED_DIFFERENCE" : "EXACT_PARITY", field_differences: differences, legacy_record_fingerprint: legacy.record_fingerprint, canonical_record_fingerprint: canonical.record_fingerprint, parity_record_fingerprint: canonicalFingerprint("RA004-NORMALIZED-PARITY", { legacy, canonical }) });
}
function compareParityCollections(legacyRows, canonicalRows, nativeGoldens = {}) {
  const key = (row) => `${row.external_product_id}|${row.external_variant_id}`;
  const left = new Map(legacyRows.map((row) => [key(row), row])), right = new Map(canonicalRows.map((row) => [key(row), row]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().map((identity) => {
    if (!left.has(identity)) return { key: identity, difference_class: "UNEXPLAINED_DIFFERENCE", side: "CANONICAL_ONLY" };
    if (!right.has(identity)) return { key: identity, difference_class: "UNEXPLAINED_DIFFERENCE", side: "LEGACY_ONLY" };
    return { key: identity, ...compareParityRows(left.get(identity), right.get(identity), nativeGoldens[identity.split("|")[1]]) };
  });
}
function compareParityReport(report, expected) {
  if (!expected || typeof expected !== "object") fail("RA004_PARITY_EXPECTATIONS_REQUIRED", "Static parity expectations are required");
  const differences = [];
  const counts = emptyDifferenceCounts();
  const add = (entry) => {
    differences.push(entry);
    if (entry.counter_category.startsWith("integrity.")) counts.integrity[entry.counter_category.slice("integrity.".length)] += 1;
  };
  const schema = (scope, value, keys) => {
    if (!exactKeys(value, keys)) add(difference(scope, `${scope}.$schema`, [...keys].sort(), value && typeof value === "object" ? Object.keys(value).sort() : null, "RA004_SCHEMA_MISMATCH", "integrity.schema"));
  };
  schema("report", report, REPORT_FIELDS);
  schema("legacy", report?.legacy, ["state", "action_manifest_fingerprint", "row_count"]);
  schema("canonical", report?.canonical, ["run_outcome", "output_fingerprint", "row_count"]);
  schema("capabilities", report?.capabilities, CAPABILITY_FIELDS);

  const expectedRaw = expected.expected_raw_sha256 || expected.raw_lf_sha256;
  if (report?.raw_snapshot_sha256 !== expectedRaw) add(difference("raw_fingerprint", "raw_snapshot_sha256", expectedRaw, report?.raw_snapshot_sha256, "RA004_RAW_SNAPSHOT_FINGERPRINT_MISMATCH", "integrity.raw_fingerprint"));
  for (const path of ["legacy_snapshot_sha256", "canonical_snapshot_sha256"]) {
    if (report?.[path] !== report?.raw_snapshot_sha256) add(difference("raw_fingerprint", path, report?.raw_snapshot_sha256, report?.[path], "RA004_ISSUED_SNAPSHOT_FINGERPRINT_MISMATCH", "integrity.raw_fingerprint"));
  }
  const runChecks = [
    ["legacy.action_manifest_fingerprint", expected.legacy_output_fingerprint, report?.legacy?.action_manifest_fingerprint, "RA004_LEGACY_OUTPUT_FINGERPRINT_MISMATCH"],
    ["canonical.output_fingerprint", expected.canonical_output_fingerprint, report?.canonical?.output_fingerprint, "RA004_CANONICAL_OUTPUT_FINGERPRINT_MISMATCH"],
    ["report_fingerprint", expected.parity_report_fingerprint, report?.report_fingerprint, "RA004_REPORT_FINGERPRINT_MISMATCH"],
    ["legacy.state", expected.legacy_state, report?.legacy?.state, "RA004_LEGACY_STATE_MISMATCH"],
    ["canonical.run_outcome", expected.canonical_run_outcome, report?.canonical?.run_outcome, "RA004_CANONICAL_RUN_OUTCOME_MISMATCH"],
  ];
  for (const [path, wanted, actual, code] of runChecks) if (!same(actual, wanted)) add(difference("run_level", path, wanted, actual, code, "integrity.run_level"));
  const recomputedReportFingerprint = canonicalFingerprint("RA004-SINGLE-SNAPSHOT-REPORT", { ...report, report_fingerprint: null });
  if (report?.report_fingerprint !== recomputedReportFingerprint) add(difference("run_level", "report_fingerprint.integrity", recomputedReportFingerprint, report?.report_fingerprint, "RA004_REPORT_FINGERPRINT_INTEGRITY", "integrity.run_level"));

  for (const field of CAPABILITY_FIELDS) {
    const wanted = field === "source_read_attempt_count" || field === "source_read_count" ? 1 : 0;
    if (report?.capabilities?.[field] !== wanted) add(difference("capability", `capabilities.${field}`, wanted, report?.capabilities?.[field], "RA004_CAPABILITY_COUNT_MISMATCH", "integrity.capability"));
  }

  const parityRows = Array.isArray(report?.parity_rows) ? report.parity_rows : [];
  const identity = (row) => row && `${row.external_product_id}|${row.external_variant_id}`;
  const expectedVariants = new Set(Object.keys(expected.native_records || {}));
  const rowKeys = new Map();
  for (const row of parityRows) rowKeys.set(String(row?.key), (rowKeys.get(String(row?.key)) || 0) + 1);
  for (const [key, occurrences] of rowKeys) if (occurrences > 1) add(difference("record_set", `parity_rows.${key}`, 1, occurrences, "RA004_DUPLICATE_PARITY_RECORD", "integrity.record_set"));
  for (const variant of expectedVariants) if (!rowKeys.has(variant)) add(difference("record_set", `parity_rows.${variant}`, "present", "missing", "RA004_PARITY_RECORD_MISSING", "integrity.record_set"));
  for (const key of rowKeys.keys()) if (!expectedVariants.has(key)) add(difference("record_set", `parity_rows.${key}`, "absent", "present", "RA004_PARITY_RECORD_EXTRA", "integrity.record_set"));

  const legacyRows = parityRows.map((row) => row?.legacy).filter(Boolean);
  const canonicalRows = parityRows.map((row) => row?.canonical).filter(Boolean);
  for (const [side, rows] of [["legacy", legacyRows], ["canonical", canonicalRows]]) {
    const identities = new Map();
    for (const row of rows) identities.set(identity(row), (identities.get(identity(row)) || 0) + 1);
    for (const [key, occurrences] of identities) if (occurrences > 1) add(difference("record_set", `${side}.${key}`, 1, occurrences, "RA004_DUPLICATE_OUTPUT_IDENTITY", "integrity.record_set"));
  }
  const recomputed = compareParityCollections(legacyRows, canonicalRows, expected.native_records || {});
  for (const record of recomputed) {
    const recordClass = DIFFERENCE_CLASSES.includes(record.difference_class) ? record.difference_class : "UNEXPLAINED_DIFFERENCE";
    counts.records[recordClass] += 1;
    if (record.side) {
      add(difference("record_set", `records.${record.key}`, "both sides present", record.side, "RA004_RECORD_SIDE_MISSING", "integrity.record_set"));
      continue;
    }
    for (const path of record.field_differences || []) {
      const native = /(?:native_action|native_reason_codes|native_record_fingerprint|record_fingerprint)$/.test(path);
      const schemaMismatch = path.endsWith(".$schema");
      const category = schemaMismatch ? "integrity.schema" : native ? "integrity.native_golden" : "records.UNEXPLAINED_DIFFERENCE";
      add(difference(native ? "native_golden" : schemaMismatch ? "schema" : "record", `records.${record.key}.${path}`, "contract/golden match", "mismatch", native ? "RA004_NATIVE_GOLDEN_MISMATCH" : schemaMismatch ? "RA004_RECORD_SCHEMA_MISMATCH" : "RA004_RECORD_FIELD_MISMATCH", category));
    }
  }
  if (report?.legacy?.row_count !== legacyRows.length || report?.canonical?.row_count !== canonicalRows.length) add(difference("record_set", "row_count", { legacy: legacyRows.length, canonical: canonicalRows.length }, { legacy: report?.legacy?.row_count, canonical: report?.canonical?.row_count }, "RA004_RECORD_COUNT_MISMATCH", "integrity.record_set"));
  counts.total_mismatches = differences.length;
  return deepFreeze({ difference_class: differences.length ? "UNEXPLAINED_DIFFERENCE" : "EXACT_PARITY", differences, difference_entry_count: differences.length, difference_counts: counts });
}

function replaySingleSnapshot(state, options = {}) {
  const boundary = options.boundary;
  if (!boundary || typeof boundary.readOnce !== "function") fail("RA004_SOURCE_CAPABILITY_REQUIRED", "Replay requires an explicit source capability");
  const bytes = boundary.readOnce();
  const originalFingerprint = rawSha256(bytes);
  if (options.expectedRawSha256 === undefined || options.expectedRawSha256 === null || options.expectedRawSha256 === "") fail("RA004_EXPECTED_RAW_FINGERPRINT_REQUIRED", "Replay requires an expected raw snapshot SHA-256");
  if (!/^[a-f0-9]{64}$/.test(options.expectedRawSha256)) fail("RA004_EXPECTED_RAW_FINGERPRINT_INVALID", "Expected raw snapshot fingerprint must be a lowercase SHA-256");
  if (originalFingerprint !== options.expectedRawSha256) fail("RA004_RAW_SNAPSHOT_FINGERPRINT_MISMATCH", "Raw snapshot fingerprint does not match the approved expectation");
  const legacyBytes = Buffer.from(bytes), canonicalBytes = Buffer.from(bytes);
  validateSnapshot(bytes, options.contentType || "text/csv");
  if (!state || !Array.isArray(state.targets) || !state.captured_at) fail("RA004_STATE_INVALID", "A fixed test state export is required");
  const identities = state.targets.map((target) => `${target.external_product_id}|${target.external_variant_id}`);
  if (new Set(identities).size !== identities.length) fail("RA004_IDENTITY_CONFLICT", "State export contains a duplicate source identity");
  const legacyProjector = options.legacyProjector || projectCsvRows;
  const legacyProjected = legacyProjector(legacyBytes, { storeUrl: config.store_url, capturedAt: state.captured_at });
  const canonicalConnected = (options.canonicalConnector || connectTenRepsCsv)(canonicalBytes, { storeUrl: config.store_url, capturedAt: state.captured_at });
  const sourceVariants = legacyProjected.sourceVariants.map((row) => ({ ...row, shipping_cost: config.shipping_policy.cost_gbp }));
  const policy = { ...config.guardrails, required_matched_offers: state.targets.length, store_url: config.store_url };
  const legacy = classifyExistingOffers({ targets: structuredClone(state.targets), sourceVariants, policy, sourceCapturedAt: state.captured_at, now: new Date(state.captured_at), sourceProductCount: legacyProjected.products.length, guardScope: { name: "RA004_TEST_ONLY_10REPS", retailer: "10 Reps" }, quarantineUnsafeRows: true });
  const fixture = { fixture_id: "ra004-10reps-single-snapshot", run_id: "ra004-test-only-replay", captured_at: state.captured_at, source: { retailer_ref: "10-reps", source_ref: `sha256:${originalFingerprint}`, source_type: "CSV" }, raw_records: canonicalConnected.rawRecords, expected_state: state.targets.map(expectedState), controls: {} };
  const canonical = runZeroWriteHarness(fixture, { clock: () => state.captured_at });
  if (rawSha256(legacyBytes) !== originalFingerprint || rawSha256(canonicalBytes) !== originalFingerprint || rawSha256(bytes) !== originalFingerprint) fail("RA004_FINGERPRINT_CHANGED_DURING_RUN", "Snapshot bytes changed during replay");
  const legacyEvidence = new Map(legacyProjected.evidenceRows.map((row) => [row.variant_id, row])), canonicalEvidence = new Map(canonicalConnected.evidenceRows.map((row) => [row.variant_id, row]));
  const legacyRows = [...(legacy.rows || []), ...(legacy.quarantined_rows || [])], legacyByVariant = new Map(legacyRows.map((row) => [String(row.external_variant_id), row])), canonicalByVariant = new Map(canonical.rows.map((row) => [value(row.canonical_record.external_variant_id), row]));
  const parityRows = state.targets.map((target) => {
    const key = String(target.external_variant_id), left = legacyNormalized(target, legacyEvidence.get(key) || null, legacyByVariant.get(key), originalFingerprint), right = canonicalNormalized(target, canonicalEvidence.get(key) || null, canonicalByVariant.get(key), originalFingerprint);
    return { key, legacy: left, canonical: right, comparison: compareParityRows(left, right, options.nativeGoldenExpectations?.[key]) };
  });
  const report = {
    schema_version: 2, adapter: "RA004_TEST_ONLY_SINGLE_SNAPSHOT_V2", retailer: { id: "14", name: "10 Reps" },
    snapshot_contract: { contract_version: "RA004_SINGLE_SNAPSHOT_V1", retailer: { id: "14", name: "10 Reps", slug: "10-reps" }, source_type: "CSV_PRODUCT_FEED", capture_id: "ra004-synthetic-fixture-001", capture_timestamp_utc: state.captured_at, content_type: options.contentType || "text/csv", byte_length: bytes.length, expected_raw_sha256: options.expectedRawSha256, raw_bytes_sha256: originalFingerprint, issued_copy_sha256: { legacy: rawSha256(legacyBytes), canonical: rawSha256(canonicalBytes) }, source_read_count: boundary.metrics.source_read_count, provenance: "scripts/test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv" },
    raw_snapshot_sha256: originalFingerprint, legacy_snapshot_sha256: rawSha256(legacyBytes), canonical_snapshot_sha256: rawSha256(canonicalBytes), required_headers: REQUIRED_COLUMNS, difference_classes: DIFFERENCE_CLASSES, parity_fields: PARITY_FIELDS,
    legacy: { state: legacy.state, action_manifest_fingerprint: legacy.action_manifest_fingerprint || null, row_count: legacyRows.length }, canonical: { run_outcome: canonical.run_outcome, output_fingerprint: canonical.output_fingerprint, row_count: canonical.rows.length },
    parity_rows: parityRows, difference_counts: { records: Object.fromEntries(DIFFERENCE_CLASSES.map((name) => [name, parityRows.filter((row) => row.comparison.difference_class === name).length])), integrity: Object.fromEntries(INTEGRITY_CATEGORIES.map((name) => [name, 0])), total_mismatches: 0 }, unclassified_record_count: parityRows.filter((row) => row.legacy.change_classification === "UNCLASSIFIED" || row.canonical.change_classification === "UNCLASSIFIED").length,
    semantic_mappings: [
      { field: "native_action", legacy: "offer-sync action", canonical: "canonical classification", validation: "side-specific static golden" },
      { field: "native_reason_codes", legacy: "RA-003 compatibility plus source reason", canonical: "canonical taxonomy", validation: "side-specific static golden" },
      { field: "native_record_fingerprint", legacy: "legacy classified evidence", canonical: "canonical v1 record", validation: "side-specific static golden" },
    ],
    capabilities: { ...boundary.metrics }, authorization: { adapter: "READY_FOR_REVERIFICATION", ra004: "IN_PROGRESS", shadow: shadowPlan.status, production_execution_allowed: false }, report_fingerprint: null,
  };
  report.report_fingerprint = canonicalFingerprint("RA004-SINGLE-SNAPSHOT-REPORT", { ...report, report_fingerprint: null });
  return deepFreeze(report);
}

module.exports = { CAPABILITY_FIELDS, DIFFERENCE_CLASSES, PARITY_FIELDS, REPORT_FIELDS, compareParityCollections, compareParityReport, compareParityRows, createDeniedCapabilities, replaySingleSnapshot };
