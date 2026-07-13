const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyArtifactPlan,
  approveArtifactPlan,
  assessVariantCompatibility,
  buildRetailerProductPayload,
  buildRowLevelOfferResults,
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
  parseExternalOptions,
  parseProductFormat,
  parseStrictBoolean,
  parseSize,
  parseVariantIdentity,
  normalizeCategory,
  normalizeCanonicalRetailerFeedRows,
  normalizeShippingForImport,
  priceHistoryTotal,
  runImportRows: runImportRowsRaw,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
  validatePilotApply,
  writeDryRunArtifact,
} = require("./import-products");
const { isSafeCreateRowAmbiguous } = require("./lib/feed-variant-guards");
const {
  canonicalJson,
  normalizeDecimalString,
} = require("./lib/canonical-json");

async function runImportRows(rows, options = {}) {
  if (options.dryRun) {
    return runImportRowsRaw(rows, options);
  }

  const preflight = await runImportRowsRaw(rows, { ...options, dryRun: true });
  const successfulRows = [];
  const failedRows = [];
  for (const item of preflight.report.approvedRows || []) {
    const row = rows[item.rowNumber - 2];
    const singlePreflight = await runImportRowsRaw([row], { ...options, dryRun: true });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-plan-test-"));
    const artifactPath = path.join(directory, "plan.json");
    try {
      const artifact = writeDryRunArtifact([row], singlePreflight, {
        artifactPath,
        sourceContent: JSON.stringify(row),
        sourceFileName: "test-row.json",
        environmentMarker: "test",
      });
      const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
      const approved = await approveArtifactPlan({ artifactPath, planFingerprint: fingerprint });
      const applied = await applyArtifactPlan({
        artifactPath,
        planFingerprint: fingerprint,
        approvalId: approved.approvalId,
        pilotApply: true,
      });
      successfulRows.push(...applied.successfulRows);
    } catch (error) {
      failedRows.push({ error: error?.message || String(error) });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  return {
    ...preflight,
    successful: successfulRows.length,
    failed: failedRows.length + (options.mode === "manual" ? preflight.blockedRows.length : 0),
    planned: 0,
    successfulRows,
    failedRows,
  };
}

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
    product_variants: seed.product_variants || [],
    retailer_products: seed.retailer_products || [],
    offers: seed.offers || [],
    price_history: seed.price_history || [],
  };
  if (seed.product_variants === undefined) {
    tables.product_variants = tables.products.map((product, index) => ({
      id: `default-variant-${index + 1}`,
      product_id: product.id,
      variant_key: "default",
      display_name: "Default",
      flavour_code: null,
      flavour_label: null,
      size_value: null,
      size_unit: null,
      pack_count: null,
      product_format: null,
      is_active: true,
      is_default: true,
    }));
  }
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
              (this.payload.external_variant_id
                ? row.external_variant_id === this.payload.external_variant_id
                : row.external_url === this.payload.external_url)
            : false
        );

        if (existing) {
          Object.assign(existing, this.payload);
          return existing;
        }

        const row = {
          ...this.payload,
          id: this.payload.id || `${this.table}-${tables[this.table].length + 1}`,
        };
        tables[this.table].push(row);
        return row;
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

  const approvedPlans = new Map();

  return {
    tables,
    writes,
    operations,
    async rpc(name, args) {
      operations.push({ type: "rpc", name, args });
      if (name === "approve_product_import_plan") {
        const id = `approval-${approvedPlans.size + 1}`;
        approvedPlans.set(id, {
          plan: structuredClone(args.p_plan),
          metadata: {
            artifact_sha256: args.p_artifact_sha256,
            run_id: args.p_run_id,
            plan_fingerprint: args.p_plan.meta.plan_fingerprint,
            source_row_fingerprint: args.p_plan.meta.source_row_fingerprint,
            retailer_id: args.p_plan.retailer.action === "existing" ? args.p_plan.retailer.id : null,
            plan_kind: args.p_plan.meta.plan_kind,
          },
          consumed: false,
        });
        return {
          data: {
            approval_id: id,
            expires_at: new Date(Date.now() + 900000).toISOString(),
            ...approvedPlans.get(id).metadata,
            status: "approved",
          },
          error: null,
        };
      }
      if (name !== "apply_approved_product_import_plan") {
        return { data: null, error: new Error(`Unknown RPC ${name}`) };
      }

      const approval = approvedPlans.get(args.p_approval_id);
      if (!approval) return { data: null, error: new Error("approved import plan not found") };
      if (approval.consumed) return { data: null, error: new Error("approved import plan already consumed") };
      for (const [key, value] of Object.entries(approval.metadata)) {
        const argument = {
          artifact_sha256: args.p_artifact_sha256,
          run_id: args.p_run_id,
          plan_fingerprint: args.p_plan_fingerprint,
          source_row_fingerprint: args.p_source_row_fingerprint,
          retailer_id: args.p_retailer_id,
          plan_kind: args.p_plan_kind,
        }[key];
        if ((argument ?? null) !== (value ?? null)) {
          return { data: null, error: new Error(`approved import plan ${key} mismatch`) };
        }
      }
      const snapshot = structuredClone(tables);
      const writesLength = writes.length;
      const plan = approval.plan;
      try {
        let retailerId = plan.retailer.id;
        if (plan.retailer.action === "create") {
          const row = {
            ...plan.retailer.values,
            id: `retailers-${tables.retailers.length + 1}`,
          };
          tables.retailers.push(row);
          writes.push({ table: "retailers", operation: "insert", payload: row });
          retailerId = row.id;
        }

        let productId = plan.product.id;
        if (plan.product.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.product.values, [
              "price", "servings", "net_weight_g", "net_volume_ml", "serving_count_verified",
              "serving_size_g", "serving_size_ml", "protein_per_serving_g",
              "creatine_per_serving_g", "unit_count",
            ]),
            id: `products-${tables.products.length + 1}`,
            gtin: null,
            is_active: true,
          };
          tables.products.push(row);
          writes.push({ table: "products", operation: "insert", payload: row });
          productId = row.id;
        }
        if (seed.rpc_failure_at === "after_product") throw new Error("after product");

        let productVariantId = plan.product_variant.id;
        if (plan.product_variant.action === "create_default") {
          const row = {
            id: `product_variants-${tables.product_variants.length + 1}`,
            product_id: productId,
            variant_key: "default",
            display_name: "Default",
            flavour_code: null,
            flavour_label: null,
            size_value: null,
            size_unit: null,
            pack_count: null,
            product_format: null,
            is_active: true,
            is_default: true,
          };
          tables.product_variants.push(row);
          writes.push({ table: "product_variants", operation: "insert", payload: row });
          productVariantId = row.id;
        }
        if (seed.rpc_failure_at === "after_default_variant") {
          throw new Error("after default variant");
        }

        let mappingId = plan.retailer_product.id;
        if (plan.retailer_product.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.retailer_product.values, ["match_confidence"]),
            id: `retailer_products-${tables.retailer_products.length + 1}`,
            retailer_id: retailerId,
            product_id: productId,
            product_variant_id: productVariantId,
          };
          tables.retailer_products.push(row);
          writes.push({ table: "retailer_products", operation: "insert", payload: row });
          mappingId = row.id;
        } else if (plan.retailer_product.action === "update") {
          const row = tables.retailer_products.find(({ id }) => id === mappingId);
          if (!row) throw new Error("stale retailer product");
          Object.assign(row, materializeDecimalFields(plan.retailer_product.values, ["match_confidence"]), {
            retailer_id: retailerId,
            product_id: productId,
            product_variant_id: productVariantId,
          });
          writes.push({ table: "retailer_products", operation: "update", payload: plan.retailer_product.values });
        }
        if (seed.rpc_failure_at === "after_retailer_product") throw new Error("after retailer product");

        let offerId = plan.offer.id;
        if (plan.offer.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.offer.values, ["price", "shipping_cost", "total_price"]),
            id: `offers-${tables.offers.length + 1}`,
            product_id: productId,
            retailer_id: retailerId,
            product_variant_id: productVariantId,
            retailer_product_id: mappingId,
          };
          tables.offers.push(row);
          writes.push({ table: "offers", operation: "insert", payload: row });
          offerId = row.id;
        } else if (plan.offer.action === "update") {
          const row = tables.offers.find(({ id }) => id === offerId);
          if (!row) throw new Error("stale offer");
          const materializedOfferValues = materializeDecimalFields(
            plan.offer.values,
            ["price", "shipping_cost", "total_price"]
          );
          const changed = Object.fromEntries(
            Object.entries(materializedOfferValues).filter(
              ([key, value]) => key === "last_checked_at" || !valuesEqualForTest(row[key], value)
            )
          );
          Object.assign(row, materializedOfferValues);
          writes.push({ table: "offers", operation: "update", payload: changed });
        }
        if (seed.rpc_failure_at === "after_offer") throw new Error("after offer");
        if (seed.rpc_failure_at === "before_price_history") throw new Error("before price history");

        if (plan.price_history.action === "create") {
          const row = {
            id: `price_history-${tables.price_history.length + 1}`,
            offer_id: offerId,
            price: Number(plan.offer.values.price),
            shipping_cost: plan.offer.values.shipping_cost === null ? null : Number(plan.offer.values.shipping_cost),
            total_price: plan.offer.values.total_price === null ? null : Number(plan.offer.values.total_price),
            checked_at: plan.offer.values.last_checked_at,
          };
          tables.price_history.push(row);
          writes.push({ table: "price_history", operation: "insert", payload: row });
        }

        approval.consumed = true;
        return {
          data: {
            approval_id: args.p_approval_id, product_id: productId,
            product_variant_id: productVariantId, retailer_product_id: mappingId, offer_id: offerId,
            consumed_at: new Date().toISOString(), ...approval.metadata,
          },
          error: null,
        };
      } catch (error) {
        for (const [table, rows] of Object.entries(snapshot)) {
          tables[table].splice(0, tables[table].length, ...rows);
        }
        writes.splice(writesLength);
        return { data: null, error };
      }
    },
    from(table) {
      return new Query(table);
    },
  };
}

