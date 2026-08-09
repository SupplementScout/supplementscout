const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { buildBatchItemRows, storeBatchItemRows } = require("./lib/nutrition-batch-items");

function loadTsModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
}

const {
  buildManualCandidateRows,
  parseManualNutritionCandidateInput,
  validateManualValuesAgainstWorkItem,
} = loadTsModule("app/admin/lib/nutritionCandidateManual.ts");

function page(overrides = {}) {
  return {
    source_record_id: "protein-1",
    product_id: "79",
    product_name: "Rule1 Protein",
    brand: "Rule1",
    manufacturer: "Rule One Proteins",
    source_page_url: "https://www.ruleoneproteins.com/products/r1-protein",
    expected_domain: "ruleoneproteins.com",
    official_domains: ["ruleoneproteins.com"],
    missing_fields: ["serving_count_verified", "serving_size_g", "protein_per_serving_g"],
    current_values: { net_weight_g: 868 },
    notes: "Owner controls the exact pack.",
    ...overrides,
  };
}

test("batch items preserve all manifest products including failed official pages", () => {
  const input = { pages: [page(), page({ source_record_id: "protein-2", product_id: "80" })] };
  const report = { pages: [
    { source_record_id: "protein-1", error: null },
    { source_record_id: "protein-2", error: "HTTP 404" },
  ] };
  const source = { records: [{
    source_record_id: "protein-1",
    source_url: "https://www.ruleoneproteins.com/products/r1-protein",
    snapshot_sha256: "a".repeat(64),
    source_snapshot_ref: "tmp/nutrition/pages/1.html",
  }] };
  const rows = buildBatchItemRows(input, report, source, "NCR1-batch");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].page_status, "FETCHED");
  assert.equal(rows[1].page_status, "FAILED");
  assert.equal(rows[1].page_error, "HTTP 404");
  assert.deepEqual(rows[0].missing_fields, page().missing_fields);
  assert.match(rows[0].source_context_sha256, /^[0-9a-f]{64}$/);
});

test("batch item backfill accepts the persisted candidate report products key", () => {
  const input = { pages: [page()] };
  const report = { products: [{ source_record_id: "protein-1", error: "HTTP 404" }] };
  const rows = buildBatchItemRows(input, report, null, "NCR1-backfill");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].page_status, "FAILED");
  assert.equal(rows[0].page_error, "HTTP 404");
});

test("batch item storage targets only the private work-item table", async () => {
  const calls = [];
  await storeBatchItemRows([{ run_id: "NCR1-batch", product_id: "79" }], {
    supabase: { from(table) { calls.push(table); return { async upsert(rows) { calls.push(rows); return { error: null }; } }; } },
  });
  assert.deepEqual(calls, ["nutrition_candidate_batch_items", [{ run_id: "NCR1-batch", product_id: "79" }]]);
});

test("manual admin values parse only positive allowed nutrition numbers", () => {
  const form = new FormData();
  form.set("workItemId", "10");
  form.set("runId", "NCR1-batch");
  form.set("value_serving_count_verified", "28");
  form.set("value_serving_size_g", "31");
  form.set("sourceNote", "checked official label");
  assert.deepEqual(parseManualNutritionCandidateInput(form), {
    workItemId: "10",
    runId: "NCR1-batch",
    values: { serving_count_verified: 28, serving_size_g: 31 },
    note: "checked official label",
  });
  form.set("value_serving_count_verified", "28.5");
  assert.equal(parseManualNutritionCandidateInput(form), null);
});

function workItem(overrides = {}) {
  return {
    id: "10",
    run_id: "NCR1-batch",
    product_id: "79",
    product_name: "Rule1 Protein",
    brand: "Rule1",
    source_url: "https://www.ruleoneproteins.com/products/r1-protein",
    source_domain: "ruleoneproteins.com",
    official_domains: ["ruleoneproteins.com"],
    missing_fields: ["serving_count_verified", "serving_size_g", "protein_per_serving_g"],
    current_values: { net_weight_g: 868 },
    page_status: "FAILED",
    source_file_sha256: null,
    source_snapshot_ref: null,
    source_context_sha256: "b".repeat(64),
    ...overrides,
  };
}

test("manual candidates stay pending, low confidence and owner-review flagged", () => {
  const input = {
    workItemId: "10", runId: "NCR1-batch",
    values: { serving_count_verified: 28, serving_size_g: 31, protein_per_serving_g: 25 },
    note: "label checked",
  };
  assert.equal(validateManualValuesAgainstWorkItem(input, workItem()), true);
  const rows = buildManualCandidateRows(input, workItem());
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.status === "pending" && row.approved_value === null));
  assert.ok(rows.every((row) => row.confidence === "LOW"));
  assert.ok(rows.every((row) => row.source_type === "owner_transcribed_official_page"));
  assert.ok(rows.every((row) => row.warning_flags.includes("OWNER_TRANSCRIBED_OFFICIAL_PAGE_REQUIRES_REVIEW")));
  assert.ok(rows.every((row) => !Object.hasOwn(row, "nutrition_verified")));
});

test("manual candidate validation accepts numeric database work-item IDs", () => {
  const input = {
    workItemId: "2", runId: "NCR1-batch",
    values: { net_weight_g: 2300, serving_count_verified: 66, serving_size_g: 34, protein_per_serving_g: 24 },
    note: null,
  };
  assert.equal(validateManualValuesAgainstWorkItem(input, workItem({
    id: 2,
    missing_fields: ["net_weight_g", "serving_count_verified", "serving_size_g", "protein_per_serving_g"],
    current_values: {
      net_weight_g: null,
      serving_count_verified: null,
      serving_size_g: null,
      protein_per_serving_g: null,
    },
  })), true);
});

test("manual candidate safety rejects package arithmetic and non-missing fields", () => {
  assert.equal(validateManualValuesAgainstWorkItem({
    workItemId: "10", runId: "NCR1-batch", values: { serving_count_verified: 29, serving_size_g: 31 }, note: null,
  }, workItem()), false);
  assert.equal(validateManualValuesAgainstWorkItem({
    workItemId: "10", runId: "NCR1-batch", values: { net_weight_g: 868 }, note: null,
  }, workItem()), false);
});

test("migration and route keep work items private and products untouched", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260809130000_add_nutrition_candidate_batch_items.sql"), "utf8");
  assert.match(migration, /create table public\.nutrition_candidate_batch_items/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert on table public\.nutrition_candidate_batch_items to service_role/);
  assert.doesNotMatch(migration, /grant .*nutrition_candidate_batch_items.*(?:anon|authenticated)/i);
  const route = fs.readFileSync(path.join(process.cwd(), "app/admin/nutrition-candidates/manual/route.ts"), "utf8");
  const post = route.slice(route.indexOf("export async function POST"));
  assert.ok(post.indexOf("requireAdminRoute(request)") < post.indexOf("request.formData()"));
  assert.match(post, /\.from\("nutrition_candidate_batch_items"\)/);
  assert.match(post, /\.from\("nutrition_candidates"\)/);
  assert.doesNotMatch(post, /\.from\("products"\)|\.from\("variants"\)|\.from\("offers"\)/);
});
