const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { buildReadOnlyPreview, loadClient, readAll } = require("./gtin-promotion-dry-run");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");
const { assertConfig, browseIdentity, buildReport, DEFAULT_POLICY, evaluateIdentity, getApplicationToken } = require("./lib/ebay-browse-pilot");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "ebay-uk-coverage");
const EXPECTED_IDENTITIES = Object.freeze({ "legacy-54": 54, "owner-reviewed-36": 36 });

function parseArgs(argv) {
  const options = { prepareInput: false, discovery: false, titleLeadsReport: null, refreshItemsReport: null, maxIdentities: 750, outputDir: DEFAULT_OUTPUT, scope: "legacy-54" };
  for (const argument of argv) {
    if (argument === "--prepare-input") options.prepareInput = true;
    else if (argument === "--discover-one-retailer") options.discovery = true;
    else if (argument.startsWith("--title-leads-from=")) {
      const resolved = path.resolve(ROOT, argument.slice("--title-leads-from=".length));
      const relative = path.relative(path.join(ROOT, "tmp"), resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Title-leads report must be inside repository tmp");
      options.titleLeadsReport = resolved;
    }
    else if (argument.startsWith("--refresh-items-from=")) {
      const resolved = path.resolve(ROOT, argument.slice("--refresh-items-from=".length));
      const relative = path.relative(path.join(ROOT, "tmp"), resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Item-refresh report must be inside repository tmp");
      options.refreshItemsReport = resolved;
    }
    else if (argument.startsWith("--max-identities=")) {
      const value = Number(argument.slice("--max-identities=".length));
      if (!Number.isInteger(value) || value < 1 || value > 750) throw new Error("Max identities must be between 1 and 750");
      options.maxIdentities = value;
    }
    else if (argument.startsWith("--scope=")) {
      const scope = argument.slice("--scope=".length);
      if (!Object.hasOwn(EXPECTED_IDENTITIES, scope)) throw new Error("Unsupported eBay pilot identity scope");
      options.scope = scope;
    }
    else if (argument.startsWith("--output-dir=")) {
      const resolved = path.resolve(ROOT, argument.slice("--output-dir=".length));
      const relative = path.relative(path.join(ROOT, "tmp"), resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output directory must be inside repository tmp");
      options.outputDir = resolved;
    } else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!options.discovery && options.maxIdentities !== 750) throw new Error("--max-identities requires --discover-one-retailer");
  if (options.titleLeadsReport && !options.discovery) throw new Error("--title-leads-from requires --discover-one-retailer");
  if (options.refreshItemsReport && (options.discovery || options.titleLeadsReport)) throw new Error("--refresh-items-from cannot be combined with discovery modes");
  if ((options.discovery || options.titleLeadsReport) && options.scope !== "legacy-54") throw new Error("--scope cannot be combined with discovery modes");
  if (options.refreshItemsReport && options.scope !== "legacy-54") throw new Error("--scope cannot be combined with --refresh-items-from");
  return options;
}

const IDENTITY_FIELDS = Object.freeze([
  "product_id", "variant_id", "destination_field", "brand", "product_name", "variant", "flavour_label",
  "size_value", "size_unit", "pack_count", "unit_count", "unit_type", "net_weight_g", "product_format",
  "gtin", "category", "source_retailer_count", "source_locations", "current_retailer_count", "current_best_delivered_price",
  "current_retailer_identities",
]);

function buildTitleLeadInput(report, maxIdentities, capturedAt = new Date().toISOString()) {
  if (!["EBAY_BROWSE_API_DISCOVERY", "EBAY_BROWSE_API_PILOT"].includes(report.operation_type) || report.write_enabled !== false) throw new Error("Invalid read-only report for title leads");
  const expected = hash("EBAY-BROWSE-REPORT:1", { ...report, artifact_fingerprint: null });
  if (report.artifact_fingerprint !== expected) throw new Error("Discovery report fingerprint mismatch");
  const seenProducts = new Set();
  const rows = [];
  for (const row of report.rows || []) {
    if (row.decision !== "NOT_FOUND" || seenProducts.has(String(row.product_id))) continue;
    seenProducts.add(String(row.product_id));
    rows.push(Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, row[field]]).filter(([, value]) => value !== undefined)));
    if (rows.length >= maxIdentities) break;
  }
  if (!rows.length) throw new Error("No NOT_FOUND products remain for title-lead discovery");
  return sealInput(rows, capturedAt, report.artifact_fingerprint);
}

