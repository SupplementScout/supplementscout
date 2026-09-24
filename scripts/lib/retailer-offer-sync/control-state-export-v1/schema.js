const SCHEMA_VERSION = "control-state-export-v1";

const REQUIRED_FIELDS_BY_KIND = Object.freeze({
  PLAN: ["id", "status", "scope", "retailer_ids"],
  PLAN_ITEM: ["id", "plan_id", "status", "scope", "retailer_ids"],
  SESSION: ["id", "status", "scope", "retailer_ids"],
  LOCK: ["id", "status", "scope", "retailer_ids"],
  APPROVAL: ["id", "status", "scope", "retailer_ids"],
  APPROVAL_CONSUMPTION: ["id", "approval_id", "status", "scope", "retailer_ids"],
  RECOVERY: ["id", "status", "scope", "retailer_ids"],
  APPLY: ["id", "status", "scope", "retailer_ids", "completed_at"],
  POSTFLIGHT: ["id", "status", "scope", "retailer_ids", "completed_at"],
  WATCHDOG: ["id", "status", "scope", "retailer_ids", "completed_at"],
  CONFLICT: ["id", "reason_code", "source_reference", "scope", "retailer_ids"],
});

const SOURCE_REGISTRY = Object.freeze([
  { name: "control_plans", object_kind: "PLAN", required: true },
  { name: "plan_items", object_kind: "PLAN_ITEM", required: true },
  { name: "sessions", object_kind: "SESSION", required: true },
  { name: "locks", object_kind: "LOCK", required: true },
  { name: "approval_contracts", object_kind: "APPROVAL", required: true },
  { name: "approval_consumption", object_kind: "APPROVAL_CONSUMPTION", required: true },
  { name: "recovery_state", object_kind: "RECOVERY", required: true },
  { name: "apply_ledger", object_kind: "APPLY", required: true },
  { name: "postflight_state", object_kind: "POSTFLIGHT", required: true },
  { name: "watchdog_state", object_kind: "WATCHDOG", required: true },
  { name: "global_conflicts", object_kind: "CONFLICT", required: true },
].map((source) => Object.freeze({
  ...source,
  required_fields: Object.freeze([...REQUIRED_FIELDS_BY_KIND[source.object_kind]]),
  approved_fixture_interface: `fixture:${source.name}`,
  retailer_filter: "retailer_id plus global/cross-retailer scope",
  overlap_filter: "retailer, workflow, executor, batch, parent/child and source fingerprint",
  pagination: "cursor-v1",
  sorting: "id ascending",
  consistency_marker: "required before and after pagination",
  redaction: "control identifiers only",
  live_interface: "public.read_retailer_control_state_v1",
  unavailable_reason: null,
})));

const SOURCE_NAMES = Object.freeze(SOURCE_REGISTRY.map((source) => source.name));
const FINAL_ASSESSMENTS = Object.freeze([
  "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION",
  "BLOCKED_ACTIVE_PLAN",
  "BLOCKED_ACTIVE_SESSION",
  "BLOCKED_LOCK",
  "BLOCKED_APPROVAL",
  "BLOCKED_RECOVERY",
  "BLOCKED_INCOMPLETE_STATE",
  "BLOCKED_INCONSISTENT_SNAPSHOT",
  "BLOCKED_INCOMPLETE_EXPORT",
  "BLOCKED_UNAUTHORIZED",
  "BLOCKED_UNKNOWN",
]);

const PROHIBITED_OPERATIONS = Object.freeze([
  "INSERT", "UPDATE", "UPSERT", "DELETE", "MUTATION_RPC", "RAW_SQL",
  "TRANSACTION_WRITER", "PLAN_CREATE", "SESSION_CREATE", "LOCK_ACQUIRE",
  "APPROVAL_CREATE", "APPLY", "REVIEW_QUEUE_PUBLISH", "SHADOW_RUN",
]);

const ALLOWED_PROVIDER_METHODS = Object.freeze(new Set([
  "describe", "readConsistencyMarker", "readPage", "readSnapshot",
]));

function assertOutputShape(output) {
  const required = [
    "schema_version", "retailer_id", "retailer_name", "baseline_sha",
    "export_started_at", "export_completed_at", "capture_window",
    "authorization_fingerprint", "provider_identity", "sources_queried",
    "sources_unavailable", "source_records", "completeness_status", "consistency_status",
    "active_plans", "incomplete_plans", "expired_plans", "superseded_plans",
    "recovery_plans", "sessions", "open_sessions", "stale_sessions", "active_locks",
    "expired_locks", "orphaned_locks", "pending_approvals", "unused_approvals",
    "expired_approvals", "consumed_approvals", "revoked_approvals", "last_apply",
    "last_postflight", "last_watchdog_result", "overlapping_scope_conflicts",
    "blocking_reasons", "warnings", "record_counts", "pagination_evidence",
    "read_attempt_count", "write_attempt_count", "mutation_attempt_count",
    "canonical_state_fingerprint", "export_fingerprint", "final_assessment",
  ];
  if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error("CONTROL_EXPORT_SCHEMA_INVALID: output must be an object");
  const allowed = new Set(required);
  for (const key of Object.keys(output)) if (!allowed.has(key)) throw new Error(`CONTROL_EXPORT_SCHEMA_INVALID: unexpected ${key}`);
  for (const key of required) if (!Object.hasOwn(output, key)) throw new Error(`CONTROL_EXPORT_SCHEMA_INVALID: missing ${key}`);
  if (output.schema_version !== SCHEMA_VERSION) throw new Error("CONTROL_EXPORT_SCHEMA_INVALID: unsupported schema version");
  if (!FINAL_ASSESSMENTS.includes(output.final_assessment)) throw new Error("CONTROL_EXPORT_SCHEMA_INVALID: invalid final assessment");
  for (const key of ["read_attempt_count", "write_attempt_count", "mutation_attempt_count"]) {
    if (!Number.isSafeInteger(output[key]) || output[key] < 0) throw new Error(`CONTROL_EXPORT_SCHEMA_INVALID: invalid ${key}`);
  }
  if (output.write_attempt_count !== 0 || output.mutation_attempt_count !== 0) throw new Error("CONTROL_EXPORT_MUTATION_ATTEMPT: output reports a forbidden attempt");
  return output;
}

module.exports = {
  ALLOWED_PROVIDER_METHODS,
  FINAL_ASSESSMENTS,
  PROHIBITED_OPERATIONS,
  SCHEMA_VERSION,
  SOURCE_NAMES,
  SOURCE_REGISTRY,
  assertOutputShape,
};
