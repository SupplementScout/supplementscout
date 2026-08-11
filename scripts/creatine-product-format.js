const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const { fingerprint } = require("./lib/nutrition-candidates");
const { isCreatineScopeProduct, suggestedCreatineFormat } = require("./lib/creatine-coverage");
const { loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const PLAN_KIND = "creatine-product-format-plan-v1";
const AUDIT_KIND = "creatine-product-format-audit-v1";
const PRODUCTION = CONTRACTS.PRODUCTION;
const ALLOWED_FORMATS = new Set(["powder", "capsule", "tablet", "gummy"]);
const SELECT_FIELDS = [
  "id", "name", "category", "product_format", "net_weight_g",
  "is_active", "merged_into_product_id",
];

function fail(message) {
  throw new Error(message);
}

function parseProductIds(argument) {
  const values = argument.split(",").map((value) => value.trim());
  if (!values.length || values.some((value) => !/^[1-9]\d*$/.test(value)) || new Set(values).size !== values.length) {
    fail("--product-ids must contain unique positive integer IDs");
  }
  return values;
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument === "--mode=plan") options.mode = "plan";
    else if (argument === "--mode=apply") options.mode = "apply";
    else if (argument.startsWith("--plan=")) options.plan = argument.slice("--plan=".length);
    else if (argument.startsWith("--product-ids=")) options.productIds = parseProductIds(argument.slice("--product-ids=".length));
    else if (argument === "--confirm-deterministic-creatine-format=true") options.confirm = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.mode) fail("Required option: --mode=plan|apply");
  if (options.mode === "plan" && (!options.productIds || options.plan || options.confirm)) {
    fail("Plan requires --product-ids and does not accept apply options");
  }
  if (options.mode === "apply" && (!options.plan || !options.confirm || options.productIds)) {
    fail("Apply requires --plan=<tmp plan> and --confirm-deterministic-creatine-format=true");
  }
  return options;
}

function snapshot(product) {
  return {
    id: String(product.id),
    name: String(product.name || ""),
    category: String(product.category || ""),
    product_format: product.product_format == null || String(product.product_format).trim() === ""
      ? null
      : String(product.product_format).trim().toLowerCase(),
    net_weight_g: product.net_weight_g == null ? null : Number(product.net_weight_g),
    is_active: product.is_active === true,
    merged_into_product_id: product.merged_into_product_id == null ? null : String(product.merged_into_product_id),
  };
}

function classifyProduct(product) {
  const value = snapshot(product);
  const reasons = [];
  if (!isCreatineScopeProduct(value)) reasons.push("OUTSIDE_ACTIVE_CREATINE_SCOPE");
  if (value.product_format !== null) reasons.push("FORMAT_ALREADY_SET");
  const suggestion = suggestedCreatineFormat(value);
  if (!suggestion || !ALLOWED_FORMATS.has(suggestion.value)) reasons.push("NO_DETERMINISTIC_FORMAT_SUGGESTION");
  return { eligible: reasons.length === 0, reasons, snapshot: value, suggestion };
}

function buildPlan(products, requestedProductIds, generatedAt = new Date().toISOString()) {
  const requested = new Set(requestedProductIds.map(String));
  const selected = products.filter((product) => requested.has(String(product.id)));
  if (selected.length !== requested.size) fail("One or more requested products were not found");
  const classified = selected.map((product) => ({ product, result: classifyProduct(product) }));
  const blocked = classified.filter((entry) => !entry.result.eligible);
  if (blocked.length) {
    fail(`Requested products failed format eligibility: ${blocked.map((entry) => `${entry.product.id}:${entry.result.reasons.join("+")}`).join(",")}`);
  }
  const updates = classified.map((entry) => ({
    product_id: String(entry.product.id),
    product_name: String(entry.product.name),
    before_snapshot: entry.result.snapshot,
    before_snapshot_fingerprint: fingerprint("CREATINE_FORMAT_BEFORE", entry.result.snapshot),
    change: { field: "product_format", before: null, after: entry.result.suggestion.value },
    reason: entry.result.suggestion.reason,
  })).sort((left, right) => Number(left.product_id) - Number(right.product_id));
  const core = {
    schema_version: 1,
    kind: PLAN_KIND,
    generated_at: new Date(generatedAt).toISOString(),
    status: "READY_FOR_EXPLICIT_APPLY",
    eligibility: {
      active_unmerged_creatine_scope_required: true,
      blank_product_format_required: true,
      deterministic_identity_required: true,
      requested_product_ids: [...requested].sort((left, right) => Number(left) - Number(right)),
    },
    product_updates: updates,
    database_writes: 0,
  };
  return { ...core, plan_fingerprint: fingerprint("CREATINE_FORMAT_PLAN", core) };
}

