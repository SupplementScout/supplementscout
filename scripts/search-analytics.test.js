const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadSearchAnalyticsModule(mockSupabaseAdmin) {
  const filename = path.join(process.cwd(), "app", "lib", "searchAnalytics.ts");
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

    if (parent === mod && request === "./supabaseAdmin") {
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

const metadata = {
  originalQuery: "magnesum",
  appliedQuery: "magnesium",
  correctedQuery: "magnesium",
  queryVariants: ["magnesum", "magnesium"],
  matchStatus: "corrected",
  searchMode: "standard_ilike",
};

test("sanitizeSearchQueryForAnalytics normalizes and caps safe queries", () => {
  const { sanitizeSearchQueryForAnalytics } = loadSearchAnalyticsModule({});
  const longQuery = `  ${"creatine ".repeat(40)}  `;

  assert.equal(
    sanitizeSearchQueryForAnalytics("  whey   protien  "),
    "whey protien"
  );
  assert.equal(sanitizeSearchQueryForAnalytics(longQuery)?.length, 200);
});

test("sanitizeSearchQueryForAnalytics drops private-looking queries", () => {
  const { sanitizeSearchQueryForAnalytics } = loadSearchAnalyticsModule({});

  assert.equal(sanitizeSearchQueryForAnalytics("person@example.com"), null);
  assert.equal(sanitizeSearchQueryForAnalytics("+44 7700 900123"), null);
  assert.equal(sanitizeSearchQueryForAnalytics("call 07700 900123"), null);
  assert.equal(sanitizeSearchQueryForAnalytics("1234567890123456"), null);
  assert.equal(sanitizeSearchQueryForAnalytics("   "), null);
});

test("logSearchResultsEvent inserts privacy-safe search result payload", async () => {
  const inserts = [];
  const { logSearchResultsEvent } = loadSearchAnalyticsModule({
    from(table) {
      assert.equal(table, "search_events");

      return {
        async insert(payload) {
          inserts.push(payload);

          return { error: null };
        },
      };
    },
  });

  const result = await logSearchResultsEvent({
    query: "  magnesum  ",
    metadata,
    resultCount: 5,
  });

  assert.deepEqual(result, { logged: true, skipped: false, error: null });
  assert.deepEqual(inserts, [
    {
      event_type: "search_results",
      source_page: "search_page",
      query: "magnesum",
      applied_query: "magnesium",
      corrected_query: "magnesium",
      result_count: 5,
      match_status: "corrected",
      search_mode: "standard_ilike",
    },
  ]);
});

test("logSearchResultsEvent skips unsafe queries before insert", async () => {
  let insertCalled = false;
  const { logSearchResultsEvent } = loadSearchAnalyticsModule({
    from() {
      return {
        async insert() {
          insertCalled = true;

          return { error: null };
        },
      };
    },
  });

  const result = await logSearchResultsEvent({
    query: "person@example.com",
    metadata,
    resultCount: 0,
  });

  assert.deepEqual(result, { logged: false, skipped: true, error: null });
  assert.equal(insertCalled, false);
});

test("logSearchResultsEvent fails silently on insert errors", async () => {
  const insertError = new Error("database unavailable");
  const { logSearchResultsEvent } = loadSearchAnalyticsModule({
    from() {
      return {
        async insert() {
          return { error: insertError };
        },
      };
    },
  });

  const result = await logSearchResultsEvent({
    query: "magnesium",
    metadata: { ...metadata, correctedQuery: null, matchStatus: "exact" },
    resultCount: 2,
  });

  assert.equal(result.logged, false);
  assert.equal(result.skipped, false);
  assert.equal(result.error, insertError);
});

test("logSearchResultsEvent fails silently on thrown insert errors", async () => {
  const insertError = new Error("network unavailable");
  const { logSearchResultsEvent } = loadSearchAnalyticsModule({
    from() {
      return {
        async insert() {
          throw insertError;
        },
      };
    },
  });

  const result = await logSearchResultsEvent({
    query: "magnesium",
    metadata,
    resultCount: 1,
  });

  assert.equal(result.logged, false);
  assert.equal(result.skipped, false);
  assert.equal(result.error, insertError);
});
