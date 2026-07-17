const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const contract = require("./lib/retailer-snapshot/staging-execution-contract");
const { guard, isExactStagingEndpoint } = require("./retailer-snapshot-staging-executor");

const packageFile = path.join(__dirname, "test-fixtures/retailer-snapshot/jons-supplements/staging-execution-package.json");
const approvedPackage = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const local = { mode: "guard-test", "allow-staging-simulation": true, "disposable-database": true, "database-url": "postgresql://postgres@127.0.0.1/supplementscout_stage3_test_staging_executor_unit" };

test("simulation CLI accepts only explicit disposable loopback targets", () => {
  assert.equal(guard(local, {}).database, "supplementscout_stage3_test_staging_executor_unit");
  for (const changed of [{ "allow-staging-simulation": false }, { "disposable-database": false }, { "database-url": "postgresql://postgres@example.com/supplementscout_stage3_test_staging_executor_unit" }, { "database-url": "postgresql://postgres@db.aftboxmrdgyhizicfsfu.supabase.co/postgres" }, { "database-url": "postgresql://postgres@127.0.0.1/postgres" }]) assert.throws(() => guard({ ...local, ...changed }, {}));
  assert.throws(() => guard(local, { SAFE_UPDATE: "true" }));
  assert.throws(() => guard(local, { SUPABASE_SERVICE_ROLE_KEY: "secret" }));
});

test("real staging mode accepts only the exact target ref and endpoint", () => {
  const exact = { mode: "execute-staging", "allow-staging-business-writes": true, "target-project-ref": contract.STAGING_REF, "database-url": `postgresql://operator@db.${contract.STAGING_REF}.supabase.co/postgres` };
  assert.equal(guard(exact, {}).remote, true);
  assert.equal(isExactStagingEndpoint(new URL(`postgresql://postgres.${contract.STAGING_REF}@aws-0-eu-west-3.pooler.supabase.com/postgres`)), true);
  for (const changed of [{ "allow-staging-business-writes": false }, { "target-project-ref": contract.PRODUCTION_REF }, { "database-url": `postgresql://operator@db.${contract.PRODUCTION_REF}.supabase.co/postgres` }, { "database-url": "postgresql://operator@example.com/postgres" }, { "database-url": `postgresql://operator@db.${contract.STAGING_REF}.supabase.co/other` }]) assert.throws(() => guard({ ...exact, ...changed }, {}));
  assert.throws(() => guard(exact, { DATABASE_URL: "postgresql://secret" }));
});

test("frozen fixture remains historical while package binds the current framework commit", () => {
  const fixture = contract.validateFrozenFixture();
  const packageValue = contract.validatePackage(approvedPackage);
  assert.equal(fixture.source_records.length, 10);
  assert.equal(packageValue.fixture_build_commit, fixture.code_commit);
  assert.equal(packageValue.code_commit, "7a1f768024d323aa1c64707697274267d5a1d00d");
  assert.notEqual(packageValue.code_commit, packageValue.fixture_build_commit);
  assert.equal(contract.CHILD_GROUPS.length, 4);
});

test("contract and migration preserve the atomic path, trusted identity, and Phase 3 isolation", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260717140000_add_staging_retailer_catalogue_executor.sql"), "utf8");
  const cli = fs.readFileSync(__filename.replace(/\.test\.js$/, ".js"), "utf8");
  assert.match(migration, /validate_product_import_plan_read_only/i);
  assert.match(migration, /approve_product_import_plan/i);
  assert.match(migration, /apply_approved_product_import_plan/i);
  assert.match(migration, /pg_control_system/i);
  assert.match(migration, /supabase_migrations\.schema_migrations/i);
  assert.doesNotMatch(migration, /execute_local_retailer_catalogue_child/i);
  assert.doesNotMatch(migration, /6f7eefb29f775e773bd0764664a0ba138993fa06/i);
  assert.doesNotMatch(cli, /createClient|@supabase\/supabase-js|dotenv|\.env\.local/i);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(migration, /delete from public\.price_history[\s\S]+delete from public\.products/i);
});

test("apply and recovery request schemas are closed and fingerprints deterministic", () => {
  const applySchema = JSON.parse(fs.readFileSync(path.join(__dirname, "lib/retailer-snapshot/contracts/staging-execution.schema.json"), "utf8"));
  const recoverySchema = JSON.parse(fs.readFileSync(path.join(__dirname, "lib/retailer-snapshot/contracts/staging-recovery.schema.json"), "utf8"));
  assert.equal(applySchema.additionalProperties, false);
  assert.equal(recoverySchema.additionalProperties, false);
  assert.deepEqual(applySchema.required.sort(), [...contract.REQUEST_KEYS].sort());
  assert.deepEqual(recoverySchema.required.sort(), [...contract.RECOVERY_REQUEST_KEYS].sort());
  const request = Object.fromEntries(contract.REQUEST_KEYS.map((key) => [key, null]));
  request.request_fingerprint = contract.requestFingerprint(request);
  assert.equal(contract.requestFingerprint(request), request.request_fingerprint);
});
