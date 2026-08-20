const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-j-exact-10-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_J_EXACT_10";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const SELLER = "welzohealth";
const SELLER_LEGAL_NAME = "Welzo Ltd";
const ROLLOUT_FINGERPRINT = "1f885a42ca003299ab5eb2389851e30a8e849799da3407ef75e6a26425a7f877";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-j-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "482:1697:v1|227339481787|526541736174", "482:1698:v1|227339481787|526541736170",
  "93:1011:v1|227339480945|526541656197", "93:1638:v1|227339480945|526541656195",
  "93:1639:v1|227339480945|526541656194", "93:1640:v1|227339480945|526541656193",
  "93:1641:v1|227339480945|526541656192", "93:1643:v1|227339480945|526541656198",
  "222:752:v1|227319961531|526525449487", "222:755:v1|227319961531|526525449491",
]);
const LIVE_EXPECTATIONS = Object.freeze([
  { title: /jnx\s+sports\s+the\s+curse/i, flavour: "Blue Raspberry", size: /\b250\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+curse/i, flavour: "Fruit Punch", size: /\b250\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Fruit Punch", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Blue Raspberry", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Pineapple Shred", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Raspberry Lemonade", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Razor Lime", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /jnx\s+sports\s+the\s+ripper/i, flavour: "Blood Orange", size: /\b150\s*(?:g|grams?)\b/i },
  { title: /mutant\s+mutant\s+mass/i, flavour: "Chocolate Fudge Brownie", size: /\b6800\s*(?:g|grams?)\b/i },
  { title: /mutant\s+mutant\s+mass/i, flavour: "Triple Chocolate", size: /\b6800\s*(?:g|grams?)\b/i },
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalized(value) { return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim(); }
function aspect(item, name) { return (item.localizedAspects || []).find((row) => normalized(row.name) === normalized(name))?.value || null; }
function money(value) { const number = Number(value?.value); return Number.isFinite(number) ? number : null; }
function cheapestShipping(item) { const values = (item.shippingOptions || []).map((row) => money(row.shippingCost)).filter(Number.isFinite); return values.length ? Math.min(...values) : null; }
function returnedGtin(item) { return String(item.gtin || aspect(item, "EAN") || aspect(item, "UPC") || "").replace(/\D/g, "") || null; }
function evidenceValue(value) { return value == null ? null : String(value); }

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|output)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (!new Set(["preflight", "validate", "apply"]).has(options.mode)) fail("Required --mode=preflight|validate|apply");
  if (!options.output) fail("Required --output=<path>");
  options.output = path.resolve(options.output);
  const relative = path.relative(path.join(ROOT, "tmp"), options.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  return options;
}

function validateRollout() {
  const rollout = JSON.parse(fs.readFileSync(ROLLOUT_PATH, "utf8"));
  const fingerprint = sha256(JSON.stringify({ ...rollout, rollout_fingerprint: null }));
  const identities = (rollout.entries || []).map((row) => `${row.product_id}:${row.product_variant_id}:${row.external_variant_id}`);
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== "Zatwierdzam produkcyjny apply Batch J — dokładnie te 10." || rollout.target_project_ref !== PROJECT_REF || rollout.seller !== SELLER || rollout.seller_legal_name !== SELLER_LEGAL_NAME || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch J rollout approval, target, scope or fingerprint mismatch");
  const csvPath = path.resolve(ROOT, rollout.csv), artifactPath = path.resolve(ROOT, rollout.artifact);
  const directory = path.dirname(ROLLOUT_PATH);
  for (const file of [csvPath, artifactPath]) { const relative = path.relative(directory, file); if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Batch J inputs escaped reviewed directory"); }
  const loaded = loadDryRunArtifact(artifactPath);
  if (sha256(fs.readFileSync(csvPath)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 10 || loaded.artifact.blocked_rows.length !== 0) fail("Batch J artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index], plan = entry.resolved_plan;
    const evidence = plan.product_variant?.evidence || {};
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_gtin !== approved.gtin || plan.retailer_product?.values?.external_product_id !== approved.external_product_id || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || plan.retailer_product?.values?.match_method !== "gtin" || String(plan.retailer_product?.values?.match_confidence) !== "100" || plan.offer?.action !== "create" || plan.offer?.values?.price !== approved.price || plan.offer?.values?.shipping_cost !== approved.shipping_cost || plan.offer?.values?.total_price !== approved.total_price || plan.offer?.values?.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer?.values?.url || "") || plan.price_history?.action !== "create" || !/^\d{8,14}$/.test(approved.gtin || "")) fail(`Batch J reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved, live: LIVE_EXPECTATIONS[index] };
  });
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout();
  const config = assertConfig(env);
  if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl), rows = [];
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`, `affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`].join(",");
  for (const { approved, live } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch J item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(), shipping = cheapestShipping(item), itemPrice = money(item.price);
    const delivered = itemPrice === null || shipping === null ? null : Number((itemPrice + shipping).toFixed(2));
    const inStock = (item.estimatedAvailabilities || []).some((row) => row.estimatedAvailabilityStatus === "IN_STOCK");
    const searchableSize = [item.title, aspect(item, "Flavour"), aspect(item, "Size"), aspect(item, "Weight")].filter(Boolean).join(" ");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.external_product_id || returnedGtin(item) !== approved.gtin || !live.title.test(item.title) || !normalized(aspect(item, "Flavour")).includes(normalized(live.flavour)) || !live.size.test(searchableSize) || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalized(item.condition) !== "new") || !inStock || item.seller?.username !== SELLER || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== SELLER_LEGAL_NAME || Number(item.seller?.feedbackPercentage) < 98 || Number(item.seller?.feedbackScore) < 100 || String(itemPrice) !== approved.price || String(shipping) !== approved.shipping_cost || String(delivered) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date)\b/i.test(item.title)) fail(`Batch J live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: SELLER, gtin: returnedGtin(item), delivered_price: delivered });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch J production apply requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout();
  let rows = [];
  if (options.mode === "preflight") rows = await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env);
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: ROLLOUT_FINGERPRINT, validated_plan_count: validated.entries.length, live_checked_count: options.mode === "preflight" ? rows.length : 0, executed_plan_count: options.mode === "apply" ? rows.length : 0, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, LIVE_EXPECTATIONS, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
