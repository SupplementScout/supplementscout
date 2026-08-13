const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { buildReadOnlyPreview, loadClient, readAll } = require("./gtin-promotion-dry-run");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { assertConfig, browseIdentity, buildReport, DEFAULT_POLICY, evaluateIdentity } = require("./lib/ebay-browse-pilot");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "ebay-uk-coverage");
const EXPECTED_IDENTITIES = 54;

function parseArgs(argv) {
  const options = { prepareInput: false, outputDir: DEFAULT_OUTPUT };
  for (const argument of argv) {
    if (argument === "--prepare-input") options.prepareInput = true;
    else if (argument.startsWith("--output-dir=")) {
      const resolved = path.resolve(ROOT, argument.slice("--output-dir=".length));
      const relative = path.relative(path.join(ROOT, "tmp"), resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output directory must be inside repository tmp");
      options.outputDir = resolved;
    } else throw new Error(`Unsupported argument: ${argument}`);
  }
  return options;
}

function currentOfferEvidence(identity, mappings, offers) {
  const mappingIds = new Set(mappings.filter((mapping) =>
    String(mapping.product_id) === identity.product_id && (
      String(mapping.product_variant_id || "") === identity.variant_id ||
      (identity.destination_field === "products.gtin" && mapping.product_variant_id == null)
    )
  ).map((mapping) => String(mapping.id)));
  const eligible = offers.filter((offer) => mappingIds.has(String(offer.retailer_product_id)) && offer.in_stock === true && Number(offer.price) > 0);
  const retailerCount = new Set(eligible.map((offer) => String(offer.retailer_id))).size;
  const delivered = eligible.map((offer) => {
    const price = Number(offer.price);
    const shipping = offer.shipping_cost === null || offer.shipping_cost === "" ? null : Number(offer.shipping_cost);
    return Number.isFinite(price) && Number.isFinite(shipping) && shipping >= 0 ? Number((price + shipping).toFixed(2)) : null;
  }).filter((value) => value !== null).sort((a, b) => a - b);
  return { current_retailer_count: retailerCount, current_best_delivered_price: delivered[0] ?? null };
}

async function buildInput(client, capturedAt = new Date().toISOString()) {
  const [{ preview }, products, variants, mappings, offers] = await Promise.all([
    buildReadOnlyPreview({ target: "production", output: null }, { client }),
    readAll(client, "products", "id,name,brand,category,net_weight_g,unit_count,unit_type,product_format,is_active,merged_into_product_id"),
    readAll(client, "product_variants", "id,product_id,display_name,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active"),
    readAll(client, "retailer_products", "id,retailer_id,product_id,product_variant_id"),
    readAll(client, "offers", "id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,last_checked_at"),
  ]);
  if (preview.candidate_count !== EXPECTED_IDENTITIES || preview.rows.some((row) => row.decision !== "ALREADY_PRESENT")) {
    throw new Error("Safe GTIN identity gate failed: expected exactly 54 ALREADY_PRESENT identities");
  }
  const rows = preview.rows.map((row) => {
    const product = products.find((value) => String(value.id) === row.product_id);
    const variant = variants.find((value) => String(value.id) === row.variant_id);
    if (!product || !variant || product.is_active === false || variant.is_active === false || product.merged_into_product_id != null) {
      throw new Error(`Canonical identity is no longer active: ${row.product_id}/${row.variant_id}`);
    }
    return {
      product_id: row.product_id,
      variant_id: row.variant_id,
      destination_field: row.destination_field,
      brand: product.brand,
      product_name: product.name,
      variant: variant.display_name,
      flavour_label: variant.flavour_label,
      size_value: variant.size_value,
      size_unit: variant.size_unit,
      pack_count: variant.pack_count,
      unit_count: product.unit_count,
      unit_type: product.unit_type,
      net_weight_g: product.net_weight_g,
      product_format: variant.product_format || product.product_format,
      gtin: row.gtin,
      category: product.category,
      ...currentOfferEvidence(row, mappings, offers),
    };
  }).sort((a, b) => BigInt(a.product_id) < BigInt(b.product_id) ? -1 : BigInt(a.product_id) > BigInt(b.product_id) ? 1 : BigInt(a.variant_id) < BigInt(b.variant_id) ? -1 : 1);
  return sealInput(rows, capturedAt, preview.preview_fingerprint);
}

function sealInput(rows, capturedAt, sourcePreviewFingerprint) {
  const artifact = {
    schema_version: 1,
    operation_type: "EBAY_BROWSE_API_PILOT_INPUT",
    read_only: true,
    captured_at: capturedAt,
    source_preview_fingerprint: sourcePreviewFingerprint,
    identity_count: rows.length,
    rows,
    artifact_fingerprint: null,
  };
  artifact.artifact_fingerprint = hash("EBAY-BROWSE-INPUT:1", {
    schema_version: artifact.schema_version,
    operation_type: artifact.operation_type,
    read_only: artifact.read_only,
    identity_count: artifact.identity_count,
    rows: artifact.rows,
  });
  return artifact;
}

function writeImmutableJson(directory, name, value) {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(`${target}.sha256`, `${value.artifact_fingerprint}  ${name}\n`, { encoding: "utf8", flag: "wx" });
  return path.relative(ROOT, target);
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const config = options.prepareInput ? null : assertConfig(dependencies.env || process.env);
  const client = dependencies.client || loadClient();
  const input = await buildInput(client, dependencies.now?.() || new Date().toISOString());
  const stamp = input.captured_at.replace(/[:.]/g, "-");
  const inputPath = writeImmutableJson(options.outputDir, `ebay-pilot-input-${stamp}.json`, input);
  if (options.prepareInput) {
    console.log(JSON.stringify({ mode: "prepare-input", input: inputPath, identities: input.identity_count, database_writes: 0, ebay_api_calls: 0, fingerprint: input.artifact_fingerprint }, null, 2));
    return { input, inputPath };
  }

  const policy = {
    ...DEFAULT_POLICY,
    marketplace_id: config.marketplace_id,
    minimum_feedback_percentage: Number((dependencies.env || process.env).EBAY_PILOT_MIN_FEEDBACK_PERCENTAGE || DEFAULT_POLICY.minimum_feedback_percentage),
    minimum_feedback_score: Number((dependencies.env || process.env).EBAY_PILOT_MIN_FEEDBACK_SCORE || DEFAULT_POLICY.minimum_feedback_score),
    affiliate_campaign_configured: Boolean(config.campaign_id),
  };
  const fetchImpl = dependencies.fetch || fetch;
  const results = [];
  const rawRows = [];
  for (const identity of input.rows) {
    const items = await browseIdentity(identity, config, fetchImpl);
    rawRows.push({ product_id: identity.product_id, variant_id: identity.variant_id, gtin: identity.gtin, items });
    results.push(evaluateIdentity(identity, items, policy));
  }
  const report = buildReport(input, results, policy, { captured_at: dependencies.now?.() || new Date().toISOString(), affiliate_campaign_configured: Boolean(config.campaign_id) });
  const raw = { schema_version: 1, operation_type: "EBAY_BROWSE_API_PILOT_RAW", captured_at: report.captured_at, rows: rawRows, artifact_fingerprint: null };
  raw.artifact_fingerprint = hash("EBAY-BROWSE-RAW:1", raw);
  const rawPath = writeImmutableJson(options.outputDir, `ebay-pilot-raw-${stamp}.json`, raw);
  const reportPath = writeImmutableJson(options.outputDir, `ebay-pilot-report-${stamp}.json`, report);
  console.log(JSON.stringify({ input: inputPath, raw: rawPath, report: reportPath, summary: report.summary, database_writes: 0 }, null, 2));
  return { input, report, inputPath, rawPath, reportPath };
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildInput, currentOfferEvidence, main, parseArgs, sealInput, writeImmutableJson };
