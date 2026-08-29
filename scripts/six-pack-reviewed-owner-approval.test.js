const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");
const approvedManifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const {
  assertFreshBatchMatch, assertOwnerExecutionContext, buildReviewedBatch,
  expectedConfirmation, loadReviewedBatch, reviewedBatchFingerprint, semanticSourceFingerprint,
  validateReviewedBatch,
} = require("./lib/six-pack-reviewed-owner-approval");
const { executeApprovedPlansWithCheckpoint, validateReviewedOwnerArtifact } = require("./six-pack-offer-refresh-executor");
const { authorizeReviewedOwnerBatch } = require("./six-pack-offer-refresh");
const { verifyPostflight, hash } = require("./six-pack-reviewed-postflight");
const { finalizeOutcome } = require("./six-pack-reviewed-outcome");

const CHANGES = [
  ["2006", "41.99", "41.99", true, false], ["2027", "41.99", "44.99", true, true],
  ["2028", "41.99", "44.99", true, true], ["2029", "41.99", "44.99", false, true],
  ["2030", "41.99", "44.99", true, true], ["2031", "41.99", "44.99", true, true],
  ["2032", "39.99", "44.99", true, false], ["2033", "39.99", "44.99", true, true],
  ["2062", "41.99", "44.99", true, true], ["2063", "41.99", "44.99", true, false],
  ["2064", "39.99", "44.99", true, false], ["2065", "39.99", "44.99", true, false],
  ["2066", "39.99", "44.99", true, true], ["2422", "41.99", "44.99", true, true],
];

function fixture() {
  const captured = new Date(Date.now() - 60_000).toISOString();
  const beforeAt = new Date(Date.parse(captured) - 86_400_000).toISOString();
  const bindings = new Map(approvedManifest.rows.map((row) => [String(row.offer_id), row]));
  const rows = CHANGES.map(([offerId, oldPrice, newPrice, oldStock, newStock]) => {
    const binding = bindings.get(offerId);
    assert.ok(binding, `approved manifest binding ${offerId}`);
    const url = `https://6pack-supplements.co.uk/product/reviewed-${binding.external_product_id}/`;
    return {
      offer_id: offerId, product_id: binding.canonical_product_id, product_variant_id: binding.canonical_variant_id,
      retailer_product_id: binding.mapping_id, external_product_id: binding.external_product_id, external_variant_id: binding.external_variant_id,
      before: { price: oldPrice, shipping_cost: "4.99", total_price: (Number(oldPrice) + 4.99).toFixed(2), in_stock: oldStock, url, last_checked_at: beforeAt },
      after: { price: newPrice, shipping_cost: "4.99", total_price: (Number(newPrice) + 4.99).toFixed(2), in_stock: newStock, url, last_checked_at: captured },
    };
  });
  return buildReviewedBatch({ rows, implementationCommitSha: "c68d10f6c8a46868ea3ddd84f5eed00d85627850", manifestSha256: require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", "config", "retailers", "six-pack-approved-offer-manifest.json"))).digest("hex"), sourceCapturedAt: captured, expiresAt: new Date(Date.parse(captured) + 23 * 60 * 60 * 1000).toISOString() });
}

function clone(value) { return structuredClone(value); }

test("valid reviewed owner batch binds the exact 14 rows, 13 histories and 6 stock changes", () => {
  const batch = fixture();
  assert.equal(validateReviewedBatch(batch), batch);
  assert.equal(batch.rows.length, 14);
  assert.equal(batch.expected_price_history_delta, 13);
  assert.equal(batch.rows.filter((row) => row.before.in_stock !== row.after.in_stock).length, 6);
  assert.equal(batch.expected_mapping_delta, 0);
  assert.equal(batch.rows.find((row) => row.offer_id === "2006").operation_type, "UPDATE_STOCK");
  assert.equal(batch.rows.filter((row) => row.operation_type === "UPDATE_PRICE_AND_STOCK").length, 5);
});

test("fresh full-scope MASS_OOS capture authorizes exactly the 14 reviewed rows", () => {
  const batch = fixture();
  const capturedAt = new Date().toISOString();
  const records = batch.rows.map((row) => ({
    product: { id: row.product_id }, variant: { id: row.product_variant_id },
    mapping: { id: row.retailer_product_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_url: row.after.url },
    offer: { id: row.offer_id, ...row.before },
  }));
  const sourceRows = batch.rows.map((row) => ({ external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, price: row.after.price, shipping_cost: row.after.shipping_cost, total_price: row.after.total_price, in_stock: row.after.in_stock, url: row.after.url }));
  const classification = { state: "BLOCKED", reason: "MASS_OOS", rows: batch.rows.map((row) => ({ offer_id: row.offer_id, action: row.operation_type })) };
  const result = authorizeReviewedOwnerBatch(classification, records, sourceRows, { manifest: approvedManifest, sha256: batch.manifest_sha256 }, { batch }, capturedAt);
  assert.equal(result.classification.state, "DRY_RUN_READY");
  assert.equal(result.classification.rows.length, 14);
  assert.equal(result.review.reviewed_batch_fingerprint, batch.reviewed_batch_fingerprint);
});

test("batch fingerprint is canonical while semantic source fingerprint is capture-time independent", () => {
  const batch = fixture();
  const reorder = (value) => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reorder(value[key])])) : value;
  const reordered = reorder(batch);
  assert.equal(reviewedBatchFingerprint(reordered), batch.reviewed_batch_fingerprint);
  const fresh = clone(batch);
  fresh.source_captured_at = new Date(Date.parse(batch.source_captured_at) + 1000).toISOString();
  fresh.expires_at = new Date(Date.parse(fresh.source_captured_at) + 3600000).toISOString();
  for (const row of fresh.rows) { row.source_captured_at = fresh.source_captured_at; row.after.last_checked_at = fresh.source_captured_at; }
  fresh.reviewed_batch_fingerprint = reviewedBatchFingerprint(fresh);
  assert.notEqual(fresh.reviewed_batch_fingerprint, batch.reviewed_batch_fingerprint);
  assert.equal(semanticSourceFingerprint(fresh.rows), batch.source_semantic_fingerprint);
  assert.equal(assertFreshBatchMatch(batch, fresh), true);
});

