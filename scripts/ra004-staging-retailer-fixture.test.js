const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { CONTRACTS, sha256File } = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const FILENAME = "20260926100000_create_ra004_staging_10reps_retailer.sql";
const FILE = path.join(ROOT, "supabase", "migrations", FILENAME);
const SHA256 = "2948af2c348ebf7cca56b2f46966a393ad022bd4cbfef0876ac9bc899a92ba0e";
const SQL = fs.readFileSync(FILE, "utf8").replaceAll("\r\n", "\n");

test("RA-004 staging retailer fixture is immutable and excluded from ordinary deployment", () => {
  assert.equal(sha256File(FILE), SHA256);
  assert.equal(CONTRACTS.STAGING.excluded[FILENAME], SHA256);
  assert.equal(CONTRACTS.PRODUCTION.excluded[FILENAME], SHA256);
  assert.ok(!CONTRACTS.STAGING.pending.some((entry) => entry.filename === FILENAME));
  assert.ok(!CONTRACTS.PRODUCTION.pending.some((entry) => entry.filename === FILENAME));
});

test("RA-004 fixture is one transactional, staging-attested minimal retailer insert", () => {
  assert.match(SQL, /^begin;[\s\S]*commit;\n$/);
  assert.match(SQL, /current_user <> 'postgres'/);
  assert.match(SQL, /'target_environment' <> 'STAGING'/);
  assert.match(SQL, /'project_ref' <> 'hxnrsyyqffztlvcrtgbf'/);
  assert.match(SQL, /'project_ref' = 'aftboxmrdgyhizicfsfu'/);
  assert.match(SQL, /'database_identity' <> 'supplementscout-staging:hxnrsyyqffztlvcrtgbf'/);
  assert.match(SQL, /lock table public\.retailers in access exclusive mode/);
  assert.match(SQL, /if v_existing_count <> 0/);
  assert.match(SQL, /if v_retailer_id = 14/);
  assert.match(SQL, /insert into public\.retailers\(id, name, slug\)[\s\S]*values \(v_retailer_id, '10 Reps', '10-reps'\)/);
  assert.equal((SQL.match(/\binsert\s+into\b/gi) || []).length, 1);
  assert.doesNotMatch(SQL, /\b(?:update|delete\s+from|truncate|merge)\b/i);
  assert.doesNotMatch(SQL, /public\.(?:products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(SQL, /\b(?:feed|shadow|approval|plan|apply)\b/i);
});
