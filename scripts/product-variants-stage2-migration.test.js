const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const migration = path.join(root, "supabase/migrations/20260713130000_product_variants_stage2.sql");
const setup = path.join(root, "supabase/test/product_variants_stage2_migration_test.sql");
const successAssertions = path.join(root, "supabase/test/product_variants_stage2_success_assertions.sql");
const failureAssertions = path.join(root, "supabase/test/product_variants_stage2_failure_assertions.sql");
const appliedDrift = path.join(root, "supabase/test/product_variants_stage2_applied_drift_test.sql");
const image = "postgres:17-alpine";
const forbiddenRefs = ["aftboxmrdgyhizicfsfu", "dlsbwshkzdsvzubjftbv"];

assert.equal(process.argv.length, 2, "this test runner accepts no connection arguments");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout || 120_000,
    env: { ...process.env, ...options.env },
  });
}

function combined(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message || "spawn failed"}`);
  assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`);
}

function dockerAvailable() {
  const version = run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10_000 });
  return version.status === 0 && version.stdout.trim().length > 0;
}

function waitForFinalPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = run("docker", ["logs", container], { timeout: 5_000 });
    const initialized = logs.status === 0 && /PostgreSQL init process complete; ready for start up\./i.test(combined(logs));
    if (initialized) {
      const probe = exec(container, [
        "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres",
        "-tAc", "select 1",
      ], { timeout: 5_000 });
      if (probe.status === 0 && probe.stdout.trim() === "1") return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail(`disposable PostgreSQL ${container} did not reach its final ready state`);
}

function containerPath(localPath) {
  return `/workspace/${path.relative(root, localPath).replaceAll("\\", "/")}`;
}

function exec(container, args, options) {
  return run("docker", ["exec", "-e", "PGPASSWORD=stage2-local-only", container, ...args], options);
}

function psql(container, database, file) {
  assert.match(database, /^supplementscout_stage2_test_[a-z0-9_]+$/);
  assert.ok(forbiddenRefs.every((ref) => !database.includes(ref)));
  return exec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-v", "stage2_test_database_confirmed=1",
    "-v", "stage2_test_host=127.0.0.1",
    "-v", `stage2_expected_database=${database}`,
    "-d", database, "-U", "postgres", "-f", containerPath(file),
  ]);
}

function psqlScenario(container, database, scenario, file) {
  assert.match(database, /^supplementscout_stage2_test_[a-z0-9_]+$/);
  assert.ok(forbiddenRefs.every((ref) => !database.includes(ref)));
  return exec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-v", "stage2_test_database_confirmed=1",
    "-v", "stage2_test_host=127.0.0.1",
    "-v", `stage2_expected_database=${database}`,
    "-v", `stage2_scenario=${scenario}`,
    "-d", database, "-U", "postgres", "-f", containerPath(file),
  ]);
}

function setupScenario(container, database, scenario) {
  requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), `create ${database}`);
  requireSuccess(exec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-d", database,
    "-U", "postgres", "-c",
    `do $stage2_roles$
     begin
       if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
         create role anon nologin;
       end if;
       if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
         create role authenticated nologin;
       end if;
       if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
         create role service_role nologin;
       end if;
     end
     $stage2_roles$;`,
  ]), `create local Supabase roles for ${database}`);
  requireSuccess(psql(container, database, baseline), `baseline for ${scenario}`);
  const result = psqlScenario(container, database, scenario, setup);
  requireSuccess(result, `fixture ${scenario}`);
}

function dropDatabase(container, database) {
  const result = exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]);
  requireSuccess(result, `drop ${database}`);
}

function cleanupResources({ databases, drop, removeContainer, container }) {
  const errors = [];
  for (const database of [...databases].reverse()) {
    try {
      drop(database);
    } catch (error) {
      errors.push(new Error(`disposable database ${database} was not removed: ${error.message}`, { cause: error }));
    }
  }
  try {
    removeContainer(container);
  } catch (error) {
    errors.push(new Error(`disposable container ${container} was not removed: ${error.message}`, { cause: error }));
  }
  return errors;
}

