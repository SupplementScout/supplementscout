const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");
const { canonicalJson } = require("./lib/canonical-json");
const { waitForStablePostgres } = require("./lib/docker-postgres-readiness");
const { buildPreparedFormatPackage, packageFingerprint } = require("./lib/reviewed-product-pack-correction");

// Component integration, deliberately separate from a full migration/approval
// integration proof. Runs actual proposed helper DDL against synthetic tables.
// Full consumer lineage, protected RPC roles and concurrency still require the
// current isolated catalogue fixture. Never accepts a URL or remote DB target.
const ROOT = path.resolve(__dirname, "..");
const IMAGE = process.env.SUPPLEMENTSCOUT_PG17_IMAGE || "postgres:17.6";
const PROPOSALS = [
  "20261125100000_shared_import_contract_v4.sql",
  "20261125101000_reviewed_format_correction_v2.sql",
  "20261125102000_existing_target_identity_rebind_v5.sql",
];
function docker(args, options = {}) {
  return spawnSync("docker", ["--context", "desktop-linux", ...args], {
    cwd: ROOT, encoding: "utf8", timeout: 10000, windowsHide: true, ...options,
  });
}
const context = docker(["context", "inspect", "desktop-linux"]);
let localEndpoint = false;
try {
  const endpoint = JSON.parse(context.stdout)[0].Endpoints.docker.Host;
  localEndpoint = endpoint.startsWith("npipe:////./pipe/") || endpoint.startsWith("unix:///var/run/");
} catch { /* An unavailable existing local context is a blocker, not a fallback. */ }
const available = localEndpoint && docker(["version", "--format", "{{.Server.Version}}"], { timeout: 10000 }).status === 0;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
function existingFunction(file, name) {
  const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8");
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name);
  const rest = sql.slice(start);
  const tag = rest.match(/\bas (\$[a-z_]*\$)/i)?.[1];
  assert.ok(tag, name);
  const end = rest.indexOf(`${tag};`, rest.indexOf(tag) + tag.length);
  assert.ok(end > 0, name);
  return rest.slice(0, end + tag.length + 1);
}

// Persistent local psql sessions let the regression observe real lock waits
// before releasing its scheduling barrier. No URL or host can be supplied.
function localSession(container, user) {
  const child = spawn("docker", ["--context", "desktop-linux", "exec", "-i", container,
    "psql", "-h", "/tmp", "-X", "--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", user, "-d", "postgres"], { windowsHide: true });
  let output = "", errors = "", pending, sequence = 0, exited = false;
  function finish(error) {
    if (!pending) return;
    const query = pending;
    pending = null;
    clearTimeout(query.timer);
    if (error) query.reject(error);
    else {
      const end = output.indexOf(query.marker);
      const result = output.slice(0, end).trim();
      output = output.slice(end + query.marker.length).trimStart();
      query.resolve(result);
    }
  }
  child.stdout.on("data", bytes => {
    output += bytes;
    if (pending && output.includes(pending.marker)) finish();
  });
  child.stderr.on("data", bytes => { errors += bytes; });
  child.stdin.on("error", error => finish(error));
  child.on("error", error => { exited = true; finish(error); });
  child.on("exit", code => { exited = true; finish(new Error(`Local psql exited ${code}: ${errors}`)); });
  return {
    query(statement) {
      assert.ok(!pending, "one query per local session");
      assert.ok(!exited, errors);
      return new Promise((resolve, reject) => {
        const marker = `CONTRACT_LOCK_DONE_${++sequence}`;
        const timer = setTimeout(() => finish(new Error(`Local lock regression timed out: ${errors}`)), 20000);
        pending = { marker, resolve, reject, timer };
        child.stdin.write(`${statement}\nselect '${marker}';\n`);
      });
    },
    close() { if (!exited) child.stdin.end("\\q\n"); },
  };
}

