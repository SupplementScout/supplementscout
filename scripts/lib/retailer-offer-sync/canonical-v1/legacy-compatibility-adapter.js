const matrix = require("../../../test-fixtures/retailer-canonical-v1/legacy-compatibility-matrix.json");
const { deepFreeze } = require("./contract");
const { getReason } = require("./taxonomy");

function fail(code, message, detail = {}) {
  const error = new Error(message);
  error.code = code;
  error.detail = detail;
  throw error;
}

function validateMatrix(input = matrix) {
  if (input.schema_version !== 1 || input.canonical_taxonomy_version !== "v1") fail("LEGACY_MATRIX_INVALID", "Unsupported compatibility matrix version");
  const ids = new Set();
  const keys = new Set();
  for (const mapping of input.mappings || []) {
    const key = `${mapping.context_type}\u0000${mapping.legacy_status}`;
    if (!mapping.mapping_id || ids.has(mapping.mapping_id) || keys.has(key)) fail("LEGACY_MATRIX_CONFLICT", `Conflicting compatibility mapping ${key}`);
    ids.add(mapping.mapping_id);
    keys.add(key);
    if (!input.compatibility_states.includes(mapping.compatibility_state)) fail("LEGACY_MATRIX_INVALID", `Invalid compatibility state ${mapping.compatibility_state}`);
    const profiles = mapping.profiles_by_context ? Object.values(mapping.profiles_by_context.values) : [mapping.profile];
    for (const profileName of profiles) {
      const profile = input.profiles[profileName];
      if (!profile) fail("LEGACY_MATRIX_INVALID", `Unknown canonical profile ${profileName}`);
      getReason(profile.reason_code);
    }
  }
  return true;
}

function requiredContext(mapping, context) {
  return (mapping.required_context || []).filter((field) => context[field] === undefined || context[field] === null || context[field] === "");
}

function resolveProfile(mapping, context, input) {
  if (!mapping.profiles_by_context) return input.profiles[mapping.profile];
  const { field, values } = mapping.profiles_by_context;
  const profileName = values[context[field]];
  if (!profileName) fail("LEGACY_STATUS_CONTEXT_INVALID", `Unsupported ${field} for ${mapping.legacy_status}`, { field, value: context[field], allowed: Object.keys(values) });
  return input.profiles[profileName];
}

function mapLegacyStatus(legacyStatus, context = {}, input = matrix) {
  validateMatrix(input);
  if (typeof legacyStatus !== "string" || !legacyStatus) fail("LEGACY_STATUS_INVALID", "Legacy status must be a non-empty string");
  if (typeof context.context_type !== "string" || !context.context_type) fail("LEGACY_STATUS_CONTEXT_REQUIRED", "context_type is required");
  const mapping = input.mappings.find((entry) => entry.legacy_status === legacyStatus && entry.context_type === context.context_type);
  if (!mapping) fail("LEGACY_STATUS_UNKNOWN", `Unknown legacy status ${legacyStatus} for ${context.context_type}`);
  const missing = requiredContext(mapping, context);
  if (missing.length) fail("LEGACY_STATUS_CONTEXT_REQUIRED", `Missing context for ${legacyStatus}`, { missing });
  if (mapping.compatibility_state === "AMBIGUOUS_BLOCKED") fail("LEGACY_STATUS_AMBIGUOUS", `Legacy status ${legacyStatus} cannot be mapped safely`, { mapping_id: mapping.mapping_id, evidence_needed: mapping.evidence_needed });
  const canonical = resolveProfile(mapping, context, input);
  return deepFreeze({
    matrix_id: input.matrix_id,
    mapping_id: mapping.mapping_id,
    legacy_status: mapping.legacy_status,
    context_type: mapping.context_type,
    compatibility_state: mapping.compatibility_state,
    canonical: { ...canonical },
    reason: { ...getReason(canonical.reason_code) },
  });
}

validateMatrix();

module.exports = { mapLegacyStatus, matrix, validateMatrix };
