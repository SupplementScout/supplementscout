const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  assertNoUndefined,
  canonicalJson,
  normalizeNumbersToDecimalStrings,
  omitUndefinedObjectFields,
} = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
  ROOT,
  "config",
  "retailers",
  "predators-gear-reviewed-bindings-v1.json"
);
const EXPECTED_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-with-images-safe-create-dry-run-v2.json"
);
const EXPECTED_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-with-images.csv"
);
const REMAINING_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-remaining-6-dry-run.json"
);
const REMAINING_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v1-remaining-6.csv"
);
const BATCH2_MANIFEST_PATH = path.join(
  ROOT,
  "config",
  "retailers",
  "predators-gear-reviewed-bindings-v2.json"
);
const BATCH2_ARTIFACT_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v2-batch-2-safe-5-dry-run.json"
);
const BATCH2_CSV_PATH = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "predators-gear",
  "predators-gear-reviewed-existing-bindings-v2-batch-2-safe-5.csv"
);
const APPROVER_CREDENTIAL_PATH = path.join(
  process.env.USERPROFILE || "",
  ".supplementscout",
  "credentials",
  "production-approver.env"
);
const APPROVER_ROLE = "retailer_catalogue_production_approver";
const APPROVER_LOGIN = "supplementscout_production_approver_login";
const STAGING_PROJECT_REF = "hxnrsyyqffztlvcrtgbf";
const EXPECTED_REVIEW_ROWS = [1, 2, 6, 7, 8, 9, 10];
const EXPECTED_EXCLUDED_ROWS = [3, 4, 5];
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MD5_PATTERN = /^[0-9a-f]{32}$/;
const REVIEWED_PROFILES = Object.freeze([
  Object.freeze({
    name: "original-v2",
    manifestPath: MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v1",
    approvalReason: "predators-gear-reviewed-bindings-v1",
    artifactPath: EXPECTED_ARTIFACT_PATH,
    artifactSha256: "ef843b77fbd0aa75f83908dadf33f4f92bda06b25f86115f8c5ffb3780ecc8c1",
    csvPath: EXPECTED_CSV_PATH,
    csvSha256: "841cbdb71a1de7e4216716bddd2dd582fd1f73901fe64929979e09768ecd7dd2",
    planCount: 7,
    reviewRows: Object.freeze([1, 2, 6, 7, 8, 9, 10]),
    retailerAction: "create",
    retailerId: null,
    planFingerprints: Object.freeze([
      "8d9c2ce4e4d88a8ddb5c7feec9ed825a",
      "5f5c0f82602db01fc7b5397b27bae4d1",
      "b3c0936ccd4005b81a49e0f2d6ab7bf2",
      "d428e32c5da245dabe86fa001e591ded",
      "0bd87626c252582d9c98ce449d529fd3",
      "d5f171f4b445a37bdf690441009da5e6",
      "69d107a53f318ced2d88ebdffc004fe8",
    ]),
    selectableFingerprints: Object.freeze(["8d9c2ce4e4d88a8ddb5c7feec9ed825a"]),
  }),
  Object.freeze({
    name: "remaining-6",
    manifestPath: MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v1",
    approvalReason: "predators-gear-reviewed-bindings-v1",
    artifactPath: REMAINING_ARTIFACT_PATH,
    artifactSha256: "6353e4285db10fe160d0b8f2ffbdea61489606c86528dc2fa31aa79f57b0428c",
    csvPath: REMAINING_CSV_PATH,
    csvSha256: "c09ce429f62098bc341e0027d05556005718e5813b3fee13e4e6a2e3ce31adfb",
    planCount: 6,
    reviewRows: Object.freeze([2, 6, 7, 8, 9, 10]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze([
      "d8e536e8361752e01a64672086af50dc",
      "78bd93523f61d5aef20b82cb4d74ecaa",
      "afaa55b519f266ed4eeb70a8db01a27f",
      "5c44cb1aa6dd494547a4fb28f99fc149",
      "36ad963f00982a936877dd2ffa2d67d4",
      "9885fc60773e83b34385dcd71908571b",
    ]),
    selectableFingerprints: Object.freeze([
      "d8e536e8361752e01a64672086af50dc",
      "78bd93523f61d5aef20b82cb4d74ecaa",
      "afaa55b519f266ed4eeb70a8db01a27f",
      "5c44cb1aa6dd494547a4fb28f99fc149",
      "36ad963f00982a936877dd2ffa2d67d4",
      "9885fc60773e83b34385dcd71908571b",
    ]),
  }),
  Object.freeze({
    name: "batch-2-safe-5",
    manifestPath: BATCH2_MANIFEST_PATH,
    manifestKind: "predators-gear-reviewed-existing-bindings-v2-batch-2",
    approvalReason: "predators-gear-reviewed-bindings-v2-batch-2-safe-5",
    artifactPath: BATCH2_ARTIFACT_PATH,
    artifactSha256: "0b9c9350dfc53c10d4769415c899ab88bff372cf784b273daaaa0cc92297440a",
    csvPath: BATCH2_CSV_PATH,
    csvSha256: "0ad4ccbdce0fa1cbdbebca24100e48f9c818d81e5527e438c4334c425269bf46",
    planCount: 5,
    reviewRows: Object.freeze([3, 6, 7, 8, 9]),
    retailerAction: "existing",
    retailerId: "13",
    planFingerprints: Object.freeze([
      "a1344d6236e5396fc6dc9f80ce684a90",
      "713d3e09c0e20c8a5ba8edeb807c7f7f",
      "a0e5ec0f9cd1b3b426246cfce955fb03",
      "f6bbb3ad3a982ce6c8abc4a243503be4",
      "4380e5ad881ca58639905b9817ec8c55",
    ]),
    selectableFingerprints: Object.freeze([
      "a1344d6236e5396fc6dc9f80ce684a90",
      "713d3e09c0e20c8a5ba8edeb807c7f7f",
      "a0e5ec0f9cd1b3b426246cfce955fb03",
      "f6bbb3ad3a982ce6c8abc4a243503be4",
      "4380e5ad881ca58639905b9817ec8c55",
    ]),
  }),
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
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

function planFingerprint(plan) {
  return hashJson(normalizeNumbersToDecimalStrings({
    ...plan,
    meta: { ...plan.meta, plan_fingerprint: null },
  }));
}

function parseArgs(argv) {
  const options = {};
  const allowed = new Set(["artifact", "plan-fingerprint", "csv"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    if (!match || !allowed.has(match[1]) || options[match[1]] !== undefined) {
      fail(`Invalid argument ${argument}`);
    }
    options[match[1]] = match[2];
  }
  for (const name of allowed) {
    if (!options[name]) fail(`Required --${name}=<value>`);
  }
  options.artifact = path.resolve(options.artifact);
  options.csv = path.resolve(options.csv);
  options.planFingerprint = String(options["plan-fingerprint"]).trim().toLowerCase();
  delete options["plan-fingerprint"];
  if (!MD5_PATTERN.test(options.planFingerprint)) {
    fail("A valid --plan-fingerprint is required");
  }
  return options;
}

function loadDryRunArtifactEquivalent(artifactPath) {
  if (!fs.existsSync(artifactPath)) fail("Dry-run artifact not found");
  const sidecarPath = `${artifactPath}.sha256`;
  if (!fs.existsSync(sidecarPath)) fail("Dry-run artifact SHA-256 sidecar not found");
  const bytes = fs.readFileSync(artifactPath);
  const expectedSha = fs.readFileSync(sidecarPath, "utf8").trim().toLowerCase();
  const rawSha = sha256(bytes);
  const text = bytes.toString("utf8");
  const normalizedSha = text.includes("\r\n")
    ? sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8"))
    : rawSha;
  if (!SHA256_PATTERN.test(expectedSha) || (rawSha !== expectedSha && normalizedSha !== expectedSha)) {
    fail("Dry-run artifact SHA-256 mismatch");
  }
  const artifact = JSON.parse(text);
  assertNoUndefined(artifact);
  if (
    artifact.artifact_version !== "1" ||
    !Array.isArray(artifact.source_rows) ||
    !Array.isArray(artifact.plans) ||
    !Array.isArray(artifact.blocked_rows) ||
    artifact.row_count !== String(artifact.source_rows.length)
  ) fail("Dry-run artifact schema is invalid");
  for (const source of artifact.source_rows) {
    if (source.source_row_fingerprint !== sourceRowFingerprint(source.normalized_source_row)) {
      fail("Dry-run artifact source row fingerprint mismatch");
    }
  }
  for (const entry of artifact.plans) {
    const plan = entry.resolved_plan;
    if (
      !plan ||
      entry.plan_fingerprint !== plan.meta?.plan_fingerprint ||
      entry.source_row_fingerprint !== plan.meta?.source_row_fingerprint ||
      entry.plan_kind !== plan.meta?.plan_kind ||
      entry.operation_type !== plan.meta?.operation_type ||
      entry.operation_type !== "standard_import" ||
      entry.plan_fingerprint !== planFingerprint(plan) ||
      !MD5_PATTERN.test(entry.plan_fingerprint) ||
      !SHA256_PATTERN.test(entry.source_row_fingerprint)
    ) fail("Dry-run artifact plan metadata mismatch");
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    if (!source || source.source_row_fingerprint !== entry.source_row_fingerprint) {
      fail("Dry-run artifact plan/source row mismatch");
    }
  }
  return { artifact, artifactPath, artifactSha256: expectedSha };
}

function sortedNumbers(values) {
  return [...values].map(Number).sort((a, b) => a - b);
}

function sameNumbers(left, right) {
  return canonicalJson(sortedNumbers(left)) === canonicalJson(sortedNumbers(right));
}

function identityKey(row) {
  return `${String(row.external_product_id || "")}:${String(row.external_variant_id || "")}`;
}

function exactDecimal(value, expected) {
  return Number.isFinite(Number(value)) && Number(value) === Number(expected);
}

function resolveReviewedProfile(options, configuredProfile) {
  if (configuredProfile) return configuredProfile;
  const matches = REVIEWED_PROFILES.filter((profile) =>
    path.resolve(options.artifact) === path.resolve(profile.artifactPath) &&
    path.resolve(options.csv) === path.resolve(profile.csvPath)
  );
  if (matches.length !== 1) {
    fail("Artifact and CSV paths do not match exactly one reviewed Predators Gear profile");
  }
  return matches[0];
}

function validateManifest(manifest, profile) {
  const isV1 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v1";
  const isBatch2 = profile.manifestKind === "predators-gear-reviewed-existing-bindings-v2-batch-2";
  const commonContract =
    manifest.schema_version === 1 &&
    manifest.kind === profile.manifestKind &&
    manifest.approved === true &&
    manifest.retailer?.name === "Predators Gear" &&
    manifest.retailer?.slug === "predators-gear" &&
    manifest.retailer?.website === "https://predatorsgear.co.uk/" &&
    manifest.retailer?.shipping_known === true &&
    manifest.retailer?.shipping_cost === 0 &&
    manifest.policy?.existing_products_only === true &&
    manifest.policy?.existing_variants_only === true &&
    manifest.policy?.allow_product_creation === false &&
    manifest.policy?.allow_variant_creation === false &&
    manifest.policy?.allow_live_import === false &&
    manifest.policy?.sku_is_not_gtin === true &&
    Array.isArray(manifest.rows);
  const v1Contract =
    isV1 &&
    manifest.canonical_csv?.row_count === 7 &&
    manifest.rows.length === 7 &&
    sameNumbers(manifest.rows.map((row) => row.review_row), EXPECTED_REVIEW_ROWS) &&
    sameNumbers(manifest.excluded_review_rows || [], EXPECTED_EXCLUDED_ROWS);
  const batch2Contract =
    isBatch2 &&
    manifest.retailer?.id === 13 &&
    manifest.canonical_csv?.row_count === 9 &&
    manifest.rows.length === 9 &&
    manifest.execution_subset?.status === "DRY_RUN_PASS" &&
    manifest.execution_subset?.csv_path === path.relative(ROOT, profile.csvPath).replaceAll("\\", "/") &&
    manifest.execution_subset?.csv_sha256 === profile.csvSha256 &&
    manifest.execution_subset?.artifact_path === path.relative(ROOT, profile.artifactPath).replaceAll("\\", "/") &&
    manifest.execution_subset?.artifact_sha256 === profile.artifactSha256 &&
    manifest.execution_subset?.plan_count === profile.planCount &&
    manifest.execution_subset?.blocked_row_count === 0 &&
    sameNumbers(manifest.execution_subset?.review_rows || [], profile.reviewRows) &&
    canonicalJson([...(manifest.execution_subset?.plan_fingerprints || [])].sort()) ===
      canonicalJson([...profile.planFingerprints].sort()) &&
    Array.isArray(manifest.held_after_dry_run) &&
    sameNumbers(manifest.held_after_dry_run.flatMap((entry) => entry.review_rows || []), [1, 2, 4, 5]);
  if (!commonContract || (!v1Contract && !batch2Contract)) {
    fail("Predators Gear reviewed manifest contract mismatch");
  }
  const identities = new Set();
  for (const row of manifest.rows) {
    const key = identityKey(row);
    if (
      identities.has(key) ||
      !row.product_id ||
      !row.product_variant_id ||
      Number(row.product_id) === 337 ||
      row.shipping_cost !== 0 ||
      row.delivered_price !== row.price ||
      row.disposition !== "OWNER_APPROVED" ||
      !String(row.image_url || "").startsWith("https://predatorsgear.co.uk/wp-content/uploads/") ||
      (!String(row.image_provenance || "").startsWith("source_") &&
        !String(row.image_provenance || "").startsWith("browser_verified_source_")) ||
      !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/")
    ) fail(`Unsafe reviewed manifest row ${row.review_row}`);
    if (isV1 && [6, 7].includes(row.review_row) && Number(row.product_id) !== 510) {
      fail(`Whey review row ${row.review_row} must target product 510`);
    }
    identities.add(key);
  }
  return new Map(manifest.rows.map((row) => [identityKey(row), row]));
}

function validatePlan(entry, sourceRecord, reviewed, profile) {
  const source = sourceRecord?.normalized_source_row || {};
  const plan = entry.resolved_plan || {};
  const productId = String(reviewed.product_id);
  const variantId = String(reviewed.product_variant_id);
  let offerUrl;
  let imageUrl;
  try {
    offerUrl = new URL(plan.offer?.values?.url);
    imageUrl = new URL(source.image);
  } catch {
    fail(`Invalid reviewed URL for row ${reviewed.review_row}`);
  }
  if (
    entry.plan_kind !== "feed" ||
    entry.operation_type !== "standard_import" ||
    sourceRecord.status !== "planned" ||
    sourceRecord.plan_fingerprint !== entry.plan_fingerprint ||
    identityKey(source) !== identityKey(reviewed) ||
    String(source.product_id) !== productId ||
    String(source.product_variant_id) !== variantId ||
    source.retailer_name !== "Predators Gear" ||
    source.retailer_website !== "https://predatorsgear.co.uk/" ||
    String(source.shipping_known).toLowerCase() !== "true" ||
    !exactDecimal(source.shipping_cost, 0) ||
    !exactDecimal(source.price, reviewed.price) ||
    !exactDecimal(source.total_price, reviewed.price) ||
    source.external_url !== reviewed.source_url ||
    source.affiliate_url !== reviewed.source_url ||
    source.image !== reviewed.image_url ||
    String(source.external_gtin || "") !== String(reviewed.external_gtin14 || "") ||
    plan.product?.action !== "existing" ||
    String(plan.product.id) !== productId ||
    plan.product_variant?.action !== "existing" ||
    String(plan.product_variant.id) !== variantId ||
    plan.expected_state?.product?.is_active !== true ||
    plan.expected_state?.product?.merged_into_product_id != null ||
    String(plan.expected_state?.product?.id) !== productId ||
    plan.expected_state?.product_variant?.is_active !== true ||
    String(plan.expected_state?.product_variant?.id) !== variantId ||
    String(plan.expected_state?.product_variant?.product_id) !== productId ||
    plan.retailer_product?.action !== "create" ||
    String(plan.retailer_product?.values?.product_variant_id) !== variantId ||
    String(plan.retailer_product?.values?.external_product_id) !== String(reviewed.external_product_id) ||
    String(plan.retailer_product?.values?.external_variant_id) !== String(reviewed.external_variant_id) ||
    String(plan.retailer_product?.values?.external_gtin || "") !== String(reviewed.external_gtin14 || "") ||
    plan.expected_state?.retailer_product != null ||
    plan.offer?.action !== "create" ||
    !exactDecimal(plan.offer?.values?.price, reviewed.price) ||
    !exactDecimal(plan.offer?.values?.shipping_cost, 0) ||
    !exactDecimal(plan.offer?.values?.total_price, reviewed.price) ||
    plan.offer?.values?.url !== reviewed.source_url ||
    plan.expected_state?.offer != null ||
    plan.price_history?.action !== "create" ||
    plan.approval?.approved !== false ||
    plan.approval?.approval_type !== "none" ||
    offerUrl.protocol !== "https:" ||
    offerUrl.hostname !== "predatorsgear.co.uk" ||
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== "predatorsgear.co.uk" ||
    Number(productId) === 337
  ) fail(`Unsafe Predators Gear plan for review row ${reviewed.review_row}`);
  if (
    profile.manifestKind === "predators-gear-reviewed-existing-bindings-v1" &&
    [6, 7].includes(reviewed.review_row) &&
    Number(productId) !== 510
  ) {
    fail(`Whey review row ${reviewed.review_row} must target product 510`);
  }
  if (profile.retailerAction === "create") {
    if (
      entry.retailer_id != null ||
      plan.retailer?.action !== "create" ||
      plan.retailer?.values?.name !== "Predators Gear" ||
      plan.retailer?.values?.slug !== "predators-gear" ||
      plan.retailer?.values?.website !== "https://predatorsgear.co.uk/" ||
      plan.expected_state?.retailer != null
    ) fail(`Unsafe retailer create plan for review row ${reviewed.review_row}`);
  } else if (
    profile.retailerAction !== "existing" ||
    String(entry.retailer_id) !== String(profile.retailerId) ||
    plan.retailer?.action !== "existing" ||
    String(plan.retailer?.id) !== String(profile.retailerId) ||
    String(plan.expected_state?.retailer?.id) !== String(profile.retailerId) ||
    plan.expected_state?.retailer?.name !== "Predators Gear" ||
    plan.expected_state?.retailer?.slug !== "predators-gear" ||
    plan.expected_state?.retailer?.website !== "https://predatorsgear.co.uk/"
  ) fail(`Unsafe existing retailer plan for review row ${reviewed.review_row}`);
}

function validateApprovalScope(options, loaded, manifest, csvBytes, configuration = {}) {
  const profile = resolveReviewedProfile(options, configuration.profile);
  const csvSha = sha256(csvBytes);
  const artifact = loaded.artifact;
  if (
    path.resolve(options.artifact) !== path.resolve(profile.artifactPath) ||
    path.resolve(loaded.artifactPath) !== path.resolve(profile.artifactPath) ||
    loaded.artifactSha256 !== profile.artifactSha256 ||
    path.resolve(options.csv) !== path.resolve(profile.csvPath) ||
    csvSha !== profile.csvSha256 ||
    csvSha !== artifact.source_file_sha256 ||
    artifact.source_file_name !== path.basename(profile.csvPath) ||
    artifact.environment_marker !== "local" ||
    artifact.row_count !== String(profile.planCount) ||
    artifact.source_rows?.length !== profile.planCount ||
    artifact.plans?.length !== profile.planCount ||
    artifact.blocked_rows?.length !== 0 ||
    artifact.summary?.plan_count !== String(profile.planCount) ||
    artifact.summary?.blocked_row_count !== "0" ||
    artifact.summary?.skipped_row_count !== "0"
  ) fail("Predators Gear artifact, source hash, or clean-run contract mismatch");
  const allReviewed = validateManifest(manifest, profile);
  const reviewedRows = manifest.rows.filter((row) => profile.reviewRows.includes(row.review_row));
  if (reviewedRows.length !== profile.planCount) fail("Reviewed profile row scope is invalid");
  const reviewedByIdentity = new Map(reviewedRows.map((row) => [identityKey(row), allReviewed.get(identityKey(row))]));
  const fingerprints = new Set();
  const seenIdentities = new Set();
  for (const entry of artifact.plans) {
    if (fingerprints.has(entry.plan_fingerprint)) fail("Duplicate plan fingerprint");
    fingerprints.add(entry.plan_fingerprint);
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    const key = identityKey(source?.normalized_source_row || {});
    const reviewed = reviewedByIdentity.get(key);
    if (!reviewed || seenIdentities.has(key)) fail(`Unreviewed or duplicate artifact identity ${key}`);
    validatePlan(entry, source, reviewed, profile);
    seenIdentities.add(key);
  }
  if (
    seenIdentities.size !== profile.planCount ||
    !sameNumbers([...seenIdentities].map((key) => reviewedByIdentity.get(key)?.review_row), profile.reviewRows) ||
    canonicalJson([...fingerprints].sort()) !== canonicalJson([...profile.planFingerprints].sort())
  ) fail("Predators Gear artifact scope or reviewed fingerprint set is incomplete");
  if (!profile.selectableFingerprints.includes(options.planFingerprint)) {
    fail("Plan fingerprint is not selectable in this reviewed profile");
  }
  const selected = artifact.plans.filter((entry) => entry.plan_fingerprint === options.planFingerprint);
  if (selected.length !== 1) fail("Artifact must contain exactly one matching plan");
  const source = artifact.source_rows.find((row) => row.row_number === selected[0].row_number);
  const reviewed = reviewedByIdentity.get(identityKey(source.normalized_source_row));
  return { loaded, entry: selected[0], source: source.normalized_source_row, reviewed, profile };
}

function loadCredential(file = APPROVER_CREDENTIAL_PATH) {
  if (!file || !fs.existsSync(file)) fail("Protected production approver credential not found");
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  const candidates = Object.entries(values).filter(([key, value]) => key.endsWith("_DATABASE_URL") && value);
  if (candidates.length !== 1) fail("Protected approver credential must contain exactly one database URL");
  const url = new URL(candidates[0][1]);
  url.searchParams.delete("sslmode");
  if (url.href.includes(STAGING_PROJECT_REF)) fail("Approver credential points to staging");
  return url.href;
}

function prepareApproval(options, dependencies = {}) {
  const profile = resolveReviewedProfile(options, dependencies.configuration?.profile);
  const manifest = dependencies.manifest || JSON.parse(fs.readFileSync(profile.manifestPath, "utf8"));
  const loaded = dependencies.loaded || loadDryRunArtifactEquivalent(options.artifact);
  const csvBytes = dependencies.csvBytes || fs.readFileSync(options.csv);
  return validateApprovalScope(options, loaded, manifest, csvBytes, {
    ...dependencies.configuration,
    profile,
  });
}

function verifyApprovalResult(result, prepared) {
  const entry = prepared.entry;
  const loaded = prepared.loaded;
  if (
    result?.status !== "approved" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(result.approval_id || "")) ||
    result.artifact_sha256 !== loaded.artifactSha256 ||
    result.run_id !== loaded.artifact.run_id ||
    result.plan_fingerprint !== entry.plan_fingerprint ||
    result.source_row_fingerprint !== entry.source_row_fingerprint ||
    (result.retailer_id ?? null) !== (entry.retailer_id ?? null) ||
    result.plan_kind !== entry.plan_kind ||
    !Number.isFinite(Date.parse(result.expires_at))
  ) fail("Approval result metadata does not match the reviewed artifact");
}

async function runApproval(options, dependencies = {}) {
  const prepared = prepareApproval(options, dependencies);
  const connectionString = dependencies.connectionString || loadCredential();
  const client = dependencies.client || new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "predators-gear-artifact-approver",
    options: "-c statement_timeout=120000",
  });
  let began = false;
  try {
    await client.connect();
    await client.query("begin");
    began = true;
    await client.query(
      "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)"
    );
    await client.query(`set local role ${APPROVER_ROLE}`);
    const identity = (await client.query("select current_user,session_user")).rows[0];
    if (identity.current_user !== APPROVER_ROLE || identity.session_user !== APPROVER_LOGIN) {
      fail("Production approver identity mismatch");
    }
    const response = await client.query(
      "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
      [
        prepared.entry.resolved_plan,
        prepared.loaded.artifactSha256,
        prepared.loaded.artifact.run_id,
        prepared.profile.approvalReason,
      ]
    );
    const approval = response.rows[0]?.result;
    verifyApprovalResult(approval, prepared);
    await client.query("commit");
    began = false;
    const plan = prepared.entry.resolved_plan;
    return {
      approval_id: approval.approval_id,
      expires_at: approval.expires_at,
      plan_fingerprint: approval.plan_fingerprint,
      retailer: prepared.source.retailer_name,
      product_id: plan.product.id,
      product_variant_id: plan.product_variant.id,
      price: plan.offer.values.price,
      shipping_cost: plan.offer.values.shipping_cost,
      source_url: plan.offer.values.url,
      product_action: plan.product.action,
      variant_action: plan.product_variant.action,
      no_apply_was_run: true,
    };
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runApproval(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  APPROVER_CREDENTIAL_PATH,
  APPROVER_ROLE,
  BATCH2_ARTIFACT_PATH,
  BATCH2_CSV_PATH,
  BATCH2_MANIFEST_PATH,
  EXPECTED_ARTIFACT_PATH,
  EXPECTED_CSV_PATH,
  MANIFEST_PATH,
  REMAINING_ARTIFACT_PATH,
  REMAINING_CSV_PATH,
  REVIEWED_PROFILES,
  loadCredential,
  loadDryRunArtifactEquivalent,
  parseArgs,
  planFingerprint,
  prepareApproval,
  runApproval,
  sha256,
  sourceRowFingerprint,
  validateApprovalScope,
};
