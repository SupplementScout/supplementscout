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
      "Applied Nutrition",
    ],
  });
  assert.deepEqual(config.shipping, {
    known: true,
    cost: 3.99,
    free_shipping_threshold: 100,
    approval_note: "Confirmed directly by the retailer owner.",
  });
});

test("Fit House config contains exactly 52 unique approved mappings", () => {
  assert.equal(config.products.length, 52);

  for (const field of [
    "shopify_product_id",
    "shopify_variant_id",
    "canonical_slug",
    "expected_handle",
  ]) {
    const values = config.products.map((product) => product[field]);
    assert.equal(new Set(values).size, 52, `${field} must be unique`);
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

test("the approved first 22 mappings remain byte-for-byte unchanged", () => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(config.products.slice(0, 22)))
    .digest("hex");

  assert.equal(
    digest,
    "8c3294679b89b4816ab00007600bced52c4087cbe8050be738743a65354265a9"
  );
});

test("the approved first 38 mappings remain byte-for-byte unchanged", () => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(config.products.slice(0, 38)))
    .digest("hex");

  assert.equal(
    digest,
    "b0938d7117a0816b01ae5724efe5ec0258c76f9099e26abaaa3459a1378e5d82"
  );
});

test("batch two contains exactly the twelve approved new mappings", () => {
  const batchTwo = config.products.slice(10, 22);
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

test("batch three contains exactly the sixteen approved mappings", () => {
  const batchThree = config.products.slice(22, 38);
  const expectedProductIds = [
    "8271543730416", "8493486047472", "9370163708144", "9347715301616",
    "9347657269488", "9107338264816", "9060070064368", "9058975187184",
    "8969071853808", "8905761685744", "8816824549616", "8776332837104",
    "8776286798064", "8511414534384", "8493494370544", "8334171177200",
  ];

  assert.equal(batchThree.length, 16);
  assert.deepEqual(batchThree.map((product) => product.shopify_product_id), expectedProductIds);
  assert.deepEqual(
    batchThree.filter((product) => product.canonical_product_id !== null).map((product) => ({
      shopify_product_id: product.shopify_product_id,
      canonical_product_id: product.canonical_product_id,
    })),
    [{ shopify_product_id: "9347715301616", canonical_product_id: 43 }]
  );
  assert.equal(batchThree.filter((product) => product.canonical_product_id === null).length, 15);

  for (const product of batchThree) {
    assert.equal(product.approved_in_stock, true);
    assert.equal(product.is_for_sale, true);
    assert.ok(Number.isFinite(product.approved_price) && product.approved_price > 0);
    assert.ok(["Vitamins", "Amino Acids", "Health Supplements"].includes(product.category));
    assert.ok(["capsule", "powder", "tablet", "softgel"].includes(product.product_format));
  }
});

test("batch four contains exactly the fourteen approved new mappings", () => {
  const batchFour = config.products.slice(38);
  const expectedProductIds = [
    "8163807887600", "9370261913840", "9347456499952", "9179043856624",
    "8245425144048", "9059083157744", "8929298252016", "8776311636208",
    "8493540278512", "8479801114864", "8339449184496", "8333749092592",
    "8493491585264", "10077991993584",
  ];

  assert.equal(batchFour.length, 14);
  assert.deepEqual(batchFour.map((product) => product.shopify_product_id), expectedProductIds);

  for (const product of batchFour) {
    assert.equal(product.canonical_product_id, null);
    assert.equal(product.approved_in_stock, true);
    assert.equal(product.is_for_sale, true);
    assert.ok(Number.isFinite(product.approved_price) && product.approved_price > 0);
    assert.ok(["Vitamins", "Amino Acids", "Health Supplements", "Creatine"].includes(product.category));
    assert.ok(["capsule", "tablet", "powder"].includes(product.product_format));
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
    "Applied Nutrition",
  ]) {
    assert.ok(config.retailer.vendor_aliases.includes(alias), `missing alias: ${alias}`);
  }
});

test("approved batches exclude blocked image and separately deferred products", () => {
  const serialized = JSON.stringify(config.products).toLowerCase();
  assert.equal(serialized.includes("shilajit"), false);
  assert.equal(serialized.includes("ostrovit-creatine-monohydrate-300g"), false);
  for (const productId of ["8693101330672", "8271509946608", "8816846504176"]) {
    assert.equal(config.products.some((product) => product.shopify_product_id === productId), false);
  }
  for (const slug of ["now-foods-organic-inulin-prebiotic-powder", "osavi-cod-liver-oil-d3-250ml-lemon"]) {
    assert.equal(serialized.includes(slug), false);
  }
});

test("the tablet mapping preserves its approved orange flavour evidence", () => {
  const tablets = config.products.filter(
    (product) => product.product_format === "tablet"
  );

  const orangeElectrolytes = tablets.find(
    (product) => product.canonical_slug === "ostrovit-electrolytes-orange-20-effervescent-tablets"
  );
  assert.equal(orangeElectrolytes.flavour, "orange");
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
