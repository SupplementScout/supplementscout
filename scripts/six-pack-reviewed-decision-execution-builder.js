const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_ID =
  "3da223519802bf0a786c20936d027fadb3be86b51954fc3fa11416127c3c3ae2";
const DECISION_ARTIFACT_FINGERPRINT =
  "e7638b3ee2520af6fc5a2d89f524b27910e79774f7d08ec66f003dceb3a1115a";
const SOURCE = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-source-snapshot.json"
);
const DECISIONS = path.join(
  ROOT,
  "tmp",
  "product-match-decisions",
  "resume-automation-2026-07-28",
  `${SNAPSHOT_ID}-decisions.json`
);
const DEFAULT_OUTPUT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-large-family-batch-v14.json"
);

function single({
  id,
  name,
  brand,
  category,
  size,
  size_unit,
  unit_count,
  unit_type,
  product_format,
  flavour = "Unflavoured",
}) {
  return {
    name,
    brand,
    category,
    ...(size ? { size: String(size), size_unit } : {}),
    ...(unit_count ? { unit_count, unit_type } : {}),
    product_format,
    rows: [{ id: String(id), flavour }],
  };
}

const FAMILY_SPECS = [
  single({
    id: 1546,
    name: "ActivLab Isoactive Electrolyte 630g",
    brand: "ActivLab",
    category: "Electrolytes",
    size: 630,
    size_unit: "g",
    product_format: "powder",
    flavour: "Lemon",
  }),
  single({
    id: 3915,
    name: "7Nutrition Selenium 120 Vege Capsules",
    brand: "7Nutrition",
    category: "Vitamins",
    unit_count: 120,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 4135,
    name: "Good Guru Pearl Shilajit 90 Capsules",
    brand: "Good Guru",
    category: "Health Supplements",
    unit_count: 90,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 4145,
    name: "Good Guru Gold Shilajit Resin 30g",
    brand: "Good Guru",
    category: "Health Supplements",
    size: 30,
    size_unit: "g",
    product_format: "resin",
  }),
  single({
    id: 4150,
    name: "Good Guru Pearl Shilajit Resin 30g",
    brand: "Good Guru",
    category: "Health Supplements",
    size: 30,
    size_unit: "g",
    product_format: "resin",
  }),
  single({
    id: 4493,
    name: "Olimp Nutrition Caffeine Kick 60 Capsules",
    brand: "Olimp Nutrition",
    category: "Energy Supplements",
    unit_count: 60,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 4590,
    name: "BioTech USA Protein Pancake 1kg",
    brand: "BioTech USA",
    category: "Protein Powder",
    size: 1000,
    size_unit: "g",
    product_format: "powder",
    flavour: "Vanilla",
  }),
  single({
    id: 4611,
    name: "Applied Nutrition Critical Oats Protein Porridge 600g",
    brand: "Applied Nutrition",
    category: "Protein Powder",
    size: 600,
    size_unit: "g",
    product_format: "powder",
    flavour: "Cookies & Cream",
  }),
  single({
    id: 4698,
    name: "BioTech USA Caffeine + Taurine 60 Capsules",
    brand: "BioTech USA",
    category: "Energy Supplements",
    unit_count: 60,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 6332,
    name: "Trec Nutrition Multipack Sport Day/Night Formula",
    brand: "Trec Nutrition",
    category: "Vitamins",
    unit_count: 1,
    unit_type: "pack",
    product_format: "pack",
    flavour: "Standard",
  }),
  single({
    id: 6533,
    name: "Animal M-Stak 21 Packs",
    brand: "Animal",
    category: "Workout Supplements",
    unit_count: 21,
    unit_type: "pack",
    product_format: "pack",
  }),
  single({
    id: 6537,
    name: "Animal Pak 44 Packs",
    brand: "Animal",
    category: "Vitamins",
    unit_count: 44,
    unit_type: "pack",
    product_format: "pack",
  }),
  single({
    id: 6738,
    name: "Trec Nutrition Clenburexin 180 Capsules",
    brand: "Trec Nutrition",
    category: "Fat Burners",
    unit_count: 180,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 6742,
    name: "NOW Foods Liquid Chlorophyll Natural Mint 473ml",
    brand: "NOW Foods",
    category: "Health Supplements",
    size: 473,
    size_unit: "ml",
    product_format: "liquid",
    flavour: "Natural Mint",
  }),
  single({
    id: 8151,
    name: "Trec Nutrition Creatine Monohydrate + Taurine 400g",
    brand: "Trec Nutrition",
    category: "Creatine",
    size: 400,
    size_unit: "g",
    product_format: "powder",
  }),
  single({
    id: 8633,
    name: "Trec Nutrition CM3 Tri-Creatine Malate 360 Capsules",
    brand: "Trec Nutrition",
    category: "Creatine",
    unit_count: 360,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 16454,
    name: "Nordic Labs TUDCA & NAC Liver Support 60 Capsules",
    brand: "Nordic Labs",
    category: "Health Supplements",
    unit_count: 60,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 16475,
    name: "Nordic Labs NAC N-Acetyl Cysteine 60 Capsules",
    brand: "Nordic Labs",
    category: "Health Supplements",
    unit_count: 60,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 16488,
    name: "Ultra Nutrio Mr Test 100 Capsules",
    brand: "Ultra Nutrio",
    category: "Testosterone Boosters",
    unit_count: 100,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 29754,
    name: "7Nutrition TCM 1100 Tri-Creatine Malate 350 Capsules",
    brand: "7Nutrition",
    category: "Creatine",
    unit_count: 350,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 29817,
    name: "BioTech USA Vegan Multivitamin 60 Tablets",
    brand: "BioTech USA",
    category: "Vitamins",
    unit_count: 60,
    unit_type: "tablet",
    product_format: "tablet",
  }),
  single({
    id: 29928,
    name: "Ultra Nutrio Limitless Nootropic 100 Capsules",
    brand: "Ultra Nutrio",
    category: "Nootropics",
    unit_count: 100,
    unit_type: "capsule",
    product_format: "capsule",
  }),
  single({
    id: 31065,
    name: "ALLNUTRITION Vitamins A+E Drops 30ml",
    brand: "ALLNUTRITION",
    category: "Vitamins",
    size: 30,
    size_unit: "ml",
    product_format: "liquid",
  }),
  single({
    id: 31071,
    name: "ALLNUTRITION Vitamin D3 4000 + K2 Drops 30ml",
    brand: "ALLNUTRITION",
    category: "Vitamins",
    size: 30,
    size_unit: "ml",
    product_format: "liquid",
  }),
  single({
    id: 31146,
    name: "ALLNUTRITION Vitamin C Drops 30ml",
    brand: "ALLNUTRITION",
    category: "Vitamins",
    size: 30,
    size_unit: "ml",
    product_format: "liquid",
  }),
  {
    name: "Applied Nutrition Flavo Drops 38ml",
    brand: "Applied Nutrition",
    category: "Health Supplements",
    size: "38",
    size_unit: "ml",
    product_format: "liquid",
    rows: [
      { id: "5017", flavour: "Chocolate" },
      { id: "5024", flavour: "Raspberry" },
      { id: "5025", flavour: "Strawberry" },
    ],
  },
  {
    name: "BioTech USA Zero Syrup",
    brand: "BioTech USA",
    category: "Health Supplements",
    unit_count: 1,
    unit_type: "bottle",
    product_format: "liquid",
    rows: [
      { id: "5129", flavour: "Chocolate" },
      { id: "5133", flavour: "Strawberry" },
    ],
  },
  {
    name: "Callowfit Sauce 300ml",
    brand: "Callowfit",
    category: "Health Supplements",
    size: "300",
    size_unit: "ml",
    product_format: "liquid",
    rows: [
      { id: "5251", flavour: "Mayo" },
      { id: "5256", flavour: "Curry Mango" },
      { id: "5261", flavour: "Peri-Peri" },
      { id: "5264", flavour: "Curry Ketchup" },
      { id: "5276", flavour: "Strawberry" },
      { id: "5280", flavour: "Chocolate" },
      { id: "6011", flavour: "Cookies & Cream" },
    ],
  },
  {
    name: "ALLNUTRITION Nutlove Sauce 280g",
    brand: "ALLNUTRITION",
    category: "Protein Bars",
    size: "280",
    size_unit: "g",
    product_format: "spread",
    rows: [
      { id: "31014", flavour: "White Chocolate with Peanuts" },
      { id: "31023", flavour: "Cinnamon Cookie" },
      { id: "31035", flavour: "Crunchy Chocolate & Peanuts" },
    ],
  },
  {
    product_id: "364",
    name: "7Nutrition Apple Cinnamon Jam 1000g",
    slug: "7nutrition-apple-cinnamon-jam-1000g",
    brand: "7Nutrition",
    category: "Protein Bars",
    size: "1000",
    size_unit: "g",
    product_format: "spread",
    existing_match_evidence: {
      method: "OWNER_REVIEWED_SHARED_JAM_FLAVOUR_FAMILY",
    },
    rows: [
      { id: "7194", flavour: "Raspberry" },
      { id: "7196", flavour: "Strawberry" },
      { id: "30081", flavour: "Gooseberry & Kiwi" },
    ],
  },
  {
    product_id: "424",
    name: "NXT Nutrition Cream Of Rice 2kg",
    slug: "nxt-nutrition-cream-of-rice-2kg",
    brand: "NXT Nutrition",
    category: "Health Supplements",
    size: "2000",
    size_unit: "g",
    product_format: "powder",
    existing_match_evidence: {
      method: "OWNER_REVIEWED_SHARED_CREAM_OF_RICE_FLAVOUR_FAMILY",
    },
    rows: [
      { id: "6583", flavour: "Chocolate Coconut" },
      { id: "6585", flavour: "Cinnamon Cereal" },
      { id: "6587", flavour: "Strawberry Cheesecake" },
    ],
  },
  {
    product_id: "956",
    name: "Animal Flex 44 packs",
    slug: "animal-flex-44-packs",
    brand: "Animal",
    category: "Health Supplements",
    unit_count: 44,
    unit_type: "pack",
    product_format: "pack",
    existing_match_evidence: {
      method: "ADMIN_REVIEW_EXACT_EXISTING_VARIANT",
    },
    rows: [
      {
        id: "3087",
        flavour: null,
        is_default: true,
        product_variant_id: "1863",
        product_format: null,
      },
    ],
  },
  {
    product_id: "68",
    name: "7Nutrition Whey Isolate 90 1kg",
    slug: "7nutrition-whey-isolate-90-1kg",
    brand: "7Nutrition",
    category: "Whey Protein",
    size: "1000",
    size_unit: "g",
    product_format: "powder",
    existing_match_evidence: {
      method: "ADMIN_REVIEW_EXACT_EXISTING_VARIANT",
    },
    rows: [
      {
        id: "3991",
        flavour: "Belgian Chocolate",
        source_flavour: "Chocolate",
        display_name: "Belgian Chocolate / 1000g",
        product_variant_id: "1967",
      },
    ],
  },
  {
    product_id: "1076",
    name: "6Pak Nutrition Protein Wafer 40g",
    slug: "6pak-nutrition-protein-wafer-40g",
    brand: "6Pak Nutrition",
    category: "Protein Bars",
    size: "40",
    size_unit: "g",
    product_format: "snack",
    existing_match_evidence: {
      method: "ADMIN_REVIEW_EXACT_EXISTING_VARIANT",
    },
    rows: [
      {
        id: "5232",
        flavour: "Vanilla",
        product_variant_id: "2307",
      },
    ],
  },
  {
    product_id: "983",
    name: "Nordic Labs TestX Pro Turkesterone 60 Capsules",
    slug: "nordic-labs-testx-pro-turkesterone-60-capsules",
    brand: "Nordic Labs",
    category: "Health Supplements",
    unit_count: 60,
    unit_type: "capsule",
    product_format: "capsule",
    existing_match_evidence: {
      method: "ADMIN_REVIEW_EXACT_EXISTING_VARIANT",
    },
    rows: [
      {
        id: "8342",
        flavour: null,
        is_default: true,
        product_variant_id: "1923",
        product_format: null,
      },
    ],
  },
];

