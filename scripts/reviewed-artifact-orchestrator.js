const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson, normalizeDecimalString } = require("./lib/canonical-json");
const { canonicalizeTimestamps } = require("./lib/canonical-timestamp");
const { loadDryRunArtifact } = require("./import-products");
const { parseReviewedContract } = require("./whey-okay-workflow-router");
const {
  normalizeConnectionString,
  withPostgresRoleSession,
} = require("./lib/retailer-offer-sync/production-role-session");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "reviewed-artifact-apply");
const REPOSITORY = "SupplementScout/supplementscout";
const WORKFLOW = ".github/workflows/whey-okay-offer-refresh.yml";
const WORKFLOW_NAME = "Whey Okay Offer Refresh";
const OPERATION = "reviewed_variant_create_rebind_offer_update";
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function hash(value) { return sha256(canonicalJson(value)); }
function evidenceHash(value) { return sha256(canonicalJson(canonicalizeTimestamps(JSON.parse(JSON.stringify(value))))); }
function comparableDbJson(value) { return canonicalJson(canonicalizeTimestamps(value)); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }); }
function exactDecimal(value) { return value == null ? null : Number(value).toFixed(2); }
function contractFromEnv(env = process.env) {
  return parseReviewedContract(env.REVIEWED_CONTRACT_JSON || "");
}

function targetBinding(entry) {
  const plan = entry.resolved_plan;
  return {
    operation_type: plan.meta.operation_type,
    retailer_id: String(plan.retailer.id),
    product_id: String(plan.product.id),
    current_variant_id: String(plan.expected_state.product_variant.id),
    mapping_id: String(plan.retailer_product.id),
    offer_id: String(plan.offer.id),
    source_product_id: plan.source_record.source_product_id,
    source_variant_id: plan.source_record.source_variant_id,
    target_variant_key: plan.product_variant.values.variant_key,
    target_display_name: plan.product_variant.values.display_name,
    before_state: {
      product: plan.expected_state.product,
      product_variant: plan.expected_state.product_variant,
      retailer_product: plan.expected_state.retailer_product,
      offer: plan.expected_state.offer,
    },
    approved_after_state: {
      product_action: plan.product.action,
      product_variant: plan.product_variant.values,
      retailer_product: plan.retailer_product.values,
      offer: plan.offer.values,
      price_history_action: plan.price_history.action,
    },
    expected_deltas: plan.expected_deltas,
    expires_at: plan.meta.expires_at,
  };
}

function ownerConfirmation(contract, entry) {
  return `OWNER_APPROVED_REVIEWED_ARTIFACT:${hash({ contract, target: targetBinding(entry) })}`;
}

function verifyLoadedArtifact(directory, contract, now = new Date(), options = {}) {
  const files = [];
  const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true }).forEach((item) => {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) walk(file); else files.push(file);
  });
  walk(directory);
  const sidecars = files.filter((file) => file.endsWith(".json.sha256"));
  invariant(sidecars.length === 1, "approved artifact must contain exactly one plan SHA sidecar");
  const artifactPath = sidecars[0].slice(0, -7);
  const reportPath = `${artifactPath}.report.json`;
  invariant(files.length === 3 && files.includes(artifactPath) && files.includes(reportPath), "approved artifact file inventory mismatch");
  const loaded = loadDryRunArtifact(artifactPath);
  invariant(loaded.artifactSha256 === contract.artifact_sha256, "approved plan artifact SHA-256 mismatch");
  invariant(sha256(fs.readFileSync(reportPath)) === contract.report_sha256, "approved report SHA-256 mismatch");
  invariant(loaded.artifact.plans.length === 1 && loaded.artifact.blocked_rows.length === 0, "approved artifact must contain exactly one unblocked plan");
  const entry = loaded.artifact.plans[0];
  const plan = entry.resolved_plan;
  const report = read(reportPath);
  invariant(entry.operation_type === OPERATION && plan.meta.operation_type === OPERATION, "reviewed operation type mismatch");
  invariant(entry.plan_fingerprint === contract.plan_fingerprint, "approved plan fingerprint mismatch");
  invariant(plan.meta.approval_fingerprint === contract.approval_fingerprint, "approved approval fingerprint mismatch");
  invariant(plan.meta.idempotency_key === contract.idempotency_key, "approved idempotency key mismatch");
  if (options.requireFresh !== false) invariant(Date.parse(plan.meta.expires_at) > now.getTime(), "approved artifact expired");
  invariant(report.result === "PASS" && report.mode === "dry-run" && report.database_writes === 0 && report.approval_rpc_invoked === false && report.apply_rpc_invoked === false, "approved report is not a read-only PASS");
  invariant(report.artifact_sha256 === contract.artifact_sha256 && report.plan_fingerprint === contract.plan_fingerprint && report.approval_fingerprint === contract.approval_fingerprint && report.idempotency_key === contract.idempotency_key, "approved report correlation mismatch");
  invariant(report.expires_at === plan.meta.expires_at && canonicalJson(report.expected_deltas) === canonicalJson(plan.expected_deltas), "approved report plan binding mismatch");
  invariant(String(plan.retailer.id) === "3", "reviewed artifact is not scoped to Whey Okay");
  return { artifactPath, reportPath, loaded, entry, report };
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Reviewed-Artifact/1.0" } });
  invariant(response.ok, `GitHub metadata request failed with HTTP ${response.status}`);
  return response.json();
}

