const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { sha256 } = require("../../stable-json-hash");
const { redact } = require("../control-state-export-v1/exporter");

const ROOT = path.resolve(__dirname, "../../../..");
const VERSION = "ra-004-staging-preflight-v1";
const RPC_NAME = "public.read_ra004_staging_preflight_v1";
const RPC_SIGNATURE = `${RPC_NAME}(text,text,text,integer,text,text,integer)`;
const CURRENT_DECISION_FINGERPRINT = "b0cb6c6de75eace4e7d4d8705305eb90e6a975203438f23de7b745974e4ffdb8";
const CONTROL_MIGRATION = "supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql";
const PREFLIGHT_MIGRATION = "supabase/migrations/20260925100000_add_ra004_staging_preflight_metadata_interface.sql";
const FORBIDDEN_ROLES = Object.freeze([
  "service_role", "validator", "approver", "executor", "exporter",
  "retailer_catalogue_staging_validator", "retailer_catalogue_staging_approver",
  "retailer_catalogue_staging_executor", "retailer_catalogue_production_validator",
  "retailer_catalogue_production_approver", "retailer_catalogue_production_executor",
  "retailer_control_state_exporter",
]);
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9._:@/-]{1,127}$/;
const SECRET_KEY = /(?:secret|token|password|credential_value|connection_string|authorization_header|cookie|database_url|service_role_key)/i;
const SECRET_VALUE = /(?:postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._~+/-]{8,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function object(value, code, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, `${label} must be an object`);
  return value;
}

function exact(value, keys, code, label) {
  object(value, code, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("|") !== expected.join("|")) fail(code, `${label} fields are not closed`);
}

function utc(value, code, label) {
  if (!UTC.test(String(value)) || !Number.isFinite(Date.parse(value))) fail(code, `${label} must be UTC`);
}