const EXPECTED_DECISIONS = new Map([
  ...FAMILY_SPECS.flatMap((family) =>
    family.rows.map((row) => [
      row.id,
      {
        decision: family.product_id
          ? row.product_variant_id
            ? "APPROVE_EXISTING_VARIANT"
            : "APPROVE_NEW_VARIANT_SEED"
          : family.rows.length > 1
            ? row === family.rows[0]
              ? "APPROVE_NEW_FAMILY_SEED"
              : "APPROVE_NEW_VARIANT_SEED"
            : "APPROVE_NEW_PRODUCT",
        product_id: family.product_id || "",
        variant_id: row.product_variant_id || "",
      },
    ])
  ),
]);

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
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) {
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

function sourceOptionFlavour(source) {
  return (
    source.external_options?.Flavour ||
    source.external_options?.FLAVOUR ||
    null
  );
}

function build(sourceSnapshot, decisionArtifact) {
  if (
    sourceSnapshot.snapshot_fingerprint !== SNAPSHOT_ID ||
    decisionArtifact.snapshot_id !== SNAPSHOT_ID ||
    decisionArtifact.artifact_fingerprint !==
      DECISION_ARTIFACT_FINGERPRINT
  ) {
    fail("Reviewed decision artifact binding mismatch");
  }
  const actionable = decisionArtifact.rows.filter((row) =>
    String(row.reviewer_decision).startsWith("APPROVE_")
  );
  if (
    actionable.length !== 50 ||
    EXPECTED_DECISIONS.size !== 50 ||
    actionable.some((row) => {
      const expected = EXPECTED_DECISIONS.get(String(row.source_record_id));
      return (
        !expected ||
        row.reviewer_decision !== expected.decision ||
        String(row.selected_canonical_product_id || "") !==
          expected.product_id ||
        String(row.selected_canonical_variant_id || "") !==
          expected.variant_id ||
        !row.decision_fingerprint
      );
    })
  ) {
    fail("Reviewed actionable decision scope drift");
  }
  const sourceById = new Map(
    sourceSnapshot.records.map((row) => [
      String(row.source_record_id),
      row,
    ])
  );
  const families = FAMILY_SPECS.map((spec) => {
    const rows = spec.rows.map((row) => sourceById.get(row.id));
    if (
      rows.some(
        (row) =>
          !row ||
          row.policy_state !== "ELIGIBLE" ||
          row.published !== true
      )
    ) {
      fail(`Approved source identity drift for ${spec.name}`);
    }
    return {
      external_product_id: String(rows[0].external_product_id),
      name: spec.name,
      brand: spec.brand,
      category: spec.category,
      ...(spec.size
        ? { size: spec.size, size_unit: spec.size_unit }
        : {
            unit_count: spec.unit_count,
            unit_type: spec.unit_type,
          }),
      slug: spec.slug || slugify(spec.name),
      product_format: spec.product_format,
      ...(spec.product_id ? { product_id: spec.product_id } : {}),
      ...(spec.existing_match_evidence
        ? { existing_match_evidence: spec.existing_match_evidence }
        : {}),
      kind: spec.product_id
        ? "EXISTING_CANONICAL_PRODUCT"
        : "NEW_CANONICAL_PRODUCT",
      price: Math.min(...rows.map((row) => Number(row.price))).toFixed(2),
      image: rows[0].image_url || null,
      variants: rows.map((source, index) => {
        const reviewed = spec.rows[index];
        return {
          external_product_id: String(source.external_product_id),
          external_variant_id: String(source.external_variant_id),
          source_flavour: Object.prototype.hasOwnProperty.call(
            reviewed,
            "source_flavour"
          )
            ? reviewed.source_flavour
            : sourceOptionFlavour(source),
          flavour: reviewed.flavour,
          ...(reviewed.display_name
            ? { display_name: reviewed.display_name }
            : {}),
          ...(reviewed.is_default ? { is_default: true } : {}),
          ...(reviewed.product_variant_id
            ? { product_variant_id: reviewed.product_variant_id }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(
            reviewed,
            "product_format"
          )
            ? { product_format: reviewed.product_format }
            : {}),
          in_stock: Boolean(source.in_stock),
        };
      }),
    };
  });
  const variantIds = families.flatMap((family) =>
    family.variants.map((variant) => variant.external_variant_id)
  );
  if (
    families.length !== 35 ||
    families.filter((family) => family.kind === "NEW_CANONICAL_PRODUCT")
      .length !== 29 ||
    variantIds.length !== 50 ||
    new Set(variantIds).size !== 50
  ) {
    fail("Reviewed execution family scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v14",
    approved: true,
    approval_source: "ADMIN_REVIEW_AND_USER_RESUME_CONFIRMATION",
    approved_at: "2026-07-28",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint: SNAPSHOT_ID,
    decision_artifact_fingerprint: DECISION_ARTIFACT_FINGERPRINT,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      food: "EXCLUDE",
      reviewed_food_exceptions: "ALLOW",
      dmaa: "EXCLUDE",
      yohimbine: "EXCLUDE",
      t5_eca: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      reuse_existing_products_first: true,
      family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.filter(
      (family) => family.kind === "NEW_CANONICAL_PRODUCT"
    ).length,
    row_count: variantIds.length,
    source_candidate_count: variantIds.length,
    source_aliases: [],
    covered_duplicate_aliases: [
      {
        approved_external_variant_id: "5232",
        existing_external_product_id: "4551",
        existing_external_variant_id: "4553",
        product_variant_id: "2307",
        reason: "DUPLICATE_SINGLE_VANILLA_WAFER_PAGE_ALREADY_AUTOMATED",
      },
    ],
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

module.exports = {
  DECISION_ARTIFACT_FINGERPRINT,
  EXPECTED_DECISIONS,
  FAMILY_SPECS,
  SNAPSHOT_ID,
  build,
  parseArgs,
};
