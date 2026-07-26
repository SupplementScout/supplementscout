const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  validateReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(
  ROOT,
  "data",
  "verified",
  "variant-nutrition-reviewed-batch-2-v2.json",
);
const REJECTED_V1 = path.join(
  ROOT,
  "data",
  "verified",
  "variant-nutrition-reviewed-batch-2.json",
);
const REJECTED_V1_SHA256 =
  "fcb820a878a95cda7368961980409fe88203a4dfa063c387edf8a4b5bddaf3b5";

const REVIEWED_VARIANTS = Object.freeze([
  Object.freeze({
    product_id: "767",
    expected_product_name: "OstroVit Creatine Monohydrate 300g",
    variant_id: "930",
    expected_variant_key: "orange-300g",
    expected_display_name: "Orange / 300g",
    net_weight_g: 300,
    serving_count_verified: 75,
    serving_size_g: 4,
    creatine_per_serving_g: 3,
    source_url:
      "https://ostrovit.com/en/products/ostrovit-creatine-monohydrate-300-g-16609.html",
    evidence:
      "OstroVit identifies the exact orange 300g variant and declares 75 servings, a 4g serving, 3.4g creatine monohydrate and 3.0g creatine per serving.",
  }),
  Object.freeze({
    product_id: "767",
    expected_product_name: "OstroVit Creatine Monohydrate 300g",
    variant_id: "931",
    expected_variant_key: "unflavored-300g",
    expected_display_name: "Unflavored / 300g",
    net_weight_g: 300,
    serving_count_verified: 100,
    serving_size_g: 3,
    creatine_per_serving_g: 2.64,
    source_url:
      "https://ostrovit.com/en/products/ostrovit-creatine-monohydrate-300-g-16677.html?selected_size=onesize",
    evidence:
      "OstroVit identifies the exact unflavored 300g variant and declares 100 servings, a 3g serving, 3.0g creatine monohydrate and 2.64g creatine per serving.",
  }),
  Object.freeze({
    product_id: "780",
    expected_product_name: "OstroVit Creatine Monohydrate 1000g",
    variant_id: "980",
    expected_variant_key: "lemon-1000g",
    expected_display_name: "lemon / 1000g",
    net_weight_g: 1000,
    serving_count_verified: 333,
    serving_size_g: 3,
    creatine_per_serving_g: 2.288,
    source_url:
      "https://ostrovit.com/en/products/ostrovit-creatine-monohydrate-1000-g-26792.html",
    evidence:
      "OstroVit identifies the exact lemon 1000g variant and declares 333 servings, a 3g serving, 2.6g creatine monohydrate and 2.288g creatine per serving.",
  }),
  Object.freeze({
    product_id: "781",
    expected_product_name: "OstroVit Creatine Monohydrate 500g",
    variant_id: "982",
    expected_variant_key: "green-apple-500g",
    expected_display_name: "Green apple / 500g",
    net_weight_g: 500,
    serving_count_verified: 125,
    serving_size_g: 4,
    creatine_per_serving_g: 3,
    source_url:
      "https://ostrovit.com/en/products/ostrovit-creatine-monohydrate-500-g-16623.html",
    evidence:
      "OstroVit identifies the exact green apple 500g variant and declares 125 servings, a 4g serving, 3.4g creatine monohydrate and 3.0g creatine per serving.",
  }),
  Object.freeze({
    product_id: "781",
    expected_product_name: "OstroVit Creatine Monohydrate 500g",
    variant_id: "983",
    expected_variant_key: "mango-500g",
    expected_display_name: "Mango / 500g",
    net_weight_g: 500,
    serving_count_verified: 125,
    serving_size_g: 4,
    creatine_per_serving_g: 3,
    source_url:
      "https://ostrovit.com/en/products/ostrovit-creatine-monohydrate-500-g-16622.html",
    evidence:
      "OstroVit identifies the exact mango 500g variant and declares 125 servings, a 4g serving, 3.4g creatine monohydrate and 3.0g creatine per serving.",
  }),
]);

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function build() {
  const changes = REVIEWED_VARIANTS.map((row) => {
    const after = {
      net_weight_g: row.net_weight_g,
      serving_count_verified: row.serving_count_verified,
      serving_size_g: row.serving_size_g,
      protein_per_serving_g: null,
      creatine_per_serving_g: row.creatine_per_serving_g,
      product_format: "powder",
      unit_pricing_verified: true,
      nutrition_verified: true,
      source_url: row.source_url,
      source_type: "manufacturer_product_page",
      evidence: row.evidence,
    };
    return {
      product_id: row.product_id,
      expected_product_name: row.expected_product_name,
      variant_id: row.variant_id,
      expected_variant_key: row.expected_variant_key,
      expected_display_name: row.expected_display_name,
      before_nutrition_override: {},
      after_nutrition_override: after,
      source_url: row.source_url,
      evidence: row.evidence,
    };
  }).sort((left, right) =>
    BigInt(left.variant_id) < BigInt(right.variant_id) ? -1 : 1,
  );
  const manifest = {
    schema_version: 1,
    kind: "reviewed-product-variant-nutrition-manifest-v1",
    status: "REVIEWED",
    authorized_by: "user-approved-nutrition-enrichment",
    authorized_at: "2026-07-26T18:20:00.000Z",
    source_policy:
      "Manufacturer product pages for the exact flavour and package size are authoritative. WheyWise was used only for discovery and second-source comparison.",
    reviewed_scope_hash: fingerprint(changes),
    changes,
  };
  validateReviewedManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function main() {
  invariant(
    sha256(fs.readFileSync(REJECTED_V1)) === REJECTED_V1_SHA256,
    "rejected immutable v1 manifest SHA-256 mismatch",
  );
  const output = build();
  if (fs.existsSync(OUTPUT)) {
    invariant(
      fs.readFileSync(OUTPUT, "utf8") === output,
      "immutable reviewed manifest differs",
    );
  } else {
    fs.writeFileSync(OUTPUT, output, { flag: "wx" });
  }
  console.log(JSON.stringify({
    status: "PASS",
    rejected_v1_manifest_sha256: REJECTED_V1_SHA256,
    reviewed_manifest: path.relative(ROOT, OUTPUT).replaceAll("\\", "/"),
    reviewed_manifest_sha256: sha256(Buffer.from(output)),
    reviewed_scope_hash: JSON.parse(output).reviewed_scope_hash,
    products: 3,
    variant_changes: REVIEWED_VARIANTS.length,
    database_writes: 0,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { REVIEWED_VARIANTS, build };
