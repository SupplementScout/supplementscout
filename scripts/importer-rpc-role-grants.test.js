const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20260719173000_grant_importer_rpc_access_to_existing_roles.sql"
);

const sql = () => fs.readFileSync(MIGRATION, "utf8");

test("importer RPC grant migration is a minimal transactional permission correction", () => {
  const source = sql();

  assert.match(source, /^begin;\s/i);
  assert.match(source, /commit;\s*$/i);
  assert.match(source, /to_regprocedure\('public\.approve_product_import_plan\(jsonb,text,text,text,timestamptz\)'\)/);
  assert.match(source, /to_regprocedure\('public\.apply_approved_product_import_plan\(uuid,text,text,text,bigint,text,text\)'\)/);

  assert.doesNotMatch(source, /\bcreate\s+role\b/i);
  assert.doesNotMatch(source, /\bcreate\s+user\b/i);
  assert.doesNotMatch(source, /\bcreate\s+table\b/i);
  assert.doesNotMatch(source, /\balter\s+role\b/i);
  assert.doesNotMatch(source, /\bgrant\s+(select|insert|update|delete|truncate|all)\s+on\s+(table|all tables)\b/i);
  assert.doesNotMatch(source, /\bgrant\s+execute\s+on\s+all\s+functions\b/i);
  assert.doesNotMatch(source, /\bto\s+public\b/i);
  assert.doesNotMatch(source, /\bto\s+anon\b/i);
  assert.doesNotMatch(source, /\bto\s+authenticated\b/i);
  assert.doesNotMatch(source, /\bto\s+service_role\b/i);
});

test("importer RPC grants are role-separated and cover only existing staging or production families", () => {
  const source = sql();

  const approveSignature = "public.approve_product_import_plan(jsonb,text,text,text,timestamptz)";
  const applySignature = "public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text)";

  assert.match(source, /if v_has_staging and v_has_production then/i);
  assert.match(source, /if not v_has_staging and not v_has_production then/i);

  assert.match(
    source,
    new RegExp(`grant execute on function ${approveSignature.replace(/[().]/g, "\\$&")}\\s+to retailer_catalogue_staging_approver`, "i")
  );
  assert.match(
    source,
    new RegExp(`grant execute on function ${applySignature.replace(/[().]/g, "\\$&")}\\s+to retailer_catalogue_staging_executor`, "i")
  );
  assert.match(
    source,
    new RegExp(`grant execute on function ${approveSignature.replace(/[().]/g, "\\$&")}\\s+to retailer_catalogue_production_approver`, "i")
  );
  assert.match(
    source,
    new RegExp(`grant execute on function ${applySignature.replace(/[().]/g, "\\$&")}\\s+to retailer_catalogue_production_executor`, "i")
  );

  const grantLines = source
    .split(/\r?\n/)
    .map((line, index, lines) => `${line} ${lines[index + 1] || ""}`.trim())
    .filter((line) => /^grant execute on function/i.test(line));

  assert.deepEqual(
    grantLines.map((line) => line.replace(/\s+/g, " ").toLowerCase()).sort(),
    [
      "grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to retailer_catalogue_production_executor;",
      "grant execute on function public.apply_approved_product_import_plan(uuid,text,text,text,bigint,text,text) to retailer_catalogue_staging_executor;",
      "grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz) to retailer_catalogue_production_approver;",
      "grant execute on function public.approve_product_import_plan(jsonb,text,text,text,timestamptz) to retailer_catalogue_staging_approver;",
    ]
  );
});
