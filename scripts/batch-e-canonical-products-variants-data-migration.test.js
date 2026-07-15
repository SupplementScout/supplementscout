const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260715210000_seed_discount_supplements_batch_e_canonical_products_variants.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_batch_e_test";

const products = [
  {
    "name": "Applied Nutrition BEEF-XP Clear Beef Protein Isolate 1.8kg",
    "slug": "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 60,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritionbeefxpclearbeefproteinisolate18kg"
  },
  {
    "name": "Applied Nutrition Diet Whey Protein 1.8kg",
    "slug": "applied-nutrition-diet-whey-protein-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 72,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritiondietwheyprotein18kg"
  },
  {
    "name": "Applied Nutrition Diet Whey Protein 1kg",
    "slug": "applied-nutrition-diet-whey-protein-1kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1000,
    "servings": 40,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritiondietwheyprotein1kg"
  },
  {
    "name": "DY Nutrition Shadowhey Concentrate 2kg",
    "slug": "dy-nutrition-shadowhey-concentrate-2kg",
    "brand": "DY Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 2000,
    "servings": 66,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "dynutritionshadowheyconcentrate2kg"
  },
  {
    "name": "DY Nutrition The Creatine 400g",
    "slug": "dy-nutrition-the-creatine-400g",
    "brand": "DY Nutrition",
    "category": "Creatine",
    "net_weight_g": 400,
    "servings": 40,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "dynutritionthecreatine400g"
  },
  {
    "name": "Optimum Nutrition Platinum Creatine Plus 350g",
    "slug": "optimum-nutrition-platinum-creatine-plus-350g",
    "brand": "Optimum Nutrition",
    "category": "Creatine",
    "net_weight_g": 350,
    "servings": 50,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "optimumnutritionplatinumcreatineplus350g"
  },
  {
    "name": "Applied Nutrition Beef Mass Gainer 3.13kg",
    "slug": "applied-nutrition-beef-mass-gainer-3-13kg",
    "brand": "Applied Nutrition",
    "category": "Mass Gainer",
    "net_weight_g": 3130,
    "servings": 25,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritionbeefmassgainer313kg"
  },
  {
    "name": "Applied Nutrition Critical Plant Protein 1.8kg",
    "slug": "applied-nutrition-critical-plant-protein-1-8kg",
    "brand": "Applied Nutrition",
    "category": "Whey Protein",
    "net_weight_g": 1800,
    "servings": 60,
    "product_format": "powder",
    "is_active": true,
    "identity_key": "appliednutritioncriticalplantprotein18kg"
  }
];

