const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION =
  "supabase/migrations/20260726210000_add_reviewed_variant_nutrition_apply.sql";
const IMAGE = "postgres:17-alpine";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeout || 180_000,
    input: options.input,
  });
}

function output(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function ok(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label}:\n${output(result)}`);
  return result;
}

function dockerAvailable() {
  return run(
    "docker",
    ["version", "--format", "{{.Server.Version}}"],
    { timeout: 10_000 }
  ).status === 0;
}

function exec(container, args, options = {}) {
  return run(
    "docker",
    ["exec", ...(options.stdin ? ["-i"] : []), container, ...args],
    options
  );
}

function sql(container, text, user = "postgres") {
  return exec(
    container,
    [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
      "-U", user, "-d", "postgres", "-tA", "-f", "-",
    ],
    { stdin: true, input: text }
  );
}

function literal(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function wait(container) {
  let consecutive = 0;
  for (let index = 0; index < 80; index += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"]).status === 0) {
      consecutive += 1;
      if (consecutive === 2) return;
    } else {
      consecutive = 0;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL unavailable");
}

function setupSql() {
  return `
create extension pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role login;
create table public.products(
  id bigint primary key,
  name text not null,
  is_active boolean not null,
  merged_into_product_id bigint,
  merged_at timestamptz
);
create table public.product_variants(
  id bigint primary key,
  product_id bigint not null references public.products(id),
  variant_key text not null,
  display_name text not null,
  nutrition_override jsonb not null default '{}'::jsonb,
  is_active boolean not null
);
create function public.atomic_import_has_exact_keys(p jsonb,k text[]) returns boolean
language sql immutable as $$
  select jsonb_typeof(p)='object'
    and (select array_agg(key order by key) from jsonb_object_keys(p) key)
      =(select array_agg(x order by x) from unnest(k)x)
$$;
create function public.atomic_import_canonical_json(v jsonb) returns text
language plpgsql immutable strict set search_path=pg_catalog as $$
declare result text;
begin
  case jsonb_typeof(v)
    when 'object' then
      select '{'||coalesce(string_agg(to_jsonb(entry.key)::text||':'||
        public.atomic_import_canonical_json(entry.value),',' order by entry.key),'')||'}'
      into result from jsonb_each(v) entry;
    when 'array' then
      select '['||coalesce(string_agg(
        public.atomic_import_canonical_json(entry.value),',' order by entry.ordinality),'')||']'
      into result from jsonb_array_elements(v) with ordinality entry(value,ordinality);
    else result:=v::text;
  end case;
  return result;
end
$$;
create function public.retailer_catalogue_sha256_json(v jsonb) returns text
language sql immutable as $$
  select encode(digest(convert_to(public.atomic_import_canonical_json(v),'UTF8'),'sha256'),'hex')
$$;
create function public.retailer_catalogue_actual_database_target() returns jsonb
language sql stable as $$
  select '{"target_environment":"STAGING"}'::jsonb
$$;
insert into public.products values
  (10,'First Protein',true,null,null),
  (20,'Second Protein',true,null,null),
  (30,'Atomic Protein',true,null,null),
  (40,'Atomic Protein Two',true,null,null);
insert into public.product_variants values
  (100,10,'vanilla-1000g','Vanilla / 1kg','{}',true),
  (200,20,'chocolate-2000g','Chocolate / 2kg','{}',true),
  (300,30,'berry-1000g','Berry / 1kg','{}',true),
  (400,40,'plain-1000g','Plain / 1kg','{"unexpected":true}',true);
`;
}

function after(weight, servings, servingSize, protein, sourceUrl) {
  return {
    net_weight_g: weight,
    serving_count_verified: servings,
    serving_size_g: servingSize,
    protein_per_serving_g: protein,
    creatine_per_serving_g: null,
    product_format: "powder",
    unit_pricing_verified: true,
    nutrition_verified: true,
    source_url: sourceUrl,
    source_type: "manufacturer_product_page",
    evidence: "Manufacturer product page confirms the reviewed package and serving values.",
  };
}

function change(productId, productName, variantId, key, display, next, before = {}) {
  return {
    product_id: String(productId),
    expected_product_name: productName,
    variant_id: String(variantId),
    expected_variant_key: key,
    expected_display_name: display,
    before_nutrition_override: before,
    after_nutrition_override: next,
    source_url: next.source_url,
    evidence: next.evidence,
  };
}

function contract(changes, overrides = {}) {
  const value = {
    schema_version: 1,
    kind: "reviewed-product-variant-nutrition-v1",
    authorization_id: "nutrition-batch-1-staging",
    target_environment: "STAGING",
    reviewed_manifest_sha256: "a".repeat(64),
    reviewed_scope_hash: fingerprint(changes),
    authorized_by: "user-approved-nutrition-enrichment",
    authorized_at: "2026-07-26T18:00:00.000Z",
    changes,
    ...overrides,
  };
  value.reviewed_contract_hash = fingerprint(value);
  return value;
}

test(
  "reviewed nutrition migration is owner-only, hash-locked, atomic and idempotent",
  { skip: !dockerAvailable() && "Docker unavailable" },
  () => {
    const container = `variant-nutrition-${crypto.randomBytes(5).toString("hex")}`;
    try {
      ok(run("docker", [
        "run", "--detach", "--rm", "--name", container, "--network", "none",
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
        "-v", `${ROOT}:/workspace:ro`, IMAGE,
      ]), "start");
      wait(container);
      ok(sql(container, setupSql()), "setup");
      ok(exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
        "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`,
      ]), "migration");

      const beforeRerun = ok(sql(container, `
        select
          (select count(*) from public.product_variant_nutrition_reviewed_applications)
          ||':'||
          (select count(*) from pg_proc
           where proname='apply_reviewed_product_variant_nutrition');
      `), "before rerun").stdout.trim();
      const rerun = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
        "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`,
      ]);
      assert.notEqual(rerun.status, 0);
      assert.match(output(rerun), /already installed; rerun rejected/);
      const afterRerun = ok(sql(container, `
        select
          (select count(*) from public.product_variant_nutrition_reviewed_applications)
          ||':'||
          (select count(*) from pg_proc
           where proname='apply_reviewed_product_variant_nutrition');
      `), "after rerun").stdout.trim();
      assert.equal(afterRerun, beforeRerun);

      const changes = [
        change(
          10, "First Protein", 100, "vanilla-1000g", "Vanilla / 1kg",
          after(1000, 40, 25, 20, "https://manufacturer.example/first")
        ),
        change(
          20, "Second Protein", 200, "chocolate-2000g", "Chocolate / 2kg",
          after(2000, 80, 25, 21, "https://manufacturer.example/second")
        ),
      ];
      const reviewed = contract(changes);

      const serviceBlocked = sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(reviewed)},true);`,
        "service_role"
      );
      assert.notEqual(serviceBlocked.status, 0);
      assert.match(output(serviceBlocked), /permission denied for function/);

      const dryRun = ok(sql(container, `
        begin read only;
        select public.apply_reviewed_product_variant_nutrition(${literal(reviewed)},true);
        rollback;
      `), "read-only dry-run");
      assert.match(dryRun.stdout, /"status": "READY"/);
      assert.match(dryRun.stdout, /"business_writes": 0/);
      assert.equal(
        ok(sql(container, `
          select count(*)||':'||
            (select count(*) from public.product_variants
             where nutrition_override <> '{}'::jsonb)
          from public.product_variant_nutrition_reviewed_applications;
        `), "zero writes").stdout.trim(),
        "0:1"
      );

      const badHash = structuredClone(reviewed);
      badHash.reviewed_scope_hash = "b".repeat(64);
      delete badHash.reviewed_contract_hash;
      badHash.reviewed_contract_hash = fingerprint(badHash);
      const hashBlocked = sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(badHash)},true);`
      );
      assert.notEqual(hashBlocked.status, 0);
      assert.match(output(hashBlocked), /PVN_SOURCE_HASH_MISMATCH/);

      const identityDrift = structuredClone(reviewed);
      identityDrift.changes[0].expected_variant_key = "drift";
      identityDrift.reviewed_scope_hash = fingerprint(identityDrift.changes);
      delete identityDrift.reviewed_contract_hash;
      identityDrift.reviewed_contract_hash = fingerprint(identityDrift);
      const identityBlocked = sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(identityDrift)},true);`
      );
      assert.notEqual(identityBlocked.status, 0);
      assert.match(output(identityBlocked), /PVN_IDENTITY_DRIFT/);

      const applied = ok(sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(reviewed)},false);`
      ), "apply");
      assert.match(applied.stdout, /"status": "APPLIED"/);
      assert.match(applied.stdout, /"business_writes": 2/);
      assert.match(applied.stdout, /"control_plane_writes": 1/);
      assert.equal(
        ok(sql(container, `
          select
            (select count(*) from public.product_variant_nutrition_reviewed_applications)
            ||':'||
            (select count(*) from public.product_variants
             where nutrition_override <> '{}'::jsonb);
        `), "post apply").stdout.trim(),
        "1:3"
      );

      const replay = ok(sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(reviewed)},false);`
      ), "idempotent replay");
      assert.match(replay.stdout, /"status": "ALREADY_APPLIED"/);
      assert.match(replay.stdout, /"business_writes": 0/);

      ok(sql(container, `
        update public.product_variants set nutrition_override='{}' where id=100;
      `), "create partial drift");
      const partialBlocked = sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(reviewed)},false);`
      );
      assert.notEqual(partialBlocked.status, 0);
      assert.match(output(partialBlocked), /PVN_PARTIAL_APPLY/);

      const atomicChanges = [
        change(
          30, "Atomic Protein", 300, "berry-1000g", "Berry / 1kg",
          after(1000, 40, 25, 20, "https://manufacturer.example/atomic")
        ),
        change(
          40, "Atomic Protein Two", 400, "plain-1000g", "Plain / 1kg",
          after(1000, 40, 25, 20, "https://manufacturer.example/atomic-two"),
          {}
        ),
      ];
      const atomicContract = contract(atomicChanges, {
        authorization_id: "nutrition-atomic-staging",
        reviewed_manifest_sha256: "c".repeat(64),
      });
      delete atomicContract.reviewed_contract_hash;
      atomicContract.reviewed_contract_hash = fingerprint(atomicContract);
      const atomicBlocked = sql(
        container,
        `select public.apply_reviewed_product_variant_nutrition(${literal(atomicContract)},false);`
      );
      assert.notEqual(atomicBlocked.status, 0);
      assert.match(output(atomicBlocked), /PVN_STATE_DRIFT/);
      assert.equal(
        ok(sql(container, `
          select nutrition_override='{}'::jsonb
          from public.product_variants where id=300;
        `), "atomic no partial write").stdout.trim(),
        "t"
      );
    } finally {
      run("docker", ["rm", "--force", container], { timeout: 20_000 });
    }
  }
);
