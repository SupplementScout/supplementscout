const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { OWNER_REVIEWED_36_IDENTITIES, buildReadOnlyPreview } = require("./gtin-promotion-dry-run");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "gtin-promotion-approved-exact-45-v1";
const CONFIRMATION = "OWNER_APPROVED_EXACT_45";
const APPROVED_SCOPE_FINGERPRINT = "a79b0f29d9ba141e3421a76a58b4cda4fb0995f4513e9d7004e6ab6308d50046";
const APPROVED_IDENTITIES = Object.freeze([
  ["435","414","0754590525954"],["426","410","5056555205297"],["439","422","0754590525916"],
  ["469","2313","0634158940033"],["469","2699","0634158940026"],["81","67","5999076228171"],
  ["88","54","040232661082"],["360","364","5901330020520"],["393","334","5902114044664"],
  ["425","397","5999100029293"],["1040","2176","5903111089412"],["138","90","033984017351"],
  ["176","227","5901330022685"],["258","248","087614023953"],["11","1002","6009544910770"],
  ["11","1713","6009544910718"],["11","1714","6009544910732"],["11","1715","6009544910756"],
  ["11","1717","6009544910695"],["11","1720","6009544942368"],["11","1722","6009544918745"],
  ["338","1020","658556043769"],["338","1782","5056555214473"],["338","1783","5056555214510"],
  ["338","1784","5056555214527"],["338","1786","5056555214534"],["10","1710","5999076263882"],
  ["55","1029","5999076253548"],["55","1599","5999076253555"],["55","1600","5999076253524"],
  ["790","1094","5061097264619"],["790","1095","5061097264633"],["790","1096","5061097264596"],
  ["790","1097","5061097264657"],["790","1098","5061097264671"],["789","1084","5061097261878"],
  ["789","1085","5060660084821"],["789","1086","5060660084760"],["789","1088","5060660084784"],
  ["789","1089","5060660084746"],["789","1092","5060660084807"],["56","1601","5060424707256"],
  ["56","1604","5060424700363"],["56","1605","5060756342927"],["139","142","8901138110710"],
].map(([product_id, variant_id, gtin]) => Object.freeze({ product_id, variant_id, gtin })));
const SCOPE_CONFIGS = Object.freeze({
  "exact-45": Object.freeze({
    kind: KIND, confirmation: CONFIRMATION, identities: APPROVED_IDENTITIES,
    scopeFingerprint: APPROVED_SCOPE_FINGERPRINT, rowCount: 45, previewScope: "legacy-54",
  }),
  "owner-reviewed-36": Object.freeze({
    kind: "gtin-promotion-owner-reviewed-exact-36-v1",
    confirmation: "OWNER_APPROVED_EXACT_36",
    identities: OWNER_REVIEWED_36_IDENTITIES,
    scopeFingerprint: "415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02",
    rowCount: 36,
    previewScope: "owner-reviewed-36",
  }),
});
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
    const match = argument.match(/^--(mode|target|artifact|output|confirm|scope)=(.+)$/);
    if (!match || result[match[1]] !== undefined) fail(`Unsupported argument: ${argument}`);
    result[match[1]] = match[2];
  }
  if (!["plan", "validate", "apply"].includes(result.mode)) fail("Required --mode=plan|validate|apply");
  if (result.target !== "production") fail("Required --target=production");
  result.scope ||= "exact-45";
  const scope = SCOPE_CONFIGS[result.scope];
  if (!scope) fail("Unsupported GTIN promotion scope");
  if (result.mode === "plan") {
    if (result.artifact || result.confirm) fail("Plan mode cannot approve or consume an artifact");
  } else {
    if (!result.artifact) fail("Protected modes require --artifact=<path>");
    result.artifact = path.resolve(ROOT, result.artifact);
    if (result.confirm !== scope.confirmation) fail(`Protected modes require --confirm=${scope.confirmation}`);
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
  const scope = SCOPE_CONFIGS[options.scope || "exact-45"];
  if (!scope) fail("Unsupported GTIN promotion scope");
  const ready = preview.rows.filter((row) => row.decision === "READY_TO_PROMOTE");
  if (ready.length !== scope.rowCount || ready.some((row) => row.destination_field !== "product_variants.gtin" || row.current_value !== null || row.blockers.length)) {
    fail(`Owner-approved ${options.scope || "exact-45"} scope drifted from the reviewed preview`);
  }
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const ownerRows = ready.map((row) => ({ product_id: row.product_id, variant_id: row.variant_id, gtin: row.gtin, decision: "APPROVE_CANDIDATE" }));
  const identityRows = ownerRows.map(({ product_id, variant_id, gtin }) => ({ product_id, variant_id, gtin }));
  if (JSON.stringify(identityRows) !== JSON.stringify(scope.identities)) fail("Owner-approved identity list mismatch");
  const scopeFingerprint = hash("GTIN-PROMOTION-OWNER-SCOPE:1", ownerRows);
  if (scopeFingerprint !== scope.scopeFingerprint) fail("Owner-approved scope fingerprint mismatch");
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
      reviewed_count: String(scope.rowCount),
      document: OWNER_DOCUMENT,
      scope_fingerprint: scopeFingerprint,
    },
    rows,
  };
  plan.meta.plan_fingerprint = md5(canonicalJson(plan));
  const createdAt = options.createdAt || new Date().toISOString();
  const artifact = {
    artifact_version: "1",
    kind: scope.kind,
    target_environment: "PRODUCTION",
    target_project_ref: PROJECT_REF,
    run_id: options.runId || crypto.randomUUID(),
    created_at: createdAt,
    expires_at: options.expiresAt || new Date(Date.parse(createdAt) + 15 * 60 * 1000).toISOString(),
    row_count: String(scope.rowCount),
    owner_confirmation: scope.confirmation,
    plan,
    artifact_fingerprint: null,
  };
  artifact.artifact_fingerprint = hash("GTIN-PROMOTION-ARTIFACT:1", artifact);
  return artifact;
}

