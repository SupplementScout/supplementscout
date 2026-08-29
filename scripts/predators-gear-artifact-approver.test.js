const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const reviewedManifest = require("../config/retailers/predators-gear-reviewed-bindings-v1.json");
const reviewedBatch2Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v2.json");
const reviewedHeld4Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v3-held-4.json");
const reviewedShadowhey3Manifest = require("../config/retailers/predators-gear-reviewed-bindings-v4-shadowhey-3.json");
const reviewedNewProductsV1Manifest = require("../config/retailers/predators-gear-reviewed-new-products-v1.json");
const reviewedNewProductsV2Manifest = require("../config/retailers/predators-gear-reviewed-new-products-v2.json");
const reviewedNewProductsV3Manifest = require("../config/retailers/predators-gear-reviewed-new-products-v3.json");
const reviewedCm3MissingVariantsManifest = require("../config/retailers/predators-gear-reviewed-cm3-missing-variants-v1.json");
const {
  BATCH2_ARTIFACT_PATH,
  BATCH2_CSV_PATH,
  CM3_MISSING_VARIANTS_ARTIFACT_PATH,
  CM3_MISSING_VARIANTS_CSV_PATH,
  EXPECTED_ARTIFACT_PATH,
  HELD_CM3_ARTIFACT_PATH,
  HELD_CM3_CSV_PATH,
  HELD_OLIMP_ARTIFACT_PATH,
  HELD_OLIMP_CSV_PATH,
  REMAINING_ARTIFACT_PATH,
  SHADOWHEY3_ARTIFACT_PATH,
  SHADOWHEY3_CSV_PATH,
  REVIEWED_PROFILES,
  loadCredential,
  parseArgs,
  planFingerprint,
  runApproval,
  sha256,
  sourceRowFingerprint,
  validateApprovalScope,
} = require("./predators-gear-artifact-approver");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.resolve(ROOT, reviewedManifest.canonical_csv.path);
const FIRST_FINGERPRINT = "8d9c2ce4e4d88a8ddb5c7feec9ed825a";
const PREDATORS_PARENT_TRANSPORT_MIGRATION = path.resolve(
  ROOT,
  "supabase/migrations/20260827201000_allow_predators_gear_reviewed_parent_variant_transport.sql",
);
const PREDATORS_PARENT_TRANSPORT_MIGRATION_SHA256 =
  "9b42121d7445b2c308cea89c80c27194f3e16f41eae6edca34e0c81a64bb664b";
const PREDATORS_PARENT_URL_SIBLINGS_MIGRATION = path.resolve(
  ROOT,
  "supabase/migrations/20260828080000_allow_predators_gear_reviewed_parent_url_siblings.sql",
);
const PREDATORS_CM3_CROSS_PRODUCT_URL_MIGRATION = path.resolve(
  ROOT,
  "supabase/migrations/20260828102000_allow_predators_gear_cm3_cross_product_parent_url.sql",
);

function clone(value) {
  return structuredClone(value);
}

