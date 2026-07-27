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
  "six-pack-reviewed-large-family-batch-v7.json"
);

const EXISTING_FAMILIES = [
  {
    external_product_id: "3019",
    product_id: "215",
    size: "315",
    size_unit: "g",
    product_format: "powder",
    variants: {
      "28846": ["Bubblegum Crush", "1016"],
      "28849": ["Candy Ice Blast", "1663"],
      "28855": ["Energy", "1665"],
      "28858": ["Fruit Punch", "1666"],
      "28861": ["Gin & Tonic", null],
      "28864": ["Icy Blue Raz", "1667"],
      "28870": ["Sour Apple", "1668"],
      "28873": ["Sour Gummy Bear", "1669"],
      "28876": ["Strawberry Mojito", "1670"],
      "28879": ["Tropical", "1671"],
    },
  },
  {
    external_product_id: "6312",
    product_id: "744",
    size: "375",
    size_unit: "g",
    product_format: "powder",
    variants: {
      "6315": ["Icy Blue Razz", "816"],
      "6317": ["Fruit Burst", "815"],
    },
  },
];

const NEW_FAMILIES = [
  {
    external_product_id: "4030",
    name: "7Nutrition Whey Protein 80 500g",
    slug: "7nutrition-whey-protein-80-500g",
    brand: "7Nutrition",
    category: "Whey Protein",
    size: "500",
    size_unit: "g",
    product_format: "powder",
    expected_count: 17,
  },
  {
    external_product_id: "3582",
    name: "7Nutrition Whey Protein 80 2kg",
    slug: "7nutrition-whey-protein-80-2kg",
    brand: "7Nutrition",
    category: "Whey Protein",
    size: "2000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 13,
  },
  {
    external_product_id: "3835",
    name: "BioTech USA 100% Pure Whey 2.27kg",
    slug: "biotech-usa-100-pure-whey-2-27kg",
    brand: "BioTech USA",
    category: "Whey Protein",
    size: "2270",
    size_unit: "g",
    product_format: "powder",
    expected_count: 9,
  },
  {
    external_product_id: "2767",
    name: "7Nutrition Whey Isolate 90 2kg",
    slug: "7nutrition-whey-isolate-90-2kg",
    brand: "7Nutrition",
    category: "Whey Protein",
    size: "2000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 9,
  },
  {
    external_product_id: "2760",
    name: "Applied Nutrition ISO-XP 1kg",
    slug: "applied-nutrition-iso-xp-1kg",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    size: "1000",
    size_unit: "g",
    product_format: "powder",
    expected_count: 9,
  },
  {
    external_product_id: "61810",
    name: "PER4M Plant Advanced Vegan Protein 900g",
    slug: "per4m-plant-advanced-vegan-protein-900g",
    brand: "PER4M",
    category: "Whey Protein",
    size: "900",
    size_unit: "g",
    product_format: "powder",
    expected_count: 8,
  },
];

const FLAVOUR_ALIASES = new Map([
  ["Energy Flavour", "Energy"],
  ["Icy Blue Raz", "Icy Blue Razz"],
  ["Strawberry -Banana", "Strawberry-Banana"],
  ["Chocolate-Carmel-Peanut", "Chocolate-Caramel-Peanut"],
  ["Cookie with cream", "Cookies & Cream"],
  ["salty caramel", "Salted Caramel"],
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
  return {
    source_flavour: String(raw).trim(),
    flavour:
      FLAVOUR_ALIASES.get(String(raw).trim()) || titleCase(String(raw)),
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
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
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
  const families = [];
  for (const spec of EXISTING_FAMILIES) {
    const sourceRows = byProduct.get(spec.external_product_id) || [];
    const expectedIds = Object.keys(spec.variants).sort();
    if (
      sourceRows.length !== expectedIds.length ||
      JSON.stringify(
        sourceRows.map((row) => String(row.external_variant_id)).sort()
      ) !== JSON.stringify(expectedIds)
    ) {
      fail(`Existing family source drift for ${spec.external_product_id}`);
    }
    families.push({
      ...spec,
      kind: "EXISTING_CANONICAL_PRODUCT",
      variants: sourceRows
        .map((source) => {
          const [flavour, productVariantId] =
            spec.variants[String(source.external_variant_id)];
          return {
            external_variant_id: String(source.external_variant_id),
            product_variant_id: productVariantId,
            flavour,
            source_flavour: flavourFor(source).source_flavour,
            in_stock: Boolean(source.in_stock),
          };
        })
        .sort(
          (left, right) =>
            Number(left.external_variant_id) -
            Number(right.external_variant_id)
        ),
    });
  }
  for (const spec of NEW_FAMILIES) {
    const sourceRows = byProduct.get(spec.external_product_id) || [];
    if (sourceRows.length !== spec.expected_count) {
      fail(`New family source drift for ${spec.external_product_id}`);
    }
    families.push({
      ...spec,
      kind: "NEW_CANONICAL_PRODUCT",
      price: Number(
        Math.min(...sourceRows.map((row) => Number(row.price)))
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
    });
  }
  const variantIds = families.flatMap((family) =>
    family.variants.map((variant) => variant.external_variant_id)
  );
  if (
    families.length !== 8 ||
    variantIds.length !== 77 ||
    new Set(variantIds).size !== 77
  ) {
    fail("Large family approval scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v7",
    approved: true,
    approval_source: "USER_EXPLICIT_CHAT_CONFIRMATION",
    approved_at: "2026-07-27",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint: sourceSnapshot.snapshot_fingerprint,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      food: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: NEW_FAMILIES.length,
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
  fs.writeFileSync(options.output, `${JSON.stringify(approval, null, 2)}\n`);
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
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, flavourFor, parseArgs };
