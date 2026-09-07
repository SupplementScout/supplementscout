const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const { canonicalJson, normalizeNumbersToDecimalStrings } = require("./canonical-json");

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const REVIEWED_ACTIONS = new Set([
  "map_existing_variant",
  "create_variant_on_existing_product",
  "create_product_with_default_variant",
  "create_product_with_variant",
]);

function fail(message) {
  throw new Error(message);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function normalizedManifestSha(bytes) {
  return sha256(Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8"));
}

function planFingerprint(plan) {
  const normalized = normalizeNumbersToDecimalStrings(plan);
  normalized.meta.plan_fingerprint = null;
  return crypto.createHash("md5").update(canonicalJson(normalized)).digest("hex");
}

function withinRoot(root, relativePath, prefix) {
  invariant(typeof relativePath === "string" && relativePath.replaceAll("\\", "/").startsWith(prefix), `Reviewed ${prefix} path required`);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Reviewed package path escapes the repository");
  return resolved;
}

function exactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys mismatch`);
}

function decimal(value, label) {
  invariant(/^\d+(?:\.\d{1,2})?$/.test(String(value)), `${label} must be a non-negative decimal`);
  return Number(value);
}

function validateManifest(manifest, profileId) {
  exactKeys(manifest, ["schema_version", "kind", "status", "authorized_by", "authorized_at", "retailer", "policy", "profiles"], "reviewed manifest");
  invariant(manifest.schema_version === 1 && manifest.kind === "reviewed-catalogue-package-v1", "Reviewed manifest identity mismatch");
  invariant(manifest.status === "OWNER_APPROVED", "Reviewed manifest is not owner approved");
  invariant(typeof manifest.authorized_by === "string" && manifest.authorized_by.trim(), "Reviewed manifest authorizer missing");
  invariant(!Number.isNaN(Date.parse(manifest.authorized_at)), "Reviewed manifest authorization time invalid");
  exactKeys(manifest.retailer, ["id", "name", "slug", "website", "expected_action", "shipping_known", "shipping_cost"], "reviewed retailer");
  invariant(Number.isSafeInteger(manifest.retailer.id) && manifest.retailer.id > 0, "Reviewed retailer ID invalid");
  invariant(manifest.retailer.expected_action === "existing", "Reviewed retailer must already exist");
  invariant(manifest.retailer.shipping_known === true, "Reviewed shipping must be known");
  decimal(manifest.retailer.shipping_cost, "Reviewed shipping cost");
  exactKeys(manifest.policy, ["reviewed_rows_only", "allow_product_creation", "allow_variant_creation", "allow_canonical_product_updates", "allow_canonical_variant_updates", "allow_canonical_gtin_updates", "allow_category_changes", "sku_is_not_gtin", "one_plan_at_a_time", "fresh_single_use_approval_per_plan", "strict_production_readback_after_each_apply"], "reviewed policy");
  for (const key of ["reviewed_rows_only", "sku_is_not_gtin", "one_plan_at_a_time", "fresh_single_use_approval_per_plan", "strict_production_readback_after_each_apply"]) invariant(manifest.policy[key] === true, `Reviewed policy ${key} must be true`);
  for (const key of ["allow_canonical_product_updates", "allow_canonical_variant_updates", "allow_canonical_gtin_updates", "allow_category_changes"]) invariant(manifest.policy[key] === false, `Reviewed policy ${key} must be false`);
  invariant(Array.isArray(manifest.profiles) && manifest.profiles.length > 0, "Reviewed profiles missing");
  const profile = manifest.profiles.find(candidate => candidate.id === profileId);
  invariant(profile && manifest.profiles.filter(candidate => candidate.id === profileId).length === 1, "Exact reviewed profile missing");
  exactKeys(profile, ["id", "status", "csv_path", "csv_sha256", "artifact_path", "artifact_sha256", "row_count", "blocked_row_count", "conflict_count", "expected_actions", "rows"], "reviewed profile");
  invariant(profile.status === "DRY_RUN_PASS", "Reviewed profile dry-run is not approved");
  invariant(HEX64.test(profile.csv_sha256) && HEX64.test(profile.artifact_sha256), "Reviewed profile digest invalid");
  invariant(Number.isSafeInteger(profile.row_count) && profile.row_count > 0, "Reviewed row count invalid");
  invariant(profile.blocked_row_count === 0 && profile.conflict_count === 0, "Reviewed profile contains blockers or conflicts");
  invariant(Array.isArray(profile.rows) && profile.rows.length === profile.row_count, "Reviewed profile row count mismatch");
  exactKeys(profile.expected_actions, ["retailers_create", "products_create", "product_variants_create", "retailer_products_create", "offers_create", "price_history_create"], "reviewed expected actions");
  invariant(profile.expected_actions.retailers_create === 0, "Reviewed package cannot create a retailer");
  invariant(profile.expected_actions.retailer_products_create === profile.row_count && profile.expected_actions.offers_create === profile.row_count && profile.expected_actions.price_history_create === profile.row_count, "Reviewed mapping/offer/history counts mismatch");
  invariant(profile.expected_actions.products_create === 0 || manifest.policy.allow_product_creation, "Reviewed product creation is not allowed");
  invariant(profile.expected_actions.product_variants_create === 0 || manifest.policy.allow_variant_creation, "Reviewed variant creation is not allowed");
  const sourceIds = new Set();
  const fingerprints = new Set();
  for (const row of profile.rows) {
    exactKeys(row, ["review_row", "external_product_id", "external_variant_id", "external_sku", "external_gtin", "source_url", "product_id", "product_variant_id", "action", "brand", "category", "product_name", "variant_name", "flavour", "size_value", "size_unit", "pack_count", "product_format", "price", "in_stock", "source_row_fingerprint", "plan_fingerprint"], "reviewed row");
    invariant(Number.isSafeInteger(row.review_row) && row.review_row > 0, "Reviewed row number invalid");
    invariant(typeof row.external_product_id === "string" && row.external_product_id && typeof row.external_variant_id === "string" && row.external_variant_id, "Reviewed source identity missing");
    invariant(REVIEWED_ACTIONS.has(row.action), "Reviewed action invalid");
    invariant(HEX64.test(row.source_row_fingerprint) && HEX32.test(row.plan_fingerprint), "Reviewed row fingerprint invalid");
    invariant(row.external_gtin === null || row.external_gtin !== row.external_sku, "Reviewed SKU cannot be used as GTIN");
    invariant(/^https:\/\//.test(row.source_url), "Reviewed source URL invalid");
    invariant(!sourceIds.has(row.external_variant_id) && !fingerprints.has(row.plan_fingerprint), "Reviewed row identity is duplicated");
    sourceIds.add(row.external_variant_id);
    fingerprints.add(row.plan_fingerprint);
  }
  return profile;
}

function actionCounts(plans) {
  return {
    retailers_create: plans.filter(entry => entry.resolved_plan.retailer.action === "create").length,
    products_create: plans.filter(entry => ["create", "create_or_reuse_reviewed"].includes(entry.resolved_plan.product.action)).length,
    product_variants_create: plans.filter(entry => ["create", "create_default", "create_variant", "create_reviewed_variant"].includes(entry.resolved_plan.product_variant.action)).length,
    retailer_products_create: plans.filter(entry => entry.resolved_plan.retailer_product.action === "create").length,
    offers_create: plans.filter(entry => entry.resolved_plan.offer.action === "create").length,
    price_history_create: plans.filter(entry => entry.resolved_plan.price_history.action === "create").length,
  };
}

function validatePlan(entry, reviewed, retailer) {
  const plan = entry.resolved_plan;
  invariant(planFingerprint(plan) === entry.plan_fingerprint && entry.plan_fingerprint === reviewed.plan_fingerprint, "Reviewed plan fingerprint mismatch");
  invariant(entry.source_row_fingerprint === reviewed.source_row_fingerprint, "Reviewed source fingerprint mismatch");
  invariant(plan.meta.plan_kind === "feed" && plan.meta.operation_type === "standard_import", "Reviewed plan type invalid");
  invariant(plan.retailer.action === "existing" && String(plan.retailer.id) === String(retailer.id), "Reviewed retailer binding mismatch");
  invariant(plan.retailer_product.action === "create" && plan.offer.action === "create" && plan.price_history.action === "create", "Reviewed commercial actions mismatch");
  const mapping = plan.retailer_product.values;
  const offer = plan.offer.values;
  invariant(String(mapping.external_product_id) === reviewed.external_product_id && String(mapping.external_variant_id) === reviewed.external_variant_id, "Reviewed source identity mismatch");
  invariant((mapping.external_sku ?? null) === reviewed.external_sku && (mapping.external_gtin ?? null) === reviewed.external_gtin, "Reviewed SKU/GTIN mismatch");
  invariant(mapping.external_gtin == null || mapping.external_gtin !== mapping.external_sku, "Reviewed SKU cannot be promoted to GTIN");
  invariant(mapping.external_url === reviewed.source_url && offer.url === reviewed.source_url, "Reviewed source URL mismatch");
  invariant(String(plan.product.id ?? "") === String(reviewed.product_id ?? ""), "Reviewed product binding mismatch");
  invariant(String(plan.product_variant.id ?? "") === String(reviewed.product_variant_id ?? ""), "Reviewed variant binding mismatch");
  const validActions = reviewed.action === "map_existing_variant"
    ? plan.product.action === "existing" && plan.product_variant.action === "existing"
    : reviewed.action === "create_variant_on_existing_product"
      ? plan.product.action === "existing" && plan.product_variant.action === "create_variant"
      : reviewed.action === "create_product_with_variant"
        ? plan.product.action === "create_or_reuse_reviewed" && plan.product_variant.action === "create_reviewed_variant"
        : plan.product.action === "create" && plan.product_variant.action === "create_default";
  invariant(validActions, "Reviewed catalogue action mismatch");
  invariant(offer.shipping_cost != null && Number(offer.shipping_cost) === Number(retailer.shipping_cost), "Reviewed shipping mismatch");
  invariant(Number(offer.total_price) === Number((Number(offer.price) + Number(retailer.shipping_cost)).toFixed(2)), "Reviewed delivered price mismatch");
  invariant(Number(offer.price) === Number(reviewed.price) && Boolean(offer.in_stock) === reviewed.in_stock, "Reviewed price or stock mismatch");
  if (reviewed.action.startsWith("create_product")) {
    const approvalType = reviewed.action === "create_product_with_default_variant"
      ? "safe_create"
      : "reviewed_parent_variant_safe_create";
    invariant(plan.approval.approved === true && plan.approval.approval_type === approvalType, "Reviewed product-create identity approval invalid");
  } else {
    invariant(plan.approval.approved === false && plan.approval.approval_type === "none", "Reviewed dry-run approval state invalid");
  }
  invariant(plan.expected_state.retailer && String(plan.expected_state.retailer.id) === String(retailer.id), "Reviewed retailer before-state missing");
  if (plan.product.action === "existing") invariant(plan.expected_state.product && plan.expected_state.product.is_active === true && plan.expected_state.product.merged_into_product_id == null, "Reviewed existing product is inactive or merged");
  if (plan.product_variant.action === "existing") invariant(plan.expected_state.product_variant && plan.expected_state.product_variant.is_active === true && String(plan.expected_state.product_variant.product_id) === String(reviewed.product_id), "Reviewed existing variant is invalid");
  invariant(plan.expected_state.retailer_product === null && plan.expected_state.offer === null, "Reviewed source mapping already exists");
}

function loadReviewedPackage(options, readFile = fs.readFileSync) {
  const root = path.resolve(options.root || path.resolve(__dirname, "../.."));
  invariant(HEX64.test(String(options.manifestSha256 || "").toLowerCase()), "Exact reviewed manifest SHA-256 required");
  const manifestPath = withinRoot(root, options.manifestPath, "config/retailers/");
  const manifestBytes = readFile(manifestPath);
  invariant(normalizedManifestSha(manifestBytes) === options.manifestSha256.toLowerCase(), "Reviewed manifest SHA-256 mismatch");
  const manifest = JSON.parse(manifestBytes);
  const profile = validateManifest(manifest, options.profileId);
  const csvPath = withinRoot(root, profile.csv_path, "tmp/retailer-feeds/");
  const artifactPath = withinRoot(root, profile.artifact_path, "tmp/retailer-feeds/");
  const csvBytes = readFile(csvPath);
  const artifactBytes = readFile(artifactPath);
  invariant(sha256(csvBytes) === profile.csv_sha256, "Reviewed CSV SHA-256 mismatch");
  invariant(sha256(artifactBytes) === profile.artifact_sha256, "Reviewed artifact SHA-256 mismatch");
  const csvRows = parse(csvBytes, { columns: true, skip_empty_lines: true });
  const artifact = normalizeNumbersToDecimalStrings(JSON.parse(artifactBytes));
  invariant(csvRows.length === profile.row_count && artifact.plans.length === profile.row_count && artifact.source_rows.length === profile.row_count, "Reviewed package plan/source/CSV count mismatch");
  invariant(artifact.blocked_rows.length === 0 && artifact.summary.blocked_row_count === "0" && artifact.summary.plan_count === String(profile.row_count), "Reviewed artifact blockers or plan count mismatch");
  invariant(artifact.source_file_sha256 === profile.csv_sha256, "Reviewed artifact CSV binding mismatch");
  invariant(canonicalJson(actionCounts(artifact.plans)) === canonicalJson(profile.expected_actions), "Reviewed artifact action counts mismatch");
  const byFingerprint = new Map(artifact.plans.map(entry => [entry.plan_fingerprint, entry]));
  invariant(byFingerprint.size === profile.row_count, "Reviewed artifact contains duplicate fingerprints");
  for (const reviewed of profile.rows) {
    const entry = byFingerprint.get(reviewed.plan_fingerprint);
    invariant(entry, "Reviewed artifact plan missing");
    const source = artifact.source_rows.find(candidate => candidate.plan_fingerprint === reviewed.plan_fingerprint);
    invariant(source && source.status === "planned" && source.source_row_fingerprint === reviewed.source_row_fingerprint, "Reviewed artifact source row mismatch");
    validatePlan(entry, reviewed, manifest.retailer);
  }
  invariant(HEX32.test(options.planFingerprint || ""), "Exact reviewed plan fingerprint required");
  const reviewed = profile.rows.find(row => row.plan_fingerprint === options.planFingerprint);
  invariant(reviewed, "Selected plan is outside the reviewed manifest");
  return { root, manifestPath, manifest, profile, csvPath, artifactPath, artifact, csvRows, reviewed, entry: byFingerprint.get(options.planFingerprint) };
}

function loadReviewedSourceProfile(options, sourceBytes, readFile = fs.readFileSync) {
  const root = path.resolve(options.root || path.resolve(__dirname, "../.."));
  invariant(HEX64.test(String(options.manifestSha256 || "").toLowerCase()), "Exact reviewed manifest SHA-256 required");
  const manifestPath = withinRoot(root, options.manifestPath, "config/retailers/");
  const manifestBytes = readFile(manifestPath);
  invariant(normalizedManifestSha(manifestBytes) === options.manifestSha256.toLowerCase(), "Reviewed manifest SHA-256 mismatch");
  const manifest = JSON.parse(manifestBytes);
  const profile = validateManifest(manifest, options.profileId);
  invariant(sha256(sourceBytes) === profile.csv_sha256, "Reviewed CSV SHA-256 mismatch");
  return { manifest, profile, manifestPath };
}

module.exports = { actionCounts, loadReviewedPackage, loadReviewedSourceProfile, normalizedManifestSha, planFingerprint, sha256, validateManifest, validatePlan };
