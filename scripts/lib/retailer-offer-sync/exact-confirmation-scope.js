const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalJson } = require('../canonical-json');
const { canonicalizeTimestamps, timestampEpochNanoseconds } = require('../canonical-timestamp');
const { sealArtifact } = require('./artifacts');

function requireScope(value, message) {
  if (!value) { const error = new Error(`Exact confirmation scope: ${message}`); error.code = 'EXACT_CONFIRMATION_SCOPE_BLOCKED'; error.stage = 'EXACT_CONFIRMATION_SCOPE'; throw error; }
}
function sortedIds(values) {
  requireScope(Array.isArray(values) && values.every(id => typeof id === 'string' && /^[1-9]\d*$/.test(id)), 'invalid offer IDs');
  requireScope(new Set(values).size === values.length, 'duplicate offer IDs');
  return [...values].sort((a, b) => Number(a) - Number(b));
}
function idsHash(ids) { return crypto.createHash('sha256').update(JSON.stringify(sortedIds(ids))).digest('hex'); }
function stateFingerprint(targets) {
  const sorted = [...targets].sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  return crypto.createHash('sha256').update(canonicalJson(canonicalizeTimestamps(sorted))).digest('hex');
}
function loadExactConfirmationScope(root, config) {
  const policy = config.exact_confirmation_scope;
  requireScope(policy && /^config\/retailers\/[a-z0-9-]+\.json$/.test(policy.path), 'missing approval evidence');
  requireScope(fs.existsSync(path.join(root, policy.path)), 'missing approval evidence file');
  const text = fs.readFileSync(path.join(root, policy.path), 'utf8').replace(/\r\n/g, '\n');
  requireScope(crypto.createHash('sha256').update(text).digest('hex') === policy.sha256, 'approval evidence SHA mismatch');
  const evidence = JSON.parse(text);
  requireScope(evidence.schema_version === 1 && evidence.kind === 'owner-approved-exact-confirmation-subset'
    && evidence.authority === policy.authority && typeof policy.authority === 'string'
    && String(evidence.retailer_id) === String(config.retailer_id) && evidence.retailer_slug === config.retailer_slug
    && evidence.segment === policy.segment
    && evidence.approved_manifest_sha256 === config.manifest_sha256
    && evidence.active_count === config.approved_mapping_count, 'approval identity mismatch');
  const ids = sortedIds(evidence.execution_offer_ids), reviews = sortedIds(evidence.review_offer_ids);
  requireScope(ids.length === evidence.execution_count && reviews.length === evidence.review_count
    && ids.length + reviews.length === evidence.active_count && !ids.some(id => reviews.includes(id))
    && idsHash(ids) === evidence.execution_ids_sha256, 'approval partition/hash mismatch');
  requireScope(evidence.source_evidence.run_id && evidence.source_evidence.artifact_id
    && /^[a-f0-9]{64}$/.test(evidence.source_evidence.zip_sha256), 'missing artifact provenance');
  return evidence;
}

