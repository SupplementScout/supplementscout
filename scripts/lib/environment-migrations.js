const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  migrationLedgerFingerprint,
} = require("./retailer-snapshot/staging-execution-contract");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_MIGRATION_SOURCE_DIR = path.join(ROOT, "supabase", "migrations");
const MIGRATION_FILE = /^\d{14}_[a-z0-9_]+\.sql$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PENDING_POLICY = Object.freeze({
  EXCLUDE: "EXCLUDE_PENDING",
  INCLUDE: "INCLUDE_PENDING",
});
const EXCLUSIONS = Object.freeze({
  STAGING: Object.freeze([
    "20261031120000_add_verified_automation_review_stock_transition_reader",
    "20261030120000_create_sealed_artifacts_registry",
    "20261029061000_reissue_reviewed_product_pack_correction_production_safe",
    "20261027150000_extend_sequential_parent_approval_to_gladiator",
    "20261015130000_release_gym_high_seo15_stage3_source",
    "20261009120000_add_compact_other_retailer_fingerprint",
    "20261008200000_consolidate_shared_executor_state_reads",
    "20260920150000_add_nutrition_candidate_creatine_components",
    "20260913110000_add_nutrition_candidate_citrulline_components",
    "20260911150000_add_nutrition_candidate_structured_creatine",
    "20260911130000_add_nutrition_candidate_preworkout_facts",
    "20260911120000_add_nutrition_candidate_variant_provenance",
    "20260910193000_allow_automation_review_retry_revisions",
    "20260831110000_create_automation_review_queue_publication_rpc",
    "20261008140000_add_active_retailer_parent_inventory",
    "20261008120000_serialize_all_approved_offer_writes",
    "20260922170000_allow_fit_house_parent_approval_and_supersede_failed_plan",
    "20260922160000_allow_owner_approved_fit_house_six_oos",
    "20260909094000_bind_fit_house_104_runtime_policy",
    "20260909093000_apply_reviewed_fit_house_944_oos",
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
    "20260901100000_fix_reviewed_variant_digest_schema_resolution",
    "20260901110000_restore_reviewed_variant_executor_rpc_acl",
    "20260903100000_exclude_reviewed_whey_offer_73_from_automatic_scope",
    "20260903101000_supersede_expired_fit_house_control_plan",
    "20260903130000_exclude_reviewed_whey_offer_73_from_registration",
    "20260903140000_apply_reviewed_ebay_34_remediation",
    "20260904100000_apply_reviewed_whey_okay_existing_variant_3",
    "20260905170000_apply_reviewed_ebay_26_remediation",
    "20260906143000_allow_10reps_reviewed_new_products_v8",
    "20260906150000_allow_10reps_v8_short_source_ids",
    "20260906153000_allow_10reps_v8_sibling_variants_without_default",
    "20260906200000_allow_10reps_reviewed_new_products_v9",
    "20260906210000_allow_10reps_v9_sibling_variants_without_default",
    "20260906220000_allow_10reps_reviewed_catalogue_v10",
    "20260907070000_allow_10reps_v10_short_source_ids",
    "20260907080000_allow_10reps_v10_reviewed_liquid_parent",
    "20260907090000_allow_10reps_v10_sibling_variants_without_default",
    "20260907100000_add_reviewed_catalogue_package_v1",
    "20260907210000_allow_reviewed_catalogue_count_identity",
    "20260908070000_allow_owner_reviewed_energy_supplements_default_create",
    "20260908100000_add_10reps_offer_sync_registration",
    "20260908110000_allow_reviewed_catalogue_existing_categories",
    "20260908113000_allow_reviewed_variant_count_evidence",
    "20260908120000_allow_reviewed_count_sibling_variants",
    "20260908123000_fix_reviewed_count_sibling_normalization",
    "20260908180000_supersede_interrupted_shared_refresh_plans",
    "20260908190000_supersede_expired_discount_jons_refresh_plans",
    "20260908200000_serialize_shared_refresh_and_close_partial_jons",
    "20260908210000_reuse_atomic_price_history_and_close_jons_retry",
    "20260919113000_supersede_interrupted_jons_refresh",
    "20260919120000_supersede_interrupted_10reps_refresh",
    "20260919193000_extend_sequential_refresh_window",
    "20260919200000_extend_10reps_simply_refresh_window",
    "20260919203000_prepare_sequential_parent_approval",
    "20260919210000_fix_sequential_parent_approver_identity",
    "20260919220000_allow_simply_confirmed_aggregate_price_wave",
    "20260919223000_apply_simply_confirmed_aggregate_guard",
    "20260922122000_extend_three_dedicated_refresh_windows",
    "20260922140000_extend_three_sequential_parent_approvals",
    "20260922141000_supersede_three_failed_refresh_plans",
    "20260924100000_add_transactional_retailer_control_state_interface",
    "20260925100000_add_ra004_staging_preflight_metadata_interface",
    "20260926100000_create_ra004_staging_10reps_retailer",
    "20260926110000_add_ra004_staging_interface_compatibility",
    "20260927100000_reissue_transactional_retailer_control_state_interface",
    "20260927101000_reissue_ra004_staging_preflight_metadata_interface",
    "20260927102000_correct_ra004_staging_preflight_ledger_contract",
    "20260927103000_consolidate_ra004_supabase_ownership_interfaces",
    "20260928100000_diagnose_ra004_preflight_acl_rls",
    "20260928101000_align_ra004_control_export_provider_identity",
    "20260929133000_extend_expired_sequential_plan_close",
    "20261004120000_add_central_control_plan_readback",
    "20261006120000_extend_partial_sequential_plan_close",
    "20261006170000_add_automation_review_owner_decision_validation",
    "20261006190000_add_automation_review_verified_postflight_recovery",
    "20261008100000_align_shared_stable_oos_validation",
    "20261009100000_align_shared_sequential_child_capacity",
    "20261017131000_add_environment_safe_reviewed_catalogue_bounded_state",
    "20261018121000_add_environment_safe_reviewed_catalogue_v3_boundary",
    "20261018191000_fix_environment_safe_reviewed_v3_apply_option_roles",
    "20261021190000_correct_ghost_lifestyle_energy_drink_metadata",
  ]),
  PRODUCTION: Object.freeze([
    "20261031120000_add_verified_automation_review_stock_transition_reader",
    "20261030120000_create_sealed_artifacts_registry",
    "20261028210000_add_reviewed_product_pack_correction",
    "20261009120000_add_compact_other_retailer_fingerprint",
    "20261008200000_consolidate_shared_executor_state_reads",
    "20260717120000_create_retailer_catalogue_control_ledger",
    "20260717130000_add_local_retailer_catalogue_child_executor",
    "20260717140000_add_staging_retailer_catalogue_executor",
    "20260718150000_add_verified_no_change_offer_refresh",
    "20260718160000_add_retailer_offer_mixed_batch_executor",
    "20260718170000_add_read_only_mixed_batch_validator",
    "20260719090000_add_expired_retailer_offer_sync_approval_close",
    "20260924100000_add_transactional_retailer_control_state_interface",
    "20260925100000_add_ra004_staging_preflight_metadata_interface",
    "20260926100000_create_ra004_staging_10reps_retailer",
    "20260926110000_add_ra004_staging_interface_compatibility",
    "20260927100000_reissue_transactional_retailer_control_state_interface",
    "20260927101000_reissue_ra004_staging_preflight_metadata_interface",
    "20260927102000_correct_ra004_staging_preflight_ledger_contract",
    "20260927103000_consolidate_ra004_supabase_ownership_interfaces",
    "20260928100000_diagnose_ra004_preflight_acl_rls",
    "20260928101000_align_ra004_control_export_provider_identity",
    "20260929133000_extend_expired_sequential_plan_close",
    "20261004120000_add_central_control_plan_readback",
    "20261006120000_extend_partial_sequential_plan_close",
    "20261006190000_add_automation_review_verified_postflight_recovery",
    "20261008140000_add_active_retailer_parent_inventory",
    "20261017130000_add_reviewed_catalogue_bounded_state",
    "20261018120000_add_reviewed_catalogue_v3_boundary",
    "20261018190000_fix_reviewed_catalogue_v3_apply_option_roles",
  ]),
});

