const { canonicalize, fingerprintParentCore, fingerprintParentPlan, fingerprintRollbackManifest, hash } = require("./fingerprints");
const { partitionRecords } = require("./partitioner");
const { buildRowPlan } = require("./row-plan-builder");
const { buildChildPlan, hashUuid } = require("./child-plan-builder");

const SAFE_PARENT = new Set(["SAFE_EXISTING_VARIANT", "SAFE_NEW_CANONICAL_PRODUCT"]);
function sumDeltas(children) { const out = { products: 0, variants: 0, mappings: 0, offers: 0, price_history: 0 }; for (const child of children) for (const key of Object.keys(out)) out[key] += child.expected_deltas[key] || 0; return out; }

function buildParentPlan({ classification, sourceSnapshot, canonicalSnapshot, policy, rowContexts = new Map(), metadata = {} }) {
  const sourceById = new Map(sourceSnapshot.records.map((record) => [String(record.source_record_id), record]));
  const safe = classification.records.filter((record) => SAFE_PARENT.has(record.primary_status) && !record.quarantine_required && ["AUTO_LOW_RISK", "PARENT_APPROVAL"].includes(record.approval_level));
  const quarantine = classification.records.filter((record) => !safe.includes(record));
  const groups = partitionRecords(safe, { preferred: policy.guardrails.preferred_batch_size, maximum: policy.guardrails.max_batch_size });
  const coreData = { snapshot_id: sourceSnapshot.snapshot_id, classification_id: classification.classification_id, source_sha256: sourceSnapshot.source_sha256, canonical_snapshot_fingerprint: canonicalSnapshot.fingerprint, policy_config_sha256: metadata.policy_config_sha256 || hash("RSBI:CONFIG:1", policy), safe_record_ids: safe.map((record) => record.source_record_id).sort(), quarantine_record_ids: quarantine.map((record) => record.source_record_id).sort(), classification_totals: classification.totals };
  const parentCoreFingerprint = fingerprintParentCore(coreData);
  const parentPlanId = hashUuid(parentCoreFingerprint);
  const children = groups.map((records, index) => buildChildPlan({ parentPlanId, parentCoreFingerprint, batchIndex: index, batchCount: groups.length, records, rowPlans: records.map((record) => buildRowPlan(record, sourceById.get(String(record.source_record_id)), rowContexts.get(String(record.source_record_id)) || {})) }));
  const rollbackManifest = { schema_version: 1, parent_plan_id: parentPlanId, child_plan_ids: children.map((child) => child.child_plan_id), ownership_markers: children.flatMap((child) => child.row_plans.map((row) => row.rollback_ownership)), created_record_ids: [], updated_before_state: [], price_history_ownership: [], deactivation_operations: [], deletion_operations: [], protected_shared_canonical_records: [], reverse_dependency_order: [...children].reverse().map((child) => child.child_plan_id), rollback_checks: [{ code: "PLAN_OWNERSHIP_ONLY" }], rollback_fingerprint: null };
  rollbackManifest.rollback_fingerprint = fingerprintRollbackManifest(rollbackManifest);
  const createdAt = metadata.created_at || "1970-01-01T00:00:00.000Z";
  const expiresAt = metadata.expires_at || "1970-01-01T02:00:00.000Z";
  const parent = { schema_version: 1, parent_plan_id: parentPlanId, snapshot_id: sourceSnapshot.snapshot_id, classification_id: classification.classification_id, retailer_id: String(metadata.retailer_id || "0"), target_environment: metadata.target_environment || "STAGING", source_sha256: sourceSnapshot.source_sha256, canonical_snapshot_fingerprint: canonicalSnapshot.fingerprint, adapter_sha256: metadata.adapter_sha256 || "0".repeat(64), code_commit: metadata.code_commit || "0".repeat(40), policy_config_sha256: coreData.policy_config_sha256, shipping_config_sha256: hash("RSBI:SHIPPING:1", policy.shipping_policy), affiliate_config_sha256: hash("RSBI:AFFILIATE:1", policy.affiliate_policy), created_at: createdAt, expires_at: expiresAt, classification_totals: classification.totals, safe_record_ids: coreData.safe_record_ids, quarantine_record_ids: coreData.quarantine_record_ids, child_batches: children.map((child) => ({ child_plan_id: child.child_plan_id, child_plan_fingerprint: child.child_plan_fingerprint, batch_index: child.batch_index, record_ids: child.record_ids })), aggregate_expected_deltas: sumDeltas(children), rollback_manifest: rollbackManifest, guardrail_results: metadata.guardrail_results || [], parent_plan_fingerprint: null };
  parent.parent_plan_fingerprint = fingerprintParentPlan(parent);
  return { parent, children, parent_core_fingerprint: parentCoreFingerprint, canonical_preview: canonicalize(parent) };
}

module.exports = { SAFE_PARENT, buildParentPlan, sumDeltas };
