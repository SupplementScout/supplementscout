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
          throw new Error("Supabase should be mocked in catalog health tests.");
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

const {
  CATALOG_HEALTH_ROW_GUARD_MESSAGE,
  getCatalogHealthReport,
  getCatalogHealthLoadErrorMessage,
  normalizeCatalogHealthFilters,
} = require(path.join(process.cwd(), "app", "admin", "lib", "catalogHealth.ts"));
const {
  applyMonitoredBacklog,
  buildEbaySplitRunAttestation,
  correlateEvidence,
  evaluateRetailer,
  findContractEvidence,
  loadConfig: loadWatchdogConfig,
  parseArgs: parseWatchdogArgs,
  summarizeWatchdogResult,
  watchdogExitCode,
  validateEbayApplyArtifacts,
  validateEbayIdempotencyArtifacts,
} = require("./automation-reliability-watchdog");
const {
  PROFILES: postflightProfiles,
  approvedOfferIds,
} = require("./retailer-offer-refresh-postflight");
const { seal: sealEbayRefreshEvidence } = require("./ebay-refresh-evidence-sealer");
const { canonicalHash } = require("./lib/ebay-artifact-bound-contract");

const now = new Date("2026-07-06T12:00:00.000Z");

function product(overrides = {}) {
  return {
    id: "1",
    slug: "product-one",
    name: "Product One",
    gtin: "123",
    brand: "Brand",
    category: "Creatine",
    image: "https://images.test/one.jpg",
    is_active: true,
    merged_into_product_id: null,
    merged_at: null,
    unit_pricing_verified: true,
    nutrition_verified: true,
    ...overrides,
  };
}

function offer(overrides = {}) {
  return {
    id: "101",
    product_id: "1",
    retailer_id: "10",
    price: 10,
    shipping_cost: 2,
    in_stock: true,
    last_checked_at: "2026-07-05T12:00:00.000Z",
    ...overrides,
  };
}

function dataSource({ products, offers, retailers }) {
  const calls = { productPages: [], offerPages: [], retailerFetches: 0 };

  return {
    calls,
    dataSource: {
      async fetchActiveProductsPage(from, to) {
        calls.productPages.push({ from, to });

        return products.slice(from, to + 1);
      },
      async fetchOffersPage(from, to) {
        calls.offerPages.push({ from, to });

        return offers.slice(from, to + 1);
      },
      async fetchRetailers() {
        calls.retailerFetches += 1;

        return retailers;
      },
    },
  };
}

test("invalid catalog health filters fall back safely", () => {
  assert.deepEqual(
    normalizeCatalogHealthFilters({
      issue: "delete-everything",
      retailer: " 3 ",
      category: " Whey   Protein ",
      staleAge: "forever",
      page: "-99",
    }),
    {
      issue: "zero-offers",
      retailer: "3",
      category: "Whey Protein",
      staleAge: "7d",
      page: 1,
    }
  );
});

test("valid catalog health filters are accepted", () => {
  assert.deepEqual(
    normalizeCatalogHealthFilters({
      issue: "stale-offers",
      retailer: "10",
      category: "Creatine",
      staleAge: "30d",
      page: "3",
    }),
    {
      issue: "stale-offers",
      retailer: "10",
      category: "Creatine",
      staleAge: "30d",
      page: 3,
    }
  );
});

