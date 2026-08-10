const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const test = require("node:test");

const migrationPath = "supabase/migrations/20260810260000_rebind_two_reviewed_fit_house_variants.sql";
const rollbackPath = "supabase/rollbacks/20260810260000_rebind_two_reviewed_fit_house_variants.sql";
const manifestPath = "config/retailers/fit-house-approved-offer-manifest.json";
const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const config = require("../config/retailers/fit-house-offer-sync.json");

test("two owner-reviewed Fit House rebinds are exact and production-bound", () => {
  for (const token of [
    "id=595", "id=797", "id=735", "8493540278512", "45060374167792", "50234901954800",
    "Capsules", "120", "id=917", "id=1102", "id=916", "9674420912368",
    "48124051816688", "50235877982448", "Peanut Butter Chocolate Chip",
    "aftboxmrdgyhizicfsfu", "supplementscout-production:aftboxmrdgyhizicfsfu",
  ]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, /current_user<>'postgres'/);
  assert.match(migration, /retailer_id=9\)<>286/);
  assert.match(migration, /existing active control plan/);
});

test("rebind preserves canonical and commercial data and changes no row counts", () => {
  assert.doesNotMatch(migration, /(?:insert into|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(migration, /update\s+public\.(?:products|product_variants|price_history)/i);
  assert.doesNotMatch(migration, /set\s+(?:price|shipping_cost|total_price|in_stock|last_checked_at)\s*=/i);
  assert.match(migration, /price=14\.99 and shipping_cost=3\.99 and total_price=18\.98 and in_stock/);
  assert.match(migration, /price=2\.50 and shipping_cost=3\.99 and total_price=6\.49 and in_stock/);
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"])
    assert.match(migration, new RegExp(`count\\(\\*\\) from public\\.${table}`));
});

test("approved 286 manifest is rebound exactly and hash-bound end to end", () => {
  assert.equal(manifest.rows.length, 286);
  assert.equal(new Set(manifest.rows.map((row) => row.external_variant_id)).size, 286);
  assert.ok(manifest.rows.some((row) => row.external_product_id === "8493540278512" && row.external_variant_id === "50234901954800"));
  assert.ok(manifest.rows.some((row) => row.external_product_id === "9674420912368" && row.external_variant_id === "50235877982448"));
  assert.ok(!manifest.rows.some((row) => ["45060374167792", "48124051816688"].includes(row.external_variant_id)));
  const sha = crypto.createHash("sha256").update(manifestBytes).digest("hex");
  assert.equal(sha, "a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292");
  assert.equal(config.manifest_sha256, sha);
  assert.equal(fs.readFileSync(`${manifestPath}.sha256`, "utf8").trim(), `${sha}  fit-house-approved-offer-manifest.json`);
  assert.match(migration, new RegExp(sha));
});

test("rollback restores exact old identities and refuses after refresh", () => {
  for (const token of ["45060374167792", "48124051816688", "50234901954800", "50235877982448"])
    assert.match(rollback, new RegExp(token));
  assert.match(rollback, /last_checked_at>v_installed_at/);
  assert.match(rollback, /updated_at>v_installed_at/);
  assert.match(rollback, /rollback is forbidden after corrected Fit House rows have been refreshed/);
  assert.match(rollback, /id=735 and retailer_id=9 and product_id=716 and product_variant_id=595[\s\S]*retailer_product_id=797[\s\S]*price=14\.99 and shipping_cost=3\.99 and total_price=18\.98 and in_stock[\s\S]*variant=50234901954800/);
  assert.match(rollback, /id=916 and retailer_id=9 and product_id=165 and product_variant_id=917[\s\S]*retailer_product_id=1102[\s\S]*price=2\.50 and shipping_cost=3\.99 and total_price=6\.49 and in_stock[\s\S]*variant=50235877982448/);
  assert.match(rollback, /\(id=797 and retailer_id=9[\s\S]*external_variant_id='50234901954800'[\s\S]*\)\s*or\s*\(id=1102 and retailer_id=9[\s\S]*external_variant_id='50235877982448'/);
  assert.doesNotMatch(rollback, /where id in \(797,1102\)[\s\S]*external_variant_id in/);
  assert.match(rollback, /external_variant_id='45060374167792'[\s\S]*external_options is null[\s\S]*variant=45060374167792/);
  assert.match(rollback, /external_variant_id='48124051816688'[\s\S]*\{"Flavor":"Peanut Butter Chocolate Chip"\}[\s\S]*variant=48124051816688/);
  assert.match(rollback, /Fit House rollback registration binding postcondition mismatch/);
  assert.match(rollback, /position\(v_old_manifest_sha in v_definition\)=0[\s\S]*position\(v_new_manifest_sha in v_definition\)>0/);
  assert.doesNotMatch(rollback, /set\s+(?:price|shipping_cost|total_price|in_stock|last_checked_at)\s*=/i);
});
