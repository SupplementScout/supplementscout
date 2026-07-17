const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { guard, requestFingerprint } = require("./retailer-snapshot-phase3-executor");

const base = { "allow-local-business-writes": true, "disposable-database": true, "database-url": "postgresql://postgres@127.0.0.1/supplementscout_phase3_test_unit", target: "local" };
test("hard environment guard accepts only explicit disposable local target", () => {
  assert.equal(guard(base, {}).database, "supplementscout_phase3_test_unit");
  for (const changed of [
    { "allow-local-business-writes": false }, { "disposable-database": false },
    { "database-url": "postgresql://postgres@example.com/supplementscout_phase3_test_unit" },
    { "database-url": "postgresql://postgres@db.aftboxmrdgyhizicfsfu.supabase.co/postgres" },
    { "database-url": "postgresql://postgres@127.0.0.1/postgres" }, { target: "staging" }, { target: "production" },
  ]) assert.throws(() => guard({ ...base, ...changed }, {}));
  assert.throws(() => guard(base, { SAFE_UPDATE: "true" }));
  assert.throws(() => guard(base, { SUPABASE_SERVICE_ROLE_KEY: "secret" }));
});
test("request fingerprint is deterministic and excludes only its sealed field", () => {
  const request = { schema_version: 1, row_plans: [], request_fingerprint: null };
  const a = requestFingerprint(request); request.request_fingerprint = a;
  assert.equal(requestFingerprint(request), a); assert.match(a, /^[0-9a-f]{64}$/);
});
test("executor has no Supabase client or direct business DML", () => {
  const cli = fs.readFileSync(__filename.replace(/\.test\.js$/, ".js"), "utf8");
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260717130000_add_local_retailer_catalogue_child_executor.sql"), "utf8");
  assert.doesNotMatch(cli, /createClient|@supabase\/supabase-js|dotenv|readFileSync\([^)]*\.env/);
  assert.doesNotMatch(migration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)\b/i);
  assert.match(migration, /apply_approved_product_import_plan\s*\(/i);
  assert.doesNotMatch(migration, /grant execute[^;]+(?:anon|authenticated|service_role)/i);
});