function fixture(profileName = "original-v2") {
  const csvBytes = Buffer.from("predators-gear-reviewed-canonical-fixture\n", "utf8");
  const productionProfile = REVIEWED_PROFILES.find((profile) => profile.name === profileName);
  const manifest = clone(
    profileName === "batch-2-safe-5"
      ? reviewedBatch2Manifest
      : profileName.startsWith("held-")
        ? reviewedHeld4Manifest
        : profileName === "shadowhey-3"
          ? reviewedShadowhey3Manifest
        : profileName.startsWith("reviewed-new-products-v1")
          ? reviewedNewProductsV1Manifest
        : profileName === "reviewed-new-products-v2-approved-8"
          ? reviewedNewProductsV2Manifest
        : profileName.startsWith("reviewed-new-products-v3-")
          ? reviewedNewProductsV3Manifest
        : profileName === "cm3-missing-variants-5"
          ? reviewedCm3MissingVariantsManifest
        : reviewedManifest
  );
  if (manifest.canonical_csv) manifest.canonical_csv.sha256 = sha256(csvBytes);
  const existingRetailer = productionProfile.retailerAction === "existing";
  const selectedRows = manifest.rows.filter((row) => productionProfile.reviewRows.includes(row.review_row));
  const sourceRows = [];
  const plans = [];
  for (let index = 0; index < selectedRows.length; index += 1) {
    const reviewed = selectedRows[index];
    const cm3MissingVariant = productionProfile.allowsReviewedVariantCreation === true;
    const rowNumber = String(index + 2);
    const source = {
      retailer_name: "Predators Gear",
      retailer_website: "https://predatorsgear.co.uk/",
      external_product_id: String(reviewed.external_product_id),
      external_variant_id: String(reviewed.external_variant_id),
      external_gtin: reviewed.external_gtin14 || reviewed.external_gtin || "",
      external_options: reviewed.external_options ? JSON.stringify(reviewed.external_options) : "",
      product_id: reviewed.product_id == null ? "" : String(reviewed.product_id),
      product_variant_id: reviewed.product_variant_id == null ? "" : String(reviewed.product_variant_id),
      product_name: reviewed.product_name,
      slug: reviewed.slug,
      brand: reviewed.brand,
      category: reviewed.category,
      product_format: reviewed.product_format,
      external_sku: reviewed.external_sku || "",
      shipping_known: "true",
      shipping_cost: "0",
      price: String(reviewed.price),
      total_price: String(reviewed.price),
      external_url: reviewed.source_url,
      affiliate_url: reviewed.source_url,
      image: reviewed.image_url || reviewed.image,
    };
    if (cm3MissingVariant) {
      source.__reviewed_predators_new_product_identity = {
        action: "create_reviewed_product_variant",
        cm3_missing_variant: true,
        contract: "predators-gear-reviewed-cm3-missing-variants-v1",
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour,
        product_format: "powder",
        review_row: String(reviewed.review_row),
        size_unit: "g",
        size_value: String(reviewed.size),
        source_url: reviewedCm3MissingVariantsManifest.parent_url,
        target_product_id: String(reviewed.target_product_id),
      };
      source.product_id = "";
      source.product_variant_id = "";
      source.external_url = reviewedCm3MissingVariantsManifest.parent_url;
      source.affiliate_url = reviewedCm3MissingVariantsManifest.parent_url;
      source.image = reviewedCm3MissingVariantsManifest.image;
    }
    if (
      productionProfile.allowsReviewedCreation &&
      productionProfile.manifestKind !== "predators-gear-reviewed-new-products-v2"
    ) {
      source.__reviewed_predators_new_product_identity = {
        action: reviewed.action,
        contract: productionProfile.manifestKind,
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour || null,
        product_format: reviewed.product_format,
        review_row: String(reviewed.review_row),
        ...(productionProfile.manifestKind === "predators-gear-reviewed-new-products-v3"
          ? { safe_create_category_reviewed: reviewed.category === "Pre Workout" }
          : {}),
        size_unit: reviewed.size_unit || null,
        size_value: reviewed.size || null,
        source_url: reviewed.source_url,
        ...(productionProfile.name === "reviewed-new-products-v1-remaining-sibling-2"
          ? { post_create_sibling: true }
          : productionProfile.manifestKind === "predators-gear-reviewed-new-products-v1"
            ? { post_create_sibling: false }
            : {}),
      };
    }
    if (productionProfile.allowsReviewedSiblingVariantCreation) {
      source.__reviewed_predators_new_product_identity = {
        action: "create_reviewed_product_variant",
        contract: "predators-gear-reviewed-new-products-v3",
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        flavour: reviewed.flavour,
        post_create_sibling: true,
        product_format: "powder",
        review_row: String(reviewed.review_row),
        safe_create_category_reviewed: false,
        size_unit: "g",
        size_value: String(reviewed.size),
        source_url: reviewed.source_url,
      };
    }
    const sourceFingerprint = sourceRowFingerprint(source);
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: {
        offer: null,
        product: {
          id: String(reviewed.product_id),
          is_active: true,
          merged_into_product_id: null,
        },
        product_variant: {
          id: String(reviewed.product_variant_id),
          product_id: String(reviewed.product_id),
          is_active: true,
          ...(reviewed.canonical_variant ? { display_name: reviewed.canonical_variant } : {}),
          ...(reviewed.canonical_size_value != null ? { size_value: String(reviewed.canonical_size_value) } : {}),
          ...(reviewed.canonical_size_unit ? { size_unit: reviewed.canonical_size_unit } : {}),
          ...(reviewed.canonical_pack_count != null ? { pack_count: reviewed.canonical_pack_count } : {}),
          ...(reviewed.canonical_product_format ? { product_format: reviewed.canonical_product_format } : {}),
        },
        retailer: existingRetailer ? {
          id: "13",
          name: "Predators Gear",
          slug: "predators-gear",
          website: "https://predatorsgear.co.uk/",
        } : null,
        retailer_product: null,
      },
      meta: {
        operation_type: "standard_import",
        plan_fingerprint: null,
        plan_kind: "feed",
        source_row_fingerprint: sourceFingerprint,
        version: "2",
      },
      offer: {
        action: "create",
        values: {
          in_stock: true,
          last_checked_at: "2026-08-26T20:33:05.744Z",
          price: String(reviewed.price),
          shipping_cost: "0",
          total_price: String(reviewed.price),
          url: reviewed.source_url,
        },
      },
      price_history: { action: "create" },
      product: { action: "existing", id: String(reviewed.product_id) },
      product_variant: {
        action: "existing",
        evidence: {},
        id: String(reviewed.product_variant_id),
      },
      retailer: existingRetailer ? {
        action: "existing",
        id: "13",
      } : {
        action: "create",
        values: {
          name: "Predators Gear",
          slug: "predators-gear",
          website: "https://predatorsgear.co.uk/",
        },
      },
      retailer_product: {
        action: "create",
        values: {
          external_gtin: reviewed.external_gtin14 || null,
          external_options: reviewed.external_options || null,
          external_product_id: String(reviewed.external_product_id),
          external_variant_id: String(reviewed.external_variant_id),
          product_variant_id: String(reviewed.product_variant_id),
        },
      },
    };
    if (productionProfile.allowsReviewedCreation) {
      const reviewedVariant = reviewed.action === "create_reviewed_product_variant";
      plan.approval = {
        approval_type: reviewedVariant ? "reviewed_parent_variant_safe_create" : "safe_create",
        approved: true,
        approved_category: reviewed.category,
        canonical_name: reviewed.product_name,
        has_variant_evidence: reviewedVariant,
      };
      plan.expected_state.product = null;
      plan.expected_state.product_variant = null;
      plan.product = {
        action: reviewedVariant ? "create_or_reuse_reviewed" : "create",
        values: {
          name: reviewed.product_name,
          slug: reviewed.slug,
          brand: reviewed.brand,
          category: reviewed.category,
          product_format: reviewed.product_format,
          image: reviewed.image,
          gtin: null,
        },
      };
      plan.product_variant = reviewedVariant
        ? {
            action: "create_reviewed_variant",
            evidence: {},
            values: {
              display_name: reviewed.variant_name,
              flavour_code: reviewed.flavour.toLowerCase(),
              flavour_label: reviewed.flavour,
              size_value: reviewed.size,
              size_unit: reviewed.size_unit,
              product_format: reviewed.product_format,
              pack_count: "1",
            },
          }
        : { action: "create_default", evidence: {} };
      plan.retailer_product.values = {
        external_gtin: reviewed.external_gtin,
        external_options: reviewed.external_options || null,
        external_product_id: String(reviewed.external_product_id),
        external_variant_id: String(reviewed.external_variant_id),
        external_sku: reviewed.external_sku,
        product_variant_id: null,
      };
    }
    if (cm3MissingVariant) {
      const product = reviewedCm3MissingVariantsManifest.existing_products.find(
        (candidate) => candidate.product_id === reviewed.target_product_id
      );
      const variantKey = `${reviewed.flavour.toLowerCase().replaceAll(" ", "-")}-${reviewed.size}g`;
      const canonicalVariant = {
        display_name: reviewed.variant_name,
        flavour_code: reviewed.flavour.toLowerCase(),
        flavour_label: reviewed.flavour,
        pack_count: "1",
        product_format: "powder",
        size_unit: "g",
        size_value: String(reviewed.size),
        variant_key: variantKey,
      };
      plan.expected_state.product = {
        id: String(reviewed.target_product_id),
        is_active: true,
        merged_into_product_id: null,
        name: reviewed.product_name,
        product_format: "powder",
      };
      plan.expected_state.product_variant = null;
      plan.product = { action: "existing", id: String(reviewed.target_product_id) };
      plan.product_variant = {
        action: "create_variant",
        evidence: { external_options: reviewed.external_options },
        values: canonicalVariant,
      };
      plan.retailer_product.values = {
        external_gtin: reviewed.external_gtin,
        external_name: reviewed.product_name,
        external_options: reviewed.external_options,
        external_product_id: String(reviewed.external_product_id),
        external_sku: reviewed.external_sku,
        external_slug: reviewed.slug,
        external_url: reviewedCm3MissingVariantsManifest.parent_url,
        external_variant_id: String(reviewed.external_variant_id),
        match_confidence: "100",
        match_method: "gtin",
        product_variant_id: null,
      };
      plan.retailer_product.identity_contract = {
        approved_url_peers: [{
          canonical_variant: canonicalVariant,
          external_gtin: reviewed.external_gtin,
          external_options: reviewed.external_options,
          external_product_id: String(reviewed.external_product_id),
          external_sku: reviewed.external_sku,
          external_url: reviewedCm3MissingVariantsManifest.parent_url,
          external_variant_id: String(reviewed.external_variant_id),
          legacy: false,
          product_id: String(reviewed.target_product_id),
          product_variant_id: null,
          retailer_id: "13",
        }],
        incoming: {
          canonical_variant: canonicalVariant,
          external_gtin: reviewed.external_gtin,
          external_options: reviewed.external_options,
          external_product_id: String(reviewed.external_product_id),
          external_sku: reviewed.external_sku,
          external_url: reviewedCm3MissingVariantsManifest.parent_url,
          external_variant_id: String(reviewed.external_variant_id),
          legacy: false,
          product_id: String(reviewed.target_product_id),
          product_variant_id: null,
          retailer_id: "13",
        },
        peer_set_fingerprint: "a".repeat(64),
        version: "1",
      };
      plan.offer.values.url = reviewedCm3MissingVariantsManifest.parent_url;
      assert.ok(product);
    }
    if (productionProfile.allowsReviewedSiblingVariantCreation) {
      const productId = productionProfile.targetProductIds[reviewed.review_row];
      const anchorReviewRow = productionProfile.anchorReviewRows[reviewed.review_row];
      const anchor = manifest.rows.find((candidate) => candidate.review_row === anchorReviewRow);
      const canonicalVariant = {
        display_name: reviewed.variant_name,
        flavour_code: reviewed.flavour.toLowerCase(),
        flavour_label: reviewed.flavour,
        pack_count: "1",
        product_format: "powder",
        size_unit: "g",
        size_value: String(reviewed.size),
        variant_key: `${reviewed.flavour.toLowerCase().replaceAll(" ", "-")}-${reviewed.size}g`,
      };
      plan.expected_state.product = {
        id: productId,
        is_active: true,
        merged_into_product_id: null,
        name: reviewed.product_name,
        product_format: "powder",
      };
      plan.expected_state.product_variant = null;
      plan.product = { action: "existing", id: productId };
      plan.product_variant = {
        action: "create_variant",
        evidence: { external_options: reviewed.external_options },
        values: canonicalVariant,
      };
      plan.retailer_product.values = {
        external_gtin: reviewed.external_gtin,
        external_name: reviewed.product_name,
        external_options: reviewed.external_options,
        external_product_id: String(reviewed.external_product_id),
        external_sku: reviewed.external_sku,
        external_slug: reviewed.slug,
        external_url: reviewed.source_url,
        external_variant_id: String(reviewed.external_variant_id),
        match_confidence: "100",
        match_method: "gtin",
        product_variant_id: null,
      };
      const incoming = {
        canonical_variant: canonicalVariant,
        external_gtin: reviewed.external_gtin,
        external_options: reviewed.external_options,
        external_product_id: String(reviewed.external_product_id),
        external_sku: reviewed.external_sku,
        external_url: reviewed.source_url,
        external_variant_id: String(reviewed.external_variant_id),
        legacy: false,
        product_id: productId,
        product_variant_id: null,
        retailer_id: "13",
      };
      const anchorPeer = {
          canonical_variant: null,
          external_gtin: anchor.external_gtin,
          external_options: anchor.external_options,
          external_product_id: String(anchor.external_product_id),
          external_sku: anchor.external_sku,
          external_url: anchor.source_url,
          external_variant_id: String(anchor.external_variant_id),
          legacy: false,
          product_id: productId,
          product_variant_id: "9999",
          retailer_id: "13",
        };
      const siblingPeers = manifest.rows
        .filter((candidate) =>
          productionProfile.reviewRows.includes(candidate.review_row) &&
          candidate.external_product_id === reviewed.external_product_id
        )
        .map((candidate) => {
          const variant = {
            display_name: candidate.variant_name,
            flavour_code: candidate.flavour.toLowerCase(),
            flavour_label: candidate.flavour,
            pack_count: "1",
            product_format: "powder",
            size_unit: "g",
            size_value: String(candidate.size),
            variant_key: `${candidate.flavour.toLowerCase().replaceAll(" ", "-")}-${candidate.size}g`,
          };
          return {
            canonical_variant: variant,
            external_gtin: candidate.external_gtin,
            external_options: candidate.external_options,
            external_product_id: String(candidate.external_product_id),
            external_sku: candidate.external_sku,
            external_url: candidate.source_url,
            external_variant_id: String(candidate.external_variant_id),
            legacy: false,
            product_id: productId,
            product_variant_id: null,
            retailer_id: "13",
          };
        });
      plan.retailer_product.identity_contract = {
        approved_url_peers: [anchorPeer, ...siblingPeers],
        incoming,
        peer_set_fingerprint: "a".repeat(64),
        version: "1",
      };
    }
    let fingerprint = planFingerprint(plan);
    if (index === 0 && profileName === "original-v2") fingerprint = FIRST_FINGERPRINT;
    plan.meta.plan_fingerprint = fingerprint;
    sourceRows.push({
      row_number: rowNumber,
      normalized_source_row: source,
      source_row_fingerprint: sourceFingerprint,
      status: "planned",
      plan_fingerprint: fingerprint,
    });
    plans.push({
      row_number: rowNumber,
      source_row_fingerprint: sourceFingerprint,
      plan_fingerprint: fingerprint,
      retailer_id: existingRetailer ? "13" : null,
      plan_kind: "feed",
      operation_type: "standard_import",
      resolved_plan: plan,
    });
  }
  const artifact = {
    artifact_version: "1",
    run_id: "predators-gear-fixture",
    created_at: "2026-08-26T20:33:05.758Z",
    source_file_name: path.basename(productionProfile.csvPath),
    source_file_sha256: sha256(csvBytes),
    row_count: String(selectedRows.length),
    source_rows: sourceRows,
    plans,
    blocked_rows: [],
    summary: {
      plan_count: String(selectedRows.length),
      blocked_row_count: "0",
      skipped_row_count: "0",
    },
    environment_marker: "local",
  };
  const loaded = {
    artifact,
    artifactPath: productionProfile.artifactPath,
    artifactSha256: "a".repeat(64),
  };
  const options = {
    artifact: productionProfile.artifactPath,
    csv: productionProfile.csvPath,
    planFingerprint: plans[0].plan_fingerprint,
  };
  const profile = {
    ...productionProfile,
    artifactSha256: loaded.artifactSha256,
    csvSha256: sha256(csvBytes),
    planFingerprints: plans.map((entry) => entry.plan_fingerprint),
    selectableFingerprints: plans.map((entry) => entry.plan_fingerprint),
  };
  if (profileName === "batch-2-safe-5") {
    manifest.execution_subset.csv_path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.execution_subset.csv_sha256 = profile.csvSha256;
    manifest.execution_subset.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_subset.artifact_sha256 = profile.artifactSha256;
    manifest.execution_subset.plan_count = profile.planCount;
    manifest.execution_subset.blocked_row_count = 0;
    manifest.execution_subset.review_rows = [...profile.reviewRows];
    manifest.execution_subset.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName.startsWith("held-")) {
    const execution = manifest.execution_profiles[profile.executionKey];
    execution.csv_path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    execution.csv_sha256 = profile.csvSha256;
    execution.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    execution.artifact_sha256 = profile.artifactSha256;
    execution.plan_count = profile.planCount;
    execution.blocked_row_count = 0;
    execution.review_rows = [...profile.reviewRows];
    execution.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "shadowhey-3") {
    manifest.canonical_csv.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.canonical_csv.sha256 = profile.csvSha256;
    manifest.canonical_csv.row_count = profile.planCount;
    manifest.execution_profile.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_profile.artifact_sha256 = profile.artifactSha256;
    manifest.execution_profile.plan_count = profile.planCount;
    manifest.execution_profile.blocked_row_count = 0;
    manifest.execution_profile.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "reviewed-new-products-v1") {
    manifest.canonical_csv.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.canonical_csv.sha256 = profile.csvSha256;
    manifest.canonical_csv.row_count = profile.planCount;
    manifest.execution_profile.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_profile.artifact_sha256 = profile.artifactSha256;
    manifest.execution_profile.plan_count = profile.planCount;
    manifest.execution_profile.blocked_row_count = 0;
    manifest.execution_profile.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "reviewed-new-products-v1-remaining-simple-2") {
    const execution = manifest[profile.executionKey];
    execution.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    execution.sha256 = profile.csvSha256;
    execution.row_count = profile.planCount;
    execution.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    execution.artifact_sha256 = profile.artifactSha256;
    execution.plan_count = profile.planCount;
    execution.blocked_row_count = 0;
    execution.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "reviewed-new-products-v1-remaining-sibling-2") {
    const execution = manifest[profile.executionKey];
    execution.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    execution.sha256 = profile.csvSha256;
    execution.row_count = profile.planCount;
    execution.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    execution.artifact_sha256 = profile.artifactSha256;
    execution.plan_count = profile.planCount;
    execution.blocked_row_count = 0;
    execution.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "reviewed-new-products-v2-approved-8") {
    manifest.canonical_csv.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.canonical_csv.sha256 = profile.csvSha256;
    manifest.canonical_csv.row_count = profile.planCount;
    manifest.dry_run.path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.dry_run.sha256 = profile.artifactSha256;
    manifest.dry_run.plan_count = profile.planCount;
    manifest.dry_run.blocked_row_count = 0;
    manifest.dry_run.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName.startsWith("reviewed-new-products-v3-")) {
    const execution = manifest[profile.executionKey];
    execution.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    execution.sha256 = profile.csvSha256;
    execution.row_count = profile.planCount;
    execution.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    execution.artifact_sha256 = profile.artifactSha256;
    execution.plan_count = profile.planCount;
    execution.blocked_row_count = 0;
    execution.conflict_count = 0;
    execution.would_create_products = profile.expectedCreates.products;
    execution.would_create_explicit_variants = profile.expectedCreates.explicitVariants;
    execution.implicit_default_variants_with_products = profile.expectedCreates.implicitDefaults;
    execution.would_create_retailer_products = profile.expectedCreates.mappings;
    execution.would_create_offers = profile.expectedCreates.offers;
    execution.would_create_price_history = profile.expectedCreates.history;
    execution.plan_fingerprints = [...profile.planFingerprints];
  } else if (profileName === "cm3-missing-variants-5") {
    manifest.canonical_csv.path = path.relative(ROOT, profile.csvPath).replaceAll("\\", "/");
    manifest.canonical_csv.sha256 = profile.csvSha256;
    manifest.canonical_csv.row_count = profile.planCount;
    manifest.execution_profile.artifact_path = path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/");
    manifest.execution_profile.artifact_sha256 = profile.artifactSha256;
    manifest.execution_profile.plan_count = profile.planCount;
    manifest.execution_profile.blocked_row_count = 0;
    manifest.execution_profile.plan_fingerprints = [...profile.planFingerprints];
  }
  return { artifact, csvBytes, loaded, manifest, options, configuration: { profile } };
}

