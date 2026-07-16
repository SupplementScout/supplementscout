const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260716010000_seed_whey_okay_medium_batch_1_canonical_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_whey_okay_medium_batch_1_test";
const productIds = [6,11,12,24,44,56,58,71,77,85,93,112,164,166,169,215,232,233,271,338,449,482,489,495,520];
const defaultPairs = [{"product_id":6,"default_variant_id":8,"product_name":"Ghost Legend V4 Pre-Workout 660g","brand":"Ghost"},{"product_id":11,"default_variant_id":14,"product_name":"USN Blue Lab 100% Whey Premium Protein 2kg","brand":"USN"},{"product_id":12,"default_variant_id":15,"product_name":"Per4m Whey Protein 2kg","brand":"Per4m"},{"product_id":24,"default_variant_id":152,"product_name":"PEScience Prolific 280g","brand":"PEScience"},{"product_id":44,"default_variant_id":47,"product_name":"PEScience Amino IV 375g","brand":"PEScience"},{"product_id":56,"default_variant_id":102,"product_name":"Warrior Rage Unleash Hell Pre Workout 392g","brand":"Warrior"},{"product_id":58,"default_variant_id":60,"product_name":"5 Nutrition Rich Piana  Full As F*ck 387g","brand":"5% Nutrition"},{"product_id":71,"default_variant_id":34,"product_name":"BioTech USA Vegan Protein 500g","brand":"BioTech USA"},{"product_id":77,"default_variant_id":66,"product_name":"Boditronics Diet Whey 900g","brand":"Boditronics"},{"product_id":85,"default_variant_id":68,"product_name":"5% Nutrition Rich Piana CreaTen 240g","brand":"5% Nutrition"},{"product_id":93,"default_variant_id":70,"product_name":"JNX Sports The Ripper Fat Burner Powder 150g","brand":"JNX Sports"},{"product_id":112,"default_variant_id":105,"product_name":"5% Nutrition Rich Piana  All Day You May 465g","brand":"5% Nutrition"},{"product_id":164,"default_variant_id":519,"product_name":"BSN Syntha-6 Edge 1.87kg","brand":"BSN"},{"product_id":166,"default_variant_id":191,"product_name":"Clif Bar Energy Bar 12x68g","brand":"Clif"},{"product_id":169,"default_variant_id":156,"product_name":"Redcon1 Total War 400g","brand":"Redcon1"},{"product_id":215,"default_variant_id":134,"product_name":"Applied Nutrition ABE Ultimate Pre-Workout 315g","brand":"Applied Nutrition"},{"product_id":232,"default_variant_id":223,"product_name":"Ghost Vegan Protein 989g","brand":"Ghost"},{"product_id":233,"default_variant_id":170,"product_name":"Ghost 100% Whey Protein 907g","brand":"Ghost"},{"product_id":271,"default_variant_id":271,"product_name":"Grenade Carb Killa Protein Bar 60g","brand":"Grenade"},{"product_id":338,"default_variant_id":340,"product_name":"Applied Nutrition Clear Whey Protein 875g","brand":"Applied Nutrition"},{"product_id":449,"default_variant_id":551,"product_name":"USN QHUSH Black Pre-workout 220g","brand":"Unknown"},{"product_id":482,"default_variant_id":441,"product_name":"JNX Sports The Curse 250g","brand":"JNX Sports"},{"product_id":489,"default_variant_id":489,"product_name":"Mutant Madness Pre Workout 225g","brand":"Mutant"},{"product_id":495,"default_variant_id":569,"product_name":"GYM HIGH Cream Of Rice 2kg","brand":"GYM HIGH"},{"product_id":520,"default_variant_id":426,"product_name":"Olimp Redweiler Preworkout 480g","brand":"Olimp"}];
function run(command, args, timeout = 120_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, env: process.env }); }
function combined(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`); assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000); return result.status === 0 && result.stdout.trim().length > 0; }
function exec(container, args, timeout = 120_000) { return run("docker", ["exec", "-e", "PGPASSWORD=medium-batch-1-local-only", container, ...args], timeout); }
function psql(container, args, timeout) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout); }
function sql(container, statement) { const result = psql(container, ["-tAc", statement]); requireSuccess(result, "execute local fixture SQL"); return result.stdout.trim(); }
function applyMigration(container) { return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]); }
function waitForPostgres(container) { let ok = 0; for (let attempt = 0; attempt < 80; attempt += 1) { const ready = exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000); const can = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000); if (ready.status === 0 && can.status === 0 && can.stdout.trim() === "1") { ok += 1; if (ok >= 3) return; } else ok = 0; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } assert.fail("PostgreSQL did not become ready"); }
function migrationInventory() { const text = fs.readFileSync(migration, "utf8"); const match = text.match(/\$whey_okay_medium_batch_1_inventory\$\s*(\[[\s\S]*?\])\s*\$whey_okay_medium_batch_1_inventory\$::jsonb/); assert.ok(match, "migration must expose inventory"); return JSON.parse(match[1]); }
const inventory = migrationInventory();
assert.equal(inventory.length, 25);
function lit(v) { if (v === null) return "null"; if (typeof v === "number" || typeof v === "boolean") return String(v); return "'" + String(v).replaceAll("'", "''") + "'"; }
function insertInventory(container, rows) { const values = rows.map(r => `(${lit(r.product_id)},${lit(r.variant_key)},${lit(r.display_name)},${lit(r.flavour_code)},${lit(r.flavour_label)},${lit(r.size_value)},${lit(r.size_unit)},${lit(r.pack_count)},${lit(r.product_format)},null,null,'{}'::jsonb,${lit(r.is_default)},${lit(r.is_active)})`).join(","); sql(container, `insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active) values ${values}`); }
const fixtureSql = `
  insert into public.retailers(id,name,slug,website) values(3,'Whey Okay','whey-okay','https://wheyokay.example');
  insert into public.products(id,name,slug,brand,category,is_active,merged_into_product_id,merged_at) values
    (6,'Ghost Legend V4 Pre-Workout 660g','ghost-legend-v4-pre-workout-660g','Ghost','Health Supplements',true,null,null),
    (11,'USN Blue Lab 100% Whey Premium Protein 2kg','usn-blue-lab-100-whey-premium-protein-2kg','USN','Health Supplements',true,null,null),
    (12,'Per4m Whey Protein 2kg','per4m-whey-protein-2kg','Per4m','Health Supplements',true,null,null),
    (24,'PEScience Prolific 280g','pescience-prolific-280g','PEScience','Health Supplements',true,null,null),
    (44,'PEScience Amino IV 375g','pescience-amino-iv-375g','PEScience','Health Supplements',true,null,null),
    (56,'Warrior Rage Unleash Hell Pre Workout 392g','warrior-rage-unleash-hell-pre-workout-392g','Warrior','Health Supplements',true,null,null),
    (58,'5 Nutrition Rich Piana  Full As F*ck 387g','5-nutrition-rich-piana-full-as-f-ck-387g','5% Nutrition','Health Supplements',true,null,null),
    (71,'BioTech USA Vegan Protein 500g','biotech-usa-vegan-protein-500g','BioTech USA','Health Supplements',true,null,null),
    (77,'Boditronics Diet Whey 900g','boditronics-diet-whey-900g','Boditronics','Health Supplements',true,null,null),
    (85,'5% Nutrition Rich Piana CreaTen 240g','5-nutrition-rich-piana-createn-240g','5% Nutrition','Health Supplements',true,null,null),
    (93,'JNX Sports The Ripper Fat Burner Powder 150g','jnx-sports-the-ripper-fat-burner-powder-150g','JNX Sports','Health Supplements',true,null,null),
    (112,'5% Nutrition Rich Piana  All Day You May 465g','5-nutrition-rich-piana-all-day-you-may-465g','5% Nutrition','Health Supplements',true,null,null),
    (164,'BSN Syntha-6 Edge 1.87kg','bsn-syntha-6-edge-1-87kg','BSN','Health Supplements',true,null,null),
    (166,'Clif Bar Energy Bar 12x68g','clif-bar-energy-bar-12x68g','Clif','Health Supplements',true,null,null),
    (169,'Redcon1 Total War 400g','redcon1-total-war-400g','Redcon1','Health Supplements',true,null,null),
    (215,'Applied Nutrition ABE Ultimate Pre-Workout 315g','applied-nutrition-abe-ultimate-pre-workout-315g','Applied Nutrition','Health Supplements',true,null,null),
    (232,'Ghost Vegan Protein 989g','ghost-vegan-protein-989g','Ghost','Health Supplements',true,null,null),
    (233,'Ghost 100% Whey Protein 907g','ghost-100-whey-protein-907g','Ghost','Health Supplements',true,null,null),
    (271,'Grenade Carb Killa Protein Bar 60g','grenade-carb-killa-protein-bar-60g','Grenade','Health Supplements',true,null,null),
    (338,'Applied Nutrition Clear Whey Protein 875g','applied-nutrition-clear-whey-protein-875g','Applied Nutrition','Health Supplements',true,null,null),
    (449,'USN QHUSH Black Pre-workout 220g','usn-qhush-black-pre-workout-220g','Unknown','Health Supplements',true,null,null),
    (482,'JNX Sports The Curse 250g','jnx-sports-the-curse-250g','JNX Sports','Health Supplements',true,null,null),
    (489,'Mutant Madness Pre Workout 225g','mutant-madness-pre-workout-225g','Mutant','Health Supplements',true,null,null),
    (495,'GYM HIGH Cream Of Rice 2kg','gym-high-cream-of-rice-2kg','GYM HIGH','Health Supplements',true,null,null),
    (520,'Olimp Redweiler Preworkout 480g','olimp-redweiler-preworkout-480g','Olimp','Health Supplements',true,null,null);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values
    (8,6,'default','Default',true,true),
    (14,11,'default','Default',true,true),
    (15,12,'default','Default',true,true),
    (152,24,'default','Default',true,true),
    (47,44,'default','Default',true,true),
    (102,56,'default','Default',true,true),
    (60,58,'default','Default',true,true),
    (34,71,'default','Default',true,true),
    (66,77,'default','Default',true,true),
    (68,85,'default','Default',true,true),
    (70,93,'default','Default',true,true),
    (105,112,'default','Default',true,true),
    (519,164,'default','Default',true,true),
    (191,166,'default','Default',true,true),
    (156,169,'default','Default',true,true),
    (134,215,'default','Default',true,true),
    (223,232,'default','Default',true,true),
    (170,233,'default','Default',true,true),
    (271,271,'default','Default',true,true),
    (340,338,'default','Default',true,true),
    (551,449,'default','Default',true,true),
    (441,482,'default','Default',true,true),
    (489,489,'default','Default',true,true),
    (569,495,'default','Default',true,true),
    (426,520,'default','Default',true,true);
  select setval('public.product_variants_id_seq',20000,true);
  insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence) values
    (10001,3,12,15,'Per4m Whey Protein 2kg','https://wheyokay.com/per4m-whey-protein-2kg-24-p.asp','fixture',100),
    (10002,3,11,14,'USN Blue Lab 100% Whey Premium Protein 2kg','https://wheyokay.com/usn-blue-lab-100-whey-premium-protein-2kg-18-p.asp','fixture',100),
    (10003,3,233,170,'Ghost 100% Whey Protein 907g','https://wheyokay.com/ghost-100-whey-protein-907g-1514-p.asp','fixture',100),
    (10004,3,482,441,'JNX Sports The Curse 250g','https://wheyokay.com/jnx-sports-the-curse-250g-3733-p.asp','fixture',100),
    (10005,3,56,102,'Warrior Rage Unleash Hell Pre Workout 392g','https://wheyokay.com/warrior-rage-unleash-hell-pre-workout-392g-236-p.asp','fixture',100),
    (10006,3,215,134,'Applied Nutrition ABE Ultimate Pre-Workout 315g','https://wheyokay.com/applied-nutrition-abe-ultimate-pre-workout-315g-1358-p.asp','fixture',100),
    (10007,3,169,156,'Redcon1 Total War 400g','https://wheyokay.com/redcon1-total-war-400g-1041-p.asp','fixture',100),
    (10008,3,271,271,'Grenade Carb Killa Protein Bar 60g','https://wheyokay.com/grenade-carb-killa-protein-bar-60g-1774-p.asp','fixture',100),
    (10009,3,93,70,'JNX Sports The Ripper Fat Burner Powder 150g','https://wheyokay.com/jnx-sports-the-ripper-fat-burner-powder-150g-532-p.asp','fixture',100),
    (10010,3,112,105,'5% Nutrition Rich Piana  All Day You May 465g','https://wheyokay.com/5-nutrition-rich-piana--all-day-you-may-465g-658-p.asp','fixture',100),
    (10011,3,58,60,'5 Nutrition Rich Piana  Full As F*ck 387g','https://wheyokay.com/5-nutrition-rich-piana--full-as-fck-387g-245-p.asp','fixture',100),
    (10012,3,338,340,'Applied Nutrition Clear Whey Protein 875g','https://wheyokay.com/applied-nutrition-clear-whey-protein-875g-2418-p.asp','fixture',100),
    (10013,3,495,569,'GYM HIGH Cream Of Rice 2kg','https://wheyokay.com/gym-high-cream-of-rice-2kg-3837-p.asp','fixture',100),
    (10014,3,520,426,'Olimp Redweiler Preworkout 480g','https://wheyokay.com/olimp-redweiler-preworkout-480g-4080-p.asp','fixture',100),
    (10015,3,449,551,'USN QHUSH Black Pre-workout 220g','https://wheyokay.com/usn-qhush-black-pre-workout-220g-3465-p.asp','fixture',100),
    (10016,3,232,223,'Ghost Vegan Protein 989g','https://wheyokay.com/ghost-vegan-protein-989g-1507-p.asp','fixture',100),
    (10017,3,6,8,'Ghost Legend V4 Pre-Workout 660g','https://wheyokay.com/ghost-legend-pre-workout-660g-211-p.asp','fixture',100),
    (10018,3,85,68,'5% Nutrition Rich Piana CreaTen 240g','https://wheyokay.com/5-nutrition-rich-piana-createn-240g-510-p.asp','fixture',100),
    (10019,3,71,34,'BioTech USA Vegan Protein 500g','https://wheyokay.com/biotech-usa-vegan-protein-500g-312-p.asp','fixture',100),
    (10020,3,77,66,'Boditronics Diet Whey 900g','https://wheyokay.com/boditronics-diet-whey-900g-367-p.asp','fixture',100),
    (10021,3,164,519,'BSN Syntha-6 Edge 1.87kg','https://wheyokay.com/bsn-syntha-6-edge-187kg-982-p.asp','fixture',100),
    (10022,3,489,489,'Mutant Madness Pre Workout 225g','https://wheyokay.com/mutant-madness-pre-workout-225g-3789-p.asp','fixture',100),
    (10023,3,166,191,'Clif Bar Energy Bar 12x68g','https://wheyokay.com/clif-bar-energy-bar-12x68g-1005-p.asp','fixture',100),
    (10024,3,24,152,'PEScience Prolific 280g','https://wheyokay.com/pescience-prolific-280g-90-p.asp','fixture',100),
    (10025,3,44,47,'PEScience Amino IV 375g','https://wheyokay.com/pescience-amino-iv-375g-191-p.asp','fixture',100);
  insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url) values
    (11001,12,3,10001,15,9.99,3.99,null,true,'https://wheyokay.com/per4m-whey-protein-2kg-24-p.asp'),
    (11002,11,3,10002,14,9.99,3.99,null,true,'https://wheyokay.com/usn-blue-lab-100-whey-premium-protein-2kg-18-p.asp'),
    (11003,233,3,10003,170,9.99,3.99,null,true,'https://wheyokay.com/ghost-100-whey-protein-907g-1514-p.asp'),
    (11004,482,3,10004,441,9.99,3.99,null,true,'https://wheyokay.com/jnx-sports-the-curse-250g-3733-p.asp'),
    (11005,56,3,10005,102,9.99,3.99,null,true,'https://wheyokay.com/warrior-rage-unleash-hell-pre-workout-392g-236-p.asp'),
    (11006,215,3,10006,134,9.99,3.99,null,true,'https://wheyokay.com/applied-nutrition-abe-ultimate-pre-workout-315g-1358-p.asp'),
    (11007,169,3,10007,156,9.99,3.99,null,true,'https://wheyokay.com/redcon1-total-war-400g-1041-p.asp'),
    (11008,271,3,10008,271,9.99,3.99,null,true,'https://wheyokay.com/grenade-carb-killa-protein-bar-60g-1774-p.asp'),
    (11009,93,3,10009,70,9.99,3.99,null,true,'https://wheyokay.com/jnx-sports-the-ripper-fat-burner-powder-150g-532-p.asp'),
    (11010,112,3,10010,105,9.99,3.99,null,true,'https://wheyokay.com/5-nutrition-rich-piana--all-day-you-may-465g-658-p.asp'),
    (11011,58,3,10011,60,9.99,3.99,null,true,'https://wheyokay.com/5-nutrition-rich-piana--full-as-fck-387g-245-p.asp'),
    (11012,338,3,10012,340,9.99,3.99,null,true,'https://wheyokay.com/applied-nutrition-clear-whey-protein-875g-2418-p.asp'),
    (11013,495,3,10013,569,9.99,3.99,null,true,'https://wheyokay.com/gym-high-cream-of-rice-2kg-3837-p.asp'),
    (11014,520,3,10014,426,9.99,3.99,null,true,'https://wheyokay.com/olimp-redweiler-preworkout-480g-4080-p.asp'),
    (11015,449,3,10015,551,9.99,3.99,null,true,'https://wheyokay.com/usn-qhush-black-pre-workout-220g-3465-p.asp'),
    (11016,232,3,10016,223,9.99,3.99,null,true,'https://wheyokay.com/ghost-vegan-protein-989g-1507-p.asp'),
    (11017,6,3,10017,8,9.99,3.99,null,true,'https://wheyokay.com/ghost-legend-pre-workout-660g-211-p.asp'),
    (11018,85,3,10018,68,9.99,3.99,null,true,'https://wheyokay.com/5-nutrition-rich-piana-createn-240g-510-p.asp'),
    (11019,71,3,10019,34,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-vegan-protein-500g-312-p.asp'),
    (11020,77,3,10020,66,9.99,3.99,null,true,'https://wheyokay.com/boditronics-diet-whey-900g-367-p.asp'),
    (11021,164,3,10021,519,9.99,3.99,null,true,'https://wheyokay.com/bsn-syntha-6-edge-187kg-982-p.asp'),
    (11022,489,3,10022,489,9.99,3.99,null,true,'https://wheyokay.com/mutant-madness-pre-workout-225g-3789-p.asp'),
    (11023,166,3,10023,191,9.99,3.99,null,true,'https://wheyokay.com/clif-bar-energy-bar-12x68g-1005-p.asp'),
    (11024,24,3,10024,152,9.99,3.99,null,true,'https://wheyokay.com/pescience-prolific-280g-90-p.asp'),
    (11025,44,3,10025,47,9.99,3.99,null,true,'https://wheyokay.com/pescience-amino-iv-375g-191-p.asp');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price) select 12000+id,id,price,shipping_cost,total_price from public.offers;
  insert into public.outbound_clicks(id,offer_id,product_id,retailer_id,destination_url,source_page) select 13000+id,id,product_id,retailer_id,url,'product_offer_list' from public.offers;
