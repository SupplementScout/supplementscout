const { fail } = require("./errors");

function evaluateGuardrails(metrics, policy) {
  const p = policy.guardrails || policy;
  const results = [];
  const check = (name, passed, code, actual, limit) => results.push({ name, passed, code: passed ? null : code, actual, limit });
  check("source_count", metrics.source_count_ratio >= p.minimum_source_count_ratio, metrics.source_count_ratio < p.catastrophic_source_count_ratio ? "RSBI_SOURCE_COLLAPSE" : "RSBI_GUARDRAIL_EXCEEDED", metrics.source_count_ratio, p.minimum_source_count_ratio);
  check("oos_ratio", metrics.oos_ratio <= p.max_oos_ratio && metrics.oos_increase <= p.max_oos_increase_percentage_points, "RSBI_MASS_OOS", metrics.oos_ratio, p.max_oos_ratio);
  check("changed_records", metrics.changed_record_ratio <= p.max_changed_record_ratio, "RSBI_GUARDRAIL_EXCEEDED", metrics.changed_record_ratio, p.max_changed_record_ratio);
  check("new_categories", metrics.new_category_ratio <= p.max_new_category_ratio, "RSBI_GUARDRAIL_EXCEEDED", metrics.new_category_ratio, p.max_new_category_ratio);
  check("missing_sku", metrics.missing_sku_ratio <= p.max_missing_sku_ratio, "RSBI_MISSING_REQUIRED_EVIDENCE", metrics.missing_sku_ratio, p.max_missing_sku_ratio);
  check("duplicate_external_ids", metrics.duplicate_external_id_ratio <= p.max_duplicate_external_id_ratio, "RSBI_DUPLICATE_IDENTITY", metrics.duplicate_external_id_ratio, p.max_duplicate_external_id_ratio);
  check("mass_price_change", metrics.mass_price_change_ratio < p.mass_price_change_ratio, "RSBI_PRICE_ANOMALY", metrics.mass_price_change_ratio, p.mass_price_change_ratio);
  return { passed: results.every((result) => result.passed), results };
}

function assertGuardrails(metrics, policy) {
  const evaluation = evaluateGuardrails(metrics, policy);
  const failure = evaluation.results.find((result) => !result.passed);
  if (failure) fail(failure.code, `Guardrail failed: ${failure.name}`, `$.guardrails.${failure.name}`, failure);
  return evaluation;
}

module.exports = { assertGuardrails, evaluateGuardrails };