function noSecrets(value, code = "RA004_PREFLIGHT_SCHEMA_INVALID", at = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => noSecrets(item, code, `${at}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) fail(code, `secret-shaped field at ${at}.${key}`);
      noSecrets(child, code, `${at}.${key}`);
    }
  } else if (typeof value === "string" && SECRET_VALUE.test(value)) fail(code, `secret-shaped value at ${at}`);
}

function authorizationFingerprint(value) {
  const payload = { ...value };
  delete payload.authorization_fingerprint;
  return sha256(payload);
}

function postgresJsonbText(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(postgresJsonbText).join(", ")}]`;
  const keys = Object.keys(value).sort((left, right) => Buffer.byteLength(left) - Buffer.byteLength(right) || Buffer.compare(Buffer.from(left), Buffer.from(right)));
  return `{${keys.map((key) => `${JSON.stringify(key)}: ${postgresJsonbText(value[key])}`).join(", ")}}`;
}

function validateAuthorization(value, expected, now) {
  const code = "RA004_PREFLIGHT_UNAUTHORIZED";
  exact(value, [
    "schema_version", "status", "task_id", "baseline_sha", "decision_fingerprint",
    "plan_fingerprint", "control_migration", "preflight_migration", "target", "operator",
    "credential_issuer", "window", "credential_design", "evidence_store", "authorization_fingerprint",
  ], code, "authorization");
  if (value.schema_version !== "ra-004-staging-preflight-authorization-execution-v1"
      || !["AUTHORIZED", "TEST_ONLY_AUTHORIZED"].includes(value.status)
      || value.task_id !== "RA-004") fail(code, "execution authorization is absent");
  if (value.status === "TEST_ONLY_AUTHORIZED" && expected.provider_mode !== "fixture") fail(code, "test authorization cannot open a live provider");
  if (value.status === "AUTHORIZED" && expected.provider_mode !== "live-read-only") fail(code, "live authorization requires the closed live provider");
  if (!COMMIT.test(value.baseline_sha) || value.baseline_sha !== expected.baseline_sha) fail(code, "baseline mismatch");
  if (!SHA256.test(value.decision_fingerprint) || value.decision_fingerprint !== expected.decision_fingerprint) fail(code, "decision fingerprint mismatch");
  if (!SHA256.test(value.plan_fingerprint) || value.plan_fingerprint !== expected.plan_fingerprint) fail(code, "plan fingerprint mismatch");
  for (const [key, wanted] of [["control_migration", expected.control_migration], ["preflight_migration", expected.preflight_migration]]) {
    exact(value[key], ["path", "sha256"], code, key);
    if (value[key].path !== wanted.path || !SHA256.test(value[key].sha256) || value[key].sha256 !== wanted.sha256) fail(code, `${key} SHA mismatch`);
  }
  exact(value.target, ["environment", "project_reference", "canonical_host", "host_allowlist", "retailer", "ledger"], code, "target");
  exact(value.target.retailer, ["name", "slug"], code, "target retailer");
  exact(value.target.ledger, ["count", "fingerprint"], code, "target ledger");
  if (value.target.environment !== "STAGING" || value.target.retailer.name !== "10 Reps" || value.target.retailer.slug !== "10-reps") fail(code, "one exact staging retailer is required");
  if (!SAFE_NAME.test(value.target.project_reference) || !Array.isArray(value.target.host_allowlist)
      || value.target.host_allowlist.length < 1 || value.target.host_allowlist.length > 4
      || !value.target.host_allowlist.every((host) => typeof host === "string" && host === host.toLowerCase() && /^[a-z0-9.-]+$/.test(host))
      || !value.target.host_allowlist.includes(value.target.canonical_host)) fail(code, "project and host allowlist are required");
  if (/(?:^|[._-])(prod|production)(?:[._-]|$)|aftboxmrdgyhizicfsfu/i.test(`${value.target.project_reference} ${value.target.canonical_host}`)) fail(code, "production target rejected");
  if (value.target.project_reference !== expected.project_reference || value.target.canonical_host !== expected.canonical_host
      || !expected.host_allowlist.includes(value.target.canonical_host)) fail(code, "unknown target rejected");
  if (!Number.isSafeInteger(value.target.ledger.count) || value.target.ledger.count < 1 || value.target.ledger.count > 10000
      || !SHA256.test(value.target.ledger.fingerprint)) fail(code, "ledger expectation is invalid");
  if (!SAFE_NAME.test(value.operator) || !SAFE_NAME.test(value.credential_issuer) || value.operator === value.credential_issuer) fail(code, "named separated operator and issuer are required");
  exact(value.window, ["starts_at", "expires_at"], code, "window");
  utc(value.window.starts_at, code, "window start"); utc(value.window.expires_at, code, "window end"); utc(now, code, "current time");
  const start = Date.parse(value.window.starts_at), end = Date.parse(value.window.expires_at), instant = Date.parse(now);
  if (end <= start || end - start > 30 * 60 * 1000 || instant < start || instant >= end) fail(code, "authorization window is invalid or expired");
  exact(value.credential_design, [
    "role_name", "environment", "rpc_name", "maximum_attempts", "maximum_ttl_minutes",
    "automatic_retry", "service_role", "table_privileges", "sequence_privileges", "dml", "ddl", "mutation_rpc",
  ], code, "credential design");
  const credential = value.credential_design;
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(credential.role_name)
      || FORBIDDEN_ROLES.some((name) => credential.role_name === name || credential.role_name.includes(name))
      || credential.environment !== "STAGING_ONLY" || credential.rpc_name !== RPC_NAME
      || credential.maximum_attempts !== 1 || credential.maximum_ttl_minutes > 30
      || credential.automatic_retry !== false || credential.service_role !== false
      || credential.table_privileges !== false || credential.sequence_privileges !== false
      || credential.dml !== false || credential.ddl !== false || credential.mutation_rpc !== false) fail(code, "credential is broader than the closed design");
  exact(value.evidence_store, ["store_identifier", "required_private", "required_encryption", "required_write_once", "required_access_audit", "required_readback", "raw_retention_days", "derived_retention_days"], code, "evidence store expectation");
  if (!SAFE_NAME.test(value.evidence_store.store_identifier) || !value.evidence_store.required_private
      || !value.evidence_store.required_encryption || !value.evidence_store.required_write_once
      || !value.evidence_store.required_access_audit || !value.evidence_store.required_readback
      || value.evidence_store.raw_retention_days !== 90 || value.evidence_store.derived_retention_days !== 90) fail(code, "evidence store contract is absent");
  if (!SHA256.test(value.authorization_fingerprint) || value.authorization_fingerprint !== authorizationFingerprint(value)) fail(code, "authorization fingerprint mismatch");
  noSecrets(value, code);
  return Object.freeze(structuredClone(value));
}

