const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "discount-supplements-reviewed-stock-changes-v1";
const AUTHORITY = "owner-approved-chat-2026-08-11-all-12-discount-stock-changes";
const ROW_KEYS = ["after_in_stock","before_in_stock","external_product_id","external_variant_id","mapping_id","offer_id","plan_fingerprint","price","product_id","product_variant_id","shipping_cost","total_price","url"].sort();

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|manifest|output)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (!new Set(["validate", "apply"]).has(options.mode)) fail("Required --mode=validate|apply");
  for (const key of ["manifest", "output"]) {
    if (!options[key]) fail(`Required --${key}=<path>`);
    options[key] = path.resolve(options[key]);
  }
  const relative = path.relative(path.join(ROOT, "tmp"), options.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return options;
}

function readHashedJson(filePath) {
  const sidecar = `${filePath}.sha256`;
  if (!fs.existsSync(filePath) || !fs.existsSync(sidecar)) fail(`Missing immutable package ${filePath}`);
  const bytes = fs.readFileSync(filePath);
  const expected = fs.readFileSync(sidecar, "utf8").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected) || sha256(bytes) !== expected) fail(`SHA-256 mismatch for ${filePath}`);
  return { value: JSON.parse(bytes.toString("utf8")), sha256: expected };
}

function validatePackage(manifestPath) {
  const loadedManifest = readHashedJson(manifestPath);
  const manifest = loadedManifest.value;
  if (manifest.schema_version !== 1 || manifest.kind !== KIND || manifest.target_environment !== "PRODUCTION" || manifest.target_project_ref !== PROJECT_REF || manifest.retailer_id !== "4" || manifest.retailer_slug !== "discount-supplements" || manifest.authority !== AUTHORITY || manifest.row_count !== 12 || manifest.new_oos_count !== 11 || manifest.restock_count !== 1 || !Array.isArray(manifest.rows) || manifest.rows.length !== 12) fail("Reviewed manifest contract mismatch");
  const artifactPath = path.resolve(ROOT, manifest.artifact);
  const rolloutRoot = path.dirname(manifestPath);
  if (path.dirname(artifactPath) !== rolloutRoot) fail("Artifact must remain beside the reviewed manifest");
  const loadedArtifact = loadDryRunArtifact(artifactPath);
  if (loadedArtifact.artifactSha256 !== manifest.artifact_sha256 || loadedArtifact.artifact.run_id !== manifest.artifact_run_id || loadedArtifact.artifact.blocked_rows.length !== 0) fail("Reviewed artifact identity mismatch");
  const artifactByOffer = new Map(loadedArtifact.artifact.plans.map((entry) => [String(entry.resolved_plan?.expected_state?.offer?.id), entry]));
  const seen = { offer: new Set(), mapping: new Set(), fingerprint: new Set() };
  const selected = [];
  for (const row of manifest.rows) {
    if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(ROW_KEYS)) fail("Reviewed row keys mismatch");
    for (const [label, value] of [["offer", row.offer_id], ["mapping", row.mapping_id], ["fingerprint", row.plan_fingerprint]]) {
      if (seen[label].has(value)) fail(`Duplicate reviewed ${label}`);
      seen[label].add(value);
    }
    const entry = artifactByOffer.get(row.offer_id);
    const plan = entry?.resolved_plan;
    const before = plan?.expected_state?.offer;
    const after = plan?.offer?.values;
    const mapping = plan?.expected_state?.retailer_product;
    if (!entry || entry.plan_fingerprint !== row.plan_fingerprint || String(entry.retailer_id) !== "4" || plan.product?.action !== "existing" || String(plan.product.id) !== row.product_id || plan.product_variant?.action !== "existing" || String(plan.product_variant.id) !== row.product_variant_id || plan.retailer?.action !== "existing" || String(plan.retailer.id) !== "4" || plan.retailer_product?.action !== "noop" || String(mapping.id) !== row.mapping_id || String(mapping.external_product_id) !== row.external_product_id || String(mapping.external_variant_id) !== row.external_variant_id || plan.offer?.action !== "update" || plan.price_history?.action !== "noop" || plan.approval?.approved !== false) fail(`Plan scope mismatch for offer ${row.offer_id}`);
    if (before.in_stock !== row.before_in_stock || after.in_stock !== row.after_in_stock || before.in_stock === after.in_stock || String(before.price) !== row.price || String(after.price) !== row.price || String(before.shipping_cost) !== row.shipping_cost || String(after.shipping_cost) !== row.shipping_cost || String(before.total_price) !== row.total_price || String(after.total_price) !== row.total_price || before.url !== row.url || after.url !== row.url || JSON.stringify(Object.keys(after).sort()) !== JSON.stringify(["in_stock","last_checked_at","price","shipping_cost","total_price","url"].sort())) fail(`Commercial delta mismatch for offer ${row.offer_id}`);
    selected.push({ row, entry });
  }
  if (selected.filter(({ row }) => row.before_in_stock && !row.after_in_stock).length !== 11 || selected.filter(({ row }) => !row.before_in_stock && row.after_in_stock).length !== 1) fail("Stock direction count mismatch");
  return { manifest, manifestSha256: loadedManifest.sha256, loadedArtifact, selected };
}

