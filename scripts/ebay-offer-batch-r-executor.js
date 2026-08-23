const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { isValidGtin, normalizeGtin } = require("./lib/gtin-promotion");

const ROOT = path.resolve(__dirname, "..");
const KIND = "ebay-offer-batch-r-exact-39-scope-38-actionable-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_R_EXACT_39";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const OWNER_WORDS = "zatwierdzam 11 zamian i produkcyjny apply Batch R";
const ROLLOUT_FINGERPRINT = "b890b989116bb92573b26516f1111716a6e72467967229d67845c343c12c9a3b";
const ROLLOUT_PATH = path.join(ROOT, "docs/rollouts/ebay-offer-canary/batch-r-rollout.json");
const EXPECTED_IDENTITIES = Object.freeze([
  "6:1739:v1|406396487824|676718471799", "7:1574:v1|198228877102|497356872937",
  "10:1705:v1|147306765663|445732030633", "19:1579:v1|325991814548|515421410637",
  "24:1583:v1|167879148689|467421651920", "31:1594:v1|134591032739|434103081092",
  "44:1733:v1|135253043475|434696910530", "786:1070:v1|327060618170|0",
  "58:1609:v1|227132642275|0", "59:1612:v1|176728986438|0",
  "67:1743:v1|145912801501|444959160336", "74:1627:v1|800319414198|657404220498",
  "80:1745:v1|336035176429|545582222745", "108:1747:v1|227482522680|526660650424",
  "112:1749:v1|132815030478|432119091530", "125:1053:v1|297783388039|595073149727",
  "157:776:v1|198315032211|497400846557", "158:746:v1|198315034246|497400845270",
  "159:1755:v1|157949041527|459285588036", "166:1760:v1|376399851938|645034081397",
  "175:1659:v1|394019431788|662565823099", "215:1664:v1|316166161203|614844035757",
  "232:1811:v1|234899416364|534748630032", "271:1767:v1|286812035548|589268195266",
  "294:1059:v1|135164731160|434814771499", "295:1778:v1|145913175539|444959128709",
  "322:1781:v1|163375678688|462680657033", "1077:2315:v1|404858427882|0",
  "449:1788:v1|354343324643|623744168324", "450:1049:v1|137239727747|435555053157",
  "468:2697:v1|406431647826|676750282318", "788:1077:v1|326796105372|515780120438",
  "1041:2178:v1|146722603644|0", "1042:2180:v1|133391840181|0",
  "1065:2246:v1|256904088070|557459693860", "1104:2395:v1|235526727416|0",
  "1120:2435:v1|267647291151|0", "169:1015:v1|147032518200|445550089805",
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
  const existing = rollout.verified_existing || {};
  if (rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true || rollout.owner_confirmation !== CONFIRMATION || rollout.owner_words !== OWNER_WORDS || rollout.target_project_ref !== PROJECT_REF || rollout.reviewed_parent_exception_contract !== "ebay-reviewed-cross-product-parent-batch-r-v1" || rollout.rollout_fingerprint !== ROLLOUT_FINGERPRINT || fingerprint !== ROLLOUT_FINGERPRINT || JSON.stringify(identities) !== JSON.stringify(EXPECTED_IDENTITIES) || existing.review_number !== 28 || existing.product_variant_id !== "140" || existing.existing_mapping_id !== "2888" || existing.disposition !== "VERIFIED_EXISTING_NOOP_NO_DUPLICATE_WRITE") fail("Batch R rollout approval, target, scope or fingerprint mismatch");
  const csv = path.resolve(ROOT, rollout.csv); const artifact = path.resolve(ROOT, rollout.artifact); const loaded = loadDryRunArtifact(artifact);
  if (textSha256(fs.readFileSync(csv)) !== rollout.csv_sha256 || loaded.artifactSha256 !== rollout.artifact_sha256 || loaded.artifact.source_file_sha256 !== rollout.csv_sha256 || loaded.artifact.plans.length !== 38 || loaded.artifact.blocked_rows.length) fail("Batch R artifact or source hash mismatch");
  const entries = loaded.artifact.plans.map((entry, index) => {
    const approved = rollout.entries[index]; const plan = entry.resolved_plan; const evidence = plan.product_variant?.evidence || {}; const expectedMethod = approved.gtin ? "gtin" : "slug"; const expectedConfidence = approved.gtin ? "100" : "90";
    if (entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint || entry.plan_kind !== "manual" || String(entry.retailer_id) !== "12" || String(plan.product?.id) !== approved.product_id || plan.product?.action !== "existing" || String(plan.product_variant?.id) !== approved.product_variant_id || plan.product_variant?.action !== "existing" || evidenceValue(evidence.flavour) !== approved.flavour || evidenceValue(evidence.size_value) !== approved.size_value || evidenceValue(evidence.size_unit) !== approved.size_unit || evidenceValue(evidence.pack_count) !== approved.pack_count || evidenceValue(evidence.product_format) !== approved.product_format || plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" || plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_variant_id !== approved.external_variant_id || (plan.retailer_product?.values?.external_gtin || null) !== approved.gtin || plan.retailer_product?.values?.match_method !== expectedMethod || String(plan.retailer_product?.values?.match_confidence) !== expectedConfidence || plan.offer?.action !== "create" || plan.price_history?.action !== "create") fail(`Batch R reviewed plan ${index + 1} drift`);
    return { loaded, entry, approved };
  });
  if (entries.filter(({ approved }) => approved.creates_product_level_second_retailer).length !== 21 || entries.filter(({ approved }) => approved.adds_first_ebay_variant_to_multi_retailer_product).length !== 4 || entries.filter(({ approved }) => approved.expands_existing_ebay_product).length !== 13) fail("Batch R approved scope summary drift");
  return { rollout, entries };
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const { entries } = validateRollout(); const config = assertConfig(env); if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl); const context = `contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)},affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`; const rows = [];
  for (const { approved } of entries) {
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(approved.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch R item ${approved.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json(); const shippingCost = shipping(item); const itemPrice = money(item.price); const total = itemPrice === null || shippingCost === null ? null : Number((itemPrice + shippingCost).toFixed(2)); const inStock = (item.estimatedAvailabilities || []).some((availability) => availability.estimatedAvailabilityStatus === "IN_STOCK");
    if (String(item.itemId) !== approved.external_variant_id || String(item.legacyItemId) !== approved.legacy_item_id || normalize(item.title) !== normalize(approved.live_title) || returnedGtin(item) !== approved.expected_returned_gtin || item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") || (item.conditionId !== "1000" && normalize(item.condition) !== "new") || !inStock || item.seller?.username !== approved.seller || item.seller?.sellerAccountType !== "BUSINESS" || item.seller?.sellerLegalInfo?.name !== approved.seller_legal_name || Number(item.seller?.feedbackPercentage) < Number(approved.minimum_feedback_percentage) || Number(item.seller?.feedbackScore) < Number(approved.minimum_feedback_score) || String(itemPrice) !== approved.price || String(shippingCost) !== approved.shipping_cost || String(total) !== approved.total_price || !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) || unsafeTitle(item.title)) fail(`Batch R live safety evidence drift for ${approved.external_variant_id}`);
    rows.push({ product_id: approved.product_id, product_variant_id: approved.product_variant_id, item_id: approved.external_variant_id, seller: approved.seller, returned_gtin: returnedGtin(item), delivered_price: total });
  }
  return rows;
}

async function run(options, dependencies = {}) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION) fail("Batch R production apply requires exact owner-approved GitHub Actions dispatch on main");
  const validated = validateRollout(); const rows = [];
  if (options.mode === "preflight") rows.push(...await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env));
  if (options.mode === "apply") for (const item of validated.entries) rows.push(await (dependencies.executePlan || executePlan)(item, KIND));
  const report = { schema_version: 1, kind: `${KIND}-${options.mode}`, rollout_fingerprint: ROLLOUT_FINGERPRINT, approved_scope_count: 39, verified_existing_count: 1, validated_plan_count: validated.entries.length, live_checked_count: options.mode === "preflight" ? rows.length : 0, executed_plan_count: options.mode === "apply" ? rows.length : 0, rows, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count }))).catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { CONFIRMATION, EXPECTED_IDENTITIES, ROLLOUT_FINGERPRINT, parseArgs, run, validateLiveSources, validateRollout };
