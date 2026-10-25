const test = require("node:test");
const assert = require("node:assert/strict");
const { canonicalEvidenceSha256, validateCanonicalIdentityEvidence } = require("./lib/reviewed-catalogue-canonical-evidence");
const { assertV3ActionSemantics } = require("./lib/reviewed-catalogue-v3");
const { validateManifest } = require("./lib/reviewed-catalogue-package");
const { planFingerprint, sourceRowFingerprint } = require("./import-products");

const AUTHORIZED_AT = "2026-10-25T12:00:00.000Z";
const FINGERPRINT = "a".repeat(64);
function derivation(factId, role, operands, normalizedValue, unit, allFacts) {
  const ordered = operands.map(id => {
    const fact = allFacts.find(item => item.fact_id === id);
    return { fact_id: id, normalized_value: fact.normalized_value, unit: fact.unit };
  });
  return {
    fact_id: factId, role, formula_id: "multiply_exact_decimal_v1", operand_fact_ids: operands,
    normalized_value: normalizedValue, unit,
    derivation_sha256: canonicalEvidenceSha256({ formula_id: "multiply_exact_decimal_v1", ordered_operands: ordered, result: normalizedValue, unit }),
  };
}
function fixture({ tongkat = false } = {}) {
  const binding = {
    retailer_id: "15", external_product_id: tongkat ? "7500539297837" : "15640537334134", external_variant_id: tongkat ? "41706864803885" : "57417961668982",
    source_row_fingerprint: FINGERPRINT, brand: tongkat ? "TWP" : "KAYOW", product_identity: tongkat ? "Tongkat Ali" : "Protein Butter Cups",
    external_gtin: null, external_sku: tongkat ? "TA-60" : "KBC-12", package_authorized_at: AUTHORIZED_AT,
  };
  const raw = tongkat
    ? [{ fact_id: "raw-servings", role: "serving_count", raw_value: "60/30 Servings", source_key: "Size", source_row_fingerprint: FINGERPRINT }]
    : [
      { fact_id: "raw-pack-structure", role: "pack_structure", raw_value: "12 x Packs of 2 x 22g Cups", source_key: "Size", source_row_fingerprint: FINGERPRINT },
      { fact_id: "raw-weight", role: "physical_size", raw_value: "265g", source_key: "Weight", source_row_fingerprint: FINGERPRINT },
    ];
  const identity_binding = { brand: binding.brand, product_identity: binding.product_identity, external_gtin: null, external_sku: binding.external_sku, pack_configuration: tongkat ? "60 capsules" : "12 packs x 2 cups x 22g" };
  const external = tongkat ? [{
    fact_id: "manufacturer-count", role: "container_count", normalized_value: "60", unit: "capsules", evidence_source_type: "manufacturer_product_page",
    source_url: "https://manufacturer.example/tongkat", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: { ...identity_binding },
  }] : [
    { fact_id: "cups", role: "piece_count", normalized_value: "2", unit: "pieces", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/cups", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: { ...identity_binding } },
    { fact_id: "cup-size", role: "physical_size", normalized_value: "22", unit: "g", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/cups", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: { ...identity_binding } },
    { fact_id: "packs", role: "pack_count", normalized_value: "12", unit: "packs", evidence_source_type: "manufacturer_label", source_url: "https://manufacturer.example/cups", captured_at: "2026-10-25T10:00:00.000Z", source_content_sha256: "b".repeat(64), identity_binding: { ...identity_binding } },
  ];
  const derived = tongkat ? [] : [
    derivation("pack-size", "physical_size", ["cups", "cup-size"], "44", "g", external),
  ];
  if (!tongkat) derived.push(derivation("total", "total_content", ["packs", "pack-size"], "528", "g", [...external, ...derived]));
  const selected = tongkat
    ? [{ role: "container_count", selected_fact_id: "manufacturer-count", normalized_value: "60", unit: "capsules", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" }]
    : [
      { role: "physical_size", selected_fact_id: "pack-size", normalized_value: "44", unit: "g", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" },
      { role: "pack_count", selected_fact_id: "packs", normalized_value: "12", unit: "packs", evidence_review_decision: "ACCEPT_FOR_CANONICAL_IDENTITY" },
    ];
  const evidence = {
    contract_version: "1", binding, raw_source_facts: raw, external_evidence_facts: external, derived_facts: derived,
    canonical_selected_facts: selected,
    conflict_records: tongkat
      ? [{ raw_fact_id: "raw-servings", canonical_fact_id: "manufacturer-count", classification: "SERVING_COUNT_NOT_CONTAINER_COUNT", disposition: "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY" }]
      : [{ raw_fact_id: "raw-weight", canonical_fact_id: "pack-size", classification: "UNEXPLAINED_CONFLICTING_METADATA", disposition: "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY" }],
    evidence_review_decision: { decision: "ACCEPT_EXACT_FACTS_FOR_CANONICAL_IDENTITY", reviewed_fact_ids: selected.map(item => item.selected_fact_id), reviewed_by: "catalogue-evidence-reviewer:marek", reviewed_at: "2026-10-25T11:00:00.000Z", decision_evidence_sha256: null },
  };
  evidence.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(evidence);
  return evidence;
}
function context(evidence) {
  const b = evidence.binding;
  const tongkat = b.external_product_id === "7500539297837";
  return {
    retailer_id: b.retailer_id, authorized_at: AUTHORIZED_AT, external_product_id: b.external_product_id,
    external_variant_id: b.external_variant_id, source_row_fingerprint: b.source_row_fingerprint,
    brand: b.brand, product_identity: b.product_identity, external_gtin: b.external_gtin, external_sku: b.external_sku,
    external_options: tongkat
      ? { Size: "60/30 Servings" }
      : { Flavour: "Milk Chocolate Hazelnut", Size: "12 x Packs of 2 x 22g Cups", Weight: "265g" },
    option_roles: tongkat
      ? { flavour: null, physical_size: null, count: { source_key: "Size", source_value: "60/30 Servings", count_value: "60/30", count_unit: "servings" } }
      : { flavour: { source_key: "Flavour", source_value: "Milk Chocolate Hazelnut" }, physical_size: { source_key: "Weight", source_value: "265g", size_value: "265", size_unit: "g" }, count: null },
  };
}
function rehash(evidence) { evidence.evidence_review_decision.decision_evidence_sha256 = null; evidence.evidence_review_decision.decision_evidence_sha256 = canonicalEvidenceSha256(evidence); }

function evidenceBackedSourceTemplate({ tongkat = false } = {}) {
  const evidence = fixture({ tongkat });
  evidence.binding.source_row_fingerprint = null;
  for (const fact of evidence.raw_source_facts) fact.source_row_fingerprint = null;
  evidence.evidence_review_decision.decision_evidence_sha256 = null;
  const binding = evidence.binding;
  return {
    retailer_id: binding.retailer_id,
    external_product_id: binding.external_product_id,
    external_variant_id: binding.external_variant_id,
    external_sku: binding.external_sku,
    external_options: context(evidence).external_options,
    brand: binding.brand,
    product_name: binding.product_identity,
    price: "19.99",
    in_stock: true,
    __reviewed_catalogue_identity: {
      contract: "reviewed-catalogue-package-v3",
      source_row_fingerprint: null,
      canonical_identity_evidence: evidence,
    },
  };
}

function finalizeEvidenceBackedSource(row) {
  const finalized = structuredClone(row);
  const sourceFingerprint = sourceRowFingerprint(finalized);
  const identity = finalized.__reviewed_catalogue_identity;
  const evidence = identity.canonical_identity_evidence;
  identity.source_row_fingerprint = sourceFingerprint;
  evidence.binding.source_row_fingerprint = sourceFingerprint;
  for (const fact of evidence.raw_source_facts) fact.source_row_fingerprint = sourceFingerprint;
  rehash(evidence);
  return { finalized, sourceFingerprint };
}

test("TWP and KAYOW evidence finalize in one deterministic source and plan fingerprint pass", () => {
  for (const tongkat of [true, false]) {
    const { finalized, sourceFingerprint } = finalizeEvidenceBackedSource(evidenceBackedSourceTemplate({ tongkat }));
    const evidence = finalized.__reviewed_catalogue_identity.canonical_identity_evidence;
    const decisionHash = evidence.evidence_review_decision.decision_evidence_sha256;
    const validationContext = context(evidence);
    validationContext.source_row_fingerprint = sourceFingerprint;

    assert.equal(sourceRowFingerprint(finalized), sourceFingerprint);
    assert.doesNotThrow(() => validateCanonicalIdentityEvidence(evidence, validationContext));
    const repeatedEvidence = structuredClone(evidence);
    rehash(repeatedEvidence);
    assert.equal(repeatedEvidence.evidence_review_decision.decision_evidence_sha256, decisionHash);

    const plan = {
      meta: { source_row_fingerprint: sourceFingerprint, plan_fingerprint: null },
      product_variant: { evidence },
    };
    assert.equal(planFingerprint(structuredClone(plan)), planFingerprint(plan));
    assert.equal(sourceRowFingerprint(finalized), sourceFingerprint);
  }
});

test("source fingerprint still binds every material canonical-evidence dimension", () => {
  const { finalized, sourceFingerprint } = finalizeEvidenceBackedSource(evidenceBackedSourceTemplate());
  const mutations = [
    row => { row.external_options.Weight = "266g"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.raw_source_facts[0].raw_value = "11 x Packs of 2 x 22g Cups"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.raw_source_facts[0].source_key = "Pack"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].normalized_value = "3"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].evidence_source_type = "manufacturer_product_page"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].source_url += "?changed=1"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].captured_at = "2026-10-25T10:01:00.000Z"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].source_content_sha256 = "c".repeat(64); },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].identity_binding.pack_configuration = "11 packs x 2 cups x 22g"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.derived_facts[0].operand_fact_ids = ["packs", "cup-size"]; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.derived_facts[0].formula_id = "different_formula"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.derived_facts[0].normalized_value = "45"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.derived_facts[0].derivation_sha256 = "c".repeat(64); },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.canonical_selected_facts[0].normalized_value = "45"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.conflict_records[0].classification = "DIFFERENT_CONFLICT"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.conflict_records[0].disposition = "REJECT"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.evidence_review_decision.reviewed_by = "catalogue-evidence-reviewer:other"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.evidence_review_decision.reviewed_at = "2026-10-25T11:01:00.000Z"; },
    row => { row.__reviewed_catalogue_identity.canonical_identity_evidence.binding.package_authorized_at = "2026-10-25T12:01:00.000Z"; },
    row => { row.external_product_id = "different-product"; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(finalized);
    mutate(changed);
    assert.notEqual(sourceRowFingerprint(changed), sourceFingerprint);
  }

  const { finalized: tongkat, sourceFingerprint: tongkatFingerprint } = finalizeEvidenceBackedSource(evidenceBackedSourceTemplate({ tongkat: true }));
  tongkat.__reviewed_catalogue_identity.canonical_identity_evidence.external_evidence_facts[0].normalized_value = "61";
  assert.notEqual(sourceRowFingerprint(tongkat), tongkatFingerprint);
});

