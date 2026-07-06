const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

const originalModuleLoad = Module._load;
const originalTsLoader = require.extensions[".ts"];

require.extensions[".ts"] = function loadTypeScriptModule(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  mod._compile(outputText, filename);
};

Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }

  if (request.endsWith("/supabaseAdmin") || request.endsWith("\\supabaseAdmin")) {
    return {
      supabaseAdmin: {
        from() {
          throw new Error("Supabase should be mocked in report unit tests.");
        },
      },
    };
  }

  return originalModuleLoad.call(this, request, parent, isMain);
};

test.after(() => {
  Module._load = originalModuleLoad;

  if (originalTsLoader) {
    require.extensions[".ts"] = originalTsLoader;
  } else {
    delete require.extensions[".ts"];
  }
});

const reportModule = require(path.join(
  process.cwd(),
  "app",
  "admin",
  "lib",
  "outboundClicksReport.ts"
));

const {
  getOutboundClicksReport,
  normalizeOutboundClickReportPeriod,
} = reportModule;

const now = new Date("2026-07-06T12:00:00.000Z");
const bigintProductId = "90071992547409931234";
const bigintRetailerId = "80000000000000000001";

function syntheticClick(index, overrides = {}) {
  return {
    id: String(index + 1),
    created_at: new Date(Date.UTC(2026, 6, 1, 0, 0, index)).toISOString(),
    offer_id: String(10000000000000000000n + BigInt(index)),
    product_id: String((index % 3) + 1),
    retailer_id: String((index % 4) + 1),
    destination_url: `https://retailer.test/deal-${index}`,
    source_page: index % 2 === 0 ? "product_best_offer" : "product_offer_list",
    ...overrides,
  };
}

function syntheticRows(count, rowFactory = syntheticClick) {
  return Array.from({ length: count }, (_, index) => rowFactory(index));
}

function createDataSource(overrides = {}) {
  const rows =
    overrides.rows ||
    [
      {
        created_at: "2026-07-06T11:00:00.000Z",
        offer_id: "101",
        product_id: bigintProductId,
        retailer_id: bigintRetailerId,
        destination_url: "https://retailer.test/newest?aff=1",
        source_page: "product_best_offer",
      },
      {
        created_at: "2026-07-05T10:00:00.000Z",
        offer_id: "102",
        product_id: bigintProductId,
        retailer_id: "2",
        destination_url: "https://other.test/deal",
        source_page: "product_offer_list",
      },
      {
        created_at: "2026-07-04T09:00:00.000Z",
        offer_id: null,
        product_id: null,
        retailer_id: null,
        destination_url: "https://deleted.test/deal",
        source_page: "product_offer_list",
      },
    ];
  const recentRows = overrides.recentRows || [...rows].reverse();
  const calls = {
    countSince: [],
    recentSince: [],
    aggregationPages: [],
    productFetchBatches: [],
    retailerFetchBatches: [],
  };

  return {
    calls,
    dataSource: {
      async countClicks(sinceIso) {
        calls.countSince.push(sinceIso);
        const key = sinceIso || "all";

        return {
          "2026-07-06T00:00:00.000Z": 3,
          "2026-06-29T12:00:00.000Z": 7,
          "2026-06-06T12:00:00.000Z": 30,
          all: 300,
        }[key];
      },
      async fetchRecentClicks(sinceIso) {
        calls.recentSince.push(sinceIso);

        return recentRows;
      },
      async fetchClicksForAggregationPage(sinceIso, from, to) {
        calls.aggregationPages.push({ sinceIso, from, to });

        if (overrides.failAggregationFrom === from) {
          throw new Error("raw database failure should not render");
        }

        if (overrides.fullAggregationPages) {
          return syntheticRows(to - from + 1);
        }

        return rows.slice(from, to + 1);
      },
      async fetchProducts(productIds) {
        calls.productFetchBatches.push([...productIds]);

        return [
          { id: bigintProductId, name: "Creatine Alpha" },
          { id: "3", name: "Zinc Beta" },
          { id: "1", name: "Product One" },
          { id: "2", name: "Product Two" },
        ];
      },
      async fetchRetailers(retailerIds) {
        calls.retailerFetchBatches.push([...retailerIds]);

        return [
          { id: bigintRetailerId, name: "Retailer Alpha" },
          { id: "2", name: "Retailer Beta" },
          { id: "1", name: "Retailer One" },
          { id: "3", name: "Retailer Three" },
          { id: "4", name: "Retailer Four" },
        ];
      },
    },
  };
}

test("missing period defaults to 30d", () => {
  assert.equal(normalizeOutboundClickReportPeriod(undefined), "30d");
});

test("invalid period defaults to 30d", () => {
  assert.equal(normalizeOutboundClickReportPeriod("forever"), "30d");
});

test("7d, 30d, and all are accepted", () => {
  assert.equal(normalizeOutboundClickReportPeriod("7d"), "7d");
  assert.equal(normalizeOutboundClickReportPeriod("30d"), "30d");
  assert.equal(normalizeOutboundClickReportPeriod("all"), "all");
});