function extractZip(zipPath, destination, spawn = spawnSync) {
  const listed = spawn("unzip", ["-Z1", zipPath], { encoding: "utf8", windowsHide: true });
  invariant(listed.status === 0, "reviewed artifact ZIP could not be listed");
  const names = listed.stdout.split(/\r?\n/).filter(Boolean);
  invariant(names.length > 0 && names.every((name) => !path.isAbsolute(name) && !name.includes("\\") && name.split("/").every((part) => part && part !== "." && part !== "..")), "reviewed artifact ZIP contains an unsafe path");
  fs.mkdirSync(destination, { recursive: true });
  const extracted = spawn("unzip", ["-q", zipPath, "-d", destination], { encoding: "utf8", windowsHide: true });
  invariant(extracted.status === 0, "reviewed artifact ZIP could not be extracted");
}

async function downloadAndVerify({ env = process.env, fetchImpl = fetch, spawn = spawnSync, now = new Date(), out = OUT } = {}) {
  const contract = contractFromEnv(env);
  invariant(env.GITHUB_ACTIONS === "true" && env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main", "reviewed apply requires manual main-branch GitHub Actions");
  invariant(env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_SHA === contract.source_commit, "reviewed apply repository or commit mismatch");
  invariant(env.GITHUB_TOKEN, "GitHub artifact token is missing");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const run = await githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${contract.source_run_id}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(run.id) === String(contract.source_run_id) && run.repository?.full_name === REPOSITORY, "reviewed source run mismatch");
  invariant(String(run.path || "").split("@")[0] === WORKFLOW && run.name === WORKFLOW_NAME && run.status === "completed" && run.conclusion === "success" && run.event === "workflow_dispatch" && run.head_branch === "main" && run.head_sha === contract.source_commit, "reviewed source run contract mismatch");
  const metadata = await githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${contract.source_artifact_id}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(metadata.id) === String(contract.source_artifact_id) && String(metadata.workflow_run?.id) === String(contract.source_run_id) && metadata.name === contract.source_artifact_name && metadata.expired === false, "reviewed source artifact metadata mismatch or expiry");
  invariant(Number(metadata.size_in_bytes) > 0 && Number(metadata.size_in_bytes) <= MAX_ZIP_BYTES, "reviewed source artifact size is invalid");
  const response = await fetchImpl(`${api}/repos/${REPOSITORY}/actions/artifacts/${contract.source_artifact_id}/zip`, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GITHUB_TOKEN}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Reviewed-Artifact/1.0" }, redirect: "follow" });
  invariant(response.ok, `reviewed artifact download failed with HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  invariant(archive.length > 0 && archive.length <= MAX_ZIP_BYTES && sha256(archive) === contract.zip_sha256, "reviewed artifact ZIP SHA-256 mismatch");
  fs.mkdirSync(out, { recursive: true });
  const zipPath = path.join(out, "source-artifact.zip");
  const directory = path.join(out, "source-artifact");
  fs.writeFileSync(zipPath, archive, { flag: "wx" });
  extractZip(zipPath, directory, spawn);
  const verified = verifyLoadedArtifact(directory, contract, now);
  invariant(env.OWNER_CONFIRMATION === ownerConfirmation(contract, verified.entry), "owner confirmation does not bind the exact reviewed artifact and deltas");
  const evidence = { schema_version: 1, kind: "reviewed-artifact-verification", result: "PASS", contract, target: targetBinding(verified.entry), owner_confirmation_hash: env.OWNER_CONFIRMATION.slice(-64), artifact_run_id: verified.loaded.artifact.run_id, database_writes: 0 };
  write(path.join(out, "verification.json"), evidence);
  return evidence;
}

async function capture(client, entry) {
  const plan = entry.resolved_plan;
  const productId = String(plan.product.id), mappingId = String(plan.retailer_product.id), offerId = String(plan.offer.id);
  const [counts, product, variants, mapping, offer, history] = await Promise.all([
    client.query("select (select count(*) from public.products)::text products,(select count(*) from public.product_variants)::text product_variants,(select count(*) from public.retailer_products)::text retailer_products,(select count(*) from public.offers)::text offers,(select count(*) from public.price_history)::text price_history"),
    client.query("select * from public.products where id=$1::bigint", [productId]),
    client.query("select * from public.product_variants where product_id=$1::bigint order by id", [productId]),
    client.query("select * from public.retailer_products where id=$1::bigint", [mappingId]),
    client.query("select * from public.offers where id=$1::bigint", [offerId]),
    client.query("select * from public.price_history where offer_id=$1::bigint order by id", [offerId]),
  ]);
  invariant(product.rows.length === 1 && mapping.rows.length === 1 && offer.rows.length === 1, "reviewed DB scope is incomplete");
  const snapshot = { counts: counts.rows[0], product: product.rows[0], variants: variants.rows, mapping: mapping.rows[0], offer: offer.rows[0], price_history: history.rows };
  return { ...snapshot, snapshot_hash: evidenceHash(snapshot) };
}

async function validatorCapture(artifactDirectory, env = process.env, ClientClass = Client, options = {}) {
  const contract = contractFromEnv(env);
  const verified = verifyLoadedArtifact(artifactDirectory, contract, new Date(), options);
  const session = await withPostgresRoleSession({
    connectionString: normalizeConnectionString(env.REVIEWED_VALIDATOR_DATABASE_URL, "validator"), applicationName: "reviewed-artifact-validator",
    ClientClass, defaultReadOnly: true, readOnly: true, role: "retailer_catalogue_production_validator",
    expectedSessionUser: "supplementscout_production_validator_login", kind: "validator",
  }, (client) => capture(client, verified.entry));
  return { verified, snapshot: session.result };
}

async function baseline(options = {}) {
  const out = options.out || OUT, env = options.env || process.env;
  const result = await validatorCapture(path.join(out, "source-artifact"), env, options.Client || Client);
  const evidence = { schema_version: 1, kind: "reviewed-artifact-db-baseline", result: "PASS", contract: contractFromEnv(env), target: targetBinding(result.verified.entry), snapshot: result.snapshot, database_writes: 0 };
  evidence.evidence_hash = evidenceHash(evidence);
  write(path.join(out, "baseline.json"), evidence);
  return evidence;
}

function loadEvidence(out = OUT, env = process.env) {
  const contract = contractFromEnv(env);
  const verified = verifyLoadedArtifact(path.join(out, "source-artifact"), contract);
  invariant(env.OWNER_CONFIRMATION === ownerConfirmation(contract, verified.entry), "owner confirmation mismatch");
  return { contract, verified };
}

async function roleRpc(kind, envName, callback, dependencies = {}) {
  const env = dependencies.env || process.env;
  const session = await withPostgresRoleSession({
    connectionString: normalizeConnectionString(env[envName], kind), applicationName: `reviewed-artifact-${kind}`,
    ClientClass: dependencies.Client || Client, role: `retailer_catalogue_production_${kind}`,
    expectedSessionUser: `supplementscout_production_${kind}_login`, kind,
    localSettings: { "app.retailer_catalogue_production_marker": "1", "app.retailer_catalogue_allow": "1" },
  }, callback);
  return session.result;
}

async function approve(options = {}) {
  const out = options.out || OUT, env = options.env || process.env;
  const { contract, verified } = loadEvidence(out, env);
  const validation = read(path.join(out, "verification.json"));
  const dbBaseline = read(path.join(out, "baseline.json"));
  invariant(validation.result === "PASS" && validation.database_writes === 0 && canonicalJson(validation.contract) === canonicalJson(contract), "artifact validation evidence mismatch");
  invariant(dbBaseline.result === "PASS" && dbBaseline.database_writes === 0 && dbBaseline.evidence_hash === evidenceHash(Object.fromEntries(Object.entries(dbBaseline).filter(([key]) => key !== "evidence_hash"))) && canonicalJson(dbBaseline.contract) === canonicalJson(contract), "DB baseline evidence mismatch");
  const entry = verified.entry;
  const approval = await roleRpc("approver", "REVIEWED_APPROVER_DATABASE_URL", async (client) => {
    const result = await client.query("select public.approve_product_import_plan($1::jsonb,$2,$3,$4,$5::timestamptz) result", [entry.resolved_plan, contract.artifact_sha256, verified.loaded.artifact.run_id, env.OWNER_CONFIRMATION, entry.resolved_plan.meta.expires_at]);
    return result.rows[0].result;
  }, options);
  invariant(approval.status === "approved" && approval.artifact_sha256 === contract.artifact_sha256 && approval.plan_fingerprint === contract.plan_fingerprint && approval.source_row_fingerprint === entry.source_row_fingerprint && approval.run_id === verified.loaded.artifact.run_id, "approval RPC metadata mismatch");
  const evidence = { schema_version: 1, kind: "reviewed-artifact-approval", result: "PASS", approval_id: approval.approval_id, contract, artifact_run_id: verified.loaded.artifact.run_id, approval_rpc_count: 1, apply_rpc_count: 0 };
  write(path.join(out, "approval.json"), evidence);
  return evidence;
}

async function execute(options = {}) {
  const out = options.out || OUT, env = options.env || process.env;
  const { contract, verified } = loadEvidence(out, env);
  const approval = read(path.join(out, "approval.json"));
  invariant(approval.result === "PASS" && canonicalJson(approval.contract) === canonicalJson(contract) && approval.artifact_run_id === verified.loaded.artifact.run_id, "approval evidence mismatch");
  const entry = verified.entry;
  const applied = await roleRpc("executor", "REVIEWED_EXECUTOR_DATABASE_URL", async (client) => {
    const result = await client.query("select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result", [approval.approval_id, contract.artifact_sha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, verified.loaded.artifact.run_id]);
    return result.rows[0].result;
  }, options);
  invariant(applied.approval_status === "consumed" && applied.already_applied === false && applied.plan_fingerprint === entry.plan_fingerprint && applied.source_row_fingerprint === entry.source_row_fingerprint && String(applied.offer_id) === String(entry.resolved_plan.offer.id), "atomic apply RPC metadata mismatch");
  const evidence = { schema_version: 1, kind: "reviewed-artifact-execution", result: "PASS", contract, artifact_run_id: verified.loaded.artifact.run_id, approval_id: approval.approval_id, approval_rpc_count: 1, apply_rpc_count: 1, execution: applied };
  write(path.join(out, "execution.json"), evidence);
  return evidence;
}

function verifyPostflight(baselineEvidence, after, entry, execution) {
  invariant(baselineEvidence.result === "PASS" && baselineEvidence.evidence_hash === evidenceHash(Object.fromEntries(Object.entries(baselineEvidence).filter(([key]) => key !== "evidence_hash"))), "baseline evidence integrity mismatch");
  invariant(execution.result === "PASS" && execution.apply_rpc_count === 1, "execution evidence mismatch");
  const before = baselineEvidence.snapshot, plan = entry.resolved_plan, deltas = plan.expected_deltas.row_count_deltas;
  for (const table of Object.keys(deltas)) invariant(BigInt(after.counts[table]) - BigInt(before.counts[table]) === BigInt(deltas[table]), `${table} row-count delta mismatch`);
  invariant(comparableDbJson(after.product) === comparableDbJson(before.product), "parent product changed");
  invariant(after.variants.length === before.variants.length + 1, "variant delta mismatch");
  for (const existing of before.variants) invariant(comparableDbJson(after.variants.find((row) => String(row.id) === String(existing.id))) === comparableDbJson(existing), `existing variant ${existing.id} changed`);
  const newVariantId = String(execution.execution.product_variant_id);
  const newVariant = after.variants.find((row) => String(row.id) === newVariantId);
  invariant(newVariant && String(newVariant.product_id) === String(plan.product.id) && newVariant.variant_key === plan.product_variant.values.variant_key && newVariant.display_name === plan.product_variant.values.display_name && newVariant.flavour_code === plan.product_variant.values.flavour_code && newVariant.flavour_label === plan.product_variant.values.flavour_label && String(newVariant.size_value) === String(plan.product_variant.values.size_value) && newVariant.size_unit === plan.product_variant.values.size_unit && String(newVariant.pack_count) === String(plan.product_variant.values.pack_count) && newVariant.product_format === plan.product_variant.values.product_format && newVariant.gtin == null && canonicalJson(newVariant.nutrition_override || {}) === "{}" && newVariant.is_active === true && newVariant.is_default === false, "approved target variant mismatch");
  invariant(String(after.mapping.product_variant_id) === newVariantId && String(after.offer.product_variant_id) === newVariantId, "mapping or offer was not rebound atomically");
  invariant(normalizeDecimalString(after.mapping.match_confidence, "mapping match_confidence") === normalizeDecimalString(plan.retailer_product.values.match_confidence, "approved mapping match_confidence"), "mapping match confidence mismatch");
  const expectedMapping = { ...before.mapping, ...plan.retailer_product.values, product_variant_id: newVariantId, match_confidence: after.mapping.match_confidence, updated_at: after.mapping.updated_at };
  invariant(comparableDbJson(after.mapping) === comparableDbJson(expectedMapping), "mapping target state contains an unapproved change");
  invariant(exactDecimal(after.offer.price) === plan.offer.values.price && exactDecimal(after.offer.shipping_cost) === plan.offer.values.shipping_cost && exactDecimal(after.offer.total_price) === plan.offer.values.total_price && after.offer.in_stock === plan.offer.values.in_stock && after.offer.url === plan.offer.values.url, "offer target state mismatch");
  invariant(new Date(after.offer.last_checked_at).toISOString() === new Date(plan.offer.values.last_checked_at).toISOString(), "offer freshness target mismatch");
  const expectedOffer = { ...before.offer, ...plan.offer.values, product_variant_id: newVariantId, price: after.offer.price, shipping_cost: after.offer.shipping_cost, total_price: after.offer.total_price };
  invariant(comparableDbJson(after.offer) === comparableDbJson(expectedOffer), "offer target state contains an unapproved change");
  for (const existing of before.price_history) invariant(comparableDbJson(after.price_history.find((row) => String(row.id) === String(existing.id))) === comparableDbJson(existing), `existing price history ${existing.id} changed`);
  const newHistory = after.price_history.find((row) => String(row.id) === String(execution.execution.price_history_id));
  invariant(after.price_history.length === before.price_history.length + 1 && newHistory && String(newHistory.offer_id) === String(plan.offer.id) && exactDecimal(newHistory.price) === plan.offer.values.price && exactDecimal(newHistory.shipping_cost) === plan.offer.values.shipping_cost && exactDecimal(newHistory.total_price) === plan.offer.values.total_price && new Date(newHistory.checked_at).toISOString() === new Date(plan.offer.values.last_checked_at).toISOString(), "price history delta mismatch");
  return { result: "PASS", exact_deltas: plan.expected_deltas, baseline_hash: baselineEvidence.evidence_hash, after_hash: after.snapshot_hash, idempotency: { result: "PASS", key: plan.meta.idempotency_key, proof: "consumed approval plus exact target state; no second apply RPC invoked" } };
}

async function postflight(options = {}) {
  const out = options.out || OUT, env = options.env || process.env;
  const baselineEvidence = read(path.join(out, "baseline.json"));
  const execution = read(path.join(out, "execution.json"));
  const result = await validatorCapture(path.join(out, "source-artifact"), env, options.Client || Client, { requireFresh: false });
  const verified = verifyPostflight(baselineEvidence, result.snapshot, result.verified.entry, execution);
  const evidence = { schema_version: 1, kind: "reviewed-artifact-db-postflight", ...verified, contract: contractFromEnv(env), snapshot: result.snapshot, database_writes: 0, approval_rpc_count: 1, apply_rpc_count: 1 };
  evidence.evidence_hash = evidenceHash(evidence);
  write(path.join(out, "postflight.json"), evidence);
  return evidence;
}

function parseArgs(argv) {
  const value = argv.find((arg) => arg.startsWith("--mode="));
  const mode = value?.slice(7);
  invariant(["download", "baseline", "approve", "execute", "postflight"].includes(mode) && argv.length === 1, "exactly one valid --mode is required");
  return { mode };
}

async function main(argv = process.argv.slice(2)) {
  const { mode } = parseArgs(argv);
  const operations = { download: downloadAndVerify, baseline, approve, execute, postflight };
  return operations[mode]();
}

if (require.main === module) main().then((value) => console.log(JSON.stringify(value))).catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

module.exports = { approve, baseline, capture, contractFromEnv, downloadAndVerify, evidenceHash, execute, extractZip, githubJson, main, ownerConfirmation, parseArgs, postflight, targetBinding, verifyLoadedArtifact, verifyPostflight };
