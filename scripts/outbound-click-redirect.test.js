const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadOutboundModule() {
  const filename = path.join(process.cwd(), "app", "lib", "outboundClickRedirect.ts");
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
  isCrawlerUserAgent,
  normalizeOutboundSource,
  resolveOutboundRedirect,
  validateRetailerDestinationUrl,
} = loadOutboundModule();

function createDataSource(overrides = {}) {
  const calls = {
    insertedClicks: [],
    fetchOfferIds: [],
    fetchProductIds: [],
  };
  const offer =
    overrides.offer === undefined
      ? {
          id: "90071992547409931234",
          product_id: "80000000000000000001",
          retailer_id: "70000000000000000002",
          url: "https://retailer.test/deal?aff=abc&utm=keep",
          in_stock: true,
        }
      : overrides.offer;
  const product =
    overrides.product === undefined
      ? {
          id: "80000000000000000001",
          slug: "safe-product",
          is_active: true,
          merged_into_product_id: null,
        }
      : overrides.product;

  return {
    calls,
    dataSource: {
      async fetchOffer(offerId) {
        calls.fetchOfferIds.push(offerId);

        return {
          data: offer,
          error: overrides.offerError || null,
        };
      },
      async fetchProduct(productId) {
        calls.fetchProductIds.push(productId);

        return {
          data: product,
          error: overrides.productError || null,
        };
      },
      async insertClick(click) {
        calls.insertedClicks.push(click);

        return { error: overrides.insertError || null };
      },
    },
  };
}

test("valid in-stock offer records a click and redirects to exact database URL", async () => {
  const { dataSource, calls } = createDataSource();
  const result = await resolveOutboundRedirect({
    offerId: "90071992547409931234",
    source: "product_best_offer",
    dataSource,
  });

  assert.equal(result.ok, true);
  assert.equal(result.destinationUrl, "https://retailer.test/deal?aff=abc&utm=keep");
  assert.equal(result.clickInserted, true);
  assert.deepEqual(calls.insertedClicks, [
    {
      offer_id: "90071992547409931234",
      product_id: "80000000000000000001",
      retailer_id: "70000000000000000002",
      destination_url: "https://retailer.test/deal?aff=abc&utm=keep",
      source_page: "product_best_offer",
    },
  ]);
});

test("missing offer does not insert a click or redirect externally", async () => {
  const { dataSource, calls } = createDataSource({ offer: null });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(calls.insertedClicks.length, 0);
});

