const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { EXTRA_COLUMNS, serializeCsv } = require("./six-pack-canary-builder");
const { assertApproval, inspectVariants } = require("./gym-high-reviewed-catalogue-bootstrap");
const { shippingCostTextForPrice } = require("./gym-high-shipping-policy");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const APPROVAL = path.join(ROOT, "config", "retailers", "gym-high-reviewed-full-catalogue-2026-08-01.json");
const DEFAULT_SOURCE = path.join(ROOT, "tmp", "gym-high-source-monitor", "approved-catalogue-report.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "gym-high-reviewed-catalogue", "full-catalogue.csv");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(source|output)=(.*)$/);
    if (!match || values[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    values[match[1]] = path.resolve(match[2]);
  }
  const source = values.source || DEFAULT_SOURCE;
  const output = values.output || DEFAULT_OUTPUT;
  for (const target of [source, output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Inputs and output must be inside repository tmp");
  }
  return { source, output };
}

function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function reviewedOptions(family, variant) {
  if (String(family.external_product_id) === String(variant.external_variant_id)) return null;
  if (["713", "719"].includes(String(family.external_product_id))) return { Fit: variant.canonical_label };
  if (String(family.external_product_id) === "708") return { Colour: variant.canonical_label };
  const options = { Flavour: variant.canonical_label };
  if (family.size_value != null && family.size_unit) options.Size = `${family.size_value}${family.size_unit}`;
  return options;
}

function assertSource(approval, source, now = new Date()) {
  if (source.result !== "PASS" || source.production_writes !== 0 || source.source_row_count !== 71 || source.source_identity_fingerprint !== approval.source_identity_fingerprint) fail("GYM HIGH source report binding mismatch");
  const capturedAt = new Date(source.captured_at);
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt > new Date(now.getTime() + 5 * 60_000) || capturedAt < new Date(now.getTime() - 24 * 60 * 60_000)) fail("GYM HIGH source report is stale or in the future");
  const approvedKeys = new Set(approval.families.flatMap((family) => family.variants.map((variant) => `${family.external_product_id}:${variant.external_variant_id}`)));
  const sourceKeys = source.rows.map((row) => `${row.external_product_id}:${row.external_variant_id}`);
  if (new Set(sourceKeys).size !== 71 || sourceKeys.filter((key) => approvedKeys.has(key)).length !== 66) fail("GYM HIGH approved source coverage mismatch");
  const omitted = sourceKeys.filter((key) => !approvedKeys.has(key)).sort();
  const expectedOmitted = [...approval.excluded_source_rows, ...approval.exception_source_rows].sort();
  if (JSON.stringify(omitted) !== JSON.stringify(expectedOmitted)) fail("GYM HIGH source exclusions drift");
  return new Map(source.rows.map((row) => [`${row.external_product_id}:${row.external_variant_id}`, row]));
}

function resolveBindings(approval, products, variants) {
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const key = String(variant.product_id);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(variant);
  }
  const bindings = [];
  for (const family of approval.families) {
    const product = productById.get(String(family.product_id));
    if (!product || product.name !== family.expected_name || product.is_active !== true || product.merged_into_product_id != null || (product.product_format || null) !== (family.product_format || null)) fail(`Canonical product drift for ${family.external_product_id}`);
    const actions = inspectVariants(family, variantsByProduct.get(String(family.product_id)) || []);
    if (actions.some((row) => row.action === "CREATE_VARIANT")) fail(`Canonical variant bootstrap incomplete for ${family.external_product_id}`);
    for (const action of actions) {
      const reviewed = family.variants.find((row) => String(row.external_variant_id) === String(action.external_variant_id));
      const variant = (variantsByProduct.get(String(family.product_id)) || []).find((row) => String(row.id) === String(action.product_variant_id));
      if (!reviewed || !variant || variant.is_active !== true || String(variant.product_id) !== String(product.id)) fail(`Canonical variant drift for ${family.external_product_id}:${action.external_variant_id}`);
      bindings.push({ family, reviewed, product, variant });
    }
  }
  if (bindings.length !== 66 || new Set(bindings.map(({ family, reviewed }) => `${family.external_product_id}:${reviewed.external_variant_id}`)).size !== 66) fail("GYM HIGH canonical binding scope mismatch");
  return bindings;
}

function buildFeedRow(binding, source, mapping, offer, capturedAt) {
  const { family, reviewed, product, variant } = binding;
  const options = reviewedOptions(family, reviewed);
  return {
    retailer_name: "GYM HIGH", retailer_website: "https://gymhigh.co.uk",
    external_product_id: String(family.external_product_id), external_variant_id: String(reviewed.external_variant_id),
    product_name: product.name, variant_name: variant.display_name, brand: product.brand, category: product.category,
    description: "", image: product.image || "", slug: product.slug,
    external_url: source.canonical_url, affiliate_url: source.canonical_url, external_gtin: mapping?.external_gtin || "",
    price: String(source.price_gbp), shipping_known: "true", shipping_cost: shippingCostTextForPrice(source.price_gbp),
    in_stock: String(source.in_stock), is_for_sale: "true",
    size: variant.size_value ?? "", size_unit: variant.size_unit ?? "", flavour: variant.flavour_label || variant.flavour_code || "",
    product_format: variant.product_format || product.product_format || "", pack_count: variant.pack_count ?? 1,
    source_updated_at: capturedAt, external_sku: source.sku || "",
    external_options: options == null ? "" : JSON.stringify(options), product_id: String(product.id), product_variant_id: String(variant.id),
  };
}

