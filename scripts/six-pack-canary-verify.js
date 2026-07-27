const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : null;
}

function verifyState(rollout, retailer, mappings, offers, idempotency) {
  if (
    !retailer ||
    retailer.slug !== rollout.retailer_slug ||
    retailer.name !== "6 Pack Supplements" ||
    retailer.website !== "https://6pack-supplements.co.uk"
  ) fail("Retailer identity verification failed");
  if (mappings.length !== rollout.row_count || offers.length !== rollout.row_count) {
    fail(`Expected ${rollout.row_count} mappings and offers`);
  }
  const mappingByExternalVariant = new Map(mappings.map((row) => [String(row.external_variant_id), row]));
  const offerByMapping = new Map(offers.map((row) => [String(row.retailer_product_id), row]));
  if (mappingByExternalVariant.size !== rollout.row_count || offerByMapping.size !== rollout.row_count) {
    fail("Duplicate mapping or offer identity detected");
  }
  for (const expected of rollout.expected_bindings) {
    const mapping = mappingByExternalVariant.get(expected.external_variant_id);
    if (
      !mapping ||
      String(mapping.external_product_id) !== expected.external_product_id ||
      String(mapping.product_id) !== expected.product_id ||
      String(mapping.product_variant_id) !== expected.product_variant_id ||
      mapping.external_url !== expected.external_url
    ) fail(`Mapping verification failed for ${expected.external_variant_id}`);
    const offer = offerByMapping.get(String(mapping.id));
    if (
      !offer ||
      String(offer.product_id) !== expected.product_id ||
      String(offer.product_variant_id) !== expected.product_variant_id ||
      normalizeMoney(offer.price) !== normalizeMoney(expected.price) ||
      offer.in_stock !== expected.in_stock ||
      offer.url !== expected.external_url ||
      offer.shipping_cost !== null ||
      offer.total_price !== null
    ) fail(`Offer verification failed for ${expected.external_variant_id}`);
  }
  if (
    idempotency.blockedRows?.length !== 0 ||
    idempotency.failedRows?.length !== 0 ||
    idempotency.rowLevelOffers?.length !== rollout.row_count ||
    idempotency.plans?.length !== rollout.row_count ||
    idempotency.plans.some((plan) =>
      plan.retailer?.action !== "existing" ||
      !["noop", "verify_no_change"].includes(plan.offer?.action) ||
      plan.price_history?.action !== "noop"
    )
  ) fail("Fresh post-apply dry-run is not idempotent");
  return {
    retailer_id: String(retailer.id),
    mapping_count: mappings.length,
    offer_count: offers.length,
    idempotent_plan_count: idempotency.plans.length,
  };
}

async function run({ rolloutPath, idempotencyPath, outputPath }) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch");
  const rollout = JSON.parse(fs.readFileSync(rolloutPath, "utf8"));
  const idempotency = JSON.parse(fs.readFileSync(idempotencyPath, "utf8"));
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const retailerResult = await client.from("retailers").select("id,name,slug,website").eq("slug", rollout.retailer_slug).limit(2);
  if (retailerResult.error) throw retailerResult.error;
  if (retailerResult.data.length !== 1) fail("Expected exactly one 6 Pack Supplements retailer");
  const retailer = retailerResult.data[0];
  const mappingResult = await client
    .from("retailer_products")
    .select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_url")
    .eq("retailer_id", retailer.id)
    .in("external_variant_id", rollout.expected_external_variant_ids);
  if (mappingResult.error) throw mappingResult.error;
  const offerResult = await client
    .from("offers")
    .select("id,product_id,product_variant_id,retailer_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at")
    .eq("retailer_id", retailer.id)
    .in("retailer_product_id", mappingResult.data.map((row) => row.id));
  if (offerResult.error) throw offerResult.error;
  const verified = verifyState(rollout, retailer, mappingResult.data, offerResult.data, idempotency);
  const report = {
    schema_version: 1,
    kind: "six-pack-production-canary-verification",
    result: "PASS",
    target_project_ref: PROJECT_REF,
    ...verified,
    database_writes: 0,
    verified_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(rollout|idempotency|output)=(.*)$/);
    if (!match || values[match[1]]) fail(`Invalid argument ${argument}`);
    values[match[1]] = path.resolve(match[2]);
  }
  for (const key of ["rollout", "idempotency", "output"]) if (!values[key]) fail(`Required --${key}`);
  const relative = path.relative(path.join(ROOT, "tmp"), values.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return {
    rolloutPath: values.rollout,
    idempotencyPath: values.idempotency,
    outputPath: values.output,
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

module.exports = { normalizeMoney, parseArgs, verifyState };
