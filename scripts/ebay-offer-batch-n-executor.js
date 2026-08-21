const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-n-exact-19-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_N_EXACT_19";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "oprocz nr 5, reszta jest dobra";
const ROLLOUT_FINGERPRINT = "8bcc2b86dd89b0802f3d5c1bf25badee3fd1e4e353d0cacd8c41ca3e60c09ce1";
const ROLLOUT_PATH = path.join(ROOT, "docs/rollouts/ebay-offer-canary/batch-n-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "27:1590:v1|373707858011|642746534514",
  "90:24:v1|298602193517|0",
  "139:142:v1|178337400684|477710042215",
  "379:313:v1|227339481459|0",
  "499:469:v1|388831629571|0",
  "683:544:v1|387049058279|0",
  "684:545:v1|386965889328|0",
  "703:579:v1|385435605679|0",
  "707:583:v1|355703763092|0",
  "720:599:v1|388955605779|0",
  "741:615:v1|134979307941|0",
  "788:1076:v1|227221196528|0",
  "807:1154:v1|389455624589|0",
  "808:1155:v1|227315398173|0",
  "810:1157:v1|389883997981|0",
  "811:1158:v1|387996845027|0",
  "925:1531:v1|178337337530|477710015241",
  "1105:2397:v1|286736755888|588764980609",
  "1139:2491:v1|227339481966|526541813994",
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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.target_project_ref !== PROJECT_REF || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch N rollout approval, target, scope or fingerprint mismatch");
  const csv = path.resolve(ROOT, rollout.csv);
  const artifact = path.resolve(ROOT, rollout.artifact);
  const loaded = loadDryRunArtifact(artifact);
  if (textSha256(fs.readFileSync(csv)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 19 || loaded.artifact.blocked_rows.length) fail("Batch N artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index];
    const plan = entry.resolved_plan;
    const evidence = plan.product_variant?.evidence || {};
    const expectedMethod = approved.gtin ? "gtin" : "slug";
    const expectedConfidence = approved.gtin ? "100" : "90";
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || (plan.retailer_product?.values?.external_gtin || null) !== approved.gtin || plan.retailer_product?.values?.match_method !== expectedMethod || String(plan.retailer_product?.values?.match_confidence) !== expectedConfidence || plan.offer?.action !== "create" || plan.price_history?.action !== "create") fail(`Batch N reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.filter(({ approved }) => approved.gtin).length !== 1 || entries.filter(({ approved }) => !approved.gtin).length !== 18 || entries.filter(({ approved }) => approved.creates_second_retailer).length !== 17 || entries.some(({ approved }) => approved.original_review_number === 5)) fail("Batch N approved scope summary drift");
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
    if (!response.ok) fail(`Batch N item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json();
    const shippingCost = shipping(item);
    const itemPrice = money(item.price);
    const total = itemPrice === null || shippingCost === null ? null : Number((itemPrice + shippingCost).toFixed(2));
    const inStock = (item.estimatedAvailabilities || []).some((availability) => availability.estimatedAvailabilityStatus === "IN_STOCK");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalize(item.title) !== normalize(approved.live_title) || returnedGtin(item) !== approved.expected_returned_gtin || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalize(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < Number(approved.minimum_feedback_percentage) || Number(item.seller?.feedbackScore) < 100 || String(itemPrice) !== approved.price || String(shippingCost) !== approved.shipping_cost || String(total) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date|best before|bbe)\b/i.test(item.title)) fail(`Batch N live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, returned_gtin: returnedGtin(item), delivered_price: total });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch N production apply requires exact owner-approved GitHub Actions dispatch on main");
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