function validateProjectIdentity(value) {
  const code = "RA004_PREFLIGHT_PROJECT_IDENTITY_INVALID";
  exact(value, ["schema_version", "project_reference", "canonical_host", "environment_label", "project_identity_fingerprint", "observed_at"], code, "project identity");
  if (value.schema_version !== "ra-004-project-identity-v1" || value.environment_label !== "STAGING" || !SHA256.test(value.project_identity_fingerprint)) fail(code, "project identity mismatch");
  utc(value.observed_at, code, "project identity observed_at"); noSecrets(value, code); return value;
}

function validateEvidenceStore(value) {
  const code = "RA004_PREFLIGHT_EVIDENCE_STORE_INVALID";
  exact(value, ["schema_version", "store_identifier", "private", "encryption", "write_once", "access_audit", "readback_supported", "raw_retention_days", "derived_retention_days", "approved_by", "approved_at"], code, "evidence store");
  if (value.schema_version !== "ra-004-evidence-store-metadata-v1" || value.private !== true || value.encryption !== "AT_REST_AND_IN_TRANSIT"
      || value.write_once !== true || value.access_audit !== true || value.readback_supported !== true
      || value.raw_retention_days !== 90 || value.derived_retention_days !== 90 || !SAFE_NAME.test(value.approved_by)) fail(code, "evidence store is not approved and private");
  utc(value.approved_at, code, "evidence store approved_at"); noSecrets(value, code); return value;
}

function validateMetadata(value) {
  const code = "RA004_PREFLIGHT_METADATA_INVALID";
  exact(value, ["schema_version", "q2_retailer", "q3_migration_ledger", "q4_objects", "q5_functions", "q6_roles", "q7_acl_rls", "snapshot", "metadata_fingerprint"], code, "metadata output");
  if (value.schema_version !== "ra-004-staging-preflight-metadata-v1" || !SHA256.test(value.metadata_fingerprint)) fail(code, "metadata version or fingerprint mismatch");
  exact(value.q2_retailer, ["id", "name", "slug", "match_count"], code, "Q2");
  exact(value.q3_migration_ledger, ["target_version", "target_name", "target_match_count", "ordered_ledger_count", "ordered_ledger_fingerprint"], code, "Q3");
  exact(value.snapshot, ["isolation", "metadata_only", "retailer_rows_read", "business_rows_read"], code, "snapshot");
  if (value.q2_retailer.name !== "10 Reps" || value.q2_retailer.slug !== "10-reps" || value.q2_retailer.match_count !== 1
      || value.q3_migration_ledger.target_match_count !== 1 || !SHA256.test(value.q3_migration_ledger.ordered_ledger_fingerprint)
      || value.snapshot.isolation !== "ONE_POSTGRESQL_STATEMENT" || value.snapshot.metadata_only !== true
      || value.snapshot.retailer_rows_read !== 1 || value.snapshot.business_rows_read !== 0) fail(code, "metadata is not a one-retailer metadata-only snapshot");
  for (const [key, cap] of [["q4_objects",32],["q5_functions",8],["q6_roles",24],["q7_acl_rls",64]]) if (!Array.isArray(value[key]) || value[key].length < 1 || value[key].length > cap) fail(code, `${key} cap violated`);
  const unhashed = { ...value, metadata_fingerprint: "0".repeat(64) };
  if (sha256(postgresJsonbText(unhashed)) !== value.metadata_fingerprint) fail(code, "metadata fingerprint mismatch");
  noSecrets(value, code); return value;
}

