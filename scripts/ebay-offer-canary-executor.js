const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");
const { assertConfig, getApplicationToken } = require("./lib/ebay-browse-pilot");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const KIND = "ebay-offer-batch-g-exact-9-v1";
const CONFIRMATION = "OWNER_APPROVED_EBAY_BATCH_G_EXACT_9";
const ROLLOUT_PATH = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary", "batch-g-rollout.json");
const EXPECTED_SCOPE = [
  { product_id: "865", product_variant_id: "1307", gtin: null, external_product_id: "234804379561", external_variant_id: "v1|234804379561|534609926235", flavour: "chocolate", size_value: "2270", size_unit: "g", pack_count: "1", product_format: "powder", price: "69.99", shipping_cost: "3.5", total_price: "73.49" },
  { product_id: "865", product_variant_id: "1308", gtin: null, external_product_id: "234804379561", external_variant_id: "v1|234804379561|534609926237", flavour: "vanilla", size_value: "2270", size_unit: "g", pack_count: "1", product_format: "powder", price: "69.99", shipping_cost: "3.5", total_price: "73.49" },
  { product_id: "868", product_variant_id: "1322", gtin: null, external_product_id: "406077245568", external_variant_id: "v1|406077245568|676400597329", flavour: "salted caramel", size_value: "1800", size_unit: "g", pack_count: "1", product_format: "powder", price: "76.99", shipping_cost: "3.99", total_price: "80.98" },
  { product_id: "885", product_variant_id: "1420", gtin: null, external_product_id: "267663811829", external_variant_id: "v1|267663811829|567469691560", flavour: "rainbow rock candy", size_value: "437", size_unit: "g", pack_count: "1", product_format: "powder", price: "39.99", shipping_cost: "0", total_price: "39.99" },
  { product_id: "789", product_variant_id: "1090", gtin: null, external_product_id: "236709473396", external_variant_id: "v1|236709473396|537208106165", flavour: "pink lemonade", size_value: "570", size_unit: "g", pack_count: "1", product_format: "powder", price: "29.99", shipping_cost: "0", total_price: "29.99" },
  { product_id: "1026", product_variant_id: "2148", gtin: null, external_product_id: "800474478717", external_variant_id: "v1|800474478717|0", flavour: "unflavoured", size_value: null, size_unit: null, pack_count: "1", product_format: "capsule", price: "10.89", shipping_cost: "0", total_price: "10.89" },
  { product_id: "1048", product_variant_id: "2192", gtin: null, external_product_id: "386965889224", external_variant_id: "v1|386965889224|0", flavour: "unflavoured", size_value: null, size_unit: null, pack_count: "1", product_format: "capsule", price: "11.69", shipping_cost: "0", total_price: "11.69" },
  { product_id: "1021", product_variant_id: "2138", gtin: null, external_product_id: "325098747981", external_variant_id: "v1|325098747981|0", flavour: "unflavoured", size_value: null, size_unit: null, pack_count: "1", product_format: "capsule", price: "12.89", shipping_cost: "0", total_price: "12.89" },
  { product_id: "1028", product_variant_id: "2152", gtin: null, external_product_id: "366034420732", external_variant_id: "v1|366034420732|0", flavour: "unflavoured", size_value: null, size_unit: null, pack_count: "1", product_format: "capsule", price: "14.96", shipping_cost: "0", total_price: "14.96" },
];
const LIVE_EXPECTATIONS = [
  { title: "CNP Pro Peptide 2.27kg (NEW) Mix Blend Protein Powder", flavour: "Chocolate", seller: "icebergsupplements" },
  { title: "CNP Pro Peptide 2.27kg (NEW) Mix Blend Protein Powder", flavour: "Vanilla", seller: "icebergsupplements" },
  { title: "CNP ISOLATE Protein 1.8KG", flavour: "Salted Caramel", seller: "muscle-factory-co-uk" },
  { title: "MVPre 3.0 437g InnovaPharm – Advanced Pre-Workout Energy, Focus & Pump Formula", flavour: "Rainbow Rock Candy", seller: "gorilla_muscle" },
  { title: "PER4M Advanced Stim Pre Workout 570g (30 Servings) ALL FLAVOURS Fitness Gym High", flavour: "Pink Lemonade", seller: "dcelectricsltd" },
  { title: "Olimp Nutrition Vita-Min One 60 caps - Exp.03/28", flavour: null, seller: "ccolta" },
  { title: "Osavi Zinc Picolinate 50mg, 60 vegan caps - Exp. 09/27", flavour: null, seller: "ccolta" },
  { title: "Olimp Vita-Min Multiple Sport Mega Caps multi vitamin mineral formula (1 Box)", flavour: null, seller: "trainingfuels" },
  { title: "The Good Guru Magnesium Complex", flavour: null, seller: "healthyessentialsuk" },
];

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

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