test("self-reference normalization does not weaken full evidence validation or plan binding", () => {
  const { finalized, sourceFingerprint } = finalizeEvidenceBackedSource(evidenceBackedSourceTemplate());
  const evidence = finalized.__reviewed_catalogue_identity.canonical_identity_evidence;
  const validationContext = context(evidence);
  validationContext.source_row_fingerprint = sourceFingerprint;
  const originalPlan = { meta: { source_row_fingerprint: sourceFingerprint, plan_fingerprint: null }, product_variant: { evidence } };

  const wrongBinding = structuredClone(finalized);
  wrongBinding.__reviewed_catalogue_identity.canonical_identity_evidence.binding.source_row_fingerprint = "9".repeat(64);
  assert.equal(sourceRowFingerprint(wrongBinding), sourceFingerprint);
  assert.throws(
    () => validateCanonicalIdentityEvidence(wrongBinding.__reviewed_catalogue_identity.canonical_identity_evidence, validationContext),
    /V3_CANONICAL_EVIDENCE_BINDING_MISMATCH/,
  );

  const wrongRawFact = structuredClone(finalized);
  wrongRawFact.__reviewed_catalogue_identity.canonical_identity_evidence.raw_source_facts[0].source_row_fingerprint = "8".repeat(64);
  assert.equal(sourceRowFingerprint(wrongRawFact), sourceFingerprint);
  assert.throws(
    () => validateCanonicalIdentityEvidence(wrongRawFact.__reviewed_catalogue_identity.canonical_identity_evidence, validationContext),
    /V3_CANONICAL_EVIDENCE_BINDING_MISMATCH/,
  );

  const wrongDecisionHash = structuredClone(finalized);
  wrongDecisionHash.__reviewed_catalogue_identity.canonical_identity_evidence.evidence_review_decision.decision_evidence_sha256 = "7".repeat(64);
  assert.equal(sourceRowFingerprint(wrongDecisionHash), sourceFingerprint);
  assert.throws(
    () => validateCanonicalIdentityEvidence(wrongDecisionHash.__reviewed_catalogue_identity.canonical_identity_evidence, validationContext),
    /V3_CANONICAL_EVIDENCE_HASH_MISMATCH/,
  );
  const changedPlan = structuredClone(originalPlan);
  changedPlan.product_variant.evidence = wrongDecisionHash.__reviewed_catalogue_identity.canonical_identity_evidence;
  assert.notEqual(planFingerprint(changedPlan), planFingerprint(originalPlan));

  const unknownField = structuredClone(finalized);
  unknownField.__reviewed_catalogue_identity.canonical_identity_evidence.future_unreviewed_field = true;
  assert.notEqual(sourceRowFingerprint(unknownField), sourceFingerprint);
  assert.throws(
    () => validateCanonicalIdentityEvidence(unknownField.__reviewed_catalogue_identity.canonical_identity_evidence, validationContext),
    /V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH/,
  );

  const otherVariant = structuredClone(finalized);
  otherVariant.external_variant_id = "different-variant";
  assert.notEqual(sourceRowFingerprint(otherVariant), sourceFingerprint);
  assert.throws(
    () => validateCanonicalIdentityEvidence(evidence, { ...validationContext, external_variant_id: "different-variant" }),
    /V3_CANONICAL_EVIDENCE_BINDING_MISMATCH/,
  );
});

