const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { readEkmGoogleProductFeed } = require("./lib/ekm-google-product-feed-reader");
const { buildReviewedVariantCreateRebindPlan } = require("./lib/reviewed-variant-create-rebind-offer-update");
const { writeDryRunArtifact } = require("./import-products");
const retailerConfig = require("../config/retailers/whey-okay-offer-sync.json");
const scope = require("../config/retailers/whey-okay-offer-73-reviewed.json");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";

function invariant(value, message) { if (!value) throw new Error(message); }
function hash(value) { return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function parseArgs(argv) {
  const args = { mode: null, output: null };
  for (const value of argv) {
    const match = value.match(/^--(mode|output)=(.*)$/);
    invariant(match && args[match[1]] === null, `invalid argument ${value}`);
    args[match[1]] = match[2];
  }
  invariant(args.mode === "dry-run", "only --mode=dry-run is supported");
  invariant(args.output, "--output is required");
  const output = path.resolve(ROOT, args.output);
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "output must be inside tmp");
  return { ...args, output };
}
async function one(client, table, select, id) {
  invariant(select === "*", "reviewed state reads must request the complete row");
  const result = await client.query(`select to_jsonb(row) value from public.${table} row where id=$1`, [id]);
  invariant(result.rows.length === 1, `${table} ${id} read failed: missing`);
  return result.rows[0].value;
}
async function variants(client) {
  const result = await client.query("select to_jsonb(row) value from public.product_variants row where product_id=$1 order by id", [scope.product_id]);
  return result.rows.map((row) => row.value);
}
async function state(client) {
  const [product, retailer, mapping, offer, allVariants] = await Promise.all([
    one(client, "products", "*", scope.product_id), one(client, "retailers", "*", scope.retailer_id),
    one(client, "retailer_products", "*", scope.mapping_id), one(client, "offers", "*", scope.offer_id), variants(client),
  ]);
  const variant = allVariants.find((row) => Number(row.id) === scope.expected_current_variant_id);
  invariant(variant, "expected current variant missing");
  return { product, retailer, mapping, offer, variant, allVariants };
}
async function capture() {
  return readEkmGoogleProductFeed({
    url: retailerConfig.source_url,
    maximumAttempts: retailerConfig.source_fetch.maximum_attempts,
    retryBaseDelayMs: retailerConfig.source_fetch.retry_base_delay_ms,
    timeoutMs: retailerConfig.source_fetch.timeout_ms,
    maximumRedirects: retailerConfig.source_fetch.maximum_redirects,
    freshnessHours: retailerConfig.guardrails.source_freshness_hours,
    futureClockSkewMinutes: retailerConfig.guardrails.future_clock_skew_minutes,
    userAgent: retailerConfig.source_fetch.user_agent,
  });
}
function assertScope(before, source) {
  invariant(before.retailer.slug === scope.retailer_slug, "retailer drift");
  invariant(Number(before.mapping.product_id) === scope.product_id && Number(before.mapping.product_variant_id) === scope.expected_current_variant_id && Number(before.mapping.retailer_id) === scope.retailer_id, "mapping drift");
  invariant(Number(before.offer.product_id) === scope.product_id && Number(before.offer.product_variant_id) === scope.expected_current_variant_id && Number(before.offer.retailer_product_id) === scope.mapping_id, "offer drift");
  invariant(Number(before.offer.price).toFixed(2) === scope.expected_before.price && Number(before.offer.shipping_cost).toFixed(2) === scope.expected_before.shipping_cost && before.offer.total_price === null && before.offer.in_stock === false, "commercial before-state drift");
  invariant(before.allVariants.length === 1 && before.variant.is_default === true, "canonical variant scope drift");
  invariant(before.product.net_weight_g === 900, "parent net_weight_g drift");
  invariant(source.external_product_id === scope.source_product_id && source.external_variant_id === scope.source_variant_id && source.title === scope.exact_source_title, "source identity drift");
  invariant(Number(source.price).toFixed(2) === scope.expected_after.price && source.in_stock === true, "source commercial drift");
}
async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  invariant(!fs.existsSync(args.output) && !fs.existsSync(`${args.output}.sha256`), "refusing to overwrite immutable dry-run artifact");
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const connectionString = process.env.WHEY_OKAY_REFRESH_VALIDATOR_DATABASE_URL;
  invariant(connectionString && connectionString.includes(PRODUCTION_REF), "production validator binding missing");
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  const client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: false }, application_name: "whey-offer-73-reviewed-dry-run", options: "-c default_transaction_read_only=on -c statement_timeout=120000" });
  await client.connect();
  let transactionStarted = false;
  try {
  await client.query("begin read only");
  transactionStarted = true;
  await client.query("set local role retailer_catalogue_production_validator");
  const role = (await client.query("select session_user, current_user, current_setting('transaction_read_only') read_only")).rows[0];
  invariant(role.session_user === "supplementscout_production_validator_login" && role.current_user === "retailer_catalogue_production_validator" && role.read_only === "on", "validator role or read-only mode mismatch");
  const before = await state(client);
  const first = await capture();
  const second = await capture();
  invariant(first.semantic_fingerprint === second.semantic_fingerprint, "two fresh captures differ");
  const source = second.rows.find((row) => row.source_key === `${scope.source_product_id}:${scope.source_variant_id}`);
  invariant(source, "reviewed source row missing");
  assertScope(before, source);
  const expiresAt = new Date(Date.now() + scope.approval_ttl_minutes * 60_000).toISOString();
  const plan = buildReviewedVariantCreateRebindPlan({
    state: before,
    source: { ...source, flavour: scope.option_value, weight_value: scope.weight_value, weight_unit: scope.weight_unit, shipping_cost: source.feed_shipping_cost },
    captures: [first, second], expiresAt,
  });
  const row = plan.source_record;
  const item = { rowNumber: 2, row, importPlan: plan };
  const result = { skipped: 0, blockedRows: [], report: { approvedRows: [item], blockedRows: [] } };
  const written = writeDryRunArtifact([row], result, {
    artifactPath: args.output,
    runId: `whey-offer-73-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceContent: canonicalJson(row), sourceFileName: "whey-okay-offer-73-reviewed-source.json",
    environmentMarker: "production-readonly",
  });
  const after = await state(client);
  invariant(hash(before) === hash(after), "production scope changed during dry-run");
  const report = {
    result: "PASS", mode: "dry-run", operation_type: plan.meta.operation_type,
    artifact_path: path.relative(ROOT, written.artifactPath), artifact_sha256: written.artifactSha256,
    plan_fingerprint: plan.meta.plan_fingerprint, source_row_fingerprint: plan.meta.source_row_fingerprint,
    source_snapshot_sha256: plan.meta.source_snapshot_sha256, approval_fingerprint: plan.meta.approval_fingerprint,
    idempotency_key: plan.meta.idempotency_key, expires_at: plan.meta.expires_at,
    scope: { product_id: "69", mapping_id: "65", offer_id: "73", expected_current_variant_id: "64", source_key: "300:301" },
    capture_timestamps: plan.source_record.captures.map((captureRow) => captureRow.captured_at),
    expected_deltas: plan.expected_deltas, before_state_hash: hash(before), after_state_hash: hash(after),
    database_writes: 0, approval_rpc_invoked: false, apply_rpc_invoked: false,
  };
  const reportPath = `${args.output}.report.json`;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ ...report, report_sha256: crypto.createHash("sha256").update(fs.readFileSync(reportPath)).digest("hex") }, null, 2));
  await client.query("commit");
  transactionStarted = false;
  return report;
  } catch (error) {
    if (transactionStarted) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { assertScope, main, parseArgs, state };
