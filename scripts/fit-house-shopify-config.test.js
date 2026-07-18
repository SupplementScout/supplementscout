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
      "7 Nutrition",
      "Reflex Nutrition",
      "Soma",
      "Animal",
      "Nordic Naturals",
      "Olimp",
      "Gym High",
    ],
  });
  assert.deepEqual(config.shipping, {
    known: true,
    cost: 3.99,
    free_shipping_threshold: 100,
    approval_note: "Confirmed directly by the retailer owner.",
  });
});

test("Fit House config contains 73 standard mappings and 12 verification-only variants", () => {
  const standard = config.products.filter((product) => product.verification_only !== true);
  const verificationOnly = config.products.filter((product) => product.verification_only === true);
  assert.equal(config.products.length, 85);
  assert.equal(standard.length, 73);
  assert.equal(verificationOnly.length, 12);

  for (const field of [
    "shopify_product_id",
    "canonical_slug",
    "expected_handle",
  ]) {
    const values = standard.map((product) => product[field]);
    assert.equal(new Set(values).size, 73, `${field} must be unique`);
  }
  assert.equal(new Set(config.products.map((product) => product.shopify_variant_id)).size, 85);
  assert.equal(new Set(verificationOnly.map((product) => product.canonical_variant_id)).size, 12);
});

test("verification-only entries have exact external and canonical variant evidence", () => {
  const entries = config.products.filter((product) => product.verification_only === true);
  assert.equal(entries.length, 12);
  for (const item of entries) {
    assert.match(item.shopify_product_id, /^\d+$/);
    assert.match(item.shopify_variant_id, /^\d+$/);
    assert.equal(Number.isInteger(item.canonical_product_id), true);
    assert.equal(Number.isInteger(item.canonical_variant_id), true);
    assert.equal(typeof item.expected_source_variant_title, "string");
    assert.ok(item.expected_source_variant_title.length > 0);
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

test("the approved first 52 mappings remain byte-for-byte unchanged", () => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(config.products.slice(0, 52)))
    .digest("hex");

  assert.equal(
    digest,
    "4e2b3b60924d944bca6274e4b63cf7cae6d9cfc4534cb1c82936e4e2129c9a49"
  );
});

test("the approved first 72 mappings remain byte-for-byte unchanged", () => {
  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(config.products.slice(0, 72)))
    .digest("hex");

  assert.equal(
    digest,
    "821db6d63c6f584776a74b6fabc3ad283a990be40332f0e81aac45520763ad58"
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
  const batchFour = config.products.slice(38, 52);
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

test("batch five contains exactly the twenty approved new mappings", () => {
  const batchFive = config.products.slice(52, 72);
  const expectedProductIds = [
    "8816846504176", "8693101330672", "8271509946608", "8968956084464",
    "8685938376944", "8147551846640", "9624501813488", "9623385932016",
    "9347614343408", "9176724177136", "9176635834608", "9174925803760",
    "9168643719408", "9097931817200", "8147560530160", "9060343709936",
    "9041428283632", "8333086884080", "9168824172784", "8273427333360",
  ];

  assert.equal(batchFive.length, 20);
  assert.deepEqual(batchFive.map((product) => product.shopify_product_id), expectedProductIds);

  for (const product of batchFive) {
    assert.equal(product.canonical_product_id, null);
    assert.equal(product.approved_in_stock, true);
    assert.equal(product.is_for_sale, true);
    assert.equal(product.pack_count, 1);
    assert.ok(Number.isFinite(product.approved_price) && product.approved_price > 0);
    assert.ok(["Health Supplements", "Vitamins", "Amino Acids"].includes(product.category));
    assert.ok(["capsule", "tablet", "powder", "softgel"].includes(product.product_format));
  }

  const egcg = batchFive.find((product) => product.shopify_product_id === "8816846504176");
  assert.match(egcg.canonical_name, /180 Capsules/);
  assert.match(egcg.canonical_slug, /180-capsules/);
  assert.doesNotMatch(`${egcg.canonical_name} ${egcg.canonical_slug}`, /90[ -]capsules/i);

  const berberine = batchFive.find((product) => product.shopify_product_id === "9168824172784");
  assert.equal(berberine.canonical_product_id, null);
  assert.match(berberine.canonical_name, /500mg 90 Capsules/);
});

test("the approved Fit House mapping targets existing canonical product 508", () => {
  const mapping = config.products[72];
  assert.deepEqual(mapping, {
    shopify_product_id: "9673951019248",
    shopify_variant_id: "48121139658992",
    expected_handle: "gym-high-shred-mode-60-capsules",
    canonical_product_id: 508,
    canonical_name: "GYM HIGH Shred Mode 60 Capsules",
    canonical_slug: "gym-high-shred-mode-60-capsules",
    brand: "GYM HIGH",
    category: "Health Supplements",
    product_format: "capsule",
    variant_name: "60 Capsules",
    size: null,
    size_unit: null,
    flavour: null,
    pack_count: 1,
    is_for_sale: true,
    approved_price: 39.99,
    approved_in_stock: true,
  });
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
    "7 Nutrition",
    "Reflex Nutrition",
    "Soma",
    "Animal",
    "Nordic Naturals",
    "Olimp",
    "Gym High",
  ]) {
    assert.ok(config.retailer.vendor_aliases.includes(alias), `missing alias: ${alias}`);
  }
});

test("approved batches exclude separately deferred products", () => {
  const serialized = JSON.stringify(config.products.filter((product) => product.verification_only !== true)).toLowerCase();
  assert.equal(serialized.includes("shilajit"), false);
  assert.equal(serialized.includes("ostrovit-creatine-monohydrate-300g"), false);
  for (const slug of ["osavi-cod-liver-oil-d3-250ml-lemon"]) {
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