function valuesEqualForTest(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function materializeDecimalFields(values, fields) {
  const result = { ...values };
  for (const field of fields) {
    if (result[field] !== null && result[field] !== undefined) result[field] = Number(result[field]);
  }
  return result;
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
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1", external_url: row.url,
      external_gtin: row.gtin || null,
    }],
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp1",
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

function outOfStockSafeCreateFixture(overrides = {}) {
  const row = baseSafeCreateFeedRow({
    price: "16.99",
    shipping_cost: "3.99",
    delivery_cost: "3.99",
    in_stock: "false",
    is_for_sale: "false",
    ...overrides,
  });
  const retailer = {
    id: "r1",
    name: row.retailer_name,
    slug: "simply-supplements",
  };
  const product = {
    id: "p458",
    name: row.product_name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gtin: null,
  };

  return { row, retailer, product };
}

function buildFitHouseCanonicalRows(config) {
  return config.products.map((product) => {
    const url = `${config.retailer.website}/products/${product.expected_handle}?variant=${product.shopify_variant_id}`;

    return {
      retailer_name: config.retailer.name,
      retailer_website: config.retailer.website,
      external_product_id: product.shopify_product_id,
      external_variant_id: product.shopify_variant_id,
      product_name: product.canonical_name,
      variant_name: product.variant_name,
      brand: product.brand,
      category: product.category,
      description: "",
      image: `https://cdn.shopify.com/s/files/fit-house/${product.shopify_variant_id}.jpg`,
      slug: product.canonical_slug,
      external_url: url,
      affiliate_url: url,
      external_gtin: "",
      price: String(product.approved_price),
      shipping_known: String(config.shipping.known),
      shipping_cost: String(config.shipping.cost),
      in_stock: String(product.approved_in_stock),
      is_for_sale: String(product.is_for_sale),
      size: product.size === null ? "" : String(product.size),
      size_unit: product.size_unit || "",
      flavour: product.flavour || "",
      product_format: product.product_format,
      pack_count: String(product.pack_count),
      source_updated_at: "2026-07-11T14:18:26+01:00",
    };
  });
}

