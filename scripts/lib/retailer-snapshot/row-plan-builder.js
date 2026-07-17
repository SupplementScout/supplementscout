const { fingerprintRowPlan } = require("./fingerprints");

const section = (action, id = null, values = null, expected = null) => ({ action, id: id == null ? null : String(id), values, expected });

function buildRowPlan(classification, sourceRecord, context = {}) {
  const existing = classification.primary_status === "SAFE_EXISTING_VARIANT";
  const newProduct = classification.primary_status === "SAFE_NEW_CANONICAL_PRODUCT";
  const newVariant = classification.primary_status === "SAFE_EXISTING_PRODUCT_MISSING_VARIANT";
  const plan = {
    schema_version: 1, source_record_id: String(classification.source_record_id),
    retailer: section("REUSE", context.retailer_id || null, null, context.expected_retailer || null),
    product: section(newProduct ? "CREATE" : "REUSE", context.product_id || null, newProduct ? (context.product_values || {}) : null, context.expected_product || null),
    canonical_variant: section(newProduct || newVariant ? "CREATE" : "REUSE", context.variant_id || null, newProduct || newVariant ? (context.variant_values || {}) : null, context.expected_variant || null),
    retailer_mapping: section(existing ? "NOOP" : "CREATE", context.mapping_id || null, existing ? null : (context.mapping_values || {}), context.expected_mapping || null),
    offer: section(existing ? (context.offer_changed ? "UPDATE" : "NOOP") : "CREATE", context.offer_id || null, existing && !context.offer_changed ? null : (context.offer_values || {}), context.expected_offer || null),
    price_history: section(context.price_changed ? "CREATE" : "NOOP", null, context.price_changed ? (context.price_history_values || {}) : null, null),
    source_evidence: sourceRecord.evidence || sourceRecord.raw || {}, expected_state: context.expected_state || {},
    postconditions: context.postconditions || [{ code: "ROW_STATE_MATCHES_PLAN", source_record_id: String(classification.source_record_id) }],
    rollback_ownership: { dependency_group: classification.dependency_group, rollback_group: classification.rollback_group, plan_owned_only: true },
    fingerprints: { classification_record: classification.record_fingerprint, row_plan: null },
  };
  plan.fingerprints.row_plan = fingerprintRowPlan(plan);
  return plan;
}

module.exports = { buildRowPlan, section };
