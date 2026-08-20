const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260820140000_normalize_reviewed_brand_aliases.sql"), "utf8");
const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks/20260820140000_normalize_reviewed_brand_aliases.sql"), "utf8");

test("SEO-11 alias normalization is production-owner-bound and fail-closed", () => {
  assert.match(migration, /current_user <> 'postgres'/);
  assert.match(migration, /target_environment' <> 'PRODUCTION'/);
  assert.match(migration, /project_ref' <> 'aftboxmrdgyhizicfsfu'/);
  assert.match(migration, /Reviewed brand alias product set drifted/);
  assert.match(migration, /inactive or merged products/);
});

test("SEO-11 changes only four reviewed case aliases on products", () => {
  const updates = [...migration.matchAll(/update public\.([a-z_]+)[\s\S]*?;/gi)];
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1], "products");
  assert.match(updates[0][0], /when 'PER4M' then 'Per4m'/);
  assert.match(updates[0][0], /when 'Now Foods' then 'NOW Foods'/);
  assert.match(updates[0][0], /when 'Ostrovit' then 'OstroVit'/);
  assert.match(updates[0][0], /when 'ActivLab' then 'Activlab'/);
  assert.match(migration, /v_rows <> 40/);
  assert.doesNotMatch(migration, /(?:insert into|delete from|update public\.(?:product_variants|retailer_products|offers|price_history))/i);
});

test("SEO-11 preserves catalogue row counts and does not rewrite Unknown", () => {
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    assert.match(migration, new RegExp(`count\\(\\*\\) from public\\.${table}`));
  }
  assert.doesNotMatch(migration, /when 'Unknown'/);
  assert.doesNotMatch(migration, /set\s+(?:name|slug|category|merged_into_product_id)/i);
});

test("rollback restores only the exact 40 reviewed source aliases", () => {
  assert.match(rollback, /version='20260820140000' and name='normalize_reviewed_brand_aliases'/);
  assert.match(rollback, /then 'PER4M'/);
  assert.match(rollback, /then 'Now Foods'/);
  assert.match(rollback, /then 'Ostrovit'/);
  assert.match(rollback, /then 'ActivLab'/);
  assert.match(rollback, /v_rows <> 40/);
  assert.doesNotMatch(rollback, /(?:insert into|delete from|update public\.(?:product_variants|retailer_products|offers|price_history))/i);
});
