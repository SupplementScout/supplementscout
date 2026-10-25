const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");

const VERSION = "1";
const HEX64 = /^[0-9a-f]{64}$/;
const SOURCE_TYPES = new Set([
  "manufacturer_product_page", "manufacturer_label", "manufacturer_structured_data",
  "exact_retailer_gtin_sku", "independent_exact_retailer",
]);
const MANUFACTURER_SOURCES = new Set([
  "manufacturer_product_page", "manufacturer_label", "manufacturer_structured_data",
]);
const FACT_ROLES = new Set(["physical_size", "container_count", "pack_count", "piece_count", "product_format", "total_content", "serving_count", "pack_structure"]);
const SELECTED_ROLES = new Set(["physical_size", "container_count", "pack_count", "product_format"]);
const COUNT_UNITS = {
  container_count: new Set(["capsules", "tablets", "softgels", "pieces"]),
  pack_count: new Set(["packs"]),
  piece_count: new Set(["pieces"]),
};
const CONFLICTS = new Set(["UNEXPLAINED_CONFLICTING_METADATA", "SERVING_COUNT_NOT_CONTAINER_COUNT", "PACK_CONFIGURATION_CONFLICT"]);
const ROOT_KEYS = ["contract_version", "binding", "raw_source_facts", "external_evidence_facts", "derived_facts", "canonical_selected_facts", "conflict_records", "evidence_review_decision"];

function fail(code) { throw new Error(code); }
function requireValue(value, code) { if (!value) fail(code); }
function exactKeys(value, keys) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
}
function sha(value) { return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function canonicalDecimal(value, integer = false) {
  const text = String(value);
  if (!(integer ? /^[1-9]\d*$/ : /^(?:0|[1-9]\d*)(?:\.\d+)?$/).test(text) || Number(text) <= 0) fail("V3_CANONICAL_DERIVATION_MISMATCH");
  if (!integer && (text.includes(".") && (text.endsWith("0") || text.endsWith(".")))) fail("V3_CANONICAL_DERIVATION_MISMATCH");
  return text;
}
function decimalMultiply(values) {
  let coefficient = 1n;
  let scale = 0;
  for (const value of values) {
    const text = canonicalDecimal(value);
    const [, whole, fraction = ""] = text.match(/^(\d+)(?:\.(\d+))?$/);
    coefficient *= BigInt(whole + fraction);
    scale += fraction.length;
  }
  let digits = coefficient.toString().padStart(scale + 1, "0");
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/g, "");
  return digits;
}
function normalizedTimestamp(value, code) {
  requireValue(typeof value === "string" && new Date(value).toISOString() === value, code);
  return value;
}

function validateNormalizedFact(fact) {
  if (["physical_size", "total_content"].includes(fact.role)) {
    canonicalDecimal(fact.normalized_value);
    if (!["g", "ml"].includes(fact.unit)) fail("V3_CANONICAL_EVIDENCE_AMBIGUOUS");
    return;
  }
  if (COUNT_UNITS[fact.role]) {
    canonicalDecimal(fact.normalized_value, true);
    if (!COUNT_UNITS[fact.role].has(fact.unit)) fail("V3_CANONICAL_EVIDENCE_AMBIGUOUS");
    return;
  }
  if (fact.role === "product_format") {
    if (typeof fact.normalized_value !== "string" || !fact.normalized_value || fact.unit !== "format") fail("V3_CANONICAL_EVIDENCE_AMBIGUOUS");
    return;
  }
  fail("V3_CANONICAL_EVIDENCE_AMBIGUOUS");
}

function admissibleExternalFact(fact, allFacts, context) {
  if (MANUFACTURER_SOURCES.has(fact.evidence_source_type)) return true;
  const peers = allFacts.filter(item => item.fact_id !== fact.fact_id && item.role === fact.role &&
    item.normalized_value === fact.normalized_value && item.unit === fact.unit);
  if (peers.some(item => MANUFACTURER_SOURCES.has(item.evidence_source_type))) return true;
  return Boolean(context.external_gtin || context.external_sku) &&
    peers.some(item => item.evidence_source_type !== fact.evidence_source_type);
}

