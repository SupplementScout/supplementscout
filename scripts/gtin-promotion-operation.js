const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { buildReadOnlyPreview } = require("./gtin-promotion-dry-run");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "gtin-promotion-approved-exact-45-v1";
const CONFIRMATION = "OWNER_APPROVED_EXACT_45";
const OWNER_DOCUMENT = "docs/EBAY-UK-COVERAGE-PLAN.md";
const PROTECTED_DATABASE_ENV = Object.freeze({
  approver: "GTIN_PROMOTION_APPROVER_DATABASE_URL",
  executor: "GTIN_PROMOTION_EXECUTOR_DATABASE_URL",
});

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function md5(value) { return crypto.createHash("md5").update(value).digest("hex"); }
function nullableString(value) { return value == null || String(value).trim() === "" ? null : String(value); }

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target|artifact|output|confirm)=(.+)$/);
    if (!match || result[match[1]] !== undefined) fail(`Unsupported argument: ${argument}`);
    result[match[1]] = match[2];
  }
  if (!["plan", "validate", "apply"].includes(result.mode)) fail("Required --mode=plan|validate|apply");
  if (result.target !== "production") fail("Required --target=production");
  if (result.mode === "plan") {
    if (result.artifact || result.confirm) fail("Plan mode cannot approve or consume an artifact");
  } else {
    if (!result.artifact) fail("Protected modes require --artifact=<path>");
    result.artifact = path.resolve(ROOT, result.artifact);
    if (result.confirm !== CONFIRMATION) fail(`Protected modes require --confirm=${CONFIRMATION}`);
  }
  if (result.output) {
    result.output = path.resolve(ROOT, result.output);
    const relative = path.relative(path.join(ROOT, "tmp"), result.output);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  }
  return result;
}

function loadReadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Missing or mismatched production read credentials");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readTargets(client, table, columns, ids) {
  const { data, error } = await client.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

function expectedProduct(product) {
  return {
    name: product.name,
    brand: product.brand,
    product_format: product.product_format,
    is_active: product.is_active,
    merged_into_product_id: nullableString(product.merged_into_product_id),
    gtin: nullableString(product.gtin),
  };
}

function expectedVariant(variant) {
  return {
    product_id: String(variant.product_id),
    display_name: nullableString(variant.display_name),
    flavour_label: nullableString(variant.flavour_label),
    size_value: nullableString(variant.size_value),
    size_unit: nullableString(variant.size_unit),
    pack_count: nullableString(variant.pack_count),
    product_format: nullableString(variant.product_format),
    is_active: variant.is_active,
    is_default: variant.is_default,
    gtin: nullableString(variant.gtin),
  };
}

