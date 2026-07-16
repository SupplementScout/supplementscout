const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  addDecimalStrings,
  assertNoUndefined,
  canonicalJson,
  normalizeDecimalString,
  normalizeNumbersToDecimalStrings,
  omitUndefinedObjectFields,
} = require("./lib/canonical-json");
const {
  analyzeFeedRows,
  assessVariantCompatibility,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  isAmbiguousFeedRow,
  isSafeCreateRowAmbiguous,
  isProductGtinVerified,
  normalizeFlavour,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseSize,
  parseStrictBoolean,
  parseVariantIdentity,
  sizeKey,
} = require("./lib/feed-variant-guards");

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  quiet: true,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

function getSupabase() {
  if (supabase) {
    return supabase;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

function setSupabaseForTests(client) {
  supabase = client;
}

function hashJson(value, algorithm = "md5") {
  assertNoUndefined(value);
  return crypto.createHash(algorithm).update(canonicalJson(value)).digest("hex");
}

function normalizeSourceRow(row) {
  return normalizeNumbersToDecimalStrings(omitUndefinedObjectFields(row));
}

function sourceRowFingerprint(row) {
  return hashJson(normalizeSourceRow(row), "sha256");
}

// Trust model: service_role is a trusted backend administrator. Fingerprints and
// the one-time ledger bind an operator-reviewed artifact to one source row and
// protect against accidental cross-record apply, changed input, replay and stale
// state. They are not a cryptographic boundary against a malicious service_role.
function approvalFingerprint(approval) {
  return hashJson({ ...approval, approval_fingerprint: null });
}

function planFingerprint(plan) {
  const normalized = normalizeNumbersToDecimalStrings({
    ...plan,
    meta: { ...plan.meta, plan_fingerprint: null },
  });
  return hashJson(normalized);
}

function serializeImportPlan(plan) {
  const normalized = normalizeNumbersToDecimalStrings(plan);
  assertNoUndefined(normalized);
  return JSON.parse(canonicalJson(normalized));
}

function decimalOrNull(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return normalizeDecimalString(value, fieldName);
}

function positiveDecimal(value, fieldName) {
  const normalized = normalizeDecimalString(value, fieldName);
  if (normalized.startsWith("-") || normalized === "0") {
    throw new Error(`${fieldName} must be greater than 0`);
  }
  return normalized;
}

function nonNegativeDecimal(value, fieldName) {
  const normalized = normalizeDecimalString(value, fieldName);
  if (normalized.startsWith("-")) throw new Error(`${fieldName} must be 0 or greater`);
  return normalized;
}

const IMPORT_ARTIFACT_VERSION = 1;
const IMPORT_ARTIFACT_ROOT = path.join(process.cwd(), "tmp", "import-plans");
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MD5_PATTERN = /^[0-9a-f]{32}$/;

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function artifactSidecarPath(artifactPath) {
  return `${artifactPath}.sha256`;
}

function buildDryRunArtifact(rows, result, options = {}) {
  const runId = String(options.runId || crypto.randomUUID()).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId)) {
    throw new Error("Dry-run artifact run_id is invalid");
  }
  const createdAt = String(options.createdAt || new Date().toISOString());
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Dry-run artifact created_at is invalid");
  const sourceBytes = Buffer.isBuffer(options.sourceBytes)
    ? options.sourceBytes
    : Buffer.from(String(options.sourceContent ?? canonicalJson(normalizeSourceRow(rows))), "utf8");
  const approvedByRow = new Map(
    (result.report?.approvedRows || []).map((item) => [item.rowNumber, item])
  );
  const blockedByRow = new Map(
    (result.blockedRows || []).map((item) => [item.rowNumber, item])
  );
  const sourceRows = rows.map((row, index) => {
    const rowNumber = index + 2;
    const approved = approvedByRow.get(rowNumber);
    const normalizedSourceRow = normalizeSourceRow(approved?.row || row);
    return {
      row_number: String(rowNumber),
      normalized_source_row: normalizedSourceRow,
      source_row_fingerprint: sourceRowFingerprint(normalizedSourceRow),
      status: approved ? "planned" : blockedByRow.has(rowNumber) ? "blocked" : "skipped",
      plan_fingerprint: approved?.importPlan?.meta?.plan_fingerprint || null,
    };
  });
  const plans = (result.report?.approvedRows || []).map((item) => {
    const plan = serializeImportPlan(item.importPlan);
    const retailerId = plan.retailer.action === "existing" ? plan.retailer.id : null;
    const entry = {
      row_number: String(item.rowNumber),
      source_row_fingerprint: plan.meta.source_row_fingerprint,
      plan_fingerprint: plan.meta.plan_fingerprint,
      retailer_id: retailerId,
      plan_kind: plan.meta.plan_kind,
      operation_type: plan.meta.operation_type,
      resolved_plan: plan,
    };
    if (item.legacyMappingUpgrade) {
      entry.retailer_product_id = String(item.mapping.id);
      entry.before = normalizeNumbersToDecimalStrings(
        expectedMappingState(item.mapping)
      );
      entry.after = plan.retailer_product.values;
      entry.exact_url_evidence = item.legacyMappingUpgrade.exactUrl;
      entry.expected_updated_at = item.legacyMappingUpgrade.controls.expectedUpdatedAt;
      entry.approved_evidence_summary = item.legacyMappingUpgrade.approvedEvidence;
    }
    return entry;
  });
  const artifact = {
    artifact_version: String(IMPORT_ARTIFACT_VERSION),
    run_id: runId,
    created_at: createdAt,
    source_file_name: path.basename(String(options.sourceFileName || "programmatic-input.json")),
    source_file_sha256: sha256Bytes(sourceBytes),
    row_count: String(rows.length),
    source_rows: sourceRows,
    plans,
    blocked_rows: result.blockedRows || [],
    summary: {
      plan_count: String(plans.length),
      blocked_row_count: String((result.blockedRows || []).length),
      skipped_row_count: String(result.skipped || 0),
    },
    environment_marker: String(options.environmentMarker || "local"),
  };
  assertNoUndefined(artifact);
  return JSON.parse(canonicalJson(artifact));
}

function writeDryRunArtifact(rows, result, options = {}) {
  const artifact = buildDryRunArtifact(rows, result, options);
  const artifactPath = path.resolve(
    options.artifactPath || path.join(IMPORT_ARTIFACT_ROOT, `${artifact.run_id}.json`)
  );
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const artifactSha256 = sha256Bytes(bytes);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, bytes, { encoding: "utf8", flag: "wx" });
  try {
    fs.writeFileSync(artifactSidecarPath(artifactPath), `${artifactSha256}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    fs.unlinkSync(artifactPath);
    throw error;
  }
  return { artifact, artifactPath, artifactSha256 };
}

function loadDryRunArtifact(artifactPath) {
  const resolvedPath = path.resolve(String(artifactPath || ""));
  if (!artifactPath || !fs.existsSync(resolvedPath)) throw new Error("Dry-run artifact not found");
  const sidecar = artifactSidecarPath(resolvedPath);
  if (!fs.existsSync(sidecar)) throw new Error("Dry-run artifact SHA-256 sidecar not found");
  const bytes = fs.readFileSync(resolvedPath);
  const artifactSha256 = sha256Bytes(bytes);
  const expectedSha256 = fs.readFileSync(sidecar, "utf8").trim().toLowerCase();
  if (!SHA256_PATTERN.test(expectedSha256) || artifactSha256 !== expectedSha256) {
    throw new Error("Dry-run artifact SHA-256 mismatch");
  }
  const artifact = JSON.parse(bytes.toString("utf8"));
  assertNoUndefined(artifact);
  if (artifact.artifact_version !== String(IMPORT_ARTIFACT_VERSION)) {
    throw new Error("Unsupported dry-run artifact version");
  }
  if (!Array.isArray(artifact.source_rows) || !Array.isArray(artifact.plans)) {
    throw new Error("Dry-run artifact schema is invalid");
  }
  if (artifact.row_count !== String(artifact.source_rows.length)) {
    throw new Error("Dry-run artifact row_count mismatch");
  }
  for (const sourceRow of artifact.source_rows) {
    if (sourceRow.source_row_fingerprint !== sourceRowFingerprint(sourceRow.normalized_source_row)) {
      throw new Error("Dry-run artifact source row fingerprint mismatch");
    }
  }
  for (const entry of artifact.plans) {
    const plan = entry.resolved_plan;
    if (!plan || entry.plan_fingerprint !== plan.meta?.plan_fingerprint
        || entry.source_row_fingerprint !== plan.meta?.source_row_fingerprint
        || entry.plan_kind !== plan.meta?.plan_kind
        || entry.operation_type !== plan.meta?.operation_type
        || !["standard_import", "legacy_mapping_upgrade"].includes(entry.operation_type)
        || entry.plan_fingerprint !== planFingerprint(plan)
        || !MD5_PATTERN.test(entry.plan_fingerprint)
        || !SHA256_PATTERN.test(entry.source_row_fingerprint)) {
      throw new Error("Dry-run artifact plan metadata mismatch");
    }
    const retailerId = plan.retailer?.action === "existing" ? plan.retailer.id : null;
    if (entry.retailer_id !== retailerId) throw new Error("Dry-run artifact retailer_id mismatch");
    const sourceRow = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    if (!sourceRow || sourceRow.source_row_fingerprint !== entry.source_row_fingerprint) {
      throw new Error("Dry-run artifact plan/source row mismatch");
    }
    if (entry.operation_type === "legacy_mapping_upgrade") {
      const source = sourceRow.normalized_source_row || {};
      if (
        String(source.legacy_mapping_upgrade ?? "").trim().toLowerCase() !== "true" ||
        String(source.retailer_product_id ?? "").trim() !== String(plan.retailer_product?.id) ||
        String(source.expected_retailer_product_updated_at ?? "").trim() !== entry.expected_updated_at ||
        entry.retailer_product_id !== String(plan.retailer_product?.id) ||
        plan.retailer_product?.action === "create" ||
        entry.expected_updated_at !== entry.before?.updated_at ||
        entry.exact_url_evidence !== entry.before?.external_url ||
        entry.exact_url_evidence !== entry.after?.external_url ||
        canonicalJson(entry.before) !== canonicalJson(plan.expected_state?.retailer_product) ||
        canonicalJson(entry.after) !== canonicalJson(plan.retailer_product?.values) ||
        !["noop", "identity_update"].includes(plan.offer?.action) ||
        plan.price_history?.action !== "noop"
      ) {
        throw new Error("Dry-run artifact legacy mapping upgrade metadata mismatch");
      }
    }
  }
  return { artifact, artifactPath: resolvedPath, artifactSha256 };
}

function selectArtifactPlan(loaded, fingerprint) {
  const requested = String(fingerprint || "").trim().toLowerCase();
  if (!MD5_PATTERN.test(requested)) throw new Error("A valid --plan-fingerprint is required");
  const matches = loaded.artifact.plans.filter((entry) => entry.plan_fingerprint === requested);
  if (matches.length !== 1) throw new Error("Artifact must contain exactly one matching plan");
  return matches[0];
}

const CATEGORY_MAPPINGS = new Map([
  ["pre-workout", "Pre Workout"],
  ["pre workout", "Pre Workout"],
  ["creatine supplements", "Creatine"],
  ["amino acid supplements", "Amino Acids"],
]);

function required(value, fieldName, rowNumber) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`Row ${rowNumber}: missing ${fieldName}`);
  }

  return cleaned;
}

function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeCategory(value) {
  const cleaned = normalizeWhitespace(value);
  const mapped = CATEGORY_MAPPINGS.get(cleaned.toLowerCase());

  return mapped || cleaned;
}

function shouldLogCategoryNormalization(inputCategory, normalizedCategory) {
  return normalizedCategory !== normalizeWhitespace(inputCategory);
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return number;
}

function parseFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return number;
}

function parseOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return number;
}

function getInputShippingValue(row) {
  if (
    rowHasColumn(row, "shipping_cost") &&
    row.shipping_cost !== null &&
    row.shipping_cost !== undefined &&
    row.shipping_cost !== ""
  ) {
    return row.shipping_cost;
  }

  if (rowHasColumn(row, "delivery_cost")) {
    return row.delivery_cost;
  }

  if (rowHasColumn(row, "shipping_cost")) {
    return row.shipping_cost;
  }

  return undefined;
}

function getRetailerProductUrl(row) {
  return (
    getDirectRetailerProductUrl(row) ||
    String(row.url || "").trim()
  );
}

function getDirectRetailerProductUrl(row) {
  return (
    String(row.merchant_deep_link || "").trim() ||
    String(row.external_url || "").trim() ||
    String(row.direct_url || "").trim()
  );
}

function getOfferUrl(row) {
  return (
    String(row.aw_deep_link || "").trim() ||
    String(row.affiliate_url || "").trim() ||
    String(row.url || "").trim()
  );
}

function isSimplySupplementsRow(row) {
  const merchantId = String(row.merchant_id || "").trim();
  const merchantName = String(row.merchant_name || row.retailer_name || "")
    .trim()
    .toLowerCase();

  return merchantId === "5959" || merchantName === "simply supplements";
}

function inferSimplySupplementsShipping(price) {
  return price >= 20 ? 0 : 1.99;
}

function normalizeShippingForImport(row, mode = "manual") {
  const shippingInput = getInputShippingValue(row);
  const parsedShipping = parseOptionalFiniteNumber(shippingInput, "shipping_cost");

  if (parsedShipping !== null) {
    if (parsedShipping < 0) {
      throw new Error("shipping_cost must be 0 or greater");
    }

    return {
      row: { ...row, shipping_cost: parsedShipping },
      shippingInferredFromPolicy: false,
    };
  }

  if (mode !== "feed" || !isSimplySupplementsRow(row)) {
    return {
      row: { ...row, shipping_cost: null },
      shippingInferredFromPolicy: false,
    };
  }

  const price = parseFiniteNumber(row.price, "price");

  if (price <= 0) {
    throw new Error("price must be greater than 0");
  }

  const inferredShipping = inferSimplySupplementsShipping(price);

  if (!Number.isFinite(inferredShipping) || inferredShipping < 0) {
    throw new Error("inferred shipping_cost must be a finite non-negative number");
  }

  return {
    row: { ...row, shipping_cost: inferredShipping },
    shippingInferredFromPolicy: true,
  };
}

function rowHasColumn(row, fieldName) {
  return Object.prototype.hasOwnProperty.call(row, fieldName);
}

function optionalPositiveNumber(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (number <= 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be greater than 0`);
  }

  return number;
}