function authoritativeRawRoles(context, sourceKey) {
  const roles = new Set();
  const physical = context.option_roles?.physical_size;
  const count = context.option_roles?.count;
  if (physical?.source_key === sourceKey) roles.add("physical_size");
  if (count?.source_key === sourceKey) {
    if (count.count_unit === "servings") roles.add("serving_count");
    else if (COUNT_UNITS.container_count.has(count.count_unit)) roles.add("container_count");
    else fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
  }
  return roles;
}

function rawConflictObligations(selected, context) {
  const obligations = [];
  const physical = context.option_roles?.physical_size;
  if (selected.physical_size && physical &&
      (String(physical.size_value) !== selected.physical_size.normalized_value || physical.size_unit !== selected.physical_size.unit)) {
    obligations.push({
      selected: selected.physical_size, raw_role: "physical_size",
      source_key: physical.source_key, raw_value: physical.source_value,
      classifications: new Set(["UNEXPLAINED_CONFLICTING_METADATA", "PACK_CONFIGURATION_CONFLICT"]),
    });
  }
  const count = context.option_roles?.count;
  if (selected.container_count && count &&
      (String(count.count_value) !== selected.container_count.normalized_value || count.count_unit !== selected.container_count.unit)) {
    const serving = count.count_unit === "servings";
    const rawRole = serving ? "serving_count" : COUNT_UNITS.container_count.has(count.count_unit) ? "container_count" : null;
    if (!rawRole) fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
    obligations.push({
      selected: selected.container_count, raw_role: rawRole,
      source_key: count.source_key, raw_value: count.source_value,
      classifications: new Set(serving
        ? ["SERVING_COUNT_NOT_CONTAINER_COUNT"]
        : ["UNEXPLAINED_CONFLICTING_METADATA", "PACK_CONFIGURATION_CONFLICT"]),
    });
  }
  return obligations;
}