test("catalog health summary counts products and offers", async () => {
  const fixture = dataSource({
    products: [
      product({ id: "1", name: "Zero Offer" }),
      product({ id: "2", name: "One Offer", category: "Pre-Workout" }),
      product({ id: "3", name: "Two Offer", gtin: "", image: null }),
      product({
        id: "4",
        name: "Missing Data",
        brand: "",
        category: "",
        unit_pricing_verified: false,
        nutrition_verified: false,
      }),
    ],
    offers: [
      offer({ id: "201", product_id: "2", last_checked_at: null }),
      offer({ id: "301", product_id: "3", retailer_id: "10" }),
      offer({
        id: "302",
        product_id: "3",
        retailer_id: "11",
        last_checked_at: "2026-06-01T12:00:00.000Z",
      }),
      offer({ id: "401", product_id: "4", in_stock: false }),
    ],
    retailers: [
      { id: "10", name: "Retailer One", slug: "retailer-one" },
      { id: "11", name: "Retailer Two", slug: "retailer-two" },
      { id: "12", name: "No Stock Retailer", slug: "no-stock" },
    ],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({}),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.summary.activeUnmergedProducts, 4);
  assert.equal(report.summary.productsWithZeroInStockOffers, 2);
  assert.equal(report.summary.productsWithOneInStockOffer, 1);
  assert.equal(report.summary.productsWithTwoOrMoreInStockOffers, 1);
  assert.equal(report.summary.productsMissingGtin, 1);
  assert.equal(report.summary.productsMissingImage, 1);
  assert.equal(report.summary.productsMissingBrand, 1);
  assert.equal(report.summary.productsMissingCategory, 1);
  assert.equal(report.summary.productsWithPotentiallyStaleOffers, 2);
  assert.equal(report.summary.retailersWithZeroInStockOffers, 1);
  assert.equal(report.summary.staleOffersOlderThan7Days, 1);
  assert.equal(report.summary.staleOffersOlderThan30Days, 1);
  assert.equal(report.summary.staleOffersNeverChecked, 1);
  assert.equal(report.status, "Critical");
  assert.equal(report.categoryQuality.rows.some((row) => row.flagged), true);
  assert.deepEqual(report.retailerReliability, [
    {
      id: "12",
      name: "No Stock Retailer",
      totalOffers: 0,
      staleOffersOlderThan48Hours: 0,
      staleOffersOlderThan7Days: 0,
      staleOffersOlderThan30Days: 0,
      neverCheckedOffers: 0,
      oldestCheck: null,
      newestCheck: null,
      productsWithoutInStockOffer: 0,
    },
    {
      id: "10",
      name: "Retailer One",
      totalOffers: 3,
      staleOffersOlderThan48Hours: 0,
      staleOffersOlderThan7Days: 0,
      staleOffersOlderThan30Days: 0,
      neverCheckedOffers: 1,
      oldestCheck: "2026-07-05T12:00:00.000Z",
      newestCheck: "2026-07-05T12:00:00.000Z",
      productsWithoutInStockOffer: 1,
    },
    {
      id: "11",
      name: "Retailer Two",
      totalOffers: 1,
      staleOffersOlderThan48Hours: 1,
      staleOffersOlderThan7Days: 1,
      staleOffersOlderThan30Days: 1,
      neverCheckedOffers: 0,
      oldestCheck: "2026-06-01T12:00:00.000Z",
      newestCheck: "2026-06-01T12:00:00.000Z",
      productsWithoutInStockOffer: 0,
    },
  ]);
  assert.deepEqual(fixture.calls.productPages, [{ from: 0, to: 999 }]);
  assert.deepEqual(fixture.calls.offerPages, [{ from: 0, to: 999 }]);
  assert.equal(fixture.calls.retailerFetches, 1);
});

test("catalog health retailer reliability uses an exact 48-hour boundary", async () => {
  const fixture = dataSource({
    products: [product({ id: "1" }), product({ id: "2" })],
    offers: [
      offer({
        id: "101",
        product_id: "1",
        last_checked_at: "2026-07-04T12:00:00.000Z",
      }),
      offer({
        id: "102",
        product_id: "2",
        last_checked_at: "2026-07-04T12:00:01.000Z",
      }),
    ],
    retailers: [{ id: "10", name: "Retailer One", slug: "retailer-one" }],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({}),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.retailerReliability[0].totalOffers, 2);
  assert.equal(report.retailerReliability[0].staleOffersOlderThan48Hours, 1);
});

test("catalog health in-stock counts require positive prices", async () => {
  const fixture = dataSource({
    products: [
      product({ id: "1", name: "Valid Plus Zero" }),
      product({ id: "2", name: "Zero Price Only" }),
      product({ id: "3", name: "Negative Price Only" }),
    ],
    offers: [
      offer({ id: "101", product_id: "1", price: 10 }),
      offer({ id: "102", product_id: "1", price: 0 }),
      offer({ id: "201", product_id: "2", price: 0 }),
      offer({ id: "301", product_id: "3", price: -1 }),
    ],
    retailers: [{ id: "10", name: "Retailer One", slug: "retailer-one" }],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({}),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.summary.productsWithZeroInStockOffers, 2);
  assert.equal(report.summary.productsWithOneInStockOffer, 1);
  assert.equal(report.summary.productsWithTwoOrMoreInStockOffers, 0);
  assert.deepEqual(
    report.oneOfferProducts.rows.map((row) => row.name),
    ["Valid Plus Zero"]
  );
});

test("catalog health delivered price requires known valid shipping", async () => {
  const fixture = dataSource({
    products: [
      product({ id: "1", name: "Unknown Shipping" }),
      product({ id: "2", name: "Known Shipping" }),
      product({ id: "3", name: "Invalid Shipping" }),
      product({ id: "4", name: "Free Shipping" }),
    ],
    offers: [
      offer({ id: "101", product_id: "1", price: 10, shipping_cost: null }),
      offer({ id: "201", product_id: "2", price: 10, shipping_cost: 3.5 }),
      offer({ id: "301", product_id: "3", price: 10, shipping_cost: "nope" }),
      offer({ id: "401", product_id: "4", price: 19.99, shipping_cost: 0 }),
    ],
    retailers: [{ id: "10", name: "Retailer One", slug: "retailer-one" }],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({ issue: "one-offer" }),
    now,
    dataSource: fixture.dataSource,
  });
  const rowsByName = new Map(
    report.oneOfferProducts.rows.map((row) => [row.name, row])
  );

  assert.equal(rowsByName.get("Unknown Shipping").totalDeliveredPrice, null);
  assert.equal(rowsByName.get("Known Shipping").totalDeliveredPrice, 13.5);
  assert.equal(rowsByName.get("Invalid Shipping").totalDeliveredPrice, null);
  assert.equal(rowsByName.get("Free Shipping").shipping, 0);
  assert.equal(rowsByName.get("Free Shipping").totalDeliveredPrice, 19.99);
});

test("catalog health invalid retailer and category filters fall back after loading options", async () => {
  const fixture = dataSource({
    products: [product({ id: "1", name: "Visible Product" })],
    offers: [offer({ id: "101", product_id: "1", retailer_id: "10" })],
    retailers: [{ id: "10", name: "Retailer One", slug: "retailer-one" }],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({
      retailer: "missing-retailer",
      category: "Missing Category",
    }),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.filters.retailer, "");
  assert.equal(report.filters.category, "");
  assert.equal(report.oneOfferProducts.totalRows, 1);
});

test("catalog health stale counts keep never-checked separate and include out-of-stock offers", async () => {
  const fixture = dataSource({
    products: [
      product({ id: "1", name: "Eight Days Old" }),
      product({ id: "2", name: "Thirty Five Days Old" }),
      product({ id: "3", name: "Never Checked" }),
      product({ id: "4", name: "Out Of Stock Stale" }),
    ],
    offers: [
      offer({
        id: "101",
        product_id: "1",
        last_checked_at: "2026-06-28T12:00:00.000Z",
      }),
      offer({
        id: "201",
        product_id: "2",
        last_checked_at: "2026-06-01T12:00:00.000Z",
      }),
      offer({ id: "301", product_id: "3", last_checked_at: null }),
      offer({
        id: "401",
        product_id: "4",
        in_stock: false,
        last_checked_at: "2026-06-01T12:00:00.000Z",
      }),
    ],
    retailers: [{ id: "10", name: "Retailer One", slug: "retailer-one" }],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({ issue: "stale-offers" }),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.summary.staleOffersOlderThan7Days, 3);
  assert.equal(report.summary.staleOffersOlderThan30Days, 2);
  assert.equal(report.summary.staleOffersNeverChecked, 1);
  assert(
    report.staleOffers.rows.some(
      (row) => row.product === "Out Of Stock Stale" && row.inStock === false
    )
  );
});

test("catalog health row guard throws instead of returning partial metrics", async () => {
  const oversizedProducts = Array.from({ length: 20001 }, (_, index) =>
    product({ id: String(index + 1), name: `Product ${index + 1}` })
  );
  const fixture = dataSource({
    products: oversizedProducts,
    offers: [],
    retailers: [],
  });

  await assert.rejects(
    () =>
      getCatalogHealthReport({
        filters: normalizeCatalogHealthFilters({}),
        now,
        dataSource: fixture.dataSource,
      }),
    (error) =>
      error instanceof Error &&
      error.message.includes(CATALOG_HEALTH_ROW_GUARD_MESSAGE) &&
      error.message.includes("product")
  );

  assert.equal(fixture.calls.productPages.length, 21);
});

test("catalog health row guard has a visible admin warning and no complete report", () => {
  const message = getCatalogHealthLoadErrorMessage(
    new Error(`${CATALOG_HEALTH_ROW_GUARD_MESSAGE} (product)`)
  );

  assert.match(message, /too large to generate safely/);
  assert.match(message, /database view or RPC/i);
  assert.equal(message.includes("Unable to load catalog health."), false);
});

test("catalog health pagination validates requested page", async () => {
  const products = Array.from({ length: 30 }, (_, index) =>
    product({ id: String(index + 1), name: `Product ${index + 1}` })
  );
  const fixture = dataSource({
    products,
    offers: [],
    retailers: [],
  });
  const report = await getCatalogHealthReport({
    filters: normalizeCatalogHealthFilters({ page: "999" }),
    now,
    dataSource: fixture.dataSource,
  });

  assert.equal(report.zeroOfferProducts.totalRows, 30);
  assert.equal(report.zeroOfferProducts.page, 2);
  assert.equal(report.zeroOfferProducts.totalPages, 2);
  assert.equal(report.zeroOfferProducts.rows.length, 5);
});

test("catalog health page authenticates before loading report", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "catalog-health", "page.tsx"),
    "utf8"
  );
  const authIndex = pageSource.indexOf("await requireAdminPage()");
  const importIndex = pageSource.indexOf('await import("../lib/catalogHealth")');
  const loadIndex = pageSource.indexOf("loadCatalogHealthReport({ filters })");

  assert(authIndex >= 0);
  assert(importIndex > authIndex);
  assert(loadIndex > authIndex);
  assert.equal(pageSource.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(pageSource.includes("supabaseAdmin"), false);
});

test("catalog health renders per-retailer DB freshness without inventing workflow state", () => {
  const componentsSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "catalog-health", "components.tsx"),
    "utf8"
  );

  assert.match(componentsSource, /Retailer database freshness/);
  assert.match(componentsSource, /Older than 48h/);
  assert.match(componentsSource, /Products without this retailer in stock/);
  assert.match(componentsSource, /monitored separately by the/);
  assert.match(componentsSource, /Automation Reliability Watchdog/);
});

test("catalog health joins the shared review queue without inferring workflow or cron state", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "app", "admin", "catalog-health", "page.tsx"), "utf8");
  const loader = fs.readFileSync(path.join(process.cwd(), "app", "admin", "lib", "automationReviewHealth.ts"), "utf8");
  const components = fs.readFileSync(path.join(process.cwd(), "app", "admin", "catalog-health", "components.tsx"), "utf8");
  assert.match(page, /loadAutomationReviewCounts/);
  assert.match(loader, /product_match_review_queue/);
  assert.match(loader, /review_kind,review_status/);
  assert.match(components, /Pending review/);
  assert.match(components, /Source unavailable/);
  assert.match(components, /\/admin\/automation-review\?status=PENDING/);
  assert.match(components, /are not inferred from timestamps/);
});

