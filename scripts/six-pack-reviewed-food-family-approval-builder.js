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
const DECISIONS = path.join(
  ROOT,
  "config",
  "retailers",
  "six-pack-reviewed-food-policy-v12.json"
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-large-family-batch-v12.json"
);

const FAMILY_SPECS = [
  {
    name: "7Nutrition Peanut Butter Crunchy 1kg",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "1000",
    size_unit: "g",
    product_format: "spread",
    rows: [{ id: "4880", flavour: "Crunchy" }],
  },
  {
    name: "7Nutrition Seven Protein Bar 77g",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "77",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "5079", flavour: "Triple Chocolate" },
      { id: "30924", flavour: "Salted Caramel" },
      { id: "30930", flavour: "Banana & Dark Chocolate" },
      { id: "30936", flavour: "White Chocolate" },
    ],
  },
  {
    product_id: "384",
    name: "Battle Snacks Battle Bites Protein Bar 62g",
    brand: "Battle Bites",
    category: "Protein Bars",
    size: "62",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "5086", flavour: "Red Velvet" },
      {
        id: "5088",
        flavour: "White Chocolate Toasted Marshmallow",
      },
      { id: "5090", flavour: "Carrot Cake" },
      { id: "5091", flavour: "Chocolate Caramel" },
      { id: "5092", flavour: "Cookies & Cream" },
      { id: "8189", flavour: "Sticky Toffee Pudding" },
      { id: "8191", flavour: "Mississippi Mud Pie" },
    ],
  },
  {
    name: "Warrior Crunch Protein Bar 64g",
    brand: "Warrior",
    category: "Protein Bars",
    size: "64",
    size_unit: "g",
    product_format: "bar",
    rows: [
      {
        id: "3290",
        flavour: "Milk Chocolate Coconut",
        pack_count: 12,
      },
      {
        id: "3291",
        flavour: "Dark Chocolate Peanut",
        pack_count: 12,
      },
      {
        id: "3292",
        flavour: "Raspberry Lemon Cheesecake",
        pack_count: 12,
      },
      {
        id: "3293",
        flavour: "Salted Caramel",
        pack_count: 12,
      },
      {
        id: "3294",
        flavour: "White Chocolate",
        pack_count: 12,
      },
      { id: "3295", flavour: "Banoffee Pie", pack_count: 12 },
      { id: "3297", flavour: "Key Lime Pie", pack_count: 12 },
      { id: "5193", flavour: "Key Lime Pie" },
      { id: "5195", flavour: "Dark Chocolate Peanut" },
      { id: "5197", flavour: "Salted Caramel" },
      { id: "8278", flavour: "Banoffee Pie" },
      { id: "8280", flavour: "White Chocolate" },
      { id: "8282", flavour: "Chocolate Chip Cookie Dough" },
      { id: "8285", flavour: "Milk Chocolate Coconut" },
      { id: "8287", flavour: "Raspberry Lemon Cheesecake" },
    ],
  },
  {
    name: "USN Trust Crunch Protein Bar 60g",
    brand: "USN",
    category: "Protein Bars",
    size: "60",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "5226", flavour: "Cherry Chocolate" },
      { id: "5228", flavour: "White Chocolate" },
      { id: "5230", flavour: "Salted Caramel" },
    ],
  },
  {
    name: "6Pak Nutrition Protein Wafer 40g",
    brand: "6Pak Nutrition",
    category: "Protein Bars",
    size: "40",
    size_unit: "g",
    product_format: "snack",
    rows: [
      { id: "4552", flavour: "Chocolate" },
      { id: "4553", flavour: "Vanilla" },
      { id: "4554", flavour: "Strawberry" },
      { id: "4557", flavour: "Chocolate", pack_count: 12 },
      { id: "4558", flavour: "Vanilla", pack_count: 12 },
      { id: "4559", flavour: "Strawberry", pack_count: 12 },
    ],
  },
  {
    product_id: "472",
    name: "Critical Cookie Chocolate Chip",
    brand: "Applied Nutrition",
    category: "Protein Bars",
    size: "85",
    size_unit: "g",
    product_format: "snack",
    rows: [{ id: "5234", flavour: "Chocolate Chip" }],
  },
  {
    product_id: "469",
    name: "Critical Cookie Double Chocolate",
    brand: "Applied Nutrition",
    category: "Protein Bars",
    size: "85",
    size_unit: "g",
    product_format: "snack",
    rows: [{ id: "6391", flavour: "Double Chocolate" }],
  },
  {
    name: "7Nutrition Cream Crunch 750g",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "750",
    size_unit: "g",
    product_format: "spread",
    rows: [
      { id: "6904", flavour: "Chocolate Peanut" },
      { id: "6917", flavour: "Salted Caramel" },
      { id: "6919", flavour: "Coconut" },
    ],
  },
  {
    name: "7Nutrition Keto Cream Crunch 750g",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "750",
    size_unit: "g",
    product_format: "spread",
    rows: [
      { id: "7123", flavour: "Coconut" },
      { id: "7133", flavour: "Caramel" },
    ],
  },
  {
    name: "7Nutrition Vege Cream Chocolate Coconut 750g",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "750",
    size_unit: "g",
    product_format: "spread",
    rows: [{ id: "7135", flavour: "Chocolate Coconut" }],
  },
  {
    name: "Warrior RAW Protein Flapjack 75g",
    brand: "Warrior",
    category: "Protein Bars",
    size: "75",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "8373", flavour: "Chocolate Brownie" },
      { id: "8375", flavour: "Salted Caramel" },
      { id: "8377", flavour: "Chocolate Peanut Butter" },
      { id: "8379", flavour: "Red Velvet Cake" },
      { id: "8381", flavour: "White Chocolate Cranberry" },
      { id: "8383", flavour: "Honey Berry" },
      { id: "8385", flavour: "Rainbow Cupcake" },
    ],
  },
  {
    name: "CNP Protein Flapjack Box of 12 x 75g",
    brand: "CNP",
    category: "Protein Bars",
    size: "75",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "4568", flavour: "Lemon Meringue", pack_count: 12 },
      {
        id: "4570",
        flavour: "Chocolate Orange",
        pack_count: 12,
      },
      { id: "4572", flavour: "Cherry & Almond", pack_count: 12 },
      { id: "4580", flavour: "Chocolate", pack_count: 12 },
    ],
  },
  {
    name: "BioTechUSA Peanut Butter 1kg",
    brand: "BioTech USA",
    category: "Protein Bars",
    size: "1000",
    size_unit: "g",
    product_format: "spread",
    rows: [
      { id: "31005", flavour: "Crunchy" },
      { id: "31008", flavour: "Smooth" },
    ],
  },
  {
    name: "PER4M Protein Bar 62g",
    brand: "PER4M",
    category: "Protein Bars",
    size: "62",
    size_unit: "g",
    product_format: "bar",
    rows: [
      { id: "31401", flavour: "Dubai Chocolate" },
      { id: "31410", flavour: "Caramel Biscuit" },
      { id: "31419", flavour: "Cookies N' Creme" },
      { id: "31425", flavour: "Chocatella" },
      { id: "31431", flavour: "Cookie Dough" },
      { id: "31437", flavour: "Chocolate Brownie" },
      { id: "31443", flavour: "Chocolate Peanut Butter" },
      { id: "31452", flavour: "Salted Caramel" },
    ],
  },
];