function validateCanonicalIdentityEvidence(evidence, context) {
  if (evidence == null) return null;
  exactKeys(evidence, ROOT_KEYS);
  if (evidence.contract_version !== VERSION) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
  exactKeys(evidence.binding, ["retailer_id", "external_product_id", "external_variant_id", "source_row_fingerprint", "brand", "product_identity", "external_gtin", "external_sku", "package_authorized_at"]);
  const bindingExpected = {
    retailer_id: String(context.retailer_id), external_product_id: String(context.external_product_id),
    external_variant_id: String(context.external_variant_id), source_row_fingerprint: context.source_row_fingerprint,
    brand: context.brand, product_identity: context.product_identity,
    external_gtin: context.external_gtin ?? null, external_sku: context.external_sku ?? null,
    package_authorized_at: context.authorized_at,
  };
  if (canonicalJson(evidence.binding) !== canonicalJson(bindingExpected)) fail("V3_CANONICAL_EVIDENCE_BINDING_MISMATCH");
  if (!HEX64.test(evidence.binding.source_row_fingerprint)) fail("V3_CANONICAL_EVIDENCE_BINDING_MISMATCH");

  for (const key of ["raw_source_facts", "external_evidence_facts", "derived_facts", "canonical_selected_facts", "conflict_records"]) {
    if (!Array.isArray(evidence[key])) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
  }
  if (!context.external_options || typeof context.external_options !== "object" || Array.isArray(context.external_options) ||
      !context.option_roles || typeof context.option_roles !== "object" || Array.isArray(context.option_roles)) {
    fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
  }
  const facts = new Map();
  const rawBindings = new Set();
  for (const fact of evidence.raw_source_facts) {
    exactKeys(fact, ["fact_id", "role", "raw_value", "source_key", "source_row_fingerprint"]);
    requireValue(typeof fact.fact_id === "string" && FACT_ROLES.has(fact.role) && typeof fact.raw_value === "string" && typeof fact.source_key === "string", "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    if (fact.source_row_fingerprint !== context.source_row_fingerprint) fail("V3_CANONICAL_EVIDENCE_BINDING_MISMATCH");
    if (!Object.hasOwn(context.external_options, fact.source_key) || context.external_options[fact.source_key] !== fact.raw_value) fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
    const representedRoles = authoritativeRawRoles(context, fact.source_key);
    if (representedRoles.size && !representedRoles.has(fact.role)) fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
    const rawBinding = canonicalJson([fact.source_key, fact.role]);
    if (rawBindings.has(rawBinding)) fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
    rawBindings.add(rawBinding);
    if (facts.has(fact.fact_id)) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    facts.set(fact.fact_id, { ...fact, kind: "raw" });
  }
  for (const fact of evidence.external_evidence_facts) {
    exactKeys(fact, ["fact_id", "role", "normalized_value", "unit", "evidence_source_type", "source_url", "captured_at", "source_content_sha256", "identity_binding"]);
    exactKeys(fact.identity_binding, ["brand", "product_identity", "external_gtin", "external_sku", "pack_configuration"]);
    requireValue(typeof fact.fact_id === "string" && FACT_ROLES.has(fact.role) && SOURCE_TYPES.has(fact.evidence_source_type), "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    validateNormalizedFact(fact);
    requireValue(/^https:\/\//.test(fact.source_url) && HEX64.test(fact.source_content_sha256), "V3_CANONICAL_EVIDENCE_HASH_MISMATCH");
    normalizedTimestamp(fact.captured_at, "V3_CANONICAL_EVIDENCE_BINDING_MISMATCH");
    if (new Date(fact.captured_at) > new Date(context.authorized_at)) fail("V3_CANONICAL_EVIDENCE_BINDING_MISMATCH");
    const identity = fact.identity_binding;
    if (identity.brand !== context.brand || identity.product_identity !== context.product_identity || !identity.pack_configuration ||
        (identity.external_gtin ?? null) !== (context.external_gtin ?? null) || (identity.external_sku ?? null) !== (context.external_sku ?? null)) {
      fail("V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH");
    }
    if (facts.has(fact.fact_id)) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    facts.set(fact.fact_id, { ...fact, kind: "external" });
  }
  for (const fact of evidence.external_evidence_facts) {
    if (!admissibleExternalFact(fact, evidence.external_evidence_facts, context)) fail("V3_CANONICAL_EVIDENCE_SOURCE_NOT_ADMISSIBLE");
    if (fact.identity_binding.pack_configuration !== evidence.external_evidence_facts[0].identity_binding.pack_configuration) fail("V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH");
    if (evidence.external_evidence_facts.some(item => item.fact_id !== fact.fact_id && item.role === fact.role &&
      (item.normalized_value !== fact.normalized_value || item.unit !== fact.unit))) fail("V3_CANONICAL_EVIDENCE_AMBIGUOUS");
  }
  for (const fact of evidence.derived_facts) {
    exactKeys(fact, ["fact_id", "role", "formula_id", "operand_fact_ids", "normalized_value", "unit", "derivation_sha256"]);
    if (fact.formula_id !== "multiply_exact_decimal_v1" || !Array.isArray(fact.operand_fact_ids) || fact.operand_fact_ids.length < 2 || facts.has(fact.fact_id)) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    const operands = fact.operand_fact_ids.map(id => facts.get(id));
    if (operands.some(item => !item)) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    if (!["physical_size", "total_content"].includes(fact.role)) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    validateNormalizedFact(fact);
    const physicalOperands = operands.filter(item => ["physical_size", "total_content"].includes(item.role));
    const countOperands = operands.filter(item => COUNT_UNITS[item.role]);
    if (physicalOperands.length !== 1 || countOperands.length !== operands.length - 1 ||
        physicalOperands[0].unit !== fact.unit) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    for (const item of countOperands) canonicalDecimal(item.normalized_value, true);
    const result = decimalMultiply(operands.map(item => item.normalized_value));
    if (result !== fact.normalized_value) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    const expectedHash = sha({ formula_id: fact.formula_id, ordered_operands: fact.operand_fact_ids.map(id => ({ fact_id: id, normalized_value: facts.get(id).normalized_value, unit: facts.get(id).unit })), result: fact.normalized_value, unit: fact.unit });
    if (fact.derivation_sha256 !== expectedHash) fail("V3_CANONICAL_DERIVATION_MISMATCH");
    facts.set(fact.fact_id, { ...fact, kind: "derived" });
  }

  const selected = {};
  for (const fact of evidence.canonical_selected_facts) {
    exactKeys(fact, ["role", "selected_fact_id", "normalized_value", "unit", "evidence_review_decision"]);
    if (!SELECTED_ROLES.has(fact.role) || selected[fact.role] || fact.evidence_review_decision !== "ACCEPT_FOR_CANONICAL_IDENTITY") fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    const source = facts.get(fact.selected_fact_id);
    if (!source || !["external", "derived"].includes(source.kind) || source.role !== fact.role || source.normalized_value !== fact.normalized_value || source.unit !== fact.unit) fail("V3_CANONICAL_EVIDENCE_CANONICAL_FACT_MISMATCH");
    selected[fact.role] = fact;
  }
  requireValue(Object.keys(selected).length > 0, "V3_CANONICAL_EVIDENCE_REVIEW_MISSING");

  const obligations = rawConflictObligations(selected, context);
  const requiredConflicts = [];
  for (const obligation of obligations) {
    const rawFacts = [...facts.values()].filter(item => item.kind === "raw" && item.role === obligation.raw_role &&
      item.source_key === obligation.source_key && item.raw_value === obligation.raw_value &&
      item.source_row_fingerprint === context.source_row_fingerprint);
    if (rawFacts.length !== 1) fail("V3_CANONICAL_RAW_FACT_BINDING_MISMATCH");
    requiredConflicts.push({ obligation, raw: rawFacts[0] });
  }
  const conflictBindings = new Set();
  for (const conflict of evidence.conflict_records) {
    exactKeys(conflict, ["raw_fact_id", "canonical_fact_id", "classification", "disposition"]);
    if (facts.get(conflict.raw_fact_id)?.kind !== "raw" || !Object.values(selected).some(item => item.selected_fact_id === conflict.canonical_fact_id) || !CONFLICTS.has(conflict.classification) || conflict.disposition !== "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY") fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    const conflictBinding = canonicalJson([conflict.raw_fact_id, conflict.canonical_fact_id]);
    if (conflictBindings.has(conflictBinding)) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
    conflictBindings.add(conflictBinding);
    const required = requiredConflicts.find(item => item.raw.fact_id === conflict.raw_fact_id &&
      item.obligation.selected.selected_fact_id === conflict.canonical_fact_id &&
      item.obligation.classifications.has(conflict.classification));
    if (!required) fail("V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH");
  }
  for (const required of requiredConflicts) {
    const matches = evidence.conflict_records.filter(item => item.raw_fact_id === required.raw.fact_id &&
      item.canonical_fact_id === required.obligation.selected.selected_fact_id &&
      required.obligation.classifications.has(item.classification));
    if (matches.length !== 1) fail("V3_CANONICAL_CONFLICT_RECORD_REQUIRED");
  }

  const review = evidence.evidence_review_decision;
  exactKeys(review, ["decision", "reviewed_fact_ids", "reviewed_by", "reviewed_at", "decision_evidence_sha256"]);
  if (review.decision !== "ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY" || !Array.isArray(review.reviewed_fact_ids) || !review.reviewed_fact_ids.length || !review.reviewed_by || /owner[_ -]?approved|robimy/i.test(review.reviewed_by)) fail("V3_CANONICAL_EVIDENCE_REVIEW_MISSING");
  normalizedTimestamp(review.reviewed_at, "V3_CANONICAL_EVIDENCE_REVIEW_MISSING");
  if (new Date(review.reviewed_at) > new Date(context.authorized_at) || review.reviewed_fact_ids.some(id => !facts.has(id)) ||
      Object.values(selected).some(item => !review.reviewed_fact_ids.includes(item.selected_fact_id))) fail("V3_CANONICAL_EVIDENCE_REVIEW_MISSING");
  const unhashed = structuredClone(evidence); unhashed.evidence_review_decision.decision_evidence_sha256 = null;
  if (review.decision_evidence_sha256 !== sha(unhashed)) fail("V3_CANONICAL_EVIDENCE_HASH_MISMATCH");

  return { contract_version: VERSION, selected_facts: selected, evidence_sha256: sha(evidence) };
}

module.exports = { canonicalEvidenceSha256: sha, validateCanonicalIdentityEvidence };
