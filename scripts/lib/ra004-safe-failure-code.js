const SAFE_FAILURE_CODE = /^(?:RA004|CONTROL_EXPORT)_[A-Z0-9_]+$/;
const SAFE_MESSAGE_PREFIX = /^((?:RA004|CONTROL_EXPORT)_[A-Z0-9_]+)(?::(?:\s|$)|$)/;

function normalizeFailureCode(value) {
  const candidate = String(value || "");
  return SAFE_FAILURE_CODE.test(candidate) ? candidate : null;
}

function safeFailureCode(error) {
  const structured = normalizeFailureCode(error?.code);
  if (structured) return structured;
  const messageCode = String(error?.message || "").match(SAFE_MESSAGE_PREFIX)?.[1] || null;
  return normalizeFailureCode(messageCode) || "RA004_UNCLASSIFIED_FAILURE";
}

module.exports = { normalizeFailureCode, safeFailureCode };
