const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-q-exact-20-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_Q_EXACT_20";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "akcepuje";
const OWNER_PRECEDING_EXCLUSION = "3, 5 nie.";
const ROLLOUT_FINGERPRINT = "6d845627138382fe156d5891d7a16f0959779349b6052fca0687fbb91bc6d2b7";
const ROLLOUT_PATH = path.join(ROOT, "docs/rollouts/ebay-offer-canary/batch-q-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "81:67:v1|398263424505|666530542921", "790:1094:v1|327261939687|516049468284",
  "131:140:v1|204492290001|505081430817", "55:1029:v1|176656268247|0",
  "219:202:v1|388240705551|0", "863:1300:v1|278003127980|2560859598066",
  "34:28:v1|177555839706|0", "370:348:v1|187768437029|0", "360:364:v1|187833104047|0",
  "875:1339:v1|406431648421|677122188671", "135:141:v1|114229917998|414483567665",
  "138:90:v1|114025559750|414309386736", "140:111:v1|318096238181|0",
  "227:204:v1|377244586186|0", "258:248:v1|276358420222|0", "518:455:v1|398059958397|0",
  "249:245:v1|397974125581|0", "373:329:v1|297974730806|0", "456:440:v1|387640181610|0",
  "217:166:v1|155926124418|0",
]);

const fail = (message) => { throw new Error(message); };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const normalize = (value) => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const aspect = (item, names) => (item.localizedAspects || []).find((entry) => names.map(normalize).includes(normalize(entry.name)))?.value || null;
const money = (value) => { const number = Number(value?.value); return Number.isFinite(number) ? number : null; };
const shipping = (item) => { const values = (item.shippingOptions || []).map((option) => money(option.shippingCost)).filter(Number.isFinite); return values.length ? Math.min(...values) : null; };
const returnedGtin = (item) => { const value = normalizeGtin(item.gtin || aspect(item, ["EAN", "UPC", "GTIN"]) || ""); return isValidGtin(value) ? value : null; };
const evidenceValue = (value) => value == null ? null : String(value);
const textSha256 = (bytes) => { const raw = sha256(bytes); const text = bytes.toString("utf8"); return text.includes("\r\n") ? sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8")) : raw; };
const unsafeTitle = (title, exception) => {
  if (/\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date|expired)\b/i.test(title)) return true;
  if (/\bbbe\b/i.test(title) && exception !== "FUTURE_BBE_09_2028") return true;
  if (/\bexp\.?\s*\d/i.test(title) && exception !== "FUTURE_EXPIRY_06_2027") return true;
  return false;
};

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) { const match = argument.match(/^--(mode|output)=(.*)$/); if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`); options[match[1]] = match[2]; }
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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.owner_preceding_exclusion !== OWNER_PRECEDING_EXCLUSION || rollout.target_project_ref !== PROJECT_REF || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch Q rollout approval, target, scope or fingerprint mismatch");
  const csv = path.resolve(ROOT, rollout.csv); const artifact = path.resolve(ROOT, rollout.artifact); const loaded = loadDryRunArtifact(artifact);
  if (textSha256(fs.readFileSync(csv)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 20 || loaded.artifact.blocked_rows.length) fail("Batch Q artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index]; const plan = entry.resolved_plan; const evidence = plan.product_variant?.evidence || {}; const expectedMethod = approved.gtin ? "gtin" : "slug"; const expectedConfidence = approved.gtin ? "100" : "90";
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || (plan.retailer_product?.values?.external_gtin || null) !== approved.gtin || plan.retailer_product?.values?.match_method !== expectedMethod || String(plan.retailer_product?.values?.match_confidence) !== expectedConfidence || plan.offer?.action !== "create" || plan.price_history?.action !== "create") fail(`Batch Q reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.filter(({ approved }) => approved.gtin).length !== 13 || entries.filter(({ approved }) => !approved.gtin).length !== 7 || entries.some(({ approved }) => !approved.creates_second_retailer || approved.expands_existing_ebay_product)) fail("Batch Q approved scope summary drift");
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout(); const config = assertConfig(env); if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl); const context = `contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)},affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`; const rows = [];
  for (const { approved } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch Q item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(); const shippingCost = shipping(item); const itemPrice = money(item.price); const total = itemPrice === null || shippingCost === null ? null : Number((itemPrice + shippingCost).toFixed(2)); const inStock = (item.estimatedAvailabilities || []).some((availability) => availability.estimatedAvailabilityStatus === "IN_STOCK");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalize(item.title) !== normalize(approved.live_title) || returnedGtin(item) !== approved.expected_returned_gtin || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalize(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < Number(approved.minimum_feedback_percentage) || Number(item.seller?.feedbackScore) < Number(approved.minimum_feedback_score) || String(itemPrice) !== approved.price || String(shippingCost) !== approved.shipping_cost || String(total) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || unsafeTitle(item.title, approved.expiry_exception)) fail(`Batch Q live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, returned_gtin: returnedGtin(item), delivered_price: total });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch Q production apply requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout(); const rows = [];
  if (options.mode === "preflight") rows.push(...await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env));
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: ROLLOUT_FINGERPRINT, validated_plan_count: validated.entries.length, live_checked_count: options.mode === "preflight" ? rows.length : 0, executed_plan_count: options.mode === "apply" ? rows.length : 0, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
