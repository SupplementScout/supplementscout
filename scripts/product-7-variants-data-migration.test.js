const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260713210000_create_product_7_chocolate_vanilla_variants_and_retire_legacy_offer.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_product_7_variants_test";
const legacyUrl = "https://www.discount-supplements.co.uk/products/optimum-nutrition-gold-standard-100-whey-2-27kg";

assert.equal(process.argv.length, 2, "this test runner accepts no connection arguments");

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, env: process.env });
}

function combined(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`);
  assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`);
}

function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}

function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=product-7-local-only", container, ...args], timeout);
}

function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}

function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local product 7 fixture SQL");
  return result.stdout.trim();
}

function applyMigration(container) {
  return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]);
}

function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000);
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}

const fixtureSql = `
  insert into public.retailers(id,name,slug,website)
  values(4,'Discount Supplements','discount-supplements','https://www.discount-supplements.co.uk');
  insert into public.products(id,name,slug,brand,category,is_active,merged_into_product_id)
  values(7,'Optimum Nutrition Gold Standard 100% Whey 2.27kg','optimum-nutrition-gold-standard-whey-2-27kg','Optimum Nutrition','Whey Protein',true,null);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
  values(7,7,'default','Default',true,true);
  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_slug,
    external_url,external_variant_id,match_method,match_confidence,created_at,updated_at
  ) values(
    10,4,7,7,'Optimum Nutrition Gold Standard 100% Whey 2.27kg',
    'optimum-nutrition-gold-standard-whey-2-27kg','${legacyUrl}',null,
    'existing_offer',100,'2026-06-30T19:40:13.950723+00:00','2026-06-30T19:40:13.950723+00:00'
  );
  insert into public.offers(
    id,product_id,retailer_id,retailer_product_id,product_variant_id,price,
    shipping_cost,total_price,in_stock,url,last_checked_at
  ) values(
    10,7,4,10,7,77.95,4.99,null,true,'${legacyUrl}','2026-06-28T14:32:45.398+00:00'
  );
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price,checked_at,created_at)
  values(11,10,77.95,4.99,82.94,'2026-06-28T14:32:45.398+00:00','2026-06-29T12:58:42.980505+00:00');
  insert into public.outbound_clicks(id,offer_id,product_id,retailer_id,destination_url,source_page,created_at)
  values(577,10,7,4,'${legacyUrl}','product_offer_list','2026-07-08T08:17:32.09933+00:00');
`;

const exactVariantsSql = `
  insert into public.product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
    size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) values
    (7,'chocolate-2000g','Chocolate / 2kg','chocolate','Chocolate',2000,'g',1,'powder',null,null,'{}',false,true),
    (7,'vanilla-2000g','Vanilla / 2kg','vanilla','Vanilla',2000,'g',1,'powder',null,null,'{}',false,true);
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create product 7 fixture");
}

function snapshot(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'product_count',(select count(*) from products),
    'variants',(select coalesce(jsonb_agg(to_jsonb(v)-'created_at'-'updated_at' order by variant_key),'[]') from product_variants v where product_id=7),
    'mapping',(select to_jsonb(rp) from retailer_products rp where id=10),
    'offer',(select to_jsonb(o) from offers o where id=10),
    'history',(select coalesce(jsonb_agg(to_jsonb(ph) order by id),'[]') from price_history ph where offer_id=10),
    'clicks',(select coalesce(jsonb_agg(to_jsonb(oc) order by id),'[]') from outbound_clicks oc where offer_id=10)
  );`));
}

function assertOnlyStockChanged(before, after) {
  const expectedOffer = { ...before.offer, in_stock: false };
  assert.deepEqual(after.offer, expectedOffer);
  assert.deepEqual(after.mapping, before.mapping);
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.clicks, before.clicks);
  assert.equal(after.product_count, before.product_count);
}

function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