function valueOf(value) { return Number(value?.value); }
function cheapestShipping(item) {
  const values = (item.shippingOptions || []).map((option) => valueOf(option.shippingCost)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}
function aspect(item, name) {
  return (item.localizedAspects || []).find((entry) => String(entry.name).toLowerCase() === name.toLowerCase())?.value || null;
}

async function validateLiveSources(fetchImpl = fetch, env = process.env) {
  const config = assertConfig(env);
  if (!config.campaign_id) fail("EPN campaign ID is required");
  const token = await getApplicationToken(config, fetchImpl);
  const rows = [];
  for (let index = 0; index < EXPECTED_SCOPE.length; index += 1) {
    const scope = EXPECTED_SCOPE[index];
    const live = LIVE_EXPECTATIONS[index];
    const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`, `affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`].join(",");
    const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(scope.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context } });
    if (!response.ok) fail(`Batch G item ${scope.external_variant_id} direct read failed with HTTP ${response.status}`);
    const item = await response.json();
    if (String(item.itemId) !== scope.external_variant_id || String(item.legacyItemId) !== scope.external_product_id) fail(`Batch G item identity drift at row ${index + 1}`);
    const shipping = cheapestShipping(item);
    const delivered = Number((valueOf(item.price) + shipping).toFixed(2));
    const seller = item.seller || {};
    const inStock = (item.estimatedAvailabilities || []).some((entry) => entry.estimatedAvailabilityStatus === "IN_STOCK");
    if (
      item.title !== live.title || (live.flavour && aspect(item, "Flavour") !== live.flavour) ||
      item.listingMarketplaceId !== "EBAY_GB" || !item.buyingOptions?.includes("FIXED_PRICE") ||
      (item.conditionId !== "1000" && String(item.condition).toLowerCase() !== "new") || !inStock ||
      seller.username !== live.seller || seller.sellerAccountType !== "BUSINESS" ||
      Number(seller.feedbackPercentage) < 98 || Number(seller.feedbackScore) < 100 ||
      !Number.isFinite(shipping) || String(valueOf(item.price)) !== scope.price ||
      String(shipping) !== scope.shipping_cost || String(delivered) !== scope.total_price ||
      !String(item.itemAffiliateWebUrl || "").includes(`campid=${config.campaign_id}`) ||
      /\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container)\b/i.test(item.title)
    ) fail(`Batch G live safety evidence drift at row ${index + 1}`);
    rows.push({ product_id: scope.product_id, product_variant_id: scope.product_variant_id, item_id: scope.external_variant_id, seller: live.seller, decision: "OWNER_REVIEWED_EXACT_ITEM", delivered_price: delivered });
  }
  return rows;
}

function validateRollout() {
  const rollout = JSON.parse(fs.readFileSync(ROLLOUT_PATH, "utf8"));
  const fingerprint = sha256(JSON.stringify({ ...rollout, rollout_fingerprint: null }));
  const approvedScope = rollout.entries?.map((entry) => ({
    product_id: entry.product_id,
    product_variant_id: entry.product_variant_id,
    gtin: entry.gtin,
    external_product_id: entry.external_product_id,
    external_variant_id: entry.external_variant_id,
    flavour: entry.flavour,
    size_value: entry.size_value,
    size_unit: entry.size_unit,
    pack_count: entry.pack_count,
    product_format: entry.product_format,
    price: entry.price,
    shipping_cost: entry.shipping_cost,
    total_price: entry.total_price,
  }));
  if (
    rollout.schema_version !== 1 || rollout.kind !== KIND || rollout.approved !== true ||
    rollout.owner_confirmation !== CONFIRMATION || rollout.target_project_ref !== PROJECT_REF ||
    rollout.rollout_fingerprint !== fingerprint || JSON.stringify(approvedScope) !== JSON.stringify(EXPECTED_SCOPE)
  ) fail("Rollout approval, target, scope or fingerprint mismatch");

  const csvPath = path.resolve(ROOT, rollout.csv);
  const artifactPath = path.resolve(ROOT, rollout.artifact);
  const reviewedDirectory = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary");
  for (const resolved of [csvPath, artifactPath]) {
    const relative = path.relative(reviewedDirectory, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Inputs must remain inside the reviewed rollout directory");
  }
  const loaded = loadDryRunArtifact(artifactPath);
  const csvSha = sha256(fs.readFileSync(csvPath));
  if (
    loaded.artifactSha256 !== rollout.artifact_sha256 || csvSha !== rollout.csv_sha256 ||
    loaded.artifact.source_file_sha256 !== csvSha || loaded.artifact.plans.length !== EXPECTED_SCOPE.length ||
    loaded.artifact.blocked_rows.length !== 0
  ) fail("Artifact or source hash mismatch");

  const entries = loaded.artifact.plans.map((entry, index) => {
    const expected = EXPECTED_SCOPE[index];
    const approved = rollout.entries[index];
    const plan = entry.resolved_plan;
    if (
      entry.plan_fingerprint !== approved.plan_fingerprint || entry.source_row_fingerprint !== approved.source_row_fingerprint ||
      entry.plan_kind !== "feed" || String(entry.retailer_id) !== "12" ||
      String(plan.product?.id) !== expected.product_id || plan.product?.action !== "existing" ||
      String(plan.product_variant?.id) !== expected.product_variant_id || plan.product_variant?.action !== "existing" ||
      plan.product_variant?.evidence?.flavour !== expected.flavour ||
      (plan.product_variant?.evidence?.size_value == null ? null : String(plan.product_variant.evidence.size_value)) !== expected.size_value ||
      plan.product_variant?.evidence?.size_unit !== expected.size_unit ||
      String(plan.product_variant?.evidence?.pack_count) !== expected.pack_count || plan.product_variant?.evidence?.product_format !== expected.product_format ||
      plan.retailer?.action !== "existing" || String(plan.retailer?.id) !== "12" ||
      plan.retailer_product?.action !== "create" || plan.retailer_product?.values?.external_gtin !== expected.gtin ||
      plan.retailer_product?.values?.external_product_id !== expected.external_product_id ||
      plan.retailer_product?.values?.external_variant_id !== expected.external_variant_id ||
      plan.retailer_product?.values?.match_method !== "slug" || String(plan.retailer_product?.values?.match_confidence) !== "90" ||
      plan.offer?.action !== "create" || plan.offer?.values?.price !== expected.price ||
      plan.offer?.values?.shipping_cost !== expected.shipping_cost || plan.offer?.values?.total_price !== expected.total_price ||
      plan.offer?.values?.in_stock !== true || !/[?&]campid=\d+/.test(plan.offer?.values?.url || "") ||
      plan.price_history?.action !== "create"
    ) fail(`Reviewed plan ${index + 1} identity or mutation scope mismatch`);
    return { loaded, entry };
  });
  return { rollout, entries };
}

function credential(kind) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY must not be present");
  const value = process.env[`EBAY_CANARY_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing EBAY_CANARY_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function roleCall(kind, callback) {
  const client = new Client({
    connectionString: credential(kind),
    ssl: { rejectUnauthorized: false },
    application_name: `ebay-offer-canary-${kind}`,
    options: "-c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user")).rows[0].current_user;
    if (identity !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function executePlan(item, approvalKind = KIND) {
  const { loaded, entry } = item;
  const approval = await roleCall("approver", async (client) => (await client.query(
    "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
    [entry.resolved_plan, loaded.artifactSha256, loaded.artifact.run_id, approvalKind]
  )).rows[0].result);
  if (
    approval?.status !== "approved" || approval.artifact_sha256 !== loaded.artifactSha256 ||
    approval.plan_fingerprint !== entry.plan_fingerprint || approval.source_row_fingerprint !== entry.source_row_fingerprint
  ) fail("Approval metadata mismatch");
  const applied = await roleCall("executor", async (client) => (await client.query(
    "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
    [approval.approval_id, loaded.artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, loaded.artifact.run_id]
  )).rows[0].result);
  if (applied?.approval_status !== "consumed" || applied.plan_fingerprint !== entry.plan_fingerprint) fail("Apply metadata mismatch");
  return {
    approval_id: approval.approval_id,
    consumed_at: applied.consumed_at,
    retailer_id: applied.retailer_id,
    retailer_product_id: applied.retailer_product_id,
    offer_id: applied.offer_id,
    price_history_id: applied.price_history_id,
  };
}

async function run(options, dependencies = {}) {
  if (
    process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main" ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" || process.env.EBAY_CANARY_OWNER_CONFIRMATION !== CONFIRMATION
  ) fail("Production canary requires the exact owner-approved manual GitHub Actions dispatch on main");
  const validated = validateRollout();
  const rows = [];
  if (options.mode === "preflight") {
    rows.push(...await validateLiveSources(dependencies.fetchImpl || fetch, dependencies.env || process.env));
  } else if (options.mode === "apply") {
    for (const item of validated.entries) rows.push(await executePlan(item));
  }
  const report = {
    schema_version: 1,
    kind: `${KIND}-${options.mode}`,
    rollout_fingerprint: validated.rollout.rollout_fingerprint,
    validated_plan_count: validated.entries.length,
    live_checked_count: options.mode === "preflight" ? rows.length : 0,
    executed_plan_count: options.mode === "apply" ? rows.length : 0,
    rows,
    completed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify({ result: "PASS", validated: report.validated_plan_count, executed: report.executed_plan_count })))
    .catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { CONFIRMATION, EXPECTED_SCOPE, LIVE_EXPECTATIONS, executePlan, parseArgs, validateLiveSources, validateRollout };
