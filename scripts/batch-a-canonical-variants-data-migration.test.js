const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260713220000_seed_batch_a_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_a_variants_test";
const productIds = [17, 36, 38, 80, 178, 248];
const expectedCounts = { 17: 4, 36: 8, 38: 3, 80: 3, 178: 4, 248: 3 };
const expectedKeys = {
  17: ["blue-raspberry-330g", "fruit-punch-330g", "green-apple-330g", "watermelon-330g"],
  36: ["candy-ice-blast-390g", "cherry-limeade-390g", "cola-millions-390g", "fruit-burst-390g", "fruit-salad-390g", "icy-blue-razz-390g", "pineapple-millions-390g", "raspberry-mojito-390g"],
  38: ["fruit-burst-375g", "icy-blue-razz-375g", "rainbow-unicorn-375g"],
  80: ["fruit-fusion-270g", "lemon-lime-270g", "orange-270g"],
  178: ["banana-1800g", "chocolate-1800g", "strawberry-1800g", "vanilla-1800g"],
  248: ["chocolate-930g", "strawberry-930g", "vanilla-930g"],
};
const definitionSpecs = {
  17: { sizeValue: 330, displaySize: "330g", flavours: [["blue raspberry", "Blue Raspberry"], ["fruit punch", "Fruit Punch"], ["green apple", "Green Apple"], ["watermelon", "Watermelon"]] },
  36: { sizeValue: 390, displaySize: "390g", flavours: [["candy ice blast", "Candy Ice Blast"], ["cherry limeade", "Cherry Limeade"], ["cola millions", "Cola Millions"], ["fruit burst", "Fruit Burst"], ["fruit salad", "Fruit Salad"], ["icy blue razz", "Icy Blue Razz"], ["pineapple millions", "Pineapple Millions"], ["raspberry mojito", "Raspberry Mojito"]] },
  38: { sizeValue: 375, displaySize: "375g", flavours: [["fruit burst", "Fruit Burst"], ["icy blue razz", "Icy Blue Razz"], ["rainbow unicorn", "Rainbow Unicorn"]] },
  80: { sizeValue: 270, displaySize: "270g", flavours: [["fruit fusion", "Fruit Fusion"], ["lemon lime", "Lemon Lime"], ["orange", "Orange"]] },
  178: { sizeValue: 1800, displaySize: "1.8kg", flavours: [["banana", "Banana"], ["chocolate", "Chocolate"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
  248: { sizeValue: 930, displaySize: "930g", flavours: [["chocolate", "Chocolate"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
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
  return run("docker", ["exec", "-e", "PGPASSWORD=batch-a-local-only", container, ...args], timeout);
}

function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}

function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local Batch A fixture SQL");
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
  const match = text.match(/\$batch_a_inventory\$\s*(\[[\s\S]*?\])\s*\$batch_a_inventory\$::jsonb/);
  assert.ok(match, "migration must expose its closed Batch A inventory");
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
    (17,'Optimum Nutrition Gold Standard Pre-Workout 330g','on-gold-standard-pre-workout-330g','Optimum Nutrition','Pre Workout',true,null,null),
    (36,'Applied Nutrition Amino Fuel EAA 390g','applied-amino-fuel-eaa-390g','Applied Nutrition','Amino Acids',true,null,null),
    (38,'Applied Nutrition Pump Pre Workout 375g','applied-pump-pre-workout-375g','Applied Nutrition','Pre Workout',true,null,null),
    (80,'Optimum Nutrition Amino Energy 270g','on-amino-energy-270g','Optimum Nutrition','Amino Acids',true,null,null),
    (178,'Applied Nutrition ISO-XP 1.8kg','applied-iso-xp-1-8kg','Applied Nutrition','Whey Protein',true,null,null),
    (248,'Optimum Nutrition 100% Isolate 930g','on-isolate-930g','Optimum Nutrition','Health Supplements',true,null,null);

  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
  values
    (1,17,'default','Default',true,true),
    (59,36,'default','Default',true,true),
    (6,38,'default','Default',true,true),
    (52,80,'default','Default',true,true),
    (176,178,'default','Default',true,true),
    (300,248,'default','Default',true,true);
  select setval('public.product_variants_id_seq',1000,true);

  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence
  ) values
    (101,3,17,1,'ON Pre Workout','https://wheyokay.example/p17','fixture',100),
    (102,3,36,59,'Amino Fuel','https://wheyokay.example/p36','fixture',100),
    (103,3,38,6,'Pump','https://wheyokay.example/p38','fixture',100),
    (104,3,80,52,'Amino Energy','https://wheyokay.example/p80','fixture',100),
    (105,3,178,176,'ISO-XP','https://wheyokay.example/p178','fixture',100),
    (106,3,248,300,'Isolate','https://wheyokay.example/p248','fixture',100);

  insert into public.offers(
    id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url
  ) values
    (201,17,3,101,1,23.99,0,23.99,true,'https://wheyokay.example/p17'),
    (202,36,3,102,59,24.77,0,24.77,true,'https://wheyokay.example/p36'),
    (203,38,3,103,6,22.99,0,22.99,true,'https://wheyokay.example/p38'),
    (204,80,3,104,52,17.99,0,17.99,true,'https://wheyokay.example/p80'),
    (205,178,3,105,176,71.53,0,71.53,true,'https://wheyokay.example/p178'),
    (206,248,3,106,300,45.99,0,45.99,true,'https://wheyokay.example/p248');

  insert into public.price_history(id,offer_id,price,shipping_cost,total_price)
  select 300 + id, id, price, shipping_cost, total_price from public.offers;

  insert into public.outbound_clicks(id,offer_id,product_id,retailer_id,destination_url,source_page)
  select 400 + id,id,product_id,retailer_id,url,'product_offer_list' from public.offers;
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create Batch A fixture");
}

function snapshot(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p) order by id) from products p where id in (17,36,38,80,178,248)),
    'variants',(select jsonb_agg(to_jsonb(v)-'created_at'-'updated_at' order by product_id,variant_key) from product_variants v where product_id in (17,36,38,80,178,248)),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph),
    'clicks',(select jsonb_agg(to_jsonb(oc) order by id) from outbound_clicks oc)
  )`));
}

function otherTables(state) {
  return {
    products: state.products,
    mappings: state.mappings,
    offers: state.offers,
    history: state.history,
    clicks: state.clicks,
  };
}

function targetRows(container) {
  return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object(
    'product_id',product_id,'variant_key',variant_key,'display_name',display_name,
    'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,
    'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,
    'is_default',is_default,'is_active',is_active
  ) order by product_id,variant_key) from product_variants
  where product_id in (17,36,38,80,178,248) and not is_default`));
}