function reviewedRow(evidence, { tongkat = false } = {}) {
  return {
    review_row: 1, external_product_id: evidence.binding.external_product_id,
    external_variant_id: evidence.binding.external_variant_id, external_sku: evidence.binding.external_sku,
    external_gtin: evidence.binding.external_gtin,
    external_url: `https://example.myshopify.com/products/item?variant=${evidence.binding.external_variant_id}`,
    affiliate_url: `https://example.myshopify.com/products/item?variant=${evidence.binding.external_variant_id}`,
    product_id: null, product_variant_id: null,
    action: tongkat ? "create_product_with_default_variant" : "create_product_with_variant",
    brand: evidence.binding.brand, category: "Supplements", product_name: evidence.binding.product_identity,
    variant_name: tongkat ? "Default" : "Milk Chocolate Hazelnut", flavour: tongkat ? null : "Milk Chocolate Hazelnut",
    size_value: tongkat ? null : 44, size_unit: tongkat ? null : "g", pack_count: tongkat ? 1 : 12,
    product_format: tongkat ? "capsule" : "bar", price: 10, in_stock: true,
    source_row_fingerprint: FINGERPRINT, plan_fingerprint: "a".repeat(32),
    external_options: tongkat
      ? { Size: "60/30 Servings" }
      : { Flavour: "Milk Chocolate Hazelnut", Size: "12 x Packs of 2 x 22g Cups", Weight: "265g" },
    option_roles: tongkat
      ? { flavour: null, physical_size: null, count: { source_key: "Size", source_value: "60/30 Servings", count_value: "60/30", count_unit: "servings" } }
      : { flavour: { source_key: "Flavour", source_value: "Milk Chocolate Hazelnut" }, physical_size: { source_key: "Weight", source_value: "265g", size_value: "265", size_unit: "g" }, count: null },
    source_structure: tongkat
      ? { product_variant_count: 1, meaningful_variant_axes: [] }
      : { product_variant_count: 5, meaningful_variant_axes: ["flavour"] },
    ...(tongkat ? { unit_count: 60, unit_type: "capsules" } : {}),
    canonical_identity_evidence: evidence,
  };
}

