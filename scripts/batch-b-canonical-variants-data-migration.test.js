const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715120000_seed_discount_supplements_batch_b_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_b_variants_test";
const productIds = [37, 158, 222, 409, 481];
const expectedCounts = { 37: 7, 158: 6, 222: 4, 409: 4, 481: 4 };
const definitionSpecs = {
  37: { sizeValue: 450, displaySize: "450g", flavours: [["fruit burst", "Fruit Burst"], ["green apple", "Green Apple"], ["ice blue razz", "Ice Blue Razz"], ["lemon and lime", "Lemon & Lime"], ["orange and mango", "Orange & Mango"], ["pineapple", "Pineapple"], ["watermelon", "Watermelon"]] },
  158: { sizeValue: 5400, displaySize: "5.4kg", flavours: [["banana", "Banana"], ["chocolate", "Chocolate"], ["chocolate peanut", "Chocolate Peanut"], ["cookies and cream", "Cookies & Cream"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
  222: { sizeValue: 6800, displaySize: "6.8kg", flavours: [["chocolate fudge brownie", "Chocolate Fudge Brownie"], ["cookies and cream", "Cookies & Cream"], ["strawberry and banana", "Strawberry & Banana"], ["triple chocolate", "Triple Chocolate"]] },
  409: { sizeValue: 1800, displaySize: "1.8kg", flavours: [["apple and cherry", "Apple & Cherry"], ["blue raspberry", "Blue Raspberry"], ["fruit burst", "Fruit Burst"], ["summer fruit", "Summer Fruit"]] },
  481: { sizeValue: 500, displaySize: "500g", flavours: [["blue razz", "Blue Razz"], ["red hawaiian", "Red Hawaiian"], ["slush puppie", "Slush Puppie"], ["tigers blood", "Tigers Blood"]] },
};
const independentInventory = Object.entries(definitionSpecs).flatMap(([productId, spec]) =>
  spec.flavours.map(([flavourCode, flavourLabel]) => ({
    product_id: Number(productId),
    variant_key: `${flavourCode.replaceAll(" ", "-")}-${spec.sizeValue}g`,
    display_name: `${flavourLabel} / ${spec.displaySize}`,
    flavour_code: flavourCode,
    flavour_label: flavourLabel,
    size_value: spec.sizeValue,
    size_unit: "g",
    pack_count: 1,
    product_format: "powder",
    is_default: false,
    is_active: true,
  }))
).sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key));

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
  return run("docker", ["exec", "-e", "PGPASSWORD=batch-b-local-only", container, ...args], timeout);
}

function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}

function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local Batch B fixture SQL");
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

function migrationInventory() {
  const text = fs.readFileSync(migration, "utf8");
  const match = text.match(/\$batch_b_inventory\$\s*(\[[\s\S]*?\])\s*\$batch_b_inventory\$::jsonb/);
  assert.ok(match, "migration must expose its closed Batch B inventory");
  return JSON.parse(match[1]);
}

const expectedInventory = migrationInventory();

function sqlLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertInventory(container, rows) {
  const values = rows.map((row) => `(
    ${sqlLiteral(row.product_id)},${sqlLiteral(row.variant_key)},${sqlLiteral(row.display_name)},
    ${sqlLiteral(row.flavour_code)},${sqlLiteral(row.flavour_label)},${sqlLiteral(row.size_value)},
    ${sqlLiteral(row.size_unit)},${sqlLiteral(row.pack_count)},${sqlLiteral(row.product_format)},
    null,null,'{}'::jsonb,${sqlLiteral(row.is_default)},${sqlLiteral(row.is_active)}
  )`).join(",");
  sql(container, `insert into public.product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
    size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) values ${values}`);
}

const fixtureSql = `
  insert into public.retailers(id,name,slug,website)
  values(3,'Whey Okay','whey-okay','https://wheyokay.example');

  insert into public.products(id,name,slug,brand,category,is_active,merged_into_product_id,merged_at)
  values
    (37,'Applied Nutrition BCAA Amino Hydrate 450g','applied-bcaa-450g','Applied Nutrition','Amino Acids',true,null,null),
    (158,'Optimum Nutrition Serious Mass  5.4kg','serious-mass-5-4kg','Optimum Nutrition','Health Supplements',true,null,null),
    (222,'Mutant Mass 6.8kg','mutant-mass-6-8kg','Mutant','Health Supplements',true,null,null),
    (409,'NXT Beef Protein Isolate 1.8kg','nxt-beef-isolate-1-8kg','Unknown','Whey Protein',true,null,null),
    (481,'Applied Nutrition ABE Pump 500g','abe-pump-500g','Applied Nutrition','Pre Workout',true,null,null);

  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
  values
    (75,37,'default','Default',true,true),
    (149,158,'default','Default',true,true),
    (187,222,'default','Default',true,true),
    (387,409,'default','Default',true,true),
    (475,481,'default','Default',true,true);
  select setval('public.product_variants_id_seq',1000,true);

  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence
  ) values
    (101,3,37,75,'BCAA Amino Hydrate','https://wheyokay.example/p37','fixture',100),
    (102,3,158,149,'Serious Mass','https://wheyokay.example/p158','fixture',100),
    (103,3,222,187,'Mutant Mass','https://wheyokay.example/p222','fixture',100),
    (104,3,409,387,'NXT Beef Protein Isolate','https://wheyokay.example/p409','fixture',100),
    (105,3,481,475,'ABE Pump','https://wheyokay.example/p481','fixture',100);

  insert into public.offers(
    id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url
  ) values
    (201,37,3,101,75,16,0,16,true,'https://wheyokay.example/p37'),
    (202,158,3,102,149,68,0,68,true,'https://wheyokay.example/p158'),
    (203,222,3,103,187,65,0,65,false,'https://wheyokay.example/p222'),
    (204,409,3,104,387,50,0,50,true,'https://wheyokay.example/p409'),
    (205,481,3,105,475,30,0,30,true,'https://wheyokay.example/p481');

  insert into public.price_history(id,offer_id,price,shipping_cost,total_price)
  select 300 + id, id, price, shipping_cost, total_price from public.offers;
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create Batch B fixture");
}

function snapshot(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p) order by id) from products p where id in (37,158,222,409,481)),
    'variants',(select jsonb_agg(to_jsonb(v)-'created_at'-'updated_at' order by product_id,variant_key) from product_variants v where product_id in (37,158,222,409,481)),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph)
  )`));
}

