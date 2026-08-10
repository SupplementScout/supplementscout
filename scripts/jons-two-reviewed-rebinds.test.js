const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const migration = fs.readFileSync("supabase/migrations/20260810200000_rebind_two_reviewed_jons_variants.sql", "utf8");
const rollback = fs.readFileSync("supabase/rollbacks/20260810200000_rebind_two_reviewed_jons_variants.sql", "utf8");

test("two owner-reviewed Jon's rebinds preserve canonical identities and exact scope", () => {
  for (const token of [
    "id=1282", "id=1396", "id=1210", "50666562126162", "54182107578706",
    "Chocomel cups", "Chocolate Caramel", "CNP60004",
    "id=1311", "id=1425", "id=1239", "50602413883730", "54181091279186",
    "Salted Caramel", "CNP09006",
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /retailer_id=10\)<>506/);
  assert.doesNotMatch(migration, /(?:insert into|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(migration, /update\s+public\.(?:products|product_variants|price_history)/i);
});

test("two-rebind rollback refuses after ordinary offer refresh", () => {
  assert.match(rollback, /rollback is forbidden after corrected Jon''s offers have been refreshed/);
  assert.match(rollback, /last_checked_at>v_installed_at/);
});
