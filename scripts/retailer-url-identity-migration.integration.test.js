const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "retailer-url-identity-local-only";
const FILES = {
  baseline: "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
  setup: "supabase/test/product_variants_stage2_migration_test.sql",
  stage2: "supabase/migrations/20260713130000_product_variants_stage2.sql",
  forward:
    "supabase/migrations/20260723160000_allow_exact_retailer_variants_to_share_product_urls.sql",
  refinement:
    "supabase/migrations/20260723161000_allow_exact_retailer_variants_to_share_legacy_parent_url_evidence.sql",
  rollback:
    "supabase/manual/20260723160000_allow_exact_retailer_variants_to_share_product_urls_rollback.sql",
  refinementRollback:
    "supabase/manual/20260723161000_allow_exact_retailer_variants_to_share_legacy_parent_url_evidence_rollback.sql",
  preflight: "supabase/manual/20260723160000_retailer_url_identity_preflight.sql",
  post:
    "supabase/manual/20260723160000_retailer_url_identity_post_validation.sql",
};

function run(command, args, timeout = 180_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
}
function output(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}
function succeed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function fail(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(output(result), pattern, label);
  return result;
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0;
}
function exec(container, args, timeout = 180_000) {
  return run(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${PASSWORD}`,
      "-e",
      "PGHOST=127.0.0.1",
      container,
      ...args,
    ],
    timeout,
  );
}
function psql(container, database, sql) {
  return exec(container, [
    "psql",
    "-X",
    "--no-psqlrc",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
    "-c",
    sql,
  ]);
}
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", `/workspace/${file}`);
  return exec(container, args);
}
function psqlText(container, database, sql) {
  return exec(container, [
    "psql",
    "-X",
    "--no-psqlrc",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
    "-c",
    sql,
  ]);
}
function json(container, database, sql) {
  const result = succeed(
    exec(container, [
      "psql",
      "-X",
      "--no-psqlrc",
      "-At",
      "-U",
      "postgres",
      "-d",
      database,
      "-c",
      sql,
    ]),
    "JSON query",
  );
  return JSON.parse(result.stdout.trim());
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"], 5_000).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}

const STATE_SQL = `
select jsonb_build_object(
  'counts', jsonb_build_object(
    'retailer_products',(select count(*) from public.retailer_products),
    'offers',(select count(*) from public.offers),
    'price_history',(select count(*) from public.price_history)
  ),
  'fingerprints', jsonb_build_object(
    'retailer_products',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.retailer_products t),
    'offers',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.offers t),
    'price_history',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]')) from public.price_history t)
  )
)::text`;

const SCENARIOS_SQL = `
begin;
insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default)
values
  (990001,510,'shared-a','Shared A',true,false),
  (990002,510,'shared-b','Shared B',true,false),
  (990003,510,'shared-c','Shared C',true,false);

insert into public.retailer_products(
  id,retailer_id,product_id,product_variant_id,external_name,external_url,
  external_product_id,external_variant_id,match_method,match_confidence
) values
  (990000,1,510,603,'Grandfathered legacy','https://local.invalid/shared-parent',null,null,'legacy_url',80),
  (990001,1,510,990001,'Shared A','https://local.invalid/shared-parent','PARENT-1','VARIANT-1','external_id',100),
  (990002,1,510,990002,'Shared B','https://local.invalid/shared-parent','PARENT-1','VARIANT-2','external_id',100);

insert into public.offers(
  id,product_id,retailer_id,product_variant_id,retailer_product_id,price,url,in_stock
) values
  (990000,510,1,603,990000,9,'https://local.invalid/shared-parent',true),
  (990001,510,1,990001,990001,10,'https://local.invalid/shared-parent',true),
  (990002,510,1,990002,990002,11,'https://local.invalid/shared-parent',true);

insert into public.retailer_products(
  id,retailer_id,product_id,product_variant_id,external_name,external_url
) values (
  990008,1,511,604,'Other canonical product legacy','https://local.invalid/cross-product'
);

do $cases$
declare
  v_cases integer := 0;
