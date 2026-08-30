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
  correlateEvidence,
  evaluateRetailer,
  findContractEvidence,
  loadConfig: loadWatchdogConfig,
  parseArgs: parseWatchdogArgs,
} = require("./automation-reliability-watchdog");
const {
  PROFILES: postflightProfiles,
  approvedOfferIds,
} = require("./retailer-offer-refresh-postflight");
const { seal: sealEbayRefreshEvidence } = require("./ebay-refresh-evidence-sealer");

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
  assert.equal(evaluateRetailer(input, now, 48).result, "PASS");
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
      idempotency_result: null,
      database_writes: null,
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
  const apply = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197 }, execution_offer_ids: executionOfferIds, review_rows: reviewRows, expected_deltas: expectedDeltas, commit_sha: "a".repeat(40), manifest_sha256: "b".repeat(64), source_fingerprint: "c".repeat(64), plan_fingerprint: "d".repeat(64) };
  const postflight = { result: "PASS", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 197, review_row_count: 40, blocked_row_count: 0, freshness_change_count: 197, price_change_count: 0, stock_change_count: 0, shipping_change_count: 0, total_change_count: 0, offer_url_change_count: 0, mapping_url_change_count: 0, price_history_delta: 0, postflight_hash: "e".repeat(64), completed_at: "2026-08-30T18:00:00.000Z" };
  const idempotency = { result: "PASS_WITH_REVIEW", approved_mapping_count: 237, executable_plan_count: 197, executed_plan_count: 0, review_row_count: 40, blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 197, UPDATE_PRICE: 7 }, classifications, execution_offer_ids: executionOfferIds, review_rows: reviewRows, commit_sha: "a".repeat(40), source_fingerprint: "f".repeat(64), plan_fingerprint: "0".repeat(64) };
  const env = { GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "1", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "SupplementScout/supplementscout" };
  const sealed = sealEbayRefreshEvidence({ apply, postflight, idempotency, env });
  assert.equal(sealed.result, "PASS"); assert.equal(sealed.idempotency_result, "PASS"); assert.equal(sealed.database_writes, 197); assert.equal(sealed.price_history_delta, 0); assert.equal(sealed.idempotency_source_fingerprint, "f".repeat(64));
  assert.throws(() => sealEbayRefreshEvidence({ apply, postflight: { ...postflight, price_history_delta: 1 }, idempotency, env }), /postflight delta drift/);
  assert.throws(() => sealEbayRefreshEvidence({ apply, postflight, idempotency: { ...idempotency, execution_offer_ids: executionOfferIds.slice(1) }, env }), /executable scope drift/);
});

test("watchdog isolates database-old offers only when every row is explicit review", () => {
  const completed = "2026-08-30T03:00:00.000Z";
  const input = { profile: { id: 12, name: "eBay UK", workflow: "ebay.yml" }, stages: { capture: { completed_at: completed, run_id: "1", head_sha: "a" }, apply: { completed_at: completed, run_id: "1", head_sha: "a" }, db_postflight: { completed_at: completed, run_id: "1", head_sha: "a" } }, contract: { approved_mapping_count: 2, executable_plan_count: 1, executed_plan_count: 1, review_row_count: 1, blocked_row_count: 0, review_offer_ids: ["2"], execution_offer_ids: ["1"], expected_deltas: {}, commit_sha: "a", manifest_sha256: "m", source_fingerprint: "s", plan_fingerprint: "p", postflight_hash: "h", idempotency_result: "PASS", database_writes: 1 }, database: { offer_count: 2, offers_older_than_48h: 1, older_offer_ids: ["2"] } };
  assert.equal(evaluateRetailer(input, new Date("2026-08-30T04:00:00.000Z"), 48).result, "PASS");
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