test("summary counts map correctly", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.deepEqual(report.summary, {
    today: 3,
    last7Days: 7,
    last30Days: 30,
    total: 300,
  });
});

test("selected period boundaries are applied safely", async () => {
  const seven = createDataSource();
  await getOutboundClicksReport({ period: "7d", now, dataSource: seven.dataSource });
  assert.deepEqual(seven.calls.recentSince, ["2026-06-29T12:00:00.000Z"]);
  assert.deepEqual(
    seven.calls.aggregationPages.map((page) => page.sinceIso),
    ["2026-06-29T12:00:00.000Z"]
  );

  const thirty = createDataSource();
  await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource: thirty.dataSource,
  });
  assert.deepEqual(thirty.calls.recentSince, ["2026-06-06T12:00:00.000Z"]);
  assert.deepEqual(
    thirty.calls.aggregationPages.map((page) => page.sinceIso),
    ["2026-06-06T12:00:00.000Z"]
  );

  const all = createDataSource();
  await getOutboundClicksReport({ period: "all", now, dataSource: all.dataSource });
  assert.deepEqual(all.calls.recentSince, [null]);
  assert.deepEqual(all.calls.aggregationPages.map((page) => page.sinceIso), [null]);
});

test("recent clicks sorted newest first", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.deepEqual(
    report.recentClicks.map((click) => click.createdAt),
    [
      "2026-07-06T11:00:00.000Z",
      "2026-07-05T10:00:00.000Z",
      "2026-07-04T09:00:00.000Z",
    ]
  );
});

test("top products aggregated correctly", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.deepEqual(report.topProducts, [
    { id: bigintProductId, name: "Creatine Alpha", clicks: 2 },
    { id: null, name: "Deleted product", clicks: 1 },
  ]);
});

test("top retailers aggregated correctly", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.deepEqual(report.topRetailers, [
    { id: null, name: "Deleted retailer", clicks: 1 },
    { id: bigintRetailerId, name: "Retailer Alpha", clicks: 1 },
    { id: "2", name: "Retailer Beta", clicks: 1 },
  ]);
});

test("source counts aggregated correctly", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.deepEqual(report.sourceCounts, {
    product_best_offer: 1,
    product_offer_list: 2,
  });
});

test("deleted/null product and retailer fallbacks render safely", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });
  const deletedClick = report.recentClicks.find((click) => click.offerId === null);

  assert.equal(deletedClick.productName, "Deleted product");
  assert.equal(deletedClick.retailerName, "Deleted retailer");
});

test("bigint IDs remain strings", async () => {
  const { dataSource, calls } = createDataSource();
  const report = await getOutboundClicksReport({
    period: "30d",
    now,
    dataSource,
  });

  assert.equal(typeof calls.productFetchBatches[0][0], "string");
  assert.equal(typeof calls.retailerFetchBatches[0][0], "string");
  assert.equal(report.recentClicks[0].productId, bigintProductId);
  assert.equal(report.recentClicks[0].retailerId, bigintRetailerId);
});

test("pagination fetches more than 1000 rows across page boundaries", async () => {
  const rows = syntheticRows(1001);
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  await getOutboundClicksReport({ period: "30d", now, dataSource });

  assert.deepEqual(calls.aggregationPages, [
    { sinceIso: "2026-06-06T12:00:00.000Z", from: 0, to: 999 },
    { sinceIso: "2026-06-06T12:00:00.000Z", from: 1000, to: 1999 },
  ]);
});

test("2500 synthetic click rows aggregate exactly across pages", async () => {
  const rows = syntheticRows(2500, (index) =>
    syntheticClick(index, {
      product_id: index < 1200 ? "1" : index < 2000 ? "2" : "3",
      retailer_id: index < 1100 ? "1" : index < 1900 ? "2" : "3",
      source_page: index < 1300 ? "product_best_offer" : "product_offer_list",
    })
  );
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  const report = await getOutboundClicksReport({ period: "all", now, dataSource });

  assert.deepEqual(
    calls.aggregationPages.map(({ from, to }) => ({ from, to })),
    [
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
    ]
  );
  assert.deepEqual(report.topProducts.slice(0, 3), [
    { id: "1", name: "Product One", clicks: 1200 },
    { id: "2", name: "Product Two", clicks: 800 },
    { id: "3", name: "Zinc Beta", clicks: 500 },
  ]);
  assert.deepEqual(report.topRetailers.slice(0, 3), [
    { id: "1", name: "Retailer One", clicks: 1100 },
    { id: "2", name: "Retailer Beta", clicks: 800 },
    { id: "3", name: "Retailer Three", clicks: 600 },
  ]);
  assert.deepEqual(report.sourceCounts, {
    product_best_offer: 1300,
    product_offer_list: 1200,
  });
});

