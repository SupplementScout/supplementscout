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
  return { ...data, policy: { store_url: config.store_url, ...config.guardrails }, retailerSlug: config.retailer_slug, retailerId: "9001", targetEnvironment: "STAGING", targetProjectRef: "hxnrsyyqffztlvcrtgbf", targetDatabaseIdentity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf", expectedMigrationVersions: ["20260718150000_add_verified_no_change_offer_refresh", "20260718160000_add_retailer_offer_mixed_batch_executor"], expectedMigrationFingerprint: "9".repeat(64), migrationFingerprintAlgorithm: "SHA-256", migrationFingerprintVersion: "RSBI-CJ1", sourceSnapshotFingerprint: fixture.source_manifest_sha256, adapterFingerprint: "a".repeat(64), policyFingerprint: "b".repeat(64), codeCommit: "bc9ae1630c56cd7daeda3f94f93d9b6cfaedd7c8", expectedStateFingerprint: fixture.inventory_fingerprint, sourceCapturedAt: fixture.captured_at, now: new Date("2026-07-18T17:00:00.000Z"), sourceProductCount: 5, previousSourceProductCount: 5 };
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
  assert.equal(classifyExistingOffers({ ...input(), sourceCapturedAt: "2026-07-16T00:00:00.000Z" }).state, "BLOCKED");
  assert.equal(classifyExistingOffers({ ...input(), sourceProductCount: 4, previousSourceProductCount: 5 }).reason, "SOURCE_COLLAPSE");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].shipping_cost = "0.00"; })).reason, "SHIPPING_POLICY_DRIFT");
});
test("OOS, changed-row, mass-price and hard-price guardrails fail closed", () => {
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 3).forEach((r) => { r.in_stock = false; }))).state, "DRY_RUN_READY");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 4).forEach((r) => { r.in_stock = false; }))).reason, "MASS_OOS");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 7).forEach((r) => { r.product_handle = `changed-${r.external_variant_id}`; }))).reason, "MASS_CHANGE");
  assert.equal(classifyExistingOffers(input((d) => d.sourceVariants.slice(0, 6).forEach((r) => { r.price = (Number(r.price) + 0.1).toFixed(2); }))).reason, "MASS_PRICE");
  assert.equal(classifyExistingOffers(input((d) => { d.sourceVariants[0].price = "40.00"; })).reason, "HARD_PRICE_ANOMALY");
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
