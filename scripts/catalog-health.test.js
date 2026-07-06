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
  assert.deepEqual(fixture.calls.productPages, [{ from: 0, to: 999 }]);
  assert.deepEqual(fixture.calls.offerPages, [{ from: 0, to: 999 }]);
  assert.equal(fixture.calls.retailerFetches, 1);
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
