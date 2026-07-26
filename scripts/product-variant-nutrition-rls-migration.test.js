const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260726200000_allow_public_read_active_product_variants.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

test("variant nutrition read policy is transactional and rerunnable", () => {
  assert.match(normalized, /^begin;/);
  assert.match(normalized, /drop policy if exists/);
  assert.match(normalized, /create policy/);
  assert.match(normalized, /commit;$/);
});

test("anonymous access is select-only and limited to active variants", () => {
  assert.match(
    normalized,
    /create policy "public can read active product variants" on public\.product_variants for select to anon using \(is_active = true\)/
  );
  assert.match(
    normalized,
    /grant select on table public\.product_variants to anon/
  );
  assert.doesNotMatch(
    normalized,
    /grant (?:all|insert|update|delete|truncate|references|trigger)/
  );
});

test("migration contains no business data writes", () => {
  assert.doesNotMatch(normalized, /\b(?:insert|update|delete|truncate)\b/);
  assert.doesNotMatch(
    normalized,
    /\b(?:products|offers|retailer_products|price_history)\b/
  );
});
