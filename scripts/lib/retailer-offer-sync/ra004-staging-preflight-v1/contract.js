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
const SAFE_PROJECT_REFERENCE = /^[a-z][a-z0-9-]{2,62}$/;
const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
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

function boundedString(value, code, label, minimum = 1, maximum = 256) {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) fail(code, `${label} length is invalid`);
  return value;
}

function safeInteger(value, code, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code, `${label} is outside the safe range`);
  return value;
}

function validateHost(host, code = "RA004_PREFLIGHT_TARGET_BLOCKED", label = "host") {
  boundedString(host, code, label, 4, 253);
  if (host !== host.toLowerCase() || host.endsWith(".") || !host.includes(".")
      || host.split(".").some((part) => !HOST_LABEL.test(part))
      || /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3})$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|home|lan)$/.test(host)) {
    fail(code, `${label} must be an explicit public DNS hostname`);
  }
  return host;
}

function validateTarget({ projectReference, canonicalHost, hostAllowlist }, code = "RA004_PREFLIGHT_TARGET_BLOCKED") {
  if (!SAFE_PROJECT_REFERENCE.test(String(projectReference))) fail(code, "project reference is invalid");
  validateHost(canonicalHost, code, "canonical host");
  if (!Array.isArray(hostAllowlist) || hostAllowlist.length < 1 || hostAllowlist.length > 4
      || new Set(hostAllowlist).size !== hostAllowlist.length) fail(code, "host allowlist is invalid");
  for (const host of hostAllowlist) validateHost(host, code, "allowlisted host");
  if (!hostAllowlist.includes(canonicalHost)) fail(code, "canonical host is outside the allowlist");
  const production = /(?:^|[._-])(?:prod|production)(?:[._-]|$)|aftboxmrdgyhizicfsfu/i;
  if (production.test(projectReference) || production.test(canonicalHost)) fail(code, "production target rejected");
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
  validateTarget({ projectReference: value.target.project_reference, canonicalHost: value.target.canonical_host, hostAllowlist: value.target.host_allowlist }, code);
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
      || credential.maximum_attempts !== 1 || !Number.isSafeInteger(credential.maximum_ttl_minutes)
      || credential.maximum_ttl_minutes < 1 || credential.maximum_ttl_minutes > 30
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
  validateTarget({ projectReference: value.project_reference, canonicalHost: value.canonical_host, hostAllowlist: [value.canonical_host] }, code);
  if (value.schema_version !== "ra-004-project-identity-v1" || value.environment_label !== "STAGING" || !SHA256.test(value.project_identity_fingerprint)
      || sha256({ ...value, project_identity_fingerprint: "0".repeat(64) }) !== value.project_identity_fingerprint) fail(code, "project identity mismatch");
  utc(value.observed_at, code, "project identity observed_at"); noSecrets(value, code); return value;
}