`;
function recreateDatabase(container) { requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop database"); requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create database"); requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create roles"); requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply baseline"); requireSuccess(psql(container, ["-c", fixtureSql]), "create fixture"); }
function counts(container) { return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history),'clicks',(select count(*) from outbound_clicks))")); }
function targetRows(container) { return JSON.parse(sql(container, `select jsonb_agg(jsonb_build_object('product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_default',is_default,'is_active',is_active) order by product_id,variant_key) from product_variants where product_id in (${productIds.join(',')}) and not is_default`)); }
function expectBlocked(container, label) { const before = counts(container); const result = applyMigration(container); assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.deepEqual(counts(container), before, `${label} should rollback fully`); }
function expectInventory(container) { const actual = targetRows(container); const expected = [...inventory].sort((a,b)=>a.product_id-b.product_id || a.variant_key.localeCompare(b.variant_key)); assert.deepEqual(actual, expected); }
test("Whey Okay Medium batch 1 canonical variant migration", { timeout: 600_000, skip: dockerAvailable() ? false : "Docker daemon unavailable" }, async () => {
  const container = `whey-okay-medium-batch-1-${Date.now()}`;
  requireSuccess(run("docker", ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=medium-batch-1-local-only", "-v", `${root.replaceAll("\\", "/")}:/workspace`, image], 120_000), "start postgres");
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
    recreateDatabase(container); sql(container, `update products set is_active=false, merged_into_product_id=${inventory[0].product_id}, merged_at=now() where id=${inventory[2].product_id}`); expectBlocked(container, "inactive parent");
    recreateDatabase(container); sql(container, `update product_variants set is_active=false where id=${defaultPairs[3].default_variant_id}`); expectBlocked(container, "stale default relation");
    recreateDatabase(container); sql(container, `create function public.block_late_medium_insert() returns trigger language plpgsql as $$ begin if new.variant_key = '${inventory.at(-1).variant_key}' then raise exception 'late fixture failure'; end if; return new; end $$; create trigger block_late_medium_insert before insert on public.product_variants for each row execute function public.block_late_medium_insert();`); expectBlocked(container, "late failure atomic rollback");
  } finally { run("docker", ["rm", "-f", container], 30_000); }
});

