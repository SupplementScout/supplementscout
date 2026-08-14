const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const name = "20260814213000_correct_critical_cookie_73g_identity.sql";
const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8");
const rollback = fs.readFileSync(path.join(process.cwd(), "supabase/rollbacks", name), "utf8");

test("Critical Cookie correction is owner-only, production-bound and stale-state guarded", () => {
  assert.match(migration, /current_user <> 'postgres'/);
  assert.match(migration, /target_environment' <> 'PRODUCTION'/);
  assert.match(migration, /project_ref' <> 'aftboxmrdgyhizicfsfu'/);
  assert.match(migration, /id=468 and name='Critical Cookie 12 x 85g'/);
  assert.match(migration, /slug='critical-cookie-12-x-85g'/);
  for (const id of [2696, 2697, 2698, 2710]) assert.match(migration, new RegExp(String(id)));
  assert.match(migration, /size_value=85 and size_unit='g' and pack_count=12/);
});

test("forward correction changes only one product and four existing variants", () => {
  const updates = [...migration.matchAll(/update public\.([a-z_]+)[\s\S]*?;/gi)];
  assert.equal(updates.length, 2);
  assert.deepEqual(updates.map((match) => match[1]), ["products", "product_variants"]);
  assert.match(updates[0][0], /name='Critical Cookie 12 x 73g'/);
  assert.match(updates[1][0], /size_value=73/);
  assert.match(updates[1][0], /id in \(2696,2697,2698,2710\)/);
  assert.doesNotMatch(migration, /(?:insert into|delete from|update public\.(?:retailer_products|offers|price_history))/i);
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    assert.match(migration, new RegExp(`count\\(\\*\\) from public\\.${table}`));
  }
});

test("rollback is ledger-bound and restores the exact 85g identity", () => {
  assert.match(rollback, /version='20260814213000' and name='correct_critical_cookie_73g_identity'/);
  assert.match(rollback, /name='Critical Cookie 12 x 85g'/);
  assert.match(rollback, /size_value=85/);
  assert.doesNotMatch(rollback, /(?:insert into|delete from|update public\.(?:retailer_products|offers|price_history))/i);
});

test("migration and rollback are single transactional packages", () => {
  for (const content of [migration, rollback]) {
    assert.match(crypto.createHash("sha256").update(content).digest("hex"), /^[0-9a-f]{64}$/);
    assert.match(content, /^begin;[\s\S]*commit;\s*$/);
    assert.equal((content.match(/\bbegin\s*;/gi) || []).length, 1);
    assert.equal((content.match(/\bcommit\s*;/gi) || []).length, 1);
  }
});
