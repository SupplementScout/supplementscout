const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = require("../config/retailers/six-pack-supplements-woocommerce.json");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements", "six-pack-approved-offer-manifest-expanded.json");

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function money(value) {
  return Number(value).toFixed(2);
}

function parseArgs(argv) {
  if (argv.length > 1 || (argv[0] && !argv[0].startsWith("--output="))) fail("Usage: --output=<tmp path>");
  const output = path.resolve(argv[0]?.slice("--output=".length) || DEFAULT_OUTPUT);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}

function buildManifest({ retailer, mappings, offers }) {
  if (
    String(retailer.id) !== String(CONFIG.automation.retailer_id) ||
    retailer.slug !== CONFIG.retailer.slug ||
    retailer.website !== CONFIG.retailer.website ||
    mappings.length === 0 ||
    offers.length !== mappings.length
  ) fail("Retailer production scope mismatch");
  const offerByMapping = new Map();
  for (const offer of offers) {
    const key = String(offer.retailer_product_id);
    if (offerByMapping.has(key)) fail(`Duplicate offer for mapping ${key}`);
    offerByMapping.set(key, offer);
  }
  const rows = mappings
    .map((mapping) => {
      const offer = offerByMapping.get(String(mapping.id));
      const expectedShipping = Number(offer.price) < Number(CONFIG.shipping_policy.free_shipping_threshold)
        ? CONFIG.shipping_policy.below_threshold
        : CONFIG.shipping_policy.at_or_above_threshold;
      if (
        !offer ||
        String(offer.product_id) !== String(mapping.product_id) ||
        String(offer.product_variant_id) !== String(mapping.product_variant_id) ||
        money(offer.shipping_cost) !== money(expectedShipping) ||
        money(offer.total_price) !== money(Number(offer.price) + Number(expectedShipping))
      ) fail(`Offer binding or shipping drift for mapping ${mapping.id}`);
      return {
        mapping_id: String(mapping.id),
        offer_id: String(offer.id),
        external_product_id: String(mapping.external_product_id),
        external_variant_id: String(mapping.external_variant_id),
        canonical_product_id: String(mapping.product_id),
        canonical_variant_id: String(mapping.product_variant_id)
      };
    })
    .sort((left, right) => Number(left.mapping_id) - Number(right.mapping_id));
  if (
    new Set(rows.map((row) => row.external_variant_id)).size !== rows.length ||
    new Set(rows.map((row) => row.offer_id)).size !== rows.length
  ) fail("Manifest contains duplicate external variants or offers");
  return {
    schema_version: 1,
    manifest_type: "six_pack_supplements_approved_offer_scope",
    approved: true,
    retailer: {
      id: Number(retailer.id),
      name: retailer.name,
      slug: retailer.slug,
      website: retailer.website,
      source_platform: "WOOCOMMERCE"
    },
    approved_mapping_count: rows.length,
    shipping_policy: {
      mode: "standard_delivery_below_threshold",
      free_shipping_threshold_gbp: CONFIG.shipping_policy.free_shipping_threshold,
      shipping_cost_gbp: CONFIG.shipping_policy.below_threshold,
      shipping_cost_at_or_above_threshold_gbp: CONFIG.shipping_policy.at_or_above_threshold,
      source: CONFIG.shipping_policy.source,
      confirmed_at: CONFIG.shipping_policy.confirmed_at
    },
    discovery_policy: {
      mode: "report_only",
      catalogue_creates: false
    },
    rows
  };
}

function client() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function run(options, dependencies = {}) {
  const db = dependencies.client || client();
  const [retailerResult, mappingsResult, offersResult] = await Promise.all([
    db.from("retailers").select("id,name,slug,website").eq("id", CONFIG.automation.retailer_id),
    db.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id").eq("retailer_id", CONFIG.automation.retailer_id),
    db.from("offers").select("id,retailer_id,product_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price").eq("retailer_id", CONFIG.automation.retailer_id)
  ]);
  for (const result of [retailerResult, mappingsResult, offersResult]) if (result.error) throw result.error;
  if (retailerResult.data.length !== 1) fail("Retailer is missing or duplicated");
  const manifest = buildManifest({
    retailer: retailerResult.data[0],
    mappings: mappingsResult.data,
    offers: offersResult.data
  });
  const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, bytes);
  return {
    result: "PASS",
    database_writes: 0,
    approved_mapping_count: manifest.approved_mapping_count,
    approved_product_page_count: new Set(manifest.rows.map((row) => row.external_product_id)).size,
    manifest_sha256: sha256(bytes),
    output: path.relative(ROOT, options.output)
  };
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { buildManifest, parseArgs };
