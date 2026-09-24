const { hash } = require("../../retailer-snapshot/fingerprints");
const { PROHIBITED_OPERATIONS, SOURCE_NAMES } = require("./schema");

const OPERATION = "READ_ONLY_CONTROL_STATE_EXPORT";
const AUTH_VERSION = "control-state-export-authorization-v1";

function authorizationFingerprint(value) {
  const payload = { ...value };
  delete payload.authorization_fingerprint;
  return hash("RA:CONTROL-STATE-AUTHORIZATION:1", payload);
}

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function validateAuthorization(value, request, now) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("CONTROL_EXPORT_UNAUTHORIZED", "authorization file is required");
  const required = ["version", "status", "retailer_id", "retailer_name", "allowed_scope", "baseline_sha", "task_id", "valid_from", "expires_at", "operation", "prohibited_operations", "owner_consent", "authorization_fingerprint"];
  for (const key of required) if (!Object.hasOwn(value, key)) fail("CONTROL_EXPORT_UNAUTHORIZED", `authorization missing ${key}`);
  if (value.version !== AUTH_VERSION || value.operation !== OPERATION) fail("CONTROL_EXPORT_UNAUTHORIZED", "authorization version or operation mismatch");
  const fixtureAuthorized = request.provider_mode === "fixture" && value.status === "TEST_ONLY" && value.owner_consent === "TEST_ONLY_FIXTURE";
  const liveAuthorized = request.provider_mode === "live-read-only" && value.status === "AUTHORIZED" && value.owner_consent === "OWNER_APPROVED";
  if (!fixtureAuthorized && !liveAuthorized) fail("CONTROL_EXPORT_UNAUTHORIZED", "authorization status does not permit this provider mode");
  if (String(value.retailer_id) !== String(request.retailer_id) || value.retailer_name !== request.retailer_name) fail("CONTROL_EXPORT_UNAUTHORIZED", "retailer mismatch");
  if (value.baseline_sha !== request.baseline_sha || !/^[0-9a-f]{40}$/.test(value.baseline_sha)) fail("CONTROL_EXPORT_UNAUTHORIZED", "baseline mismatch");
  if (!Array.isArray(value.allowed_scope) || value.allowed_scope.length !== SOURCE_NAMES.length || SOURCE_NAMES.some((name) => !value.allowed_scope.includes(name))) fail("CONTROL_EXPORT_UNAUTHORIZED", "approved scope is incomplete or broader than the registry");
  if (!Array.isArray(value.prohibited_operations) || PROHIBITED_OPERATIONS.some((name) => !value.prohibited_operations.includes(name))) fail("CONTROL_EXPORT_UNAUTHORIZED", "prohibited operation contract is incomplete");
  const instant = new Date(now).getTime();
  const start = new Date(value.valid_from).getTime();
  const end = new Date(value.expires_at).getTime();
  if (![instant, start, end].every(Number.isFinite) || instant < start || instant >= end) fail("CONTROL_EXPORT_UNAUTHORIZED", "authorization is outside its validity window");
  const expected = authorizationFingerprint(value);
  if (!/^[0-9a-f]{64}$/.test(value.authorization_fingerprint) || value.authorization_fingerprint !== expected) fail("CONTROL_EXPORT_UNAUTHORIZED", "authorization fingerprint mismatch");
  return Object.freeze({ ...value, allowed_scope: Object.freeze([...value.allowed_scope]), prohibited_operations: Object.freeze([...value.prohibited_operations]) });
}

module.exports = { AUTH_VERSION, OPERATION, authorizationFingerprint, validateAuthorization };
