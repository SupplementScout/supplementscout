const assert = require("node:assert/strict");
const test = require("node:test");
const {
  extractProductOffer,
  extractProductName,
  extractVariationPayload,
  parseWooCommerceProductPage,
  readWooCommerceProductPage,
} = require("./woocommerce-product-page-reader");

test("extracts the current product heading for identity-drift checks", () => {
  assert.equal(
    extractProductName('<h1 class="product_title entry-title">Melatonin 4mg &amp; Zinc</h1>'),
    "Melatonin 4mg & Zinc"
  );
});

const productJsonLd = (offer = {}) => `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Example Product",
  sku: "ABC",
  offers: {
    "@type": "Offer",
    price: "19.99",
    priceCurrency: "GBP",
    availability: "https://schema.org/InStock",
    url: "https://shop.example.test/product/example/",
    ...offer,
  },
})}</script>`;

test("parses a simple product offer from JSON-LD", () => {
  assert.deepEqual(extractProductOffer(productJsonLd(), {
    canonicalUrl: "https://shop.example.test/product/example/",
  }), {
    name: "Example Product",
    sku: "ABC",
    price: "19.99",
    in_stock: true,
    url: "https://shop.example.test/product/example/",
  });
});

test("parses HTML-encoded WooCommerce variation payloads", () => {
  const payload = JSON.stringify([{
    variation_id: 21,
    attributes: { attribute_flavour: "Cherry" },
    display_price: 18.5,
    display_regular_price: 20,
    is_in_stock: true,
    is_purchasable: true,
    variation_is_active: true,
    sku: "",
    image: { full_src: "https://shop.example.test/cherry.jpg" },
  }]).replaceAll('"', "&quot;");
  const html = `<form data-product_id="20" data-product_variations="${payload}">`;
  assert.deepEqual(extractVariationPayload(html), [{
    external_variant_id: "21",
    attributes: { attribute_flavour: "Cherry" },
    price: "18.50",
    regular_price: "20.00",
    in_stock: true,
    purchasable: true,
    active: true,
    sku: null,
    image_url: "https://shop.example.test/cherry.jpg",
  }]);
});

test("binds parsed page state to the expected product identity", () => {
  const html = `<body class="single-product postid-10"><form data-product_id="99">${productJsonLd()}</form></body>`;
  const parsed = parseWooCommerceProductPage(html, {
    productId: "10",
    canonicalUrl: "https://shop.example.test/product/example/",
    capturedAt: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(parsed.external_product_id, "10");
  assert.equal(parsed.product_offer.price, "19.99");
  assert.throws(
    () => parseWooCommerceProductPage(html, { productId: "11" }),
    /Expected product 11, received 10/
  );
});

test("live reader enforces same-host product redirects and bounded HTML", async () => {
  const html = `<form data-product_id="10">${productJsonLd()}</form>`;
  const response = (url = "https://shop.example.test/product/example/") => ({
    status: 200,
    url,
    headers: { get: (name) => name === "content-type" ? "text/html; charset=UTF-8" : null },
    body: null,
    text: async () => html,
  });
  const parsed = await readWooCommerceProductPage({
    storeUrl: "https://shop.example.test",
    productId: "10",
    fetchImpl: async () => response(),
    maximumAttempts: 1,
  });
  assert.equal(parsed.canonical_url, "https://shop.example.test/product/example/");
  await assert.rejects(
    readWooCommerceProductPage({
      storeUrl: "https://shop.example.test",
      productId: "10",
      fetchImpl: async () => response("https://evil.example/product/example/"),
      maximumAttempts: 1,
    }),
    /redirected outside/
  );
});

test("fails closed on duplicate variation IDs and malformed offer currency", () => {
  const row = {
    variation_id: 21,
    attributes: {},
    display_price: 10,
    display_regular_price: 10,
    is_in_stock: true,
    is_purchasable: true,
    variation_is_active: true,
  };
  const payload = JSON.stringify([row, row]).replaceAll('"', "&quot;");
  assert.throws(() => extractVariationPayload(`<form data-product_variations="${payload}">`), /Duplicate live variation ID/);
  assert.throws(() => extractProductOffer(productJsonLd({ priceCurrency: "USD" })), /invalid GBP offer/);
});
