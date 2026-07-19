const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION_FILE = "supabase/migrations/20260719100000_add_production_retailer_sync_enablement.sql";
const BUILDER_FILE = "scripts/build-production-retailer-sync-rollout-package.js";
const CURRENT_FINGERPRINT = "ba5d4c8581b185d5412fa4f41a3cbeacf40547f507e124962f922d4aa71772b0";
const EXPECTED_FINGERPRINT = "a0015032fc8b3b4fbf829ea0d0f1eb1dfdcaf1893d68dc875f21558c6a587152";
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const STAGING_REF = "hxnrsyyqffztlvcrtgbf";
const PRODUCTION_IDENTITY = `supplementscout-production:${PRODUCTION_REF}`;

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function uuidFromHash(hash) { return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`; }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT,relative),"utf8")); }
function ledgerRows(identity) {
  return identity.migration_ledger.rows.map((row,index)=>({identifier:`${row.version}_${row.name}`,name:row.name,ordinal:index+1,version:row.version}));
}
function buildPackage() {
  const delta=readJson("tmp/jons-production-expected-deltas.json");
  const identity=readJson("tmp/jons-production-identity.json");
  const migrationSha=sha256(fs.readFileSync(path.join(ROOT,MIGRATION_FILE)));
  const currentLedger=ledgerRows(identity);
  const expectedLedger=[...currentLedger,{identifier:"20260719100000_add_production_retailer_sync_enablement",name:"add_production_retailer_sync_enablement",ordinal:26,version:"20260719100000"}];
  const seed=sha256(canonicalJson({migration_sha256:migrationSha,semantic_source_fingerprint:delta.semantic_source_fingerprint,expected_migration_fingerprint:EXPECTED_FINGERPRINT}));
  const packageCore={
    schema_version:1,
    kind:"jons-production-one-stage-rollout",
    state:"READY_FOR_ONE_EXPLICIT_APPROVAL",
    package_id:uuidFromHash(seed),
    created_at:"2026-07-19T12:50:00.000Z",
    expires_at:"2026-07-20T09:58:27.691Z",
    prepared_from_head:"5a92aa1d4c32aa13737fa7303dccf22330519272",
    head_contract:"Base audited HEAD; the rollout commit must descend from it, local/origin/remote HEAD must agree, and every bound artefact hash must match.",
    target:{
      environment:"PRODUCTION",
      project_ref:PRODUCTION_REF,
      database_identity:PRODUCTION_IDENTITY,
      database_system_identifier:"7642734024280108049",
      database_oid:"5",
      retailer_id:"10",
      retailer_slug:"jon-s-supplements",
      retailer_name:"Jon's Supplements",
      staging_project_ref_blocked:STAGING_REF,
      staging_database_identity_blocked:`supplementscout-staging:${STAGING_REF}`,
    },
    migration:{
      strategy:"SELECTIVE_SINGLE_PRODUCTION_ENABLEMENT_BUNDLE",
      runner_contract:"Apply only the named production bundle after exact ledger-25 preflight; never apply or mark the six staging-only identifiers.",
      role_deployment:"CREATE_FINAL_FAIL_CLOSED_ATTRIBUTES_IN_BUNDLE_NO_BOOTSTRAP_NO_POST_CREATE_ATTRIBUTE_CHANGE",
      role_operator_requirement:"CREATEROLE is sufficient; no superuser-only role attribute operation remains.",
      bootstrap_artifact:null,
      current_count:25,
      current_fingerprint:CURRENT_FINGERPRINT,
      current_ledger:currentLedger,
      sequence:[{ordinal:1,identifier:"20260719100000_add_production_retailer_sync_enablement",file:MIGRATION_FILE,sha256:migrationSha,executed:false}],
      expected_count:26,
      expected_fingerprint:EXPECTED_FINGERPRINT,
      expected_ledger:expectedLedger,
      fingerprint_algorithm:"SHA-256",
      fingerprint_version:"RSBI-CJ1",
      staging_behavior:"FAIL_CLOSED_BEFORE_DDL_ON_LEDGER_31",
      rerun_behavior:"DETERMINISTIC_REJECT_NO_CHANGE",
    },
    stages:[
      {ordinal:1,name:"production_enablement_migration",executed:false,expected_control_rows:0,expected_business_deltas:0},
      {ordinal:2,name:"post_migration_checkpoint",executed:false,read_only:true},
      {ordinal:3,name:"production_target_attestations",executed:false,expected_rows:2},
      {ordinal:4,name:"restricted_login_provisioning",executed:false,expected_logins:3},
      {ordinal:5,name:"read_only_validator_dry_run_and_replay",executed:false,expected_rows:26,expected_writes:0},
      {ordinal:6,name:"fresh_whole_stage_approval",executed:false,approval_count:1},
      {ordinal:7,name:"single_production_apply",executed:false,expected_rows:26},
      {ordinal:8,name:"exact_post_apply_validation",executed:false,read_only:true},
      {ordinal:9,name:"recovery_readiness_without_recovery",executed:false,recovery_execution_forbidden:true},
    ],
    post_migration_checkpoint:{
      migration_count:26,
      migration_fingerprint:EXPECTED_FINGERPRINT,
      target_attestation_rows:0,
      active_approvals:0,
      apply_runs:0,
      recovery_runs:0,
      business_data_deltas:0,
      control_data_deltas:0,
    },
    attestations:[
      {table:"retailer_catalogue_database_targets",row:{id:true,target_environment:"PRODUCTION",project_ref:PRODUCTION_REF,database_identity:PRODUCTION_IDENTITY,database_system_identifier:"7642734024280108049",database_oid:"5",is_active:true,attested_by:"EXPLICIT_PRODUCTION_ROLLOUT_OPERATOR",attested_at:"SAME_AUTHORISED_TRANSACTION_TIMESTAMP"}},
      {table:"verified_offer_refresh_targets",row:{id:true,target_environment:"PRODUCTION",project_ref:PRODUCTION_REF,database_system_identifier:"7642734024280108049",database_oid:"5",is_active:true,attested_by:"retailer_catalogue_database_targets:EXPLICIT_PRODUCTION_ROLLOUT_OPERATOR",attested_at:"SAME_AUTHORISED_TRANSACTION_TIMESTAMP"}},
    ],
    roles:[
      {role:"retailer_catalogue_production_validator",attributes:["NOLOGIN","NOINHERIT","NOSUPERUSER","NOCREATEDB","NOCREATEROLE","NOREPLICATION","NOBYPASSRLS"],login:"supplementscout_production_validator_login",schema_usage:["public"],execute_grants:["validate_retailer_offer_sync_batch_read_only(jsonb)","retailer_offer_sync_validate_batch_read_only_internal(jsonb)"],direct_business_dml:false},
      {role:"retailer_catalogue_production_approver",attributes:["NOLOGIN","NOINHERIT","NOSUPERUSER","NOCREATEDB","NOCREATEROLE","NOREPLICATION","NOBYPASSRLS"],login:"supplementscout_production_approver_login",schema_usage:["public"],execute_grants:["approve_retailer_offer_sync_batch(jsonb)","approve_retailer_offer_sync_recovery(jsonb)","close_expired_retailer_offer_sync_approval(jsonb)","retailer_offer_sync_approve_batch_internal(jsonb)","retailer_offer_sync_approve_recovery_internal(jsonb)","retailer_offer_sync_close_expired_approval_internal(jsonb)"],direct_business_dml:false},
      {role:"retailer_catalogue_production_executor",attributes:["NOLOGIN","NOINHERIT","NOSUPERUSER","NOCREATEDB","NOCREATEROLE","NOREPLICATION","NOBYPASSRLS"],login:"supplementscout_production_executor_login",schema_usage:["public"],execute_grants:["execute_retailer_offer_sync_batch(jsonb)","recover_retailer_offer_sync_batch(jsonb)","retailer_offer_sync_execute_batch_internal(jsonb)","retailer_offer_sync_recover_batch_internal(jsonb)"],direct_business_dml:false},
    ],
    membership_contract:{inherit_option:false,set_option:true,admin_option:false,cross_role_membership:false,service_role_exposure:false,credential_storage:"outside repository with operator-only ACL"},
    source:{
      captured_at:delta.source_captured_at,
      raw_source_fingerprint:delta.raw_source_fingerprint,
      semantic_source_fingerprint:delta.semantic_source_fingerprint,
      products:delta.source_counts.products,
      variants:delta.source_counts.variants,
      production_coverage:delta.coverage.production,
      adapter_file:"scripts/adapters/jons-supplements.js",
      adapter_sha256:sha256(fs.readFileSync(path.join(ROOT,"scripts/adapters/jons-supplements.js"))),
      policy_file:"config/retailers/jons-supplements-offer-sync.json",
      policy_sha256:sha256(fs.readFileSync(path.join(ROOT,"config/retailers/jons-supplements-offer-sync.json"))),
    },
    execution_plan:{
      row_count:delta.row_plans.length,
      action_counts:delta.action_counts,
      row_plans:delta.row_plans,
      expected_business_deltas:delta.expected_business_deltas,
      expected_last_checked_at_updates:26,
      expected_price_updates:0,
      expected_stock_updates:0,
      expected_offer_url_updates:0,
      expected_mapping_url_updates:0,
      expected_price_history_inserts:0,
    },
    control_plane_deltas:{
      migration:{tables_created:10,role_groups_created:3,data_rows:0},
      attestations:{rows_created:2},
      plan_seal:{parent_plans:1,child_plans:1},
      approval:{batch_approvals:1,row_approvals:26},
      apply:{apply_runs:1,recovery_manifests_ready:1,batch_approval_consumed:1,row_approvals_consumed:26},
      recovery:{approvals:0,runs:0,audit_rows:0,executed:false},
    },
    abort_conditions:[
      "Local/origin/actual remote HEAD differ, worktree is dirty, or migration SHA differs.",
      "Production ref, database identity, system identifier, database OID, ledger count, ledger order, or ledger fingerprint differs.",
      "Staging ref or staging database identity appears in the active target.",
      "Retailer 10 is absent, duplicated, or its canonical slug is not jon-s-supplements.",
      "The 26 mapping/offer identity set, raw fingerprint, semantic fingerprint, source capture, price, stock, URL, or coverage differs.",
      "Any target attestation, role, grant, RLS, approval, apply-run, or recovery state differs from the checkpoint.",
      "Validator is not a zero-write VERIFY_NO_CHANGE x26 preview with last_checked_at x26 and every other business delta zero.",
      "Package or validation is expired, approval is not fresh, or SAFE_UPDATE is enabled.",
      "Any step fails; stop the transaction/stage and do not continue to approval, apply, or recovery.",
    ],
    operator_checklist:[
      "Verify one explicit user approval names this exact package ID and fingerprint.",
      "Verify migration file SHA and exact current ledger-25 checkpoint in a read-only transaction.",
      "Apply only the single production enablement migration and verify ledger-26 checkpoint before continuing.",
      "Create the two exact target attestations, then the three restricted logins without printing credentials.",
      "Run the 26-row validator and replay under the validator login; require zero writes and an identical preview.",
      "Create one fresh whole-stage approval under the approver login within the package/approval expiry.",
      "Execute one 26-row apply under the executor login; never use service_role.",
      "Verify exact last_checked_at x26, all other business deltas zero, approval consumption, one apply run and one READY recovery manifest.",
      "Confirm recovery readiness but do not approve or execute recovery.",
      "Stop immediately on every abort condition and preserve evidence.",
    ],
    production_actions_executed:[],
    provenance:{builder_file:BUILDER_FILE,builder_sha256:sha256(fs.readFileSync(path.join(ROOT,BUILDER_FILE)))},
    package_fingerprint:null,
  };
  packageCore.package_fingerprint=sha256(canonicalJson(packageCore));
  return packageCore;
}
function main() { process.stdout.write(`${JSON.stringify(buildPackage(),null,2)}\n`); }
if(require.main===module) main();
module.exports={buildPackage};