function validate(value) {
  return validateApprovalScope(
    value.options,
    value.loaded,
    value.manifest,
    value.csvBytes,
    value.configuration
  );
}

test("CLI accepts only the exact artifact, fingerprint and CSV arguments", () => {
  const parsed = parseArgs([
    `--artifact=${EXPECTED_ARTIFACT_PATH}`,
    `--plan-fingerprint=${FIRST_FINGERPRINT}`,
    `--csv=${CSV_PATH}`,
  ]);
  assert.equal(parsed.planFingerprint, FIRST_FINGERPRINT);
  assert.throws(() => parseArgs(["--artifact=x"]), /Required --plan-fingerprint/);
  assert.throws(
    () => parseArgs(["--artifact=x", "--plan-fingerprint=bad", "--csv=y"]),
    /valid --plan-fingerprint/
  );
  assert.throws(
    () => parseArgs(["--artifact=x", `--plan-fingerprint=${FIRST_FINGERPRINT}`, "--csv=y", "--mode=apply"]),
    /Invalid argument/
  );
  assert.throws(
    () => parseArgs(["--artifact=x", `--plan-fingerprint=${FIRST_FINGERPRINT}`, "--csv=y", "--database-url=postgresql:\/\/invalid"]),
    /Invalid argument/
  );
});

