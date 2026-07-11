const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assessVariantCompatibility,
  buildRetailerProductPayload,
  findOrCreateProduct,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  getOfferUrl,
  getRetailerProductUrl,
  isAmbiguousFeedRow,
  isProductGtinVerified,
  parseArgs,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseStrictBoolean,
  parseSize,
  parseVariantIdentity,
  normalizeCategory,
  normalizeCanonicalRetailerFeedRows,
  normalizeShippingForImport,
  priceHistoryTotal,
  runImportRows,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
} = require("./import-products");

function baseFeedRow(overrides = {}) {
  return {
    retailer_name: "Retailer One",
    retailer_website: "https://retailer.test",
    product_name: "BioTech USA Iso Whey Zero 1816g Chocolate powder",
    slug: "biotech-usa-iso-whey-zero-1816g",
    brand: "BioTech USA",
    category: "Whey Protein",
    price: "29.99",
    shipping_cost: "0",
    in_stock: "true",
    url: "https://retailer.test/iso-whey-zero-chocolate",
    gtin: "0001234567890",
    ...overrides,
  };
}

function baseSafeCreateFeedRow(overrides = {}) {
  return baseFeedRow({
    retailer_name: "Simply Supplements",
    retailer_website: "https://www.simplysupplements.co.uk",
    merchant_id: "5959",
    merchant_name: "Simply Supplements",
    product_name: "Vitamin C 500mg Capsules",
    slug: "vitamin-c-500mg-capsules",
    brand: "Simply Supplements",
    category: "Vitamins",
    price: "4.99",
    shipping_cost: undefined,
    delivery_cost: "",
    in_stock: "true",
    is_for_sale: "1",
    image: "https://cdn.example.test/vitamin-c.jpg",
    merchant_image_url: "https://cdn.example.test/vitamin-c.jpg",
    gtin: "",
    external_gtin: "5056049515772",
    product_gtin_verified: "false",
    external_id: "C149",
    merchant_product_id: "C149",
    aw_product_id: "45010750732",
    external_name: "Vitamin C 500mg Capsules",
    external_url: "https://www.simplysupplements.co.uk/products/vitamin-c-500mg",
    merchant_deep_link: "https://www.simplysupplements.co.uk/products/vitamin-c-500mg",
    aw_deep_link: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    affiliate_url: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    url: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    evidence_name: "Vitamin C 500mg Capsules",
    evidence_size: "500mg",
    evidence_format: "capsules",
    ...overrides,
  });
}

function baseCanonicalFeedRow(overrides = {}) {
  return {
    retailer_name: "Example Nutrition",
    retailer_website: "https://example.test",
    external_product_id: "prod_100",
    external_variant_id: "var_100_500",
    product_name: "Example Creatine Monohydrate 500g",
    variant_name: "Unflavoured / 500g",
    brand: "Example Nutrition",
    category: "Creatine",
    description: "Pure creatine monohydrate",
    image: "https://example.test/images/creatine.jpg",
    slug: "example-creatine-monohydrate-500g",
    external_url: "https://example.test/products/creatine?variant=var_100_500",
    affiliate_url: "https://example.test/products/creatine?variant=var_100_500",
    external_gtin: "5012345678901",
    price: "19.99",
    shipping_known: "false",
    shipping_cost: "",
    in_stock: "true",
    is_for_sale: "true",
    size: "500",
    size_unit: "g",
    flavour: "unflavoured",
    product_format: "powder",
    pack_count: "1",
    source_updated_at: "2026-07-10T09:30:00Z",
    ...overrides,
  };
}

function createMockSupabase(seed = {}) {
  const tables = {
    retailers: seed.retailers || [
      { id: "r1", name: "Retailer One", slug: "retailer-one" },
    ],
    products: seed.products || [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: null,
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
    retailer_products: seed.retailer_products || [],
    offers: seed.offers || [],
    price_history: seed.price_history || [],
  };
  const writes = [];
  const operations = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.payload = null;
      this.limitCount = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    insert(payload) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload) {
      this.operation = "upsert";
      this.payload = payload;
      return this;
    }

    matchingRows() {
      return tables[this.table].filter((row) =>
        this.filters.every((filter) => String(row[filter.field]) === String(filter.value))
      );
    }

    executeRead() {
      operations.push({ type: "read", table: this.table, filters: this.filters });
      const rows = this.matchingRows();
      return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
    }

    executeWrite() {
      operations.push({ type: "write", table: this.table, operation: this.operation });
      writes.push({ table: this.table, operation: this.operation, payload: this.payload });

      if (this.operation === "insert") {
        const row = {
          ...this.payload,
          id: this.payload.id || `${this.table}-${tables[this.table].length + 1}`,
        };
        tables[this.table].push(row);
        return row;
      }

      if (this.operation === "update") {
        const rows = this.matchingRows();
        for (const row of rows) {
          Object.assign(row, this.payload);
        }
        return rows[0] || null;
      }

      if (this.operation === "upsert") {
        const existing = tables[this.table].find((row) =>
          this.table === "retailer_products"
            ? row.retailer_id === this.payload.retailer_id &&
              row.external_url === this.payload.external_url
            : false
        );

        if (existing) {
          Object.assign(existing, this.payload);
          return existing;
        }

        tables[this.table].push({ ...this.payload });
        return this.payload;
      }

      return null;
    }

    maybeSingle() {
      return Promise.resolve({ data: this.executeRead()[0] || null, error: null });
    }

    single() {
      if (this.operation === "select") {
        return Promise.resolve({ data: this.executeRead()[0] || null, error: null });
      }

      return Promise.resolve({ data: this.executeWrite(), error: null });
    }

    then(resolve, reject) {
      try {
        if (this.operation === "select") {
          resolve({ data: this.executeRead(), error: null });
          return;
        }

        this.executeWrite();
        resolve({ error: null });
      } catch (error) {
        reject(error);
      }
    }
  }

  return {
    tables,
    writes,
    operations,
    from(table) {
      return new Query(table);
    },
  };
}

