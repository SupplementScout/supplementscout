const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715230000_seed_fit_house_batch_f_catalog_and_backfill_images.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_f_test";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, windowsHide: true });
}
function requireSuccess(result, label) {
  assert.equal(result.status, 0, `${label} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  return result;
}
function dockerAvailable() {
  return run("docker", ["info"], 20_000).status === 0;
}
function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", container, ...args], timeout);
}
function psql(container, args, timeout = 120_000) {
  return exec(container, ["psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}
function sql(container, statement) {
  const result = requireSuccess(psql(container, ["-At", "-c", statement]), "SQL statement");
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
  const match = text.match(new RegExp(`\\$batch_f_${label}\\$\\s*([\\s\\S]*?)\\s*\\$batch_f_${label}\\$::jsonb`));
  assert.ok(match, `migration must expose closed Batch F ${label} inventory`);
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
const images = inventory("images");
const allTargetSlugs = [...newProducts, ...existingProducts].map((row) => row.slug);

function productValues(row, id = null, imageValue = row.image ?? null) {
  return `(${id === null ? "default" : id},${literal(row.name)},${literal(row.slug)},${literal(row.brand)},${literal(row.category)},null,${literal(imageValue)},${literal(row.servings)},${literal(row.net_weight_g)},${literal(row.net_volume_ml)},${literal(row.product_format)},true)`;
}
function insertNewProducts(container, rows) {
  sql(container, `insert into products(id,name,slug,brand,category,price,image,servings,net_weight_g,net_volume_ml,product_format,is_active) values ${rows.map((row) => productValues(row)).join(",")}`);
}
function insertVariants(container, rows) {
  sql(container, `insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
    select p.id,x.variant_key,x.display_name,x.flavour_code,x.flavour_label,x.size_value::numeric,x.size_unit,x.pack_count::integer,x.product_format,null,null,'{}'::jsonb,x.is_default,x.is_active
    from (values ${rows.map((row) => `(${literal(row.product_slug)},${literal(row.variant_key)},${literal(row.display_name)},${literal(row.flavour_code)},${literal(row.flavour_label)},${literal(row.size_value)},${literal(row.size_unit)},${literal(row.pack_count)},${literal(row.product_format)},${row.is_default},${row.is_active})`).join(",")})
      x(product_slug,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active)
    join products p on p.slug=x.product_slug`);
}

function fixtureSql() {
  const existingRows = existingProducts.map((row) => `(${row.id},${literal(row.name)},${literal(row.slug)},${literal(row.brand)},${literal(row.category)},true)`).join(",");
  const imageRows = images.map((row) => `(${row.product_id},${literal(row.name)},${literal(row.slug)},${literal(row.brand)},'Regression',true,null)`).join(",");
  const regressionRows = [
    [7,"Batch A Regression","batch-a-regression","Brand A"],
    [222,"Batch B Regression","batch-b-regression","Brand B"],
    [296,"Batch C Regression","batch-c-regression","Brand C"],
  ].map(([id,name,slug,brand]) => `(${id},${literal(name)},${literal(slug)},${literal(brand)},'Regression',true,null)`).join(",");
  const defaultRows = [...existingProducts.map((row) => row.id), ...images.map((row) => row.product_id), 7, 222, 296]
    .map((id, index) => `(${9000 + index},${id},'default','Default',true,true)`).join(",");
  return `
    insert into retailers(id,name,slug,website) values(3,'Regression Retailer','regression-retailer','https://regression.example');
    insert into products(id,name,slug,brand,category,is_active) values ${existingRows};
    insert into products(id,name,slug,brand,category,is_active,image) values ${imageRows},${regressionRows};
    insert into product_variants(id,product_id,variant_key,display_name,is_active,is_default) values ${defaultRows};
    insert into retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence)
      values(101,3,7,${9000 + existingProducts.length + images.length},'Regression Product','https://regression.example/p7','fixture',100);
    insert into offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url)
      values(201,7,3,101,${9000 + existingProducts.length + images.length},10,2,12,true,'https://regression.example/p7');
    insert into price_history(id,offer_id,price,shipping_cost,total_price) values(301,201,10,2,12);
    select setval('products_id_seq',10000,true); select setval('product_variants_id_seq',10000,true);
  `;
}
function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql()]), "create A-E and Batch F fixtures");
}
function counts(container) {
  return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'mappings',(select count(*) from retailer_products),'offers',(select count(*) from offers),'history',(select count(*) from price_history))"));
}
function immutableState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p)-'image' order by id) from products p where id in(7,222,296,${existingProducts.map((row) => row.id).join(",")},${images.map((row) => row.product_id).join(",")})),
    'variants',(select jsonb_agg(to_jsonb(v) order by id) from product_variants v where product_id in(7,222,296,${images.map((row) => row.product_id).join(",")})),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph))`));
}
function targetState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'new_products',(select count(*) from products where slug in(${newProducts.map((row) => literal(row.slug)).join(",")})),
    'inventory_variants',(select count(*) from product_variants v join products p on p.id=v.product_id join (values ${variants.map((row) => `(${literal(row.product_slug)},${literal(row.variant_key)})`).join(",")}) e(slug,variant_key) on e.slug=p.slug and e.variant_key=v.variant_key),
    'defaults',(select count(*) from product_variants v join products p on p.id=v.product_id where p.slug in(${allTargetSlugs.map(literal).join(",")}) and v.is_default and v.is_active),
    'images',(select count(*) from products p join (values ${images.map((row) => `(${row.product_id},${literal(row.image)})`).join(",")}) e(id,image) on e.id=p.id and e.image=p.image))`));
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch F migration has a closed 12-product, 47-variant, 12-image contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(newProducts.length, 12);
  assert.equal(existingProducts.length, 4);
  assert.equal(variants.length, 47);
  assert.equal(variants.filter((row) => row.is_default).length, 12);
  assert.equal(variants.filter((row) => !row.is_default).length, 35);
  assert.equal(images.length, 12);
  assert.equal(new Set(newProducts.map((row) => row.slug)).size, 12);
  assert.equal(new Set(variants.map((row) => `${row.product_slug}:${row.variant_key}`)).size, 47);
  assert.equal(new Set(variants.filter((row) => !row.is_default).map((row) => `${row.product_slug}:${row.flavour_code}:${row.size_value}:${row.size_unit}`)).size, 35);
  assert.equal(new Set(images.map((row) => row.product_id)).size, 12);
  assert.ok(variants.every((row) => row.is_active));
  assert.ok(variants.filter((row) => !row.is_default).every((row) => row.pack_count === 1));
  assert.match(text, /insert into public\.products/i);
  assert.match(text, /insert into public\.product_variants/i);
  assert.match(text, /update public\.products p set image=e\.image/i);
  assert.doesNotMatch(text, /insert into public\.(retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
});

test("real Batch F migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-f-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-f-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    const immutable = immutableState(container);
    requireSuccess(applyMigration(container), "Batch F clean state");
    const after = counts(container);
    assert.deepEqual(after, { products: before.products + 12, variants: before.variants + 47, mappings: before.mappings, offers: before.offers, history: before.history });
    assert.deepEqual(targetState(container), { new_products: 12, inventory_variants: 47, defaults: 16, images: 12 });
    assert.deepEqual(immutableState(container), immutable, "Batch A-E or importer-owned rows changed");
    const stable = targetState(container);
    requireSuccess(applyMigration(container), "Batch F identical rerun");
    assert.deepEqual(targetState(container), stable);
    assert.deepEqual(counts(container), after);

    recreateDatabase(container);
    insertNewProducts(container, newProducts.slice(0, 1));
    insertVariants(container, variants.filter((row) => row.product_slug === newProducts[0].slug).slice(0, 1));
    sql(container, `update products set image=${literal(images[0].image)} where id=${images[0].product_id}`);
    requireSuccess(applyMigration(container), "Batch F partial identical state and image already present");
    assert.deepEqual(targetState(container), { new_products: 12, inventory_variants: 47, defaults: 16, images: 12 });

    recreateDatabase(container);
    sql(container, `update products set name='Wrong identity' where id=${images[0].product_id}`);
    const wrongIdentity = counts(container); expectBlocked(container, "wrong image product identity"); assert.deepEqual(counts(container), wrongIdentity);

    recreateDatabase(container);
    sql(container, `update products set image='https://wrong.example/image.jpg' where id=${images[0].product_id}`);
    const imageDrift = counts(container); expectBlocked(container, "image URL drift"); assert.deepEqual(counts(container), imageDrift);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,product_format,is_active) values('Drifted',${literal(newProducts[0].slug)},${literal(newProducts[0].brand)},${literal(newProducts[0].category)},${literal(newProducts[0].product_format)},true)`);
    const slugCollision = counts(container); expectBlocked(container, "slug collision"); assert.deepEqual(counts(container), slugCollision);

    recreateDatabase(container);
    const existingVariant = variants.find((row) => row.product_slug === existingProducts[0].slug);
    insertVariants(container, [{ ...existingVariant, display_name: "Drifted" }]);
    const keyCollision = counts(container); expectBlocked(container, "variant key collision"); assert.deepEqual(counts(container), keyCollision);

    recreateDatabase(container);
    insertVariants(container, [{ ...existingVariant, variant_key: "legacy-semantic-key" }]);
    const semanticCollision = counts(container); expectBlocked(container, "semantic variant collision"); assert.deepEqual(counts(container), semanticCollision);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,product_format,is_active) values(${literal(newProducts[0].name)},'semantic-duplicate',${literal(newProducts[0].brand)},${literal(newProducts[0].category)},${literal(newProducts[0].product_format)},true)`);
    const semanticProduct = counts(container); expectBlocked(container, "semantic product collision"); assert.deepEqual(counts(container), semanticProduct);

    recreateDatabase(container);
    sql(container, `delete from product_variants where product_id=${existingProducts[0].id}`);
    const missingDefault = counts(container); expectBlocked(container, "missing existing default relation"); assert.deepEqual(counts(container), missingDefault);

    recreateDatabase(container);
    const lastKey = variants.at(-1).variant_key;
    sql(container, `create function reject_batch_f_variant() returns trigger language plpgsql as $$ begin if new.variant_key=${literal(lastKey)} then raise exception 'controlled Batch F failure'; end if; return new; end $$; create trigger reject_batch_f_variant before insert on product_variants for each row execute function reject_batch_f_variant()`);
    const late = counts(container); const lateImmutable = immutableState(container);
    expectBlocked(container, "late controlled failure");
    assert.deepEqual(counts(container), late); assert.deepEqual(immutableState(container), lateImmutable);
    assert.equal(sql(container, `select count(*) from products where slug in(${newProducts.map((row) => literal(row.slug)).join(",")})`), "0");
    assert.equal(sql(container, `select count(*) from products p join (values ${images.map((row) => `(${row.product_id})`).join(",")}) e(id) on e.id=p.id where p.image is not null`), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
