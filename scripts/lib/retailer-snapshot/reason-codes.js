const frozen = require("./contracts/reason-codes.json");
const { APPROVAL_LEVELS, PRIMARY_STATUSES } = require("./schemas");
const { fail } = require("./errors");

const SEVERITIES = Object.freeze([...frozen.severity_enum]);
const REASON_CODES = Object.freeze(frozen.codes.map((entry) => Object.freeze({ ...entry, required_evidence: Object.freeze([...entry.required_evidence]) })));
const REASON_CODE_ENUM = Object.freeze(REASON_CODES.map(({ code }) => code));
const REASON_CODE_BY_CODE = new Map(REASON_CODES.map((entry) => [entry.code, entry]));

function validateRegistry() {
  if (REASON_CODES.length !== 64 || new Set(REASON_CODE_ENUM).size !== 64) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "Reason registry must contain exactly 64 unique codes");
  for (const entry of REASON_CODES) {
    if (!PRIMARY_STATUSES.includes(entry.default_primary_status)) fail("RSBI_UNSUPPORTED_CLASSIFICATION", `Unknown default status for ${entry.code}`);
    if (!APPROVAL_LEVELS.includes(entry.default_approval_level)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown approval for ${entry.code}`);
    if (!SEVERITIES.includes(entry.severity)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown severity for ${entry.code}`);
    if (!entry.category || !entry.message || !entry.remediation || !Array.isArray(entry.required_evidence)) fail("RSBI_MISSING_REQUIRED_EVIDENCE", `Incomplete reason definition ${entry.code}`);
  }
  return true;
}

function getReason(code) {
  return REASON_CODE_BY_CODE.get(code) || fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown reason code ${code}`);
}

validateRegistry();
module.exports = { REASON_CODES, REASON_CODE_BY_CODE, REASON_CODE_ENUM, SEVERITIES, getReason, validateRegistry };
