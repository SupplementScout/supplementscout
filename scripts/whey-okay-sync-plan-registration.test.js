const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { main: runWorkflowRouter, routeWorkflowEvent } = require("./whey-okay-workflow-router");

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
const reviewedOffer73ScopeMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260903100000_exclude_reviewed_whey_offer_73_from_automatic_scope.sql"),
  "utf8",
);
const wheyConfig = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "config/retailers/whey-okay-offer-sync.json"),
  "utf8",
));

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

test("reviewed offer 73 remains outside the exact autonomous 586-row scope", () => {
  assert.deepEqual(wheyConfig.reviewed_exception_mapping_ids, [11, 65, 150, 191, 249]);
  assert.equal(wheyConfig.approved_mapping_count, 586);
  assert.equal(wheyConfig.legacy_mapping_count, 284);
  assert.match(reviewedOffer73ScopeMigration, /v_approved_count = 587 and v_legacy_count = 283/);
  assert.match(reviewedOffer73ScopeMigration, /rp\.id=65[\s\S]+o\.id=73[\s\S]+v\.id=3217/);
  assert.match(reviewedOffer73ScopeMigration, /external_product_id='300'[\s\S]+external_variant_id='301'/);
  assert.match(reviewedOffer73ScopeMigration, /where rp\.retailer_id = 3 and rp\.id <> 65/);
  assert.match(reviewedOffer73ScopeMigration, /array\[11,65,150,191,249\]/);
  assert.match(reviewedOffer73ScopeMigration, /has_function_privilege\('retailer_catalogue_production_validator'/);
  assert.doesNotMatch(reviewedOffer73ScopeMigration, /retailer_catalogue_staging_validator/);
  assert.doesNotMatch(reviewedOffer73ScopeMigration, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(reviewedOffer73ScopeMigration, /grant\s/i);
});

test("workflow is scheduled, dry-run by default and role-separated without service role", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /default: select-operation/);
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
  const routerStart = workflow.indexOf("\n  route-operation:");
  const standardStart = workflow.indexOf("\n  whey-okay-offer-refresh:");
  const reviewedStart = workflow.indexOf("\n  reviewed-offer-73-dry-run:");
  const reviewedApplyStart = workflow.indexOf("\n  validate-reviewed-artifact:");
  assert.ok(routerStart > -1 && standardStart > routerStart && reviewedStart > standardStart);
  const routerJob = workflow.slice(routerStart, standardStart);
  const standardJob = workflow.slice(standardStart, reviewedStart);
  const reviewedJob = workflow.slice(reviewedStart, reviewedApplyStart);

  assert.match(routerJob, /route-operation:[\s\S]*whey-okay-workflow-router\.js/);
  assert.doesNotMatch(routerJob, /secrets\.|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(standardJob, /needs: route-operation/);
  assert.match(standardJob, /needs\.route-operation\.outputs\.run_standard_refresh == 'true'/);
  assert.match(standardJob, /needs\.route-operation\.outputs\.run_standard_apply == 'true'/);
  assert.match(standardJob, /Dry-run all approved Whey Okay offers/);
  assert.match(standardJob, /Apply all approved Whey Okay offer refreshes/);

  assert.match(reviewedJob, /needs: route-operation/);
  assert.match(reviewedJob, /needs\.route-operation\.outputs\.run_reviewed_offer_73 == 'true'/);
  assert.match(reviewedJob, /Build immutable reviewed offer 73 dry-run/);
  assert.match(reviewedJob, /whey-okay-offer-73-reviewed-dry-run\.js/);
  assert.match(reviewedJob, /Upload reviewed offer 73 evidence[\s\S]*if: always\(\)/);
  assert.match(reviewedJob, /WHEY_OKAY_REFRESH_VALIDATOR_DATABASE_URL/);
  assert.doesNotMatch(reviewedJob, /Dry-run all approved Whey Okay offers|Apply all approved Whey Okay offer refreshes/);
  assert.doesNotMatch(reviewedJob, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(reviewedJob, /path: tmp\/whey-okay-offer-refresh\//);
  assert.match(reviewedOffer73DryRun, /default_transaction_read_only=on/);
  assert.match(reviewedOffer73DryRun, /begin read only/);
  assert.match(reviewedOffer73DryRun, /set local role retailer_catalogue_production_validator/);
  assert.match(reviewedOffer73DryRun, /supplementscout_production_validator_login/);
  assert.doesNotMatch(reviewedOffer73DryRun, /SUPABASE_SERVICE_ROLE_KEY|approve_product_import_plan|apply_approved_product_import_plan/);
});

test("generic reviewed artifact apply is artifact-bound and credentials are split by job", () => {
  const validationStart = workflow.indexOf("\n  validate-reviewed-artifact:");
  const approvalStart = workflow.indexOf("\n  approve-reviewed-artifact:");
  const executionStart = workflow.indexOf("\n  execute-reviewed-artifact:");
  const postflightStart = workflow.indexOf("\n  postflight-reviewed-artifact:");
  assert.ok(validationStart > -1 && approvalStart > validationStart && executionStart > approvalStart && postflightStart > executionStart);
  const validation = workflow.slice(validationStart, approvalStart);
  const approval = workflow.slice(approvalStart, executionStart);
  const execution = workflow.slice(executionStart, postflightStart);
  const postflight = workflow.slice(postflightStart);
  assert.match(validation, /run_reviewed_artifact_apply == 'true'/);
  assert.match(validation, /--mode=download[\s\S]*--mode=baseline/);
  assert.match(validation, /REVIEWED_VALIDATOR_DATABASE_URL/);
  assert.doesNotMatch(validation, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(approval, /--mode=approve/);
  assert.match(approval, /REVIEWED_APPROVER_DATABASE_URL/);
  assert.doesNotMatch(approval, /VALIDATOR_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(execution, /--mode=execute/);
  assert.match(execution, /REVIEWED_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(execution, /VALIDATOR_DATABASE_URL|APPROVER_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(postflight, /--mode=postflight/);
  assert.match(postflight, /REVIEWED_VALIDATOR_DATABASE_URL/);
  assert.doesNotMatch(postflight, /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /reviewed_contract:[\s\S]*owner_confirmation:/);
});

test("workflow router evaluates real workflow_dispatch payload shapes and fails closed", () => {
  const dispatch = (operation, validation_context = "workflow_dispatch") => ({ inputs: { operation, validation_context } });
  assert.deepEqual(routeWorkflowEvent("workflow_dispatch", dispatch("reviewed-offer-73-dry-run")), {
    operation: "reviewed-offer-73-dry-run", validation_context: "workflow_dispatch",
    run_standard_refresh: false, run_reviewed_offer_73: true, run_reviewed_artifact_apply: false,
    run_standard_apply: false, reviewed_contract: "", owner_confirmation: "",
  });
  assert.deepEqual(routeWorkflowEvent("workflow_dispatch", dispatch("dry-run")), {
    operation: "dry-run", validation_context: "workflow_dispatch",
    run_standard_refresh: true, run_reviewed_offer_73: false, run_reviewed_artifact_apply: false,
    run_standard_apply: false, reviewed_contract: "", owner_confirmation: "",
  });
  assert.deepEqual(routeWorkflowEvent("workflow_dispatch", dispatch("apply")), {
    operation: "apply", validation_context: "workflow_dispatch",
    run_standard_refresh: true, run_reviewed_offer_73: false, run_reviewed_artifact_apply: false,
    run_standard_apply: true, reviewed_contract: "", owner_confirmation: "",
  });
  assert.deepEqual(routeWorkflowEvent("schedule", {}), {
    operation: "schedule", validation_context: "schedule",
    run_standard_refresh: true, run_reviewed_offer_73: false, run_reviewed_artifact_apply: false,
    run_standard_apply: true, reviewed_contract: "", owner_confirmation: "",
  });
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", dispatch("")), /unknown or empty operation/);
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", dispatch("reviewed-offer-73-dryrun")), /unknown or empty operation/);
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", dispatch("reviewed-offer-73-dry-run", "push")), /invalid validation context/);
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", dispatch("reviewed-offer-73-dry-run", "schedule")), /invalid validation context for reviewed offer 73/);
  const contract = {
    source_run_id: "33519949060", source_artifact_id: "9805239082",
    source_artifact_name: "whey-okay-offer-73-reviewed-33519949060-1",
    source_commit: "8".repeat(40), zip_sha256: "1".repeat(64), artifact_sha256: "2".repeat(64),
    report_sha256: "3".repeat(64), plan_fingerprint: "4".repeat(32),
    approval_fingerprint: "5".repeat(64), idempotency_key: "6".repeat(64),
  };
  const reviewed = routeWorkflowEvent("workflow_dispatch", { inputs: { operation: "reviewed-artifact-apply", validation_context: "workflow_dispatch", reviewed_contract: JSON.stringify(contract), owner_confirmation: `OWNER_APPROVED_REVIEWED_ARTIFACT:${"7".repeat(64)}` } });
  assert.equal(reviewed.run_reviewed_artifact_apply, true);
  assert.equal(reviewed.run_standard_refresh, false);
  assert.equal(reviewed.run_standard_apply, false);
  assert.deepEqual(JSON.parse(reviewed.reviewed_contract), contract);
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", { inputs: { operation: "reviewed-artifact-apply", validation_context: "workflow_dispatch" } }), /reviewed contract is required/);
  assert.throws(() => routeWorkflowEvent("workflow_dispatch", { inputs: { operation: "reviewed-artifact-apply", validation_context: "schedule", reviewed_contract: JSON.stringify(contract), owner_confirmation: `OWNER_APPROVED_REVIEWED_ARTIFACT:${"7".repeat(64)}` } }), /invalid validation context/);
});

test("workflow router reads the actual GitHub event file and emits deterministic outputs", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whey-workflow-router-"));
  const eventPath = path.join(directory, "event.json");
  const outputPath = path.join(directory, "output.txt");
  try {
    fs.writeFileSync(eventPath, JSON.stringify({
      inputs: {
        operation: "reviewed-offer-73-dry-run",
        validation_context: "workflow_dispatch",
      },
    }));
    const route = runWorkflowRouter({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outputPath,
    });
    assert.equal(route.run_standard_refresh, false);
    assert.equal(route.run_reviewed_offer_73, true);
    assert.equal(route.run_standard_apply, false);
    assert.match(fs.readFileSync(outputPath, "utf8"), /run_standard_refresh=false\nrun_reviewed_offer_73=true\nrun_reviewed_artifact_apply=false\nrun_standard_apply=false/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