async function assertInvalidFeedRowHasZeroWrites(overrides) {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow(overrides)], { mode: "feed" });

  assert.equal(result.report.invalidRows.length, 1);
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(supabase.writes.length, 0);
}

async function preflightExistingOffer({ rowOverrides = {}, offerOverrides = {} } = {}) {
  const row = baseFeedRow(rowOverrides);
  const supabase = createMockSupabase({
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        price: 29.99,
        shipping_cost: 0,
        total_price: 29.99,
        in_stock: true,
        url: baseFeedRow().url,
        ...offerOverrides,
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    dryRun: true,
  });

  return { report: result.report, result, supabase };
}

test("normalizes pre-workout variants to Pre Workout", () => {
  assert.equal(normalizeCategory("Pre-Workout"), "Pre Workout");
  assert.equal(normalizeCategory("pre-workout"), "Pre Workout");
  assert.equal(normalizeCategory(" PRE-WORKOUT "), "Pre Workout");
});

test("normalizes mapped supplement category aliases", () => {
  assert.equal(normalizeCategory("Creatine Supplements"), "Creatine");
  assert.equal(normalizeCategory("Amino Acid Supplements"), "Amino Acids");
});

test("leaves product-level categories unmapped except whitespace cleanup", () => {
  assert.equal(normalizeCategory("Health Supplements"), "Health Supplements");
  assert.equal(normalizeCategory("Protein Powder"), "Protein Powder");
  assert.equal(normalizeCategory("  Whey   Protein  "), "Whey Protein");
  assert.equal(normalizeCategory(" Weight Management "), "Weight Management");
});

test("logs only when canonical mapping changes category after whitespace cleanup", () => {
  assert.equal(
    shouldLogCategoryNormalization(" Pre-Workout ", normalizeCategory(" Pre-Workout ")),
    true
  );
  assert.equal(
    shouldLogCategoryNormalization("Whey   Protein", normalizeCategory("Whey   Protein")),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization(
      "Health Supplements",
      normalizeCategory("Health Supplements")
    ),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization("pre-workout", normalizeCategory("pre-workout")),
    true
  );
});

test("feed GTIN is blocked from products.gtin unless explicitly product-verified", () => {
  const flavourSpecificRow = {
    import_mode: "awin",
    product_name: "Optimum Nutrition Gold Standard Whey 908g Chocolate",
    gtin: "5060469989242",
  };

  assert.equal(getExternalGtin(flavourSpecificRow), "5060469989242");
  assert.equal(getProductLevelGtin(flavourSpecificRow, "feed"), null);
  assert.equal(
    getProductLevelGtin({
      ...flavourSpecificRow,
      product_gtin_verified: "true",
    }, "feed"),
    "5060469989242"
  );
});

test("product GTIN verification flags stay false unless explicitly truthy", () => {
  for (const value of [false, undefined, null, "", "false", "0", "definitely"]) {
    assert.equal(isProductGtinVerified({ product_gtin_verified: value }), false);
    assert.equal(parseStrictBoolean(value), false);
  }

  assert.equal(isProductGtinVerified({ product_gtin_verified: "true" }), true);
  assert.equal(isProductGtinVerified({ product_gtin_verified: "1" }), true);
});

test("legacy manually imported GTIN behaviour remains intact", () => {
  assert.equal(
    getProductLevelGtin({
      product_name: "Verified Manual Product",
      gtin: "5060469983615",
    }),
    "5060469983615"
  );
});