test("runner fails closed without the protected approver credential", () => {
  assert.throws(
    () => loadCredential(path.join(ROOT, "tmp", "missing-production-approver.env")),
    /Protected production approver credential not found/
  );
});

test("reviewed seven-plan fixture validates and preserves the approved Whey bindings", () => {
  const value = fixture();
  const prepared = validate(value);
  assert.equal(prepared.entry.plan_fingerprint, FIRST_FINGERPRINT);
  const whey = value.artifact.plans.filter((entry) =>
    ["1068", "1971"].includes(String(entry.resolved_plan.product_variant.id))
  );
  assert.equal(whey.length, 2);
  assert.ok(whey.every((entry) => String(entry.resolved_plan.product.id) === "510"));
});

test("reviewed remaining-six profile is exact and its fixture validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "remaining-6");
  assert.equal(profile.artifactPath, REMAINING_ARTIFACT_PATH);
  assert.equal(profile.artifactSha256, "6353e4285db10fe160d0b8f2ffbdea61489606c86528dc2fa31aa79f57b0428c");
  assert.equal(profile.csvSha256, "c09ce429f62098bc341e0027d05556005718e5813b3fee13e4e6a2e3ce31adfb");
  assert.deepEqual(profile.reviewRows, [2, 6, 7, 8, 9, 10]);
  assert.deepEqual(profile.planFingerprints, [
    "d8e536e8361752e01a64672086af50dc",
    "78bd93523f61d5aef20b82cb4d74ecaa",
    "afaa55b519f266ed4eeb70a8db01a27f",
    "5c44cb1aa6dd494547a4fb28f99fc149",
    "36ad963f00982a936877dd2ffa2d67d4",
    "9885fc60773e83b34385dcd71908571b",
  ]);
  assert.deepEqual(profile.selectableFingerprints, profile.planFingerprints);
  const value = fixture("remaining-6");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 6);
});

test("reviewed batch-two safe-five profile is exact and its fixture validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "batch-2-safe-5");
  assert.equal(profile.artifactPath, BATCH2_ARTIFACT_PATH);
  assert.equal(profile.artifactSha256, "0b9c9350dfc53c10d4769415c899ab88bff372cf784b273daaaa0cc92297440a");
  assert.equal(profile.csvPath, BATCH2_CSV_PATH);
  assert.equal(profile.csvSha256, "0ad4ccbdce0fa1cbdbebca24100e48f9c818d81e5527e438c4334c425269bf46");
  assert.deepEqual(profile.reviewRows, [3, 6, 7, 8, 9]);
  assert.deepEqual(profile.planFingerprints, [
    "a1344d6236e5396fc6dc9f80ce684a90",
    "713d3e09c0e20c8a5ba8edeb807c7f7f",
    "a0e5ec0f9cd1b3b426246cfce955fb03",
    "f6bbb3ad3a982ce6c8abc4a243503be4",
    "4380e5ad881ca58639905b9817ec8c55",
  ]);
  assert.deepEqual(profile.selectableFingerprints, profile.planFingerprints);
  const value = fixture("batch-2-safe-5");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 5);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "existing"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "existing"));
});

test("reviewed held Olimp and CM3 profiles are exact and validate independently", () => {
  const olimp = REVIEWED_PROFILES.find((profile) => profile.name === "held-olimp-exact-2");
  assert.equal(olimp.artifactPath, HELD_OLIMP_ARTIFACT_PATH);
  assert.equal(olimp.csvPath, HELD_OLIMP_CSV_PATH);
  assert.equal(olimp.artifactSha256, "b6928e1f5eaaae38538ca9e247586acd4e7c76b5199e851d4a285b79666c657d");
  assert.equal(olimp.csvSha256, "869684ebfe5c69d2877acb1f3b8f19f1a07b9686dd9b1c9a1a77fcdc03f6a232");
  assert.deepEqual(olimp.reviewRows, [1, 2]);
  assert.doesNotThrow(() => validate(fixture("held-olimp-exact-2")));

  const cm3 = REVIEWED_PROFILES.find((profile) => profile.name === "held-cm3-exact-2");
  assert.equal(cm3.artifactPath, HELD_CM3_ARTIFACT_PATH);
  assert.equal(cm3.csvPath, HELD_CM3_CSV_PATH);
  assert.equal(cm3.artifactSha256, "70885388f287729cfaaee00727ae49e88b5d171e21a3975199e840523255192d");
  assert.equal(cm3.csvSha256, "46ac92ccd8a7374b0b745f8335f9cb23073aa2970261cdd051b84193bbe16468");
  assert.deepEqual(cm3.reviewRows, [4, 5]);
  assert.doesNotThrow(() => validate(fixture("held-cm3-exact-2")));
});

test("reviewed Shadowhey three-plan profile is exact and validates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "shadowhey-3");
  assert.equal(profile.artifactPath, SHADOWHEY3_ARTIFACT_PATH);
  assert.equal(profile.csvPath, SHADOWHEY3_CSV_PATH);
  assert.equal(profile.artifactSha256, "751800690204a1353ea66497c1bd50dd88b697b7c03a7c6afc08c3c04f8f904a");
  assert.equal(profile.csvSha256, "79fab41b82b334e7e275a820c2d0860b11c799cf96e3e72c47362d9420fdc717");
  assert.deepEqual(profile.reviewRows, [1, 2, 3]);
  assert.deepEqual(profile.planFingerprints, [
    "00ba9b685f3b81a2b8676f0ffe1a85dc",
    "db8d13fb0c59310089bff574369ec457",
    "65a26305967a0f1b8d47993a94820cb2",
  ]);
  const value = fixture("shadowhey-3");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 3);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.id === "753"));
  assert.deepEqual(value.artifact.plans.map((entry) => entry.resolved_plan.product_variant.id), ["873", "876", "877"]);
});

