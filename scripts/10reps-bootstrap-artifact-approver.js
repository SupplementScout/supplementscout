const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const { parse } = require("csv-parse/sync");
const { canonicalJson, normalizeNumbersToDecimalStrings } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const PROFILE = Object.freeze({
  id: "bootstrap",
  manifest: path.join(ROOT, "config/retailers/10reps-reviewed-bindings-v1.json"),
  manifestSha256: "dc0bc67840bb7f74e555ab2b60a42dc13b46fc8522ae3549a6a3888d7c5c3283",
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-dry-run.json"),
  artifactSha256: "68bff98ddabff332a71fcf968214a09a0fe94d473c2dae110d473a725cc33785",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1.csv"),
  csvSha256: "0ecba1a6528c4e4397ab48256355fee7d8e7a2f40d6a6ac0276df8b42762da36",
  fingerprint: "b8ee7742e878f30d4343044332471a7a",
  allowedFingerprints: Object.freeze(["b8ee7742e878f30d4343044332471a7a"]),
  reviewedStart: 0,
  rowCount: 20,
  retailerAction: "create",
  retailerId: null,
  approvalSource: "10reps-reviewed-bootstrap-row-1",
  applicationName: "10reps-bootstrap-artifact-approver",
  role: "retailer_catalogue_production_approver",
  login: "supplementscout_production_approver_login",
  project: "aftboxmrdgyhizicfsfu",
});
const REMAINING_BINDINGS = Object.freeze([
  [2, "8481", 882, 1406, "0146b444423932cdac03d5175a354fc8"],
  [3, "8489", 882, 1397, "20fe6c3d91a4dbe20d05503e64da3cb1"],
  [4, "8638", 837, 1237, "614b7db0399ef3067433487919940e7e"],
  [5, "8640", 837, 1238, "1d54539de90dfada5b07f4069a2a8bdf"],
  [6, "8641", 837, 2766, "ff56bab1f919e5efbe9ccc5253e0d210"],
  [7, "8642", 837, 1239, "bdb4d7765cfaa33b7ee6fe71b69250f5"],
  [8, "8643", 837, 1240, "e4986c4ea18c53819675a8373da94b20"],
  [9, "8956", 743, 1995, "3825a5a5a16592d1155b140dc92a7e17"],
  [10, "8957", 743, 802, "da442a972125575e528e722e56e71fac"],
  [11, "8962", 743, 807, "acda44bc8b89d033135559af28b87e48"],
  [12, "8963", 743, 808, "1a497a00f2a403a9172e68f8536477de"],
  [13, "8965", 743, 1993, "4c423dc00d88292e427ab82db026798d"],
  [14, "8966", 743, 811, "215fa3a6b7bd531b147259c4f7153247"],
  [15, "9571", 338, 1785, "ecb00823abe6bd34d2a2bbc059d05e81"],
  [16, "9572", 338, 1020, "74cb1a3e7b81e257337994ccb05b27e7"],
  [17, "9574", 338, 1782, "6a9ba9f5ecc9c24db1dbbc7914b71a4e"],
  [18, "9575", 338, 1783, "fcbb902723f5efc0dd3e5c720b44b2b5"],
  [19, "9576", 338, 1784, "39313813786ddafe3fb59d8355633c32"],
  [20, "9577", 338, 1786, "4279a29e399f0a1a39ae1b0c439e171e"],
].map(([reviewRow, externalVariantId, productId, productVariantId, fingerprint]) => Object.freeze({ reviewRow, externalVariantId, productId, productVariantId, fingerprint })));
const REMAINING_PROFILE = Object.freeze({
  id: "remaining-19",
  manifest: PROFILE.manifest,
  manifestSha256: PROFILE.manifestSha256,
  artifact: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-remaining-19-dry-run.json"),
  artifactSha256: "a1f5ca5aacb093d55ad909b4528e9ab0d6e88dbd5eb144c4cd2406d107abbb3e",
  csv: path.join(ROOT, "tmp/retailer-feeds/10reps/10reps-reviewed-bindings-v1-remaining-19.csv"),
  csvSha256: "7b95c17d343f086aebd5d9f9b6f9f5485386e51140be6c87dcd8bd7cca2d94db",
  fingerprint: REMAINING_BINDINGS[0].fingerprint,
  allowedFingerprints: Object.freeze(REMAINING_BINDINGS.map(binding => binding.fingerprint)),
  bindings: REMAINING_BINDINGS,
  reviewedStart: 1,
  rowCount: 19,
  retailerAction: "existing",
  retailerId: "14",
  approvalSource: "10reps-reviewed-remaining-19",
  applicationName: "10reps-remaining-19-artifact-approver",
  role: PROFILE.role,
  login: PROFILE.login,
  project: PROFILE.project,
});
const PROFILES = Object.freeze([PROFILE, REMAINING_PROFILE]);
const CREDENTIAL_PATH = path.join(process.env.USERPROFILE || "", ".supplementscout/credentials/production-approver.env");
const APPROVAL_SQL = "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result";
function requireCondition(value, message) { if (!value) throw new Error(message); }
function same(actual, expected, label) {
  requireCondition(canonicalJson(actual) === canonicalJson(expected), `Invalid ${label}`);
}
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function checkDigest(bytes, expected, label) { same(sha256(bytes), expected, `${label} SHA`); }
function sourceFingerprint(row) { return sha256(canonicalJson(normalizeNumbersToDecimalStrings(row))); }
function planFingerprint(plan) {
  return crypto.createHash("md5").update(canonicalJson(normalizeNumbersToDecimalStrings({
    ...plan, meta: { ...plan.meta, plan_fingerprint: null },
  }))).digest("hex");
}
function checkOptions(options) {
  same(Object.keys(options).sort(), ["artifact", "csv", "planFingerprint"], "argument set");
  const profile = PROFILES.find(candidate => path.resolve(options.artifact) === candidate.artifact && path.resolve(options.csv) === candidate.csv);
  requireCondition(profile, "Invalid closed profile artifact/CSV paths");
  requireCondition(profile.allowedFingerprints.includes(options.planFingerprint), `Invalid ${profile.id} fingerprint`);
  return profile;
}
function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = arg.match(/^--(artifact|csv|plan-fingerprint)=(.+)$/);
    requireCondition(match, "Only artifact, csv and plan-fingerprint arguments are accepted");
    const key = match[1] === "plan-fingerprint" ? "planFingerprint" : match[1];
    requireCondition(!Object.hasOwn(options, key), "Duplicate argument");
    options[key] = match[2];
  }
  checkOptions(options);
  return options;
}
function reviewedPlanFingerprint(profile, reviewed) {
  if (profile === PROFILE) return reviewed.plan_fingerprint;
  const binding = profile.bindings.find(candidate => candidate.reviewRow === reviewed.review_row);
  requireCondition(binding, `Missing ${profile.id} reviewed binding`);
  same(binding.externalVariantId, reviewed.external_variant_id, "profile external variant");
  same(binding.productId, reviewed.product_id, "profile product");
  same(binding.productVariantId, reviewed.product_variant_id, "profile variant");
  return binding.fingerprint;
}
function validatePlan(entry, reviewed, source, profile = PROFILE) {
  const plan = entry.resolved_plan;
  same(plan.product, { action: "existing", id: String(reviewed.product_id) }, "existing product");
  same(plan.product_variant.action, "existing", "existing variant action");
  same(plan.product_variant.id, String(reviewed.product_variant_id), "existing variant ID");
  same(plan.expected_state.product.id, String(reviewed.product_id), "product before-state");
  same(plan.expected_state.product.name, reviewed.canonical_product, "canonical name");
  same(plan.expected_state.product.is_active, true, "active product");
  same(plan.expected_state.product.merged_into_product_id, null, "unmerged product");
  const variant = plan.expected_state.product_variant;
  for (const [key, value] of Object.entries({ id: String(reviewed.product_variant_id), product_id: String(reviewed.product_id), size_value: String(reviewed.size), size_unit: reviewed.size_unit, flavour_label: reviewed.canonical_flavour, product_format: reviewed.product_format, pack_count: String(reviewed.pack_count), is_active: true, is_default: false })) same(variant[key], value, `variant ${key}`);
  if (profile.retailerAction === "create") {
    same(plan.retailer, { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } }, "retailer creation");
    same(plan.expected_state.retailer, null, "retailer absent before-state");
  } else {
    same(plan.retailer, { action: "existing", id: profile.retailerId }, "existing retailer");
    same(plan.expected_state.retailer, { id: profile.retailerId, name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" }, "retailer before-state");
  }
  for (const key of ["retailer_product", "offer"]) same(plan.expected_state[key], null, `${key} absent before-state`);
  same(plan.retailer_product.action, "create", "mapping action");
  const mapping = plan.retailer_product.values;
  for (const [key, value] of Object.entries({ external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_variant_id: String(reviewed.product_variant_id), external_sku: reviewed.external_sku, external_gtin: reviewed.external_gtin, external_url: reviewed.source_url, external_name: reviewed.external_name })) same(mapping[key], value, `mapping ${key}`);
  same(mapping.external_options, { Flavour: reviewed.flavour, Size: reviewed.source_size }, "source options");
  same(plan.offer.action, "create", "offer action");
  same(plan.offer.values.price, reviewed.price.toFixed(2), "effective price");
  same(plan.offer.values.shipping_cost, "3.99", "shipping");
  same(plan.offer.values.total_price, ((Math.round(reviewed.price * 100) + 399) / 100).toFixed(2), "delivered price");
  same(plan.offer.values.url, reviewed.source_url, "offer URL");
  same(plan.offer.values.in_stock, true, "in-stock offer");
  same(plan.price_history, { action: "create" }, "initial history");
  same(plan.approval, { approved: false, approval_type: "none" }, "unapproved plan");
  for (const [key, value] of Object.entries({ product_id: String(reviewed.product_id), product_variant_id: String(reviewed.product_variant_id), external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id, product_name: reviewed.external_name, brand: reviewed.brand, category: reviewed.category, flavour: reviewed.flavour, size: `${reviewed.size} ${reviewed.size_unit}`, size_unit: reviewed.size_unit, image: reviewed.image_url, external_url: reviewed.source_url, affiliate_url: reviewed.source_url, external_sku: reviewed.external_sku || "", external_gtin: reviewed.external_gtin || "", shipping_known: "true", shipping_cost: "3.99", price: reviewed.price.toFixed(2), in_stock: "true", is_for_sale: "true" })) same(source[key], value, `source ${key}`);
  // The immutable package supplies the complete schema; these checks also keep
  // identity and commercial guards independently testable without private files.
  same(entry.operation_type, "standard_import", "operation");
  same(entry.plan_kind, "feed", "plan kind");
  same(entry.retailer_id, profile.retailerId, `${profile.id} retailer ID`);
  same(plan.meta.operation_type, entry.operation_type, "operation metadata");
  same(plan.meta.plan_kind, entry.plan_kind, "kind metadata");
  same(entry.source_row_fingerprint, sourceFingerprint(source), "source fingerprint");
  same(plan.meta.source_row_fingerprint, entry.source_row_fingerprint, "source metadata");
  same(entry.plan_fingerprint, planFingerprint(plan), "plan integrity");
  same(plan.meta.plan_fingerprint, entry.plan_fingerprint, "plan metadata");
  same(entry.plan_fingerprint, reviewedPlanFingerprint(profile, reviewed), "reviewed plan fingerprint");
}
function validatePackage(manifest, artifact, csvRows, profile = PROFILE, selectedFingerprint = profile.fingerprint) {
  same(manifest.kind, "10reps-reviewed-existing-bindings-v1", "manifest kind");
  same(manifest.row_count, 20, "manifest row count");
  same(manifest.rows.length, 20, "reviewed rows");
  same(manifest.held_rows, [], "held rows");
  for (const flag of ["existing_products_only", "existing_variants_only", "sku_is_not_gtin"]) same(manifest.policy[flag], true, flag);
  for (const flag of ["allow_product_creation", "allow_variant_creation", "allow_canonical_gtin_updates", "allow_category_changes", "allow_live_import"]) same(manifest.policy[flag], false, flag);
  same(manifest.production_approval.approved, false, "production approval state");
  same(manifest.retailer.shipping_known, true, "known shipping");
  same(manifest.retailer.shipping_cost, 3.99, "manifest shipping");
  same(artifact.artifact_version, "1", "artifact version");
  same(artifact.row_count, String(profile.rowCount), "artifact row count");
  same(artifact.plans.length, profile.rowCount, "plan count");
  same(artifact.source_rows.length, profile.rowCount, "source count");
  same(csvRows.length, profile.rowCount, "CSV row count");
  same(artifact.blocked_rows, [], "blocked rows");
  same(artifact.summary, { blocked_row_count: "0", plan_count: String(profile.rowCount), skipped_row_count: "0" }, "artifact summary");
  same(artifact.source_file_sha256, profile.csvSha256, "artifact CSV digest");
  const reviewedRows = manifest.rows.slice(profile.reviewedStart, profile.reviewedStart + profile.rowCount);
  same(reviewedRows.length, profile.rowCount, "reviewed scope");
  same(new Set(reviewedRows.map(r => r.product_variant_id)).size, profile.rowCount, "unique target variants");
  same(new Set(artifact.plans.map(e => e.row_number)).size, profile.rowCount, "unique plan rows");
  same(new Set(artifact.source_rows.map(e => e.row_number)).size, profile.rowCount, "unique source rows");
  same(new Set(artifact.plans.map(e => e.plan_fingerprint)).size, profile.rowCount, "unique fingerprints");
  for (let index = 0; index < profile.rowCount; index++) {
    const reviewed = reviewedRows[index];
    same(reviewed.review_row, index + profile.reviewedStart + 1, "review order");
    const entry = artifact.plans.find(e => e.row_number === String(index + 2));
    const source = artifact.source_rows.find(e => e.row_number === String(index + 2));
    requireCondition(entry && source, "Missing reviewed plan/source row");
    same(source.status, "planned", "source disposition");
    same(source.source_row_fingerprint, entry.source_row_fingerprint, "source binding");
    same(source.plan_fingerprint, entry.plan_fingerprint, "source plan binding");
    const normalized = { ...csvRows[index], variant: csvRows[index].variant_name, size: `${csvRows[index].size} ${csvRows[index].size_unit}` };
    same(normalized, source.normalized_source_row, "CSV to artifact source");
    validatePlan(entry, reviewed, source.normalized_source_row, profile);
  }
  requireCondition(profile.allowedFingerprints.includes(selectedFingerprint), `Invalid ${profile.id} selected fingerprint`);
  const entry = artifact.plans.find(candidate => candidate.plan_fingerprint === selectedFingerprint);
  requireCondition(entry, `Missing closed ${profile.id} plan`);
  if (profile === PROFILE) {
    same(entry.row_number, "2", "bootstrap row");
    same(entry.resolved_plan.product.id, "788", "bootstrap product");
    same(entry.resolved_plan.product_variant.id, "1080", "bootstrap variant");
    same(entry.resolved_plan.retailer_product.values.external_variant_id, "10003", "bootstrap source");
  } else {
    same([...new Set(artifact.plans.map(candidate => candidate.plan_fingerprint))].sort(), [...profile.allowedFingerprints].sort(), "remaining fingerprints");
    requireCondition(!artifact.plans.some(candidate => candidate.plan_fingerprint === PROFILE.fingerprint || candidate.resolved_plan.retailer_product.values.external_variant_id === "10003" || candidate.resolved_plan.product.id === "788" && candidate.resolved_plan.product_variant.id === "1080"), "Bootstrap plan is forbidden in remaining profile");
  }
  return { entry, artifact, profile };
}
function prepareApproval(options, readFile = fs.readFileSync) {
  const profile = checkOptions(options);
  const manifestBytes = readFile(profile.manifest);
  // Git may check out the committed JSON with CRLF. Artifact/CSV digests are
  // byte-exact; only the reviewed repository manifest permits Git line endings.
  checkDigest(manifestBytes.toString("utf8").replace(/\r\n/g, "\n"), profile.manifestSha256, "manifest");
  const artifactBytes = readFile(profile.artifact);
  checkDigest(artifactBytes, profile.artifactSha256, "artifact");
  const csvBytes = readFile(profile.csv);
  checkDigest(csvBytes, profile.csvSha256, "CSV");
  return validatePackage(JSON.parse(manifestBytes), JSON.parse(artifactBytes), parse(csvBytes, { columns: true, skip_empty_lines: true }), profile, options.planFingerprint);
}
function parseCredential(text) {
  const entries = text.split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+_DATABASE_URL)=(.*)$/)).filter(Boolean);
  requireCondition(entries.length === 1, "Protected credential must contain exactly one database URL");
  let url;
  try { url = new URL(entries[0][2].trim().replace(/^(['"])(.*)\1$/, "$2")); } catch { throw new Error("Invalid protected credential"); }
  requireCondition(["postgres:", "postgresql:"].includes(url.protocol), "Direct PostgreSQL credential required");
  const login = decodeURIComponent(url.username);
  requireCondition((url.hostname === `db.${PROFILE.project}.supabase.co` && login === PROFILE.login) ||
    (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && login === `${PROFILE.login}.${PROFILE.project}` && url.port === "5432"), "Protected production approver endpoint/login required");
  requireCondition(url.pathname === "/postgres" && !!url.password, "Protected approver database/password required");
  for (const key of [...url.searchParams.keys()]) requireCondition(key === "sslmode", "Unexpected credential option");
  url.searchParams.delete("sslmode");
  return url.href;
}
function verifyApprovalResult(result, prepared, now = Date.now()) {
  requireCondition(result && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.approval_id || ""), "Invalid approval receipt");
  const { entry, profile } = prepared;
  for (const [key, value] of Object.entries({ status: "approved", artifact_sha256: profile.artifactSha256, run_id: prepared.artifact.run_id, plan_fingerprint: entry.plan_fingerprint, source_row_fingerprint: entry.source_row_fingerprint, retailer_id: profile.retailerId, plan_kind: "feed" })) same(result[key], value, `approval receipt ${key}`);
  const expiry = Date.parse(result.expires_at);
  requireCondition(expiry > now && expiry <= now + 16 * 60_000, "Invalid approval expiry");
}
async function approveWithClient(prepared, client) {
  const { entry, profile } = prepared;
  requireCondition(profile.allowedFingerprints.includes(entry.plan_fingerprint), `Invalid ${profile.id} approval fingerprint`);
  same(planFingerprint(entry.resolved_plan), entry.plan_fingerprint, `selected ${profile.id} integrity`);
  let began = false;
  try {
    await client.connect();
    await client.query("begin"); began = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query("SET LOCAL ROLE retailer_catalogue_production_approver");
    const identity = (await client.query("select current_user,session_user")).rows[0];
    same(identity.current_user, PROFILE.role, "approver role");
    same(identity.session_user, PROFILE.login, "approver login");
    const response = await client.query(APPROVAL_SQL, [entry.resolved_plan, profile.artifactSha256, prepared.artifact.run_id, profile.approvalSource]);
    const receipt = response.rows[0]?.result;
    verifyApprovalResult(receipt, prepared);
    await client.query("commit"); began = false;
    return { approval_id: receipt.approval_id, expires_at: receipt.expires_at, plan_fingerprint: entry.plan_fingerprint, product_id: Number(entry.resolved_plan.product.id), product_variant_id: Number(entry.resolved_plan.product_variant.id), external_variant_id: entry.resolved_plan.retailer_product.values.external_variant_id, retailer_id: profile.retailerId === null ? null : Number(profile.retailerId), approval_only: true };
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end().catch(() => {}); }
}
async function runApproval(options) {
  const prepared = prepareApproval(options);
  // No credential read or connection is reachable until the entire package passes.
  const connectionString = parseCredential(fs.readFileSync(CREDENTIAL_PATH, "utf8"));
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, application_name: prepared.profile.applicationName, options: "-c statement_timeout=120000" });
  return approveWithClient(prepared, client);
}
if (require.main === module) {
  Promise.resolve().then(() => runApproval(parseArgs(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => { console.error("10 Reps bootstrap approval failed; credentials and database diagnostics suppressed."); process.exitCode = 1; });
}
module.exports = { PROFILE, REMAINING_PROFILE, CREDENTIAL_PATH, parseArgs, prepareApproval, validatePackage, validatePlan, parseCredential, planFingerprint, sourceFingerprint, checkDigest, verifyApprovalResult, approveWithClient };
