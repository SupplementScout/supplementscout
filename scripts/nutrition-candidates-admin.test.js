const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
}

const {
  buildNutritionCandidateReviewUpdate,
  canReviewNutritionCandidate,
  isBulkApprovableNutritionCandidate,
  parseNutritionCandidateBulkReviewInput,
  parseNutritionCandidateReviewInput,
  validateNutritionCandidateReviewFact,
  validateNutritionCandidateBulkSelection,
} = loadTsModule("app/admin/lib/nutritionCandidateReview.ts");
const {
  getNutritionCandidateBatchProgress,
  groupNutritionCandidatesByProduct,
  groupNutritionCandidatesByRun,
} = loadTsModule(
  "app/admin/lib/nutritionCandidateRuns.ts"
);
const {
  NutritionVariantProvenanceMigrationRequiredError,
  isMissingNutritionPreworkoutFactColumn,
  isMissingNutritionVariantProvenanceColumn,
  readNutritionCandidatesWithSchemaCompatibility,
} = loadTsModule("app/admin/lib/nutritionCandidateSchemaCompatibility.ts");

test("candidate reads fall back only for the exact missing provenance columns", async () => {
  const missing = {
    code: "42703",
    message: "column nutrition_candidates.product_variant_id does not exist",
  };
  assert.equal(isMissingNutritionVariantProvenanceColumn(missing), true);
  assert.equal(isMissingNutritionVariantProvenanceColumn({ code: "42703", message: "column products.name does not exist" }), false);
  let legacyReads = 0;
  const result = await readNutritionCandidatesWithSchemaCompatibility(
    async () => ({ data: null, error: missing }),
    async () => {
      legacyReads += 1;
      return { data: [{ id: "1", product_id: "38" }], error: null };
    },
    true
  );
  assert.equal(legacyReads, 1);
  assert.equal(result.variantProvenanceAvailable, false);
  assert.deepEqual(result.rows, [{
    id: "1", product_id: "38", product_variant_id: null, source_archive_uri: null,
  }]);
  await assert.rejects(
    readNutritionCandidatesWithSchemaCompatibility(
      async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
      async () => ({ data: [], error: null }),
      true
    ),
    (error) => error?.code === "42501" && error?.message === "permission denied"
  );
});

test("variant review stays unavailable when provenance columns are absent", async () => {
  await assert.rejects(
    readNutritionCandidatesWithSchemaCompatibility(
      async () => ({ data: null, error: {
        code: "PGRST204",
        message: "Could not find the 'source_archive_uri' column of 'nutrition_candidates' in the schema cache",
      } }),
      async () => ({ data: [{ id: "1" }], error: null }),
      false
    ),
    NutritionVariantProvenanceMigrationRequiredError
  );
});

test("post-migration candidate reads retain exact provenance without a legacy retry", async () => {
  let legacyReads = 0;
  const result = await readNutritionCandidatesWithSchemaCompatibility(
    async () => ({ data: [{
      id: "1", product_id: "38", product_variant_id: "726",
      source_archive_uri: "supabase-storage://nutrition-sources/labels/38/source.jpg",
    }], error: null }),
    async () => {
      legacyReads += 1;
      return { data: [], error: null };
    },
    true
  );
  assert.equal(result.variantProvenanceAvailable, true);
  assert.equal(result.rows[0].product_variant_id, "726");
  assert.equal(legacyReads, 0);
});

test("batch progress counts complete data entry and completed review by product", () => {
  const items = [
    { run_id: "NCR1", product_id: "10", missing_fields: ["net_weight_g", "serving_size_g"] },
    { run_id: "NCR1", product_id: "11", missing_fields: ["net_weight_g"] },
    { run_id: "NCR1", product_id: "12", missing_fields: ["protein_per_serving_g"] },
  ];
  const candidate = (product_id, proposed_field, status) => ({
    run_id: "NCR1", product_id, proposed_field, status,
  });
  assert.deepEqual(getNutritionCandidateBatchProgress(items, {
    pending: [candidate("11", "net_weight_g", "pending")],
    approved: [
      candidate("10", "net_weight_g", "approved"),
      candidate("10", "serving_size_g", "approved"),
    ],
    rejected: [],
  }), {
    totalProducts: 3,
    dataEntered: 2,
    dataRemaining: 1,
    reviewCompleted: 1,
    reviewRemaining: 2,
  });
});
const {
  addNutritionCandidateReturnTarget,
  parseNutritionCandidateReturnTarget,
} = loadTsModule("app/admin/lib/nutritionCandidateNavigation.ts");