function optionalNonNegativeNumber(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (number < 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be 0 or greater`);
  }

  return number;
}

function optionalPositiveInteger(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be a positive integer`);
  }

  return number;
}

function optionalText(row, fieldName) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  return String(row[fieldName] || "").trim().toLowerCase() || null;
}

function parseRequiredBoolean(value, fieldName) {
  const cleaned = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(cleaned)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(cleaned)) {
    return false;
  }

  throw new Error(`${fieldName} must be a boolean`);
}

const CANONICAL_RETAILER_FEED_SIGNATURE_COLUMNS = [
  "external_product_id",
  "external_variant_id",
  "shipping_known",
];

const CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS = [
  "retailer_name",
  "retailer_website",
  "external_product_id",
  "external_variant_id",
  "product_name",
  "brand",
  "category",
  "slug",
  "external_url",
  "affiliate_url",
  "price",
  "shipping_known",
  "in_stock",
  "is_for_sale",
];

const CANONICAL_RETAILER_FEED_FORBIDDEN_COLUMNS = [
  "gtin",
  "product_gtin_verified",
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "unit_count",
  "unit_type",
  "unit_pricing_verified",
  "nutrition_verified",
];

function isCanonicalRetailerFeedRow(row) {
  return CANONICAL_RETAILER_FEED_SIGNATURE_COLUMNS.every((column) =>
    rowHasColumn(row, column)
  );
}

function normalizeCanonicalRetailerFeedRows(rows) {
  if (!rows.length || !isCanonicalRetailerFeedRow(rows[0])) {
    return rows;
  }

  const headerRow = rows[0];
  const missingColumns = CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS.filter(
    (column) => !rowHasColumn(headerRow, column)
  );
  const forbiddenColumns = CANONICAL_RETAILER_FEED_FORBIDDEN_COLUMNS.filter(
    (column) => rowHasColumn(headerRow, column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Canonical retailer feed missing required column(s): ${missingColumns.join(", ")}`
    );
  }

  if (forbiddenColumns.length > 0) {
    throw new Error(
      `Canonical retailer feed contains forbidden column(s): ${forbiddenColumns.join(", ")}`
    );
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;

    for (const column of CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS) {
      required(row[column], column, rowNumber);
    }

    const shippingKnown = parseRequiredBoolean(row.shipping_known, "shipping_known");
    const shippingInput = String(row.shipping_cost ?? "").trim();
    let shippingCost = null;

    if (!shippingKnown && shippingInput) {
      throw new Error(
        `Row ${rowNumber}: shipping_cost must be blank when shipping_known is false`
      );
    }

    if (shippingKnown) {
      if (!shippingInput) {
        throw new Error(
          `Row ${rowNumber}: shipping_cost is required when shipping_known is true`
        );
      }

      shippingCost = parseFiniteNumber(shippingInput, "shipping_cost");

      if (shippingCost < 0) {
        throw new Error(`Row ${rowNumber}: shipping_cost must be 0 or greater`);
      }
    }

    const size = String(row.size ?? "").trim();
    const sizeUnit = String(row.size_unit ?? "").trim();
    const normalizedSize = size && sizeUnit ? `${size} ${sizeUnit}` : size;
    const packCount = String(row.pack_count ?? "").trim();
    const variantEvidence = [
      String(row.variant_name ?? "").trim(),
      packCount ? `pack of ${packCount}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      ...row,
      variant: variantEvidence,
      size: normalizedSize,
      shipping_cost: shippingCost,
      delivery_cost: undefined,
    };
  });
}

function optionalBoolean(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const cleaned = String(row[fieldName] || "").trim().toLowerCase();

  if (!cleaned) {
    return false;
  }

  if (["true", "1", "yes", "y"].includes(cleaned)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(cleaned)) {
    return false;
  }

  throw new Error(`Row ${rowNumber}: ${fieldName} must be a boolean`);
}

function buildRetailerProductPayload({
  row,
  retailerId,
  productId,
  name,
  slug,
  offerUrl,
  matchMethod,
  matchConfidence,
  productVariantId,
  includeUpdatedAt = false,
}) {
  const externalOptions = parseExternalOptions(row.external_options);
  const payload = {
    retailer_id: retailerId,
    product_id: productId,
    external_product_id: optionalIdentifier(row.external_product_id),
    external_variant_id: optionalIdentifier(row.external_variant_id),
    external_sku: optionalIdentifier(row.external_sku),
    external_options: externalOptions,
    external_name: name,
    external_slug: slug,
    external_gtin: getExternalGtin(row),
    external_url: getRetailerProductUrl(row) || offerUrl,
    match_method: matchMethod,
    match_confidence: matchConfidence,
  };

  if (productVariantId !== undefined && productVariantId !== null) {
    payload.product_variant_id = productVariantId;
  }

  if (includeUpdatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

function optionalIdentifier(value) {
  return String(value ?? "").trim() || null;
}

function parseLegacyMappingUpgradeControls(row) {
  if (rowHasColumn(row, "operation_type")) {
    throw new Error("operation_type is derived by the importer and cannot be supplied");
  }
  const hasFlag = rowHasColumn(row, "legacy_mapping_upgrade");
  const hasMappingId = rowHasColumn(row, "retailer_product_id");
  const hasExpectedUpdatedAt = rowHasColumn(
    row,
    "expected_retailer_product_updated_at"
  );
  const hasStandalone = rowHasColumn(row, "legacy_mapping_standalone");
  const hasOptioned = rowHasColumn(row, "legacy_mapping_optioned");
  if (!hasFlag && !hasMappingId && !hasExpectedUpdatedAt && !hasStandalone && !hasOptioned) return null;

  const enabled = String(row.legacy_mapping_upgrade ?? "").trim().toLowerCase();
  if (enabled !== "true") {
    throw new Error("legacy mapping upgrade requires legacy_mapping_upgrade=true");
  }
  const mappingId = optionalIdentifier(row.retailer_product_id);
  if (!mappingId || !/^\d+$/.test(mappingId) || mappingId === "0") {
    throw new Error("legacy mapping upgrade requires retailer_product_id");
  }
  const expectedUpdatedAt = String(
    row.expected_retailer_product_updated_at ?? ""
  ).trim();
  if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    throw new Error(
      "legacy mapping upgrade requires expected_retailer_product_updated_at"
    );
  }
  const standalone = String(row.legacy_mapping_standalone ?? "")
    .trim()
    .toLowerCase();
  const standaloneEnabled = standalone === "true";
  if (standalone && !["true", "false"].includes(standalone)) {
    throw new Error("legacy mapping standalone proof must be true or false");
  }
  const optioned = String(row.legacy_mapping_optioned ?? "")
    .trim()
    .toLowerCase();
  const optionedEnabled = optioned === "true";
  if (optioned && !["true", "false"].includes(optioned)) {
    throw new Error("legacy mapping optioned proof must be true or false");
  }
  if (standaloneEnabled && optionedEnabled) {
    throw new Error("legacy mapping upgrade cannot be both standalone and optioned");
  }
  if (standaloneEnabled) {
    if (String(row.legacy_standalone_sellable_count ?? "").trim() !== "1") {
      throw new Error("standalone legacy mapping upgrade requires exactly one sellable source row");
    }
    for (const [field, message] of [
      ["legacy_standalone_has_options", "standalone legacy mapping upgrade forbids source options"],
      ["legacy_duplicate_source_listing", "standalone legacy mapping upgrade forbids duplicate source listings"],
      ["legacy_identity_drift", "standalone legacy mapping upgrade forbids identity drift"],
    ]) {
      if (String(row[field] ?? "").trim().toLowerCase() !== "false") {
        throw new Error(message);
      }
    }
  }
  if (optionedEnabled) {
    for (const [field, message] of [
      ["legacy_duplicate_source_listing", "optioned legacy mapping upgrade forbids duplicate source listings"],
      ["legacy_identity_drift", "optioned legacy mapping upgrade forbids identity drift"],
    ]) {
      if (String(row[field] ?? "").trim().toLowerCase() !== "false") {
        throw new Error(message);
      }
    }
  }
  return { mappingId, expectedUpdatedAt, standalone: standaloneEnabled, optioned: optionedEnabled };
}

function parseExternalOptions(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("external_options must be valid JSON object");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("external_options must be a JSON object");
  }

  return parsed;
}

