const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(
  "supabase/migrations/20260810220000_correct_jons_strom_buttered_pancake_variant.sql",
), "utf8");
const rollback = fs.readFileSync(path.resolve(
  "supabase/rollbacks/20260810220000_correct_jons_strom_buttered_pancake_variant.sql",
), "utf8");

test("Strom Buttered Pancake correction is exact and preserves commercial state", () => {
  for (const token of [
    "id=838", "id=1185", "id=1299", "id=1113",
    "10697591423314", "53111925768530", "STM55004",
    "buttered-pancake-2000g", "Buttered Pancake / 2000g",
    "owner-approved-chat-2026-08-10-23-jons-oos",
    "price=17.99", "shipping_cost=3.99", "total_price=21.98",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /requires production database owner/);
  assert.match(migration, /select count\(\*\) into v_history_count from public\.price_history where offer_id=1113/);
  assert.match(migration, /set variant_key='buttered-pancake-2000g'[\s\S]+is_default=false/);
  assert.match(migration, /set external_options='\{"Size":"2000g","Flavour":"Buttered Pancake"\}'::jsonb/);
  assert.doesNotMatch(migration, /update public\.offers/i);
  assert.doesNotMatch(migration, /(?:insert into|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});

test("Strom Buttered Pancake rollback is allowed only before reviewed OOS binding", () => {
  assert.match(rollback, /rollback is forbidden after the reviewed Jon''s 23-OOS authorization is bound/);
  assert.match(rollback, /set variant_key='default'/);
  assert.match(rollback, /set external_options='\{\}'::jsonb/);
  assert.doesNotMatch(rollback, /update public\.offers/i);
  assert.doesNotMatch(rollback, /(?:insert into|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