test("reviewed new-products profile permits only the exact three-product five-plan creation scope", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "reviewed-new-products-v1");
  assert.equal(profile.artifactSha256, "309de9d46985e85816701198b4b72301bfe9857838e57e315ef34b1c9d99de12");
  assert.equal(profile.csvSha256, "790803511e8219737f0b4a637f9b83cd5ae7208f1ed5f33304a7f19f18e337a9");
  assert.deepEqual(profile.planFingerprints, [
    "ca0abf6244760b196aab29cfbda76510",
    "7c844da2320487376923ab979edddab6",
    "ca504fc16da99d401b9b820b3110a596",
    "8a085ee3c866423b0a53a8ec61d41d4c",
    "99c22d5737ab8f544000129b8055a947",
  ]);
  const value = fixture("reviewed-new-products-v1");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 5);
  assert.deepEqual(
    value.artifact.plans.map((entry) => entry.resolved_plan.product.action),
    ["create_or_reuse_reviewed", "create_or_reuse_reviewed", "create_or_reuse_reviewed", "create", "create"]
  );
  assert.deepEqual(
    value.artifact.plans.map((entry) => entry.resolved_plan.product_variant.action),
    ["create_reviewed_variant", "create_reviewed_variant", "create_reviewed_variant", "create_default", "create_default"]
  );
});

test("reviewed new-products v2 profile permits exactly eight owner-approved default-variant creates", () => {
  const profile = REVIEWED_PROFILES.find(
    (candidate) => candidate.name === "reviewed-new-products-v2-approved-8"
  );
  assert.equal(profile.artifactSha256, "c8ca2fcdc04c2f6c3f1fd148e531cbaf6dc09e74fe9e2f93c83d0812b440920f");
  assert.equal(profile.csvSha256, "0ce339b42aecfe4fd71e213d9fc84546935eb8b4dc1367b330c20741e3d23f67");
  assert.deepEqual(profile.reviewRows, [1, 2, 3, 4, 5, 7, 8, 10]);
  assert.deepEqual(profile.planFingerprints, [
    "0ad9094abd5198c15cca030b3e8927e1",
    "81ff81228efe105ab0b4963218d2ad1b",
    "21817f39a7ea2e265ce7f74d7f7525fc",
    "8c821db8fa0a443219fbcb20d6f2b5c4",
    "6137a92cf8db349712b9667f00f2505d",
    "d868785e77875293ff878c3950d87f8d",
    "640492ed875ded87ccf98eada63bd016",
    "9c5bbef6f5064edfab8c7f1e01fafaaa",
  ]);
  const value = fixture("reviewed-new-products-v2-approved-8");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 8);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "create"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "create_default"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.values.gtin === null));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.offer.values.shipping_cost === "0"));
});

test("reviewed new-products v2 profile rejects hash, retailer and commercial drift", () => {
  const artifactSha = fixture("reviewed-new-products-v2-approved-8");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const csvSha = fixture("reviewed-new-products-v2-approved-8");
  csvSha.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csvSha), /clean-run contract mismatch/);

  const retailer = fixture("reviewed-new-products-v2-approved-8");
  retailer.artifact.plans[0].resolved_plan.retailer.id = "14";
  assert.throws(() => validate(retailer), /Unsafe Predators Gear reviewed creation plan/);

  const shipping = fixture("reviewed-new-products-v2-approved-8");
  shipping.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(shipping), /Unsafe Predators Gear reviewed creation plan/);

  const total = fixture("reviewed-new-products-v2-approved-8");
  total.artifact.plans[0].resolved_plan.offer.values.total_price = "29.98";
  assert.throws(() => validate(total), /Unsafe Predators Gear reviewed creation plan/);
});

test("reviewed new-products v2 profile rejects unreviewed identities and action drift", () => {
  const held = fixture("reviewed-new-products-v2-approved-8");
  held.manifest.rows[0].external_product_id = "8594181607643";
  held.manifest.rows[0].external_variant_id = "8594181607643";
  assert.throws(() => validate(held), /Unsafe reviewed v2 manifest row/);

  const product = fixture("reviewed-new-products-v2-approved-8");
  product.artifact.plans[0].resolved_plan.product = { action: "existing", id: "337" };
  assert.throws(() => validate(product), /Unsafe Predators Gear reviewed creation plan/);

  const variant = fixture("reviewed-new-products-v2-approved-8");
  variant.artifact.plans[0].resolved_plan.product_variant = { action: "existing", id: "1068" };
  assert.throws(() => validate(variant), /Unsafe Predators Gear reviewed creation plan/);

  const canonicalGtin = fixture("reviewed-new-products-v2-approved-8");
  canonicalGtin.artifact.plans[0].resolved_plan.product.values.gtin = "05949106122382";
  assert.throws(() => validate(canonicalGtin), /Unsafe Predators Gear reviewed creation plan/);

  const fingerprint = fixture("reviewed-new-products-v2-approved-8");
  fingerprint.manifest.dry_run.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);
});

test("reviewed new-products v3 initial profile permits exactly seven owner-approved anchors", () => {
  const profile = REVIEWED_PROFILES.find(
    (candidate) => candidate.name === "reviewed-new-products-v3-initial-7"
  );
  assert.equal(profile.artifactSha256, "08de65b758b4f243faf228b2dfaff8de7c2150e0654c59bec61f4c0605e961f4");
  assert.equal(profile.csvSha256, "776ddcbfd8ba3836923d54678becbd9499cbef4148fd30df125dcdf407a76349");
  assert.deepEqual(profile.reviewRows, [1, 2, 3, 4, 5, 7, 10]);
  assert.deepEqual(profile.planFingerprints, [
    "6604ff4af2e6f312d04aa8f0e143f6a7",
    "ab33ee6bcb143b9f1d6da93695857728",
    "f4b6afddacfca43eabc9e8bd6f085d7e",
    "91bb0ce2abf4c5b89248f4e276b1aaf8",
    "a989ce56c66942e534314d391fe285fa",
    "713f5625eb4ba1f7276912f34200507a",
    "1b41f37443e6fae2a785a9dac9811fc3",
  ]);
  const value = fixture("reviewed-new-products-v3-initial-7");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerAction, "existing");
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 7);
  assert.deepEqual(
    value.artifact.plans.map((entry) => entry.resolved_plan.product.action),
    ["create", "create", "create", "create", "create_or_reuse_reviewed", "create_or_reuse_reviewed", "create_or_reuse_reviewed"]
  );
  assert.ok(value.artifact.plans.every((entry) =>
    entry.resolved_plan.product.values.gtin === null &&
      entry.resolved_plan.offer.values.shipping_cost === "0"
  ));
});

test("reviewed new-products v3 initial profile rejects hash, row, category, variant, and shipping drift", () => {
  const artifactSha = fixture("reviewed-new-products-v3-initial-7");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const heldSibling = fixture("reviewed-new-products-v3-initial-7");
  heldSibling.manifest.initial_anchor_profile.included_review_rows = [1, 2, 3, 4, 5, 6, 10];
  assert.throws(() => validate(heldSibling), /manifest contract mismatch/);

  const category = fixture("reviewed-new-products-v3-initial-7");
  category.artifact.plans[0].resolved_plan.product.values.category = "Amino Acids";
  assert.throws(() => validate(category), /Unsafe Predators Gear reviewed creation plan/);

  const variant = fixture("reviewed-new-products-v3-initial-7");
  variant.artifact.plans[4].resolved_plan.product_variant.values.size_value = "316";
  assert.throws(() => validate(variant), /Unsafe Predators Gear reviewed variant plan/);

  const shipping = fixture("reviewed-new-products-v3-initial-7");
  shipping.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(shipping), /Unsafe Predators Gear reviewed creation plan/);
});