test("variant parsing extracts conservative flavour, size, pack count, and format", () => {
  assert.equal(parseFlavour("Chocolate flavour"), "chocolate");
  assert.deepEqual(parseSize("908g"), {
    value: 908,
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("0.908kg"), {
    value: 908,
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("Optimum Nutrition Whey 2.27kg"), {
    value: 2270,
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("2,27kg"), {
    value: 2270,
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("1.8 kg"), {
    value: 1800,
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("500ml"), {
    value: 500,
    unit: "ml",
    dimension: "volume",
  });
  assert.equal(parsePackCount("Barebells Vegan Protein Bars 12x55g"), 12);
  assert.equal(parsePackCount("Barebells Vegan Protein Bars 12 x 55 g"), 12);
  assert.equal(parsePackCount("pack of 12"), 12);
  assert.equal(parsePackCount("single bar"), 1);
  assert.equal(parsePackCount("30 servings"), null);
  assert.equal(parseProductFormat("60 capsules"), "capsule");
  assert.equal(parseProductFormat("60 caps"), "capsule");
  assert.equal(parseProductFormat("120 tablets"), "tablet");
  assert.equal(parseProductFormat("ready to drink liquid 500ml"), "liquid");
  assert.equal(parseProductFormat("ready-to-drink"), "liquid");
  assert.equal(parseProductFormat("whey powder"), "powder");
  assert.equal(parseProductFormat("unclear merch item"), null);
});

test("908g feed row does not match 2.27kg product", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Optimum Nutrition Gold Standard Whey 908g Chocolate",
      brand: "Optimum Nutrition",
    },
    {
      name: "Optimum Nutrition Gold Standard Whey 2.27kg",
      brand: "Optimum Nutrition",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("size conflict"));
});

test("single bar does not match 12-pack", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Barebells Vegan Protein Bar single bar 55g Salty Peanut",
      brand: "Barebells",
    },
    {
      name: "Barebells Vegan Protein Bars 12x55g",
      brand: "Barebells",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(
    compatibility.reasons.includes("pack-count conflict") ||
      compatibility.reasons.includes("single item conflicts with multipack")
  );
});

test("powder does not match capsules", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Optimum Nutrition Creatine Powder 300g",
      brand: "Optimum Nutrition",
    },
    {
      name: "Optimum Nutrition Creatine 2500mg Capsules",
      brand: "Optimum Nutrition",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("format conflict"));
});

test("missing optional variant data lowers evidence but does not block compatibility", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "BioTech USA Iso Whey Zero powder",
      brand: "BioTech USA",
    },
    {
      name: "BioTech USA Iso Whey Zero 1816g powder",
      brand: "BioTech USA",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert(compatibility.warnings.includes("incomplete size evidence"));
});

test("ambiguous feed rows are skipped", () => {
  const row = {
    product_name: "Mystery Supplement",
    brand: "Unknown",
  };

  assert.equal(isAmbiguousFeedRow(row), true);
});

test("external_gtin is the storage target for unverified feed GTINs", () => {
  const row = {
    import_mode: "awin",
    product_name: "Rule1 R1 Protein 2.2kg Vanilla powder",
    gtin: "858925004081",
  };
  const identity = parseVariantIdentity({
    ...row,
  });
  const payload = buildRetailerProductPayload({
    row,
    retailerId: "3",
    productId: "182",
    name: row.product_name,
    slug: "rule1-r1-protein-22kg-vanilla",
    offerUrl: "https://example.com/rule1-r1-protein-22kg-vanilla",
    matchMethod: "slug",
    matchConfidence: 90,
  });

  assert.equal(identity.flavour, "vanilla");
  assert.equal(identity.productFormat, "powder");
  assert.equal(getExternalGtin({ gtin: "858925004081" }), "858925004081");
  assert.equal(getProductLevelGtin(row, "feed"), null);
  assert.equal(payload.external_gtin, "858925004081");
  assert.equal(payload.product_id, "182");
});

test("feed mode is explicit and ordinary CSV columns do not activate it", () => {
  assert.equal(parseArgs([]).mode, "manual");
  assert.equal(parseArgs(["--mode=feed"]).mode, "feed");
  assert.equal(parseArgs(["--mode=feed", "--safe-create"]).safeCreate, true);
  assert.throws(() => parseArgs(["--safe-create"]), /only supported with --mode=feed/);
  assert.equal(getProductLevelGtin({ import_mode: "awin", gtin: "123" }), "123");
  assert.equal(getProductLevelGtin({ import_mode: "awin", gtin: "123" }, "feed"), null);
});

test("valid canonical retailer feed passes existing safe-create preflight", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseCanonicalFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("canonical signature triggers full required-header validation", async () => {
  const row = baseCanonicalFeedRow();
  delete row.affiliate_url;

  await assert.rejects(
    () => runImportRows([row], { mode: "feed", dryRun: true }),
    /missing required column\(s\): affiliate_url/
  );
});

test("variant_name alone does not activate canonical normalization", () => {
  const rows = [baseFeedRow({ variant_name: "Chocolate" })];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("size_unit alone does not activate canonical normalization", () => {
  const rows = [baseFeedRow({ size_unit: "g" })];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("external IDs without shipping_known do not activate canonical normalization", () => {
  const rows = [
    baseFeedRow({ external_product_id: "prod_100", external_variant_id: "var_100" }),
  ];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("canonical retailer feed rejects forbidden product verification columns", async () => {
  await assert.rejects(
    () =>
      runImportRows(
        [baseCanonicalFeedRow({ serving_count_verified: "50" })],
        { mode: "feed", dryRun: true }
      ),
    /forbidden column\(s\): serving_count_verified/
  );
});

test("canonical shipping validation distinguishes unknown, free, and paid shipping", () => {
  const unknown = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "false", shipping_cost: "" }),
  ])[0];
  const free = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "0" }),
  ])[0];
  const paid = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "2.99" }),
  ])[0];

  assert.equal(unknown.shipping_cost, null);
  assert.equal(free.shipping_cost, 0);
  assert.equal(paid.shipping_cost, 2.99);
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({ shipping_known: "false", shipping_cost: "2.99" }),
      ]),
    /shipping_cost must be blank when shipping_known is false/
  );
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "" }),
      ]),
    /shipping_cost is required when shipping_known is true/
  );
});

