const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baselinePath = path.join(
  root,
  "supabase",
  "migrations",
  "20260712211120_baseline_current_public_schema.sql",
);
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260723210000_apply_reviewed_whey_okay_product_formats.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const rowsMatch = sql.match(/\$rows\$\s*(\[[\s\S]*?\])\s*\$rows\$::jsonb/);
assert.ok(rowsMatch);
const rows = JSON.parse(rowsMatch[1]);
const image = "postgres:17-alpine";
const database = "supplementscout_whey_formats_test";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    env: process.env,
  });
}

function combined(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function requireSuccess(result, label) {
  assert.equal(
    result.error,
    undefined,
    `${label}: ${result.error?.message || "spawn failed"}`,
  );
  assert.equal(result.status, 0, `${label} failed:\n${combined(result)}`);
}

function dockerAvailable() {
  const result = run(
    "docker",
    ["version", "--format", "{{.Server.Version}}"],
    10_000,
  );
  return result.status === 0 && result.stdout.trim().length > 0;
}

function dockerExec(container, args, timeout = 120_000) {
  return run(
    "docker",
    ["exec", "-e", "PGPASSWORD=whey-formats-local-only", container, ...args],
    timeout,
  );
}

function psql(container, args, timeout) {
  return dockerExec(
    container,
    [
      "psql",
      "-X",
      "--no-psqlrc",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
      ...args,
    ],
    timeout,
  );
}

function sqlValue(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function fixtureSql(overrides = new Map()) {
  return `insert into public.products(id,name,slug,brand,category,product_format,is_active)
    values ${rows
      .map(
        (row, index) =>
          `(${index + 1},${sqlValue(row.name)},${sqlValue(row.slug)},${sqlValue(
            row.brand,
          )},${sqlValue(row.category)},${sqlValue(
            overrides.has(row.slug) ? overrides.get(row.slug) : null,
          )},true)`,
      )
      .join(",")};`;
}

function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = run("docker", ["logs", container], 5_000);
    if (
      /PostgreSQL init process complete; ready for start up\./i.test(
        combined(logs),
      )
    ) {
      const query = dockerExec(
        container,
        [
          "psql",
          "-X",
          "--no-psqlrc",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-tAc",
          "select 1",
        ],
        5_000,
      );
      if (query.status === 0 && query.stdout.trim() === "1") return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}

function recreateDatabase(container, overrides = new Map()) {
  requireSuccess(
    dockerExec(container, [
      "dropdb",
      "-U",
      "postgres",
      "--force",
      "--if-exists",
      database,
    ]),
    "drop scenario database",
  );
  requireSuccess(
    dockerExec(container, ["createdb", "-U", "postgres", database]),
    "create scenario database",
  );
  requireSuccess(
    psql(container, [
      "-c",
      "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;",
    ]),
    "create local roles",
  );
  requireSuccess(
    psql(container, [
      "-f",
      `/workspace/${path.relative(root, baselinePath).replaceAll("\\", "/")}`,
    ]),
    "apply local baseline",
  );
  requireSuccess(
    psql(container, ["-c", fixtureSql(overrides)]),
    "seed format fixtures",
  );
}

function applyMigration(container) {
  return psql(container, [
    "-f",
    `/workspace/${path.relative(root, migrationPath).replaceAll("\\", "/")}`,
  ]);
}

function targetState(container) {
  const result = psql(container, [
    "-tAc",
    `select jsonb_object_agg(slug,coalesce(product_format,'<null>') order by slug)
     from public.products`,
  ]);
  requireSuccess(result, "read target state");
  return JSON.parse(result.stdout.trim());
}

test("reviewed Whey Okay format migration is a closed 27-product update", () => {
  assert.equal(rows.length, 27);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 27);
  assert.deepEqual(
    Object.fromEntries(
      ["powder", "snack", "spread", "gummy"].map((format) => [
        format,
        rows.filter((row) => row.product_format === format).length,
      ]),
    ),
    { powder: 20, snack: 5, spread: 1, gummy: 1 },
  );
  assert.ok(
    rows.every(
      (row) =>
        row.name &&
        row.slug &&
        row.brand &&
        row.category &&
        row.product_format,
    ),
  );
  assert.match(sql, /set product_format = e\.product_format/i);
  assert.match(sql, /v_updated not in \(0, 27\)/i);
  assert.match(sql, /WHEY_OKAY_FORMATS_PARTIAL_OR_CONFLICTING_STATE/);
  assert.match(sql, /current_setting\('app\.safe_update', true\) is not null/i);
  assert.doesNotMatch(sql, /\binsert\s+into\s+public\./i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\./i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.(?!products\b)/i);
  assert.doesNotMatch(sql, /\bcreate\s+(?:or\s+replace\s+)?function\b/i);
  assert.doesNotMatch(sql, /\bgrant\b|\brevoke\b|\bmerge\b/i);
});

test(
  "reviewed Whey Okay formats apply atomically and only from an exact state",
  { skip: !dockerAvailable() && "Docker daemon unavailable" },
  () => {
    const container = `supplementscout-whey-formats-${crypto
      .randomBytes(6)
      .toString("hex")}`;
    try {
      requireSuccess(
        run(
          "docker",
          [
            "run",
            "--detach",
            "--rm",
            "--name",
            container,
            "--network",
            "none",
            "-e",
            "POSTGRES_PASSWORD=whey-formats-local-only",
            "-v",
            `${root}:/workspace:ro`,
            image,
          ],
          180_000,
        ),
        "start disposable PostgreSQL",
      );
      waitForPostgres(container);

      recreateDatabase(container);
      requireSuccess(applyMigration(container), "apply exact blank state");
      assert.deepEqual(
        targetState(container),
        Object.fromEntries(
          [...rows]
            .sort((a, b) => a.slug.localeCompare(b.slug))
            .map((row) => [row.slug, row.product_format]),
        ),
      );
      const stable = targetState(container);
      requireSuccess(applyMigration(container), "apply exact replay");
      assert.deepEqual(targetState(container), stable);

      recreateDatabase(
        container,
        new Map([[rows[0].slug, rows[0].product_format]]),
      );
      const partial = targetState(container);
      const partialResult = applyMigration(container);
      assert.notEqual(partialResult.status, 0);
      assert.match(
        combined(partialResult),
        /WHEY_OKAY_FORMATS_PARTIAL_OR_CONFLICTING_STATE/,
      );
      assert.deepEqual(targetState(container), partial);

      recreateDatabase(container);
      requireSuccess(
        psql(container, [
          "-c",
          `create function reject_reviewed_format() returns trigger language plpgsql as $$
             begin
               if new.slug=${sqlValue(rows.at(-1).slug)} then
                 raise exception 'controlled reviewed format failure';
               end if;
               return new;
             end $$;
             create trigger reject_reviewed_format before update on public.products
             for each row execute function reject_reviewed_format();`,
        ]),
        "install controlled failure",
      );
      const beforeFailure = targetState(container);
      const failure = applyMigration(container);
      assert.notEqual(failure.status, 0);
      assert.match(combined(failure), /controlled reviewed format failure/);
      assert.deepEqual(targetState(container), beforeFailure);
    } finally {
      run("docker", ["rm", "--force", container], 30_000);
    }
  },
);