function assertFitHouseApprovedScope(config, rows) {
  const approvedMappings = new Set(
    config.products.map(
      (product) => `${product.shopify_product_id}:${product.shopify_variant_id}`
    )
  );

  if (
    rows.length !== config.products.length ||
    rows.some(
      (row) =>
        !approvedMappings.has(
          `${row.external_product_id}:${row.external_variant_id}`
        )
    )
  ) {
    throw new Error("Fit House preflight rows must exactly match approved config");
  }
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
    value: "908",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("0.908kg"), {
    value: "908",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("Optimum Nutrition Whey 2.27kg"), {
    value: "2270",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("2,27kg"), {
    value: "2270",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("1.8 kg"), {
    value: "1800",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("500ml"), {
    value: "500",
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
  assert.equal(parseProductFormat("softgel"), "softgel");
  assert.equal(parseProductFormat("softgels"), "softgel");
  assert.equal(parseProductFormat("soft gel"), "softgel");
  assert.equal(parseProductFormat("soft gels"), "softgel");
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

test("approval and pilot apply require an artifact, fingerprint and one approval ID", () => {
  const artifact = "tmp/import-plans/review.json";
  const fingerprint = "a".repeat(32);
  const pilot = parseArgs([
    "--mode=feed", "--pilot-apply", `--artifact=${artifact}`,
    `--plan-fingerprint=${fingerprint}`, "--approval-id=approval-1",
  ]);
  assert.equal(pilot.pilotApply, true);
  assert.equal(pilot.approvalId, "approval-1");
  assert.equal(parseArgs([
    "--mode=feed", "--approve-plan", `--artifact=${artifact}`,
    `--plan-fingerprint=${fingerprint}`,
  ]).approvePlan, true);
  assert.throws(
    () => parseArgs(["--mode=feed", "--pilot-apply", "--dry-run"]),
    /cannot be combined/i
  );
  assert.throws(() => parseArgs(["--pilot-apply"]), /artifact and --plan-fingerprint/i);
  assert.throws(() => validatePilotApply([{}], { dryRun: false }), /artifact approval workflow/i);
  assert.doesNotThrow(() => validatePilotApply([{}, {}], { dryRun: true }));
});

test("safe-create blocks canonical feed rows with flavour and size evidence", async () => {
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
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.blockedRows.length, 1);
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
  assert.equal(identity.size.value, "500");
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

test("safe-create emits a closed v2 plan with integrity fingerprints and approval metadata", async () => {
  const supabase = createMockSupabase({
    retailers: [], products: [], retailer_products: [], offers: [], price_history: [],
  });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed", safeCreate: true, dryRun: true,
  });
  const plan = result.report.approvedRows[0].importPlan;
  assert.deepEqual(Object.keys(plan).sort(), [
    "approval", "expected_state", "meta", "offer", "price_history",
    "product", "product_variant", "retailer", "retailer_product",
  ]);
  assert.equal(plan.meta.version, "2");
  assert.equal(plan.meta.plan_kind, "feed");
  assert.match(plan.meta.source_row_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(plan.meta.plan_fingerprint, /^[0-9a-f]{32}$/);
  assert.equal(plan.approval.approved, true);
  assert.equal(plan.approval.approval_type, "safe_create");
  assert.equal(plan.approval.approved_category, plan.product.values.category);
  assert.equal(plan.approval.canonical_name, plan.product.values.name);
  assert.equal(plan.approval.source_row_fingerprint, plan.meta.source_row_fingerprint);
  assert.equal(plan.approval.has_variant_evidence, false);
  assert.match(plan.approval.approval_fingerprint, /^[0-9a-f]{32}$/);
});

test("Fit House safe-create plans only neutral rows and blocks variant evidence", { concurrency: false }, async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 10);
  const rows = buildFitHouseCanonicalRows(config);
  const uniqueCount = (field) => new Set(rows.map((row) => row[field])).size;

  assert.equal(config.products.length, 10);
  assert.equal(rows.length, 10);
  assert.equal(uniqueCount("external_product_id"), 10);
  assert.equal(uniqueCount("external_variant_id"), 10);
  assert.equal(uniqueCount("slug"), 10);
  assert.equal(uniqueCount("external_url"), 10);
  assertFitHouseApprovedScope(config, rows);

  for (const row of rows) {
    assert.equal(
      priceHistoryTotal(row.price, row.shipping_cost),
      Math.round((Number(row.price) + 3.99) * 100) / 100
    );
  }

  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const logs = [];
  const originalLog = console.log;
  let result;

  console.log = (...values) => logs.push(values.join(" "));
  try {
    result = await runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(result.report.approvedRows.length, 4);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 6);
  assert.equal(result.report.exclusions.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 1);
  assert.equal(result.report.newRetailersToCreate[0].slug, "fit-house");
  assert.equal(result.report.newProductsToCreate.length, 4);
  assert.equal(result.report.retailerProductsToCreate.length, 4);
  assert.equal(result.report.offersToCreate.length, 4);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 4);
  assert.equal(result.report.blockedRows.length, 6);
  assert.equal(result.planned, 4);
  assert.equal(result.skipped, 6);
  assert.equal(supabase.writes.length, 0);
  assert.equal(
    logs.some((line) => line.includes("Dry run: no database writes performed.")),
    true
  );
});

test("Fit House existing defaults pass while unsafe new variant rows stay blocked", { concurrency: false }, async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 22);
  const rows = buildFitHouseCanonicalRows(config);
  const batchOneRows = rows.slice(0, 10);
  const products = batchOneRows.map((row, index) => ({
    id: `fit-product-${index + 1}`,
    name: row.product_name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    product_format: row.product_format,
    gtin: null,
  }));
  const retailerProducts = batchOneRows.map((row, index) => ({
    id: `fit-mapping-${index + 1}`,
    retailer_id: "fit-house-retailer",
    product_id: products[index].id,
    product_variant_id: `default-variant-${index + 1}`,
    external_url: row.external_url,
    external_gtin: null,
  }));
  const offers = batchOneRows.map((row, index) => ({
    id: `fit-offer-${index + 1}`,
    retailer_id: "fit-house-retailer",
    product_id: products[index].id,
    product_variant_id: `default-variant-${index + 1}`,
    retailer_product_id: `fit-mapping-${index + 1}`,
    price: Number(row.price),
    shipping_cost: Number(row.shipping_cost),
    total_price: priceHistoryTotal(row.price, row.shipping_cost),
    in_stock: true,
    url: row.affiliate_url,
  }));
  const supabase = createMockSupabase({
    retailers: [{
      id: "fit-house-retailer",
      name: "Fit House",
      slug: "fit-house",
      website: "https://fithouse.uk",
    }],
    products,
    retailer_products: retailerProducts,
    offers,
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const softgelRows = rows.filter((row) => row.product_format === "softgel");
  assert.equal(softgelRows.length, 4);
  assert.ok(softgelRows.every((row) => !isSafeCreateRowAmbiguous(row)));

  const originalLog = console.log;
  let result;
  console.log = () => {};
  try {
    result = await runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(result.report.approvedRows.length, 12);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 10);
  assert.equal(result.report.collisionGroups.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 8);
  assert.equal(result.report.retailerProductsToCreate.length, 8);
  assert.equal(result.report.offersToCreate.length, 8);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 4);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 8);
  assert.equal(result.report.blockedRows.length, 10);
  assert.equal(supabase.writes.length, 0);
});

test("Fit House scope guard rejects an unmapped eleventh row before importer", async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 10);
  const rows = buildFitHouseCanonicalRows(config);
  rows.push({
    ...rows[0],
    external_product_id: "9999999999999",
    external_variant_id: "99999999999999",
    slug: "unmapped-fit-house-product",
    external_url: "https://fithouse.uk/products/unmapped?variant=99999999999999",
    affiliate_url: "https://fithouse.uk/products/unmapped?variant=99999999999999",
  });
  let importerCalls = 0;

  async function guardedRun() {
    assertFitHouseApprovedScope(config, rows);
    importerCalls += 1;
    return runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  }

  await assert.rejects(guardedRun, /must exactly match approved config/);
  assert.equal(importerCalls, 0);
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

async function applyExistingOffer(rowOverrides = {}, offerOverrides = {}) {
  const row = baseFeedRow(rowOverrides);
  const supabase = createMockSupabase({
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1", external_url: row.url,
      external_gtin: row.gtin || null,
    }],
    offers: [{
      id: "o1", product_id: "p1", retailer_id: "r1", price: 29.99,
      product_variant_id: "default-variant-1", retailer_product_id: "rp1",
      shipping_cost: 0, total_price: 29.99, in_stock: true,
      url: baseFeedRow().url, ...offerOverrides,
    }],
  });
  setSupabaseForTests(supabase);
  const messages = [];
  const originalLog = console.log;
  console.log = (...args) => messages.push(args.join(" "));
  try {
    const result = await runImportRows([row], { mode: "feed" });
    return { result, supabase, messages };
  } finally {
    console.log = originalLog;
  }
}

