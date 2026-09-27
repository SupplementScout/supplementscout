const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scriptPath = path.join(__dirname, "ra004-staging-schema-inventory.js");
const launcherPath = path.join(__dirname, "ra004-run-staging-schema-inventory.ps1");
const source = fs.readFileSync(scriptPath, "utf8");
const launcher = fs.readFileSync(launcherPath, "utf8");
const inventory = require("./ra004-staging-schema-inventory");

test("inventory is pinned to the exact staging host and project", () => {
  assert.equal(inventory.EXPECTED_HOST, "aws-0-eu-west-3.pooler.supabase.com");
  assert.equal(inventory.EXPECTED_REF, "hxnrsyyqffztlvcrtgbf");
  assert.match(source, /parsed\.hostname === EXPECTED_HOST/);
  assert.match(source, /parsed\.username\.includes\(EXPECTED_REF\)/);
});

test("inventory uses one explicit read-only repeatable-read transaction", () => {
  assert.equal((source.match(/begin transaction read only isolation level repeatable read/g) || []).length, 1);
  assert.equal((source.match(/await client\.query\("commit"\)/g) || []).length, 1);
  assert.match(source, /await client\.query\("rollback"\)/);
  assert.doesNotMatch(source, /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\s+(?:table|role|policy|function|into|public\.)/i);
});

test("inventory covers every dependency category without accepting arbitrary SQL", () => {
  for (const category of [
    "relations", "columns", "constraints", "indexes", "sequences", "policies",
    "relation_grants", "functions", "function_grants", "roles", "memberships",
    "schema_grants", "extensions", "ledger",
  ]) assert.match(source, new RegExp(`\\b${category.replace("_", "[_A-Za-z]*")}\\b`, "i"));
  assert.doesNotMatch(source, /process\.argv|readFileSync\([^)]*\.sql|RA004_INVENTORY_QUERY/);
});

test("launcher masks the only credential and clears it", () => {
  assert.equal((launcher.match(/ConvertFrom-MaskedInput '/g) || []).length, 1);
  assert.match(launcher, /RA004_INVENTORY_DATABASE_URL = \$databaseUrl/);
  assert.match(launcher, /RA004_INVENTORY_DATABASE_URL = ''/);
  assert.match(launcher, /INVENTORY_LAUNCHER_VALIDATION_PASS/);
  assert.doesNotMatch(launcher, /db push|ra004-staging-execution-coordinator|--include-all/i);
});
