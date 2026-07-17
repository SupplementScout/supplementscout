const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const contract = require("./lib/retailer-snapshot/staging-execution-contract");
const { guard } = require("./retailer-snapshot-staging-executor");

const base = { mode: "guard-test", "allow-staging-simulation": true, "disposable-database": true, "database-url": "postgresql://postgres@127.0.0.1/supplementscout_stage3_test_staging_executor_unit" };
test("staging simulation CLI accepts only explicit disposable loopback targets", () => {
  assert.equal(guard(base, {}).database, "supplementscout_stage3_test_staging_executor_unit");
  for (const changed of [{ "allow-staging-simulation": false }, { "disposable-database": false }, { "database-url": "postgresql://postgres@example.com/supplementscout_stage3_test_staging_executor_unit" }, { "database-url": "postgresql://postgres@db.aftboxmrdgyhizicfsfu.supabase.co/postgres" }, { "database-url": "postgresql://postgres@127.0.0.1/postgres" }]) assert.throws(() => guard({ ...base, ...changed }, {}));
  assert.throws(() => guard(base, { SAFE_UPDATE: "true" }));
  assert.throws(() => guard(base, { SUPABASE_SERVICE_ROLE_KEY: "secret" }));
});
test("frozen fixture maps to four complete atomic children and exact aggregate", () => {
  const fixture = contract.validateFrozenFixture();
  assert.equal(fixture.source_records.length, 10); assert.equal(contract.CHILD_GROUPS.length, 4);
  assert.deepEqual(contract.CHILD_GROUPS.map((group) => group.records.length), [1, 1, 1, 7]);
  assert.deepEqual(contract.CHILD_GROUPS[2].expected_deltas, { retailers: 0, products: 0, product_variants: 0, retailer_products: 1, offers: 1, price_history: 1 });
});
test("contract and migration preserve the core atomic path and isolate Phase 3", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260717140000_add_staging_retailer_catalogue_executor.sql"), "utf8");
  const cli = fs.readFileSync(__filename.replace(/\.test\.js$/, ".js"), "utf8");
  assert.match(migration, /validate_product_import_plan_read_only/i); assert.match(migration, /approve_product_import_plan/i); assert.match(migration, /apply_approved_product_import_plan/i);
  assert.doesNotMatch(migration, /execute_local_retailer_catalogue_child/i);
  assert.doesNotMatch(cli, /createClient|@supabase\/supabase-js|dotenv|\.env\.local/i);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(migration, /delete from public\.price_history[\s\S]+delete from public\.products/i);
});
test("request schema is closed and request fingerprint is deterministic", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "lib/retailer-snapshot/contracts/staging-execution.schema.json"), "utf8"));
  assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required.sort(), [...contract.REQUEST_KEYS].sort());
  const request = Object.fromEntries(contract.REQUEST_KEYS.map((key) => [key, null])); request.request_fingerprint = contract.requestFingerprint(request); assert.equal(contract.requestFingerprint(request), request.request_fingerprint);
});
