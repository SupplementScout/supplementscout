const fs = require("node:fs");
const path = require("node:path");
const {
  migrationLedgerFingerprint,
} = require("./retailer-snapshot/staging-execution-contract");

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION_FILE = /^\d{14}_[a-z0-9_]+\.sql$/;
const EXCLUSIONS = Object.freeze({
  STAGING: Object.freeze([
    "20260717130000_add_local_retailer_catalogue_child_executor",
    "20260719100000_add_production_retailer_sync_enablement",
    "20260726140000_authorize_reviewed_jons_16_mapped_scope",
    "20260729200000_authorize_reviewed_jons_11_stock_changes",
    "20260729210000_correct_strom_essentialmax_berrylicious_variant",
    "20260731120000_correct_jons_two_default_flavour_variants",
    "20260801170000_support_reviewed_gym_high_no_sku_legacy_upgrade",
    "20260801180000_upgrade_reviewed_gym_high_accessory_and_wrong_legacy_identities",
    "20260801190000_allow_reviewed_gym_high_null_total_identity_upgrade",
    "20260801200000_repair_reviewed_gym_high_legacy_control_binding",
    "20260801210000_allow_reviewed_gym_high_standalone_null_options",
    "20260801220000_recognize_reviewed_gym_high_standalone_legacy_tuples",
    "20260803120000_authorize_reviewed_jons_10_oos_changes",
    "20260803130000_correct_jons_creamax_lemonade_variant",
    "20260803230000_authorize_simply_reviewed_commercial_baseline",
    "20260803240000_normalize_simply_reviewed_commercial_money",
    "20260803250000_support_simply_reviewed_commercial_registration",
    "20260803260000_align_existing_offer_option_evidence",
    "20260803270000_verify_separate_offer_and_mapping_urls",
    "20260804000000_add_dolphin_vegan_protein_offer_sync_registration",
    "20260804010000_add_dolphin_single_offer_validation",
    "20260804020000_correct_dolphin_scope_fingerprint",
    "20260810160000_authorize_simply_offer_635_reviewed_sale",
    "20260810170000_support_simply_offer_635_reviewed_sale_validation",
    "20260810180000_support_simply_offer_635_reviewed_sale_registration",
    "20260810190000_rebind_jons_loaded_eaa_fruit_twist_variant",
    "20260810200000_rebind_two_reviewed_jons_variants",
    "20260810210000_authorize_reviewed_jons_23_oos_changes",
    "20260810220000_correct_jons_strom_buttered_pancake_variant",
    "20260810230000_complete_jons_strom_buttered_pancake_variant_move",
    "20260810240000_create_reviewed_jons_17_explicit_variants",
    "20260810250000_supersede_abandoned_partial_jons_plan",
    "20260810260000_rebind_two_reviewed_fit_house_variants",
    "20260811000000_authorize_reviewed_fit_house_47_changes",
    "20260811010000_add_fit_house_stable_oos_validator",
    "20260811020000_repair_fit_house_runtime_policy_fingerprint",
  ]),
  PRODUCTION: Object.freeze([
    "20260717120000_create_retailer_catalogue_control_ledger",
    "20260717130000_add_local_retailer_catalogue_child_executor",
    "20260717140000_add_staging_retailer_catalogue_executor",
    "20260718150000_add_verified_no_change_offer_refresh",
    "20260718160000_add_retailer_offer_mixed_batch_executor",
    "20260718170000_add_read_only_mixed_batch_validator",
    "20260719090000_add_expired_retailer_offer_sync_approval_close",
  ]),
});

function migrationIdentifier(filename) {
  if (!MIGRATION_FILE.test(filename)) {
    throw new Error(`invalid migration filename ${filename}`);
  }
  return filename.slice(0, -4);
}

function excludedMigrationIds(environment) {
  const excluded = EXCLUSIONS[environment];
  if (!excluded) throw new Error(`unsupported migration environment ${environment}`);
  return new Set(excluded);
}

function migrationBinding(
  environment,
  migrationFiles = fs.readdirSync(path.join(ROOT, "supabase", "migrations")),
) {
  const excluded = excludedMigrationIds(environment);
  const versions = migrationFiles
    .filter((name) => MIGRATION_FILE.test(name))
    .sort()
    .map(migrationIdentifier)
    .filter((identifier) => !excluded.has(identifier));
  return {
    versions,
    fingerprint: migrationLedgerFingerprint(versions, environment),
  };
}

module.exports = {
  EXCLUSIONS,
  MIGRATION_FILE,
  excludedMigrationIds,
  migrationBinding,
  migrationIdentifier,
};