function buildArtifact(preview, products, variants, options = {}) {
  const ready = preview.rows.filter((row) => row.decision === "READY_TO_PROMOTE");
  if (ready.length !== 45 || ready.some((row) => row.destination_field !== "product_variants.gtin" || row.current_value !== null || row.blockers.length)) {
    fail("Owner-approved exact 45 scope drifted from the reviewed preview");
  }
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const ownerRows = ready.map((row) => ({ product_id: row.product_id, variant_id: row.variant_id, gtin: row.gtin, decision: "APPROVE_CANDIDATE" }));
  const scopeFingerprint = hash("GTIN-PROMOTION-OWNER-SCOPE:1", ownerRows);
  const rows = ready.map((row) => {
    const product = productById.get(row.product_id);
    const variant = variantById.get(row.variant_id);
    if (!product || !variant || String(variant.product_id) !== row.product_id) fail(`Missing canonical target ${row.product_id}/${row.variant_id}`);
    return {
      product_id: row.product_id,
      variant_id: row.variant_id,
      gtin: row.gtin,
      destination_field: row.destination_field,
      expected_current_gtin: row.current_value,
      single_trade_item: false,
      evidence_count: String(row.evidence_count),
      evidence_sources: row.evidence_sources,
      candidate_fingerprint: row.candidate_fingerprint,
      owner_decision: "APPROVE_CANDIDATE",
      expected_product: expectedProduct(product),
      expected_variant: expectedVariant(variant),
    };
  });
  const plan = {
    meta: {
      version: "1",
      operation_type: "GTIN_PROMOTION",
      plan_kind: "gtin_promotion",
      plan_fingerprint: null,
      source_row_fingerprint: hash("GTIN-PROMOTION-ROWS:1", rows),
      preview_fingerprint: preview.preview_fingerprint,
      canonical_snapshot_fingerprint: preview.canonical_snapshot_fingerprint,
    },
    owner_review: {
      decision: "APPROVED_EXACT_SCOPE",
      reviewed_count: "45",
      document: OWNER_DOCUMENT,
      scope_fingerprint: scopeFingerprint,
    },
    rows,
  };
  plan.meta.plan_fingerprint = md5(canonicalJson(plan));
  const createdAt = options.createdAt || new Date().toISOString();
  const artifact = {
    artifact_version: "1",
    kind: KIND,
    target_environment: "PRODUCTION",
    target_project_ref: PROJECT_REF,
    run_id: options.runId || crypto.randomUUID(),
    created_at: createdAt,
    expires_at: options.expiresAt || new Date(Date.parse(createdAt) + 15 * 60 * 1000).toISOString(),
    row_count: "45",
    owner_confirmation: CONFIRMATION,
    plan,
    artifact_fingerprint: null,
  };
  artifact.artifact_fingerprint = hash("GTIN-PROMOTION-ARTIFACT:1", artifact);
  return artifact;
}

function validateArtifact(artifact) {
  if (artifact.artifact_version !== "1" || artifact.kind !== KIND || artifact.target_environment !== "PRODUCTION" || artifact.target_project_ref !== PROJECT_REF || artifact.row_count !== "45" || artifact.owner_confirmation !== CONFIRMATION || !Array.isArray(artifact.plan?.rows) || artifact.plan.rows.length !== 45) fail("GTIN promotion artifact envelope mismatch");
  if (Date.parse(artifact.expires_at) <= Date.now()) fail("GTIN promotion artifact expired; generate a fresh plan");
  const artifactFingerprint = artifact.artifact_fingerprint;
  if (artifactFingerprint !== hash("GTIN-PROMOTION-ARTIFACT:1", { ...artifact, artifact_fingerprint: null })) fail("GTIN promotion artifact fingerprint mismatch");
  const expectedPlanFingerprint = md5(canonicalJson({ ...artifact.plan, meta: { ...artifact.plan.meta, plan_fingerprint: null } }));
  if (artifact.plan.meta.plan_fingerprint !== expectedPlanFingerprint) fail("GTIN promotion plan fingerprint mismatch");
  const uniqueTargets = new Set(artifact.plan.rows.map((row) => `${row.destination_field}:${row.destination_field === "products.gtin" ? row.product_id : row.variant_id}`));
  const uniqueGtins = new Set(artifact.plan.rows.map((row) => row.gtin));
  if (uniqueTargets.size !== 45 || uniqueGtins.size !== 45 || artifact.plan.rows.some((row) => row.owner_decision !== "APPROVE_CANDIDATE" || row.evidence_sources.length < 2)) fail("GTIN promotion artifact row scope mismatch");
  return artifact;
}

function readArtifact(file) {
  const sidecar = `${file}.sha256`;
  if (!fs.existsSync(file) || !fs.existsSync(sidecar)) fail("Immutable GTIN promotion artifact or SHA-256 sidecar missing");
  const bytes = fs.readFileSync(file);
  const expected = fs.readFileSync(sidecar, "utf8").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected) || sha256(bytes) !== expected) fail("GTIN promotion artifact SHA-256 mismatch");
  return { artifact: validateArtifact(JSON.parse(bytes.toString("utf8"))), artifactSha256: expected };
}

