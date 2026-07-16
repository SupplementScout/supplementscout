const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260716203000_seed_jons_per4m_product_families.sql");
const image = "postgres:17-alpine";
const database = "supplementscout_jons_per4m_test";
const password = "jons-per4m-local-only";

const products = [
  {
    "name": "Per4m Creatine Sherbet 310g",
    "slug": "per4m-creatine-sherbet-310g",
    "brand": "Per4m",
    "category": "Creatine",
    "net_weight_g": 310,
    "servings": 100,
    "serving_count_verified": 100,
    "product_format": "powder",
    "is_active": true
  },
  {
    "name": "Per4m EAA Xtra 420g",
    "slug": "per4m-eaa-xtra-420g",
    "brand": "Per4m",
    "category": "Amino Acids",
    "net_weight_g": 420,
    "servings": null,
    "serving_count_verified": null,
    "product_format": "powder",
    "is_active": true
  },
  {
    "name": "Per4m Pre-Workout Stim 570g",
    "slug": "per4m-pre-workout-stim-570g",
    "brand": "Per4m",
    "category": "Pre Workout",
    "net_weight_g": 570,
    "servings": 30,
    "serving_count_verified": 30,
    "product_format": "powder",
    "is_active": true
  }
];
const variants = [
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "cherry-fizz-310g",
    "display_name": "Cherry Fizz / 310g",
    "flavour_code": "cherry fizz",
    "flavour_label": "Cherry Fizz",
    "size_value": 310,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": "powder",
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "fizzy-bubblegum-bottles-310g",
    "display_name": "Fizzy Bubblegum Bottles / 310g",
    "flavour_code": "fizzy bubblegum bottles",
    "flavour_label": "Fizzy Bubblegum Bottles",
    "size_value": 310,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "original-sherbet-310g",
    "display_name": "Original Sherbet / 310g",
    "flavour_code": "original sherbet",
    "flavour_label": "Original Sherbet",
    "size_value": 310,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "peach-sweets-310g",
    "display_name": "Peach Sweets / 310g",
    "flavour_code": "peach sweets",
    "flavour_label": "Peach Sweets",
    "size_value": 310,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-creatine-sherbet-310g",
    "variant_key": "rainbow-candy-310g",
    "display_name": "Rainbow Candy / 310g",
    "flavour_code": "rainbow candy",
    "flavour_label": "Rainbow Candy",
    "size_value": 310,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "blackberry-420g",
    "display_name": "Blackberry / 420g",
    "flavour_code": "blackberry",
    "flavour_label": "Blackberry",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "blue-raspberry-420g",
    "display_name": "Blue Raspberry / 420g",
    "flavour_code": "blue raspberry",
    "flavour_label": "Blue Raspberry",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "cherry-fizz-420g",
    "display_name": "Cherry Fizz / 420g",
    "flavour_code": "cherry fizz",
    "flavour_label": "Cherry Fizz",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": "powder",
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "lemon-lime-splash-420g",
    "display_name": "Lemon Lime Splash / 420g",
    "flavour_code": "lemon lime splash",
    "flavour_label": "Lemon Lime Splash",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "mango-margarita-420g",
    "display_name": "Mango Margarita / 420g",
    "flavour_code": "mango margarita",
    "flavour_label": "Mango Margarita",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "passionfruit-420g",
    "display_name": "Passionfruit / 420g",
    "flavour_code": "passionfruit",
    "flavour_label": "Passionfruit",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "peach-iced-tea-420g",
    "display_name": "Peach Iced Tea / 420g",
    "flavour_code": "peach iced tea",
    "flavour_label": "Peach Iced Tea",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "rainbow-candy-420g",
    "display_name": "Rainbow Candy / 420g",
    "flavour_code": "rainbow candy",
    "flavour_label": "Rainbow Candy",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "strawberry-lime-twist-420g",
    "display_name": "Strawberry Lime Twist / 420g",
    "flavour_code": "strawberry lime twist",
    "flavour_label": "Strawberry Lime Twist",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-eaa-xtra-420g",
    "variant_key": "tropical-pineapple-420g",
    "display_name": "Tropical Pineapple / 420g",
    "flavour_code": "tropical pineapple",
    "flavour_label": "Tropical Pineapple",
    "size_value": 420,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "berry-blast-570g",
    "display_name": "Berry Blast / 570g",
    "flavour_code": "berry blast",
    "flavour_label": "Berry Blast",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "blackberry-570g",
    "display_name": "Blackberry / 570g",
    "flavour_code": "blackberry",
    "flavour_label": "Blackberry",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "cola-bottles-570g",
    "display_name": "Cola Bottles / 570g",
    "flavour_code": "cola bottles",
    "flavour_label": "Cola Bottles",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "default",
    "display_name": "Default",
    "flavour_code": null,
    "flavour_label": null,
    "size_value": null,
    "size_unit": null,
    "pack_count": null,
    "product_format": "powder",
    "is_default": true,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "lemon-sherbet-fizz-570g",
    "display_name": "Lemon Sherbet Fizz / 570g",
    "flavour_code": "lemon sherbet fizz",
    "flavour_label": "Lemon Sherbet Fizz",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "orange-and-mango-570g",
    "display_name": "Orange & Mango / 570g",
    "flavour_code": "orange and mango",
    "flavour_label": "Orange & Mango",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "passionfruit-570g",
    "display_name": "Passionfruit / 570g",
    "flavour_code": "passionfruit",
    "flavour_label": "Passionfruit",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "pink-lemonade-570g",
    "display_name": "Pink Lemonade / 570g",
    "flavour_code": "pink lemonade",
    "flavour_label": "Pink Lemonade",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "rainbow-candy-570g",
    "display_name": "Rainbow Candy / 570g",
    "flavour_code": "rainbow candy",
    "flavour_label": "Rainbow Candy",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  },
  {
    "product_slug": "per4m-pre-workout-stim-570g",
    "variant_key": "watermelon-lemonade-570g",
    "display_name": "Watermelon Lemonade / 570g",
    "flavour_code": "watermelon lemonade",
    "flavour_label": "Watermelon Lemonade",
    "size_value": 570,
    "size_unit": "g",
    "pack_count": 1,
    "product_format": "powder",
    "is_default": false,
    "is_active": true
  }
];

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
function dockerExec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", `PGPASSWORD=${password}`, container, ...args], timeout);
}
function psql(container, args, timeout) {
  return dockerExec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database, ...args,
  ], timeout);
}
function sql(container, statement) {
  const result = psql(container, ["-tAc", statement]);
  requireSuccess(result, "execute local PER4M fixture SQL");
  return result.stdout.trim();
}
function applyMigration(container) {
  return psql(container, ["-f", `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`]);
}
function waitForPostgres(container) {
  let readyCount = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = dockerExec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5_000);
    const query = dockerExec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres", "-tAc", "select 1",
    ], 5_000);
    if (ready.status === 0 && query.status === 0 && query.stdout.trim() === "1") {
      readyCount += 1;
      if (readyCount === 3) return;
    } else {
      readyCount = 0;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function sqlLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}
