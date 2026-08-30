const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { normalizeConnectionString, withPostgresRoleSession } = require("./lib/retailer-offer-sync/production-role-session");

const ROOT = path.resolve(__dirname, "..");
const VALIDATOR_LOGIN = "supplementscout_production_validator_login";
const VALIDATOR_ROLE = "retailer_catalogue_production_validator";
const PROFILES = Object.freeze({
  "simply-supplements": {
    retailerId: "7",
    retailerName: "Simply Supplements",
    credential: "SIMPLY_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL",
  },
});

function invariant(condition, message) { if (!condition) throw new Error(message); }
function hash(value) { return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function baselineHash(value) { const payload = { ...value }; delete payload.evidence_hash; return hash(payload); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function insideTmp(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(path.join(ROOT, "tmp"), resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Evidence paths must stay inside repository tmp");
  return resolved;
}
function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(profile|mode|baseline|execution|output)=(.*)$/);
    invariant(match && values[match[1]] === undefined, `Invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(PROFILES[values.profile], "Unsupported retailer postflight profile");
  invariant(["baseline", "postflight"].includes(values.mode), "Postflight mode must be baseline or postflight");
  invariant(values.output, "Postflight output is required");
  if (values.mode === "postflight") invariant(values.baseline && values.execution, "Postflight requires baseline and execution evidence");
  return {
    profile: values.profile,
    mode: values.mode,
    baseline: values.baseline ? insideTmp(values.baseline) : null,
    execution: values.execution ? insideTmp(values.execution) : null,
    output: insideTmp(values.output),
  };
}

async function capture(client, profile) {
  const result = await client.query(`
    select rp.id::text mapping_id, rp.retailer_id::text retailer_id,
           rp.product_id::text mapping_product_id, rp.product_variant_id::text mapping_variant_id,
           rp.external_product_id, rp.external_variant_id, rp.external_sku, rp.external_gtin,
           rp.external_options, rp.external_url,
           o.id::text offer_id, o.product_id::text offer_product_id,
           o.product_variant_id::text offer_variant_id, o.price::text, o.shipping_cost::text,
           o.total_price::text, o.in_stock, o.url, o.last_checked_at
      from public.retailer_products rp
      join public.offers o on o.retailer_product_id=rp.id and o.retailer_id=rp.retailer_id
     where rp.retailer_id=$1::bigint
     order by o.id`, [profile.retailerId]);
  const rows = result.rows;
  const offerIds = rows.map((row) => row.offer_id);
  const history = await client.query("select count(*)::integer count from public.price_history where offer_id=any($1::bigint[])", [offerIds]);
  return { captured_at: new Date().toISOString(), retailer_id: profile.retailerId, retailer_name: profile.retailerName, row_count: rows.length, price_history_count: history.rows[0].count, rows };
}

function verifyPostflight(baseline, after, execution) {
  invariant(baseline.result === "PASS" && baseline.kind === "retailer-offer-refresh-db-baseline", "Invalid DB baseline evidence");
  invariant(baseline.evidence_hash === baselineHash(baseline), "DB baseline evidence hash mismatch");
  invariant(execution.result === "PASS" || execution.result === "PASS_WITH_REVIEW", "Apply result did not pass");
  invariant(execution.approved_mapping_count === baseline.snapshot.row_count, "Approved mapping count drift");
  invariant(execution.blocked_row_count === 0, "Apply contains blocked rows");
  invariant(execution.executed_plan_count === execution.executable_plan_count, "Executed plan count differs from executable plan count");
  invariant(after.row_count === baseline.snapshot.row_count, "Retailer mapping or offer row-count drift");
  const beforeByOffer = new Map(baseline.snapshot.rows.map((row) => [row.offer_id, row]));
  const afterByOffer = new Map(after.rows.map((row) => [row.offer_id, row]));
  const reviewIds = new Set((execution.review_rows || []).map((row) => String(row.offer_id)));
  invariant(reviewIds.size === execution.review_row_count, "Review row count drift");
  const identityFields = ["mapping_id","retailer_id","mapping_product_id","mapping_variant_id","external_product_id","external_variant_id","external_sku","external_gtin","external_options","offer_id","offer_product_id","offer_variant_id"];
  let priceChanges = 0, stockChanges = 0, shippingChanges = 0, totalChanges = 0, offerUrlChanges = 0, mappingUrlChanges = 0, freshnessChanges = 0;
  for (const [offerId, before] of beforeByOffer) {
    const current = afterByOffer.get(offerId);
    invariant(current, `Offer ${offerId} disappeared during apply`);
    for (const field of identityFields) invariant(canonicalJson(current[field]) === canonicalJson(before[field]), `Forbidden ${field} change for offer ${offerId}`);
    if (current.price !== before.price) priceChanges += 1;
    if (current.in_stock !== before.in_stock) stockChanges += 1;
    if (current.shipping_cost !== before.shipping_cost) shippingChanges += 1;
    if (current.total_price !== before.total_price) totalChanges += 1;
    if (current.url !== before.url) offerUrlChanges += 1;
    if (current.external_url !== before.external_url) mappingUrlChanges += 1;
    if (reviewIds.has(offerId)) {
      invariant(canonicalJson(current) === canonicalJson(before), `Review offer ${offerId} changed`);
    } else {
      invariant(Date.parse(current.last_checked_at) > Date.parse(before.last_checked_at), `Executable offer ${offerId} did not advance freshness`);
      freshnessChanges += 1;
    }
  }
  const logical = execution.expected_deltas?.logical_field_deltas || {};
  const rowDeltas = execution.expected_deltas?.row_count_deltas || {};
  invariant(priceChanges === Number(logical.offer_price_updates || 0), "Price update count differs from plan");
  invariant(stockChanges === Number(logical.offer_stock_updates || 0), "Stock update count differs from plan");
  invariant(shippingChanges === Number(logical.offer_shipping_updates || 0), "Shipping update count differs from plan");
  invariant(totalChanges === Number(logical.offer_total_updates || 0), "Total update count differs from plan");
  invariant(offerUrlChanges === Number(logical.offer_url_updates || 0), "Offer URL update count differs from plan");
  invariant(mappingUrlChanges === Number(logical.mapping_url_updates || 0), "Mapping URL update count differs from plan");
  invariant(freshnessChanges === execution.executed_plan_count && freshnessChanges === Number(logical.last_checked_at_updates || 0), "Freshness update count differs from execution");
  const historyDelta = after.price_history_count - baseline.snapshot.price_history_count;
  invariant(historyDelta === Number(rowDeltas.price_history || 0), "Price history delta differs from plan");
  return { schema_version: 1, kind: "retailer-offer-refresh-db-postflight", result: "PASS", profile: baseline.profile, approved_mapping_count: execution.approved_mapping_count, executable_plan_count: execution.executable_plan_count, executed_plan_count: execution.executed_plan_count, review_row_count: execution.review_row_count, blocked_row_count: execution.blocked_row_count, price_change_count: priceChanges, stock_change_count: stockChanges, shipping_change_count: shippingChanges, total_change_count: totalChanges, offer_url_change_count: offerUrlChanges, mapping_url_change_count: mappingUrlChanges, freshness_change_count: freshnessChanges, price_history_delta: historyDelta, baseline_hash: baseline.evidence_hash, postflight_hash: hash(after), completed_at: new Date().toISOString() };
}

async function run(options, dependencies = {}) {
  const profile = PROFILES[options.profile];
  const env = dependencies.env || process.env;
  const session = await withPostgresRoleSession({
    connectionString: normalizeConnectionString(env[profile.credential], "validator"),
    applicationName: `${options.profile}-offer-refresh-postflight`,
    ClientClass: dependencies.Client || Client,
    defaultReadOnly: true,
    readOnly: true,
    role: VALIDATOR_ROLE,
    expectedSessionUser: VALIDATOR_LOGIN,
    kind: "validator",
  }, (client) => capture(client, profile));
  let evidence;
  if (options.mode === "baseline") {
    evidence = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: options.profile, snapshot: session.result };
    evidence.evidence_hash = baselineHash(evidence);
  } else evidence = verifyPostflight(read(options.baseline), session.result, read(options.execution));
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { PROFILES, baselineHash, capture, hash, parseArgs, run, verifyPostflight, VALIDATOR_LOGIN, VALIDATOR_ROLE };
