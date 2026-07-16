const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { atomicWrite } = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUTS = {
  audit: path.join(ROOT, "tmp/jons-adapter-audit.md"),
  per4m: path.join(ROOT, "tmp/jons-per4m-pilot-source.csv"),
  newCanonical: path.join(ROOT, "tmp/jons-new-canonical-pilot-source.csv"),
  correctedNewCanonical: path.join(ROOT, "tmp/jons-corrected-new-canonical-source.csv"),
  sevenRecord: path.join(ROOT, "tmp/jons-seven-record-pilot-source.csv"),
  combinedJson: path.join(ROOT, "tmp/jons-combined-pilot-validation.json"),
  combinedMd: path.join(ROOT, "tmp/jons-combined-pilot-report.md"),
};
const EXPECTED_HASHES = {
  csv: "0db4020fc134dca89a61ef07546cb1a58cd9df31685867c6601f4f7ca1429e08",
  json: "2f0e6fbfb4f6a0dba5a3f847985c6072c40ca33b2e2dbdac7299be4b2ee98967",
};
const HEADER = [
  "retailer_name", "retailer_website", "product_id", "product_variant_id",
  "external_product_id", "external_variant_id", "external_sku", "external_options",
  "product_name", "variant_name", "brand", "category", "description", "image", "slug",
  "external_url", "affiliate_url", "external_gtin", "price", "shipping_known",
  "shipping_cost", "total_price", "in_stock", "is_for_sale", "size", "size_unit",
  "flavour", "product_format", "pack_count", "servings", "source_unit_count",
  "source_unit_type", "source_updated_at",
];

const PER4M_PILOT = [
  { variantId: "50561871413586", productId: "12", productVariantId: "1003", canonicalName: "Per4m Whey Protein 2kg", slug: "per4m-whey-protein-2kg", flavour: "Strawberry Cream", variantName: "Strawberry Cream / 2kg" },
  { variantId: "50561870397778", productId: "12", canonicalName: "Per4m Whey Protein 2kg", slug: "per4m-whey-protein-2kg", flavour: "Banana Cream", variantName: "Banana Cream / 2kg" },
  { variantId: "50561870987602", productId: "12", canonicalName: "Per4m Whey Protein 2kg", slug: "per4m-whey-protein-2kg", flavour: "Double Chocolate", variantName: "Double Chocolate / 2kg" },
  { variantId: "50561871348050", productId: "12", canonicalName: "Per4m Whey Protein 2kg", slug: "per4m-whey-protein-2kg", flavour: "Salted Caramel", variantName: "Salted Caramel / 2kg" },
  { variantId: "50561871479122", productId: "12", canonicalName: "Per4m Whey Protein 2kg", slug: "per4m-whey-protein-2kg", flavour: "Vanilla Cream", variantName: "Vanilla Cream / 2kg" },
];

const NEW_CANONICAL_PILOT = [
  { variantId: "53896427798866", canonicalName: "Per4m Mult Vita+Min 30 Capsules", slug: "per4m-mult-vita-min-30-capsules", brand: "Per4m", category: "Vitamins", format: "capsule", unitCount: "30", unitType: "capsule", servings: "30", variantName: "Default" },
  { variantId: "50927006581074", canonicalName: "TBJP Oh Mega Pharma Pro 180 Capsules", slug: "tbjp-oh-mega-pharma-pro-180-capsules", brand: "TBJP Nutrition", category: "Health Supplements", format: "capsule", unitCount: "180", unitType: "capsule", variantName: "Default" },
];

