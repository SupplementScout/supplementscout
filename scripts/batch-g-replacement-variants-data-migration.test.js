const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260716001000_seed_batch_g_replacement_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_g_replacement_test";

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
  return requireSuccess(psql(container, ["-At", "-c", statement]), "SQL statement").stdout.trim();
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
function inventory() {
  const text = fs.readFileSync(migration, "utf8");
  const match = text.match(/\$batch_g_replacement_variants\$\s*([\s\S]*?)\s*\$batch_g_replacement_variants\$::jsonb/);
  assert.ok(match, "migration must expose closed Batch G replacement variant inventory");
  return JSON.parse(match[1]);
}
const variants = inventory();

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", `
    insert into retailers(id,name,slug,website) values(9,'Fit House','fit-house','https://fithouse.uk');
    insert into products(id,name,slug,brand,category,price,image,servings,net_weight_g,product_format,is_active,nutrition_verified,unit_pricing_verified,serving_count_verified,protein_per_serving_g)
      values(337,'GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','GYM HIGH','Whey Protein',26.99,'https://files.ekmcdn.com/2ab763/images/gym-high-whey-pro-synergy-600g-flavour-cookies-cream-3299-p.jpg',null,600,'powder',true,true,true,20,25.2);
    insert into product_variants(id,product_id,variant_key,display_name,is_active,is_default,nutrition_override)
      values(333,337,'default','Default',true,true,'{}'::jsonb);
    insert into retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence)
      values(101,9,337,333,'Fixture Default','https://example.test','fixture',100);
    insert into offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url)
      values(201,337,9,101,333,10,2,12,true,'https://example.test');
    insert into price_history(id,offer_id,price,shipping_cost,total_price) values(301,201,10,2,12);
    select setval('product_variants_id_seq',1000,true);
  `]), "create Batch G replacement fixture");
}
function counts(container) {
  return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'mappings',(select count(*) from retailer_products),'offers',(select count(*) from offers),'history',(select count(*) from price_history))"));
}
function targetState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'target_variants',(select count(*) from product_variants where product_id=337 and variant_key in ('banana-600g','strawberry-600g')),
    'active_non_default',(select count(*) from product_variants where product_id=337 and is_active and not is_default and variant_key in ('banana-600g','strawberry-600g')),
    'defaults',(select count(*) from product_variants where product_id=337 and is_active and is_default),
    'formats',(select jsonb_agg(product_format order by variant_key) from product_variants where product_id=337 and variant_key in ('banana-600g','strawberry-600g'))
  )`));
}
function expectBlocked(container, label) {
  const before = counts(container);
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.deepEqual(counts(container), before);
}

test("Batch G replacement migration has a closed 2-variant canonical-only contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(variants.length, 2);
  assert.deepEqual(variants.map((row) => row.variant_key).sort(), ["banana-600g", "strawberry-600g"]);
  assert.equal(new Set(variants.map((row) => `${row.product_id}:${row.variant_key}`)).size, 2);
  assert.equal(new Set(variants.map((row) => `${row.product_id}:${row.flavour_code}:${row.size_value}:${row.size_unit}:${row.product_format}`)).size, 2);
  assert.ok(variants.every((row) => row.product_id === 337 && row.size_value === 600 && row.size_unit === "g"));
  assert.ok(variants.every((row) => row.product_format === "powder" && row.pack_count === 1 && row.is_default === false && row.is_active === true));
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(products|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
});

test("real Batch G replacement migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-g-replacement-${Date.now()}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-g-replacement-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    requireSuccess(applyMigration(container), "Batch G replacement clean state");
    assert.deepEqual(counts(container), { products: before.products, variants: before.variants + 2, mappings: before.mappings, offers: before.offers, history: before.history });
    assert.deepEqual(targetState(container), { target_variants: 2, active_non_default: 2, defaults: 1, formats: ["powder", "powder"] });

    requireSuccess(applyMigration(container), "Batch G replacement identical rerun");
    assert.deepEqual(counts(container), { products: before.products, variants: before.variants + 2, mappings: before.mappings, offers: before.offers, history: before.history });

    recreateDatabase(container);
    sql(container, "update products set name='Drifted' where id=337");
    expectBlocked(container, "product identity drift");

    recreateDatabase(container);
    sql(container, "delete from product_variants where id=333");
    expectBlocked(container, "missing default relation");

    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default,nutrition_override) values(337,'legacy-banana','Banana / 600g','banana','Banana',600,'g',1,'powder',true,false,'{}'::jsonb)");
    expectBlocked(container, "semantic variant collision");

    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default,nutrition_override) values(337,'banana-600g','Drifted','banana','Banana',600,'g',1,'powder',true,false,'{}'::jsonb)");
    expectBlocked(container, "variant key drift");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
