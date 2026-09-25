const { sha256 } = require("../../stable-json-hash");
const {
  authorizationFingerprint, fail, fileSha, redact, sanitizeError, validateAuthorization,
  validateCounters, validateEvidenceStore, validateMetadata, validateProjectIdentity,
  validateReport, validateRevokeReceipt,
} = require("./contract");
const { writeOnce } = require("./evidence");

function fingerprint(value, field) { return sha256({ ...value, [field]: "0".repeat(64) }); }

async function runPreflight({ authorization, expected, providerBundle, outputPath, now, evidenceOptions }) {
  // Authorization is deliberately validated before the provider object is touched.
  const approved = validateAuthorization(authorization, expected, now);
  if (fileSha(expected.control_migration.path) !== expected.control_migration.sha256
      || fileSha(expected.preflight_migration.path) !== expected.preflight_migration.sha256) fail("RA004_PREFLIGHT_MIGRATION_SHA_MISMATCH", "local migration bytes differ from authorization");
  if (!providerBundle?.provider || typeof providerBundle.snapshotCounters !== "function") fail("RA004_PREFLIGHT_PROVIDER_INVALID", "closed provider is required");
  const { provider, snapshotCounters } = providerBundle;
  let reportArtifact;
  try {
    const store = redact(validateEvidenceStore(await provider.readEvidenceStoreMetadata()));
    if (store.store_identifier !== approved.evidence_store.store_identifier) fail("RA004_PREFLIGHT_EVIDENCE_STORE_INVALID", "store identity mismatch");
    const identity = redact(validateProjectIdentity(await provider.readProjectIdentity()));
    if (identity.project_reference !== approved.target.project_reference || identity.canonical_host !== approved.target.canonical_host
        || !approved.target.host_allowlist.includes(identity.canonical_host)) fail("RA004_PREFLIGHT_PROJECT_IDENTITY_INVALID", "project is outside the authorization allowlist");
    const metadata = redact(validateMetadata(await provider.callMetadataRpc({
      p_environment: "STAGING", p_retailer_name: approved.target.retailer.name,
      p_retailer_slug: approved.target.retailer.slug,
      p_expected_ledger_count: approved.target.ledger.count,
      p_expected_ledger_fingerprint: approved.target.ledger.fingerprint,
      p_expected_session_user: approved.credential_design.role_name,
      p_max_bytes: 131072,
    }), approved.credential_design.role_name));
    if (metadata.q3_migration_ledger.ordered_ledger_count !== approved.target.ledger.count
        || metadata.q3_migration_ledger.ordered_ledger_fingerprint !== approved.target.ledger.fingerprint) fail("RA004_PREFLIGHT_LEDGER_UNKNOWN", "metadata ledger differs from authorization");
    const counters = validateCounters(snapshotCounters());
    if (counters.project_identity.performed_count !== 1 || counters.evidence_store.performed_count !== 1
        || counters.connection.performed_count !== 1 || counters.metadata_rpc.performed_count !== 1
        || counters.retry.attempt_count !== 0 || counters.prohibited.attempt_count !== 0) fail("RA004_PREFLIGHT_COUNTER_INVALID", "pre-revoke capability counters mismatch");
    const report = {
      schema_version: "ra-004-staging-preflight-report-v1", status: "METADATA_CAPTURED_PENDING_REVOKE", task_id: "RA-004",
      baseline_sha: approved.baseline_sha, authorization_fingerprint: authorizationFingerprint(approved),
      decision_fingerprint: approved.decision_fingerprint, plan_fingerprint: approved.plan_fingerprint,
      project_identity: identity, evidence_store: store, metadata, capability_counters: counters,
      completed_at: now, report_fingerprint: "0".repeat(64),
    };
    report.report_fingerprint = fingerprint(report, "report_fingerprint");
    validateReport(report);
    reportArtifact = writeOnce(outputPath, report, evidenceOptions);
    if (!/^[0-9a-f]{64}$/.test(reportArtifact.sha256)) fail("RA004_PREFLIGHT_READBACK_FAILED", "sealed report fingerprint mismatch");
    const revoked = await provider.revokeAndClose();
    const finalCounters = validateCounters(snapshotCounters());
    if (!revoked.access_revoked || !revoked.connection_closed || finalCounters.revoke.performed_count !== 1 || finalCounters.close.performed_count !== 1) fail("RA004_PREFLIGHT_REVOKE_FAILED", "revoke and close proof mismatch");
    const receipt = {
      schema_version: "ra-004-staging-preflight-revoke-receipt-v1", status: "REVOKED_AND_CLOSED",
      revoked_at: now, access_revoked: true, connection_closed: true,
      capability_counters: finalCounters, report_fingerprint: report.report_fingerprint,
      receipt_fingerprint: "0".repeat(64),
    };
    receipt.receipt_fingerprint = fingerprint(receipt, "receipt_fingerprint");
    validateRevokeReceipt(receipt);
    const receiptArtifact = writeOnce(`${outputPath}.revoke.json`, receipt, evidenceOptions);
    return Object.freeze({ report, receipt, reportArtifact, receiptArtifact });
  } catch (error) {
    try { await provider.revokeAndClose(); } catch { /* preserve the primary fail-closed error */ }
    throw sanitizeError(error);
  }
}

module.exports = { fingerprint, runPreflight };