function sanitizeError(error) {
  const original = typeof error?.message === "string" ? error.message : String(error);
  const message = String(redact(original))
    .replace(/\b(?:authorization|cookie|set-cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]")
    .slice(0, 512);
  const safe = new Error(message || "RA004_PREFLIGHT_FAILED");
  safe.code = typeof error?.code === "string" && /^[A-Z0-9_]{3,80}$/.test(error.code) ? error.code : "RA004_PREFLIGHT_FAILED";
  return safe;
}

function validateEvidenceStore(value) {
  const code = "RA004_PREFLIGHT_EVIDENCE_STORE_INVALID";
  exact(value, ["schema_version", "store_identifier", "private", "encryption", "write_once", "access_audit", "readback_supported", "raw_retention_days", "derived_retention_days", "approved_by", "approved_at", "evidence_store_fingerprint"], code, "evidence store");
  if (value.schema_version !== "ra-004-evidence-store-metadata-v1" || value.private !== true || value.encryption !== "AT_REST_AND_IN_TRANSIT"
      || value.write_once !== true || value.access_audit !== true || value.readback_supported !== true
      || value.raw_retention_days !== 90 || value.derived_retention_days !== 90 || !SAFE_NAME.test(value.approved_by)
      || !SAFE_NAME.test(value.store_identifier) || !SHA256.test(value.evidence_store_fingerprint)
      || sha256({ ...value, evidence_store_fingerprint: "0".repeat(64) }) !== value.evidence_store_fingerprint) fail(code, "evidence store is not approved and private");
  utc(value.approved_at, code, "evidence store approved_at"); noSecrets(value, code); return value;
}

const EXPECTED_OBJECTS = new Set([
  "public.retailers:TABLE", "supabase_migrations.schema_migrations:TABLE",
  "public.retailer_control_state_evidence_v1:TABLE",
  "public.read_retailer_control_state_v1:FUNCTION",
  "public.write_retailer_control_state_evidence_v1:FUNCTION",
  "public.read_ra004_staging_preflight_v1:FUNCTION",
]);
const EXPECTED_FUNCTIONS = new Map([
  ["public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)", ["retailer_control_state_read_owner", "s"]],
  ["public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)", ["retailer_control_state_evidence_owner", "v"]],
  [RPC_SIGNATURE, ["ra004_staging_preflight_owner", "s"]],
]);
const EXPECTED_POLICIES = new Map([
  ["retailer_control_state_evidence_owner_insert_v1", ["retailer_control_state_evidence_v1", "retailer_control_state_evidence_owner", true, true, "a", "retailer_control_state_evidence_owner", null, "true"]],
  ["retailer_control_state_evidence_owner_select_v1", ["retailer_control_state_evidence_v1", "retailer_control_state_evidence_owner", true, true, "r", "retailer_control_state_evidence_owner", "true", null]],
  ["retailer_control_state_read_owner_select_v1", ["retailer_control_state_evidence_v1", "retailer_control_state_evidence_owner", true, true, "r", "retailer_control_state_read_owner", "true", null]],
  ["ra004_staging_preflight_retailer_read_v1", ["retailers", "postgres", true, false, "r", "ra004_staging_preflight_owner", "((lower(name) = '10 reps'::text) OR (lower(slug) = '10-reps'::text))", null]],
]);

function validateMetadata(value, expectedSessionUser) {
  const code = "RA004_PREFLIGHT_METADATA_INVALID";
  exact(value, ["schema_version", "q2_retailer", "q3_migration_ledger", "q4_objects", "q5_functions", "q6_roles", "q7_acl_rls", "snapshot", "metadata_fingerprint"], code, "metadata output");
  if (value.schema_version !== "ra-004-staging-preflight-metadata-v1" || !SHA256.test(value.metadata_fingerprint)) fail(code, "metadata version or fingerprint mismatch");
  exact(value.q2_retailer, ["id", "name", "slug", "match_count"], code, "Q2");
  exact(value.q3_migration_ledger, ["target_version", "target_name", "target_match_count", "ordered_ledger_count", "ordered_ledger_fingerprint"], code, "Q3");
  exact(value.snapshot, ["isolation", "metadata_only", "retailer_rows_read", "business_rows_read"], code, "snapshot");
  boundedString(value.q2_retailer.id, code, "Q2 retailer id", 1, 64);
  if (value.q2_retailer.name !== "10 Reps" || value.q2_retailer.slug !== "10-reps" || value.q2_retailer.match_count !== 1
      || value.q3_migration_ledger.target_version !== "20260924100000"
      || value.q3_migration_ledger.target_name !== "add_transactional_retailer_control_state_interface"
      || value.q3_migration_ledger.target_match_count !== 1 || !SHA256.test(value.q3_migration_ledger.ordered_ledger_fingerprint)
      || value.snapshot.isolation !== "ONE_POSTGRESQL_STATEMENT" || value.snapshot.metadata_only !== true
      || value.snapshot.retailer_rows_read !== 1 || value.snapshot.business_rows_read !== 0) fail(code, "metadata is not a one-retailer metadata-only snapshot");
  safeInteger(value.q3_migration_ledger.ordered_ledger_count, code, "ordered ledger count", 1, 10000);
  for (const [key, cap] of [["q4_objects",32],["q5_functions",8],["q6_roles",24],["q7_acl_rls",64]]) if (!Array.isArray(value[key]) || value[key].length < 1 || value[key].length > cap) fail(code, `${key} cap violated`);
  const objectKeys = new Set();
  for (const item of value.q4_objects) {
    exact(item, ["object_schema","object_name","object_kind","exists","expected_state"], code, "Q4 object");
    boundedString(item.object_schema, code, "Q4 schema", 1, 63); boundedString(item.object_name, code, "Q4 object name", 1, 128);
    if (!['TABLE','FUNCTION'].includes(item.object_kind) || item.exists !== true || item.expected_state !== "PRESENT") fail(code, "Q4 object contract mismatch");
    const key = `${item.object_schema}.${item.object_name}:${item.object_kind}`; if (objectKeys.has(key)) fail(code, "Q4 duplicate object"); objectKeys.add(key);
  }
  if (objectKeys.size !== EXPECTED_OBJECTS.size || [...EXPECTED_OBJECTS].some((key) => !objectKeys.has(key))) fail(code, "Q4 closed registry mismatch");
  const functionKeys = new Set();
  for (const item of value.q5_functions) {
    exact(item, ["schema","signature","owner","security_definer","volatility","search_path","definition_sha256"], code, "Q5 function");
    boundedString(item.signature, code, "Q5 signature", 1, 512); boundedString(item.owner, code, "Q5 owner", 1, 63);
    const expected = EXPECTED_FUNCTIONS.get(item.signature);
    if (item.schema !== "public" || !expected || item.owner !== expected[0] || item.security_definer !== true
        || item.volatility !== expected[1] || !Array.isArray(item.search_path) || item.search_path.length !== 1
        || item.search_path[0] !== "search_path=pg_catalog" || !SHA256.test(item.definition_sha256)
        || functionKeys.has(item.signature)) fail(code, "Q5 function contract mismatch");
    functionKeys.add(item.signature);
  }
  if (functionKeys.size !== EXPECTED_FUNCTIONS.size) fail(code, "Q5 closed registry mismatch");
  let loginCount = 0, observedLogin; const roleKeys = new Set(); const seenRoles = new Set();
  for (const item of value.q6_roles) {
    exact(item, ["role_name","rolsuper","rolinherit","rolcreaterole","rolcreatedb","rolcanlogin","rolreplication","rolbypassrls","membership_role","set_option","admin_option"], code, "Q6 role");
    boundedString(item.role_name, code, "Q6 role name", 1, 63);
    for (const field of ["rolsuper","rolinherit","rolcreaterole","rolcreatedb","rolcanlogin","rolreplication","rolbypassrls"]) if (typeof item[field] !== "boolean") fail(code, "Q6 role attribute type mismatch");
    if (item.membership_role !== null || item.set_option !== null || item.admin_option !== null) fail(code, "Q6 unexpected membership");
    const key = `${item.role_name}:<none>`; if (roleKeys.has(key)) fail(code, "Q6 duplicate role"); roleKeys.add(key); seenRoles.add(item.role_name);
    if (item.role_name === "ra004_staging_preflight_owner" || item.role_name === "ra004_staging_preflight_caller" || item.role_name === expectedSessionUser) {
      if (item.rolsuper || item.rolinherit || item.rolcreaterole || item.rolcreatedb || item.rolreplication || item.rolbypassrls) fail(code, "Q6 unsafe role attribute");
    }
    if (item.rolcanlogin) { loginCount += 1; observedLogin = item.role_name; if (expectedSessionUser && item.role_name !== expectedSessionUser) fail(code, "Q6 unexpected login role"); }
  }
  if (!seenRoles.has("ra004_staging_preflight_owner") || !seenRoles.has("ra004_staging_preflight_caller") || loginCount !== 1
      || (expectedSessionUser && !seenRoles.has(expectedSessionUser))) fail(code, "Q6 required role inventory mismatch");
  const policyKeys = new Set(); const functionGrants = new Set(); const aclKeys = new Set();
  for (const item of value.q7_acl_rls) {
    exact(item, ["object_schema","object_name","owner","rls_enabled","rls_forced","policy_name","policy_command","policy_roles","policy_using","policy_with_check","grantee","privilege_type"], code, "Q7 ACL row");
    for (const [field, max] of [["object_schema",63],["object_name",128],["owner",63]]) boundedString(item[field], code, `Q7 ${field}`, 1, max);
    if (typeof item.rls_enabled !== "boolean" || typeof item.rls_forced !== "boolean") fail(code, "Q7 RLS flag type mismatch");
    const key = JSON.stringify(item); if (aclKeys.has(key)) fail(code, "Q7 duplicate row"); aclKeys.add(key);
    if (item.policy_name !== null) {
      boundedString(item.policy_name, code, "Q7 policy name", 1, 128);
      const expected = EXPECTED_POLICIES.get(item.policy_name);
      if (!expected || item.object_schema !== "public" || item.object_name !== expected[0] || item.owner !== expected[1]
          || item.rls_enabled !== expected[2] || item.rls_forced !== expected[3] || item.policy_command !== expected[4]
          || !Array.isArray(item.policy_roles) || item.policy_roles.length !== 1 || item.policy_roles[0] !== expected[5]
          || item.policy_using !== expected[6] || item.policy_with_check !== expected[7]
          || (item.policy_using !== null && (typeof item.policy_using !== "string" || item.policy_using.length > 512))
          || (item.policy_with_check !== null && (typeof item.policy_with_check !== "string" || item.policy_with_check.length > 512))) fail(code, "Q7 policy contract mismatch");
      policyKeys.add(item.policy_name);
    } else if (item.object_name === "read_ra004_staging_preflight_v1") {
      if (item.object_schema !== "public" || item.owner !== "ra004_staging_preflight_owner" || item.rls_enabled || item.rls_forced
          || item.policy_command !== null || item.policy_roles !== null || item.policy_using !== null || item.policy_with_check !== null
          || !['ra004_staging_preflight_owner','ra004_staging_preflight_caller',observedLogin].includes(item.grantee)
          || item.privilege_type !== "EXECUTE") fail(code, "Q7 function grant mismatch");
      functionGrants.add(item.grantee);
    } else fail(code, "Q7 unknown ACL row");
  }
  if (policyKeys.size !== EXPECTED_POLICIES.size || functionGrants.size !== 3) fail(code, "Q7 closed registry mismatch");
  const unhashed = { ...value, metadata_fingerprint: "0".repeat(64) };
  if (sha256(postgresJsonbText(unhashed)) !== value.metadata_fingerprint) fail(code, "metadata fingerprint mismatch");
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 131072) fail(code, "metadata byte cap violated");
  noSecrets(value, code); return value;
}

