const fs = require("node:fs");
const path = require("node:path");
const config = require("../config/retailers/dolphin-vegan-protein-offer-sync.json");

const ROOT = path.resolve(__dirname, "..");
const HEADERS = "retailer_name,retailer_website,external_product_id,external_variant_id,product_name,variant_name,brand,category,description,image,slug,external_url,affiliate_url,external_gtin,price,shipping_known,shipping_cost,in_stock,is_for_sale,size,size_unit,flavour,product_format,pack_count,source_updated_at,product_id,product_variant_id".split(",");

function fail(message) { throw new Error(message); }
function csv(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

function parseProductPage(html, capturedAt = new Date().toISOString()) {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title !== config.source_title) fail("Dolphin exact product title drift");
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const documents = scripts.map((match) => JSON.parse(match[1]));
  const group = documents.find((item) => item?.["@type"] === "ProductGroup" && String(item.productGroupID) === config.external_product_id);
  if (!group || !Array.isArray(group.hasVariant)) fail("Dolphin exact ProductGroup is missing");
  const product = group.hasVariant.find((item) => item?.sku === config.external_variant_id && item?.url === config.source_url);
  const offer = product?.offers;
  if (!product || product.name !== config.source_title || offer?.priceCurrency !== "GBP" || offer?.seller?.name !== config.retailer_name) fail("Dolphin variant identity drift");
  const price = Number(offer.price);
  if (!Number.isFinite(price) || price <= 0) fail("Dolphin price is invalid");
  const availability = String(offer.availability || "");
  if (!/\/(InStock|OutOfStock)$/.test(availability)) fail("Dolphin availability is invalid");
  const inStock = availability.endsWith("/InStock");
  return {
    retailer_name: config.retailer_name, retailer_website: config.retailer_website,
    external_product_id: config.external_product_id, external_variant_id: config.external_variant_id,
    product_name: config.product_name, variant_name: config.variant_name, brand: "Optimum Nutrition",
    category: "Whey Protein", description: "", image: "", slug: "optimum-nutrition-100-plant-protein-684g",
    external_url: config.source_url, affiliate_url: config.source_url, external_gtin: "",
    price: price.toFixed(2), shipping_known: "true", shipping_cost: config.shipping_cost_gbp,
    in_stock: String(inStock), is_for_sale: "true", size: "684", size_unit: "g",
    flavour: "Vanilla", product_format: "powder", pack_count: "1", source_updated_at: capturedAt,
    product_id: String(config.product_id), product_variant_id: String(config.product_variant_id),
    retailer_product_id: String(config.retailer_product_id), offer_id: String(config.offer_id),
  };
}

function parseArgs(argv) {
  if (argv.length !== 1 || !argv[0].startsWith("--output=")) fail("Required --output=tmp/<file>.csv");
  const output = path.resolve(argv[0].slice(9));
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(output) !== ".csv") fail("Output must be a CSV inside tmp");
  return output;
}

async function run(output, options = {}) {
  const response = await (options.fetch || fetch)(config.source_url, { headers: { accept: "text/html", "user-agent": "SupplementScout-Dolphin-Offer-Refresh/1.0" }, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) fail("Dolphin source response is invalid");
  const row = parseProductPage(await response.text(), (options.now || new Date()).toISOString());
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${HEADERS.join(",")}\n${HEADERS.map((key) => csv(row[key])).join(",")}\n`);
  return { result: "PASS", source_url: config.source_url, rows: 1, price: row.price, in_stock: row.in_stock === "true", production_writes: 0, output: path.relative(ROOT, output) };
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { HEADERS, parseArgs, parseProductPage, run };
