const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { assertConfig, evaluateItem, DEFAULT_POLICY, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { loadDryRunArtifact, runImportRows, writeDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
const ROLLOUT_DIR = path.join(ROOT, "docs", "rollouts", "ebay-offer-canary");
const CONFIRMATION = "OWNER_APPROVED_EBAY_REFRESH_EXACT_31";
const KIND = "ebay-existing-offer-refresh-exact-31-v1";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const PENDING_BATCH = path.join(OUT, "pending-batch.json");
const EXACT_GTIN_METADATA_GAPS = new Set(["FORMAT_UNPROVEN", "SIZE_UNPROVEN", "UNIT_COUNT_UNPROVEN"]);
const REVIEWED_MISSING_GTIN_CONTINUITY = new Map([
  ["2559", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2560", { seller: "snober_trade_ltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2561", { seller: "icebergsupplements", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2562", { seller: "icebergsupplements", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2563", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2564", { seller: "gorilla_muscle", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2565", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2566", { seller: "ccolta", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2567", { seller: "ccolta", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2568", { seller: "trainingfuels", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2569", { seller: "healthyessentialsuk", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
]);
const ROLLOUTS = Object.freeze([
  { csv: "bootstrap.csv", approval: "rollout.json", count: 1 },
  { csv: "remaining-4.csv", approval: "remaining-4-rollout.json", count: 4 },
  { csv: "batch-b.csv", approval: "batch-b-rollout.json", count: 5 },
  { csv: "batch-c.csv", approval: "batch-c-rollout.json", count: 7 },
  { csv: "batch-d.csv", approval: "batch-d-rollout.json", count: 2 },
  { csv: "batch-e.csv", approval: "batch-e-rollout.json", count: 1 },
  { csv: "batch-f.csv", approval: "batch-f-rollout.json", count: 2 },
  { csv: "batch-g.csv", approval: "batch-g-rollout.json", count: 9 },
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function loadScopes() {
  const rows = [];
  for (const source of ROLLOUTS) {
    const csvPath = path.join(ROLLOUT_DIR, source.csv);
    const approval = JSON.parse(fs.readFileSync(path.join(ROLLOUT_DIR, source.approval), "utf8"));
    const bytes = fs.readFileSync(csvPath);
    if (approval.approved !== true || approval.target_project_ref !== PROJECT_REF || approval.csv_sha256 !== sha256(bytes)) fail(`Reviewed rollout integrity mismatch: ${source.approval}`);
    const parsed = parse(bytes, { columns: true, skip_empty_lines: true, bom: true });
    if (parsed.length !== source.count) fail(`Reviewed rollout count mismatch: ${source.csv}`);
    const approvedEntries = approval.entries || [approval.scope];
    for (let index = 0; index < parsed.length; index += 1) {
      const row = parsed[index], approved = approvedEntries[index];
      const rowGtin = String(row.external_gtin || "").trim() || null;
      const approvedGtin = approved.gtin == null ? null : String(approved.gtin);
      const options = row.external_options ? JSON.parse(row.external_options) : {};
      const unitMatch = String(options["Unit count"] || "").match(/(\d+)\s*(capsules?|caps?|tablets?|softgels?|servings?)/i);
      if (String(row.product_id) !== String(approved.product_id) || String(row.product_variant_id) !== String(approved.product_variant_id) || rowGtin !== approvedGtin || row.external_product_id !== approved.external_product_id || row.external_variant_id !== approved.external_variant_id) fail(`Reviewed rollout row identity mismatch: ${source.csv} row ${index + 2}`);
      rows.push({
        ...row,
        flavour_label: row.flavour || null,
        size_value: approved.size_value ?? String(row.size || "").match(/\d+(?:\.\d+)?/)?.[0] ?? null,
        size_unit: approved.size_unit ?? row.size_unit ?? null,
        pack_count: approved.pack_count ?? row.pack_count ?? "1",
        unit_count: approved.unit_count ?? unitMatch?.[1] ?? null,
        unit_type: approved.unit_type ?? (unitMatch ? "capsule" : null),
        product_format: approved.product_format ?? row.product_format ?? null,
        rollout: source.approval,
      });
    }
  }
  if (rows.length !== 31) fail("Exact eBay refresh manifest must contain 31 rows");
  const unique = (key) => new Set(rows.map((row) => row[key])).size === rows.length;
  if (!["product_variant_id", "external_variant_id"].every(unique)) fail("Exact eBay refresh manifest contains duplicate identities");
  return Object.freeze(rows.map((row, index) => Object.freeze({ ...row, gtin: row.external_gtin, retailer_id: "12", retailer_product_id: String(2724 + index), offer_id: String(2539 + index) })));
}

const SCOPES = loadScopes();
const SCOPE = SCOPES.find((scope) => scope.offer_id === "2558");
function pendingArtifact(scope) { return path.join(OUT, `pending-${scope.offer_id}.json`); }

function writePendingBatch(report, now) {
  const manifest = { schema_version: 1, kind: KIND, created_at: now.toISOString(), offer_ids: SCOPES.map((scope) => scope.offer_id), eligible_offer_ids: Object.keys(report.classifications), blocked_rows: report.blocked_rows };
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(PENDING_BATCH, bytes, { flag: "wx" });
  fs.writeFileSync(`${PENDING_BATCH}.sha256`, `${sha256(bytes)}\n`, { flag: "wx" });
}

function loadPendingBatch(now = new Date()) {
  const bytes = fs.readFileSync(PENDING_BATCH);
  const expectedHash = fs.readFileSync(`${PENDING_BATCH}.sha256`, "utf8").trim();
  if (sha256(bytes) !== expectedHash) fail("Pending eBay refresh batch SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  const ageMs = now.getTime() - new Date(manifest.created_at).getTime();
  const eligible = new Set(manifest.eligible_offer_ids || []), blocked = new Set((manifest.blocked_rows || []).map((row) => row.offer_id));
  if (manifest.schema_version !== 1 || manifest.kind !== KIND || !Number.isFinite(ageMs) || ageMs < -120000 || ageMs > 15 * 60 * 1000 || JSON.stringify(manifest.offer_ids) !== JSON.stringify(SCOPES.map((scope) => scope.offer_id)) || eligible.size !== (manifest.eligible_offer_ids || []).length || blocked.size !== (manifest.blocked_rows || []).length || [...eligible].some((id) => blocked.has(id)) || eligible.size + blocked.size !== SCOPES.length || SCOPES.some((scope) => !eligible.has(scope.offer_id) && !blocked.has(scope.offer_id))) fail("Pending eBay refresh batch scope, partition or freshness mismatch");
  return { manifest, eligible };
}

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

function classifyContinuity(scope, evaluation) {
  const exactIdentity = evaluation.item_id === scope.external_variant_id && evaluation.legacy_item_id === scope.external_product_id;
  if (!exactIdentity || !evaluation.affiliate_ready || !evaluation.affiliate_url) return { eligible: false, tier: "blocked" };
  const blockers = new Set(evaluation.blockers);
  const reasons = new Set(evaluation.review_reasons);
  const reviewed = REVIEWED_MISSING_GTIN_CONTINUITY.get(scope.offer_id);
  const expectedBlockers = scope.gtin ? new Set() : new Set(["CANONICAL_GTIN_INVALID"]);
  if (
    evaluation.returned_gtin === null && reviewed && evaluation.seller?.username === reviewed.seller && evaluation.seller?.account_type === "BUSINESS" &&
    blockers.size === expectedBlockers.size && [...blockers].every((blocker) => expectedBlockers.has(blocker)) &&
    reasons.size === reviewed.review_reasons.size && [...reasons].every((reason) => reviewed.review_reasons.has(reason))
  ) return { eligible: true, tier: "sealed_owner_reviewed_missing_gtin_continuity" };
  if (blockers.size) return { eligible: false, tier: "blocked" };
  if (evaluation.decision === "AUTO_ELIGIBLE" && evaluation.returned_gtin === scope.gtin) return { eligible: true, tier: "live_exact_gtin" };
  if (evaluation.returned_gtin === scope.gtin && reasons.size > 0 && [...reasons].every((reason) => EXACT_GTIN_METADATA_GAPS.has(reason))) return { eligible: true, tier: "live_exact_gtin_with_metadata_gap" };
  if (scope.gtin && evaluation.returned_gtin === null && reasons.size === 1 && reasons.has("RETURNED_GTIN_UNPROVEN")) return { eligible: true, tier: "sealed_existing_identity_continuity" };
  return { eligible: false, tier: "blocked" };
}

function rowFromEvaluation(scope, evaluation) {
  if (!(evaluation.continuity || classifyContinuity(scope, evaluation)).eligible) fail(`Exact eBay listing identity is no longer eligible for offer ${scope.offer_id}`);
  if (!evaluation.item_price || !evaluation.uk_shipping || !evaluation.delivered_price || evaluation.item_price.currency !== "GBP" || evaluation.uk_shipping.currency !== "GBP" || evaluation.delivered_price.currency !== "GBP" || !evaluation.affiliate_ready || !evaluation.affiliate_url) fail(`Complete affiliate-ready GBP delivered price is required for offer ${scope.offer_id}`);
  return {
    ...Object.fromEntries(Object.entries(scope).filter(([key]) => !["gtin", "flavour_label", "size_value", "unit_count", "unit_type", "retailer_id", "retailer_product_id", "offer_id", "rollout"].includes(key))),
    external_url: scope.external_url,
    affiliate_url: scope.affiliate_url,
    price: evaluation.item_price.value.toFixed(2), shipping_known: "true",
    shipping_cost: evaluation.uk_shipping.value.toFixed(2), in_stock: "true", is_for_sale: "true",
  };
}

function validatePlan(scope, loaded) {
  if (loaded.artifact.blocked_rows.length || loaded.artifact.plans.length !== 1) fail(`Refresh importer must return exactly one unblocked plan for offer ${scope.offer_id}`);
  const entry = loaded.artifact.plans[0], plan = entry.resolved_plan;
  const before = plan.expected_state?.offer, after = plan.offer?.values;
  if (!["manual", "feed"].includes(entry.plan_kind) || String(entry.retailer_id) !== scope.retailer_id || plan.product?.action !== "existing" || String(plan.product.id) !== scope.product_id || plan.product_variant?.action !== "existing" || String(plan.product_variant.id) !== scope.product_variant_id || plan.retailer?.action !== "existing" || String(plan.retailer.id) !== scope.retailer_id || plan.retailer_product?.action !== "noop" || String(plan.retailer_product.id) !== scope.retailer_product_id || !["update", "verify_no_change"].includes(plan.offer?.action) || String(plan.offer.id) !== scope.offer_id || !["noop", "create"].includes(plan.price_history?.action)) fail(`Refresh plan escaped exact scope for offer ${scope.offer_id}`);
  if (!before || !after || String(before.retailer_product_id) !== scope.retailer_product_id || after.url !== scope.affiliate_url || after.in_stock !== true) fail(`Refresh plan changed identity, URL or guarded stock policy for offer ${scope.offer_id}`);
  const oldPrice = Number(before.price), newPrice = Number(after.price), absolute = Math.abs(newPrice - oldPrice), ratio = absolute / Math.max(0.01, oldPrice);
  if (!(newPrice > 0) || ratio >= 0.6 || absolute >= 20) fail(`Refresh price change exceeds the approved hard limit for offer ${scope.offer_id}`);
  return { loaded, entry };
}

function validatePreparedArtifact(scope, loaded, now = new Date()) {
  if (loaded.artifact.environment_marker !== "production") fail("Prepared refresh artifact target mismatch");
  const createdAt = new Date(loaded.artifact.created_at), ageMs = now.getTime() - createdAt.getTime();
  if (!Number.isFinite(createdAt.getTime()) || ageMs < -120000 || ageMs > 15 * 60 * 1000) fail("Prepared refresh artifact is not fresh");
  return validatePlan(scope, loaded);
}

async function buildSource(scope, config, fetchImpl = fetch, tokenOverride = null) {
  const token = tokenOverride || await getApplicationToken(config, fetchImpl);
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  const response = await fetchImpl(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(scope.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context.join(",") } });
  if (!response.ok) fail(`Approved eBay listing ${scope.external_variant_id} direct read failed with HTTP ${response.status}; automatic OOS is intentionally blocked`);
  const exact = await response.json();
  if (String(exact.itemId) !== scope.external_variant_id || String(exact.legacyItemId) !== scope.external_product_id) fail(`Direct eBay item identity drift for offer ${scope.offer_id}`);
  return evaluateItem(scope, exact, { ...DEFAULT_POLICY, affiliate_campaign_configured: true });
}

async function prepareScope(scope, evaluation, mode, dependencies, stamp) {
  const row = rowFromEvaluation(scope, evaluation);
  let artifactRows = [row];
  let result = await (dependencies.runImportRows || runImportRows)([row], { mode: "manual", dryRun: true });
  const initialPlan = result.report?.approvedRows?.[0]?.importPlan;
  if (initialPlan?.offer?.action === "noop") {
    const capturedAt = new Date().toISOString();
    const snapshotHash = sha256(JSON.stringify({ item_id: evaluation.item_id, gtin: evaluation.returned_gtin, price: evaluation.item_price, shipping: evaluation.uk_shipping, delivered: evaluation.delivered_price, captured_at: capturedAt }));
    const target = JSON.parse(JSON.stringify(initialPlan.expected_state));
    delete target.retailer_product.updated_at;
    const verification = buildVerifiedNoChangeDryRun([{ source_snapshot_sha256: snapshotHash, source_captured_at: capturedAt, source: { external_product_id: scope.external_product_id, external_variant_id: scope.external_variant_id, price: row.price, in_stock: true, url: row.affiliate_url, external_url: row.external_url }, target }], { targetEnvironment: "PRODUCTION", targetProjectRef: PROJECT_REF, expectedCount: 1, sourceSnapshotSha256s: [snapshotHash], now: new Date(capturedAt) });
    artifactRows = verification.records;
    result = verification.result;
  }
  const artifactPath = mode === "prepare-apply" ? pendingArtifact(scope) : path.join(OUT, `artifact-${scope.offer_id}-${stamp}.json`);
  const written = (dependencies.writeDryRunArtifact || writeDryRunArtifact)(artifactRows, result, { artifactPath, sourceFileName: `ebay-browse-live-${scope.offer_id}.json`, environmentMarker: "production" });
  const approved = validatePlan({ ...scope, affiliate_url: row.affiliate_url }, { artifact: written.artifact, artifactSha256: written.artifactSha256 });
  return { approved, evaluation };
}

async function run(options, dependencies = {}) {
  assertExecutionContext(options.mode, dependencies.env || process.env);
  fs.mkdirSync(OUT, { recursive: true });
  const now = dependencies.now || new Date();
  if (options.mode === "execute-apply") {
    const batch = (dependencies.loadPendingBatch || loadPendingBatch)(now);
    const approved = SCOPES.filter((scope) => batch.eligible.has(scope.offer_id)).map((scope) => validatePreparedArtifact(scope, (dependencies.loadDryRunArtifact || loadDryRunArtifact)(pendingArtifact(scope)), now));
    for (const item of approved) await (dependencies.executePlan || executePlan)(item, KIND);
    const report = { result: "PASS", mode: options.mode, scope: { offers: SCOPES.length, eligible: approved.length, blocked: batch.manifest.blocked_rows.length, offer_ids: SCOPES.map((scope) => scope.offer_id) }, executed: approved.length, blocked_rows: batch.manifest.blocked_rows, automatic_oos: "blocked" };
    fs.writeFileSync(path.join(OUT, `execute-apply-${now.toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  const config = dependencies.config || assertConfig(dependencies.env || process.env);
  const token = dependencies.token || await getApplicationToken(config, dependencies.fetchImpl || fetch);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const evaluations = [];
  for (const scope of SCOPES) {
    const evaluation = dependencies.evaluations?.get(scope.offer_id) || await buildSource(scope, config, dependencies.fetchImpl || fetch, token);
    evaluations.push({ ...evaluation, continuity: classifyContinuity(scope, evaluation) });
  }
  const blocked = evaluations.flatMap((evaluation, index) => evaluation.continuity.eligible ? [] : [{
    offer_id: SCOPES[index].offer_id,
    item_id: evaluation.item_id,
    decision: evaluation.decision,
    blockers: evaluation.blockers,
    review_reasons: evaluation.review_reasons,
    returned_gtin: evaluation.returned_gtin,
  }]);
  const prepared = [];
  for (let index = 0; index < SCOPES.length; index += 1) {
    if (!evaluations[index].continuity.eligible) continue;
    prepared.push(await prepareScope(SCOPES[index], evaluations[index], options.mode, dependencies, stamp));
  }
  const report = {
    result: blocked.length ? "PASS_WITH_BLOCKS" : "PASS", mode: options.mode,
    scope: { offers: SCOPES.length, eligible: prepared.length, blocked: blocked.length, offer_ids: SCOPES.map((scope) => scope.offer_id) },
    classifications: Object.fromEntries(prepared.map(({ approved }) => [String(approved.entry.resolved_plan.offer.id), approved.entry.resolved_plan.offer.action])),
    source: evaluations.map((evaluation, index) => ({ offer_id: SCOPES[index].offer_id, item_id: evaluation.item_id, gtin: evaluation.returned_gtin, continuity_tier: evaluation.continuity.tier, price: evaluation.item_price?.value ?? null, shipping: evaluation.uk_shipping?.value ?? null, delivered: evaluation.delivered_price?.value ?? null })),
    blocked_rows: blocked, executed: 0, automatic_oos: "blocked",
  };
  if (options.mode === "prepare-apply") (dependencies.writePendingBatch || writePendingBatch)(report, now);
  fs.writeFileSync(path.join(OUT, `${options.mode}-${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main(argv = process.argv.slice(2)) { const report = await run(parseArgs(argv)); console.log(JSON.stringify(report)); if (!report.result.startsWith("PASS")) process.exitCode = 2; }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CONFIRMATION, KIND, ROLLOUTS, SCOPES, SCOPE, assertExecutionContext, buildSource, classifyContinuity, loadPendingBatch, loadScopes, parseArgs, rowFromEvaluation, run, validatePlan, validatePreparedArtifact, writePendingBatch };