begin
  begin
    insert into public.retailer_products(
      id,retailer_id,product_id,product_variant_id,external_name,external_url,
      external_product_id,external_variant_id
    ) values (
      990003,1,510,990003,'Duplicate external variant','https://local.invalid/other',
      'PARENT-1','VARIANT-1'
    );
    raise exception 'duplicate external variant accepted';
  exception when unique_violation then v_cases := v_cases + 1;
  end;

  begin
    insert into public.retailer_products(
      id,retailer_id,product_id,product_variant_id,external_name,external_url,
      external_product_id,external_variant_id
    ) values (
      990004,1,510,990001,'Duplicate canonical target','https://local.invalid/canonical',
      'PARENT-1','VARIANT-4'
    );
    raise exception 'duplicate exact canonical target accepted';
  exception when unique_violation then v_cases := v_cases + 1;
  end;

  begin
    insert into public.retailer_products(
      id,retailer_id,product_id,product_variant_id,external_name,external_url
    ) values (
      990005,1,510,990003,'Legacy collision','https://local.invalid/shared-parent'
    );
    raise exception 'legacy/exact URL collision accepted';
  exception when others then
    if sqlerrm not like '%a legacy mapping cannot enter an exact shared parent URL%' then raise; end if;
    v_cases := v_cases + 1;
  end;

  begin
    insert into public.retailer_products(
      id,retailer_id,product_id,product_variant_id,external_name,external_url,
      external_product_id,external_variant_id
    ) values (
      990009,1,510,990003,'Cross-product URL','https://local.invalid/cross-product',
      'PARENT-1','VARIANT-9'
    );
    raise exception 'shared URL canonical product conflict accepted';
  exception when others then
    if sqlerrm not like '%shared parent URL canonical product conflict%' then raise; end if;
    v_cases := v_cases + 1;
  end;

  begin
    insert into public.retailer_products(
      id,retailer_id,product_id,product_variant_id,external_name,external_url,
      external_product_id,external_variant_id
    ) values (
      990006,1,510,990003,'Parent conflict','https://local.invalid/shared-parent',
      'PARENT-2','VARIANT-6'
    );
    raise exception 'shared parent identity conflict accepted';
  exception when others then
    if sqlerrm not like '%shared parent URL external product identity conflict%' then raise; end if;
    v_cases := v_cases + 1;
  end;

  begin
    insert into public.offers(
      id,product_id,retailer_id,product_variant_id,retailer_product_id,price,url,in_stock
    ) values (
      990003,510,1,990001,990001,12,'https://local.invalid/another-offer-url',true
    );
    raise exception 'duplicate offer per mapping accepted';
  exception when unique_violation then v_cases := v_cases + 1;
  end;

  insert into public.retailer_products(
    id,retailer_id,product_id,product_variant_id,external_name,external_url,
    external_product_id,external_variant_id
  ) values (
    990007,2,510,990001,'Retailer-isolated identity','https://local.invalid/shared-parent',
    'PARENT-1','VARIANT-1'
  );
  v_cases := v_cases + 1;

  if v_cases <> 7 then raise exception 'expected 7 identity cases, observed %', v_cases; end if;
