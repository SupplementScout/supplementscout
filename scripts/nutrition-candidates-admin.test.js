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
  validateNutritionCandidateBulkSelection,
} = loadTsModule("app/admin/lib/nutritionCandidateReview.ts");
const {
  groupNutritionCandidatesByProduct,
  groupNutritionCandidatesByRun,
} = loadTsModule(
  "app/admin/lib/nutritionCandidateRuns.ts"
);
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
  const candidate = (id, product_id, product_name, proposed_field, confidence = "LOW") => ({
    id,
    product_id,
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

test("candidate review accepts only pending to approved or rejected", () => {
  assert.equal(canReviewNutritionCandidate("pending", "approved"), true);
  assert.equal(canReviewNutritionCandidate("pending", "rejected"), true);
  assert.equal(canReviewNutritionCandidate("approved", "rejected"), false);
  assert.equal(canReviewNutritionCandidate("rejected", "approved"), false);
});

test("candidate review validates IDs, decisions and bounded optional notes", () => {
  assert.deepEqual(parseNutritionCandidateReviewInput({
    id: "42",
    status: "approved",
    approvedValue: "14",
    reviewNote: "  label checked  ",
  }), { id: "42", status: "approved", approvedValue: 14, reviewNote: "label checked" });
  assert.equal(parseNutritionCandidateReviewInput({ id: "0", status: "approved", approvedValue: "14", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "pending", approvedValue: "14", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "approved", approvedValue: "", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "approved", approvedValue: "0", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "approved", approvedValue: "14", reviewNote: "x".repeat(1001) }), null);
  assert.deepEqual(parseNutritionCandidateReviewInput({
    id: "42", status: "rejected", approvedValue: "28", reviewNote: "wrong pack",
  }), { id: "42", status: "rejected", approvedValue: null, reviewNote: "wrong pack" });
});

test("candidate review update contains review metadata but no product mutation", () => {
  const update = buildNutritionCandidateReviewUpdate(
    { id: "42", status: "approved", approvedValue: 14, reviewNote: null },
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
    candidateIds: ["10", "11"], productId: "79", runId: "NCR1-safe",
  }), { candidateIds: ["10", "11"], productId: "79", runId: "NCR1-safe" });
  assert.equal(parseNutritionCandidateBulkReviewInput({
    candidateIds: ["10", "10"], productId: "79", runId: "NCR1-safe",
  }), null);
  assert.equal(parseNutritionCandidateBulkReviewInput({
    candidateIds: Array.from({ length: 51 }, (_, index) => String(index + 1)),
    productId: "79", runId: "NCR1-safe",
  }), null);
});

test("bulk review excludes unsafe warnings and invalid serving counts", () => {
  const candidate = (overrides = {}) => ({
    id: "10", product_id: "79", proposed_field: "serving_size_g",
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
  const input = { candidateIds: ["10", "11"], productId: "79", runId: "NCR1-safe" };
  const candidate = (id, field, value) => ({
    id, product_id: "79", proposed_field: field, proposed_value: value,
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
  assert.match(page, /nutrition-product-/);
  assert.match(page, /productGroup\.candidates\.every\(isBulkApprovableNutritionCandidate\)/);
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