// Checks the freshly built native plan; it neither selects rows nor grants an approval.
function enforceExactConfirmationScope(run, evidence, validations, config, now = Date.now()) {
  requireScope(evidence && run.target === 'production' && !run.reviewed && run.isolateUnsafe === true, 'unsupported execution context');
  requireScope(run.spec.ref === evidence.target_project_ref && run.spec.identity === evidence.target_database_identity
    && String(config.retailer_id) === String(evidence.retailer_id) && config.retailer_slug === evidence.retailer_slug
    && config.manifest_sha256 === evidence.approved_manifest_sha256, 'target/catalogue mismatch');
  requireScope(run.binding.fingerprint === evidence.expected_migration_fingerprint
    && run.binding.versions.length === evidence.expected_migration_count, 'migration binding drift');
  requireScope(Number.isFinite(Date.parse(run.capturedAt)) && Date.parse(run.capturedAt) <= now
    && now - Date.parse(run.capturedAt) <= config.guardrails.source_freshness_hours * 3600000
    && run.snapshot.source_diagnostic?.pagination_completed === true, 'stale/incomplete source');
  const proof = run.exactConfirmationState;
  requireScope(proof?.active === evidence.active_state_sha256 && proof?.historical === evidence.historical_state_sha256
    && proof?.mapped_source === evidence.mapped_source_fingerprint, 'source/DB state drift');
  const rows = run.artifacts.flatMap(artifact => artifact.rows);
  requireScope(['DRY_RUN_READY', 'DRY_RUN_READY_WITH_REVIEW'].includes(run.classification.state), 'classifier blocked');
  const actual = sortedIds(rows.map(row => String(row.offer_id)));
  requireScope(idsHash(actual) === evidence.execution_ids_sha256
    && JSON.stringify(actual) === JSON.stringify(sortedIds(evidence.execution_offer_ids)), 'execution IDs drift');
  requireScope(JSON.stringify(sortedIds(run.classification.rows.map(row => String(row.offer_id)))) === JSON.stringify(actual)
    && run.classification.rows.every(row => row.action === 'VERIFY_NO_CHANGE'), 'additional/changed executable classifier rows');
  const reviews = sortedIds((run.classification.quarantined_rows || []).map(row => String(row.offer_id)));
  requireScope(JSON.stringify(reviews) === JSON.stringify(sortedIds(evidence.review_offer_ids)), 'excluded review IDs drift');
  const delta = { row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 },
    logical_field_deltas: { offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 0,
      offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 1 } };
  for (const row of rows) {
    const plan = row.atomic_plan;
    requireScope(row.action === 'VERIFY_NO_CHANGE' && Object.values(row.changed_fields).every(value => value === false)
      && canonicalJson(row.expected_deltas) === canonicalJson(delta)
      && plan?.offer.action === 'verify_no_change' && String(plan.offer.id) === String(row.offer_id)
      && plan.product.action === 'existing' && plan.product_variant.action === 'existing' && plan.retailer.action === 'existing'
      && String(plan.retailer.id) === String(evidence.retailer_id)
      && plan.retailer_product.action === 'noop' && plan.price_history.action === 'noop'
      && timestampEpochNanoseconds(plan.offer.values.last_checked_at) === timestampEpochNanoseconds(run.capturedAt)
      && timestampEpochNanoseconds(plan.offer.values.last_checked_at) > timestampEpochNanoseconds(plan.expected_state.offer.last_checked_at), 'commercial/catalogue plan or delta');
    for (const field of ['price', 'shipping_cost', 'total_price', 'in_stock', 'url'])
      requireScope(canonicalJson(plan.offer.values[field]) === canonicalJson(plan.expected_state.offer[field]), 'commercial plan values drift');
  }
  requireScope(validations?.length === run.artifacts.length && validations.length > 0, 'missing SQL validation');
  for (const [index, artifact] of run.artifacts.entries()) {
    const { artifact_fingerprint, ...core } = artifact, validation = validations[index];
    const batchDelta = { row_count_deltas: delta.row_count_deltas,
      logical_field_deltas: { ...delta.logical_field_deltas, last_checked_at_updates: artifact.rows.length } };
    requireScope(artifact.state === 'DRY_RUN_READY' && artifact.block === null
      && canonicalJson(artifact.expected_deltas) === canonicalJson(batchDelta)
      && artifact.source_captured_at === run.capturedAt && sealArtifact(core).artifact_fingerprint === artifact_fingerprint
      && canonicalJson(validation.request.artifact) === canonicalJson(artifact)
      && Date.parse(validation.request.validation_expires_at) > now
      && validation.result.valid === true && validation.result.status === 'DRY_RUN_VALIDATED'
      && Number(validation.result.row_count) === artifact.rows.length, 'stale/mismatched SQL validation');
  }
  return { result: 'PASS', execution_count: actual.length, execution_ids_sha256: idsHash(actual), review_count: reviews.length,
    source_run_id: evidence.source_evidence.run_id, source_artifact_id: evidence.source_evidence.artifact_id };
}
module.exports = { enforceExactConfirmationScope, idsHash, loadExactConfirmationScope, sortedIds, stateFingerprint };
