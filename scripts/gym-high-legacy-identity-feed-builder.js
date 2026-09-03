const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { EXTRA_COLUMNS, serializeCsv } = require("./six-pack-canary-builder");
const { assertApproval } = require("./gym-high-reviewed-catalogue-bootstrap");
const { canonicalJson } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const APPROVAL = path.join(ROOT, "config", "retailers", "gym-high-reviewed-full-catalogue-2026-08-01.json");
const SOURCE = path.join(ROOT, "tmp", "gym-high-source-monitor", "approved-catalogue-report.json");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "gym-high-reviewed-catalogue", "legacy-identity-upgrade.csv");

const UPGRADES = Object.freeze([
  [1,1,1,"632","632","2965"], [3,4,403,"661","676","956"],
  [4,5,367,"696","697","1044"], [5,6,414,"639","640","2741"],
  [76,539,411,"680","681","1047"], [77,542,444,"702","702","2966"],
  [78,543,390,"703","704","1064"], [106,535,429,"635","635","2967"],
  [135,549,495,"738","739","1843"], [136,550,508,"2796","2796","2975"],
  [137,538,510,"3627","4299","999"], [138,553,527,"3955","3957","2711"],
  [139,536,427,"638","638","2968"], [140,537,408,"646","1337","2735"],
  [141,540,412,"700","700","2969"], [142,544,413,"707","707","2970"],
  [144,546,445,"712","712","574"], [384,541,389,"701","701","2971"],
  [385,551,516,"3333","3333","2972"], [386,552,525,"3405","3405","510"],
  [387,554,529,"4623","4623","2973"],
].map(([mappingId, offerId, productId, externalProductId, externalVariantId, variantId]) => ({ mappingId, offerId, productId, externalProductId, externalVariantId, variantId })));

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function parseArgs(argv) {
  let output = DEFAULT_OUTPUT;
  for (const argument of argv) {
    const match = argument.match(/^--output=(.*)$/);
    if (!match || output !== DEFAULT_OUTPUT) fail(`Invalid argument ${argument}`);
    output = path.resolve(match[1]);
  }
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return { output };
}
function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function optionEvidence(family, reviewed) {
  if (family.external_product_id === reviewed.external_variant_id) return null;
  const options = { Flavour: reviewed.canonical_label };
  if (family.size_value != null && family.size_unit) options.Size = `${family.size_value}${family.size_unit}`;
  return options;
}
function controls(spec, mapping, family) {
  const standalone = spec.externalProductId === spec.externalVariantId;
  return standalone ? {
    legacy_mapping_upgrade: "true", retailer_product_id: String(spec.mappingId), expected_retailer_product_updated_at: mapping.updated_at,
    legacy_mapping_standalone: "true", legacy_standalone_sellable_count: "1", legacy_standalone_has_options: "false",
    legacy_duplicate_source_listing: "false", legacy_identity_drift: "false",
  } : {
    legacy_mapping_upgrade: "true", retailer_product_id: String(spec.mappingId), expected_retailer_product_updated_at: mapping.updated_at,
    legacy_mapping_optioned: "true", legacy_duplicate_source_listing: "false", legacy_identity_drift: "false",
  };
}
function mappingState(spec, family, reviewed, mapping, offer) {
  const expectedOptions = optionEvidence(family, reviewed);
  const complete = mapping.retailer_id === 1 && String(mapping.product_id) === String(spec.productId) &&
    String(mapping.product_variant_id) === spec.variantId && mapping.external_product_id === spec.externalProductId &&
    mapping.external_variant_id === spec.externalVariantId && mapping.external_sku == null &&
    canonicalJson(mapping.external_options ?? null) === canonicalJson(expectedOptions) &&
    offer.retailer_id === 1 && String(offer.retailer_product_id) === String(mapping.id) &&
    String(offer.product_id) === String(spec.productId) && String(offer.product_variant_id) === spec.variantId;
  if (complete) return "COMPLETE";
  const legacy = mapping.retailer_id === 1 && String(mapping.product_id) === String(spec.productId) &&
    mapping.external_product_id == null && mapping.external_variant_id == null && mapping.external_sku == null && mapping.external_options == null &&
    offer.retailer_id === 1 && String(offer.retailer_product_id) === String(mapping.id) && String(offer.product_id) === String(spec.productId);
  return legacy ? "LEGACY" : "DRIFT";
}
function buildRow({ spec, source, family, reviewed, product, variant, mapping, offer, capturedAt }) {
  const shippingKnown = offer.shipping_cost != null;
  return {
    retailer_name: "GYM HIGH", retailer_website: "https://gymhigh.co.uk",
    external_product_id: spec.externalProductId, external_variant_id: spec.externalVariantId,
    product_name: product.name, variant_name: variant.display_name, brand: product.brand, category: product.category,
    description: "", image: product.image || "", slug: product.slug, external_url: mapping.external_url, affiliate_url: offer.url,
    external_gtin: mapping.external_gtin || "", price: String(offer.price), shipping_known: String(shippingKnown), shipping_cost: shippingKnown ? String(offer.shipping_cost) : "",
    in_stock: String(offer.in_stock), is_for_sale: "true", size: variant.size_value ?? "", size_unit: variant.size_unit ?? "",
    flavour: variant.flavour_label || variant.flavour_code || "", product_format: variant.product_format || product.product_format || "",
    pack_count: variant.pack_count ?? 1, source_updated_at: capturedAt, external_sku: "",
    external_options: optionEvidence(family, reviewed) == null ? "" : JSON.stringify(optionEvidence(family, reviewed)), product_id: String(product.id), product_variant_id: String(variant.id),
    ...controls(spec, mapping, family),
  };
}
async function run(options, dependencies = {}) {
  const approval = assertApproval(dependencies.approval || JSON.parse(fs.readFileSync(APPROVAL, "utf8")));
  const sourceReport = dependencies.sourceReport || JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  if (sourceReport.result !== "PASS" || sourceReport.production_writes !== 0 || sourceReport.source_identity_fingerprint !== approval.source_identity_fingerprint || sourceReport.source_row_count !== 71) fail("GYM HIGH source report binding mismatch");
  const db = dependencies.client || loadClient();
  const [products, variants, mappings, offers] = await Promise.all([
    db.from("products").select("id,name,slug,brand,category,image,product_format,is_active,merged_into_product_id").in("id", UPGRADES.map((row) => row.productId)),
    db.from("product_variants").select("id,product_id,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default").in("id", UPGRADES.map((row) => Number(row.variantId))),
    db.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_options,external_name,external_slug,external_url,updated_at").in("id", UPGRADES.map((row) => row.mappingId)),
    db.from("offers").select("id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at").in("id", UPGRADES.map((row) => row.offerId)),
  ]);
  for (const result of [products, variants, mappings, offers]) if (result.error) throw result.error;
  const byId = (rows) => new Map(rows.map((row) => [String(row.id), row]));
  const productById = byId(products.data), variantById = byId(variants.data), mappingById = byId(mappings.data), offerById = byId(offers.data);
  const familyByExternal = new Map(approval.families.map((family) => [String(family.external_product_id), family]));
  const sourceByKey = new Map(sourceReport.rows.map((row) => [`${row.external_product_id}:${row.external_variant_id}`, row]));
  const rows = [];
  const completedMappingIds = [];
  for (const spec of UPGRADES) {
    const product = productById.get(String(spec.productId)), variant = variantById.get(spec.variantId), mapping = mappingById.get(String(spec.mappingId)), offer = offerById.get(String(spec.offerId));
    const family = familyByExternal.get(spec.externalProductId), reviewed = family?.variants.find((row) => String(row.external_variant_id) === spec.externalVariantId), source = sourceByKey.get(`${spec.externalProductId}:${spec.externalVariantId}`);
    if (!product || !variant || !mapping || !offer || !family || !reviewed || !source || product.is_active !== true || product.merged_into_product_id != null || variant.is_active !== true || String(variant.product_id) !== String(product.id)) fail(`Legacy identity drift for mapping ${spec.mappingId}`);
    const state = mappingState(spec, family, reviewed, mapping, offer);
    if (state === "COMPLETE") { completedMappingIds.push(String(spec.mappingId)); continue; }
    if (state !== "LEGACY") fail(`Legacy identity drift for mapping ${spec.mappingId}`);
    rows.push(buildRow({ spec, source, family, reviewed, product, variant, mapping, offer, capturedAt: sourceReport.captured_at }));
  }
  if (rows.length + completedMappingIds.length !== 21 || new Set([...rows.map((row) => row.retailer_product_id), ...completedMappingIds]).size !== 21) fail("GYM HIGH identity feed scope mismatch");
  const controlColumns = [...new Set(rows.flatMap(Object.keys))].filter((key) => ![...fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(","), ...EXTRA_COLUMNS].includes(key));
  const header = [...fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(","), ...EXTRA_COLUMNS, ...controlColumns];
  const csv = serializeCsv(header, rows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const partsDir = options.output.replace(/\.csv$/i, "-rows");
  fs.mkdirSync(partsDir, { recursive: true });
  const rowArtifacts = rows.map((row, index) => {
    const filename = `${String(index + 1).padStart(2, "0")}-mapping-${row.retailer_product_id}.csv`;
    const bytes = serializeCsv(header, [row]);
    fs.writeFileSync(path.join(partsDir, filename), bytes);
    return { mapping_id: row.retailer_product_id, filename, sha256: sha256(bytes) };
  });
  const report = { schema_version: 1, kind: "gym-high-legacy-identity-feed", result: "PASS", database_writes: 0, reviewed_scope_count: 21, row_count: rows.length, remaining_upgrade_count: rows.length, completed_mapping_count: completedMappingIds.length, completed_mapping_ids: completedMappingIds, standalone_count: rows.filter((row) => row.legacy_mapping_standalone === "true").length, optioned_count: rows.filter((row) => row.legacy_mapping_optioned === "true").length, approval_fingerprint: approval.approval_fingerprint, source_identity_fingerprint: sourceReport.source_identity_fingerprint, csv_sha256: sha256(csv), output: path.relative(ROOT, options.output), row_artifact_count: rowArtifacts.length, row_artifacts_directory: path.relative(ROOT, partsDir), row_artifacts: rowArtifacts };
  fs.writeFileSync(options.output.replace(/\.csv$/i, "-builder-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { UPGRADES, buildRow, controls, mappingState, optionEvidence, parseArgs, run };
