const { getReason, REASON_CODE_ENUM } = require("./reason-codes");
const { APPROVAL_LEVELS, CONFIDENCE_LEVELS, PRIMARY_STATUSES, PROPOSED_ACTIONS } = require("./schemas");
const { fingerprintClassificationArtifact, fingerprintClassificationRecord } = require("./fingerprints");
const { fail } = require("./errors");

const STATUS_ACTION = Object.freeze({
  SAFE_EXISTING_VARIANT: "NOOP", SAFE_EXISTING_PRODUCT_MISSING_VARIANT: "CREATE_CANONICAL_VARIANT",
  SAFE_NEW_CANONICAL_PRODUCT: "CREATE_CANONICAL_PRODUCT", SAFE_NEW_CANONICAL_FAMILY_WITH_VARIANTS: "CREATE_CANONICAL_FAMILY",
  AMBIGUOUS: "QUARANTINE", BLOCKED: "BLOCK", OUT_OF_STOCK: "SKIP_OOS",
  DUPLICATE_SOURCE_IDENTITY: "QUARANTINE", DEFERRED_POLICY: "SKIP_POLICY",
});
const PRIORITY = Object.freeze({ BLOCKED: 9, DUPLICATE_SOURCE_IDENTITY: 8, AMBIGUOUS: 7, DEFERRED_POLICY: 6, OUT_OF_STOCK: 5, SAFE_EXISTING_PRODUCT_MISSING_VARIANT: 4, SAFE_NEW_CANONICAL_FAMILY_WITH_VARIANTS: 3, SAFE_NEW_CANONICAL_PRODUCT: 2, SAFE_EXISTING_VARIANT: 1 });
const APPROVAL_PRIORITY = Object.freeze({ AUTO_LOW_RISK: 1, PARENT_APPROVAL: 2, CHILD_APPROVAL: 3, MANUAL_REVIEW: 4, FORBIDDEN: 5 });

function inferReasonCodes(record, canonical, context = {}) {
  const codes = [...(context.reason_codes || record.reason_codes || [])];
  if (context.reason_codes) return [...new Set(codes)].sort();
  const external = record.external_identity || record;
  const commerce = record.commerce || record;
  if (commerce.in_stock === false || record.available === false) codes.push("POLICY_OUT_OF_STOCK");
  if (!external.external_variant_id) codes.push("VARIANT_MISSING_EXTERNAL_VARIANT_ID");
  if (!external.external_sku && !record.sku) codes.push("IDENTITY_MISSING_SKU");
  if (!external.external_gtin && !record.gtin) codes.push("IDENTITY_MISSING_GTIN");
  const retailerId = context.retailer_id || record.retailer_id || "jon-s-supplements";
  const mappingKey = `${retailerId}|${external.external_variant_id || record.external_variant_id || ""}`;
  if ((canonical?.indexes?.external_variant_id?.[mappingKey] || []).length === 1) codes.push("IDENTITY_EXACT_EXTERNAL_VARIANT");
  if (context.canonical_candidates?.length > 1) codes.push("CONFLICT_MULTIPLE_CANONICAL_CANDIDATES");
  if (!codes.length) {
    if (context.new_family || Array.isArray(record.variants)) codes.push("IDENTITY_EXACT_FORMAT", "IDENTITY_EXACT_SIZE", "IDENTITY_EXACT_FLAVOUR");
    else if (context.new_product || context.canonical_candidates?.length === 0) codes.push("IDENTITY_EXACT_FORMAT", "IDENTITY_EXACT_SIZE");
    else codes.push("CONFLICT_MULTIPLE_CANONICAL_CANDIDATES");
  }
  return [...new Set(codes)].sort();
}

function chooseStatus(codes, context) {
  if (context.primary_status) return context.primary_status;
  return codes.map(getReason).map((entry) => entry.default_primary_status).sort((a, b) => PRIORITY[b] - PRIORITY[a])[0];
}

