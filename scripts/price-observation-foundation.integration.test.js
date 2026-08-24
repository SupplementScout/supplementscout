const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const migration = path.join(root, "supabase/migrations/20260824160000_add_identity_proven_price_observations.sql");
const rollback = path.join(root, "supabase/rollbacks/20260824160000_add_identity_proven_price_observations.sql");
const stage2Setup = path.join(root, "supabase/test/product_variants_stage2_migration_test.sql");
const prerequisites = [
  "20260712211120_baseline_current_public_schema.sql",
  "20260713130000_product_variants_stage2.sql",
  "20260713180000_atomic_product_import_rpc.sql",
  "20260713190000_approved_import_plan_ledger.sql",
  "20260713200000_legacy_mapping_upgrade_rpc.sql",
  "20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  "20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql",
  "20260715234500_align_approval_product_format_normalization.sql",
  "20260716003000_support_optioned_legacy_mapping_upgrade.sql",
  "20260716004000_support_optioned_parent_size_evidence.sql",
  "20260716005000_allow_optioned_legacy_identity_update_null_total.sql",
  "20260717120000_create_retailer_catalogue_control_ledger.sql",
  "20260717140000_add_staging_retailer_catalogue_executor.sql",
  "20260718150000_add_verified_no_change_offer_refresh.sql",
].map((name) => path.join(root, "supabase/migrations", name));

