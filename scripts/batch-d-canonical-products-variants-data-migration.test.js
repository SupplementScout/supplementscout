const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715180000_seed_discount_supplements_batch_d_canonical_products_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_d_test";

const products = [
  { name: "Applied Nutrition Critical Whey 2kg", slug: "applied-nutrition-critical-whey-2kg", brand: "Applied Nutrition", category: "Whey Protein", net_weight_g: 2000, servings: null, product_format: "powder", is_active: true, identity_key: "appliednutritioncriticalwhey2kg" },
  { name: "Applied Nutrition Creatine Monohydrate 250g", slug: "applied-nutrition-creatine-monohydrate-250g", brand: "Applied Nutrition", category: "Creatine", net_weight_g: 250, servings: 50, product_format: "powder", is_active: true, identity_key: "appliednutritioncreatinemonohydrate250g" },
  { name: "Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg", slug: "efectiv-nutrition-grass-fed-whey-protein-isolate-2kg", brand: "Efectiv Nutrition", category: "Whey Protein", net_weight_g: 2000, servings: 66, product_format: "powder", is_active: true, identity_key: "efectivnutritiongrassfedwheyproteinisolate2kg" },
  { name: "Applied Nutrition Pump 3G Zero Stim 375g", slug: "applied-nutrition-pump-3g-zero-stim-375g", brand: "Applied Nutrition", category: "Pre Workout", net_weight_g: 375, servings: 25, product_format: "powder", is_active: true, identity_key: "appliednutritionpump3gzerostim375g" },
  { name: "CNP Loaded EAA 300g", slug: "cnp-loaded-eaa-300g", brand: "CNP", category: "Amino Acids", net_weight_g: 300, servings: null, product_format: "powder", is_active: true, identity_key: "cnploadedeaa300g" },
  { name: "XL Nutrition XTRA Whey 2kg", slug: "xl-nutrition-xtra-whey-2kg", brand: "XL Nutrition", category: "Whey Protein", net_weight_g: 2000, servings: 66, product_format: "powder", is_active: true, identity_key: "xlnutritionxtrawhey2kg" },
];

const flavourSpecs = {
  "applied-nutrition-critical-whey-2kg": { size: 2000, displaySize: "2kg", flavours: [["banana", "Banana"], ["banana strawberry", "Banana Strawberry"], ["caramel latte", "Caramel Latte"], ["choco hazelnut", "Choco Hazelnut"], ["chocolate", "Chocolate"], ["cookies and cream", "Cookies & Cream"], ["frappuccino", "Frappuccino"], ["salted caramel", "Salted Caramel"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"], ["vanilla matcha", "Vanilla Matcha"], ["white choco hazelnut", "White Choco Hazelnut"], ["white chocolate pistachio", "White Chocolate Pistachio"]] },
  "applied-nutrition-creatine-monohydrate-250g": { size: 250, displaySize: "250g", flavours: [["cherry and apple", "Cherry & Apple"], ["icy blue razz", "Icy Blue Razz"], ["strawberry and raspberry", "Strawberry & Raspberry"], ["unflavoured", "Unflavoured"]] },
  "efectiv-nutrition-grass-fed-whey-protein-isolate-2kg": { size: 2000, displaySize: "2kg", flavours: [["chocolate", "Chocolate"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
  "applied-nutrition-pump-3g-zero-stim-375g": { size: 375, displaySize: "375g", flavours: [["fruit burst", "Fruit Burst"], ["icy blue razz", "Icy Blue Razz"]] },
  "cnp-loaded-eaa-300g": { size: 300, displaySize: "300g", flavours: [["cherry cola bottles", "Cherry Cola Bottles"], ["lemon", "Lemon"], ["pink lemonade", "Pink Lemonade"], ["pink pigs", "Pink Pigs"], ["tropical pineapple", "Tropical Pineapple"], ["twisted fruit", "Twisted Fruit"]] },
  "xl-nutrition-xtra-whey-2kg": { size: 2000, displaySize: "2kg", flavours: [["banana", "Banana"], ["birthday cake", "Birthday Cake"], ["chocolate", "Chocolate"], ["chocolate bueno", "Chocolate Bueno"], ["chocolate mint", "Chocolate Mint"], ["coconut cream", "Coconut Cream"], ["cookies and cream", "Cookies & Cream"], ["peanut butter", "Peanut Butter"], ["strawberry", "Strawberry"], ["toffee popcorn", "Toffee Popcorn"], ["vanilla", "Vanilla"], ["white chocolate raspberry", "White Chocolate Raspberry"]] },
};

const variants = products.flatMap((product) => {
  const spec = flavourSpecs[product.slug];
  return [
    { product_slug: product.slug, variant_key: "default", display_name: "Default", flavour_code: null, flavour_label: null, size_value: null, size_unit: null, pack_count: null, product_format: null, is_default: true, is_active: true },
    ...spec.flavours.map(([code, label]) => ({ product_slug: product.slug, variant_key: `${code.replaceAll(" ", "-")}-${spec.size}g`, display_name: `${label} / ${spec.displaySize}`, flavour_code: code, flavour_label: label, size_value: spec.size, size_unit: "g", pack_count: 1, product_format: "powder", is_default: false, is_active: true })),
  ];
}).sort((a, b) => a.product_slug.localeCompare(b.product_slug) || a.variant_key.localeCompare(b.variant_key));

assert.equal(process.argv.length, 2, "this test runner accepts no connection arguments");

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, env: process.env });
}
function combined(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`);
  assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`);
}
function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}
function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=batch-d-local-only", container, ...args], timeout);
}
function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}
function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local Batch D fixture SQL");
  return result.stdout.trim();
}
function applyMigration(container) {
  return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]);
}
function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function inventory(label) {
  const text = fs.readFileSync(migration, "utf8");
  const match = text.match(new RegExp(`\\$batch_d_${label}\\$\\s*([\\s\\S]*?)\\s*\\$batch_d_${label}\\$::jsonb`));
  assert.ok(match, `migration must expose closed Batch D ${label} inventory`);
  return JSON.parse(match[1]);
}
function sqlLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