function validateCounters(counters, code = "RA004_PREFLIGHT_SCHEMA_INVALID") {
  exact(counters, ["project_identity", "evidence_store", "connection", "metadata_rpc", "revoke", "close", "retry", "prohibited"], code, "capability counters");
  for (const [name, counter] of Object.entries(counters)) {
    exact(counter, ["attempt_count", "performed_count", "denied_count"], code, `counter ${name}`);
    if (![counter.attempt_count, counter.performed_count, counter.denied_count].every((number) => Number.isSafeInteger(number) && number >= 0)) fail(code, `counter ${name} is invalid`);
  }
  return counters;
}

function validateReport(value) {
  const code = "RA004_PREFLIGHT_REPORT_INVALID";
  exact(value, ["schema_version", "status", "task_id", "baseline_sha", "authorization_fingerprint", "decision_fingerprint", "plan_fingerprint", "project_identity", "evidence_store", "metadata", "capability_counters", "completed_at", "report_fingerprint"], code, "report");
  if (value.schema_version !== "ra-004-staging-preflight-report-v1" || value.status !== "PASS_METADATA_ONLY" || value.task_id !== "RA-004" || !COMMIT.test(value.baseline_sha)) fail(code, "report identity mismatch");
  for (const key of ["authorization_fingerprint","decision_fingerprint","plan_fingerprint","report_fingerprint"]) if (!SHA256.test(value[key])) fail(code, `${key} invalid`);
  if (sha256({ ...value, report_fingerprint: "0".repeat(64) }) !== value.report_fingerprint) fail(code, "report fingerprint mismatch");
  validateProjectIdentity(value.project_identity); validateEvidenceStore(value.evidence_store); validateMetadata(value.metadata); validateCounters(value.capability_counters, code); utc(value.completed_at, code, "completed_at"); noSecrets(value, code); return value;
}

function validateRevokeReceipt(value) {
  const code = "RA004_PREFLIGHT_REVOKE_INVALID";
  exact(value, ["schema_version", "status", "revoked_at", "access_revoked", "connection_closed", "capability_counters", "report_fingerprint", "receipt_fingerprint"], code, "revoke receipt");
  if (value.schema_version !== "ra-004-staging-preflight-revoke-receipt-v1" || value.status !== "REVOKED_AND_CLOSED" || !value.access_revoked || !value.connection_closed) fail(code, "revoke proof missing");
  utc(value.revoked_at, code, "revoked_at"); validateCounters(value.capability_counters, code);
  if (![value.report_fingerprint,value.receipt_fingerprint].every((item) => SHA256.test(item))) fail(code, "receipt fingerprint invalid");
  if (sha256({ ...value, receipt_fingerprint: "0".repeat(64) }) !== value.receipt_fingerprint) fail(code, "receipt fingerprint mismatch");
  noSecrets(value, code); return value;
}

function fileSha(relativePath) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relativePath))).digest("hex"); }

module.exports = {
  COMMIT, CONTROL_MIGRATION, CURRENT_DECISION_FINGERPRINT, FORBIDDEN_ROLES,
  PREFLIGHT_MIGRATION, ROOT, RPC_NAME, RPC_SIGNATURE, SHA256, UTC, VERSION,
  authorizationFingerprint, exact, fail, fileSha, noSecrets, postgresJsonbText, redact,
  validateAuthorization, validateCounters, validateEvidenceStore, validateMetadata,
  validateProjectIdentity, validateReport, validateRevokeReceipt,
};
