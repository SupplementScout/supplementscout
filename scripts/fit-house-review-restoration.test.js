const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const retained = require('./test-fixtures/fit-house-review-partition-captured-2026-11-10.json');
const prior = require('./test-fixtures/retailer-quarantine-captured-evidence-2026-11-09.json');
const fit = require('./fit-house-offer-refresh');
const { reconcileApprovedCatalogueScope } = require('./lib/feed-variant-guards');
const { loadAndValidateSource, buildSourceContract, buildManifestRows, buildOutput, profileFor } = require('./shared-retailer-automation-review-source');
const { planPublication, sha256 } = require('./lib/automation-review-publisher');
const { REVIEW_EXECUTION_ADAPTERS } = require('./lib/automation-review-adapter-registry');
const { selectReviewQueueExecutionRows } = require('./lib/automation-review-execution-selection');
const { prepareAutomationReviewDecision } = require('./lib/retailer-offer-sync/automation-review-decision');

const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'SupplementScout/supplementscout', GITHUB_RUN_ID: '42766571104', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: retained.provenance.commit };
const config = require('../config/retailers/fit-house-offer-sync.json');
const stockIdentity = require('./lib/fit-house-stock-identity');
const { projectShopifyCanonicalRecords } = require('./lib/shopify-snapshot-reader');
const { classifyExistingOffers } = require('./lib/retailer-offer-sync/classifier');
function fixture(t, mutate = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-review-restoration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = structuredClone(retained);
  // Replay the retained classifier/DB evidence with the corrected producer's
  // ACTIVE diagnostic counts. The captured original stays byte-for-byte intact.
  input.diagnostic.approved_mapping_count = input.report.approved_mapping_count;
  input.diagnostic.approved_offer_count = input.report.approved_mapping_count;
  mutate(input);
  for (const [key, name] of Object.entries({ report: 'production-dry-run.json', diagnostic: 'production-preflight-diagnostic.json', baseline: 'production-db-baseline.json' })) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(input[key]));
  }
  return { directory, input };
}
function publication(t) {
  const { directory } = fixture(t), source = loadAndValidateSource(directory);
  source.contract = buildSourceContract(directory, env);
  const byId = new Map(prior.fit.records.map(r => [String(r.offer.id), r]));
  const records = source.changedRows.map(row => {
    const record = structuredClone(byId.get(row.offer_id));
    const identity = retained.canonical_review_bindings.find(binding => binding.offer_id === row.offer_id);
    Object.assign(record.variant, { flavour_label: identity.flavour_label, flavour_code: identity.flavour_code });
    record.mapping.external_options = identity.external_options;
    return record;
  });
  const baseline = {
    catalogueCounts: { products: 1399, product_variants: 4070, retailer_products: 4361, offers: 4361, price_history: 49855 },
    activeRows: [], offers: records.map(r => r.offer), mappings: records.map(r => r.mapping),
    products: records.map(r => r.product), variants: records.map(r => r.variant),
  };
  const options = { sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: String(retained.provenance.artifact_id), sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: retained.provenance.zip_sha256, sourceContractSha256: sha256(source.contract), output: path.join(directory, 'reconciliation.json') };
  return { source, baseline, options, rows: buildManifestRows(source, baseline, options) };
}

test('retained 284 ACTIVE + 2 HISTORICAL seals exactly 261 confirmations,19 stock and4 missing', t => {
  const { directory } = fixture(t), source = loadAndValidateSource(directory), contract = buildSourceContract(directory, env);
  const partition = reconcileApprovedCatalogueScope(fit.loadApprovedManifest().manifest, structuredClone(prior.fit.records));
  assert.equal(partition.records.length, 284); assert.equal(partition.historical_records.length, 2);
  assert.equal(contract.approved_mapping_count, 284); assert.equal(contract.executable_plan_count, 261);
  assert.equal(contract.review_row_count, 23); assert.equal(contract.catalogue_writes, 0);
  assert.equal(source.changedRows.filter(r => r.action === 'UPDATE_STOCK').length, 19);
  assert.equal(source.changedRows.filter(r => r.action === 'SOURCE_MISSING').length, 4);
  assert.deepEqual(new Set(contract.catalogue_offer_ids), new Set(partition.records.map(r => String(r.offer.id))));
  assert.ok(partition.historical_records.every(r => !contract.catalogue_offer_ids.includes(String(r.offer.id))));
  const receipt = require('../docs/retailer-automation/evidence/FIT-HOUSE-EXACT-261-EXECUTION-CLOSEOUT-2026-11-10.json');
  for (const [field, name] of [['native_apply_receipt', 'production-apply.json'], ['native_db_postflight_receipt', 'production-db-postflight.json'], ['native_readonly_idempotency_receipt', 'production-dry-run.json']]) {
    assert.equal(sha256(JSON.stringify(receipt[field], null, 2) + '\n'), receipt.original_receipt_file_sha256[name]);
  }
  assert.deepEqual(receipt.native_readonly_idempotency_receipt, retained.report);
  assert.equal(receipt.native_apply_receipt.executed_plan_count, 261);
  assert.equal(receipt.native_db_postflight_receipt.daily_confirmation_delta, 237);
  assert.equal(receipt.independent_verification.approvals.length, 261);
  assert.ok(receipt.independent_verification.approvals.every(a => a.status === 'consumed'));
  assert.equal(receipt.independent_verification.skipped.length, 24);
});

