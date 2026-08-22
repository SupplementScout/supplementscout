const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-p-exact-20-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_P_EXACT_20";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "zawierdzam wszskie";
const PARENT_CONTRACT = "ebay-reviewed-cross-product-parent-batch-p-v1";
const ROLLOUT_FINGERPRINT = "daa33cdaf5ae106befba5ca8d59f9e2ef20ac771a020070f61280a8827129ed4";
const ROLLOUT_PATH = path.join(ROOT, "docs/rollouts/ebay-offer-canary/batch-p-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "89:69:v1|188822153425|0",
  "24:1582:v1|317649344086|0",
  "273:900:v1|406895062062|677104093499",
  "273:1815:v1|137252056707|435559918149",
  "273:1816:v1|137252056707|435559918150",
  "273:1819:v1|137252056707|435559918154",
  "468:2710:v1|406431647826|676750282319",
  "788:1080:v1|267461430373|567539198324",
  "1077:2317:v1|355909580184|0",
  "70:1622:v1|233673267094|533567926335",
  "224:1677:v1|257109707764|0",
  "1106:2399:v1|284943753378|0",
  "14:1730:v1|143963592379|445427699751",
  "77:1631:v1|354815726458|624134926919",
  "489:1793:v1|185926599465|694997267454",
  "489:1794:v1|256983420098|557970957862",
  "489:1796:v1|185926599465|694997267455",
  "520:1701:v1|407021140091|677211935190",
  "520:1702:v1|407021140091|677211935191",
  "520:1703:v1|407021140091|677211935192",
]);

const fail = (message) => { throw new Error(message); };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const normalize = (value) => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const aspect = (item, names) => (item.localizedAspects || []).find((entry) => names.map(normalize).includes(normalize(entry.name)))?.value || null;
const money = (value) => { const number = Number(value?.value); return Number.isFinite(number) ? number : null; };
const shipping = (item) => { const values = (item.shippingOptions || []).map((option) => money(option.shippingCost)).filter(Number.isFinite); return values.length ? Math.min(...values) : null; };
const returnedGtin = (item) => { const value = normalizeGtin(item.gtin || aspect(item, ["EAN", "UPC", "GTIN"]) || ""); return isValidGtin(value) ? value : null; };
const evidenceValue = (value) => value == null ? null : String(value);
const textSha256 = (bytes) => {
  const raw = sha256(bytes);
  const text = bytes.toString("utf8");
  return text.includes("\r\n") ? sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8")) : raw;
};

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
  const identities = (rollout.entries || []).map((entry) => `${entry.product_id}:${entry.product_variant_id}:${entry.external_variant_id}`);
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.reviewed_parent_exception_contract !== PARENT_CONTRACT || rollout.target_project_ref !== PROJECT_REF || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch P rollout approval, target, scope or fingerprint mismatch");
  const csv = path.resolve(ROOT, rollout.csv);
  const artifact = path.resolve(ROOT, rollout.artifact);
  const loaded = loadDryRunArtifact(artifact);
  if (textSha256(fs.readFileSync(csv)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 20 || loaded.artifact.blocked_rows.length) fail("Batch P artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index];
    const plan = entry.resolved_plan;
    const evidence = plan.product_variant?.evidence || {};
    const expectedMethod = approved.gtin ? "gtin" : "slug";
    const expectedConfidence = approved.gtin ? "100" : "90";
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || (plan.retailer_product?.values?.external_gtin || null) !== approved.gtin || plan.retailer_product?.values?.match_method !== expectedMethod || String(plan.retailer_product?.values?.match_confidence) !== expectedConfidence || plan.offer?.action !== "create" || plan.price_history?.action !== "create") fail(`Batch P reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.filter(({ approved }) => approved.gtin).length !== 11 || entries.filter(({ approved }) => !approved.gtin).length !== 9 || entries.filter(({ approved }) => approved.creates_second_retailer).length !== 9 || entries.filter(({ approved }) => approved.expands_existing_ebay_product).length !== 11) fail("Batch P approved scope summary drift");
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout();
  const config = assertConfig(env);
  if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl);
  const context = `contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)},affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`;
  const rows = [];
  for (const { approved } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch P item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json();
    const shippingCost = shipping(item);
    const itemPrice = money(item.price);
    const total = itemPrice === null || shippingCost === null ? null : Number((itemPrice + shippingCost).toFixed(2));
    const inStock = (item.estimatedAvailabilities || []).some((availability) => availability.estimatedAvailabilityStatus === "IN_STOCK");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalize(item.title) !== normalize(approved.live_title) || returnedGtin(item) !== approved.expected_returned_gtin || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalize(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < Number(approved.minimum_feedback_percentage) || Number(item.seller?.feedbackScore) < Number(approved.minimum_feedback_score) || String(itemPrice) !== approved.price || String(shippingCost) !== approved.shipping_cost || String(total) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date|best before|bbe)\b/i.test(item.title)) fail(`Batch P live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, returned_gtin: returnedGtin(item), delivered_price: total });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch P production apply requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout();
  const rows = [];
  if (options.mode === "preflight") rows.push(...await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env));
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: ROLLOUT_FINGERPRINT, validated_plan_count: validated.entries.length, live_checked_count: options.mode === "preflight" ? rows.length : 0, executed_plan_count: options.mode === "apply" ? rows.length : 0, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
