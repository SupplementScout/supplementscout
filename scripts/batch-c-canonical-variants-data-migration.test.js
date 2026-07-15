const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715150000_seed_discount_supplements_batch_c_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_c_variants_test";
const productIds = [19, 124, 157, 222, 231, 253, 292, 296];
const expectedCounts = { 19: 7, 124: 5, 157: 6, 222: 1, 231: 1, 253: 3, 292: 3, 296: 5 };
const definitionSpecs = {
  19: { sizeValue: 380, displaySize: "380g", flavours: [["blueberry", "Blueberry"], ["bubblegum", "Bubblegum"], ["cola", "Cola"], ["mango", "Mango"], ["mojito", "Mojito"], ["strawberry", "Strawberry"], ["watermelon", "Watermelon"]] },
  124: { sizeValue: 6000, displaySize: "6kg", flavours: [["banana", "Banana"], ["chocolate", "Chocolate"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"], ["white chocolate bueno", "White Chocolate Bueno"]] },
  157: { sizeValue: 2700, displaySize: "2.7kg", flavours: [["banana", "Banana"], ["chocolate", "Chocolate"], ["chocolate peanut", "Chocolate Peanut"], ["cookies and cream", "Cookies & Cream"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
  222: { sizeValue: 6800, displaySize: "6.8kg", flavours: [["vanilla", "Vanilla"]] },
  231: { sizeValue: 317, displaySize: "317g", flavours: [["unflavoured", "Unflavoured"]] },
  253: { sizeValue: 266, displaySize: "266g", flavours: [["peach and passionfruit", "Peach & Passionfruit"], ["raspberry and pomegranate", "Raspberry & Pomegranate"], ["strawberry kiwi", "Strawberry Kiwi"]] },
  292: { sizeValue: 390, displaySize: "390g", flavours: [["green burst", "Green Burst"], ["purple power", "Purple Power"], ["red rush", "Red Rush"]] },
  296: { sizeValue: 4000, displaySize: "4kg", flavours: [["banana", "Banana"], ["chocolate", "Chocolate"], ["cookies and cream", "Cookies & Cream"], ["strawberry", "Strawberry"], ["vanilla", "Vanilla"]] },
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
  return run("docker", ["exec", "-e", "PGPASSWORD=batch-c-local-only", container, ...args], timeout);
}
function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}
function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local Batch C fixture SQL");
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
  const match = text.match(/\$batch_c_inventory\$\s*(\[[\s\S]*?\])\s*\$batch_c_inventory\$::jsonb/);
  assert.ok(match, "migration must expose its closed Batch C inventory");
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
    (19,'Dorian Yates Blood & Guts Pre Workout 380g','blood-guts-380g','Dorian Yates','Pre Workout',true,null,null),
    (124,'Applied Nutrition Critical Mass Gainer 6kg','critical-mass-6kg','Applied Nutrition','Mass Gainer',true,null,null),
    (157,'Optimum Nutrition Serious Mass 2.7kg','serious-mass-2-7kg','Optimum Nutrition','Health Supplements',true,null,null),
    (222,'Mutant Mass 6.8kg','mutant-mass-6-8kg','Mutant','Health Supplements',true,null,null),
    (231,'Optimum Nutrition Micronised Creatine 317g','on-creatine-317g','Optimum Nutrition','Creatine',true,null,null),
    (253,'Optimum Nutrition Gold Standard BCAA Train Sustain 266g','on-bcaa-266g','Optimum Nutrition','Amino Acids',true,null,null),
    (292,'BSN NO-Xplode 390g (New formula)','bsn-no-xplode-390g','BSN','Health Supplements',true,null,null),
    (296,'USN Muscle Fuel Anabolic 4kg','usn-muscle-fuel-4kg','USN','Health Supplements',true,null,null);

  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
  values
    (3,19,'default','Default',true,true),(115,124,'default','Default',true,true),
    (148,157,'default','Default',true,true),(187,222,'default','Default',true,true),
    (194,231,'default','Default',true,true),(229,253,'default','Default',true,true),
    (291,292,'default','Default',true,true),(292,296,'default','Default',true,true),
    (752,222,'chocolate-fudge-brownie-6800g','Chocolate Fudge Brownie / 6.8kg',true,false),
    (753,222,'cookies-and-cream-6800g','Cookies & Cream / 6.8kg',true,false),
    (754,222,'strawberry-and-banana-6800g','Strawberry & Banana / 6.8kg',true,false),
    (755,222,'triple-chocolate-6800g','Triple Chocolate / 6.8kg',true,false);
  update public.product_variants set
    flavour_code=replace(split_part(variant_key,'-6800g',1),'-',' '),
    flavour_label=split_part(display_name,' / ',1),size_value=6800,size_unit='g',
    pack_count=1,product_format='powder'
  where id between 752 and 755;
  select setval('public.product_variants_id_seq',1000,true);

  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence
  ) values(101,3,19,3,'Blood & Guts','https://wheyokay.example/p19','fixture',100);
  insert into public.offers(
    id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url
  ) values(201,19,3,101,3,26.31,3.99,30.30,true,'https://wheyokay.example/p19');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price)
  values(301,201,26.31,3.99,30.30);
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create Batch C fixture");
}
function snapshot(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p) order by id) from products p where id in (19,124,157,222,231,253,292,296)),
    'variants',(select jsonb_agg(to_jsonb(v)-'created_at'-'updated_at' order by product_id,variant_key) from product_variants v where product_id in (19,124,157,222,231,253,292,296)),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph)
  )`));
}
function otherTables(state) { return { products: state.products, mappings: state.mappings, offers: state.offers, history: state.history }; }
function targetRows(container) {
  return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object(
    'product_id',v.product_id,'variant_key',v.variant_key,'display_name',v.display_name,
    'flavour_code',v.flavour_code,'flavour_label',v.flavour_label,'size_value',v.size_value,
    'size_unit',v.size_unit,'pack_count',v.pack_count,'product_format',v.product_format,
    'is_default',v.is_default,'is_active',v.is_active
  ) order by v.product_id,v.variant_key)
  from product_variants v
  join (values ${expectedInventory.map((r) => `(${r.product_id},${sqlLiteral(r.variant_key)})`).join(",")}) e(product_id,variant_key)
    on e.product_id=v.product_id and e.variant_key=v.variant_key`));
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch C migration has a closed 31-variant product_variants-only contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.equal(expectedInventory.length, 31);
  assert.deepEqual([...new Set(expectedInventory.map((row) => row.product_id))].sort((a, b) => a - b), productIds);
  assert.equal(new Set(expectedInventory.map((row) => `${row.product_id}:${row.variant_key}`)).size, 31);
  assert.equal(new Set(expectedInventory.map((row) => `${row.product_id}:${row.flavour_code}:${row.size_value}:${row.size_unit}`)).size, 31);
  assert.deepEqual([...expectedInventory].sort((a, b) => a.product_id - b.product_id || a.variant_key.localeCompare(b.variant_key)), independentInventory);
  for (const [productId, count] of Object.entries(expectedCounts)) assert.equal(expectedInventory.filter((row) => row.product_id === Number(productId)).length, count);
  for (const row of expectedInventory) {
    assert.equal(row.size_unit, "g"); assert.equal(row.pack_count, 1); assert.equal(row.product_format, "powder");
    assert.equal(row.is_default, false); assert.equal(row.is_active, true);
  }
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(products|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
  assert.doesNotMatch(text, /(external_product_id|external_variant_id|external_sku|external_url|https?:\/\/|\bprice\b)/i);
  assert.ok(text.indexOf("semantic duplicate exists") < text.indexOf("insert into public.product_variants"));
  assert.match(text, /v_after_count is distinct from v_before_count\+v_inserted/i);
});

