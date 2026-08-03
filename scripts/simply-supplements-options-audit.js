const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readShopifySnapshot } = require("./lib/shopify-snapshot-reader");
const config = require("../config/retailers/simply-supplements-reconciliation.json");
const priorAuthorization = require("../config/retailers/simply-supplements-identity-bootstrap-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");

function invariant(value, message) { if (!value) throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value)).digest("hex"); }
function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(identity|output)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument: ${argument}`);
    out[match[1]] = path.resolve(match[2]);
  }
  invariant(out.identity && out.output, "required --identity=<tmp/identity.json> --output=<tmp/options.json>");
  for (const value of Object.values(out)) {
    const relative = path.relative(path.join(ROOT, "tmp"), value);
    invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "options audit paths must be inside tmp");
  }
  return out;
}
function optionNames(product) {
  return (product.options || []).map((option) => String(typeof option === "string" ? option : option.name || "").trim());
}
function exactOptions(product, variant) {
  const names = optionNames(product);
  invariant(names.length === 2 && names[0] === "Size" && names[1] === "Subscription", `unexpected Shopify option schema for product ${product.id}`);
  const values = [variant.option1, variant.option2, variant.option3];
  const options = Object.fromEntries(names.map((name, index) => [name, String(values[index] ?? "").trim()]));
  invariant(options.Size && options.Subscription === "[Multibuy 1]", `unexpected approved option values for variant ${variant.id}`);
  return options;
}
function buildAudit(identity, snapshot) {
  invariant(identity.artifact_fingerprint === priorAuthorization.artifact_fingerprint && identity.row_count === 120 && identity.rows?.length === 120, "prior identity authority mismatch");
  const wanted = new Map(identity.rows.map((row) => [String(row.approved_identity.external_variant_id), row]));
  const found = new Map();
  for (const product of snapshot.products || []) for (const variant of product.variants || []) {
    const id = String(variant.id);
    if (!wanted.has(id)) continue;
    invariant(!found.has(id), `duplicate Shopify variant ${id}`);
    const approved = wanted.get(id);
    invariant(String(product.id) === approved.approved_identity.external_product_id, `Shopify product drift for mapping ${approved.mapping_id}`);
    invariant(String(variant.sku || "").trim() === approved.approved_identity.external_sku, `Shopify SKU drift for mapping ${approved.mapping_id}`);
    found.set(id, {
      mapping_id: String(approved.mapping_id),
      external_product_id: String(product.id),
      external_variant_id: id,
      external_sku: String(variant.sku).trim(),
      external_options: exactOptions(product, variant),
    });
  }
  invariant(found.size === 120, `Shopify option coverage mismatch: ${found.size}/120`);
  const rows = identity.rows.map((approved) => found.get(String(approved.approved_identity.external_variant_id)));
  invariant(new Set(rows.map((row) => row.mapping_id)).size === 120, "option audit mapping duplication");
  const report = {
    schema_version: 1,
    kind: "simply-supplements-reviewed-options-audit-v1",
    result: "PASS",
    database_writes: 0,
    source_identity_artifact_fingerprint: identity.artifact_fingerprint,
    source: {
      captured_at: snapshot.captured_at,
      raw_source_fingerprint: snapshot.raw_source_fingerprint,
      semantic_source_fingerprint: snapshot.semantic_source_fingerprint,
      product_count: snapshot.products.length,
      variant_count: snapshot.products.reduce((sum, product) => sum + (product.variants || []).length, 0),
      market_country: snapshot.market_country,
    },
    row_count: rows.length,
    option_schema: ["Size", "Subscription"],
    subscription_value: "[Multibuy 1]",
    rows,
  };
  report.audit_fingerprint = sha256(report);
  return report;
}
async function run(options) {
  const identity = JSON.parse(fs.readFileSync(options.identity, "utf8"));
  const snapshot = await readShopifySnapshot({ storeUrl: config.retailer.store_url, marketCountry: config.shopify.market_country, noCache: true, paginationCompletion: config.shopify.pagination_completion });
  const report = buildAudit(identity, snapshot);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(`${options.output}.sha256`, `${sha256(fs.readFileSync(options.output))}\n`, { flag: "wx" });
  return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, rows: report.row_count, option_schema: report.option_schema, subscription_value: report.subscription_value, audit_fingerprint: report.audit_fingerprint, database_writes: 0 }, null, 2))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { buildAudit, exactOptions, optionNames, parseArgs };