function validatePlan(plan) {
  if (!plan || plan.schema_version !== 1 || plan.kind !== PLAN_KIND ||
      plan.status !== "READY_FOR_EXPLICIT_APPLY" || !Array.isArray(plan.product_updates) ||
      !plan.product_updates.length || plan.database_writes !== 0) fail("Creatine-format plan is invalid or empty");
  const core = { ...plan };
  delete core.plan_fingerprint;
  if (plan.plan_fingerprint !== fingerprint("CREATINE_FORMAT_PLAN", core)) fail("Creatine-format plan fingerprint mismatch");
  const ids = new Set();
  for (const update of plan.product_updates) {
    const classified = classifyProduct(update.before_snapshot);
    if (!/^[1-9]\d*$/.test(String(update.product_id)) || ids.has(String(update.product_id)) ||
        update.change?.field !== "product_format" || update.change.before !== null ||
        !ALLOWED_FORMATS.has(update.change.after) || update.change.after !== classified.suggestion?.value ||
        update.before_snapshot_fingerprint !== fingerprint("CREATINE_FORMAT_BEFORE", update.before_snapshot) ||
        !classified.eligible) fail("Invalid creatine-format product update");
    ids.add(String(update.product_id));
  }
  const requested = plan.eligibility?.requested_product_ids || [];
  if (requested.length !== ids.size || requested.some((id) => !ids.has(String(id)))) fail("Plan product scope mismatch");
  return plan;
}

function tmpPlanPath(plan, cwd = process.cwd()) {
  const directory = path.resolve(cwd, "tmp", "creatine-product-format");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${plan.plan_fingerprint.slice(0, 16)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  return file;
}

function resolvePlan(file, cwd = process.cwd()) {
  const tmpRoot = fs.realpathSync.native(path.resolve(cwd, "tmp"));
  const resolved = fs.realpathSync.native(path.resolve(cwd, file));
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) fail("Plan must be inside tmp/");
  return resolved;
}

async function readProducts(client) {
  const rows = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await client.from("products").select(SELECT_FIELDS.join(",")).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

async function applyPlan(plan, dependencies = {}) {
  const envFile = dependencies.envFile || path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  const env = dependencies.environment || loadEnvFile(envFile);
  if (env[PRODUCTION.projectRefEnvironmentKey] !== PRODUCTION.projectRef || !env[PRODUCTION.databaseUrlEnvironmentKey]) {
    fail("Production owner environment or project reference is missing");
  }
  const client = dependencies.client || new Client({
    connectionString: env[PRODUCTION.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-creatine-product-format",
  });
  const ownsClient = !dependencies.client;
  if (ownsClient) await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:creatine-product-format',0))");
    const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
    validateDatabaseOwner(PRODUCTION, identity);
    if (identity.safe_update) fail("Database SAFE_UPDATE must be unset");
    const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
    if (target.target_environment !== "PRODUCTION" || target.project_ref !== PRODUCTION.projectRef ||
        target.database_identity !== PRODUCTION.databaseIdentity) fail("Production database identity mismatch");
    const ids = plan.product_updates.map((update) => update.product_id);
    const result = await client.query(`select ${SELECT_FIELDS.join(",")} from public.products where id=any($1::bigint[]) order by id for update`, [ids]);
    const actual = new Map(result.rows.map((product) => [String(product.id), product]));
    if (actual.size !== ids.length) fail("One or more planned products no longer exist");
    for (const update of plan.product_updates) {
      const current = snapshot(actual.get(update.product_id));
      if (fingerprint("CREATINE_FORMAT_BEFORE", current) !== update.before_snapshot_fingerprint ||
          !classifyProduct(current).eligible) fail(`Product ${update.product_id} changed after plan generation`);
    }
    for (const update of plan.product_updates) {
      const changed = await client.query(
        "update public.products set product_format=$2 where id=$1 and product_format is null returning id",
        [update.product_id, update.change.after],
      );
      if (changed.rowCount !== 1) fail(`Product ${update.product_id} was not updated exactly once`);
    }
    await client.query("commit");
    open = false;
    return ids;
  } catch (error) {
    if (open) await client.query("rollback");
    throw error;
  } finally {
    if (ownsClient) await client.end();
  }
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const cwd = dependencies.cwd || process.cwd();
  if (options.mode === "plan") {
    const products = dependencies.products || await readProducts(
      dependencies.supabase || createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
    const plan = buildPlan(products, options.productIds, dependencies.generatedAt);
    const file = tmpPlanPath(plan, cwd);
    return { mode: "DRY_RUN_NO_DATABASE_WRITE", status: plan.status, planned_products: plan.product_updates.length, plan: path.relative(cwd, file).replaceAll("\\", "/") };
  }
  const planPath = resolvePlan(options.plan, cwd);
  const plan = validatePlan(JSON.parse(fs.readFileSync(planPath, "utf8")));
  const changed = dependencies.applyPlan ? await dependencies.applyPlan(plan) : await applyPlan(plan, dependencies);
  const audit = {
    schema_version: 1, kind: AUDIT_KIND, status: "APPLIED", plan_fingerprint: plan.plan_fingerprint,
    applied_at: new Date(dependencies.appliedAt || Date.now()).toISOString(), changed_product_ids: changed,
    destination_table: "products", changed_field: "product_format",
  };
  const auditPath = `${planPath.slice(0, -5)}-audit.json`;
  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
  return { status: audit.status, changed_products: changed.length, changed_product_ids: changed, audit: path.relative(cwd, auditPath).replaceAll("\\", "/") };
}

if (require.main === module) {
  require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { AUDIT_KIND, PLAN_KIND, applyPlan, buildPlan, classifyProduct, parseArgs, runCli, snapshot, validatePlan };