test("unchanged offer is a true atomic-plan noop", async () => {
  const { result, supabase } = await applyExistingOffer();
  const offerUpdate = supabase.writes.find((write) => write.table === "offers");
  assert.equal(offerUpdate, undefined);
  assert.equal(supabase.writes.some((write) => write.table === "price_history"), false);
  assert.deepEqual(result.rowLevelOffers, [{ rowNumber: 2, slug: baseFeedRow().slug, offerAction: "unchanged" }]);
});

test("business offer changes keep full updates and price history rules", async () => {
  const cases = [
    { overrides: { price: "31.99" }, action: "update", history: true },
    { overrides: { shipping_cost: "1.49" }, action: "update", history: true },
    { overrides: { in_stock: "false" }, action: "update", history: false },
    { overrides: { affiliate_url: "https://affiliate.test/new-offer" }, action: "update", history: false },
  ];
  for (const item of cases) {
    const { result, supabase } = await applyExistingOffer(item.overrides);
    const offerUpdate = supabase.writes.find((write) => write.table === "offers");
    assert.equal(Object.hasOwn(offerUpdate.payload, "last_checked_at"), true);
    assert.equal(Object.hasOwn(offerUpdate.payload, "product_id"), false);
    assert.equal(Object.hasOwn(offerUpdate.payload, "retailer_product_id"), false);
    assert.equal(supabase.writes.some((write) => write.table === "price_history"), item.history);
    assert.equal(result.rowLevelOffers[0].offerAction, item.action);
  }
});

test("new offer reports row-level create", async () => {
  const supabase = createMockSupabase({ offers: [] });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseFeedRow()], { mode: "feed", dryRun: true });
  assert.deepEqual(result.rowLevelOffers, [{ rowNumber: 2, slug: baseFeedRow().slug, offerAction: "create" }]);
  assert.deepEqual(buildRowLevelOfferResults(result.report), result.rowLevelOffers);
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

test("safe-create requires is_for_sale to be present and a valid boolean", async () => {
  for (const overrides of [
    { is_for_sale: undefined },
    { is_for_sale: "" },
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

test("safe-create allows an out-of-stock offer for an existing canonical product", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [product],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToCreate.length, 1);
  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create apply writes an out-of-stock offer without writing products", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [{ ...product }],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  await runImportRows([row], { mode: "feed", safeCreate: true });

  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].in_stock, false);
  assert.equal(supabase.tables.price_history.length, 1);
  assert.equal(
    supabase.writes.some((write) => write.table === "products"),
    false
  );
});

test("safe-create blocks an out-of-stock row without a canonical match", async () => {
  const { row, retailer } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.invalidRows.length, 1);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 0);
  assert.equal(result.report.offersToCreate.length, 0);
  assert.deepEqual(result.report.invalidRows[0].reasons, [
    "in_stock must be true to create a new canonical product",
    "is_for_sale must be true to create a new canonical product",
  ]);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create plans an out-of-stock offer returning to stock as stock-only", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture({
    in_stock: "true",
    is_for_sale: "true",
  });
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [product],
    retailer_products: [{
      id: "rp458",
      retailer_id: retailer.id,
      product_id: product.id,
      product_variant_id: "default-variant-1",
      external_url: getRetailerProductUrl(row),
      external_gtin: row.external_gtin,
    }],
    offers: [
      {
        id: "o458",
        product_id: product.id,
        retailer_id: retailer.id,
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp458",
        price: 16.99,
        shipping_cost: 3.99,
        total_price: 20.98,
        in_stock: false,
        url: getOfferUrl(row),
      },
    ],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.offersToUpdate.length, 1);
  assert.equal(result.report.stockOnlyChanges.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
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
  assert.equal(productWrite.payload.gtin, null);
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

  const firstWrite = supabase.operations.findIndex((operation) => operation.type === "rpc");
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

test("new product create keeps validated metrics but isolates retailer GTIN", async () => {
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
  assert.equal(productInsert.payload.gtin, null);
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
        id: "rp1",
        retailer_id: "r1",
        product_id: "p1",
        product_variant_id: "default-variant-1",
        external_url: "https://retailer.test/iso-whey-zero-chocolate",
        external_gtin: null,
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], { mode: "feed" });

  assert.equal(result.report.externalGtinStoredOrUpdated.length, 1);
  assert.equal(result.report.retailerProductsToUpdate.length, 1);
  assert.deepEqual(
    result.report.retailerProductsToUpdate[0].changes.external_gtin,
    { before: null, after: "0001234567890" }
  );
  assert.equal(result.report.retailerProductsUnchanged.length, 0);
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
  assert.equal(supabase.writes.length, writesAfterFirstRun);
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
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1",
      external_url: baseFeedRow().url, external_gtin: null,
    }],
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp1",
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

  const historyWrites = supabase.writes.filter(
    (write) => write.table === "price_history"
  );

  assert.equal(supabase.tables.offers[0].shipping_cost, 2.99);
  assert.equal(supabase.tables.offers[0].total_price, 12.99);
  assert.equal(historyWrites.length, 0);
});

