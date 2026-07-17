const { fingerprintChildPlan } = require("./fingerprints");

function hashUuid(hash, version = "4") { const h = hash.slice(0, 32).split(""); h[12] = version; h[16] = "8"; return `${h.slice(0,8).join("")}-${h.slice(8,12).join("")}-${h.slice(12,16).join("")}-${h.slice(16,20).join("")}-${h.slice(20).join("")}`; }
function countDeltas(rowPlans) {
  const out = { products: 0, variants: 0, mappings: 0, offers: 0, price_history: 0 };
  for (const plan of rowPlans) { if (plan.product.action === "CREATE") out.products += 1; if (plan.canonical_variant.action === "CREATE") out.variants += 1; if (plan.retailer_mapping.action === "CREATE") out.mappings += 1; if (plan.offer.action === "CREATE") out.offers += 1; if (plan.price_history.action === "CREATE") out.price_history += 1; }
  return out;
}

function buildChildPlan({ parentPlanId, parentCoreFingerprint, batchIndex, batchCount, records, rowPlans }) {
  const provisional = { child_plan_id: "00000000-0000-4000-8000-000000000000", parent_plan_id: parentPlanId, batch_index: batchIndex, batch_count: batchCount, dependency_group: [...new Set(records.map((record) => record.dependency_group))].join("|"), rollback_group: [...new Set(records.map((record) => record.rollback_group))].join("|"), record_ids: records.map((record) => String(record.source_record_id)), row_plans: rowPlans, expected_state: { parent_core_fingerprint: parentCoreFingerprint }, expected_deltas: countDeltas(rowPlans), preconditions: [{ code: "PARENT_CORE_MATCH", fingerprint: parentCoreFingerprint }], postconditions: [{ code: "EXACT_DELTAS", deltas: countDeltas(rowPlans) }], rollback_operations: rowPlans.map((plan) => ({ source_record_id: plan.source_record_id, ownership: plan.rollback_ownership })), child_plan_fingerprint: null, status: "PLANNED" };
  provisional.child_plan_fingerprint = fingerprintChildPlan(provisional);
  provisional.child_plan_id = hashUuid(provisional.child_plan_fingerprint);
  return provisional;
}

module.exports = { buildChildPlan, countDeltas, hashUuid };
