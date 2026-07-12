const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.resolve(
  "supabase/migrations/20260712_add_product_variants_stage1.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();

function resolveOfferMappings(retailerProducts, offers) {
  const candidates = new Map();
  for (const mapping of retailerProducts) {
    const key = `${mapping.retailer_id}:${mapping.product_id}`;
    const rows = candidates.get(key) || [];
    rows.push(mapping);
    candidates.set(key, rows);
  }
  return offers.map((offer) => {
    const rows = candidates.get(`${offer.retailer_id}:${offer.product_id}`) || [];
    return { ...offer, retailer_product_id: rows.length === 1 ? rows[0].id : null };
  });
}

function simulateDefaultVariantBackfill(products, existingVariants = []) {
  const variants = existingVariants.map((variant) => ({ ...variant }));
  for (const product of products) {
    if (product.is_active == null) throw new Error("products.is_active contains NULL");
    if (!variants.some((variant) =>
      variant.product_id === product.id && variant.variant_key === "default"
    )) {
      variants.push({
        product_id: product.id,
        variant_key: "default",
        display_name: "Default",
        is_active: product.is_active,
        is_default: true,
        flavour_code: null,
        flavour_label: null,
        gtin: null,
        nutrition_override: {},
      });
    }
  }
  for (const product of products) {
    const defaults = variants.filter((variant) =>
      variant.product_id === product.id && variant.is_default === true
    );
    if (defaults.length !== 1) throw new Error("default variant count mismatch");
    const baseline = variants.find((variant) =>
      variant.product_id === product.id && variant.variant_key === "default"
    );
    if (!baseline || baseline.display_name !== "Default"
      || baseline.is_default !== true || baseline.is_active !== product.is_active) {
      throw new Error("default variant baseline mismatch");
    }
  }
  return variants;
}

test("stage-one migration is transactional, additive, and keeps the legacy offer uniqueness", () => {
  assert.match(normalized, /^begin;/i);
  assert.match(normalized, /commit;$/i);
  assert.match(normalized, /create table if not exists public\.product_variants/i);
  assert.match(normalized, /alter table public\.retailer_products add column if not exists product_variant_id bigint/i);
  assert.match(normalized, /alter table public\.offers add column if not exists retailer_product_id bigint/i);
  assert.doesNotMatch(normalized, /drop\s+(table|column|constraint)/i);
  assert.doesNotMatch(normalized, /alter\s+column[^;]+set\s+not\s+null/i);
  assert.doesNotMatch(normalized, /drop\s+constraint\s+offers_product_retailer_unique/i);
});

test("product variant schema enforces identity, one default, and safe JSON defaults", () => {
  assert.match(normalized, /unique \(product_id, variant_key\)/i);
  assert.match(normalized, /unique index if not exists product_variants_one_default_per_product_idx on public\.product_variants \(product_id\) where is_default = true/i);
  assert.match(normalized, /nutrition_override jsonb not null default '\{\}'::jsonb/i);
  assert.match(normalized, /jsonb_typeof\(nutrition_override\) = 'object'/i);
  assert.match(normalized, /size_value::text <> 'NaN'/i);
  assert.match(normalized, /external_options is null or jsonb_typeof\(external_options\) = 'object'/i);
  assert.match(normalized, /flavour_code is null and flavour_label is null/i);
  assert.match(normalized, /foreign key \(product_variant_id\) references public\.product_variants\(id\) on delete set null/i);
  assert.doesNotMatch(normalized, /create index if not exists product_variants_product_id_idx/i);
});

test("backfill creates one neutral default per product without copying product GTIN", () => {
  const insert = normalized.match(
    /insert into public\.product_variants \((.*?)\) select (.*?) from public\.products p on conflict/si
  );
  assert.ok(insert, "default variant backfill must exist");
  assert.match(insert[1], /gtin/i);
  assert.doesNotMatch(insert[2], /p\.gtin/i);
  assert.match(insert[2], /'default'/i);
  assert.match(insert[2], /'Default'/i);
  assert.match(insert[2], /p\.is_active/i);
  assert.match(normalized, /having count\(pv\.id\) <> 1/i);
});

test("backfill changes only new linkage columns on existing business tables", () => {
  const updates = [...normalized.matchAll(/update public\.(products|retailer_products|offers|price_history)\s+\w*\s*set\s+([^;]+)/gi)];
  assert.deepEqual(
    updates.map((match) => [match[1], match[2].split("=")[0].trim()]),
    [
      ["retailer_products", "product_variant_id"],
      ["offers", "product_variant_id"],
      ["offers", "retailer_product_id"],
    ]
  );
  assert.doesNotMatch(normalized, /update public\.(products|price_history)/i);
  assert.doesNotMatch(normalized, /\b(delete|truncate)\s+(from\s+)?public\./i);
  assert.match(normalized, /create temp table product_variants_stage1_baseline on commit drop/i);
  assert.doesNotMatch(normalized, /\bmd5\s*\(/i);
  assert.match(normalized, /jsonb_agg\(to_jsonb\(p\) order by p\.id\)/i);
  assert.match(normalized, /is distinct from current_offers_snapshot/i);
  assert.match(normalized, /Stage-one migration changed pre-existing rows or fields/i);
  assert.match(
    normalized,
    /do \$\$ declare baseline record; current_retailer_products_snapshot jsonb; current_offers_snapshot jsonb; begin if exists \(select 1 from public\.retailer_products where product_variant_id is null\)/i
  );
});

test("default backfill is idempotent and preserves active and inactive state", () => {
  const products = [
    { id: 1, is_active: true },
    { id: 2, is_active: false },
  ];
  const first = simulateDefaultVariantBackfill(products);
  const second = simulateDefaultVariantBackfill(products, first);
  assert.equal(first.length, 2);
  assert.deepEqual(second, first);
  assert.equal(second.find((row) => row.product_id === 1).is_active, true);
  assert.equal(second.find((row) => row.product_id === 2).is_active, false);
  assert.equal(second.filter((row) => row.is_default).length, 2);
});

test("partial or conflicting prior default state fails instead of creating two defaults", () => {
  assert.throws(
    () => simulateDefaultVariantBackfill(
      [{ id: 1, is_active: true }],
      [{ product_id: 1, variant_key: "vanilla", display_name: "Vanilla", is_active: true, is_default: true }]
    ),
    /default variant count mismatch/
  );
  assert.throws(
    () => simulateDefaultVariantBackfill(
      [{ id: 1, is_active: true }],
      [{ product_id: 1, variant_key: "default", display_name: "Wrong", is_active: true, is_default: true }]
    ),
    /default variant baseline mismatch/
  );
});

test("offer mapping is assigned only for a unique retailer/product pair", () => {
  const retailerProducts = [
    { id: 10, retailer_id: 4, product_id: 407 },
    { id: 137, retailer_id: 1, product_id: 510 },
    { id: 549, retailer_id: 1, product_id: 510 },
  ];
  const resolved = resolveOfferMappings(retailerProducts, [
    { id: 762, retailer_id: 4, product_id: 407 },
    { id: 538, retailer_id: 1, product_id: 510 },
  ]);
  assert.equal(resolved[0].retailer_product_id, 10);
  assert.equal(resolved[1].retailer_product_id, null);
  assert.match(normalized, /group by retailer_id, product_id having count\(\*\) = 1/i);
});

test("new variant and external identity columns remain nullable in stage one", () => {
  for (const column of [
    "product_variant_id bigint",
    "external_product_id text",
    "external_variant_id text",
    "external_sku text",
    "external_options jsonb",
    "retailer_product_id bigint",
  ]) {
    assert.match(normalized, new RegExp(`add column if not exists ${column}`, "i"));
    assert.doesNotMatch(normalized, new RegExp(`${column} not null`, "i"));
  }
});
