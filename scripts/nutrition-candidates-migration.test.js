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
