const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260811030000_correct_reviewed_mass_gainer_metadata.sql");
const rollbackPath = path.join(process.cwd(), "supabase/rollbacks/20260811030000_correct_reviewed_mass_gainer_metadata.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");

test("reviewed Mass Gainer correction is production-bound and exact to products 128 and 132", () => {
  assert.match(migration, /current_user <> 'postgres'/);
  assert.match(migration, /target_environment' <> 'PRODUCTION'/);
  assert.match(migration, /project_ref' <> 'aftboxmrdgyhizicfsfu'/);
  assert.match(migration, /id=128 and name='7Nutrition Bodybuilder 1\.5kg'/);
  assert.match(migration, /id=132 and name='Applied Nutrition Critical Mass Lean Mass Gainz 2\.4kg'/);
  assert.match(migration, /product_id=128[\s\S]*size_value is distinct from 1500/);
  assert.match(migration, /product_id=132[\s\S]*size_value is distinct from 2400/);
  assert.match(migration, /retailer_id in \(3,11\)/);
});

test("forward migration changes only reviewed canonical category and format", () => {
  const updates = [...migration.matchAll(/update public\.([a-z_]+)[\s\S]*?;/gi)];
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1], "products");
  assert.match(updates[0][0], /set category='Mass Gainer', product_format='powder'/);
  assert.match(updates[0][0], /where id in \(128,132\)/);
  assert.doesNotMatch(migration, /(?:insert into|delete from|update public\.(?:product_variants|retailer_products|offers|price_history))/i);
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    assert.match(migration, new RegExp(`count\\(\\*\\) from public\\.${table}`));
  }
});

test("rollback is exact, migration-ledger-bound and restores only prior metadata", () => {
  assert.match(rollback, /version='20260811030000' and name='correct_reviewed_mass_gainer_metadata'/);
  assert.match(rollback, /set category='Health Supplements', product_format=null/);
  assert.match(rollback, /where id in \(128,132\)/);
  assert.doesNotMatch(rollback, /(?:insert into|delete from|update public\.(?:product_variants|retailer_products|offers|price_history))/i);
});

test("migration and rollback packages have stable SHA-256 shapes", () => {
  for (const content of [migration, rollback]) {
    assert.match(crypto.createHash("sha256").update(content).digest("hex"), /^[0-9a-f]{64}$/);
    assert.match(content, /^begin;[\s\S]*commit;\s*$/);
  }
});
