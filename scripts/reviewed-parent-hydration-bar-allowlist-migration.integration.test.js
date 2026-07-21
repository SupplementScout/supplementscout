const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const password = "hydration-bar-local-only";
const migration = "supabase/migrations/20260721190000_allow_reviewed_jons_hydration_bar_parent_variants.sql";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0;
}
function exec(container, args, timeout) {
  return run("docker", ["exec", "-e", `PGPASSWORD=${password}`, container, ...args], timeout);
}
function wait(container) {
  for (let index = 0; index < 80; index += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"], 5_000).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL not ready");
}

test("reviewed hydration/bar allowlist migration passes exact families and blocks boundary drift", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `supplementscout-hydration-bar-${crypto.randomBytes(5).toString("hex")}`;
  let failure;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${password}`, "-v", `${root}:/workspace:ro`, image]), "start PostgreSQL");
    wait(container);
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `
      create schema if not exists public;
      create function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) returns boolean language sql immutable as $fn$ select false $fn$;
      create function public.validate_product_import_plan_read_only(jsonb) returns jsonb language sql as $fn$ select '{}'::jsonb $fn$;
      create function public.apply_product_import_plan(jsonb) returns jsonb language sql as $fn$ select '{}'::jsonb $fn$;
    `]), "create exact preflight functions");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", `/workspace/${migration}`]), "apply hydration/bar migration");
    const result = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-U", "postgres", "-c", `
      select jsonb_build_object(
        'exact_passes', (
          select count(*) from (values
            ('Conteh Sports Hydra Flow 300g','Conteh Sports','Health Supplements','powder','300','g'),
            ('PER4M Hydrate Electrolyte Mix 210g','PER4M','Health Supplements','powder','210','g'),
            ('PER4M Protein Bars Box of 12 x 62g','PER4M','Protein Bars','bar','62','g'),
            ('Strom Sports HydraMax 420g','Strom','Health Supplements','powder','420','g'),
            ('Strom Sports HydraMax 1.08kg','Strom','Health Supplements','powder','1080','g')
          ) x(n,b,c,f,s,u) where public.atomic_import_reviewed_parent_variant_allowed(n,b,c,f,s,u)
        ),
        'legacy_preserved', public.atomic_import_reviewed_parent_variant_allowed('CNP Premium Whey 2kg','CNP','Whey Protein','powder','2000','g'),
        'wrong_size_blocked', not public.atomic_import_reviewed_parent_variant_allowed('Strom Sports HydraMax 420g','Strom','Health Supplements','powder','1080','g'),
        'wrong_format_blocked', not public.atomic_import_reviewed_parent_variant_allowed('PER4M Protein Bars Box of 12 x 62g','PER4M','Protein Bars','powder','62','g'),
        'wrong_category_blocked', not public.atomic_import_reviewed_parent_variant_allowed('PER4M Hydrate Electrolyte Mix 210g','PER4M','Amino Acids','powder','210','g'),
        'unreviewed_blocked', not public.atomic_import_reviewed_parent_variant_allowed('PER4M Protein Powder 2kg','PER4M','Whey Protein','powder','2000','g')
      );
    `]);
    ok(result, "validate exact allowlist");
    const value = JSON.parse(result.stdout.trim());
    assert.deepEqual(value, {
      exact_passes: 5,
      legacy_preserved: true,
      wrong_size_blocked: true,
      wrong_format_blocked: true,
      wrong_category_blocked: true,
      unreviewed_blocked: true,
    });
  } catch (error) { failure = error; }
  finally {
    const cleanup = run("docker", ["rm", "--force", container], 30_000);
    if (!failure && cleanup.status !== 0) failure = new Error(`cleanup failed: ${output(cleanup)}`);
  }
  if (failure) throw failure;
});