test("batch and source fingerprints fail closed", () => {
  const batch = fixture();
  const badBatch = clone(batch); badBatch.reviewed_batch_fingerprint = "0".repeat(64);
  assert.throws(() => validateReviewedBatch(badBatch), /batch fingerprint/i);
  const badSource = clone(batch); badSource.source_semantic_fingerprint = "0".repeat(64); badSource.reviewed_batch_fingerprint = reviewedBatchFingerprint(badSource);
  assert.throws(() => validateReviewedBatch(badSource), /source semantic fingerprint/i);
});

test("manifest filename, embedded fingerprint and dispatched fingerprint must be identical", () => {
  const batch = fixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "six-pack-reviewed-"));
  try {
    fs.writeFileSync(path.join(directory, `${batch.reviewed_batch_fingerprint}.json`), JSON.stringify(batch));
    assert.equal(loadReviewedBatch(batch.reviewed_batch_fingerprint, { directory }).batch.reviewed_batch_fingerprint, batch.reviewed_batch_fingerprint);
    fs.renameSync(path.join(directory, `${batch.reviewed_batch_fingerprint}.json`), path.join(directory, "wrong.json"));
    assert.throws(() => loadReviewedBatch(batch.reviewed_batch_fingerprint, { directory }), /filename/);
    assert.throws(() => loadReviewedBatch("0".repeat(64), { directory }), /exactly one/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("price, stock, extra, missing, variant, URL and mapping drift all block", () => {
  const mutations = [
    (b) => { b.rows[0].after.price = "42.99"; },
    (b) => { b.rows[0].after.in_stock = !b.rows[0].after.in_stock; },
    (b) => { b.rows.push(clone(b.rows[0])); b.rows.at(-1).offer_id = "99999"; b.offer_ids.push("99999"); },
    (b) => { b.rows.pop(); },
    (b) => { b.rows[0].product_variant_id = "99999"; },
    (b) => { b.rows[0].external_product_id = "99999"; },
    (b) => { b.rows[0].external_variant_id = "99999"; },
    (b) => { b.rows[0].after.url += "changed"; },
    (b) => { b.rows[0].retailer_product_id = "99999"; },
  ];
  for (const mutate of mutations) {
    const live = clone(fixture()); mutate(live);
    live.source_semantic_fingerprint = semanticSourceFingerprint(live.rows);
    live.reviewed_batch_fingerprint = reviewedBatchFingerprint(live);
    assert.throws(() => assertFreshBatchMatch(fixture(), live));
  }
});

test("expiry and any guard other than MASS_OOS block", () => {
  const expired = fixture(); expired.expires_at = new Date(Date.now() - 1000).toISOString(); expired.reviewed_batch_fingerprint = reviewedBatchFingerprint(expired);
  assert.throws(() => validateReviewedBatch(expired), /expired/);
  const wrongGuard = fixture(); wrongGuard.approved_guard = "MASS_PRICE"; wrongGuard.reviewed_batch_fingerprint = reviewedBatchFingerprint(wrongGuard);
  assert.throws(() => validateReviewedBatch(wrongGuard), /guard/);
});

test("owner context requires dispatch, main, exact origin/main code, confirmation and maintain/admin", async () => {
  const batch = fixture();
  const runtime = "b".repeat(40);
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_ACTOR: "owner", GITHUB_TOKEN: "test", REVIEWED_BATCH_FINGERPRINT: batch.reviewed_batch_fingerprint, REVIEWED_OWNER_CONFIRMATION: expectedConfirmation(batch.reviewed_batch_fingerprint) };
  const expectedFile = `config/retailers/six-pack-reviewed-batches/${batch.reviewed_batch_fingerprint}.json`;
  const deps = { git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? expectedFile : "", getPermission: async () => "maintain" };
  assert.equal((await assertOwnerExecutionContext(batch, env, deps)).permission, "maintain");
  for (const mutate of [
    (e) => { e.GITHUB_REF = "refs/heads/feature"; }, (e) => { e.GITHUB_EVENT_NAME = "schedule"; },
    (e) => { e.REVIEWED_OWNER_CONFIRMATION = "yes"; },
  ]) { const changed = { ...env }; mutate(changed); await assert.rejects(assertOwnerExecutionContext(batch, changed, deps)); }
  await assert.rejects(assertOwnerExecutionContext(batch, env, { ...deps, getPermission: async () => "write" }), /permission/);
  await assert.rejects(assertOwnerExecutionContext(batch, env, { ...deps, git: (args) => args[0] === "rev-parse" && args[1] === "HEAD" ? "f".repeat(40) : args[0] === "rev-parse" ? "e".repeat(40) : "" }), /origin\/main/);
});

test("Commit A plus exactly one fingerprint-named manifest commit B passes without self-reference", async () => {
  const batch = fixture(); const runtime = "b".repeat(40);
  assert.equal(batch.implementation_commit_sha, "c68d10f6c8a46868ea3ddd84f5eed00d85627850");
  assert.equal(Object.hasOwn(batch, "runtime_commit_sha"), false);
  const selfReferential = clone(batch); selfReferential.runtime_commit_sha = runtime; selfReferential.reviewed_batch_fingerprint = reviewedBatchFingerprint(selfReferential);
  assert.throws(() => validateReviewedBatch(selfReferential), /schema is not closed/);
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_ACTOR: "owner", GITHUB_TOKEN: "x", REVIEWED_BATCH_FINGERPRINT: batch.reviewed_batch_fingerprint, REVIEWED_OWNER_CONFIRMATION: expectedConfirmation(batch.reviewed_batch_fingerprint) };
  const expected = `config/retailers/six-pack-reviewed-batches/${batch.reviewed_batch_fingerprint}.json`;
  const git = (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? expected : "";
  assert.equal((await assertOwnerExecutionContext(batch, env, { git, getPermission: async () => "admin" })).runtime_commit_sha, runtime);
  const cases = [
    { name: "A equals HEAD", git: (args) => args[0] === "rev-parse" ? batch.implementation_commit_sha : "" },
    { name: "extra file", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? `${expected}\nscripts/changed.js` : "" },
    { name: "workflow change", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? ".github/workflows/six-pack-offer-refresh.yml" : "" },
    { name: "code change", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? "scripts/six-pack-offer-refresh.js" : "" },
    { name: "two manifests", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? `${expected}\nconfig/retailers/six-pack-reviewed-batches/other.json` : "" },
    { name: "wrong filename", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "1" : args[0] === "diff" ? "config/retailers/six-pack-reviewed-batches/wrong.json" : "" },
    { name: "not ancestor", git: (args) => { if (args[0] === "merge-base") throw new Error("not ancestor"); return args[0] === "rev-parse" ? runtime : ""; } },
    { name: "later commit", git: (args) => args[0] === "rev-parse" ? runtime : args[0] === "rev-list" ? "2" : "" },
  ];
  for (const item of cases) await assert.rejects(assertOwnerExecutionContext(batch, env, { git: item.git, getPermission: async () => "admin" }), undefined, item.name);
  await assert.rejects(assertOwnerExecutionContext(batch, { ...env, REVIEWED_BATCH_FINGERPRINT: "0".repeat(64) }, { git, getPermission: async () => "admin" }), /fingerprint|confirmation/);
});

test("executor independently binds every reviewed artifact row and rejects stale/value/identity drift", () => {
  const batch = fixture();
  const artifact = { run_id: `six-pack-reviewed-owner-${batch.reviewed_batch_fingerprint}-1`, created_at: batch.source_captured_at, source_rows: [], plans: [] };
  batch.rows.forEach((row, index) => {
    artifact.source_rows.push({ row_number: String(index + 2), normalized_source_row: { source: { external_product_id: row.external_product_id, external_variant_id: row.external_variant_id } } });
    artifact.plans.push({ row_number: String(index + 2), resolved_plan: { product: { id: row.product_id }, product_variant: { id: row.product_variant_id }, retailer_product: { id: row.retailer_product_id }, offer: { id: row.offer_id, values: row.after }, expected_state: { offer: row.before } } });
  });
  assert.equal(validateReviewedOwnerArtifact(artifact, { batch }), true);
  for (const mutate of [(a) => { a.plans[0].resolved_plan.offer.values.price = "99.99"; }, (a) => { a.plans[0].resolved_plan.expected_state.offer.in_stock = !a.plans[0].resolved_plan.expected_state.offer.in_stock; }, (a) => { a.plans[0].resolved_plan.product_variant.id = "999"; }]) {
    const changed = clone(artifact); mutate(changed); assert.throws(() => validateReviewedOwnerArtifact(changed, { batch }), /differs/);
  }
});

test("interruption checkpoint reports executed, remaining and blocked; stale replay is not skipped", async () => {
  const batch = fixture();
  const plans = batch.rows.slice(0, 3).map((row, index) => ({ row_number: String(index + 2), resolved_plan: { offer: { id: row.offer_id } } }));
  const checkpoints = [];
  await assert.rejects(executeApprovedPlansWithCheckpoint(plans, async (entry) => {
    if (entry === plans[1]) throw new Error("stale-state conflict");
    return { offer_id: entry.resolved_plan.offer.id };
  }, (value) => checkpoints.push(value)), /stale-state/);
  assert.deepEqual(checkpoints.at(-1).executed_offer_ids, [plans[0].resolved_plan.offer.id]);
  assert.deepEqual(checkpoints.at(-1).remaining_offer_ids, plans.slice(1).map((entry) => entry.resolved_plan.offer.id));
  assert.equal(checkpoints.at(-1).blocked_rows.length, 1);
});

test("a partially applied prior attempt cannot match the old reviewed batch", () => {
  const approved = fixture();
  const fresh = clone(approved);
  fresh.rows[0].before = { ...fresh.rows[0].after, last_checked_at: new Date().toISOString() };
  fresh.rows[0].after.last_checked_at = new Date(Date.now() + 1000).toISOString();
  fresh.rows[0].source_captured_at = fresh.rows[0].after.last_checked_at;
  fresh.source_captured_at = fresh.rows[0].after.last_checked_at;
  fresh.expires_at = new Date(Date.parse(fresh.source_captured_at) + 3600000).toISOString();
  fresh.source_semantic_fingerprint = semanticSourceFingerprint(fresh.rows);
  fresh.reviewed_batch_fingerprint = reviewedBatchFingerprint(fresh);
  assert.throws(() => assertFreshBatchMatch(approved, fresh), /no approved commercial change|differs/);
});

test("DB postflight proves 13 exact histories, 6 stock changes, no mapping or entity creates", () => {
  const batch = fixture();
  const offersBefore = batch.rows.map((row) => ({ id: row.offer_id, ...row.before }));
  const offersAfter = batch.rows.map((row) => ({ id: row.offer_id, ...row.after }));
  const mappings = batch.rows.map((row) => ({ id: row.retailer_product_id, external_variant_id: row.external_variant_id }));
  const executionRows = batch.rows.map((row, index) => ({ offer_id: row.offer_id, price_history_id: row.operation_type === "UPDATE_STOCK" ? null : String(10000 + index) }));
  const histories = executionRows.filter((row) => row.price_history_id).map((row) => { const expected = batch.rows.find((item) => item.offer_id === row.offer_id).after; return { id: row.price_history_id, offer_id: row.offer_id, price: expected.price, shipping_cost: expected.shipping_cost, total_price: expected.total_price }; });
  const counts = { products: 1000, product_variants: 2000, retailer_products: 3000, offers: 3000, price_history: 9000 };
  const baseline = { offers: offersBefore, retailer_products: mappings, products: [], product_variants: [], mapping_hash: hash(mappings), counts, evidence_hash: "baseline" };
  const after = { offers: offersAfter, retailer_products: clone(mappings), products: [], product_variants: [], mapping_hash: hash(mappings), counts: { ...counts, price_history: 9013 }, price_history: histories };
  const report = verifyPostflight(batch, baseline, after, { result: "PASS", executed_plan_count: 14, rows: executionRows });
  assert.equal(report.price_history_delta, 13); assert.equal(report.stock_change_count, 6); assert.equal(report.mapping_delta, 0);
  assert.equal(executionRows.find((row) => row.offer_id === "2006").price_history_id, null);
});

test("source timeout after passed execution and DB postflight is deferred success, never replay", () => {
  const execution = { result: "PASS", executed_plan_count: 14, rows: Array.from({ length: 14 }, (_, index) => ({ offer_id: String(2000 + index) })), reviewed_owner_approval: { approved_reviewed_plan_count: 14, reviewed_batch_fingerprint: "a".repeat(64) } };
  const postflight = { result: "PASS", reviewed_batch_fingerprint: "a".repeat(64) };
  const deferred = finalizeOutcome({ execution, postflight, idempotencyOutcome: "failure", idempotencyReport: { classification_state: "SOURCE_READ_FAILED", source_error: { timeout: true } } });
  assert.equal(deferred.result, "APPLY_SUCCEEDED_POSTFLIGHT_PASSED_IDEMPOTENCY_DEFERRED");
  assert.equal(deferred.executed_offer_ids.length, 14);
  assert.equal(deferred.apply_replay_allowed, false);
  assert.equal(deferred.recommended_action, "RUN_READ_ONLY_IDEMPOTENCY_CHECK");
  assert.throws(() => finalizeOutcome({ execution, postflight, idempotencyOutcome: "failure", idempotencyReport: { result: "BLOCK", block_reason: "IDEMPOTENCY_FAILED" } }), /other than a source timeout/);
  assert.throws(() => finalizeOutcome({ execution: { ...execution, result: "BLOCK" }, postflight, idempotencyOutcome: "failure" }), /did not pass/);
});

test("ordinary cron remains isolated and cannot select or approve a reviewed batch", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "six-pack-offer-refresh.yml"), "utf8");
  assert.match(workflow, /cron: "17 3 \* \* \*"/);
  assert.match(workflow, /six-pack-reviewed-apply:[\s\S]*inputs\.operation == 'apply-reviewed'/);
  assert.doesNotMatch(workflow, /schedule\|apply-reviewed/);
  assert.match(workflow, /APPLY_REVIEWED:<fingerprint>/);
  assert.match(workflow, /six-pack-offer-refresh:[\s\S]*environment: production-readonly/);
  const reviewedJob = workflow.match(/  six-pack-reviewed-apply:[\s\S]*$/)?.[0] || "";
  assert.match(reviewedJob, /environment: production-readonly/);
  assert.doesNotMatch(reviewedJob, /production-reviewed-apply|required_reviewers|prevent_self_review|ENVIRONMENT_PROTECTION_AUDIT_TOKEN/);
  const controlIndex = reviewedJob.indexOf("Validate owner and immutable commits");
  const firstWriteCredentialIndex = reviewedJob.indexOf("SIX_PACK_SYNC_APPROVER_DATABASE_URL");
  assert.ok(controlIndex >= 0 && firstWriteCredentialIndex > controlIndex);
  const dryRunJob = workflow.slice(workflow.indexOf("  six-pack-offer-refresh:"), workflow.indexOf("  six-pack-reviewed-apply:"));
  const dryRunStep = dryRunJob.match(/- name: Fresh live-source dry-run[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.doesNotMatch(dryRunStep, /SIX_PACK_SYNC_APPROVER_DATABASE_URL|SIX_PACK_SYNC_EXECUTOR_DATABASE_URL/);
});
