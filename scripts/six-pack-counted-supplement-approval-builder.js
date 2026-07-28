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
  "six-pack-reviewed-large-family-batch-v9.json"
);

const SOURCE_IDS = [
  "2753", "2755", "2821", "3903", "3908", "3912",
  "3922", "4067", "4131", "4143", "4146", "4162",
  "4300", "4490", "4495", "4599", "4601", "4619",
  "4649", "4861", "4864", "4867", "6526", "6528",
  "6547", "6554", "6556", "6558", "6560", "28774",
  "30945", "30954", "31257", "31263", "31269", "31284",
];

const BRAND_ALIASES = new Map([
  ["7 Nutrition", "7Nutrition"],
  ["Bio Tech USA", "BioTech USA"],
  ["Olimp Sport Nutrition", "Olimp Nutrition"],
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

function productFormat(name) {
  const value = String(name).toLowerCase();
  if (/softgels?\b|gel caps?\b/.test(value)) return "softgel";
  if (/tablets?\b|tabs?\b/.test(value)) return "tablet";
  if (/capsules?\b|caps?\b/.test(value)) return "capsule";
  fail(`Counted supplement format missing for ${name}`);
}

function unitCount(name) {
  const matches = [
    ...String(name).matchAll(
      /(\d+)\s*(?:vege\s+|vegan\s+)?(?:softgels?|gel caps?|capsules?|caps?|tablets?|tabs?)\b/gi
    ),
  ];
  if (!matches.length) fail(`Counted supplement quantity missing for ${name}`);
  return Number(matches.at(-1)[1]);
}

function categoryFor(source) {
  const text = `${source.product_name} ${(source.categories || []).join(" ")}`.toLowerCase();
  if (text.includes("creatine")) return "Creatine";
  if (/\baakg\b|beta-alanine|l-carnitine/.test(text)) return "Amino Acids";
  if (/multi.?vit|mineral|vitamin|omega|zinc|selenium|iodine|biotin|d3|k2|zmb|zma/.test(text)) {
    return "Vitamins";
  }
  return "Health Supplements";
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
  const byId = new Map(
    (sourceSnapshot.records || []).map((row) => [
      String(row.source_record_id),
      row,
    ])
  );
  const families = SOURCE_IDS.map((sourceId) => {
    const source = byId.get(sourceId);
    if (
      !source ||
      source.source_type !== "simple" ||
      String(source.external_product_id) !== sourceId ||
      String(source.external_variant_id) !== sourceId ||
      source.policy_state !== "ELIGIBLE"
    ) {
      fail(`Counted supplement source drift for ${sourceId}`);
    }
    const format = productFormat(source.product_name);
    const count = unitCount(source.product_name);
    const brand =
      BRAND_ALIASES.get(source.brand) || String(source.brand || "").trim();
    if (!brand) fail(`Counted supplement brand missing for ${sourceId}`);
    return {
      external_product_id: sourceId,
      name: String(source.product_name).trim(),
      slug: slugify(source.product_name),
      brand,
      category: categoryFor(source),
      size: null,
      size_unit: null,
      unit_count: count,
      unit_type: format,
      product_format: format,
      expected_count: 1,
      kind: "NEW_CANONICAL_PRODUCT",
      price: Number(source.price).toFixed(2),
      image: source.image_url || null,
      variants: [
        {
          external_variant_id: sourceId,
          source_flavour: null,
          flavour: "Unflavoured",
          in_stock: Boolean(source.in_stock),
        },
      ],
    };
  });
  if (
    families.length !== SOURCE_IDS.length ||
    new Set(families.map((family) => family.slug)).size !== families.length
  ) {
    fail("Counted supplement approval scope mismatch");
  }
  const approval = {
    schema_version: 1,
    kind: "six-pack-reviewed-large-family-batch-v9",
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
      missing_metrics: "LEAVE_NULL_UNTIL_EXPERT_REVIEW",
      family_mapping: true,
      one_shared_automation: true,
    },
    family_count: families.length,
    new_product_count: families.length,
    row_count: families.length,
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

module.exports = { build, categoryFor, parseArgs, productFormat, unitCount };
