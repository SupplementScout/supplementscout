const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const DECISIONS = path.join(ROOT, "config", "retailers", "six-pack-reviewed-catalogue-decisions-v11.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-large-family-batch-v11.json");

const FAMILIES = [
  {
    product_id: "745",
    name: "CNP Loaded EAA 300g", brand: "CNP", category: "Amino Acids",
    size: "300", size_unit: "g", product_format: "powder",
    rows: [["8355", "Juicy Melons"], ["8357", "Strawberry Laces"], ["8359", "Fruit Salad", "1269"], ["8361", "Grape Gazillionz"], ["8363", "Pink Pigs", "821"]],
  },
  {
    name: "Scivation XTEND BCAA 30 Servings", brand: "Scivation", category: "Amino Acids",
    size: null, size_unit: null, unit_count: 30, unit_type: "serving", product_format: "powder",
    rows: [["8485", "Blue Raspberry Ice"], ["8488", "Smash Apple"], ["8490", "Raspberry Pineapple"], ["8492", "Knockout Fruit Punch"], ["8494", "Mango Madness"], ["8502", "Lemon Lime Squeeze"]],
  },
  {
    name: "USN Hyperbolic Mass gH 6kg", brand: "USN", category: "Mass Gainer",
    size: "6000", size_unit: "g", product_format: "powder",
    rows: [["24849", "Strawberry Cheesecake"], ["24875", "French Vanilla"], ["24878", "Dutch Chocolate"]],
  },
  {
    name: "7Nutrition Creatine Strong Tri-Creatine Malate 400g", brand: "7Nutrition", category: "Creatine",
    size: "400", size_unit: "g", product_format: "powder",
    rows: [["2817", "Orange"], ["16680", "Lemon"], ["16683", "Green Apple"]],
  },
  {
    external_product_id: "6312",
    product_id: "1062",
    name: "Applied Nutrition Pump 3G Pre-Workout 375g", brand: "Applied Nutrition", category: "Pre Workout",
    size: "375", size_unit: "g", product_format: "powder",
    rows: [["6315", "Icy Blue Raz", "2239"], ["6317", "Fruit Burst", "2240"]],
  },
];

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function slugify(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}
function build(sourceSnapshot, decisions) {
  if (
    decisions.approved !== true ||
    decisions.kind !== "six-pack-reviewed-catalogue-decisions-v11" ||
    decisions.source_snapshot_fingerprint !== sourceSnapshot.snapshot_fingerprint
  ) fail("Reviewed catalogue decision binding mismatch");
  const byId = new Map((sourceSnapshot.records || []).map((row) => [String(row.source_record_id), row]));
  const approvedFamilies = new Map(
    decisions.approved_multi_page_families.map((family) => [family.canonical_name, family])
  );
  const pumpOverride = decisions.approved_identity_overrides.find(
    (row) => row.external_product_id === "6312"
  );
  const families = FAMILIES.map((spec) => {
    const reviewed = spec.external_product_id === "6312"
      ? pumpOverride
      : approvedFamilies.get(spec.name);
    if (!reviewed) fail(`Missing user approval for ${spec.name}`);
    const sourceRows = spec.rows.map(([id]) => byId.get(id));
    if (
      sourceRows.some((row) => !row || row.policy_state !== "ELIGIBLE") ||
      sourceRows.some((row, index) => String(row.external_variant_id) !== spec.rows[index][0])
    ) fail(`Reviewed source drift for ${spec.name}`);
    if (spec.external_product_id === "6312") {
      if (
        reviewed.net_weight_g !== 375 ||
        reviewed.title_token_override?.not_net_weight !== true ||
        reviewed.distinct_from_external_product_id !== "6320"
      ) fail("Pump 3G identity override mismatch");
    } else {
      const approvedIds = reviewed.external_product_ids.map(String);
      const specIds = spec.rows.map(([id]) => id);
      if (JSON.stringify(approvedIds) !== JSON.stringify(specIds)) {
        fail(`Multi-page family scope drift for ${spec.name}`);
      }
    }
    const externalProductIds = [...new Set(sourceRows.map((row) => String(row.external_product_id)))];
    const familyExternalProductId = spec.external_product_id || externalProductIds[0];
    return {
      external_product_id: familyExternalProductId,
      name: spec.name,
      brand: spec.brand,
      category: spec.category,
      size: spec.size,
      size_unit: spec.size_unit,
      ...(spec.unit_count ? { unit_count: spec.unit_count, unit_type: spec.unit_type } : {}),
      slug: slugify(spec.name),
      product_format: spec.product_format,
      ...(spec.product_id ? { product_id: spec.product_id } : {}),
      kind: spec.product_id ? "EXISTING_CANONICAL_PRODUCT" : "NEW_CANONICAL_PRODUCT",
      price: Math.min(...sourceRows.map((row) => Number(row.price))).toFixed(2),
      image: sourceRows[0].image_url || null,
      variants: sourceRows.map((source, index) => {
        const productVariantId = spec.rows[index][2];
        return {
          external_product_id: String(source.external_product_id),
          external_variant_id: String(source.external_variant_id),
          ...(productVariantId ? { product_variant_id: productVariantId } : {}),
          source_flavour: null,
          flavour: spec.rows[index][1],
          in_stock: Boolean(source.in_stock),
        };
      }),
    };
  });
  const variantIds = families.flatMap((family) => family.variants.map((variant) => variant.external_variant_id));
  if (families.length !== 5 || variantIds.length !== 19 || new Set(variantIds).size !== 19) {
    fail("Reviewed multi-page family scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v11",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-28",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint: sourceSnapshot.snapshot_fingerprint,
    decision_kind: decisions.kind,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      collagen_supplements: "ALLOW",
      food: "EXCLUDE",
      dmaa: "EXCLUDE",
      yohimbine: "EXCLUDE",
      t5_eca: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      family_mapping: true,
      multi_page_family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.filter((family) => family.kind === "NEW_CANONICAL_PRODUCT").length,
    row_count: variantIds.length,
    families,
    approval_fingerprint: null,
  };
  approval.approval_fingerprint = sha256(JSON.stringify(approval));
  return approval;
}
function run(options) {
  const approval = build(
    JSON.parse(fs.readFileSync(SOURCE, "utf8")),
    JSON.parse(fs.readFileSync(DECISIONS, "utf8"))
  );
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(approval, null, 2)}\n`);
  return {
    result: "PASS",
    database_writes: 0,
    family_count: approval.family_count,
    row_count: approval.row_count,
    approval_fingerprint: approval.approval_fingerprint,
    output: path.relative(ROOT, options.output),
  };
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, parseArgs };
