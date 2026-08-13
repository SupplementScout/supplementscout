const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { buildArtifact } = require("./gtin-promotion-operation");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const MIGRATIONS = [
  "20260712211120_baseline_current_public_schema.sql",
  "20260713130000_product_variants_stage2.sql",
  "20260713180000_atomic_product_import_rpc.sql",
  "20260713190000_approved_import_plan_ledger.sql",
  "20260813170000_add_guarded_gtin_promotion.sql",
].map((file) => path.join(ROOT, "supabase", "migrations", file));
const STAGE2_SETUP = path.join(ROOT, "supabase", "test", "product_variants_stage2_migration_test.sql");
const ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "20260813170000_add_guarded_gtin_promotion.sql");

function run(command, args, timeout = 120000) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function success(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}:\n${output(result)}`); }
function dockerAvailable() { const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10000); return result.status === 0; }
function exec(container, args, timeout) { return run("docker", ["exec", "-e", "PGPASSWORD=gtin-local-only", container, ...args], timeout); }
function containerPath(file) { return `/workspace/${path.relative(ROOT, file).replaceAll("\\", "/")}`; }
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", containerPath(file));
  return exec(container, args);
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5000);
    if (result.status === 0 && result.stdout.trim() === "1") return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not start");
}
function validGtin(index) {
  const base = `29000000${String(index).padStart(4, "0")}`;
  const sum = [...base].reverse().reduce((total, digit, position) => total + Number(digit) * (position % 2 === 0 ? 3 : 1), 0);
  return `${base}${(10 - sum % 10) % 10}`;
}
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }

function fixture() {
  const products = [];
  const variants = [];
  const rows = [];
  for (let index = 1; index <= 45; index += 1) {
    const productId = String(10000 + index);
    const variantId = String(20000 + index);
    const gtin = validGtin(index);
    products.push({ id: productId, name: `GTIN Product ${index}`, brand: "Integration Brand", product_format: "powder", gtin: null, is_active: true, merged_into_product_id: null });
    variants.push({ id: variantId, product_id: productId, display_name: `Flavour ${index} / 300g`, flavour_label: `Flavour ${index}`, size_value: 300, size_unit: "g", pack_count: 1, product_format: "powder", gtin: null, is_active: true, is_default: false });
    rows.push({ product_id: productId, variant_id: variantId, gtin, destination_field: "product_variants.gtin", current_value: null, proposed_value: gtin, evidence_count: 2, evidence_sources: ["fixture:a", "fixture:b"], blockers: [], decision: "READY_TO_PROMOTE", candidate_source: "INTEGRATION", candidate_fingerprint: crypto.createHash("sha256").update(`candidate:${index}`).digest("hex") });
  }
  const preview = { rows, preview_fingerprint: "a".repeat(64), canonical_snapshot_fingerprint: "b".repeat(64) };
  return { products, variants, artifact: buildArtifact(preview, products, variants, { createdAt: "2099-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:15:00.000Z", runId: "gtin-postgres-integration" }) };
}

test("guarded GTIN promotion runs atomically on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-gtin-${crypto.randomBytes(6).toString("hex")}`;
  const database = "supplementscout_stage2_test_atomic_import_gtin";
  const tempFile = path.join(ROOT, "tmp", `gtin-promotion-integration-${crypto.randomUUID()}.sql`);
  let primaryError;
  try {
    success(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=gtin-local-only", "-v", `${ROOT}:/workspace:ro`, IMAGE], 180000), "start PostgreSQL");
    wait(container);
    success(exec(container, ["createdb", "-U", "postgres", database]), "create database");
    success(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", "create role anon nologin; create role authenticated nologin; create role service_role nologin; create role retailer_catalogue_production_approver nologin; create role retailer_catalogue_production_executor nologin; grant usage on schema public to retailer_catalogue_production_approver,retailer_catalogue_production_executor;"]), "create roles");
    success(psqlFile(container, database, MIGRATIONS[0]), "baseline");
    success(psqlFile(container, database, STAGE2_SETUP, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${database}`, "stage2_scenario=success"]), "stage2 fixture");
    success(psqlFile(container, database, MIGRATIONS[1]), "stage2");
    success(psqlFile(container, database, MIGRATIONS[2]), "atomic importer");
    success(psqlFile(container, database, MIGRATIONS[3]), "approval ledger");

    const { products, variants, artifact } = fixture();
    const quarantineBindings = [[87,38],[58,1007],[58,1607],[58,1611],[49,1028],[49,1596],[49,1597],[49,1598],[291,1040],[291,1691],[291,1692],[291,1693],[232,1017],[232,1812],[232,1813],[27,1593]];
    const quarantineProducts = [...new Set(quarantineBindings.map(([product]) => product))].map((id) => `(${id},'Quarantine ${id}','quarantine-${id}','Fixture','Health Supplements',true)`).join(",");
    const quarantineVariants = quarantineBindings.map(([product, variant]) => `(${variant},${product},'fixture-${variant}','Fixture',true,false)`).join(",");
    const targetProducts = products.map((row) => `(${row.id},${sqlLiteral(row.name)},'gtin-product-${row.id}',${sqlLiteral(row.brand)},'Health Supplements',${sqlLiteral(row.product_format)},true)`).join(",");
    const targetVariants = variants.map((row) => `(${row.id},${row.product_id},'variant-${row.id}',${sqlLiteral(row.display_name)},${sqlLiteral(row.flavour_label)},${row.size_value},${sqlLiteral(row.size_unit)},${row.pack_count},${sqlLiteral(row.product_format)},true,false)`).join(",");
    success(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", `insert into public.products(id,name,slug,brand,category,is_active) values ${quarantineProducts}; insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values ${quarantineVariants}; insert into public.products(id,name,slug,brand,category,product_format,is_active) values ${targetProducts}; insert into public.product_variants(id,product_id,variant_key,display_name,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values ${targetVariants};`]), "seed GTIN fixtures");
    success(psqlFile(container, database, MIGRATIONS[4]), "GTIN promotion migration");
    success(psqlFile(container, database, MIGRATIONS[4]), "GTIN promotion migration rerun");

    const plan = sqlLiteral(JSON.stringify(artifact.plan));
    const scenario = `\set ON_ERROR_STOP on
do $test$
declare
  v_plan jsonb := ${plan}::jsonb;
  v_approval jsonb;
  v_id uuid;
  v_result jsonb;
begin
  if (public.validate_gtin_promotion_plan_read_only(v_plan)->>'row_count') <> '45' then raise exception 'validation count'; end if;
  v_approval := public.approve_gtin_promotion_plan(v_plan,repeat('c',64),'gtin-postgres-integration','integration',now()+interval '15 minutes');
  v_id := (v_approval->>'approval_id')::uuid;
  perform set_config('app.gtin_promotion_test_failpoint','after_first_row',true);
  begin
    perform public.apply_approved_gtin_promotion_plan(v_id,repeat('c',64),v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}','gtin-postgres-integration');
    raise exception 'expected failpoint rejection';
  exception when others then
    if sqlerrm='expected failpoint rejection' then raise; end if;
  end;
  perform set_config('app.gtin_promotion_test_failpoint','',true);
  if exists(select 1 from public.product_variants where id between 20001 and 20045 and gtin is not null) then raise exception 'partial write escaped rollback'; end if;
  if (select status from public.approved_import_plans where id=v_id) <> 'approved' then raise exception 'failed apply consumed approval'; end if;
  v_result := public.apply_approved_gtin_promotion_plan(v_id,repeat('c',64),v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}','gtin-postgres-integration');
  if v_result->>'status'<>'APPLIED' or v_result->>'applied_count'<>'45' then raise exception 'apply result'; end if;
  if (select count(*) from public.product_variants where id between 20001 and 20045 and gtin is not null)<>45 then raise exception 'write count'; end if;
  if (select apply_result->>'applied_count' from public.approved_import_plans where id=v_id)<>'45' then raise exception 'audit result'; end if;
  begin
    perform public.apply_approved_gtin_promotion_plan(v_id,repeat('c',64),v_plan#>>'{meta,plan_fingerprint}',v_plan#>>'{meta,source_row_fingerprint}','gtin-postgres-integration');
    raise exception 'expected replay rejection';
  exception when others then
    if sqlerrm='expected replay rejection' then raise; end if;
  end;
end;
$test$;
do $acl$
begin
  if not has_function_privilege('retailer_catalogue_production_approver','public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz)','execute')
    or has_function_privilege('retailer_catalogue_production_approver','public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)','execute')
    or not has_function_privilege('retailer_catalogue_production_executor','public.apply_approved_gtin_promotion_plan(uuid,text,text,text,text)','execute')
    or has_function_privilege('retailer_catalogue_production_executor','public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz)','execute')
    or has_function_privilege('service_role','public.approve_gtin_promotion_plan(jsonb,text,text,text,timestamptz)','execute') then raise exception 'ACL separation'; end if;
  if (select count(*) from public.gtin_promotion_quarantine)<>16 then raise exception 'quarantine count'; end if;
end;
$acl$;`;
    fs.mkdirSync(path.dirname(tempFile), { recursive: true });
    fs.writeFileSync(tempFile, scenario, "utf8");
    success(psqlFile(container, database, tempFile), "GTIN promotion scenarios");
    const rollbackResult = psqlFile(container, database, ROLLBACK);
    assert.notEqual(rollbackResult.status, 0);
    assert.match(output(rollbackResult), /refusing GTIN promotion rollback while approval audit rows exist/);
  } catch (error) {
    primaryError = error;
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    const stopped = run("docker", ["rm", "--force", container], 30000);
    if (!primaryError && stopped.status !== 0 && !/No such container/i.test(output(stopped))) primaryError = new Error(output(stopped));
  }
  if (primaryError) throw primaryError;
});
