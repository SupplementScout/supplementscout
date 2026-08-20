const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-k-exact-20-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_K_EXACT_20";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "Zatwierdzą wszystkie i nie pytaj mnie o ponowne potwierdzenia zrób wszystko do końca aż będziemy mogli kontynuować i szukać następnych po dodaniu tego po zakończeniu tego bacza czyli aż do końca bacza nie pytaj mnie";
const ROLLOUT_FINGERPRINT = "3c21d4691871b096a9e93d80c80eef8116922913ae0337c7a5660718c52d9a74";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-k-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "71:1625:v1|394018039646|662564730389", "19:769:v1|256978504929|557601659147",
  "528:1848:v1|145921318153|444963406170", "36:1595:v1|143513790155|445757979940",
  "93:1642:v1|177952936229|477482944161", "220:1810:v1|404774853352|674791941889",
  "788:1073:v1|326796105372|516023060149", "112:1012:v1|267459060041|567236756567",
  "166:1759:v1|227482554146|526660766785", "166:1761:v1|227482554146|526660766784",
  "324:1060:v1|267460401796|567238268029", "14:1725:v1|323304007010|512368831135",
  "77:1630:v1|354815561341|624134728917", "24:1004:v1|167879148689|467421651918",
  "27:1588:v1|227339481694|526541817001", "520:1700:v1|407021140091|677211935189",
  "789:1091:v1|236709473396|537300103237", "423:1048:v1|227187131642|0",
  "124:1754:v1|315768710740|614309055150", "470:445:v1|406431647826|676750282316",
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalized(value) { return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim(); }
function aspect(item, names) {
  const wanted = names.map(normalized);
  return (item.localizedAspects || []).find((row) => wanted.includes(normalized(row.name)))?.value || null;
}
function money(value) { const number = Number(value?.value); return Number.isFinite(number) ? number : null; }
function cheapestShipping(item) { const values = (item.shippingOptions || []).map((row) => money(row.shippingCost)).filter(Number.isFinite); return values.length ? Math.min(...values) : null; }
function returnedGtin(item) {
  const value = normalizeGtin(item.gtin || aspect(item, ["EAN", "UPC", "GTIN"]) || "");
  return isValidGtin(value) ? value : null;
}
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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.target_project_ref !== PROJECT_REF || rollout.seller_scope !== "multiple_verified_ebay_business_sellers" || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch K rollout approval, target, scope or fingerprint mismatch");
  const csvPath = path.resolve(ROOT, rollout.csv), artifactPath = path.resolve(ROOT, rollout.artifact);
  const directory = path.dirname(ROLLOUT_PATH);
  for (const file of [csvPath, artifactPath]) {
    const relative = path.relative(directory, file);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Batch K inputs escaped reviewed directory");
  }
  const loaded = loadDryRunArtifact(artifactPath);
  if (sha256(fs.readFileSync(csvPath)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 20 || loaded.artifact.blocked_rows.length !== 0) fail("Batch K artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index], plan = entry.resolved_plan, evidence = plan.product_variant?.evidence || {};
    const gtinContract = approved.gtin
      ? approved.match_method === "gtin" && approved.match_confidence === "100" && /^\d{8,14}$/.test(approved.gtin) && approved.gtin === approved.canonical_gtin
      : approved.match_method === "slug" && approved.match_confidence === "90" && /^\d{8,14}$/.test(approved.canonical_gtin);
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_gtin !== approved.gtin || plan.retailer_product?.values?.external_product_id !== approved.external_product_id || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || plan.retailer_product?.values?.match_method !== approved.match_method || String(plan.retailer_product?.values?.match_confidence) !== approved.match_confidence || plan.offer?.action !== "create" || plan.offer?.values?.price !== approved.price || plan.offer?.values?.shipping_cost !== approved.shipping_cost || plan.offer?.values?.total_price !== approved.total_price || plan.offer?.values?.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer?.values?.url || "") || plan.price_history?.action !== "create" || approved.seller_account_type !== "BUSINESS" || !approved.seller || !approved.seller_legal_name || !gtinContract) fail(`Batch K reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.filter(({ approved }) => approved.gtin).length !== 11 || entries.filter(({ approved }) => !approved.gtin).length !== 9) fail("Batch K GTIN scope drift");
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout();
  const config = assertConfig(env);
  if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl), rows = [];
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`, `affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`].join(",");
  for (const { approved } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch K item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(), shipping = cheapestShipping(item), itemPrice = money(item.price);
    const delivered = itemPrice === null || shipping === null ? null : Number((itemPrice + shipping).toFixed(2));
    const inStock = (item.estimatedAvailabilities || []).some((row) => row.estimatedAvailabilityStatus === "IN_STOCK");
    const liveFlavour = aspect(item, ["Flavour", "Flavor"]), liveSize = aspect(item, ["Size", "Weight", "Volume"]);
    const flavourMatches = !approved.flavour || !liveFlavour || normalized(liveFlavour).includes(normalized(approved.flavour)) || normalized(approved.flavour).includes(normalized(liveFlavour));
    const expectedSize = approved.size_value && approved.size_unit ? normalized(`${approved.size_value}${approved.size_unit}`).replace(/\s/g, "") : null;
    const sizeMatches = !expectedSize || !liveSize ? true : normalized(liveSize).replace(/\s/g, "").includes(expectedSize);
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalized(item.title) !== normalized(approved.live_title) || returnedGtin(item) !== approved.gtin || !flavourMatches || !sizeMatches || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalized(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < 98 || Number(item.seller?.feedbackScore) < 100 || String(itemPrice) !== approved.price || String(shipping) !== approved.shipping_cost || String(delivered) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date|best before|bbe|clearance)\b/i.test(item.title)) fail(`Batch K live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, gtin: returnedGtin(item), delivered_price: delivered });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch K production apply requires exact owner-approved GitHub Actions dispatch on main");
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
