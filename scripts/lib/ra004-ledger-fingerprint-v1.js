const crypto = require("node:crypto");
const { canonical } = require("./stable-json-hash");

const CONTRACT_VERSION = "RA004_LEDGER_V1";
const SCHEMA_VERSION = 1;
const VERSION = /^\d{14}$/;
const NAME = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function invariant(value, message) {
  if (!value) throw new Error(`RA004_LEDGER_CONTRACT_INVALID: ${message}`);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function normalizeRows(rows) {
  invariant(Array.isArray(rows) && rows.length > 0 && rows.length <= 10_000,
    "ledger row count is outside the closed range");
  const projected = rows.map((row, index) => {
    invariant(row && typeof row === "object" && !Array.isArray(row), `row ${index} must be an object`);
    invariant(typeof row.version === "string" && VERSION.test(row.version), `row ${index} version is invalid`);
    invariant(typeof row.name === "string" && NAME.test(row.name), `row ${index} name is invalid`);
    return { version: row.version, name: row.name };
  }).sort((left, right) => compareUtf8(left.version, right.version) || compareUtf8(left.name, right.name));

  const versions = new Set();
  for (const row of projected) {
    invariant(!versions.has(row.version), `duplicate migration version ${row.version}`);
    versions.add(row.version);
  }
  return projected;
}

function ledgerDocument(rows, options = {}) {
  const contractVersion = options.contractVersion ?? CONTRACT_VERSION;
  const targetEnvironment = options.targetEnvironment ?? "STAGING";
  invariant(contractVersion === CONTRACT_VERSION, `unknown contract version ${contractVersion}`);
  invariant(["STAGING", "PRODUCTION"].includes(targetEnvironment),
    `unsupported target environment ${targetEnvironment}`);
  return {
    migrations: normalizeRows(rows).map((row, index) => ({
      identifier: `${row.version}_${row.name}`,
      name: row.name,
      ordinal: index + 1,
      version: row.version,
    })),
    schema_version: SCHEMA_VERSION,
    target_environment: targetEnvironment,
  };
}

function canonicalLedger(rows, options) {
  return canonical(ledgerDocument(rows, options));
}

function ledgerFingerprint(rows, options) {
  return crypto.createHash("sha256").update(canonicalLedger(rows, options), "utf8").digest("hex");
}

function rowsFromIdentifiers(identifiers) {
  invariant(Array.isArray(identifiers), "migration identifiers must be an array");
  return identifiers.map((identifier, index) => {
    invariant(typeof identifier === "string", `identifier ${index} must be a string`);
    const split = identifier.indexOf("_");
    invariant(split === 14 && !identifier.endsWith(".sql"), `identifier ${index} is invalid`);
    return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
  });
}

module.exports = {
  CONTRACT_VERSION,
  SCHEMA_VERSION,
  canonicalLedger,
  compareUtf8,
  ledgerDocument,
  ledgerFingerprint,
  normalizeRows,
  rowsFromIdentifiers,
};