const migrationProducts = inventory("products");
const migrationVariants = inventory("variants");

const fixtureSql = `
  insert into public.retailers(id,name,slug,website) values(3,'Regression Retailer','regression-retailer','https://regression.example');
  insert into public.products(id,name,slug,brand,category,product_format,is_active) values
    (7,'Batch A Regression','batch-a-regression','Brand A','Whey Protein','powder',true),
    (222,'Batch B Regression','batch-b-regression','Brand B','Mass Gainer','powder',true),
    (296,'Batch C Regression','batch-c-regression','Brand C','Whey Protein','powder',true);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values
    (7,7,'default','Default',true,true),(187,222,'default','Default',true,true),(292,296,'default','Default',true,true),
    (701,7,'batch-a-variant','Batch A Variant',true,false),(702,222,'batch-b-variant','Batch B Variant',true,false),(703,296,'batch-c-variant','Batch C Variant',true,false);
  insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence)
  values(101,3,7,7,'Regression Product','https://regression.example/p7','fixture',100);
  insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url)
  values(201,7,3,101,7,10,2,12,true,'https://regression.example/p7');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price) values(301,201,10,2,12);
  select setval('public.products_id_seq',1000,true);
  select setval('public.product_variants_id_seq',1000,true);
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create Batch A/B/C regression fixture");
}
function counts(container) {
  return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'mappings',(select count(*) from retailer_products),'offers',(select count(*) from offers),'history',(select count(*) from price_history))"));
}
function regressionState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p) order by id) from products p where id in(7,222,296)),
    'variants',(select jsonb_agg(to_jsonb(v) order by id) from product_variants v where product_id in(7,222,296)),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph))`));
}
function targetState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(jsonb_build_object('name',p.name,'slug',p.slug,'brand',p.brand,'category',p.category,'net_weight_g',p.net_weight_g,'servings',p.servings,'product_format',p.product_format,'is_active',p.is_active,'price',p.price) order by p.slug) from products p where p.slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})),
    'variants',(select jsonb_agg(jsonb_build_object('product_slug',p.slug,'variant_key',v.variant_key,'display_name',v.display_name,'flavour_code',v.flavour_code,'flavour_label',v.flavour_label,'size_value',v.size_value,'size_unit',v.size_unit,'pack_count',v.pack_count,'product_format',v.product_format,'is_default',v.is_default,'is_active',v.is_active) order by p.slug,v.variant_key) from product_variants v join products p on p.id=v.product_id where p.slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})))`));
}
function insertProducts(container, rows) {
  sql(container, `insert into products(name,slug,brand,category,price,servings,net_weight_g,product_format,is_active) values ${rows.map((p) => `(${sqlLiteral(p.name)},${sqlLiteral(p.slug)},${sqlLiteral(p.brand)},${sqlLiteral(p.category)},null,${sqlLiteral(p.servings)},${p.net_weight_g},${sqlLiteral(p.product_format)},true)`).join(",")}`);
}
function insertVariants(container, rows) {
  sql(container, `insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active) select p.id,v.variant_key,v.display_name,v.flavour_code,v.flavour_label,v.size_value::numeric,v.size_unit,v.pack_count::integer,v.product_format,null,null,'{}'::jsonb,v.is_default,v.is_active from (values ${rows.map((v) => `(${sqlLiteral(v.product_slug)},${sqlLiteral(v.variant_key)},${sqlLiteral(v.display_name)},${sqlLiteral(v.flavour_code)},${sqlLiteral(v.flavour_label)},${sqlLiteral(v.size_value)},${sqlLiteral(v.size_unit)},${sqlLiteral(v.pack_count)},${sqlLiteral(v.product_format)},${v.is_default},${v.is_active})`).join(",")}) v(product_slug,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active) join products p on p.slug=v.product_slug`);
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch D migration has a closed 6-product, 46-variant contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.deepEqual(migrationProducts, products);
  assert.deepEqual([...migrationVariants].sort((a, b) => a.product_slug.localeCompare(b.product_slug) || a.variant_key.localeCompare(b.variant_key)), variants);
  assert.equal(migrationProducts.length, 6);
  assert.equal(migrationVariants.length, 46);
  assert.equal(migrationVariants.filter((row) => row.is_default).length, 6);
  assert.equal(migrationVariants.filter((row) => !row.is_default).length, 40);
  assert.equal(new Set(migrationProducts.map((row) => row.slug)).size, 6);
  assert.equal(new Set(migrationVariants.map((row) => `${row.product_slug}:${row.variant_key}`)).size, 46);
  assert.match(text, /insert into public\.products/i);
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
});

test("real Batch D migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-d-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-d-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    const regressions = regressionState(container);
    requireSuccess(applyMigration(container), "Batch D clean state");
    const after = counts(container);
    assert.deepEqual(after, { products: before.products + 6, variants: before.variants + 46, mappings: before.mappings, offers: before.offers, history: before.history });
    const expectedProducts = products.map((p) => ({
      name: p.name, slug: p.slug, brand: p.brand, category: p.category,
      net_weight_g: p.net_weight_g, servings: p.servings,
      product_format: p.product_format, is_active: p.is_active, price: null,
    })).sort((a, b) => a.slug.localeCompare(b.slug));
    assert.deepEqual(targetState(container), { products: expectedProducts, variants });
    assert.deepEqual(regressionState(container), regressions, "Batch A/B/C regression rows changed");
    const stable = targetState(container);
    requireSuccess(applyMigration(container), "Batch D identical rerun");
    assert.deepEqual(targetState(container), stable);
    assert.deepEqual(counts(container), after);

    recreateDatabase(container);
    insertProducts(container, products.slice(0, 2));
    insertVariants(container, variants.filter((row) => row.product_slug === products[0].slug).slice(0, 5));
    requireSuccess(applyMigration(container), "Batch D partial identical state");
    assert.deepEqual(targetState(container), { products: expectedProducts, variants });

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,price,net_weight_g,product_format,is_active) values('Drifted',${sqlLiteral(products[0].slug)},${sqlLiteral(products[0].brand)},${sqlLiteral(products[0].category)},null,2000,'powder',true)`);
    const driftedProduct = counts(container); expectBlocked(container, "drifted product slug"); assert.deepEqual(counts(container), driftedProduct);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    insertVariants(container, [{ ...variants.find((row) => row.product_slug === products[0].slug && row.variant_key !== "default"), display_name: "Drifted" }]);
    const driftedVariant = counts(container); expectBlocked(container, "drifted variant key"); assert.deepEqual(counts(container), driftedVariant);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,price,net_weight_g,product_format,is_active) values(${sqlLiteral(products[0].name)},'semantic-duplicate',${sqlLiteral(products[0].brand)},${sqlLiteral(products[0].category)},null,2000,'powder',true)`);
    const duplicateProduct = counts(container); expectBlocked(container, "semantic duplicate product"); assert.deepEqual(counts(container), duplicateProduct);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    const semantic = variants.find((row) => row.product_slug === products[0].slug && row.variant_key !== "default");
    insertVariants(container, [{ ...semantic, variant_key: "legacy-semantic-key" }]);
    const duplicateVariant = counts(container); expectBlocked(container, "semantic duplicate variant"); assert.deepEqual(counts(container), duplicateVariant);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    insertVariants(container, [{ ...variants.find((row) => row.product_slug === products[0].slug && row.is_default), variant_key: "legacy-default" }]);
    const missingRelation = counts(container); expectBlocked(container, "missing required default relation"); assert.deepEqual(counts(container), missingRelation);

    recreateDatabase(container);
    sql(container, "create function reject_batch_d_variant() returns trigger language plpgsql as $$ begin if new.variant_key='white-chocolate-raspberry-2000g' then raise exception 'controlled Batch D failure'; end if; return new; end $$; create trigger reject_batch_d_variant before insert on product_variants for each row execute function reject_batch_d_variant()");
    const late = counts(container); const lateRegressions = regressionState(container);
    expectBlocked(container, "late controlled failure");
    assert.deepEqual(counts(container), late); assert.deepEqual(regressionState(container), lateRegressions);
    assert.equal(sql(container, `select count(*) from products where slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})`), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