function buildItemRefreshInput(report, currentRows, capturedAt = new Date().toISOString()) {
  if (!String(report.operation_type || "").startsWith("EBAY_BROWSE_API_") || report.write_enabled !== false) {
    throw new Error("Invalid read-only report for item refresh");
  }
  const expected = hash("EBAY-BROWSE-REPORT:1", { ...report, artifact_fingerprint: null });
  if (report.artifact_fingerprint !== expected) throw new Error("Item-refresh report fingerprint mismatch");
  const currentByKey = new Map(currentRows.map((row) => [`${row.product_id}:${row.variant_id}`, row]));
  const seenItems = new Set();
  const rows = [];
  for (const prior of report.rows || []) {
    if (!['AUTO_ELIGIBLE', 'REVIEW'].includes(prior.decision) || !prior.selected_offer?.item_id || !prior.selected_offer?.legacy_item_id) continue;
    const current = currentByKey.get(`${prior.product_id}:${prior.variant_id}`);
    if (!current || current.gtin !== prior.gtin) continue;
    if (seenItems.has(prior.selected_offer.item_id)) continue;
    seenItems.add(prior.selected_offer.item_id);
    rows.push({ ...current, refresh_item_id: prior.selected_offer.item_id, refresh_legacy_item_id: String(prior.selected_offer.legacy_item_id) });
  }
  if (!rows.length) throw new Error("No current unresolved exact items remain for refresh");
  return sealInput(rows, capturedAt, report.artifact_fingerprint);
}

async function readExactItem(identity, config, fetchImpl, token) {
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(identity.refresh_item_id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id,
      "X-EBAY-C-ENDUSERCTX": context.join(","),
    },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`eBay Browse item refresh failed with HTTP ${response.status} for product ${identity.product_id} variant ${identity.variant_id}`);
  const item = await response.json();
  if (String(item.itemId) !== identity.refresh_item_id || String(item.legacyItemId) !== identity.refresh_legacy_item_id) {
    throw new Error(`Direct eBay item identity drift for product ${identity.product_id} variant ${identity.variant_id}`);
  }
  return [item];
}

function parseQuarantinedGtins(markdown) {
  const values = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.includes("`CONFLICT`")) continue;
    for (const match of line.matchAll(/`(\d{8}|\d{12,14})`/g)) {
      if (isValidGtin(match[1])) values.add(normalizeGtin(match[1]));
    }
  }
  return values;
}

