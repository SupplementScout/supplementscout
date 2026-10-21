const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "supabase/migrations/20261021190000_correct_ghost_lifestyle_energy_drink_metadata.sql";
const ROLLBACK = "supabase/rollbacks/20261021190000_correct_ghost_lifestyle_energy_drink_metadata.sql";
const migration = fs.readFileSync(path.join(ROOT, MIGRATION), "utf8");
const rollback = fs.readFileSync(path.join(ROOT, ROLLBACK), "utf8");
const IMAGE = "postgres:17-alpine";
const DATABASE = "supplementscout_ghost_metadata_test";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout, env: process.env });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function succeed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}
function dockerExec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=ghost-local-only", container, ...args], timeout);
}
function psql(container, args, timeout) {
  return dockerExec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", DATABASE, ...args], timeout);
}
function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = dockerExec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000);
    if (result.status === 0 && result.stdout.trim() === "1") return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function fixtureSql(target = {}) {
  const environment = target.environment || "PRODUCTION";
  const projectRef = target.projectRef || "aftboxmrdgyhizicfsfu";
  const identity = target.identity || "supplementscout-production:aftboxmrdgyhizicfsfu";
  return `
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text not null,name text not null);
    create table public.products(
      id bigint primary key,name text,slug text,brand text,category text,product_format text,gtin text,
      is_active boolean,merged_into_product_id bigint,merged_at timestamptz,created_at timestamptz default now()
    );
    create table public.product_variants(
      id bigint primary key,product_id bigint,variant_key text,display_name text,flavour_code text,flavour_label text,
      size_value numeric,size_unit text,pack_count integer,product_format text,gtin text,is_active boolean,
      is_default boolean,created_at timestamptz default now(),updated_at timestamptz default now()
    );
    create table public.retailer_products(
      id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,external_product_id text,
      external_variant_id text,external_options jsonb,external_url text,external_name text,external_sku text,
      external_gtin text,created_at timestamptz default now(),updated_at timestamptz default now()
    );
    create table public.offers(
      id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,retailer_product_id bigint,
      price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text,created_at timestamptz default now(),
      last_checked_at timestamptz default now()
    );
    create table public.price_history(
      id bigint primary key,offer_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,
      checked_at timestamptz,created_at timestamptz default now()
    );
    create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable as
      $$select jsonb_build_object('target_environment','${environment}','project_ref','${projectRef}',
        'database_identity','${identity}')$$;
    insert into public.products(id,name,slug,brand,category,product_format,gtin,is_active,merged_into_product_id,merged_at)
      values(1398,'Ghost Lifestyle Energy Drink','ghost-lifestyle-energy-drink','Ghost Lifestyle','Pre Workout','powder',null,true,null,null);
    insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active,is_default)
      values(4306,1398,'sour-warheads-watermelon-500ml','Sour Warheads Watermelon / 500ml','sour warheads watermelon','Sour Warheads Watermelon',500,'ml',1,'powder',null,true,false);
    insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_options,external_url,external_name,external_sku,external_gtin)
      values(4270,15,1398,4306,'15246472610166','55897618579830','{"Flavour":"Sour Warheads Watermelon","Size":"500ml"}',
        'https://gladiatornutrition.co.uk/products/ghost-lifestyle-energy-drink?variant=55897618579830','Ghost Lifestyle Energy Drink',null,null);
    insert into public.offers(id,retailer_id,product_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url)
      values(4083,15,1398,4306,4270,2.75,6.99,9.74,true,
        'https://gladiatornutrition.co.uk/products/ghost-lifestyle-energy-drink?variant=55897618579830&sca_ref=11968733.U3nlV04VwN4S');
    insert into public.price_history(id,offer_id,price,shipping_cost,total_price,in_stock,checked_at)
      values(43153,4083,2.75,6.99,9.74,null,'2026-10-21T04:58:33.968Z');
  `;
}
function recreate(container, target) {
  succeed(dockerExec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", DATABASE]), "drop database");
  succeed(dockerExec(container, ["createdb", "-U", "postgres", DATABASE]), "create database");
  succeed(psql(container, ["-c", fixtureSql(target)]), "seed fixture");
}
function applyFile(container, file) {
  return psql(container, ["-f", `/workspace/${file}`]);
}
function scalar(container, sql) {
  return succeed(psql(container, ["-tAc", sql]), "read scalar").stdout.trim();
}
function snapshot(container) {
  return scalar(container, `select jsonb_build_object(
    'product',(select to_jsonb(p) from products p where id=1398),
    'variants',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from product_variants v where product_id=1398),
    'mappings',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from retailer_products r),
    'offers',(select coalesce(jsonb_agg(to_jsonb(o) order by id),'[]') from offers o),
    'history',(select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from price_history h),
    'counts',jsonb_build_array((select count(*) from products),(select count(*) from product_variants),
      (select count(*) from retailer_products),(select count(*) from offers),(select count(*) from price_history)))::text`);
}
function assertFailureWithoutPartialWrite(container, mutate, pattern, file = MIGRATION) {
  succeed(psql(container, ["-c", mutate]), "mutate negative fixture");
  const before = snapshot(container);
  const result = applyFile(container, file);
  assert.notEqual(result.status, 0);
  assert.match(output(result), pattern);
  assert.equal(snapshot(container), before);
}

test("Ghost Lifestyle correction is exact, production-bound and changes only two reviewed rows", () => {
  for (const content of [migration, rollback]) {
    assert.match(content, /^begin;[\s\S]*commit;\s*$/);
    assert.match(crypto.createHash("sha256").update(content).digest("hex"), /^[0-9a-f]{64}$/);
    assert.match(content, /current_user <> 'postgres'/);
    assert.match(content, /target_environment' <> 'PRODUCTION'/);
    assert.match(content, /project_ref' <> 'aftboxmrdgyhizicfsfu'/);
    assert.match(content, /database_identity' <> 'supplementscout-production:aftboxmrdgyhizicfsfu'/);
    assert.doesNotMatch(content, /\binsert\s+into\s+public\./i);
    assert.doesNotMatch(content, /\bdelete\s+from\s+public\./i);
    assert.doesNotMatch(content, /update public\.(?:retailer_products|offers|price_history)/i);
  }
  assert.match(migration, /id=1398[\s\S]+category='Pre Workout' and product_format='powder'/);
  assert.match(migration, /id=4306[\s\S]+product_format='powder'/);
  assert.match(migration, /set category='Energy Drinks', product_format='liquid'/);
  assert.match(migration, /set product_format='liquid'/);
  assert.equal([...migration.matchAll(/update public\.products\b/gi)].length, 1);
  assert.equal([...migration.matchAll(/update public\.product_variants\b/gi)].length, 1);
  for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
    assert.match(migration, new RegExp(`count\\(\\*\\) from public\\.${table}`));
  }
  assert.match(rollback, /version='20261021190000' and name='correct_ghost_lifestyle_energy_drink_metadata'/);
  assert.match(rollback, /rollback refused after sibling expansion/);
  assert.match(rollback, /set category='Pre Workout', product_format='powder'/);
  assert.match(rollback, /set product_format='powder'/);
  assert.equal([...rollback.matchAll(/update public\.products\b/gi)].length, 1);
  assert.equal([...rollback.matchAll(/update public\.product_variants\b/gi)].length, 1);
});

test("Ghost Lifestyle forward and rollback are atomic and fail closed", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `supplementscout-ghost-metadata-${crypto.randomBytes(6).toString("hex")}`;
  try {
    succeed(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_PASSWORD=ghost-local-only", "-v", `${ROOT}:/workspace:ro`, IMAGE], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreate(container);
    const before = JSON.parse(snapshot(container));
    succeed(applyFile(container, MIGRATION), "apply forward migration");
    const corrected = JSON.parse(snapshot(container));
    assert.equal(corrected.product.category, "Energy Drinks");
    assert.equal(corrected.product.product_format, "liquid");
    assert.equal(corrected.variants[0].product_format, "liquid");
    assert.deepEqual(corrected.mappings, before.mappings);
    assert.deepEqual(corrected.offers, before.offers);
    assert.deepEqual(corrected.history, before.history);
    assert.deepEqual(corrected.counts, before.counts);
    succeed(psql(container, ["-c", "insert into supabase_migrations.schema_migrations values('20261021190000','correct_ghost_lifestyle_energy_drink_metadata')"]), "seed ledger");
    succeed(applyFile(container, ROLLBACK), "apply rollback");
    const restored = JSON.parse(snapshot(container));
    assert.equal(restored.product.category, "Pre Workout");
    assert.equal(restored.product.product_format, "powder");
    assert.equal(restored.variants[0].product_format, "powder");
    assert.deepEqual(restored.mappings, before.mappings);
    assert.deepEqual(restored.offers, before.offers);
    assert.deepEqual(restored.history, before.history);

    for (const [mutation, pattern] of [
      ["update products set product_format='liquid' where id=1398", /product precondition mismatch/],
      ["update products set category='Energy Drinks' where id=1398", /product precondition mismatch/],
      ["update product_variants set product_format='liquid' where id=4306", /variant precondition mismatch/],
      ["update retailer_products set external_variant_id='wrong' where id=4270", /mapping precondition mismatch/],
      ["update offers set product_variant_id=999 where id=4083", /offer precondition mismatch/],
      ["insert into product_variants(id,product_id,variant_key,display_name,is_active,is_default) values(4307,1398,'extra','Extra',true,false)", /variant precondition mismatch/],
    ]) {
      recreate(container);
      assertFailureWithoutPartialWrite(container, mutation, pattern);
    }

    recreate(container, { environment: "STAGING" });
    const wrongEnvironment = snapshot(container);
    const environmentFailure = applyFile(container, MIGRATION);
    assert.notEqual(environmentFailure.status, 0);
    assert.match(output(environmentFailure), /requires production database owner/);
    assert.equal(snapshot(container), wrongEnvironment);

    recreate(container, { projectRef: "wrongproject" });
    const wrongProject = snapshot(container);
    const projectFailure = applyFile(container, MIGRATION);
    assert.notEqual(projectFailure.status, 0);
    assert.match(output(projectFailure), /requires production database owner/);
    assert.equal(snapshot(container), wrongProject);

    for (const mutation of [
      "insert into product_variants(id,product_id,variant_key,display_name,product_format,is_active,is_default) values(4307,1398,'cherry','Cherry / 500ml','liquid',true,false)",
      "insert into retailer_products(id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_options,external_url) values(4271,15,1398,4306,'15246472610166','55897618612598','{}','https://example.invalid')",
    ]) {
      recreate(container);
      succeed(applyFile(container, MIGRATION), "apply forward before guarded rollback");
      succeed(psql(container, ["-c", "insert into supabase_migrations.schema_migrations values('20261021190000','correct_ghost_lifestyle_energy_drink_metadata')"]), "seed rollback ledger");
      assertFailureWithoutPartialWrite(container, mutation, /rollback refused after sibling expansion/, ROLLBACK);
    }
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