const fixtureSql = `
  insert into public.retailers(id,name,slug,website)
  values(3,'Regression Retailer','regression-retailer','https://regression.example');
  insert into public.products(id,name,slug,brand,category,product_format,is_active)
  values(7,'Regression Product','regression-product','Fixture','Creatine','powder',true);
  insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
  values(7,7,'default','Default',true,true);
  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_url
  ) values(101,3,7,7,'Regression Product','https://regression.example/product');
  insert into public.offers(
    id,product_id,retailer_id,retailer_product_id,product_variant_id,
    price,shipping_cost,total_price,in_stock,url
  ) values(201,7,3,101,7,10,2,12,true,'https://regression.example/product');
  insert into public.price_history(id,offer_id,price,shipping_cost,total_price)
  values(301,201,10,2,12);
  select setval('public.products_id_seq',1000,true);
  select setval('public.product_variants_id_seq',1000,true);
`;
function recreateDatabase(container) {
  requireSuccess(dockerExec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop scenario database");
  requireSuccess(dockerExec(container, ["createdb", "-U", "postgres", database]), "create scenario database");
  requireSuccess(psql(container, ["-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
  requireSuccess(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "apply local baseline");
  requireSuccess(psql(container, ["-c", fixtureSql]), "create regression fixture");
}
function counts(container) {
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select count(*) from products),
    'variants',(select count(*) from product_variants),
    'retailers',(select count(*) from retailers),
    'mappings',(select count(*) from retailer_products),
    'offers',(select count(*) from offers),
    'history',(select count(*) from price_history))`));
}
function targetState(container) {
  const slugs = products.map((row) => sqlLiteral(row.slug)).join(",");
  return JSON.parse(sql(container, `select jsonb_build_object(
    'products',(select coalesce(jsonb_agg(jsonb_build_object(
      'name',p.name,'slug',p.slug,'brand',p.brand,'category',p.category,
      'net_weight_g',p.net_weight_g,'servings',p.servings,
      'serving_count_verified',p.serving_count_verified,
      'product_format',p.product_format,'is_active',p.is_active
    ) order by p.slug),'[]'::jsonb) from products p where p.slug in(${slugs})),
    'variants',(select coalesce(jsonb_agg(jsonb_build_object(
      'product_slug',p.slug,'variant_key',v.variant_key,'display_name',v.display_name,
      'flavour_code',v.flavour_code,'flavour_label',v.flavour_label,
      'size_value',v.size_value,'size_unit',v.size_unit,'pack_count',v.pack_count,
      'product_format',v.product_format,'is_default',v.is_default,'is_active',v.is_active
    ) order by p.slug,v.variant_key),'[]'::jsonb)
      from product_variants v join products p on p.id=v.product_id
      where p.slug in(${slugs})))`));
}
function insertProducts(container, selected) {
  sql(container, `insert into products(
    name,slug,brand,category,servings,net_weight_g,serving_count_verified,
    product_format,is_active
  ) values ${selected.map((p) => `(${sqlLiteral(p.name)},${sqlLiteral(p.slug)},${sqlLiteral(p.brand)},${sqlLiteral(p.category)},${sqlLiteral(p.servings)},${p.net_weight_g},${sqlLiteral(p.serving_count_verified)},'powder',true)`).join(",")}`);
}
function insertVariants(container, selected) {
  sql(container, `insert into product_variants(
    product_id,variant_key,display_name,flavour_code,flavour_label,size_value,
    size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active
  ) select p.id,v.variant_key,v.display_name,v.flavour_code,v.flavour_label,
    v.size_value::numeric,v.size_unit,v.pack_count::integer,v.product_format,
    null,null,'{}'::jsonb,v.is_default,v.is_active
  from (values ${selected.map((v) => `(${sqlLiteral(v.product_slug)},${sqlLiteral(v.variant_key)},${sqlLiteral(v.display_name)},${sqlLiteral(v.flavour_code)},${sqlLiteral(v.flavour_label)},${sqlLiteral(v.size_value)},${sqlLiteral(v.size_unit)},${sqlLiteral(v.pack_count)},${sqlLiteral(v.product_format)},${v.is_default},${v.is_active})`).join(",")})
    v(product_slug,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default,is_active)
  join products p on p.slug=v.product_slug`);
}
function expectBlocked(container, label) {
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

test("Jon's PER4M migration has a closed 3-product, 27-variant contract", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.match(text, /lock table public\.products, public\.product_variants/i);
  assert.equal(products.length, 3);
  assert.equal(variants.length, 27);
  assert.equal(variants.filter((row) => row.is_default).length, 3);
  assert.equal(variants.filter((row) => !row.is_default).length, 24);
  assert.equal(new Set(products.map((row) => row.slug)).size, 3);
  assert.equal(new Set(variants.map((row) => `${row.product_slug}:${row.variant_key}`)).size, 27);
  for (const product of products) {
    assert.match(text, new RegExp(product.slug.replaceAll("-", "\\-"), "g"));
    assert.equal(variants.filter((row) => row.product_slug === product.slug && row.is_default).length, 1);
  }
  for (const variant of variants) {
    assert.ok(text.includes(`'${variant.variant_key}'`), `missing variant key ${variant.variant_key}`);
  }
  assert.ok(variants.some((row) => row.flavour_code === "lemon sherbet fizz"));
  assert.ok(!variants.some((row) => row.flavour_code === "lemon sherbert fizz"));
  assert.ok(!variants.some((row) => row.flavour_code === "strawberry lime"));
  assert.ok(!variants.some((row) => ["blue rasberry", "orange burst", "fizzy bubblegum bottle"].includes(row.flavour_code)));
  assert.doesNotMatch(text, /insert into public\.(retailer_products|offers|price_history|retailers)/i);
  assert.doesNotMatch(text, /(update|delete from|truncate) public\.(products|product_variants|retailers|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(text, /on conflict/i);
  assert.doesNotMatch(text, /(hxnrsyyqffztlvcrtgbf|aftboxmrdgyhizicfsfu|supabase\.co)/i);
});

test("real Jon's PER4M scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-jons-per4m-${crypto.randomBytes(6).toString("hex")}`;
  try {
    requireSuccess(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", `POSTGRES_PASSWORD=${password}`, "-v", `${root}:/workspace:ro`, image,
    ], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);

    recreateDatabase(container);
    const before = counts(container);
    requireSuccess(applyMigration(container), "PER4M clean state");
    const after = counts(container);
    assert.deepEqual(after, {
      products: before.products + 3,
      variants: before.variants + 27,
      retailers: before.retailers,
      mappings: before.mappings,
      offers: before.offers,
      history: before.history,
    });
    assert.deepEqual(targetState(container), { products, variants });
    assert.equal(sql(container, "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug like 'per4m-%' and v.is_default"), "3");
    assert.equal(sql(container, "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug in('per4m-eaa-xtra-420g','per4m-pre-workout-stim-570g','per4m-creatine-sherbet-310g') and not v.is_default"), "24");
    assert.equal(sql(container, "select count(*) from retailer_products where product_id in(select id from products where slug in('per4m-eaa-xtra-420g','per4m-pre-workout-stim-570g','per4m-creatine-sherbet-310g'))"), "0");

    const stable = targetState(container);
    requireSuccess(applyMigration(container), "PER4M identical rerun");
    assert.deepEqual(targetState(container), stable);
    assert.deepEqual(counts(container), after);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    const partialProduct = counts(container);
    expectBlocked(container, "partial exact product");
    assert.deepEqual(counts(container), partialProduct);

    recreateDatabase(container);
    requireSuccess(applyMigration(container), "prepare partial variant scenario");
    const removed = variants.find((row) => !row.is_default);
    sql(container, `delete from product_variants v using products p where v.product_id=p.id and p.slug=${sqlLiteral(removed.product_slug)} and v.variant_key=${sqlLiteral(removed.variant_key)}`);
    const partialVariant = counts(container);
    expectBlocked(container, "partial exact variant set");
    assert.deepEqual(counts(container), partialVariant);

    recreateDatabase(container);
    sql(container, `insert into products(name,slug,brand,category,net_weight_g,product_format,is_active)
      values('Drifted',${sqlLiteral(products[0].slug)},'Per4m','Creatine',310,'powder',true)`);
    const slugDrift = counts(container);
    expectBlocked(container, "product slug collision");
    assert.deepEqual(counts(container), slugDrift);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    const semantic = variants.find((row) => row.product_slug === products[0].slug && !row.is_default);
    insertVariants(container, [{ ...semantic, variant_key: "legacy-normalized-key", flavour_code: semantic.flavour_code.toUpperCase() }]);
    const flavourCollision = counts(container);
    expectBlocked(container, "flavour normalization collision");
    assert.deepEqual(counts(container), flavourCollision);

    recreateDatabase(container);
    insertProducts(container, [products[0]]);
    const technicalDefault = variants.find((row) => row.product_slug === products[0].slug && row.is_default);
    insertVariants(container, [{ ...technicalDefault, variant_key: "legacy-default" }]);
    const defaultCollision = counts(container);
    expectBlocked(container, "default variant collision");
    assert.deepEqual(counts(container), defaultCollision);

    recreateDatabase(container);
    sql(container, `create function reject_per4m_variant() returns trigger language plpgsql as $$ begin
      if new.variant_key='watermelon-lemonade-570g' then
        raise exception 'controlled PER4M failure';
      end if;
      return new;
    end $$;
    create trigger reject_per4m_variant before insert on product_variants
      for each row execute function reject_per4m_variant()`);
    const beforeFailure = counts(container);
    expectBlocked(container, "late controlled failure");
    assert.deepEqual(counts(container), beforeFailure);
    assert.equal(sql(container, "select count(*) from products where slug in('per4m-eaa-xtra-420g','per4m-pre-workout-stim-570g','per4m-creatine-sherbet-310g')"), "0");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
