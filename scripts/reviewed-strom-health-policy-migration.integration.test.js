const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const password = "strom-health-policy-local-only";
const migration = "supabase/migrations/20260721210000_allow_reviewed_strom_health_support_families.sql";
function run(command, args, timeout = 120000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout }); }
function ok(result, label) { assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`); return result.stdout.trim(); }
function exec(container, args) { return run("docker", ["exec", container, ...args]); }

test("reviewed Strom health-support DB policy accepts exact families and rejects broad Strom support", () => {
  const container = `supplementscout-strom-health-${process.pid}-${Date.now()}`;
  ok(run("docker", ["run", "--detach", "--rm", "--name", container, "-e", `POSTGRES_PASSWORD=${password}`, "-v", `${root.replaceAll("\\", "/")}:/workspace:ro`, image]), "start postgres");
  let failure;
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (exec(container, ["pg_isready", "-U", "postgres"]).status === 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-c", `
      create function public.atomic_import_reviewed_parent_variant_allowed(text,text,text,text,text,text) returns boolean language sql immutable as $fn$ select false $fn$;
      create function public.validate_product_import_plan_read_only(jsonb) returns jsonb language sql as $fn$ select '{}'::jsonb $fn$;
      create function public.apply_product_import_plan(jsonb) returns jsonb language sql as $fn$ select '{}'::jsonb $fn$;
    `]), "create policy stubs");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-f", `/workspace/${migration}`]), "apply migration");
    const exact = JSON.parse(ok(exec(container, ["psql", "-X", "--no-psqlrc", "-A", "-t", "-U", "postgres", "-c", `
      select jsonb_build_object(
        'focus',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports FocusMax 36 Servings','Strom','Health Supplements','powder','36','servings'),
        'glutathione',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports GlutathioneMAX 200g','Strom','Health Supplements','powder','200','g'),
        'digest',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports DigestMax 480g','Strom','Health Supplements','powder','480','g'),
        'legacy',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports CarbMax 1.5kg','Strom','Health Supplements','powder','1500','g'),
        'wrong_size',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports DigestMax 480g','Strom','Health Supplements','powder','495','g'),
        'unreviewed',public.atomic_import_reviewed_parent_variant_allowed('Strom Sports UnknownMAX 480g','Strom','Health Supplements','powder','480','g'));
    `]), "query policy"));
    assert.deepEqual(exact, { focus: true, glutathione: true, digest: true, legacy: true, wrong_size: false, unreviewed: false });
  } catch (error) { failure = error; }
  finally { run("docker", ["rm", "--force", container], 30000); }
  if (failure) throw failure;
});

