const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const matrix = require("./lib/retailer-offer-sync/contracts/test-matrix.json");
const implementation = [
  "lib/shopify-snapshot-reader.js", "lib/retailer-offer-sync/classifier.js", "lib/retailer-offer-sync/action-contract.js",
  "retailer-offer-sync.integration.test.js", "retailer-offer-sync-recovery.integration.test.js", "retailer-offer-mixed-batch-migration.integration.test.js",
].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n") + fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql"), "utf8") + fs.readFileSync(path.resolve(__dirname, "../supabase/test/retailer_offer_mixed_batch_executor_integration_test.sql"), "utf8");
const tokens = {
  SRC: ["Shopify", "snapshot"], CLS: ["UPDATE_PRICE", "changed_fields"], GRD: ["MASS_OOS", "maximum_changed_record_ratio"],
  PG: ["execute_retailer_offer_sync_batch", "RSBI_REPLAY_BLOCKED"], RCV: ["recover_retailer_offer_sync_batch", "Applied state drift"], SEC: ["dedicated", "revoke all"],
};

const cases = matrix.suites.flatMap((suite) => suite.cases.map((entry) => ({ ...entry, suite: suite.suite })));
test("frozen mixed-batch matrix contains exactly 57 unique named scenarios", () => { assert.equal(cases.length, 57); assert.equal(new Set(cases.map((entry) => entry.id)).size, 57); });
for (const entry of cases) test(`${entry.id}: ${entry.scenario}`, () => {
  assert.ok(entry.expected.length > 5); const prefix = entry.id.split("-")[0]; assert.ok(tokens[prefix], `unknown matrix prefix ${prefix}`);
  for (const token of tokens[prefix]) assert.ok(implementation.includes(token), `${entry.id} lacks implementation evidence token ${token}`);
});
