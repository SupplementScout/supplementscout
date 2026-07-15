const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715235500_seed_batch_g_canonical_catalog.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_g_test";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, windowsHide: true });
}
function requireSuccess(result, label) {
  assert.equal(result.status, 0, `${label} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  return result;
}
function dockerAvailable() { return run("docker", ["info"], 20_000).status === 0; }
function exec(container, args, timeout = 120_000) { return run("docker", ["exec", container, ...args], timeout); }
function psql(container, args, timeout = 120_000) { return exec(container, ["psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout); }
function sql(container, statement) { return requireSuccess(psql(container, ["-At", "-c", statement]), "SQL statement").stdout.trim(); }
function applyMigration(container) { return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]); }
function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function inventory(label) {
  const text = fs.readFileSync(migration, "utf8");
  const match = text.match(new RegExp(`\\$batch_g_${label}\\$\\s*([\\s\\S]*?)\\s*\\$batch_g_${label}\\$::jsonb`));
  assert.ok(match, `migration must expose closed Batch G ${label} inventory`);
  return JSON.parse(match[1]);
}
function literal(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

const newProducts = inventory("new_products");
const existingProducts = inventory("existing_products");
const variants = inventory("variants");
const allTargetSlugs = [...newProducts, ...existingProducts].map((row) => row.slug);
const sourceVariants = variants.filter((row) => !row.is_default);

function productValues(row) {
  return `(default,${literal(row.name)},${literal(row.slug)},${literal(row.brand)},${literal(row.category)},null,${literal(row.image)},${literal(row.servings)},${literal(row.net_weight_g)},${literal(row.net_volume_ml)},${literal(row.unit_count)},${literal(row.unit_type)},${literal(row.product_format)},true)`;
}
function insertNewProducts(container, rows) {
  sql(container, `insert into products(id,name,slug,brand,category,price,image,servings,net_weight_g,net_volume_ml,unit_count,unit_type,product_format,is_active) values ${rows.map(productValues).join(",")}`);
}
function insertVariants(container, rows) {
  sql(container, `insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
    select p.id,x.variant_key,x.display_name,x.flavour_code,x.flavour_label,x.size_value::numeric,x.size_unit,x.pack_count::integer,x.product_format,null,null,'{}'::jsonb,x.is_default,x.is_active
    from (values ${rows.map((row) => `(${literal(row.product_slug)},${literal(row.variant_key)},${literal(row.display_name)},${literal(row.flavour_code)},${literal(row.flavour_label)},${literal(row.size_value)},${literal(row.size_unit)},${literal(row.pack_count)},${literal(row.product_format)},${row.is_default},${row.is_active})`).join(",")})
      x(product_slug,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active)
    join products p on p.slug=x.product_slug`);
}
function fixtureSql() {
  const existingRows = existingProducts.map((row) => `(${row.id},${literal(row.name)},${literal(row.slug)},${literal(row.brand)},${literal(row.category)},${literal(row.product_format)},true)`).join(",");
  return `
    insert into retailers(id,name,slug,website) values(9,'Fit House','fit-house','https://fithouse.uk'),(3,'Whey Okay','whey-okay','https://wheyokay.com');
    insert into products(id,name,slug,brand,category,product_format,is_active) values ${existingRows};
    insert into product_variants(id,product_id,variant_key,display_name,is_active,is_default) values ${existingProducts.map((row, index) => `(${9000 + index},${row.id},'default','Default',true,true)`).join(",")};
    insert into retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence)
      values(101,3,${existingProducts[0].id},9000,'Regression Product','https://regression.example','fixture',100);
    insert into offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url)
      values(201,${existingProducts[0].id},3,101,9000,10,2,12,true,'https://regression.example');
    insert into price_history(id,offer_id,price,shipping_cost,total_price) values(301,201,10,2,12);
    select setval('products_id_seq',10000,true); select setval('product_variants_id_seq',10000,true);
  `;
}
function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql()]), "create Batch G fixture");
}
function counts(container) {
  return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'mappings',(select count(*) from retailer_products),'offers',(select count(*) from offers),'history',(select count(*) from price_history))"));
}
function targetState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'new_products',(select count(*) from products where slug in(${newProducts.map((row) => literal(row.slug)).join(",")})),
    'inventory_variants',(select count(*) from product_variants v join products p on p.id=v.product_id join (values ${variants.map((row) => `(${literal(row.product_slug)},${literal(row.variant_key)})`).join(",")}) e(slug,variant_key) on e.slug=p.slug and e.variant_key=v.variant_key),
    'defaults',(select count(*) from product_variants v join products p on p.id=v.product_id where p.slug in(${allTargetSlugs.map(literal).join(",")}) and v.is_default and v.is_active),
    'images',(select count(*) from products p join (values ${newProducts.map((row) => `(${literal(row.slug)},${literal(row.image)})`).join(",")}) e(slug,image) on e.slug=p.slug and e.image=p.image))`));
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}
function expectSqlBlocked(container, statement, label, pattern) {
  const result = psql(container, ["-c", statement]);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(result.stderr, pattern);
}

