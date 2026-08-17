const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { assertConfig, evaluateItem, DEFAULT_POLICY, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { loadDryRunArtifact, runImportRows, writeDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
const PENDING_ARTIFACT = path.join(OUT, "pending-apply.json");
const CONFIRMATION = "OWNER_APPROVED_EBAY_REFRESH_EXACT_1";
const KIND = "ebay-existing-offer-refresh-exact-1-v1";
const SCOPE = Object.freeze({
  product_id: "1107", product_variant_id: "2401", retailer_id: "12",
  retailer_product_id: "2743", offer_id: "2558", gtin: "5902114017811",
  external_product_id: "204137434720", external_variant_id: "v1|204137434720|0",
  brand: "Trec Nutrition", product_name: "Trec Nutrition Creatine Monohydrate + Taurine 400g",
  variant: "Unflavoured / 400g", flavour_label: "Unflavoured", size_value: 400,
  size_unit: "g", pack_count: 1, unit_count: null, unit_type: null,
  net_weight_g: 400, product_format: "powder", category: "Creatine",
  direct_url: "https://www.ebay.co.uk/itm/204137434720",
  affiliate_url: "https://www.ebay.co.uk/itm/204137434720?mkevt=1&mkcid=1&mkrid=710-53481-19255-0&campid=5339189922&customid=&toolid=10050",
  image: "https://i.ebayimg.com/images/g/NNsAAOSw-U5iBqLf/s-l1600.jpg",
});

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (options.target !== "production") fail("Required --target=production");
  if (!new Set(["dry-run", "prepare-apply", "execute-apply"]).has(options.mode)) fail("Required --mode=dry-run|prepare-apply|execute-apply");
  return options;
}

function assertExecutionContext(mode, env = process.env) {
  if (mode === "dry-run") return;
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) fail("eBay refresh apply requires GitHub Actions schedule or manual dispatch on main");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.EBAY_REFRESH_OWNER_CONFIRMATION !== CONFIRMATION) fail("Manual eBay refresh apply requires exact owner confirmation");
}

function validatePreparedArtifact(loaded, now = new Date()) {
  if (loaded.artifact.environment_marker !== "production") fail("Prepared refresh artifact target mismatch");
  const createdAt = new Date(loaded.artifact.created_at);
  const ageMs = now.getTime() - createdAt.getTime();
  if (!Number.isFinite(createdAt.getTime()) || ageMs < -120000 || ageMs > 15 * 60 * 1000) fail("Prepared refresh artifact is not fresh");
  return validatePlan(loaded);
}

function rowFromEvaluation(evaluation) {
  if (evaluation.decision !== "AUTO_ELIGIBLE" || evaluation.item_id !== SCOPE.external_variant_id || evaluation.legacy_item_id !== SCOPE.external_product_id || evaluation.returned_gtin !== SCOPE.gtin) fail("Exact eBay listing identity is no longer eligible");
  if (!evaluation.item_price || !evaluation.uk_shipping || !evaluation.delivered_price || evaluation.item_price.currency !== "GBP" || evaluation.uk_shipping.currency !== "GBP" || evaluation.delivered_price.currency !== "GBP") fail("Complete GBP delivered price is required");
  return {
    retailer_name: "eBay UK", retailer_website: "https://www.ebay.co.uk",
    product_id: SCOPE.product_id, product_variant_id: SCOPE.product_variant_id,
    external_product_id: SCOPE.external_product_id, external_variant_id: SCOPE.external_variant_id,
    external_sku: "", product_name: SCOPE.product_name, variant_name: SCOPE.variant,
    brand: SCOPE.brand, category: SCOPE.category, slug: `ebay-${SCOPE.external_product_id}`,
    external_url: SCOPE.direct_url, affiliate_url: SCOPE.affiliate_url,
    external_gtin: SCOPE.gtin, external_options: JSON.stringify({ Size: "400g", Flavour: "Unflavoured" }),
    price: evaluation.item_price.value.toFixed(2), shipping_known: "true",
    shipping_cost: evaluation.uk_shipping.value.toFixed(2), in_stock: "true", is_for_sale: "true",
    image: SCOPE.image, size: "400g", size_unit: "g", flavour: "Unflavoured",
    pack_count: "1", product_format: "powder",
  };
}

