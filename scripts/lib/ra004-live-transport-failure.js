const crypto = require("node:crypto");
const { normalizeFailureCode } = require("./ra004-safe-failure-code");

const SQLSTATE = /^[0-9A-Z]{5}$/;
const RCSE_PREFIX = /^(RCSE_[A-Z0-9_]+)(?::(?:\s|$)|$)/;
const PHASES = new Set(["CONNECT", "BEGIN", "RPC", "PROOF", "ROLLBACK", "CLOSE"]);
const RCSE_CODES = Object.freeze({
  RCSE_SOURCE_UNAVAILABLE: "CONTROL_EXPORT_SOURCE_UNAVAILABLE",
  RCSE_INVALID_REQUEST: "CONTROL_EXPORT_RPC_REQUEST_INVALID",
  RCSE_LIMIT_EXCEEDED: "CONTROL_EXPORT_RPC_LIMIT_EXCEEDED",
});

function phaseName(value) {
  const phase = String(value || "").toUpperCase();
  return PHASES.has(phase) ? phase : "RPC";
}

function reasonCode(error, phase) {
  const structured = normalizeFailureCode(error?.code);
  if (structured) return structured;
  const message = String(error?.message || "");
  const messageCode = message.match(/^((?:RA004|CONTROL_EXPORT)_[A-Z0-9_]+)(?::(?:\s|$)|$)/)?.[1];
  if (normalizeFailureCode(messageCode)) return messageCode;
  const rcse = message.match(RCSE_PREFIX)?.[1];
  if (rcse) return RCSE_CODES[rcse] || "CONTROL_EXPORT_RPC_REJECTED";
  const sqlstate = SQLSTATE.test(String(error?.code || "")) ? String(error.code) : null;
  if (sqlstate === "28P01" || sqlstate === "28000") return "RA004_LIVE_TRANSPORT_AUTH_REJECTED";
  if (phase === "RPC" && sqlstate === "42501") return "RA004_LIVE_TRANSPORT_RPC_PERMISSION_DENIED";
  if (phase === "RPC" && sqlstate === "42883") return "RA004_LIVE_TRANSPORT_RPC_UNDEFINED_FUNCTION";
  if (phase === "RPC" && sqlstate === "42P01") return "RA004_LIVE_TRANSPORT_RPC_UNDEFINED_RELATION";
  if (sqlstate === "57014") return `RA004_LIVE_TRANSPORT_${phase}_TIMEOUT`;
  return `RA004_LIVE_TRANSPORT_${phase}_FAILED`;
}

function normalizeTransportFailure(error, phaseValue) {
  const phase = phaseName(phaseValue);
  const code = reasonCode(error, phase);
  const sqlstate = SQLSTATE.test(String(error?.code || "")) ? String(error.code) : null;
  const diagnostic = { schema_version: "ra004-live-transport-failure-v1", phase, code, sqlstate };
  diagnostic.fingerprint = crypto.createHash("sha256")
    .update(JSON.stringify(diagnostic)).digest("hex");
  const safe = new Error(code);
  safe.code = code;
  safe.diagnostic = Object.freeze(diagnostic);
  return safe;
}

module.exports = { normalizeTransportFailure };