test("existing offer records explicit shipping changes including free delivery", async () => {
  for (const [shipping_cost, expectedTotal] of [["0", 10], ["1.49", 11.49]]) {
    const supabase = createMockSupabase({
      retailer_products: [{
        id: "rp1", retailer_id: "r1", product_id: "p1",
        product_variant_id: "default-variant-1",
        external_url: baseFeedRow().url, external_gtin: null,
      }],
      offers: [
        {
          id: "o1",
          product_id: "p1",
          retailer_id: "r1",
          product_variant_id: "default-variant-1",
          retailer_product_id: "rp1",
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

test("manual import attaches an offer to an existing product without creating a product", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow({ gtin: "manual-retailer-gtin" })], {
    mode: "manual",
  });

  assert.equal(result.successful, 1);
  assert.equal(supabase.writes.some((write) => write.table === "products"), false);
  assert.equal(supabase.writes.some((write) => write.table === "retailer_products"), true);
  assert.equal(supabase.writes.some((write) => write.table === "offers"), true);
  assert.equal(supabase.writes.some((write) => write.table === "price_history"), true);
});

test("manual import blocks an unknown canonical product before all writes", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow({ gtin: "manual-gtin" })], {
    mode: "manual",
  });

  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.match(result.report.blockedRows[0].reason, /existing canonical product/i);
  assert.equal(result.blockedRows.length, 1);
  assert.match(result.blockedRows[0].block_reason, /existing canonical product/i);
  assert.equal(supabase.writes.length, 0);
});

async function resolveDefaultFixture(rowOverrides, productVariants) {
  const row = baseFeedRow({ gtin: "", ...rowOverrides });
  const product = {
    id: "p1", name: row.product_name, slug: row.slug, brand: row.brand,
    category: row.category, product_format: row.product_format || null, gtin: null,
  };
  const supabase = createMockSupabase({ products: [product], product_variants: productVariants });
  setSupabaseForTests(supabase);
  return runImportRows([row], { mode: "feed", dryRun: true });
}

function defaultVariant(overrides = {}) {
  return {
    id: "pv-default", product_id: "p1", flavour_code: null, flavour_label: null,
    size_value: null, size_unit: null, pack_count: null, product_format: null,
    is_active: true, is_default: true, ...overrides,
  };
}

test("KIOR-like pack_count 1 capsule evidence resolves the neutral default", async () => {
  const result = await resolveDefaultFixture(
    { product_name: "KIOR Daily Capsules", slug: "kior-daily-capsules", brand: "KIOR", pack_count: "1", product_format: "capsule" },
    [defaultVariant()]
  );
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.approvedRows[0].importPlan.product_variant.id, "pv-default");
});

test("Fit House-like format-only evidence resolves one neutral default", async () => {
  const result = await resolveDefaultFixture(
    { product_name: "Fit House Creatine Powder", slug: "fit-house-creatine", brand: "Fit House", product_format: "powder", pack_count: "1" },
    [defaultVariant()]
  );
  assert.equal(result.report.approvedRows.length, 1);
});

test("default fallback is fail-closed for non-default, missing, and duplicate defaults", async () => {
  const nonDefault = {
    ...defaultVariant({ id: "pv-chocolate", is_default: false }),
    flavour_code: "chocolate", flavour_label: "Chocolate",
  };
  for (const variants of [
    [defaultVariant(), nonDefault],
    [],
    [defaultVariant(), defaultVariant({ id: "pv-default-2" })],
  ]) {
    const result = await resolveDefaultFixture({}, variants);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.blockedRows.length, 1);
  }
});

test("non-default variants require complete distinguishing evidence or an approved mapping", async () => {
  const chocolate500 = {
    ...defaultVariant({ id: "pv-chocolate-500", is_default: false }),
    flavour_code: "chocolate", flavour_label: "Chocolate", size_value: 500, size_unit: "g",
  };
  const vanilla500 = {
    ...chocolate500, id: "pv-vanilla-500", flavour_code: "vanilla", flavour_label: "Vanilla",
  };
  for (const evidence of [
    { flavour: "chocolate" },
    { size: "500g" },
    { external_options: JSON.stringify({ Flavour: "Chocolate" }) },
  ]) {
    const result = await resolveDefaultFixture(evidence, [chocolate500, vanilla500]);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.blockedRows.length, 1);
  }

  const exact = await resolveDefaultFixture(
    { flavour: "chocolate", size: "500g" },
    [chocolate500, vanilla500]
  );
  assert.equal(exact.report.approvedRows[0].importPlan.product_variant.id, "pv-chocolate-500");
});

test("manual Stage 2 existing-product import creates full identity, is idempotent, and dry-run shares the plan", async () => {
  const row = baseFeedRow({ gtin: "manual-retailer-gtin" });
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const dryRun = await runImportRows([row], { mode: "manual", dryRun: true });
  assert.equal(dryRun.planned, 1);
  assert.equal(supabase.writes.length, 0);
  assert.equal(dryRun.report.approvedRows[0].importPlan.product_variant.action, "existing");
  assert.equal(dryRun.report.approvedRows[0].importPlan.approval.approved, false);

  const first = await runImportRows([row], { mode: "manual" });
  const second = await runImportRows([row], { mode: "manual" });
  assert.equal(first.successful, 1);
  assert.equal(second.successful, 1);
  assert.equal(supabase.tables.product_variants.length, 1);
  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].retailer_product_id, supabase.tables.retailer_products[0].id);
  assert.equal(supabase.tables.offers[0].product_variant_id, supabase.tables.product_variants[0].id);
  assert.equal(supabase.writes.some((write) => write.table === "products"), false);
});

test("manual import with ambiguous defaults blocks before any write", async () => {
  const supabase = createMockSupabase({
    product_variants: [defaultVariant(), defaultVariant({ id: "pv-default-2" })],
  });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseFeedRow()], { mode: "manual" });
  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.report.blockedRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create RPC failures roll back product, default, mapping, offer, and history", async () => {
  for (const rpc_failure_at of [
    "after_product", "after_default_variant", "after_retailer_product",
    "after_offer", "before_price_history",
  ]) {
    const supabase = createMockSupabase({
      retailers: [], products: [], retailer_products: [], offers: [], price_history: [], rpc_failure_at,
    });
    setSupabaseForTests(supabase);
    const result = await runImportRows([baseSafeCreateFeedRow()], { mode: "feed", safeCreate: true });
    assert.equal(result.failed, 1);
    assert.equal(result.failedRows.length, 1);
    for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      assert.equal(supabase.tables[table].length, 0, `${rpc_failure_at} left ${table}`);
    }
  }
});

