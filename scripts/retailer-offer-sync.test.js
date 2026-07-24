const assert = require("node:assert/strict");
const test = require("node:test");
const fixture = require("./test-fixtures/retailer-offer-sync/jons-supplements-26.json");
const config = require("../config/retailers/jons-supplements-offer-sync.json");
const { ACTIONS, actionForChanges } = require("./lib/retailer-offer-sync/action-contract");
const { fingerprint, sortRows } = require("./lib/retailer-offer-sync/artifacts");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { canTransition, transition } = require("./lib/retailer-offer-sync/state-machine");
const { buildDryRun, buildExecutionArtifact, executeApprovedBatch, parseArgs } = require("./retailer-offer-sync");

function inventory() {
  const targets = [];
  for (const group of fixture.groups) group.external_variant_ids.forEach((variant, index) => {
    const price = group.price;
    const url = `${config.store_url}/products/${group.product_handle}?variant=${variant}`;
    targets.push({ offer_id: group.offer_ids[index], retailer_product_id: group.retailer_product_ids[index], external_product_id: group.external_product_id, external_variant_id: variant, price, shipping_cost: fixture.defaults.shipping_cost, total_price: (Number(price) + Number(fixture.defaults.shipping_cost)).toFixed(2), in_stock: fixture.defaults.in_stock, url, external_url: url, last_checked_at: fixture.defaults.last_checked_at });
  });
  const sourceVariants = targets.map((row) => ({ external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, product_handle: new URL(row.url).pathname.split("/").pop(), price: row.price, shipping_cost: row.shipping_cost, in_stock: row.in_stock }));
  return { targets, sourceVariants };
}
function input(changes = () => {}) {
  const data = inventory(); changes(data);
  return { ...data, policy: { store_url: config.store_url, ...config.guardrails }, retailerSlug: config.retailer_slug, retailerId: "9001", targetEnvironment: "STAGING", targetProjectRef: "hxnrsyyqffztlvcrtgbf", targetDatabaseIdentity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf", expectedMigrationVersions: ["20260718150000_add_verified_no_change_offer_refresh", "20260718160000_add_retailer_offer_mixed_batch_executor"], expectedMigrationFingerprint: "9".repeat(64), migrationFingerprintAlgorithm: "SHA-256", migrationFingerprintVersion: "RSBI-CJ1", sourceSnapshotFingerprint: fixture.source_manifest_sha256, rawSourceFingerprint: "7".repeat(64), semanticSourceFingerprint: fixture.source_manifest_sha256, adapterFingerprint: "a".repeat(64), policyFingerprint: "b".repeat(64), codeCommit: "bc9ae1630c56cd7daeda3f94f93d9b6cfaedd7c8", expectedStateFingerprint: fixture.inventory_fingerprint, sourceCapturedAt: fixture.captured_at, now: new Date("2026-07-18T17:00:00.000Z"), sourceProductCount: 5, previousSourceProductCount: 5 };
}
function sizedInput(count, scopeName = `TEST_SCOPE_${count}`) {
  const scenario = input();
  while (scenario.targets.length < count) {
    const index = scenario.targets.length;
    const template = scenario.targets[index % fixture.groups.length];
    const externalProductId = `extra-product-${index}`;
    const externalVariantId = `extra-variant-${index}`;
    const url = `${config.store_url}/products/extra-${index}?variant=${externalVariantId}`;
    scenario.targets.push({
      ...template,
      offer_id: String(900_000 + index),
      retailer_product_id: String(800_000 + index),
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: null,
      url,
      external_url: url,
    });
    scenario.sourceVariants.push({
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: null,
      product_handle: `extra-${index}`,
      price: template.price,
      shipping_cost: template.shipping_cost,
      in_stock: template.in_stock,
    });
  }
  scenario.targets = scenario.targets.slice(0, count);
  scenario.sourceVariants = scenario.sourceVariants.slice(0, count);
  scenario.policy = { ...scenario.policy, required_matched_offers: count };
  scenario.guardScope = { name: scopeName, retailer: "Test Retailer" };
  return scenario;
}

test("closed action enum and changed-field bitmap cover all six executable actions", () => {
  assert.equal(ACTIONS.length, 8);
  assert.equal(config.target_shopify_identity_groups.flatMap((group) => group.external_variant_ids.map((variant) => `${group.external_product_id}:${variant}`)).length, 26);
  assert.deepEqual([[false,false,false],[true,false,false],[false,true,false],[true,true,false],[false,false,true],[true,false,true]].map(([price,stock,url]) => actionForChanges({ price, stock, url })), ["VERIFY_NO_CHANGE","UPDATE_PRICE","UPDATE_STOCK","UPDATE_PRICE_AND_STOCK","UPDATE_URL","UPDATE_PRICE_STOCK_URL"]);
});
test("full 26-row Jon's fixture classifies as deterministic verified no-change", () => {
  const first = buildDryRun(input()); const second = buildDryRun(input());
  assert.equal(first.state, "DRY_RUN_READY"); assert.equal(first.rows.length, 26); assert.equal(first.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);
  assert.equal(first.expected_deltas.logical_field_deltas.last_checked_at_updates, 26); assert.equal(first.expected_deltas.row_count_deltas.price_history, 0); assert.equal(first.artifact_fingerprint, second.artifact_fingerprint);
  const classification = classifyExistingOffers(input());
  assert.equal(classification.action_manifest_fingerprint, fingerprint({ state: classification.state, rows: classification.rows, expected_deltas: classification.expected_deltas }));
});
test("single price, stock, combined, URL and composite changes classify exactly", () => {
  const scenarios = [
    ["UPDATE_PRICE", (d) => { d.sourceVariants[0].price = "17.49"; }],
    ["UPDATE_STOCK", (d) => { d.sourceVariants[0].in_stock = false; }],
    ["UPDATE_PRICE_AND_STOCK", (d) => { d.sourceVariants[0].price = "17.49"; d.sourceVariants[0].in_stock = false; }],
    ["UPDATE_URL", (d) => { d.sourceVariants[0].product_handle = "new-valid-handle"; }],
    ["UPDATE_PRICE_STOCK_URL", (d) => { d.sourceVariants[0].product_handle = "new-valid-handle"; d.sourceVariants[0].price = "17.49"; }],
  ];
  for (const [expected, mutate] of scenarios) { const result = classifyExistingOffers(input(mutate)); assert.equal(result.state, "DRY_RUN_READY"); assert.equal(result.rows.find((row) => row.action !== "VERIFY_NO_CHANGE").action, expected); }
});
test("identity, coverage, freshness and source-collapse anomalies block the whole run", () => {
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.pop())).state, "BLOCKED");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].external_product_id = "wrong"; })).action, "BLOCK_IDENTITY_DRIFT");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].external_sku = "unexpected"; })).action, "BLOCK_IDENTITY_DRIFT");
  assert.equal(classifyExistingOffers({ ...input(), sourceCapturedAt: "2026-07-16T00:00:00.000Z" }).state, "BLOCKED");
  assert.equal(classifyExistingOffers({ ...input(), sourceProductCount: 4, previousSourceProductCount: 5 }).reason, "SOURCE_COLLAPSE");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].shipping_cost = "0.00"; })).reason, "SHIPPING_POLICY_DRIFT");
});
test("execution artifacts bind semantic source fingerprints and reject semantic package reuse", () => {
  const first = buildDryRun(input());
  const changed = buildDryRun({ ...input(), semanticSourceFingerprint: "6".repeat(64) });
  const metadataOnly = input((data) => data.sourceVariants.forEach((row) => { row.source_updated_at = "2026-07-19T01:00:00.000Z"; }));
  metadataOnly.rawSourceFingerprint = "5".repeat(64);
  const metadataOnlyArtifact = buildDryRun(metadataOnly);
  assert.equal(first.source_snapshot_fingerprint, fixture.source_manifest_sha256);
  assert.equal(changed.source_snapshot_fingerprint, "6".repeat(64));
  assert.notEqual(first.artifact_fingerprint, changed.artifact_fingerprint);
  assert.equal(metadataOnlyArtifact.artifact_fingerprint, first.artifact_fingerprint);
  assert.throws(() => buildDryRun({ ...input(), semanticSourceFingerprint: "bad" }), /Raw and semantic source fingerprints/);
});
test("OOS, changed-row, mass-price and hard-price guardrails fail closed", () => {
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 3).forEach((r) => { r.in_stock = false; }))).state, "DRY_RUN_READY");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 4).forEach((r) => { r.in_stock = false; }))).reason, "MASS_OOS");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 7).forEach((r) => { r.product_handle = `changed-${r.external_variant_id}`; }))).reason, "MASS_CHANGE");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 6).forEach((r) => { r.price = (Number(r.price) + 0.1).toFixed(2); }))).reason, "MASS_PRICE");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].price = "40.00"; })).reason, "HARD_PRICE_ANOMALY");
});
test("MASS_OOS ignores an unchanged historical OOS baseline but blocks genuine new transitions", () => {
  function fiveOfferInput(previousOos) {
    const scenario = input((data) => {
      data.targets = data.targets.slice(0, 5);
      data.sourceVariants = data.sourceVariants.slice(0, 5);
      for (let index = 0; index < previousOos; index += 1) {
        data.targets[index].in_stock = false;
        data.sourceVariants[index].in_stock = false;
      }
    });
    scenario.policy = { ...scenario.policy, required_matched_offers: 5 };
    return scenario;
  }

  const twoHistoricalOos = classifyExistingOffers(fiveOfferInput(2));
  assert.equal(twoHistoricalOos.state, "DRY_RUN_READY");
  assert.equal(twoHistoricalOos.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);

  const allHistoricalOos = classifyExistingOffers(fiveOfferInput(5));
  assert.equal(allHistoricalOos.state, "DRY_RUN_READY");
  assert.equal(allHistoricalOos.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);

  const restock = fiveOfferInput(1);
  restock.sourceVariants[0].in_stock = true;
  const restockResult = classifyExistingOffers(restock);
  assert.equal(restockResult.state, "DRY_RUN_READY");
  assert.equal(restockResult.rows.find((row) => row.offer_id === restock.targets[0].offer_id).action, "UPDATE_STOCK");

  for (const count of [4, 5]) {
    const scenario = fiveOfferInput(0);
    scenario.sourceVariants.slice(0, count).forEach((source) => { source.in_stock = false; });
    const blocked = classifyExistingOffers(scenario);
    assert.equal(blocked.reason, "MASS_OOS");
    assert.equal(blocked.detail.new_oos, count);
  }
});
test("30 of 30 VERIFY_NO_CHANGE rows reconcile to zero changes and cannot produce MASS_CHANGE", () => {
  const result = classifyExistingOffers(sizedInput(30, "CREATINE_HEALTHY_30"));
  assert.equal(result.state, "DRY_RUN_READY");
  assert.equal(result.rows.length, 30);
  assert.equal(result.rows.every((row) => row.action === "VERIFY_NO_CHANGE"), true);
  assert.equal(result.guard_evidence.scope_name, "CREATINE_HEALTHY_30");
  assert.equal(result.guard_evidence.total, 30);
  assert.equal(result.guard_evidence.no_change, 30);
  assert.equal(result.guard_evidence.changed, 0);
  assert.equal(result.guard_evidence.changed_ratio, 0);
  assert.equal(result.guard_evidence.reconciled_total, 30);
  assert.equal(result.guard_evidence.guards.find((guard) => guard.guard === "MASS_CHANGE").result, "PASS");
});
test("guard evidence counts one real change exactly once and preserves the MASS_CHANGE boundary", () => {
  const atBoundary = sizedInput(4, "BOUNDARY_25_PERCENT");
  atBoundary.targets[0].in_stock = false;
  const boundaryResult = classifyExistingOffers(atBoundary);
  assert.equal(boundaryResult.state, "DRY_RUN_READY");
  assert.equal(boundaryResult.guard_evidence.changed, 1);
  assert.equal(boundaryResult.guard_evidence.action_counts.UPDATE_STOCK, 1);
  assert.equal(boundaryResult.guard_evidence.changed_ratio, 0.25);
  assert.equal(boundaryResult.guard_evidence.guards.find((guard) => guard.guard === "MASS_CHANGE").result, "PASS");

  const aboveBoundary = sizedInput(4, "ABOVE_BOUNDARY");
  aboveBoundary.targets[0].in_stock = false;
  aboveBoundary.targets[1].in_stock = false;
  const blocked = classifyExistingOffers(aboveBoundary);
  assert.equal(blocked.reason, "MASS_CHANGE");
  assert.equal(blocked.rows.length, 4);
  assert.equal(blocked.guard_evidence.changed, 2);
  assert.equal(blocked.guard_evidence.reconciled, true);
  assert.equal(Object.values(blocked.guard_evidence.action_counts).reduce((sum, count) => sum + count, 0), 4);
});
test("sequential classifications and stale blocked artifacts cannot leak guard state", () => {
  const blockedInput = sizedInput(5, "JONS_CHILD_5");
  blockedInput.targets[0].in_stock = false;
  blockedInput.targets[1].in_stock = false;
  const blocked = classifyExistingOffers(blockedInput);
  assert.equal(blocked.reason, "MASS_CHANGE");
  assert.equal(JSON.parse(JSON.stringify(blocked)).guard_evidence.changed, 2);

  const fresh = classifyExistingOffers(sizedInput(5, "JONS_CHILD_5"));
  assert.equal(fresh.state, "DRY_RUN_READY");
  assert.equal(fresh.guard_evidence.changed, 0);
  assert.equal(fresh.guard_evidence.guards.find((guard) => guard.guard === "MASS_CHANGE").result, "PASS");
  assert.deepEqual(fresh.guard_evidence.scope_row_ids, fresh.rows.map((row) => String(row.offer_id)));
});
test("artifact ordering and state transitions are stable and closed", () => {
  assert.deepEqual(sortRows([{ offer_id: "10" }, { offer_id: "2" }]).map((x) => x.offer_id), ["2", "10"]);
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 })); assert.equal(canTransition("DRY_RUN_READY", "APPROVED"), true); assert.equal(transition("APPLYING", "APPLIED"), "APPLIED"); assert.throws(() => transition("BLOCKED", "APPROVED"), /Forbidden/);
});
test("CLI is dry-run only and approved execution needs injected RPC and approval", async () => {
  assert.throws(() => parseArgs([]), /requires/); assert.throws(() => parseArgs(["--input=x", "--output=outside.json"]), /inside tmp/);
  const dryRun = buildDryRun(input());
  assert.throws(() => buildDryRun({ ...input(), expectedMigrationVersions: undefined }), /migration versions/);
  assert.throws(() => buildDryRun({ ...input(), expectedMigrationFingerprint: undefined }), /migration fingerprint/);
  await assert.rejects(executeApprovedBatch({ approvalId: "approval", artifact: dryRun, rpc: async () => ({}) }), /execution artifact/);
  const plans = Object.fromEntries(dryRun.rows.map((row) => [row.offer_id, { meta: { operation_type: "verify_offer_no_change" } }]));
  const artifact = buildExecutionArtifact(dryRun, plans);
  const calls = []; const result = await executeApprovedBatch({ approvalId: "approval", executionFingerprint: "8".repeat(64), artifact, rpc: async (...args) => { calls.push(args); return { data: "ok" }; } });
  assert.equal(result.data, "ok"); assert.equal(calls[0][0], "execute_retailer_offer_sync_batch");
  assert.deepEqual(calls[0][1].p_request.expected_migration_versions, artifact.expected_migration_versions); assert.equal(calls[0][1].p_request.expected_migration_fingerprint, artifact.expected_migration_fingerprint);
});

module.exports = { input, inventory };