test("candidate review navigation accepts only local product queue anchors", () => {
  assert.equal(parseNutritionCandidateReturnTarget("nutrition-product-32"), "nutrition-product-32");
  assert.equal(parseNutritionCandidateReturnTarget("nutrition-work-item-51"), "nutrition-work-item-51");
  assert.equal(parseNutritionCandidateReturnTarget("nutrition-candidate-review"), "nutrition-candidate-review");
  assert.equal(parseNutritionCandidateReturnTarget("https://attacker.example"), null);
  assert.equal(parseNutritionCandidateReturnTarget("nutrition-product-0"), null);
  assert.equal(
    addNutritionCandidateReturnTarget(new URL("https://example.test/admin?run=NCR1"), "nutrition-product-32").toString(),
    "https://example.test/admin?run=NCR1#nutrition-product-32"
  );
});

test("nutrition candidate runs are grouped with the newest batch first", () => {
  const candidate = (id, run_id, created_at, status) => ({
    id,
    run_id,
    created_at,
    status,
  });
  const groups = groupNutritionCandidatesByRun({
    pending: [
      candidate("1", "NCR1-older", "2026-08-02T10:00:00.000Z", "pending"),
      candidate("2", "NCR1-newer", "2026-08-02T12:00:00.000Z", "pending"),
    ],
    approved: [
      candidate("3", "NCR1-older", "2026-08-02T10:00:00.000Z", "approved"),
    ],
    rejected: [],
  });

  assert.deepEqual(groups.map((group) => group.run_id), ["NCR1-newer", "NCR1-older"]);
  assert.equal(groups[0].total, 1);
  assert.equal(groups[1].total, 2);
  assert.equal(groups[1].report.pending[0].id, "1");
  assert.equal(groups[1].report.approved[0].id, "3");
});

test("candidates are grouped by product and ordered by review dependency", () => {
  const candidate = (id, product_id, product_name, proposed_field, confidence = "LOW", product_variant_id = null) => ({
    id,
    product_id,
    product_variant_id,
    product_name,
    proposed_field,
    confidence,
  });
  const groups = groupNutritionCandidatesByProduct([
    candidate("6", "742", "Applied Creatine", "creatine_per_serving_g"),
    candidate("5", "338", "Applied Clear Whey", "protein_per_serving_g"),
    candidate("3", "742", "Applied Creatine", "serving_count_verified"),
    candidate("2", "742", "Applied Creatine", "serving_size_g"),
    candidate("4", "338", "Applied Clear Whey", "serving_size_g"),
    candidate("8", "748", "Applied Mass", "protein_per_serving_g", "LOW"),
    candidate("7", "748", "Applied Mass", "protein_per_serving_g", "MEDIUM"),
  ]);

  assert.deepEqual(groups.map((group) => group.product_id), ["338", "742", "748"]);
  assert.deepEqual(
    groups[1].candidates.map((item) => item.proposed_field),
    ["serving_size_g", "serving_count_verified", "creatine_per_serving_g"]
  );
  assert.deepEqual(groups[2].candidates.map((item) => item.id), ["7", "8"]);
});

test("variant candidates remain in separate review groups", () => {
  const base = {
    product_id: "38", product_name: "Pump 3G", proposed_field: "serving_size_g", confidence: "LOW",
  };
  const groups = groupNutritionCandidatesByProduct([
    { ...base, id: "1", product_variant_id: "726" },
    { ...base, id: "2", product_variant_id: "727" },
    { ...base, id: "3", product_variant_id: null },
  ]);
  assert.equal(groups.length, 3);
  assert.deepEqual(new Set(groups.map((group) => group.product_variant_id)), new Set(["726", "727", null]));
});

test("candidate review accepts only pending to approved or rejected", () => {
  assert.equal(canReviewNutritionCandidate("pending", "approved"), true);
  assert.equal(canReviewNutritionCandidate("pending", "rejected"), true);
  assert.equal(canReviewNutritionCandidate("approved", "rejected"), false);
  assert.equal(canReviewNutritionCandidate("rejected", "approved"), false);
});

test("candidate review validates IDs, decisions and bounded optional notes", () => {
  const candidateFingerprint = "a".repeat(64);
  assert.deepEqual(parseNutritionCandidateReviewInput({
    id: "42",
    status: "approved",
    approvedValue: "14",
    reviewNote: "  label checked  ",
    candidateFingerprint,
  }), { id: "42", status: "approved", approvedValue: 14, reviewNote: "label checked", candidateFingerprint, informationState: null });
  const values = { candidateFingerprint, approvedValue: "14", reviewNote: null };
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "0", status: "approved" }), null);
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "42", status: "pending" }), null);
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "42", status: "approved", approvedValue: "" }), null);
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "42", status: "approved", approvedValue: "0" }), null);
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "42", status: "approved", reviewNote: "x".repeat(1001) }), null);
  assert.equal(parseNutritionCandidateReviewInput({ ...values, id: "42", status: "approved", candidateFingerprint: "bad" }), null);
  assert.deepEqual(parseNutritionCandidateReviewInput({
    id: "42", status: "rejected", approvedValue: "28", reviewNote: "wrong pack", candidateFingerprint,
  }), { id: "42", status: "rejected", approvedValue: null, reviewNote: "wrong pack", candidateFingerprint, informationState: null });
});

