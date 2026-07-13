const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const validator = path.join(root, "scripts/verify-baseline-migrations.js");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-validator-"));

function validateFixture(label, sql) {
  const file = path.join(tempDir, `${label}.sql`);
  fs.writeFileSync(file, sql);
  return spawnSync(process.execPath, [validator, "--test-managed-schema-fixture", file], {
    cwd: root,
    encoding: "utf8",
  });
}

test.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

test("validator permits public-only DDL, DML, grants, and search_path", () => {
  const result = validateFixture("safe-public", `
    CREATE TABLE public.example (id bigint);
    CREATE FUNCTION public.example_fn() RETURNS void LANGUAGE sql SET search_path TO 'pg_catalog', 'public' AS $$ SELECT NULL $$;
    ALTER TABLE public.example ADD COLUMN name text;
    GRANT SELECT ON TABLE public.example TO anon;
    INSERT INTO public.example VALUES (1);
    UPDATE public.example SET id = 2;
    DELETE FROM public.example;
    SET LOCAL search_path TO pg_catalog, public;
    SET search_path TO public;
    SET search_path TO public, pg_temp;
    CREATE FUNCTION public.safe_path() RETURNS void LANGUAGE sql SET "search_path" = "public", "pg_temp" AS $$ SELECT NULL $$;
    INSERT INTO public.example_log(message) VALUES ('SET search_path TO auth');
    -- SET search_path TO auth, public;
  `);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS managed-schema fixture/);
});

const forbidden = [
  ["create-table", "CREATE TABLE auth.users_copy (id bigint);"],
  ["create-type", "CREATE TYPE storage.object_state AS ENUM ('ready');"],
  ["create-function", "CREATE FUNCTION realtime.touch() RETURNS void LANGUAGE sql AS $$ SELECT NULL $$;"],
  ["create-view", "CREATE VIEW extensions.visible AS SELECT 1;"],
  ["alter-table", "ALTER TABLE stage1_validation.sample ADD COLUMN id bigint;"],
  ["alter-function", "ALTER FUNCTION auth.uid() SECURITY DEFINER;"],
  ["grant", "GRANT SELECT ON TABLE storage.objects TO anon;"],
  ["revoke", "REVOKE EXECUTE ON FUNCTION auth.uid() FROM anon;"],
  ["insert", "INSERT INTO realtime.messages DEFAULT VALUES;"],
  ["update", "UPDATE auth.users SET email = NULL;"],
  ["delete", "DELETE FROM storage.objects;"],
  ["copy", "COPY stage1_validation.sample FROM STDIN;"],
  ["search-path", "SET search_path TO pg_catalog, auth, public;"],
  ["quoted-search-path", "SET LOCAL search_path = 'storage', 'public';"],
  ["create-function-auth-search-path", "CREATE FUNCTION public.example() RETURNS void LANGUAGE sql SET search_path TO auth, public AS $$ SELECT NULL $$;"],
  ["create-function-storage-search-path", "CREATE FUNCTION public.example() RETURNS void LANGUAGE sql SET search_path = storage, public AS $$ SELECT NULL $$;"],
  ["alter-function-realtime-search-path", "ALTER FUNCTION public.example() SET search_path TO realtime, public;"],
  ["alter-function-extensions-search-path", "ALTER FUNCTION public.example() SET search_path = extensions, public;"],
  ["local-stage1-search-path", "SET LOCAL search_path TO stage1_validation, public;"],
  ["schema-grant", "GRANT USAGE ON SCHEMA extensions TO anon;"],
  ["do-block-dml", "DO $$ BEGIN DELETE FROM auth.users; END $$;"],
  ["function-body-ddl", "CREATE FUNCTION public.bad() RETURNS void LANGUAGE plpgsql AS $$ BEGIN CREATE TABLE storage.bad(id bigint); END $$;"],
];

for (const [label, sql] of forbidden) {
  test(`validator rejects managed-schema operation: ${label}`, () => {
    const result = validateFixture(label, sql);
    assert.notEqual(result.status, 0, `${label} unexpectedly passed`);
    assert.match(`${result.stdout}\n${result.stderr}`, /managed schema/i);
  });
}

test("validator does not treat comments or string data as managed-schema operations", () => {
  const result = validateFixture("comments-and-data", `
    -- CREATE TABLE auth.not_real (id bigint);
    INSERT INTO public.example_log(message) VALUES ('DELETE FROM storage.objects');
  `);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