test("reviewed new-products v3 remaining profile permits only three exact existing-parent sibling variants", () => {
  const profile = REVIEWED_PROFILES.find(
    (candidate) => candidate.name === "reviewed-new-products-v3-remaining-3"
  );
  assert.equal(profile.artifactSha256, "cbd161963251beaaa59d9fd5eda40103bd47f02bc19b277edc4ac220708a230c");
  assert.equal(profile.csvSha256, "e59a78bdafcdbb2c5895c70ada2b21d01d2f553849697319079a188280b04133");
  assert.deepEqual(profile.reviewRows, [6, 8, 9]);
  assert.deepEqual(profile.targetProductIds, { 6: "1158", 8: "1159", 9: "1159" });
  assert.deepEqual(profile.planFingerprints, [
    "a7399c5a511976103aff24264bccd387",
    "184c41881cce71c6df7b1a47e8b128f3",
    "638b182d7fb7e4a62915c78aa6171aab",
  ]);
  const value = fixture("reviewed-new-products-v3-remaining-3");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 3);
  assert.deepEqual(value.artifact.plans.map((entry) => entry.resolved_plan.product.id), ["1158", "1159", "1159"]);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "existing" && entry.resolved_plan.product_variant.action === "create_variant" && entry.resolved_plan.offer.values.shipping_cost === "0"));
});

test("reviewed new-products v3 remaining profile rejects parent, row, hash, and shipping drift", () => {
  const product = fixture("reviewed-new-products-v3-remaining-3");
  product.artifact.plans[0].resolved_plan.product.id = "1159";
  assert.throws(() => validate(product), /Unsafe Predators Gear v3 sibling plan/);

  const row = fixture("reviewed-new-products-v3-remaining-3");
  row.manifest.remaining_sibling_profile.included_review_rows = [5, 8, 9];
  assert.throws(() => validate(row), /manifest contract mismatch/);

  const hash = fixture("reviewed-new-products-v3-remaining-3");
  hash.loaded.artifactSha256 = "f".repeat(64);
  assert.throws(() => validate(hash), /clean-run contract mismatch/);

  const shipping = fixture("reviewed-new-products-v3-remaining-3");
  shipping.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "1";
  assert.throws(() => validate(shipping), /Unsafe Predators Gear v3 sibling plan/);
});

test("reviewed new-products remaining simple profile permits only rows four and five", () => {
  const profile = REVIEWED_PROFILES.find(
    (candidate) => candidate.name === "reviewed-new-products-v1-remaining-simple-2"
  );
  assert.equal(profile.artifactSha256, "1f58c031488f519ba8370ee6bdf2090b67ed724a8ff0e734ea78df837c9d4d50");
  assert.equal(profile.csvSha256, "57f6010fe0420b71be218f76f0d57006521c4d553857a8108c62c2148833c3bd");
  assert.deepEqual(profile.reviewRows, [4, 5]);
  assert.deepEqual(profile.planFingerprints, [
    "f358370614b927defcd384b076d370d0",
    "60c61440407f5b244c0e3fe6bfc21064",
  ]);
  const value = fixture("reviewed-new-products-v1-remaining-simple-2");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 2);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "create"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "create_default"));
});

test("reviewed new-products remaining sibling profile permits only Peach and Strawberry parent reuse", () => {
  const profile = REVIEWED_PROFILES.find(
    (candidate) => candidate.name === "reviewed-new-products-v1-remaining-sibling-2"
  );
  assert.equal(profile.artifactSha256, "5d752ca88b3509bee43ca042bea912faa26e10ece74e72dcd0fbcdc3a65aa260");
  assert.equal(profile.csvSha256, "d0bb592fa9b8a5bc5d4d670600739cbfb8529821f5f7ee637e0b83b144fdb05e");
  assert.deepEqual(profile.reviewRows, [2, 3]);
  assert.deepEqual(profile.planFingerprints, [
    "3cfee93984a7d8749f991de30dccfae4",
    "16f3a70ad405c500bb099742b48fac93",
  ]);
  const value = fixture("reviewed-new-products-v1-remaining-sibling-2");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerId, "13");
  assert.equal(value.artifact.plans.length, 2);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "create_or_reuse_reviewed"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "create_reviewed_variant"));
});

test("reviewed CM3 missing-variants profile is exact and permits only five existing-product variant creates", () => {
  const profile = REVIEWED_PROFILES.find((candidate) => candidate.name === "cm3-missing-variants-5");
  assert.equal(profile.artifactPath, CM3_MISSING_VARIANTS_ARTIFACT_PATH);
  assert.equal(profile.csvPath, CM3_MISSING_VARIANTS_CSV_PATH);
  assert.equal(profile.artifactSha256, "d9c2d98eb5b039847e9bfe0042ef43b1847c0774a480008d322f851b934be042");
  assert.equal(profile.csvSha256, "edfedf3d426e7b4502cc73a1c26e5a120c9c81c5f5282db3484205dffe50d7a7");
  assert.deepEqual(profile.planFingerprints, [
    "7c79072fae1e974ceb2d830d818c9377",
    "a5c34864f761d25b6c3816fa0e4c1131",
    "6837b1331e457dac3c21f387c3748642",
    "cf7ba8cd7f9a50e2b0ca0b8373ada303",
    "fd335deebadba36164c571d4e831443d",
  ]);
  const value = fixture("cm3-missing-variants-5");
  const prepared = validate(value);
  assert.equal(prepared.profile.retailerId, "13");
  assert.deepEqual(value.artifact.plans.map((entry) => entry.resolved_plan.product.id), ["361", "361", "1067", "1067", "1067"]);
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product.action === "existing"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.product_variant.action === "create_variant"));
  assert.ok(value.artifact.plans.every((entry) => entry.resolved_plan.offer.values.shipping_cost === "0"));
});

test("reviewed CM3 profile rejects artifact, CSV, fingerprint, retailer and commercial drift", () => {
  const artifact = fixture("cm3-missing-variants-5");
  artifact.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifact), /clean-run contract mismatch/);

  const csv = fixture("cm3-missing-variants-5");
  csv.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csv), /clean-run contract mismatch/);

  const fingerprint = fixture("cm3-missing-variants-5");
  fingerprint.manifest.execution_profile.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);

  const retailer = fixture("cm3-missing-variants-5");
  retailer.artifact.plans[0].resolved_plan.retailer.id = "14";
  assert.throws(() => validate(retailer), /Unsafe Predators Gear CM3 variant plan/);

  const shipping = fixture("cm3-missing-variants-5");
  shipping.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(shipping), /Unsafe Predators Gear CM3 variant plan/);
});

test("reviewed CM3 profile rejects product creation, existing variant, product 337 and alias drift", () => {
  const product = fixture("cm3-missing-variants-5");
  product.artifact.plans[0].resolved_plan.product = { action: "create", values: {} };
  assert.throws(() => validate(product), /Unsafe Predators Gear CM3 variant plan/);

  const variant = fixture("cm3-missing-variants-5");
  variant.artifact.plans[0].resolved_plan.product_variant = { action: "existing", id: "1043" };
  assert.throws(() => validate(variant), /Unsafe Predators Gear CM3 variant plan/);

  const oldProduct = fixture("cm3-missing-variants-5");
  oldProduct.manifest.rows[0].target_product_id = 337;
  assert.throws(() => validate(oldProduct), /Unsafe CM3 reviewed manifest row/);

  const alias = fixture("cm3-missing-variants-5");
  alias.manifest.rows[3].flavour = "Pineapple";
  assert.throws(() => validate(alias), /Unsafe CM3 reviewed manifest row/);
});

