const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
      "Doctor's Best",
      "Doctors Best",
      "TBJP",
      "tbjp",
      "Trec Nutrition",
      "Trec",
      "Nutrend",
      "NUTREND",
      "EFX Sports",
      "EFX",
      "efx",
    ],
  });
  assert.deepEqual(config.shipping, {
    known: true,
    cost: 3.99,
    free_shipping_threshold: 100,
    approval_note: "Confirmed directly by the retailer owner.",
  });
});

test("Fit House config contains exactly 22 unique approved mappings", () => {
  assert.equal(config.products.length, 22);

  for (const field of [
    "shopify_product_id",
    "shopify_variant_id",
    "canonical_slug",
    "expected_handle",
  ]) {
    const values = config.products.map((product) => product[field]);
    assert.equal(new Set(values).size, 22, `${field} must be unique`);
  }
});

test("the original ten batch-one mappings remain byte-for-byte unchanged", () => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(config.products.slice(0, 10)))
    .digest("hex");

  assert.equal(
    digest,
    "98a691985a3a7d5c04e0f3cd039644688c2639fd61d130907b247d4b6aeecfac"
  );
});

test("batch two contains exactly the twelve approved new mappings", () => {
  const batchTwo = config.products.slice(10);
  const expectedProductIds = [
    "10034753143024",
    "10079982584048",
    "10079982944496",
    "10081661419760",
    "10081679147248",
    "10083619340528",
    "10033393893616",
    "10028557009136",
    "10028561989872",
    "10028475810032",
    "10028500615408",
    "10077997170928",
  ];

  assert.equal(batchTwo.length, 12);
  assert.deepEqual(
    batchTwo.map((product) => product.shopify_product_id),
    expectedProductIds
  );

  for (const product of batchTwo) {
    assert.equal(product.canonical_product_id, null);
    assert.equal(product.approved_in_stock, true);
    assert.equal(product.is_for_sale, true);
    assert.equal(Number.isFinite(product.approved_price), true);
    assert.ok(product.approved_price > 0);
    assert.ok(
      ["Health Supplements", "Vitamins", "Creatine"].includes(product.category)
    );
    assert.ok(["powder", "softgel", "capsule"].includes(product.product_format));
  }
});

test("every mapping has complete approved identity and variant evidence", () => {
  for (const product of config.products) {
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

test("shipping and newly approved vendor aliases remain exact", () => {
  assert.deepEqual(config.shipping, {
    known: true,
    cost: 3.99,
    free_shipping_threshold: 100,
    approval_note: "Confirmed directly by the retailer owner.",
  });

  for (const alias of [
    "Doctor's Best",
    "Doctors Best",
    "TBJP",
    "tbjp",
    "Trec Nutrition",
    "Trec",
    "Nutrend",
    "NUTREND",
    "EFX Sports",
    "EFX",
    "efx",
  ]) {
    assert.ok(config.retailer.vendor_aliases.includes(alias), `missing alias: ${alias}`);
  }
});

test("batch two excludes Shilajit and OstroVit Creatine 300g", () => {
  const serialized = JSON.stringify(config.products.slice(10)).toLowerCase();
  assert.equal(serialized.includes("shilajit"), false);
  assert.equal(serialized.includes("ostrovit-creatine-monohydrate-300g"), false);
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