// Some migrations start life as environment exclusions and are later applied by
// an explicitly authorized recovery. Keep that state here so artifact bindings
// and the migration selector cannot disagree about the current ledger.
const APPLIED_EXCLUSIONS = Object.freeze({
  STAGING: Object.freeze([
    "20260926100000_create_ra004_staging_10reps_retailer.sql",
    "20260926110000_add_ra004_staging_interface_compatibility.sql",
    "20260927103000_consolidate_ra004_supabase_ownership_interfaces.sql",
    "20260928100000_diagnose_ra004_preflight_acl_rls.sql",
    "20260928101000_align_ra004_control_export_provider_identity.sql",
    "20261008200000_consolidate_shared_executor_state_reads.sql",
  ]),
  PRODUCTION: Object.freeze([
    "20261031120000_add_verified_automation_review_stock_transition_reader.sql",
    "20260929133000_extend_expired_sequential_plan_close.sql",
    "20261004120000_add_central_control_plan_readback.sql",
    "20261006120000_extend_partial_sequential_plan_close.sql",
    "20261006190000_add_automation_review_verified_postflight_recovery.sql",
    "20261008140000_add_active_retailer_parent_inventory.sql",
    "20261008200000_consolidate_shared_executor_state_reads.sql",
    "20261009120000_add_compact_other_retailer_fingerprint.sql",
    "20261030120000_create_sealed_artifacts_registry.sql",
  ]),
});