test("reviewed new-products profile rejects unreviewed creation, 400g reuse, shipping, and retailer drift", () => {
  const product = fixture("reviewed-new-products-v1");
  product.artifact.plans[0].resolved_plan.product.values.name = "DY Nutrition The Creatine Complex 400g";
  assert.throws(() => validate(product), /Unsafe Predators Gear reviewed creation plan/);

  const reuse = fixture("reviewed-new-products-v1");
  reuse.artifact.plans[0].resolved_plan.product = { action: "existing", id: "754" };
  assert.throws(() => validate(reuse), /Unsafe Predators Gear reviewed creation plan/);

  const shipping = fixture("reviewed-new-products-v1");
  shipping.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(shipping), /Unsafe Predators Gear reviewed creation plan/);

  const retailer = fixture("reviewed-new-products-v1");
  retailer.artifact.plans[0].retailer_id = "14";
  assert.throws(() => validate(retailer), /Unsafe Predators Gear reviewed creation plan/);

  const held = fixture("reviewed-new-products-v1");
  held.manifest.rows[4].product_name = "DY Nutrition Joint Support";
  assert.throws(() => validate(held), /Unsafe reviewed manifest row/);
});

test("Shadowhey profile rejects hash, retailer, target, and fingerprint drift", () => {
  const artifactSha = fixture("shadowhey-3");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const csvSha = fixture("shadowhey-3");
  csvSha.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csvSha), /clean-run contract mismatch/);

  const retailer = fixture("shadowhey-3");
  retailer.artifact.plans[0].resolved_plan.retailer = { action: "create", values: {} };
  retailer.artifact.plans[0].resolved_plan.expected_state.retailer = null;
  assert.throws(() => validate(retailer), /Unsafe existing retailer plan/);

  const target = fixture("shadowhey-3");
  target.manifest.rows[0].product_variant_id = 875;
  assert.throws(() => validate(target), /manifest contract mismatch/);

  const fingerprint = fixture("shadowhey-3");
  fingerprint.manifest.execution_profile.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);
});

test("held profiles reject variant, exact options, profile scope and fingerprint drift", () => {
  const variant = fixture("held-olimp-exact-2");
  variant.manifest.rows.find((row) => row.review_row === 1).product_variant_id = 488;
  assert.throws(() => validate(variant), /manifest contract mismatch/);

  const options = fixture("held-cm3-exact-2");
  options.artifact.source_rows[1].normalized_source_row.external_options = JSON.stringify({ Size: "250g", Flavour: "Pineapple" });
  assert.throws(() => validate(options), /Unsafe Predators Gear plan/);

  const scope = fixture("held-cm3-exact-2");
  scope.manifest.execution_profiles.cm3_cross_product_parent.review_rows = [3, 5];
  assert.throws(() => validate(scope), /manifest contract mismatch/);

  const fingerprint = fixture("held-cm3-exact-2");
  fingerprint.manifest.execution_profiles.cm3_cross_product_parent.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprint), /manifest contract mismatch/);
});

test("batch-two profile rejects held rows and reviewed fingerprint drift", () => {
  const held = fixture("batch-2-safe-5");
  held.manifest.execution_subset.review_rows = [1, 3, 6, 7, 8];
  assert.throws(() => validate(held), /manifest contract mismatch/);

  const fingerprintDrift = fixture("batch-2-safe-5");
  fingerprintDrift.manifest.execution_subset.plan_fingerprints[0] = "f".repeat(32);
  assert.throws(() => validate(fingerprintDrift), /manifest contract mismatch/);
});

test("batch-two profile rejects wrong artifact SHA, CSV SHA, and retailer drift", () => {
  const artifactSha = fixture("batch-2-safe-5");
  artifactSha.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(artifactSha), /clean-run contract mismatch/);

  const csvSha = fixture("batch-2-safe-5");
  csvSha.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(csvSha), /clean-run contract mismatch/);

  const retailer = fixture("batch-2-safe-5");
  retailer.artifact.plans[0].retailer_id = "14";
  retailer.artifact.plans[0].resolved_plan.retailer.id = "14";
  retailer.artifact.plans[0].resolved_plan.expected_state.retailer.id = "14";
  assert.throws(() => validate(retailer), /Unsafe existing retailer plan/);
});