function run(command, args, timeout = 180_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout });
}
function runAsync(command, args, timeout = 180_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root });
    const stdout = [];
    const stderr = [];
    let error;
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (cause) => { error = cause; });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), error });
    });
  });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function requireFailure(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly passed`);
  assert.match(output(result), pattern);
}
function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}
function exec(container, args, timeout = 180_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=identity-local-only", container, ...args], timeout);
}
function containerPath(file) { return `/workspace/${path.relative(root, file).replaceAll("\\", "/")}`; }
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", containerPath(file));
  return exec(container, args);
}
function psql(container, database, sql) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", sql]);
}
function json(container, database, sql) {
  const result = requireSuccess(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-tA", "-c", sql]), "JSON query");
  return JSON.parse(result.stdout.trim());
}
async function jsonAsync(container, database, sql) {
  const result = await runAsync("docker", ["exec", "-e", "PGPASSWORD=identity-local-only", container,
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-tA", "-c", sql]);
  requireSuccess(result, "concurrent JSON query");
  return JSON.parse(result.stdout.trim());
}
function waitForPostgres(container) {
  let consecutive = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000);
    consecutive = result.status === 0 && result.stdout.trim() === "1" ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}

test("identity-proven recorder is immutable, fail-closed, idempotent and fully rollbackable", { skip: !dockerAvailable() && "Docker daemon unavailable" }, async (t) => {
  const container = `supplementscout-price-observation-${crypto.randomBytes(5).toString("hex")}`;
  const database = "supplementscout_stage2_test_identity_foundation";
  let primaryError;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=identity-local-only", "-v", `${root}:/workspace:ro`, image]), "start disposable PostgreSQL");
    waitForPostgres(container);
    requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create disposable database");
    requireSuccess(psql(container, database, "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"), "create local roles");
    requireSuccess(psqlFile(container, database, prerequisites[0]), "apply baseline");
    requireSuccess(psqlFile(container, database, stage2Setup, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${database}`, "stage2_scenario=success"]), "seed Product Variants fixture");
    for (const prerequisite of prerequisites.slice(1)) requireSuccess(psqlFile(container, database, prerequisite), `apply ${path.basename(prerequisite)}`);

    const offerId = "9007199254740993";
    const mappingId = "9007199254740995";
    const productId = "9007199254740997";
    const variantId = "9007199254740999";
    const seed = `
      insert into public.retailers(id,name,slug,website) values
        (1,'GYM HIGH','gym-high','https://gymhigh.co.uk'),(3,'Whey Okay','whey-okay','https://wheyokay.com'),
        (7,'Simply Supplements','simply-supplements','https://www.simplysupplements.co.uk'),(9,'Fit House','fit-house','https://fithouse.uk'),
        (10,'Jon''s Supplements','jon-s-supplements','https://jonssupplements.co.uk'),(11,'6 Pack Supplements','6-pack-supplements','https://6pack-supplements.co.uk'),
        (12,'eBay UK','ebay-uk','https://www.ebay.co.uk') on conflict(id) do nothing;
      insert into public.products(id,name,slug,brand,category,unit_count,unit_type,product_format,unit_pricing_verified,is_active)
        values(${productId},'Identity Safe Whey','identity-safe-whey','Test','Whey Protein',40,'serving','powder',true,true);
      insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active,is_default)
        values(${variantId},${productId},'chocolate-1000g','Chocolate / 1kg','chocolate','Chocolate',1000,'g',1,'powder','05000000000001',true,false);
      insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_name,external_url,match_method,match_confidence)
        values(${mappingId},7,${productId},${variantId},'shop-100','variant-200','Identity Safe Whey Chocolate','https://example.test/whey?variant=200','external_id',100);
      insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at)
        values(${offerId},${productId},7,${mappingId},${variantId},20,3.99,23.99,true,'https://example.test/whey?variant=200','2026-08-24T08:00:00Z');
      insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at)
        values(${offerId},19,3.99,22.99,'2026-08-23T08:00:00Z');`;
    requireSuccess(psql(container, database, seed), "seed exact identity fixture");
    requireSuccess(psqlFile(container, database, migration), "apply Stage 2A migration");

    const installed = json(container, database, `select jsonb_build_object(
      'legacy_unproven',(select count(*) from public.price_history where identity_series_id is null),
      'series',(select count(*) from public.price_identity_series),
      'enabled',(select count(*) from public.price_observation_producers where enabled),
      'capable',(select count(*) from public.price_observation_producers where technically_capable),
      'blocked',(select count(*) from public.price_observation_producers where not technically_capable),
      'wrapper',(select position('record_identity_proven_price_observation' in pg_get_functiondef('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure))>0)
    )::text`);
    assert.equal(installed.legacy_unproven >= 1, true);
    assert.deepEqual({ ...installed, legacy_unproven: 1 }, { legacy_unproven: 1, series: 0, enabled: 0, capable: 5, blocked: 2, wrapper: true });

    const disabled = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-disabled','retailer_offer_mixed_batch')::text`);
    assert.equal(disabled.status, "IDENTITY_OBSERVATION_SKIPPED");
    assert.equal(disabled.reason, "PRODUCER_DISABLED");
    assert.equal(json(container, database, "select count(*)::text::jsonb from public.price_identity_series"), 0);

    requireSuccess(psql(container, database, "update public.price_observation_producers set enabled=true where retailer_id=7 and source_importer='retailer_offer_mixed_batch';"), "enable local-only producer fixture");
    const first = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-1','retailer_offer_mixed_batch')::text`);
    assert.equal(first.status, "IDENTITY_OBSERVATION_RECORDED");
    assert.equal(first.evidence_status, "proven");
    assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
    const replay = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-1','retailer_offer_mixed_batch')::text`);
    const sameDay = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-2','retailer_offer_mixed_batch')::text`);
    assert.equal(replay.status, "IDENTITY_OBSERVATION_REPLAYED");
    assert.equal(sameDay.status, "IDENTITY_OBSERVATION_REPLAYED");
    assert.equal(replay.price_history_id, first.price_history_id);
    assert.equal(sameDay.price_history_id, first.price_history_id);

    requireSuccess(psql(container, database, `update public.offers set last_checked_at='2026-08-25T08:00:00Z' where id=${offerId};`), "advance successful source check");
    const secondDay = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-3','retailer_offer_mixed_batch')::text`);
    assert.equal(secondDay.status, "IDENTITY_OBSERVATION_RECORDED");

    requireSuccess(psql(container, database, `update public.offers set price=5,shipping_cost=3.99,total_price=8.99,last_checked_at='2026-08-25T09:00:00Z' where id=${offerId}; insert into public.price_history(offer_id,price,shipping_cost,total_price,checked_at) values(${offerId},5,3.99,8.99,'2026-08-25T09:00:00Z');`), "seed current atomic price-change row");
    const historyId = json(container, database, `select max(id)::text::jsonb from public.price_history where offer_id=${offerId}`);
    const changed = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'delivered_price_changed','run-4','retailer_offer_mixed_batch',${historyId})::text`);
    assert.equal(changed.status, "IDENTITY_OBSERVATION_RECORDED");
    assert.equal(changed.price_history_id, String(historyId));
    assert.equal(changed.evidence_status, "quarantined");
    assert.equal(changed.anomaly_flags.includes("LARGE_PERCENT_CHANGE"), true);

    requireSuccess(psql(container, database, `update public.offers set price=20,shipping_cost=3.99,total_price=23.99,last_checked_at='2026-08-25T10:00:00Z' where id=${offerId};`), "seed rapid return");
    const reversal = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'delivered_price_changed','run-5','retailer_offer_mixed_batch')::text`);
    assert.equal(reversal.anomaly_flags.includes("RAPID_REVERSAL"), true);

    requireSuccess(psql(container, database, `update public.offers set last_checked_at='2026-08-26T08:00:00Z' where id=${offerId};`), "advance concurrent confirmation fixture");
    const concurrent = await Promise.all([
      jsonAsync(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-concurrent-a','retailer_offer_mixed_batch')::text`),
      jsonAsync(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-concurrent-b','retailer_offer_mixed_batch')::text`),
    ]);
    assert.deepEqual(concurrent.map((entry) => entry.status).sort(), ["IDENTITY_OBSERVATION_RECORDED", "IDENTITY_OBSERVATION_REPLAYED"]);
    assert.equal(json(container, database, `select count(*)::text::jsonb from public.price_history where identity_series_id=${first.identity_series_id} and observation_kind='daily_confirmation' and observation_date='2026-08-26'`), 1);

    const beforeFailure = json(container, database, `select jsonb_build_object('history',(select count(*) from public.price_history),'series',(select count(*) from public.price_identity_series),'shipping',(select shipping_cost from public.offers where id=${offerId}))::text`);
    requireSuccess(psql(container, database, `update public.offers set shipping_cost=null,total_price=null,last_checked_at='2026-08-26T08:00:00Z' where id=${offerId};`), "remove shipping locally");
    const missingShipping = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-6','retailer_offer_mixed_batch')::text`);
    assert.equal(missingShipping.reason, "INCOMPLETE_DELIVERED_PRICE_OR_STOCK");
    const afterFailure = json(container, database, `select jsonb_build_object('history',(select count(*) from public.price_history),'series',(select count(*) from public.price_identity_series))::text`);
    assert.equal(afterFailure.history, beforeFailure.history);
    assert.equal(afterFailure.series, beforeFailure.series);

    const variant2 = "9007199254741001";
    requireSuccess(psql(container, database, `insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(${variant2},${productId},'chocolate-2000g','Chocolate / 2kg',2000,'g',1,'powder',true,false); update public.retailer_products set product_variant_id=${variant2},external_variant_id='variant-201' where id=${mappingId}; update public.offers set product_variant_id=${variant2},shipping_cost=3.99,total_price=23.99,last_checked_at='2026-08-26T09:00:00Z' where id=${offerId};`), "rebind local identity fixture");
    const rebound = json(container, database, `select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-7','retailer_offer_mixed_batch')::text`);
    assert.notEqual(rebound.identity_series_id, first.identity_series_id);
    assert.equal(rebound.anomaly_flags.includes("IDENTITY_SERIES_RESET"), true);
    assert.equal(json(container, database, "select count(*)::text::jsonb from public.price_identity_series"), 2);
    requireFailure(psql(container, database, `update public.price_identity_series set product_variant_id=${variant2} where id=${first.identity_series_id};`), "immutable series update", /immutable/);

    const beforeAtomic = json(container, database, `select jsonb_build_object('history',(select count(*) from public.price_history),'checked',(select last_checked_at from public.offers where id=${offerId}))::text`);
    const atomicFailure = psql(container, database, `begin; update public.offers set last_checked_at='2026-08-27T08:00:00Z' where id=${offerId}; select public.record_identity_proven_price_observation(${offerId},'daily_confirmation','run-atomic','retailer_offer_mixed_batch'); do $fail$ begin raise exception 'INJECTED_ATOMIC_FAILURE'; end $fail$; commit;`);
    requireFailure(atomicFailure, "atomic recorder rollback", /INJECTED_ATOMIC_FAILURE/);
    assert.deepEqual(json(container, database, `select jsonb_build_object('history',(select count(*) from public.price_history),'checked',(select last_checked_at from public.offers where id=${offerId}))::text`), beforeAtomic);

    const measurements = json(container, database, `select jsonb_build_object(
      'series_bytes',(select pg_column_size(s) from public.price_identity_series s order by id limit 1),
      'repeated_snapshot_bytes',(select pg_column_size(to_jsonb(s)) from public.price_identity_series s order by id limit 1),
      'observation_bytes',(select pg_column_size(h) from public.price_history h where identity_series_id is not null order by id limit 1),
      'proven',(select count(*) from public.price_history where identity_series_id is not null),
      'legacy',(select count(*) from public.price_history where identity_series_id is null),
      'business_history',(public.retailer_catalogue_business_counts()->>'price_history')::int
    )::text`);
    assert.equal(measurements.series_bytes > 0, true);
    assert.equal(measurements.observation_bytes > 0, true);
    assert.equal(measurements.proven >= 5, true);
    assert.equal(measurements.legacy >= 1, true);
    assert.equal(measurements.business_history < measurements.proven + measurements.legacy, true, "daily confirmations are excluded from legacy business delta accounting");
    t.diagnostic(`local PostgreSQL storage sample: ${JSON.stringify(measurements)}`);

    requireSuccess(psql(container, database, "update public.price_observation_producers set enabled=false; truncate table public.price_history,public.price_identity_series restart identity;"), "prepare pre-accrual rollback fixture");
    requireSuccess(psqlFile(container, database, rollback), "apply full pre-accrual rollback");
    const rolledBack = json(container, database, `select jsonb_build_object(
      'series',to_regclass('public.price_identity_series') is null,
      'producers',to_regclass('public.price_observation_producers') is null,
      'identity_column',not exists(select 1 from information_schema.columns where table_schema='public' and table_name='price_history' and column_name='identity_series_id'),
      'recorder',to_regprocedure('public.record_identity_proven_price_observation(bigint,text,text,text,bigint)') is null,
      'wrapper_clean',position('record_identity_proven_price_observation' in pg_get_functiondef('public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)'::regprocedure))=0
    )::text`);
    assert.deepEqual(rolledBack, { series: true, producers: true, identity_column: true, recorder: true, wrapper_clean: true });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanup = run("docker", ["rm", "--force", container], 30_000);
    if (!primaryError && cleanup.status !== 0) assert.fail(output(cleanup));
  }
});

test("migration and rollback are additive, legacy-safe and contain no public claim/UI change", () => {
  const sql = fs.readFileSync(migration, "utf8");
  const down = fs.readFileSync(rollback, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /identity_series_id bigint/);
  assert.match(sql, /identity_series_id is null/i, "legacy rows remain explicitly unproven");
  assert.match(sql, /identity_observation_result/);
  assert.match(sql, /PRODUCER_DISABLED/);
  assert.match(sql, /IDENTITY_OBSERVATION_SKIPPED/);
  assert.match(sql, /daily_confirmation/);
  assert.match(sql, /delivered_price_changed/);
  assert.match(sql, /on conflict do nothing/);
  assert.doesNotMatch(sql, /update public\.price_history set identity_series_id[^\n]*where identity_series_id is null\s*;/i, "no broad legacy backfill");
  assert.match(down, /rollback blocked after identity-proven accrual/i);
  assert.doesNotMatch(sql, /price drop|lowest ever|down from|\/deals/i);
});