function reviewedManifest(row) {
  return {
    schema_version: 3, kind: "reviewed-catalogue-package-v3", source_platform: "shopify",
    status: "OWNER_APPROVED", authorized_by: "owner:marek", authorized_at: AUTHORIZED_AT,
    target_environment: "STAGING", target_project_ref: "hxnrsyyqffztlvcrtgbf",
    retailer: { id: 15, name: "Example", slug: "example", website: "https://example.myshopify.com", expected_action: "existing", shipping_known: true, shipping_cost: 0 },
    policy: { reviewed_rows_only: true, allow_product_creation: true, allow_variant_creation: true, allow_canonical_product_updates: false, allow_canonical_variant_updates: false, allow_canonical_gtin_updates: false, allow_category_changes: false, sku_is_not_gtin: true, one_plan_at_a_time: true, fresh_single_use_approval_per_plan: true, strict_production_readback_after_each_apply: true },
    profiles: [{ id: "bypass-proof", status: "DRY_RUN_PASS", csv_path: "tmp/retailer-feeds/example.csv", csv_sha256: "b".repeat(64), artifact_path: "tmp/retailer-feeds/example.json", artifact_sha256: "c".repeat(64), row_count: 1, blocked_row_count: 0, conflict_count: 0, expected_actions: { retailers_create: 0, products_create: 1, product_variants_create: 1, retailer_products_create: 1, offers_create: 1, price_history_create: 1 }, rows: [row] }],
  };
}

