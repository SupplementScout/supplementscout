const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { fingerprint } = require("./lib/nutrition-candidates");
const { isCreatineScopeProduct } = require("./lib/creatine-coverage");
const { loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const PLAN_KIND = "creatine-unit-identity-plan-v1";
const AUDIT_KIND = "creatine-unit-identity-audit-v1";
const PRODUCTION = CONTRACTS.PRODUCTION;
const COUNTED_FORMATS = new Set(["capsule", "tablet", "gummy"]);
const SELECT_FIELDS = [
  "id", "name", "category", "product_format", "unit_count", "unit_type",
  "is_active", "merged_into_product_id",
];

function fail(message) { throw new Error(message); }

function parseProductIds(value) {
  const ids = value.split(",").map((item) => item.trim());
  if (!ids.length || ids.some((id) => !/^[1-9]\d*$/.test(id)) || new Set(ids).size !== ids.length) {
    fail("--product-ids must contain unique positive integer IDs");
  }
  return ids;
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument === "--mode=plan") options.mode = "plan";
    else if (argument === "--mode=apply") options.mode = "apply";
    else if (argument.startsWith("--plan=")) options.plan = argument.slice("--plan=".length);
    else if (argument.startsWith("--product-ids=")) options.productIds = parseProductIds(argument.slice("--product-ids=".length));
    else if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else if (argument === "--confirm-deterministic-creatine-unit-identity=true") options.confirm = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.mode) fail("Required option: --mode=plan|apply");
  if (options.mode === "plan" && (Boolean(options.productIds) === Boolean(options.input) || options.plan || options.confirm)) {
    fail("Plan requires exactly one of --product-ids or --input and does not accept apply options");
  }
  if (options.mode === "apply" && (!options.plan || !options.confirm || options.productIds || options.input)) {
    fail("Apply requires --plan=<tmp plan> and --confirm-deterministic-creatine-unit-identity=true");
  }
  return options;
}

function snapshot(product) {
  return {
    id: String(product.id), name: String(product.name || ""), category: String(product.category || ""),
    product_format: String(product.product_format || "").trim().toLowerCase() || null,
    unit_count: product.unit_count == null ? null : Number(product.unit_count),
    unit_type: String(product.unit_type || "").trim().toLowerCase() || null,
    is_active: product.is_active === true,
    merged_into_product_id: product.merged_into_product_id == null ? null : String(product.merged_into_product_id),
  };
}

function explicitUnitIdentity(name) {
  const match = String(name || "").match(/\b(\d{1,4})\s*(capsules?|caps|tablets?|gumm(?:y|ies))\b/i);
  if (!match) return null;
  const token = match[2].toLowerCase();
  const unitType = token.startsWith("cap") ? "capsule" : token.startsWith("tab") ? "tablet" : "gummy";
  return { unit_count: Number(match[1]), unit_type: unitType };
}

function classifyProduct(product) {
  const value = snapshot(product);
  const reasons = [];
  if (!isCreatineScopeProduct(value)) reasons.push("OUTSIDE_ACTIVE_CREATINE_SCOPE");
  if (!COUNTED_FORMATS.has(value.product_format)) reasons.push("NOT_COUNTED_FORMAT");
  if (value.unit_count !== null || value.unit_type !== null) reasons.push("UNIT_IDENTITY_ALREADY_SET");
  const suggestion = explicitUnitIdentity(value.name);
  if (!suggestion) reasons.push("NO_EXPLICIT_COUNTED_IDENTITY_IN_NAME");
  if (suggestion && suggestion.unit_type !== value.product_format) reasons.push("FORMAT_NAME_CONFLICT");
  return { eligible: reasons.length === 0, reasons, snapshot: value, suggestion };
}

