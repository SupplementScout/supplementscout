const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(
  ROOT,
  "config/retailers/fit-house-shopify.json"
);
const configText = fs.readFileSync(CONFIG_PATH, "utf8");
const config = JSON.parse(configText);

test("Fit House config has the approved top-level contract", () => {
  assert.equal(config.schema_version, 1);
  assert.equal(config.source_url, "https://fithouse.uk/products.json?limit=250");
  assert.deepEqual(config.retailer, {
    name: "Fit House",
    website: "https://fithouse.uk",
    vendor_aliases: [
      "Swanson",
      "Now Foods",
      "Osavi",
      "OstroVit",
      "Ostrovit",
      "Mutant",
      "Per4m",
      "PER4M",
    ],
  });
  assert.deepEqual(config.shipping, {
    known: true,
    cost: 3.99,
    free_shipping_threshold: 100,
    approval_note: "Confirmed directly by the retailer owner.",
  });
});

test("Fit House config contains exactly ten unique approved mappings", () => {
  assert.equal(config.products.length, 10);

  for (const field of [
    "shopify_product_id",
    "shopify_variant_id",
    "canonical_slug",
  ]) {
    const values = config.products.map((product) => product[field]);
    assert.equal(new Set(values).size, 10, `${field} must be unique`);
  }
});

test("every mapping is an approved in-stock new canonical candidate", () => {
  for (const product of config.products) {
    assert.equal(product.canonical_product_id, null);
    assert.equal(product.approved_in_stock, true);
    assert.equal(product.is_for_sale, true);
    assert.equal(Number.isFinite(product.approved_price), true);
    assert.ok(product.approved_price > 0);

    for (const field of [
      "brand",
      "category",
      "product_format",
      "canonical_name",
      "canonical_slug",
      "expected_handle",
      "variant_name",
    ]) {
      assert.equal(typeof product[field], "string");
      assert.ok(product[field].length > 0, `${field} must not be blank`);
    }

    assert.equal(
      product.size === null,
      product.size_unit === null,
      "size and size_unit must both be null or both be supplied"
    );
  }
});

test("the tablet mapping preserves its approved orange flavour evidence", () => {
  const tablets = config.products.filter(
    (product) => product.product_format === "tablet"
  );

  assert.equal(tablets.length, 1);
  assert.equal(tablets[0].flavour, "orange");
});

test("config excludes retailer-forbidden and verified product data", () => {
  const forbiddenKeys = new Set([
    "products.gtin",
    "gtin",
    "product_gtin_verified",
    "net_weight_g",
    "net_volume_ml",
    "serving_count_verified",
    "serving_size_g",
    "serving_size_ml",
    "protein_per_serving_g",
    "creatine_per_serving_g",
    "unit_count",
    "unit_type",
    "unit_pricing_verified",
    "nutrition_verified",
    "description",
    "descriptions",
    "Variant Grams",
    "Body HTML",
  ]);

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `forbidden key: ${key}`);
      visit(child);
    }
  }

  visit(config);
});

test("config contains no secrets or local filesystem paths", () => {
  const secretPatterns = [
    /service[_-]?role/i,
    /api[_-]?key/i,
    /access[_-]?token/i,
    /password/i,
    /bearer\s+/i,
    /(?:[a-z]:\\|\/users\/|\/home\/)/i,
  ];

  for (const pattern of secretPatterns) {
    assert.equal(pattern.test(configText), false, `matched ${pattern}`);
  }
});