test("fails closed: omitted physical raw fact and conflict cannot pass any JavaScript path", () => {
  const evidence = fixture(); evidence.raw_source_facts = []; evidence.conflict_records = []; rehash(evidence);
  assert.throws(() => validateCanonicalIdentityEvidence(evidence, context(evidence)), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
  assert.throws(() => assertV3ActionSemantics(reviewedRow(evidence), { retailer_id: "15", authorized_at: AUTHORIZED_AT }), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
  assert.throws(() => validateManifest(reviewedManifest(reviewedRow(evidence)), "bypass-proof"), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
});

test("fails closed: omitted serving raw fact and conflict cannot pass any JavaScript path", () => {
  const evidence = fixture({ tongkat: true }); evidence.raw_source_facts = []; evidence.conflict_records = []; rehash(evidence);
  assert.throws(() => validateCanonicalIdentityEvidence(evidence, context(evidence)), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
  assert.throws(() => assertV3ActionSemantics(reviewedRow(evidence, { tongkat: true }), { retailer_id: "15", authorized_at: AUTHORIZED_AT }), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
  assert.throws(() => validateManifest(reviewedManifest(reviewedRow(evidence, { tongkat: true })), "bypass-proof"), /V3_CANONICAL_RAW_FACT_BINDING_MISMATCH/);
});

test("projects nested multipack canonical facts and total deterministically", () => {
  const evidence = fixture();
  const result = validateCanonicalIdentityEvidence(evidence, context(evidence));
  assert.equal(result.selected_facts.physical_size.normalized_value, "44");
  assert.equal(evidence.derived_facts[1].normalized_value, "528");
});
test("projects serving text to an evidence-backed container count without rewriting raw facts", () => {
  const evidence = fixture({ tongkat: true });
  assert.equal(validateCanonicalIdentityEvidence(evidence, context(evidence)).selected_facts.container_count.unit, "capsules");
  assert.equal(evidence.raw_source_facts[0].raw_value, "60/30 Servings");
});
test("absence preserves the legacy V3 path", () => assert.equal(validateCanonicalIdentityEvidence(null, {}), null));
test("V3 semantics accept evidence projection but retain exact raw option roles", () => {
  const evidence = fixture();
  assert.doesNotThrow(() => assertV3ActionSemantics(reviewedRow(evidence), { retailer_id: "15", authorized_at: AUTHORIZED_AT }));
});
for (const [name, mutate, code] of [
  ["unknown version", e => { e.contract_version = "2"; }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
  ["row binding drift", e => { e.binding.external_variant_id = "999"; }, "V3_CANONICAL_EVIDENCE_BINDING_MISMATCH"],
  ["missing content hash", e => { e.external_evidence_facts[0].source_content_sha256 = ""; rehash(e); }, "V3_CANONICAL_EVIDENCE_HASH_MISMATCH"],
  ["arithmetic drift", e => { e.derived_facts[0].normalized_value = "45"; rehash(e); }, "V3_CANONICAL_DERIVATION_MISMATCH"],
  ["missing conflict", e => { e.conflict_records = []; rehash(e); }, "V3_CANONICAL_CONFLICT_RECORD_REQUIRED"],
  ["business approval is not evidence review", e => { e.evidence_review_decision.reviewed_by = "OWNER_APPROVED"; rehash(e); }, "V3_CANONICAL_EVIDENCE_REVIEW_MISSING"],
]) test(`fails closed: ${name}`, () => {
  const evidence = fixture(); mutate(evidence);
  assert.throws(() => validateCanonicalIdentityEvidence(evidence, context(fixture())), new RegExp(code));
});

test("all five flavour rows retain distinct immutable row bindings", () => {
  const variants = [
    ["57417961668982", "Milk Chocolate Hazelnut", true],
    ["57417961701750", "Milk Chocolate Cinnamon", false],
    ["57417961734518", "Milk Chocolate Cookies & Cream", true],
    ["57417961767286", "Milk Chocolate Salted Caramel", true],
    ["57417961800054", "Milk Chocolate", true],
  ];
  for (const [variantId, flavour, inStock] of variants) {
    const evidence = fixture();
    evidence.binding.external_variant_id = variantId;
    evidence.binding.product_identity = `Protein Butter Cups / ${flavour}`;
    for (const fact of evidence.external_evidence_facts) fact.identity_binding.product_identity = evidence.binding.product_identity;
    for (const fact of evidence.raw_source_facts) fact.source_row_fingerprint = evidence.binding.source_row_fingerprint;
    rehash(evidence);
    const exactContext = context(evidence);
    exactContext.external_options.Flavour = flavour;
    exactContext.option_roles.flavour = { source_key: "Flavour", source_value: flavour };
    assert.equal(validateCanonicalIdentityEvidence(evidence, exactContext).selected_facts.physical_size.normalized_value, "44");
    assert.equal(typeof inStock, "boolean");
  }
});

test("manufacturer plus independent retailer may corroborate a no-GTIN exact product", () => {
  const evidence = fixture({ tongkat: true });
  const peer = structuredClone(evidence.external_evidence_facts[0]);
  peer.fact_id = "independent-count";
  peer.evidence_source_type = "independent_exact_retailer";
  peer.source_url = "https://independent.example/exact-item";
  peer.source_content_sha256 = "c".repeat(64);
  evidence.external_evidence_facts.push(peer);
  evidence.evidence_review_decision.reviewed_fact_ids.push(peer.fact_id);
  rehash(evidence);
  assert.equal(validateCanonicalIdentityEvidence(evidence, context(evidence)).selected_facts.container_count.normalized_value, "60");
});

test("legacy raw-role paths remain unchanged for clean multipacks and serving products", () => {
  for (const reviewed of [
    { product_name: "PER4M", product_format: "bar", size_value: "62", size_unit: "g", pack_count: "12", raw: "62g" },
    { product_name: "CNP ProDough", product_format: "bar", size_value: "60", size_unit: "g", pack_count: "12", raw: "60g" },
    { product_name: "ABE RTD", product_format: "liquid", size_value: "330", size_unit: "ml", pack_count: "12", raw: "330ml" },
    { product_name: "Grenade Soft Core", product_format: "bar", size_value: "50", size_unit: "g", pack_count: "12", raw: "50g" },
  ]) assert.doesNotThrow(() => assertV3ActionSemantics({
    action: "map_existing_variant", external_product_id: "100", external_variant_id: "101", source_row_fingerprint: FINGERPRINT,
    external_sku: null, external_gtin: null, brand: "Example", product_name: reviewed.product_name, flavour: "Chocolate",
    external_options: { Flavour: "Chocolate", Size: reviewed.raw },
    option_roles: { flavour: { source_key: "Flavour", source_value: "Chocolate" }, physical_size: { source_key: "Size", source_value: reviewed.raw, size_value: reviewed.size_value, size_unit: reviewed.size_unit }, count: null },
    source_structure: { product_variant_count: 2, meaningful_variant_axes: ["flavour"] },
    size_value: reviewed.size_value, size_unit: reviewed.size_unit, pack_count: reviewed.pack_count, product_format: reviewed.product_format,
  }));
  assert.doesNotThrow(() => assertV3ActionSemantics({
    action: "create_product_with_default_variant", external_product_id: "100", external_variant_id: "101", source_row_fingerprint: FINGERPRINT,
    external_sku: null, external_gtin: null, brand: "Example", product_name: "Serving Product", flavour: null,
    external_options: { Size: "30 Servings" }, option_roles: { flavour: null, physical_size: null, count: { source_key: "Size", source_value: "30 Servings", count_value: "30", count_unit: "servings" } },
    source_structure: { product_variant_count: 1, meaningful_variant_axes: [] }, size_value: null, size_unit: null, pack_count: "1", product_format: "powder", unit_count: "30", unit_type: "servings",
  }));
});

for (const [name, build, mutate, code] of [
  ["claim without operands", () => fixture(), e => { e.derived_facts[0].operand_fact_ids = []; rehash(e); }, "V3_CANONICAL_DERIVATION_MISMATCH"],
  ["decimal pack count", () => fixture(), e => { e.external_evidence_facts[2].normalized_value = "12.5"; rehash(e); }, "V3_CANONICAL_DERIVATION_MISMATCH|V3_CANONICAL_EVIDENCE_AMBIGUOUS"],
  ["inconsistent physical unit", () => fixture(), e => { e.derived_facts[0].unit = "ml"; rehash(e); }, "V3_CANONICAL_DERIVATION_MISMATCH"],
  ["different pack configuration", () => fixture(), e => { e.external_evidence_facts[0].identity_binding.pack_configuration = "single cup"; rehash(e); }, "V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH"],
  ["sibling product identity", () => fixture(), e => { e.external_evidence_facts[0].identity_binding.product_identity = "Sibling Product"; rehash(e); }, "V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH"],
  ["different exact SKU", () => fixture({ tongkat: true }), e => { e.external_evidence_facts[0].identity_binding.external_sku = "OTHER"; rehash(e); }, "V3_CANONICAL_EVIDENCE_IDENTITY_MISMATCH"],
  ["conflicting authoritative sources", () => fixture({ tongkat: true }), e => { const peer = structuredClone(e.external_evidence_facts[0]); peer.fact_id = "retailer-count"; peer.normalized_value = "90"; peer.evidence_source_type = "independent_exact_retailer"; peer.source_url = "https://retailer.example/item"; e.external_evidence_facts.push(peer); rehash(e); }, "V3_CANONICAL_EVIDENCE_(AMBIGUOUS|SOURCE_NOT_ADMISSIBLE)"],
  ["capture after authorization", () => fixture(), e => { e.external_evidence_facts[0].captured_at = "2026-10-25T13:00:00.000Z"; rehash(e); }, "V3_CANONICAL_EVIDENCE_BINDING_MISMATCH"],
  ["duplicate fact id", () => fixture(), e => { e.external_evidence_facts[1].fact_id = e.external_evidence_facts[0].fact_id; rehash(e); }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
  ["duplicate selected role", () => fixture(), e => { e.canonical_selected_facts.push(structuredClone(e.canonical_selected_facts[0])); rehash(e); }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
  ["unsupported formula", () => fixture(), e => { e.derived_facts[0].formula_id = "multiply_unreviewed_v2"; rehash(e); }, "V3_CANONICAL_DERIVATION_MISMATCH"],
  ["unknown field", () => fixture(), e => { e.owner_override = true; rehash(e); }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
  ["selected fact omitted from evidence review", () => fixture(), e => { e.evidence_review_decision.reviewed_fact_ids = ["pack-size"]; rehash(e); }, "V3_CANONICAL_EVIDENCE_REVIEW_MISSING"],
  ["Tongkat missing cross-role conflict", () => fixture({ tongkat: true }), e => { e.conflict_records = []; rehash(e); }, "V3_CANONICAL_CONFLICT_RECORD_REQUIRED"],
  ["wrong raw source key", () => fixture(), e => { e.raw_source_facts.find(f => f.fact_id === "raw-weight").source_key = "Size"; rehash(e); }, "V3_CANONICAL_RAW_FACT_BINDING_MISMATCH"],
  ["wrong raw value", () => fixture(), e => { e.raw_source_facts.find(f => f.fact_id === "raw-weight").raw_value = "264g"; rehash(e); }, "V3_CANONICAL_RAW_FACT_BINDING_MISMATCH"],
  ["wrong raw role", () => fixture(), e => { e.raw_source_facts.find(f => f.fact_id === "raw-weight").role = "pack_structure"; rehash(e); }, "V3_CANONICAL_RAW_FACT_BINDING_MISMATCH"],
  ["wrong raw source-row fingerprint", () => fixture(), e => { e.raw_source_facts.find(f => f.fact_id === "raw-weight").source_row_fingerprint = "d".repeat(64); rehash(e); }, "V3_CANONICAL_EVIDENCE_BINDING_MISMATCH"],
  ["duplicate raw fact for one source option", () => fixture(), e => { const duplicate = structuredClone(e.raw_source_facts.find(f => f.fact_id === "raw-weight")); duplicate.fact_id = "raw-weight-duplicate"; e.raw_source_facts.push(duplicate); rehash(e); }, "V3_CANONICAL_RAW_FACT_BINDING_MISMATCH"],
  ["physical raw fact omitted but unrelated raw fact remains", () => fixture(), e => { e.raw_source_facts = e.raw_source_facts.filter(f => f.fact_id !== "raw-weight"); e.conflict_records = []; rehash(e); }, "V3_CANONICAL_RAW_FACT_BINDING_MISMATCH"],
  ["conflict points to another source option", () => fixture(), e => { e.conflict_records[0].raw_fact_id = "raw-pack-structure"; rehash(e); }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
  ["orphan conflict", () => fixture(), e => { e.conflict_records.push({ raw_fact_id: "raw-pack-structure", canonical_fact_id: "packs", classification: "PACK_CONFIGURATION_CONFLICT", disposition: "PRESERVE_RAW_DO_NOT_USE_FOR_CANONICAL_IDENTITY" }); rehash(e); }, "V3_CANONICAL_EVIDENCE_SCHEMA_MISMATCH"],
]) test(`fails closed: ${name}`, () => {
  const evidence = build();
  const expectedContext = context(evidence);
  mutate(evidence);
  assert.throws(() => validateCanonicalIdentityEvidence(evidence, expectedContext), new RegExp(code));
});

test("matching authoritative physical role does not require a false conflict", () => {
  const evidence = fixture();
  const rawWeight = evidence.raw_source_facts.find(fact => fact.fact_id === "raw-weight");
  rawWeight.raw_value = "44g";
  evidence.conflict_records = [];
  rehash(evidence);
  const exactContext = context(evidence);
  exactContext.external_options.Weight = "44g";
  exactContext.option_roles.physical_size = { source_key: "Weight", source_value: "44g", size_value: "44", size_unit: "g" };
  assert.doesNotThrow(() => validateCanonicalIdentityEvidence(evidence, exactContext));
});

test("evidence cannot be rebound to another product, variant, or source row", () => {
  for (const changed of ["external_product_id", "external_variant_id", "source_row_fingerprint"]) {
    const evidence = fixture();
    const expectedContext = context(evidence);
    evidence.binding[changed] = changed === "source_row_fingerprint" ? "d".repeat(64) : "999";
    rehash(evidence);
    assert.throws(() => validateCanonicalIdentityEvidence(evidence, expectedContext), /V3_CANONICAL_EVIDENCE_BINDING_MISMATCH/);
  }
});

test("target projection mutation remains a hard failure", () => {
  const evidence = fixture();
  const reviewed = reviewedRow(evidence);
  reviewed.size_value = 45;
  assert.throws(() => assertV3ActionSemantics(reviewed, { retailer_id: "15", authorized_at: AUTHORIZED_AT }), /V3 physical size role mismatch/);
});
