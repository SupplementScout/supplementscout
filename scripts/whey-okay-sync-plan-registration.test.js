const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260724100000_add_approved_retailer_sync_registration.sql",
  ),
  "utf8",
);
const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/whey-okay-offer-refresh.yml"),
  "utf8",
);

test("migration reuses control ledgers through narrow state and registration RPCs", () => {
  assert.match(
    migration,
    /create or replace function public\.read_retailer_offer_sync_approved_state/i,
  );
  assert.match(
    migration,
    /create or replace function public\.register_retailer_offer_sync_control_plan/i,
  );
  assert.match(migration, /exactly 586 approved Whey Okay mappings/i);
  assert.match(migration, /array\[11,150,191,249\]/i);
  assert.match(migration, /SAFE_UPDATE must remain unset/i);
  assert.match(
    migration,
    /perform public\.retailer_offer_sync_validate_manifest\(v_artifact\)/i,
  );
});

test("registration writes only existing parent and child control ledgers", () => {
  const registration = migration.slice(
    migration.indexOf("create or replace function public.register_retailer"),
  );
  const inserts = [
    ...registration.matchAll(/insert into public\.([a-z0-9_]+)/gi),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(inserts)].sort(),
    ["retailer_catalogue_child_plans", "retailer_catalogue_parent_plans"],
  );
  assert.doesNotMatch(
    registration,
    /\b(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i,
  );
  assert.doesNotMatch(registration, /\b(?:merge|truncate)\b/i);
});

test("only validator roles receive new RPC execute permission", () => {
  assert.match(
    migration,
    /grant execute on function\s+public\.register_retailer_offer_sync_control_plan\(jsonb\)\s+to retailer_catalogue_staging_validator/i,
  );
  assert.match(
    migration,
    /grant execute on function\s+public\.register_retailer_offer_sync_control_plan\(jsonb\)\s+to retailer_catalogue_production_validator/i,
  );
  assert.doesNotMatch(migration, /create\s+(?:role|user)/i);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\./i,
  );
});

test("workflow is scheduled, dry-run by default and role-separated without service role", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /default: dry-run/);
  assert.match(workflow, /cron: "17 2 \* \* \*"/);
  assert.match(workflow, /environment: production-readonly/);
  for (const secret of [
    "JONS_SYNC_VALIDATOR_DATABASE_URL",
    "JONS_SYNC_APPROVER_DATABASE_URL",
    "JONS_SYNC_EXECUTOR_DATABASE_URL",
  ]) {
    assert.match(workflow, new RegExp(`secrets\\.${secret}`));
  }
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /^\s*SAFE_UPDATE\s*:/m);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /if-no-files-found: warn/);
});
