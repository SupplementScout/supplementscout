const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const password = "nutrition-policy-local-only";
const migration = "supabase/migrations/20260721200000_allow_reviewed_jons_nutrition_families.sql";
function run(command, args, timeout = 120000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout }); }
function ok(result, label) { assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`); return result.stdout.trim(); }
function exec(container, args) { return run("docker", ["exec", container, ...args]); }

test("reviewed nutrition DB policy accepts exact families and blocks prohibited identities", () => {
  const container = `supplementscout-nutrition-${process.pid}-${Date.now()}`;
  ok(run("docker", ["run", "--detach", "--rm", "--name", container, "-e", `POSTGRES_PASSWORD=${password}`, "-v", `${root.replaceAll("\\", "/")}:/workspace:ro`, image]), "start postgres");
  let failure;
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const ready = exec(container, ["pg_isready", "-U", "postgres"]); if (ready.status === 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `
      create function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) returns boolean language sql immutable as $fn$ select false $fn$;
      create function public.validate_product_import_plan_read_only(p_plan jsonb) returns jsonb language plpgsql as $fn$
      declare v_variant_action text := p_plan#>>'{product_variant,action}';
      begin
        if v_variant_action <> 'create_reviewed_variant' then return '{}'::jsonb; end if;
        return '{"reviewed":true}'::jsonb;
      end $fn$;
      create function public.apply_product_import_plan(jsonb) returns jsonb language sql as $fn$ select '{}'::jsonb $fn$;
    `]), "create policy stubs");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", `/workspace/${migration}`]), "apply migration");
    const exact = JSON.parse(ok(exec(container, ["psql", "-X", "--no-psqlrc", "-A", "-t", "-U", "postgres", "-c", `
      select jsonb_build_object(
        'carbmax',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports CarbMax 1.5kg','Strom','Health Supplements','powder','1500','g'),
        'plant',public.atomic_import_reviewed_parent_variant_allowed('PER4M Plant Protein 2kg','PER4M','Whey Protein','powder','2000','g'),
        'nihpro',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports Nihpro Hydrolysed Protein Isolate 40 Servings','Strom','Whey Protein','powder','40','servings'),
        'wrong_size',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports CarbMax 1.5kg','Strom','Health Supplements','powder','2500','g'),
        'unreviewed',public.atomic_import_reviewed_parent_variant_allowed('Strom Arbitrary 1.5kg','Strom','Health Supplements','powder','1500','g'));
    `]), "query policy"));
    assert.deepEqual(exact, { carbmax: true, plant: true, nihpro: true, wrong_size: false, unreviewed: false });
    const blocked = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `select public.validate_product_import_plan_read_only('{"product":{"values":{"name":"Optimised Research Labs AN-VAR Oxandro 60 Capsules","brand":"Optimised Research Labs"}},"product_variant":{"action":"existing"}}'::jsonb);`]);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /prohibited catalogue type: SARM or peptide/);
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `select public.validate_product_import_plan_read_only('{"product":{"values":{"name":"CNP Peptide Whey Protein Blend 2.27kg","brand":"CNP"}},"product_variant":{"action":"existing"}}'::jsonb);`]), "ordinary protein peptide remains allowed");
  } catch (error) { failure = error; }
  finally { run("docker", ["rm", "--force", container], 30000); }
  if (failure) throw failure;
});