function otherTables(state) {
  return { products: state.products, mappings: state.mappings, offers: state.offers, history: state.history };
}

function targetRows(container) {
  return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object(
    'product_id',product_id,'variant_key',variant_key,'display_name',display_name,
    'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,
    'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,
    'is_default',is_default,'is_active',is_active
  ) order by product_id,variant_key) from product_variants
  where product_id in (37,158,222,409,481) and not is_default`));
}

function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch B migration has a closed 25-variant product_variants-only contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(expectedInventory.length, 25);
  assert.deepEqual([...new Set(expectedInventory.map((row) => row.product_id))].sort((a, b) => a - b), productIds);
  assert.equal(new Set(expectedInventory.map((row) => `${row.product_id}:${row.variant_key}`)).size, 25);
  assert.equal(new Set(expectedInventory.map((row) => `${row.product_id}:${row.flavour_code}:${row.size_value}:${row.size_unit}`)).size, 25);
  assert.deepEqual([...expectedInventory].sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key)), independentInventory);
  for (const [productId, count] of Object.entries(expectedCounts)) {
    assert.equal(expectedInventory.filter((row) => row.product_id === Number(productId)).length, count);
  }
  for (const row of expectedInventory) {
    assert.equal(row.size_unit, "g");
    assert.equal(row.pack_count, 1);
    assert.equal(row.product_format, "powder");
    assert.equal(row.is_default, false);
    assert.equal(row.is_active, true);
  }
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(products|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
  assert.doesNotMatch(text, /(external_product_id|external_variant_id|external_sku|external_url|https?:\/\/|\bprice\b)/i);
  assert.ok(text.indexOf("semantic duplicate exists") < text.indexOf("insert into public.product_variants"));
  assert.match(text, /v_after_count is distinct from v_before_count \+ v_inserted/i);
});

test("real Batch B migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-b-variants-${crypto.randomBytes(6).toString("hex")}`;
  const mount = `${root}:/workspace:ro`;
  try {
    requireSuccess(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_PASSWORD=batch-b-local-only", "-v", mount, image,
    ], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = snapshot(container);
    requireSuccess(applyMigration(container), "Batch B happy path");
    const after = snapshot(container);
    const actualTargets = targetRows(container);
    assert.deepEqual(actualTargets, independentInventory);
    for (const [productId, count] of Object.entries(expectedCounts)) {
      assert.equal(actualTargets.filter((row) => row.product_id === Number(productId)).length, count);
    }
    assert.deepEqual(after.variants.filter((row) => row.is_default), before.variants.filter((row) => row.is_default));
    assert.deepEqual(otherTables(after), otherTables(before));

    requireSuccess(applyMigration(container), "Batch B idempotent rerun");
    assert.deepEqual(snapshot(container), after);

    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(409,'legacy-blue-raspberry','Legacy Blue Raspberry','blue raspberry','Blue Raspberry',1800,'g',1,'powder',true,false)");
    const semanticCollision = snapshot(container);
    expectBlocked(container, "semantic collision under another key");
    assert.deepEqual(snapshot(container), semanticCollision);

    recreateDatabase(container);
    insertInventory(container, [expectedInventory[0]]);
    sql(container, `update product_variants set display_name='Drifted' where product_id=${expectedInventory[0].product_id} and variant_key='${expectedInventory[0].variant_key}'`);
    const driftedKey = snapshot(container);
    expectBlocked(container, "drifted expected key");
    assert.deepEqual(snapshot(container), driftedKey);

    recreateDatabase(container);
    sql(container, "alter table products drop constraint products_merge_state_consistent; update products set is_active=false where id=481");
    const inactiveProduct = snapshot(container);
    expectBlocked(container, "inactive canonical product");
    assert.deepEqual(snapshot(container), inactiveProduct);

    recreateDatabase(container);
    insertInventory(container, expectedInventory.slice(0, 5));
    requireSuccess(applyMigration(container), "exact partial target completion");
    assert.deepEqual(targetRows(container), independentInventory);

    recreateDatabase(container);
    sql(container, "create function reject_batch_b_variant() returns trigger language plpgsql as $$ begin if new.variant_key='triple-chocolate-6800g' then raise exception 'controlled Batch B failure'; end if; return new; end $$; create trigger reject_batch_b_variant before insert on product_variants for each row execute function reject_batch_b_variant()");
    const beforeControlledFailure = snapshot(container);
    expectBlocked(container, "controlled insert failure");
    assert.deepEqual(snapshot(container), beforeControlledFailure);
    assert.equal(sql(container, "select count(*) from product_variants where product_id in (37,158,222,409,481) and not is_default"), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