function credential(kind) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must not be present during protected execution");
  const value = process.env[`DISCOUNT_STOCK_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing DISCOUNT_STOCK_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleTransaction(kind, callback, commit) {
  const client = new Client({ connectionString: credential(kind), ssl: { rejectUnauthorized: false }, application_name: `discount-stock-${kind}`, options: "-c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
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

async function validatePlans(pkg) {
  return roleTransaction("approver", async (client) => {
    for (const { entry } of pkg.selected) {
      const response = await client.query("select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", [entry.resolved_plan, pkg.loadedArtifact.artifactSha256, pkg.loadedArtifact.artifact.run_id, `${KIND}-rollback-preflight`]);
      const approval = response.rows[0].result;
      if (approval?.status !== "approved" || approval.artifact_sha256 !== pkg.loadedArtifact.artifactSha256 || approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint) fail("Rollback preflight metadata mismatch");
    }
    return pkg.selected.length;
  }, false);
}

async function applyPlans(pkg) {
  const approvals = await roleTransaction("approver", async (client) => {
    const rows = [];
    for (const { entry } of pkg.selected) {
      const response = await client.query("select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", [entry.resolved_plan, pkg.loadedArtifact.artifactSha256, pkg.loadedArtifact.artifact.run_id, KIND]);
      const approval = response.rows[0].result;
      if (approval?.status !== "approved" || approval.artifact_sha256 !== pkg.loadedArtifact.artifactSha256 || approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint) fail("Approval metadata mismatch");
      rows.push({ approval, entry });
    }
    return rows;
  }, true);
  return roleTransaction("executor", async (client) => {
    const rows = [];
    for (const { approval, entry } of approvals) {
      const response = await client.query("select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result", [approval.approval_id, pkg.loadedArtifact.artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, pkg.loadedArtifact.artifact.run_id]);
      const applied = response.rows[0].result;
      if (applied?.approval_status !== "consumed" || applied.plan_fingerprint !== entry.plan_fingerprint) fail("Apply metadata mismatch");
      rows.push({ offer_id: String(applied.offer_id), retailer_product_id: String(applied.retailer_product_id), consumed_at: applied.consumed_at });
    }
    return rows;
  }, true);
}

async function run(options) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch") fail("Reviewed stock execution is restricted to manual GitHub Actions on main");
  const pkg = validatePackage(options.manifest);
  const validated = await validatePlans(pkg);
  const rows = options.mode === "apply" ? await applyPlans(pkg) : [];
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, result: "PASS", manifest_sha256: pkg.manifestSha256, artifact_sha256: pkg.loadedArtifact.artifactSha256, validated_plan_count: validated, executed_plan_count: rows.length, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { parseArgs, validatePackage };