function validateOfficialEvidence(evidence, snapshotValue = null) {
  if (!evidence || !/^[1-9]\d*$/.test(String(evidence.product_id)) ||
      !Number.isInteger(Number(evidence.unit_count)) || Number(evidence.unit_count) <= 0 ||
      !COUNTED_FORMATS.has(String(evidence.unit_type)) || evidence.owner_approved !== true ||
      !["DIRECT", "DERIVED_SERVING_ARITHMETIC"].includes(evidence.evidence_type) ||
      typeof evidence.evidence_snippet !== "string" || evidence.evidence_snippet.trim().length < 12 ||
      !Array.isArray(evidence.official_domains) || !evidence.official_domains.length) fail("Invalid reviewed official unit evidence");
  let url;
  try { url = new URL(evidence.source_url); } catch { fail("Official evidence source URL is invalid"); }
  if (url.protocol !== "https:" || !evidence.official_domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    fail("Official evidence URL is outside official_domains");
  }
  if (snapshotValue && (snapshotValue.product_format !== evidence.unit_type ||
      String(snapshotValue.id) !== String(evidence.product_id) || snapshotValue.unit_count !== null || snapshotValue.unit_type !== null)) {
    fail("Official evidence does not match current product identity");
  }
  return { ...evidence, product_id: String(evidence.product_id), unit_count: Number(evidence.unit_count) };
}

function buildPlan(products, requestedProductIds, generatedAt = new Date().toISOString()) {
  const requested = new Set(requestedProductIds.map(String));
  const selected = products.filter((product) => requested.has(String(product.id)));
  if (selected.length !== requested.size) fail("One or more requested products were not found");
  const classified = selected.map((product) => ({ product, result: classifyProduct(product) }));
  const blocked = classified.filter((entry) => !entry.result.eligible);
  if (blocked.length) fail(`Requested products failed unit identity eligibility: ${blocked.map((entry) => `${entry.product.id}:${entry.result.reasons.join("+")}`).join(",")}`);
  const updates = classified.map((entry) => ({
    product_id: String(entry.product.id), product_name: String(entry.product.name),
    before_snapshot: entry.result.snapshot,
    before_snapshot_fingerprint: fingerprint("CREATINE_UNIT_IDENTITY_BEFORE", entry.result.snapshot),
    changes: {
      unit_count: { before: null, after: entry.result.suggestion.unit_count },
      unit_type: { before: null, after: entry.result.suggestion.unit_type },
    },
    reason: "explicit count and unit token in canonical product name",
  })).sort((left, right) => Number(left.product_id) - Number(right.product_id));
  const core = {
    schema_version: 1, kind: PLAN_KIND, generated_at: new Date(generatedAt).toISOString(),
    status: "READY_FOR_EXPLICIT_APPLY",
    eligibility: {
      active_unmerged_creatine_scope_required: true, counted_format_required: true,
      blank_unit_identity_required: true, explicit_name_evidence_required: true,
      requested_product_ids: [...requested].sort((a, b) => Number(a) - Number(b)),
    },
    product_updates: updates, database_writes: 0,
  };
  return { ...core, plan_fingerprint: fingerprint("CREATINE_UNIT_IDENTITY_PLAN", core) };
}

function buildOfficialPlan(products, evidenceRows, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(evidenceRows) || !evidenceRows.length) fail("Official evidence input is empty");
  const evidence = evidenceRows.map((row) => validateOfficialEvidence(row));
  const ids = evidence.map((row) => row.product_id);
  if (new Set(ids).size !== ids.length) fail("Official evidence product IDs must be unique");
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const updates = evidence.map((row) => {
    const product = byId.get(row.product_id);
    if (!product) fail(`Official evidence product ${row.product_id} was not found`);
    const before = snapshot(product);
    validateOfficialEvidence(row, before);
    if (!isCreatineScopeProduct(before)) fail(`Official evidence product ${row.product_id} is outside active creatine scope`);
    return {
      product_id: row.product_id, product_name: before.name, before_snapshot: before,
      before_snapshot_fingerprint: fingerprint("CREATINE_UNIT_IDENTITY_BEFORE", before),
      changes: { unit_count: { before: null, after: row.unit_count }, unit_type: { before: null, after: row.unit_type } },
      reason: "owner-authorized official manufacturer evidence",
      official_evidence: row,
    };
  }).sort((a, b) => Number(a.product_id) - Number(b.product_id));
  const core = {
    schema_version: 1, kind: PLAN_KIND, generated_at: new Date(generatedAt).toISOString(), status: "READY_FOR_EXPLICIT_APPLY",
    eligibility: { active_unmerged_creatine_scope_required: true, counted_format_required: true, blank_unit_identity_required: true, owner_authorized_official_evidence_required: true, requested_product_ids: [...ids].sort((a, b) => Number(a) - Number(b)) },
    product_updates: updates, database_writes: 0,
  };
  return { ...core, plan_fingerprint: fingerprint("CREATINE_UNIT_IDENTITY_PLAN", core) };
}

