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
const {
  PREWORKOUT_TARGET_FIELDS,
  TARGET_FIELD_BY_CANDIDATE_FIELD,
  ingredientFact,
} = (() => {
  const facts = require("./lib/nutrition-preworkout-facts");
  return {
    PREWORKOUT_TARGET_FIELDS: Object.values(facts.TARGET_FIELD_BY_CANDIDATE_FIELD),
    TARGET_FIELD_BY_CANDIDATE_FIELD: facts.TARGET_FIELD_BY_CANDIDATE_FIELD,
    ingredientFact: facts.ingredientFact,
  };
})();

const PRODUCTION = CONTRACTS.PRODUCTION;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument.startsWith("--plan=")) options.plan = argument.slice("--plan=".length);
    else if (["--confirm-reviewed-nutrition-update=true", "--confirm-reviewed-product-update=true"].includes(argument)) options.confirm = true;
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.plan) fail("Required option: --plan=tmp/nutrition-approved-plan/<plan>.json");
  if (!options.confirm) fail("Apply requires --confirm-reviewed-nutrition-update=true; --confirm-reviewed-product-update=true remains a compatible alias");
  return options;
}

function candidateSnapshot(candidate) {
  return {
    id: String(candidate.id),
    product_id: candidate.product_id == null ? null : String(candidate.product_id),
    product_variant_id: candidate.product_variant_id == null ? null : String(candidate.product_variant_id),
    proposed_field: String(candidate.proposed_field),
    proposed_value: candidate.proposed_value == null ? null : Number(candidate.proposed_value),
    approved_value: candidate.approved_value == null ? null : Number(candidate.approved_value),
    proposed_unit: candidate.proposed_unit == null ? null : String(candidate.proposed_unit),
    status: String(candidate.status),
    run_id: String(candidate.run_id),
    candidate_fingerprint: String(candidate.candidate_fingerprint),
    source_file_sha256: String(candidate.source_file_sha256),
    source_archive_uri: candidate.source_archive_uri == null ? null : String(candidate.source_archive_uri),
    information_state: candidate.information_state == null ? null : String(candidate.information_state),
    source_quantity_value: candidate.source_quantity_value == null ? null : Number(candidate.source_quantity_value),
    source_quantity_unit: candidate.source_quantity_unit == null ? null : String(candidate.source_quantity_unit),
    quantity_basis: candidate.quantity_basis == null ? null : String(candidate.quantity_basis),
    serving_basis_value: candidate.serving_basis_value == null ? null : Number(candidate.serving_basis_value),
    serving_basis_unit: candidate.serving_basis_unit == null ? null : String(candidate.serving_basis_unit),
    serving_basis_text: candidate.serving_basis_text == null ? null : String(candidate.serving_basis_text),
    ingredient_form: candidate.ingredient_form == null ? null : String(candidate.ingredient_form),
    ingredient_ratio: candidate.ingredient_ratio == null ? null : String(candidate.ingredient_ratio),
  };
}

