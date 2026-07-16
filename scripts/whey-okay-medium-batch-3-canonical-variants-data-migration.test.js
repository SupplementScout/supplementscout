const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260716012000_seed_whey_okay_medium_batch_3_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_whey_okay_medium_batch_3_test";
const productIds = [61,75,125,165,170,172,220,290,294,324,328,339,348,390,404,448,453,510,517];
const defaultPairs = [{"product_id":61,"default_variant_id":132,"product_name":"Stay Lean Engage Natural Pre Workout 300g","brand":"Stay Lean"},{"product_id":75,"default_variant_id":35,"product_name":"Stay Lean BCAA All Day 500g","brand":"Stay Lean"},{"product_id":125,"default_variant_id":125,"product_name":"Reflex Instant Mass Heavyweight 2kg","brand":"Reflex Nutrition"},{"product_id":165,"default_variant_id":172,"product_name":"Lenny & Larry's Complete Vegan Cookie  113g","brand":"Lenny & Larry"},{"product_id":170,"default_variant_id":174,"product_name":"Redcon1 Big Noise Pre-Workout 315g","brand":"Redcon1"},{"product_id":172,"default_variant_id":226,"product_name":"Boditronics Heavyweight 6kg Mass Attack","brand":"Boditronics"},{"product_id":220,"default_variant_id":220,"product_name":"HR Labs Basic 510g","brand":"HR Labs"},{"product_id":290,"default_variant_id":256,"product_name":"BSN Syntha 6 Limited Edition 2.26kg","brand":"BSN"},{"product_id":294,"default_variant_id":246,"product_name":"BioTech USA Black Blood CAF+ 300g","brand":"BioTech USA"},{"product_id":324,"default_variant_id":527,"product_name":"Muscle Moose Protein Pancakes Mix 500g","brand":"Muscle Moose"},{"product_id":328,"default_variant_id":373,"product_name":"Per4m Isolate Zero 900g","brand":"Per4m"},{"product_id":339,"default_variant_id":304,"product_name":"Boditronics Juggernaut Mass Attack 4kg","brand":"Boditronics"},{"product_id":348,"default_variant_id":361,"product_name":"Ghost Greens 330g","brand":"Ghost"},{"product_id":390,"default_variant_id":556,"product_name":"GYM HIGH Vegan Plant-Based-Protein Blend 600g","brand":"GYM HIGH"},{"product_id":404,"default_variant_id":398,"product_name":"ProSupps Mr Hyde Pre Workout 292g","brand":"ProSupps"},{"product_id":448,"default_variant_id":439,"product_name":"Mutant Iso Surge 727g","brand":"Mutant"},{"product_id":453,"default_variant_id":490,"product_name":"KIOR Health Whey+ Probiotics 900g","brand":"KIOR Health"},{"product_id":510,"default_variant_id":603,"product_name":"GYM HIGH Whey Pro Synergy Dynamic 600g","brand":"GYM HIGH"},{"product_id":517,"default_variant_id":487,"product_name":"Mutant Mass (Mass Gainer) 2.27kg","brand":"Mutant"}];
function run(command, args, timeout = 120_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, env: process.env }); }
function combined(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`); assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000); return result.status === 0 && result.stdout.trim().length > 0; }
function exec(container, args, timeout = 120_000) { return run("docker", ["exec", "-e", "PGPASSWORD=medium-batch-3-local-only", container, ...args], timeout); }
function psql(container, args, timeout) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout); }
function sql(container, statement) { const result = psql(container, ["-tAc", statement]); requireSuccess(result, "execute local fixture SQL"); return result.stdout.trim(); }
function applyMigration(container) { return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]); }
function waitForPostgres(container) { let ok = 0; for (let attempt = 0; attempt < 80; attempt += 1) { const ready = exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000); const can = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000); if (ready.status === 0 && can.status === 0 && can.stdout.trim() === "1") { ok += 1; if (ok >= 3) return; } else ok = 0; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL did not become ready"); }
function migrationInventory() { const text = fs.readFileSync(migration, "utf8"); const match = text.match(/\$whey_okay_medium_batch_3_inventory\$\s*(\[[\s\S]*?\])\s*\$whey_okay_medium_batch_3_inventory\$::jsonb/); assert.ok(match, "migration must expose inventory"); return JSON.parse(match[1]); }
const inventory = migrationInventory();
assert.equal(inventory.length, 19);
function lit(v) { if (v === null) return "null"; if (typeof v === "number" || typeof v === "boolean") return String(v); return "'" + String(v).replaceAll("'", "''") + "'"; }
function insertInventory(container, rows) { const values = rows.map(r => `(${lit(r.product_id)},${lit(r.variant_key)},${lit(r.display_name)},${lit(r.flavour_code)},${lit(r.flavour_label)},${lit(r.size_value)},${lit(r.size_unit)},${lit(r.pack_count)},${lit(r.product_format)},null,null,'{}'::jsonb,${lit(r.is_default)},${lit(r.is_active)})`).join(","); sql(container, `insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active) values ${values}`); }
const fixtureSql = `
  insert into public.retailers(id,name,slug,website) values(3,'Whey Okay','whey-okay','https://wheyokay.example');
  insert into public.products(id,name,slug,brand,category,is_active,merged_into_product_id,merged_at) values
    (61,'Stay Lean Engage Natural Pre Workout 300g','stay-lean-engage-natural-pre-workout-300g','Stay Lean','Health Supplements',true,null,null),
    (75,'Stay Lean BCAA All Day 500g','stay-lean-bcaa-all-day-500g','Stay Lean','Health Supplements',true,null,null),
    (125,'Reflex Instant Mass Heavyweight 2kg','reflex-instant-mass-heavyweight-2kg','Reflex Nutrition','Health Supplements',true,null,null),
    (165,'Lenny & Larry''s Complete Vegan Cookie  113g','lenny-larry-s-complete-vegan-cookie-113g','Lenny & Larry','Health Supplements',true,null,null),
    (170,'Redcon1 Big Noise Pre-Workout 315g','redcon1-big-noise-pre-workout-315g','Redcon1','Health Supplements',true,null,null),
    (172,'Boditronics Heavyweight 6kg Mass Attack','boditronics-heavyweight-6kg-mass-attack','Boditronics','Health Supplements',true,null,null),
    (220,'HR Labs Basic 510g','hr-labs-basic-510g','HR Labs','Health Supplements',true,null,null),
    (290,'BSN Syntha 6 Limited Edition 2.26kg','bsn-syntha-6-limited-edition-2-26kg','BSN','Health Supplements',true,null,null),
    (294,'BioTech USA Black Blood CAF+ 300g','biotech-usa-black-blood-caf-300g','BioTech USA','Health Supplements',true,null,null),
    (324,'Muscle Moose Protein Pancakes Mix 500g','muscle-moose-protein-pancakes-mix-500g','Muscle Moose','Health Supplements',true,null,null),
    (328,'Per4m Isolate Zero 900g','per4m-isolate-zero-900g','Per4m','Health Supplements',true,null,null),
    (339,'Boditronics Juggernaut Mass Attack 4kg','boditronics-juggernaut-mass-attack-4kg','Boditronics','Health Supplements',true,null,null),
    (348,'Ghost Greens 330g','ghost-greens-330g','Ghost','Health Supplements',true,null,null),
    (390,'GYM HIGH Vegan Plant-Based-Protein Blend 600g','gym-high-vegan-plant-based-protein-blend-600g','GYM HIGH','Health Supplements',true,null,null),
    (404,'ProSupps Mr Hyde Pre Workout 292g','prosupps-mr-hyde-pre-workout-292g','ProSupps','Health Supplements',true,null,null),
    (448,'Mutant Iso Surge 727g','mutant-iso-surge-727g','Mutant','Health Supplements',true,null,null),
    (453,'KIOR Health Whey+ Probiotics 900g','kior-health-whey-probiotics-900g','KIOR Health','Health Supplements',true,null,null),
    (510,'GYM HIGH Whey Pro Synergy Dynamic 600g','gym-high-whey-pro-synergy-dynamic-600g','GYM HIGH','Health Supplements',true,null,null),
    (517,'Mutant Mass (Mass Gainer) 2.27kg','mutant-mass-mass-gainer-2-27kg','Mutant','Health Supplements',true,null,null);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values
    (132,61,'default','Default',true,true),
    (35,75,'default','Default',true,true),
    (125,125,'default','Default',true,true),
    (172,165,'default','Default',true,true),
    (174,170,'default','Default',true,true),
    (226,172,'default','Default',true,true),
    (220,220,'default','Default',true,true),
    (256,290,'default','Default',true,true),
    (246,294,'default','Default',true,true),
    (527,324,'default','Default',true,true),
    (373,328,'default','Default',true,true),
    (304,339,'default','Default',true,true),
    (361,348,'default','Default',true,true),
    (556,390,'default','Default',true,true),
    (398,404,'default','Default',true,true),
    (439,448,'default','Default',true,true),
    (490,453,'default','Default',true,true),
    (603,510,'default','Default',true,true),
    (487,517,'default','Default',true,true);
  select setval('public.product_variants_id_seq',20000,true);
  insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence) values
    (10001,3,294,246,'BioTech USA Black Blood CAF+ 300g','https://wheyokay.com/biotech-usa-black-blood-caf-300g-1946-p.asp','fixture',100),
    (10002,3,125,125,'Reflex Instant Mass Heavyweight 2kg','https://wheyokay.com/reflex-instant-mass-heavyweight-2kg-696-p.asp','fixture',100),
    (10003,3,61,132,'Stay Lean Engage Natural Pre Workout 300g','https://wheyokay.com/stay-lean-engage-natural-pre-workout-300g-259-p.asp','fixture',100),
    (10004,3,348,361,'Ghost Greens 330g','https://wheyokay.com/ghost-greens-330g-2474-p.asp','fixture',100),
    (10005,3,172,226,'Boditronics Heavyweight 6kg Mass Attack','https://wheyokay.com/boditronics-heavyweight-6kg-mass-attack-1068-p.asp','fixture',100),
    (10006,3,220,220,'HR Labs Basic 510g','https://wheyokay.com/hr-labs-basic-510g-1430-p.asp','fixture',100),
    (10007,3,328,373,'Per4m Isolate Zero 900g','https://wheyokay.com/per4m-isolate-zero-900g-2215-p.asp','fixture',100),
    (10008,3,390,556,'GYM HIGH Vegan Plant-Based-Protein Blend 600g','https://wheyokay.com/gym-high-vegan-plant-based-protein-blend-600g-3072-p.asp','fixture',100),
    (10009,3,290,256,'BSN Syntha 6 Limited Edition 2.26kg','https://wheyokay.com/bsn-syntha-6-limited-edition-226kg-1921-p.asp','fixture',100),
    (10010,3,165,172,'Lenny & Larry''s Complete Vegan Cookie  113g','https://wheyokay.com/lenny--larrys-complete-vegan-cookie--113g-987-p.asp','fixture',100),
    (10011,3,324,527,'Muscle Moose Protein Pancakes Mix 500g','https://wheyokay.com/muscle-moose-protein-pancakes-mix-500g-2177-p.asp','fixture',100),
    (10012,3,170,174,'Redcon1 Big Noise Pre-Workout 315g','https://wheyokay.com/redcon1-big-noise-pre-workout-315g-1054-p.asp','fixture',100),
    (10013,3,517,487,'Mutant Mass (Mass Gainer) 2.27kg','https://wheyokay.com/mutant-mass-mass-gainer-227kg-4062-p.asp','fixture',100),
    (10014,3,453,490,'KIOR Health Whey+ Probiotics 900g','https://wheyokay.com/kior-health-whey-probiotics-900g-3485-p.asp','fixture',100),
    (10015,3,448,439,'Mutant Iso Surge 727g','https://wheyokay.com/mutant-iso-surge-727g-3453-p.asp','fixture',100),
    (10016,3,510,603,'GYM HIGH Whey Pro Synergy Dynamic 600g','https://wheyokay.com/gym-high-whey-pro-synergy-dynamic-600g-3977-p.asp','fixture',100),
    (10017,3,404,398,'ProSupps Mr Hyde Pre Workout 292g','https://wheyokay.com/prosupps-mr-hyde-pre-workout-292g-3148-p.asp','fixture',100),
    (10018,3,339,304,'Boditronics Juggernaut Mass Attack 4kg','https://wheyokay.com/boditronics-juggernaut-mass-attack-4kg-2431-p.asp','fixture',100),
    (10019,3,75,35,'Stay Lean BCAA All Day 500g','https://wheyokay.com/stay-lean-bcaa-all-day-500g-341-p.asp','fixture',100);
  insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url) values
    (11001,294,3,10001,246,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-black-blood-caf-300g-1946-p.asp'),
    (11002,125,3,10002,125,9.99,3.99,null,true,'https://wheyokay.com/reflex-instant-mass-heavyweight-2kg-696-p.asp'),
    (11003,61,3,10003,132,9.99,3.99,null,true,'https://wheyokay.com/stay-lean-engage-natural-pre-workout-300g-259-p.asp'),
    (11004,348,3,10004,361,9.99,3.99,null,true,'https://wheyokay.com/ghost-greens-330g-2474-p.asp'),
    (11005,172,3,10005,226,9.99,3.99,null,true,'https://wheyokay.com/boditronics-heavyweight-6kg-mass-attack-1068-p.asp'),
    (11006,220,3,10006,220,9.99,3.99,null,true,'https://wheyokay.com/hr-labs-basic-510g-1430-p.asp'),
    (11007,328,3,10007,373,9.99,3.99,null,true,'https://wheyokay.com/per4m-isolate-zero-900g-2215-p.asp'),
    (11008,390,3,10008,556,9.99,3.99,null,true,'https://wheyokay.com/gym-high-vegan-plant-based-protein-blend-600g-3072-p.asp'),
    (11009,290,3,10009,256,9.99,3.99,null,true,'https://wheyokay.com/bsn-syntha-6-limited-edition-226kg-1921-p.asp'),
    (11010,165,3,10010,172,9.99,3.99,null,true,'https://wheyokay.com/lenny--larrys-complete-vegan-cookie--113g-987-p.asp'),
    (11011,324,3,10011,527,9.99,3.99,null,true,'https://wheyokay.com/muscle-moose-protein-pancakes-mix-500g-2177-p.asp'),
    (11012,170,3,10012,174,9.99,3.99,null,true,'https://wheyokay.com/redcon1-big-noise-pre-workout-315g-1054-p.asp'),
    (11013,517,3,10013,487,9.99,3.99,null,true,'https://wheyokay.com/mutant-mass-mass-gainer-227kg-4062-p.asp'),
    (11014,453,3,10014,490,9.99,3.99,null,true,'https://wheyokay.com/kior-health-whey-probiotics-900g-3485-p.asp'),
    (11015,448,3,10015,439,9.99,3.99,null,true,'https://wheyokay.com/mutant-iso-surge-727g-3453-p.asp'),
    (11016,510,3,10016,603,9.99,3.99,null,true,'https://wheyokay.com/gym-high-whey-pro-synergy-dynamic-600g-3977-p.asp'),
    (11017,404,3,10017,398,9.99,3.99,null,true,'https://wheyokay.com/prosupps-mr-hyde-pre-workout-292g-3148-p.asp'),
    (11018,339,3,10018,304,9.99,3.99,null,true,'https://wheyokay.com/boditronics-juggernaut-mass-attack-4kg-2431-p.asp'),
    (11019,75,3,10019,35,9.99,3.99,null,true,'https://wheyokay.com/stay-lean-bcaa-all-day-500g-341-p.asp');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price) select 12000+id,id,price,shipping_cost,total_price from public.offers;
  insert into public.outbound_clicks(id,offer_id,product_id,retailer_id,destination_url,source_page) select 13000+id,id,product_id,retailer_id,url,'product_offer_list' from public.offers;