test("canonical variant fields map to evidence understood by variant guards", () => {
  const originalRow = baseCanonicalFeedRow({
    variant_name: "Unflavoured / 500g",
    size: "500",
    size_unit: "g",
    pack_count: "2",
  });
  const [row] = normalizeCanonicalRetailerFeedRows([originalRow]);
  const identity = parseVariantIdentity(row);

  assert.notStrictEqual(row, originalRow);
  assert.equal(originalRow.size, "500");
  assert.equal(Object.prototype.hasOwnProperty.call(originalRow, "variant"), false);
  assert.equal(row.size, "500 g");
  assert.match(row.variant, /Unflavoured \/ 500g/);
  assert.equal(identity.size.value, 500);
  assert.equal(identity.size.unit, "g");
  assert.equal(identity.flavour, "unflavoured");
  assert.equal(identity.packCount, 2);
});

test("canonical shipping ignores delivery_cost as an alternative", () => {
  const [unknown] = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({
      shipping_known: "false",
      shipping_cost: "",
      delivery_cost: "4.99",
    }),
  ]);

  assert.equal(unknown.shipping_cost, null);
  assert.equal(unknown.delivery_cost, undefined);
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({
          shipping_known: "true",
          shipping_cost: "",
          delivery_cost: "4.99",
        }),
      ]),
    /shipping_cost is required when shipping_known is true/
  );
});