function buildDiscoveryRows({ products, variants, mappings, offers, retailers = [] }, markdown, maxIdentities = 750) {
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const quarantined = parseQuarantinedGtins(markdown);
  const canonicalGtins = new Set([
    ...products.map((row) => normalizeGtin(row.gtin)).filter(Boolean),
    ...variants.map((row) => normalizeGtin(row.gtin)).filter(Boolean),
  ]);
  const valid = mappings.filter((mapping) => {
    const product = productById.get(String(mapping.product_id));
    const variant = variantById.get(String(mapping.product_variant_id));
    const gtin = normalizeGtin(mapping.external_gtin);
    return product && variant && String(variant.product_id) === String(product.id) &&
      product.is_active !== false && product.merged_into_product_id == null && variant.is_active !== false &&
      isValidGtin(gtin) && !canonicalGtins.has(gtin) && !quarantined.has(gtin);
  });
  const gtinVariants = new Map();
  const groups = new Map();
  for (const mapping of valid) {
    const gtin = normalizeGtin(mapping.external_gtin);
    const variantId = String(mapping.product_variant_id);
    if (!gtinVariants.has(gtin)) gtinVariants.set(gtin, new Set());
    gtinVariants.get(gtin).add(variantId);
    const key = `${variantId}:${gtin}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mapping);
  }
  const perVariant = new Map();
  for (const rows of groups.values()) {
    const gtin = normalizeGtin(rows[0].external_gtin);
    if (gtinVariants.get(gtin).size !== 1) continue;
    if (new Set(rows.map((row) => String(row.retailer_id))).size !== 1) continue;
    const variantId = String(rows[0].product_variant_id);
    if (!perVariant.has(variantId)) perVariant.set(variantId, []);
    perVariant.get(variantId).push(rows);
  }
  const categoryPriority = new Map(["Creatine", "Whey Protein", "Vitamins", "Magnesium", "Electrolytes", "Pre Workout"].map((value, index) => [value.toLowerCase(), index]));
  const candidates = [];
  for (const candidateGroups of perVariant.values()) {
    if (candidateGroups.length !== 1) continue;
    const rows = candidateGroups[0];
    const mapping = rows[0];
    const product = productById.get(String(mapping.product_id));
    const variant = variantById.get(String(mapping.product_variant_id));
    if (!String(product.brand || "").trim()) continue;
    if (variant.size_value == null && product.net_weight_g == null && product.unit_count == null) continue;
    const identity = {
      product_id: String(product.id), variant_id: String(variant.id), destination_field: "product_variants.gtin",
      brand: product.brand, product_name: product.name, variant: variant.display_name,
      flavour_label: variant.flavour_label, size_value: variant.size_value, size_unit: variant.size_unit,
      pack_count: variant.pack_count, unit_count: product.unit_count, unit_type: product.unit_type,
      net_weight_g: product.net_weight_g, product_format: variant.product_format || product.product_format,
      gtin: normalizeGtin(mapping.external_gtin), category: product.category,
      source_retailer_count: 1, source_locations: [...new Set(rows.map((row) => row.external_url).filter(Boolean))],
    };
    const offerEvidence = currentOfferEvidence(identity, mappings, offers, retailers);
    if (offerEvidence.current_retailer_count !== 1) continue;
    candidates.push({ ...identity, ...offerEvidence });
  }
  candidates.sort((a, b) => {
    const ap = categoryPriority.get(String(a.category || "").toLowerCase()) ?? 99;
    const bp = categoryPriority.get(String(b.category || "").toLowerCase()) ?? 99;
    if (ap !== bp) return ap - bp;
    if (BigInt(a.product_id) !== BigInt(b.product_id)) return BigInt(a.product_id) < BigInt(b.product_id) ? -1 : 1;
    return BigInt(a.variant_id) < BigInt(b.variant_id) ? -1 : 1;
  });
  return candidates.slice(0, maxIdentities);
}

function currentOfferEvidence(identity, mappings, offers, retailers = []) {
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
  const retailerById = new Map(retailers.map((retailer) => [String(retailer.id), retailer]));
  const currentRetailerIdentities = [...new Set(eligible.flatMap((offer) => {
    const retailer = retailerById.get(String(offer.retailer_id));
    return retailer ? [retailer.name, retailer.slug].filter(Boolean) : [];
  }))];
  return {
    current_retailer_count: retailerCount,
    current_best_delivered_price: delivered[0] ?? null,
    ...(retailers.length ? { current_retailer_identities: currentRetailerIdentities } : {}),
  };
}

async function buildInput(client, capturedAt = new Date().toISOString(), scope = "legacy-54") {
  const identityCount = EXPECTED_IDENTITIES[scope];
  if (!identityCount) throw new Error("Unsupported eBay pilot identity scope");
  const [{ preview }, products, variants, mappings, offers, retailers] = await Promise.all([
    buildReadOnlyPreview({ target: "production", output: null, scope, expectedState: scope === "owner-reviewed-36" ? "post-apply" : undefined }, { client }),
    readAll(client, "products", "id,name,brand,category,net_weight_g,unit_count,unit_type,product_format,is_active,merged_into_product_id"),
    readAll(client, "product_variants", "id,product_id,display_name,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active"),
    readAll(client, "retailer_products", "id,retailer_id,product_id,product_variant_id"),
    readAll(client, "offers", "id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,last_checked_at"),
    readAll(client, "retailers", "id,name,slug"),
  ]);
  if (preview.candidate_count !== identityCount || preview.rows.some((row) => row.decision !== "ALREADY_PRESENT")) {
    throw new Error(`Safe GTIN identity gate failed: expected exactly ${identityCount} ALREADY_PRESENT identities`);
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
      ...currentOfferEvidence(row, mappings, offers, retailers),
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

async function buildDiscoveryInput(client, maxIdentities, capturedAt = new Date().toISOString()) {
  const [products, variants, mappings, offers, retailers] = await Promise.all([
    readAll(client, "products", "id,name,brand,category,net_weight_g,unit_count,unit_type,product_format,gtin,is_active,merged_into_product_id"),
    readAll(client, "product_variants", "id,product_id,display_name,flavour_label,size_value,size_unit,pack_count,product_format,gtin,is_active"),
    readAll(client, "retailer_products", "id,retailer_id,product_id,product_variant_id,external_gtin,external_url"),
    readAll(client, "offers", "id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,last_checked_at"),
    readAll(client, "retailers", "id,name,slug"),
  ]);
  const markdown = fs.readFileSync(path.join(ROOT, "docs", "EBAY-UK-COVERAGE-PLAN.md"), "utf8");
  const rows = buildDiscoveryRows({ products, variants, mappings, offers, retailers }, markdown, maxIdentities);
  if (!rows.length) throw new Error("No safe one-retailer GTIN discovery identities remain");
  return sealInput(rows, capturedAt, hash("EBAY-DISCOVERY-SOURCE:1", rows));
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
  const capturedAt = dependencies.now?.() || new Date().toISOString();
  let input;
  if (options.refreshItemsReport) {
    const report = JSON.parse(fs.readFileSync(options.refreshItemsReport, "utf8"));
    const client = dependencies.client || loadClient();
    const current = await buildDiscoveryInput(client, 750, capturedAt);
    input = buildItemRefreshInput(report, current.rows, capturedAt);
  } else if (options.titleLeadsReport) {
    const report = JSON.parse(fs.readFileSync(options.titleLeadsReport, "utf8"));
    input = buildTitleLeadInput(report, options.maxIdentities, capturedAt);
  } else {
    const client = dependencies.client || loadClient();
    input = options.discovery
      ? await buildDiscoveryInput(client, options.maxIdentities, capturedAt)
      : await buildInput(client, capturedAt, options.scope);
  }
  const stamp = input.captured_at.replace(/[:.]/g, "-");
  const prefix = options.refreshItemsReport ? "ebay-item-refresh" : options.titleLeadsReport ? "ebay-title-leads" : options.discovery ? "ebay-discovery" : options.scope === "owner-reviewed-36" ? "ebay-owner-reviewed-36" : "ebay-pilot";
  const inputPath = writeImmutableJson(options.outputDir, `${prefix}-input-${stamp}.json`, input);
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
  const directToken = options.refreshItemsReport ? await getApplicationToken(config, fetchImpl) : null;
  const results = [];
  const rawRows = [];
  for (const identity of input.rows) {
    const browseOptions = options.titleLeadsReport
      ? { limit: 5, maxDetails: 5, searchMode: "title" }
      : options.discovery ? { limit: 5, maxDetails: 5 } : undefined;
    const items = options.refreshItemsReport
      ? await readExactItem(identity, config, fetchImpl, directToken)
      : await browseIdentity(identity, config, fetchImpl, browseOptions);
    rawRows.push({ product_id: identity.product_id, variant_id: identity.variant_id, gtin: identity.gtin, items });
    results.push(evaluateIdentity(identity, items, policy));
  }
  const operationType = options.refreshItemsReport ? "EBAY_BROWSE_API_ITEM_REFRESH" : options.titleLeadsReport ? "EBAY_BROWSE_API_TITLE_LEADS" : options.discovery ? "EBAY_BROWSE_API_DISCOVERY" : "EBAY_BROWSE_API_PILOT";
  const report = buildReport(input, results, policy, { captured_at: dependencies.now?.() || new Date().toISOString(), affiliate_campaign_configured: Boolean(config.campaign_id), operation_type: operationType });
  const raw = { schema_version: 1, operation_type: `${operationType}_RAW`, captured_at: report.captured_at, rows: rawRows, artifact_fingerprint: null };
  raw.artifact_fingerprint = hash("EBAY-BROWSE-RAW:1", raw);
  const rawPath = writeImmutableJson(options.outputDir, `${prefix}-raw-${stamp}.json`, raw);
  const reportPath = writeImmutableJson(options.outputDir, `${prefix}-report-${stamp}.json`, report);
  console.log(JSON.stringify({ input: inputPath, raw: rawPath, report: reportPath, summary: report.summary, database_writes: 0 }, null, 2));
  return { input, report, inputPath, rawPath, reportPath };
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildDiscoveryInput, buildDiscoveryRows, buildInput, buildItemRefreshInput, buildTitleLeadInput, currentOfferEvidence, main, parseArgs, parseQuarantinedGtins, readExactItem, sealInput, writeImmutableJson };