const flavourSpecs = {
  "applied-nutrition-beef-xp-clear-beef-protein-isolate-1-8kg": {
    "size": 1800,
    "displaySize": "1.8kg",
    "flavours": [
      [
        "blue raspberry",
        "Blue Raspberry"
      ],
      [
        "cherry and apple",
        "Cherry & Apple"
      ],
      [
        "citrus twist",
        "Citrus Twist"
      ],
      [
        "lemon and mint",
        "Lemon & Mint"
      ],
      [
        "millions blackcurrant",
        "Millions Blackcurrant"
      ],
      [
        "millions cola",
        "Millions Cola"
      ],
      [
        "mixed berry",
        "Mixed Berry"
      ],
      [
        "orange and mango",
        "Orange & Mango"
      ],
      [
        "pineapple millions",
        "Pineapple Millions"
      ],
      [
        "strawberry and raspberry",
        "Strawberry & Raspberry"
      ],
      [
        "tropical vibes",
        "Tropical Vibes"
      ]
    ]
  },
  "applied-nutrition-diet-whey-protein-1-8kg": {
    "size": 1800,
    "displaySize": "1.8kg",
    "flavours": [
      [
        "banana milkshake",
        "Banana Milkshake"
      ],
      [
        "chocolate dessert",
        "Chocolate Dessert"
      ],
      [
        "strawberry milkshake",
        "Strawberry Milkshake"
      ],
      [
        "vanilla ice cream",
        "Vanilla Ice Cream"
      ]
    ]
  },
  "applied-nutrition-diet-whey-protein-1kg": {
    "size": 1000,
    "displaySize": "1kg",
    "flavours": [
      [
        "banana milkshake",
        "Banana Milkshake"
      ],
      [
        "chocolate dessert",
        "Chocolate Dessert"
      ],
      [
        "strawberry milkshake",
        "Strawberry Milkshake"
      ],
      [
        "vanilla ice cream",
        "Vanilla Ice Cream"
      ]
    ]
  },
  "dy-nutrition-shadowhey-concentrate-2kg": {
    "size": 2000,
    "displaySize": "2kg",
    "flavours": [
      [
        "chocolate",
        "Chocolate"
      ],
      [
        "cookies and cream",
        "Cookies & Cream"
      ],
      [
        "strawberry",
        "Strawberry"
      ],
      [
        "vanilla",
        "Vanilla"
      ]
    ]
  },
  "dy-nutrition-the-creatine-400g": {
    "size": 400,
    "displaySize": "400g",
    "flavours": [
      [
        "cherry",
        "Cherry"
      ],
      [
        "peach",
        "Peach"
      ],
      [
        "strawberry",
        "Strawberry"
      ]
    ]
  },
  "optimum-nutrition-platinum-creatine-plus-350g": {
    "size": 350,
    "displaySize": "350g",
    "flavours": [
      [
        "orange",
        "Orange"
      ],
      [
        "pineapple",
        "Pineapple"
      ]
    ]
  },
  "applied-nutrition-beef-mass-gainer-3-13kg": {
    "size": 3130,
    "displaySize": "3.13kg",
    "flavours": [
      [
        "blackcurrant millions",
        "Blackcurrant Millions"
      ],
      [
        "cola millions",
        "Cola Millions"
      ],
      [
        "frozen berries",
        "Frozen Berries"
      ],
      [
        "pineapple millions",
        "Pineapple Millions"
      ],
      [
        "tropical vibes",
        "Tropical Vibes"
      ]
    ]
  },
  "applied-nutrition-critical-plant-protein-1-8kg": {
    "size": 1800,
    "displaySize": "1.8kg",
    "flavours": [
      [
        "chocolate",
        "Chocolate"
      ],
      [
        "strawberry",
        "Strawberry"
      ],
      [
        "vanilla",
        "Vanilla"
      ]
    ]
  }
};

const variants = products.flatMap((product) => {
  const spec = flavourSpecs[product.slug];
  return [
    { product_slug: product.slug, variant_key: "default", display_name: "Default", flavour_code: null, flavour_label: null, size_value: null, size_unit: null, pack_count: null, product_format: null, is_default: true, is_active: true },
    ...spec.flavours.map(([code, label]) => ({ product_slug: product.slug, variant_key: `${code.replaceAll(" ", "-")}-${spec.size}g`, display_name: `${label} / ${spec.displaySize}`, flavour_code: code, flavour_label: label, size_value: spec.size, size_unit: "g", pack_count: 1, product_format: "powder", is_default: false, is_active: true })),
  ];
}).sort((a, b) => a.product_slug.localeCompare(b.product_slug) || a.variant_key.localeCompare(b.variant_key));

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
  return run("docker", ["exec", "-e", "PGPASSWORD=batch-e-local-only", container, ...args], timeout);
}
function psql(container, args, timeout) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args], timeout);
}
function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local Batch E fixture SQL");
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
  const match = text.match(new RegExp(`\\$batch_e_${label}\\$\\s*([\\s\\S]*?)\\s*\\$batch_e_${label}\\$::jsonb`));
  assert.ok(match, `migration must expose closed Batch E ${label} inventory`);
  return JSON.parse(match[1]);
}
function sqlLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

const migrationProducts = inventory("products");
const migrationVariants = inventory("variants");

