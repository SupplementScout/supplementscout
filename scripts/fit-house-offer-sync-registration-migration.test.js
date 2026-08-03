const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const file = path.join(
  process.cwd(),
  "supabase/migrations/20260726170000_add_fit_house_offer_sync_registration.sql",
);
const sql = fs.readFileSync(file, "utf8");
const selector = require("./supabase-migration-selector");
const expectedSha = "214ace99e775f443692a19410a3b6e19e076472371f070cd10dd5bbaa0c9554a";

test("migration is hash-bound and transactional", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), expectedSha);
  assert.deepEqual(selector.CONTRACTS.STAGING.pending, []);
  assert.equal(selector.CONTRACTS.STAGING.ledgerCount, 77);
  assert.deepEqual(selector.CONTRACTS.PRODUCTION.pending, [
    {
      filename: "20260803260000_align_existing_offer_option_evidence.sql",
      sha256: "cb6fdbaab004de4734db5755e0dc4498bfded6188f8337625a0db78b8b68cdf5",
    },
  ]);
  assert.equal(selector.CONTRACTS.PRODUCTION.ledgerCount, 87);
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
});

test("registration is frozen to Fit House Shopify scope and manifest", () => {
  assert.match(sql, /retailer_id' <> '9'/);
  assert.match(sql, /retailer_slug' <> 'fit-house'/);
  assert.match(sql, /source_platform' <> 'SHOPIFY'/);
  assert.match(sql, /source_domain'\) <> 'fithouse\.uk'/);
  assert.match(sql, /jsonb_array_length\(v_manifest\) <> 286/);
  assert.match(sql, /8a3653774c7169b40db0dfa129bba83d3cb496b17f25513a256b8fa84999897f/);
  assert.match(sql, /v_mapping\.retailer_id <> 9 or v_offer\.retailer_id <> 9/);
  assert.doesNotMatch(sql, /Whey Okay|whey-okay|retailer_id <> 3/);
});

test("migration changes only the dedicated registry function and its ACL", () => {
  assert.match(sql, /create or replace function public\.register_fit_house_offer_sync_control_plan/);
  assert.doesNotMatch(sql, /create or replace function public\.register_retailer_offer_sync_control_plan/);
  assert.match(sql, /owner to postgres/);
  assert.match(sql, /revoke all on function[\s\S]*from public,anon,authenticated,service_role/);
  assert.match(sql, /to retailer_catalogue_staging_validator/);
  assert.match(sql, /to retailer_catalogue_production_validator/);
  assert.doesNotMatch(sql, /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
  assert.doesNotMatch(sql, /MASS_OOS|maximum_total_oos|shipping_cost/);
});