test("automation watchdog covers all retailers on a read-only six-hour schedule", () => {
  const config = loadWatchdogConfig();
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github/workflows/automation-reliability-watchdog.yml"),
    "utf8"
  );
  assert.equal(config.retailers.length, 11);
  assert.equal(config.maximum_success_age_hours, 48);
  assert.match(workflow, /cron: "11 \*\/6 \* \* \*"/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /JONS_SYNC_VALIDATOR_DATABASE_URL/);
  assert.doesNotMatch(
    workflow,
    /APPROVER_DATABASE_URL|EXECUTOR_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/
  );
  assert.throws(
    () => parseWatchdogArgs(["--output=docs/watchdog.json"]),
    /inside repository tmp/
  );
});

test("automation watchdog requires fresh capture, apply, DB postflight and exact execution counts", () => {
  const completed = "2026-08-30T03:00:00.000Z";
  const input = {
    profile: { id: 3, name: "Whey Okay", workflow: "whey.yml" },
    stages: {
      capture: { completed_at: completed, run_id: "1", head_sha: "a" },
      apply: { completed_at: completed, run_id: "1", head_sha: "a" },
      db_postflight: { completed_at: completed, run_id: "1", head_sha: "a" },
    },
    contract: {
      result: "PASS_WITH_REVIEW",
      approved_mapping_count: 586,
      executable_plan_count: 576,
      executed_plan_count: 576,
      review_row_count: 10,
      blocked_row_count: 0,
      review_offer_ids: [],
    },
    database: { offer_count: 586, offers_older_than_48h: 0 },
  };
  const now = new Date("2026-08-30T04:00:00.000Z");
  assert.equal(evaluateRetailer(input, now, 48).result, "PASS_WITH_REVIEW");
  const failed = evaluateRetailer(
    {
      ...input,
      stages: { ...input.stages, db_postflight: null },
      contract: { ...input.contract, executed_plan_count: 575 },
      database: { ...input.database, offers_older_than_48h: 1 },
    },
    now,
    48
  );
  assert.equal(failed.result, "FAIL");
  assert.deepEqual(failed.failures, [
    "DB_POSTFLIGHT_SUCCESS_MISSING",
    "EXECUTED_PLAN_COUNT_MISMATCH",
    "DATABASE_OFFERS_OLDER_THAN_48H",
  ]);
});