function classifyRecord(record, canonicalSnapshot, policy, context = {}) {
  const reason_codes = inferReasonCodes(record, canonicalSnapshot, context);
  for (const code of reason_codes) if (!REASON_CODE_ENUM.includes(code)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown reason code ${code}`);
  const primary_status = chooseStatus(reason_codes, context);
  if (!PRIMARY_STATUSES.includes(primary_status)) fail("RSBI_UNSUPPORTED_CLASSIFICATION", `Unsupported status ${primary_status}`);
  const proposed_action = context.proposed_action || STATUS_ACTION[primary_status];
  if (!PROPOSED_ACTIONS.includes(proposed_action)) fail("RSBI_UNSUPPORTED_ACTION", `Unsupported action ${proposed_action}`);
  const defaultApproval = reason_codes.map(getReason).map((entry) => entry.default_approval_level).sort((a, b) => APPROVAL_PRIORITY[b] - APPROVAL_PRIORITY[a])[0];
  const approval_level = context.approval_level || defaultApproval;
  if (!APPROVAL_LEVELS.includes(approval_level)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unsupported approval ${approval_level}`);
  const confidence = context.confidence || (primary_status.startsWith("SAFE_") ? "HIGH" : primary_status === "OUT_OF_STOCK" ? "VERY_HIGH" : "LOW");
  if (!CONFIDENCE_LEVELS.includes(confidence)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unsupported confidence ${confidence}`);
  const source_record_id = String(record.source_record_id || record.external_variant_id || record.external_identity?.external_variant_id || "");
  const productKey = String(record.source_product_key || record.external_product_id || record.external_identity?.external_product_id || "unknown");
  const result = {
    source_record_id, source_fingerprint: record.source_fingerprint || null, primary_status,
    secondary_statuses: [...new Set(context.secondary_statuses || [])].filter((status) => status !== primary_status).sort(),
    confidence, reason_codes, evidence: context.evidence || record.evidence || {},
    candidates: context.canonical_candidates || [], selected_canonical_product_id: context.selected_canonical_product_id || null,
    selected_canonical_variant_id: context.selected_canonical_variant_id || null, proposed_action, approval_level,
    dependency_group: context.dependency_group || `retailer:${policy?.retailer?.id || "unknown"}/external-product:${productKey}`,
    rollback_group: context.rollback_group || `retailer:${policy?.retailer?.id || "unknown"}/external-product:${productKey}`,
    quarantine_required: ["AMBIGUOUS", "BLOCKED", "DUPLICATE_SOURCE_IDENTITY", "DEFERRED_POLICY"].includes(primary_status),
    review_required: approval_level === "MANUAL_REVIEW", record_fingerprint: null,
  };
  result.record_fingerprint = fingerprintClassificationRecord(result);
  return Object.freeze(result);
}

function buildClassificationArtifact({ snapshot, canonicalSnapshot, policy, contexts = new Map(), metadata = {} }) {
  const records = snapshot.records.map((record) => classifyRecord(record, canonicalSnapshot, policy, contexts.get(String(record.source_record_id)) || {}));
  const count = (field) => records.reduce((out, record) => { const value = record[field]; out[value] = (out[value] || 0) + 1; return out; }, {});
  const reason_code_counts = {}; for (const record of records) for (const code of record.reason_codes) reason_code_counts[code] = (reason_code_counts[code] || 0) + 1;
  const artifact = { schema_version: 1, classification_id: metadata.classification_id || "00000000-0000-4000-8000-000000000002", snapshot_id: snapshot.snapshot_id, source_sha256: snapshot.source_sha256, canonical_snapshot_id: canonicalSnapshot.snapshot_id, canonical_snapshot_timestamp: canonicalSnapshot.captured_at, classifier_version: "RSBI-PHASE1-1", classifier_commit: metadata.code_commit || "WORKTREE", policy_config_sha256: metadata.policy_config_sha256 || "0".repeat(64), created_at: metadata.created_at || "1970-01-01T00:00:00.000Z", records, totals: count("primary_status"), reason_code_counts, confidence_counts: count("confidence"), proposed_action_counts: count("proposed_action"), blocked_counts: { quarantine: records.filter((record) => record.quarantine_required).length, review: records.filter((record) => record.review_required).length }, warnings: [], artifact_fingerprint: null };
  artifact.artifact_fingerprint = fingerprintClassificationArtifact(artifact);
  return artifact;
}

module.exports = { STATUS_ACTION, buildClassificationArtifact, classifyRecord, inferReasonCodes };
