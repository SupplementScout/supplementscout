const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-s-exact-18-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_S_EXACT_18";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "wszystkie sa dobre";
const ROLLOUT_FINGERPRINT = "e57500c62d5287a0e8b53112f30c8f8d6264d71119e2c00afc24f102f0d53e26";
const ROLLOUT_PATH = path.join(ROOT, "docs/rollouts/ebay-offer-canary/batch-s-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "755:883:v1|287487748050|0", "1116:2419:v1|147450939094|0",
  "1117:2421:v1|227315409315|0", "1128:2469:v1|147458020827|0",
  "163:518:v1|256978504893|557601584732", "257:230:v1|198346682799|0",
  "285:237:v1|257053651805|557696446300", "342:341:v1|286049984782|588148986109",
  "350:343:v1|353439521141|0", "366:347:v1|178052718291|0",
  "372:366:v1|318546057510|0", "385:332:v1|146086688061|445043246478",
  "386:352:v1|187837047801|0", "428:407:v1|166550190737|466197712102",
  "488:433:v1|286709971349|0", "500:436:v1|377141158759|0",
  "513:486:v1|354869780698|0", "519:473:v1|373243202481|642139796536",
]);

const fail = (message) => { throw new Error(message); };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const normalize = (value) => String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const aspect = (item, names) => (item.localizedAspects || []).find((entry) => names.map(normalize).includes(normalize(entry.name)))?.value || null;
const money = (value) => { const number = Number(value?.value); return Number.isFinite(number) ? number : null; };
const shipping = (item) => { const values = (item.shippingOptions || []).map((option) => money(option.shippingCost)).filter(Number.isFinite); return values.length ? Math.min(...values) : null; };
const returnedGtin = (item) => { const value = normalizeGtin(item.gtin || aspect(item, ["EAN", "UPC", "GTIN"]) || ""); return isValidGtin(value) ? value : null; };
const textSha256 = (bytes) => { const raw = sha256(bytes); const text = bytes.toString("utf8"); return text.includes("\r\n") ? sha256(Buffer.from(text.replace(/\r\n/g, "\n"), "utf8")) : raw; };
const unsafeTitle = (title) => /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container|out of date|expired)\b/i.test(title || "");

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
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.target_project_ref !== PROJECT_REF || rollout.production_kpi_before !== 232 || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES)) fail("Batch S rollout approval, target, scope or fingerprint mismatch");
  const csv = path.resolve(ROOT, rollout.csv); const artifact = path.resolve(ROOT, rollout.artifact); const loaded = loadDryRunArtifact(artifact);
  if (textSha256(fs.readFileSync(csv)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 18 || loaded.artifact.blocked_rows.length) fail("Batch S artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index]; const plan = entry.resolved_plan;
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || (plan.retailer_product?.values?.external_gtin || null) !== (approved.expected_returned_gtin || null) || plan.offer?.action !== "create" || plan.price_history?.action !== "create") fail(`Batch S reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.length !== 18 || new Set(entries.map(({ approved }) => approved.product_id)).size !== 18) fail("Batch S approved scope summary drift");
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout(); const config = assertConfig(env); if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl); const context = `contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)},affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`; const rows = [];
  for (const { approved } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch S item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(); const shippingCost = shipping(item); const itemPrice = money(item.price); const total = itemPrice === null || shippingCost === null ? null : Number((itemPrice + shippingCost).toFixed(2)); const inStock = (item.estimatedAvailabilities || []).some((availability) => availability.estimatedAvailabilityStatus === "IN_STOCK");
    const liveGtin = returnedGtin(item);
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalize(item.title) !== normalize(approved.live_title) || (liveGtin && liveGtin !== approved.expected_returned_gtin) || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalize(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < Number(approved.minimum_feedback_percentage) || Number(item.seller?.feedbackScore) < Number(approved.minimum_feedback_score) || itemPrice !== Number(approved.price) || shippingCost !== Number(approved.shipping_cost) || total !== Number(approved.total_price) || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || unsafeTitle(item.title)) fail(`Batch S live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, returned_gtin: returnedGtin(item), delivered_price: total });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch S production apply requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout(); const rows = [];
  if (options.mode === "preflight") rows.push(...await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env));
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: ROLLOUT_FINGERPRINT, approved_scope_count: 18, verified_existing_count: 0, validated_plan_count: validated.entries.length, live_checked_count: options.mode === "preflight" ? rows.length : 0, executed_plan_count: options.mode === "apply" ? rows.length : 0, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