test("automation watchdog returns exit 0 only for review or unchanged monitored backlog", () => {
  const baseline = {
    maximum_offers_older_than_48h: 47,
    maximum_review_row_count: 0,
    allowed_failure_codes: ["DATABASE_OFFERS_OLDER_THAN_48H"],
  };
  const historical = {
    retailer_id: "4",
    retailer: "Discount Supplements",
    result: "FAIL",
    failures: ["DATABASE_OFFERS_OLDER_THAN_48H"],
    database: { offers_older_than_48h: 47 },
    contract: { review_row_count: 0 },
  };
  const monitored = applyMonitoredBacklog(historical, baseline);
  assert.equal(monitored.result, "PASS_WITH_MONITORED_BACKLOG");
  assert.deepEqual(monitored.warnings, ["DATABASE_OFFERS_OLDER_THAN_48H"]);
  assert.equal(watchdogExitCode(monitored.result), 0);
  assert.equal(watchdogExitCode("PASS_WITH_REVIEW"), 0);
  assert.equal(watchdogExitCode("FAIL"), 1);
  assert.deepEqual(historical.failures, ["DATABASE_OFFERS_OLDER_THAN_48H"]);
});

test("automation watchdog fails on backlog growth and any new reason code", () => {
  const baseline = {
    maximum_offers_older_than_48h: 47,
    maximum_review_row_count: 1,
    allowed_failure_codes: ["DATABASE_OFFERS_OLDER_THAN_48H"],
  };
  const base = {
    result: "FAIL",
    failures: ["DATABASE_OFFERS_OLDER_THAN_48H"],
    database: { offers_older_than_48h: 47 },
    contract: { review_row_count: 1 },
  };
  const growth = applyMonitoredBacklog(
    { ...base, database: { offers_older_than_48h: 48 } },
    baseline,
  );
  assert.equal(growth.result, "FAIL");
  assert(growth.failures.includes("MONITORED_BACKLOG_GROWTH"));
  const unknown = applyMonitoredBacklog(
    { ...base, failures: [...base.failures, "NEW_REASON_CODE"] },
    baseline,
  );
  assert.equal(unknown.result, "FAIL");
  assert.deepEqual(unknown.monitored_backlog.unexpected_failure_codes, ["NEW_REASON_CODE"]);

  const exactReviewBaseline = {
    maximum_offers_older_than_48h: 0,
    maximum_review_row_count: 1,
    allowed_review_offer_ids: ["2060"],
    allowed_failure_codes: [],
  };
  const exactReview = { result: "PASS_WITH_REVIEW", failures: [], database: { offers_older_than_48h: 0 }, contract: { review_row_count: 1, review_offer_ids: ["2060"] } };
  assert.equal(applyMonitoredBacklog(exactReview, exactReviewBaseline).result, "PASS_WITH_REVIEW");
  assert.deepEqual(
    applyMonitoredBacklog({ ...exactReview, contract: { review_row_count: 1, review_offer_ids: ["2061"] } }, exactReviewBaseline).monitored_backlog.growth,
    ["REVIEW_SCOPE_DRIFT"]
  );
  assert.deepEqual(
    applyMonitoredBacklog({ ...exactReview, contract: { review_row_count: 1, review_offer_ids: null } }, exactReviewBaseline).monitored_backlog.growth,
    ["REVIEW_SCOPE_EVIDENCE_MISSING"]
  );
});

test("automation watchdog never suppresses infrastructure, writes or postflight mismatch", () => {
  const baseline = {
    maximum_offers_older_than_48h: 0,
    maximum_review_row_count: 0,
    allowed_failure_codes: [],
  };
  const postflightMismatch = applyMonitoredBacklog(
    {
      result: "FAIL",
      failures: ["APPLY_POSTFLIGHT_CORRELATION_MISMATCH"],
      database: { offers_older_than_48h: 0 },
      contract: { review_row_count: 0 },
    },
    baseline,
  );
  assert.equal(postflightMismatch.result, "FAIL");
  assert.equal(
    summarizeWatchdogResult([], { databaseError: "permission denied" }).result,
    "FAIL",
  );
  assert.equal(
    summarizeWatchdogResult([], { monitoringError: "GitHub API 503" }).result,
    "FAIL",
  );
  const unauthorized = summarizeWatchdogResult([], { databaseWrites: 1 });
  assert.equal(unauthorized.result, "FAIL");
  assert.deepEqual(unauthorized.globalFailures, ["UNAUTHORIZED_DATABASE_WRITE"]);
  assert.throws(() => watchdogExitCode("UNKNOWN"), /Unknown watchdog result/);
});

test("automation watchdog finds only complete per-row execution evidence", () => {
  assert.deepEqual(
    findContractEvidence({ nested: { approved_mapping_count: 6, executable_plan_count: 4, executed_plan_count: 4, blocked_row_count: 0, review_row_count: 2 } }),
    {
      approved_mapping_count: 6,
      executable_plan_count: 4,
      executed_plan_count: 4,
      review_row_count: 2,
      blocked_row_count: 0,
      result: null,
      execution_offer_ids: null,
      review_offer_ids: null,
      expected_deltas: null,
      commit_sha: null,
      manifest_sha256: null,
      plan_fingerprint: null,
      postflight_hash: null,
      source_fingerprint: null,
      full_capture_fingerprint: null,
      executable_source_fingerprint: null,
      review_scope_fingerprint: null,
      idempotency_result: null,
      database_writes: null,
      apply_run_id: null,
      apply_artifact_id: null,
      apply_artifact_digest: null,
      apply_database_writes: null,
      apply_executed_plan_count: null,
      idempotency_run_id: null,
      idempotency_artifact_id: null,
      idempotency_artifact_digest: null,
      idempotency_database_writes: null,
      idempotency_executed_plan_count: null,
      idempotency_plan_fingerprint: null,
      postflight_file_sha256: null,
      evidence_model: null,
      attestation_fingerprint: null,
    }
  );
  assert.equal(
    findContractEvidence({ executable_plan_count: 4, executed_plan_count: 4, blocked_row_count: 0, review_row_count: 0 }),
    null
  );
});

