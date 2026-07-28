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
  "six-pack-reviewed-accessory-policy-v13.json"
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-large-family-batch-v13.json"
);

const FAMILY_SPECS = [
  {
    name: "Waist Slimming Sweat Belt",
    brand: "Unknown",
    unit_count: 1,
    unit_type: "piece",
    option_name: "Size",
    rows: [{ id: "1497", flavour: "One Size" }],
  },
  {
    product_id: "83",
    product_variant_id: "37",
    name: "Applied Nutrition Lifestyle Water Bottle 1L",
    slug: "applied-nutrition-lifestyle-water-bottle-1l",
    brand: "Applied Nutrition",
    size: "1000",
    size_unit: "ml",
    option_name: null,
    existing_match_evidence: {
      method: "EXACT_BRAND_MODEL_CAPACITY_AND_EXTERNAL_SKU",
      external_sku: "0634158938573",
      existing_retailer_external_sku: "0634158938573",
    },
    rows: [
      {
        id: "2832",
        flavour: null,
        is_default: true,
        product_format: null,
        product_variant_id: "37",
      },
    ],
  },
  {
    name: "Applied Nutrition Protein Shaker 600ml",
    brand: "Applied Nutrition",
    size: "600",
    size_unit: "ml",
    option_name: "Style",
    rows: [{ id: "66976", flavour: "Standard" }],
  },
  {
    name: "Applied Nutrition Protein Shaker 400ml",
    brand: "Applied Nutrition",
    size: "400",
    size_unit: "ml",
    option_name: "Style",
    rows: [{ id: "66979", flavour: "Standard" }],
  },
  {
    name: "Applied Nutrition ABE Protein Shaker 700ml",
    brand: "Applied Nutrition",
    size: "700",
    size_unit: "ml",
    option_name: "Style",
    rows: [{ id: "67009", flavour: "ABE Black" }],
  },
  {
    name: "Applied Nutrition ABE Water Jug 2.5L",
    brand: "Applied Nutrition",
    size: "2500",
    size_unit: "ml",
    option_name: "Style",
    rows: [{ id: "68428", flavour: "ABE Black" }],
  },
  {
    name: "Applied Nutrition Stainless Steel Shaker 750ml",
    brand: "Applied Nutrition",
    size: "750",
    size_unit: "ml",
    option_name: "Style",
    rows: [{ id: "68437", flavour: "Blue" }],
  },
  {
    name: "Power System No Compromise PS-2700 Gloves",
    brand: "Power System",
    unit_count: 1,
    unit_type: "pair",
    option_name: "Size",
    rows: [{ id: "3097", flavour: "M" }],
  },
  {
    product_id: "82",
    name: "BioTech USA Wave Shaker 600ml",
    slug: "biotech-usa-wave-shaker-600ml",
    brand: "BioTech USA",
    size: "600",
    size_unit: "ml",
    option_name: "Colour",
    existing_match_evidence: {
      method: "EXACT_MANUFACTURER_MODEL_CAPACITY_AND_VISUAL_FAMILY",
      manufacturer_model: "Wave Shaker",
      manufacturer_capacity_ml: 600,
    },
    rows: [
      { id: "29943", flavour: "Pink" },
      { id: "29946", flavour: "Transparent" },
      { id: "29949", flavour: "Blue" },
      { id: "29952", flavour: "Green" },
    ],
  },
  {
    name: "Applied Nutrition Stainless Steel Flask 500ml",
    brand: "Applied Nutrition",
    size: "500",
    size_unit: "ml",
    option_name: "Colour",
    rows: [
      { id: "69136", flavour: "White" },
      { id: "69139", flavour: "Blue" },
    ],
  },
  {
    name: "Applied Nutrition Cooler Cup 1200ml",
    brand: "Applied Nutrition",
    size: "1200",
    size_unit: "ml",
    option_name: "Colour",
    rows: [
      { id: "69148", flavour: "White" },
      { id: "69151", flavour: "Blue" },
    ],
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
    decisions.kind !== "six-pack-reviewed-accessory-policy-v13" ||
    decisions.policy.accessories !== "ALLOW" ||
    decisions.policy.melatonin_5mg !== "DEFER" ||
    decisions.policy.nmn !== "DEFER" ||
    decisions.policy.limitlesss_nootropic_brain_booster !== "DEFER" ||
    decisions.policy.vitamin_d3_8000_iu !== "DEFER" ||
    decisions.catalogue_policy.category !== "Accessories" ||
    decisions.catalogue_policy.reuse_existing_products_first !== true ||
    decisions.source_snapshot_fingerprint !==
      sourceSnapshot.snapshot_fingerprint
  ) {
    fail("Reviewed accessory decision binding mismatch");
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
          row.policy_state !== "DEFERRED" ||
          row.policy_code !== "DEFER_ACCESSORY" ||
          !row.categories.includes("Accessories")
      )
    ) {
      fail(`Reviewed accessory source drift for ${spec.name}`);
    }
    const sourceProductIds = new Set(
      sourceRows.map((row) => String(row.external_product_id))
    );
    if (sourceProductIds.size !== 1) {
      fail(`Reviewed accessory family spans unexpected pages for ${spec.name}`);
    }
    return {
      external_product_id: String(sourceRows[0].external_product_id),
      name: spec.name,
      brand: spec.brand,
      category: "Accessories",
      ...(spec.size
        ? { size: spec.size, size_unit: spec.size_unit }
        : {
            unit_count: spec.unit_count,
            unit_type: spec.unit_type,
          }),
      slug: spec.slug || slugify(spec.name),
      product_format: "accessory",
      option_name: spec.option_name,
      ...(spec.product_id ? { product_id: spec.product_id } : {}),
      ...(spec.existing_match_evidence
        ? { existing_match_evidence: spec.existing_match_evidence }
        : {}),
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
          source.external_options?.Colour ||
          source.external_options?.Color ||
          source.external_options?.Size ||
          null,
        flavour: spec.rows[index].flavour,
        ...(spec.rows[index].is_default
          ? { is_default: true }
          : {}),
        ...(spec.rows[index].product_variant_id
          ? {
              product_variant_id:
                spec.rows[index].product_variant_id,
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(
          spec.rows[index],
          "product_format"
        )
          ? { product_format: spec.rows[index].product_format }
          : {}),
        in_stock: Boolean(source.in_stock),
      })),
    };
  });

  const variantIds = families.flatMap((family) =>
    family.variants.map((variant) => variant.external_variant_id)
  );
  if (
    families.length !== 11 ||
    variantIds.length !== 16 ||
    new Set(variantIds).size !== 16 ||
    families.filter(
      (family) => family.kind === "EXISTING_CANONICAL_PRODUCT"
    ).length !== 2 ||
    families.filter(
      (family) => family.kind === "NEW_CANONICAL_PRODUCT"
    ).length !== 9
  ) {
    fail("Reviewed accessory family scope mismatch");
  }

  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v13",
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
      accessories: "ALLOW",
      allowed_accessory_types: decisions.allowed_accessory_types,
      melatonin_5mg: "DEFER",
      nmn: "DEFER",
      limitlesss_nootropic_brain_booster: "DEFER",
      vitamin_d3_8000_iu: "DEFER",
      dmaa: "EXCLUDE",
      yohimbine: "EXCLUDE",
      t5_eca: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      reuse_existing_products_first: true,
      family_mapping: true,
      multi_page_family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.filter(
      (family) => family.kind === "NEW_CANONICAL_PRODUCT"
    ).length,
    row_count: variantIds.length,
    source_candidate_count: variantIds.length,
    source_aliases: [],
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

module.exports = {
  FAMILY_SPECS,
  build,
  parseArgs,
};