test("structured ingredient review keeps evidence state separate and binds quantified values", () => {
  const candidateFingerprint = "a".repeat(64);
  const absent = parseNutritionCandidateReviewInput({
    id: "42", status: "approved", approvedValue: "", reviewNote: "absence checked",
    candidateFingerprint, informationState: "confirmed_absent",
  });
  assert.equal(absent.informationState, "confirmed_absent");
  assert.equal(absent.approvedValue, null);
  assert.equal(validateNutritionCandidateReviewFact(absent, {
    information_state: "confirmed_absent", proposed_value: null,
  }), true);
  const quantified = parseNutritionCandidateReviewInput({
    id: "43", status: "approved", approvedValue: "200", reviewNote: null,
    candidateFingerprint, informationState: "present_with_amount",
  });
  assert.equal(validateNutritionCandidateReviewFact(quantified, {
    information_state: "present_with_amount", proposed_value: "200",
  }), true);
  assert.equal(validateNutritionCandidateReviewFact({ ...quantified, approvedValue: 201 }, {
    information_state: "present_with_amount", proposed_value: "200",
  }), false);
  assert.equal(parseNutritionCandidateReviewInput({
    id: "44", status: "approved", approvedValue: "0", reviewNote: null,
    candidateFingerprint, informationState: "confirmed_absent",
  }), null);
});

test("NUT-02B compatibility recognizes only its exact missing columns", () => {
  assert.equal(isMissingNutritionPreworkoutFactColumn({
    code: "42703", message: "column nutrition_candidates.information_state does not exist",
  }), true);
  assert.equal(isMissingNutritionPreworkoutFactColumn({
    code: "42703", message: "column nutrition_candidates.unrelated does not exist",
  }), false);
  assert.equal(isMissingNutritionPreworkoutFactColumn({
    code: "42501", message: "column nutrition_candidates.information_state does not exist",
  }), false);
});

test("candidate review update contains review metadata but no product mutation", () => {
  const update = buildNutritionCandidateReviewUpdate(
    { id: "42", status: "approved", approvedValue: 14, reviewNote: null, candidateFingerprint: "a".repeat(64), informationState: null },
    "2026-08-02T12:00:00.000Z"
  );
  assert.deepEqual(update, {
    status: "approved",
    reviewed_at: "2026-08-02T12:00:00.000Z",
    reviewed_by: "admin-panel",
    approved_value: 14,
    review_note: null,
  });
  assert.equal("product_id" in update, false);
  assert.equal("nutrition_verified" in update, false);
});

test("bulk review accepts a bounded unique product selection", () => {
  assert.deepEqual(parseNutritionCandidateBulkReviewInput({
    candidateIds: ["10", "11"], productId: "79", productVariantId: null, runId: "NCR1-safe",
  }), { candidateIds: ["10", "11"], productId: "79", productVariantId: null, runId: "NCR1-safe" });
  assert.deepEqual(parseNutritionCandidateBulkReviewInput({
    candidateIds: ["10"], productId: "79", productVariantId: "726", runId: "NCR1-safe",
  }), { candidateIds: ["10"], productId: "79", productVariantId: "726", runId: "NCR1-safe" });
  assert.equal(parseNutritionCandidateBulkReviewInput({
    candidateIds: ["10", "10"], productId: "79", productVariantId: null, runId: "NCR1-safe",
  }), null);
  assert.equal(parseNutritionCandidateBulkReviewInput({
    candidateIds: Array.from({ length: 51 }, (_, index) => String(index + 1)),
    productId: "79", productVariantId: null, runId: "NCR1-safe",
  }), null);
});

test("bulk review excludes unsafe warnings and invalid serving counts", () => {
  const candidate = (overrides = {}) => ({
    id: "10", product_id: "79", product_variant_id: null, proposed_field: "serving_size_g",
    proposed_value: "31", warning_flags: [], status: "pending", run_id: "NCR1-safe",
    ...overrides,
  });
  assert.equal(isBulkApprovableNutritionCandidate(candidate()), true);
  assert.equal(isBulkApprovableNutritionCandidate(candidate({ warning_flags: ["PACKAGE_SERVING_MISMATCH"] })), false);
  assert.equal(isBulkApprovableNutritionCandidate(candidate({
    proposed_field: "serving_count_verified", proposed_value: "28.5",
  })), false);
});