test("remaining-six profile rejects wrong artifact SHA", () => {
  const value = fixture("remaining-6");
  value.loaded.artifactSha256 = "b".repeat(64);
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("remaining-six profile rejects wrong CSV SHA", () => {
  const value = fixture("remaining-6");
  value.csvBytes = Buffer.from("different reviewed CSV\n", "utf8");
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("remaining-six profile rejects retailer creation and retailer ID drift", () => {
  const createValue = fixture("remaining-6");
  createValue.artifact.plans[0].resolved_plan.retailer = {
    action: "create",
    values: { name: "Predators Gear", slug: "predators-gear", website: "https://predatorsgear.co.uk/" },
  };
  createValue.artifact.plans[0].resolved_plan.expected_state.retailer = null;
  assert.throws(() => validate(createValue), /Unsafe existing retailer plan/);

  const wrongIdValue = fixture("remaining-6");
  wrongIdValue.artifact.plans[0].retailer_id = "14";
  wrongIdValue.artifact.plans[0].resolved_plan.retailer.id = "14";
  wrongIdValue.artifact.plans[0].resolved_plan.expected_state.retailer.id = "14";
  assert.throws(() => validate(wrongIdValue), /Unsafe existing retailer plan/);
});

test("remaining-six profile rejects plans outside its fingerprints", () => {
  const value = fixture("remaining-6");
  const unknown = "f".repeat(32);
  value.artifact.plans[0].plan_fingerprint = unknown;
  value.artifact.plans[0].resolved_plan.meta.plan_fingerprint = unknown;
  value.artifact.source_rows[0].plan_fingerprint = unknown;
  assert.throws(() => validate(value), /reviewed fingerprint set/);
});

test("remaining-six profile rejects a Mass Gainer identity", () => {
  const value = fixture("remaining-6");
  const source = value.artifact.source_rows[0].normalized_source_row;
  source.external_product_id = "8594181609003";
  source.external_variant_id = "8594181609004";
  assert.throws(() => validate(value), /Unreviewed or duplicate artifact identity/);
});

test("remaining-six profile rejects Whey rows not targeting product 510", () => {
  const value = fixture("remaining-6");
  value.manifest.rows.find((row) => row.review_row === 6).product_id = 511;
  assert.throws(() => validate(value), /Whey review row 6 must target product 510/);
});

test("runner rejects an artifact with blockers", () => {
  const value = fixture();
  value.artifact.blocked_rows.push({ row_number: "2", reason: "blocked" });
  value.artifact.summary.blocked_row_count = "1";
  assert.throws(() => validate(value), /clean-run contract mismatch/);
});

test("runner rejects an unknown plan fingerprint", () => {
  const value = fixture();
  value.options.planFingerprint = "f".repeat(32);
  assert.throws(() => validate(value), /not selectable|exactly one matching plan/);
});

test("runner rejects a product creation plan", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product = { action: "create", values: {} };
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects a variant creation plan", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product_variant = { action: "create", values: {} };
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects non-zero Predators Gear shipping", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99";
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner rejects any plan targeting product 337", () => {
  const value = fixture();
  value.artifact.plans[0].resolved_plan.product.id = "337";
  assert.throws(() => validate(value), /Unsafe Predators Gear plan/);
});

test("runner source is direct-PG approval-only with the dedicated local role", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts", "predators-gear-artifact-approver.js"),
    "utf8"
  );
  assert.match(source, /require\("pg"\)/);
  assert.match(source, /production-approver\.env/);
  assert.match(source, /set local role \$\{APPROVER_ROLE\}/);
  assert.match(source, /approve_product_import_plan/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /apply_approved_product_import_plan/);
  assert.doesNotMatch(source, /pilot[-_ ]apply/i);
  assert.doesNotMatch(source, /from\(["'](?:retailers|products|product_variants|retailer_products|offers)["']\)/);
});

test("successful execution calls one approval RPC and never an apply path", async () => {
  const value = fixture();
  const queries = [];
  const client = {
    async connect() { queries.push("CONNECT"); },
    async end() { queries.push("END"); },
    async query(sql) {
      queries.push(sql);
      if (sql === "select current_user,session_user") {
        return {
          rows: [{
            current_user: "retailer_catalogue_production_approver",
            session_user: "supplementscout_production_approver_login",
          }],
        };
      }
      if (/approve_product_import_plan/.test(sql)) {
        return {
          rows: [{
            result: {
              approval_id: "11111111-1111-4111-8111-111111111111",
              artifact_sha256: value.loaded.artifactSha256,
              run_id: value.artifact.run_id,
              plan_fingerprint: FIRST_FINGERPRINT,
              source_row_fingerprint: value.artifact.plans[0].source_row_fingerprint,
              retailer_id: null,
              plan_kind: "feed",
              expires_at: "2026-08-27T12:15:00.000Z",
              status: "approved",
            },
          }],
        };
      }
      return { rows: [] };
    },
  };
  const result = await runApproval(value.options, {
    client,
    connectionString: "postgresql://not-used.invalid/database",
    loaded: value.loaded,
    manifest: value.manifest,
    csvBytes: value.csvBytes,
    configuration: value.configuration,
  });
  assert.equal(result.approval_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.product_action, "existing");
  assert.equal(result.variant_action, "existing");
  assert.equal(result.no_apply_was_run, true);
  assert.equal(queries.filter((query) => /approve_product_import_plan/.test(query)).length, 1);
  assert.equal(queries.filter((query) => /apply_/.test(query)).length, 0);
  assert.ok(queries.includes("commit"));
  assert.ok(!queries.includes("rollback"));
});

test("Predators Gear reviewed-parent transport migration is exact and hash-bound", () => {
  const bytes = fs.readFileSync(PREDATORS_PARENT_TRANSPORT_MIGRATION);
  const sql = bytes.toString("utf8");
  assert.equal(sha256(bytes), PREDATORS_PARENT_TRANSPORT_MIGRATION_SHA256);
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /v_retailer_id = 13/);
  assert.match(sql, /'name','Predators Gear'/);
  assert.match(sql, /'slug','predators-gear'/);
  assert.match(sql, /'website','https:\/\/predatorsgear\.co\.uk\/'/);
  assert.match(sql, /DY Nutrition The Creatine Complex 316g/);
  assert.match(sql, /8594181604892/);
  for (const variantId of ["8594181604895", "8594181604896", "8594181604897"]) {
    assert.match(sql, new RegExp(variantId));
  }
  assert.doesNotMatch(sql, /DY Nutrition The Creatine Complex 400g/);
});

test("Predators Gear reviewed-parent transport migration preserves global catalogue guards", () => {
  const sql = fs.readFileSync(PREDATORS_PARENT_TRANSPORT_MIGRATION, "utf8");
  assert.match(sql, /v_retailer_actual->>'slug' = 'jon-s-supplements'/);
  assert.match(sql, /strict Shopify variant URL identity/);
  assert.match(sql, /retailer and transport policy does not allow this plan/);
  assert.match(sql, /pg_get_functiondef\('public\.atomic_import_validate_pre_source_metadata_plan_core\(jsonb\)'/);
  assert.doesNotMatch(sql, /create or replace function public\.atomic_import_reviewed_parent_variant_allowed/);
  assert.doesNotMatch(
    sql,
    /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i,
  );
  assert.doesNotMatch(sql, /apply_product_import_plan\s*\(/i);
});

test("Predators Gear reviewed-parent URL sibling migration is exact to product 1143 and three approved tuples", () => {
  const sql = fs.readFileSync(PREDATORS_PARENT_URL_SIBLINGS_MIGRATION, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /v_retailer_id=13/);
  assert.match(sql, /rp\.product_id=1143/);
  assert.match(sql, /rp\.product_variant_id=3188/);
  assert.match(sql, /v_external_product_id='8594181604892'/);
  assert.match(sql, /v_external_variant_id in \('8594181604896','8594181604897'\)/);
  for (const value of [
    "8594181604895", "5060763890503", "05060763890503", "Cherry",
    "8594181604896", "5060763890510", "05060763890510", "Peach",
    "8594181604897", "5060763890527", "05060763890527", "Strawberry",
  ]) assert.match(sql, new RegExp(value));
  assert.match(sql, /pv\.product_id=1143/);
  assert.match(sql, /pv\.is_active/);
  assert.match(sql, /not pv\.is_default/);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("Predators Gear reviewed-parent URL sibling migration keeps external variant and SKU collisions fail-closed", () => {
  const sql = fs.readFileSync(PREDATORS_PARENT_URL_SIBLINGS_MIGRATION, "utf8");
  assert.match(sql, /rp\.external_variant_id=v_external_variant_id/);
  assert.match(sql, /rp\.external_sku=v_external_sku and rp\.external_variant_id is distinct from v_external_variant_id/);
  assert.match(sql, /rp\.external_url=v_external_url\s+and not \(/s);
  assert.match(sql, /raise exception 'stale product import plan: retailer product identity'/);
  assert.match(sql, /length\(v_definition\).*<> 1/s);
  assert.doesNotMatch(sql, /grant\s+execute|service_role/i);
});

test("Predators Gear CM3 cross-product URL migration is exact, trigger-only and fail-closed", () => {
  const sql = fs.readFileSync(PREDATORS_CM3_CROSS_PRODUCT_URL_MIGRATION, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /ad3a6ddbde8470ef6e991471289b246a27d9620e6e081be09baa3a4dbc717d82/);
  assert.match(sql, /p_row\.retailer_id = 13/);
  assert.match(sql, /p_row\.external_product_id = '8594181607503'/);
  assert.match(sql, /p_row\.product_id = a\.product_id/);
  assert.match(sql, /pv\.product_id = a\.product_id/);
  assert.match(sql, /pv\.is_active/);
  assert.match(sql, /not pv\.is_default/);
  assert.match(sql, /not exists \(\s*select 1\s*from public\.retailer_products rp/s);
  for (const externalVariantId of [
    "8594181607979", "8594181607980", "8594181607507", "8594181607563",
    "8594181607506", "8594181607977", "8594181607978",
  ]) assert.match(sql, new RegExp(externalVariantId));
  assert.equal((sql.match(/\(361::bigint,/g) || []).length, 4);
  assert.equal((sql.match(/\(1067::bigint,/g) || []).length, 3);
  assert.doesNotMatch(
    sql,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i,
  );
  assert.doesNotMatch(sql, /apply_(?:approved_)?product_import_plan\s*\(/i);
  assert.doesNotMatch(sql, /grant\s+execute/i);
});

test("Predators Gear CM3 cross-product URL migration preserves the global conflict guard", () => {
  const sql = fs.readFileSync(PREDATORS_CM3_CROSS_PRODUCT_URL_MIGRATION, "utf8");
  assert.match(sql, /and product_id is distinct from new\.product_id/);
  assert.match(sql, /and not public\.retailer_products_predators_cm3_cross_product_allowed\(new\)/);
  assert.match(sql, /v_old text := \$old\$and product_id is distinct from new\.product_id/);
  assert.match(sql, /external_product_id = '8594181607503'/);
  assert.match(sql, /external_url = 'https:\/\/predatorsgear\.co\.uk\/supplements-vitamins-shop\/creatine-cm3\/'/);
  assert.match(sql, /external_options = jsonb_build_object/);
  assert.match(sql, /has_function_privilege/);
  assert.match(sql, /revoke all on function/);
});