async function run(options, dependencies = {}) {
  const approval = assertApproval(dependencies.approval || JSON.parse(fs.readFileSync(APPROVAL, "utf8")));
  const source = dependencies.source || JSON.parse(fs.readFileSync(options.source, "utf8"));
  const sourceByKey = assertSource(approval, source, dependencies.now || new Date());
  const db = dependencies.client || loadClient();
  const productIds = [...new Set(approval.families.map((row) => Number(row.product_id)))];
  const [productsResult, variantsResult, mappingsResult, offersResult] = await Promise.all([
    db.from("products").select("id,name,slug,brand,category,image,product_format,is_active,merged_into_product_id").in("id", productIds),
    db.from("product_variants").select("id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default").in("product_id", productIds),
    db.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_options,external_url").eq("retailer_id", 1),
    db.from("offers").select("id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at").eq("retailer_id", 1),
  ]);
  for (const result of [productsResult, variantsResult, mappingsResult, offersResult]) if (result.error) throw result.error;
  const bindings = resolveBindings(approval, productsResult.data || [], variantsResult.data || []);
  const approvedKeys = new Set(bindings.map(({ family, reviewed }) => `${family.external_product_id}:${reviewed.external_variant_id}`));
  const mappingByKey = new Map();
  for (const mapping of mappingsResult.data || []) {
    const key = `${mapping.external_product_id}:${mapping.external_variant_id}`;
    if (!approvedKeys.has(key)) fail(`Unapproved GYM HIGH mapping ${mapping.id} remains in retailer scope`);
    if (mappingByKey.has(key)) fail(`Duplicate GYM HIGH mapping for ${key}`);
    mappingByKey.set(key, mapping);
  }
  const offerByMapping = new Map();
  for (const offer of offersResult.data || []) {
    const key = String(offer.retailer_product_id);
    if (offerByMapping.has(key)) fail(`Duplicate GYM HIGH offer for mapping ${key}`);
    offerByMapping.set(key, offer);
  }
  const rows = [];
  let existingMappingCount = 0;
  let existingOfferCount = 0;
  for (const binding of bindings) {
    const sourceKey = `${binding.family.external_product_id}:${binding.reviewed.external_variant_id}`;
    const sourceRow = sourceByKey.get(sourceKey);
    const mapping = mappingByKey.get(sourceKey) || null;
    const offer = mapping ? offerByMapping.get(String(mapping.id)) || null : null;
    if (!sourceRow) fail(`Approved source row missing for ${sourceKey}`);
    if (mapping && (String(mapping.product_id) !== String(binding.product.id) || String(mapping.product_variant_id) !== String(binding.variant.id))) fail(`GYM HIGH mapping canonical drift for ${sourceKey}`);
    if (offer && (String(offer.product_id) !== String(binding.product.id) || String(offer.product_variant_id) !== String(binding.variant.id))) fail(`GYM HIGH offer canonical drift for ${sourceKey}`);
    if (mapping) existingMappingCount += 1;
    if (offer) existingOfferCount += 1;
    rows.push(buildFeedRow(binding, sourceRow, mapping, offer, source.captured_at));
  }
  if (existingMappingCount !== mappingByKey.size || existingOfferCount !== offerByMapping.size) fail("GYM HIGH retailer scope contains orphan state");
  const header = [...fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(","), ...EXTRA_COLUMNS];
  const csv = serializeCsv(header, rows);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, csv);
  const rowsDirectory = options.output.replace(/\.csv$/i, "-rows");
  fs.mkdirSync(rowsDirectory, { recursive: true });
  const rowArtifacts = rows.map((row, index) => {
    const filename = `${String(index + 1).padStart(2, "0")}-${row.external_product_id}-${row.external_variant_id}.csv`;
    const bytes = serializeCsv(header, [row]);
    fs.writeFileSync(path.join(rowsDirectory, filename), bytes);
    return { source_key: `${row.external_product_id}:${row.external_variant_id}`, filename, sha256: sha256(bytes) };
  });
  const report = {
    schema_version: 1, kind: "gym-high-reviewed-full-catalogue-feed", result: "PASS", database_writes: 0,
    target_project_ref: PROJECT_REF, approval_fingerprint: approval.approval_fingerprint,
    source_identity_fingerprint: source.source_identity_fingerprint, source_captured_at: source.captured_at,
    approved_row_count: rows.length, existing_mapping_count: existingMappingCount, mapping_create_count: 66 - existingMappingCount,
    existing_offer_count: existingOfferCount, offer_create_count: 66 - existingOfferCount,
    csv_sha256: sha256(csv), output: path.relative(ROOT, options.output), row_artifact_count: rowArtifacts.length,
    row_artifacts_directory: path.relative(ROOT, rowsDirectory), row_artifacts: rowArtifacts,
  };
  fs.writeFileSync(options.output.replace(/\.csv$/i, "-builder-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { assertSource, buildFeedRow, parseArgs, resolveBindings, reviewedOptions, run };