function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch A migration has a closed 25-variant product_variants-only contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(expectedInventory.length, 25);
  assert.deepEqual([...new Set(expectedInventory.map((row) => row.product_id))].sort((a, b) => a - b), productIds);
  assert.equal(expectedInventory.some((row) => row.product_id === 124), false);
  assert.equal(new Set(expectedInventory.map((row) => `${row.product_id}:${row.variant_key}`)).size, 25);
  assert.deepEqual(
    [...expectedInventory].sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key)),
    independentInventory
  );
  for (const [productId, keys] of Object.entries(expectedKeys)) {
    assert.deepEqual(expectedInventory.filter((row) => row.product_id === Number(productId)).map((row) => row.variant_key).sort(), [...keys].sort());
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
});

test("real Batch A migration scenarios A-L on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-a-variants-${crypto.randomBytes(6).toString("hex")}`;
  const mount = `${root}:/workspace:ro`;
  try {
    requireSuccess(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_PASSWORD=batch-a-local-only", "-v", mount, image,
    ], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    // A and L: happy path, exact per-product counts, unchanged defaults and other tables.
    recreateDatabase(container);
    const before = snapshot(container);
    requireSuccess(applyMigration(container), "Batch A happy path");
    const after = snapshot(container);
    const actualTargets = targetRows(container);
    assert.deepEqual(actualTargets, [...expectedInventory].sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key)));
    for (const [productId, count] of Object.entries(expectedCounts)) {
      assert.equal(actualTargets.filter((row) => row.product_id === Number(productId)).length, count);
    }
    assert.deepEqual(after.variants.filter((row) => row.is_default), before.variants.filter((row) => row.is_default));
    assert.deepEqual(otherTables(after), otherTables(before));

    // B: full rerun is a no-op.
    requireSuccess(applyMigration(container), "Batch A idempotent rerun");
    assert.deepEqual(snapshot(container), after);

    // C: inactive semantic duplicate under another key blocks.
    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(178,'legacy-banana','Legacy Banana','banana','Banana',1800,'g',1,'powder',false,false)");
    const inactiveDuplicate = snapshot(container);
    expectBlocked(container, "inactive semantic duplicate");
    assert.deepEqual(snapshot(container), inactiveDuplicate);

    // D: active semantic duplicate under another key blocks.
    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(36,'legacy-fruit-burst','Legacy Fruit Burst','fruit burst','Fruit Burst',390,'g',1,'powder',true,false)");
    const activeDuplicate = snapshot(container);
    expectBlocked(container, "active semantic duplicate");
    assert.deepEqual(snapshot(container), activeDuplicate);

    // E: expected key with drifted values blocks.
    recreateDatabase(container);
    insertInventory(container, [expectedInventory[0]]);
    sql(container, `update product_variants set display_name='Drifted' where product_id=${expectedInventory[0].product_id} and variant_key='${expectedInventory[0].variant_key}'`);
    const driftedKey = snapshot(container);
    expectBlocked(container, "drifted expected key");
    assert.deepEqual(snapshot(container), driftedKey);

    // F: inactive product blocks.
    recreateDatabase(container);
    sql(container, "alter table products drop constraint products_merge_state_consistent; update products set is_active=false where id=178");
    const inactiveProduct = snapshot(container);
    expectBlocked(container, "inactive canonical product");
    assert.deepEqual(snapshot(container), inactiveProduct);

    // G: merged product blocks.
    recreateDatabase(container);
    sql(container, "insert into products(id,name,slug,is_active) values(999,'Merge target','merge-target',true); update products set is_active=false,merged_into_product_id=999,merged_at=now() where id=248");
    const mergedProduct = snapshot(container);
    expectBlocked(container, "merged canonical product");
    assert.deepEqual(snapshot(container), mergedProduct);

    // H: stale default variant blocks.
    recreateDatabase(container);
    sql(container, "update product_variants set is_active=false where id=59");
    const staleDefault = snapshot(container);
    expectBlocked(container, "stale default variant");
    assert.deepEqual(snapshot(container), staleDefault);

    // I: an exact partial target state is completed safely.
    recreateDatabase(container);
    insertInventory(container, expectedInventory.slice(0, 5));
    requireSuccess(applyMigration(container), "exact partial target completion");
    assert.deepEqual(targetRows(container), [...expectedInventory].sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key)));

    // J: one drifted target in a partial state blocks all missing inserts.
    recreateDatabase(container);
    insertInventory(container, expectedInventory.slice(0, 5));
    sql(container, `update product_variants set size_value=999 where product_id=${expectedInventory[1].product_id} and variant_key='${expectedInventory[1].variant_key}'`);
    const partialDrift = snapshot(container);
    expectBlocked(container, "partial target state with drift");
    assert.deepEqual(snapshot(container), partialDrift);
    assert.equal(targetRows(container).length, 5);

    // K: a controlled later-row insert error rolls back the whole batch.
    recreateDatabase(container);
    sql(container, "create function reject_batch_a_variant() returns trigger language plpgsql as $$ begin if new.variant_key='strawberry-930g' then raise exception 'controlled Batch A failure'; end if; return new; end $$; create trigger reject_batch_a_variant before insert on product_variants for each row execute function reject_batch_a_variant()");
    const beforeControlledFailure = snapshot(container);
    expectBlocked(container, "controlled insert failure");
    assert.deepEqual(snapshot(container), beforeControlledFailure);
    assert.equal(sql(container, "select count(*) from product_variants where product_id in (17,36,38,80,178,248) and not is_default"), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
