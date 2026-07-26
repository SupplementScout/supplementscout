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
  const expectedNutritionPending = [
    {
      filename: "20260726200000_allow_public_read_active_product_variants.sql",
      sha256: "04c5a3bc7746c497040e3f2b5e496332d76a5c4d340acc63d7d7d8e08d92653d",
    },
    {
      filename: "20260726210000_add_reviewed_variant_nutrition_apply.sql",
      sha256: "ad165f24cc4f72f879645320116ffbade5dc51ab5a09f1a2cf2a5a2f9d0cd0ec",
    },
  ];
  assert.deepEqual(selector.CONTRACTS.STAGING.pending, expectedNutritionPending);
  assert.equal(selector.CONTRACTS.STAGING.ledgerCount, 63);
  assert.deepEqual(selector.CONTRACTS.PRODUCTION.pending, expectedNutritionPending);
  assert.equal(selector.CONTRACTS.PRODUCTION.ledgerCount, 59);
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