test('old286 scope,missing classifier row,changed executable and incomplete review partition fail closed', t => {
  for (const mutate of [
    f => { f.report.approved_mapping_count = 286; },
    f => { f.diagnostic.classifier_summary.scope.scope_row_ids.pop(); },
    f => { f.report.stock_change_offer_ids.push(f.report.execution_offer_ids[0]); },
    f => { f.report.review_rows.pop(); f.report.review_row_count--; },
    f => { f.report.deferred_changed_offer_ids.push(f.report.review_rows.find(r => r.reason === 'MASS_OOS').offer_id); },
  ]) {
    const f = fixture(t, mutate); assert.throws(() => loadAndValidateSource(f.directory));
  }
});

test('Fit mixed publication rejects price,compound and URL changes without expanding other profiles', t => {
  for (const action of ['UPDATE_PRICE', 'UPDATE_PRICE_AND_STOCK', 'UPDATE_URL']) {
    const f = fixture(t, input => {
      const row = input.report.review_rows.find(r => r.action === 'UPDATE_STOCK');
      row.action = action; row.new_price = '999.00'; row.changed_fields.price = true;
    });
    assert.throws(() => loadAndValidateSource(f.directory), /review action drifted/);
  }
  const profile = profileFor('fit-house'), invariant = (ok, message) => assert.ok(ok, message);
  const compound = { action: 'UPDATE_PRICE_AND_STOCK', old_price: '10.00', new_price: '11.00', old_stock: false, new_stock: true };
  assert.throws(() => profile.validateChangedRows(profile, [compound], invariant), /unsafe catalogue change/);
  const other = profileFor('gladiator-nutrition');
  assert.equal(other.stockOnlyCommercialChanges, undefined);
  assert.doesNotThrow(() => other.validateChangedRows(other, [compound], invariant));
  assert.equal(profileFor('six-pack-supplements').reviewType, 'mixed-policy');
});

test('retained labels are not invented:7 stock cards,15 identity cards and1 owner HOLD', t => {
  const { rows } = publication(t);
  const stock = rows.filter(r => r.operation_type === 'UPDATE_STOCK'), missing = rows.filter(r => r.operation_type === 'MANUAL_REVIEW_IDENTITY');
  assert.equal(stock.length, 7); assert.equal(missing.length, 15);
  assert.equal(missing.filter(r => r.reason_codes === 'SOURCE_MISSING').length, 4);
  const hold = rows.find(r => r.offer_id === '1938');
  assert.equal(hold.operation_type, 'MANUAL_REVIEW'); assert.equal(hold.review_kind, 'POLICY_REVIEW');
  assert.equal(hold.source_evidence.reason, 'OWNER_HOLD'); assert.equal(hold.before_state.in_stock, false);
  assert.equal(hold.proposed_state.automatic_action, false); assert.equal(hold.proposed_state.in_stock, undefined);
  assert.ok(stock.some(r => r.offer_id === '954' && r.review_status === 'PENDING'));
  assert.ok(stock.every(r => r.reason_codes === 'STOCK_CHANGE' && r.before_state.price === r.proposed_state.price && r.before_state.in_stock !== r.proposed_state.in_stock));
  for (const row of missing) {
    assert.equal(row.review_kind, 'IDENTITY_CONFLICT'); assert.ok(['SOURCE_MISSING', 'IDENTITY_CONFLICT'].includes(row.reason_codes));
    assert.deepEqual(row.proposed_state, { catalogue_action: 'KEEP_UNCHANGED', identity_review: 'READ_ONLY', automatic_action: false });
    assert.equal(row.source_price, null); assert.equal(row.proposed_product_id, null); assert.equal(row.proposed_variant_id, null);
    assert.equal(row.impact_summary.executable, false);
  }
  assert.equal(missing.find(r => r.offer_id === '1859').before_state.in_stock, false);
  assert.ok(missing.filter(r => r.reason_codes === 'SOURCE_MISSING' && r.offer_id !== '1859').every(r => r.before_state.in_stock === true));
});