function validatePlan(plan) {
  if (!plan || plan.schema_version !== 1 || plan.kind !== PLAN_KIND || plan.status !== "READY_FOR_EXPLICIT_APPLY" ||
      !Array.isArray(plan.product_updates) || !plan.product_updates.length || plan.database_writes !== 0) fail("Unit-identity plan is invalid or empty");
  const core = { ...plan }; delete core.plan_fingerprint;
  if (plan.plan_fingerprint !== fingerprint("CREATINE_UNIT_IDENTITY_PLAN", core)) fail("Unit-identity plan fingerprint mismatch");
  const ids = new Set();
  for (const update of plan.product_updates) {
    const classified = classifyProduct(update.before_snapshot);
    const officialEvidence = update.official_evidence
      ? validateOfficialEvidence(update.official_evidence, update.before_snapshot)
      : null;
    const eligible = officialEvidence ? isCreatineScopeProduct(update.before_snapshot) : classified.eligible;
    const expected = officialEvidence || classified.suggestion;
    if (!/^[1-9]\d*$/.test(String(update.product_id)) || ids.has(String(update.product_id)) || !eligible ||
        update.before_snapshot_fingerprint !== fingerprint("CREATINE_UNIT_IDENTITY_BEFORE", update.before_snapshot) ||
        update.changes?.unit_count?.before !== null || update.changes?.unit_type?.before !== null ||
        update.changes.unit_count.after !== expected.unit_count ||
        update.changes.unit_type.after !== expected.unit_type) fail("Invalid unit-identity product update");
    ids.add(String(update.product_id));
  }
  const requested = plan.eligibility?.requested_product_ids || [];
  if (requested.length !== ids.size || requested.some((id) => !ids.has(String(id)))) fail("Plan product scope mismatch");
  return plan;
}

function tmpPlanPath(plan, cwd = process.cwd()) {
  const directory = path.resolve(cwd, "tmp", "creatine-unit-identity"); fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${plan.plan_fingerprint.slice(0, 16)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" }); return file;
}

function resolvePlan(file, cwd = process.cwd()) {
  const tmpRoot = fs.realpathSync.native(path.resolve(cwd, "tmp"));
  const resolved = fs.realpathSync.native(path.resolve(cwd, file));
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) fail("Plan must be inside tmp/");
  return resolved;
}

function readTmpJson(file, cwd = process.cwd()) {
  const resolved = resolvePlan(file, cwd);
  const value = JSON.parse(fs.readFileSync(resolved, "utf8"));
  return Array.isArray(value) ? value : value.entries;
}

async function readProducts(client) {
  const rows = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await client.from("products").select(SELECT_FIELDS.join(",")).order("id").range(from, from + 999);
    if (error) throw error; rows.push(...(data || [])); if ((data || []).length < 1000) return rows;
  }
}