function discountStage2Fixture() {
  const retailer = {
    id: "discount-retailer",
    name: "Discount Supplements",
    slug: "discount-supplements",
  };
  const product = {
    id: "discount-product",
    name: "Applied Nutrition ISO-XP Whey Protein",
    slug: "applied-nutrition-iso-xp-whey-protein",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    product_format: "powder",
    gtin: "canonical-product-gtin",
  };
  const productVariants = [
    {
      id: "pv-chocolate-500g",
      product_id: product.id,
      variant_key: "chocolate-500g",
      display_name: "Chocolate / 500g",
      flavour_code: "chocolate",
      flavour_label: "Chocolate",
      size_value: 500,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
      is_active: true,
      is_default: false,
    },
    {
      id: "pv-vanilla-1kg",
      product_id: product.id,
      variant_key: "vanilla-1000g",
      display_name: "Vanilla / 1kg",
      flavour_code: "vanilla",
      flavour_label: "Vanilla",
      size_value: 1000,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
      is_active: true,
      is_default: false,
    },
  ];
  const shared = {
    retailer_name: retailer.name,
    retailer_website: "https://www.discount-supplements.co.uk",
    external_product_id: "shopify-product-9001",
    product_name: product.name,
    brand: product.brand,
    category: product.category,
    description: "Applied Nutrition ISO-XP whey protein powder",
    image: "https://cdn.shopify.com/s/files/discount/iso-xp.webp",
    slug: product.slug,
    shipping_known: "true",
    shipping_cost: "4.99",
    in_stock: "true",
    is_for_sale: "true",
    product_format: "powder",
    pack_count: "1",
  };
  const rows = [
    baseCanonicalFeedRow({
      ...shared,
      external_variant_id: "shopify-variant-chocolate-500g",
      external_sku: "ISOXP-CHOC-500",
      external_options: JSON.stringify({ Size: "500g", Flavour: "Chocolate" }),
      variant_name: "Chocolate / 500g",
      external_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-chocolate-500g",
      affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-chocolate-500g",
      external_gtin: "retailer-gtin-chocolate",
      price: "24.99",
      size: "500",
      size_unit: "g",
      flavour: "Chocolate",
    }),
    baseCanonicalFeedRow({
      ...shared,
      external_variant_id: "shopify-variant-vanilla-1kg",
      external_sku: "ISOXP-VAN-1000",
      external_options: JSON.stringify({ Size: "1kg", Flavour: "Vanilla" }),
      variant_name: "Vanilla / 1kg",
      external_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-vanilla-1kg",
      affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-vanilla-1kg",
      external_gtin: "retailer-gtin-vanilla",
      price: "39.99",
      size: "1000",
      size_unit: "g",
      flavour: "Vanilla",
    }),
  ];

  return { product, productVariants, retailer, rows };
}

function stage2Seed({ withMappings = false, withOffers = false } = {}) {
  const fixture = discountStage2Fixture();
  const retailerProducts = withMappings
    ? fixture.rows.map((row, index) => ({
        id: `rp-${index + 1}`,
        retailer_id: fixture.retailer.id,
        product_id: fixture.product.id,
        product_variant_id: fixture.productVariants[index].id,
        external_product_id: row.external_product_id,
        external_variant_id: row.external_variant_id,
        external_sku: row.external_sku,
        external_options: JSON.parse(row.external_options),
        external_name: row.product_name,
        external_slug: row.slug,
        external_gtin: row.external_gtin,
        external_url: row.external_url,
        match_method: "slug",
        match_confidence: 90,
        updated_at: "2026-07-13T12:00:00.000Z",
      }))
    : [];
  const offers = withOffers
    ? fixture.rows.map((row, index) => ({
        id: `offer-${index + 1}`,
        product_id: fixture.product.id,
        retailer_id: fixture.retailer.id,
        retailer_product_id: retailerProducts[index].id,
        product_variant_id: fixture.productVariants[index].id,
        price: Number(row.price),
        shipping_cost: 4.99,
        total_price: priceHistoryTotal(Number(row.price), 4.99),
        url: row.affiliate_url,
        in_stock: true,
      }))
    : [];

  return {
    fixture,
    seed: {
      retailers: [fixture.retailer],
      products: [{ ...fixture.product }],
      product_variants: fixture.productVariants.map((variant) => ({ ...variant })),
      retailer_products: retailerProducts,
      offers,
      price_history: [],
    },
  };
}

test("Stage 2 retailer product payload preserves Shopify variant identity and retailer-only GTIN", () => {
  const { fixture } = stage2Seed();
  const row = fixture.rows[0];
  const payload = buildRetailerProductPayload({
    row,
    retailerId: fixture.retailer.id,
    productId: fixture.product.id,
    name: row.product_name,
    slug: row.slug,
    offerUrl: row.affiliate_url,
    matchMethod: "external_variant_id",
    matchConfidence: 100,
  });

  assert.equal(payload.external_product_id, row.external_product_id);
  assert.equal(payload.external_variant_id, row.external_variant_id);
  assert.equal(payload.external_sku, row.external_sku);
  assert.deepEqual(payload.external_options, JSON.parse(row.external_options));
  assert.equal(payload.external_gtin, row.external_gtin);
  assert.equal(Object.hasOwn(payload, "gtin"), false);
});

test("Stage 2 external_options accepts only JSON objects and blocks invalid rows", async () => {
  assert.deepEqual(parseExternalOptions('{"Size":"500g"}'), { Size: "500g" });
  assert.throws(() => parseExternalOptions("not-json"), /valid JSON object/i);
  assert.throws(() => parseExternalOptions('["500g"]'), /JSON object/i);
  assert.throws(() => parseExternalOptions('"500g"'), /JSON object/i);

  for (const externalOptions of ["not-json", '["500g"]', '"500g"']) {
    const { fixture, seed } = stage2Seed();
    const supabase = createMockSupabase(seed);
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [{ ...fixture.rows[0], external_options: externalOptions }],
      { mode: "feed", dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.invalidRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("Stage 2 identity distinguishes two Shopify variants where product plus retailer does not", () => {
  const { fixture } = stage2Seed();
  const legacyKeys = new Set(
    fixture.rows.map(() => `${fixture.product.id}:${fixture.retailer.id}`)
  );
  const stage2Keys = new Set(
    fixture.rows.map(
      (row) => `${fixture.retailer.id}:${row.external_variant_id}`
    )
  );

  assert.equal(legacyKeys.size, 1);
  assert.equal(stage2Keys.size, 2);
});

test("Stage 2 dry-run plans two retailer products and two offers for one retailer and canonical product", async () => {
  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed", dryRun: true });

  assert.equal(result.report.collisionGroups.length, 0);
  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.retailerProductsToCreate.length, 2);
  assert.equal(result.report.offersToCreate.length, 2);
  assert.equal(result.planned, 2);
  assert.equal(supabase.writes.length, 0);
});

test("Stage 2 mixed batch never reuses variant A offer when variant B mapping is new", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.retailer_products = seed.retailer_products.slice(0, 1);
  seed.offers = seed.offers.slice(0, 1);
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const dryRun = await runImportRows([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(dryRun.report.retailerProductsToCreate.length, 1);
  assert.equal(dryRun.report.offersToCreate.length, 1);
  assert.equal(dryRun.report.offersToUpdate.length, 0);
  assert.equal(dryRun.report.approvedRows[0].existingOffer, null);

  const apply = await runImportRows([fixture.rows[1]], { mode: "feed" });
  assert.equal(apply.successful, 1);
  assert.equal(apply.successfulRows.length, 1);
  assert.equal(apply.failedRows.length, 0);
  assert.equal(supabase.tables.retailer_products.length, 2);
  assert.equal(supabase.tables.offers.length, 2);
  assert.equal(supabase.tables.offers[0].retailer_product_id, "rp-1");
  assert.notEqual(supabase.tables.offers[1].retailer_product_id, "rp-1");
  assert.equal(supabase.tables.offers[1].product_variant_id, "pv-vanilla-1kg");
});

test("Stage 2 apply creates separate linked retailer products and offers without changing products.gtin", async () => {
  const { fixture, seed } = stage2Seed();
  const originalProduct = structuredClone(seed.products[0]);
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed" });

  assert.equal(result.successful, 2);
  assert.equal(supabase.tables.retailer_products.length, 2);
  assert.equal(supabase.tables.offers.length, 2);
  assert.equal(new Set(supabase.tables.retailer_products.map((row) => row.id)).size, 2);
  assert.equal(new Set(supabase.tables.retailer_products.map((row) => row.external_variant_id)).size, 2);
  for (let index = 0; index < fixture.rows.length; index += 1) {
    const row = fixture.rows[index];
    const mapping = supabase.tables.retailer_products.find(
      (candidate) => candidate.external_variant_id === row.external_variant_id
    );
    const offer = supabase.tables.offers.find(
      (candidate) => candidate.retailer_product_id === mapping?.id
    );

    assert(mapping);
    assert(offer);
    assert.equal(mapping.external_product_id, row.external_product_id);
    assert.equal(mapping.external_sku, row.external_sku);
    assert.deepEqual(mapping.external_options, JSON.parse(row.external_options));
    assert.equal(mapping.external_gtin, row.external_gtin);
    assert.equal(mapping.product_variant_id, fixture.productVariants[index].id);
    assert.equal(offer.product_variant_id, fixture.productVariants[index].id);
  }
  assert.deepEqual(supabase.tables.products[0], originalProduct);
});

test("Stage 2 rerun is idempotent and looks up offers by retailer product identity", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed", dryRun: true });

  assert.equal(result.report.retailerProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 2);
  assert.equal(result.report.offersToCreate.length, 0);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 2);
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "retailer_products" &&
        operation.filters.some((filter) => filter.field === "external_variant_id")
    ),
    true
  );
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "offers" &&
        operation.filters.some((filter) => filter.field === "retailer_product_id")
    ),
    true
  );
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "offers" &&
        operation.filters.some((filter) => filter.field === "product_id") &&
        operation.filters.some((filter) => filter.field === "retailer_id")
    ),
    false
  );
  assert.equal(supabase.writes.length, 0);
});