const fixtureSql = `
  insert into public.retailers(id,name,slug,website) values(3,'Regression Retailer','regression-retailer','https://regression.example');
  insert into public.products(id,name,slug,brand,category,product_format,is_active) values
    (7,'Batch A Regression','batch-a-regression','Brand A','Whey Protein','powder',true),
    (222,'Batch B Regression','batch-b-regression','Brand B','Mass Gainer','powder',true),
    (296,'Batch C Regression','batch-c-regression','Brand C','Whey Protein','powder',true),
    (742,'Batch D Regression','batch-d-regression','Brand D','Creatine','powder',true);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values
    (7,7,'default','Default',true,true),(187,222,'default','Default',true,true),(292,296,'default','Default',true,true),(9001,742,'default','Default',true,true),
    (701,7,'batch-a-variant','Batch A Variant',true,false),(702,222,'batch-b-variant','Batch B Variant',true,false),(703,296,'batch-c-variant','Batch C Variant',true,false),(9002,742,'batch-d-variant','Batch D Variant',true,false);
  insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence)
  values(101,3,7,7,'Regression Product','https://regression.example/p7','fixture',100);
  insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url)
  values(201,7,3,101,7,10,2,12,true,'https://regression.example/p7');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price) values(301,201,10,2,12);
  select setval('public.products_id_seq',1000,true);
  select setval('public.product_variants_id_seq',1000,true);
`;

function recreateDatabase(container) {
  requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create Batch A/B/C/D regression fixture");
}
function counts(container) {
  return JSON.parse(sql(container, "select jsonb_build_object('products',(select count(*) from products),'variants',(select count(*) from product_variants),'mappings',(select count(*) from retailer_products),'offers',(select count(*) from offers),'history',(select count(*) from price_history))"));
}
function regressionState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(to_jsonb(p) order by id) from products p where id in(7,222,296,742)),
    'variants',(select jsonb_agg(to_jsonb(v) order by id) from product_variants v where product_id in(7,222,296,742)),
    'mappings',(select jsonb_agg(to_jsonb(rp) order by id) from retailer_products rp),
    'offers',(select jsonb_agg(to_jsonb(o) order by id) from offers o),
    'history',(select jsonb_agg(to_jsonb(ph) order by id) from price_history ph))`));
}
function targetState(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select jsonb_agg(jsonb_build_object('name',p.name,'slug',p.slug,'brand',p.brand,'category',p.category,'net_weight_g',p.net_weight_g,'servings',p.servings,'product_format',p.product_format,'is_active',p.is_active,'price',p.price) order by p.slug) from products p where p.slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})),
    'variants',(select jsonb_agg(jsonb_build_object('product_slug',p.slug,'variant_key',v.variant_key,'display_name',v.display_name,'flavour_code',v.flavour_code,'flavour_label',v.flavour_label,'size_value',v.size_value,'size_unit',v.size_unit,'pack_count',v.pack_count,'product_format',v.product_format,'is_default',v.is_default,'is_active',v.is_active) order by p.slug,v.variant_key) from product_variants v join products p on p.id=v.product_id where p.slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})))`));
}
function insertProducts(container, rows) {
  sql(container, `insert into products(name,slug,brand,category,price,servings,net_weight_g,product_format,is_active) values ${rows.map((p) => `(${sqlLiteral(p.name)},${sqlLiteral(p.slug)},${sqlLiteral(p.brand)},${sqlLiteral(p.category)},null,${sqlLiteral(p.servings)},${p.net_weight_g},${sqlLiteral(p.product_format)},true)`).join(",")}`);
}
function insertVariants(container, rows) {
  sql(container, `insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active) select p.id,v.variant_key,v.display_name,v.flavour_code,v.flavour_label,v.size_value::numeric,v.size_unit,v.pack_count::integer,v.product_format,null,null,'{}'::jsonb,v.is_default,v.is_active from (values ${rows.map((v) => `(${sqlLiteral(v.product_slug)},${sqlLiteral(v.variant_key)},${sqlLiteral(v.display_name)},${sqlLiteral(v.flavour_code)},${sqlLiteral(v.flavour_label)},${sqlLiteral(v.size_value)},${sqlLiteral(v.size_unit)},${sqlLiteral(v.pack_count)},${sqlLiteral(v.product_format)},${v.is_default},${v.is_active})`).join(",")}) v(product_slug,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active) join products p on p.slug=v.product_slug`);
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Batch E migration has a closed 8-product, 44-variant contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.deepEqual(migrationProducts, products);
  assert.deepEqual([...migrationVariants].sort((a, b) => a.product_slug.localeCompare(b.product_slug) || a.variant_key.localeCompare(b.variant_key)), variants);
  assert.equal(migrationProducts.length, 8);
  assert.equal(migrationVariants.length, 44);
  assert.equal(migrationVariants.filter((row) => row.is_default).length, 8);
  assert.equal(migrationVariants.filter((row) => !row.is_default).length, 36);
  assert.equal(new Set(migrationProducts.map((row) => row.slug)).size, 8);
  assert.equal(new Set(migrationVariants.map((row) => `${row.product_slug}:${row.variant_key}`)).size, 44);
  assert.match(text, /insert into public\.products/i);
  assert.match(text, /insert into public\.product_variants/i);
  assert.doesNotMatch(text, /insert into public\.(retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)/i);
  assert.doesNotMatch(text, /on conflict/i);
});