test("new shared import helper contracts on isolated local PostgreSQL", {
  skip: !available && "BLOCKED: existing local Docker Desktop PostgreSQL unavailable",
}, async t => {
  const container = `supplementscout-contracts-${crypto.randomBytes(6).toString("hex")}`;
  function sql(statement, shouldPass = true, pattern) {
    const result = docker(["exec", "-i", container, "psql", "-h", "/tmp", "-X", "--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres"], { input: statement, timeout: 30000 });
    if (shouldPass) assert.equal(result.status, 0, result.stderr || result.error?.message);
    else {
      assert.notEqual(result.status, 0, "SQL unexpectedly passed");
      if (pattern) assert.match(result.stderr, pattern);
    }
    return result.stdout.trim();
  }
  const started = docker(["run", "--pull", "never", "--detach", "--rm", "--network", "none", "--name", container,
    "--label", "supplementscout.test=shared-import-contracts", "--user", "postgres", "--entrypoint", "bash", IMAGE, "-c",
    "initdb -D /tmp/shared-import-pgdata -U postgres --locale=en_US.UTF-8 --encoding=UTF8 --auth=trust && exec postgres -D /tmp/shared-import-pgdata -c listen_addresses='' -c unix_socket_directories=/tmp"], { timeout: 30000 });
  assert.equal(started.status, 0, started.stderr);
  try {
    const inspected = docker(["inspect", container]);
    assert.equal(inspected.status, 0, inspected.stderr);
    const instance = JSON.parse(inspected.stdout)[0];
    assert.equal(instance.Id, started.stdout.trim());
    assert.equal(instance.Config.Labels["supplementscout.test"], "shared-import-contracts");
    assert.equal(instance.HostConfig.NetworkMode, "none");
    assert.deepEqual(instance.Mounts, []);
    assert.deepEqual(instance.NetworkSettings.Ports, {});
    waitForStablePostgres(() => docker(["exec", container, "psql", "-h", "/tmp", "-X", "--no-psqlrc", "-U", "postgres", "-Atc", "select 1"]));
    assert.equal(sql("select current_setting('server_version_num');"), "170006");
    assert.equal(sql("select datcollate from pg_database where datname=current_database();"), "en_US.UTF-8");
    assert.equal(sql("select datctype from pg_database where datname=current_database();"), "en_US.UTF-8");
    assert.equal(sql("select datlocprovider from pg_database where datname=current_database();"), "c");
    assert.equal(sql("select current_setting('server_encoding');"), "UTF8");
    sql(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
      create table public.products(id bigint primary key,name text,slug text,brand text,category text,net_weight_g numeric,
        product_format text,gtin text,is_active boolean,merged_into_product_id bigint);
      create table public.product_variants(id bigint primary key,product_id bigint,variant_key text,display_name text,
        flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,
        gtin text,is_active boolean,is_default boolean);
      create table public.retailers(id bigint primary key,name text,slug text,website text);
      create table public.retailer_products(id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,
        external_product_id text,external_variant_id text,external_sku text,external_options jsonb,external_name text,
        external_slug text,external_gtin text,external_url text,match_method text,match_confidence numeric,updated_at timestamptz);
      create table public.offers(id bigint primary key,product_id bigint,retailer_id bigint,product_variant_id bigint,
        retailer_product_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text,last_checked_at timestamptz);
      create table public.price_history(id bigint primary key,offer_id bigint,price numeric,shipping_cost numeric,total_price numeric,
        checked_at timestamptz,identity_series_id bigint);
      create table public.price_identity_series(id bigint primary key,offer_id bigint);
      create table public.gtin_promotion_quarantine(gtin text primary key);
      alter table public.gtin_promotion_quarantine enable row level security;
      alter table public.gtin_promotion_quarantine force row level security;
      revoke all on public.gtin_promotion_quarantine from public,anon,authenticated,service_role;
      create index on public.products(gtin);create index on public.product_variants(gtin);
      create index on public.retailer_products(external_gtin);
      create index on public.retailer_products(retailer_id,external_product_id);
      create function public.retailer_catalogue_actual_database_target() returns jsonb language sql as
        $$select '{"target_environment":"PRODUCTION","project_ref":"aftboxmrdgyhizicfsfu"}'::jsonb$$;`);
    for (const name of ["atomic_import_has_exact_keys", "atomic_import_canonical_json", "atomic_import_decimal_string"]) {
      sql(existingFunction("20260713180000_atomic_product_import_rpc.sql", name));
    }
    sql(existingFunction("20260813170000_add_guarded_gtin_promotion.sql", "gtin_promotion_is_valid_gtin"));
    for (const file of PROPOSALS) {
      const proposal = fs.readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8");
      assert.ok(proposal.includes("-- Guarded consumer changes"));
      sql(proposal.split("-- Guarded consumer changes")[0] + "\ncommit;");
    }
    await t.test("JS and PostgreSQL canonical bytes and hashes, including native numeric metadata", () => {
      for (const value of [
        { "2": 2, "10": 10, A: "Carb-X", a: "carb-x", é: "é", "😀": true, "\ue000": null },
        { schema_version: 2, values: [1.25, -0, 1e-7, "quote\"\\\n\t\b", [], {}] },
      ]) {
        const expected = canonicalJson(value);
        const result = JSON.parse(sql(`select json_build_object('canonical',atomic_import_private.canonical_json(${literal(JSON.stringify(value))}::jsonb),
          'sha',encode(sha256(convert_to(atomic_import_private.canonical_json(${literal(JSON.stringify(value))}::jsonb),'UTF8')),'hex'));`));
        assert.equal(result.canonical, expected);
        assert.equal(result.sha, crypto.createHash("sha256").update(expected).digest("hex"));
      }
      sql(`select atomic_import_private.plan_fingerprint('{"meta":{"version":"99"}}');`, false, /VERSION_UNSUPPORTED/);
      const plan = { meta: { version: "5", operation_type: "reviewed_variant_create_rebind_offer_update", plan_fingerprint: null },
        expected_state: { retailer_product: { external_options: { pack_count: 1, nested: { amount: 1.25 } } } } };
      const { planFingerprint, serializeImportPlan } = require("./import-products");
      plan.meta.plan_fingerprint = planFingerprint(plan);
      assert.deepEqual(serializeImportPlan(plan), plan);
      assert.equal(sql(`select atomic_import_private.plan_fingerprint(${literal(JSON.stringify(plan))}::jsonb);`), plan.meta.plan_fingerprint);
    });
    await t.test("direct access to private helpers and quarantine is denied", () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        sql(`set role ${role};select atomic_import_private.canonical_json('{}');`, false, /permission denied/);
        sql(`set role ${role};select * from public.gtin_promotion_quarantine;`, false, /permission denied/);
      }
    });
    await t.test("physical tablet counts and finite equivalent GTIN forms", () => {
      assert.equal(sql("select atomic_import_private.physical_count_matches('Unflavoured / 60 tablets','60','tablets');"), "t");
      for (const label of ["Unflavoured / 120 tablets", "60 servings", "500 mg", "2 x 60 tablets"]) {
        assert.equal(sql(`select atomic_import_private.physical_count_matches(${literal(label)},'60','tablets');`), "f");
      }
      const aliases = JSON.parse(sql("select to_json(atomic_import_private.gtin_aliases('0033984017108'));"));
      assert.ok(aliases.includes("0033984017108"));assert.ok(aliases.includes("00033984017108"));
      sql("select atomic_import_private.gtin_aliases('0033984017109');", false, /GTIN_INVALID/);
    });
    await t.test("no returned GTIN still checks canonical quarantine and foreign claims", () => {
      sql("insert into public.products(id,name,brand,gtin,is_active) values(1,'TEST ONLY','Example',null,true);insert into public.product_variants(id,product_id,gtin,display_name,variant_key) values(2,1,'0033984017108','Unflavoured / 60 tablets','unflavoured-60tablets');");
      const plan = { meta: { version: "4", operation_type: "standard_import" }, product: { action: "existing", id: "1" },
        product_variant: { action: "existing", id: "2", evidence: { canonical_gtins: { product: null, variant: "0033984017108" }, unit_count: "60", unit_type: "tablets", source_captured_at: "2026-11-24T12:00:00.000Z" } },
        retailer: { action: "existing", id: "1" }, retailer_product: { action: "noop", values: { external_gtin: null } }, offer: { action: "noop" }, expected_state: {} };
      const check = `select atomic_import_private.assert_standard_plan(${literal(JSON.stringify(plan))}::jsonb);`;
      sql(check);
      sql("insert into public.gtin_promotion_quarantine values('00033984017108');");
      sql(check, false, /GTIN_QUARANTINED/);sql("delete from public.gtin_promotion_quarantine;");
      sql("insert into public.products(id,gtin) values(3,'0033984017108');");
      sql(check, false, /FOREIGN_GTIN_CLAIM/);sql("delete from public.products where id=3;");
    });
    await t.test("typed format packages require exact NULL state and preserve native schema_version", () => {
      const product = { id: "4", name: "TEST ONLY format", brand: "Example", product_format: null, is_active: true, merged_into_product_id: null };
      sql("insert into public.products(id,name,brand,product_format,is_active) values(4,'TEST ONLY format','Example',null,true);");
      const value = buildPreparedFormatPackage({ target: "production", product, reviewedFormat: "powder",
        preparationEvidence: { relative_path: "tmp/test-only/prepared.json", sha256: "a".repeat(64), artifact_fingerprint: "b".repeat(64) },
        sourceEvidence: { relative_path: "tmp/test-only/source.json", sha256: "c".repeat(64) } });
      const check = `select atomic_import_private.validate_format_correction(${literal(JSON.stringify(value))}::jsonb,true);`;
      assert.equal(JSON.parse(sql(check)).current_value, null);
      sql("update public.products set product_format='powder' where id=4;");
      sql(check, false, /EXPECTED_STATE_CHANGED/);
    });
    await t.test("quarantine reader checks the actual caller under forced RLS", () => {
      sql("create role contract_reader nologin nosuperuser nobypassrls;grant usage on schema public,atomic_import_private to contract_reader;");
      sql(`begin;grant execute on function atomic_import_private.assert_quarantine_reader() to contract_reader;
        set local role contract_reader;select atomic_import_private.assert_quarantine_reader();rollback;`, false, /QUARANTINE_READER_NOT_AUTHORIZED/);
      assert.equal(sql("select prosecdef from pg_proc where oid='atomic_import_private.assert_quarantine_reader()'::regprocedure;"), "f");
    });
    await t.test("new manual approvals cannot downgrade to the historical standard contract", () => {
      sql(existingFunction("20260718150000_add_verified_no_change_offer_refresh.sql", "approve_product_import_plan"));
      sql("revoke all on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz) from public,anon,authenticated,service_role;");
      const core = fs.readFileSync(path.join(ROOT, "supabase/migrations", PROPOSALS[0]), "utf8");
      const start = core.indexOf("do $upgrade_approve_product_import_plan$");
      assert.ok(start > 0);
      sql(core.slice(start));
      for (const version of ["2", "3", "99"]) {
        const plan = { meta: { version, plan_kind: "manual", operation_type: "standard_import" } };
        sql(`select public.approve_product_import_plan(${literal(JSON.stringify(plan))}::jsonb,'${"a".repeat(64)}','test-only');`, false, /V4_REQUIRED_FOR_NEW_MANUAL_APPROVAL/);
      }
    });
    await t.test("legacy weight correction serializes before new import table locks and rolls back intact", async () => {
      const ledger = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260713190000_approved_import_plan_ledger.sql"), "utf8");
      const ledgerEnd = ledger.indexOf("drop function if exists");
      assert.ok(ledgerEnd > 0);
      sql(ledger.slice(0, ledgerEnd) + "\ncommit;");
      sql(existingFunction("20260719100000_add_production_retailer_sync_enablement.sql", "retailer_catalogue_raise"));
      const migration = "20261029061000_reissue_reviewed_product_pack_correction_production_safe.sql";
      for (const name of ["reviewed_product_pack_correction_validate_core", "reviewed_product_pack_correction_assert_session",
        "approve_reviewed_product_pack_correction", "apply_approved_reviewed_product_pack_correction"]) {
        sql(existingFunction(migration, name));
      }
      const format = fs.readFileSync(path.join(ROOT, "supabase/migrations", PROPOSALS[1]), "utf8");
      const unmodifiedApply = sql("select pg_get_functiondef('public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)'::regprocedure);");
      const authorization = "  v_target:=public.reviewed_product_pack_correction_assert_session(p_package,'executor');";
      assert.equal(unmodifiedApply.split(authorization).length, 2);
      sql(unmodifiedApply.replace(authorization, `  -- TEST ONLY unexpected function lineage\n${authorization}`) + ";");
      sql("begin;\n" + format.slice(format.indexOf("-- Guarded consumer changes")), false, /FORMAT_V2_LINEAGE_MISMATCH/);
      sql(unmodifiedApply + ";");
      sql("begin;\n" + format.slice(format.indexOf("-- Guarded consumer changes")));
      for (const role of ["approver", "executor"]) {
        sql(`create role retailer_catalogue_production_${role} nologin;
          create role supplementscout_production_${role}_login login noinherit;
          grant retailer_catalogue_production_${role} to supplementscout_production_${role}_login with set true;
          grant usage on schema public to retailer_catalogue_production_${role};`);
      }
      sql(`revoke all on function public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz),
          public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text) from public,anon,authenticated,service_role;
        grant execute on function public.approve_reviewed_product_pack_correction(jsonb,text,timestamptz) to retailer_catalogue_production_approver;
        grant execute on function public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text) to retailer_catalogue_production_executor;
        insert into products(id,name,net_weight_g,is_active) values(5,'TEST ONLY lock regression',250,true);`);
      const value = { schema_version: 1, kind: "reviewed-catalogue-product-pack-correction-v1", status: "OWNER_APPROVED",
        authorized_by: "TEST ONLY regression", authorized_at: new Date().toISOString(), target_environment: "PRODUCTION",
        target_project_ref: "aftboxmrdgyhizicfsfu", operation: { table: "products", product_id: "5", field: "net_weight_g",
          expected_before: "250", reviewed_after: "251" }, evidence: {
          preparation_artifact: { relative_path: "tmp/test-only/prepared.json", sha256: "a".repeat(64), artifact_fingerprint: "b".repeat(64) },
          source_evidence: { relative_path: "tmp/test-only/source.json", sha256: "c".repeat(64) } },
        policy: { single_product_row: true, single_field_only: true, exact_before_required: true,
          strict_post_write_readback: true, row_count_delta_must_be_zero: true }, package_fingerprint: null };
      value.package_fingerprint = packageFingerprint(value);
      const json = `${literal(JSON.stringify(value))}::jsonb`;
      const artifactSha = crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
      const protectedTransaction = role => `begin;set local role retailer_catalogue_production_${role};
        set local app.retailer_catalogue_production_marker='1';set local app.retailer_catalogue_allow='1';`;
      const applyName = "public.apply_approved_reviewed_product_pack_correction(uuid,jsonb,text)";
      const definition = sql(`select pg_get_functiondef('${applyName}'::regprocedure);`);
      const rowLock = "  select * into strict v_before from public.products\n  where id=(p_package#>>'{operation,product_id}')::bigint for update;";
      assert.equal(definition.split(rowLock).length, 2);
      // Test-only barrier after the real consumer's row lock; validation, DML,
      // approval consumption and the proposed advisory lock remain real.
      sql(definition.replace(rowLock, `${rowLock}\n  perform pg_advisory_xact_lock(91515);`) + ";");
      const sessions = [], pids = [];
      async function open(user) {
        const session = localSession(container, user);
        sessions.push(session);
        pids.push(Number(await session.query("select pg_backend_pid();")));
        return session;
      }
      async function waitForAdvisory(pid) {
        for (let attempt = 0; attempt < 30; attempt++) {
          if (sql(`select exists(select 1 from pg_locks where pid=${pid} and locktype='advisory' and not granted);`) === "t") return;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.fail(`Expected local backend ${pid} to wait on the advisory lock`);
      }
      try {
        const approver = await open("supplementscout_production_approver_login");
        const approval = JSON.parse(await approver.query(`${protectedTransaction("approver")}
          select public.approve_reviewed_product_pack_correction(${json},'${artifactSha}');commit;`));
        const barrier = await open("postgres"), correction = await open("supplementscout_production_executor_login"), importer = await open("postgres");
        await barrier.query("select pg_advisory_lock(91515);");
        await correction.query(protectedTransaction("executor"));
        const corrected = correction.query(`select public.apply_approved_reviewed_product_pack_correction('${approval.approval_id}',${json},'${artifactSha}');`)
          .then(result => ({ result }), error => ({ error }));
        await waitForAdvisory(pids[2]);
        await importer.query("begin;");
        const core = fs.readFileSync(path.join(ROOT, "supabase/migrations", PROPOSALS[0]), "utf8");
        const locks = core.match(/lock table public\.[^;]+;/g);
        assert.equal(locks.length, 3);
        const imported = importer.query(`select pg_advisory_xact_lock(hashtextextended('retailer-offer-sync:global-execution',0));
          ${locks.join("\n")}select id from products where id=5 for update;`).then(result => ({ result }), error => ({ error }));
        await waitForAdvisory(pids[3]);
        assert.equal(sql(`select exists(select 1 from pg_locks where pid=${pids[3]} and relation='products'::regclass
          and mode='ShareLock' and granted);`), "f", "new import must wait before acquiring predicate table locks");
        await barrier.query("select pg_advisory_unlock(91515);");
        const receipt = await corrected;
        assert.ifError(receipt.error);
        assert.equal(JSON.parse(receipt.result).approval_status, "consumed");
        assert.equal(JSON.parse(receipt.result).after_value, "251");
        await correction.query("rollback;");
        assert.ifError((await imported).error);
        await importer.query("rollback;");
        assert.equal(sql("select net_weight_g from products where id=5;"), "250");
        assert.equal(sql(`select status from approved_import_plans where id='${approval.approval_id}';`), "approved");
      } finally {
        // Only these exact disposable-container sessions; terminate on failure
        // too, releasing the barrier and rolling back any unfinished operation.
        if (pids.length) sql(`select pg_terminate_backend(pid) from pg_stat_activity where pid=any(array[${pids.join(",")}]);`);
        for (const session of sessions) session.close();
      }
    });
  } finally {
    const removed = docker(["rm", "--force", container]);
    assert.equal(removed.status, 0, removed.stderr);
  }
});