test("watchdog rejects unrelated independent idempotency evidence", () => {
  const core = { apply: { run_id: "10", head_sha: "a" }, db_postflight: { run_id: "10", head_sha: "a" } };
  assert.equal(correlateEvidence({ ...core, capture: { run_id: "10", head_sha: "a" } }, {}).result, "CORRELATED");
  const unrelated = correlateEvidence({ ...core, capture: { run_id: "11", head_sha: "b" } }, {});
  assert.equal(unrelated.result, "UNRELATED_EVIDENCE");
  assert(unrelated.failures.includes("INDEPENDENT_IDEMPOTENCY_COMMIT_MISMATCH"));
  const complete = { execution_offer_ids: ["1"], expected_deltas: {}, manifest_sha256: "m", plan_fingerprint: "p", postflight_hash: "h" };
  assert.equal(correlateEvidence({ ...core, capture: { run_id: "11", head_sha: "a" } }, complete).result, "CORRELATED");
});

test("same-run eBay evidence sealer requires exact apply, postflight and idempotency correlation", () => {
  const executionOfferIds = Array.from({ length: 197 }, (_, index) => String(index + 1));
  const reviewRows = Array.from({ length: 40 }, (_, index) => ({ offer_id: String(index + 198) }));
  const classifications = Object.fromEntries(executionOfferIds.map((id) => [id, "VERIFY_NO_CHANGE"]));
  const expectedDeltas = { logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: 197 }, row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 } };
  const semanticSourceRows = [...executionOfferIds, ...reviewRows.map((row) => row.offer_id)].map((offer_id) => ({ offer_id, mapping_id: `m-${offer_id}`, price: "10.00" }));
  const semanticExecutablePlans = executionOfferIds.map((offer_id) => ({ offer_id, operation_type: "VERIFY_NO_CHANGE", offer: { values: { price: "10" } }, before_state: { offer: { last_checked_at: "2026-08-29T00:00:00.000Z" } } }));
  const fullCaptureFingerprint = canonicalHash(semanticSourceRows);
  const executableSourceFingerprint = canonicalHash(semanticSourceRows.slice(0, 197));
  const reviewScopeFingerprint = canonicalHash(semanticSourceRows.slice(197));
  const planFingerprint = canonicalHash({ executable_offer_ids: executionOfferIds, executable: semanticExecutablePlans, expected_deltas: expectedDeltas });
  const apply = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197 }, execution_offer_ids: executionOfferIds, review_rows: reviewRows, expected_deltas: expectedDeltas, commit_sha: "a".repeat(40), manifest_sha256: "b".repeat(64), source_fingerprint: fullCaptureFingerprint, full_capture_fingerprint: fullCaptureFingerprint, executable_source_fingerprint: executableSourceFingerprint, review_scope_fingerprint: reviewScopeFingerprint, plan_fingerprint: planFingerprint, plan_row_fingerprints: semanticExecutablePlans.map((row) => ({ offer_id: row.offer_id, semantic_fingerprint: canonicalHash(row), scope: "EXECUTABLE" })) };
  const postflight = { result: "PASS", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, freshness_change_count: 197, price_change_count: 0, stock_change_count: 0, shipping_change_count: 0, total_change_count: 0, offer_url_change_count: 0, mapping_url_change_count: 0, price_history_delta: 0, postflight_hash: "e".repeat(64), completed_at: "2026-08-30T18:00:00.000Z" };
  const postApplyPlans = structuredClone(semanticExecutablePlans);
  for (const row of postApplyPlans) row.before_state.offer.last_checked_at = "2026-08-30T18:00:00.000Z";
  const idempotency = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 0, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197, UPDATE_PRICE: 7 }, classifications, execution_offer_ids: executionOfferIds, review_rows: reviewRows, commit_sha: "a".repeat(40), source_fingerprint: fullCaptureFingerprint, full_capture_fingerprint: fullCaptureFingerprint, executable_source_fingerprint: executableSourceFingerprint, review_scope_fingerprint: reviewScopeFingerprint, plan_fingerprint: canonicalHash({ executable_offer_ids: executionOfferIds, executable: postApplyPlans, expected_deltas: expectedDeltas }), semantic_source_rows: semanticSourceRows, semantic_plan_rows: { executable: postApplyPlans, review: reviewRows, blocked: [] } };
  const baseline = { result: "PASS", profile: "ebay-uk", snapshot: { row_count: 237, rows: [...executionOfferIds, ...reviewRows.map((row) => row.offer_id)].map((offer_id) => ({ offer_id, last_checked_at: "2026-08-29T00:00:00.000Z" })) } };
  const env = { GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "1", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "SupplementScout/supplementscout" };
  const sealed = sealEbayRefreshEvidence({ apply, baseline, postflight, idempotency, env });
  assert.equal(sealed.result, "PASS"); assert.equal(sealed.idempotency_result, "PASS"); assert.equal(sealed.database_writes, 197); assert.equal(sealed.price_history_delta, 0); assert.equal(sealed.idempotency_executable_source_fingerprint, executableSourceFingerprint);
  assert.throws(() => sealEbayRefreshEvidence({ apply, baseline, postflight: { ...postflight, price_history_delta: 1 }, idempotency, env }), /postflight delta drift/);
  assert.throws(() => sealEbayRefreshEvidence({ apply, baseline, postflight, idempotency: { ...idempotency, execution_offer_ids: executionOfferIds.slice(1) }, env }), /approved executable scope/);
  const priceDrift = structuredClone(idempotency); priceDrift.semantic_plan_rows.executable[0].offer.values.price = "11";
  assert.throws(() => sealEbayRefreshEvidence({ apply, baseline, postflight, idempotency: priceDrift, env }), /drift outside freshness/);
});

