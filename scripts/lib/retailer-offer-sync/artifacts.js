const { canonical, sha256 } = require("../shopify-snapshot-reader");

function fingerprint(value) { return sha256(canonical(value)); }
function sortRows(rows) { return [...rows].sort((a, b) => BigInt(a.offer_id) < BigInt(b.offer_id) ? -1 : BigInt(a.offer_id) > BigInt(b.offer_id) ? 1 : String(a.external_variant_id).localeCompare(String(b.external_variant_id))); }
function sealArtifact(core) {
  const artifact = { schema_version: 1, ...core, rows: sortRows(core.rows || []) };
  return { ...artifact, artifact_fingerprint: fingerprint(artifact) };
}
function rowRunId(childFingerprint, order, planFingerprint) { return `mbs-${childFingerprint.slice(0, 16)}-${String(order).padStart(2, "0")}-${planFingerprint.slice(0, 16)}`; }
module.exports = { fingerprint, rowRunId, sealArtifact, sortRows };