test("Batch G migration has a closed 18-product and 67-variant canonical-only contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(newProducts.length, 18);
  assert.equal(existingProducts.length, 6);
  assert.equal(variants.length, 67);
  assert.equal(variants.filter((row) => row.is_default).length, 18);
  assert.equal(sourceVariants.length, 49);
  assert.equal(new Set(newProducts.map((row) => row.slug)).size, 18);
  assert.equal(new Set(variants.map((row) => `${row.product_slug}:${row.variant_key}`)).size, 67);
  assert.equal(new Set(sourceVariants.map((row) => `${row.product_slug}:${row.flavour_code}:${row.size_value}:${row.size_unit}:${row.product_format}`)).size, 49);
  assert.ok(newProducts.every((row) => row.image && row.image.startsWith("https://cdn.shopify.com/")));
  assert.ok(variants.every((row) => row.is_active));
  assert.ok(sourceVariants.every((row) => row.pack_count === 1));
  assert.match(text, /insert into public\.products/i);
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
});

test("real Batch G migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-g-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-g-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    requireSuccess(applyMigration(container), "Batch G clean state");
    const after = counts(container);
    assert.deepEqual(after, { products: before.products + 18, variants: before.variants + 67, mappings: before.mappings, offers: before.offers, history: before.history });
    assert.deepEqual(targetState(container), { new_products: 18, inventory_variants: 67, defaults: 24, images: 18 });

    requireSuccess(applyMigration(container), "Batch G identical rerun");
    assert.deepEqual(counts(container), after);
    assert.deepEqual(targetState(container), { new_products: 18, inventory_variants: 67, defaults: 24, images: 18 });

    recreateDatabase(container);
    insertNewProducts(container, newProducts.slice(0, 1));
    insertVariants(container, variants.filter((row) => row.product_slug === newProducts[0].slug).slice(0, 2));
    requireSuccess(applyMigration(container), "Batch G partial identical state");
    assert.deepEqual(targetState(container), { new_products: 18, inventory_variants: 67, defaults: 24, images: 18 });

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,product_format,is_active) values('Drifted',${literal(newProducts[0].slug)},${literal(newProducts[0].brand)},${literal(newProducts[0].category)},${literal(newProducts[0].product_format)},true)`);
    const slugDrift = counts(container); expectBlocked(container, "product slug drift"); assert.deepEqual(counts(container), slugDrift);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,product_format,is_active) values(${literal(newProducts[0].name)},'semantic-duplicate',${literal(newProducts[0].brand)},${literal(newProducts[0].category)},${literal(newProducts[0].product_format)},true)`);
    const productCollision = counts(container); expectBlocked(container, "product semantic collision"); assert.deepEqual(counts(container), productCollision);

    recreateDatabase(container);
    const existingVariant = variants.find((row) => !row.is_default && existingProducts.some((p) => p.slug === row.product_slug));
    insertVariants(container, [{ ...existingVariant, display_name: "Drifted" }]);
    const keyDrift = counts(container); expectBlocked(container, "variant key drift"); assert.deepEqual(counts(container), keyDrift);

    recreateDatabase(container);
    insertVariants(container, [{ ...existingVariant, variant_key: "legacy-semantic-key" }]);
    const semanticVariant = counts(container); expectBlocked(container, "variant semantic collision"); assert.deepEqual(counts(container), semanticVariant);

    recreateDatabase(container);
    sql(container, `delete from product_variants where product_id=${existingProducts[0].id}`);
    const missingDefault = counts(container); expectBlocked(container, "missing existing default relation"); assert.deepEqual(counts(container), missingDefault);

    recreateDatabase(container);
    sql(container, `update products set is_active=false, merged_into_product_id=${existingProducts[1].id}, merged_at=now() where id=${existingProducts[0].id}`);
    const inactiveParent = counts(container); expectBlocked(container, "inactive existing parent product"); assert.deepEqual(counts(container), inactiveParent);

    recreateDatabase(container);
    expectSqlBlocked(
      container,
      `insert into product_variants(product_id,variant_key,display_name,is_active,is_default) values(${existingProducts[0].id},'second-default','Second Default',true,true)`,
      "duplicate active default schema constraint",
      /product_variants_one_default_per_product_idx/,
    );
    assert.equal(sql(container, `select count(*) from product_variants where product_id=${existingProducts[0].id} and is_default`), "1");

    recreateDatabase(container);
    sql(container, `insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(${existingProducts[0].id},'harmless-extra-999g','Harmless Extra / 999g','harmless extra','Harmless Extra',999,'g',1,'powder',true,false)`);
    const extraNonDefault = counts(container);
    requireSuccess(applyMigration(container), "Batch G harmless extra non-default state");
    assert.deepEqual(counts(container), { products: extraNonDefault.products + 18, variants: extraNonDefault.variants + 67, mappings: extraNonDefault.mappings, offers: extraNonDefault.offers, history: extraNonDefault.history });
    assert.equal(sql(container, `select count(*) from product_variants where product_id=${existingProducts[0].id} and variant_key='harmless-extra-999g'`), "1");

    recreateDatabase(container);
    insertNewProducts(container, [{ ...newProducts[0], image: "https://wrong.example/image.jpg" }]);
    const imageMismatch = counts(container); expectBlocked(container, "new product image inventory mismatch"); assert.deepEqual(counts(container), imageMismatch);

    recreateDatabase(container);
    const lastKey = variants.at(-1).variant_key;
    sql(container, `create function reject_batch_g_variant() returns trigger language plpgsql as $$ begin if new.variant_key=${literal(lastKey)} then raise exception 'controlled Batch G failure'; end if; return new; end $$; create trigger reject_batch_g_variant before insert on product_variants for each row execute function reject_batch_g_variant()`);
    const late = counts(container);
    expectBlocked(container, "late controlled failure");
    assert.deepEqual(counts(container), late);
    assert.equal(sql(container, `select count(*) from products where slug in(${newProducts.map((row) => literal(row.slug)).join(",")})`), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