function ebaySplitRunFixture(overrides = {}) {
  const executionOfferIds = Array.from({ length: 197 }, (_, index) => String(2539 + index)).filter((id) => !["2554","2582","2583","2584","2585","2586","2587","2624","2625","2626","2627","2630","2636","2637","2638","2642","2643","2646","2647","2648","2649","2650","2651","2653","2654","2655","2656","2686","2688","2695","2715","2727","2728","2735","2750","2758","2759","2760","2761","2770"].includes(id)).slice(0, 197);
  while (executionOfferIds.length < 197) executionOfferIds.push(String(2600 + executionOfferIds.length));
  const reviewIds = ["2554","2582","2583","2584","2585","2586","2587","2624","2625","2626","2627","2630","2636","2637","2638","2642","2643","2646","2647","2648","2649","2650","2651","2653","2654","2655","2656","2686","2688","2695","2715","2727","2728","2735","2750","2758","2759","2760","2761","2770"];
  const reviewRows = reviewIds.map((offer_id) => ({ offer_id, review_type: offer_id === "2686" ? "SOURCE_FAILURE" : "IDENTITY_CONFLICT" }));
  const expectedDeltas = { logical_field_deltas: { offer_price_updates: 0, offer_stock_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, last_checked_at_updates: 197 }, row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 } };
  const sourceRows = [...executionOfferIds, ...reviewIds].map((offer_id) => ({ offer_id, mapping_id: `m-${offer_id}`, retailer_id: "12", product_id: `p-${offer_id}`, product_variant_id: `v-${offer_id}`, external_url: `https://www.ebay.co.uk/itm/${offer_id}`, price: "10.00", shipping: "0.00", total: "10.00", decision: reviewIds.includes(offer_id) ? "REVIEW" : "ACCEPT" }));
  const executableSourceFingerprint = canonicalHash(sourceRows.filter((row) => executionOfferIds.includes(row.offer_id)));
  const fullCaptureFingerprint = canonicalHash(sourceRows);
  const reviewScopeFingerprint = canonicalHash(sourceRows.filter((row) => reviewIds.includes(row.offer_id)));
  const applyPlanFingerprint = "4dea4728c98fdf74e61fb058b02258c227ed4d5045cf826463cf959d9df86314";
  const idempotencyPlanFingerprint = "f7d081e3cdcc316b5d558ae502ac5ba5d07bd439e3634e3e67557c0710ec77fa";
  const commit = "8389a5f765e4da422f3a1ce22cc4496dadceeb2e";
  const apply = { result: "PASS_WITH_REVIEW", mode: "execute-apply", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197 }, execution_offer_ids: executionOfferIds, review_rows: reviewRows, expected_deltas: expectedDeltas, commit_sha: commit, manifest_sha256: "e".repeat(64), approved_manifest_sha256: "16d8ed6bbced25790030a5d8e929562e510749fe9baaf34c8b484f7228ac9eb7", source_fingerprint: fullCaptureFingerprint, full_capture_fingerprint: fullCaptureFingerprint, executable_source_fingerprint: executableSourceFingerprint, review_scope_fingerprint: reviewScopeFingerprint, approved_full_capture_fingerprint: "31d602ec4deadfc7d2644c97831499fb72dc680149687c02896f1fab5810650d", approved_review_scope_fingerprint: reviewScopeFingerprint, plan_fingerprint: applyPlanFingerprint };
  const postflight = { result: "PASS", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, freshness_change_count: 197, price_change_count: 0, stock_change_count: 0, shipping_change_count: 0, total_change_count: 0, offer_url_change_count: 0, mapping_url_change_count: 0, price_history_delta: 0, postflight_hash: "0281412744d3034b9437cc79e9bb1ecac61019a569a58d2aa6d8adef8a62c40f", completed_at: "2026-08-31T09:08:36.575Z" };
  const verification = { result: "PASS", run_id: "33373500248", artifact_id: "9751118948", commit_sha: commit, database_writes: 0 };
  const idempotency = { result: "PASS_WITH_REVIEW", mode: "dry-run", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 0, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197, UPDATE_PRICE: 7 }, classifications: Object.fromEntries(executionOfferIds.map((id) => [id, "VERIFY_NO_CHANGE"])), execution_offer_ids: executionOfferIds, review_rows: reviewRows, blocked_rows: [], expected_deltas: expectedDeltas, commit_sha: commit, source_fingerprint: fullCaptureFingerprint, full_capture_fingerprint: fullCaptureFingerprint, executable_source_fingerprint: executableSourceFingerprint, review_scope_fingerprint: reviewScopeFingerprint, plan_fingerprint: idempotencyPlanFingerprint, semantic_source_rows: sourceRows, semantic_plan_binding: { executable_offer_ids: executionOfferIds, executable: executionOfferIds.map((offer_id) => ({ offer_id, operation_type: "VERIFY_NO_CHANGE", before_state: { offer: { last_checked_at: "2026-08-31T09:08:36.000Z" } } })), expected_deltas: expectedDeltas } };
  const contract = { ...idempotency, schema_version: 2, kind: "ebay-offer-refresh-executable-scope-contract-v2" };
  const applyRun = { id: 33374870684, conclusion: "cancelled", event: "workflow_dispatch", head_sha: commit };
  const idempotencyRun = { id: 33378021842, conclusion: "success", event: "workflow_dispatch", head_sha: commit };
  const applyArtifact = { id: 9752044455, digest: "sha256:74ab4426108c6d2bc57614c6db9c87bae938f6f8aac44e11541b2de6fa2c57d9" };
  const idempotencyArtifact = { id: 9752753449, digest: "sha256:b4ff2faa5d5a72145cf51b30ae778345e1516160d44cb47cba8d89400c92708f" };
  const applyFiles = [{ name: "production-apply.json", sha256: "apply", json: apply }, { name: "production-db-postflight.json", sha256: "35920e013b10518bdd6ee6fa899c3704464508cbf1f0dbf814f4349fc5b8d3e8", json: postflight }, { name: "approved-artifact-verification.json", sha256: "verification", json: verification }];
  const idempotencyFiles = [{ name: "production-dry-run.json", sha256: "dryrun", json: idempotency }, { name: "production-dry-run-contract.json", sha256: "contract", json: contract }];
  return { executionOfferIds, reviewIds, expectedDeltas, apply, postflight, verification, idempotency, contract, applyRun, idempotencyRun, applyArtifact, idempotencyArtifact, applyFiles, idempotencyFiles, ...overrides };
}