test("legacy Awin-shaped feeds bypass canonical normalization", () => {
  const rows = [baseSafeCreateFeedRow()];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("default feed mode remains match-only for unmatched rows", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseSafeCreateFeedRow()], { mode: "feed" });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.unmatchedRows.length, 1);
  assert.equal(result.report.newRetailersToCreate.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create approves safe unmatched rows for planned creation", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.unmatchedRows.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 1);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.retailerProductsToCreate.length, 1);
  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(result.report.shippingInferredFromPolicy.length, 1);
  assert.equal(result.report.productGtinBlocked.length, 1);
  assert.equal(result.report.externalGtinStoredOrUpdated.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("offer preflight plans a new offer and price history row", async () => {
  const supabase = createMockSupabase({ offers: [] });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 0);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("offer preflight marks an identical offer unchanged", async () => {
  const { report, supabase } = await preflightExistingOffer();

  assert.equal(report.offersToCreate.length, 0);
  assert.equal(report.offersToUpdate.length, 0);
  assert.equal(report.offersUnchanged.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
});

test("offer preflight plans price changes with price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { price: "31.99" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.priceChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 1);
});

test("offer preflight plans shipping changes with price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { shipping_cost: "1.49" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.shippingChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 1);
});

test("offer preflight preserves existing shipping when feed shipping is unknown", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { shipping_cost: undefined, delivery_cost: "" },
    offerOverrides: { shipping_cost: 2.99, total_price: 32.98 },
  });

  assert.equal(report.offersToUpdate.length, 0);
  assert.equal(report.offersUnchanged.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight classifies stock-only changes without price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { in_stock: "false" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 1);
  assert.equal(report.urlOnlyChanges.length, 0);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight classifies URL-only changes without price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { affiliate_url: "https://affiliate.test/new-offer" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 0);
  assert.equal(report.urlOnlyChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight does not call combined stock and URL changes only changes", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: {
      in_stock: "false",
      affiliate_url: "https://affiliate.test/new-offer",
    },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 0);
  assert.equal(report.urlOnlyChanges.length, 0);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("formatPreflightReport includes detailed offer plan counters", async () => {
  const { report } = await preflightExistingOffer();
  const output = formatPreflightReport(report);

  assert.match(output, /offers would be created: 0/);
  assert.match(output, /offers would be updated: 0/);
  assert.match(output, /offers unchanged: 1/);
  assert.match(output, /price_history rows would be created: 0/);
  assert.match(output, /price changes: 0/);
  assert.match(output, /shipping changes: 0/);
  assert.match(output, /stock-only changes: 0/);
  assert.match(output, /URL-only changes: 0/);
});

test("safe-create requires is_for_sale to be present and true", async () => {
  for (const overrides of [
    { is_for_sale: undefined },
    { is_for_sale: "" },
    { is_for_sale: "false" },
    { is_for_sale: "0" },
    { is_for_sale: "no" },
    { is_for_sale: "not-sure" },
  ]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow(overrides)], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.invalidRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }

  for (const is_for_sale of ["true", "1", "yes"]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow({ is_for_sale })], {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });

    assert.equal(result.report.approvedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("safe-create blocks variant-ambiguous new product rows", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [
      baseSafeCreateFeedRow({
        product_name: "Mystery Supplement",
        external_name: "Mystery Supplement",
        slug: "mystery-supplement",
        description: "Unclear supplement with no useful product identity evidence",
        evidence_name: "",
        evidence_size: "",
        evidence_format: "",
      }),
    ],
    { mode: "feed", safeCreate: true }
  );

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create only allows approved supplement categories", async () => {
  for (const category of ["Vitamins", "Health Supplements", "Amino Acids", "Creatine"]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [baseSafeCreateFeedRow({ category, product_name: `${category} 500mg Capsules`, slug: `${category.toLowerCase().replace(/\s+/g, "-")}-500mg-capsules` })],
      { mode: "feed", safeCreate: true, dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }

  for (const category of [
    "Accessories",
    "Whey Protein",
    "Protein Bars",
    "Mass Gainer",
    "Pre Workout",
    "Weight Management",
    "Unclear",
  ]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow({ category })], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.exclusions.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("safe-create dry-run reports planned rows instead of skipped approved rows", async () => {
  const safeSupabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(safeSupabase);

  const safeResult = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(safeResult.planned, 1);
  assert.equal(safeResult.skipped, 0);
  assert.equal(safeSupabase.writes.length, 0);

  const matchOnlySupabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(matchOnlySupabase);

  const matchOnlyResult = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(matchOnlyResult.planned, 0);
  assert.equal(matchOnlyResult.skipped, 1);
  assert.equal(matchOnlySupabase.writes.length, 0);
});

test("Simply Supplements sample-shaped safe-create rows still approve twenty rows", async () => {
  const productNames = [
    "Vitamin C 500mg Capsules",
    "Immunity Support with Vitamin C, Vitamin D & Zinc",
    "Multivitamins A,B,C,D & E 100% NRV",
    "Vitamin D3 Tablets 2,000iu",
    "Gentle Vitamin C 1000mg Capsules",
    "Glucosamine Sulphate 500mg",
    "Glucosamine Sulphate 1,000mg - Tablets",
    "Vitamin B Complex Tablets",
    "Zinc Tablets 15mg",
    "Cod Liver Oil Capsules 550mg",
    "Omega 3 Capsules 500mg",
    "Omega 3 for Kids 500mg",
    "Selenium 220mcg with Multivitamins & Iron",
    "Folic Acid 400mcg",
    "Glucosamine 1,000mg with Vitamin C Tablets",
    "Potassium Chloride 1000mg",
    "Biotin Tablets 10,000mcg",
    "Chewable Calcium & Vitamin D3 Tablets",
    "Cod Liver Oil Capsules 1,000mg",
    "Max Strength Glucosamine Sulphate 1858mg 2KCl",
  ];
  const rows = productNames.map((product_name, index) =>
    baseSafeCreateFeedRow({
      product_name,
      external_name: product_name,
      slug: `simply-sample-${index + 1}`,
      category: index === 5 || index === 6 || index === 14 || index === 15 || index === 19
        ? "Health Supplements"
        : "Vitamins",
      external_gtin: `505604951${String(1000 + index).padStart(4, "0")}`,
      external_id: `C${100 + index}`,
      merchant_product_id: `C${100 + index}`,
      merchant_deep_link: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      external_url: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      direct_url: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      aw_deep_link: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      affiliate_url: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      url: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      description: `${product_name} capsules tablets supplement`,
      evidence_name: product_name,
      evidence_size: product_name,
      evidence_format: product_name,
    })
  );
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 20);
  assert.equal(result.report.ambiguousRows.length, 0);
  assert.equal(result.planned, 20);
  assert.equal(result.skipped, 0);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create writes direct retailer URL to mapping and affiliate URL to offer", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const row = baseSafeCreateFeedRow();
  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
  });
  const mappingWrite = supabase.writes.find(
    (write) => write.table === "retailer_products"
  );
  const offerWrite = supabase.writes.find((write) => write.table === "offers");
  const productWrite = supabase.writes.find((write) => write.table === "products");

  assert.equal(result.successful, 1);
  assert.equal(getRetailerProductUrl(row), row.merchant_deep_link);
  assert.equal(getOfferUrl(row), row.aw_deep_link);
  assert.equal(mappingWrite.payload.external_url, row.merchant_deep_link);
  assert.equal(mappingWrite.payload.external_gtin, row.external_gtin);
  assert.equal(offerWrite.payload.url, row.aw_deep_link);
  assert.equal(offerWrite.payload.shipping_cost, 1.99);
  assert.equal(offerWrite.payload.total_price, 6.98);
  assert.equal(Object.prototype.hasOwnProperty.call(productWrite.payload, "gtin"), false);
});

test("safe-create blocks excluded and unsafe rows", async () => {
  const cases = [
    { product_name: "CBD Oil Capsules", description: "CBD supplement" },
    { product_name: "Dog Multivitamin Tablets", description: "pet vitamins" },
    { product_name: "Magnesium Massage Gel", description: "topical massage gel" },
    { product_name: "Vitamin D Blood Test Kit", description: "medical test kit" },
    { aw_deep_link: "", affiliate_url: "", url: "" },
    { merchant_deep_link: "", external_url: "", direct_url: "" },
  ];

  for (const overrides of cases) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow(overrides)], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(supabase.writes.length, 0);
  }
});

