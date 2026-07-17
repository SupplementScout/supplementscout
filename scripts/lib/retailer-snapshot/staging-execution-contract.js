const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalize } = require("./fingerprints");

const STAGING_REF = "hxnrsyyqffztlvcrtgbf";
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const STAGING_DATABASE_IDENTITY = `supplementscout-staging:${STAGING_REF}`;
const FIXTURE_ID = "jons-staging-canary-real-10-v1-20260717";
const FIXTURE_FINGERPRINT = "2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5";
const EXPECTED_DELTAS = Object.freeze({ retailers: 0, products: 2, product_variants: 2, retailer_products: 3, offers: 3, price_history: 3 });
const CHILD_GROUPS = Object.freeze([
  { id: "DG1_HEART_CARE_ATOMIC", records: ["50844992602450"], expected_deltas: { retailers: 0, products: 1, product_variants: 1, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG2_CONTEH_ATOMIC", records: ["53951719768402"], expected_deltas: { retailers: 0, products: 1, product_variants: 1, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG3_PROJECT_AD_OFFER", records: ["51935656018258"], expected_deltas: { retailers: 0, products: 0, product_variants: 0, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG4_EXISTING_NOOPS", records: ["53868239389010", "53868239421778", "53868239454546", "53868239487314", "53868239520082", "53896427798866", "50927006581074"], expected_deltas: { retailers: 0, products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 } },
]);
const PACKAGE_KEYS = ["schema_version","package_id","target_environment","staging_project_ref","staging_database_identity","fixture_id","fixture_fingerprint","fixture_build_commit","source_snapshot_fingerprint","canonical_snapshot_fingerprint","adapter_fingerprint","policy_fingerprint","code_commit","expected_migration_identifiers","expected_migration_ledger_fingerprint","package_fingerprint"];
const REQUEST_KEYS = ["schema_version","target_environment","staging_project_ref","staging_database_identity","package_id","package_fingerprint","parent_plan_id","child_plan_id","fixture_id","fixture_fingerprint","fixture_approval_id","parent_plan_fingerprint","child_plan_fingerprint","source_snapshot_fingerprint","canonical_snapshot_fingerprint","migration_ledger_fingerprint","adapter_fingerprint","policy_fingerprint","code_commit","expected_deltas","row_plans","approval_expiry","requested_at","explicit_allow","request_fingerprint"];
const RECOVERY_REQUEST_KEYS = ["schema_version","target_environment","staging_project_ref","staging_database_identity","package_id","package_fingerprint","child_plan_id","parent_plan_fingerprint","child_plan_fingerprint","recovery_approval_id","execution_fingerprint","rollback_manifest_fingerprint","requested_at","explicit_allow","request_fingerprint"];

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function seal(value, fingerprintKey) { return sha256(canonicalize({ ...value, [fingerprintKey]: null })); }
function packageFingerprint(value) { return seal(value, "package_fingerprint"); }
function requestFingerprint(value) { return seal(value, "request_fingerprint"); }
function migrationLedgerDocument(identifiers, targetEnvironment = "STAGING") {
  return { schema_version: 1, target_environment: targetEnvironment, migrations: identifiers.map((identifier, index) => { const split = identifier.indexOf("_"); return { identifier, name: identifier.slice(split + 1), ordinal: index + 1, version: identifier.slice(0, split) }; }) };
}
function migrationLedgerFingerprint(identifiers, targetEnvironment = "STAGING") { return sha256(canonicalize(migrationLedgerDocument(identifiers, targetEnvironment))); }
function exactKeys(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }
function isSha256(value) { return /^[0-9a-f]{64}$/.test(String(value)); }
function isCommit(value) { return /^[0-9a-f]{40}$/.test(String(value)); }

function validateFrozenFixture(file = path.resolve("tmp/jons-canary-final-fixture.json")) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  if (fixture.fixture_id !== FIXTURE_ID || fixture.fixture_fingerprint !== FIXTURE_FINGERPRINT || fixture.target?.project_ref !== STAGING_REF) throw new Error("frozen fixture identity mismatch");
  if (!isCommit(fixture.code_commit)) throw new Error("fixture build commit is invalid");
  if (canonicalize(fixture.expected_deltas) !== canonicalize(EXPECTED_DELTAS)) throw new Error("frozen fixture exact deltas mismatch");
  const records = new Map(fixture.source_records.map((record) => [record.source_record_id, record]));
  for (const group of CHILD_GROUPS) for (const id of group.records) if (!records.has(id) || records.get(id).blocked) throw new Error(`fixture group record rejected: ${id}`);
  const projectAd = records.get("51935656018258");
  if (projectAd.staging_canonical_product_candidate !== "91" || projectAd.staging_canonical_variant_candidate !== "39") throw new Error("Project AD canonical binding mismatch");
  for (const id of ["50844992602450", "53951719768402"]) {
    const record = records.get(id);
    if (record.source_variant_count !== 1 || record.pack_count !== 1 || record.variant_title !== "Default Title" || record.availability !== "IN_STOCK" || !record.alternate_identity_evidence?.no_unresolved_canonical_collision) throw new Error(`simple canonical guard rejected: ${id}`);
  }
  return fixture;
}

function validatePackage(packageValue) {
  if (!exactKeys(packageValue, PACKAGE_KEYS)) throw new Error("closed staging package schema mismatch");
  if (packageValue.schema_version !== 1 || packageValue.target_environment !== "STAGING" || packageValue.staging_project_ref !== STAGING_REF || packageValue.staging_database_identity !== STAGING_DATABASE_IDENTITY) throw new Error("staging package target mismatch");
  if (packageValue.fixture_id !== FIXTURE_ID || packageValue.fixture_fingerprint !== FIXTURE_FINGERPRINT || !isCommit(packageValue.fixture_build_commit) || !isCommit(packageValue.code_commit)) throw new Error("staging package fixture or commit mismatch");
  if (![packageValue.source_snapshot_fingerprint, packageValue.canonical_snapshot_fingerprint, packageValue.adapter_fingerprint, packageValue.policy_fingerprint, packageValue.expected_migration_ledger_fingerprint].every(isSha256)) throw new Error("staging package fingerprint field invalid");
  if (!Array.isArray(packageValue.expected_migration_identifiers) || packageValue.expected_migration_identifiers.length < 1 || packageValue.expected_migration_identifiers.some((item) => !/^\d+_[a-z0-9_]+$/.test(item))) throw new Error("staging package migration identifiers invalid");
  if (packageValue.expected_migration_ledger_fingerprint !== migrationLedgerFingerprint(packageValue.expected_migration_identifiers, packageValue.target_environment)) throw new Error("staging package migration ledger fingerprint mismatch");
  if (packageValue.package_fingerprint !== packageFingerprint(packageValue)) throw new Error("staging package fingerprint mismatch");
  return packageValue;
}

function validateBinding(request, packageValue) {
  const approvedPackage = validatePackage(packageValue);
  for (const key of ["target_environment","staging_project_ref","staging_database_identity","package_id","package_fingerprint","fixture_id","fixture_fingerprint","source_snapshot_fingerprint","canonical_snapshot_fingerprint","migration_ledger_fingerprint","adapter_fingerprint","policy_fingerprint","code_commit"]) {
    const packageKey = key === "migration_ledger_fingerprint" ? "expected_migration_ledger_fingerprint" : key;
    if (request[key] !== approvedPackage[packageKey]) throw new Error(`staging request package binding mismatch: ${key}`);
  }
}

function validateRequest(request, packageValue) {
  if (!exactKeys(request, REQUEST_KEYS)) throw new Error("closed staging request schema mismatch");
  if (request.schema_version !== 1 || request.explicit_allow !== true || !Array.isArray(request.row_plans) || request.row_plans.length < 1 || request.row_plans.length > 10 || new Date(request.approval_expiry) <= new Date(request.requested_at)) throw new Error("bounded staging request invalid");
  validateBinding(request, packageValue);
  if (request.request_fingerprint !== requestFingerprint(request)) throw new Error("staging request fingerprint mismatch");
  return request;
}

function validateRecoveryRequest(request, packageValue) {
  if (!exactKeys(request, RECOVERY_REQUEST_KEYS)) throw new Error("closed staging recovery request schema mismatch");
  if (request.schema_version !== 1 || request.explicit_allow !== true || !isSha256(request.execution_fingerprint) || !isSha256(request.rollback_manifest_fingerprint)) throw new Error("bounded staging recovery request invalid");
  const packageProjection = { ...request, fixture_id: packageValue.fixture_id, fixture_fingerprint: packageValue.fixture_fingerprint, source_snapshot_fingerprint: packageValue.source_snapshot_fingerprint, canonical_snapshot_fingerprint: packageValue.canonical_snapshot_fingerprint, migration_ledger_fingerprint: packageValue.expected_migration_ledger_fingerprint, adapter_fingerprint: packageValue.adapter_fingerprint, policy_fingerprint: packageValue.policy_fingerprint, code_commit: packageValue.code_commit };
  validateBinding(packageProjection, packageValue);
  if (request.request_fingerprint !== requestFingerprint(request)) throw new Error("staging recovery request fingerprint mismatch");
  return request;
}

module.exports = { CHILD_GROUPS, EXPECTED_DELTAS, FIXTURE_FINGERPRINT, FIXTURE_ID, PACKAGE_KEYS, PRODUCTION_REF, RECOVERY_REQUEST_KEYS, REQUEST_KEYS, STAGING_DATABASE_IDENTITY, STAGING_REF, migrationLedgerDocument, migrationLedgerFingerprint, packageFingerprint, requestFingerprint, validateFrozenFixture, validatePackage, validateRecoveryRequest, validateRequest };