test("watchdog accepts split-run eBay evidence from apply 33374870684 and independent idempotency 33378021842", () => {
  const fixture = ebaySplitRunFixture();
  const applyEvidence = validateEbayApplyArtifacts({ run: fixture.applyRun, artifact: fixture.applyArtifact, files: fixture.applyFiles });
  const idempotencyEvidence = validateEbayIdempotencyArtifacts({ run: fixture.idempotencyRun, artifact: fixture.idempotencyArtifact, files: fixture.idempotencyFiles, applyEvidence });
  const attestation = buildEbaySplitRunAttestation({ applyRun: fixture.applyRun, applyArtifact: fixture.applyArtifact, applyEvidence, idempotencyRun: fixture.idempotencyRun, idempotencyArtifact: fixture.idempotencyArtifact, idempotencyEvidence });
  const contract = findContractEvidence(attestation);
  assert.equal(contract.evidence_model, "split-run-v1");
  assert.equal(contract.apply_database_writes, 197);
  assert.equal(contract.idempotency_database_writes, 0);
  assert.equal(contract.idempotency_executed_plan_count, 0);
  assert.equal(contract.plan_fingerprint, "4dea4728c98fdf74e61fb058b02258c227ed4d5045cf826463cf959d9df86314");
  assert.equal(contract.idempotency_plan_fingerprint, "f7d081e3cdcc316b5d558ae502ac5ba5d07bd439e3634e3e67557c0710ec77fa");
  assert.match(contract.attestation_fingerprint, /^[0-9a-f]{64}$/);
  const completed = "2026-08-31T09:40:00.000Z";
  const evaluated = evaluateRetailer({ profile: { id: 12, name: "eBay UK", workflow: "ebay.yml" }, stages: { capture: { completed_at: completed, run_id: "33378021842", head_sha: fixture.apply.commit_sha }, apply: { completed_at: completed, run_id: "33374870684", head_sha: fixture.apply.commit_sha }, db_postflight: { completed_at: completed, run_id: "33374870684", head_sha: fixture.apply.commit_sha } }, contract, database: { offer_count: 237, offers_older_than_48h: 40, older_offer_ids: fixture.reviewIds } }, new Date("2026-08-31T10:00:00.000Z"), 48);
  assert.equal(evaluated.result, "PASS_WITH_REVIEW");
  assert.equal(evaluated.evidence_correlation, "CORRELATED");
});

