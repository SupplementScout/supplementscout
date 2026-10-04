const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(ROOT, "supabase/migrations/20261004120000_add_central_control_plan_readback.sql");
const sql = fs.readFileSync(MIGRATION, "utf8");

test("central readback is production-bound and retailer-neutral", () => {
  assert.match(sql, /target_environment' <> 'PRODUCTION'/);
  assert.match(sql, /aftboxmrdgyhizicfsfu/);
  assert.match(sql, /read_control_plan_status_v1\(p_parent_plan_id uuid\)/);
  assert.doesNotMatch(sql, /10 Reps|retailer_id\s*=|06ae81b7/);
});

test("caller is durable but disabled and receives one private RPC only", () => {
  assert.match(sql, /create role retailer_control_plan_readback_caller\s+\n?\s*nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/);
  assert.match(sql, /connection limit 1/);
  assert.match(sql, /default_transaction_read_only=on/);
  assert.match(sql, /grant usage on schema retailer_readback to retailer_control_plan_readback_caller/);
  assert.match(sql, /grant execute on function retailer_readback\.read_control_plan_status_v1\(uuid\)\s+to retailer_control_plan_readback_caller/);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete|truncate).*retailer_control_plan_readback_caller/i);
});

test("wrapper is static, stable and closed to shared runtime roles", () => {
  assert.match(sql, /language sql\s+stable\s+security definer\s+set search_path=pg_catalog/);
  assert.match(sql, /select public\.get_retailer_catalogue_plan_status\(p_parent_plan_id\)/);
  assert.doesNotMatch(sql, /alter function[\s\S]+owner to/i);
  assert.doesNotMatch(sql, /execute format|dynamic sql/i);
  assert.match(sql, /revoke all on function retailer_readback\.read_control_plan_status_v1\(uuid\)[\s\S]+from public,anon,authenticated,service_role/);
});

test("incident regression restores the baseline helper ACL and checks reachable capabilities", () => {
  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public/);
  assert.match(sql, /has_schema_privilege\('retailer_control_plan_readback_caller',n\.oid,'USAGE'\)/);
  assert.match(sql, /has_function_privilege\('public','public\.rls_auto_enable\(\)','EXECUTE'\)/);
  assert.match(sql, /RA_STAB_CENTRAL_REACHABLE_RELATION_PRIVILEGE/);
});
