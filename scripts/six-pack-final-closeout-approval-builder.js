const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_ID =
  "3da223519802bf0a786c20936d027fadb3be86b51954fc3fa11416127c3c3ae2";
const DECISION_ARTIFACT_FINGERPRINT =
  "9acbe77d8c3d837b5b516fa544389357e5e70e7efe7728aa27a7333239d68a93";
const SOURCE = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-source-snapshot.json");
const DECISIONS = path.join(ROOT, "tmp", "product-match-decisions", "final-closeout-2026-07-29", `${SNAPSHOT_ID}-decisions.json`);
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-reviewed-large-family-batch-v15.json");

function row(id, flavour = "Unflavoured", values = {}) {
  return { id: String(id), flavour, ...values };
}

function single(id, name, brand, category, dimension, product_format) {
  return {
    name,
    brand,
    category,
    ...dimension,
    product_format,
    rows: [row(id)],
  };
}

const FAMILY_SPECS = [
  single("11477", "Trec Nutrition MCT Gold Oil 400ml", "Trec Nutrition", "Health Supplements", { size: "400", size_unit: "ml" }, "liquid"),
  {
    name: "Real Pharm Crea-Stack 420g",
    brand: "Real Pharm",
    category: "Creatine",
    size: "420",
    size_unit: "g",
    product_format: "powder",
    rows: [row("16689", "Mango-Passion Fruit")],
  },
  single("23149", "Nordic Labs Fadogia Agrestis 60 Capsules", "Nordic Labs", "Testosterone Boosters", { unit_count: 60, unit_type: "capsule" }, "capsule"),
  {
    name: "Skull Labs Angel Dust PUMP Pre-Workout",
    brand: "Skull Labs",
    category: "Pre Workout",
    unit_count: 1,
    unit_type: "tub",
    product_format: "powder",
    rows: [
      row("29091", "Watermelon Explosion"),
      row("29094", "Blue Raspberry Attack"),
      row("29097", "Crazy Lychee"),
    ],
  },
  {
    name: "Applied Nutrition High Protein Shake 500ml",
    brand: "Applied Nutrition",
    category: "Protein Powder",
    size: "500",
    size_unit: "ml",
    product_format: "ready-to-drink",
    rows: [
      row("29475", "Double Chocolate", { pack_count: 1, display_name: "Double Chocolate / 1 Bottle / 500ml" }),
      row("29478", "Double Chocolate", { pack_count: 8, display_name: "Double Chocolate / 8-Pack / 500ml" }),
      row("29481", "Strawberries & Cream", { pack_count: 1, display_name: "Strawberries & Cream / 1 Bottle / 500ml" }),
      row("29484", "Strawberries & Cream", { pack_count: 8, display_name: "Strawberries & Cream / 8-Pack / 500ml" }),
      row("29496", "Vanilla Ice Cream", { pack_count: 1, display_name: "Vanilla Ice Cream / 1 Bottle / 500ml" }),
      row("29499", "Vanilla Ice Cream", { pack_count: 8, display_name: "Vanilla Ice Cream / 8-Pack / 500ml" }),
      row("29505", "Banana Delight", { pack_count: 1, display_name: "Banana Delight / 1 Bottle / 500ml" }),
      row("29508", "Banana Delight", { pack_count: 8, display_name: "Banana Delight / 8-Pack / 500ml" }),
    ],
  },
  single("29832", "7Nutrition Green Detox Superfood & Antioxidant Formula 225g", "7Nutrition", "Health Supplements", { size: "225", size_unit: "g" }, "powder"),
  single("31059", "ALLNUTRITION Vitamin B12 Methyl Drops 30ml", "ALLNUTRITION", "Vitamins", { size: "30", size_unit: "ml" }, "liquid"),
  single("31140", "ALLNUTRITION ADEK Vitamins Drops 30ml", "ALLNUTRITION", "Vitamins", { size: "30", size_unit: "ml" }, "liquid"),
  single("40045", "Nordic Labs Gold Stack Mushroom Complex 90 Capsules", "Nordic Labs", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("40054", "Nordic Labs Lion's Mane Mushroom 90 Capsules", "Nordic Labs", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("40063", "Nordic Labs Reishi Mushroom 90 Capsules", "Nordic Labs", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("4104", "BioTech USA Fiber Mix 225g", "BioTech USA", "Health Supplements", { size: "225", size_unit: "g" }, "powder"),
  single("4130", "Good Guru Black Maca + Ginseng 90 Capsules", "Good Guru", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("4137", "Good Guru Organic Ashwagandha KSM-66 90 Capsules", "Good Guru", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("4155", "Good Guru Gold Shilajit + Ashwagandha KSM-66 90 Capsules", "Good Guru", "Health Supplements", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("4442", "NOW Foods Maca 500mg 100 Veg Capsules", "NOW Foods", "Health Supplements", { unit_count: 100, unit_type: "capsule" }, "capsule"),
  single("4518", "Himalaya Cystone 100 Tablets", "Himalaya", "Health Supplements", { unit_count: 100, unit_type: "tablet" }, "tablet"),
  single("6740", "Trec Nutrition Clenburexin 90 Capsules", "Trec Nutrition", "Fat Burners", { unit_count: 90, unit_type: "capsule" }, "capsule"),
  single("8146", "Applied Nutrition Zinc 90 Tablets", "Applied Nutrition", "Vitamins", { unit_count: 90, unit_type: "tablet" }, "tablet"),
  single("8222", "7Nutrition Lactoferrin & Prebiotic 20 Sachets", "7Nutrition", "Health Supplements", { unit_count: 20, unit_type: "sachet" }, "sachet"),
  existing(1100, "Applied Nutrition Critical Oats Protein Porridge 600g", "Applied Nutrition", "Protein Powder", { size: "600", size_unit: "g" }, "powder", [
    row("29328", "Salted Caramel"),
    row("29331", "Chocolate"),
    row("4610", "Golden Syrup"),
  ]),
  existing(364, "7Nutrition Apple Cinnamon Jam 1000g", "7Nutrition", "Protein Bars", { size: "1000", size_unit: "g" }, "spread", [
    row("30078", "Blueberry"),
    row("30084", "Mango"),
    row("7191", "Cherry"),
    row("7189", "Apple Cinnamon", { supplemental: true }),
  ]),
  existing(1121, "ALLNUTRITION Nutlove Sauce 280g", "ALLNUTRITION", "Protein Bars", { size: "280", size_unit: "g" }, "spread", [
    row("31029", "White Chocolate with Raspberries"),
    row("31041", "Choco Hazelnut"),
  ]),
  existing(181, "Uncle Jack's Free Range Liquid Egg White 970ml", "Uncle Jack's", "Protein Bars", { size: "970", size_unit: "ml" }, "liquid", [
    row("31389", "Unflavoured", { pack_count: 1, display_name: "1 Bottle / 970ml" }),
    row("31392", "Unflavoured", { pack_count: 3, display_name: "3 Bottles / 970ml" }),
    row("31395", "Unflavoured", { pack_count: 6, display_name: "6 Bottles / 970ml" }),
  ]),
  existing(328, "Per4m Isolate Zero 900g", "Per4m", "Health Supplements", { size: "900", size_unit: "g" }, "powder", [
    row("32571", "Strawberry Creme", { product_variant_id: "1970" }),
  ]),
  existing(1099, "BioTech USA Protein Pancake 1kg", "BioTech USA", "Protein Powder", { size: "1000", size_unit: "g" }, "powder", [
    row("4589", "Chocolate"),
  ]),
  existing(1094, "7Nutrition Selenium 120 Vege Capsules", "7Nutrition", "Vitamins", { unit_count: 120, unit_type: "capsule" }, "capsule", [
    row("4642", "Unflavoured", { product_variant_id: "2375" }),
  ]),
  {
    name: "7Nutrition Steel Joints Drink 450g",
    brand: "7Nutrition",
    category: "Health Supplements",
    size: "450",
    size_unit: "g",
    product_format: "powder",
    rows: [row("29226", "Cherry"), row("4660", "Orange"), row("4662", "Lemon")],
  },
  existing(507, "Animal Cuts Fat Burner 42 Packs", "Animal/Universal", "Weight Management", { unit_count: 42, unit_type: "pack" }, null, [
    row("4876", null, { is_default: true, product_variant_id: "471", product_format: null }),
  ]),
  existing(1118, "Applied Nutrition Flavo Drops 38ml", "Applied Nutrition", "Health Supplements", { size: "38", size_unit: "ml" }, "liquid", [
    row("5023", "Toffee Caramel"),
    row("5027", "Coffee"),
  ]),
  existing(1119, "BioTech USA Zero Syrup", "BioTech USA", "Health Supplements", { unit_count: 1, unit_type: "bottle" }, "liquid", [
    row("5131", "Pancake Maple"),
  ]),
  existing(357, "Mars M&M Peanut Hi Protein Bar", "Mars", "Protein Bars", { unit_count: 1, unit_type: "bar" }, "bar", [
    row("5215", null, { is_default: true, product_variant_id: "325", product_format: null }),
  ]),
  existing(1120, "Callowfit Sauce 300ml", "Callowfit", "Health Supplements", { size: "300", size_unit: "ml" }, "liquid", [
    row("5247", "Fancy Garlic"), row("5253", "Honey Mustard"), row("5259", "Sweet Chilli"), row("5263", "Tomato Ketchup"),
    row("5273", "Salty Caramel"), row("5278", "Raspberry"), row("6005", "Vanilla Style"), row("6008", "Cesar Style Dressing"),
  ]),
  existing(1076, "6Pak Nutrition Protein Wafer 40g", "6Pak Nutrition", "Protein Bars", { size: "40", size_unit: "g" }, "snack", [
    row("6286", "Strawberry", { product_variant_id: "2308" }),
    row("6301", "Chocolate", { product_variant_id: "2306" }),
  ]),
  existing(424, "NXT Nutrition Cream Of Rice 2kg", "NXT Nutrition", "Health Supplements", { size: "2000", size_unit: "g" }, "powder", [
    row("6584", "Apple Pie"), row("6586", "Gingerbread"),
  ]),
  existing(506, "Creatine Gummies 400g 80 Gummies  Applied Nutrition", "Applied Nutrition", "Creatine", { size: "400", size_unit: "g" }, "gummy", [
    row("69811", "Blue Raspberry", { product_variant_id: "1798" }),
    row("69814", "Cola Blast"),
    row("69817", "Millions Blackcurrant"),
  ]),
  existing(216, "Trec Sleep-er 225g", "Trec Nutrition", "Vitamins", { size: "225", size_unit: "g" }, "powder", [
    row("7567", "Orange"),
  ]),
  existing(59, "5% Nutrition Rich Piana 5150 375g", "5% Nutrition", "Pre Workout", { size: "375", size_unit: "g" }, "powder", [
    row("8628", "Green Apple", { product_variant_id: "1612" }),
  ]),
];

function existing(product_id, name, brand, category, dimension, product_format, rows) {
  return { product_id: String(product_id), name, brand, category, ...dimension, product_format, rows };
}

const SOURCE_ALIASES = [
  alias("29820", "29814", "29817", "SOURCE_CORRUPT_VEGAN_MULTIVITAMIN_FLAVOUR_ALIAS"),
  alias("29823", "29814", "29817", "SOURCE_CORRUPT_VEGAN_MULTIVITAMIN_FLAVOUR_ALIAS"),
  alias("29826", "29814", "29817", "SOURCE_CORRUPT_VEGAN_MULTIVITAMIN_FLAVOUR_ALIAS"),
];

const COVERED_DUPLICATE_ALIASES = [
  {
    approved_external_variant_id: "4642",
    existing_external_product_id: "3915",
    existing_external_variant_id: "3915",
    product_variant_id: "2375",
    reason: "DUPLICATE_SELENIUM_PAGE_ALREADY_AUTOMATED",
  },
  {
    approved_external_variant_id: "6286",
    existing_external_product_id: "4551",
    existing_external_variant_id: "4554",
    product_variant_id: "2308",
    reason: "DUPLICATE_SINGLE_STRAWBERRY_WAFER_PAGE_ALREADY_AUTOMATED",
  },
  {
    approved_external_variant_id: "6301",
    existing_external_product_id: "4551",
    existing_external_variant_id: "4552",
    product_variant_id: "2306",
    reason: "DUPLICATE_SINGLE_CHOCOLATE_WAFER_PAGE_ALREADY_AUTOMATED",
  },
];

const EXISTING_SLUGS = new Map([
  ["59", "5-nutrition-rich-piana-5150-375g"],
  ["181", "uncle-jacks-free-range-liquid-egg-white-970ml"],
  ["216", "trec-sleep-er-225g"],
  ["328", "per4m-isolate-zero-900g"],
  ["357", "mars-mm-peanut-hi-protein-bar"],
  ["364", "7nutrition-apple-cinnamon-jam-1000g"],
  ["424", "nxt-nutrition-cream-of-rice-2kg"],
  ["506", "creatine-gummies-400g-80-gummies--applied-nutrition"],
  ["507", "animal-cuts-fat-burner-42-packs"],
  ["1076", "6pak-nutrition-protein-wafer-40g"],
  ["1094", "7nutrition-selenium-120-vege-capsules"],
  ["1099", "biotech-usa-protein-pancake-1kg"],
  ["1100", "applied-nutrition-critical-oats-protein-porridge-600g"],
  ["1118", "applied-nutrition-flavo-drops-38ml"],
  ["1119", "biotech-usa-zero-syrup"],
  ["1120", "callowfit-sauce-300ml"],
  ["1121", "allnutrition-nutlove-sauce-280g"],
]);

function alias(external_variant_id, external_product_id, canonical_external_variant_id, reason) {
  return { external_product_id, external_variant_id, canonical_external_product_id: external_product_id, canonical_external_variant_id, reason };
}

const EXPECTED_DECISIONS = new Map(
  FAMILY_SPECS.flatMap((family) =>
    family.rows
      .filter((item) => !item.supplemental)
      .map((item) => [
        item.id,
        {
          decision: item.product_variant_id
            ? "APPROVE_EXISTING_VARIANT"
            : family.product_id
              ? "APPROVE_NEW_VARIANT_SEED"
              : family.rows.length === 1
                ? (item.id === "16689" ? "APPROVE_NEW_FAMILY_SEED" : "APPROVE_NEW_PRODUCT")
                : ["29091", "29496", "4660"].includes(item.id)
                  ? "APPROVE_NEW_FAMILY_SEED"
                  : "APPROVE_NEW_VARIANT_SEED",
          product_id: family.product_id || "",
          variant_id: item.product_variant_id || "",
        },
      ])
  )
);

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugify(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  const sealedConfig = path.join(ROOT, "config", "retailers", "six-pack-reviewed-large-family-batch-v15.json");
  if (
    (!relative || relative.startsWith("..") || path.isAbsolute(relative)) &&
    output !== sealedConfig
  ) fail("Output must be inside repository tmp or the exact V15 reviewed config");
  return { output };
}

function sourceFlavour(source) {
  return source.external_options?.Flavour || source.external_options?.FLAVOUR || source.external_options?.Flavor || source.external_options?.["Pack size"] || source.external_options?.Size || null;
}

function build(sourceSnapshot, decisionArtifact) {
  if (sourceSnapshot.snapshot_fingerprint !== SNAPSHOT_ID || decisionArtifact.snapshot_id !== SNAPSHOT_ID || decisionArtifact.artifact_fingerprint !== DECISION_ARTIFACT_FINGERPRINT) {
    fail("Final closeout artifact binding mismatch");
  }
  const previous = JSON.parse(fs.readFileSync(path.join(ROOT, "tmp", "product-match-decisions", "resume-automation-2026-07-28", `${SNAPSHOT_ID}-decisions.json`), "utf8"));
  const oldIds = new Set(previous.rows.filter((item) => item.reviewer_decision).map((item) => item.review_item_id));
  const remaining = decisionArtifact.rows.filter((item) => !oldIds.has(item.review_item_id));
  const actionable = remaining.filter((item) => String(item.reviewer_decision).startsWith("APPROVE_"));
  const aliases = remaining.filter((item) => ["29820", "29823", "29826"].includes(String(item.source_record_id)));
  const deferred = remaining.filter((item) => item.reviewer_decision === "DEFER_POLICY");
  const rejected = remaining.filter((item) => item.reviewer_decision === "REJECT_IDENTITY");
  if (
    remaining.length !== 83 || actionable.length !== 68 || EXPECTED_DECISIONS.size !== 68 ||
    deferred.length !== 2 || rejected.length !== 13 ||
    actionable.some((item) => {
      const expected = EXPECTED_DECISIONS.get(String(item.source_record_id));
      return !expected || item.reviewer_decision !== expected.decision ||
        String(item.selected_canonical_product_id || "") !== expected.product_id ||
        String(item.selected_canonical_variant_id || "") !== expected.variant_id ||
        !item.decision_fingerprint;
    }) ||
    aliases.some((item) => item.reviewer_decision !== "REJECT_IDENTITY")
  ) fail("Final reviewed decision scope drift");

  const sourceById = new Map(sourceSnapshot.records.map((item) => [String(item.source_record_id), item]));
  const families = FAMILY_SPECS.map((spec) => {
    const sources = spec.rows.map((item) => sourceById.get(item.id));
    if (sources.some((item) => !item || item.policy_state !== "ELIGIBLE" || item.published !== true)) fail(`Approved source identity drift for ${spec.name}`);
    return {
      external_product_id: String(sources[0].external_product_id),
      name: spec.name,
      brand: spec.brand,
      category: spec.category,
      ...(spec.size ? { size: spec.size, size_unit: spec.size_unit } : { unit_count: spec.unit_count, unit_type: spec.unit_type }),
      slug: EXISTING_SLUGS.get(String(spec.product_id)) || slugify(spec.name),
      product_format: spec.product_format,
      ...(spec.product_id ? { product_id: spec.product_id, existing_match_evidence: { method: "FINAL_OWNER_REVIEWED_CLOSEOUT" } } : {}),
      kind: spec.product_id ? "EXISTING_CANONICAL_PRODUCT" : "NEW_CANONICAL_PRODUCT",
      price: Math.min(...sources.map((item) => Number(item.price))).toFixed(2),
      image: sources[0].image_url || null,
      variants: sources.map((source, index) => {
        const reviewed = spec.rows[index];
        return {
          external_product_id: String(source.external_product_id),
          external_variant_id: String(source.external_variant_id),
          source_flavour: sourceFlavour(source),
          flavour: reviewed.flavour,
          ...(reviewed.pack_count ? { pack_count: reviewed.pack_count } : {}),
          ...(reviewed.display_name ? { display_name: reviewed.display_name } : {}),
          ...(reviewed.is_default ? { is_default: true } : {}),
          ...(reviewed.product_variant_id ? { product_variant_id: reviewed.product_variant_id } : {}),
          ...(Object.prototype.hasOwnProperty.call(reviewed, "product_format") ? { product_format: reviewed.product_format } : {}),
          in_stock: Boolean(source.in_stock),
        };
      }),
    };
  });
  const ids = families.flatMap((family) => family.variants.map((item) => item.external_variant_id));
  if (families.length !== 38 || families.filter((item) => item.kind === "NEW_CANONICAL_PRODUCT").length !== 21 || ids.length !== 69 || new Set(ids).size !== 69) {
    fail("Final closeout family scope mismatch");
  }
  for (const sourceAlias of SOURCE_ALIASES) {
    const source = sourceById.get(sourceAlias.external_variant_id);
    if (!source || source.policy_state !== "ELIGIBLE") fail(`Source alias drift for ${sourceAlias.external_variant_id}`);
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v15",
    approved: true,
    approval_source: "ADMIN_REVIEW_USER_FINAL_CLOSEOUT_CONFIRMATION",
    approved_at: "2026-07-29",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_snapshot_fingerprint: SNAPSHOT_ID,
    decision_artifact_fingerprint: DECISION_ARTIFACT_FINGERPRINT,
    policy: {
      dated_products: "EXCLUDE",
      sarms: "EXCLUDE",
      peptides: "EXCLUDE",
      food: "EXCLUDE",
      reviewed_food_exceptions: "ALLOW",
      allowed_food_types: ["sauces", "syrups", "jams", "spreads", "protein bars", "protein cookies", "porridge and oats", "pancake mixes", "ready-to-drink shakes", "liquid egg whites"],
      dmaa: "EXCLUDE",
      yohimbine: "EXCLUDE",
      t5_eca: "EXCLUDE",
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      reuse_existing_products_first: true,
      family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.filter((item) => item.kind === "NEW_CANONICAL_PRODUCT").length,
    row_count: ids.length,
    source_candidate_count: ids.length + SOURCE_ALIASES.length,
    source_aliases: SOURCE_ALIASES,
    covered_duplicate_aliases: COVERED_DUPLICATE_ALIASES,
    final_classification: {
      reviewed_remaining_rows: 83,
      actionable_decisions: 68,
      supplemental_exact_rows: 1,
      prohibited_rows: 10,
      deferred_rows: 2,
      source_alias_rows: 6,
    },
    families,
    approval_fingerprint: null,
  };
  approval.approval_fingerprint = sha256(JSON.stringify(approval));
  return approval;
}

function run(options) {
  const approval = build(JSON.parse(fs.readFileSync(SOURCE, "utf8")), JSON.parse(fs.readFileSync(DECISIONS, "utf8")));
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(approval, null, 2)}\n`);
  return { result: "PASS", database_writes: 0, family_count: approval.family_count, new_product_count: approval.new_product_count, row_count: approval.row_count, source_candidate_count: approval.source_candidate_count, approval_fingerprint: approval.approval_fingerprint, output: path.relative(ROOT, options.output) };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { DECISION_ARTIFACT_FINGERPRINT, EXPECTED_DECISIONS, FAMILY_SPECS, SNAPSHOT_ID, SOURCE_ALIASES, build, parseArgs };
