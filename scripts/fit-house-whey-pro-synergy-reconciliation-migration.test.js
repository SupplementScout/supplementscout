const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(
  root,
  "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
);
const stage2 = path.join(
  root,
  "supabase/migrations/20260713130000_product_variants_stage2.sql",
);
const stage2Setup = path.join(
  root,
  "supabase/test/product_variants_stage2_migration_test.sql",
);
const migration = path.join(
  root,
  "supabase/migrations/20260726180000_reconcile_fit_house_whey_pro_synergy_dynamic.sql",
);
const image = "postgres:17-alpine";
const database = "supplementscout_stage2_test_whey_synergy";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
}
function requireSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\n${result.stdout || ""}\n${result.stderr || ""}`,
  );
  return result;
}
function dockerAvailable() {
  return run("docker", ["info"], 20_000).status === 0;
}
function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", container, ...args], timeout);
}
function psql(container, args, timeout = 120_000) {
  return exec(
    container,
    ["psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, ...args],
    timeout,
  );
}
function sql(container, statement) {
  return requireSuccess(
    psql(container, ["-At", "-c", statement]),
    "SQL statement",
  ).stdout.trim();
}
function applyMigration(container) {
  return psql(container, [
    "-f",
    `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`,
  ]);
}
function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (
      exec(
        container,
        ["pg_isready", "-U", "postgres", "-d", "postgres"],
        5_000,
      ).status === 0
    ) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function recreateDatabase(container) {
  requireSuccess(
    exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]),
    "drop scenario database",
  );
  requireSuccess(
    exec(container, ["createdb", "-U", "postgres", database]),
    "create scenario database",
  );
  requireSuccess(
    psql(container, [
      "-c",
      "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;",
    ]),
    "create local roles",
  );
  requireSuccess(
    psql(container, [
      "-f",
      `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`,
    ]),
    "apply local baseline",
  );
  requireSuccess(
    psql(container, [
      "-v",
      "stage2_test_database_confirmed=1",
      "-v",
      "stage2_test_host=127.0.0.1",
      "-v",
      `stage2_expected_database=${database}`,
      "-v",
      "stage2_scenario=success",
      "-f",
      `/workspace/${path.relative(root, stage2Setup).replaceAll("\\", "/")}`,
    ]),
    "create Product Variants Stage 2 fixture",
  );
  requireSuccess(
    psql(container, [
      "-f",
      `/workspace/${path.relative(root, stage2).replaceAll("\\", "/")}`,
    ]),
    "apply Product Variants Stage 2",
  );
  requireSuccess(
    psql(container, [
      "-c",
      `
      truncate table
        public.outbound_clicks, public.price_history, public.offers,
        public.retailer_products, public.product_variants,
        public.product_merge_history, public.ignored_duplicate_product_pairs,
        public.search_events, public.products, public.retailers
      restart identity cascade;
      insert into retailers(id,name,slug,website) values
        (1,'GYM HIGH','gym-high','https://gymhigh.co.uk'),
        (3,'Whey Okay','whey-okay','https://wheyokay.com'),
        (9,'Fit House','fit-house','https://fithouse.uk');
      insert into products(
        id,name,slug,brand,category,net_weight_g,product_format,is_active
      ) values
        (337,'GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','GYM HIGH','Whey Protein',600,'powder',true),
        (510,'GYM HIGH Whey Pro Synergy Dynamic 600g','gym-high-whey-pro-synergy-dynamic-600g','GYM HIGH','Whey Protein',600,'powder',true);
      insert into product_variants(
        id,product_id,variant_key,display_name,flavour_code,flavour_label,
        size_value,size_unit,pack_count,product_format,is_active,is_default,nutrition_override
      ) values
        (333,337,'default','Default',null,null,null,null,null,null,true,true,'{}'),
        (603,510,'default','Default',null,null,null,null,null,null,true,true,'{}'),
        (999,337,'banana-600g','Banana / 600g','banana','Banana',600,'g',1,'powder',true,false,'{}'),
        (1000,337,'strawberry-600g','Strawberry / 600g','strawberry','Strawberry',600,'g',1,'powder',true,false,'{}'),
        (1068,510,'belgian-chocolate-600g','Belgian Chocolate / 600g','belgian chocolate','Belgian Chocolate',600,'g',1,'powder',true,false,'{}'),
        (1971,337,'vanilla-600g','Vanilla / 600g','vanilla','Vanilla',600,'g',1,'powder',true,false,'{}');
      insert into retailer_products(
        id,retailer_id,product_id,product_variant_id,external_product_id,
        external_variant_id,external_name,external_slug,external_url,
        match_method,match_confidence
      ) values
        (324,3,337,333,null,null,'GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','https://wheyokay.com/gym-high-whey-pro-synergy-600g-2407-p.asp','existing_offer',100),
        (484,3,510,603,null,null,'GYM HIGH Whey Pro Synergy Dynamic 600g','gym-high-whey-pro-synergy-dynamic-600g','https://wheyokay.com/gym-high-whey-pro-synergy-dynamic-600g-3977-p.asp','existing_offer',100),
        (1176,9,337,999,'9554213830896','47792261431536','GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261431536','slug',90),
        (1177,9,337,1000,'9554213830896','47792261497072','GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261497072','slug',90),
        (2138,9,337,1971,'9554213830896','47792261464304','GYM HIGH Whey Pro Synergy 600g','gym-high-whey-pro-synergy-600g','https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261464304','slug',90);
      insert into offers(
        id,product_id,retailer_id,retailer_product_id,product_variant_id,
        price,shipping_cost,total_price,in_stock,url
      ) values
        (341,337,3,324,333,26.99,3.99,null,false,'https://wheyokay.com/gym-high-whey-pro-synergy-600g-2407-p.asp'),
        (514,510,3,484,603,28.99,3.99,null,true,'https://wheyokay.com/gym-high-whey-pro-synergy-dynamic-600g-3977-p.asp'),
        (990,337,9,1176,999,25.99,3.99,29.98,true,'https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261431536'),
        (991,337,9,1177,1000,25.99,3.99,29.98,true,'https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261497072'),
        (1952,337,9,2138,1971,25.99,3.99,29.98,true,'https://fithouse.uk/products/gym-high-whey-pro-synergy-tested-600g?variant=47792261464304');
      insert into price_history(id,offer_id,price,shipping_cost,total_price) values
        (1,341,26.99,3.99,null),(2,514,28.99,3.99,null),
        (3,990,25.99,3.99,29.98),(4,991,25.99,3.99,29.98),
        (5,1952,25.99,3.99,29.98);
      insert into outbound_clicks(
        id,offer_id,product_id,retailer_id,destination_url,source_page
      ) values
        (1,990,337,9,'https://fithouse.uk/banana','product_offer_list'),
        (2,991,337,9,'https://fithouse.uk/strawberry','product_offer_list'),
        (3,514,510,3,'https://wheyokay.com/dynamic','product_best_offer');
      `,
    ]),
    "create reconciliation fixture",
  );
}
function counts(container) {
  return JSON.parse(
    sql(
      container,
      `select jsonb_build_object(
        'products',(select count(*) from products),
        'variants',(select count(*) from product_variants),
        'mappings',(select count(*) from retailer_products),
        'offers',(select count(*) from offers),
        'history',(select count(*) from price_history),
        'clicks',(select count(*) from outbound_clicks)
      )`,
    ),
  );
}
function state(container) {
  return JSON.parse(
    sql(
      container,
      `select jsonb_build_object(
        'fit_variants',(select count(*) from product_variants where id in(999,1000,1971) and product_id=510),
        'fit_mappings',(select count(*) from retailer_products where id in(1176,1177,2138) and product_id=510),
        'fit_offers',(select count(*) from offers where id in(990,991,1952) and product_id=510),
        'fit_clicks',(select count(*) from outbound_clicks where offer_id in(990,991,1952) and product_id=510),
        'old_whey_okay',(select count(*) from retailer_products where id=324 and product_id=337 and product_variant_id=333),
        'dynamic_whey_okay',(select count(*) from retailer_products where id=484 and product_id=510 and product_variant_id=603)
      )`,
    ),
  );
}
function expectBlocked(container, label) {
  const before = counts(container);
  const result = applyMigration(container);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.deepEqual(counts(container), before);
}

test("migration is closed to the three reviewed Fit House Shopify variants", () => {
  const text = fs.readFileSync(migration, "utf8");
  assert.match(text, /^begin;/i);
  assert.match(text, /commit;\s*$/i);
  assert.match(text, /9554213830896/);
  for (const id of ["47792261431536", "47792261464304", "47792261497072"]) {
    assert.match(text, new RegExp(id));
  }
  assert.match(text, /v_source_product_id constant bigint := 337/);
  assert.match(text, /v_target_product_id constant bigint := 510/);
  assert.doesNotMatch(text, /\b(delete|truncate|insert into)\s+public\.(products|product_variants|retailer_products|offers|price_history|outbound_clicks)\b/i);
  assert.doesNotMatch(text, /\b(price|shipping_cost|total_price|in_stock|url)\s*=/i);
});

test(
  "migration reassigns only Fit House Dynamic variants and is idempotent",
  { skip: !dockerAvailable() && "Docker daemon unavailable" },
  () => {
    const container = `supplementscout-whey-synergy-${Date.now()}`;
    try {
      requireSuccess(
        run(
          "docker",
          [
            "run",
            "--detach",
            "--rm",
            "--name",
            container,
            "--network",
            "none",
            "-e",
            "POSTGRES_PASSWORD=whey-synergy-local-only",
            "-v",
            `${root}:/workspace:ro`,
            image,
          ],
          180_000,
        ),
        "start disposable PostgreSQL",
      );
      waitForPostgres(container);

      recreateDatabase(container);
      const before = counts(container);
      requireSuccess(applyMigration(container), "clean reconciliation");
      assert.deepEqual(counts(container), before);
      assert.deepEqual(state(container), {
        fit_variants: 3,
        fit_mappings: 3,
        fit_offers: 3,
        fit_clicks: 2,
        old_whey_okay: 1,
        dynamic_whey_okay: 1,
      });

      requireSuccess(applyMigration(container), "identical rerun");
      assert.deepEqual(counts(container), before);
      assert.deepEqual(state(container), {
        fit_variants: 3,
        fit_mappings: 3,
        fit_offers: 3,
        fit_clicks: 2,
        old_whey_okay: 1,
        dynamic_whey_okay: 1,
      });

      recreateDatabase(container);
      sql(container, "update products set name='Drifted' where id=510");
      expectBlocked(container, "canonical identity drift");

      recreateDatabase(container);
      sql(
        container,
        "begin; set constraints all deferred; update product_variants set product_id=510 where id=999; update retailer_products set product_id=510 where id=1176; update offers set product_id=510 where id=990; commit;",
      );
      expectBlocked(container, "partial application");

      recreateDatabase(container);
      sql(
        container,
        "insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default,nutrition_override) values(510,'banana-600g','Collision','banana','Banana',600,'g',1,'powder',true,false,'{}')",
      );
      expectBlocked(container, "target collision");

      recreateDatabase(container);
      sql(
        container,
        "insert into retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_url,match_method,match_confidence) values(9999,1,337,999,'Unrelated','https://example.test','fixture',100)",
      );
      expectBlocked(container, "unrelated variant consumer");
    } finally {
      run("docker", ["rm", "--force", container], 30_000);
    }
  },
);
