const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260803270000_verify_separate_offer_and_mapping_urls.sql"),
  "utf8",
);
const timestampSql = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260831080000_fix_verified_no_change_timestamp_guard.sql"),
  "utf8",
);
const timestampOperatorSql = fs.readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260831081000_fix_verified_no_change_timestamp_guard_jsonb_operator.sql"),
  "utf8",
);

test("separate verified URLs migration is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
});

test("validator compares each URL to its own closed expected state", () => {
  assert.match(sql, /v_mapping\.external_url is distinct from p_plan#>>'\{retailer_product,values,external_url\}'/);
  assert.match(sql, /v_mapping\.external_url is distinct from v_offer\.url/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("verified no-change timestamp guard migration compares timestamp instants outside JSONB state", () => {
  const replacementStart = timestampSql.indexOf("create or replace function public.validate_verified_offer_no_change_plan");
  const replacementEnd = timestampSql.indexOf("end\n$validate$;", replacementStart);
  const replacementBody = timestampSql.slice(replacementStart, replacementEnd);
  assert.match(timestampSql, /^begin;/i);
  assert.match(timestampSql, /commit;\s*$/i);
  assert.match(timestampSql, /current_user<>'postgres'/);
  assert.match(timestampSql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(timestampSql, /create or replace function public\.verified_offer_refresh_required_timestamptz/);
  assert.match(timestampSql, /p_value::timestamptz/);
  assert.match(replacementBody, /v_expected_offer_last_checked_at is distinct from v_offer\.last_checked_at/);
  assert.match(replacementBody, /p_plan#>'\{expected_state,offer\}' - 'last_checked_at'/);
  assert.match(replacementBody, /v_mapping\.external_url is distinct from p_plan#>>'\{retailer_product,values,external_url\}'/);
  assert.doesNotMatch(replacementBody, /v_actual is distinct from p_plan#>'\{expected_state,offer\}'/);
  assert.doesNotMatch(timestampSql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("timestamp operator repair is production-only, forward-only, and only disambiguates JSONB minus text", () => {
  assert.match(timestampOperatorSql, /^begin;/i);
  assert.match(timestampOperatorSql, /commit;\s*$/i);
  assert.match(timestampOperatorSql, /current_user<>'postgres'/);
  assert.match(timestampOperatorSql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(timestampOperatorSql, /replace\(\s*v_definition,\s*\$old\$p_plan#>'\{expected_state,offer\}' - 'last_checked_at'\$old\$,\s*\$new\$\(p_plan#>'\{expected_state,offer\}'\) - 'last_checked_at'::text\$new\$/);
  assert.match(timestampOperatorSql, /\(p_plan#>'\{expected_state,offer\}'\) - 'last_checked_at'::text/);
  assert.doesNotMatch(timestampOperatorSql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
});