test("watchdog split-run eBay evidence remains fail-closed for drift and unsafe idempotency", () => {
  const cases = [
    ["missing apply artifact", (fixture) => { fixture.applyFiles = fixture.applyFiles.filter((file) => file.name !== "production-apply.json"); }, /missing apply/],
    ["bad artifact digest", (fixture) => { fixture.applyArtifact.digest = "sha256:not-a-digest"; }, /digest/],
    ["missing postflight hash", (fixture) => { fixture.postflight.postflight_hash = null; }, /postflight hash missing/],
    ["postflight failure", (fixture) => { fixture.postflight.result = "FAIL"; }, /postflight scope drift/],
    ["job interrupted before postflight", (fixture) => { fixture.applyFiles = fixture.applyFiles.filter((file) => file.name !== "production-db-postflight.json"); }, /missing apply, postflight/],
    ["independent run contains apply", (fixture) => { fixture.idempotencyFiles.push({ name: "production-apply.json", sha256: "x", json: fixture.apply }); }, /contains apply/],
    ["independent run with database writes", (fixture) => { fixture.idempotency.executed_plan_count = 1; fixture.contract.executed_plan_count = 1; }, /not read-only/],
    ["missing executed offer ID", (fixture) => { fixture.idempotency.execution_offer_ids = fixture.idempotency.execution_offer_ids.slice(1); }, /offer IDs drift/],
    ["additional offer ID", (fixture) => { fixture.idempotency.execution_offer_ids = [...fixture.idempotency.execution_offer_ids, "9999"]; }, /offer IDs drift/],
    ["price drift", (fixture) => { fixture.idempotency.executable_source_fingerprint = "1".repeat(64); }, /executable source fingerprint drift/],
    ["stock drift", (fixture) => { fixture.idempotency.executable_source_fingerprint = "2".repeat(64); }, /executable source fingerprint drift/],
    ["url drift", (fixture) => { fixture.idempotency.executable_source_fingerprint = "3".repeat(64); }, /executable source fingerprint drift/],
    ["mapping drift", (fixture) => { fixture.idempotency.executable_source_fingerprint = "4".repeat(64); }, /executable source fingerprint drift/],
    ["identity drift", (fixture) => { fixture.idempotency.executable_source_fingerprint = "5".repeat(64); }, /executable source fingerprint drift/],
    ["review row in executable scope", (fixture) => { fixture.idempotency.execution_offer_ids[0] = "2686"; }, /offer IDs drift|2686/],
    ["blocked row", (fixture) => { fixture.idempotency.blocked_row_count = 1; fixture.contract.blocked_row_count = 1; }, /scope drift/],
    ["different retailer scope", (fixture) => { fixture.idempotency.approved_mapping_count = 236; }, /scope drift/],
    ["incompatible commit", (fixture) => { fixture.idempotencyRun.head_sha = "b".repeat(40); }, /status or commit mismatch/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const fixture = ebaySplitRunFixture();
    mutate(fixture);
    assert.throws(() => {
      const applyEvidence = validateEbayApplyArtifacts({ run: fixture.applyRun, artifact: fixture.applyArtifact, files: fixture.applyFiles });
      validateEbayIdempotencyArtifacts({ run: fixture.idempotencyRun, artifact: fixture.idempotencyArtifact, files: fixture.idempotencyFiles, applyEvidence });
    }, pattern, name);
  }
});

test("watchdog split-run keeps future freshness timestamp plan fingerprint drift distinct from semantic drift", () => {
  const fixture = ebaySplitRunFixture();
  const applyEvidence = validateEbayApplyArtifacts({ run: fixture.applyRun, artifact: fixture.applyArtifact, files: fixture.applyFiles });
  const idempotencyEvidence = validateEbayIdempotencyArtifacts({ run: fixture.idempotencyRun, artifact: fixture.idempotencyArtifact, files: fixture.idempotencyFiles, applyEvidence });
  const attestation = buildEbaySplitRunAttestation({ applyRun: fixture.applyRun, applyArtifact: fixture.applyArtifact, applyEvidence, idempotencyRun: fixture.idempotencyRun, idempotencyArtifact: fixture.idempotencyArtifact, idempotencyEvidence });
  assert.notEqual(attestation.plan_fingerprint, attestation.idempotency_plan_fingerprint);
  assert.equal(attestation.executable_source_fingerprint, fixture.apply.executable_source_fingerprint);
  assert.throws(() => {
    const drift = ebaySplitRunFixture();
    drift.idempotency.expected_deltas = { ...drift.idempotency.expected_deltas, logical_field_deltas: { ...drift.idempotency.expected_deltas.logical_field_deltas, offer_price_updates: 1 } };
    const driftApplyEvidence = validateEbayApplyArtifacts({ run: drift.applyRun, artifact: drift.applyArtifact, files: drift.applyFiles });
    validateEbayIdempotencyArtifacts({ run: drift.idempotencyRun, artifact: drift.idempotencyArtifact, files: drift.idempotencyFiles, applyEvidence: driftApplyEvidence });
  }, /expected deltas drift/);
});

test("watchdog isolates database-old offers only when every row is explicit review", () => {
  const completed = "2026-08-30T03:00:00.000Z";
  const input = { profile: { id: 12, name: "eBay UK", workflow: "ebay.yml" }, stages: { capture: { completed_at: completed, run_id: "1", head_sha: "a" }, apply: { completed_at: completed, run_id: "1", head_sha: "a" }, db_postflight: { completed_at: completed, run_id: "1", head_sha: "a" } }, contract: { result: "PASS_WITH_REVIEW", approved_mapping_count: 2, executable_plan_count: 1, executed_plan_count: 1, review_row_count: 1, blocked_row_count: 0, review_offer_ids: ["2"], execution_offer_ids: ["1"], expected_deltas: {}, commit_sha: "a", manifest_sha256: "m", source_fingerprint: "s", full_capture_fingerprint: "f", executable_source_fingerprint: "e", review_scope_fingerprint: "r", plan_fingerprint: "p", postflight_hash: "h", idempotency_result: "PASS", database_writes: 1 }, database: { offer_count: 2, offers_older_than_48h: 1, older_offer_ids: ["2"] } };
  assert.equal(evaluateRetailer(input, new Date("2026-08-30T04:00:00.000Z"), 48).result, "PASS_WITH_REVIEW");
  assert(evaluateRetailer({ ...input, database: { ...input.database, older_offer_ids: ["1"] } }, new Date("2026-08-30T04:00:00.000Z"), 48).failures.includes("DATABASE_OFFERS_OLDER_THAN_48H"));
  assert.equal(loadWatchdogConfig().retailers.find((row) => row.id === 12).db_postflight_step, "Verify eBay UK DB postflight read-only");
});

test("shared DB postflight covers nine exact retailer scopes", () => {
  const expected = {
    "discount-supplements": [109, 109],
    "dolphin-fitness": [1, 1],
    "ebay-uk": [237, 237],
    "fit-house": [286, null],
    "jons-supplements": [506, null],
    "kior-health": [11, 11],
    "simply-supplements": [120, null],
    "six-pack-supplements": [506, 506],
    "whey-okay": [586, 586],
  };

  assert.deepEqual(Object.keys(postflightProfiles).sort(), Object.keys(expected));
  for (const [name, [approvedCount, scopedCount]] of Object.entries(expected)) {
    const profile = postflightProfiles[name];
    assert.equal(profile.approvedMappingCount, approvedCount);
    assert.equal(approvedOfferIds(profile)?.length ?? null, scopedCount);
  }
});

test("adopted retailer workflows place read-only DB evidence around apply", () => {
  const workflows = [
    ["creatine-offer-refresh.yml", "Capture Discount Supplements DB baseline read-only", "Apply safe authorised Discount refresh", "Verify Discount Supplements DB postflight read-only"],
    ["dolphin-vegan-protein-offer-refresh.yml", "Capture Dolphin Fitness DB baseline read-only", "Apply the one approved existing Dolphin offer refresh", "Verify Dolphin Fitness DB postflight read-only"],
    ["ebay-offer-refresh.yml", "Capture eBay UK DB baseline read-only", "Apply exact approved existing-offer refresh", "Verify eBay UK DB postflight read-only"],
    ["fit-house-offer-refresh.yml", "Capture Fit House DB baseline read-only", "Apply all approved Fit House offer refresh", "Verify Fit House DB postflight read-only"],
    ["jons-offer-refresh.yml", "Capture Jon's Supplements DB baseline read-only", "Apply all approved Jon's offer refresh", "Verify Jon's Supplements DB postflight read-only"],
    ["kior-offer-refresh.yml", "Capture KIOR Health DB baseline read-only", "Apply the exact approved KIOR offer refresh", "Verify KIOR Health DB postflight read-only"],
    ["six-pack-offer-refresh.yml", "Capture 6 Pack DB baseline read-only", "Apply exact approved manifest", "Verify 6 Pack DB postflight read-only"],
  ];

  for (const [file, baseline, apply, postflight] of workflows) {
    const source = fs.readFileSync(
      path.join(process.cwd(), ".github", "workflows", file),
      "utf8"
    );
    assert(source.indexOf(baseline) < source.indexOf(apply));
    assert(source.indexOf(apply) < source.indexOf(postflight));
    assert.match(source, /retailer-offer-refresh-postflight\.js/);
  }

  const jonsSource = fs.readFileSync(
    path.join(process.cwd(), "scripts", "jons-offer-refresh.js"),
    "utf8"
  );
  assert.match(jonsSource, /approvedMappingCount=reviewed\?executablePlanCount\+reviewRows\.length:506/);
  assert.match(jonsSource, /approved_mapping_count:approvedMappingCount,executable_plan_count:executablePlanCount,executed_plan_count:0,review_row_count:reviewRows\.length,blocked_row_count:0/);
  assert.match(jonsSource, /executed_plan_count:appliedRows/);
});