function validateArtifact(artifact, options = {}) {
  const scope = Object.values(SCOPE_CONFIGS).find((value) => value.kind === artifact.kind);
  if (!scope || artifact.artifact_version !== "1" || artifact.target_environment !== "PRODUCTION" || artifact.target_project_ref !== PROJECT_REF || artifact.row_count !== String(scope.rowCount) || artifact.owner_confirmation !== scope.confirmation || artifact.plan?.owner_review?.scope_fingerprint !== scope.scopeFingerprint || !Array.isArray(artifact.plan?.rows) || artifact.plan.rows.length !== scope.rowCount) fail("GTIN promotion artifact envelope mismatch");
  if (!options.allowExpired && Date.parse(artifact.expires_at) <= Date.now()) fail("GTIN promotion artifact expired; generate a fresh plan");
  const artifactFingerprint = artifact.artifact_fingerprint;
  if (artifactFingerprint !== hash("GTIN-PROMOTION-ARTIFACT:1", { ...artifact, artifact_fingerprint: null })) fail("GTIN promotion artifact fingerprint mismatch");
  const expectedPlanFingerprint = md5(canonicalJson({ ...artifact.plan, meta: { ...artifact.plan.meta, plan_fingerprint: null } }));
  if (artifact.plan.meta.plan_fingerprint !== expectedPlanFingerprint) fail("GTIN promotion plan fingerprint mismatch");
  const uniqueTargets = new Set(artifact.plan.rows.map((row) => `${row.destination_field}:${row.destination_field === "products.gtin" ? row.product_id : row.variant_id}`));
  const uniqueGtins = new Set(artifact.plan.rows.map((row) => row.gtin));
  const identities = artifact.plan.rows.map(({ product_id, variant_id, gtin }) => ({ product_id, variant_id, gtin }));
  if (uniqueTargets.size !== scope.rowCount || uniqueGtins.size !== scope.rowCount || JSON.stringify(identities) !== JSON.stringify(scope.identities) || artifact.plan.rows.some((row) => row.owner_decision !== "APPROVE_CANDIDATE" || row.destination_field !== "product_variants.gtin" || row.single_trade_item !== false || row.expected_current_gtin !== null || row.evidence_sources.length < 2)) fail("GTIN promotion artifact row scope mismatch");
  return artifact;
}

function readArtifact(file, options = {}) {
  const sidecar = `${file}.sha256`;
  if (!fs.existsSync(file) || !fs.existsSync(sidecar)) fail("Immutable GTIN promotion artifact or SHA-256 sidecar missing");
  const bytes = fs.readFileSync(file);
  const expected = fs.readFileSync(sidecar, "utf8").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected) || sha256(bytes) !== expected) fail("GTIN promotion artifact SHA-256 mismatch");
  return { artifact: validateArtifact(JSON.parse(bytes.toString("utf8")), options), artifactSha256: expected };
}

function writeArtifact(artifact, output) {
  const label = artifact.row_count === "36" ? "owner-reviewed-exact-36" : "approved-exact-45";
  const resolved = output || path.join(ROOT, "tmp", "gtin-promotion", `${label}-${artifact.run_id}.json`);
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
  const scope = SCOPE_CONFIGS[options.scope || "exact-45"];
  if (!scope) fail("Unsupported GTIN promotion scope");
  const previewResult = await buildReadOnlyPreview({ target: "production", output: null, scope: scope.previewScope });
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
    if (applied.status !== "APPLIED" || applied.approval_status !== "consumed" || applied.applied_count !== loaded.artifact.row_count) fail("GTIN promotion apply result mismatch");
    return applied;
  }, true);
}

async function run(options) {
  if (options.mode === "plan") {
    const artifact = await buildFreshArtifact({ scope: options.scope });
    const written = writeArtifact(artifact, options.output);
    return { mode: "plan", scope: options.scope, database_writes: 0, artifact: path.relative(ROOT, written.path), artifact_sha256: written.sha256, plan_fingerprint: artifact.plan.meta.plan_fingerprint, rows: Number(artifact.row_count) };
  }
  if (options.scope === "owner-reviewed-36" && process.env.GTIN_PROMOTION_EXACT_36_SCHEMA_READY !== "true") {
    fail("Exact-36 protected modes remain blocked until the reviewed database migration is deployed");
  }
  const loaded = readArtifact(options.artifact);
  if (options.mode === "validate") {
    const approval = await approveArtifact(loaded, false);
    return { mode: "validate", database_writes: 0, approval_rolled_back: true, plan_fingerprint: approval.plan_fingerprint, rows: Number(loaded.artifact.row_count) };
  }
  const applied = await applyArtifact(loaded);
  return { mode: "apply", database_writes: Number(loaded.artifact.row_count), approval_id: applied.approval_id, consumed_at: applied.consumed_at, rows: Number(loaded.artifact.row_count) };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { APPROVED_IDENTITIES, APPROVED_SCOPE_FINGERPRINT, SCOPE_CONFIGS, buildArtifact, buildFreshArtifact, parseArgs, readArtifact, run, validateArtifact, writeArtifact };