function throwWithCleanupErrors(primaryError, cleanupErrors) {
  if (primaryError && cleanupErrors.length) {
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      `Stage 2 scenario failed and cleanup also failed: ${cleanupErrors.map((error) => error.message).join("; ")}`,
      { cause: primaryError }
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, `Stage 2 cleanup failed: ${cleanupErrors.map((error) => error.message).join("; ")}`);
  }
}

test("Stage 2 contract uses the audited mapping and protects all required identities", () => {
  const sql = fs.readFileSync(migration, "utf8").replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");
  assert.match(sql, /where id = 538/i);
  assert.match(sql, /where id = 137/i);
  assert.match(sql, /where id = 549/i);
  assert.match(sql, /set retailer_product_id = 137 where id = 538/i);
  assert.match(sql, /alter column product_id set not null/i);
  assert.match(sql, /alter column retailer_id set not null/i);
  assert.match(sql, /foreign key \(retailer_product_id, product_id, retailer_id, product_variant_id\)/i);
  assert.match(sql, /stage2_prepare_default_only_merge/i);
  assert.match(sql, /already applied/i);
});

test("SQL harness is guarded and has independent success and rollback assertions", () => {
  for (const file of [setup, successAssertions, failureAssertions, appliedDrift]) {
    const sql = fs.readFileSync(file, "utf8");
    assert.match(sql, /stage2_test_database_confirmed/);
    assert.match(sql, /127\.0\.0\.1/);
    assert.match(sql, /supplementscout_stage2_test_/);
    for (const ref of forbiddenRefs) assert.match(sql, new RegExp(ref));
  }
  assert.doesNotMatch(fs.readFileSync(setup, "utf8"), /\\i\s+.*product_variants_stage2/i);
  assert.match(fs.readFileSync(failureAssertions, "utf8"), /did not roll back every data and DDL change/);
  assert.match(fs.readFileSync(successAssertions, "utf8"), /merge_products_with_decisions/);
});

test("cleanup attempts every resource and reports database and container failures", () => {
  const attempts = [];
  const errors = cleanupResources({
    databases: ["supplementscout_stage2_test_one", "supplementscout_stage2_test_two"],
    container: "supplementscout-stage2-cleanup-test",
    drop(database) {
      attempts.push(`database:${database}`);
      throw new Error("controlled drop failure");
    },
    removeContainer(container) {
      attempts.push(`container:${container}`);
      throw new Error("controlled container failure");
    },
  });
  assert.deepEqual(attempts, [
    "database:supplementscout_stage2_test_two",
    "database:supplementscout_stage2_test_one",
    "container:supplementscout-stage2-cleanup-test",
  ]);
  assert.equal(errors.length, 3);
  assert.match(errors[0].message, /supplementscout_stage2_test_two was not removed/);
  assert.match(errors[2].message, /supplementscout-stage2-cleanup-test was not removed/);
  assert.throws(
    () => throwWithCleanupErrors(new Error("primary scenario failure"), errors),
    (error) => error instanceof AggregateError && error.cause?.message === "primary scenario failure" && error.errors.length === 4
  );
});