test("out-of-stock offer does not insert a click or redirect externally", async () => {
  const { dataSource, calls } = createDataSource({
    offer: {
      id: "123",
      product_id: "456",
      retailer_id: "789",
      url: "https://retailer.test/deal",
      in_stock: false,
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(calls.insertedClicks.length, 0);
});

test("missing product does not insert a click or redirect externally", async () => {
  const { dataSource, calls } = createDataSource({ product: null });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.productPath, null);
  assert.equal(calls.insertedClicks.length, 0);
});

test("inactive product does not insert a click or redirect externally", async () => {
  const { dataSource, calls } = createDataSource({
    product: {
      id: "456",
      slug: "inactive-product",
      is_active: false,
      merged_into_product_id: null,
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.productPath, "/product/inactive-product");
  assert.equal(calls.insertedClicks.length, 0);
});

test("merged product does not insert a click or redirect externally", async () => {
  const { dataSource, calls } = createDataSource({
    product: {
      id: "456",
      slug: "merged-product",
      is_active: true,
      merged_into_product_id: "999",
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.productPath, "/product/merged-product");
  assert.equal(calls.insertedClicks.length, 0);
});

test("missing URL does not redirect", async () => {
  const { dataSource, calls } = createDataSource({
    offer: {
      id: "123",
      product_id: "456",
      retailer_id: "789",
      url: null,
      in_stock: true,
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(calls.insertedClicks.length, 0);
});

test("malformed non-URL destination does not insert a click or redirect externally", async () => {
  assert.equal(validateRetailerDestinationUrl("not a url"), null);

  const { dataSource, calls } = createDataSource({
    offer: {
      id: "123",
      product_id: "456",
      retailer_id: "789",
      url: "not a url",
      in_stock: true,
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(calls.insertedClicks.length, 0);
});

test("javascript URL is rejected", async () => {
  assert.equal(validateRetailerDestinationUrl("javascript:alert(1)"), null);

  const { dataSource, calls } = createDataSource({
    offer: {
      id: "123",
      product_id: "456",
      retailer_id: "789",
      url: "javascript:alert(1)",
      in_stock: true,
    },
  });
  const result = await resolveOutboundRedirect({
    offerId: "123",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(calls.insertedClicks.length, 0);
});

test("http and https URLs are accepted", () => {
  assert.equal(
    validateRetailerDestinationUrl("http://retailer.test/deal?aff=abc"),
    "http://retailer.test/deal?aff=abc"
  );
  assert.equal(
    validateRetailerDestinationUrl("https://retailer.test/deal?aff=abc"),
    "https://retailer.test/deal?aff=abc"
  );
});

test("arbitrary destination query parameter is ignored in favour of database URL", async () => {
  const { dataSource } = createDataSource();
  const requestUrl = new URL(
    "https://www.supplementscout.co.uk/go/90071992547409931234?destination=https://evil.test"
  );
  const result = await resolveOutboundRedirect({
    offerId: "90071992547409931234",
    source: requestUrl.searchParams.get("source"),
    dataSource,
  });

  assert.equal(result.ok, true);
  assert.equal(result.destinationUrl, "https://retailer.test/deal?aff=abc&utm=keep");
});

test("invalid source is replaced with safe default", async () => {
  assert.equal(normalizeOutboundSource("not_real"), "product_offer_list");

  const { dataSource, calls } = createDataSource();
  const result = await resolveOutboundRedirect({
    offerId: "90071992547409931234",
    source: "not_real",
    dataSource,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.insertedClicks[0].source_page, "product_offer_list");
});

test("obvious crawler user agents are detected conservatively", () => {
  assert.equal(isCrawlerUserAgent(null), false);
  assert.equal(isCrawlerUserAgent("Mozilla/5.0 Safari/537.36"), false);
  assert.equal(isCrawlerUserAgent("Mozilla/5.0 AppleWebKit/537.36 Chrome/126"), false);
  assert.equal(isCrawlerUserAgent("Googlebot/2.1"), true);
  assert.equal(isCrawlerUserAgent("facebookexternalhit/1.1"), true);
  assert.equal(isCrawlerUserAgent("HeadlessChrome Lighthouse"), true);
});

test("click insert failure still redirects to valid retailer URL", async () => {
  const errors = [];
  const { dataSource } = createDataSource({ insertError: new Error("insert failed") });
  const result = await resolveOutboundRedirect({
    offerId: "90071992547409931234",
    source: "product_best_offer",
    dataSource,
    log: {
      error(...args) {
        errors.push(args);
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.clickInserted, false);
  assert.equal(result.destinationUrl, "https://retailer.test/deal?aff=abc&utm=keep");
  assert.equal(errors.length, 1);
});

test("bigint offer IDs remain strings throughout route handling", async () => {
  const { dataSource, calls } = createDataSource();
  const result = await resolveOutboundRedirect({
    offerId: "90071992547409931234",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.fetchOfferIds[0], "90071992547409931234");
  assert.equal(calls.fetchProductIds[0], "80000000000000000001");
  assert.equal(calls.insertedClicks[0].offer_id, "90071992547409931234");
  assert.equal(calls.insertedClicks[0].product_id, "80000000000000000001");
});

test("structurally invalid IDs are rejected without database calls", async () => {
  const { dataSource, calls } = createDataSource();
  const result = await resolveOutboundRedirect({
    offerId: "001",
    source: "product_offer_list",
    dataSource,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(calls.fetchOfferIds.length, 0);
  assert.equal(calls.insertedClicks.length, 0);
});
