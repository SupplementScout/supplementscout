const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { buildGuardEvidence } = require("./lib/retailer-offer-sync/classifier");
const config = require("../config/retailers/simply-supplements-reconciliation.json");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}

function actionFor(row, db) {
  const changed = [];
  if (money(db.price) !== money(row.price)) changed.push("price");
  if (money(db.shipping_cost) !== money(row.shipping_cost)) changed.push("shipping_cost");
  if (money(db.total_price) !== money(row.total_price)) changed.push("total_price");
  if (Boolean(db.in_stock) !== Boolean(row.in_stock)) changed.push("in_stock");
  if (db.url !== row.affiliate_url) changed.push("offer_url");
  if (db.external_url !== row.external_url) changed.push("mapping_url");
  return { action: changed.length ? "UPDATE_EXISTING_OFFER" : "VERIFY_NO_CHANGE", changed_fields: changed };
}

function guardAction(row) {
  const price = row.changed_fields.includes("price");
  const stock = row.changed_fields.includes("in_stock");
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  return "VERIFY_NO_CHANGE";
}

function buildDryRunGuard(rows, policy = config.guardrails) {
  const hardPriceAnomalies = rows.filter((row) => {
    if (!row.changed_fields.includes("price")) return false;
    const prior = Number(row.prior_offer.price);
    const next = Number(row.expected_offer.price);
    return Math.abs(next - prior) / Math.max(0.01, prior) >= policy.per_row_price_hard_block_ratio
      || Math.abs(next - prior) >= Number(policy.per_row_price_hard_block_absolute_gbp);
  }).map((row) => ({ offer_id: row.offer_id, prior_price: row.prior_offer.price, expected_price: row.expected_offer.price }));
  const evidenceRows = rows.map((row) => ({
    offer_id: row.offer_id,
    action: guardAction(row),
    changed_fields: { price: row.changed_fields.includes("price"), stock: row.changed_fields.includes("in_stock"), url: row.changed_fields.includes("offer_url") || row.changed_fields.includes("mapping_url"), blocked: false },
    target: { in_stock: row.prior_offer.in_stock },
    source: { in_stock: row.expected_offer.in_stock },
  }));
  const evidence = buildGuardEvidence(evidenceRows, policy, { name: "SIMPLY_SUPPLEMENTS_APPROVED_120", retailer: config.retailer.slug });
  const failed = evidence.guards.filter((guard) => guard.result === "BLOCK").map((guard) => guard.guard);
  if (hardPriceAnomalies.length) failed.unshift("HARD_PRICE_ANOMALY");
  return { state: failed.length ? "BLOCKED" : "DRY_RUN_READY", blockers: [...new Set(failed)], hard_price_anomalies: hardPriceAnomalies, guard_evidence: evidence };
}

