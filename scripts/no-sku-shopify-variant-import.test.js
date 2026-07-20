const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase/migrations/20260720113000_support_verified_shopify_variants_without_sku.sql");
const csvPath = path.join(root, "tmp/jons-no-sku-variant-review/jons-no-sku-safe-variant-candidates.csv");
const migration = fs.readFileSync(migrationPath, "utf8");
const csvRows = parse(fs.readFileSync(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

test("no-SKU Shopify variant migration is a narrow validator replacement", () => {
  assert.match(migration, /create or replace function public\.validate_product_import_plan_read_only\(p_plan jsonb\)/i);
  assert.match(migration, /create_variant without SKU requires strict Shopify product and variant identity/);
  assert.match(migration, /v_external_product_id !~ '\^\[0-9\]\{10,\}\$'/);
  assert.match(migration, /v_external_variant_id !~ '\^\[0-9\]\{10,\}\$'/);
  assert.match(migration, /external_variant_id=v_external_variant_id/);
  assert.match(migration, /equivalent canonical product_variant already exists/);
  assert.match(migration, /bundle\/free\/BBE\/dated/);
  assert.match(migration, /GTIN conflict/);
  assert.doesNotMatch(migration.toLowerCase(), /\b(?:insert|update|delete|merge|truncate)\s+(?:into\s+|from\s+)?public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/);
  assert.doesNotMatch(migration.toLowerCase(), /\bcreate\s+(?:role|user)\b/);
  assert.doesNotMatch(migration.toLowerCase(), /\bgrant\s+/);
});

test("authorised no-SKU CSV remains exact and uses strict Shopify evidence", () => {
  assert.equal(csvRows.length, 16);
  assert.equal(csvRows.filter((row) => String(row.external_sku || "").trim()).length, 0);
  assert.equal(new Set(csvRows.map((row) => row.external_variant_id)).size, 16);
  for (const row of csvRows) {
    assert.match(row.external_product_id, /^[0-9]{10,}$/);
    assert.match(row.external_variant_id, /^[0-9]{10,}$/);
    assert.notEqual(row.external_product_id, row.external_variant_id);
    assert.match(row.external_url, new RegExp(`[?&]variant=${row.external_variant_id}(?:&|$)`));
    const options = JSON.parse(row.external_options);
    assert.equal(typeof options.Flavour, "string");
    assert.equal(typeof options.Size, "string");
    assert.equal(row.product_format, "powder");
    assert.equal(row.in_stock, "true");
  }
});
