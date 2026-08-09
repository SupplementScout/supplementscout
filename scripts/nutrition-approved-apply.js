const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  AUDIT_KIND,
  resolveTmpFile,
  validatePlan,
} = require("./lib/nutrition-approved-updates");
const { loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const PRODUCTION = CONTRACTS.PRODUCTION;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--plan=")) options.plan = argument.slice("--plan=".length);
    else if (argument === "--confirm-reviewed-product-update=true") options.confirm = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.plan) fail("Required option: --plan=tmp/nutrition-approved-plan/<plan>.json");
  if (!options.confirm) fail("Apply requires --confirm-reviewed-product-update=true");
  return options;
}

function candidateSnapshot(candidate) {
  return {
    id: String(candidate.id),
    product_id: candidate.product_id == null ? null : String(candidate.product_id),
    proposed_field: String(candidate.proposed_field),
    proposed_value: Number(candidate.proposed_value),
    approved_value: Number(candidate.approved_value),
    proposed_unit: String(candidate.proposed_unit),
    status: String(candidate.status),
    run_id: String(candidate.run_id),
    candidate_fingerprint: String(candidate.candidate_fingerprint),
  };
}

function verifyCandidates(plan, candidates) {
  const actual = new Map(candidates.map((candidate) => [String(candidate.id), candidate]));
  if (actual.size !== plan.source_candidate_ids.length) fail("Approved candidate set changed after plan generation");
  for (const product of plan.product_updates) {
    for (const [field, change] of Object.entries(product.changes)) {
      for (const evidence of change.evidence) {
        const candidate = actual.get(String(evidence.candidate_id));
        const snapshot = candidate && candidateSnapshot(candidate);
        const expectedSourceField = field === "nutrition_verified" ? evidence.source_field : field;
        const expectedSourceValue = field === "nutrition_verified" ? evidence.source_value : change.after;
        if (!snapshot || snapshot.status !== "approved" || snapshot.run_id !== plan.run_id ||
            snapshot.product_id !== product.product_id || snapshot.proposed_field !== expectedSourceField ||
            snapshot.proposed_value !== evidence.proposed_value || snapshot.approved_value !== expectedSourceValue ||
            snapshot.candidate_fingerprint !== evidence.candidate_fingerprint) {
          fail(`Approved candidate ${evidence.candidate_id} changed after plan generation`);
        }
      }
    }
  }
}

function verifyProducts(plan, products) {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  for (const update of plan.product_updates) {
    const current = byId.get(update.product_id);
    if (!current) fail(`Product ${update.product_id} no longer exists`);
    for (const [field, change] of Object.entries(update.changes)) {
      const value = field === "nutrition_verified"
        ? current[field] === true
        : current[field] == null ? null : Number(current[field]);
      if (value !== change.before) fail(`Product ${update.product_id} field ${field} changed after plan generation`);
    }
  }
}

function writeAudit(planPath, audit) {
  const directory = path.dirname(planPath);
  const file = path.join(directory, `${path.basename(planPath, ".json")}-audit.json`);
  fs.writeFileSync(file, `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
  return file;
}

async function applyTransaction(plan, dependencies = {}) {
  const envFile = dependencies.envFile || path.join(
    process.env.USERPROFILE || "",
    ".supplementscout",
    "credentials",
    "production-owner.env",
  );
  const env = dependencies.environment || loadEnvFile(envFile);
  if (env[PRODUCTION.projectRefEnvironmentKey] !== PRODUCTION.projectRef || !env[PRODUCTION.databaseUrlEnvironmentKey]) {
    fail("Production owner environment or project reference is missing");
  }
  const client = dependencies.client || new Client({
    connectionString: env[PRODUCTION.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-approved-nutrition-apply",
  });
  const ownsClient = !dependencies.client;
  if (ownsClient) await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:approved-nutrition-update',0))");
    const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
    validateDatabaseOwner(PRODUCTION, identity);
    if (identity.safe_update) fail("Database SAFE_UPDATE must be unset");
    const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
    if (target.target_environment !== "PRODUCTION" || target.project_ref !== PRODUCTION.projectRef ||
        target.database_identity !== PRODUCTION.databaseIdentity) fail("Production database identity mismatch");
    const candidateResult = await client.query(`
      select id,product_id,proposed_field,proposed_value,approved_value,proposed_unit,status,run_id,candidate_fingerprint
      from public.nutrition_candidates
      where run_id=$1 and id=any($2::bigint[])
      order by id for share
    `, [plan.run_id, plan.source_candidate_ids]);
    verifyCandidates(plan, candidateResult.rows);
    const productIds = plan.product_updates.map((product) => product.product_id);
    const productResult = await client.query(`
      select id,net_weight_g,net_volume_ml,serving_count_verified,serving_size_g,
             serving_size_ml,protein_per_serving_g,creatine_per_serving_g,nutrition_verified
      from public.products where id=any($1::bigint[]) order by id for update
    `, [productIds]);
    verifyProducts(plan, productResult.rows);
    const changed = [];
    for (const product of plan.product_updates) {
      const entries = Object.entries(product.changes).filter(([, change]) => !change.no_change);
      if (!entries.length) continue;
      const assignments = entries.map(([field], index) => `"${field}"=$${index + 1}`);
      const values = entries.map(([, change]) => change.after);
      values.push(product.product_id);
      const result = await client.query(
        `update public.products set ${assignments.join(",")} where id=$${values.length} returning id`,
        values,
      );
      if (result.rowCount !== 1) fail(`Product ${product.product_id} was not updated exactly once`);
      changed.push({ product_id: product.product_id, fields: entries.map(([field]) => field) });
    }
    await client.query("commit");
    open = false;
    return changed;
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
  const planPath = resolveTmpFile(options.plan, cwd);
  let plan;
  try {
    plan = validatePlan(JSON.parse(fs.readFileSync(planPath, "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) fail("Approved product update plan is not valid JSON");
    throw error;
  }
  const changed = dependencies.applyTransaction
    ? await dependencies.applyTransaction(plan)
    : await applyTransaction(plan, dependencies);
  const audit = {
    schema_version: 1,
    kind: AUDIT_KIND,
    status: "APPLIED_REVIEWED_PRODUCT_FIELDS",
    plan_fingerprint: plan.plan_fingerprint,
    run_id: plan.run_id,
    applied_at: new Date(dependencies.appliedAt || Date.now()).toISOString(),
    changed_products: changed,
    destination_table: "products",
    allowed_fields_only: true,
  };
  const auditPath = writeAudit(planPath, audit);
  return {
    status: audit.status,
    changed_products: changed,
    audit: path.relative(cwd, auditPath).replaceAll("\\", "/"),
  };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { applyTransaction, parseArgs, runCli, verifyCandidates, verifyProducts };