function validatePlan(loaded) {
  if (loaded.artifact.blocked_rows.length || loaded.artifact.plans.length !== 1) fail("Refresh importer must return exactly one unblocked plan");
  const entry = loaded.artifact.plans[0], plan = entry.resolved_plan;
  const before = plan.expected_state?.offer, after = plan.offer?.values;
  if (!["manual", "feed"].includes(entry.plan_kind) || String(entry.retailer_id) !== SCOPE.retailer_id || plan.product?.action !== "existing" || String(plan.product.id) !== SCOPE.product_id || plan.product_variant?.action !== "existing" || String(plan.product_variant.id) !== SCOPE.product_variant_id || plan.retailer?.action !== "existing" || String(plan.retailer.id) !== SCOPE.retailer_id || plan.retailer_product?.action !== "noop" || String(plan.retailer_product.id) !== SCOPE.retailer_product_id || !["update", "verify_no_change"].includes(plan.offer?.action) || String(plan.offer.id) !== SCOPE.offer_id || !["noop", "create"].includes(plan.price_history?.action)) fail("Refresh plan escaped the exact existing offer scope");
  if (!before || !after || String(before.retailer_product_id) !== SCOPE.retailer_product_id || after.url !== SCOPE.affiliate_url || after.in_stock !== true) fail("Refresh plan changed identity, URL or guarded stock policy");
  const oldPrice = Number(before.price), newPrice = Number(after.price), absolute = Math.abs(newPrice - oldPrice), ratio = absolute / Math.max(0.01, oldPrice);
  if (!(newPrice > 0) || ratio >= 0.6 || absolute >= 20) fail("Refresh price change exceeds the approved hard limit");
  return { loaded, entry };
}

async function buildSource(config, fetchImpl = fetch) {
  const token = await getApplicationToken(config, fetchImpl);
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(SCOPE.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context.join(",") } });
  if (!response.ok) fail(`Approved eBay listing direct read failed with HTTP ${response.status}; automatic OOS is intentionally blocked`);
  const exact = await response.json();
  if (String(exact.itemId) !== SCOPE.external_variant_id || String(exact.legacyItemId) !== SCOPE.external_product_id) fail("Direct eBay item identity drift");
  return evaluateItem(SCOPE, exact, { ...DEFAULT_POLICY, affiliate_campaign_configured: true });
}

async function run(options, dependencies = {}) {
  assertExecutionContext(options.mode, dependencies.env || process.env);
  if (options.mode === "execute-apply") {
    const loaded = (dependencies.loadDryRunArtifact || loadDryRunArtifact)(PENDING_ARTIFACT);
    const approved = validatePreparedArtifact(loaded, dependencies.now || new Date());
    await (dependencies.executePlan || executePlan)(approved, KIND);
    const report = { result: "PASS", mode: options.mode, scope: { offers: 1, offer_ids: [SCOPE.offer_id] }, classification: approved.entry.resolved_plan.offer.action, executed: 1, safe_update: "unset", automatic_oos: "blocked" };
    fs.writeFileSync(path.join(OUT, `execute-apply-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  const config = dependencies.config || assertConfig(dependencies.env || process.env);
  const evaluation = dependencies.evaluation || await buildSource(config, dependencies.fetchImpl || fetch);
  const row = rowFromEvaluation(evaluation);
  let artifactRows = [row];
  let result = await (dependencies.runImportRows || runImportRows)([row], { mode: "manual", dryRun: true });
  const initialPlan = result.report?.approvedRows?.[0]?.importPlan;
  if (initialPlan?.offer?.action === "noop") {
    const capturedAt = new Date().toISOString();
    const snapshotHash = crypto.createHash("sha256").update(JSON.stringify({ item_id: evaluation.item_id, gtin: evaluation.returned_gtin, price: evaluation.item_price, shipping: evaluation.uk_shipping, delivered: evaluation.delivered_price, captured_at: capturedAt })).digest("hex");
    const target = JSON.parse(JSON.stringify(initialPlan.expected_state));
    delete target.retailer_product.updated_at;
    const verification = buildVerifiedNoChangeDryRun([{ source_snapshot_sha256: snapshotHash, source_captured_at: capturedAt, source: { external_product_id: SCOPE.external_product_id, external_variant_id: SCOPE.external_variant_id, price: row.price, in_stock: true, url: SCOPE.affiliate_url, external_url: SCOPE.direct_url }, target }], { targetEnvironment: "PRODUCTION", targetProjectRef: "aftboxmrdgyhizicfsfu", expectedCount: 1, sourceSnapshotSha256s: [snapshotHash], now: new Date(capturedAt) });
    artifactRows = verification.records;
    result = verification.result;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = options.mode === "prepare-apply" ? PENDING_ARTIFACT : path.join(OUT, `artifact-${stamp}.json`);
  const written = (dependencies.writeDryRunArtifact || writeDryRunArtifact)(artifactRows, result, { artifactPath, sourceFileName: "ebay-browse-live.json", environmentMarker: "production" });
  const approved = validatePlan({ artifact: written.artifact, artifactSha256: written.artifactSha256 });
  const report = { result: "PASS", mode: options.mode, scope: { offers: 1, offer_ids: [SCOPE.offer_id] }, source: { item_id: evaluation.item_id, gtin: evaluation.returned_gtin, price: evaluation.item_price.value, shipping: evaluation.uk_shipping.value, delivered: evaluation.delivered_price.value }, classification: approved.entry.resolved_plan.offer.action, executed: 0, safe_update: "unset", automatic_oos: "blocked" };
  fs.writeFileSync(path.join(OUT, `${options.mode}-${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main(argv = process.argv.slice(2)) { const report = await run(parseArgs(argv)); console.log(JSON.stringify(report)); }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CONFIRMATION, KIND, PENDING_ARTIFACT, SCOPE, assertExecutionContext, buildSource, parseArgs, rowFromEvaluation, run, validatePlan, validatePreparedArtifact };