test("feed collision group produces zero writes and is order independent", async () => {
  const rows = [
    baseFeedRow(),
    baseFeedRow({
      product_name: "BioTech USA Iso Whey Zero 1816g Vanilla powder",
      url: "https://retailer.test/iso-whey-zero-vanilla",
      gtin: "0001234567891",
    }),
  ];

  for (const orderedRows of [rows, [...rows].reverse()]) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);

    const result = await runImportRows(orderedRows, { mode: "feed" });

    assert.equal(result.report.collisionGroups.length, 1);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.externalGtinStoredOrUpdated.length, 0);
    assert.equal(result.report.productGtinBlocked.length, 0);
    assert.equal(supabase.writes.length, 0);
  }
});

test("no writes occur before complete feed preflight", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ gtin: "" })], { mode: "feed" });

  const firstWrite = supabase.operations.findIndex((operation) => operation.type === "write");
  const readsBeforeFirstWrite = supabase.operations
    .slice(0, firstWrite)
    .filter((operation) => operation.type === "read");

  assert(firstWrite > -1);
  assert(readsBeforeFirstWrite.length >= 3);
});

test("conflicting verified product GTIN produces zero product GTIN update", async () => {
  const supabase = createMockSupabase({
    products: [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: "existing-gtin",
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [baseFeedRow({ product_gtin_verified: "true", gtin: "different-gtin" })],
    { mode: "feed" }
  );

  assert.equal(result.report.gtinConflicts.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("identical existing product GTIN is accepted unchanged", async () => {
  const supabase = createMockSupabase({
    products: [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: "0001234567890",
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [baseFeedRow({ product_gtin_verified: "true" })],
    { mode: "feed" }
  );
  assert.equal(result.report.gtinConflicts.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
});

test("existing canonical product is never updated by a canonical retailer feed", async () => {
  const existingProduct = {
    id: "p1",
    name: "BioTech USA Iso Whey Zero 1816g powder",
    slug: "biotech-usa-iso-whey-zero-1816g",
    brand: "BioTech USA",
    category: "Whey Protein",
    servings: 50,
    description: "Existing canonical description",
    image: "https://canonical.test/existing.jpg",
    price: 44.99,
    gtin: "0001234567890",
    net_weight_g: 1816,
    net_volume_ml: 500,
    serving_count_verified: 50,
    serving_size_g: 36,
    serving_size_ml: 10,
    protein_per_serving_g: 25,
    creatine_per_serving_g: 3,
    unit_count: 60,
    unit_type: "scoop",
    product_format: "powder",
    unit_pricing_verified: true,
    nutrition_verified: true,
  };
  const supabase = createMockSupabase({
    products: [{ ...existingProduct }],
  });
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ description: "", image: "https://retailer.test/new.jpg", price: "29.99" })],
    { mode: "feed" }
  );

  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
  assert.deepEqual(supabase.tables.products[0], existingProduct);
  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.retailer_products[0].external_gtin, "0001234567890");
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].price, 29.99);
  assert.equal(supabase.tables.price_history.length, 1);
  assert.equal(supabase.tables.price_history[0].price, 29.99);
});

test("feed-style findOrCreateProduct preserves an existing canonical product", async () => {
  const existingProduct = {
    id: "p1",
    name: "BioTech USA Iso Whey Zero 1816g powder",
    slug: "biotech-usa-iso-whey-zero-1816g",
    brand: "BioTech USA",
    category: "Whey Protein",
    description: "Keep this description",
    image: "https://canonical.test/image.jpg",
    price: 44.99,
  };
  const supabase = createMockSupabase({ products: [{ ...existingProduct }] });
  setSupabaseForTests(supabase);

  const productId = await findOrCreateProduct(
    baseFeedRow({ description: "", image: "https://retailer.test/new.jpg" }),
    2,
    "r1",
    { mode: "feed" }
  );

  assert.equal(productId, "p1");
  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
  assert.deepEqual(supabase.tables.products[0], existingProduct);
  assert.equal(supabase.tables.retailer_products.length, 1);
});

test("new product create keeps the full validated product payload", async () => {
  const supabase = createMockSupabase({ products: [] });
  setSupabaseForTests(supabase);

  await runImportRows(
    [
      baseSafeCreateFeedRow({
        gtin: "5056049515772",
        external_gtin: "5056049515772",
        product_gtin_verified: "true",
        net_weight_g: "60",
        serving_count_verified: "60",
        serving_size_g: "1",
        protein_per_serving_g: "0.5",
        creatine_per_serving_g: "0.2",
        unit_count: "60",
        unit_type: "capsule",
        product_format: "capsule",
        unit_pricing_verified: "true",
        nutrition_verified: "true",
      }),
    ],
    { mode: "feed", safeCreate: true }
  );

  const productInsert = supabase.writes.find(
    (write) => write.table === "products" && write.operation === "insert"
  );

  assert(productInsert);
  assert.equal(productInsert.payload.gtin, "5056049515772");
  assert.equal(productInsert.payload.net_weight_g, 60);
  assert.equal(productInsert.payload.serving_count_verified, 60);
  assert.equal(productInsert.payload.product_format, "capsule");
  assert.equal(productInsert.payload.unit_pricing_verified, true);
  assert.equal(productInsert.payload.nutrition_verified, true);
});

test("existing mapping stores compatible external_gtin", async () => {
  const supabase = createMockSupabase({
    retailer_products: [
      {
        retailer_id: "r1",
        product_id: "p1",
        external_url: "https://retailer.test/iso-whey-zero-chocolate",
        external_gtin: null,
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], { mode: "feed" });

  assert.equal(result.report.externalGtinStoredOrUpdated.length, 1);
  assert.equal(
    supabase.writes.some(
      (write) =>
        write.table === "retailer_products" &&
        write.payload.external_gtin === "0001234567890"
    ),
    true
  );
});

test("conflicting existing external_gtin is blocked", async () => {
  const supabase = createMockSupabase({
    retailer_products: [
      {
        retailer_id: "r1",
        product_id: "p1",
        external_url: "https://retailer.test/iso-whey-zero-chocolate",
        external_gtin: "existing-external-gtin",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], { mode: "feed" });

  assert.equal(result.report.externalGtinConflicts.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("repeated identical feed rows are deduplicated and reruns are idempotent", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const rows = [baseFeedRow({ gtin: "" }), baseFeedRow({ gtin: "" })];
  const first = await runImportRows(rows, { mode: "feed" });
  const writesAfterFirstRun = supabase.writes.length;
  const second = await runImportRows(rows, { mode: "feed" });

  assert.equal(first.report.deduplicatedRows.length, 1);
  assert.equal(first.report.approvedRows.length, 1);
  assert.equal(second.report.deduplicatedRows.length, 1);
  assert.equal(second.report.approvedRows.length, 1);
  assert(supabase.writes.length > writesAfterFirstRun);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
});

test("invalid feed prices produce zero writes", async () => {
  await assertInvalidFeedRowHasZeroWrites({ price: undefined });
  await assertInvalidFeedRowHasZeroWrites({ price: "" });
  await assertInvalidFeedRowHasZeroWrites({ price: "0" });
  await assertInvalidFeedRowHasZeroWrites({ price: "-1" });
  await assertInvalidFeedRowHasZeroWrites({ price: "NaN" });
  await assertInvalidFeedRowHasZeroWrites({ price: "Infinity" });
});

test("invalid feed shipping produces zero writes", async () => {
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "NaN" });
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "Infinity" });
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "-1" });
  await assertInvalidFeedRowHasZeroWrites({
    shipping_cost: undefined,
    delivery_cost: "NaN",
  });
});

test("unknown feed shipping remains allowed", async () => {
  for (const shipping_cost of [undefined, "", null]) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseFeedRow({ gtin: "", shipping_cost })], {
      mode: "feed",
    });

    assert.equal(result.report.invalidRows.length, 0);
    assert.equal(result.report.approvedRows.length, 1);
    assert(supabase.writes.length > 0);
  }
});