function verifyCandidates(plan, candidates) {
  const actual = new Map(candidates.map((candidate) => [String(candidate.id), candidate]));
  if (actual.size !== plan.source_candidate_ids.length) fail("Approved candidate set changed after plan generation");
  for (const target of [...plan.product_updates, ...plan.variant_updates]) {
    for (const [field, change] of Object.entries(target.changes)) {
      for (const evidence of change.evidence) {
        const candidate = actual.get(String(evidence.candidate_id));
        const snapshot = candidate && candidateSnapshot(candidate);
        const structured = PREWORKOUT_TARGET_FIELDS.includes(field);
        const expectedSourceField = structured
          ? Object.keys(TARGET_FIELD_BY_CANDIDATE_FIELD).find((key) => TARGET_FIELD_BY_CANDIDATE_FIELD[key] === field)
          : field === "nutrition_verified" ? evidence.source_field : field;
        const expectedSourceValue = field === "nutrition_verified" ? evidence.source_value : structured ? evidence.source_value : change.after;
        if (!snapshot || snapshot.status !== "approved" || snapshot.run_id !== plan.run_id ||
            snapshot.product_id !== target.product_id ||
            snapshot.product_variant_id !== (target.product_variant_id || null) ||
            snapshot.proposed_field !== expectedSourceField ||
            snapshot.proposed_value !== evidence.proposed_value || snapshot.approved_value !== expectedSourceValue ||
            snapshot.candidate_fingerprint !== evidence.candidate_fingerprint ||
            snapshot.source_file_sha256 !== evidence.source_file_sha256 ||
            snapshot.source_archive_uri !== evidence.source_archive_uri ||
            snapshot.information_state !== (evidence.information_state ?? null) ||
            snapshot.source_quantity_value !== (evidence.source_quantity_value ?? null) ||
            snapshot.source_quantity_unit !== (evidence.source_quantity_unit ?? null) ||
            snapshot.quantity_basis !== (evidence.quantity_basis ?? null) ||
            snapshot.serving_basis_value !== (evidence.serving_basis_value ?? null) ||
            snapshot.serving_basis_unit !== (evidence.serving_basis_unit ?? null) ||
            snapshot.serving_basis_text !== (evidence.serving_basis_text ?? null) ||
            snapshot.ingredient_form !== (evidence.ingredient_form ?? null) ||
            snapshot.ingredient_ratio !== (evidence.ingredient_ratio ?? null) ||
            (structured && canonicalJson(ingredientFact({
              ...snapshot, field_name: snapshot.proposed_field,
              value_numeric: snapshot.proposed_value, unit: snapshot.proposed_unit,
              basis: snapshot.quantity_basis,
            }, snapshot.approved_value)) !== canonicalJson(change.after))) {
          fail(`Approved candidate ${evidence.candidate_id} changed after plan generation`);
        }
      }
    }
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function verifyVariants(plan, variants) {
  const byId = new Map(variants.map((variant) => [String(variant.id), variant]));
  for (const update of plan.variant_updates) {
    const current = byId.get(update.product_variant_id);
    if (!current) fail(`Variant ${update.product_variant_id} no longer exists`);
    if (String(current.product_id) !== update.product_id) fail(`Variant ${update.product_variant_id} no longer belongs to product ${update.product_id}`);
    if (canonicalJson(current.nutrition_override || {}) !== canonicalJson(update.before_nutrition_override)) {
      fail(`Variant ${update.product_variant_id} nutrition override changed after plan generation`);
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

function planSourceEvidence(plan) {
  const byCandidate = new Map();
  for (const target of [...plan.product_updates, ...plan.variant_updates]) {
    for (const change of Object.values(target.changes)) {
      for (const evidence of change.evidence) {
        byCandidate.set(evidence.candidate_id, {
          candidate_id: evidence.candidate_id,
          candidate_fingerprint: evidence.candidate_fingerprint,
          product_id: evidence.product_id,
          product_variant_id: evidence.product_variant_id,
          source_file_sha256: evidence.source_file_sha256,
          source_archive_uri: evidence.source_archive_uri,
        });
      }
    }
  }
  return [...byCandidate.values()].sort((left, right) => Number(left.candidate_id) - Number(right.candidate_id));
}

async function nutritionCandidateSchemaState(client) {
  const variantColumns = ["product_variant_id", "source_archive_uri"];
  const factColumns = [
    "information_state", "source_quantity_value", "source_quantity_unit", "quantity_basis",
    "serving_basis_value", "serving_basis_unit", "serving_basis_text", "ingredient_form", "ingredient_ratio",
  ];
  const result = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema='public' and table_name='nutrition_candidates'
      and column_name=any($1::text[])
    order by column_name
  `, [[...variantColumns, ...factColumns]]);
  const columns = new Set(result.rows.map((row) => String(row.column_name)));
  const variantCount = variantColumns.filter((column) => columns.has(column)).length;
  const factCount = factColumns.filter((column) => columns.has(column)).length;
  if (![0, variantColumns.length].includes(variantCount)) fail("Nutrition candidate variant provenance schema is only partially applied");
  if (![0, factColumns.length].includes(factCount) || (factCount && variantCount !== variantColumns.length)) {
    fail("Nutrition candidate NUT-02B schema is only partially applied");
  }
  return { variantProvenanceAvailable: variantCount === variantColumns.length, preworkoutFactsAvailable: factCount === factColumns.length };
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
    const { variantProvenanceAvailable, preworkoutFactsAvailable } = await nutritionCandidateSchemaState(client);
    if (!variantProvenanceAvailable && plan.variant_updates.length) {
      fail("Nutrition variant provenance migration is required before variant updates can be applied");
    }
    const hasStructuredUpdates = plan.variant_updates.some((variant) =>
      Object.keys(variant.changes).some((field) => PREWORKOUT_TARGET_FIELDS.includes(field))
    );
    if (hasStructuredUpdates && !preworkoutFactsAvailable) {
      fail("NUT-02B candidate schema migration is required before structured ingredient updates can be applied");
    }
    const candidateResult = await client.query(preworkoutFactsAvailable ? `
      select id,product_id,product_variant_id,proposed_field,proposed_value,approved_value,proposed_unit,status,run_id,candidate_fingerprint,source_file_sha256,source_archive_uri,
             information_state,source_quantity_value,source_quantity_unit,quantity_basis,serving_basis_value,serving_basis_unit,serving_basis_text,ingredient_form,ingredient_ratio
      from public.nutrition_candidates
      where run_id=$1 and id=any($2::bigint[])
      order by id for share
    ` : variantProvenanceAvailable ? `
      select id,product_id,product_variant_id,proposed_field,proposed_value,approved_value,proposed_unit,status,run_id,candidate_fingerprint,source_file_sha256,source_archive_uri,
             null::text information_state,null::numeric source_quantity_value,null::text source_quantity_unit,null::text quantity_basis,
             null::numeric serving_basis_value,null::text serving_basis_unit,null::text serving_basis_text,null::text ingredient_form,null::text ingredient_ratio
      from public.nutrition_candidates
      where run_id=$1 and id=any($2::bigint[])
      order by id for share
    ` : `
      select id,product_id,null::bigint product_variant_id,proposed_field,proposed_value,approved_value,proposed_unit,status,run_id,candidate_fingerprint,source_file_sha256,null::text source_archive_uri,
             null::text information_state,null::numeric source_quantity_value,null::text source_quantity_unit,null::text quantity_basis,
             null::numeric serving_basis_value,null::text serving_basis_unit,null::text serving_basis_text,null::text ingredient_form,null::text ingredient_ratio
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
    const variantIds = plan.variant_updates.map((variant) => variant.product_variant_id);
    const variantResult = variantIds.length ? await client.query(`
      select id,product_id,nutrition_override
      from public.product_variants where id=any($1::bigint[]) order by id for update
    `, [variantIds]) : { rows: [] };
    verifyVariants(plan, variantResult.rows);
    const changedProducts = [];
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
      changedProducts.push({ product_id: product.product_id, fields: entries.map(([field]) => field) });
    }
    const changedVariants = [];
    for (const variant of plan.variant_updates) {
      const entries = Object.entries(variant.changes).filter(([, change]) => !change.no_change);
      if (!entries.length) continue;
      const result = await client.query(
        "update public.product_variants set nutrition_override=$1::jsonb where id=$2 and product_id=$3 returning id",
        [JSON.stringify(variant.after_nutrition_override), variant.product_variant_id, variant.product_id],
      );
      if (result.rowCount !== 1) fail(`Variant ${variant.product_variant_id} was not updated exactly once`);
      changedVariants.push({
        product_id: variant.product_id,
        product_variant_id: variant.product_variant_id,
        fields: entries.map(([field]) => field),
      });
    }
    await client.query("commit");
    open = false;
    return { changed_products: changedProducts, changed_variants: changedVariants };
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
    schema_version: 2,
    kind: AUDIT_KIND,
    status: "APPLIED_REVIEWED_NUTRITION_FIELDS",
    plan_fingerprint: plan.plan_fingerprint,
    run_id: plan.run_id,
    applied_at: new Date(dependencies.appliedAt || Date.now()).toISOString(),
    changed_products: changed.changed_products,
    changed_variants: changed.changed_variants,
    source_evidence: planSourceEvidence(plan),
    destination_tables: ["products", "product_variants"],
    allowed_fields_only: true,
  };
  const auditPath = writeAudit(planPath, audit);
  return {
    status: audit.status,
    changed_products: changed.changed_products,
    changed_variants: changed.changed_variants,
    audit: path.relative(cwd, auditPath).replaceAll("\\", "/"),
  };
}

if (require.main === module) {
  runCli().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { applyTransaction, nutritionCandidateSchemaState, parseArgs, planSourceEvidence, runCli, verifyCandidates, verifyProducts, verifyVariants };