const SHIPPING = Object.freeze({ threshold: 90, below: 3.99, atOrAbove: 0, source: "MANUAL_USER_CONFIRMED" });

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function text(value) { return String(value ?? "").trim(); }
function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) fail(`Invalid price: ${value}`);
  return number.toFixed(2);
}
function csvCell(value) {
  const valueText = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(valueText) ? `"${valueText.replace(/"/g, '""')}"` : valueText;
}
function serializeCsv(rows) {
  return `${[HEADER, ...rows.map((row) => HEADER.map((key) => row[key] ?? ""))].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
function optionTuple(name, value) {
  const normalizedName = text(name) || "Title";
  const normalizedValue = text(value) || "Default Title";
  return `${normalizedName.toLowerCase()}=${normalizedValue.toLowerCase()}`;
}
function getImage(product, variant) {
  return text(variant.featured_image?.src || variant.featured_image || product.images?.[0]?.src);
}
function isHttps(value) { try { return new URL(value).protocol === "https:"; } catch { return false; } }

function parseAndJoin(csvText, jsonText) {
  const csvRows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
  let payload;
  try { payload = JSON.parse(jsonText); } catch { fail("Shopify JSON is invalid"); }
  if (!Array.isArray(payload.products)) fail("Shopify JSON is missing products");
  const csvVariants = csvRows.filter((row) => text(row["Variant Price"]));
  const optionNames = new Map();
  for (const row of csvRows) {
    const handle = text(row.Handle);
    const optionName = text(row["Option1 Name"]);
    if (handle && optionName) optionNames.set(handle, optionName);
  }
  const csvByKey = new Map();
  for (const row of csvVariants) {
    const handle = text(row.Handle);
    const key = `${handle}|${optionTuple(optionNames.get(handle), row["Option1 Value"])}`;
    if (csvByKey.has(key)) fail(`Duplicate CSV join key: ${key}`);
    csvByKey.set(key, row);
  }
  const joined = [];
  for (const product of payload.products) {
    for (const variant of product.variants || []) {
      const optionName = text(product.options?.[0]?.name) || "Title";
      const optionValue = text(variant.option1 || variant.title) || "Default Title";
      const key = `${text(product.handle)}|${optionTuple(optionName, optionValue)}`;
      const csv = csvByKey.get(key);
      if (!csv) continue;
      if (joined.some((row) => row.csv === csv)) fail(`Multiple Shopify matches for ${key}`);
      const csvSku = text(csv["Variant SKU"]).replace(/^'/, "");
      if (csvSku !== text(variant.sku)) fail(`SKU mismatch for variant ${variant.id}`);
      if (money(csv["Variant Price"]) !== money(variant.price)) fail(`Price mismatch for variant ${variant.id}`);
      const image = getImage(product, variant);
      if (!isHttps(image)) fail(`Invalid image for variant ${variant.id}`);
      joined.push({ product, variant, csv, optionName, optionValue, image });
    }
  }
  if (joined.length !== csvVariants.length) fail(`Exact join mismatch: ${joined.length}/${csvVariants.length}`);
  return { joined, csvRows: csvRows.length, csvVariants: csvVariants.length, products: payload.products.length };
}

function assertUniquePilotEvidence(joined, inventory) {
  const ids = new Set(inventory.map((item) => item.variantId));
  if (ids.size !== inventory.length) fail("Duplicate pilot external variant identity");
  const selected = joined.filter(({ variant }) => ids.has(String(variant.id)));
  const allGtins = new Map();
  const allSkus = new Map();
  const allVariantIds = new Map();
  for (const row of joined) {
    const gtin = text(row.csv["Variant Barcode"]);
    const sku = text(row.variant.sku);
    const variantId = String(row.variant.id);
    if (gtin) allGtins.set(gtin, (allGtins.get(gtin) || 0) + 1);
    if (sku) allSkus.set(sku, (allSkus.get(sku) || 0) + 1);
    allVariantIds.set(variantId, (allVariantIds.get(variantId) || 0) + 1);
  }
  for (const variantId of ids) {
    if ((allVariantIds.get(variantId) || 0) > 1) fail(`Duplicate external variant identity: ${variantId}`);
  }
  if (selected.length !== inventory.length) fail(`Pilot variants missing: ${selected.length}/${inventory.length}`);
  for (const row of selected) {
    const variantId = String(row.variant.id);
    if (!row.variant.available) fail(`Pilot variant is out of stock: ${row.variant.id}`);
    const gtin = text(row.csv["Variant Barcode"]);
    const sku = text(row.variant.sku);
    if (allVariantIds.get(variantId) !== 1) fail(`Duplicate external variant identity: ${variantId}`);
    if (!gtin) fail(`Pilot variant lacks GTIN: ${row.variant.id}`);
    if (allGtins.get(gtin) !== 1) fail(`Pilot variant has shared GTIN: ${row.variant.id}`);
    if (sku && allSkus.get(sku) !== 1) fail(`Pilot variant has shared SKU: ${row.variant.id}`);
  }
  return selected;
}

function buildRow(source, item, kind) {
  const { product, variant, csv, optionName, optionValue, image } = source;
  const sourceGrams = Number(csv["Variant Grams"]);
  if (!Number.isFinite(sourceGrams) || sourceGrams <= 0) fail(`Invalid grams for variant ${variant.id}`);
  if (kind === "per4m" && sourceGrams !== 2010) fail(`PER4M source pack drift: ${sourceGrams}g`);
  const normalizedOptionValue = optionName.toLowerCase() === "flavour" && item.flavour ? item.flavour : optionValue;
  const externalOptions = optionName === "Title" && optionValue === "Default Title" ? "" : JSON.stringify({ [optionName]: normalizedOptionValue });
  const price = money(variant.price);
  const shippingCost = Number(price) < SHIPPING.threshold ? SHIPPING.below : SHIPPING.atOrAbove;
  const totalPrice = (Number(price) + shippingCost).toFixed(2);
  return {
    retailer_name: "Jon's Supplements", retailer_website: "https://jonssupplements.co.uk",
    product_id: item.productId || "", product_variant_id: item.productVariantId || "",
    external_product_id: String(product.id), external_variant_id: String(variant.id), external_sku: text(variant.sku),
    external_options: externalOptions, product_name: item.canonicalName, variant_name: item.variantName,
    brand: item.brand || "Per4m", category: item.category || "Protein", description: "", image,
    slug: item.slug, external_url: `https://jonssupplements.co.uk/products/${product.handle}?variant=${variant.id}`,
    affiliate_url: `https://jonssupplements.co.uk/products/${product.handle}?variant=${variant.id}`,
    external_gtin: text(csv["Variant Barcode"]), price, shipping_known: "true",
    shipping_cost: shippingCost.toFixed(2), total_price: totalPrice, in_stock: "true", is_for_sale: "true",
    size: item.size || (kind === "per4m" ? "2000" : ""), size_unit: item.size || kind === "per4m" ? "g" : "",
    flavour: item.flavour || "", product_format: item.format || "powder",
    pack_count: item.packCount ?? (kind === "per4m" ? "1" : ""), servings: item.servings || "",
    source_unit_count: item.unitCount || "", source_unit_type: item.unitType || "",
    source_updated_at: variant.updated_at || product.updated_at || "",
  };
}