function insertSemanticVariant(container, {
  variantKey,
  flavourCode,
  flavourLabel,
  sizeValue = 2000,
  isActive = false,
}) {
  sql(container, `insert into product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
    size_unit,pack_count,product_format,is_active,is_default
  ) values(
    7,'${variantKey}','Semantic fixture','${flavourCode}','${flavourLabel}',
    ${sizeValue},'g',1,'powder',${isActive},false
  )`);
}

test("product 7 variant data migration is narrow, guarded, and transactional", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.doesNotMatch(text, /insert into public\.(products|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /update public\.(products|product_variants|retailer_products|price_history|outbound_clicks)/i);
  assert.match(text, /update public\.offers\s+set in_stock = false/i);
});

test("real product 7 variant migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-product-7-variants-${crypto.randomBytes(6).toString("hex")}`;
  const mount = `${root}:/workspace:ro`;
  try {
    requireSuccess(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_PASSWORD=product-7-local-only", "-v", mount, image,
    ], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    // A: happy path.
    recreateDatabase(container);
    const before = snapshot(container);
    requireSuccess(applyMigration(container), "happy path migration");
    const after = snapshot(container);
    assert.equal(before.variants.length, 1);
    assert.equal(after.variants.length, 3);
    assert.equal(after.variants.filter((variant) => variant.is_default && variant.is_active).length, 1);
    assert.deepEqual(after.variants.map((variant) => variant.variant_key).sort(), ["chocolate-2000g", "default", "vanilla-2000g"]);
    assertOnlyStockChanged(before, after);

    // B: rerun.
    requireSuccess(applyMigration(container), "idempotent rerun");
    assert.deepEqual(snapshot(container), after);

    // Null-safe offer state: NULL before the first execution blocks without mutations.
    recreateDatabase(container);
    sql(container, "update offers set in_stock=null where id=10");
    const nullBeforeFirstRun = snapshot(container);
    expectBlocked(container, "NULL offer stock before first execution");
    assert.deepEqual(snapshot(container), nullBeforeFirstRun);
    assert.equal(sql(container, "select count(*) from product_variants where product_id=7"), "1");

    // Null-safe offer state: NULL with exact variants is not an idempotent rerun.
    recreateDatabase(container);
    sql(container, exactVariantsSql);
    sql(container, "update offers set in_stock=null where id=10");
    const nullDuringRerun = snapshot(container);
    expectBlocked(container, "NULL offer stock during rerun");
    assert.deepEqual(snapshot(container), nullDuringRerun);

    // Null-safe offer state: a partial target state plus NULL blocks atomically.
    recreateDatabase(container);
    sql(container, `insert into product_variants(
      product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
      size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
    ) values(
      7,'chocolate-2000g','Chocolate / 2kg','chocolate','Chocolate',2000,
      'g',1,'powder',null,null,'{}',false,true
    )`);
    sql(container, "update offers set in_stock=null where id=10");
    const partialWithNull = snapshot(container);
    expectBlocked(container, "partial target state with NULL offer stock");
    assert.deepEqual(snapshot(container), partialWithNull);

    // C: inactive or merged product blocks.
    for (const mutation of [
      "alter table products drop constraint products_merge_state_consistent; update products set is_active=false where id=7",
      "insert into products(id,name,slug,is_active) values(99,'Merged target','merged-target',true); update products set is_active=false, merged_into_product_id=99, merged_at=now() where id=7",
    ]) {
      recreateDatabase(container);
      sql(container, mutation);
      expectBlocked(container, `stale product: ${mutation}`);
      assert.equal(sql(container, "select count(*) from product_variants where product_id=7"), "1");
    }

    // D: stale default variant blocks.
    recreateDatabase(container);
    sql(container, "update product_variants set is_active=false where id=7");
    expectBlocked(container, "stale default variant");

    // E: changed mapping identity blocks.
    recreateDatabase(container);
    sql(container, "update retailer_products set external_variant_id='unexpected' where id=10");
    expectBlocked(container, "changed mapping identity");

    // F: changed offer identity blocks.
    recreateDatabase(container);
    sql(container, "update offers set price=78.95 where id=10");
    expectBlocked(container, "changed offer identity");

    // G: variant_key conflict blocks.
    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,is_active,is_default) values(7,'chocolate-2000g','Conflicting',true,false)");
    expectBlocked(container, "variant key conflict");

    // Semantic A: inactive Chocolate under another key blocks without mutations.
    recreateDatabase(container);
    insertSemanticVariant(container, {
      variantKey: "legacy-chocolate-2kg",
      flavourCode: "chocolate",
      flavourLabel: "Chocolate",
    });
    const inactiveChocolate = snapshot(container);
    expectBlocked(container, "inactive Chocolate semantic duplicate");
    assert.deepEqual(snapshot(container), inactiveChocolate);
    assert.equal(sql(container, "select in_stock from offers where id=10"), "t");

    // Semantic B: inactive Vanilla under another key blocks.
    recreateDatabase(container);
    insertSemanticVariant(container, {
      variantKey: "legacy-vanilla-2kg",
      flavourCode: "vanilla",
      flavourLabel: "Vanilla",
    });
    const inactiveVanilla = snapshot(container);
    expectBlocked(container, "inactive Vanilla semantic duplicate");
    assert.deepEqual(snapshot(container), inactiveVanilla);

    // Semantic C: active semantic duplicate under another key blocks.
    recreateDatabase(container);
    insertSemanticVariant(container, {
      variantKey: "active-chocolate-2kg",
      flavourCode: "chocolate",
      flavourLabel: "Chocolate",
      isActive: true,
    });
    const activeDuplicate = snapshot(container);
    expectBlocked(container, "active Chocolate semantic duplicate");
    assert.deepEqual(snapshot(container), activeDuplicate);

    // Semantic D: several equivalent variants block.
    recreateDatabase(container);
    insertSemanticVariant(container, {
      variantKey: "legacy-chocolate-a",
      flavourCode: "chocolate",
      flavourLabel: "Chocolate",
    });
    insertSemanticVariant(container, {
      variantKey: "legacy-chocolate-b",
      flavourCode: "chocolate",
      flavourLabel: "Chocolate legacy label",
    });
    const severalDuplicates = snapshot(container);
    expectBlocked(container, "several Chocolate semantic duplicates");
    assert.deepEqual(snapshot(container), severalDuplicates);

    // H and J: exact existing variants plus retired offer are a safe rerun.
    recreateDatabase(container);
    sql(container, exactVariantsSql);
    sql(container, "update offers set in_stock=false where id=10");
    const exactBefore = snapshot(container);
    requireSuccess(applyMigration(container), "exact existing variant rerun");
    assert.deepEqual(snapshot(container), exactBefore);
    requireSuccess(applyMigration(container), "already retired offer rerun");
    assert.deepEqual(snapshot(container), exactBefore);

    // I and Semantic F: an expected key with drifted required fields blocks.
    for (const mutation of [
      "update product_variants set display_name='Drifted' where product_id=7 and variant_key='vanilla-2000g'",
      "update product_variants set flavour_code='strawberry', flavour_label='Strawberry' where product_id=7 and variant_key='vanilla-2000g'",
      "update product_variants set size_value=1000 where product_id=7 and variant_key='vanilla-2000g'",
    ]) {
      recreateDatabase(container);
      sql(container, exactVariantsSql);
      sql(container, mutation);
      sql(container, "update offers set in_stock=false where id=10");
      const driftedTarget = snapshot(container);
      expectBlocked(container, `existing target variant drift: ${mutation}`);
      assert.deepEqual(snapshot(container), driftedTarget);
    }

    // K: a failure on the second inserted row rolls back the first row and offer update.
    recreateDatabase(container);
    sql(container, `create function reject_vanilla() returns trigger language plpgsql as $$ begin if new.variant_key='vanilla-2000g' then raise exception 'controlled vanilla failure'; end if; return new; end $$; create trigger reject_vanilla before insert on product_variants for each row execute function reject_vanilla();`);
    expectBlocked(container, "controlled failure after first insert");
    assert.equal(sql(container, "select count(*) from product_variants where product_id=7"), "1");
    assert.equal(sql(container, "select in_stock from offers where id=10"), "t");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
