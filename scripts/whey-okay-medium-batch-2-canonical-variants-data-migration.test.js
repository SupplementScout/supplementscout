const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260716011000_seed_whey_okay_medium_batch_2_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_whey_okay_medium_batch_2_test";
const productIds = [26,31,49,55,59,62,63,67,70,74,128,132,253,286,291,295,336,361,367,368,403,411,423,450,457];
const defaultPairs = [{"product_id":26,"default_variant_id":16,"product_name":"PEScience High Volume 252g","brand":"PEScience"},{"product_id":31,"default_variant_id":42,"product_name":"Per4m Vegan Protein 908g","brand":"Per4m"},{"product_id":49,"default_variant_id":113,"product_name":"Ghost Pump Nitric Oxide 350g","brand":"Ghost"},{"product_id":55,"default_variant_id":93,"product_name":"BioTech USA Nitrox Therapy 340g","brand":"BioTech USA"},{"product_id":59,"default_variant_id":94,"product_name":"5% Nutrition Rich Piana 5150 375g","brand":"5% Nutrition"},{"product_id":62,"default_variant_id":72,"product_name":"HR Labs Defib Pre-Workout 460g","brand":"HR Labs"},{"product_id":63,"default_variant_id":96,"product_name":"Muscletech Vapor X5 Next Gen 264g","brand":"MuscleTech"},{"product_id":67,"default_variant_id":33,"product_name":"BioTech USA Micellar Casein 908g","brand":"BioTech USA"},{"product_id":70,"default_variant_id":19,"product_name":"Optimum Nutrition 100% Plant Protein 684g","brand":"Optimum Nutrition"},{"product_id":74,"default_variant_id":20,"product_name":"BSN AminoX 435g","brand":"BSN"},{"product_id":128,"default_variant_id":108,"product_name":"7Nutrition Bodybuilder 1.5kg","brand":"7Nutrition"},{"product_id":132,"default_variant_id":109,"product_name":"Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg","brand":"Applied Nutrition"},{"product_id":253,"default_variant_id":229,"product_name":"Optimum Nutrition Gold Standard BCAA Train Sustain 266g","brand":"Optimum Nutrition"},{"product_id":286,"default_variant_id":255,"product_name":"Love Vegan High Energy Protein Bite 45g","brand":"Love Vegan"},{"product_id":291,"default_variant_id":280,"product_name":"Reflex Muscle Bomb Pre-Workout 600g","brand":"Reflex Nutrition"},{"product_id":295,"default_variant_id":135,"product_name":"BioTech USA Black Blood NOX+ 330g","brand":"BioTech USA"},{"product_id":336,"default_variant_id":375,"product_name":"HR Labs Defib V3 480g","brand":"HR Labs"},{"product_id":361,"default_variant_id":326,"product_name":"Trec CM3 Creatine Powder 250g","brand":"Trec Nutrition"},{"product_id":367,"default_variant_id":317,"product_name":"GYM HIGH The Stacker 240g","brand":"GYM HIGH"},{"product_id":368,"default_variant_id":358,"product_name":"Kaged Muscle Pre-Kaged Sport 266g","brand":"Kaged Muscle"},{"product_id":403,"default_variant_id":383,"product_name":"GYM HIGH Mass Gainer 2100g","brand":"GYM HIGH"},{"product_id":411,"default_variant_id":381,"product_name":"GYM HIGH The Stinger Zero Caffeine Pump Pre Workout 425g","brand":"GYM HIGH"},{"product_id":423,"default_variant_id":378,"product_name":"Applied Nutrition Cream Of Rice 2kg","brand":"Applied Nutrition"},{"product_id":450,"default_variant_id":456,"product_name":"Trec Vitargo Electro Energy 1050g","brand":"Trec Nutrition"},{"product_id":457,"default_variant_id":491,"product_name":"Reflex Nutrition Clear Whey Isolate 510g 17 Servings","brand":"Reflex Nutrition"}];
function run(command, args, timeout = 120_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, env: process.env }); }
function combined(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`); assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000); return result.status === 0 && result.stdout.trim().length > 0; }
function exec(container, args, timeout = 120_000) { return run("docker", ["exec", "-e", "PGPASSWORD=medium-batch-2-local-only", container, ...args], timeout); }
function psql(container, args, timeout) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout); }
function sql(container, statement) { const result = psql(container, ["-tAc", statement]); requireSuccess(result, "execute local fixture SQL"); return result.stdout.trim(); }
function applyMigration(container) { return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]); }
function waitForPostgres(container) { let ok = 0; for (let attempt = 0; attempt < 80; attempt += 1) { const ready = exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000); const can = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000); if (ready.status === 0 && can.status === 0 && can.stdout.trim() === "1") { ok += 1; if (ok >= 3) return; } else ok = 0; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL did not become ready"); }
function migrationInventory() { const text = fs.readFileSync(migration, "utf8"); const match = text.match(/\$whey_okay_medium_batch_2_inventory\$\s*(\[[\s\S]*?\])\s*\$whey_okay_medium_batch_2_inventory\$::jsonb/); assert.ok(match, "migration must expose inventory"); return JSON.parse(match[1]); }
const inventory = migrationInventory();
assert.equal(inventory.length, 25);
function lit(v) { if (v === null) return "null"; if (typeof v === "number" || typeof v === "boolean") return String(v); return "'" + String(v).replaceAll("'", "''") + "'"; }
function insertInventory(container, rows) { const values = rows.map(r => `(${lit(r.product_id)},${lit(r.variant_key)},${lit(r.display_name)},${lit(r.flavour_code)},${lit(r.flavour_label)},${lit(r.size_value)},${lit(r.size_unit)},${lit(r.pack_count)},${lit(r.product_format)},null,null,'{}'::jsonb,${lit(r.is_default)},${lit(r.is_active)})`).join(","); sql(container, `insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active) values ${values}`); }
const fixtureSql = `
  insert into public.retailers(id,name,slug,website) values(3,'Whey Okay','whey-okay','https://wheyokay.example');
  insert into public.products(id,name,slug,brand,category,is_active,merged_into_product_id,merged_at) values
    (26,'PEScience High Volume 252g','pescience-high-volume-252g','PEScience','Health Supplements',true,null,null),
    (31,'Per4m Vegan Protein 908g','per4m-vegan-protein-908g','Per4m','Health Supplements',true,null,null),
    (49,'Ghost Pump Nitric Oxide 350g','ghost-pump-nitric-oxide-350g','Ghost','Health Supplements',true,null,null),
    (55,'BioTech USA Nitrox Therapy 340g','biotech-usa-nitrox-therapy-340g','BioTech USA','Health Supplements',true,null,null),
    (59,'5% Nutrition Rich Piana 5150 375g','5-nutrition-rich-piana-5150-375g','5% Nutrition','Health Supplements',true,null,null),
    (62,'HR Labs Defib Pre-Workout 460g','hr-labs-defib-pre-workout-460g','HR Labs','Health Supplements',true,null,null),
    (63,'Muscletech Vapor X5 Next Gen 264g','muscletech-vapor-x5-next-gen-264g','MuscleTech','Health Supplements',true,null,null),
    (67,'BioTech USA Micellar Casein 908g','biotech-usa-micellar-casein-908g','BioTech USA','Health Supplements',true,null,null),
    (70,'Optimum Nutrition 100% Plant Protein 684g','optimum-nutrition-100-plant-protein-684g','Optimum Nutrition','Health Supplements',true,null,null),
    (74,'BSN AminoX 435g','bsn-aminox-435g','BSN','Health Supplements',true,null,null),
    (128,'7Nutrition Bodybuilder 1.5kg','7nutrition-bodybuilder-1-5kg','7Nutrition','Health Supplements',true,null,null),
    (132,'Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg','applied-nutrition-critical-mass-lean-mass-gainz-2-4kg','Applied Nutrition','Health Supplements',true,null,null),
    (253,'Optimum Nutrition Gold Standard BCAA Train Sustain 266g','optimum-nutrition-gold-standard-bcaa-train-sustain-266g','Optimum Nutrition','Health Supplements',true,null,null),
    (286,'Love Vegan High Energy Protein Bite 45g','love-vegan-high-energy-protein-bite-45g','Love Vegan','Health Supplements',true,null,null),
    (291,'Reflex Muscle Bomb Pre-Workout 600g','reflex-muscle-bomb-pre-workout-600g','Reflex Nutrition','Health Supplements',true,null,null),
    (295,'BioTech USA Black Blood NOX+ 330g','biotech-usa-black-blood-nox-330g','BioTech USA','Health Supplements',true,null,null),
    (336,'HR Labs Defib V3 480g','hr-labs-defib-v3-480g','HR Labs','Health Supplements',true,null,null),
    (361,'Trec CM3 Creatine Powder 250g','trec-cm3-creatine-powder-250g','Trec Nutrition','Health Supplements',true,null,null),
    (367,'GYM HIGH The Stacker 240g','gym-high-the-stacker-240g','GYM HIGH','Health Supplements',true,null,null),
    (368,'Kaged Muscle Pre-Kaged Sport 266g','kaged-muscle-pre-kaged-sport-266g','Kaged Muscle','Health Supplements',true,null,null),
    (403,'GYM HIGH Mass Gainer 2100g','gym-high-mass-gainer-2100g','GYM HIGH','Health Supplements',true,null,null),
    (411,'GYM HIGH The Stinger Zero Caffeine Pump Pre Workout 425g','gym-high-the-stinger-zero-caffeine-pump-pre-workout-425g','GYM HIGH','Health Supplements',true,null,null),
    (423,'Applied Nutrition Cream Of Rice 2kg','applied-nutrition-cream-of-rice-2kg','Applied Nutrition','Health Supplements',true,null,null),
    (450,'Trec Vitargo Electro Energy 1050g','trec-vitargo-electro-energy-1050g','Trec Nutrition','Health Supplements',true,null,null),
    (457,'Reflex Nutrition Clear Whey Isolate 510g 17 Servings','reflex-nutrition-clear-whey-isolate-510g-17-servings','Reflex Nutrition','Health Supplements',true,null,null);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values
    (16,26,'default','Default',true,true),
    (42,31,'default','Default',true,true),
    (113,49,'default','Default',true,true),
    (93,55,'default','Default',true,true),
    (94,59,'default','Default',true,true),
    (72,62,'default','Default',true,true),
    (96,63,'default','Default',true,true),
    (33,67,'default','Default',true,true),
    (19,70,'default','Default',true,true),
    (20,74,'default','Default',true,true),
    (108,128,'default','Default',true,true),
    (109,132,'default','Default',true,true),
    (229,253,'default','Default',true,true),
    (255,286,'default','Default',true,true),
    (280,291,'default','Default',true,true),
    (135,295,'default','Default',true,true),
    (375,336,'default','Default',true,true),
    (326,361,'default','Default',true,true),
    (317,367,'default','Default',true,true),
    (358,368,'default','Default',true,true),
    (383,403,'default','Default',true,true),
    (381,411,'default','Default',true,true),
    (378,423,'default','Default',true,true),
    (456,450,'default','Default',true,true),
    (491,457,'default','Default',true,true);
  select setval('public.product_variants_id_seq',20000,true);
  insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence) values
    (10001,3,49,113,'Ghost Pump Nitric Oxide 350g','https://wheyokay.com/ghost-pump-nitric-oxide-350g-216-p.asp','fixture',100),
    (10002,3,62,72,'HR Labs Defib Pre-Workout 460g','https://wheyokay.com/hr-labs-defib-pre-workout-460g-262-p.asp','fixture',100),
    (10003,3,59,94,'5% Nutrition Rich Piana 5150 375g','https://wheyokay.com/5-nutrition-rich-piana-5150-375g-249-p.asp','fixture',100),
    (10004,3,63,96,'Muscletech Vapor X5 Next Gen 264g','https://wheyokay.com/muscletech-vapor-x5-next-gen-264g-267-p.asp','fixture',100),
    (10005,3,128,108,'7Nutrition Bodybuilder 1.5kg','https://wheyokay.com/7nutrition-bodybuilder-15kg-714-p.asp','fixture',100),
    (10006,3,291,280,'Reflex Muscle Bomb Pre-Workout 600g','https://wheyokay.com/reflex-muscle-bomb-pre-workout-600g-1927-p.asp','fixture',100),
    (10007,3,411,381,'GYM HIGH The Stinger Zero Caffeine Pump Pre Workout 425g','https://wheyokay.com/gym-high-the-stinger-zero-caffeine-pump-pre-workout-425g-3253-p.asp','fixture',100),
    (10008,3,403,383,'GYM HIGH Mass Gainer 2100g','https://wheyokay.com/gym-high-mass-gainer-2100g-3141-p.asp','fixture',100),
    (10009,3,361,326,'Trec CM3 Creatine Powder 250g','https://wheyokay.com/trec-cm3-creatine-powder-250g-2596-p.asp','fixture',100),
    (10010,3,457,491,'Reflex Nutrition Clear Whey Isolate 510g 17 Servings','https://wheyokay.com/reflex-nutrition-clear-whey-isolate-510g-17-servings-3552-p.asp','fixture',100),
    (10011,3,132,109,'Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg','https://wheyokay.com/applied-nutrition-critical-mass-lean-mass-gainz-24kg-731-p.asp','fixture',100),
    (10012,3,67,33,'BioTech USA Micellar Casein 908g','https://wheyokay.com/biotech-usa-micellar-casein-908g-289-p.asp','fixture',100),
    (10013,3,423,378,'Applied Nutrition Cream Of Rice 2kg','https://wheyokay.com/applied-nutrition-cream-of-rice-2kg-3316-p.asp','fixture',100),
    (10014,3,31,42,'Per4m Vegan Protein 908g','https://wheyokay.com/per4m-vegan-protein-908g-146-p.asp','fixture',100),
    (10015,3,74,20,'BSN AminoX 435g','https://wheyokay.com/bsn-aminox-435g-333-p.asp','fixture',100),
    (10016,3,295,135,'BioTech USA Black Blood NOX+ 330g','https://wheyokay.com/biotech-usa-black-blood-nox-330g-1952-p.asp','fixture',100),
    (10017,3,368,358,'Kaged Muscle Pre-Kaged Sport 266g','https://wheyokay.com/kaged-muscle-pre-kaged-sport-266g-2642-p.asp','fixture',100),
    (10018,3,55,93,'BioTech USA Nitrox Therapy 340g','https://wheyokay.com/biotech-usa-nitrox-therapy-340g-233-p.asp','fixture',100),
    (10019,3,286,255,'Love Vegan High Energy Protein Bite 45g','https://wheyokay.com/love-vegan-high-energy-protein-bite-45g-1896-p.asp','fixture',100),
    (10020,3,367,317,'GYM HIGH The Stacker 240g','https://wheyokay.com/gym-high-the-stacker-240g-2629-p.asp','fixture',100),
    (10021,3,26,16,'PEScience High Volume 252g','https://wheyokay.com/pescience-high-volume-252g-101-p.asp','fixture',100),
    (10022,3,70,19,'Optimum Nutrition 100% Plant Protein 684g','https://wheyokay.com/optimum-nutrition-100-plant-protein-684g-308-p.asp','fixture',100),
    (10023,3,450,456,'Trec Vitargo Electro Energy 1050g','https://wheyokay.com/trec-vitargo-electro-energy-1050g-3472-p.asp','fixture',100),
    (10024,3,253,229,'Optimum Nutrition Gold Standard BCAA Train Sustain 266g','https://wheyokay.com/optimum-nutrition-gold-standard-bcaa-train-sustain-266g-1649-p.asp','fixture',100),
    (10025,3,336,375,'HR Labs Defib V3 480g','https://wheyokay.com/hr-labs-defib-v3-480g-2392-p.asp','fixture',100);
  insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url) values
    (11001,49,3,10001,113,9.99,3.99,null,true,'https://wheyokay.com/ghost-pump-nitric-oxide-350g-216-p.asp'),
    (11002,62,3,10002,72,9.99,3.99,null,true,'https://wheyokay.com/hr-labs-defib-pre-workout-460g-262-p.asp'),
    (11003,59,3,10003,94,9.99,3.99,null,true,'https://wheyokay.com/5-nutrition-rich-piana-5150-375g-249-p.asp'),
    (11004,63,3,10004,96,9.99,3.99,null,true,'https://wheyokay.com/muscletech-vapor-x5-next-gen-264g-267-p.asp'),
    (11005,128,3,10005,108,9.99,3.99,null,true,'https://wheyokay.com/7nutrition-bodybuilder-15kg-714-p.asp'),
    (11006,291,3,10006,280,9.99,3.99,null,true,'https://wheyokay.com/reflex-muscle-bomb-pre-workout-600g-1927-p.asp'),
    (11007,411,3,10007,381,9.99,3.99,null,true,'https://wheyokay.com/gym-high-the-stinger-zero-caffeine-pump-pre-workout-425g-3253-p.asp'),
    (11008,403,3,10008,383,9.99,3.99,null,true,'https://wheyokay.com/gym-high-mass-gainer-2100g-3141-p.asp'),
    (11009,361,3,10009,326,9.99,3.99,null,true,'https://wheyokay.com/trec-cm3-creatine-powder-250g-2596-p.asp'),
    (11010,457,3,10010,491,9.99,3.99,null,true,'https://wheyokay.com/reflex-nutrition-clear-whey-isolate-510g-17-servings-3552-p.asp'),
    (11011,132,3,10011,109,9.99,3.99,null,true,'https://wheyokay.com/applied-nutrition-critical-mass-lean-mass-gainz-24kg-731-p.asp'),
    (11012,67,3,10012,33,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-micellar-casein-908g-289-p.asp'),
    (11013,423,3,10013,378,9.99,3.99,null,true,'https://wheyokay.com/applied-nutrition-cream-of-rice-2kg-3316-p.asp'),
    (11014,31,3,10014,42,9.99,3.99,null,true,'https://wheyokay.com/per4m-vegan-protein-908g-146-p.asp'),
    (11015,74,3,10015,20,9.99,3.99,null,true,'https://wheyokay.com/bsn-aminox-435g-333-p.asp'),
    (11016,295,3,10016,135,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-black-blood-nox-330g-1952-p.asp'),
    (11017,368,3,10017,358,9.99,3.99,null,true,'https://wheyokay.com/kaged-muscle-pre-kaged-sport-266g-2642-p.asp'),
    (11018,55,3,10018,93,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-nitrox-therapy-340g-233-p.asp'),
    (11019,286,3,10019,255,9.99,3.99,null,true,'https://wheyokay.com/love-vegan-high-energy-protein-bite-45g-1896-p.asp'),
    (11020,367,3,10020,317,9.99,3.99,null,true,'https://wheyokay.com/gym-high-the-stacker-240g-2629-p.asp'),
    (11021,26,3,10021,16,9.99,3.99,null,true,'https://wheyokay.com/pescience-high-volume-252g-101-p.asp'),
    (11022,70,3,10022,19,9.99,3.99,null,true,'https://wheyokay.com/optimum-nutrition-100-plant-protein-684g-308-p.asp'),
    (11023,450,3,10023,456,9.99,3.99,null,true,'https://wheyokay.com/trec-vitargo-electro-energy-1050g-3472-p.asp'),
    (11024,253,3,10024,229,9.99,3.99,null,true,'https://wheyokay.com/optimum-nutrition-gold-standard-bcaa-train-sustain-266g-1649-p.asp'),
    (11025,336,3,10025,375,9.99,3.99,null,true,'https://wheyokay.com/hr-labs-defib-v3-480g-2392-p.asp');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price) select 12000+id,id,price,shipping_cost,total_price from public.offers;
  insert into public.outbound_clicks(id,offer_id,product_id,retailer_id,destination_url,source_page) select 13000+id,id,product_id,retailer_id,url,'product_offer_list' from public.offers;
`;
function recreateDatabase(container) { requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop database"); requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create database"); requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create roles"); requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply baseline"); requireSuccess(psql(container, ["-c", fixtureSql]), "create fixture"); }
function counts(container) { return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history),'clicks',(select count(*) from outbound_clicks))")); }
function targetRows(container) { return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object('product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_default',is_default,'is_active',is_active) order by product_id,variant_key) from product_variants where product_id in (${productIds.join(',')}) and not is_default`)); }
function expectBlocked(container, label) { const before = counts(container); const result = applyMigration(container); assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.deepEqual(counts(container), before, `${label} should rollback fully`); }
function expectInventory(container) { const actual = targetRows(container); const expected = [...inventory].sort((a,b)=>a.product_id-b.product_id || a.variant_key.localeCompare(b.variant_key)); assert.deepEqual(actual, expected); }
test("Whey Okay Medium batch 2 canonical variant migration", { timeout: 600_000, skip: dockerAvailable() ? false : "Docker daemon unavailable" }, async () => {
  const container = `whey-okay-medium-batch-2-${Date.now()}`;
  requireSuccess(run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=medium-batch-2-local-only", "-v", `${root.replaceAll("\\", "/")}:/workspace`, image], 120_000), "start postgres");
  try {
    waitForPostgres(container);
    recreateDatabase(container);
    const cleanBefore = counts(container);
    requireSuccess(applyMigration(container), "clean state apply");
    const cleanAfter = counts(container);
    assert.equal(cleanAfter.products, cleanBefore.products);
    assert.equal(cleanAfter.product_variants, cleanBefore.product_variants + 25);
    assert.equal(cleanAfter.retailer_products, cleanBefore.retailer_products);
    assert.equal(cleanAfter.offers, cleanBefore.offers);
    assert.equal(cleanAfter.price_history, cleanBefore.price_history);
    assert.equal(Number(sql(container, `select count(*) from product_variants v join (values ${defaultPairs.map(p=>`(${p.product_id},${p.default_variant_id})`).join(",")}) expected(product_id,variant_id) on v.product_id=expected.product_id and v.id=expected.variant_id where v.variant_key='default' and v.is_default and v.is_active`)), 25);
    expectInventory(container);
    const rerunBefore = counts(container);
    requireSuccess(applyMigration(container), "identical rerun");
    assert.deepEqual(counts(container), rerunBefore);
    recreateDatabase(container);
    insertInventory(container, inventory.slice(0, 7));
    const partialBefore = counts(container);
    requireSuccess(applyMigration(container), "partial identical state");
    assert.equal(counts(container).product_variants, partialBefore.product_variants + 18);
    expectInventory(container);
    recreateDatabase(container); insertInventory(container, [{ ...inventory[0], display_name: "Drifted / 2kg" }]); expectBlocked(container, "variant-key drift");
    recreateDatabase(container); insertInventory(container, [{ ...inventory[1], variant_key: inventory[1].variant_key + "-duplicate" }]); expectBlocked(container, "semantic collision");
    recreateDatabase(container); sql(container, `delete from outbound_clicks where offer_id=11001; delete from price_history where offer_id=11001; delete from offers where retailer_product_id=10001; delete from retailer_products where id=10001; delete from product_variants where product_id=${inventory[0].product_id}; delete from products where id=${inventory[0].product_id}`); expectBlocked(container, "missing parent");
    recreateDatabase(container); sql(container, `update products set merged_into_product_id=${inventory[3].product_id},merged_at=now(),is_active=false where id=${inventory[2].product_id}`); expectBlocked(container, "inactive merged parent");
    recreateDatabase(container); sql(container, `update product_variants set is_active=false where id=${defaultPairs[3].default_variant_id}`); expectBlocked(container, "stale default relation");
    recreateDatabase(container); sql(container, `create function public.block_late_medium_batch_2_insert() returns trigger language plpgsql as $$ begin if new.variant_key = '${inventory.at(-1).variant_key}' then raise exception 'late fixture failure'; end if; return new; end $$; create trigger block_late_medium_batch_2_insert before insert on product_variants for each row execute function public.block_late_medium_batch_2_insert();`); expectBlocked(container, "late failure atomic rollback");
  } finally { run("docker", ["rm", "-f", container], 30_000); }
});
