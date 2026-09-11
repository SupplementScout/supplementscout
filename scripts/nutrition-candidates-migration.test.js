const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260802100000_create_nutrition_candidates.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const sql = migration.replace(/\s+/g, " ").trim().toLowerCase();
const variantMigration = fs.readFileSync(path.join(
  process.cwd(), "supabase", "migrations",
  "20260911120000_add_nutrition_candidate_variant_provenance.sql"
), "utf8").replace(/\s+/g, " ").trim().toLowerCase();
const preworkoutMigration = fs.readFileSync(path.join(
  process.cwd(), "supabase", "migrations",
  "20260911130000_add_nutrition_candidate_preworkout_facts.sql"
), "utf8").replace(/\s+/g, " ").trim().toLowerCase();

test("nutrition candidates migration is transactional and candidate-only", () => {
  assert.match(sql, /^begin;/);
  assert.match(sql, /create table public\.nutrition_candidates/);
  assert.match(sql, /commit;$/);
  assert.doesNotMatch(sql, /\b(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers)/);
  assert.doesNotMatch(sql, /nutrition_verified|unit_pricing_verified/);
});

test("candidate fields and field-unit pairs are constrained", () => {
  for (const field of [
    "net_weight_g",
    "net_volume_ml",
    "serving_count_verified",
    "serving_size_g",
    "serving_size_ml",
    "protein_per_serving_g",
    "creatine_per_serving_g",
  ]) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(sql, /caffeine_per_serving_mg/);
  assert.match(sql, /proposed_unit = 'g'/);
  assert.match(sql, /proposed_unit = 'ml'/);
  assert.match(sql, /proposed_unit = 'count'/);
});

test("RLS is enabled with service-role only grants and no public policy", () => {
  assert.match(sql, /alter table public\.nutrition_candidates enable row level security/);
  assert.match(sql, /revoke all on table public\.nutrition_candidates from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table public\.nutrition_candidates to service_role/);
  assert.doesNotMatch(sql, /create policy/);
  assert.doesNotMatch(sql, /grant .* on table public\.nutrition_candidates to (?:anon|authenticated|public)/);
});

test("review status is pending first and evidence becomes immutable", () => {
  assert.match(sql, /status text not null default 'pending'/);
  assert.match(sql, /status in \('pending', 'approved', 'rejected'\)/);
  assert.match(sql, /if old\.status <> 'pending'/);
  assert.match(sql, /new\.status not in \('approved', 'rejected'\)/);
  assert.match(sql, /nutrition candidate evidence is immutable/);
  assert.match(sql, /before update on public\.nutrition_candidates/);
});

test("candidate evidence and review metadata are bounded", () => {
  assert.match(sql, /source_file_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /length\(btrim\(evidence_snippet\)\) between 1 and 300/);
  assert.match(sql, /length\(review_note\) <= 1000/);
  assert.match(sql, /candidate_fingerprint text not null unique/);
  assert.match(sql, /position\('#' in source_url\) = 0/);
  assert.match(sql, /source_url !~\*/);
  assert.match(sql, /in \(source_domain, 'www\.' \|\| source_domain\)/);
});

test("variant provenance migration is nullable for legacy rows and guarded for exact variants", () => {
  assert.match(variantMigration, /^begin;/);
  assert.match(variantMigration, /add column product_variant_id bigint references public\.product_variants\(id\) on delete restrict/);
  assert.match(variantMigration, /add column source_archive_uri text/);
  assert.doesNotMatch(variantMigration, /product_variant_id bigint not null|source_archive_uri text not null/);
  assert.match(variantMigration, /product_variant_id is null or source_archive_uri is not null/);
  assert.match(variantMigration, /supabase-storage:\/\/nutrition-sources/);
  assert.match(variantMigration, /variant does not belong to product/);
  assert.match(variantMigration, /new\.product_variant_id[\s\S]*new\.source_archive_uri/);
  assert.doesNotMatch(variantMigration, /\b(?:insert into|update|delete from) public\.(?:products|product_variants)/);
  assert.match(variantMigration, /commit;$/);
});

test("NUT-02B migration models structured ingredient states without catalogue writes", () => {
  assert.match(preworkoutMigration, /^begin;/);
  for (const field of ["caffeine_per_serving_mg", "citrulline_per_serving_mg", "beta_alanine_per_serving_mg"]) {
    assert.match(preworkoutMigration, new RegExp(`'${field}'`));
  }
  for (const state of ["present_with_amount", "present_amount_not_disclosed", "confirmed_absent", "no_information", "conflicting_information"]) {
    assert.match(preworkoutMigration, new RegExp(`'${state}'`));
  }
  assert.match(preworkoutMigration, /source_quantity_unit in \('mg', 'g'\)/);
  assert.match(preworkoutMigration, /proposed_value = source_quantity_value \* case source_quantity_unit when 'g' then 1000 else 1 end/);
  assert.match(preworkoutMigration, /quantity_basis = 'per_serving'/);
  assert.match(preworkoutMigration, /ingredient_form in \('l_citrulline', 'citrulline_malate'\)/);
  assert.match(preworkoutMigration, /ingredient_form = 'citrulline_malate'/);
  assert.match(preworkoutMigration, /new\.information_state[\s\S]*old\.information_state/);
  assert.doesNotMatch(preworkoutMigration, /\b(?:insert into|update|delete from) public\.(?:products|product_variants)/);
  assert.match(preworkoutMigration, /commit;$/);
});
