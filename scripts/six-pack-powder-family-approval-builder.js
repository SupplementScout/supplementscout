const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-large-family-batch-v10.json");

const FAMILIES = [
  { external_product_id: "4486", name: "CNP Loaded H2O 300g", brand: "CNP", category: "Hydration", size: "300", size_unit: "g", expected_count: 5 },
  { external_product_id: "3088", name: "Nutrend Flexit Drink 400g", brand: "Nutrend", category: "Health Supplements", size: "400", size_unit: "g", expected_count: 5 },
  { external_product_id: "3629", name: "MuscleTech Nitro-Tech 1.8kg", brand: "MuscleTech", category: "Whey Protein", size: "1800", size_unit: "g", expected_count: 4 },
  { external_product_id: "4781", name: "BioTech USA Hyper Mass 4kg", brand: "BioTech USA", category: "Mass Gainer", size: "4000", size_unit: "g", expected_count: 3 },
  { external_product_id: "3656", name: "Medi Evil Nutrition Purely Mass 5.28kg", brand: "Medi Evil Nutrition", category: "Mass Gainer", size: "5280", size_unit: "g", expected_count: 3 },
  { external_product_id: "4749", name: "Scivation XTEND EAAs + Electrolytes 40 Servings", brand: "Scivation", category: "Amino Acids", size: null, size_unit: null, unit_count: 40, unit_type: "serving", expected_count: 3 },
  { external_product_id: "4905", name: "USN 3XT Dynamite Pre-Workout 375g", brand: "USN", category: "Pre Workout", size: "375", size_unit: "g", expected_count: 3 },
  { external_product_id: "6312", name: "Applied Nutrition Pump 3G Pre-Workout 375g", brand: "Applied Nutrition", category: "Pre Workout", size: "375", size_unit: "g", expected_count: 2 },
  { external_product_id: "1495", name: "BioTech USA BCAA Zero 360g Tropical Fruit", brand: "BioTech USA", category: "Amino Acids", size: "360", size_unit: "g", expected_count: 1, simple_flavour: "Tropical Fruit" },
  { external_product_id: "4702", name: "7Nutrition AAKG Arginine 250g", brand: "7Nutrition", category: "Amino Acids", size: "250", size_unit: "g", expected_count: 1, simple_flavour: "Unflavoured" },
  { external_product_id: "6530", name: "Applied Nutrition L-Glutamine 500g", brand: "Applied Nutrition", category: "Amino Acids", size: "500", size_unit: "g", expected_count: 1, simple_flavour: "Unflavoured" },
  { external_product_id: "11473", name: "7Nutrition Creatine Creapure 500g", brand: "7Nutrition", category: "Creatine", size: "500", size_unit: "g", expected_count: 1, simple_flavour: "Unflavoured" },
  { external_product_id: "4870", name: "Trec Nutrition CM3 Tri-Creatine Malate 500g White Cola", brand: "Trec Nutrition", category: "Creatine", size: "500", size_unit: "g", expected_count: 1, simple_flavour: "White Cola" },
  { external_product_id: "31671", name: "Reflex Nutrition Creatine Creapure 250g", brand: "Reflex Nutrition", category: "Creatine", size: "250", size_unit: "g", expected_count: 1, simple_flavour: "Unflavoured" },
];

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function slugify(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function titleCase(value) {
  return String(value).trim().toLowerCase().replace(/\s*-\s*/g, "-").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
function sourceFlavour(source) {
  const entry = Object.entries(source.external_options || {}).find(([key]) =>
    ["flavour", "flavor", "flavours", "flavors"].includes(String(key).trim().toLowerCase())
  );
  if (!entry?.[1]) fail(`Source flavour missing for ${source.source_record_id}`);
  return String(entry[1]).trim();
}
function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}
function build(sourceSnapshot) {
  const byProduct = new Map();
  for (const row of sourceSnapshot.records || []) {
    const key = String(row.external_product_id);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(row);
  }
  const families = FAMILIES.map((spec) => {
    const sourceRows = byProduct.get(spec.external_product_id) || [];
    if (
      sourceRows.length !== spec.expected_count ||
      sourceRows.some((row) => row.policy_state !== "ELIGIBLE")
    ) fail(`Reviewed powder family source drift for ${spec.external_product_id}`);
    return {
      ...spec,
      slug: slugify(spec.name),
      product_format: "powder",
      kind: "NEW_CANONICAL_PRODUCT",
      price: Math.min(...sourceRows.map((row) => Number(row.price))).toFixed(2),
      image: sourceRows[0]?.image_url || null,
      variants: sourceRows
        .map((source) => {
          const raw = spec.simple_flavour || sourceFlavour(source);
          return {
            external_variant_id: String(source.external_variant_id),
            source_flavour: spec.simple_flavour ? null : raw,
            flavour: spec.simple_flavour || titleCase(raw),
            in_stock: Boolean(source.in_stock),
          };
        })
        .sort((left, right) => Number(left.external_variant_id) - Number(right.external_variant_id)),
    };
  });
  const variantIds = families.flatMap((family) => family.variants.map((variant) => variant.external_variant_id));
  if (families.length !== 14 || variantIds.length !== 34 || new Set(variantIds).size !== 34) {
    fail("Powder family approval scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v10",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-28",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint: sourceSnapshot.snapshot_fingerprint,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      collagen_supplements: "ALLOW",
      food: "EXCLUDE",
      hormonal_and_high_risk_stimulants: "DEFER",
      conflicting_brand_identity: "DEFER",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.length,
    row_count: variantIds.length,
    families,
    approval_fingerprint: null,
  };
  approval.approval_fingerprint = sha256(JSON.stringify(approval));
  return approval;
}
function run(options) {
  const approval = build(JSON.parse(fs.readFileSync(SOURCE, "utf8")));
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(approval, null, 2)}\n`);
  return { result: "PASS", database_writes: 0, family_count: approval.family_count, row_count: approval.row_count, approval_fingerprint: approval.approval_fingerprint, output: path.relative(ROOT, options.output) };
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, parseArgs, sourceFlavour };
