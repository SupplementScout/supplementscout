const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(
  "supabase/migrations/20260810230000_complete_jons_strom_buttered_pancake_variant_move.sql",
), "utf8");
const rollback = fs.readFileSync(path.resolve(
  "supabase/rollbacks/20260810230000_complete_jons_strom_buttered_pancake_variant_move.sql",
), "utf8");

test("forward correction creates one explicit variant and moves only mapping and offer identity", () => {
  for (const token of [
    "id=838", "id=1185", "id=1299", "id=1113",
    "jons-23-563ef072fa3fd68c-production", "status='CONSUMED'",
    "10697591423314", "53111925768530", "STM55004",
    "buttered-pancake-2000g", "Buttered Pancake / 2000g",
    "returning id into v_new_variant_id",
    "set product_variant_id=v_new_variant_id,updated_at=now()",
    "update public.offers set product_variant_id=v_new_variant_id",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /not o\.in_stock/);
  assert.match(migration, /v_variants_before\+1/);
  assert.match(migration, /jsonb_agg\(to_jsonb\(ph\) order by ph\.id\)/);
  assert.match(migration, /to_jsonb\(o\)-'product_variant_id'/);
  assert.doesNotMatch(migration,
    /update public\.offers set[^;]*(?:price|shipping_cost|total_price|in_stock|url|last_checked_at)\s*=/i);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from) public\.price_history/i);
});

test("forward rollback keeps OOS and restores only the pre-forward identity state", () => {
  assert.match(rollback, /not in_stock/);
  assert.match(rollback, /last_checked_at='2026-08-10T16:09:58\.914\+00:00'/);
  assert.match(rollback, /set product_variant_id=1185/);
  assert.match(rollback, /delete from public\.product_variants where id=v_new_variant\.id/);
  assert.match(rollback, /set variant_key='buttered-pancake-2000g'/);
  assert.doesNotMatch(rollback,
    /update public\.offers set[^;]*(?:price|shipping_cost|total_price|in_stock|url|last_checked_at)\s*=/i);
  assert.doesNotMatch(rollback, /(?:insert into|update|delete from) public\.price_history/i);
});