const SOURCE_ALIASES = [
  {
    external_product_id: "5232",
    external_variant_id: "5232",
    canonical_external_product_id: "4551",
    canonical_external_variant_id: "4553",
    reason: "DUPLICATE_SINGLE_VANILLA_WAFER_PAGE",
  },
  {
    external_product_id: "6286",
    external_variant_id: "6286",
    canonical_external_product_id: "4551",
    canonical_external_variant_id: "4554",
    reason: "DUPLICATE_SINGLE_STRAWBERRY_WAFER_PAGE",
  },
  {
    external_product_id: "6301",
    external_variant_id: "6301",
    canonical_external_product_id: "4551",
    canonical_external_variant_id: "4552",
    reason: "DUPLICATE_SINGLE_CHOCOLATE_WAFER_PAGE",
  },
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

function build(sourceSnapshot, decisions) {
  if (
    decisions.approved !== true ||
    decisions.kind !== "six-pack-reviewed-food-policy-v12" ||
    decisions.policy.food_default !== "EXCLUDE" ||
    decisions.policy.reviewed_food_exceptions !== "ALLOW" ||
    decisions.source_snapshot_fingerprint !==
      sourceSnapshot.snapshot_fingerprint
  ) {
    fail("Reviewed food decision binding mismatch");
  }
  const byId = new Map(
    (sourceSnapshot.records || []).map((row) => [
      String(row.source_record_id),
      row,
    ])
  );
  const families = FAMILY_SPECS.map((spec) => {
    const sourceRows = spec.rows.map((row) => byId.get(row.id));
    if (
      sourceRows.some(
        (row) =>
          !row ||
          row.policy_state !== "ELIGIBLE" ||
          !row.categories.includes("Guilt-free")
      )
    ) {
      fail(`Reviewed food source drift for ${spec.name}`);
    }
    return {
      external_product_id: String(sourceRows[0].external_product_id),
      name: spec.name,
      brand: spec.brand,
      category: spec.category,
      size: spec.size,
      size_unit: spec.size_unit,
      slug: slugify(spec.name),
      product_format: spec.product_format,
      ...(spec.product_id ? { product_id: spec.product_id } : {}),
      kind: spec.product_id
        ? "EXISTING_CANONICAL_PRODUCT"
        : "NEW_CANONICAL_PRODUCT",
      price: Math.min(
        ...sourceRows.map((row) => Number(row.price))
      ).toFixed(2),
      image: sourceRows[0].image_url || null,
      variants: sourceRows.map((source, index) => ({
        external_product_id: String(source.external_product_id),
        external_variant_id: String(source.external_variant_id),
        source_flavour:
          source.external_options?.Flavour ||
          source.external_options?.Flavours ||
          source.external_options?.Flavor ||
          null,
        flavour: spec.rows[index].flavour,
        ...(spec.rows[index].pack_count
          ? { pack_count: spec.rows[index].pack_count }
          : {}),
        in_stock: Boolean(source.in_stock),
      })),
    };
  });
  const variantIds = families.flatMap((family) =>
    family.variants.map((variant) => variant.external_variant_id)
  );
  const aliasIds = SOURCE_ALIASES.map(
    (alias) => alias.external_variant_id
  );
  if (
    families.length !== 15 ||
    variantIds.length !== 65 ||
    new Set(variantIds).size !== 65 ||
    aliasIds.some((id) => variantIds.includes(id)) ||
    new Set([...variantIds, ...aliasIds]).size !== 68
  ) {
    fail("Reviewed food family scope mismatch");
  }
  for (const alias of SOURCE_ALIASES) {
    const source = byId.get(alias.external_variant_id);
    if (
      !source ||
      source.policy_state !== "ELIGIBLE" ||
      !source.categories.includes("Guilt-free") ||
      !variantIds.includes(alias.canonical_external_variant_id)
    ) {
      fail(`Reviewed food alias drift for ${alias.external_variant_id}`);
    }
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v12",
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
      food: "EXCLUDE",
      reviewed_food_exceptions: "ALLOW",
      allowed_food_types: decisions.allowed_food_types,
      dmaa: "EXCLUDE",
      yohimbine: "EXCLUDE",
      t5_eca: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      family_mapping: true,
      multi_page_family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.filter(
      (family) => family.kind === "NEW_CANONICAL_PRODUCT"
    ).length,
    row_count: variantIds.length,
    source_candidate_count: variantIds.length + SOURCE_ALIASES.length,
    source_aliases: SOURCE_ALIASES,
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
  fs.writeFileSync(
    options.output,
    `${JSON.stringify(approval, null, 2)}\n`
  );
  return {
    result: "PASS",
    database_writes: 0,
    family_count: approval.family_count,
    row_count: approval.row_count,
    source_candidate_count: approval.source_candidate_count,
    source_alias_count: approval.source_aliases.length,
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

module.exports = {
  FAMILY_SPECS,
  SOURCE_ALIASES,
  build,
  parseArgs,
};