test("zero source count still returns both allowed source values", async () => {
  const rows = syntheticRows(3, (index) =>
    syntheticClick(index, { source_page: "product_best_offer" })
  );
  const { dataSource } = createDataSource({ rows, recentRows: [] });
  const report = await getOutboundClicksReport({ period: "30d", now, dataSource });

  assert.deepEqual(report.sourceCounts, {
    product_best_offer: 3,
    product_offer_list: 0,
  });
});

test("null offer ID is available for safe Deleted offer rendering", async () => {
  const { dataSource } = createDataSource();
  const report = await getOutboundClicksReport({ period: "30d", now, dataSource });
  const deletedClick = report.recentClicks.find((click) => click.offerId === null);
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "outbound-clicks", "page.tsx"),
    "utf8"
  );

  assert(deletedClick);
  assert.equal(pageSource.includes('click.offerId || "Deleted offer"'), true);
});

test("aggregation fetch failure on a later page returns a generic error", async () => {
  const rows = syntheticRows(1500);
  const { dataSource } = createDataSource({
    rows,
    recentRows: [],
    failAggregationFrom: 1000,
  });
  const originalError = console.error;

  console.error = () => {};
  try {
    await assert.rejects(
      () => getOutboundClicksReport({ period: "30d", now, dataSource }),
      (error) =>
        error.message === "Unable to load outbound click report." &&
        !error.message.includes("raw database failure")
    );
  } finally {
    console.error = originalError;
  }
});

test("aggregation maximum-row guard fails safely instead of silently truncating", async () => {
  const { dataSource, calls } = createDataSource({
    recentRows: [],
    fullAggregationPages: true,
  });
  const originalError = console.error;

  console.error = () => {};
  try {
    await assert.rejects(
      () => getOutboundClicksReport({ period: "all", now, dataSource }),
      /Unable to load outbound click report\./
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(calls.aggregationPages.at(-1).from, 100000);
});

test("bigint IDs remain strings across pagination", async () => {
  const hugeProductId = "90071992547409939999";
  const hugeRetailerId = "80000000000000008888";
  const rows = syntheticRows(1001, (index) =>
    syntheticClick(index, {
      product_id: hugeProductId,
      retailer_id: hugeRetailerId,
    })
  );
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  const report = await getOutboundClicksReport({ period: "all", now, dataSource });

  assert.equal(typeof calls.productFetchBatches[0][0], "string");
  assert.equal(typeof calls.retailerFetchBatches[0][0], "string");
  assert.equal(report.topProducts[0].id, hugeProductId);
  assert.equal(report.topRetailers[0].id, hugeRetailerId);
});

test("hydration is skipped when no product or retailer IDs are present", async () => {
  const rows = syntheticRows(2, (index) =>
    syntheticClick(index, { product_id: null, retailer_id: null })
  );
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  await getOutboundClicksReport({ period: "30d", now, dataSource });

  assert.deepEqual(calls.productFetchBatches, []);
  assert.deepEqual(calls.retailerFetchBatches, []);
});

test("hydration stays batched for unique product and retailer IDs", async () => {
  const rows = syntheticRows(5);
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  await getOutboundClicksReport({ period: "30d", now, dataSource });

  assert.equal(calls.productFetchBatches.length, 1);
  assert.equal(calls.retailerFetchBatches.length, 1);
  assert.deepEqual(calls.productFetchBatches[0], ["1", "2", "3"]);
  assert.deepEqual(calls.retailerFetchBatches[0], ["1", "2", "3", "4"]);
});

test("selected-period filter is applied consistently to every aggregation page", async () => {
  const rows = syntheticRows(2500);
  const { dataSource, calls } = createDataSource({ rows, recentRows: [] });
  await getOutboundClicksReport({ period: "7d", now, dataSource });

  assert.deepEqual(
    calls.aggregationPages.map((page) => page.sinceIso),
    [
      "2026-06-29T12:00:00.000Z",
      "2026-06-29T12:00:00.000Z",
      "2026-06-29T12:00:00.000Z",
    ]
  );
});

test("unauthenticated access is blocked before Supabase query", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "outbound-clicks", "page.tsx"),
    "utf8"
  );
  const authIndex = pageSource.indexOf("await requireAdminPage()");
  const importIndex = pageSource.indexOf('await import("../lib/outboundClicksReport")');
  const loadIndex = pageSource.indexOf("loadOutboundClicksReport({ period })");

  assert(authIndex >= 0);
  assert(importIndex > authIndex);
  assert(loadIndex > authIndex);
  assert.equal(pageSource.includes("searchParams.token"), false);
  assert.equal(pageSource.includes("adminToken"), false);
});

test("raw database errors are not rendered", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "outbound-clicks", "page.tsx"),
    "utf8"
  );

  assert.equal(pageSource.includes("error.message"), false);
  assert.equal(pageSource.includes("{error}"), false);
  assert(pageSource.includes("Unable to load outbound click report."));
});

test("external destination links use noopener noreferrer", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "outbound-clicks", "page.tsx"),
    "utf8"
  );

  assert(pageSource.includes('target="_blank"'));
  assert(pageSource.includes('rel="noopener noreferrer"'));
});
