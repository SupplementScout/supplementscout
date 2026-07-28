const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-source-snapshot.json"
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-large-family-batch-v8.json"
);

const FAMILIES = [
  {
    external_product_id: "2765",
    name: "7Nutrition Bodybuilder Mass Gainer 3kg",
    slug: "7nutrition-bodybuilder-mass-gainer-3kg",
    brand: "7Nutrition",
    category: "Mass Gainer",
    size: "3000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 6,
  },
  {
    external_product_id: "8330",
    name: "7Nutrition Carbo Gold 1000g",
    slug: "7nutrition-carbo-gold-1000g",
    brand: "7Nutrition",
    category: "Health Supplements",
    size: "1000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 5,
  },
  {
    external_product_id: "3958",
    name: "7Nutrition BCAA Master 500g",
    slug: "7nutrition-bcaa-master-500g",
    brand: "7Nutrition",
    category: "Amino Acids",
    size: "500",
    size_unit: "g",
    product_format: "powder",
    expected_count: 5,
  },
  {
    external_product_id: "2850",
    name: "BioTech USA Iso Whey Zero 2.27kg",
    slug: "biotech-usa-iso-whey-zero-2-27kg",
    brand: "BioTech USA",
    category: "Whey Protein",
    size: "2270",
    size_unit: "g",
    product_format: "powder",
    expected_count: 5,
  },
  {
    external_product_id: "3851",
    name: "BioTech USA 100% Pure Whey 1kg",
    slug: "biotech-usa-100-pure-whey-1kg",
    brand: "BioTech USA",
    category: "Whey Protein",
    size: "1000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 4,
  },
  {
    external_product_id: "8325",
    name: "7Nutrition Isotonic Gold 1000g",
    slug: "7nutrition-isotonic-gold-1000g",
    brand: "7Nutrition",
    category: "Health Supplements",
    size: "1000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 3,
  },
  {
    external_product_id: "31509",
    name: "Trec Nutrition Collagen Renover 350g",
    slug: "trec-nutrition-collagen-renover-350g",
    brand: "Trec Nutrition",
    category: "Health Supplements",
    size: "350",
    size_unit: "g",
    product_format: "powder",
    expected_count: 3,
  },
  {
    external_product_id: "3864",
    name: "BioTech USA Iso Whey Zero 500g",
    slug: "biotech-usa-iso-whey-zero-500g",
    brand: "BioTech USA",
    category: "Whey Protein",
    size: "500",
    size_unit: "g",
    product_format: "powder",
    expected_count: 3,
  },
];

const FLAVOUR_ALIASES = new Map([
  ["Cookies cream", "Cookies & Cream"],
  ["cookie cream", "Cookies & Cream"],
  ["hazelnuts", "Hazelnut"],
]);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function titleCase(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function flavourFor(source) {
  const raw = Object.entries(source.external_options || {}).find(([key]) =>
    ["flavour", "flavor", "flavours", "flavors"].includes(
      String(key).trim().toLowerCase()
    )
  )?.[1];
  if (!raw) fail(`Source flavour missing for ${source.source_record_id}`);
  const sourceFlavour = String(raw).trim();
  return {
    source_flavour: sourceFlavour,
    flavour:
      FLAVOUR_ALIASES.get(sourceFlavour) || titleCase(sourceFlavour),
  };
}

function parseArgs(argv) {
  if (
    argv.length > 1 ||
    (argv[0] && !argv[0].startsWith("--output="))
  ) {
    fail("Usage: --output=<tmp path>");
  }
  const output = path.resolve(
    argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT
  );
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    fail("Output must be inside repository tmp");
  }
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
    ) {
      fail(`Reviewed family source drift for ${spec.external_product_id}`);
    }
    return {
      ...spec,
      kind: "NEW_CANONICAL_PRODUCT",
      price: Math.min(
        ...sourceRows.map((row) => Number(row.price))
      ).toFixed(2),
      image: sourceRows[0]?.image_url || null,
      variants: sourceRows
        .map((source) => ({
          external_variant_id: String(source.external_variant_id),
          ...flavourFor(source),
          in_stock: Boolean(source.in_stock),
        }))
        .sort(
          (left, right) =>
            Number(left.external_variant_id) -
            Number(right.external_variant_id)
        ),
    };
  });
  const variantIds = families.flatMap((family) =>
    family.variants.map((variant) => variant.external_variant_id)
  );
  if (
    families.length !== 8 ||
    variantIds.length !== 34 ||
    new Set(variantIds).size !== 34
  ) {
    fail("Next large family approval scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v8",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-28",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint:
      sourceSnapshot.snapshot_fingerprint,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      collagen_supplements: "ALLOW",
      food: "EXCLUDE",
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
  const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const approval = build(source);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(
    options.output,
    `${JSON.stringify(approval, null, 2)}\n`
  );
  return {
    result: "PASS",
    database_writes: 0,
    family_count: approval.family_count,
    new_product_count: approval.new_product_count,
    row_count: approval.row_count,
    approval_fingerprint: approval.approval_fingerprint,
    output: path.relative(ROOT, options.output),
  };
}

if (require.main === module) {
  try {
    console.log(
      JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, flavourFor, parseArgs };