function validateCounters(counters, code = "RA004_PREFLIGHT_SCHEMA_INVALID") {
  exact(counters, ["project_identity", "evidence_store", "connection", "metadata_rpc", "revoke", "close", "retry", "prohibited"], code, "capability counters");
  for (const [name, counter] of Object.entries(counters)) {
    exact(counter, ["attempt_count", "performed_count", "denied_count"], code, `counter ${name}`);
    if (![counter.attempt_count, counter.performed_count, counter.denied_count].every((number) => Number.isSafeInteger(number) && number >= 0 && number <= 1)
        || counter.attempt_count !== counter.performed_count + counter.denied_count) fail(code, `counter ${name} is invalid`);
  }
  return counters;
}

function validateReport(value) {
  const code = "RA004_PREFLIGHT_REPORT_INVALID";
  exact(value, ["schema_version", "status", "task_id", "baseline_sha", "authorization_fingerprint", "decision_fingerprint", "plan_fingerprint", "project_identity", "evidence_store", "metadata", "capability_counters", "completed_at", "report_fingerprint"], code, "report");
  if (value.schema_version !== "ra-004-staging-preflight-report-v1" || value.status !== "METADATA_CAPTURED_PENDING_REVOKE" || value.task_id !== "RA-004" || !COMMIT.test(value.baseline_sha)) fail(code, "report identity mismatch");
  for (const key of ["authorization_fingerprint","decision_fingerprint","plan_fingerprint","report_fingerprint"]) if (!SHA256.test(value[key])) fail(code, `${key} invalid`);
  if (sha256({ ...value, report_fingerprint: "0".repeat(64) }) !== value.report_fingerprint) fail(code, "report fingerprint mismatch");
  validateProjectIdentity(value.project_identity); validateEvidenceStore(value.evidence_store); validateMetadata(value.metadata); validateCounters(value.capability_counters, code); utc(value.completed_at, code, "completed_at");
  for (const name of ["project_identity","evidence_store","connection","metadata_rpc"]) if (value.capability_counters[name].attempt_count !== 1 || value.capability_counters[name].performed_count !== 1) fail(code, "report capability counters mismatch");
  for (const name of ["revoke","close","retry","prohibited"]) if (value.capability_counters[name].attempt_count !== 0) fail(code, "report contains premature or prohibited capability counters");
  noSecrets(value, code); return value;
}

