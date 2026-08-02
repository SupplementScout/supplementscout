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
  parseNutritionCandidateReviewInput,
} = loadTsModule("app/admin/lib/nutritionCandidateReview.ts");

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
    reviewNote: "  label checked  ",
  }), { id: "42", status: "approved", reviewNote: "label checked" });
  assert.equal(parseNutritionCandidateReviewInput({ id: "0", status: "approved", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "pending", reviewNote: null }), null);
  assert.equal(parseNutritionCandidateReviewInput({ id: "42", status: "approved", reviewNote: "x".repeat(1001) }), null);
});

test("candidate review update contains review metadata but no product mutation", () => {
  const update = buildNutritionCandidateReviewUpdate(
    { id: "42", status: "approved", reviewNote: null },
    "2026-08-02T12:00:00.000Z"
  );
  assert.deepEqual(update, {
    status: "approved",
    reviewed_at: "2026-08-02T12:00:00.000Z",
    reviewed_by: "admin-panel",
    review_note: null,
  });
  assert.equal("product_id" in update, false);
  assert.equal("nutrition_verified" in update, false);
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
