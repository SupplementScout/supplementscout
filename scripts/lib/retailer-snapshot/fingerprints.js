const crypto = require("node:crypto");
const { canonicalJson, normalizeDecimalString } = require("../canonical-json");
const { fail } = require("./errors");

const VERSION = "RSBI-CJ1";
const PREFIXES = Object.freeze({
  sourceRecord: "RSBI:SRC-RECORD:1", sourceSnapshot: "RSBI:SRC-SNAPSHOT:1",
  canonicalSnapshot: "RSBI:CANONICAL-SNAPSHOT:1", classificationRecord: "RSBI:CLASS-RECORD:1",
  classificationArtifact: "RSBI:CLASSIFICATION:1", canonicalProductProposal: "RSBI:PRODUCT-PROPOSAL:1",
  canonicalVariantProposal: "RSBI:VARIANT-PROPOSAL:1", rowPlan: "RSBI:ROW-PLAN:1",
  childPlan: "RSBI:CHILD-PLAN:1", parentCore: "RSBI:PARENT-CORE:1", parentPlan: "RSBI:PARENT-PLAN:1",
  rollbackManifest: "RSBI:ROLLBACK:1", applyRun: "RSBI:APPLY-RUN:1", reviewDecision: "RSBI:REVIEW-DECISION:1",
});
const DECIMAL_KEYS = /(?:^|_)(?:price|cost|total|amount|ratio|weight|volume|size_value)$/;
const ID_KEYS = /(?:^|_)(?:id|ids)$/;
const OMIT_BY_TYPE = Object.freeze({
  sourceRecord: new Set(["raw_row_fingerprint"]),
  classificationRecord: new Set(["record_fingerprint"]),
  classificationArtifact: new Set(["classification_id", "created_at", "artifact_fingerprint"]),
  canonicalSnapshot: new Set(["snapshot_id", "captured_at", "fingerprint"]),
  childPlan: new Set(["child_plan_id", "status", "child_plan_fingerprint"]),
  rowPlan: new Set(["row_plan"]),
  parentCore: new Set(["parent_plan_id", "created_at", "expires_at", "child_batches", "parent_plan_fingerprint"]),
  parentPlan: new Set(["parent_plan_id", "created_at", "expires_at", "parent_plan_fingerprint"]),
  rollbackManifest: new Set(["rollback_fingerprint"]),
  applyRun: new Set(["run_id", "started_at", "completed_at", "logs_summary", "apply_fingerprint"]),
});

function normalizeTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Invalid timestamp ${value}`);
  return date.toISOString();
}

function normalize(value, options = {}, path = "$", key = "") {
  if (value === undefined) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "Undefined is forbidden in canonical JSON", path);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (ID_KEYS.test(key)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "IDs must remain strings", path);
    if (!Number.isFinite(value)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "Non-finite number", path);
    return value;
  }
  if (typeof value === "string") {
    if (options.timestampKeys?.has(key)) return normalizeTimestamp(value);
    if (DECIMAL_KEYS.test(key) && /^[-+]?\d+(?:\.\d+)?$/.test(value)) return normalizeDecimalString(value);
    return value;
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => normalize(item, options, `${path}[${index}]`, key));
    if (options.unorderedPaths?.has(path)) return items.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    return items;
  }
  if (typeof value === "object") {
    const output = {};
    for (const childKey of Object.keys(value).sort()) {
      if (options.omit?.has(childKey)) continue;
      output[childKey] = normalize(value[childKey], options, `${path}.${childKey}`, childKey);
    }
    return output;
  }
  fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unsupported canonical type ${typeof value}`, path);
}

function canonicalize(value, options = {}) { return canonicalJson(normalize(value, options)); }
function hash(prefix, value, options = {}) { return crypto.createHash("sha256").update(`${VERSION}\n${prefix}\n${canonicalize(value, options)}`, "utf8").digest("hex"); }
function typed(type, value, options = {}) { return hash(PREFIXES[type], value, { ...options, omit: new Set([...(OMIT_BY_TYPE[type] || []), ...(options.omit || [])]) }); }

const fingerprintSourceRecord = (value) => typed("sourceRecord", value, { timestampKeys: new Set(["source_updated_at", "observed_at"]) });
const fingerprintSourceSnapshot = (value) => typed("sourceSnapshot", value, { omit: new Set(["warnings"]), unorderedPaths: new Set(["$.records"]) });
const fingerprintCanonicalSnapshot = (value) => typed("canonicalSnapshot", value);
const fingerprintClassificationRecord = (value) => typed("classificationRecord", value, { unorderedPaths: new Set(["$.reason_codes", "$.secondary_statuses"]) });
const fingerprintClassificationArtifact = (value) => typed("classificationArtifact", value);
const fingerprintCanonicalProductProposal = (value) => typed("canonicalProductProposal", value);
const fingerprintCanonicalVariantProposal = (value) => typed("canonicalVariantProposal", value);
const fingerprintRowPlan = (value) => typed("rowPlan", value);
const fingerprintChildPlan = (value) => typed("childPlan", value);
const fingerprintParentCore = (value) => typed("parentCore", value);
const fingerprintParentPlan = (value) => typed("parentPlan", value);
const fingerprintRollbackManifest = (value) => typed("rollbackManifest", value);
const fingerprintApplyRun = (value) => typed("applyRun", value);
const fingerprintReviewDecision = (value) => typed("reviewDecision", value);

module.exports = { PREFIXES, VERSION, canonicalize, fingerprintApplyRun, fingerprintCanonicalProductProposal, fingerprintCanonicalSnapshot, fingerprintCanonicalVariantProposal, fingerprintChildPlan, fingerprintClassificationArtifact, fingerprintClassificationRecord, fingerprintParentCore, fingerprintParentPlan, fingerprintReviewDecision, fingerprintRollbackManifest, fingerprintRowPlan, fingerprintSourceRecord, fingerprintSourceSnapshot, hash, normalize };