test("existing offer keeps known shipping when feed shipping is unknown", async () => {
  const supabase = createMockSupabase({
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        price: 10,
        shipping_cost: 2.99,
        total_price: 12.99,
      },
    ],
  });
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ price: "10", shipping_cost: undefined, delivery_cost: "", gtin: "" })],
    { mode: "feed" }
  );

  const offerUpdate = supabase.writes.find(
    (write) => write.table === "offers" && write.operation === "update"
  );
  const historyWrites = supabase.writes.filter(
    (write) => write.table === "price_history"
  );

  assert.equal(offerUpdate.payload.shipping_cost, 2.99);
  assert.equal(offerUpdate.payload.total_price, 12.99);
  assert.equal(historyWrites.length, 0);
});

test("existing offer records explicit shipping changes including free delivery", async () => {
  for (const [shipping_cost, expectedTotal] of [["0", 10], ["1.49", 11.49]]) {
    const supabase = createMockSupabase({
      offers: [
        {
          id: "o1",
          product_id: "p1",
          retailer_id: "r1",
          price: 10,
          shipping_cost: 2.99,
          total_price: 12.99,
        },
      ],
    });
    setSupabaseForTests(supabase);

    await runImportRows(
      [baseFeedRow({ price: "10", shipping_cost, gtin: "" })],
      { mode: "feed" }
    );

    const offerUpdate = supabase.writes.find(
      (write) => write.table === "offers" && write.operation === "update"
    );
    const historyWrite = supabase.writes.find(
      (write) => write.table === "price_history"
    );

    assert.equal(offerUpdate.payload.shipping_cost, Number(shipping_cost));
    assert.equal(offerUpdate.payload.total_price, expectedTotal);
    assert.equal(historyWrite.payload.shipping_cost, Number(shipping_cost));
    assert.equal(historyWrite.payload.total_price, expectedTotal);
  }
});

test("new offer without shipping keeps null shipping and total", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ shipping_cost: undefined, delivery_cost: "", gtin: "" })],
    { mode: "feed" }
  );

  const offerInsert = supabase.writes.find(
    (write) => write.table === "offers" && write.operation === "insert"
  );

  assert.equal(offerInsert.payload.shipping_cost, null);
  assert.equal(offerInsert.payload.total_price, null);
});

