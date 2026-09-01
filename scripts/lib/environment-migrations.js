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
    "20260811030000_correct_reviewed_mass_gainer_metadata",
    "20260811113000_add_two_reviewed_discount_multivitamin_offers",
    "20260813170000_add_guarded_gtin_promotion",
    "20260814213000_correct_critical_cookie_73g_identity",
    "20260816173000_extend_guarded_gtin_promotion_exact_36",
    "20260817100000_rebind_whey_okay_manifest_after_creatine_merge",
    "20260818070000_authorize_reviewed_fit_house_offer_697_oos",
    "20260818080000_authorize_reviewed_jons_offer_1098_price",
    "20260818090000_reauthorize_reviewed_jons_offer_1098_price",
    "20260818100000_allow_jons_isolated_offer_batches",
    "20260818110000_add_jons_confirmed_price_validator",
    "20260818120000_add_shared_isolated_confirmed_price_refresh",
    "20260820100000_add_whey_okay_isolated_confirmed_price_refresh",
    "20260820110000_add_discount_supplements_isolated_confirmed_price_refresh",
    "20260820120000_allow_production_validator_offer_refresh_reads",
    "20260820130000_allow_production_validator_bounded_rls_reads",
    "20260820140000_normalize_reviewed_brand_aliases",
    "20260825163000_create_jons_exact_pack_canary_5",
    "20260825170000_create_jons_exact_pack_ready_servings_10",
    "20260825200000_create_jons_exact_pack_ready_servings_2",
    "20260825201000_create_jons_exact_pack_ready_grams_4",
    "20260825210000_create_jons_exact_pack_ordinary_servings_a_10",
    "20260825211000_create_jons_exact_pack_ordinary_servings_b_10",
    "20260825212000_create_jons_exact_pack_ordinary_servings_c_10",
    "20260825213000_create_jons_exact_pack_ordinary_servings_d_9",
    "20260825214000_create_jons_exact_pack_ordinary_grams_a_10",
    "20260825215000_create_jons_exact_pack_ordinary_grams_b_1",
    "20260825220000_rebind_jons_existing_exact_pack_1",
    "20260825230000_create_jons_exact_pack_special_evidence_a_10",
    "20260825231000_create_jons_exact_pack_special_evidence_b_3",
    "20260826090000_enable_gym_high_price_observation_producer",
    "20260826100000_create_gym_high_exact_pack_9",
    "20260826110000_create_gym_high_shred_mode_exact_pack",
    "20260826120000_create_fit_house_exact_pack_batch_15",
    "20260826130000_create_fit_house_retailer_evidence_exact_pack_11",
    "20260826140000_create_fit_house_retailer_evidence_exact_pack_27",
    "20260826150000_create_fit_house_owner_reviewed_exact_pack_24",
    "20260826160000_create_fit_house_owner_reviewed_exact_pack_10",
    "20260826170000_create_fit_house_sodium_butyrate_exact_pack",
    "20260826180000_resolve_fit_house_six_exact_pack_conflicts",
    "20260826190000_enable_fit_house_price_observation_producer",
    "20260830090000_rebind_owner_approved_six_pack_offer_2006",
    "20260830091000_rebind_owner_approved_ebay_offer_2581",
    "20260830092000_promote_owner_approved_kior_11_identities",
    "20260830100000_add_kior_offer_sync_registration",
    "20260830102000_repair_kior_registration_scope_hash",
    "20260830120000_expand_discount_supplements_freshness_scope_109",
    "20260901090000_add_reviewed_variant_create_rebind_offer_update",
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