async function applyPlan(plan, dependencies = {}) {
  const envFile = dependencies.envFile || path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  const env = dependencies.environment || loadEnvFile(envFile);
  if (env[PRODUCTION.projectRefEnvironmentKey] !== PRODUCTION.projectRef || !env[PRODUCTION.databaseUrlEnvironmentKey]) fail("Production owner environment or project reference is missing");
  const client = dependencies.client || new Client({ connectionString: env[PRODUCTION.databaseUrlEnvironmentKey], ssl: { rejectUnauthorized: false }, application_name: "supplementscout-creatine-unit-identity" });
  const ownsClient = !dependencies.client; if (ownsClient) await client.connect(); let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("set local lock_timeout='10s'"); await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:creatine-unit-identity',0))");
    const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
    validateDatabaseOwner(PRODUCTION, identity); if (identity.safe_update) fail("Database SAFE_UPDATE must be unset");
    const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
    if (target.target_environment !== "PRODUCTION" || target.project_ref !== PRODUCTION.projectRef || target.database_identity !== PRODUCTION.databaseIdentity) fail("Production database identity mismatch");
    const ids = plan.product_updates.map((update) => update.product_id);
    const result = await client.query(`select ${SELECT_FIELDS.join(",")} from public.products where id=any($1::bigint[]) order by id for update`, [ids]);
    const actual = new Map(result.rows.map((product) => [String(product.id), product]));
    if (actual.size !== ids.length) fail("One or more planned products no longer exist");
    for (const update of plan.product_updates) {
      const current = snapshot(actual.get(update.product_id));
      const stillEligible = update.official_evidence
        ? (() => { validateOfficialEvidence(update.official_evidence, current); return isCreatineScopeProduct(current); })()
        : classifyProduct(current).eligible;
      if (fingerprint("CREATINE_UNIT_IDENTITY_BEFORE", current) !== update.before_snapshot_fingerprint || !stillEligible) fail(`Product ${update.product_id} changed after plan generation`);
    }
    for (const update of plan.product_updates) {
      const changed = await client.query("update public.products set unit_count=$2,unit_type=$3 where id=$1 and unit_count is null and unit_type is null returning id", [update.product_id, update.changes.unit_count.after, update.changes.unit_type.after]);
      if (changed.rowCount !== 1) fail(`Product ${update.product_id} was not updated exactly once`);
    }
    await client.query("commit"); open = false; return ids;
  } catch (error) { if (open) await client.query("rollback"); throw error; }
  finally { if (ownsClient) await client.end(); }
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv); const cwd = dependencies.cwd || process.cwd();
  if (options.mode === "plan") {
    const products = dependencies.products || await readProducts(dependencies.supabase || createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
    const plan = options.input
      ? buildOfficialPlan(products, readTmpJson(options.input, cwd), dependencies.generatedAt)
      : buildPlan(products, options.productIds, dependencies.generatedAt);
    const file = tmpPlanPath(plan, cwd);
    return { mode: "DRY_RUN_NO_DATABASE_WRITE", status: plan.status, planned_products: plan.product_updates.length, plan: path.relative(cwd, file).replaceAll("\\", "/") };
  }
  const planPath = resolvePlan(options.plan, cwd); const plan = validatePlan(JSON.parse(fs.readFileSync(planPath, "utf8")));
  const changed = dependencies.applyPlan ? await dependencies.applyPlan(plan) : await applyPlan(plan, dependencies);
  const audit = { schema_version: 1, kind: AUDIT_KIND, status: "APPLIED", plan_fingerprint: plan.plan_fingerprint, applied_at: new Date(dependencies.appliedAt || Date.now()).toISOString(), changed_product_ids: changed, destination_table: "products", changed_fields: ["unit_count", "unit_type"] };
  const auditPath = `${planPath.slice(0, -5)}-audit.json`; fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
  return { status: audit.status, changed_products: changed.length, changed_product_ids: changed, audit: path.relative(cwd, auditPath).replaceAll("\\", "/") };
}

if (require.main === module) {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { applyPlan, buildOfficialPlan, buildPlan, classifyProduct, explicitUnitIdentity, parseArgs, runCli, snapshot, validateOfficialEvidence, validatePlan };