test("real Stage 2 SQL on disposable local PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const name = `supplementscout-stage2-${crypto.randomBytes(6).toString("hex")}`;
  const mount = `${root}:/workspace:ro`;
  const started = run("docker", [
    "run", "--detach", "--rm", "--name", name,
    "--network", "none",
    "-e", "POSTGRES_PASSWORD=stage2-local-only",
    "-v", mount,
    image,
  ], { timeout: 180_000 });
  requireSuccess(started, "start disposable PostgreSQL");

  const databases = [];
  let primaryError = null;
  let cleanupErrors = [];
  try {
    waitForFinalPostgres(name);

    const failures = new Map([
      ["missing_mapping_137", "retailer_product 137 does not exist"],
      ["mapping_137_wrong_retailer", "retailer_product 137 evidence does not exactly match"],
      ["mapping_137_wrong_product", "retailer_product 137 evidence does not exactly match"],
      ["mapping_137_wrong_variant", "retailer_product 137 evidence does not exactly match"],
      ["mapping_137_wrong_url", "retailer_product 137 evidence does not exactly match"],
      ["ambiguous_mapping_549", "retailer_product 549 also qualifies"],
      ["offer_538_already_linked", "partial or inconsistent migration state"],
      ["partial_final_constraint", "partial or inconsistent migration state"],
      ["wrong_named_constraint", "partial or inconsistent migration state"],
      ["wrong_named_index_nonunique", "partial or inconsistent migration state"],
      ["wrong_index_predicate", "partial or inconsistent migration state"],
      ["missing_retailer_url_unique", "partial or inconsistent migration state"],
      ["before_merge_products_body_drift", "partial or inconsistent migration state"],
      ["before_merge_decisions_body_drift", "partial or inconsistent migration state"],
    ]);

    const successDb = "supplementscout_stage2_test_success";
    databases.push(successDb);
    setupScenario(name, successDb, "success");
    requireSuccess(psql(name, successDb, migration), "Stage 2 success migration");
    requireSuccess(psql(name, successDb, successAssertions), "Stage 2 success assertions and merge RPCs");
    dropDatabase(name, successDb);
    databases.splice(databases.indexOf(successDb), 1);

    for (const [scenario, expectedMessage] of failures) {
      const database = `supplementscout_stage2_test_${scenario}`;
      databases.push(database);
      setupScenario(name, database, scenario);
      const result = psql(name, database, migration);
      assert.notEqual(result.status, 0, `${scenario} unexpectedly succeeded`);
      assert.match(combined(result), new RegExp(expectedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), scenario);
      requireSuccess(psql(name, database, failureAssertions), `${scenario} rollback assertions`);
      dropDatabase(name, database);
      databases.splice(databases.indexOf(database), 1);
    }

    const appliedDrifts = [
      "applied_helper_body_drift",
      "applied_wrapper_body_drift",
      "applied_legacy_body_drift",
      "applied_acl_legacy_merge_anon",
      "applied_acl_legacy_decisions_authenticated",
      "applied_acl_helper_service_role",
      "applied_acl_helper_public",
      "applied_acl_wrapper_merge_missing_service_role",
      "applied_acl_wrapper_merge_anon",
      "applied_acl_wrapper_decisions_missing_service_role",
      "applied_acl_wrapper_decisions_authenticated",
    ];
    for (const scenario of appliedDrifts) {
      const database = `supplementscout_stage2_test_${scenario}`;
      databases.push(database);
      setupScenario(name, database, "success");
      requireSuccess(psql(name, database, migration), `${scenario} first Stage 2 application`);
      requireSuccess(psqlScenario(name, database, scenario, appliedDrift), `${scenario} mutation`);
      const result = psql(name, database, migration);
      assert.notEqual(result.status, 0, `${scenario} unexpectedly succeeded`);
      assert.match(combined(result), /partial or inconsistent migration state/i, scenario);
      requireSuccess(psql(name, database, failureAssertions), `${scenario} rollback assertions`);
      dropDatabase(name, database);
      databases.splice(databases.indexOf(database), 1);
    }

    const secondDb = "supplementscout_stage2_test_second_application";
    databases.push(secondDb);
    setupScenario(name, secondDb, "second_application");
    requireSuccess(psql(name, secondDb, migration), "first Stage 2 application");
    const second = psql(name, secondDb, migration);
    assert.notEqual(second.status, 0, "second Stage 2 application unexpectedly succeeded");
    assert.match(combined(second), /Product Variants Stage 2 already applied/i);
    dropDatabase(name, secondDb);
    databases.splice(databases.indexOf(secondDb), 1);
  } catch (error) {
    primaryError = error;
  } finally {
    cleanupErrors = cleanupResources({
      databases,
      container: name,
      drop: (database) => dropDatabase(name, database),
      removeContainer: (container) => requireSuccess(
        run("docker", ["rm", "--force", container], { timeout: 30_000 }),
        `remove disposable container ${container}`
      ),
    });
  }
  throwWithCleanupErrors(primaryError, cleanupErrors);
});
