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

const baseRequestParams = { q: "magnesum" };

function recordingSupabase(inserts) {
  return {
    from(table) {
      assert.equal(table, "search_events");

      return {
        async insert(payload) {
          inserts.push(payload);

          return { error: null };
        },
      };
    },
  };
}

test("only a base search request is eligible for analytics", () => {
  const { shouldLogSearchResultsEvent } = loadSearchAnalyticsModule({});

  assert.equal(shouldLogSearchResultsEvent({ q: "creatine" }), true);
  assert.equal(
    shouldLogSearchResultsEvent({
      q: "creatine",
      sort: "",
      category: " ",
      brand: "",
      retailer: "",
      page: "",
    }),
    true
  );

  for (const params of [
    { q: "creatine", sort: "price_asc" },
    { q: "creatine", category: "Creatine" },
    { q: "creatine", brand: "Example Brand" },
    { q: "creatine", retailer: "example-retailer" },
    { q: "creatine", page: "2" },
    { q: "creatine", sort: "price_asc", category: "Creatine", page: "2" },
    { q: "" },
    { q: "   " },
    {},
  ]) {
    assert.equal(shouldLogSearchResultsEvent(params), false);
  }
});

test("interaction requests skip inserts", async () => {
  const inserts = [];
  const { logSearchResultsEvent } = loadSearchAnalyticsModule(
    recordingSupabase(inserts)
  );

  for (const requestParams of [
    { q: "creatine", sort: "price_per_serving_asc" },
    { q: "creatine", category: "Creatine" },
    { q: "creatine", brand: "Example Brand" },
    { q: "creatine", retailer: "example-retailer" },
    { q: "creatine", page: "2" },
    { q: "creatine", sort: "price_asc", brand: "Example Brand", page: "2" },
  ]) {
    const result = await logSearchResultsEvent({
      query: "creatine",
      metadata: { ...metadata, correctedQuery: null, matchStatus: "exact" },
      resultCount: 10,
      requestParams,
    });

    assert.deepEqual(result, { logged: false, skipped: true, error: null });
  }

  assert.deepEqual(inserts, []);
});

test("search page passes the unfiltered result count to analytics", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "search", "page.tsx"),
    "utf8"
  );

  assert.match(
    pageSource,
    /logSearchResultsEvent\(\{[\s\S]*?resultCount: unfilteredCount,[\s\S]*?requestParams: params/
  );
});

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
  const { logSearchResultsEvent } = loadSearchAnalyticsModule(
    recordingSupabase(inserts)
  );

  const result = await logSearchResultsEvent({
    query: "  magnesum  ",
    metadata,
    resultCount: 5,
    requestParams: baseRequestParams,
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

test("goal and zero-result base searches preserve their metadata", async () => {
  const inserts = [];
  const { logSearchResultsEvent } = loadSearchAnalyticsModule(
    recordingSupabase(inserts)
  );
  const goalMetadata = {
    ...metadata,
    originalQuery: "strength",
    appliedQuery: "creatine, pre workout",
    correctedQuery: null,
    queryVariants: ["strength", "creatine", "pre workout"],
    matchStatus: "exact",
    searchMode: "goal_mapped_ilike",
  };
  const zeroMetadata = {
    ...metadata,
    originalQuery: "xyzrandom",
    appliedQuery: "xyzrandom",
    correctedQuery: null,
    queryVariants: ["xyzrandom"],
    matchStatus: "none",
  };

  await logSearchResultsEvent({
    query: "strength",
    metadata: goalMetadata,
    resultCount: 12,
    requestParams: { q: "strength" },
  });
  await logSearchResultsEvent({
    query: "xyzrandom",
    metadata: zeroMetadata,
    resultCount: 0,
    requestParams: { q: "xyzrandom" },
  });

  assert.deepEqual(
    inserts.map(({ query, applied_query, corrected_query, result_count, match_status, search_mode }) => ({
      query,
      applied_query,
      corrected_query,
      result_count,
      match_status,
      search_mode,
    })),
    [
      {
        query: "strength",
        applied_query: "creatine, pre workout",
        corrected_query: null,
        result_count: 12,
        match_status: "exact",
        search_mode: "goal_mapped_ilike",
      },
      {
        query: "xyzrandom",
        applied_query: "xyzrandom",
        corrected_query: null,
        result_count: 0,
        match_status: "none",
        search_mode: "standard_ilike",
      },
    ]
  );
});

test("an empty query request skips inserts", async () => {
  const inserts = [];
  const { logSearchResultsEvent } = loadSearchAnalyticsModule(
    recordingSupabase(inserts)
  );

  const result = await logSearchResultsEvent({
    query: "",
    metadata,
    resultCount: 0,
    requestParams: { q: "" },
  });

  assert.deepEqual(result, { logged: false, skipped: true, error: null });
  assert.deepEqual(inserts, []);
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
    requestParams: { q: "person@example.com" },
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
    requestParams: { q: "magnesium" },
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
    requestParams: { q: "magnesium" },
  });

  assert.equal(result.logged, false);
  assert.equal(result.skipped, false);
  assert.equal(result.error, insertError);
});