test("real Batch E migration scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-batch-e-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=batch-e-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    const regressions = regressionState(container);
    requireSuccess(applyMigration(container), "Batch E clean state");
    const after = counts(container);
    assert.deepEqual(after, { products: before.products + 8, variants: before.variants + 44, mappings: before.mappings, offers: before.offers, history: before.history });
    const expectedProducts = products.map((p) => ({
      name: p.name, slug: p.slug, brand: p.brand, category: p.category,
      net_weight_g: p.net_weight_g, servings: p.servings,
      product_format: p.product_format, is_active: p.is_active, price: null,
    })).sort((a, b) => a.slug.localeCompare(b.slug));
    assert.deepEqual(targetState(container), { products: expectedProducts, variants });
    assert.deepEqual(regressionState(container), regressions, "Batch A/B/C/D regression rows changed");
    const stable = targetState(container);
    requireSuccess(applyMigration(container), "Batch E identical rerun");
    assert.deepEqual(targetState(container), stable);
    assert.deepEqual(counts(container), after);

    recreateDatabase(container);
    insertProducts(container, products.slice(0, 2));
    insertVariants(container, variants.filter((row) => row.product_slug === products[0].slug).slice(0, 5));
    requireSuccess(applyMigration(container), "Batch E partial identical state");
    assert.deepEqual(targetState(container), { products: expectedProducts, variants });

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,price,net_weight_g,product_format,is_active) values('Drifted',${sqlLiteral(products[0].slug)},${sqlLiteral(products[0].brand)},${sqlLiteral(products[0].category)},null,2000,'powder',true)`);
    const driftedProduct = counts(container); expectBlocked(container, "drifted product slug"); assert.deepEqual(counts(container), driftedProduct);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    insertVariants(container, [{ ...variants.find((row) => row.product_slug === products[0].slug && row.variant_key !== "default"), display_name: "Drifted" }]);
    const driftedVariant = counts(container); expectBlocked(container, "drifted variant key"); assert.deepEqual(counts(container), driftedVariant);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,price,net_weight_g,product_format,is_active) values(${sqlLiteral(products[0].name)},'semantic-duplicate',${sqlLiteral(products[0].brand)},${sqlLiteral(products[0].category)},null,2000,'powder',true)`);
    const duplicateProduct = counts(container); expectBlocked(container, "semantic duplicate product"); assert.deepEqual(counts(container), duplicateProduct);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    const semantic = variants.find((row) => row.product_slug === products[0].slug && row.variant_key !== "default");
    insertVariants(container, [{ ...semantic, variant_key: "legacy-semantic-key" }]);
    const duplicateVariant = counts(container); expectBlocked(container, "semantic duplicate variant"); assert.deepEqual(counts(container), duplicateVariant);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    insertVariants(container, [{ ...variants.find((row) => row.product_slug === products[0].slug && row.is_default), variant_key: "legacy-default" }]);
    const missingRelation = counts(container); expectBlocked(container, "missing required default relation"); assert.deepEqual(counts(container), missingRelation);

    recreateDatabase(container);
    sql(container, "create function reject_batch_e_variant() returns trigger language plpgsql as $$ begin if new.variant_key='vanilla-1800g' then raise exception 'controlled Batch E failure'; end if; return new; end $$; create trigger reject_batch_e_variant before insert on product_variants for each row execute function reject_batch_e_variant()");
    const late = counts(container); const lateRegressions = regressionState(container);
    expectBlocked(container, "late controlled failure");
    assert.deepEqual(counts(container), late); assert.deepEqual(regressionState(container), lateRegressions);
    assert.equal(sql(container, `select count(*) from products where slug in(${products.map((p) => sqlLiteral(p.slug)).join(",")})`), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