function writeArtifact(artifact, output) {
  const resolved = output || path.join(ROOT, "tmp", "gtin-promotion", `approved-exact-45-${artifact.run_id}.json`);
  const relative = path.relative(path.join(ROOT, "tmp"), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Artifact output must be inside repository tmp");
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const digest = sha256(bytes);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, bytes, { flag: "wx" });
  fs.writeFileSync(`${resolved}.sha256`, `${digest}\n`, { flag: "wx" });
  return { path: resolved, sha256: digest };
}

async function buildFreshArtifact(options = {}) {
  const previewResult = await buildReadOnlyPreview({ target: "production", output: null });
  const ready = previewResult.preview.rows.filter((row) => row.decision === "READY_TO_PROMOTE");
  const readClient = loadReadClient();
  const [products, variants] = await Promise.all([
    readTargets(readClient, "products", "id,name,brand,product_format,gtin,is_active,merged_into_product_id", [...new Set(ready.map((row) => row.product_id))]),
    readTargets(readClient, "product_variants", "id,product_id,display_name,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active,is_default", ready.map((row) => row.variant_id)),
  ]);
  return buildArtifact(previewResult.preview, products, variants, options);
}

function protectedCredential(kind) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must not be present during protected approval/apply");
  const variable = PROTECTED_DATABASE_ENV[kind];
  if (!variable) fail(`Unsupported protected role ${kind}`);
  const value = process.env[variable];
  if (!value) fail(`Missing ${variable}`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.hostname.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleTransaction(kind, callback, commit) {
  const client = new Client({ connectionString: protectedCredential(kind), ssl: { rejectUnauthorized: false }, application_name: `gtin-promotion-${kind}`, options: "-c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user")).rows[0].current_user;
    if (identity !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally { await client.end(); }
}

async function approveArtifact(loaded, commit) {
  const artifact = loaded.artifact;
  return roleTransaction("approver", async (client) => {
    const response = await client.query(
      "select public.approve_gtin_promotion_plan($1::jsonb,$2,$3,$4,$5::timestamptz) result",
      [artifact.plan, loaded.artifactSha256, artifact.run_id, KIND, artifact.expires_at]
    );
    const approval = response.rows[0].result;
    if (approval.status !== "approved" || approval.plan_fingerprint !== artifact.plan.meta.plan_fingerprint || approval.artifact_sha256 !== loaded.artifactSha256) fail("GTIN promotion approval metadata mismatch");
    return approval;
  }, commit);
}

async function applyArtifact(loaded) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch") fail("GTIN promotion apply is restricted to manual GitHub Actions on main");
  const approval = await approveArtifact(loaded, true);
  const artifact = loaded.artifact;
  return roleTransaction("executor", async (client) => {
    const response = await client.query(
      "select public.apply_approved_gtin_promotion_plan($1::uuid,$2,$3,$4,$5) result",
      [approval.approval_id, loaded.artifactSha256, artifact.plan.meta.plan_fingerprint, artifact.plan.meta.source_row_fingerprint, artifact.run_id]
    );
    const applied = response.rows[0].result;
    if (applied.status !== "APPLIED" || applied.approval_status !== "consumed" || applied.applied_count !== "45") fail("GTIN promotion apply result mismatch");
    return applied;
  }, true);
}

async function run(options) {
  if (options.mode === "plan") {
    const artifact = await buildFreshArtifact();
    const written = writeArtifact(artifact, options.output);
    return { mode: "plan", database_writes: 0, artifact: path.relative(ROOT, written.path), artifact_sha256: written.sha256, plan_fingerprint: artifact.plan.meta.plan_fingerprint, rows: 45 };
  }
  const loaded = readArtifact(options.artifact);
  if (options.mode === "validate") {
    const approval = await approveArtifact(loaded, false);
    return { mode: "validate", database_writes: 0, approval_rolled_back: true, plan_fingerprint: approval.plan_fingerprint, rows: 45 };
  }
  const applied = await applyArtifact(loaded);
  return { mode: "apply", database_writes: 45, approval_id: applied.approval_id, consumed_at: applied.consumed_at, rows: 45 };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { buildArtifact, buildFreshArtifact, parseArgs, readArtifact, run, validateArtifact, writeArtifact };