test("bulk selection is one unchanged product and rejects field conflicts", () => {
  const input = { candidateIds: ["10", "11"], productId: "79", productVariantId: null, runId: "NCR1-safe" };
  const candidate = (id, field, value) => ({
    id, product_id: "79", product_variant_id: null, proposed_field: field, proposed_value: value,
    warning_flags: [], status: "pending", run_id: "NCR1-safe",
  });
  assert.equal(validateNutritionCandidateBulkSelection(input, [
    candidate("10", "serving_size_g", 31), candidate("11", "protein_per_serving_g", 25),
  ]), true);
  assert.equal(validateNutritionCandidateBulkSelection(input, [
    candidate("10", "protein_per_serving_g", 24), candidate("11", "protein_per_serving_g", 25),
  ]), false);
  assert.equal(validateNutritionCandidateBulkSelection(input, [
    candidate("10", "serving_size_g", 31),
  ]), false);
});

test("admin page authenticates before loading the service-role report", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "app/admin/nutrition-candidates/page.tsx"),
    "utf8"
  );
  assert(page.indexOf("await requireAdminPage()") >= 0);
  assert(
    page.indexOf("await requireAdminPage()") <
      page.indexOf('await import(')
  );
  assert.match(page, /Pending candidates/);
  assert.match(page, /Approved candidates/);
  assert.match(page, /Rejected candidates/);
  assert.match(page, /Filter by run ID/);
  assert.match(page, /candidate\.run_id/);
  assert.match(page, /groupNutritionCandidatesByRun/);
  assert.match(page, /groupNutritionCandidatesByProduct/);
  assert.match(page, /Latest batch/);
  assert.match(page, /field === "serving_count_verified" \? "1" : "0\.000001"/);
  assert.match(page, /field === "serving_count_verified" \? "1" : "any"/);
  assert.match(page, /name="returnTo"/);
  assert.match(page, /nutrition-work-item-/);
  assert.match(page, /Skip for now — no data saved/);
  assert.match(page, /nutrition-product-/);
  assert.match(page, /productGroup\.candidates\.every\(isBulkApprovableNutritionCandidate\)/);
  assert.match(page, /Structured ingredient evidence/);
  assert.match(page, /readOnly=\{structured\}/);
  assert.match(page, /Data entered:/);
  assert.match(page, /Review completed:/);
  assert.match(page, /Remaining:/);
  assert.doesNotMatch(page, /error\.message/);
});

test("review route authenticates before parsing or writing and updates candidates only", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/admin/nutrition-candidates/review/route.ts"),
    "utf8"
  );
  const post = route.slice(route.indexOf("export async function POST"));
  const auth = post.indexOf("requireAdminRoute(request)");
  assert(auth >= 0);
  assert(auth < post.indexOf("request.formData()"));
  assert(auth < post.indexOf("supabaseAdmin"));
  assert.match(post, /\.from\("nutrition_candidates"\)/);
  assert.match(post, /\.eq\("status", "pending"\)/);
  assert.match(post, /validateNutritionCandidateReviewFact/);
  assert.match(post, /isMissingNutritionPreworkoutFactColumn/);
  assert.match(post, /formData\.get\("returnTo"\)/);
  assert.doesNotMatch(post, /\.from\("products"\)|nutrition_verified|unit_pricing_verified/);
});

test("bulk review route authenticates, validates, and only updates pending candidates", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/admin/nutrition-candidates/review-bulk/route.ts"),
    "utf8"
  );
  const post = route.slice(route.indexOf("export async function POST"));
  assert(post.indexOf("requireAdminRoute(request)") < post.indexOf("request.formData()"));
  assert.match(post, /validateNutritionCandidateBulkSelection/);
  assert.match(post, /readNutritionCandidatesWithSchemaCompatibility/);
  assert.match(post, /input\.productVariantId === null/);
  assert.match(post, /Variant nutrition review requires the pending provenance migration/);
  assert.match(post, /\.from\("nutrition_candidates"\)/);
  assert.match(post, /\.eq\("status", "pending"\)/);
  assert.match(post, /formData\.get\("returnTo"\)/);
  assert.doesNotMatch(post, /\.from\("products"\)|nutrition_verified|unit_pricing_verified/);
});

test("candidate report is server-only and there is no public candidate API", () => {
  const report = fs.readFileSync(
    path.join(process.cwd(), "app/admin/lib/nutritionCandidates.ts"),
    "utf8"
  );
  assert.match(report, /^import "server-only";/);
  assert.match(report, /supabaseAdmin/);
  assert.match(report, /\.eq\("run_id", runId\)/);
  assert.equal(fs.existsSync(path.join(process.cwd(), "app/api/nutrition-candidates")), false);
});