function buildManifest(report, databaseRows, expectedCount = 120, expectedRekeyCount = 13) {
  invariant(report?.approved_scope_state === "READY_FOR_MANIFEST", "approved Simply scope is not ready for manifest");
  invariant(report.counts?.approved_scope_total === expectedCount && report.counts?.approved_scope_ready === expectedCount && report.counts?.approved_scope_blocked === 0, "approved Simply scope coverage mismatch");
  invariant(Array.isArray(databaseRows) && databaseRows.length === expectedCount, "production Simply mapping coverage mismatch");
  const byUrl = new Map();
  for (const row of databaseRows) {
    invariant(row.mapping_id != null && row.offer_id != null && row.external_url && !byUrl.has(row.external_url), "duplicate or incomplete production Simply mapping");
    byUrl.set(row.external_url, row);
  }
  const rows = report.approved_scope.map((source) => {
    invariant(source.status.startsWith("READY_"), `approved source row blocked: ${source.merchant_product_id}`);
    const database = byUrl.get(source.external_url);
    invariant(database, `production mapping missing for Simply URL: ${source.external_url}`);
    const action = actionFor(source, database);
    return {
      mapping_id: String(database.mapping_id),
      offer_id: String(database.offer_id),
      canonical_product_id: String(database.product_id),
      canonical_variant_id: database.product_variant_id == null ? null : String(database.product_variant_id),
      legacy_merchant_product_id: source.merchant_product_id,
      legacy_aw_product_id: source.aw_product_id,
      awin_presence_policy: source.status === "READY_OWNER_APPROVED_AWIN_REKEY" ? "APPROVED_REKEY" : "REQUIRED_EXACT",
      current_awin_rekey: source.current_awin_rekey || null,
      external_product_id: source.external_product_id,
      external_variant_id: source.external_variant_id,
      external_sku: source.external_sku,
      handle: source.handle,
      external_gtin: source.external_gtin,
      external_url: source.external_url,
      affiliate_url: source.affiliate_url,
      expected_offer: { price: money(source.price), shipping_cost: money(source.shipping_cost), total_price: money(source.total_price), in_stock: Boolean(source.in_stock), url: source.affiliate_url },
      source_compare_at_price: money(source.compare_at_price),
      prior_offer: { price: money(database.price), shipping_cost: money(database.shipping_cost), total_price: money(database.total_price), in_stock: Boolean(database.in_stock), url: database.url },
      ...action,
    };
  }).sort((left, right) => Number(left.mapping_id) - Number(right.mapping_id));
  for (const field of ["mapping_id", "offer_id", "external_variant_id", "external_url", "affiliate_url"]) invariant(new Set(rows.map((row) => row[field])).size === expectedCount, `Simply manifest duplicate ${field}`);
  invariant(rows.filter((row) => row.awin_presence_policy === "APPROVED_REKEY").length === expectedRekeyCount, `Simply manifest must contain exactly ${expectedRekeyCount} approved Awin rekeys`);
  const manifest = {
    schema_version: 1,
    kind: "simply-supplements-approved-existing-offer-manifest-v1",
    retailer: config.retailer,
    target_environment: "PRODUCTION",
    target_project_ref: PRODUCTION_REF,
    authority: config.approved_awin_rekeys,
    source: report.sources,
    source_report_fingerprint: report.report_fingerprint,
    approved_mapping_count: expectedCount,
    approved_offer_count: expectedCount,
    action_counts: {
      verify_no_change: rows.filter((row) => row.action === "VERIFY_NO_CHANGE").length,
      update_existing_offer: rows.filter((row) => row.action === "UPDATE_EXISTING_OFFER").length,
      new_oos: rows.filter((row) => row.prior_offer.in_stock && !row.expected_offer.in_stock).length,
    },
    dry_run: buildDryRunGuard(rows),
    database_writes: 0,
    rows,
  };
  manifest.manifest_fingerprint = sha256(manifest);
  return manifest;
}

function loadEnvFile(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

async function readProductionState() {
  const file = path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  invariant(fs.existsSync(file), "production owner credential file missing");
  const values = loadEnvFile(file);
  const raw = Object.entries(values).find(([name]) => name.endsWith("_DATABASE_URL"))?.[1];
  invariant(raw, "production owner database URL missing");
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  invariant(url.href.includes(PRODUCTION_REF) && !url.href.includes("hxnrsyyqffztlvcrtgbf"), "production owner target mismatch");
  const client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: false }, application_name: "simply-approved-manifest-read-only", options: "-c default_transaction_read_only=on -c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin read only");
    const result = await client.query("select rp.id mapping_id,o.id offer_id,rp.product_id,rp.product_variant_id,rp.external_product_id,rp.external_variant_id,rp.external_sku,rp.external_url,rp.updated_at mapping_updated_at,o.price,o.shipping_cost,o.total_price,o.in_stock,o.url,o.last_checked_at from public.retailer_products rp join public.offers o on o.retailer_product_id=rp.id where rp.retailer_id=$1 order by rp.id", [config.retailer.id]);
    await client.query("rollback");
    return result.rows;
  } finally {
    await client.end();
  }
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--(report|output)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument: ${arg}`);
    out[match[1]] = path.resolve(match[2]);
  }
  invariant(out.report && out.output, "required --report=<tmp/reconciliation.json> --output=<tmp/manifest.json>");
  for (const file of [out.report, out.output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), file);
    invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "manifest input/output must be inside tmp");
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = JSON.parse(fs.readFileSync(args.report, "utf8"));
  const state = await readProductionState();
  const manifest = buildManifest(report, state);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(`${args.output}.sha256`, `${sha256(fs.readFileSync(args.output))}  ${path.basename(args.output)}\n`);
  console.log(JSON.stringify({ approved_mapping_count: manifest.approved_mapping_count, action_counts: manifest.action_counts, manifest_fingerprint: manifest.manifest_fingerprint, database_writes: 0, output: path.relative(ROOT, args.output).replaceAll("\\", "/") }));
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { actionFor, buildDryRunGuard, buildManifest, parseArgs, readProductionState };
