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
const reviewedOffer73DryRun = fs.readFileSync(
  path.join(process.cwd(), "scripts/whey-okay-offer-73-reviewed-dry-run.js"),
  "utf8",
);
const isolatedRefreshMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260820100000_add_whey_okay_isolated_confirmed_price_refresh.sql"),
  "utf8",
);
const nullTotalMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260724120000_allow_whey_null_total_non_price_refresh.sql",
  ),
  "utf8",
);
const nullTotalRollback = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/rollbacks/20260724120000_allow_whey_null_total_non_price_refresh.sql",
  ),
  "utf8",
);
const manifestRebindMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260801070000_rebind_whey_okay_manifest_after_family_merge.sql",
  ),
  "utf8",
);
const manifestRebindRollback = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/rollbacks/20260801070000_rebind_whey_okay_manifest_after_family_merge.sql",
  ),
  "utf8",
);
const creatineManifestRebindMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260817100000_rebind_whey_okay_manifest_after_creatine_merge.sql",
  ),
  "utf8",
);
const creatineManifestRebindRollback = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/rollbacks/20260817100000_rebind_whey_okay_manifest_after_creatine_merge.sql",
  ),
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
  for (const token of ["register_whey_okay_offer_sync_control_plan", "validate_whey_okay_confirmed_price_read_only", "require_retailer_price_confirmation", "Isolated child rows do not reconcile with the approved manifest"]) {
    assert.match(isolatedRefreshMigration, new RegExp(token));
  }
  assert.doesNotMatch(isolatedRefreshMigration, /(?:insert into|delete from|update) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
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

test("historical null-total support is scoped to Whey non-price updates and is reversible", () => {
  assert.match(nullTotalMigration, /p_plan#>>'\{retailer,id\}' = '3'/);
  assert.match(nullTotalMigration, /v_offer_action = 'update'/);
  assert.match(nullTotalMigration, /v_history_action = 'noop'/);
  assert.match(
    nullTotalMigration,
    /offer,values,price[\s\S]*expected_state,offer,price/,
  );
  assert.match(
    nullTotalMigration,
    /offer,values,shipping_cost[\s\S]*expected_state,offer,shipping_cost/,
  );
  assert.doesNotMatch(
    nullTotalMigration,
    /\b(?:insert into|update|delete from|merge|truncate)\s+public\./i,
  );
  assert.match(nullTotalRollback, /execute replace\(v_definition, v_extended, v_original\)/);
});

test("reviewed family rebinding updates only the frozen manifest hash and is reversible", () => {
  const previousHash =
    "54d828af0e3c20f548708832e0a7ad9dcaf74b1cbc6ab043ed7696d6f7c4d731";
  const reboundHash =
    "9532725e0ad538b1656172c1531c49d8acd68e95d1ef459917bbdbd3f4e9d8f7";

  assert.match(manifestRebindMigration, /pg_get_functiondef/);
  assert.match(manifestRebindMigration, new RegExp(previousHash));
  assert.match(manifestRebindMigration, new RegExp(reboundHash));
  assert.match(
    manifestRebindMigration,
    /execute replace\(v_definition, v_previous_hash, v_rebound_hash\)/,
  );
  assert.doesNotMatch(
    manifestRebindMigration,
    /\b(?:insert into|update|delete from|merge|truncate)\s+public\./i,
  );
  assert.match(
    manifestRebindRollback,
    /execute replace\(v_definition, v_rebound_hash, v_previous_hash\)/,
  );
});

test("reviewed creatine rebinding advances only the frozen manifest hash and is reversible", () => {
  const previousHash =
    "9532725e0ad538b1656172c1531c49d8acd68e95d1ef459917bbdbd3f4e9d8f7";
  const reboundHash =
    "52565db2747d905fa2db68162ebd56b1b4e5b8a3d007bb10c144f2213e216905";

  assert.match(creatineManifestRebindMigration, /pg_get_functiondef/);
  assert.match(creatineManifestRebindMigration, new RegExp(previousHash));
  assert.match(creatineManifestRebindMigration, new RegExp(reboundHash));
  assert.match(
    creatineManifestRebindMigration,
    /execute replace\(v_definition, v_previous_hash, v_rebound_hash\)/,
  );
  assert.doesNotMatch(
    creatineManifestRebindMigration,
    /\b(?:insert into|update|delete from|merge|truncate)\s+public\./i,
  );
  assert.match(
    creatineManifestRebindRollback,
    /execute replace\(v_definition, v_rebound_hash, v_previous_hash\)/,
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
  assert.match(workflow, /if-no-files-found: error/);
});

test("workflow exposes exact reviewed offer 73 dry-run with validator-only credentials", () => {
  assert.match(workflow, /reviewed-offer-73-dry-run/);
  const start = workflow.indexOf("Build immutable reviewed offer 73 dry-run");
  const end = workflow.indexOf("\n      - name:", start + 1);
  const step = workflow.slice(start, end);
  assert.match(step, /github\.event_name == 'workflow_dispatch'/);
  assert.match(step, /inputs\.operation == 'reviewed-offer-73-dry-run'/);
  assert.match(step, /whey-okay-offer-73-reviewed-dry-run\.js/);
  assert.match(step, /WHEY_OKAY_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.doesNotMatch(step, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /path: tmp\/whey-okay-offer-refresh\//);
  assert.match(reviewedOffer73DryRun, /default_transaction_read_only=on/);
  assert.match(reviewedOffer73DryRun, /begin read only/);
  assert.match(reviewedOffer73DryRun, /set local role retailer_catalogue_production_validator/);
  assert.match(reviewedOffer73DryRun, /supplementscout_production_validator_login/);
  assert.doesNotMatch(reviewedOffer73DryRun, /SUPABASE_SERVICE_ROLE_KEY|approve_product_import_plan|apply_approved_product_import_plan/);
});