end
$cases$;
rollback;
`;

test(
  "retailer URL identity migration is row-preserving, fail-closed, reversible, and permits exact shared-parent variants",
  { skip: !dockerAvailable() && "Docker unavailable" },
  () => {
    const container = `supplementscout-url-identity-${crypto.randomBytes(5).toString("hex")}`;
    const database = "supplementscout_stage2_test_retailer_url_identity";
    const collisionDatabase = `${database}_collision`;
    let primaryError;
    try {
      succeed(
        run("docker", [
          "run",
          "--detach",
          "--rm",
          "--name",
          container,
          "--network",
          "none",
          "-e",
          `POSTGRES_PASSWORD=${PASSWORD}`,
          "-v",
          `${ROOT}:/workspace:ro`,
          IMAGE,
        ]),
        "start PostgreSQL",
      );
      wait(container);
      succeed(exec(container, ["createdb", "-U", "postgres", database]), "create database");
      succeed(
        psql(
          container,
          database,
          "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;",
        ),
        "create roles",
      );
      succeed(psqlFile(container, database, FILES.baseline), "baseline");
      succeed(
        psqlFile(container, database, FILES.setup, [
          "stage2_test_database_confirmed=1",
          "stage2_test_host=127.0.0.1",
          `stage2_expected_database=${database}`,
          "stage2_scenario=success",
        ]),
        "Stage 2 fixture",
      );
      succeed(psqlFile(container, database, FILES.stage2), "Stage 2 migration");
      succeed(
        psql(
          container,
          database,
          "update public.retailer_products set external_product_id=null,external_variant_id=null,external_sku=null,external_gtin=null,external_options=null where id in (137,549)",
        ),
        "align historical GymHigh duplicate with live legacy identity state",
      );
      succeed(psqlFile(container, database, FILES.preflight), "read-only preflight");

      succeed(
        exec(container, ["createdb", "-U", "postgres", "-T", database, collisionDatabase]),
        "clone collision database",
      );
      succeed(
        psql(
          container,
          collisionDatabase,
          `insert into public.retailer_products(
             id,retailer_id,product_id,product_variant_id,external_name,external_url,
             external_product_id,external_variant_id
           ) values
             (990010,1,510,603,'Exact collision A','https://local.invalid/a','PARENT-X','VARIANT-X1'),
             (990011,1,510,603,'Exact collision B','https://local.invalid/b','PARENT-X','VARIANT-X2')`,
        ),
        "inject exact canonical collision",
      );
      fail(
        psqlFile(container, collisionDatabase, FILES.forward),
        "collision preflight",
        /exact mappings collide on canonical retailer variants/,
      );
      const collisionSchema = json(
        container,
        collisionDatabase,
        `select jsonb_build_object(
          'old_mapping',to_regclass('public.retailer_products_retailer_url_unique') is not null,
          'old_offer',to_regclass('public.offers_retailer_url_unique') is not null,
          'new_exact',to_regclass('public.retailer_products_retailer_exact_canonical_variant_unique_idx') is not null
        )::text`,
      );
      assert.deepEqual(collisionSchema, {
        old_mapping: true,
        old_offer: true,
        new_exact: false,
      });

      const before = json(container, database, STATE_SQL);
      succeed(psqlFile(container, database, FILES.forward), "forward migration");
      succeed(psqlFile(container, database, FILES.refinement), "legacy-parent refinement migration");
      const after = json(container, database, STATE_SQL);
      assert.deepEqual(after, before, "forward migration changed business data");
      succeed(psqlFile(container, database, FILES.post), "post-validation");
      succeed(psqlText(container, database, SCENARIOS_SQL), "shared-parent and guard scenarios");
      assert.deepEqual(json(container, database, STATE_SQL), before, "scenarios escaped rollback");

      succeed(psqlFile(container, database, FILES.refinementRollback), "refinement rollback");
      succeed(psqlFile(container, database, FILES.rollback), "base rollback migration");
      assert.deepEqual(json(container, database, STATE_SQL), before, "rollback changed business data");
      succeed(psqlFile(container, database, FILES.preflight), "post-rollback preflight");

      const installedSql = fs.readFileSync(path.join(ROOT, FILES.forward), "utf8");
      const interruptedSql = installedSql.replace(
        "alter table public.retailer_products\n  drop constraint retailer_products_retailer_url_unique;",
        "do $injected$ begin raise exception 'INJECTED_URL_IDENTITY_FAILURE'; end $injected$;\n\nalter table public.retailer_products\n  drop constraint retailer_products_retailer_url_unique;",
      );
      fail(
        psqlText(container, database, interruptedSql),
        "injected failure",
        /INJECTED_URL_IDENTITY_FAILURE/,
      );
      assert.deepEqual(json(container, database, STATE_SQL), before, "injected failure changed data");
      succeed(psqlFile(container, database, FILES.preflight), "injected failure schema rollback");

      succeed(psqlFile(container, database, FILES.forward), "forward migration after rollback");
      succeed(psqlFile(container, database, FILES.refinement), "refinement migration after rollback");
      assert.deepEqual(json(container, database, STATE_SQL), before, "reapply changed business data");
      fail(
        psqlFile(container, database, FILES.forward),
        "deterministic rerun",
        /exact legacy retailer_products URL constraint is missing/,
      );
      assert.deepEqual(json(container, database, STATE_SQL), before, "rerun failure changed data");
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      const cleanup = run("docker", ["rm", "--force", container], 30_000);
      if (!primaryError && cleanup.status !== 0) {
        assert.fail(`cleanup failed:\n${output(cleanup)}`);
      }
    }
  },
);
