const TAXONOMY_VERSION = "v1";

const SOURCE_STATES = Object.freeze(["SOURCE_VALID", "SOURCE_MISSING", "SOURCE_INVALID", "SOURCE_IDENTITY_CONFLICT", "SOURCE_SUSPECT"]);
const CHANGE_CLASSIFICATIONS = Object.freeze(["NO_CHANGE", "SAFE_CANDIDATE", "REVIEW_REQUIRED", "REJECTED", "STALE", "EQUIVALENT_ACTIVE"]);
const EXECUTION_STATES = Object.freeze(["NOT_REQUIRED", "NOT_AUTHORIZED", "AWAITING_APPROVAL", "AUTHORIZED", "APPLIED_VERIFIED", "SKIPPED_EQUIVALENT_ACTIVE", "SUPERSEDED", "BLOCKED_GUARDRAIL", "FAILED_SYSTEM"]);
const RUN_OUTCOMES = Object.freeze(["PASS", "PASS_WITH_REVIEW", "SKIPPED_EQUIVALENT_ACTIVE", "NO_AUTHORIZED_SCOPE", "BLOCKED_SOURCE", "BLOCKED_GUARDRAIL", "FAILED_SYSTEM"]);
const ALERT_LEVELS = Object.freeze(["NONE", "INFO", "WARNING", "CRITICAL_RETAILER", "CRITICAL_PLATFORM"]);
const NEXT_ACTIONS = Object.freeze(["NONE", "WAIT", "RETRY_SOURCE", "REPLAY_READ_ONLY", "REVIEW_QUEUE", "REVIEW_GUARDRAIL", "OWNER_DECISION", "ENGINEERING_RESPONSE"]);
const SCOPES = Object.freeze(["ROW", "RETAILER_RUN", "PLATFORM"]);
const BLOCKING_SCOPES = Object.freeze(["NONE", "ROW", "RETAILER", "PLATFORM"]);

const definitions = [
  ["CANONICAL_SOURCE_VALID", "ROW", "SOURCE", true, false, "NONE", "NONE", "NONE"],
  ["CANONICAL_SOURCE_MISSING", "ROW", "SOURCE", true, true, "ROW", "WARNING", "REVIEW_QUEUE"],
  ["CANONICAL_SOURCE_INVALID", "ROW", "SOURCE", true, true, "ROW", "WARNING", "REVIEW_QUEUE"],
  ["CANONICAL_SOURCE_SUSPECT", "RETAILER_RUN", "SOURCE", true, true, "RETAILER", "CRITICAL_RETAILER", "RETRY_SOURCE"],
  ["CANONICAL_IDENTITY_EXACT", "ROW", "IDENTITY", true, false, "NONE", "NONE", "NONE"],
  ["CANONICAL_IDENTITY_CONFLICT", "ROW", "IDENTITY", true, true, "ROW", "WARNING", "REVIEW_QUEUE"],
  ["CANONICAL_NO_CHANGE", "ROW", "CHANGE", true, false, "NONE", "NONE", "NONE"],
  ["CANONICAL_PRICE_CHANGED", "ROW", "CHANGE", false, false, "NONE", "INFO", "OWNER_DECISION"],
  ["CANONICAL_REVIEW_REQUIRED", "ROW", "CHANGE", false, true, "ROW", "WARNING", "REVIEW_QUEUE"],
  ["CANONICAL_REJECTED", "ROW", "CHANGE", true, false, "ROW", "NONE", "NONE"],
  ["CANONICAL_STALE_STATE", "ROW", "STATE", true, true, "ROW", "WARNING", "REPLAY_READ_ONLY"],
  ["CANONICAL_EQUIVALENT_ACTIVE", "RETAILER_RUN", "CONCURRENCY", true, false, "NONE", "INFO", "WAIT"],
  ["CANONICAL_POLICY_NOT_AUTHORIZED", "RETAILER_RUN", "AUTHORIZATION", true, false, "NONE", "INFO", "OWNER_DECISION"],
  ["CANONICAL_GUARDRAIL_BLOCKED", "RETAILER_RUN", "GUARDRAIL", true, true, "RETAILER", "WARNING", "REVIEW_GUARDRAIL"],
  ["CANONICAL_SYSTEM_EXCEPTION", "PLATFORM", "SYSTEM", true, true, "PLATFORM", "CRITICAL_PLATFORM", "ENGINEERING_RESPONSE"],
];

const REASON_REGISTRY = Object.freeze(definitions.map(([code, scope, category, terminal, review_required, blocking_scope, alert_level, next_action]) => Object.freeze({
  code, scope, category, terminal, review_required, blocking_scope, alert_level, next_action,
})));
const REASON_BY_CODE = new Map(REASON_REGISTRY.map((entry) => [entry.code, entry]));

function validateTaxonomy() {
  if (TAXONOMY_VERSION !== "v1" || new Set(REASON_REGISTRY.map((entry) => entry.code)).size !== REASON_REGISTRY.length) throw new Error("Invalid canonical taxonomy registry");
  for (const entry of REASON_REGISTRY) {
    if (!/^[A-Z0-9_]+$/.test(entry.code) || !SCOPES.includes(entry.scope) || !BLOCKING_SCOPES.includes(entry.blocking_scope) || !ALERT_LEVELS.includes(entry.alert_level) || !NEXT_ACTIONS.includes(entry.next_action) || typeof entry.terminal !== "boolean" || typeof entry.review_required !== "boolean") throw new Error(`Invalid canonical reason ${entry.code}`);
  }
  return true;
}

function getReason(code) {
  const reason = REASON_BY_CODE.get(code);
  if (!reason) {
    const error = new Error(`Unknown canonical reason code ${code}`);
    error.code = "CANONICAL_REASON_UNKNOWN";
    throw error;
  }
  return reason;
}

validateTaxonomy();

module.exports = { ALERT_LEVELS, BLOCKING_SCOPES, CHANGE_CLASSIFICATIONS, EXECUTION_STATES, NEXT_ACTIONS, REASON_REGISTRY, RUN_OUTCOMES, SCOPES, SOURCE_STATES, TAXONOMY_VERSION, getReason, validateTaxonomy };
