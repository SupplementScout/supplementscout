const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260726210000_add_reviewed_variant_nutrition_apply.sql"
  ),
  "utf8"
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

test("reviewed nutrition apply requires the existing trusted control plane", () => {
  assert.match(normalized, /atomic_import_has_exact_keys\(jsonb,text\[\]\)/);
  assert.match(normalized, /retailer_catalogue_sha256_json\(jsonb\)/);
  assert.match(normalized, /retailer_catalogue_actual_database_target\(\)/);
});

test("reviewed nutrition apply is owner-only", () => {
  assert.match(
    normalized,
    /revoke all on function public\.apply_reviewed_product_variant_nutrition\(jsonb,boolean\) from public, anon, authenticated, service_role/
  );
  assert.match(
    normalized,
    /grant execute on function public\.apply_reviewed_product_variant_nutrition\(jsonb,boolean\) to postgres/
  );
  assert.doesNotMatch(normalized, /grant execute[^;]+service_role/);
});

test("reviewed nutrition ledger is private and forced RLS", () => {
  assert.match(
    normalized,
    /alter table public\.product_variant_nutrition_reviewed_applications force row level security/
  );
  assert.match(
    normalized,
    /revoke all on table public\.product_variant_nutrition_reviewed_applications from public, anon, authenticated, service_role/
  );
});

test("contract is bound to environment, scope and contract hashes", () => {
  assert.match(normalized, /p_contract->'changes'[\s\S]+reviewed_scope_hash/);
  assert.match(normalized, /p_contract-'reviewed_contract_hash'/);
  assert.match(normalized, /trusted database target mismatch/);
});

test("apply validates exact identities and exact before state", () => {
  assert.match(
    normalized,
    /jsonb_typeof\(v_change#>'\{after_nutrition_override,net_weight_g\}'\) is distinct from 'number'/,
  );
  assert.match(
    normalized,
    /abs\([\s\S]+net_weight_g[\s\S]+serving_count_verified[\s\S]+serving_size_g/,
  );
  assert.match(normalized, /p\.name = v_change->>'expected_product_name'/);
  assert.match(normalized, /v\.variant_key = v_change->>'expected_variant_key'/);
  assert.match(normalized, /v\.display_name = v_change->>'expected_display_name'/);
  assert.match(
    normalized,
    /v_variant\.nutrition_override = v_change->'before_nutrition_override'/
  );
});

test("apply rejects partial and unrecorded state and verifies write count", () => {
  assert.match(normalized, /pvn_partial_apply/);
  assert.match(normalized, /pvn_unrecorded_apply/);
  assert.match(normalized, /pvn_atomic_write_mismatch/);
  assert.match(normalized, /v_updated_count <> v_row_count/);
});

test("dry-run reports zero writes and apply only updates nutrition_override", () => {
  assert.match(
    normalized,
    /'mode','dry-run'[\s\S]+'business_writes',0[\s\S]+'control_plane_writes',0/
  );
  assert.match(
    normalized,
    /update public\.product_variants v set nutrition_override =/
  );
  assert.doesNotMatch(
    normalized,
    /update public\.(?:products|offers|retailer_products|retailers|price_history)/
  );
});
