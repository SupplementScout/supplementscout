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
  const records = source.changedRows.map(row => byId.get(row.offer_id));
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

test('19 commercial cards are stock-only;4 missing cards retain no commercial proposal or rebind', t => {
  const { rows } = publication(t);
  const stock = rows.filter(r => r.operation_type === 'UPDATE_STOCK'), missing = rows.filter(r => r.operation_type === 'MANUAL_REVIEW_IDENTITY');
  assert.equal(stock.length, 19); assert.equal(missing.length, 4);
  assert.ok(stock.every(r => r.reason_codes === 'STOCK_CHANGE' && r.before_state.price === r.proposed_state.price && r.before_state.in_stock !== r.proposed_state.in_stock));
  for (const row of missing) {
    assert.equal(row.review_kind, 'IDENTITY_CONFLICT'); assert.equal(row.reason_codes, 'SOURCE_MISSING');
    assert.deepEqual(row.proposed_state, { catalogue_action: 'KEEP_UNCHANGED', identity_review: 'READ_ONLY', automatic_action: false });
    assert.equal(row.source_price, null); assert.equal(row.proposed_product_id, null); assert.equal(row.proposed_variant_id, null);
    assert.equal(row.impact_summary.executable, false);
  }
  assert.equal(missing.find(r => r.offer_id === '1859').before_state.in_stock, false);
  assert.ok(missing.filter(r => r.offer_id !== '1859').every(r => r.before_state.in_stock === true));
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
