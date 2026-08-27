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

function validateManifest(manifest) {
  if (
    manifest.schema_version !== 1 ||
    manifest.kind !== "predators-gear-reviewed-existing-bindings-v1" ||
    manifest.approved !== true ||
    manifest.retailer?.name !== "Predators Gear" ||
    manifest.retailer?.slug !== "predators-gear" ||
    manifest.retailer?.website !== "https://predatorsgear.co.uk/" ||
    manifest.retailer?.shipping_known !== true ||
    manifest.retailer?.shipping_cost !== 0 ||
    manifest.canonical_csv?.row_count !== 7 ||
    manifest.policy?.existing_products_only !== true ||
    manifest.policy?.existing_variants_only !== true ||
    manifest.policy?.allow_product_creation !== false ||
    manifest.policy?.allow_variant_creation !== false ||
    manifest.policy?.allow_live_import !== false ||
    manifest.policy?.sku_is_not_gtin !== true ||
    !Array.isArray(manifest.rows) ||
    manifest.rows.length !== 7 ||
    !sameNumbers(manifest.rows.map((row) => row.review_row), EXPECTED_REVIEW_ROWS) ||
    !sameNumbers(manifest.excluded_review_rows || [], EXPECTED_EXCLUDED_ROWS)
  ) fail("Predators Gear reviewed manifest contract mismatch");
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
      !String(row.image_provenance || "").startsWith("source_") ||
      !String(row.source_url || "").startsWith("https://predatorsgear.co.uk/?p=")
    ) fail(`Unsafe reviewed manifest row ${row.review_row}`);
    if ([6, 7].includes(row.review_row) && Number(row.product_id) !== 510) {
      fail(`Whey review row ${row.review_row} must target product 510`);
    }
    identities.add(key);
  }
  return new Map(manifest.rows.map((row) => [identityKey(row), row]));
}

function validatePlan(entry, sourceRecord, reviewed) {
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
    plan.retailer?.action !== "create" ||
    plan.retailer?.values?.name !== "Predators Gear" ||
    plan.retailer?.values?.slug !== "predators-gear" ||
    plan.retailer?.values?.website !== "https://predatorsgear.co.uk/" ||
    plan.expected_state?.retailer != null ||
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
  if ([6, 7].includes(reviewed.review_row) && Number(productId) !== 510) {
    fail(`Whey review row ${reviewed.review_row} must target product 510`);
  }
}

function validateApprovalScope(options, loaded, manifest, csvBytes, configuration = {}) {
  const root = configuration.root || ROOT;
  const expectedArtifact = configuration.expectedArtifact || EXPECTED_ARTIFACT_PATH;
  const expectedCsv = path.resolve(root, manifest.canonical_csv?.path || "");
  if (path.resolve(options.artifact) !== path.resolve(expectedArtifact)) {
    fail("Artifact path is not the reviewed Predators Gear v2 artifact");
  }
  if (path.resolve(options.csv) !== expectedCsv) {
    fail("Canonical CSV path does not match the reviewed manifest");
  }
  const csvSha = sha256(csvBytes);
  const artifact = loaded.artifact;
  if (
    csvSha !== manifest.canonical_csv.sha256 ||
    csvSha !== artifact.source_file_sha256 ||
    artifact.environment_marker !== "local" ||
    artifact.row_count !== "7" ||
    artifact.source_rows?.length !== 7 ||
    artifact.plans?.length !== 7 ||
    artifact.blocked_rows?.length !== 0 ||
    artifact.summary?.plan_count !== "7" ||
    artifact.summary?.blocked_row_count !== "0" ||
    artifact.summary?.skipped_row_count !== "0"
  ) fail("Predators Gear artifact, source hash, or clean-run contract mismatch");
  const reviewedByIdentity = validateManifest(manifest);
  const fingerprints = new Set();
  const seenIdentities = new Set();
  for (const entry of artifact.plans) {
    if (fingerprints.has(entry.plan_fingerprint)) fail("Duplicate plan fingerprint");
    fingerprints.add(entry.plan_fingerprint);
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number);
    const key = identityKey(source?.normalized_source_row || {});
    const reviewed = reviewedByIdentity.get(key);
    if (!reviewed || seenIdentities.has(key)) fail(`Unreviewed or duplicate artifact identity ${key}`);
    validatePlan(entry, source, reviewed);
    seenIdentities.add(key);
  }
  if (seenIdentities.size !== 7) fail("Predators Gear artifact scope is incomplete");
  const selected = artifact.plans.filter((entry) => entry.plan_fingerprint === options.planFingerprint);
  if (selected.length !== 1) fail("Artifact must contain exactly one matching plan");
  const source = artifact.source_rows.find((row) => row.row_number === selected[0].row_number);
  const reviewed = reviewedByIdentity.get(identityKey(source.normalized_source_row));
  return { loaded, entry: selected[0], source: source.normalized_source_row, reviewed };
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
  const manifest = dependencies.manifest || JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const loaded = dependencies.loaded || loadDryRunArtifactEquivalent(options.artifact);
  const csvBytes = dependencies.csvBytes || fs.readFileSync(options.csv);
  return validateApprovalScope(options, loaded, manifest, csvBytes, dependencies.configuration);
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
        "predators-gear-reviewed-bindings-v1",
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
      retailer: plan.retailer.values.name,
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
  EXPECTED_ARTIFACT_PATH,
  MANIFEST_PATH,
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
