const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalize } = require("./fingerprints");

const STAGING_REF = "hxnrsyyqffztlvcrtgbf";
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const STAGING_DATABASE_IDENTITY = `supplementscout-staging:${STAGING_REF}`;
const FIXTURE_ID = "jons-staging-canary-real-10-v1-20260717";
const FIXTURE_FINGERPRINT = "2c62a82c169ee20fab8a86c125423aa50b2d9613283907c408726d4ed89981f5";
const CODE_COMMIT = "6f7eefb29f775e773bd0764664a0ba138993fa06";
const EXPECTED_DELTAS = Object.freeze({ retailers: 0, products: 2, product_variants: 2, retailer_products: 3, offers: 3, price_history: 3 });
const CHILD_GROUPS = Object.freeze([
  { id: "DG1_HEART_CARE_ATOMIC", records: ["50844992602450"], expected_deltas: { retailers: 0, products: 1, product_variants: 1, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG2_CONTEH_ATOMIC", records: ["53951719768402"], expected_deltas: { retailers: 0, products: 1, product_variants: 1, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG3_PROJECT_AD_OFFER", records: ["51935656018258"], expected_deltas: { retailers: 0, products: 0, product_variants: 0, retailer_products: 1, offers: 1, price_history: 1 } },
  { id: "DG4_EXISTING_NOOPS", records: ["53868239389010", "53868239421778", "53868239454546", "53868239487314", "53868239520082", "53896427798866", "50927006581074"], expected_deltas: { retailers: 0, products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 } },
]);
const REQUEST_KEYS = ["schema_version","target_environment","staging_project_ref","staging_database_identity","parent_plan_id","child_plan_id","fixture_id","fixture_fingerprint","fixture_approval_id","parent_plan_fingerprint","child_plan_fingerprint","source_snapshot_fingerprint","canonical_snapshot_fingerprint","migration_ledger_fingerprint","adapter_fingerprint","policy_fingerprint","code_commit","expected_deltas","row_plans","approval_expiry","requested_at","explicit_allow","request_fingerprint"];

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function requestFingerprint(request) { return sha256(canonicalize({ ...request, request_fingerprint: null })); }
function exactKeys(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }
function validateFrozenFixture(file = path.resolve("tmp/jons-canary-final-fixture.json")) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  if (fixture.fixture_id !== FIXTURE_ID || fixture.fixture_fingerprint !== FIXTURE_FINGERPRINT || fixture.target?.project_ref !== STAGING_REF) throw new Error("frozen fixture identity mismatch");
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
function validateRequest(request) {
  if (!exactKeys(request, REQUEST_KEYS)) throw new Error("closed staging request schema mismatch");
  if (request.schema_version !== 1 || request.target_environment !== "STAGING" || request.staging_project_ref !== STAGING_REF || request.staging_database_identity !== STAGING_DATABASE_IDENTITY) throw new Error("staging target identity mismatch");
  if (request.fixture_id !== FIXTURE_ID || request.fixture_fingerprint !== FIXTURE_FINGERPRINT || request.code_commit !== CODE_COMMIT || request.explicit_allow !== true) throw new Error("sealed staging request mismatch");
  if (!Array.isArray(request.row_plans) || request.row_plans.length < 1 || new Date(request.approval_expiry) <= new Date(request.requested_at)) throw new Error("bounded approval or rows invalid");
  if (request.request_fingerprint !== requestFingerprint(request)) throw new Error("staging request fingerprint mismatch");
  return request;
}

module.exports = { CHILD_GROUPS, CODE_COMMIT, EXPECTED_DELTAS, FIXTURE_FINGERPRINT, FIXTURE_ID, PRODUCTION_REF, REQUEST_KEYS, STAGING_DATABASE_IDENTITY, STAGING_REF, requestFingerprint, validateFrozenFixture, validateRequest };