`;
function recreateDatabase(container) { requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop database"); requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create database"); requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create roles"); requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply baseline"); requireSuccess(psql(container, ["-c", fixtureSql]), "create fixture"); }
function counts(container) { return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history),'clicks',(select count(*) from outbound_clicks))")); }
function targetRows(container) { return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object('product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_default',is_default,'is_active',is_active) order by product_id,variant_key) from product_variants where product_id in (${productIds.join(',')}) and not is_default`)); }
function expectBlocked(container, label) { const before = counts(container); const result = applyMigration(container); assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.deepEqual(counts(container), before, `${label} should rollback fully`); }
function expectInventory(container) { const actual = targetRows(container); const expected = [...inventory].sort((a,b)=>a.product_id-b.product_id || a.variant_key.localeCompare(b.variant_key)); assert.deepEqual(actual, expected); }
test("Whey Okay Medium batch 3 canonical variant migration", { timeout: 600_000, skip: dockerAvailable() ? false : "Docker daemon unavailable" }, async () => {
  const container = `whey-okay-medium-batch-3-${Date.now()}`;
  requireSuccess(run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=medium-batch-3-local-only", "-v", `${root.replaceAll("\\", "/")}:/workspace`, image], 120_000), "start postgres");
  try {
    waitForPostgres(container);
    recreateDatabase(container);
    const cleanBefore = counts(container);
    requireSuccess(applyMigration(container), "clean state apply");
    const cleanAfter = counts(container);
    assert.equal(cleanAfter.products, cleanBefore.products);
    assert.equal(cleanAfter.product_variants, cleanBefore.product_variants + 19);
    assert.equal(cleanAfter.retailer_products, cleanBefore.retailer_products);
    assert.equal(cleanAfter.offers, cleanBefore.offers);
    assert.equal(cleanAfter.price_history, cleanBefore.price_history);
    expectInventory(container);
    const rerunBefore = counts(container);
    requireSuccess(applyMigration(container), "identical rerun");
    assert.deepEqual(counts(container), rerunBefore);
    recreateDatabase(container);
    insertInventory(container, inventory.slice(0, 7));
    const partialBefore = counts(container);
    requireSuccess(applyMigration(container), "partial identical state");
    assert.equal(counts(container).product_variants, partialBefore.product_variants + 12);
    expectInventory(container);
    recreateDatabase(container); insertInventory(container, [{ ...inventory[0], display_name: "Drifted / 2kg" }]); expectBlocked(container, "variant-key drift");
    recreateDatabase(container); insertInventory(container, [{ ...inventory[1], variant_key: inventory[1].variant_key + "-duplicate" }]); expectBlocked(container, "semantic collision");
    recreateDatabase(container); sql(container, `delete from outbound_clicks where offer_id=11001; delete from price_history where offer_id=11001; delete from offers where retailer_product_id=10001; delete from retailer_products where id=10001; delete from product_variants where product_id=${inventory[0].product_id}; delete from products where id=${inventory[0].product_id}`); expectBlocked(container, "missing parent");
    recreateDatabase(container); sql(container, `update products set merged_into_product_id=${inventory[3].product_id},merged_at=now(),is_active=false where id=${inventory[2].product_id}`); expectBlocked(container, "inactive merged parent");
    recreateDatabase(container); sql(container, `update product_variants set is_active=false where id=${defaultPairs[3].default_variant_id}`); expectBlocked(container, "stale default relation");
    recreateDatabase(container); sql(container, `create function public.block_late_medium_batch_3_insert() returns trigger language plpgsql as $$ begin if new.variant_key = '${inventory.at(-1).variant_key}' then raise exception 'late fixture failure'; end if; return new; end $$; create trigger block_late_medium_batch_3_insert before insert on product_variants for each row execute function public.block_late_medium_batch_3_insert();`); expectBlocked(container, "late failure atomic rollback");
  } finally { run("docker", ["rm", "-f", container], 30_000); }
});
