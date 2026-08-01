const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const defaultApproval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const DEFAULT_APPROVAL = path.join(ROOT, "config", "retailers", "gym-high-reviewed-full-catalogue-2026-08-01.json");

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalize(value) { return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim(); }
function slug(value) { return normalize(value).replace(/\s+/g, "-"); }

function assertApproval(value = defaultApproval) {
  const rows = value.families.flatMap((family) => family.variants.map((variant) => ({ family, variant })));
  const sourceKeys = rows.map(({ family, variant }) => `${family.external_product_id}:${variant.external_variant_id}`);
  const createCount = rows.filter(({ variant }) => !variant.product_variant_id).length;
  const fingerprint = sha256(canonicalJson({ ...value, approval_fingerprint: null }));
  if (
    value.approved !== true ||
    value.kind !== "gym-high-reviewed-full-catalogue-v1" ||
    value.target_project_ref !== PROJECT_REF ||
    value.retailer_id !== 1 ||
    value.retailer_slug !== "gym-high" ||
    value.policy.catalogue_creates !== false ||
    value.policy.new_variants_only !== true ||
    value.families.length !== 25 ||
    rows.length !== value.approved_mapping_count ||
    rows.length !== 66 ||
    createCount !== value.expected_variant_create_count ||
    createCount !== 34 ||
    new Set(sourceKeys).size !== sourceKeys.length ||
    value.approval_fingerprint !== fingerprint
  ) fail("GYM HIGH full-catalogue approval contract mismatch");
  return value;
}

function sizeLabel(value, unit) {
  if (unit === "g" && Number(value) >= 1000) return `${Number(value) / 1000}kg`;
  return `${value}${unit}`;
}

function intendedVariant(family, variant) {
  if (!variant.canonical_label) fail(`Missing canonical label for new variant ${family.external_product_id}:${variant.external_variant_id}`);
  const hasSize = family.size_value != null && family.size_unit;
  const suffix = hasSize ? `-${family.size_value}${family.size_unit}` : "";
  return {
    variant_key: `${slug(variant.canonical_label)}${suffix}`,
    display_name: hasSize ? `${variant.canonical_label} / ${sizeLabel(family.size_value, family.size_unit)}` : variant.canonical_label,
    flavour_code: normalize(variant.canonical_label),
    flavour_label: variant.canonical_label,
    size_value: hasSize ? Number(family.size_value) : null,
    size_unit: hasSize ? family.size_unit : null,
    pack_count: 1,
    product_format: family.product_format,
    is_active: true,
    is_default: false,
  };
}

function exactVariant(actual, intended) {
  return actual.variant_key === intended.variant_key &&
    actual.display_name === intended.display_name &&
    normalize(actual.flavour_code) === normalize(intended.flavour_code) &&
    actual.flavour_label === intended.flavour_label &&
    (actual.size_value == null ? null : Number(actual.size_value)) === intended.size_value &&
    (actual.size_unit || null) === intended.size_unit &&
    Number(actual.pack_count) === intended.pack_count &&
    (actual.product_format || null) === (intended.product_format || null) &&
    actual.is_active === true && actual.is_default === false;
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|output|approval)=(.*)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  if (!["dry-run", "apply"].includes(values.mode)) fail("Required --mode=dry-run|apply");
  if (!values.output) fail("Required --output=<tmp path>");
  const output = path.resolve(values.output);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  const approval = path.resolve(values.approval || DEFAULT_APPROVAL);
  if (approval !== DEFAULT_APPROVAL) fail("Only the reviewed GYM HIGH full-catalogue approval is accepted");
  return { mode: values.mode, output, approval };
}

function client() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production service credential mismatch");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readProduct(db, family) {
  const result = await db.from("products").select("id,name,product_format,is_active,merged_into_product_id").eq("id", Number(family.product_id)).single();
  if (result.error) throw result.error;
  const row = result.data;
  if (String(row.id) !== String(family.product_id) || row.name !== family.expected_name || row.is_active !== true || row.merged_into_product_id != null || (row.product_format || null) !== (family.product_format || null)) fail(`Canonical product identity drift for ${family.external_product_id}`);
  return row;
}