function identityRecord(id = '953') {
  const record = structuredClone(prior.fit.records.find(r => String(r.offer.id) === id));
  const binding = retained.canonical_review_bindings.find(r => r.offer_id === id);
  record.mapping.external_options = binding.external_options;
  Object.assign(record.variant, { flavour_label: binding.flavour_label, flavour_code: binding.flavour_code });
  return record;
}
function canonicalSource(record, flavour) {
  return projectShopifyCanonicalRecords({ store_origin: 'https://fithouse.uk', products: [{ id: record.mapping.external_product_id, title: record.product.name, handle: new URL(record.offer.url).pathname.split('/')[2], options: [{ name: 'Flavour', position: 1 }], variants: [{ id: record.mapping.external_variant_id, title: flavour || 'Default Title', option1: flavour || null, available: !record.offer.in_stock, price: record.offer.price }] }] })[0];
}
function guardRow(record, flavour) {
  const source = canonicalSource(record, flavour), row = { offer_id: String(record.offer.id), retailer_product_id: String(record.mapping.id), external_product_id: record.mapping.external_product_id, external_variant_id: record.mapping.external_variant_id, action: 'UPDATE_STOCK', reason: 'OWNER_DEFERRED_STOCK_REVIEW', changed_fields: { stock: true, price: false, url: false, blocked: false }, target: record.offer, source, source_captured_at: retained.diagnostic.timestamp };
  const snapshot = { captured_at: retained.diagnostic.timestamp, semantic_source_fingerprint: 'f'.repeat(64), products: [{ id: source.external_product_id, title: record.product.name, options: [{ name: 'Flavour', position: 1 }], variants: [{ id: source.external_variant_id, title: flavour || 'Default Title', option1: flavour || null, available: source.in_stock, price: source.price }] }] };
  const guard_evidence = { scope_row_ids: [row.offer_id], guards: [{ guard: 'MASS_OOS', result: 'BLOCK' }] };
  const result = stockIdentity.guardClassification({ state: 'DRY_RUN_READY_WITH_REVIEW', rows: [row], quarantined_rows: [], guard_evidence }, { config, records: [record], snapshot });
  assert.deepEqual(result.guard_evidence, guard_evidence);
  return { result, source, snapshot, row };
}

test('same variant ID with an explicit different flavour cannot reach a stock plan or commercial card', () => {
  const record = identityRecord(), { result, row: inputRow, snapshot } = guardRow(record, 'Orange and Passionfruit');
  assert.equal(result.rows.length, 0); assert.equal(result.quarantined_rows[0].reason, 'SOURCE_VARIANT_FLAVOUR_CONFLICT');
  const row = result.quarantined_rows[0]; assert.equal(row.identity_evidence.expected_flavour, 'banana');
  assert.equal(row.identity_evidence.observed_flavour, 'orange and passionfruit');
  assert.equal(fit.reviewReportRow(row).new_stock, null); assert.equal(fit.reviewReportRow(row).proposed_offer, null);
  assert.throws(() => selectReviewQueueExecutionRows(result, { offerId: String(record.offer.id), operation: 'UPDATE_STOCK', maximumCommercialChanges: 1, freshnessConfirmationCount: 19 }), { code: 'REVIEW_EXECUTION_SOURCE_OPERATION_DRIFT' });
  const context = { config, records: [record], snapshot };
  assert.equal(stockIdentity.guardClassification({ state: 'DRY_RUN_READY', rows: [inputRow], quarantined_rows: [] }, context).state, 'DRY_RUN_READY_WITH_REVIEW');
  assert.equal(stockIdentity.guardClassification({ state: 'BLOCKED', reason: 'MASS_OOS', rows: [inputRow], quarantined_rows: [] }, context).state, 'BLOCKED');
});

