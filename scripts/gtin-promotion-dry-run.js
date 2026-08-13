const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { buildCanonicalCatalogueSnapshot } = require("./lib/retailer-snapshot/canonical-snapshot");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { buildPromotionPreview, isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const PLAN_PATH = path.join(ROOT, "docs", "EBAY-UK-COVERAGE-PLAN.md");
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const EXPECTED_CONFIRMED = 40;
const EXPECTED_AUTO_SAFE = 14;
const EXPECTED_COMBINED = 54;

function parseArgs(argv) {
  const options = { target: null, output: null };
  for (const argument of argv) {
    const match = argument.match(/^--(target|output)=(.+)$/);
    if (!match || options[match[1]]) throw new Error(`Unsupported argument: ${argument}`);
    options[match[1]] = match[2];
  }
  if (options.target !== "production") throw new Error("Required --target=production");
  if (process.env.SAFE_UPDATE === "true") throw new Error("SAFE_UPDATE must remain disabled");
  if (options.output) {
    const resolved = path.resolve(ROOT, options.output);
    const relative = path.relative(path.join(ROOT, "tmp"), resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Output must be a new file inside repository tmp");
    }
    options.output = resolved;
  }
  return options;
}

function loadClient() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing production Supabase credentials");
  if (new URL(url).hostname.split(".")[0] !== PRODUCTION_REF) {
    throw new Error("Production target mismatch");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readAll(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function parseConfirmedCandidates(markdown) {
  const confirmationStart = markdown.indexOf("## GTIN Confirmation Sprint");
  const relevant = markdown.slice(confirmationStart);
  const candidates = [];
  for (const line of relevant.split(/\r?\n/)) {
    if (!line.startsWith("|") || !line.includes("`CONFIRMED`")) continue;
    const identity = line.match(/`(\d+)`\s*\/\s*`(\d+)`/);
    const gtins = [...line.matchAll(/`(\d{8}|\d{12,14})`/g)].map((match) => match[1]);
    if (!identity || !gtins.length) continue;
    const urls = [...line.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1]);
    candidates.push({
      product_id: identity[1],
      variant_id: identity[2],
      gtin: gtins[gtins.length - 1],
      candidate_source: "CONFIRMATION_SPRINT",
      evidence_confirmed: true,
      evidence_sources: ["existing_retailer_mapping", "independent_confirmed_source"],
      evidence_locations: urls.length ? urls : ["docs/EBAY-UK-COVERAGE-PLAN.md"],
      semantic_checks: { brand: true, size: true, unit_count: true, flavour: true, format: true },
    });
  }
  const unique = new Map(candidates.map((row) => [`${row.product_id}:${row.variant_id}:${row.gtin}`, row]));
  return [...unique.values()];
}

function deriveAutoSafeCandidates(snapshot) {
  const validMappings = snapshot.mappings.filter((mapping) => {
    const product = snapshot.products.find((row) => String(row.id) === String(mapping.product_id));
    const variant = snapshot.variants.find((row) => String(row.id) === String(mapping.product_variant_id));
    return product?.is_active !== false && product?.merged_into_product_id == null &&
      variant?.is_active !== false && normalizeGtin(mapping.external_gtin) && isValidGtin(mapping.external_gtin);
  });
  const gtinVariants = new Map();
  for (const mapping of validMappings) {
    const gtin = normalizeGtin(mapping.external_gtin);
    if (!gtinVariants.has(gtin)) gtinVariants.set(gtin, new Set());
    gtinVariants.get(gtin).add(String(mapping.product_variant_id));
  }
  const groups = new Map();
  for (const mapping of validMappings) {
    const gtin = normalizeGtin(mapping.external_gtin);
    const key = `${mapping.product_variant_id}:${gtin}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mapping);
  }
  return [...groups.values()].filter((rows) => {
    const gtin = normalizeGtin(rows[0].external_gtin);
    return new Set(rows.map((row) => String(row.retailer_id))).size >= 2 && gtinVariants.get(gtin).size === 1;
  }).map((rows) => {
    const first = rows[0];
    const gtin = normalizeGtin(first.external_gtin);
    const sources = [...new Set(rows.map((row) => `retailer:${row.retailer_id}`))];
    return {
      product_id: String(first.product_id),
      variant_id: String(first.product_variant_id),
      gtin,
      candidate_source: "EXISTING_AUTO_SAFE",
      evidence_confirmed: true,
      evidence_sources: sources,
      evidence_locations: rows.map((row) => row.external_url).filter(Boolean),
      semantic_checks: { brand: true, size: true, unit_count: true, flavour: true, format: true },
    };
  });
}

async function buildReadOnlyPreview(options, dependencies = {}) {
  const markdown = dependencies.markdown || fs.readFileSync(PLAN_PATH, "utf8");
  const client = dependencies.client || loadClient();
  const [products, variants, retailers, mappings] = await Promise.all([
    readAll(client, "products", "id,name,brand,product_format,gtin,is_active,merged_into_product_id"),
    readAll(client, "product_variants", "id,product_id,display_name,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active,is_default"),
    readAll(client, "retailers", "id,name,slug"),
    readAll(client, "retailer_products", "id,retailer_id,product_id,product_variant_id,external_gtin,external_name,external_url,external_options"),
  ]);
  const capturedAt = new Date().toISOString();
  const { snapshot } = buildCanonicalCatalogueSnapshot(
    { products, product_variants: variants, retailers, retailer_products: mappings, offers: [] },
    { captured_at: capturedAt, database_ref: PRODUCTION_REF }
  );
  const autoSafe = deriveAutoSafeCandidates(snapshot);
  const confirmed = parseConfirmedCandidates(markdown);
  if (confirmed.length !== EXPECTED_CONFIRMED) {
    throw new Error(`Confirmation evidence drift: expected ${EXPECTED_CONFIRMED}, received ${confirmed.length}`);
  }
  if (autoSafe.length !== EXPECTED_AUTO_SAFE) {
    throw new Error(`AUTO_SAFE production evidence drift: expected ${EXPECTED_AUTO_SAFE}, received ${autoSafe.length}`);
  }
  const keys = new Set(autoSafe.map((row) => `${row.product_id}:${row.variant_id}:${row.gtin}`));
  const candidates = [...autoSafe, ...confirmed.filter((row) => !keys.has(`${row.product_id}:${row.variant_id}:${row.gtin}`))];
  if (candidates.length !== EXPECTED_COMBINED) {
    throw new Error(`Combined candidate drift: expected ${EXPECTED_COMBINED}, received ${candidates.length}`);
  }
  const sourceFingerprint = hash("GTIN-PROMOTION-SOURCE:1", {
    documentation_sha256: hash("GTIN-PROMOTION-DOCUMENT:1", markdown),
    candidates,
  });
  return {
    preview: buildPromotionPreview(candidates, snapshot, { createdAt: capturedAt, sourceFingerprint }),
    audit: {
      database_writes: 0,
      auto_safe_candidates: autoSafe.length,
      confirmed_candidates: confirmed.length,
      combined_candidates: candidates.length,
      canonical_products: products.length,
      canonical_variants: variants.length,
      retailer_mappings: mappings.length,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await buildReadOnlyPreview(options);
  const defaultName = `gtin-promotion-preview-${result.preview.created_at.replace(/[:.]/g, "-")}.json`;
  const output = options.output || path.join(ROOT, "tmp", "gtin-promotion", defaultName);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output: path.relative(ROOT, output), ...result.audit, summary: result.preview.summary, preview_fingerprint: result.preview.preview_fingerprint }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildReadOnlyPreview, deriveAutoSafeCandidates, loadClient, parseArgs, parseConfirmedCandidates, readAll };