test("real Batch C migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-c-variants-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-c-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = snapshot(container);
    requireSuccess(applyMigration(container), "Batch C clean state");
    const after = snapshot(container);
    assert.deepEqual(targetRows(container), independentInventory);
    for (const [productId, count] of Object.entries(expectedCounts)) assert.equal(expectedInventory.filter((r) => r.product_id === Number(productId)).length, count);
    assert.deepEqual(after.variants.filter((row) => row.is_default), before.variants.filter((row) => row.is_default));
    assert.deepEqual(after.variants.filter((row) => row.product_id === 222 && !row.is_default && row.variant_key !== "vanilla-6800g"), before.variants.filter((row) => row.product_id === 222 && !row.is_default));
    assert.deepEqual(otherTables(after), otherTables(before));
    requireSuccess(applyMigration(container), "Batch C identical rerun");
    assert.deepEqual(snapshot(container), after);

    recreateDatabase(container);
    insertInventory(container, expectedInventory.slice(0, 9));
    requireSuccess(applyMigration(container), "Batch C partial identical completion");
    assert.deepEqual(targetRows(container), independentInventory);

    recreateDatabase(container);
    insertInventory(container, [expectedInventory[0]]);
    sql(container, `update product_variants set display_name='Drifted' where product_id=${expectedInventory[0].product_id} and variant_key=${sqlLiteral(expectedInventory[0].variant_key)}`);
    const drifted = snapshot(container); expectBlocked(container, "drifted expected key"); assert.deepEqual(snapshot(container), drifted);

    recreateDatabase(container);
    sql(container, "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(19,'legacy-blueberry','Legacy Blueberry','blueberry','Blueberry',380,'g',1,'powder',true,false)");
    const semantic = snapshot(container); expectBlocked(container, "semantic collision"); assert.deepEqual(snapshot(container), semantic);

    recreateDatabase(container);
    sql(container, "alter table products drop constraint products_merge_state_consistent; update products set is_active=false where id=296");
    const inactive = snapshot(container); expectBlocked(container, "inactive product"); assert.deepEqual(snapshot(container), inactive);

    recreateDatabase(container);
    sql(container, "delete from product_variants where product_id=296; delete from products where id=296");
    const missing = snapshot(container); expectBlocked(container, "missing product"); assert.deepEqual(snapshot(container), missing);

    recreateDatabase(container);
    sql(container, "delete from product_variants where id=194");
    const noDefault = snapshot(container); expectBlocked(container, "missing default variant"); assert.deepEqual(snapshot(container), noDefault);

    recreateDatabase(container);
    sql(container, "create function reject_batch_c_variant() returns trigger language plpgsql as $$ begin if new.variant_key='vanilla-4000g' then raise exception 'controlled Batch C failure'; end if; return new; end $$; create trigger reject_batch_c_variant before insert on product_variants for each row execute function reject_batch_c_variant()");
    const late = snapshot(container); expectBlocked(container, "late controlled failure"); assert.deepEqual(snapshot(container), late);
    assert.equal(sql(container, `select count(*) from product_variants v join (values ${expectedInventory.map((r) => `(${r.product_id},${sqlLiteral(r.variant_key)})`).join(",")}) e(product_id,variant_key) on e.product_id=v.product_id and e.variant_key=v.variant_key`), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
