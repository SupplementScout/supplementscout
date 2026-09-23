const { fingerprint } = require("../artifacts");
const { createCanonicalRecord, validateCanonicalRecord } = require("./contract");
const { getReason } = require("./taxonomy");

function createZeroWriteBoundary() {
  const metrics = { write_attempt_count: 0, network_attempt_count: 0 };
  const deny = (kind) => {
    metrics[`${kind}_attempt_count`] += 1;
    const error = new Error(`Zero-write harness denied ${kind} attempt`);
    error.code = `ZERO_WRITE_${kind.toUpperCase()}_ATTEMPT`;
    throw error;
  };
  return Object.freeze({
    metrics,
    writer: Object.freeze({ write: () => deny("write") }),
    network: Object.freeze({ request: () => deny("network") }),
  });
}

function defaultFixtureAdapter(raw) { return structuredClone(raw); }
const value = (field) => field?.state === "PRESENT" ? field.value : null;
const changedFields = (record, expected) => {
  const changed = [];
  if (record.price.state === "PRESENT" && record.price.amount_minor !== String(expected.price_minor)) changed.push("price");
  if (record.availability !== expected.availability) changed.push("availability");
  return changed;
};

function classifyRecord(record, expectedMatches, fixture) {
  if (record.validation_result.status === "INVALID" || !validateCanonicalRecord(record).valid) return { source_state: "SOURCE_INVALID", change_classification: "REVIEW_REQUIRED", execution_state: "NOT_AUTHORIZED", reason_codes: ["CANONICAL_SOURCE_INVALID", "CANONICAL_REVIEW_REQUIRED"] };
  if (record.source_presence === "MISSING_FROM_SOURCE") return { source_state: "SOURCE_MISSING", change_classification: "REVIEW_REQUIRED", execution_state: "NOT_AUTHORIZED", reason_codes: ["CANONICAL_SOURCE_MISSING", "CANONICAL_REVIEW_REQUIRED"] };
  if (expectedMatches.length !== 1) return { source_state: "SOURCE_IDENTITY_CONFLICT", change_classification: "REVIEW_REQUIRED", execution_state: "NOT_AUTHORIZED", reason_codes: ["CANONICAL_IDENTITY_CONFLICT", "CANONICAL_REVIEW_REQUIRED"] };
  const expected = expectedMatches[0];
  if ((fixture.controls?.stale_record_ids || []).map(String).includes(record.source_record_id)) return { source_state: "SOURCE_VALID", change_classification: "STALE", execution_state: "BLOCKED_GUARDRAIL", reason_codes: ["CANONICAL_SOURCE_VALID", "CANONICAL_STALE_STATE"] };
  if ((fixture.controls?.rejected_record_ids || []).map(String).includes(record.source_record_id)) return { source_state: "SOURCE_VALID", change_classification: "REJECTED", execution_state: "NOT_REQUIRED", reason_codes: ["CANONICAL_SOURCE_VALID", "CANONICAL_REJECTED"] };
  const changed_fields = changedFields(record, expected);
  if (!changed_fields.length) return { source_state: "SOURCE_VALID", change_classification: "NO_CHANGE", execution_state: "NOT_REQUIRED", reason_codes: ["CANONICAL_SOURCE_VALID", "CANONICAL_IDENTITY_EXACT", "CANONICAL_NO_CHANGE"], changed_fields };
  const reviewFields = new Set(expected.review_fields || []);
  if (changed_fields.some((field) => reviewFields.has(field))) return { source_state: "SOURCE_VALID", change_classification: "REVIEW_REQUIRED", execution_state: "NOT_AUTHORIZED", reason_codes: ["CANONICAL_SOURCE_VALID", "CANONICAL_IDENTITY_EXACT", "CANONICAL_REVIEW_REQUIRED"], changed_fields };
  return { source_state: "SOURCE_VALID", change_classification: "SAFE_CANDIDATE", execution_state: "NOT_AUTHORIZED", reason_codes: ["CANONICAL_SOURCE_VALID", "CANONICAL_IDENTITY_EXACT", ...(changed_fields.includes("price") ? ["CANONICAL_PRICE_CHANGED"] : []), "CANONICAL_POLICY_NOT_AUTHORIZED"], changed_fields };
}

function deriveRunOutcome(rows, controls = {}) {
  if (controls.system_error) return "FAILED_SYSTEM";
  if (controls.source_suspect) return "BLOCKED_SOURCE";
  if (controls.equivalent_active) return "SKIPPED_EQUIVALENT_ACTIVE";
  if (controls.guardrail_blocked || rows.some((row) => row.execution_state === "BLOCKED_GUARDRAIL")) return "BLOCKED_GUARDRAIL";
  if (rows.some((row) => row.change_classification === "REVIEW_REQUIRED")) return "PASS_WITH_REVIEW";
  if (rows.some((row) => row.change_classification === "SAFE_CANDIDATE")) return "NO_AUTHORIZED_SCOPE";
  return "PASS";
}

function count(rows, predicate) { return rows.filter(predicate).length; }

