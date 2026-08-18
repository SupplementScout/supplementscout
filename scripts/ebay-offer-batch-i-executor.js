const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-i-exact-8-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_I_EXACT_8";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const SELLER = "time4nutrition";
const SELLER_LEGAL_NAME = "Matrix Nutrition Limited";
const ROLLOUT_FINGERPRINT = "03e4bd8b5df70036a1ae3bb9a984b3b985a39a6c9dc3696088100c7bd834464a";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-i-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "831:1178:v1|313270204105|0", "832:1179:v1|315370516891|0",
  "833:1180:v1|312254514051|0", "834:1181:v1|203966597198|0",
  "862:1267:v1|196375064210|0", "932:1541:v1|311415993246|0",
  "934:1543:v1|311968225657|0", "936:1547:v1|314611114352|613147465749",
]);
const LIVE_EXPECTATIONS = Object.freeze([
  { title: /time\s*4\s+collagen/i, evidence: (item) => /405\s*g/i.test([item.title, aspect(item, "Size"), aspect(item, "Supply")].join(" ")) && /45\s*servings/i.test([item.title, aspect(item, "Supply")].join(" ")) },
  { title: /time\s*4\s+digestive\s+enzymes/i, pills: "90" },
  { title: /time\s*4\s+nutrition\s+gda/i, pills: "180" },
  { title: /time\s*4\s+immune\s+pro/i, pills: "120" },
  { title: /time\s*4\s+omega\s*3/i, pills: "60" },
  { title: /time\s*4\s+nutrition\s+time\s*4\s+carbs\s+1\.8kg/i, evidence: (item) => /1\.8\s*kg/i.test([item.title, aspect(item, "Supply")].join(" ")) },
  { title: /time\s*4\s+nutrition\s+test\s+booster/i, pills: "180 Vegan Capsules" },
  { title: /time\s*4\s+whey\s+protein\s+professional\s+1\.8kg/i, flavour: "Salted Caramel 1.8kg", evidence: (item) => /1\.8\s*kg/i.test([item.title, aspect(item, "Item Weight"), aspect(item, "Unit Quantity")].join(" ")) },
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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== "Zatwierdzam produkcyjny apply Batch I — dokładnie te 8" || rollout.target_project_ref !== PROJECT_REF || rollout.seller !== SELLER || rollout.seller_legal_name !== SELLER_LEGAL_NAME || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch I rollout approval, target, scope or fingerprint mismatch");
  const csvPath = path.resolve(ROOT, rollout.csv), artifactPath = path.resolve(ROOT, rollout.artifact);
  const directory = path.dirname(ROLLOUT_PATH);
  for (const file of [csvPath, artifactPath]) { const relative = path.relative(directory, file); if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Batch I inputs escaped reviewed directory"); }
  const loaded = loadDryRunArtifact(artifactPath);
  if (sha256(fs.readFileSync(csvPath)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 8 || loaded.artifact.blocked_rows.length !== 0) fail("Batch I artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index], plan = entry.resolved_plan;
    const evidence = plan.product_variant?.evidence || {};
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== evidenceValue(approved.flavour) || evidenceValue(evidence.size_value) !== evidenceValue(approved.size_value) || evidenceValue(evidence.size_unit) !== evidenceValue(approved.size_unit) || evidenceValue(evidence.pack_count) !== evidenceValue(approved.pack_count) || evidenceValue(evidence.product_format) !== evidenceValue(approved.product_format) || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_gtin !== approved.gtin || plan.retailer_product?.values?.external_product_id !== approved.external_product_id || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || plan.retailer_product?.values?.match_method !== approved.match_method || String(plan.retailer_product?.values?.match_confidence) !== approved.match_confidence || plan.offer?.action !== "create" || plan.offer?.values?.price !== approved.price || plan.offer?.values?.shipping_cost !== approved.shipping_cost || plan.offer?.values?.total_price !== approved.total_price || plan.offer?.values?.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer?.values?.url || "") || plan.price_history?.action !== "create") fail(`Batch I reviewed plan ${index + 1} drift`);
    if (index === 0 ? !(approved.missing_gtin_exception === true && approved.gtin === null && approved.match_method === "slug" && approved.match_confidence === "90") : !(approved.missing_gtin_exception === false && /^\d{8,14}$/.test(approved.gtin || "") && approved.match_method === "gtin" && approved.match_confidence === "100")) fail(`Batch I identity exception drift at row ${index + 1}`);
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
    if (!response.ok) fail(`Batch I item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(), shipping = cheapestShipping(item), itemPrice = money(item.price);
    const delivered = itemPrice === null || shipping === null ? null : Number((itemPrice + shipping).toFixed(2));
    const inStock = (item.estimatedAvailabilities || []).some((row) => row.estimatedAvailabilityStatus === "IN_STOCK");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.external_product_id || returnedGtin(item) !== approved.gtin || !live.title.test(item.title) || (live.flavour && aspect(item, "Flavour") !== live.flavour) || (live.pills && aspect(item, "Number of Pills") !== live.pills) || (live.evidence && !live.evidence(item)) || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalized(item.condition) !== "new") || !inStock || item.seller?.username !== SELLER || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== SELLER_LEGAL_NAME || Number(item.seller?.feedbackPercentage) < 98 || Number(item.seller?.feedbackScore) < 100 || String(itemPrice) !== approved.price || String(shipping) !== approved.shipping_cost || String(delivered) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date)\b/i.test(item.title)) fail(`Batch I live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: SELLER, gtin: returnedGtin(item), delivered_price: delivered });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch I production apply requires exact owner-approved GitHub Actions dispatch on main");
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
module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
