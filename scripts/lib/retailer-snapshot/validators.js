const { validateContract } = require("./schemas");
const { getReason } = require("./reason-codes");
const { fingerprintCanonicalSnapshot, fingerprintChildPlan, fingerprintClassificationArtifact, fingerprintClassificationRecord, fingerprintParentPlan, fingerprintRowPlan } = require("./fingerprints");
const { fail } = require("./errors");

function assertEqual(actual, expected, code, message, path = "$") { if (actual !== expected) fail(code, message, path, { actual, expected }); }
function validateCanonicalSnapshot(snapshot) { assertEqual(fingerprintCanonicalSnapshot(snapshot), snapshot.fingerprint, "RSBI_SOURCE_HASH_MISMATCH", "Canonical fingerprint mismatch", "$.fingerprint"); return true; }
function validateClassificationArtifact(artifact, sourceRecordIds = null) {
  const ids = artifact.records.map((record) => String(record.source_record_id));
  if (new Set(ids).size !== ids.length) fail("RSBI_DUPLICATE_IDENTITY", "Duplicate classified source record ID");
  if (sourceRecordIds && (ids.length !== sourceRecordIds.length || ids.slice().sort().join("|") !== sourceRecordIds.map(String).sort().join("|"))) fail("RSBI_EXPECTED_STATE_MISMATCH", "Classification coverage differs from source");
  for (const record of artifact.records) {
    if (!record.reason_codes.length) fail("RSBI_MISSING_REQUIRED_EVIDENCE", "Classification has no reasons");
    for (const code of record.reason_codes) getReason(code);
    assertEqual(fingerprintClassificationRecord(record), record.record_fingerprint, "RSBI_SOURCE_HASH_MISMATCH", "Classification record fingerprint mismatch");
  }
  assertEqual(fingerprintClassificationArtifact(artifact), artifact.artifact_fingerprint, "RSBI_SOURCE_HASH_MISMATCH", "Classification artifact fingerprint mismatch");
  return true;
}
function validateChildPlans(parent, children) {
  const assigned = [];
  for (const child of children) {
    if (child.parent_plan_id !== parent.parent_plan_id) fail("RSBI_PARENT_FINGERPRINT_MISMATCH", "Child belongs to another parent");
    if (child.record_ids.length < 1 || child.record_ids.length > 100 || child.record_ids.length !== child.row_plans.length) fail("RSBI_GUARDRAIL_EXCEEDED", "Invalid child size/coverage");
    assertEqual(fingerprintChildPlan(child), child.child_plan_fingerprint, "RSBI_CHILD_FINGERPRINT_MISMATCH", "Child fingerprint mismatch");
    child.row_plans.forEach((row, index) => { assertEqual(String(row.source_record_id), String(child.record_ids[index]), "RSBI_EXPECTED_STATE_MISMATCH", "Row order differs from IDs"); assertEqual(fingerprintRowPlan(row), row.fingerprints.row_plan, "RSBI_CHILD_FINGERPRINT_MISMATCH", "Row plan fingerprint mismatch"); });
    assigned.push(...child.record_ids);
  }
  if (new Set(assigned).size !== assigned.length) fail("RSBI_DUPLICATE_IDENTITY", "Child plans overlap");
  if (assigned.slice().sort().join("|") !== parent.safe_record_ids.slice().sort().join("|")) fail("RSBI_EXPECTED_STATE_MISMATCH", "Child coverage differs from parent safe records");
  return true;
}
function validateParentPlan(parent, children) { assertEqual(fingerprintParentPlan(parent), parent.parent_plan_fingerprint, "RSBI_PARENT_FINGERPRINT_MISMATCH", "Parent fingerprint mismatch"); validateChildPlans(parent, children); return true; }
function validateResumeState(children) { const states = new Set(children.map((child) => child.status)); if (states.has("APPLIED") && (states.has("FAILED") || states.has("PLANNED"))) return { valid: false, code: "RSBI_PARTIAL_BATCH_STATE", requires_explicit_decision: true }; return { valid: true }; }
function validateNoUnsafePlan(classification, parent) { const byId = new Map(classification.records.map((record) => [String(record.source_record_id), record])); for (const id of parent.safe_record_ids) if (!byId.get(String(id))?.primary_status.startsWith("SAFE_")) fail("RSBI_UNSUPPORTED_CLASSIFICATION", "Unsafe classification entered write-bearing preview"); return true; }

module.exports = { validateCanonicalSnapshot, validateChildPlans, validateClassificationArtifact, validateContract, validateNoUnsafePlan, validateParentPlan, validateResumeState };