test("Stage 2 price update changes only the selected Shopify variant offer", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  const originalFirstOffer = structuredClone(seed.offers[0]);
  const updatedVanilla = { ...fixture.rows[1], price: "37.49" };
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([updatedVanilla], { mode: "feed" });

  assert.equal(result.successful, 1);
  assert.deepEqual(result.report.offersToUpdate[0].changes.price, {
    before: 39.99,
    after: "37.49",
  });
  assert.deepEqual(supabase.tables.offers[0], originalFirstOffer);
  assert.equal(supabase.tables.offers[1].price, 37.49);
  assert.equal(supabase.tables.offers[1].retailer_product_id, "rp-2");
  const offerUpdate = supabase.writes.find(
    (write) => write.table === "offers" && write.operation === "update"
  );
  assert.deepEqual(
    Object.keys(offerUpdate.payload).sort(),
    ["last_checked_at", "price", "total_price"].sort()
  );
});

test("Stage 2 stock and URL updates remain scoped to the selected Shopify variant", async () => {
  const scenarios = [
    {
      overrides: { in_stock: "false" },
      expected: { in_stock: false },
      keys: ["in_stock", "last_checked_at"],
    },
    {
      overrides: {
        affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp-vanilla-new?variant=shopify-variant-vanilla-1kg",
      },
      expected: {
        url: "https://www.discount-supplements.co.uk/products/iso-xp-vanilla-new?variant=shopify-variant-vanilla-1kg",
      },
      keys: ["last_checked_at", "url"],
    },
  ];

  for (const scenario of scenarios) {
    const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
    const originalFirstOffer = structuredClone(seed.offers[0]);
    const supabase = createMockSupabase(seed);
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [{ ...fixture.rows[1], ...scenario.overrides }],
      { mode: "feed" }
    );

    assert.equal(result.successful, 1);
    assert.deepEqual(supabase.tables.offers[0], originalFirstOffer);
    assert.equal(supabase.tables.offers[1].retailer_product_id, "rp-2");
    for (const [field, value] of Object.entries(scenario.expected)) {
      assert.equal(supabase.tables.offers[1][field], value);
    }
    const offerUpdate = supabase.writes.find(
      (write) => write.table === "offers" && write.operation === "update"
    );
    assert.equal(Object.hasOwn(offerUpdate.payload, "last_checked_at"), true);
    for (const key of Object.keys(scenario.expected)) {
      assert.equal(Object.hasOwn(offerUpdate.payload, key), true);
    }
    assert.equal(Object.hasOwn(offerUpdate.payload, "retailer_product_id"), false);
  }
});

test("Stage 2 resolves flavour and size evidence to the exact canonical product variant", async () => {
  const { fixture, seed } = stage2Seed();

  for (let index = 0; index < fixture.rows.length; index += 1) {
    const isolatedSeed = {
      ...seed,
      products: seed.products.map((row) => ({ ...row })),
      product_variants: seed.product_variants.map((row) => ({ ...row })),
      retailer_products: [],
      offers: [],
      price_history: [],
    };
    const supabase = createMockSupabase(isolatedSeed);
    setSupabaseForTests(supabase);

    const result = await runImportRows([fixture.rows[index]], { mode: "feed" });
    const mapping = supabase.tables.retailer_products[0];
    const offer = supabase.tables.offers[0];

    assert.equal(result.successful, 1);
    assert.equal(mapping.product_variant_id, fixture.productVariants[index].id);
    assert.equal(offer.retailer_product_id, mapping.id);
    assert.equal(offer.product_variant_id, fixture.productVariants[index].id);
  }
});

test("Stage 2 dry-run blocks missing and ambiguous canonical variant resolution", async () => {
  const { fixture, seed } = stage2Seed();
  const cases = [
    {
      label: "missing",
      variants: seed.product_variants.slice(1),
      reason: /missing canonical product_variant/i,
    },
    {
      label: "ambiguous",
      variants: [
        seed.product_variants[0],
        {
          ...seed.product_variants[0],
          id: "pv-chocolate-500g-duplicate",
          variant_key: "chocolate-500g-duplicate",
        },
      ],
      reason: /ambiguous canonical product_variant/i,
    },
  ];

  for (const scenario of cases) {
    const supabase = createMockSupabase({
      ...seed,
      product_variants: scenario.variants,
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([fixture.rows[0]], {
      mode: "feed",
      dryRun: true,
    });

    assert.equal(result.report.approvedRows.length, 0, scenario.label);
    assert.equal(result.report.ambiguousRows.length, 1, scenario.label);
    assert.match(result.report.ambiguousRows[0].reason, scenario.reason);
    assert.equal(supabase.writes.length, 0);
  }
});

test("Stage 2 dry-run blocks conflicting row and external option evidence", async () => {
  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [
      {
        ...fixture.rows[0],
        external_options: JSON.stringify({ Size: "1kg", Flavour: "Chocolate" }),
      },
    ],
    { mode: "feed", dryRun: true }
  );

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 1);
  assert.match(result.report.ambiguousRows[0].reason, /conflicting variant evidence/i);
  assert.equal(supabase.writes.length, 0);
});