const PENDING_MIGRATIONS = Object.freeze({
  STAGING: Object.freeze([
    Object.freeze({
      filename: "20261104120000_allow_automation_review_hard_price_anomaly.sql",
      sha256: "26a7aa2155bebc49313e8827fe0377b4676af455b7aa964c293db0f30d5fce6d",
    }),
    Object.freeze({
      filename: "20261105100000_refresh_pending_review_execution_binding.sql",
      sha256: "015f0de7448c10fcca10174e74dfbf7ca9e3150951f49090d01cd6eee869024c",
    }),
  ]),
  PRODUCTION: Object.freeze([]),
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

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n"))
    .digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function migrationBindingForPendingPolicy(
  environment,
  migrationFiles,
  pendingMigrations,
  pendingPolicy,
) {
  if (!Object.values(PENDING_POLICY).includes(pendingPolicy)) {
    throw new Error(`unsupported pending migration policy ${pendingPolicy}`);
  }
  const excluded = excludedMigrationIds(environment);
  const appliedExcluded = new Set(APPLIED_EXCLUSIONS[environment] || []);
  const pending = new Set(pendingMigrations.map(({ filename }) => filename));
  const versions = migrationFiles
    .filter((name) => MIGRATION_FILE.test(name))
    .filter((name) => pendingPolicy === PENDING_POLICY.INCLUDE || !pending.has(name))
    .sort()
    .map(migrationIdentifier)
    .filter((identifier) =>
      !excluded.has(identifier) || appliedExcluded.has(`${identifier}.sql`),
    );
  return {
    versions,
    fingerprint: migrationLedgerFingerprint(versions, environment),
  };
}

function migrationBinding(
  environment,
  migrationFiles = fs.readdirSync(DEFAULT_MIGRATION_SOURCE_DIR),
) {
  return migrationBindingForPendingPolicy(
    environment,
    migrationFiles,
    PENDING_MIGRATIONS[environment] || [],
    PENDING_POLICY.EXCLUDE,
  );
}

function freezeCloseoutDerivation(value) {
  for (const entry of value.consumed_pending) Object.freeze(entry);
  Object.freeze(value.consumed_pending);
  Object.freeze(value.pre_identifiers);
  Object.freeze(value.post_identifiers);
  return Object.freeze(value);
}

function derivePostApplyMigrationBinding(environment, options = {}) {
  const sourceDir = options.sourceDir || DEFAULT_MIGRATION_SOURCE_DIR;
  const migrationFiles = options.migrationFiles || fs.readdirSync(sourceDir);
  const pendingMigrations = options.pendingMigrations || PENDING_MIGRATIONS[environment];
  if (!Array.isArray(pendingMigrations)) {
    throw new Error(`unsupported migration environment ${environment}`);
  }

  const seen = new Set();
  const consumedPending = pendingMigrations.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`invalid pending migration entry ${index}`);
    }
    const { filename, sha256 } = entry;
    if (typeof filename !== "string" || !MIGRATION_FILE.test(filename)) {
      throw new Error(`invalid pending migration filename ${filename}`);
    }
    if (seen.has(filename)) {
      throw new Error(`duplicate pending migration filename ${filename}`);
    }
    seen.add(filename);
    if (index > 0 && compareUtf8(pendingMigrations[index - 1].filename, filename) >= 0) {
      throw new Error("pending migrations are not in deterministic order");
    }
    if (typeof sha256 !== "string" || !SHA256.test(sha256)) {
      throw new Error(`invalid pending migration SHA-256: ${filename}`);
    }
    if (!migrationFiles.includes(filename)) {
      throw new Error(`expected pending migration is missing from inventory: ${filename}`);
    }
    const file = path.join(sourceDir, filename);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`expected pending migration is missing: ${filename}`);
    }
    const actualSha256 = sha256File(file);
    if (actualSha256 !== sha256) {
      throw new Error(`pending migration SHA-256 mismatch: ${filename}`);
    }
    return {
      filename,
      identifier: migrationIdentifier(filename),
      sha256,
    };
  });

  const pre = migrationBindingForPendingPolicy(
    environment,
    migrationFiles,
    consumedPending,
    PENDING_POLICY.EXCLUDE,
  );
  const post = migrationBindingForPendingPolicy(
    environment,
    migrationFiles,
    consumedPending,
    PENDING_POLICY.INCLUDE,
  );
  const consumedIdentifiers = consumedPending.map(({ identifier }) => identifier);
  if (post.versions.length !== pre.versions.length + consumedPending.length) {
    throw new Error("post-apply migration count does not consume every pending migration");
  }
  if (consumedIdentifiers.some((identifier) =>
    pre.versions.includes(identifier) || !post.versions.includes(identifier))) {
    throw new Error("pending migration is incompatible with the pre/post binding");
  }

  return freezeCloseoutDerivation({
    environment,
    status: consumedPending.length === 0 ? "ALREADY_CLOSED" : "CLOSEOUT_REQUIRED",
    pre_ledger_count: pre.versions.length,
    pre_ledger_fingerprint: pre.fingerprint,
    pre_identifiers: [...pre.versions],
    consumed_pending: consumedPending,
    post_ledger_count: post.versions.length,
    post_ledger_fingerprint: post.fingerprint,
    post_identifiers: [...post.versions],
    pending_count: consumedPending.length,
  });
}

module.exports = {
  APPLIED_EXCLUSIONS,
  DEFAULT_MIGRATION_SOURCE_DIR,
  EXCLUSIONS,
  MIGRATION_FILE,
  PENDING_POLICY,
  PENDING_MIGRATIONS,
  derivePostApplyMigrationBinding,
  excludedMigrationIds,
  migrationBinding,
  migrationIdentifier,
  sha256File,
};
