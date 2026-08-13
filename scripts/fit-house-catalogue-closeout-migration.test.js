const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(
  root,
  "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
);
const migration = path.join(
  root,
  "supabase/migrations/20260726150000_seed_reviewed_fit_house_catalogue_closeout.sql",
);
const manifestPath = path.join(
  root,
  "config/retailers/fit-house-catalogue-closeout-a301eaa3.json",
);
const database = "supplementscout_fit_house_closeout_test";
const image = "postgres:17-alpine";
const sqlText = fs.readFileSync(migration, "utf8");
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const newProducts = JSON.parse(
  sqlText.match(/\$fit_house_new_products\$\s*([\s\S]*?)\s*\$fit_house_new_products\$::jsonb/)[1],
);
const variants = JSON.parse(
  sqlText.match(/\$fit_house_new_variants\$\s*([\s\S]*?)\s*\$fit_house_new_variants\$::jsonb/)[1],
);
const existingVariantCreates = JSON.parse(
  sqlText.match(/\$fit_house_existing_variant_creates\$\s*([\s\S]*?)\s*\$fit_house_existing_variant_creates\$::jsonb/)[1],
);
const existingTargets = JSON.parse(
  sqlText.match(/\$fit_house_existing_targets\$\s*([\s\S]*?)\s*\$fit_house_existing_targets\$::jsonb/)[1],
);

function run(command, args, timeout = 120000) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    windowsHide: true,
  });
}
function ok(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.stdout || ""}\n${result.stderr || ""}`);
  return result;
}
function dockerAvailable() {
  return run("docker", ["info"], 20000).status === 0;
}
function exec(container, args, timeout = 120000) {
  return run("docker", ["exec", container, ...args], timeout);
}
function psql(container, args) {
  return exec(container, [
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
    ...args,
  ]);
}
function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function query(container, statement) {
  return ok(psql(container, ["-At", "-c", statement]), "SQL").stdout.trim();
}
function apply(container) {
  return psql(container, [
    "-f",
    `/workspace/${path.relative(root, migration).replaceAll("\\", "/")}`,
  ]);
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres", "-d", "postgres"], 5000).status === 0) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL unavailable");
}
function recreate(container) {
  ok(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop db");
  ok(exec(container, ["createdb", "-U", "postgres", database]), "create db");
  ok(psql(container, [
    "-c",
    "do $roles$ begin "
      + "if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; "
      + "if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; "
      + "if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; "
      + "end $roles$;",
  ]), "create baseline roles");
  ok(psql(container, ["-f", `/workspace/${path.relative(root, baseline).replaceAll("\\", "/")}`]), "baseline");
  query(
    container,
    `insert into retailers(id,name,slug,website) values(9,'Fit House','fit-house','https://fithouse.uk');`
      + `insert into products(id,name,slug,brand,category,is_active) values ${
        existingTargets.map((row) =>
          `(${row.id},${literal(row.name)},${literal(row.slug)},${literal(row.brand)},${literal(row.category)},true)`
        ).join(",")
      };`
      + `insert into product_variants(product_id,variant_key,display_name,is_default,is_active)`
      + ` select id,'default','Default',true,true from products;`,
  );
}
function state(container) {
  return JSON.parse(query(
    container,
    "select jsonb_build_object("
      + "'products',(select count(*) from products),"
      + "'variants',(select count(*) from product_variants),"
      + "'mappings',(select count(*) from retailer_products),"
      + "'offers',(select count(*) from offers),"
      + "'history',(select count(*) from price_history))",
  ));
}

test("Fit House closeout manifest and SQL have the exact reviewed contract", () => {
  assert.equal(manifest.source_fingerprint,
    "a301eaa3b9cb54910c2857aef3f46513f091c9dd447f94191be3e0f8f9a6d58e");
  assert.equal(manifest.previously_approved_rebind_products, 67);
  assert.equal(manifest.new_review_source_products, 63);
  assert.equal(manifest.existing_canonical_targets, 6);
  assert.equal(newProducts.length, 56);
  assert.equal(variants.length, 117);
  assert.equal(variants.filter((row) => row.is_default).length, 56);
  assert.equal(existingVariantCreates.length, 16);
  assert.equal(manifest.reviewed_new_source_bindings.length, 99);
  assert.equal(manifest.reviewed_existing_target_bindings.length, 7);
  assert.equal(manifest.reviewed_partial_source_bindings.length, 22);
  assert.deepEqual(manifest.reviewed_new_canonical_products, newProducts);
  assert.deepEqual(manifest.reviewed_new_canonical_variants, variants);
  assert.equal(
    crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    "29c49b8a11492e5417c8e794c3e6464d6f1e8230db5aa21cd8fb0e6f3c282b58",
  );
  assert.match(sqlText, /^begin;/i);
  assert.match(sqlText, /commit;\s*$/i);
  assert.doesNotMatch(
    sqlText,
    /\b(insert into|update|delete from|truncate)\s+public\.(retailer_products|offers|price_history|retailers)/i,
  );
  assert.doesNotMatch(sqlText, /safe_update|guard_threshold|shipping/i);
});

test(
  "Fit House closeout migration applies atomically and reruns idempotently",
  { skip: !dockerAvailable() && "Docker unavailable" },
  () => {
    const container = `supplementscout-fit-house-closeout-${crypto.randomBytes(5).toString("hex")}`;
    try {
      ok(run("docker", [
        "run",
        "--detach",
        "--rm",
        "--name",
        container,
        "--network",
        "none",
        "-e",
        "POSTGRES_PASSWORD=fit-house-local-only",
        "-v",
        `${root}:/workspace:ro`,
        image,
      ], 180000), "start container");
      wait(container);
      recreate(container);
      const before = state(container);
      ok(apply(container), "first apply");
      const after = state(container);
      assert.equal(after.products, before.products + 56);
      assert.equal(after.variants, before.variants + 133);
      assert.equal(after.mappings, before.mappings);
      assert.equal(after.offers, before.offers);
      assert.equal(after.history, before.history);
      ok(apply(container), "idempotent rerun");
      assert.deepEqual(state(container), after);

      recreate(container);
      query(container, "update products set brand='Drifted' where id=421");
      const drifted = state(container);
      assert.notEqual(apply(container).status, 0);
      assert.deepEqual(state(container), drifted);
    } finally {
      run("docker", ["rm", "--force", container], 30000);
    }
  },
);
