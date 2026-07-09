const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadSearchAnalyticsReportModule(mockSupabaseAdmin = {}) {
  const filename = path.join(
    process.cwd(),
    "app",
    "admin",
    "lib",
    "searchAnalyticsReport.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && request === "server-only") {
      return {};
    }

    if (parent === mod && request === "../../lib/supabaseAdmin") {
      return { supabaseAdmin: mockSupabaseAdmin };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

function row(overrides) {
  return {
    id: "1",
    created_at: "2026-07-09T10:00:00.000Z",
    query: "magnesium",
    applied_query: "magnesium",
    corrected_query: null,
    result_count: 5,
    match_status: "exact",
    search_mode: "standard_ilike",
    ...overrides,
  };
}

test("aggregateZeroResultSearches groups none matches and keeps last searched", () => {
  const { aggregateZeroResultSearches } = loadSearchAnalyticsReportModule();
  const result = aggregateZeroResultSearches([
    row({
      query: "xyzrandom",
      result_count: 0,
      match_status: "none",
      created_at: "2026-07-09T10:00:00.000Z",
    }),
    row({
      query: "xyzrandom",
      result_count: 0,
      match_status: "none",
      created_at: "2026-07-09T11:00:00.000Z",
    }),
    row({
      query: "magnesium",
      result_count: 5,
      match_status: "exact",
      created_at: "2026-07-09T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(result, [
    {
      query: "xyzrandom",
      searches: 2,
      lastSearchedAt: "2026-07-09T11:00:00.000Z",
    },
  ]);
});

test("aggregateCorrectedSearches groups query and corrected query pairs", () => {
  const { aggregateCorrectedSearches } = loadSearchAnalyticsReportModule();
  const result = aggregateCorrectedSearches([
    row({
      query: "magnesum",
      applied_query: "magnesium",
      corrected_query: "magnesium",
      match_status: "corrected",
      created_at: "2026-07-09T10:00:00.000Z",
    }),
    row({
      query: "magnesum",
      applied_query: "magnesium",
      corrected_query: "magnesium",
      match_status: "corrected",
      created_at: "2026-07-09T12:00:00.000Z",
    }),
    row({
      query: "whey protien",
      applied_query: "whey protein",
      corrected_query: "whey protein",
      match_status: "corrected",
      created_at: "2026-07-09T11:00:00.000Z",
    }),
  ]);

  assert.deepEqual(result, [
    {
      query: "magnesum",
      correctedQuery: "magnesium",
      searches: 2,
      lastSearchedAt: "2026-07-09T12:00:00.000Z",
    },
    {
      query: "whey protien",
      correctedQuery: "whey protein",
      searches: 1,
      lastSearchedAt: "2026-07-09T11:00:00.000Z",
    },
  ]);
});

test("aggregateTopSearches groups queries and averages result count", () => {
  const { aggregateTopSearches } = loadSearchAnalyticsReportModule();
  const result = aggregateTopSearches([
    row({
      query: "vitamin d",
      result_count: 10,
      created_at: "2026-07-09T10:00:00.000Z",
    }),
    row({
      query: "vitamin d",
      result_count: 20,
      created_at: "2026-07-09T12:00:00.000Z",
    }),
    row({
      query: "magnesium",
      result_count: 6,
      created_at: "2026-07-09T11:00:00.000Z",
    }),
  ]);

  assert.deepEqual(result, [
    {
      query: "vitamin d",
      searches: 2,
      averageResultCount: 15,
      lastSearchedAt: "2026-07-09T12:00:00.000Z",
    },
    {
      query: "magnesium",
      searches: 1,
      averageResultCount: 6,
      lastSearchedAt: "2026-07-09T11:00:00.000Z",
    },
  ]);
});

test("search analytics aggregation limits sections to 50 items", () => {
  const {
    aggregateCorrectedSearches,
    aggregateTopSearches,
    aggregateZeroResultSearches,
  } = loadSearchAnalyticsReportModule();
  const zeroResultRows = Array.from({ length: 60 }, (_, index) =>
    row({
      id: String(index),
      query: `query-${index}`,
      match_status: "none",
      result_count: 0,
      created_at: new Date(Date.UTC(2026, 6, 9, 0, index)).toISOString(),
    })
  );
  const correctedRows = Array.from({ length: 60 }, (_, index) =>
    row({
      id: String(index),
      query: `query-${index}`,
      applied_query: `corrected-${index}`,
      corrected_query: `corrected-${index}`,
      match_status: "corrected",
      result_count: index,
      created_at: new Date(Date.UTC(2026, 6, 9, 1, index)).toISOString(),
    })
  );
  const rows = [...zeroResultRows, ...correctedRows];

  assert.equal(aggregateZeroResultSearches(rows).length, 50);
  assert.equal(aggregateCorrectedSearches(rows).length, 50);
  assert.equal(aggregateTopSearches(rows).length, 50);
});

test("getSearchAnalyticsReport combines recent rows and aggregate sections", async () => {
  const { getSearchAnalyticsReport } = loadSearchAnalyticsReportModule();
  const report = await getSearchAnalyticsReport({
    dataSource: {
      async fetchRecentSearchRows() {
        return [
          row({
            id: 99,
            query: "magnesum",
            applied_query: "magnesium",
            corrected_query: "magnesium",
            match_status: "corrected",
          }),
        ];
      },
      async fetchSearchRowsForAggregation() {
        return [
          row({
            query: "xyzrandom",
            match_status: "none",
            result_count: 0,
          }),
          row({
            query: "magnesum",
            applied_query: "magnesium",
            corrected_query: "magnesium",
            match_status: "corrected",
            result_count: 5,
          }),
        ];
      },
    },
  });

  assert.equal(report.recentSearches[0].id, "99");
  assert.equal(report.zeroResultSearches[0].query, "xyzrandom");
  assert.equal(report.correctedSearches[0].correctedQuery, "magnesium");
  assert.equal(report.topSearches.length, 2);
});