test('matching exact flavour passes normal validation;absent flavour stays review-only', () => {
  const record = identityRecord();
  const matched = guardRow(record, 'Banana').result;
  assert.equal(matched.rows[0].action, 'UPDATE_STOCK'); assert.equal(matched.rows[0].identity_evidence.status, 'VERIFIED');
  const unknown = guardRow(record, null).result;
  assert.equal(unknown.rows.length, 0); assert.equal(unknown.quarantined_rows[0].reason, 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED');
  assert.notEqual(unknown.quarantined_rows[0].reason, 'SOURCE_VARIANT_MISSING');
});

test('a genuinely absent variant keeps SOURCE_VARIANT_MISSING instead of borrowing another flavour', () => {
  const record = identityRecord(), source = canonicalSource(record, 'Orange'); source.external_variant_id = '90000000000001';
  const target = { ...record.offer, offer_id: String(record.offer.id), retailer_product_id: String(record.mapping.id), external_product_id: record.mapping.external_product_id, external_variant_id: record.mapping.external_variant_id };
  // Isolated one-row classifier contract, not a production scope or source capture.
  const result = classifyExistingOffers({ targets: [target], sourceVariants: [source], policy: { ...fit.effectiveOfferPolicy(), required_matched_offers: 1 }, sourceCapturedAt: retained.diagnostic.timestamp, now: new Date(retained.diagnostic.timestamp), quarantineUnsafeRows: true });
  assert.equal(result.quarantined_rows[0].reason, 'SOURCE_VARIANT_MISSING');
  assert.equal(result.quarantined_rows[0].source, null);
});

test('owner HOLD blocks matching,conflicting and missing flavour plus a forged old registration', () => {
  const record = identityRecord('1938');
  for (const flavour of ['Strawberry Mango', 'Orange and Passionfruit', null]) {
    const { result } = guardRow(record, flavour); assert.equal(result.rows.length, 0);
    assert.equal(result.quarantined_rows[0].reason, 'OWNER_HOLD'); assert.equal(record.offer.in_stock, false);
  }
  assert.throws(() => fit.registrationRequest({ artifacts: [{ rows: [{ offer_id: '1938', action: 'UPDATE_STOCK' }] }] }), { code: 'OWNER_HOLD_EXECUTION_BLOCKED' });
  const changed = structuredClone(record); changed.offer.in_stock = true;
  assert.throws(() => guardRow(changed, 'Strawberry Mango'), { code: 'OWNER_HOLD_STATE_DRIFT' });
});

test('conflicting approved mapping and canonical flavour cannot grant commercial identity', () => {
  const record = identityRecord(); record.mapping.external_options = { Flavour: 'Orange' };
  const { result } = guardRow(record, 'Banana');
  assert.equal(result.quarantined_rows[0].reason, 'CANONICAL_VARIANT_FLAVOUR_CONFLICT');
  const clean = identityRecord(), source = canonicalSource(clean, 'Banana'); source.variant_name = 'Orange';
  const result2 = stockIdentity.assess(clean, source, { fingerprint: 'f'.repeat(64), capturedAt: retained.diagnostic.timestamp, sourceStock: source.in_stock, sourcePrice: source.price });
  assert.equal(result2.reason, 'SOURCE_VARIANT_FLAVOUR_EVIDENCE_CONFLICT');
  assert.deepEqual(result2.evidence.conflicting_source_flavours, { option: 'banana', title: 'orange' });
});

test('954 owner observation supports only its bound evidence;explicit source conflict overrides it', t => {
  const { rows } = publication(t), row = rows.find(r => r.offer_id === '954');
  assert.equal(row.operation_type, 'UPDATE_STOCK'); assert.equal(row.review_status, 'PENDING');
  assert.equal(row.before_state.in_stock, true); assert.equal(row.proposed_state.in_stock, false);
  const record = identityRecord('954'); const conflict = guardRow(record, 'Orange').result;
  assert.equal(conflict.rows.length, 0); assert.equal(conflict.quarantined_rows[0].reason, 'SOURCE_VARIANT_FLAVOUR_CONFLICT');
  const stale = stockIdentity.assess(record, null, { fingerprint: 'a'.repeat(64), capturedAt: retained.diagnostic.timestamp, sourceStock: false, sourcePrice: '21.99' });
  assert.equal(stale.reason, 'SOURCE_VARIANT_FLAVOUR_UNVERIFIED');
});

test('other retailer profiles keep the previous guard result and fingerprint components', () => {
  const classification = { state: 'DRY_RUN_READY', rows: [], quarantined_rows: [] };
  const other = { retailer_id: 14, retailer_slug: '10reps' };
  assert.equal(stockIdentity.guardClassification(classification, { config: other }), classification);
  assert.deepEqual(stockIdentity.adapterFingerprint(other), {});
  assert.doesNotThrow(() => stockIdentity.assertNoHeldExecution(other, [{ rows: [{ offer_id: '1938' }] }]));
});

test('stock identity guard runs before native plan construction and worker row selection', () => {
  const source = fit.buildRun.toString(), guard = source.indexOf('classification=stockIdentity.guardClassification');
  assert.ok(guard >= 0 && guard < source.indexOf('selectReviewQueueExecutionRows'));
  assert.ok(guard < source.indexOf('buildExistingOfferUpdatePlan'));
  assert.ok(fit.registrationRequest.toString().startsWith('function registrationRequest(run){stockIdentity.assertNoHeldExecution'));
});

test('publication rejects stale identity provenance even for a variant without flavour', t => {
  const { source, baseline, options } = publication(t), changed = source.changedRows.find(r => r.offer_id === '692');
  changed.identity_evidence = { source_fingerprint: '0'.repeat(64), source_record: null };
  const card = buildManifestRows(source, baseline, options).find(r => r.offer_id === '692');
  assert.equal(card.operation_type, 'MANUAL_REVIEW_IDENTITY');
  assert.equal(card.proposed_state.in_stock, undefined);
  assert.equal(card.source_evidence.identity_check.technical_reason, 'SOURCE_IDENTITY_PROVENANCE_MISMATCH');
  assert.equal(card.source_evidence.identity_check.status, 'UNVERIFIED');
});

test('missing source cannot select a stock execution and the shared worker keeps one-stock-plus19 authority', t => {
  const { source } = publication(t), adapter = REVIEW_EXECUTION_ADAPTERS.find(a => a.retailerId === '9');
  assert.deepEqual(adapter.operations, ['UPDATE_STOCK']); assert.deepEqual(adapter.reasonCodes, ['STOCK_CHANGE']);
  assert.equal(adapter.sharedEngine.expectedCommercialChanges, 1); assert.equal(adapter.sharedEngine.freshnessConfirmationCount, 19);
  for (const row of source.changedRows.filter(r => r.action === 'SOURCE_MISSING')) {
    assert.throws(() => selectReviewQueueExecutionRows({ rows: [], quarantined_rows: [{ ...row, action: 'BLOCK_SOURCE_ANOMALY', changed_fields: { blocked: true } }] },
      { offerId: row.offer_id, operation: 'UPDATE_STOCK', maximumCommercialChanges: 1, freshnessConfirmationCount: 19 }), { code: 'REVIEW_EXECUTION_SOURCE_OPERATION_DRIFT' });
  }
});

test('expired,rejected and executed history is immutable;new evidence creates only fresh PENDING decisions', t => {
  const { rows } = publication(t), originals = [
    { ...rows.find(r => r.offer_id === '954'), id: '1104', review_status: 'REJECTED' },
    ...['1120', '1354', '2060', '2260'].map(id => ({ ...rows.find(r => r.offer_id === '1938'), id, review_status: 'REJECTED' })),
    { ...rows[0], id: 'old-expired', review_status: 'EXPIRED' },
    { ...rows.find(r => r.offer_id === '1859'), id: '1114', review_status: 'EXECUTED', operation_type: 'UPDATE_STOCK' },
  ];
  const snapshot = structuredClone(originals);
  const plan = planPublication({ schema_version: 1, kind: 'automation-review-publisher-manifest', generated_at: retained.diagnostic.timestamp, retailer_id: '9', retailer: 'Fit House', observed_offer_ids: rows.map(r => r.offer_id), rows }, originals);
  assert.deepEqual(originals, snapshot); assert.equal(plan.counts.created, 23); assert.equal(plan.counts.expired, 0);
  assert.ok(plan.created.every(r => r.review_status === 'PENDING'));
  assert.ok(plan.created.filter(r => ['954', '1938'].includes(r.offer_id)).every(r => !r.decision_actor && !r.decision_at));
});

test('expired PENDING is superseded,not approved;repeat reconciliation creates no duplicate cards', t => {
  const { source, baseline, options, rows } = publication(t);
  baseline.activeRows = rows.slice(0, 12).map((r, i) => ({ ...r, id: String(3250 + i), review_status: 'PENDING', source_row_fingerprint: sha256(`old-${r.offer_id}`), expires_at: '2026-11-05T09:52:40.247Z' }));
  const saved = structuredClone(baseline.activeRows), output = buildOutput(source, baseline, rows, options, env);
  assert.deepEqual(baseline.activeRows, saved); assert.equal(output.operations.CREATE, 23); assert.equal(output.operations.SUPERSEDE, 12);
  assert.ok(output.request.operations.filter(op => op.op === 'CREATE').every(op => op.row.review_status === 'PENDING'));
  baseline.activeRows = rows.map((r, i) => ({ ...r, id: String(9000 + i) }));
  const repeated = buildOutput(source, baseline, rows, options, env);
  assert.equal(repeated.operations.CREATE, 0); assert.equal(repeated.operations.REFRESH, 23); assert.equal(repeated.operations.SUPERSEDE, 0);
  assert.equal(repeated.expected.catalogue_writes, 0); assert.equal(repeated.production_writes, 0);
  const review = { ...baseline.activeRows[0], decision_actor: 'owner', decision_at: retained.diagnostic.timestamp, expires_at: '2026-11-05T09:52:40.247Z' };
  const request = { review_id: review.id, retailer_slug: 'fit-house', operation_type: review.operation_type, status: 'DISPATCHED', review_fingerprint: review.source_row_fingerprint, plan_fingerprint: review.plan_fingerprint };
  const adapter = REVIEW_EXECUTION_ADAPTERS.find(a => a.retailerId === '9');
  assert.throws(() => prepareAutomationReviewDecision({ review, request, adapter }), { code: 'AUTOMATION_REVIEW_DECISION_STATE_INVALID' });
  assert.throws(() => prepareAutomationReviewDecision({ review: { ...review, review_status: 'APPROVED' }, request, adapter, now: new Date(retained.diagnostic.timestamp) }), { code: 'AUTOMATION_REVIEW_DECISION_EXPIRED' });
});

test('native producer reports284 approved while retaining physical286 DB counts;legacy diagnostic remains rejected', async () => {
  const filename = path.resolve(__dirname, 'fit-house-offer-refresh.js'), harness = {};
  const context = { module: { exports: {} }, require: createRequire(filename), __dirname, __filename: filename, process: { env: { GITHUB_ACTIONS: 'true' } }, Buffer, console, Date, setTimeout, clearTimeout, harness };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\ngit=()=>"main";readState=async()=>({counts:{mappings:286,offers:286}});buildRun=async()=>{throw Error("BUILD_BOUNDARY");};', context, { timeout: 1000 });
  const diagnostic = {};
  await assert.rejects(context.module.exports.executeRefresh({ target: 'production', mode: 'dry-run' }, diagnostic), /BUILD_BOUNDARY/);
  assert.equal(diagnostic.approved_mapping_count, 284); assert.equal(diagnostic.approved_offer_count, 284);
  assert.equal(diagnostic.database_before.mappings, 286); assert.equal(diagnostic.database_before.offers, 286);
  const profile = profileFor('fit-house');
  assert.equal(retained.diagnostic.approved_mapping_count, 286);
  assert.throws(() => profile.validateCapture(profile, { report: retained.report, diagnostic: retained.diagnostic, invariant: (ok, message) => assert.ok(ok, message) }), /preflight source binding drifted/);
});

test('retired native selector stops before DB,source,validation or registration;ordinary apply keeps guards', async () => {
  const filename = path.resolve(__dirname, 'fit-house-offer-refresh.js'), nativeRequire = createRequire(filename), harness = { reads: 0 };
  const context = { module: { exports: {} }, require: nativeRequire, __dirname, __filename: filename, process: { env: {} }, Buffer, console, Date, setTimeout, clearTimeout, harness };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nreadState=async()=>{harness.reads++;throw Error("DB_REACHED");};', context, { timeout: 1000 });
  await assert.rejects(context.module.exports.executeRefresh({ target: 'production', mode: 'apply', scopeSegment: 'owner_exact_confirmations_261' }, {}), /unknown approved scope segment/);
  assert.equal(harness.reads, 0); assert.equal(config.require_exact_confirmation_scope, undefined); assert.equal(config.exact_confirmation_scope, undefined);
  assert.equal(fit.approvedStableOosBaseline().count, 104); assert.equal(config.guardrails.mass_oos_block_count, 4);
  assert.throws(() => fit.parseArgs(['--target=production', '--mode=apply-exact-confirmations']));
  assert.equal(fit.loadApprovedManifest().sha256, 'b25aaafadecb848e08507ba488f34a4b4a84871f67d993d93538eff50600e3b5');
});
