const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { assertConfig, evaluateItem, DEFAULT_POLICY, getApplicationToken } = require("./lib/ebay-browse-pilot");
const { boundedSourceFetch } = require("./lib/bounded-source-fetch");
const { loadDryRunArtifact, runImportRows, writeDryRunArtifact } = require("./import-products");
const { executePlan } = require("./ebay-offer-canary-executor");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");
const { buildExistingOfferUpdatePlan } = require("./lib/retailer-offer-sync/existing-offer-plan");
const { canonicalTimestamp } = require("./lib/canonical-timestamp");
const {
  approvedFromEnv,
  bindSemanticEvidence,
  buildSemanticPlanRows,
  buildSemanticSourceRows,
  loadAndVerifyContract,
  verifyFreshReport,
  writeDryRunContract,
} = require("./lib/ebay-artifact-bound-contract");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
const CONFIRMATION = "OWNER_APPROVED_EBAY_REFRESH";
const KIND = "ebay-existing-offer-refresh-exact-237-v1";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const HARD_PRICE_RATIO_LIMIT = 0.60;
const HARD_PRICE_ABSOLUTE_LIMIT = 20;
const MAPPING_VALUE_KEYS = ["external_product_id", "external_variant_id", "external_sku", "external_options", "external_name", "external_slug", "external_gtin", "external_url", "match_method", "match_confidence", "product_variant_id"];
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
  ["2581", { seller: "time4nutrition", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2610", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2611", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2612", { seller: "planszowki", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2613", { seller: "welzohealth", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2614", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2615", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2616", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2617", { seller: "the_sup_store", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2618", { seller: "muscle-factory-co-uk", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2621", { seller: "trainingfuels", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2634", { seller: "planszowki", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2642", { seller: "bosky1967", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2643", { seller: "aatavi97", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2644", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2645", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2646", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2647", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2648", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2649", { seller: "bigvits", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2650", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2651", { seller: "ivitaminsshop", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2652", { seller: "welzohealth", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2653", { seller: "ccolta", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2654", { seller: "welzohealth", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2655", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2656", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2657", { seller: "aatavi97", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2658", { seller: "anabolic_dream", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2659", { seller: "welzohealth", review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2661", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2662", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2663", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2664", { seller: "trainingfuels", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2665", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2666", { seller: "dcelectricsltd", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2667", { seller: "protein_ni", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2668", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2674", { seller: "ukesupps-2008", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2691", { seller: "food-grade-hydrogen-peroxide", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2692", { seller: "ultimate_fitness_4u", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2693", { seller: "mpbioscence", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2694", { seller: "soovital", review_reasons: new Set(["FLAVOUR_UNPROVEN", "FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2695", { seller: "thesupplementstoreuk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2696", { seller: "soovital", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2697", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2698", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2699", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2705", { seller: "gymstop", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2707", { seller: "soovital", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2709", { seller: "muscle-factory-co-uk", review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2716", { seller: "1thetreehouse", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2717", { seller: "z.m.s.limited", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2718", { seller: "ccolta", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2719", { seller: "premium_supps", review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2720", { seller: "themadtitansupplements", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2721", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2724", { seller: "planszowki", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2731", { seller: "fitgamerltd", returned_gtin: "5060245603423", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "GTIN_MISMATCH"]), review_reasons: new Set() }],
  ["2732", { seller: "jersupplementsales", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2733", { seller: "welzohealth", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2734", { seller: "ultimate_fitness_4u", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2736", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2737", { seller: "protein_ni", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2738", { seller: "occastore_limited", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2739", { seller: "startfitness-outlet", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN", "UNIT_COUNT_UNPROVEN"]) }],
  ["2741", { seller: "the_sup_store", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]) }],
  ["2742", { seller: "beastbody", returned_gtin: "810028291942", blockers: new Set(["CANONICAL_GTIN_INVALID", "GTIN_MISMATCH", "SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2743", { seller: "zambargain.house", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2747", { seller: "6packsupplementsuk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN", "SELLER_SCORE_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2749", { seller: "nutrafituk", returned_gtin: "5902114010133", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "GTIN_MISMATCH"]), review_reasons: new Set() }],
  ["2750", { seller: "muscle-factory-co-uk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2752", { seller: "ultimate_fitness_4u", returned_gtin: "5056555205402", blockers: new Set(["CANONICAL_GTIN_INVALID", "GTIN_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2753", { seller: "ultimate_fitness_4u", blockers: new Set(["CANONICAL_GTIN_INVALID", "FLAVOUR_MISMATCH", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
  ["2754", { seller: "thesupplementstoreuk", blockers: new Set(["CANONICAL_GTIN_INVALID"]), review_reasons: new Set(["FLAVOUR_UNPROVEN", "RETURNED_GTIN_UNPROVEN"]) }],
  ["2756", { seller: "fitnesshealthltd", blockers: new Set(["CANONICAL_GTIN_INVALID", "FORMAT_MISMATCH"]), review_reasons: new Set(["RETURNED_GTIN_UNPROVEN"]) }],
]);
const REVIEWED_EXACT_GTIN_CONTINUITY = new Map([
  ["2570", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2572", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2573", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set(["SIZE_UNPROVEN"]) }],
  ["2574", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2575", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2576", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2578", { seller: "appliednutritionplc", blockers: new Set(["FLAVOUR_MISMATCH"]), review_reasons: new Set() }],
  ["2582", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2583", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2585", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2587", { seller: "time4nutrition", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2588", { seller: "time4nutrition", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2631", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2632", { seller: "appliednutritionplc", blockers: new Set(["FLAVOUR_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2633", { seller: "appliednutritionplc", blockers: new Set(["UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2637", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2638", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2640", { seller: "phd_ltd", blockers: new Set(["SIZE_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2680", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2681", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2682", { seller: "ihrisironworks", blockers: new Set(), review_reasons: new Set(["SELLER_SCORE_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2688", { seller: "vikingshopsuple", blockers: new Set(), review_reasons: new Set(["SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2708", { seller: "superfoodmarket", blockers: new Set(), review_reasons: new Set(["FORMAT_UNPROVEN", "SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"]) }],
  ["2722", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2723", { seller: "trainingfuels", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2725", { seller: "ultimate_fitness_4u", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2726", { seller: "powerbodyltd", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
  ["2730", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2735", { seller: "myfit24ecom", blockers: new Set(["FORMAT_MISMATCH"]), review_reasons: new Set() }],
  ["2744", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2745", { seller: "powerbodyltd", blockers: new Set(["BRAND_MISMATCH"]), review_reasons: new Set() }],
  ["2748", { seller: "ukesupps-2008", blockers: new Set(["BRAND_MISMATCH", "UNIT_COUNT_MISMATCH"]), review_reasons: new Set() }],
  ["2755", { seller: "icebergsupplements", blockers: new Set(["BRAND_MISMATCH", "FORMAT_MISMATCH"]), review_reasons: new Set(["FLAVOUR_UNPROVEN"]) }],
  ["2757", { seller: "powerbodyltd", blockers: new Set(["SIZE_MISMATCH"]), review_reasons: new Set() }],
]);
function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
const { SCOPES, ROLLOUTS, loadScopes, bindMembership, assertArtifactMembership } = require("./lib/ebay-membership");
const SCOPE = SCOPES.find((scope) => scope.offer_id === "2558");
function pendingArtifact(scope, outDir = OUT) { return path.join(outDir, `pending-${scope.offer_id}.json`); }
function pendingBatchPath(outDir = OUT) { return path.join(outDir, "pending-batch.json"); }

function partitionSourceFailures(unsafeRows) {
  const sourceFailures = unsafeRows.filter((row) => row.source_error === "SOURCE_READ_FAILED");
  const explicitlyIsolated = sourceFailures.filter((row) => row.source_failure_scope === "ROW");
  const unclassified = sourceFailures.filter((row) => !row.source_failure_scope);
  const globalBlocked = sourceFailures.filter((row) => row.source_failure_scope === "GLOBAL");
  if (unclassified.length > 1) globalBlocked.push(...unclassified);
  else explicitlyIsolated.push(...unclassified);
  return {
    globalBlocked,
    sourceFailureReview: explicitlyIsolated.map((row) => ({ ...row, review_type: "SOURCE_FAILURE" })),
  };
}

function writePendingBatch(report, now, outDir = OUT) {
  assertArtifactMembership(report);
  if (report.blocked_row_count !== 0) fail("Global eBay refresh blockers prevent apply preparation");
  const manifest = {
    ...bindMembership(),
    schema_version: 2,
    kind: KIND,
    created_at: now.toISOString(),
    offer_ids: SCOPES.map((scope) => scope.offer_id),
    executable_offer_ids: report.execution_offer_ids,
    review_rows: report.review_rows,
    blocked_rows: report.blocked_rows,
    commit_sha: report.commit_sha,
    source_fingerprint: report.source_fingerprint,
    full_capture_fingerprint: report.full_capture_fingerprint,
    executable_source_fingerprint: report.executable_source_fingerprint,
    review_scope_fingerprint: report.review_scope_fingerprint,
    approved_full_capture_fingerprint: report.approved_full_capture_fingerprint || report.full_capture_fingerprint,
    approved_executable_source_fingerprint: report.approved_executable_source_fingerprint || report.executable_source_fingerprint,
    approved_review_scope_fingerprint: report.approved_review_scope_fingerprint || report.review_scope_fingerprint,
    approved_plan_fingerprint: report.approved_plan_fingerprint || report.plan_fingerprint,
    fresh_full_capture_fingerprint: report.fresh_full_capture_fingerprint || report.full_capture_fingerprint,
    fresh_review_scope_fingerprint: report.fresh_review_scope_fingerprint || report.review_scope_fingerprint,
    source_row_fingerprints: report.source_row_fingerprints,
    plan_row_fingerprints: report.plan_row_fingerprints,
    plan_fingerprint: report.plan_fingerprint,
  };
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = sha256(bytes);
  const batchPath = pendingBatchPath(outDir);
  fs.writeFileSync(batchPath, bytes, { flag: "wx" });
  fs.writeFileSync(`${batchPath}.sha256`, `${manifestSha256}\n`, { flag: "wx" });
  return { manifest, manifestSha256 };
}

function loadPendingBatch(now = new Date(), outDir = OUT) {
  const batchPath = pendingBatchPath(outDir);
  const bytes = fs.readFileSync(batchPath);
  const expectedHash = fs.readFileSync(`${batchPath}.sha256`, "utf8").trim();
  if (sha256(bytes) !== expectedHash) fail("Pending eBay refresh batch SHA-256 mismatch");
  const manifest = JSON.parse(bytes.toString("utf8"));
  const ageMs = now.getTime() - new Date(manifest.created_at).getTime();
  assertArtifactMembership({ approved_mapping_count: manifest.offer_ids?.length, ...manifest });
  const executable = new Set(manifest.executable_offer_ids || []);
  const review = new Set((manifest.review_rows || []).map((row) => String(row.offer_id)));
  const blocked = new Set((manifest.blocked_rows || []).map((row) => String(row.offer_id)));
  const sourceFingerprintIds = new Set((manifest.source_row_fingerprints || []).map((row) => String(row.offer_id)));
  const planFingerprintIds = new Set((manifest.plan_row_fingerprints || []).map((row) => String(row.offer_id)));
  const fingerprintFields = ["source_fingerprint", "full_capture_fingerprint", "executable_source_fingerprint", "review_scope_fingerprint", "approved_full_capture_fingerprint", "approved_executable_source_fingerprint", "approved_review_scope_fingerprint", "approved_plan_fingerprint", "fresh_full_capture_fingerprint", "fresh_review_scope_fingerprint", "plan_fingerprint"];
  if (manifest.schema_version !== 2 || manifest.kind !== KIND || !Number.isFinite(ageMs) || ageMs < -120000 || ageMs > 15 * 60 * 1000 || JSON.stringify(manifest.offer_ids) !== JSON.stringify(SCOPES.map((scope) => scope.offer_id)) || executable.size !== (manifest.executable_offer_ids || []).length || review.size !== (manifest.review_rows || []).length || blocked.size !== (manifest.blocked_rows || []).length || blocked.size !== 0 || [...executable].some((id) => review.has(id) || blocked.has(id)) || [...review].some((id) => blocked.has(id)) || executable.size + review.size !== SCOPES.length || SCOPES.some((scope) => !executable.has(scope.offer_id) && !review.has(scope.offer_id)) || sourceFingerprintIds.size !== SCOPES.length || SCOPES.some((scope) => !sourceFingerprintIds.has(scope.offer_id)) || planFingerprintIds.size !== executable.size || [...executable].some((id) => !planFingerprintIds.has(id)) || (manifest.source_row_fingerprints || []).some((row) => !/^[0-9a-f]{64}$/.test(row.semantic_fingerprint || "")) || (manifest.plan_row_fingerprints || []).some((row) => row.scope !== "EXECUTABLE" || !/^[0-9a-f]{64}$/.test(row.semantic_fingerprint || "")) || fingerprintFields.some((field) => !/^[0-9a-f]{64}$/.test(manifest[field] || ""))) fail("Pending eBay refresh batch scope, partition or freshness mismatch");
  return { manifest, executable, manifestSha256: expectedHash };
}

function parseArgs(argv) {
  const options = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target|approved-contract|emit-approval-contract)=(.*)$/);
    if (!match || options[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    options[match[1]] = match[2];
  }
  if (options.target !== "production") fail("Required --target=production");
  if (!new Set(["dry-run", "prepare-apply", "execute-apply"]).has(options.mode)) fail("Required --mode=dry-run|prepare-apply|execute-apply");
  if (options["approved-contract"] !== undefined) options.approvedContract = options["approved-contract"];
  if (options["emit-approval-contract"] !== undefined && !["true", "false"].includes(options["emit-approval-contract"])) fail("emit-approval-contract must be true or false");
  if (options["emit-approval-contract"] !== undefined) options.emitApprovalContract = options["emit-approval-contract"] === "true";
  delete options["approved-contract"];
  delete options["emit-approval-contract"];
  if (options.mode === "prepare-apply" && process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && !options.approvedContract) fail("Artifact-bound manual apply requires --approved-contract");
  if (options.mode !== "dry-run" && options.emitApprovalContract) fail("Only a dry-run may emit a review source contract");
  return options;
}

function assertExecutionContext(mode, env = process.env) {
  if (mode === "dry-run") return;
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)) fail("eBay refresh apply requires GitHub Actions schedule or manual dispatch on main");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") approvedFromEnv(env);
}

function classifyContinuity(scope, evaluation) {
  if (scope.seller_username && evaluation.seller?.username !== scope.seller_username) return { eligible: false, tier: "blocked" };
  const exactIdentity = evaluation.item_id === scope.external_variant_id && evaluation.legacy_item_id === scope.external_product_id;
  if (!exactIdentity || !evaluation.affiliate_ready || !evaluation.affiliate_url) return { eligible: false, tier: "blocked" };
  const blockers = new Set(evaluation.blockers);
  const reasons = new Set(evaluation.review_reasons);
  const policy = scope.continuity_policy;
  const extensionPolicy = policy ? { seller: scope.seller_username, returned_gtin: policy.returned_gtin, blockers: new Set(policy.blockers), review_reasons: new Set(policy.review_reasons) } : null;
  const reviewed = REVIEWED_MISSING_GTIN_CONTINUITY.get(scope.offer_id) || (policy?.returned_gtin === null ? extensionPolicy : null);
  const reviewedExactGtin = REVIEWED_EXACT_GTIN_CONTINUITY.get(scope.offer_id) || (policy?.returned_gtin != null ? extensionPolicy : null);
  const expectedBlockers = reviewed?.blockers || (scope.gtin ? new Set() : new Set(["CANONICAL_GTIN_INVALID"]));
  const expectedReturnedGtin = reviewed && Object.hasOwn(reviewed, "returned_gtin") ? reviewed.returned_gtin : null;
  if (
    evaluation.returned_gtin === expectedReturnedGtin && reviewed && evaluation.seller?.username === reviewed.seller && evaluation.seller?.account_type === "BUSINESS" &&
    blockers.size === expectedBlockers.size && [...blockers].every((blocker) => expectedBlockers.has(blocker)) &&
    reasons.size === reviewed.review_reasons.size && [...reasons].every((reason) => reviewed.review_reasons.has(reason))
  ) return { eligible: true, tier: "sealed_owner_reviewed_missing_gtin_continuity" };
  if (
    scope.gtin && evaluation.returned_gtin === scope.gtin && reviewedExactGtin &&
    evaluation.seller?.username === reviewedExactGtin.seller && evaluation.seller?.account_type === "BUSINESS" &&
    blockers.size === reviewedExactGtin.blockers.size && [...blockers].every((blocker) => reviewedExactGtin.blockers.has(blocker)) &&
    reasons.size === reviewedExactGtin.review_reasons.size && [...reasons].every((reason) => reviewedExactGtin.review_reasons.has(reason))
  ) return { eligible: true, tier: "sealed_owner_reviewed_exact_gtin_metadata_continuity" };
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
  if (!["manual", "feed"].includes(entry.plan_kind) || String(entry.retailer_id) !== scope.retailer_id || !planTargetsExactScope(scope, plan)) fail(`Refresh plan escaped exact scope for offer ${scope.offer_id}`);
  if (!before || !after || String(before.retailer_product_id) !== scope.retailer_product_id || after.url !== scope.affiliate_url || after.in_stock !== true) fail(`Refresh plan changed identity, URL or guarded stock policy for offer ${scope.offer_id}`);
  const readMoney = (value, field, { positive = false } = {}) => {
    const number = Number(value);
    if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) fail(`Refresh plan contains invalid ${field} for offer ${scope.offer_id}`);
    return number;
  };
  const oldPrice = readMoney(before.price, "before price", { positive: true });
  const newPrice = readMoney(after.price, "proposed price", { positive: true });
  const oldShipping = readMoney(before.shipping_cost, "before shipping");
  const newShipping = readMoney(after.shipping_cost, "proposed shipping");
  const oldTotal = readMoney(before.total_price, "before total");
  const newTotal = readMoney(after.total_price, "proposed total");
  if (Math.abs(oldPrice + oldShipping - oldTotal) > 0.011 || Math.abs(newPrice + newShipping - newTotal) > 0.011) fail(`Refresh plan contains malformed before or proposed totals for offer ${scope.offer_id}`);
  const absolute = Math.abs(newPrice - oldPrice);
  const ratio = absolute / oldPrice;
  const priceChange = Object.freeze({
    before_price: oldPrice.toFixed(2),
    proposed_price: newPrice.toFixed(2),
    absolute_delta: absolute.toFixed(2),
    ratio,
    ratio_hard_limit: HARD_PRICE_RATIO_LIMIT,
    absolute_hard_limit: HARD_PRICE_ABSOLUTE_LIMIT.toFixed(2),
  });
  return { loaded, entry, priceChange, hardPriceAnomaly: ratio >= HARD_PRICE_RATIO_LIMIT || absolute >= HARD_PRICE_ABSOLUTE_LIMIT };
}

function validatePreparedArtifact(scope, loaded, now = new Date()) {
  if (loaded.artifact.environment_marker !== "production") fail("Prepared refresh artifact target mismatch");
  const createdAt = new Date(loaded.artifact.created_at), ageMs = now.getTime() - createdAt.getTime();
  if (!Number.isFinite(createdAt.getTime()) || ageMs < -120000 || ageMs > 15 * 60 * 1000) fail("Prepared refresh artifact is not fresh");
  const approved = validatePlan(scope, loaded);
  const plan = approved.entry.resolved_plan;
  const before = plan.expected_state.offer, after = plan.offer.values;
  const verifiedNoChange = ["price", "shipping_cost", "total_price"].every((field) => Number(before[field]) === Number(after[field])) && before.in_stock === after.in_stock && before.url === after.url;
  if (approved.hardPriceAnomaly || plan.offer.action !== "verify_no_change" || plan.price_history.action !== "noop" || !verifiedNoChange) fail(`Only VERIFY_NO_CHANGE may execute automatically for offer ${scope.offer_id}`);
  return approved;
}

function actionForPlan(plan) {
  if (plan.offer.action === "verify_no_change") return "VERIFY_NO_CHANGE";
  const before = plan.expected_state.offer;
  const after = plan.offer.values;
  const price = Number(before.price) !== Number(after.price);
  const stock = before.in_stock !== after.in_stock;
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  return "MANUAL_REVIEW";
}

function mappingUpdateIsSerializedNoop(plan) {
  if (plan.retailer_product?.action !== "update" || !plan.retailer_product.values || !plan.expected_state?.retailer_product) return false;
  if (!isDeepStrictEqual(Object.keys(plan.retailer_product.values).sort(), [...MAPPING_VALUE_KEYS].sort())) return false;
  const expected = plan.expected_state.retailer_product;
  const expectedValues = Object.fromEntries(MAPPING_VALUE_KEYS.map((key) => [key, expected[key]]));
  return isDeepStrictEqual(plan.retailer_product.values, expectedValues);
}

function planTargetsExactScope(scope, plan, { allowSerializedMappingNoop = false } = {}) {
  const mappingActionIsSafe = plan.retailer_product?.action === "noop" || (allowSerializedMappingNoop && mappingUpdateIsSerializedNoop(plan));
  return plan.product?.action === "existing" && String(plan.product.id) === scope.product_id &&
    plan.product_variant?.action === "existing" && String(plan.product_variant.id) === scope.product_variant_id &&
    plan.retailer?.action === "existing" && String(plan.retailer.id) === scope.retailer_id &&
    mappingActionIsSafe && String(plan.retailer_product.id) === scope.retailer_product_id &&
    ["update", "verify_no_change"].includes(plan.offer?.action) && String(plan.offer.id) === scope.offer_id &&
    ["noop", "create"].includes(plan.price_history?.action);
}

function initialImporterPlanTargetsExactScope(scope, plan) {
  const offerAction = plan.offer?.action;
  const mappingActionIsSafe = plan.retailer_product?.action === "noop" || mappingUpdateIsSerializedNoop(plan);
  const historyActionIsSafe = offerAction === "update" ? ["noop", "create"].includes(plan.price_history?.action) : plan.price_history?.action === "noop";
  return plan.product?.action === "existing" && String(plan.product.id) === scope.product_id &&
    plan.product_variant?.action === "existing" && String(plan.product_variant.id) === scope.product_variant_id &&
    plan.retailer?.action === "existing" && String(plan.retailer.id) === scope.retailer_id &&
    mappingActionIsSafe && String(plan.retailer_product.id) === scope.retailer_product_id &&
    ["noop", "update", "verify_no_change"].includes(offerAction) && String(plan.offer.id) === scope.offer_id &&
    historyActionIsSafe;
}

function normalizeApprovedSourceCapturedAt(value, offerId, now = new Date()) {
  try {
    const canonical = canonicalTimestamp(value, "approved_source_captured_at");
    const parsed = new Date(canonical);
    const normalized = parsed.toISOString();
    if (canonicalTimestamp(normalized, "approved_source_captured_at") !== canonical) throw new Error("sub-millisecond precision is unsupported");
    if (parsed.getTime() > now.getTime()) throw new Error("timestamp is in the future");
    return normalized;
  } catch {
    fail(`Approved source capture timestamp is invalid for offer ${offerId}`);
  }
}

async function buildSource(scope, config, fetchImpl = fetch, tokenOverride = null, sourceFetchOptions = {}) {
  const token = tokenOverride || await getApplicationToken(config, fetchImpl);
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  const fetched = await boundedSourceFetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(scope.external_variant_id)}`, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id, "X-EBAY-C-ENDUSERCTX": context.join(",") } }, { fetchImpl, ...sourceFetchOptions });
  const response = fetched.response;
  const status = Number(response.status || (response.ok ? 200 : 0));
  if (!response.ok) {
    const error = new Error(`Approved eBay listing ${scope.external_variant_id} direct read failed with HTTP ${status}; automatic OOS is intentionally blocked`);
    error.source_failure_scope = status === 404 ? "ROW" : "GLOBAL";
    error.source_retry = { attempts: fetched.attempts, retry_count: fetched.retry_count };
    error.http_metadata = { status };
    throw error;
  }
  const exact = await response.json();
  if (String(exact.itemId) !== scope.external_variant_id || String(exact.legacyItemId) !== scope.external_product_id) fail(`Direct eBay item identity drift for offer ${scope.offer_id}`);
  return {
    ...evaluateItem(scope, exact, { ...DEFAULT_POLICY, affiliate_campaign_configured: true }),
    source_retry: { attempts: fetched.attempts, retry_count: fetched.retry_count },
    http_metadata: { status },
  };
}

async function prepareScope(scope, evaluation, mode, dependencies, stamp, approvedSourceCapturedAt = null) {
  const row = rowFromEvaluation(scope, evaluation);
  let artifactRows = [row];
  let result = await (dependencies.runImportRows || runImportRows)([row], { mode: "manual", dryRun: true });
  const initialPlan = result.report?.approvedRows?.[0]?.importPlan;
  if (!initialPlan) {
    const blockedRows = result.blockedRows || result.report?.blockedRows || [];
    const reason = String(blockedRows[0]?.block_reason || blockedRows[0]?.reason || "");
    if (blockedRows.length === 1 && /conflicting variant evidence/i.test(reason)) {
      return { review: { offer_id: scope.offer_id, item_id: evaluation.item_id, action: "IDENTITY_CONFLICT", review_type: "IDENTITY_CONFLICT", reason } };
    }
    fail(`Refresh importer blocked offer ${scope.offer_id} outside the isolated identity-conflict contract`);
  }
  if (!initialImporterPlanTargetsExactScope(scope, initialPlan)) fail(`Refresh importer escaped exact scope for offer ${scope.offer_id}`);
  const capturedAt = normalizeApprovedSourceCapturedAt(approvedSourceCapturedAt || initialPlan.offer?.values?.last_checked_at || new Date().toISOString(), scope.offer_id);
  const snapshotHash = sha256(JSON.stringify({ item_id: evaluation.item_id, gtin: evaluation.returned_gtin, price: evaluation.item_price, shipping: evaluation.uk_shipping, delivered: evaluation.delivered_price, captured_at: capturedAt }));
  if (initialPlan.offer?.action === "noop") {
    const target = JSON.parse(JSON.stringify(initialPlan.expected_state));
    delete target.retailer_product.updated_at;
    const verification = buildVerifiedNoChangeDryRun([{ source_snapshot_sha256: snapshotHash, source_captured_at: capturedAt, source: { external_product_id: scope.external_product_id, external_variant_id: scope.external_variant_id, price: row.price, in_stock: true, url: row.affiliate_url, external_url: row.external_url }, target }], { targetEnvironment: "PRODUCTION", targetProjectRef: PROJECT_REF, expectedCount: 1, sourceSnapshotSha256s: [snapshotHash], now: new Date(capturedAt) });
    artifactRows = verification.records;
    result = verification.result;
  } else if (initialPlan.offer?.action !== "verify_no_change") {
    if (!planTargetsExactScope(scope, initialPlan, { allowSerializedMappingNoop: true })) fail(`Refresh plan escaped exact offer-only scope for offer ${scope.offer_id}`);
    const built = buildExistingOfferUpdatePlan({
      product: initialPlan.expected_state.product,
      variant: initialPlan.expected_state.product_variant,
      retailer: initialPlan.expected_state.retailer,
      mapping: initialPlan.expected_state.retailer_product,
      offer: initialPlan.expected_state.offer,
      source: {
        external_product_id: scope.external_product_id,
        external_variant_id: scope.external_variant_id,
        price: row.price,
        shipping_cost: row.shipping_cost,
        total_price: (Number(row.price) + Number(row.shipping_cost)).toFixed(2),
        in_stock: true,
        url: row.affiliate_url,
      },
      sourceCapturedAt: capturedAt,
      sourceSnapshotFingerprint: snapshotHash,
    });
    artifactRows = [built.record];
    result = { report: { approvedRows: [{ importPlan: built.plan }] } };
  }
  const outDir = dependencies.outDir || OUT;
  const artifactPath = mode === "prepare-apply" ? pendingArtifact(scope, outDir) : path.join(outDir, `artifact-${scope.offer_id}-${stamp}.json`);
  const written = (dependencies.writeDryRunArtifact || writeDryRunArtifact)(artifactRows, result, { artifactPath, sourceFileName: `ebay-browse-live-${scope.offer_id}.json`, environmentMarker: "production" });
  const approved = validatePlan({ ...scope, affiliate_url: row.affiliate_url }, { artifact: written.artifact, artifactSha256: written.artifactSha256 });
  const plan = approved.entry.resolved_plan;
  if (Number(plan.expected_state.offer.shipping_cost) !== Number(plan.offer.values.shipping_cost)) {
    const reason = "SHIPPING_POLICY_DRIFT";
    return { review: { offer_id: scope.offer_id, item_id: evaluation.item_id, action: "MANUAL_REVIEW",
      review_type: "POLICY_REVIEW", reason, source_record_evidence: {
        expected_offer: plan.expected_state.offer, observed_offer: plan.offer.values,
      } }, evaluation: { ...evaluation, review_reasons: [...new Set([...evaluation.review_reasons, reason])] } };
  }
  return { approved, evaluation };
}

async function run(options, dependencies = {}) {
  assertExecutionContext(options.mode, dependencies.env || process.env);
  const outDir = path.resolve(dependencies.outDir || OUT);
  fs.mkdirSync(outDir, { recursive: true });
  const now = dependencies.now || new Date();
  if (options.mode === "execute-apply") {
    const batch = (dependencies.loadPendingBatch || loadPendingBatch)(now, outDir);
    let approvedInput = null;
    if ((dependencies.env || process.env).GITHUB_EVENT_NAME === "workflow_dispatch") {
      approvedInput = approvedFromEnv(dependencies.env || process.env);
      if (batch.manifest.commit_sha !== approvedInput.commitSha || batch.manifest.approved_full_capture_fingerprint !== approvedInput.fullCaptureFingerprint || batch.manifest.approved_executable_source_fingerprint !== approvedInput.executableSourceFingerprint || batch.manifest.approved_review_scope_fingerprint !== approvedInput.reviewScopeFingerprint || batch.manifest.approved_plan_fingerprint !== approvedInput.planFingerprint) fail("Pending batch escaped the approved executable-scope contract");
    }
    const approved = SCOPES.filter((scope) => batch.executable.has(scope.offer_id)).map((scope) => validatePreparedArtifact(scope, (dependencies.loadDryRunArtifact || loadDryRunArtifact)(pendingArtifact(scope, outDir)), now));
    for (const item of approved) await (dependencies.executePlan || executePlan)(item, KIND);
    const report = {
      result: batch.manifest.review_rows.length ? "PASS_WITH_REVIEW" : "PASS",
      mode: options.mode,
      ...bindMembership(),
      approved_mapping_count: SCOPES.length,
      executable_plan_count: approved.length,
      executed_plan_count: approved.length,
      review_row_count: batch.manifest.review_rows.length,
      blocked_row_count: 0,
      execution_offer_ids: [...batch.executable],
      review_rows: batch.manifest.review_rows,
      blocked_rows: [],
      classification: { VERIFY_NO_CHANGE: approved.length },
      expected_deltas: {
        logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: approved.length },
        row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 },
      },
      scope: { offers: SCOPES.length, executable: approved.length, review: batch.manifest.review_rows.length, blocked: 0, offer_ids: SCOPES.map((scope) => scope.offer_id) },
      executed: approved.length,
      automatic_oos: "blocked",
      commit_sha: process.env.GITHUB_SHA || null,
      manifest_sha256: batch.manifestSha256,
      source_fingerprint: batch.manifest.source_fingerprint,
      full_capture_fingerprint: batch.manifest.full_capture_fingerprint,
      executable_source_fingerprint: batch.manifest.executable_source_fingerprint,
      review_scope_fingerprint: batch.manifest.review_scope_fingerprint,
      source_row_fingerprints: batch.manifest.source_row_fingerprints,
      plan_row_fingerprints: batch.manifest.plan_row_fingerprints,
      approved_full_capture_fingerprint: batch.manifest.approved_full_capture_fingerprint,
      approved_executable_source_fingerprint: batch.manifest.approved_executable_source_fingerprint,
      approved_review_scope_fingerprint: batch.manifest.approved_review_scope_fingerprint,
      approved_plan_fingerprint: batch.manifest.approved_plan_fingerprint,
      fresh_full_capture_fingerprint: batch.manifest.fresh_full_capture_fingerprint,
      fresh_review_scope_fingerprint: batch.manifest.fresh_review_scope_fingerprint,
      plan_fingerprint: batch.manifest.plan_fingerprint,
      approved_dry_run_id: approvedInput?.runId || null,
      approved_artifact_id: approvedInput?.artifactId || null,
      approved_commit_sha: approvedInput?.commitSha || null,
      approved_manifest_sha256: approvedInput?.manifestSha256 || null,
      approved_report_sha256: approvedInput?.reportSha256 || null,
    };
    fs.writeFileSync(path.join(outDir, `execute-apply-${now.toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "production-apply.json"), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
  const config = dependencies.config || assertConfig(dependencies.env || process.env);
  const token = dependencies.token || await getApplicationToken(config, dependencies.fetchImpl || fetch);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const evaluations = [];
  for (const scope of SCOPES) {
    try {
      const evaluation = dependencies.evaluations?.get(scope.offer_id) || await buildSource(scope, config, dependencies.fetchImpl || fetch, token, dependencies.sourceFetchOptions);
      evaluations.push({ ...evaluation, continuity: evaluation.continuity || classifyContinuity(scope, evaluation) });
    } catch (error) {
      evaluations.push({
        item_id: scope.external_variant_id,
        decision: "NOT_FOUND",
        blockers: ["SOURCE_READ_FAILED"],
        review_reasons: [],
        returned_gtin: null,
        source_error: "SOURCE_READ_FAILED",
        source_failure_scope: error?.source_failure_scope || "GLOBAL",
        source_retry: error?.source_retry || null,
        http_metadata: error?.http_metadata || null,
        continuity: { eligible: false, tier: "blocked" },
      });
    }
  }
  const unsafeRows = evaluations.flatMap((evaluation, index) => evaluation.continuity.eligible ? [] : [{
    offer_id: SCOPES[index].offer_id,
    item_id: evaluation.item_id,
    decision: evaluation.decision,
    blockers: evaluation.blockers,
    review_reasons: evaluation.review_reasons,
    returned_gtin: evaluation.returned_gtin,
    source_error: evaluation.source_error || null,
    source_failure_scope: evaluation.source_failure_scope || null,
    source_retry: evaluation.source_retry || null,
    http_metadata: evaluation.http_metadata || null,
  }]);
  const prepared = [];
  for (let index = 0; index < SCOPES.length; index += 1) {
    if (!evaluations[index].continuity.eligible) continue;
    const preparedScope = await prepareScope(SCOPES[index], evaluations[index], options.mode, dependencies, stamp);
    prepared.push(preparedScope);
    if (preparedScope.evaluation) evaluations[index] = preparedScope.evaluation;
  }
  const { globalBlocked, sourceFailureReview } = partitionSourceFailures(unsafeRows);
  const identityReview = unsafeRows.filter((row) => row.source_error !== "SOURCE_READ_FAILED").map((row) => ({ ...row, review_type: "IDENTITY_CONFLICT" }));
  const importerIdentityReview = prepared.flatMap(({ review }) => review && review.review_type !== "POLICY_REVIEW" ? [review] : []);
  const policyReview = prepared.flatMap(({ review }) => review?.review_type === "POLICY_REVIEW" ? [review] : []);
  const preparedRows = prepared.filter(({ approved }) => approved).map(({ approved }) => {
    const plan = approved.entry.resolved_plan;
    return { offer_id: String(plan.offer.id), action: actionForPlan(plan), approved, hard_price_anomaly: approved.hardPriceAnomaly, price_change: approved.priceChange };
  });
  const executableRows = globalBlocked.length ? [] : preparedRows.filter((row) => row.action === "VERIFY_NO_CHANGE");
  const commercialReview = preparedRows.filter((row) => row.action !== "VERIFY_NO_CHANGE").map((row) => ({
    offer_id: row.offer_id,
    action: row.action,
    review_type: "COMMERCIAL_CHANGE",
    ...(row.hard_price_anomaly && row.action === "UPDATE_PRICE" ? { reason: "HARD_PRICE_ANOMALY", price_change: row.price_change } : {}),
  }));
  const reviewRows = [...sourceFailureReview, ...identityReview, ...importerIdentityReview, ...policyReview, ...commercialReview].sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const classification = preparedRows.reduce((counts, row) => ({ ...counts, [row.action]: (counts[row.action] || 0) + 1 }), {});
  const semanticSourceRows = buildSemanticSourceRows(SCOPES, evaluations);
  const semanticPlanRows = buildSemanticPlanRows(preparedRows, reviewRows, globalBlocked);
  let report = {
    result: globalBlocked.length ? "BLOCK" : reviewRows.length ? "PASS_WITH_REVIEW" : "PASS",
    mode: options.mode,
    approved_mapping_count: SCOPES.length,
    executable_plan_count: executableRows.length,
    executed_plan_count: 0,
    review_row_count: reviewRows.length,
    blocked_row_count: globalBlocked.length,
    execution_offer_ids: executableRows.map((row) => row.offer_id),
    scope: { offers: SCOPES.length, executable: executableRows.length, review: reviewRows.length, blocked: globalBlocked.length, offer_ids: SCOPES.map((scope) => scope.offer_id) },
    classification,
    classifications: Object.fromEntries(preparedRows.map((row) => [row.offer_id, row.action])),
    captured_at: now.toISOString(),
    source: evaluations.map((evaluation, index) => ({ offer_id: SCOPES[index].offer_id, item_id: evaluation.item_id, gtin: evaluation.returned_gtin, continuity_tier: evaluation.continuity.tier, price: evaluation.item_price?.value ?? null, shipping: evaluation.uk_shipping?.value ?? null, delivered: evaluation.delivered_price?.value ?? null, captured_at: now.toISOString(), source_retry: evaluation.source_retry || null, http_metadata: evaluation.http_metadata || null })),
    review_rows: reviewRows,
    blocked_rows: globalBlocked,
    commercial_change_count: commercialReview.length,
    identity_conflict_count: identityReview.length + importerIdentityReview.length,
    source_failure_review_count: sourceFailureReview.length,
    expected_deltas: {
      logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: executableRows.length },
      row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 },
    },
    executed: 0, automatic_oos: "blocked",
    commit_sha: process.env.GITHUB_SHA || null,
  };
  report = bindSemanticEvidence(report, semanticSourceRows, semanticPlanRows);
  if (options.mode === "prepare-apply" && !globalBlocked.length) {
    if ((dependencies.env || process.env).GITHUB_EVENT_NAME === "workflow_dispatch") {
      const approved = loadAndVerifyContract(path.dirname(path.resolve(options.approvedContract)), approvedFromEnv(dependencies.env || process.env), now);
      fs.writeFileSync(path.join(outDir, "fresh-revalidation-candidate.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
      report = verifyFreshReport(approved, report);
      fs.writeFileSync(path.join(outDir, "fresh-revalidation-result.json"), `${JSON.stringify({ result: "PASS", drift_scope: report.drift_scope, approved_executable_offer_ids: report.execution_offer_ids, fresh_candidate_executable_offer_ids: report.fresh_candidate_executable_offer_ids, full_capture_fingerprint: report.full_capture_fingerprint, executable_source_fingerprint: report.executable_source_fingerprint, review_scope_fingerprint: report.review_scope_fingerprint, plan_fingerprint: report.plan_fingerprint, database_writes: 0 }, null, 2)}\n`, { flag: "wx" });
    }
    const binding = (dependencies.writePendingBatch || writePendingBatch)(report, now, outDir);
    report.manifest_sha256 = binding?.manifestSha256 || null;
  }
  fs.writeFileSync(path.join(outDir, `${options.mode}-${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
  if (options.mode === "dry-run") {
    fs.writeFileSync(path.join(outDir, "production-dry-run.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (options.emitApprovalContract) report.approval_contract = writeDryRunContract(outDir, report, dependencies.env || process.env, now);
  }
  return report;
}

async function main(argv = process.argv.slice(2)) { const report = await run(parseArgs(argv)); console.log(JSON.stringify(report)); if (!report.result.startsWith("PASS")) process.exitCode = 2; }
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CONFIRMATION, KIND, ROLLOUTS, SCOPES, SCOPE, actionForPlan, assertExecutionContext, buildSource, classifyContinuity, initialImporterPlanTargetsExactScope, loadPendingBatch, loadScopes, mappingUpdateIsSerializedNoop, normalizeApprovedSourceCapturedAt, parseArgs, partitionSourceFailures, pendingArtifact, prepareScope, rowFromEvaluation, run, validatePlan, validatePreparedArtifact, writePendingBatch };
