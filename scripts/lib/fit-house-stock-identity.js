// Adapter safety checks only. No fetching, classification engine, approvals or writes.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('./shopify-snapshot-reader');
const { projectShopifyCanonicalRecords } = require('./shopify-snapshot-reader');
const { normalizeFlavour, parseVariantIdentity, parseSize } = require('./feed-variant-guards');
const evidencePath = path.resolve(__dirname, '../../config/retailers/fit-house-owner-source-decisions-2026-11-10.json');
const EVIDENCE_SHA = '6b6dad2dbe99bf512e7f62eb39bb854e5f357ddeb2577888b034eca691c8b29a';
const text = fs.readFileSync(evidencePath, 'utf8').replaceAll('\r\n', '\n');
if (sha256(text) !== EVIDENCE_SHA) throw Error('OWNER_SOURCE_DECISION_EVIDENCE_DRIFT');
const decisions = JSON.parse(text);
const IDENTITY_REASONS = Object.freeze(['OWNER_HOLD', 'SOURCE_VARIANT_FLAVOUR_CONFLICT', 'SOURCE_VARIANT_FLAVOUR_EVIDENCE_CONFLICT', 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED', 'CANONICAL_VARIANT_FLAVOUR_CONFLICT']);
const applies = config => String(config.retailer_id) === decisions.retailer_id && config.retailer_slug === decisions.retailer_slug;
function invariant(ok, code) { if (!ok) { const error = Error(code); error.code = code; throw error; } }
function assertBinding(record, decision) {
  const actual = { offer_id: record.offer.id, mapping_id: record.mapping.id, product_id: record.offer.product_id, variant_id: record.offer.product_variant_id, external_product_id: record.mapping.external_product_id, external_variant_id: record.mapping.external_variant_id };
  for (const key of Object.keys(actual)) invariant(String(actual[key]) === decision[key], 'OWNER_SOURCE_DECISION_BINDING_DRIFT');
  invariant(String(record.mapping.product_id) === decision.product_id && String(record.mapping.product_variant_id) === decision.variant_id && String(record.offer.retailer_id) === decisions.retailer_id, 'OWNER_SOURCE_DECISION_BINDING_DRIFT');
  invariant(String(record.variant.id) === decision.variant_id && String(record.mapping.retailer_id) === decisions.retailer_id, 'OWNER_SOURCE_DECISION_BINDING_DRIFT');
}
function expectedFlavour(record) {
  const mapping = parseVariantIdentity({ external_options: record.mapping.external_options }).flavour;
  const canonical = normalizeFlavour(record.variant.flavour_label || record.variant.flavour_code || '');
  return { mapping, canonical, value: canonical || mapping, known: Boolean(mapping || canonical) || ['flavour_label', 'flavour_code'].every(key => Object.hasOwn(record.variant, key) && record.variant[key] !== undefined), conflict: Boolean(mapping && canonical && mapping !== canonical) };
}
function sourceFlavour(source, expected) {
  if (!source) return { value: null, conflict: false };
  const explicit = parseVariantIdentity({ external_options: source.external_options }).flavour;
  const title = normalizeFlavour(source.variant_name || '');
  // A title containing a size or no recognized flavour is not proof of a flavour.
  const titleEvidence = title && title !== 'default title' && !parseSize(title) && parseVariantIdentity({ product_name: title }).flavour ? title : null;
  return { value: explicit || (title === expected ? title : titleEvidence), conflict: Boolean(explicit && titleEvidence && explicit !== titleEvidence), option: explicit, title: titleEvidence };
}
function assess(record, sourceRecord, { fingerprint, capturedAt, sourceStock, sourcePrice }) {
  const expected = expectedFlavour(record), flavourEvidence = sourceFlavour(sourceRecord, expected.value), observed = flavourEvidence.value;
  let reason = expected.conflict ? 'CANONICAL_VARIANT_FLAVOUR_CONFLICT'
    : flavourEvidence.conflict ? 'SOURCE_VARIANT_FLAVOUR_EVIDENCE_CONFLICT'
      : expected.value && observed && expected.value !== observed ? 'SOURCE_VARIANT_FLAVOUR_CONFLICT'
      : !expected.known || (expected.value && !observed) || (!expected.value && observed) ? 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED' : null;
  if (sourceRecord) invariant(String(sourceRecord.external_product_id) === String(record.mapping.external_product_id) && String(sourceRecord.external_variant_id) === String(record.mapping.external_variant_id), 'STOCK_IDENTITY_SOURCE_BINDING_DRIFT');
  let observation = null;
  if (reason === 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED') {
    observation = decisions.identity_observations.find(row => row.offer_id === String(record.offer.id));
    if (observation) {
      assertBinding(record, observation);
      if (observation.source_fingerprint === fingerprint && String(capturedAt || '').slice(0, 10) === observation.observed_on
        && sourceStock === observation.source_in_stock && Number(sourcePrice) === Number(observation.price)
        && expected.value === normalizeFlavour(observation.expected_flavour)) reason = null;
      else observation = null;
    }
  }
  const hold = decisions.holds.find(row => row.offer_id === String(record.offer.id));
  if (hold) {
    assertBinding(record, hold);
    invariant(record.offer.in_stock === hold.required_in_stock, 'OWNER_HOLD_STATE_DRIFT');
  }
  return {
    reason: hold ? 'OWNER_HOLD' : reason,
    evidence: { status: hold ? 'OWNER_HOLD' : reason ? 'UNVERIFIED' : 'VERIFIED', technical_reason: reason,
      expected_flavour: expected.value || null, observed_flavour: observed || null,
      ...(flavourEvidence.conflict ? { conflicting_source_flavours: { option: flavourEvidence.option, title: flavourEvidence.title } } : {}),
      source_record: sourceRecord || null, source_variant_present: sourceRecord === undefined ? false : sourceRecord ? true : null,
      source_fingerprint: fingerprint, source_captured_at: capturedAt,
      owner_decision_sha256: EVIDENCE_SHA, owner_hold: hold ? structuredClone(hold) : null,
      owner_identity_observation: observation ? { offer_id: observation.offer_id, authority_scope: observation.authority_scope, observed_on: observation.observed_on } : null },
  };
}
function guardClassification(classification, { config, records, snapshot, sourceVariants = [] }) {
  if (!applies(config)) return classification;
  invariant(config.manifest_sha256 === decisions.approved_manifest_sha256, 'OWNER_SOURCE_DECISION_CATALOGUE_DRIFT');
  const canonical = new Map(projectShopifyCanonicalRecords(snapshot).map(row => [row.external_variant_id, row]));
  const byOffer = new Map(records.map(record => [String(record.offer.id), record]));
  const byVariant = new Map(sourceVariants.map(row => [String(row.external_variant_id), row]));
  const guard = row => {
    const hold = decisions.holds.some(item => item.offer_id === String(row.offer_id));
    if (!hold && !row.changed_fields?.stock && !canonical.has(String(row.external_variant_id))) return row;
    const record = byOffer.get(String(row.offer_id)); invariant(record, 'STOCK_IDENTITY_TARGET_MISSING');
    // Preserve separately approved absence semantics; this check concerns present variants.
    const original = byVariant.get(String(row.external_variant_id));
    if (!hold && !canonical.has(String(row.external_variant_id)) && (original?.audited_source_absent || original?.owner_approved_source_absent)) return row;
    const result = assess(record, canonical.get(String(row.external_variant_id)), { fingerprint: snapshot.semantic_source_fingerprint, capturedAt: snapshot.captured_at || row.source_captured_at, sourceStock: row.source?.in_stock, sourcePrice: row.source?.price });
    if (!hold && !row.changed_fields?.stock && !['SOURCE_VARIANT_FLAVOUR_CONFLICT', 'SOURCE_VARIANT_FLAVOUR_EVIDENCE_CONFLICT', 'CANONICAL_VARIANT_FLAVOUR_CONFLICT'].includes(result.reason)) return row;
    if (row.reason === 'SOURCE_VARIANT_MISSING' && !canonical.has(String(row.external_variant_id))) result.evidence.technical_reason = row.reason;
    if (!result.reason) return { ...row, identity_evidence: result.evidence };
    return { ...row, action: 'BLOCK_IDENTITY_DRIFT', reason: result.reason,
      changed_fields: { price: false, stock: false, url: false, blocked: true }, identity_evidence: result.evidence };
  };
  const rows = (classification.rows || []).map(guard), held = rows.filter(row => IDENTITY_REASONS.includes(row.reason));
  const review = [...(classification.quarantined_rows || []).map(guard), ...held];
  return { ...classification, state: classification.state === 'DRY_RUN_READY' && review.length ? 'DRY_RUN_READY_WITH_REVIEW' : classification.state,
    rows: rows.filter(row => !held.includes(row)), quarantined_rows: review,
    deferred_changed_offer_ids: (classification.deferred_changed_offer_ids || []).filter(id => !review.some(row => String(row.offer_id) === String(id) && IDENTITY_REASONS.includes(row.reason))) };
}
function assertNoHeldExecution(config, artifacts) {
  if (!applies(config)) return;
  const held = new Set(decisions.holds.map(row => row.offer_id));
  invariant(!artifacts.some(artifact => artifact.rows.some(row => held.has(String(row.offer_id)))), 'OWNER_HOLD_EXECUTION_BLOCKED');
}
function reviewCard(beforeState, changed, context) {
  const { offer, mapping, variant = {}, sourceFingerprint, sourceCapturedAt } = context;
  const proof = changed.identity_evidence;
  const sourceRecord = proof?.source_fingerprint === sourceFingerprint ? proof.source_record : null;
  const result = assess({ offer, mapping, variant }, sourceRecord || null,
    { fingerprint: sourceFingerprint, capturedAt: sourceCapturedAt, sourceStock: changed.new_stock, sourcePrice: changed.new_price });
  if (result.reason === 'OWNER_HOLD' && proof?.source_fingerprint === sourceFingerprint && proof.source_variant_present === false) result.evidence.technical_reason = 'SOURCE_VARIANT_MISSING';
  if (proof && (proof.source_fingerprint !== sourceFingerprint || (changed.action === 'UPDATE_STOCK' && sourceRecord
    && (sourceRecord.in_stock !== changed.new_stock || Number(sourceRecord.price) !== Number(changed.new_price))))) {
    result.reason = result.reason === 'OWNER_HOLD' ? result.reason : 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED';
    result.evidence.status = result.reason === 'OWNER_HOLD' ? 'OWNER_HOLD' : 'UNVERIFIED';
    result.evidence.technical_reason = 'SOURCE_IDENTITY_PROVENANCE_MISMATCH';
  }
  // A producer's conflict cannot become commercial because a publication context lacks details.
  const reason = result.reason === 'OWNER_HOLD' ? result.reason : changed.action === 'SOURCE_MISSING' ? 'SOURCE_VARIANT_MISSING'
    : result.reason || (IDENTITY_REASONS.includes(changed.evidence_reason) ? changed.evidence_reason : null);
  if (reason || changed.action !== 'UPDATE_STOCK') return {
    proposedState: { catalogue_action: 'KEEP_UNCHANGED', identity_review: 'READ_ONLY', automatic_action: false },
    reasonCodes: reason === 'OWNER_HOLD' ? 'POLICY_REVIEW' : changed.action === 'SOURCE_MISSING' ? 'SOURCE_MISSING' : 'IDENTITY_CONFLICT',
    confidence: 'LOW', sourcePrice: null, reviewKind: reason === 'OWNER_HOLD' ? 'POLICY_REVIEW' : 'IDENTITY_CONFLICT',
    operationType: reason === 'OWNER_HOLD' ? 'MANUAL_REVIEW' : 'MANUAL_REVIEW_IDENTITY',
    evidenceReason: reason || changed.evidence_reason || changed.reason, identityEvidence: result.evidence,
  };
  return { proposedState: { ...beforeState, in_stock: changed.new_stock }, reasonCodes: 'STOCK_CHANGE', confidence: 'HIGH', sourcePrice: changed.new_price,
    reviewKind: 'COMMERCIAL_CHANGE', operationType: 'UPDATE_STOCK', evidenceReason: changed.evidence_reason, identityEvidence: result.evidence };
}
function adapterFingerprint(config) {
  return applies(config) ? { stock_identity_guard: sha256(fs.readFileSync(__filename, 'utf8').replaceAll('\r\n', '\n')), owner_source_decisions: EVIDENCE_SHA } : {};
}
module.exports = { EVIDENCE_SHA, IDENTITY_REASONS, assess, guardClassification, assertNoHeldExecution, reviewCard, adapterFingerprint };