function buildPilots({ csvText, jsonText }) {
  const joined = parseAndJoin(csvText, jsonText);
  const per4mSources = assertUniquePilotEvidence(joined.joined, PER4M_PILOT);
  const newSources = assertUniquePilotEvidence(joined.joined, NEW_CANONICAL_PILOT);
  const byId = (sources) => new Map(sources.map((row) => [String(row.variant.id), row]));
  const per4mMap = byId(per4mSources);
  const newMap = byId(newSources);
  const per4mRows = PER4M_PILOT.map((item) => buildRow(per4mMap.get(item.variantId), item, "per4m"));
  const newRows = NEW_CANONICAL_PILOT.map((item) => buildRow(newMap.get(item.variantId), item, "new"));
  return { joined, per4mRows, newRows, per4mCsv: serializeCsv(per4mRows), newCsv: serializeCsv(newRows), sevenCsv: serializeCsv([...per4mRows, ...newRows]) };
}

function argValue(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
function artifactSummary(artifact) {
  const plans = artifact.plans || [];
  const rows = artifact.source_rows || [];
  const blockedRows = artifact.blocked_rows || [];
  const resolved = plans.map((entry) => entry.resolved_plan);
  const countAction = (section, action) => resolved.filter((plan) => plan?.[section]?.action === action).length;
  return {
    rows: rows.length, plans: plans.length, blocked: blockedRows.length, deduplicated: 0, writes: 0,
    new_retailers: new Set(resolved.filter((plan) => plan?.retailer?.action === "create").map((plan) => plan.retailer.values.slug)).size,
    products: { create: countAction("product", "create"), existing: countAction("product", "existing") },
    product_variants: { create_default: countAction("product_variant", "create_default"), existing: countAction("product_variant", "existing") },
    retailer_products: { create: countAction("retailer_product", "create"), update: countAction("retailer_product", "update"), noop: countAction("retailer_product", "noop") },
    offers: { create: countAction("offer", "create"), update: countAction("offer", "update"), noop: countAction("offer", "noop") },
    price_history: { create: countAction("price_history", "create"), noop: countAction("price_history", "noop") },
    blocked_reasons: blockedRows.map((row) => ({ row: row.rowNumber, product: row.productName, reason: row.block_reason || row.reason })),
  };
}
function finalize(per4mPath, newPath) {
  const per4mArtifact = JSON.parse(fs.readFileSync(per4mPath, "utf8"));
  const newArtifact = JSON.parse(fs.readFileSync(newPath, "utf8"));
  const result = {
    generated_at: new Date().toISOString(), mode: "read-only dry-run", safe_update: false,
    per4m: { artifact_sha256: sha256(fs.readFileSync(per4mPath)), ...artifactSummary(per4mArtifact) },
    new_canonical: { artifact_sha256: sha256(fs.readFileSync(newPath)), ...artifactSummary(newArtifact) },
    approvals: 0, applies: 0, database_writes: 0,
  };
  atomicWrite(OUTPUTS.combinedJson, `${JSON.stringify(result, null, 2)}\n`);
  const reasons = (pilot) => pilot.blocked_reasons.map((row) => `  - row ${row.row}: ${row.product} — ${row.reason}`).join("\n");
  atomicWrite(OUTPUTS.combinedMd, `# Jon's Supplements combined pilot\n\n- Mode: read-only dry-run\n- PER4M: ${result.per4m.rows} rows, ${result.per4m.plans} plans, ${result.per4m.blocked} blocked, ${result.per4m.deduplicated} deduplicated, ${result.per4m.writes} writes\n- New canonical: ${result.new_canonical.rows} rows, ${result.new_canonical.plans} plans, ${result.new_canonical.blocked} blocked, ${result.new_canonical.deduplicated} deduplicated, ${result.new_canonical.writes} writes\n- New-canonical planned actions: products ${result.new_canonical.products.create} create; variants ${result.new_canonical.product_variants.create_default} create_default; retailer_products ${result.new_canonical.retailer_products.create} create; offers ${result.new_canonical.offers.create} create; price_history ${result.new_canonical.price_history.create} create.\n- Approvals/apply: 0/0\n- SAFE_UPDATE: disabled\n\n## PER4M blockers\n\n${reasons(result.per4m)}\n\n## New-canonical blockers\n\n${reasons(result.new_canonical)}\n\nBlocked rows remain review items; no guard was weakened. The direct retailer URL is not an approved affiliate link. Shipping is user-confirmed at GBP ${SHIPPING.below.toFixed(2)} below GBP ${SHIPPING.threshold}, otherwise free.\n`);
  return result;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--finalize-dryruns")) {
    const result = finalize(argValue(argv, "per4m-artifact"), argValue(argv, "new-artifact"));
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  const csvPath = argValue(argv, "plain-csv");
  const jsonPath = argValue(argv, "shopify-json");
  if (!csvPath || !jsonPath) fail("Required: --plain-csv and --shopify-json");
  const csvText = fs.readFileSync(csvPath, "utf8");
  const jsonText = fs.readFileSync(jsonPath, "utf8");
  const hashes = { csv: sha256(csvText), json: sha256(jsonText) };
  if (hashes.csv !== EXPECTED_HASHES.csv || hashes.json !== EXPECTED_HASHES.json) fail("Source hash changed; re-review required");
  const built = buildPilots({ csvText, jsonText });
  atomicWrite(OUTPUTS.per4m, built.per4mCsv);
  atomicWrite(OUTPUTS.newCanonical, built.newCsv);
  atomicWrite(OUTPUTS.correctedNewCanonical, built.newCsv);
  atomicWrite(OUTPUTS.sevenRecord, built.sevenCsv);
  const pilotById = new Map([...PER4M_PILOT, ...NEW_CANONICAL_PILOT].map((item) => [item.variantId, item]));
  const evidenceRows = built.joined.joined.filter(({ variant }) => pilotById.has(String(variant.id))).map(({ product, variant, csv, optionName, optionValue }) => {
    const item = pilotById.get(String(variant.id));
    return `| ${variant.id} | ${product.id} | ${optionName}: ${optionValue} | ${item.flavour || "Default"} | ${csv["Variant Grams"] || ""}g | ${item.size || (PER4M_PILOT.includes(item) ? "2000" : "")}g | ${csv["Variant Barcode"] || ""} | ${variant.sku || ""} |`;
  }).join("\n");
  atomicWrite(OUTPUTS.audit, `# Jon's Supplements adapter audit\n\n- CSV SHA-256: ${hashes.csv}\n- Shopify JSON SHA-256: ${hashes.json}\n- Exact joins: ${built.joined.csvVariants}/${built.joined.csvVariants}\n- Shopify products inspected: ${built.joined.products}\n- PER4M pilot rows: ${built.per4mRows.length}\n- New-canonical pilot rows: ${built.newRows.length}\n- Seven-record pilot rows: ${built.per4mRows.length + built.newRows.length}\n- Emitted rows are in stock only.\n- JSON is authoritative for IDs, availability, price, URL and image. CSV is authoritative for GTIN and static export evidence.\n- PER4M source weight 2010g and raw flavour spelling are preserved below; importer working identity uses reviewed canonical 2000g and Cream normalization because the family review confirmed the commercial equivalence.\n- New-product capsule counts are preserved as source_unit_count metadata, never as pack_count. Canonical feed forbids product unit_count, so canonical creation remains a manual-review dependency.\n- free_shipping_threshold_gbp: ${SHIPPING.threshold}\n- shipping_cost_below_threshold_gbp: ${SHIPPING.below}\n- shipping_cost_at_or_above_threshold_gbp: ${SHIPPING.atOrAbove}\n- shipping_rule_source: ${SHIPPING.source}\n- affiliate_status: NOT_CONFIGURED\n- Direct Shopify URLs populate the importer-required offer URL field; no affiliate tracking is claimed.\n- Approvals, apply and database writes: 0.\n\n## Raw versus working identity\n\n| External variant | External product | Raw source option | Working flavour | Raw grams | Working grams | GTIN | SKU |\n|---|---|---|---|---:|---:|---|---|\n${evidenceRows}\n`);
  console.log(JSON.stringify({ exact_joins: built.joined.csvVariants, per4m_rows: 5, new_canonical_rows: 2, seven_record_rows: 7, writes: 0 }, null, 2));
  return built;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Jon's Supplements adapter failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { EXPECTED_HASHES, HEADER, NEW_CANONICAL_PILOT, OUTPUTS, PER4M_PILOT, SHIPPING, artifactSummary, buildPilots, finalize, main, parseAndJoin, serializeCsv, sha256 };