test("size normalization uses base mass and volume units and rejects invalid evidence", async () => {
  assert.deepEqual(parseSize("0.5kg"), {
    value: "500",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("1L"), {
    value: "1000",
    unit: "ml",
    dimension: "volume",
  });
  assert.equal(parseSize("500oz"), null);
  assert.equal(parseSize("0kg"), null);

  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const accepted = await runImportRowsRaw([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(accepted.report.approvedRows.length, 1);
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_value, "1000");
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_unit, "g");

  for (const Size of ["1L", "500oz", "0kg"]) {
    const blocked = await runImportRowsRaw(
      [{ ...fixture.rows[1], external_options: JSON.stringify({ Size, Flavour: "Vanilla" }) }],
      { mode: "feed", dryRun: true }
    );
    assert.equal(blocked.report.approvedRows.length, 0);
    assert.equal(blocked.report.blockedRows.length, 1);
  }
});

test("total_price-only drift updates once, records one history row, then becomes noop", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.offers[1].total_price = 999;
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const applied = await runImportRows([fixture.rows[1]], { mode: "feed" });
  assert.equal(applied.successful, 1);
  assert.deepEqual(applied.report.offersToUpdate[0].changes.total_price, {
    before: 999,
    after: "44.98",
  });
  assert.equal(supabase.tables.offers[1].price, 39.99);
  assert.equal(supabase.tables.offers[1].shipping_cost, 4.99);
  assert.equal(supabase.tables.offers[1].total_price, 44.98);
  assert.equal(supabase.tables.price_history.length, 1);

  const rerun = await runImportRowsRaw([fixture.rows[1]], { mode: "feed", dryRun: true });
  assert.equal(rerun.report.offersToUpdate.length, 0);
  assert.equal(rerun.report.offersUnchanged.length, 1);
  assert.equal(supabase.tables.price_history.length, 1);
});

test("external_options key order is canonically equal and does not cause an update", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.retailer_products[1].external_options = { Flavour: "Vanilla", Size: "1kg" };
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.rows[1]], { mode: "feed", dryRun: true });
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 1);
  assert.deepEqual(result.report.retailerProductsUnchanged[0].changes, {});
});

test("manual import strictly blocks invalid shared input fields", async () => {
  const scenarios = [
    { in_stock: "maybe" },
    { url: "", aw_deep_link: "", affiliate_url: "", external_url: "", merchant_deep_link: "" },
    { price: "not-a-price" },
    { external_options: "{broken" },
  ];
  for (const overrides of scenarios) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([baseFeedRow(overrides)], {
      mode: "manual",
      dryRun: true,
    });
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.blockedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("programmatic CSV writes are disabled in favour of the artifact workflow", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], { mode: "feed" }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow(), baseFeedRow()], {
      mode: "feed",
      pilotApply: true,
      approvalId: "approval-1",
    }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], { mode: "feed", pilotApply: true }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], {
      mode: "feed",
      pilotApply: true,
      approvalIds: ["approval-1", "approval-2"],
    }),
    /artifact approval workflow/i
  );
});

test("canonical JSON rejects undefined and decimal strings cover cross-runtime vectors", () => {
  for (const [input, expected] of [
    ["0.0000001", "0.0000001"],
    ["0.000001", "0.000001"],
    ["1e21", "1000000000000000000000"],
    ["1000.0", "1000"],
    [-0, "0"],
  ]) {
    assert.equal(normalizeDecimalString(input), expected);
  }
  assert.throws(() => canonicalJson({ value: undefined }), /undefined is not allowed/);
  assert.throws(() => canonicalJson([undefined]), /undefined is not allowed/);
  assert.equal(canonicalJson({ value: null }), '{"value":null}');
});

test("dry-run artifact is the sole immutable input for approval and pilot apply", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);
  const rowA = baseFeedRow();
  const rowB = baseFeedRow({ price: "31.25" });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-artifact-workflow-"));
  const sourceA = Buffer.from(JSON.stringify(rowA));
  const sourceBPath = path.join(directory, "source-b.json");
  fs.writeFileSync(sourceBPath, JSON.stringify(rowB));
  try {
    const dryRunA = await runImportRowsRaw([rowA], { mode: "feed", dryRun: true });
    const artifactAPath = path.join(directory, "artifact-a.json");
    const artifactA = writeDryRunArtifact([rowA], dryRunA, {
      artifactPath: artifactAPath,
      runId: "artifact-run-a",
      sourceBytes: sourceA,
      sourceFileName: "source-a.json",
      environmentMarker: "test",
    });
    const entryA = artifactA.artifact.plans[0];
    assert.equal(artifactA.artifact.row_count, "1");
    assert.equal(entryA.resolved_plan.offer.values.price, "29.99");
    assert.equal(typeof entryA.resolved_plan.retailer.id, "string");
    assert.equal(supabase.writes.length, 0);

    const approvedA = await approveArtifactPlan({
      artifactPath: artifactAPath,
      planFingerprint: entryA.plan_fingerprint,
    });
    assert.equal(approvedA.artifactSha256, artifactA.artifactSha256);
    assert.equal(approvedA.sourceRowFingerprint, entryA.source_row_fingerprint);
    assert.ok(approvedA.expiresAt);
    assert.equal(supabase.writes.length, 0);

    const dryRunB = await runImportRowsRaw([rowB], { mode: "feed", dryRun: true });
    const artifactBPath = path.join(directory, "artifact-b.json");
    const artifactB = writeDryRunArtifact([rowB], dryRunB, {
      artifactPath: artifactBPath,
      runId: "artifact-run-b",
      sourceContent: JSON.stringify(rowB),
      sourceFileName: "source-b.json",
      environmentMarker: "test",
    });
    await assert.rejects(
      applyArtifactPlan({
        artifactPath: artifactBPath,
        planFingerprint: artifactB.artifact.plans[0].plan_fingerprint,
        approvalId: approvedA.approvalId,
        pilotApply: true,
      }),
      /artifact_sha256 mismatch/
    );
    await assert.rejects(
      approveArtifactPlan({
        artifactPath: artifactAPath,
        planFingerprint: entryA.plan_fingerprint,
        sourcePath: sourceBPath,
      }),
      /Source file SHA-256/
    );

    fs.appendFileSync(artifactAPath, " ");
    await assert.rejects(
      applyArtifactPlan({
        artifactPath: artifactAPath,
        planFingerprint: entryA.plan_fingerprint,
        approvalId: approvedA.approvalId,
        pilotApply: true,
      }),
      /artifact SHA-256 mismatch/i
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