async function readVariants(db, productId) {
  const result = await db.from("product_variants").select("id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default").eq("product_id", Number(productId));
  if (result.error) throw result.error;
  return result.data || [];
}

function inspectVariants(family, existing) {
  const actions = [];
  for (const variant of family.variants) {
    if (variant.product_variant_id) {
      const actual = existing.find((row) => String(row.id) === String(variant.product_variant_id));
      if (!actual || String(actual.product_id) !== String(family.product_id) || actual.is_active !== true) fail(`Approved existing variant drift for ${family.external_product_id}:${variant.external_variant_id}`);
      actions.push({ external_variant_id: String(variant.external_variant_id), action: "VERIFY_EXISTING", product_variant_id: String(actual.id) });
      continue;
    }
    const intended = intendedVariant(family, variant);
    const semantic = existing.filter((row) => normalize(row.flavour_label || row.flavour_code) === normalize(intended.flavour_label) && (row.size_value == null ? null : Number(row.size_value)) === intended.size_value && (row.size_unit || null) === intended.size_unit && row.is_default === false);
    if (semantic.length > 1) fail(`Ambiguous canonical variant for ${family.external_product_id}:${variant.external_variant_id}`);
    if (semantic.length === 1) {
      if (!exactVariant(semantic[0], intended)) fail(`Canonical variant identity drift for ${family.external_product_id}:${variant.external_variant_id}`);
      actions.push({ external_variant_id: String(variant.external_variant_id), action: "VERIFY_COMPLETE", product_variant_id: String(semantic[0].id) });
    } else {
      actions.push({ external_variant_id: String(variant.external_variant_id), action: "CREATE_VARIANT", product_variant_id: null, intended });
    }
  }
  return actions;
}

async function run(options, dependencies = {}) {
  if (options.mode === "apply" && (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout" || process.env.GYM_HIGH_APPROVED_APPLY !== "true")) fail("GYM HIGH bootstrap apply is restricted to an explicitly approved GitHub Actions run on main");
  const approval = assertApproval(dependencies.approval || JSON.parse(fs.readFileSync(options.approval, "utf8")));
  const db = dependencies.client || client();
  const families = [];
  let insertedVariantCount = 0;
  for (const family of approval.families) {
    await readProduct(db, family);
    let existing = await readVariants(db, family.product_id);
    let actions = inspectVariants(family, existing);
    if (options.mode === "apply") {
      for (const action of actions.filter((row) => row.action === "CREATE_VARIANT")) {
        const result = await db.from("product_variants").insert({ ...action.intended, product_id: Number(family.product_id), gtin: null, image: null, nutrition_override: {} });
        if (result.error) throw result.error;
        insertedVariantCount += 1;
      }
      existing = await readVariants(db, family.product_id);
      actions = inspectVariants(family, existing);
      if (actions.some((row) => row.action === "CREATE_VARIANT")) fail(`Bootstrap postcondition failed for ${family.external_product_id}`);
    }
    families.push({ external_product_id: String(family.external_product_id), product_id: String(family.product_id), actions: actions.map(({ intended, ...action }) => action) });
  }
  const planned = families.flatMap((family) => family.actions).filter((row) => row.action === "CREATE_VARIANT").length;
  const report = { schema_version: 1, kind: "gym-high-reviewed-catalogue-bootstrap", result: "PASS", mode: options.mode, database_writes: insertedVariantCount, target_project_ref: PROJECT_REF, approval_fingerprint: approval.approval_fingerprint, family_count: families.length, approved_mapping_count: approval.approved_mapping_count, planned_variant_create_count: planned, inserted_variant_count: insertedVariantCount, families, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { assertApproval, exactVariant, inspectVariants, intendedVariant, parseArgs, run };