test("Simply Supplements blank delivery is inferred from retailer policy", async () => {
  const cases = [
    { price: "4.99", expectedShipping: 1.99, expectedTotal: 6.98 },
    { price: "19.99", expectedShipping: 1.99, expectedTotal: 21.98 },
    { price: "20.00", expectedShipping: 0, expectedTotal: 20 },
    { price: "23.99", expectedShipping: 0, expectedTotal: 23.99 },
    { price: "25.00", expectedShipping: 0, expectedTotal: 25 },
  ];

  for (const { price, expectedShipping, expectedTotal } of cases) {
    const row = baseFeedRow({
      retailer_name: "Simply Supplements",
      retailer_website: "https://www.simplysupplements.co.uk",
      merchant_id: "5959",
      merchant_name: "Simply Supplements",
      price,
      shipping_cost: undefined,
      delivery_cost: "",
      gtin: "",
    });
    const supabase = createMockSupabase({
      retailers: [
        { id: "r1", name: "Simply Supplements", slug: "simply-supplements" },
      ],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([row], { mode: "feed" });
    const offerWrite = supabase.writes.find((write) => write.table === "offers");

    assert.equal(result.report.shippingInferredFromPolicy.length, 1);
    assert.equal(
      result.report.shippingInferredFromPolicy[0].reason,
      "shipping inferred from retailer policy"
    );
    assert.equal(offerWrite.payload.shipping_cost, expectedShipping);
    assert.equal(offerWrite.payload.total_price, expectedTotal);
    assert.notEqual(offerWrite.payload.total_price, 0);
  }
});

test("other retailer blank delivery does not infer shipping", () => {
  const result = normalizeShippingForImport(
    baseFeedRow({ shipping_cost: undefined, delivery_cost: "" }),
    "feed"
  );

  assert.equal(result.shippingInferredFromPolicy, false);
  assert.equal(result.row.shipping_cost, null);
});

test("valid feed delivery_cost overrides inferred Simply Supplements rule", () => {
  const result = normalizeShippingForImport(
    baseFeedRow({
      retailer_name: "Simply Supplements",
      merchant_id: "5959",
      merchant_name: "Simply Supplements",
      price: "25.00",
      shipping_cost: undefined,
      delivery_cost: "2.49",
    }),
    "feed"
  );

  assert.equal(result.shippingInferredFromPolicy, false);
  assert.equal(result.row.shipping_cost, 2.49);
});

test("price history total is null when shipping is unknown", async () => {
  assert.equal(priceHistoryTotal("19.99", null), null);
  assert.equal(priceHistoryTotal("19.99", ""), null);
  assert.equal(priceHistoryTotal("19.99", 0), 19.99);

  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ gtin: "", shipping_cost: undefined, delivery_cost: "" })],
    { mode: "feed" }
  );

  const historyWrite = supabase.writes.find(
    (write) => write.table === "price_history"
  );
  const offerWrite = supabase.writes.find((write) => write.table === "offers");

  assert.equal(offerWrite.payload.shipping_cost, null);
  assert.equal(offerWrite.payload.total_price, null);
  assert.equal(historyWrite.payload.shipping_cost, null);
  assert.equal(historyWrite.payload.total_price, null);
});

test("manual import offer total_price uses known shipping", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ shipping_cost: "2.50" })]);

  const offerWrite = supabase.writes.find((write) => write.table === "offers");
  const historyWrite = supabase.writes.find(
    (write) => write.table === "price_history"
  );

  assert.equal(offerWrite.payload.total_price, 32.49);
  assert.equal(historyWrite.payload.total_price, 32.49);
  assert.notEqual(offerWrite.payload.total_price, 0);
});

test("additional variant conflicts are blocked", () => {
  const sizeConflict = assessVariantCompatibility(
    { product_name: "Test Product 1.8kg powder", brand: "Test" },
    { name: "Test Product 2kg powder", brand: "Test" }
  );
  const formatConflict = assessVariantCompatibility(
    { product_name: "Test Product 60 capsules", brand: "Test" },
    { name: "Test Product 120 tablets", brand: "Test" }
  );
  const liquidPowderConflict = assessVariantCompatibility(
    { product_name: "Test Product liquid 500ml", brand: "Test" },
    { name: "Test Product powder 500g", brand: "Test" }
  );

  assert.equal(sizeConflict.compatible, false);
  assert(sizeConflict.reasons.includes("size conflict"));
  assert.equal(formatConflict.compatible, false);
  assert(formatConflict.reasons.includes("format conflict"));
  assert.equal(liquidPowderConflict.compatible, false);
  assert(liquidPowderConflict.reasons.includes("size conflict"));
  assert(liquidPowderConflict.reasons.includes("format conflict"));
});

test("feed dry-run performs zero writes", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ gtin: "" })], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(supabase.writes.length, 0);
});

test("manual import path still performs retailer, product, offer, and price history writes", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ gtin: "manual-gtin" })], { mode: "manual" });

  assert.equal(supabase.writes.some((write) => write.table === "retailers"), true);
  assert.equal(supabase.writes.some((write) => write.table === "products"), true);
  assert.equal(supabase.writes.some((write) => write.table === "offers"), true);
  assert.equal(supabase.writes.some((write) => write.table === "price_history"), true);
});
