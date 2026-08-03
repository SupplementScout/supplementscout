const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { buildAtomicImportPlan, writeDryRunArtifact } = require("./import-products");
const authorization = require("../config/retailers/simply-supplements-complete-identity-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");
const REFS = Object.freeze({ staging: "hxnrsyyqffztlvcrtgbf", production: "aftboxmrdgyhizicfsfu" });
const DEFAULT_IDENTITY = path.join(ROOT, "tmp", "simply-supplements", "complete-identity-bootstrap-production-v2.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "simply-supplements", "identity-staging-plans");

function invariant(value, message) { if (!value) throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
function parseArgs(argv) {
  const out = { identity: DEFAULT_IDENTITY, output: DEFAULT_OUTPUT };
  for (const argument of argv) {
    const match = argument.match(/^--(target|identity|output)=(.+)$/);
    invariant(match && (match[1] === "target" || out[match[1]] === (match[1] === "identity" ? DEFAULT_IDENTITY : DEFAULT_OUTPUT)), `invalid argument: ${argument}`);
    out[match[1]] = match[1] === "target" ? match[2] : path.resolve(match[2]);
  }
  invariant(REFS[out.target], "required --target=staging|production");
  for (const value of [out.identity, out.output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), value);
    invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "identity plan input/output must be inside tmp");
  }
  return out;
}
function readCredential(target) {
  const file = target === "staging"
    ? path.join(ROOT, ".env.staging.audit.local")
    : path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  invariant(fs.existsSync(file), `${target} read credential missing`);
  const values = loadEnv(file);
  const key = target === "staging" ? "SUPPLEMENTSCOUT_STAGING_DATABASE_URL" : Object.keys(values).find((name) => name.endsWith("OWNER_DATABASE_URL") || name.endsWith("DATABASE_URL"));
  const raw = values[key];
  invariant(raw, `${target} read database URL missing`);
  const url = new URL(raw); url.searchParams.delete("sslmode");
  invariant(url.href.includes(REFS[target]) && !url.href.includes(REFS[target === "staging" ? "production" : "staging"]), `${target} read target mismatch`);
  return url.href;
}
function validateAuthority(identityBytes, identity) {
  invariant(sha256(identityBytes) === authorization.artifact_file_sha256, "identity artifact file SHA mismatch");
  invariant(identity.artifact_fingerprint === authorization.artifact_fingerprint, "identity artifact fingerprint mismatch");
  invariant(identity.source_manifest_fingerprint === authorization.source_manifest_fingerprint, "identity source manifest mismatch");
  invariant(identity.source_options_audit_fingerprint === authorization.source_options_audit_fingerprint, "identity options audit mismatch");
  invariant(identity.row_count === 120 && identity.rows?.length === 120 && authorization.row_count === 120, "identity authority coverage mismatch");
  invariant(authorization.conditions?.staging_first === true, "identity authorization staging condition missing");
}
function stateKind(mapping, approved) {
  const legacy = mapping.external_product_id == null && mapping.external_variant_id == null && mapping.external_sku == null;
  const complete = String(mapping.external_product_id) === approved.external_product_id
    && String(mapping.external_variant_id) === approved.external_variant_id
    && String(mapping.external_sku) === approved.external_sku
    && JSON.stringify(mapping.external_options) === JSON.stringify(approved.external_options);
  return legacy ? "LEGACY" : complete ? "COMPLETE" : "DRIFT";
}
function buildRow({ identityRow, mapping, offer, product, variant, retailer }) {
  const approved = identityRow.approved_identity;
  const shippingKnown = offer.shipping_cost != null;
  return {
    retailer_name: retailer.name,
    retailer_website: retailer.website,
    external_product_id: approved.external_product_id,
    external_variant_id: approved.external_variant_id,
    external_sku: approved.external_sku,
    external_options: JSON.stringify(approved.external_options),
    product_name: product.name,
    variant_name: variant.display_name || "Default",
    brand: product.brand,
    category: product.category,
    description: "",
    image: product.image || "",
    slug: product.slug,
    external_url: mapping.external_url,
    affiliate_url: offer.url,
    external_gtin: mapping.external_gtin || "",
    price: String(offer.price),
    shipping_known: String(shippingKnown),
    shipping_cost: shippingKnown ? String(offer.shipping_cost) : "",
    in_stock: String(offer.in_stock),
    is_for_sale: "true",
    size: variant.size_value ?? "",
    size_unit: variant.size_unit ?? "",
    flavour: variant.flavour_label || variant.flavour_code || "",
    product_format: variant.product_format || product.product_format || "",
    pack_count: variant.pack_count ?? 1,
    external_sku_source: "reviewed Shopify catalogue",
    product_id: String(product.id),
    product_variant_id: String(variant.id),
    legacy_mapping_upgrade: "true",
    legacy_mapping_identity_only: "true",
    legacy_duplicate_source_listing: "false",
    legacy_identity_drift: "false",
    retailer_product_id: String(mapping.id),
    expected_retailer_product_updated_at: mapping.updated_at,
  };
}
function buildItem({ row, mapping, offer, product, variant, retailer, capturedAt }) {
  return {
    row,
    rowNumber: 2,
    mode: "feed",
    sourceCapturedAt: capturedAt,
    retailer,
    product,
    productVariant: variant,
    mapping,
    existingOffer: offer,
    offerPlan: { action: "unchanged", createsPriceHistory: false },
    legacyMappingUpgrade: {
      controls: { expectedUpdatedAt: row.expected_retailer_product_updated_at, standalone: false, optioned: false, identityOnly: true },
      after: {
        external_product_id: row.external_product_id,
        external_variant_id: row.external_variant_id,
        external_sku: row.external_sku,
        external_options: JSON.parse(row.external_options),
        external_gtin: mapping.external_gtin,
      },
      exactUrl: mapping.external_url,
      approvedEvidence: {
        approval_fingerprint: authorization.artifact_fingerprint,
        mapping_id: String(mapping.id),
        external_product_id: row.external_product_id,
        external_variant_id: row.external_variant_id,
        external_sku: row.external_sku,
        identity_only: true,
      },
    },
  };
}
async function readState(target, mappingIds) {
  const client = new Client({ connectionString: readCredential(target), ssl: { rejectUnauthorized: false }, application_name: `simply-identity-${target}-read-only`, options: "-c default_transaction_read_only=on -c statement_timeout=120000" });
  await client.connect();
  try {
    await client.query("begin read only");
    const result = await client.query(`
      select rp.*, o.id offer_id, o.product_id offer_product_id, o.product_variant_id offer_variant_id,
        o.retailer_id offer_retailer_id, o.retailer_product_id offer_mapping_id, o.price, o.shipping_cost,
        o.total_price, o.in_stock, o.url offer_url, o.last_checked_at,
        to_jsonb(rp.updated_at)#>>'{}' mapping_updated_at_json,
        to_jsonb(o.last_checked_at)#>>'{}' offer_last_checked_at_json,
        p.name product_name, p.slug product_slug, p.brand, p.category, p.image, p.product_format product_format,
        p.is_active product_active, p.merged_into_product_id,
        pv.display_name, pv.flavour_code, pv.flavour_label, pv.size_value, pv.size_unit, pv.pack_count,
        pv.product_format variant_product_format, pv.is_active variant_active, pv.is_default,
        r.name retailer_name, r.slug retailer_slug, r.website retailer_website
      from public.retailer_products rp
      join public.offers o on o.retailer_product_id=rp.id
      join public.products p on p.id=rp.product_id
      join public.product_variants pv on pv.id=rp.product_variant_id
      join public.retailers r on r.id=rp.retailer_id
      where rp.id=any($1::bigint[])
      order by rp.id`, [mappingIds]);
    await client.query("rollback");
    return result.rows;
  } finally { await client.end(); }
}
function objects(db) {
  const mapping = Object.fromEntries(["id","retailer_id","product_id","product_variant_id","updated_at","external_product_id","external_variant_id","external_sku","external_options","external_name","external_slug","external_gtin","external_url","match_method","match_confidence"].map((key) => [key, db[key]]));
  mapping.updated_at = db.mapping_updated_at_json;
  mapping.match_confidence = mapping.match_confidence == null ? null : String(Number(mapping.match_confidence));
  const offer = { id: db.offer_id, product_id: db.offer_product_id, retailer_id: db.offer_retailer_id, retailer_product_id: db.offer_mapping_id, product_variant_id: db.offer_variant_id, price: db.price, shipping_cost: db.shipping_cost, total_price: db.total_price, in_stock: db.in_stock, url: db.offer_url, last_checked_at: db.last_checked_at };
  offer.last_checked_at = db.offer_last_checked_at_json;
  const product = { id: db.product_id, name: db.product_name, slug: db.product_slug, brand: db.brand, category: db.category, image: db.image, product_format: db.product_format, is_active: db.product_active, merged_into_product_id: db.merged_into_product_id };
  const variant = { id: db.product_variant_id, product_id: db.product_id, display_name: db.display_name, flavour_code: db.flavour_code, flavour_label: db.flavour_label, size_value: db.size_value, size_unit: db.size_unit, pack_count: db.pack_count, product_format: db.variant_product_format, is_active: db.variant_active, is_default: db.is_default };
  const retailer = { id: db.retailer_id, name: db.retailer_name, slug: db.retailer_slug, website: db.retailer_website };
  return { mapping, offer, product, variant, retailer };
}
async function run(options) {
  const identityBytes = fs.readFileSync(options.identity);
  const identity = JSON.parse(identityBytes);
  validateAuthority(identityBytes, identity);
  const stateRows = await readState(options.target, identity.rows.map((row) => row.mapping_id));
  invariant(stateRows.length === 120, `${options.target} mapping coverage mismatch: ${stateRows.length}/120`);
  const state = new Map(stateRows.map((row) => [String(row.id), row]));
  const plans = [], completed = [];
  const capturedAt = new Date().toISOString();
  for (const identityRow of identity.rows) {
    const db = state.get(String(identityRow.mapping_id));
    invariant(db, `missing mapping ${identityRow.mapping_id}`);
    const { mapping, offer, product, variant, retailer } = objects(db);
    invariant(retailer.slug === "simply-supplements" && Number(retailer.id) === 7, `retailer drift ${mapping.id}`);
    invariant(String(mapping.product_id) === identityRow.canonical_product_id && String(mapping.product_variant_id) === identityRow.canonical_variant_id, `canonical drift ${mapping.id}`);
    invariant(String(offer.id) === identityRow.offer_id && String(offer.product_id) === String(mapping.product_id) && String(offer.product_variant_id) === String(mapping.product_variant_id), `offer identity drift ${mapping.id}`);
    invariant(mapping.external_url === identityRow.preserved_mapping_url && offer.url === identityRow.preserved_offer_url, `URL split drift ${mapping.id}`);
    invariant((mapping.external_options == null || JSON.stringify(mapping.external_options) === JSON.stringify(identityRow.approved_identity.external_options)) && product.is_active === true && product.merged_into_product_id == null && variant.is_active === true, `catalogue state drift ${mapping.id}`);
    const kind = stateKind(mapping, identityRow.approved_identity);
    if (kind === "COMPLETE") { completed.push(String(mapping.id)); continue; }
    invariant(kind === "LEGACY", `identity drift ${mapping.id}`);
    const row = buildRow({ identityRow, mapping, offer, product, variant, retailer });
    const item = buildItem({ row, mapping, offer, product, variant, retailer, capturedAt });
    item.importPlan = buildAtomicImportPlan(item);
    invariant(item.importPlan.retailer_product.action === "update" && item.importPlan.offer.action === "noop" && item.importPlan.price_history.action === "noop", `non-identity delta ${mapping.id}`);
    const filename = `mapping-${mapping.id}.json`;
    const written = writeDryRunArtifact([row], { report: { approvedRows: [item] }, blockedRows: [], skipped: 0 }, {
      artifactPath: path.join(options.output, filename),
      sourceContent: JSON.stringify(row),
      sourceFileName: filename.replace(/\.json$/, ".source.json"),
      environmentMarker: options.target,
      runId: `simply-identity-${options.target}-${mapping.id}-${authorization.artifact_fingerprint.slice(0, 12)}`,
      createdAt: capturedAt,
    });
    plans.push({ mapping_id: String(mapping.id), offer_id: String(offer.id), file: filename, artifact_sha256: written.artifactSha256, plan_fingerprint: item.importPlan.meta.plan_fingerprint, source_row_fingerprint: item.importPlan.meta.source_row_fingerprint });
  }
  invariant(plans.length + completed.length === 120, "identity plan scope mismatch");
  const report = { schema_version: 2, kind: "simply-supplements-complete-identity-plan-set-v2", result: "PASS", target_environment: options.target.toUpperCase(), target_project_ref: REFS[options.target], approval_fingerprint: authorization.artifact_fingerprint, reviewed_scope_count: 120, remaining_plan_count: plans.length, completed_mapping_count: completed.length, completed_mapping_ids: completed, expected_deltas: { mapping_identity_updates: plans.length, mapping_external_options_updates: plans.length, mapping_url_updates: 0, offer_updates: 0, price_history_inserts: 0, row_creates: 0, row_deletes: 0 }, plans, captured_at: capturedAt, database_writes: 0 };
  fs.mkdirSync(options.output, { recursive: true });
  fs.writeFileSync(path.join(options.output, "builder-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: report.result, target: report.target_environment, remaining: report.remaining_plan_count, completed: report.completed_mapping_count, database_writes: 0 }, null, 2))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { buildItem, buildRow, objects, parseArgs, stateKind, validateAuthority };
