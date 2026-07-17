const ERROR_DEFINITIONS = Object.freeze([
  ["RSBI_SOURCE_SCHEMA_MISMATCH", "CRITICAL"], ["RSBI_SOURCE_HASH_MISMATCH", "CRITICAL"],
  ["RSBI_CANONICAL_SNAPSHOT_STALE", "CRITICAL"], ["RSBI_PARENT_FINGERPRINT_MISMATCH", "CRITICAL"],
  ["RSBI_CHILD_FINGERPRINT_MISMATCH", "CRITICAL"], ["RSBI_EXPECTED_STATE_MISMATCH", "CRITICAL"],
  ["RSBI_DEPENDENCY_NOT_APPLIED", "ERROR"], ["RSBI_DUPLICATE_IDENTITY", "CRITICAL"],
  ["RSBI_APPROVAL_EXPIRED", "CRITICAL"], ["RSBI_REPLAY_BLOCKED", "INFO"],
  ["RSBI_PARTIAL_BATCH_STATE", "ERROR"], ["RSBI_ROLLBACK_OWNERSHIP_CONFLICT", "CRITICAL"],
  ["RSBI_GUARDRAIL_EXCEEDED", "CRITICAL"], ["RSBI_SOURCE_COLLAPSE", "CRITICAL"],
  ["RSBI_MASS_OOS", "CRITICAL"], ["RSBI_PRICE_ANOMALY", "ERROR"],
  ["RSBI_UNSUPPORTED_CLASSIFICATION", "CRITICAL"], ["RSBI_UNSUPPORTED_ACTION", "CRITICAL"],
  ["RSBI_MISSING_REQUIRED_EVIDENCE", "ERROR"], ["RSBI_INVALID_TRANSITION", "CRITICAL"],
].map(([code, severity]) => Object.freeze({ code, severity })));

const ERROR_CODES = Object.freeze(ERROR_DEFINITIONS.map(({ code }) => code));

class RsbiError extends Error {
  constructor(code, message, path = "$", detail = {}) {
    if (!ERROR_CODES.includes(code)) throw new Error(`Unknown RSBI error code: ${code}`);
    super(message);
    this.name = "RsbiError";
    this.code = code;
    this.path = path;
    this.detail = detail;
  }
}

function fail(code, message, path, detail) {
  throw new RsbiError(code, message, path, detail);
}

module.exports = { ERROR_CODES, ERROR_DEFINITIONS, RsbiError, fail };