function parseExplicitSize(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:[.,]\d+)?\s*(?:kg|g|mg|mcg|iu|l|ml|servings?|serves?)$/i.test(text)) {
    return null;
  }
  return parseSize(text);
}

function slugifyRetailerName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assignIfSupplied(target, fieldName, value) {
  if (value !== undefined) {
    target[fieldName] = value;
  }
}

function readNormalizedProductFields(row, rowNumber) {
  const fields = {};

  assignIfSupplied(
    fields,
    "net_weight_g",
    optionalPositiveNumber(row, "net_weight_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "net_volume_ml",
    optionalPositiveNumber(row, "net_volume_ml", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_count_verified",
    optionalPositiveInteger(row, "serving_count_verified", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_size_g",
    optionalPositiveNumber(row, "serving_size_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_size_ml",
    optionalPositiveNumber(row, "serving_size_ml", rowNumber)
  );
  assignIfSupplied(
    fields,
    "protein_per_serving_g",
    optionalNonNegativeNumber(row, "protein_per_serving_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "creatine_per_serving_g",
    optionalNonNegativeNumber(row, "creatine_per_serving_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "unit_count",
    optionalPositiveInteger(row, "unit_count", rowNumber)
  );
  assignIfSupplied(fields, "unit_type", optionalText(row, "unit_type"));
  assignIfSupplied(
    fields,
    "product_format",
    optionalText(row, "product_format")
  );
  assignIfSupplied(
    fields,
    "unit_pricing_verified",
    optionalBoolean(row, "unit_pricing_verified", rowNumber)
  );
  assignIfSupplied(
    fields,
    "nutrition_verified",
    optionalBoolean(row, "nutrition_verified", rowNumber)
  );

  if (
    fields.serving_size_g !== undefined &&
    fields.serving_size_g !== null &&
    fields.protein_per_serving_g !== undefined &&
    fields.protein_per_serving_g !== null &&
    fields.protein_per_serving_g > fields.serving_size_g
  ) {
    throw new Error(
      `Row ${rowNumber}: protein_per_serving_g cannot exceed serving_size_g`
    );
  }

  if (
    fields.serving_size_g !== undefined &&
    fields.serving_size_g !== null &&
    fields.creatine_per_serving_g !== undefined &&
    fields.creatine_per_serving_g !== null &&
    fields.creatine_per_serving_g > fields.serving_size_g
  ) {
    throw new Error(
      `Row ${rowNumber}: creatine_per_serving_g cannot exceed serving_size_g`
    );
  }

  if (fields.product_format === "liquid") {
    if (fields.net_weight_g !== undefined && fields.net_weight_g !== null) {
      throw new Error(
        `Row ${rowNumber}: liquid products must use net_volume_ml instead of net_weight_g`
      );
    }

    if (fields.serving_size_g !== undefined && fields.serving_size_g !== null) {
      throw new Error(
        `Row ${rowNumber}: liquid products must use serving_size_ml instead of serving_size_g`
      );
    }
  } else {
    if (fields.net_volume_ml !== undefined && fields.net_volume_ml !== null) {
      throw new Error(`Row ${rowNumber}: net_volume_ml requires product_format liquid`);
    }

    if (fields.serving_size_ml !== undefined && fields.serving_size_ml !== null) {
      throw new Error(`Row ${rowNumber}: serving_size_ml requires product_format liquid`);
    }
  }

  return fields;
}

function buildProductData(row, rowNumber, mode = "manual") {
  const inputCategory = required(row.category, "category", rowNumber);
  const productData = {
    name: required(row.product_name, "product_name", rowNumber),
    slug: required(row.slug, "slug", rowNumber),
    gtin: getProductLevelGtin(row, mode),
    brand: required(row.brand, "brand", rowNumber),
    category: normalizeCategory(inputCategory),
    servings: extractServings(row),
    description:
      String(row.description || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .replace("[EKM-AUTOGENERATED]", "")
        .trim() || null,
    image: String(row.image || row.merchant_image_url || "").trim() || null,
    price: optionalNumber(row.price),
    ...readNormalizedProductFields(row, rowNumber),
  };

  if (shouldLogCategoryNormalization(inputCategory, productData.category)) {
    console.log(
      `Category normalized: "${inputCategory}" -> "${productData.category}"`
    );
  }

  return productData;
}

function priceHistoryTotal(price, shippingCost) {
  const productPrice = Number(price);

  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    return null;
  }

  if (shippingCost === null || shippingCost === undefined || shippingCost === "") {
    return null;
  }

  const shipping = Number(shippingCost);

  if (!Number.isFinite(shipping) || shipping < 0) {
    return null;
  }

  return Math.round((productPrice + shipping) * 100) / 100;
}

function validateFeedRowForWrites(row, rowNumber, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  const errors = [];

  function capture(fn) {
    try {
      fn();
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  capture(() => required(row.retailer_name, "retailer_name", rowNumber));
  if (safeCreate) {
    capture(() => required(row.retailer_website, "retailer_website", rowNumber));
    capture(() => required(row.image || row.merchant_image_url, "image", rowNumber));
    capture(() => required(getDirectRetailerProductUrl(row), "merchant_deep_link", rowNumber));
    capture(() => required(getOfferUrl(row), "aw_deep_link", rowNumber));
  }
  capture(() => required(row.product_name, "product_name", rowNumber));
  capture(() => required(row.slug, "slug", rowNumber));
  capture(() => required(getOfferUrl(row), "url", rowNumber));
  capture(() => required(row.brand, "brand", rowNumber));
  capture(() => required(row.category, "category", rowNumber));
  capture(() => {
    parseRequiredBoolean(row.in_stock, "in_stock");
  });
  if (safeCreate || rowHasColumn(row, "is_for_sale")) {
    capture(() => {
      if (safeCreate && !rowHasColumn(row, "is_for_sale")) {
        throw new Error("is_for_sale is required");
      }

      parseRequiredBoolean(row.is_for_sale, "is_for_sale");
    });
  }

  capture(() => {
    const price = parseFiniteNumber(row.price, "price");

    if (price <= 0) {
      throw new Error("price must be greater than 0");
    }
  });

  capture(() => {
    const shipping = parseOptionalFiniteNumber(
      getInputShippingValue(row),
      "shipping_cost"
    );

    if (shipping !== null && shipping < 0) {
      throw new Error("shipping_cost must be 0 or greater");
    }
  });

  if (rowHasColumn(row, "total_price") && String(row.total_price ?? "").trim()) {
    capture(() => {
      const total = nonNegativeDecimal(row.total_price, "total_price");
      const price = positiveDecimal(row.price, "price");
      const shipping = decimalOrNull(
        getInputShippingValue(row),
        "shipping_cost"
      );
      const calculated = shipping === null ? null : addDecimalStrings(price, shipping);
      if (calculated !== null && total !== calculated) {
        throw new Error("total_price must equal price plus shipping_cost");
      }
    });
  }

  capture(() => extractServings(row));
  capture(() => readNormalizedProductFields(row, rowNumber));

  return errors;
}

function validateSafeCreateCanonicalAvailability(row) {
  const errors = [];

  if (!parseRequiredBoolean(row.in_stock, "in_stock")) {
    errors.push("in_stock must be true to create a new canonical product");
  }

  if (!parseRequiredBoolean(row.is_for_sale, "is_for_sale")) {
    errors.push("is_for_sale must be true to create a new canonical product");
  }

  return errors;
}

function extractServings(row) {
  const directServings = optionalNumber(row.servings);

  if (directServings !== null) {
    return directServings;
  }

  const text = `${row.product_name || ""} ${row.description || ""}`;

  const patterns = [
    /(\d+)\s*servings?/i,
    /(\d+)\s*serves?/i,
    /(\d+)\s*portions?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}
function normalizeProductName(name = "") {
  return name
    .toLowerCase()
    .replace(/\b(gym high|capsules|caps|powder|servings|serves)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findExistingOfferForPreflight(retailerProductId) {
  if (!retailerProductId) {
    return null;
  }

  const supabase = getSupabase();
  const query = supabase
    .from("offers")
    .select(
      "id, product_id, retailer_id, retailer_product_id, product_variant_id, price, shipping_cost, total_price, in_stock, url, last_checked_at"
    )
    .eq("retailer_product_id", retailerProductId);

  const { data, error } = await query.limit(2);

  if (error) {
    throw error;
  }

  if ((data || []).length > 1) {
    throw new Error("ambiguous offer retailer_product identity");
  }

  return data?.[0] || null;
}

function buildOfferPlan(row, existingOffer, options = {}) {
  if (!existingOffer) {
    return {
      action: "create",
      priceChanged: false,
      shippingChanged: false,
      stockChanged: false,
      urlChanged: false,
      createsPriceHistory: true,
    };
  }

  const incomingPrice = positiveDecimal(row.price, "price");
  const existingPrice = positiveDecimal(existingOffer.price, "existing price");
  const existingShipping = decimalOrNull(existingOffer.shipping_cost, "existing shipping_cost");
  const incomingShipping = decimalOrNull(getInputShippingValue(row), "shipping_cost");
  const effectiveShipping =
    incomingShipping === null ? existingShipping : incomingShipping;
  const priceChanged = existingPrice !== incomingPrice;
  const shippingChanged = existingShipping !== effectiveShipping;
  const existingTotalPrice = decimalOrNull(existingOffer.total_price, "existing total_price");
  const derivedTotalPrice =
    effectiveShipping === null ? null : addDecimalStrings(incomingPrice, effectiveShipping);
  const historicalNullTotalNoop =
    Boolean(options.allowLegacyNullTotalNoop) &&
    existingTotalPrice === null &&
    derivedTotalPrice !== null &&
    existingPrice === incomingPrice &&
    existingShipping === effectiveShipping;
  const totalPriceChanged =
    !historicalNullTotalNoop && existingTotalPrice !== derivedTotalPrice;
  const stockChanged =
    Boolean(existingOffer.in_stock) !== parseRequiredBoolean(row.in_stock, "in_stock");
  const urlChanged = String(existingOffer.url || "") !== getOfferUrl(row);

  return {
    action:
      priceChanged || shippingChanged || totalPriceChanged || stockChanged || urlChanged
        ? "update"
        : "unchanged",
    priceChanged,
    shippingChanged,
    totalPriceChanged,
    stockChanged,
    urlChanged,
    createsPriceHistory: priceChanged || shippingChanged || totalPriceChanged,
  };
}

async function findRetailerBySlug(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name, slug, website")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function planRetailer(row) {
  const name = String(row.retailer_name || "").trim();

  if (!name) {
    return null;
  }

  return {
    name,
    slug: slugifyRetailerName(name),
    website: String(row.retailer_website || "").trim() || null,
  };
}

async function findProductById(productId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug, is_active, merged_into_product_id, product_format")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findProductForFeedRow(row) {
  const supabase = getSupabase();
  const productLevelGtin = getProductLevelGtin(row, "feed");

  if (productLevelGtin) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, category, gtin, slug, is_active, merged_into_product_id, product_format")
      .eq("gtin", productLevelGtin)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug, is_active, merged_into_product_id, product_format")
    .eq("slug", required(row.slug, "slug", 0))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findRetailerMapping(retailerId, row) {
  const supabase = getSupabase();
  const externalVariantId = optionalIdentifier(row.external_variant_id);
  let query = supabase
    .from("retailer_products")
    .select(
      "id, retailer_id, product_id, product_variant_id, external_name, external_slug, external_gtin, external_url, external_product_id, external_variant_id, external_sku, external_options, match_method, match_confidence, updated_at"
    )
    .eq("retailer_id", retailerId);

  query = externalVariantId
    ? query.eq("external_variant_id", externalVariantId)
    : query.eq("external_url", required(getRetailerProductUrl(row), "url", 0));

  let { data, error } = await query.limit(2);

  if (error) {
    throw error;
  }

  if (externalVariantId && (data || []).length === 0) {
    const urlResult = await supabase
      .from("retailer_products")
      .select(
        "id, retailer_id, product_id, product_variant_id, external_name, external_slug, external_gtin, external_url, external_product_id, external_variant_id, external_sku, external_options, match_method, match_confidence, updated_at"
      )
      .eq("retailer_id", retailerId)
      .eq("external_url", required(getRetailerProductUrl(row), "url", 0))
      .limit(2);

    if (urlResult.error) {
      throw urlResult.error;
    }

    data = urlResult.data;
  }

  if ((data || []).length > 1) {
    throw new Error(
      externalVariantId
        ? "ambiguous retailer product external_variant_id"
        : "ambiguous retailer product external_url"
    );
  }

  const mapping = data?.[0] || null;

  if (
    mapping?.external_variant_id &&
    mapping.external_variant_id !== externalVariantId
  ) {
    throw new Error(
      "retailer product URL belongs to a different external_variant_id"
    );
  }

  return mapping;
}

async function findRetailerMappingById(mappingId) {
  const { data, error } = await getSupabase()
    .from("retailer_products")
    .select(
      "id, retailer_id, product_id, product_variant_id, external_name, external_slug, external_gtin, external_url, external_product_id, external_variant_id, external_sku, external_options, match_method, match_confidence, updated_at"
    )
    .eq("id", mappingId)
    .limit(2);
  if (error) throw error;
  if ((data || []).length !== 1) {
    throw new Error("legacy mapping upgrade retailer_product_id is missing or ambiguous");
  }
  return data[0];
}

async function findRetailerProductPeers(retailerId, productId) {
  const { data, error } = await getSupabase()
    .from("retailer_products")
    .select(
      "id, retailer_id, product_id, product_variant_id, external_variant_id, external_url"
    )
    .eq("retailer_id", retailerId)
    .eq("product_id", productId)
    .limit(3);
  if (error) throw error;
  return data || [];
}

async function findExternalVariantPeers(retailerId, externalVariantId) {
  const { data, error } = await getSupabase()
    .from("retailer_products")
    .select("id, retailer_id, product_id, product_variant_id, external_variant_id")
    .eq("retailer_id", retailerId)
    .eq("external_variant_id", externalVariantId)
    .limit(3);
  if (error) throw error;
  return data || [];
}

async function findOffersForRetailerProduct(retailerId, productId) {
  const { data, error } = await getSupabase()
    .from("offers")
    .select(
      "id, product_id, retailer_id, product_variant_id, retailer_product_id, price, shipping_cost, total_price, in_stock, url, last_checked_at"
    )
    .eq("retailer_id", retailerId)
    .eq("product_id", productId)
    .limit(3);
  if (error) throw error;
  return data || [];
}

async function fetchProductVariantById(productVariantId) {
  const { data, error } = await getSupabase()
    .from("product_variants")
    .select(
      "id, product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, is_active, is_default"
    )
    .eq("id", productVariantId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function exactLegacyExternalOptions(row, controls = null) {
  const options = parseExternalOptions(row.external_options);
  const evidence = collectCanonicalVariantEvidence(row);
  if (controls?.standalone) {
    if (options !== null) {
      throw new Error("standalone legacy mapping upgrade requires null external_options");
    }
    if (evidence.flavour || evidence.size || evidence.discriminatingSupplied) {
      throw new Error("standalone legacy mapping upgrade forbids flavour or size evidence");
    }
    if (
      optionalIdentifier(row.external_product_id) !==
      optionalIdentifier(row.external_variant_id)
    ) {
      throw new Error("standalone legacy mapping upgrade requires matching EKM product and variant IDs");
    }
    return { options: null, evidence, standalone: true };
  }
  if (!options) {
    throw new Error("legacy mapping upgrade requires external_options");
  }
  const optionKeys = Object.keys(options).sort();
  if (
    optionKeys.length !== 2 ||
    optionKeys[0] !== "Flavour" ||
    optionKeys[1] !== "Size"
  ) {
    throw new Error("legacy mapping upgrade external_options must contain exactly Size and Flavour");
  }
  if (!evidence.size || !evidence.flavour) {
    throw new Error("legacy mapping upgrade requires matching size and flavour evidence");
  }
  if (controls?.optioned && (
    optionalIdentifier(row.external_product_id) === optionalIdentifier(row.external_variant_id)
  )) {
    throw new Error("optioned legacy mapping upgrade requires distinct EKM product and variant IDs");
  }
  return { options, evidence, standalone: false, optioned: Boolean(controls?.optioned) };
}

function legacyIdentityAfter(row, controls = null) {
  const { options } = exactLegacyExternalOptions(row, controls);
  return {
    external_product_id: optionalIdentifier(row.external_product_id),
    external_variant_id: optionalIdentifier(row.external_variant_id),
    external_sku: optionalIdentifier(row.external_sku),
    external_options: options,
    external_gtin: getExternalGtin(row),
  };
}

function isCompletedLegacyIdentity(mapping, after) {
  return ["external_product_id", "external_variant_id", "external_sku", "external_gtin"]
    .every((field) => valuesEqual(mapping[field], after[field])) &&
    valuesEqual(mapping.external_options, after.external_options);
}

function normalizedEvidenceValues(values, parser, key = (value) => value) {
  const parsed = values
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map(parser)
    .filter((value) => value !== null && value !== undefined);
  const unique = new Map(parsed.map((value) => [key(value), value]));
  return [...unique.values()];
}

function externalOptionValues(options, names) {
  if (!options) {
    return [];
  }

  const wanted = new Set(names.map((name) => name.toLowerCase()));
  return Object.entries(options)
    .filter(([name]) => wanted.has(String(name).trim().toLowerCase()))
    .map(([, value]) => value);
}

function collectCanonicalVariantEvidence(row) {
  const options = parseExternalOptions(row.external_options);
  const explicitSizeValues = [
    row.size,
    ...externalOptionValues(options, ["size"]),
  ].filter((value) => String(value ?? "").trim());
  for (const value of explicitSizeValues) {
    if (!parseExplicitSize(value)) {
      throw new Error(`invalid size evidence: ${value}`);
    }
  }
  const variantText = [row.variant_name, row.variant].filter(Boolean);
  const optionFlavours = normalizedEvidenceValues(
    externalOptionValues(options, ["flavour", "flavor"]),
    normalizeFlavour
  );
  const csvFlavours = normalizedEvidenceValues(
    [row.flavour, row.flavor],
    normalizeFlavour
  );
  const fallbackFlavours = normalizedEvidenceValues(variantText, parseFlavour);
  const explicitFlavourConflict =
    optionFlavours.length > 1 ||
    csvFlavours.length > 1 ||
    (optionFlavours.length === 1 &&
      csvFlavours.length === 1 &&
      optionFlavours[0] !== csvFlavours[0]);
  const flavours = optionFlavours.length > 0
    ? optionFlavours
    : csvFlavours.length > 0
      ? csvFlavours
      : fallbackFlavours;
  const sizes = normalizedEvidenceValues(
    [
      row.size,
      ...variantText,
      ...externalOptionValues(options, ["size"]),
    ],
    parseSize,
    sizeKey
  );
  const packCounts = normalizedEvidenceValues(
    [
      row.pack_count ? `pack of ${row.pack_count}` : null,
      ...variantText,
      ...externalOptionValues(options, ["pack", "pack_count", "count"]),
    ],
    parsePackCount
  );
  const formats = normalizedEvidenceValues(
    [
      row.product_format,
      ...variantText,
      ...externalOptionValues(options, ["format", "product_format"]),
    ],
    parseProductFormat
  );
  const conflicts = [];

  if (explicitFlavourConflict || flavours.length > 1) conflicts.push("flavour");
  if (sizes.length > 1) conflicts.push("size");
  if (packCounts.length > 1) conflicts.push("pack count");
  if (formats.length > 1) conflicts.push("product format");

  if (conflicts.length > 0) {
    throw new Error(`conflicting variant evidence: ${conflicts.join(", ")}`);
  }

  return {
    flavour: flavours[0] || null,
    size: sizes[0] || null,
    packCount: packCounts[0] ?? null,
    productFormat: formats[0] || null,
    discriminatingSupplied:
      flavours.length > 0 ||
      sizes.length > 0 ||
      externalOptionValues(options, ["flavour", "flavor", "size"]).length > 0,
    supplied:
      flavours.length + sizes.length + packCounts.length + formats.length > 0,
  };
}

async function resolveCanonicalProductVariant(
  row,
  productId,
  mapping = null,
  options = {}
) {
  const supabase = getSupabase();
  const evidence = collectCanonicalVariantEvidence(row);
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, variant_key, display_name, flavour_code, flavour_label, size_value, size_unit, pack_count, product_format, is_active, is_default"
    )
    .eq("product_id", productId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  const activeVariants = data || [];

  if (activeVariants.length === 0) {
    throw new Error("missing canonical product_variant");
  }

  const defaultVariants = activeVariants.filter((variant) => variant.is_default);
  const nonDefaultVariants = activeVariants.filter((variant) => !variant.is_default);

  if (mapping?.product_variant_id) {
    const mappedVariant = activeVariants.find(
      (variant) => variant.id === mapping.product_variant_id
    );
    if (!mappedVariant) {
      throw new Error("conflicting variant evidence: retailer product mapping");
    }
    if (options.legacyMappingUpgrade) {
      if (options.legacyMappingUpgrade.optioned) {
        if (!mappedVariant.is_default) {
          throw new Error("optioned legacy mapping upgrade requires current default variant");
        }
        exactLegacyExternalOptions(row, options.legacyMappingUpgrade);
        let targetCandidates = nonDefaultVariants.filter((variant) => {
          const variantFlavour =
            normalizeFlavour(variant.flavour_code) || normalizeFlavour(variant.flavour_label);
          const variantSize = parseSize(
            variant.size_value && variant.size_unit
              ? `${variant.size_value}${variant.size_unit}`
              : ""
          );
          const variantFormat = parseProductFormat(variant.product_format);
          const evidenceMatches =
            evidence.flavour &&
            evidence.flavour === variantFlavour &&
            evidence.size &&
            sizeKey(evidence.size) === sizeKey(variantSize) &&
            (evidence.packCount === null ||
              Number(evidence.packCount) === Number(variant.pack_count)) &&
            (!evidence.productFormat || !variantFormat || evidence.productFormat === variantFormat);
          const distinguishingFeaturesConfirmed =
            variantFlavour &&
            evidence.flavour === variantFlavour &&
            variantSize &&
            sizeKey(evidence.size) === sizeKey(variantSize) &&
            (variant.pack_count === null ||
              Number(variant.pack_count) === 1 ||
              Number(evidence.packCount) === Number(variant.pack_count));
          return evidenceMatches && distinguishingFeaturesConfirmed;
        });
        if (rowHasColumn(row, "product_variant_id")) {
          const requestedVariantId = optionalIdentifier(row.product_variant_id);
          targetCandidates = targetCandidates.filter(
            (variant) => String(variant.id) === requestedVariantId
          );
        }
        if (targetCandidates.length === 0) {
          throw new Error("missing canonical product_variant");
        }
        if (targetCandidates.length > 1) {
          throw new Error("ambiguous canonical product_variant");
        }
        return targetCandidates[0];
      }
      if (nonDefaultVariants.length > 0) {
        throw new Error(
          "legacy mapping upgrade cannot use a default variant when non-default variants exist"
        );
      }
      const mappedFlavour =
        normalizeFlavour(mappedVariant.flavour_code) ||
        normalizeFlavour(mappedVariant.flavour_label);
      const mappedSize = parseSize(
        mappedVariant.size_value && mappedVariant.size_unit
          ? `${mappedVariant.size_value}${mappedVariant.size_unit}`
          : ""
      );
      const mappedFormat = parseProductFormat(mappedVariant.product_format);
      if (
        (mappedFlavour && evidence.flavour !== mappedFlavour) ||
        (mappedSize && sizeKey(evidence.size) !== sizeKey(mappedSize)) ||
        (mappedVariant.pack_count !== null &&
          Number(mappedVariant.pack_count) !== 1 &&
          Number(evidence.packCount) !== Number(mappedVariant.pack_count)) ||
        (mappedFormat && evidence.productFormat !== mappedFormat)
      ) {
        throw new Error("legacy mapping upgrade evidence points to a different variant");
      }
      exactLegacyExternalOptions(row, options.legacyMappingUpgrade);
      return mappedVariant;
    }
    if (mappedVariant.is_default) {
      if (nonDefaultVariants.length > 0 || evidence.discriminatingSupplied) {
        throw new Error("conflicting variant evidence: retailer product mapping");
      }
      return mappedVariant;
    }

    const mappedFlavour =
      normalizeFlavour(mappedVariant.flavour_code) ||
      normalizeFlavour(mappedVariant.flavour_label);
    const mappedSize = parseSize(
      mappedVariant.size_value && mappedVariant.size_unit
        ? `${mappedVariant.size_value}${mappedVariant.size_unit}`
        : ""
    );
    const mappedFormat = parseProductFormat(mappedVariant.product_format);
    const mappingConflicts =
      (evidence.flavour && evidence.flavour !== mappedFlavour) ||
      (evidence.size && sizeKey(evidence.size) !== sizeKey(mappedSize)) ||
      (Number(evidence.packCount) > 1 &&
        Number(evidence.packCount) !== Number(mappedVariant.pack_count)) ||
      (evidence.productFormat &&
        mappedFormat &&
        evidence.productFormat !== mappedFormat);

    if (mappingConflicts) {
      throw new Error("conflicting variant evidence: retailer product mapping");
    }

    // An approved retailer-product mapping is identity evidence in its own right.
    // Missing feed fields must not broaden the lookup beyond that exact mapping.
    return mappedVariant;
  }

  if (!evidence.discriminatingSupplied) {
    if (nonDefaultVariants.length > 0) {
      throw new Error("missing canonical product_variant");
    }
    if (defaultVariants.length !== 1) {
      throw new Error(
        defaultVariants.length === 0
          ? "missing canonical product_variant"
          : "ambiguous canonical product_variant"
      );
    }
    return defaultVariants[0];
  }

  let candidates = nonDefaultVariants.filter((variant) => {
      const variantFlavour =
        normalizeFlavour(variant.flavour_code) || normalizeFlavour(variant.flavour_label);
      const variantSize = parseSize(
        variant.size_value && variant.size_unit
          ? `${variant.size_value}${variant.size_unit}`
          : ""
      );
      const variantFormat = parseProductFormat(variant.product_format);

      const evidenceMatches =
        (!evidence.flavour || evidence.flavour === variantFlavour) &&
        (!evidence.size || sizeKey(evidence.size) === sizeKey(variantSize)) &&
        (evidence.packCount === null ||
          Number(evidence.packCount) === Number(variant.pack_count)) &&
        (!evidence.productFormat || evidence.productFormat === variantFormat);
      const distinguishingFeaturesConfirmed =
        (!variantFlavour || evidence.flavour === variantFlavour) &&
        (!variantSize || sizeKey(evidence.size) === sizeKey(variantSize)) &&
        (variant.pack_count === null ||
          Number(variant.pack_count) === 1 ||
          Number(evidence.packCount) === Number(variant.pack_count));

      return evidenceMatches && distinguishingFeaturesConfirmed;
    });

  if (mapping?.product_variant_id && !options.legacyMappingUpgrade?.optioned) {
    candidates = candidates.filter(
      (variant) => variant.id === mapping.product_variant_id
    );
  }

  if (candidates.length === 0) {
    throw new Error("missing canonical product_variant");
  }
  if (candidates.length > 1) {
    throw new Error("ambiguous canonical product_variant");
  }
  return candidates[0];
}

async function validateLegacyMappingUpgrade({
  row,
  controls,
  retailer,
  product,
  mapping,
  productVariant,
}) {
  if (String(mapping.id) !== controls.mappingId) {
    throw new Error("legacy mapping upgrade resolved a different retailer_product_id");
  }
  if (String(mapping.updated_at) !== controls.expectedUpdatedAt) {
    throw new Error("legacy mapping upgrade expected updated_at is stale");
  }
  if (
    (controls.standalone || controls.optioned) &&
    String(retailer.slug || "").trim() !== "whey-okay"
  ) {
    throw new Error("legacy mapping upgrade extension is limited to Whey Okay");
  }
  if (mapping.retailer_id !== retailer.id || mapping.product_id !== product.id) {
    throw new Error("legacy mapping upgrade mapping ownership mismatch");
  }
  if (controls.optioned) {
    if (mapping.product_variant_id === productVariant.id) {
      throw new Error("optioned legacy mapping upgrade requires current default to target non-default change");
    }
    const currentVariant = await fetchProductVariantById(mapping.product_variant_id);
    if (
      !currentVariant ||
      currentVariant.product_id !== product.id ||
      !currentVariant.is_active ||
      !currentVariant.is_default
    ) {
      throw new Error("optioned legacy mapping upgrade requires current mapping on active default variant");
    }
    if (
      productVariant.product_id !== product.id ||
      productVariant.is_default ||
      !productVariant.is_active
    ) {
      throw new Error("optioned legacy mapping upgrade requires active non-default target variant");
    }
  } else if (mapping.product_variant_id !== productVariant.id) {
    throw new Error("legacy mapping upgrade product_variant_id mismatch");
  }
  if (
    rowHasColumn(row, "product_variant_id") &&
    optionalIdentifier(row.product_variant_id) !== String(productVariant.id)
  ) {
    throw new Error("legacy mapping upgrade cannot change product_variant_id");
  }
  if (!product.is_active || product.merged_into_product_id !== null) {
    throw new Error("legacy mapping upgrade requires an active unmerged canonical product");
  }
  if (!productVariant.is_active) {
    throw new Error("legacy mapping upgrade requires an active product_variant");
  }
  const incomingUrl = required(getRetailerProductUrl(row), "external_url", 0);
  if (incomingUrl !== mapping.external_url) {
    throw new Error("legacy mapping upgrade requires exact external_url match");
  }
  if (
    String(row.product_name || "").trim() !== String(product.name || "").trim() ||
    String(row.product_name || "").trim() !== String(mapping.external_name || "").trim() ||
    String(row.brand || "").trim().toLowerCase() !==
      String(product.brand || "").trim().toLowerCase() ||
    String(row.slug || "").trim() !== String(product.slug || "").trim()
  ) {
    throw new Error("legacy mapping upgrade incoming product identity mismatch");
  }

  const after = legacyIdentityAfter(row, controls);
  if (!after.external_product_id || !after.external_variant_id || !after.external_sku) {
    throw new Error("legacy mapping upgrade requires complete external identity evidence");
  }
  const alreadyCompleted = isCompletedLegacyIdentity(mapping, after);
  if (mapping.external_variant_id !== null && !alreadyCompleted) {
    throw new Error("legacy mapping upgrade requires a null legacy external_variant_id");
  }
  for (const field of ["external_product_id", "external_sku", "external_gtin"]) {
    if (mapping[field] !== null && !valuesEqual(mapping[field], after[field])) {
      throw new Error(`legacy mapping upgrade existing ${field} conflicts with evidence`);
    }
  }
  if (
    mapping.external_options !== null &&
    !valuesEqual(mapping.external_options, after.external_options)
  ) {
    throw new Error("legacy mapping upgrade existing external_options conflicts with evidence");
  }

  const mappingPeers = await findRetailerProductPeers(retailer.id, product.id);
  if (mappingPeers.length !== 1 || String(mappingPeers[0].id) !== String(mapping.id)) {
    throw new Error("legacy mapping upgrade requires exactly one retailer/product mapping");
  }
  const variantPeers = await findExternalVariantPeers(
    retailer.id,
    after.external_variant_id
  );
  if (
    variantPeers.some((peer) => String(peer.id) !== String(mapping.id)) ||
    (!alreadyCompleted && variantPeers.length > 0)
  ) {
    throw new Error("legacy mapping upgrade external_variant_id conflicts with another mapping");
  }
  const offers = await findOffersForRetailerProduct(retailer.id, product.id);
  if (offers.length !== 1) {
    throw new Error("legacy mapping upgrade requires exactly one retailer/product offer");
  }
  const offer = offers[0];
  if (
    String(offer.retailer_product_id) !== String(mapping.id) ||
    (controls.optioned
      ? String(offer.product_variant_id) !== String(mapping.product_variant_id)
      : String(offer.product_variant_id) !== String(productVariant.id))
  ) {
    throw new Error("legacy mapping upgrade offer identity mismatch");
  }
  const offerPlan = buildOfferPlan(row, offer, {
    allowLegacyNullTotalNoop: true,
  });
  if (offerPlan.action !== "unchanged") {
    throw new Error("legacy mapping upgrade cannot change offer price, stock or URL");
  }
  return {
    operationType: "legacy_mapping_upgrade",
    controls,
    after,
    alreadyCompleted,
    exactUrl: incomingUrl,
    approvedEvidence: {
      product_name: String(row.product_name || "").trim(),
      brand: String(row.brand || "").trim(),
      size: String(row.size || "").trim(),
      flavour: String(row.flavour || row.flavor || "").trim(),
      product_format: String(row.product_format || "").trim(),
      pack_count: String(row.pack_count || "").trim(),
      external_product_id: after.external_product_id,
      external_variant_id: after.external_variant_id,
      external_sku: after.external_sku,
      external_options: after.external_options,
      external_gtin: after.external_gtin,
      external_url: incomingUrl,
      legacy_mapping_standalone: controls.standalone,
      legacy_mapping_optioned: controls.optioned,
      legacy_standalone_sellable_count: controls.standalone
        ? String(row.legacy_standalone_sellable_count || "").trim()
        : "",
    },
    offer,
  };
}

const RETAILER_PRODUCT_PLAN_FIELDS = [
  "external_product_id",
  "external_variant_id",
  "external_sku",
  "external_options",
  "external_name",
  "external_slug",
  "external_gtin",
  "external_url",
  "match_method",
  "match_confidence",
  "product_variant_id",
];

const PRODUCT_PLAN_VALUE_FIELDS = [
  "name", "slug", "brand", "category", "price", "image", "description",
  "servings", "net_weight_g", "net_volume_ml", "serving_count_verified",
  "serving_size_g", "serving_size_ml", "protein_per_serving_g",
  "creatine_per_serving_g", "unit_count", "unit_type", "product_format",
  "unit_pricing_verified", "nutrition_verified", "gtin",
];

function valuesEqual(left, right) {
  return canonicalJson(left ?? null) === canonicalJson(right ?? null);
}

function completeObject(source, fields, defaults = {}) {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      source?.[field] === undefined ? (defaults[field] ?? null) : source[field],
    ])
  );
}

function expectedProductState(product) {
  return product
    ? {
        id: product.id,
        name: product.name,
        is_active: product.is_active ?? true,
        merged_into_product_id: product.merged_into_product_id ?? null,
        product_format: product.product_format ?? null,
      }
    : null;
}

function expectedRetailerState(retailer) {
  return retailer
    ? {
        id: retailer.id,
        name: retailer.name,
        slug: retailer.slug,
        website: retailer.website ?? null,
      }
    : null;
}

function expectedVariantState(variant) {
  if (!variant) return null;
  return completeObject(variant, [
    "id", "product_id", "variant_key", "display_name", "flavour_code",
    "flavour_label", "size_value", "size_unit", "pack_count",
    "product_format", "is_active", "is_default",
  ], {
    variant_key: "default",
    display_name: "Default",
    is_active: true,
    is_default: true,
  });
}

function expectedMappingState(mapping) {
  if (!mapping) return null;
  return completeObject(mapping, [
    "id", "retailer_id", "product_id", "product_variant_id", "updated_at",
    "external_product_id", "external_variant_id", "external_sku",
    "external_options", "external_name", "external_slug", "external_gtin",
    "external_url", "match_method", "match_confidence",
  ]);
}

function expectedOfferState(offer) {
  if (!offer) return null;
  return completeObject(offer, [
    "id", "product_id", "retailer_id", "product_variant_id",
    "retailer_product_id", "price", "shipping_cost", "total_price",
    "in_stock", "url", "last_checked_at",
  ]);
}

function buildVariantEvidence(row, mapping, productVariant = null) {
  const evidence = collectCanonicalVariantEvidence(row);
  const canonicalFlavour =
    productVariant && evidence.flavour
      ? productVariant.flavour_code || productVariant.flavour_label || evidence.flavour
      : evidence.flavour;
  return {
    flavour: canonicalFlavour,
    size_value: evidence.size?.value === undefined
      ? null
      : normalizeDecimalString(evidence.size.value, "size_value"),
    size_unit: evidence.size?.unit ?? null,
    pack_count: evidence.packCount === null
      ? null
      : normalizeDecimalString(evidence.packCount, "pack_count"),
    product_format: evidence.productFormat,
    external_options: parseExternalOptions(row.external_options),
    approved_mapping_id: mapping?.id ?? null,
  };
}

function buildAtomicImportPlan(item) {
  const {
    row, retailer, product, productVariant, mapping, existingOffer, offerPlan,
    legacyMappingUpgrade,
  } = item;
  const now = new Date().toISOString();
  const rawProductData = product ? null : buildProductData(row, item.rowNumber, "feed");
  if (rawProductData) rawProductData.gtin = null;
  const productData = rawProductData
    ? completeObject(rawProductData, PRODUCT_PLAN_VALUE_FIELDS, {
        unit_pricing_verified: false,
        nutrition_verified: false,
      })
    : null;
  const rawMappingValues = legacyMappingUpgrade
    ? {
        ...mapping,
        ...legacyMappingUpgrade.after,
        product_variant_id: legacyMappingUpgrade.controls.optioned
          ? productVariant.id
          : mapping.product_variant_id,
        external_url: mapping.external_url,
      }
    : buildRetailerProductPayload({
        row,
        retailerId: retailer?.id,
        productId: product?.id,
        productVariantId: productVariant?.id,
        name: required(row.product_name, "product_name", item.rowNumber),
        slug: required(row.slug, "slug", item.rowNumber),
        offerUrl: required(getRetailerProductUrl(row), "url", item.rowNumber),
        matchMethod: getProductLevelGtin(row, "feed") ? "gtin" : "slug",
        matchConfidence: getProductLevelGtin(row, "feed") ? 100 : 90,
      });
  const mappingValues = completeObject(rawMappingValues, RETAILER_PRODUCT_PLAN_FIELDS);
  const mappingChanged = Boolean(
    mapping &&
      RETAILER_PRODUCT_PLAN_FIELDS.some(
        (field) => !valuesEqual(mapping[field], mappingValues[field])
      )
  );
  const price = positiveDecimal(required(row.price, "price", item.rowNumber), "price");
  const existingShipping = decimalOrNull(existingOffer?.shipping_cost, "existing shipping_cost");
  const incomingShipping = decimalOrNull(getInputShippingValue(row), "shipping_cost");
  const shippingCost =
    incomingShipping === null && existingOffer ? existingShipping : incomingShipping;
  const offerValues = legacyMappingUpgrade
    ? {
        ...completeObject(existingOffer, [
          "price", "shipping_cost", "total_price", "url", "in_stock", "last_checked_at",
        ]),
        ...(legacyMappingUpgrade.controls.optioned
          ? { product_variant_id: productVariant.id }
          : {}),
      }
    : {
        price,
        shipping_cost: shippingCost,
        total_price: shippingCost === null ? null : addDecimalStrings(price, shippingCost),
        url: required(getOfferUrl(row), "url", item.rowNumber),
        in_stock: parseRequiredBoolean(row.in_stock, "in_stock"),
        last_checked_at: now,
      };

  const sourceFingerprint = sourceRowFingerprint(row);
  let approval = {
    approved: false,
    approval_type: "none",
  };
  if (!product) {
    approval = {
      approved: true,
      approval_type: "safe_create",
      approved_category: productData.category,
      source_row_fingerprint: sourceFingerprint,
      canonical_name: productData.name,
      has_variant_evidence: false,
      approval_fingerprint: null,
    };
    approval.approval_fingerprint = approvalFingerprint(approval);
  }

  const plan = {
    meta: {
      version: 2,
      plan_kind: item.mode || "feed",
      operation_type: legacyMappingUpgrade
        ? "legacy_mapping_upgrade"
        : "standard_import",
      source_row_fingerprint: sourceFingerprint,
      plan_fingerprint: null,
    },
    product: product
      ? { action: "existing", id: product.id }
      : { action: "create", values: productData },
    product_variant: product
      ? {
          action: "existing",
          id: productVariant.id,
          evidence: buildVariantEvidence(row, mapping, productVariant),
        }
      : {
          action: "create_default",
          evidence: buildVariantEvidence(row, null),
        },
    retailer: retailer
      ? { action: "existing", id: retailer.id }
      : {
          action: "create",
          values: {
            name: required(row.retailer_name, "retailer_name", item.rowNumber),
            slug: slugifyRetailerName(row.retailer_name),
            website: required(row.retailer_website, "retailer_website", item.rowNumber),
          },
        },
    retailer_product: {
      action: mapping ? (mappingChanged ? "update" : "noop") : "create",
      ...(mapping ? { id: mapping.id } : {}),
      values: mappingValues,
    },
    offer: {
      action: existingOffer
        ? legacyMappingUpgrade?.controls.optioned
          ? "identity_update"
          : (legacyMappingUpgrade || offerPlan.action === "unchanged" ? "noop" : "update")
        : "create",
      ...(existingOffer ? { id: existingOffer.id } : {}),
      values: offerValues,
    },
    price_history: {
      action: legacyMappingUpgrade
        ? "noop"
        : offerPlan.createsPriceHistory ? "create" : "noop",
    },
    approval,
    expected_state: {
      product: expectedProductState(product),
      retailer: expectedRetailerState(retailer),
      product_variant: expectedVariantState(productVariant),
      retailer_product: expectedMappingState(mapping),
      offer: expectedOfferState(existingOffer),
    },
  };
  const serialized = serializeImportPlan(plan);
  serialized.meta.plan_fingerprint = planFingerprint(serialized);
  return serializeImportPlan(serialized);
}

async function findSimilarProductConflict(row) {
  const supabase = getSupabase();
  const productData = buildProductData(row, 0, "feed");
  const normalizedName = normalizeProductName(productData.name);

  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug")
    .eq("brand", productData.brand)
    .eq("category", productData.category);

  if (error) {
    throw error;
  }

  return (
    data?.find((product) => normalizeProductName(product.name) === normalizedName) ||
    null
  );
}

function planProduct(row) {
  return {
    name: String(row.product_name || "").trim(),
    slug: String(row.slug || "").trim(),
  };
}

async function resolveFeedRow(row, rowNumber, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  let shippingNormalizedRow = row;
  let shippingInferredFromPolicy = false;
  const shippingErrors = [];

  try {
    const shippingResult = normalizeShippingForImport(row, "feed");
    shippingNormalizedRow = shippingResult.row;
    shippingInferredFromPolicy = shippingResult.shippingInferredFromPolicy;
  } catch (error) {
    shippingErrors.push(error?.message || String(error));
  }

  const validationErrors = [
    ...validateFeedRowForWrites(shippingNormalizedRow, rowNumber, { safeCreate }),
    ...shippingErrors,
  ];
  let legacyControls = null;
  try {
    legacyControls = parseLegacyMappingUpgradeControls(shippingNormalizedRow);
    if (legacyControls && options.totalRows !== 1) {
      throw new Error("legacy mapping upgrade requires exactly one input row");
    }
  } catch (error) {
    validationErrors.push(error?.message || String(error));
  }
  try {
    parseExternalOptions(shippingNormalizedRow.external_options);
  } catch (error) {
    validationErrors.push(error?.message || String(error));
  }
  const retailerName = String(shippingNormalizedRow.retailer_name || "").trim();
  const retailer = retailerName
    ? await findRetailerBySlug(slugifyRetailerName(retailerName))
    : null;
  let mapping = null;
  let product = null;
  let plannedRetailer = null;
  let plannedProduct = null;
  let existingOffer = null;
  let productVariant = null;
  let legacyMappingUpgrade = null;
  let variantResolutionError = null;

  if (retailer) {
    try {
      mapping = legacyControls
        ? await findRetailerMappingById(legacyControls.mappingId)
        : await findRetailerMapping(retailer.id, shippingNormalizedRow);
      if (legacyControls && mapping.retailer_id !== retailer.id) {
        throw new Error("legacy mapping upgrade retailer_id mismatch");
      }
    } catch (error) {
      validationErrors.push(error?.message || String(error));
    }

    if (mapping) {
      product = await findProductById(mapping.product_id);
    }
  }

  if (!product && String(shippingNormalizedRow.slug || "").trim()) {
    product = await findProductForFeedRow(shippingNormalizedRow);
  }

  if (mapping && product && mapping.product_id !== product.id) {
    validationErrors.push("retailer product mapping has conflicting canonical product");
  }

  if (validationErrors.length === 0 && product?.id) {
    try {
      productVariant = await resolveCanonicalProductVariant(
        shippingNormalizedRow,
      product.id,
      mapping,
        { legacyMappingUpgrade: legacyControls || false }
      );
    } catch (error) {
      variantResolutionError = error?.message || String(error);
    }
  }

  if (safeCreate && validationErrors.length === 0 && !product) {
    validationErrors.push(
      ...validateSafeCreateCanonicalAvailability(shippingNormalizedRow)
    );
    try {
      if (collectCanonicalVariantEvidence(shippingNormalizedRow).discriminatingSupplied) {
        variantResolutionError =
          "safe-create requires manual approval for flavour or size variants";
      }
    } catch (error) {
      variantResolutionError = error?.message || String(error);
    }
  }

  if (safeCreate && validationErrors.length === 0) {
    if (!retailer) {
      plannedRetailer = planRetailer(shippingNormalizedRow);
    }

    if (!product) {
      plannedProduct = planProduct(shippingNormalizedRow);

      if (!isSafeCreateRowAmbiguous(shippingNormalizedRow)) {
        const conflict = await findSimilarProductConflict(shippingNormalizedRow);

        if (conflict) {
          validationErrors.push(
            `possible duplicate product found: may match product ID ${conflict.id} "${conflict.name}"`
          );
        }
      }
    }
  }

  if (
    validationErrors.length === 0 &&
    !variantResolutionError &&
    retailer?.id &&
    product?.id
  ) {
    if (legacyControls) {
      try {
        legacyMappingUpgrade = await validateLegacyMappingUpgrade({
          row: shippingNormalizedRow,
          controls: legacyControls,
          retailer,
          product,
          mapping,
          productVariant,
        });
        existingOffer = legacyMappingUpgrade.offer;
      } catch (error) {
        validationErrors.push(error?.message || String(error));
      }
    } else {
      existingOffer = await findExistingOfferForPreflight(mapping?.id);
    }
  }

  const offerPlan =
    validationErrors.length === 0 && !variantResolutionError
      ? buildOfferPlan(shippingNormalizedRow, existingOffer, {
          allowLegacyNullTotalNoop: Boolean(legacyMappingUpgrade),
        })
      : null;

  const resolved = {
    row: shippingNormalizedRow,
    rowNumber,
    retailer,
    product,
    mapping,
    plannedRetailer,
    plannedProduct,
    existingOffer,
    productVariant,
    variantResolutionError,
    offerPlan,
    validationErrors,
    shippingInferredFromPolicy,
    mode: "feed",
    legacyMappingUpgrade,
  };

  return resolved;
}

async function preflightFeedRows(rows, options = {}) {
  const resolvedRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    resolvedRows.push(await resolveFeedRow(rows[index], index + 2, {
      ...options,
      totalRows: rows.length,
    }));
  }

  return analyzeFeedRows(resolvedRows, {
    ...options,
    planBuilder: buildAtomicImportPlan,
  });
}

async function resolveManualImportPlan(row, rowNumber) {
  const validationErrors = validateFeedRowForWrites(row, rowNumber, {
    safeCreate: false,
  });
  try {
    parseExternalOptions(row.external_options);
    collectCanonicalVariantEvidence(row);
  } catch (error) {
    validationErrors.push(error?.message || String(error));
  }
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join("; "));
  }

  const retailer = await findRetailerBySlug(
    slugifyRetailerName(required(row.retailer_name, "retailer_name", rowNumber))
  );
  let mapping = null;
  let product = null;

  if (retailer) {
    mapping = await findRetailerMapping(retailer.id, row);
    if (mapping) product = await findProductById(mapping.product_id);
  }
  if (!product) product = await findProductForFeedRow(row);

  if (!product) {
    throw new Error(
      `Row ${rowNumber}: manual import requires an existing canonical product; use approved safe-create or create the product manually`
    );
  }
  const productVariant = await resolveCanonicalProductVariant(row, product.id, mapping);

  const existingOffer = product && retailer
    ? await findExistingOfferForPreflight(mapping?.id)
    : null;
  const offerPlan = buildOfferPlan(row, existingOffer);
  const resolved = {
    row,
    rowNumber,
    retailer,
    product,
    mapping,
    productVariant,
    existingOffer,
    offerPlan,
    mode: "manual",
  };
  resolved.importPlan = buildAtomicImportPlan(resolved);
  return resolved;
}

function verifyOptionalSourceFile(loaded, sourcePath) {
  if (!sourcePath) return;
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) throw new Error(`Source file not found: ${resolved}`);
  if (sha256Bytes(fs.readFileSync(resolved)) !== loaded.artifact.source_file_sha256) {
    throw new Error("Source file SHA-256 does not match the dry-run artifact");
  }
}

function assertRpcMetadata(result, entry, loaded) {
  const expected = {
    artifact_sha256: loaded.artifactSha256,
    source_row_fingerprint: entry.source_row_fingerprint,
    plan_fingerprint: entry.plan_fingerprint,
    retailer_id: entry.retailer_id,
    plan_kind: entry.plan_kind,
    run_id: loaded.artifact.run_id,
  };
  for (const [field, value] of Object.entries(expected)) {
    if ((result?.[field] ?? null) !== (value ?? null)) {
      throw new Error(`Approval ledger ${field} does not match the dry-run artifact`);
    }
  }
}

async function approveArtifactPlan(options = {}) {
  const supabase = getSupabase();
  if (typeof supabase.rpc !== "function") {
    throw new Error("Atomic product import RPC is unavailable");
  }
  const loaded = loadDryRunArtifact(options.artifactPath);
  verifyOptionalSourceFile(loaded, options.sourcePath);
  const entry = selectArtifactPlan(loaded, options.planFingerprint);
  const args = {
    p_plan: entry.resolved_plan,
    p_artifact_sha256: loaded.artifactSha256,
    p_run_id: loaded.artifact.run_id,
    p_source: String(options.approvalSource || "supplementscout_importer"),
    ...(options.approvalExpiresAt ? { p_expires_at: options.approvalExpiresAt } : {}),
  };
  const { data, error } = await supabase.rpc("approve_product_import_plan", args);
  if (error) throw error;
  assertRpcMetadata(data, entry, loaded);
  return {
    approvalId: data.approval_id,
    expiresAt: data.expires_at,
    artifactSha256: data.artifact_sha256,
    sourceRowFingerprint: data.source_row_fingerprint,
    planFingerprint: data.plan_fingerprint,
    retailerId: data.retailer_id,
    planKind: data.plan_kind,
    runId: data.run_id,
  };
}

async function applyArtifactPlan(options = {}) {
  if (!options.pilotApply) throw new Error("Artifact apply requires pilotApply=true");
  const approvalId = String(options.approvalId || "").trim();
  if (!approvalId || options.approvalIds !== undefined) {
    throw new Error("Pilot apply requires exactly one approval ID, not an array");
  }
  const supabase = getSupabase();
  if (typeof supabase.rpc !== "function") throw new Error("Atomic product import RPC is unavailable");
  const loaded = loadDryRunArtifact(options.artifactPath);
  verifyOptionalSourceFile(loaded, options.sourcePath);
  const entry = selectArtifactPlan(loaded, options.planFingerprint);
  const { data, error } = await supabase.rpc("apply_approved_product_import_plan", {
    p_approval_id: approvalId,
    p_artifact_sha256: loaded.artifactSha256,
    p_plan_fingerprint: entry.plan_fingerprint,
    p_source_row_fingerprint: entry.source_row_fingerprint,
    p_retailer_id: entry.retailer_id,
    p_plan_kind: entry.plan_kind,
    p_run_id: loaded.artifact.run_id,
  });
  if (error) throw error;
  assertRpcMetadata(data, entry, loaded);
  const successfulRow = {
    rowNumber: entry.row_number,
    approvalId,
    artifactSha256: loaded.artifactSha256,
    sourceRowFingerprint: entry.source_row_fingerprint,
    planFingerprint: entry.plan_fingerprint,
    consumedAt: data.consumed_at,
  };
  return {
    successful: 1,
    failed: 0,
    skipped: 0,
    approvalId,
    artifactSha256: loaded.artifactSha256,
    sourceRowFingerprint: entry.source_row_fingerprint,
    planFingerprint: entry.plan_fingerprint,
    consumedAt: data.consumed_at,
    successfulRows: [successfulRow],
    failedRows: [],
    blockedRows: [],
    rpcResult: data,
  };
}

function buildRowLevelOfferResults(report) {
  return report.approvedRows.map((item) => ({
    rowNumber: item.rowNumber,
    slug: String(item.row.slug || "").trim(),
    offerAction: item.offerPlan.action,
  }));
}

async function runImportRows(rows, options = {}) {
  const mode = options.mode || "manual";
  const dryRun = Boolean(options.dryRun);
  const safeCreate = Boolean(options.safeCreate);
  validatePilotApply(rows, options);

  if (mode === "feed") {
    rows = normalizeCanonicalRetailerFeedRows(rows);
  }

  if (mode === "feed") {
    const report = await preflightFeedRows(rows, { safeCreate });

    console.log(formatPreflightReport(report));

    if (dryRun) {
      console.log("Dry run: no database writes performed.");
      return {
        successful: 0,
        failed: 0,
        planned: report.approvedRows.length,
        skipped: rows.length - report.approvedRows.length,
        report,
        rowLevelOffers: buildRowLevelOfferResults(report),
        successfulRows: [],
        failedRows: [],
        blockedRows: report.blockedRows,
      };
    }

    throw new Error("CSV-based writes are disabled; use a verified dry-run artifact");
  }

  const approvedRows = [];
  const blockedRows = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;

    try {
      approvedRows.push(await resolveManualImportPlan(row, rowNumber));
    } catch (error) {
      blockedRows.push({
        rowNumber,
        productName: String(row.product_name || "").trim(),
        reason: error?.message || String(error),
        block_reason: error?.message || String(error),
        context: {
          rowNumber,
          productName: String(row.product_name || "").trim(),
          slug: String(row.slug || "").trim() || null,
          external_product_id: optionalIdentifier(row.external_product_id),
          external_variant_id: optionalIdentifier(row.external_variant_id),
          external_url: getRetailerProductUrl(row) || null,
        },
      });
    }
  }

  const report = { approvedRows, blockedRows };
  if (dryRun) {
    console.log("Dry run: no database writes performed.");
    return {
      successful: 0,
      failed: 0,
      planned: approvedRows.length,
      skipped: blockedRows.length,
      report,
      successfulRows: [],
      failedRows: [],
      blockedRows,
    };
  }

  throw new Error("CSV-based writes are disabled; use a verified dry-run artifact");
}

function parseArgs(argv) {
  const options = {
    mode: "manual",
    dryRun: false,
    safeCreate: false,
    pilotApply: false,
    approvePlan: false,
    approvalId: null,
    artifactPath: null,
    planFingerprint: null,
    csvProvided: false,
    csvPath: path.join(process.cwd(), "products-import.csv"),
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--safe-create") {
      options.safeCreate = true;
    } else if (arg === "--pilot-apply") {
      options.pilotApply = true;
    } else if (arg === "--approve-plan") {
      options.approvePlan = true;
    } else if (arg.startsWith("--approval-id=")) {
      if (options.approvalId) throw new Error("Only one --approval-id is allowed");
      options.approvalId = arg.slice("--approval-id=".length);
    } else if (arg.startsWith("--artifact=")) {
      options.artifactPath = path.resolve(process.cwd(), arg.slice("--artifact=".length));
    } else if (arg.startsWith("--plan-fingerprint=")) {
      options.planFingerprint = arg.slice("--plan-fingerprint=".length).toLowerCase();
    } else if (arg === "--mode=feed") {
      options.mode = "feed";
    } else if (arg === "--mode=manual") {
      options.mode = "manual";
    } else if (arg.startsWith("--mode=")) {
      throw new Error(`Unsupported import mode: ${arg.slice("--mode=".length)}`);
    } else if (arg.startsWith("--csv=")) {
      options.csvPath = path.resolve(process.cwd(), arg.slice("--csv=".length));
      options.csvProvided = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.safeCreate && options.mode !== "feed") {
    throw new Error("--safe-create is only supported with --mode=feed");
  }
  if (options.pilotApply && options.dryRun) {
    throw new Error("--pilot-apply cannot be combined with --dry-run");
  }
  if (options.approvePlan && (options.dryRun || options.pilotApply)) {
    throw new Error("--approve-plan is a separate step and cannot be combined with dry-run or pilot apply");
  }
  if ((options.approvePlan || options.pilotApply) && (!options.artifactPath || !options.planFingerprint)) {
    throw new Error("Approval and pilot apply require --artifact and --plan-fingerprint");
  }
  if (options.approvePlan && options.approvalId) {
    throw new Error("Plan approval cannot consume an approval ID");
  }
  if (options.pilotApply && !options.approvalId) {
    throw new Error("Pilot apply requires exactly one --approval-id");
  }
  if (options.dryRun && options.approvalId) {
    throw new Error("Dry run cannot consume an approval ID");
  }

  return options;
}

function validatePilotApply(rows, options) {
  if (options.dryRun) {
    if (options.approvalId || options.approvalIds) throw new Error("Dry run cannot consume an approval ID");
    return;
  }
  throw new Error("Database writes require the dry-run artifact approval workflow");
}

async function runImport(options = parseArgs(process.argv.slice(2))) {
  if (options.approvePlan) {
    const result = await approveArtifactPlan({
      ...options,
      sourcePath: options.csvProvided ? options.csvPath : null,
    });
    console.log(`Approval ID: ${result.approvalId}`);
    console.log(`Expires at: ${result.expiresAt}`);
    console.log(`Artifact SHA-256: ${result.artifactSha256}`);
    console.log(`Plan fingerprint: ${result.planFingerprint}`);
    console.log(`Source row fingerprint: ${result.sourceRowFingerprint}`);
    console.log(`Retailer ID: ${result.retailerId ?? "null"}`);
    console.log(`Plan kind: ${result.planKind}`);
    return result;
  }
  if (options.pilotApply) {
    const result = await applyArtifactPlan({
      ...options,
      sourcePath: options.csvProvided ? options.csvPath : null,
    });
    console.log(`Consumed approval ID: ${result.approvalId}`);
    console.log(`Consumed at: ${result.consumedAt}`);
    console.log(`Artifact SHA-256: ${result.artifactSha256}`);
    console.log(`Plan fingerprint: ${result.planFingerprint}`);
    console.log(`Source row fingerprint: ${result.sourceRowFingerprint}`);
    return result;
  }
  const csvPath = options.csvPath;

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Found ${rows.length} CSV row(s).`);
  const result = await runImportRows(rows, options);

  if (options.dryRun) {
    const artifactResult = writeDryRunArtifact(rows, result, {
      artifactPath: options.artifactPath,
      sourceBytes: Buffer.from(csvContent, "utf8"),
      sourceFileName: csvPath,
      environmentMarker: "local",
    });
    Object.assign(result, {
      artifactPath: artifactResult.artifactPath,
      artifactSha256: artifactResult.artifactSha256,
      runId: artifactResult.artifact.run_id,
      sourceFileSha256: artifactResult.artifact.source_file_sha256,
      planFingerprints: artifactResult.artifact.plans.map((entry) => entry.plan_fingerprint),
    });
    console.log(`Dry-run artifact: ${artifactResult.artifactPath}`);
    console.log(`Artifact SHA-256: ${artifactResult.artifactSha256}`);
    console.log(`Plans: ${artifactResult.artifact.plans.length}`);
    console.log(`Blocked rows: ${artifactResult.artifact.blocked_rows.length}`);
  }

  const reportPath = String(process.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH || "").trim();
  if (reportPath) {
    const reportRoot = path.resolve(process.cwd(), "tmp");
    const resolvedReportPath = path.resolve(reportPath);
    const relativeReportPath = path.relative(reportRoot, resolvedReportPath);
    if (!relativeReportPath || relativeReportPath.startsWith("..") || path.isAbsolute(relativeReportPath)) {
      throw new Error("Import report path must be inside the project tmp directory");
    }
    const runId = String(process.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID || "").trim();
    if (!runId) throw new Error("Import report run ID is required");
    const temporaryPath = `${resolvedReportPath}.tmp-${process.pid}`;
    fs.mkdirSync(path.dirname(resolvedReportPath), { recursive: true });
    try {
      fs.writeFileSync(
        temporaryPath,
        `${JSON.stringify({
          runId,
          rowLevelOffers: result.rowLevelOffers || [],
          successfulRows: result.successfulRows || [],
          failedRows: result.failedRows || [],
          blockedRows: result.blockedRows || [],
          plans: (result.report?.approvedRows || []).map((item) => item.importPlan),
        }, null, 2)}\n`,
        "utf8"
      );
      fs.renameSync(temporaryPath, resolvedReportPath);
    } catch (error) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {}
      throw error;
    }
  }

  console.log("");
  console.log("Import finished.");
  console.log(`Successful: ${result.successful}`);
  if (options.dryRun && result.planned > 0) {
    console.log(`Approved rows planned: ${result.planned}`);
  }
  console.log(`Skipped for review: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);

  if (result.failed > 0) {
    process.exitCode = 1;
  }

  return result;
}

if (require.main === module) {
  runImport().catch((error) => {
    console.error("Import failed:", error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  IMPORT_ARTIFACT_VERSION,
  applyArtifactPlan,
  approveArtifactPlan,
  assessVariantCompatibility,
  buildDryRunArtifact,
  buildAtomicImportPlan,
  buildRetailerProductPayload,
  buildRowLevelOfferResults,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  getOfferUrl,
  getRetailerProductUrl,
  isAmbiguousFeedRow,
  isProductGtinVerified,
  parseArgs,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseStrictBoolean,
  parseSize,
  parseVariantIdentity,
  parseExternalOptions,
  preflightFeedRows,
  normalizeCategory,
  normalizeFlavour,
  normalizeCanonicalRetailerFeedRows,
  normalizeSourceRow,
  normalizeShippingForImport,
  priceHistoryTotal,
  runImport,
  runImportRows,
  loadDryRunArtifact,
  selectArtifactPlan,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
  validatePilotApply,
  writeDryRunArtifact,
};
