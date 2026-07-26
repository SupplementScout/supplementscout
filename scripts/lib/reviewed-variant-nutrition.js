const crypto = require("node:crypto");
const fs = require("node:fs");
const { fingerprint } = require("./retailer-offer-sync/artifacts");

const SHA256 = /^[0-9a-f]{64}$/;
const POSITIVE_ID = /^[1-9][0-9]*$/;
const MANIFEST_KEYS = [
  "schema_version",
  "kind",
  "status",
  "authorized_by",
  "authorized_at",
  "source_policy",
  "reviewed_scope_hash",
  "changes",
];
const CHANGE_KEYS = [
  "product_id",
  "expected_product_name",
  "variant_id",
  "expected_variant_key",
  "expected_display_name",
  "before_nutrition_override",
  "after_nutrition_override",
  "source_url",
  "evidence",
];
const NUTRITION_KEYS = [
  "net_weight_g",
  "serving_count_verified",
  "serving_size_g",
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "product_format",
  "unit_pricing_verified",
  "nutrition_verified",
  "source_url",
  "source_type",
  "evidence",
];

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function exactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nullableNonnegative(value) {
  return value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validateNutrition(value, rowNumber) {
  const label = `reviewed nutrition row ${rowNumber}`;
  invariant(exactKeys(value, NUTRITION_KEYS), `${label} override keys mismatch`);
  invariant(finitePositive(value.net_weight_g), `${label} net weight is invalid`);
  invariant(
    Number.isInteger(value.serving_count_verified) &&
      value.serving_count_verified > 0,
    `${label} serving count is invalid`,
  );
  invariant(finitePositive(value.serving_size_g), `${label} serving size is invalid`);
  invariant(
    nullableNonnegative(value.protein_per_serving_g) &&
      nullableNonnegative(value.creatine_per_serving_g),
    `${label} nutrition amount is invalid`,
  );
  const protein = value.protein_per_serving_g || 0;
  const creatine = value.creatine_per_serving_g || 0;
  invariant(protein > 0 || creatine > 0, `${label} has no priced nutrient`);
  invariant(
    Math.max(protein, creatine) <= value.serving_size_g,
    `${label} nutrient exceeds serving size`,
  );
  invariant(value.product_format === "powder", `${label} format is not supported`);
  invariant(
    value.unit_pricing_verified === true && value.nutrition_verified === true,
    `${label} verification flags must be true`,
  );
  invariant(
    value.source_type === "manufacturer_product_page",
    `${label} source type is not authoritative`,
  );
  invariant(/^https:\/\//.test(value.source_url), `${label} source URL is invalid`);
  invariant(
    typeof value.evidence === "string" && value.evidence.trim().length >= 20,
    `${label} evidence is insufficient`,
  );
  invariant(
    Math.abs(
      value.net_weight_g -
        value.serving_count_verified * value.serving_size_g,
    ) <= value.serving_size_g,
    `${label} package and serving values are inconsistent`,
  );
}

function validateReviewedManifest(manifest) {
  invariant(exactKeys(manifest, MANIFEST_KEYS), "reviewed manifest keys mismatch");
  invariant(
    manifest.schema_version === 1 &&
      manifest.kind === "reviewed-product-variant-nutrition-manifest-v1" &&
      manifest.status === "REVIEWED",
    "reviewed manifest identity mismatch",
  );
  invariant(
    typeof manifest.authorized_by === "string" &&
      manifest.authorized_by.trim().length > 0,
    "reviewed manifest authorizer is missing",
  );
  invariant(
    Number.isFinite(Date.parse(manifest.authorized_at)),
    "reviewed manifest authorization time is invalid",
  );
  invariant(
    typeof manifest.source_policy === "string" &&
      manifest.source_policy.includes("Manufacturer"),
    "reviewed manifest source policy is invalid",
  );
  invariant(
    SHA256.test(manifest.reviewed_scope_hash),
    "reviewed manifest scope hash is invalid",
  );
  invariant(
    Array.isArray(manifest.changes) &&
      manifest.changes.length >= 1 &&
      manifest.changes.length <= 100,
    "reviewed manifest change count is invalid",
  );

  let previous = 0n;
  for (const [index, row] of manifest.changes.entries()) {
    const label = `reviewed nutrition row ${index + 1}`;
    invariant(exactKeys(row, CHANGE_KEYS), `${label} keys mismatch`);
    invariant(
      POSITIVE_ID.test(row.product_id) && POSITIVE_ID.test(row.variant_id),
      `${label} identity is invalid`,
    );
    const current = BigInt(row.variant_id);
    invariant(current > previous, `${label} variants must be unique and sorted`);
    previous = current;
    for (const key of [
      "expected_product_name",
      "expected_variant_key",
      "expected_display_name",
    ]) {
      invariant(
        typeof row[key] === "string" && row[key].trim().length > 0,
        `${label} ${key} is missing`,
      );
    }
    invariant(
      isPlainObject(row.before_nutrition_override),
      `${label} before override is invalid`,
    );
    validateNutrition(row.after_nutrition_override, index + 1);
    invariant(
      row.source_url === row.after_nutrition_override.source_url &&
        row.evidence === row.after_nutrition_override.evidence,
      `${label} evidence binding mismatch`,
    );
  }
  invariant(
    fingerprint(manifest.changes) === manifest.reviewed_scope_hash,
    "reviewed manifest scope hash mismatch",
  );
  return manifest;
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function loadReviewedManifest(file, requiredSha256) {
  invariant(SHA256.test(requiredSha256), "reviewed manifest SHA-256 is required");
  const bytes = fs.readFileSync(file);
  const actualSha256 = sha256Buffer(bytes);
  invariant(actualSha256 === requiredSha256, "reviewed manifest SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  validateReviewedManifest(manifest);
  return { manifest, sha256: actualSha256 };
}

function buildReviewedContract({
  reviewed,
  targetEnvironment,
  authorizationId,
  targetChanges = reviewed.manifest.changes,
}) {
  invariant(
    targetEnvironment === "STAGING" || targetEnvironment === "PRODUCTION",
    "reviewed contract target is invalid",
  );
  invariant(
    /^[a-z0-9][a-z0-9._:-]{7,199}$/.test(authorizationId),
    "reviewed contract authorization ID is invalid",
  );
  invariant(
    Array.isArray(targetChanges) &&
      targetChanges.length === reviewed.manifest.changes.length,
    "target-bound reviewed scope is invalid",
  );
  for (const [index, targetRow] of targetChanges.entries()) {
    const reviewedRow = reviewed.manifest.changes[index];
    invariant(
      POSITIVE_ID.test(targetRow.product_id) &&
        POSITIVE_ID.test(targetRow.variant_id),
      "target-bound reviewed identity is invalid",
    );
    for (const key of CHANGE_KEYS.filter(
      (name) => name !== "product_id" && name !== "variant_id",
    )) {
      invariant(
        JSON.stringify(targetRow[key]) === JSON.stringify(reviewedRow[key]),
        `target-bound reviewed row ${index + 1} changed ${key}`,
      );
    }
  }
  const sortedTargetChanges = [...targetChanges].sort((left, right) =>
    BigInt(left.variant_id) < BigInt(right.variant_id) ? -1 : 1,
  );
  const core = {
    schema_version: 1,
    kind: "reviewed-product-variant-nutrition-v1",
    authorization_id: authorizationId,
    target_environment: targetEnvironment,
    reviewed_manifest_sha256: reviewed.sha256,
    reviewed_scope_hash: fingerprint(sortedTargetChanges),
    authorized_by: reviewed.manifest.authorized_by,
    authorized_at: reviewed.manifest.authorized_at,
    changes: sortedTargetChanges,
  };
  return { ...core, reviewed_contract_hash: fingerprint(core) };
}

module.exports = {
  CHANGE_KEYS,
  MANIFEST_KEYS,
  NUTRITION_KEYS,
  buildReviewedContract,
  loadReviewedManifest,
  sha256Buffer,
  validateReviewedManifest,
};
