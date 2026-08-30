const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { normalizeConnectionString, withPostgresRoleSession } = require("./lib/retailer-offer-sync/production-role-session");
const { canonicalJson } = require("./lib/canonical-json");
const { loadReviewedBatch } = require("./lib/six-pack-reviewed-owner-approval");

const ROOT = path.resolve(__dirname, "..");
const TABLES = ["products", "product_variants", "retailer_products", "offers", "price_history"];
const VALIDATOR_LOGIN = "supplementscout_production_validator_login";
const VALIDATOR_ROLE = "retailer_catalogue_production_validator";

function fail(message) { throw new Error(message); }
function hash(value) { return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex"); }

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    const match = arg.match(/^--(mode|reviewed-batch|baseline|execution|output)=(.*)$/);
    if (!match || values[match[1]] !== undefined) fail(`Invalid argument ${arg}`);
    values[match[1]] = match[2];
  }
  if (!new Set(["baseline", "postflight"]).has(values.mode) || !values["reviewed-batch"] || !values.output) fail("Required mode, reviewed-batch and output");
  for (const key of ["baseline", "execution", "output"]) if (values[key]) {
    values[key] = path.resolve(values[key]);
    const relative = path.relative(path.join(ROOT, "tmp"), values[key]);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${key} must be inside repository tmp`);
  }
  if (values.mode === "postflight" && (!values.baseline || !values.execution)) fail("Postflight requires baseline and execution evidence");
  values.reviewedBatchFingerprint = values["reviewed-batch"];
  return values;
}

async function capture(client, batch) {
  const ids = (values) => values.map((value) => BigInt(value));
  const query = async (sql, params = []) => (await client.query(sql, params)).rows;
  const [offers, mappings, products, variants, histories, counts] = await Promise.all([
    query("select * from public.offers where id=any($1::bigint[]) order by id", [ids(batch.offer_ids)]),
    query("select * from public.retailer_products where id=any($1::bigint[]) order by id", [ids(batch.retailer_product_ids)]),
    query("select * from public.products where id=any($1::bigint[]) order by id", [ids(batch.product_ids)]),
    query("select * from public.product_variants where id=any($1::bigint[]) order by id", [ids(batch.product_variant_ids)]),
    query("select * from public.price_history where offer_id=any($1::bigint[]) order by id", [ids(batch.offer_ids)]),
    query(`select ${TABLES.map((table) => `(select count(*)::int from public.${table}) as ${table}`).join(",")}`),
  ]);
  if (offers.length !== batch.offer_ids.length || mappings.length !== batch.retailer_product_ids.length || products.length !== batch.product_ids.length || variants.length !== batch.product_variant_ids.length) fail("Reviewed DB scope is incomplete");
  const commercial = offers.map((offer) => {
    const row = { ...offer };
    delete row.last_checked_at;
    delete row.updated_at;
    return row;
  });
  return {
    captured_at: new Date().toISOString(), transaction_read_only: "on", counts: counts[0],
    offers, retailer_products: mappings, products, product_variants: variants, price_history: histories,
    commercial_hash_without_last_checked_at: hash(commercial), mapping_hash: hash(mappings),
  };
}

function verifyPostflight(batch, baseline, after, execution) {
  if (execution.result !== "PASS" || execution.executed_plan_count !== batch.rows.length || execution.rows.length !== batch.rows.length) fail("Execution evidence is incomplete");
  const executionByOffer = new Map(execution.rows.map((row) => [String(row.offer_id), row]));
  const beforeOffer = new Map(baseline.offers.map((row) => [String(row.id), row]));
  const afterOffer = new Map(after.offers.map((row) => [String(row.id), row]));
  for (const row of batch.rows) {
    const before = beforeOffer.get(String(row.offer_id));
    const current = afterOffer.get(String(row.offer_id));
    const executed = executionByOffer.get(String(row.offer_id));
    if (!before || !current || !executed) fail(`Missing postflight evidence for offer ${row.offer_id}`);
    for (const field of ["price", "shipping_cost", "total_price"]) if (Number(current[field]).toFixed(2) !== Number(row.after[field]).toFixed(2)) fail(`Postflight ${field} mismatch for offer ${row.offer_id}`);
    if (current.in_stock !== row.after.in_stock || current.url !== row.after.url || Date.parse(current.last_checked_at) <= Date.parse(before.last_checked_at)) fail(`Postflight state mismatch for offer ${row.offer_id}`);
    const unchanged = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !new Set(["price", "shipping_cost", "total_price", "in_stock", "last_checked_at", "updated_at"]).has(key)));
    if (canonicalJson(unchanged(before)) !== canonicalJson(unchanged(current))) fail(`Non-commercial offer identity changed for offer ${row.offer_id}`);
    const expectsHistory = row.operation_type !== "UPDATE_STOCK";
    if (expectsHistory !== (executed.price_history_id != null)) fail(`Price history execution mismatch for offer ${row.offer_id}`);
  }
  if (canonicalJson(baseline.retailer_products) !== canonicalJson(after.retailer_products) || baseline.mapping_hash !== after.mapping_hash) fail("Retailer mapping changed during reviewed apply");
  if (canonicalJson(baseline.products) !== canonicalJson(after.products) || canonicalJson(baseline.product_variants) !== canonicalJson(after.product_variants)) fail("Product or variant identity changed during reviewed apply");
  for (const table of ["products", "product_variants", "retailer_products", "offers"]) if (baseline.counts[table] !== after.counts[table]) fail(`${table} count changed during reviewed apply`);
  if (after.counts.price_history - baseline.counts.price_history !== batch.expected_price_history_delta) fail("Unexpected global price_history delta");
  const historyIds = new Set(after.price_history.map((row) => String(row.id)));
  const newHistory = execution.rows.filter((row) => row.price_history_id != null).map((row) => String(row.price_history_id));
  if (newHistory.length !== batch.expected_price_history_delta || newHistory.some((id) => !historyIds.has(id))) fail("Created price_history rows do not match execution evidence");
  const historyById = new Map(after.price_history.map((row) => [String(row.id), row]));
  for (const row of batch.rows.filter((item) => item.operation_type !== "UPDATE_STOCK")) {
    const history = historyById.get(String(executionByOffer.get(String(row.offer_id)).price_history_id));
    if (!history || String(history.offer_id) !== String(row.offer_id) || Number(history.price).toFixed(2) !== Number(row.after.price).toFixed(2) || Number(history.shipping_cost).toFixed(2) !== Number(row.after.shipping_cost).toFixed(2) || Number(history.total_price).toFixed(2) !== Number(row.after.total_price).toFixed(2)) fail(`Price history values mismatch for offer ${row.offer_id}`);
  }
  return {
    schema_version: 1, kind: "six-pack-reviewed-owner-db-postflight", result: "PASS",
    reviewed_batch_fingerprint: batch.reviewed_batch_fingerprint,
    approved_reviewed_plan_count: batch.rows.length, executed_plan_count: execution.rows.length,
    price_history_delta: after.counts.price_history - baseline.counts.price_history,
    stock_change_count: batch.rows.filter((row) => row.before.in_stock !== row.after.in_stock).length,
    mapping_delta: after.counts.retailer_products - baseline.counts.retailer_products,
    counts_before: baseline.counts, counts_after: after.counts,
    baseline_hash: baseline.evidence_hash, postflight_hash: hash(after),
    completed_at: new Date().toISOString(),
  };
}

async function withReadOnlyValidatorClient(callback, dependencies = {}) {
  const ClientClass = dependencies.Client || Client;
  const value = dependencies.env
    ? dependencies.env.SIX_PACK_SYNC_VALIDATOR_DATABASE_URL
    : process.env.SIX_PACK_SYNC_VALIDATOR_DATABASE_URL;
  const session = await withPostgresRoleSession({
    connectionString: normalizeConnectionString(value, "validator"),
    applicationName: "six-pack-reviewed-postflight-read-only",
    ClientClass,
    defaultReadOnly: true,
    readOnly: true,
    role: VALIDATOR_ROLE,
    expectedSessionUser: VALIDATOR_LOGIN,
    kind: "validator",
  }, callback);
  return session.result;
}

async function run(options) {
  const batch = loadReviewedBatch(options.reviewedBatchFingerprint).batch;
  return withReadOnlyValidatorClient(async (client) => {
    const snapshot = await capture(client, batch);
    if (options.mode === "baseline") {
      const evidence = { schema_version: 1, kind: "six-pack-reviewed-owner-db-baseline", result: "PASS", reviewed_batch_fingerprint: batch.reviewed_batch_fingerprint, ...snapshot };
      evidence.evidence_hash = hash(evidence);
      fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(evidence, null, 2)}\n`); return evidence;
    }
    const report = verifyPostflight(batch, JSON.parse(fs.readFileSync(options.baseline, "utf8")), snapshot, JSON.parse(fs.readFileSync(options.execution, "utf8")));
    fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
  });
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { capture, hash, parseArgs, verifyPostflight, withReadOnlyValidatorClient, VALIDATOR_LOGIN, VALIDATOR_ROLE };
