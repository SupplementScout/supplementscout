const { fingerprint } = require("./artifacts");

const REVIEWED_JONS_STOCK_ONLY = Object.freeze({
  PRODUCTION: Object.freeze({
    authorization_id: "jons-reviewed-eight-oos-2026-07-22-production",
    offer_ids: ["1013", "1016", "1029", "1046", "1176", "1243", "1276", "1375"],
    mapping_ids: ["1199", "1202", "1215", "1232", "1362", "1429", "1462", "1561"],
    external_product_ids: ["10904679186770", "10904679186770", "10018787557714", "10018787557714", "10563642065234", "10032290431314", "10088760148306", "10460316533074"],
    external_variant_ids: ["53868239389010", "53868239487314", "50561870463314", "50561871085906", "53264568910162", "50602413949266", "50838720676178", "52233394028882"],
  }),
  STAGING: Object.freeze({
    authorization_id: "jons-reviewed-eight-oos-2026-07-22-staging",
    offer_ids: ["994", "995", "1084", "1101", "1366", "1433", "1466", "1565"],
    mapping_ids: ["1180", "1181", "1270", "1287", "1552", "1619", "1652", "1751"],
    external_product_ids: ["10904679186770", "10904679186770", "10018787557714", "10018787557714", "10563642065234", "10032290431314", "10088760148306", "10460316533074"],
    external_variant_ids: ["53868239487314", "53868239389010", "50561870463314", "50561871085906", "53264568910162", "50602413949266", "50838720676178", "52233394028882"],
  }),
});

function requireTimestamp(value, name) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) throw new Error(`${name} must be exact UTC RFC3339`);
  return timestamp;
}

function buildReviewedStockOnlyContract({ artifact, snapshotA, snapshotB, expiresAt, country = "GB" }) {
  const scope = REVIEWED_JONS_STOCK_ONLY[artifact?.target_environment];
  if (!scope) throw new Error("Reviewed stock-only target must be STAGING or PRODUCTION");
  if (country !== "GB") throw new Error("Reviewed stock-only source country must be GB");
  const a = snapshotA?.semantic_source_fingerprint;
  const b = snapshotB?.semantic_source_fingerprint;
  if (!/^[0-9a-f]{64}$/.test(String(a || "")) || a !== b) throw new Error("Reviewed stock-only snapshots must match");
  const capturedA = requireTimestamp(snapshotA.captured_at, "snapshot A captured_at");
  const capturedB = requireTimestamp(snapshotB.captured_at, "snapshot B captured_at");
  if (capturedA >= capturedB) throw new Error("Reviewed snapshot B must be independently captured after snapshot A");
  requireTimestamp(expiresAt, "expiresAt");
  if (artifact.source_snapshot_fingerprint !== b || artifact.source_captured_at !== snapshotB.captured_at) throw new Error("Artifact must bind snapshot B");
  const core = {
    schema_version: 1,
    kind: "jons-reviewed-stock-only-v1",
    authorization_id: scope.authorization_id,
    target_environment: artifact.target_environment,
    retailer_id: "10",
    offer_ids: [...scope.offer_ids],
    mapping_ids: [...scope.mapping_ids],
    external_product_ids: [...scope.external_product_ids],
    external_variant_ids: [...scope.external_variant_ids],
    before_stock: true,
    after_stock: false,
    source_country: country,
    snapshot_a_fingerprint: a,
    snapshot_b_fingerprint: b,
    snapshot_a_captured_at: snapshotA.captured_at,
    snapshot_b_captured_at: snapshotB.captured_at,
    expires_at: expiresAt,
    artifact_fingerprint: artifact.artifact_fingerprint,
  };
  return { ...core, reviewed_plan_hash: fingerprint(core) };
}

function bindReviewedContract(validationRequest, contract) {
  const request = { ...validationRequest, reviewed_stock_only_contract: contract, package_fingerprint: null };
  return { ...request, package_fingerprint: fingerprint(request) };
}

module.exports = { REVIEWED_JONS_STOCK_ONLY, bindReviewedContract, buildReviewedStockOnlyContract };