function buildReport(fixture, rows, boundary, evaluatedAt, inputFingerprint, systemReason = null) {
  const reasonCounts = {};
  for (const code of rows.flatMap((row) => row.reason_codes)) {
    getReason(code);
    reasonCounts[code] = (reasonCounts[code] || 0) + 1;
  }
  if (systemReason) reasonCounts[systemReason] = (reasonCounts[systemReason] || 0) + 1;
  const forcedOutcome = systemReason === "CANONICAL_SYSTEM_EXCEPTION" ? "FAILED_SYSTEM" : systemReason === "CANONICAL_SOURCE_SUSPECT" ? "BLOCKED_SOURCE" : systemReason === "CANONICAL_EQUIVALENT_ACTIVE" ? "SKIPPED_EQUIVALENT_ACTIVE" : null;
  const report = {
    contract_version: "v1", taxonomy_version: "v1", fixture_id: fixture.fixture_id,
    evaluated_at: evaluatedAt, input_fingerprint: inputFingerprint,
    input_record_count: fixture.raw_records.length,
    valid_record_count: count(rows, (row) => row.source_record_present && row.contract_valid),
    invalid_record_count: count(rows, (row) => row.source_record_present && !row.contract_valid),
    no_change_count: count(rows, (row) => row.change_classification === "NO_CHANGE"),
    safe_candidate_count: count(rows, (row) => row.change_classification === "SAFE_CANDIDATE"),
    review_count: count(rows, (row) => row.change_classification === "REVIEW_REQUIRED"),
    rejected_count: count(rows, (row) => row.change_classification === "REJECTED"),
    reason_counts: Object.fromEntries(Object.entries(reasonCounts).sort(([a], [b]) => a.localeCompare(b))),
    run_outcome: forcedOutcome || deriveRunOutcome(rows, fixture.controls),
    write_attempt_count: boundary.metrics.write_attempt_count,
    network_attempt_count: boundary.metrics.network_attempt_count,
    authorization: { policy_state: "NOT_APPROVED", manifest_approval_state: "NOT_PRESENT", production_execution_allowed: false },
    postflight_state: "NOT_RUN_ZERO_WRITE",
    rows: [...rows].sort((a, b) => a.source_record_id.localeCompare(b.source_record_id)),
    output_fingerprint: null,
  };
  report.output_fingerprint = fingerprint({ ...report, output_fingerprint: null });
  return Object.freeze(report);
}

function runZeroWriteHarness(fixture, dependencies = {}) {
  const boundary = dependencies.boundary || createZeroWriteBoundary();
  const adapter = dependencies.adapter || defaultFixtureAdapter;
  const evaluatedAt = (dependencies.clock || (() => fixture.captured_at))();
  const inputFingerprint = fingerprint(fixture);
  if (fixture.controls?.system_error) return buildReport(fixture, [], boundary, evaluatedAt, inputFingerprint, "CANONICAL_SYSTEM_EXCEPTION");
  if (fixture.controls?.source_suspect) return buildReport(fixture, [], boundary, evaluatedAt, inputFingerprint, "CANONICAL_SOURCE_SUSPECT");
  if (fixture.controls?.equivalent_active) return buildReport(fixture, [], boundary, evaluatedAt, inputFingerprint, "CANONICAL_EQUIVALENT_ACTIVE");
  const context = { ...fixture.source, run_id: fixture.run_id, captured_at: fixture.captured_at, source_fingerprint: fingerprint({ source: fixture.source, raw_records: fixture.raw_records }) };
  const rows = [];
  try {
    for (const rawInput of fixture.raw_records) {
      const raw = adapter(structuredClone(rawInput), { boundary, fixture: structuredClone(fixture) });
      const record = createCanonicalRecord(raw, context);
      const matches = fixture.expected_state.filter((expected) => String(expected.external_product_id) === value(record.external_product_id) && String(expected.external_variant_id) === value(record.external_variant_id));
      rows.push({ source_record_id: record.source_record_id, source_record_present: true, contract_valid: record.validation_result.status === "VALID" && validateCanonicalRecord(record).valid, canonical_record: record, ...classifyRecord(record, matches, fixture), policy_authorized: false, manifest_approved: false, execution_attempted: false, postflight_state: "NOT_RUN_ZERO_WRITE" });
    }
    const observedKeys = new Set(rows.map((row) => `${value(row.canonical_record.external_product_id)}|${value(row.canonical_record.external_variant_id)}`));
    for (const expected of fixture.expected_state) {
      if (observedKeys.has(`${expected.external_product_id}|${expected.external_variant_id}`)) continue;
      const missing = createCanonicalRecord({ source_record_id: `missing:${expected.external_product_id}:${expected.external_variant_id}`, source_presence: "MISSING_FROM_SOURCE", external_product_id: expected.external_product_id, external_variant_id: expected.external_variant_id, product_name: expected.product_name || null, price: null, currency: expected.currency || "GBP", availability: "SOURCE_MISSING" }, context);
      rows.push({ source_record_id: missing.source_record_id, source_record_present: false, contract_valid: validateCanonicalRecord(missing).valid, canonical_record: missing, ...classifyRecord(missing, [expected], fixture), policy_authorized: false, manifest_approved: false, execution_attempted: false, postflight_state: "NOT_RUN_ZERO_WRITE" });
    }
  } catch (error) {
    if (String(error.code || "").startsWith("ZERO_WRITE_")) throw error;
    return buildReport(fixture, rows, boundary, evaluatedAt, inputFingerprint, "CANONICAL_SYSTEM_EXCEPTION");
  }
  return buildReport(fixture, rows, boundary, evaluatedAt, inputFingerprint);
}

module.exports = { buildReport, createZeroWriteBoundary, defaultFixtureAdapter, deriveRunOutcome, runZeroWriteHarness };