function validateRevokeReceipt(value) {
  const code = "RA004_PREFLIGHT_REVOKE_INVALID";
  exact(value, ["schema_version", "status", "revoked_at", "access_revoked", "connection_closed", "capability_counters", "report_fingerprint", "receipt_fingerprint"], code, "revoke receipt");
  if (value.schema_version !== "ra-004-staging-preflight-revoke-receipt-v1" || value.status !== "REVOKED_AND_CLOSED" || !value.access_revoked || !value.connection_closed) fail(code, "revoke proof missing");
  utc(value.revoked_at, code, "revoked_at"); validateCounters(value.capability_counters, code);
  if (![value.report_fingerprint,value.receipt_fingerprint].every((item) => SHA256.test(item))) fail(code, "receipt fingerprint invalid");
  if (sha256({ ...value, receipt_fingerprint: "0".repeat(64) }) !== value.receipt_fingerprint) fail(code, "receipt fingerprint mismatch");
  for (const name of ["project_identity","evidence_store","connection","metadata_rpc","revoke","close"]) if (value.capability_counters[name].attempt_count !== 1 || value.capability_counters[name].performed_count !== 1) fail(code, "receipt capability counters mismatch");
  for (const name of ["retry","prohibited"]) if (value.capability_counters[name].attempt_count !== 0) fail(code, "receipt contains prohibited capability counters");
  noSecrets(value, code); return value;
}

function fileSha(relativePath) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, relativePath))).digest("hex"); }

module.exports = {
  COMMIT, CONTROL_MIGRATION, CURRENT_DECISION_FINGERPRINT, FORBIDDEN_ROLES,
  PREFLIGHT_MIGRATION, ROOT, RPC_NAME, RPC_SIGNATURE, SHA256, UTC, VERSION,
  authorizationFingerprint, boundedString, exact, fail, fileSha, noSecrets, postgresJsonbText, redact,
  safeInteger, sanitizeError, validateHost, validateTarget,
  validateAuthorization, validateCounters, validateEvidenceStore, validateMetadata,
  validateProjectIdentity, validateReport, validateRevokeReceipt,
};
