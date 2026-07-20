const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  EXPECTED_PRODUCTION_REF,
  RETAILER_SCOPE,
  applyRefreshPlan,
  assertExecutionEnvironment,
  authorisedOfferIds,
  buildRefreshPlan,
  classifyRetailerScope,
  parseArgs,
  plannedValues,
  policyFor,
  scopeRowsForRetailer,
} = require("./creatine-offer-refresh");

const ROOT = path.resolve(__dirname, "..");

function env(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${EXPECTED_PRODUCTION_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    GITHUB_ACTIONS: "true",
    GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "schedule",
    GITHUB_REPOSITORY: "SupplementScout/supplementscout",
    ...overrides,
  };
}

function row({ offerId = 952, retailerId = 1, retailerName = "Fit House", retailerSlug = "fit-house", retailerWebsite = "https://fithouse.uk", retailerProductId = 1952, productId = 7, variantId = 107, externalProductId = "p1", externalVariantId = "v1", sku = "sku-1", price = "10.00", shipping = "3.99", url = "https://fithouse.uk/products/example?variant=v1" } = {}) {
  return {
    retailer: { id: retailerId, name: retailerName, slug: retailerSlug, website: retailerWebsite },
    product: { id: productId, name: "Example Creatine", category: "Creatine", is_active: true, merged_into_product_id: null, merged_at: null },
    variant: { id: variantId, product_id: productId, display_name: "Default", is_active: true },
    mapping: { id: retailerProductId, retailer_id: retailerId, product_id: productId, product_variant_id: variantId, external_product_id: externalProductId, external_variant_id: externalVariantId, external_sku: sku, external_url: url },
    offer: { id: offerId, retailer_id: retailerId, product_id: productId, product_variant_id: variantId, retailer_product_id: retailerProductId, price, shipping_cost: shipping, total_price: "13.99", in_stock: true, url, last_checked_at: "2026-07-18T03:00:00.000Z" },
  };
}

function stateFromRows(rows, extra = {}) {
  return {
    retailers: [...new Map(rows.map((entry) => [entry.retailer.id, entry.retailer])).values(), ...(extra.retailers || [])],
    products: [...new Map(rows.map((entry) => [entry.product.id, entry.product])).values(), ...(extra.products || [])],
    variants: [...new Map(rows.map((entry) => [entry.variant.id, entry.variant])).values(), ...(extra.variants || [])],
    mappings: rows.map((entry) => ({ ...entry.mapping })),
    offers: rows.map((entry) => ({ ...entry.offer })),
    priceHistory: extra.priceHistoryCount || 0,
    price_history: extra.price_history || [],
  };
}

function shopifySnapshotForRows(rows, mutate = () => {}) {
  return {
    captured_at: "2026-07-19T03:17:00.000Z",
    store_origin: "https://fithouse.uk",
    pages: [{ page: 1, count: rows.length, sha256: "a".repeat(64) }],
    snapshot_sha256: "b".repeat(64),
    products: rows.map((entry, index) => {
      const product = {
        id: entry.mapping.external_product_id,
        handle: `example-${index}`,
        title: entry.product.name,
        variants: [{
          id: entry.mapping.external_variant_id,
          sku: entry.mapping.external_sku,
          price: entry.offer.price,
          available: entry.offer.in_stock,
          title: entry.variant.display_name,
        }],
      };
      mutate(product, product.variants[0], index);
      return product;
    }),
  };
}

function retailerRows(retailerName, retailerId, retailerSlug, scope) {
  return scope.offerIds.map((offerId, index) => {
    const externalVariantId = `${retailerSlug}-v-${index}`;
    const handle = `${retailerSlug}-creatine-${index}`;
    return row({
      offerId,
      retailerId,
      retailerName,
      retailerSlug,
      retailerWebsite: scope.storeUrl,
      retailerProductId: 10_000 + Number(offerId),
      productId: retailerId * 100 + index,
      variantId: retailerId * 1000 + index,
      externalProductId: `${retailerSlug}-p-${index}`,
      externalVariantId,
      sku: retailerName === "Jon's Supplements" ? null : `${retailerSlug}-sku-${index}`,
      shipping: scope.shippingCost,
      url: `${scope.storeUrl}/products/${handle}?variant=${externalVariantId}`,
    });
  });
}

function paddedShopifySnapshot({ rows, storeOrigin, productCount, variantCount, availableCount, targetAvailable = true }) {
  let variants = 0;
  let available = 0;
  const products = rows.map((entry) => {
    const handle = new URL(entry.offer.url).pathname.split("/").pop();
    variants += 1;
    if (targetAvailable) available += 1;
    return {
      id: entry.mapping.external_product_id,
      handle,
      title: entry.product.name,
      variants: [{
        id: entry.mapping.external_variant_id,
        product_id: entry.mapping.external_product_id,
        sku: entry.mapping.external_sku,
        price: entry.offer.price,
        available: targetAvailable,
        title: entry.variant.display_name,
      }],
    };
  });
  while (products.length < productCount) {
    const index = products.length;
    const isAvailable = available < availableCount;
    products.push({
      id: `filler-p-${index}`,
      handle: `filler-${index}`,
      title: `Filler ${index}`,
      variants: [{ id: `filler-v-${index}-0`, product_id: `filler-p-${index}`, sku: `filler-sku-${index}-0`, price: "1.00", available: isAvailable, title: "Default" }],
    });
    variants += 1;
    if (isAvailable) available += 1;
  }
  let fillerVariant = 1;
  while (variants < variantCount) {
    const product = products[products.length - 1];
    const isAvailable = available < availableCount;
    product.variants.push({ id: `filler-extra-${fillerVariant}`, product_id: product.id, sku: `filler-extra-sku-${fillerVariant}`, price: "1.00", available: isAvailable, title: `Extra ${fillerVariant}` });
    variants += 1;
    fillerVariant += 1;
    if (isAvailable) available += 1;
  }
  return {
    captured_at: "2026-07-19T03:17:00.000Z",
    store_origin: storeOrigin,
    market_country: null,
    pages: [{ page: 1, count: productCount, sha256: "a".repeat(64) }],
    snapshot_sha256: "b".repeat(64),
    products,
  };
}

function clientFromState(state) {
  const tables = {
    retailers: state.retailers,
    products: state.products,
    product_variants: state.variants,
    retailer_products: state.mappings,
    offers: state.offers,
    price_history: state.price_history || [],
  };
  return {
    from(table) {
      return {
        select(_columns, options = {}) {
          if (options.count === "exact" && options.head === true) return Promise.resolve({ count: tables[table].length, error: null });
          return this;
        },
        range(from, to) {
          return Promise.resolve({ data: tables[table].slice(from, to + 1).map((entry) => ({ ...entry })), error: null });
        },
      };
    },
  };
}

function creatinePlanState() {
  const fitRows = retailerRows("Fit House", 1, "fit-house", RETAILER_SCOPE["Fit House"]);
  const discountRows = retailerRows("Discount Supplements", 2, "discount-supplements", RETAILER_SCOPE["Discount Supplements"]);
  const jonsRows = retailerRows("Jon's Supplements", 10, "jons-supplements", RETAILER_SCOPE["Jon's Supplements"]);
  return { fitRows, discountRows, jonsRows, state: stateFromRows([...fitRows, ...discountRows, ...jonsRows]) };
}

function responseForSnapshot(snapshot) {
  return { ok: true, headers: { get: () => "0" }, json: async () => ({ products: snapshot.products }) };
}

function planRows() {
  const ids = authorisedOfferIds();
  return ids.map((id, index) => {
    const oldPrice = "10.00";
    const sourcePrice = index === 0 ? "11.00" : oldPrice;
    const oldUrl = `https://fithouse.uk/products/example-${id}?variant=${id}`;
    const sourceUrl = index === 1 ? `https://fithouse.uk/products/new-example-${id}?variant=${id}` : oldUrl;
    return {
      offer_id: id,
      retailer_product_id: String(10_000 + Number(id)),
      external_product_id: `p-${id}`,
      external_variant_id: id,
      action: index === 0 ? "UPDATE_PRICE" : index === 1 ? "UPDATE_URL" : "VERIFY_NO_CHANGE",
      changed_fields: { price: index === 0, stock: false, url: index === 1, blocked: false },
      source_captured_at: "2026-07-19T03:17:00.000Z",
      source: { external_sku: `sku-${id}` },
      target: {
        price: oldPrice,
        shipping_cost: "3.99",
        total_price: "13.99",
        in_stock: true,
        url: oldUrl,
        external_url: oldUrl,
      },
      source_values: {
        price: sourcePrice,
        shipping_cost: "3.99",
        stock: true,
        url: sourceUrl,
      },
    };
  });
}

function plan() {
  const rows = planRows();
  return {
    generated_at: "2026-07-19T03:17:00.000Z",
    project_ref: EXPECTED_PRODUCTION_REF,
    safe_update: "UNSET",
    status: "DRY_RUN_READY",
    classified_rows: rows,
    retailer_results: [],
    classification_counts: { VERIFY_NO_CHANGE: 33, UPDATE_PRICE: 1, UPDATE_URL: 1 },
    blockers: [],
  };
}

function fakeClientFromPlanRows(rows) {
  const db = {
    retailers: [{ id: 1, name: "Fit House" }],
    products: [{ id: 1 }],
    product_variants: [{ id: 1 }],
    retailer_products: rows.map((entry) => ({
      id: entry.retailer_product_id,
      retailer_id: 1,
      product_id: 1,
      product_variant_id: 1,
      external_product_id: entry.external_product_id,
      external_variant_id: entry.external_variant_id,
      external_sku: entry.source.external_sku,
      external_url: entry.target.external_url,
    })),
    offers: rows.map((entry) => ({
      id: entry.offer_id,
      retailer_id: 1,
      product_id: 1,
      product_variant_id: 1,
      retailer_product_id: entry.retailer_product_id,
      price: entry.target.price,
      shipping_cost: entry.target.shipping_cost,
      total_price: entry.target.total_price,
      in_stock: entry.target.in_stock,
      url: entry.target.url,
      last_checked_at: "2026-07-18T03:00:00.000Z",
    })),
    price_history: [],
  };
  let nextHistoryId = 1;
  function filterRows(table, filters) {
    return db[table].filter((entry) => filters.every(({ field, value }) => String(entry[field]) === String(value)));
  }
  return {
    db,
    from(table) {
      const filters = [];
      let patch = null;
      return {
        select(_columns, options = {}) {
          if (patch) {
            const matches = filterRows(table, filters);
            for (const entry of matches) Object.assign(entry, patch);
            return Promise.resolve({ data: matches.map((entry) => ({ ...entry })), error: null });
          }
          if (options.count === "exact" && options.head === true) return Promise.resolve({ count: db[table].length, error: null });
          return this;
        },
        range(from, to) {
          return Promise.resolve({ data: db[table].slice(from, to + 1).map((entry) => ({ ...entry })), error: null });
        },
        eq(field, value) {
          filters.push({ field, value });
          return this;
        },
        limit(limit) {
          return Promise.resolve({ data: filterRows(table, filters).slice(0, limit).map((entry) => ({ ...entry })), error: null });
        },
        update(value) {
          patch = value;
          return this;
        },
        insert(value) {
          const row = { id: nextHistoryId++, ...value };
          db[table].push(row);
          return Promise.resolve({ data: [row], error: null });
        },
      };
    },
  };
}

test("environment guard allows only production main schedule or manual dispatch", () => {
  assert.equal(assertExecutionEnvironment(env()), EXPECTED_PRODUCTION_REF);
  assert.equal(assertExecutionEnvironment(env({ GITHUB_EVENT_NAME: "workflow_dispatch" })), EXPECTED_PRODUCTION_REF);
  assert.throws(() => assertExecutionEnvironment(env({ SAFE_UPDATE: "1" })), /SAFE_UPDATE/);
  assert.throws(() => assertExecutionEnvironment(env({ NEXT_PUBLIC_SUPABASE_URL: "https://hxnrsyyqffztlvcrtgbf.supabase.co" })), /production ref mismatch/);
  assert.throws(() => assertExecutionEnvironment(env({ GITHUB_REF: "refs/heads/feature" })), /only on main/);
  assert.throws(() => assertExecutionEnvironment(env({ GITHUB_EVENT_NAME: "pull_request" })), /cannot run/);
});

test("daily scope is exactly the 35 approved creatine offers and excludes no-source retailers", () => {
  const ids = authorisedOfferIds();
  assert.equal(ids.length, 35);
  assert.equal(new Set(ids).size, 35);
  assert.deepEqual(Object.fromEntries(Object.entries(RETAILER_SCOPE).map(([name, scope]) => [name, scope.offerIds.length])), {
    "Fit House": 18,
    "Discount Supplements": 12,
    "Jon's Supplements": 5,
  });
  assert.equal(ids.includes("999999"), false);
});

test("scope validation rejects inactive creatine, merged products and missing Shopify identity", () => {
  const good = row();
  assert.equal(scopeRowsForRetailer({ retailerName: "Fit House", scope: { ...RETAILER_SCOPE["Fit House"], expectedCount: 1, offerIds: [952] }, state: stateFromRows([good]) }).length, 1);
  assert.throws(() => scopeRowsForRetailer({ retailerName: "Fit House", scope: { ...RETAILER_SCOPE["Fit House"], expectedCount: 1, offerIds: [952] }, state: stateFromRows([{ ...good, product: { ...good.product, is_active: false } }]) }), /not active creatine/);
  assert.throws(() => scopeRowsForRetailer({ retailerName: "Fit House", scope: { ...RETAILER_SCOPE["Fit House"], expectedCount: 1, offerIds: [952] }, state: stateFromRows([{ ...good, product: { ...good.product, merged_into_product_id: 88 } }]) }), /not active creatine/);
  assert.throws(() => scopeRowsForRetailer({ retailerName: "Fit House", scope: { ...RETAILER_SCOPE["Fit House"], expectedCount: 1, offerIds: [952] }, state: stateFromRows([{ ...good, mapping: { ...good.mapping, external_variant_id: null } }]) }), /missing Shopify identity/);
});

test("existing classifier is reused for no-change, price, url and blockers", () => {
  const rows = Array.from({ length: 7 }, (_, index) => row({
    offerId: 952 + index,
    retailerProductId: 1952 + index,
    productId: 70 + index,
    variantId: 170 + index,
    externalProductId: `p${index}`,
    externalVariantId: `v${index}`,
    sku: `sku-${index}`,
    url: `https://fithouse.uk/products/example-${index}?variant=v${index}`,
  }));
  const scope = { ...RETAILER_SCOPE["Fit House"], expectedCount: 7, offerIds: rows.map((entry) => entry.offer.id), previousSourceProductCount: 7 };
  const noChange = classifyRetailerScope({ retailerName: "Fit House", scope, state: stateFromRows(rows), snapshot: shopifySnapshotForRows(rows), sourceCapturedAt: "2026-07-19T03:17:00.000Z", now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(noChange.classification.state, "DRY_RUN_READY");
  assert.equal(noChange.classified_rows.every((entry) => entry.action === "VERIFY_NO_CHANGE"), true);
  const changed = classifyRetailerScope({
    retailerName: "Fit House",
    scope,
    state: stateFromRows(rows),
    snapshot: shopifySnapshotForRows(rows, (product, variant, index) => {
      if (index === 0) {
        product.handle = "new-example-0";
        variant.price = "10.50";
      }
    }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(changed.classified_rows.find((entry) => entry.action !== "VERIFY_NO_CHANGE").action, "UPDATE_PRICE_STOCK_URL");
  const stock = classifyRetailerScope({
    retailerName: "Fit House",
    scope,
    state: stateFromRows(rows),
    snapshot: shopifySnapshotForRows(rows, (_product, variant, index) => {
      if (index === 0) variant.available = false;
    }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(stock.classified_rows.find((entry) => entry.action !== "VERIFY_NO_CHANGE").action, "UPDATE_STOCK");
  const drift = classifyRetailerScope({
    retailerName: "Fit House",
    scope,
    state: stateFromRows(rows),
    snapshot: shopifySnapshotForRows(rows, (product, _variant, index) => {
      if (index === 0) product.id = "wrong";
    }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(drift.classification.state, "BLOCKED");
  assert.equal(drift.classification.action, "BLOCK_IDENTITY_DRIFT");
  const stale = classifyRetailerScope({ retailerName: "Fit House", scope, state: stateFromRows(rows), snapshot: shopifySnapshotForRows(rows), sourceCapturedAt: "2026-07-17T03:17:00.000Z", now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(stale.classification.reason, "SOURCE_FRESHNESS");
  const collapsed = classifyRetailerScope({ retailerName: "Fit House", scope, state: stateFromRows(rows), snapshot: shopifySnapshotForRows(rows.slice(0, 5)), sourceCapturedAt: "2026-07-19T03:17:00.000Z", now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(collapsed.classification.reason, "SOURCE_COLLAPSE");
  const hardPrice = classifyRetailerScope({
    retailerName: "Fit House",
    scope,
    state: stateFromRows(rows),
    snapshot: shopifySnapshotForRows(rows, (_product, variant, index) => {
      if (index === 0) variant.price = "40.00";
    }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(hardPrice.classification.reason, "HARD_PRICE_ANOMALY");
  assert.equal(policyFor(scope).required_matched_offers, 7);
});

test("Jon's source requests GB market while Fit House and Discount stay unchanged", async () => {
  const { fitRows, discountRows, jonsRows, state } = creatinePlanState();
  const calls = [];
  const snapshots = new Map([
    ["https://fithouse.uk", paddedShopifySnapshot({ rows: fitRows, storeOrigin: "https://fithouse.uk", productCount: 85, variantCount: 85, availableCount: 85 })],
    ["https://www.discount-supplements.co.uk", paddedShopifySnapshot({ rows: discountRows, storeOrigin: "https://www.discount-supplements.co.uk", productCount: 12, variantCount: 12, availableCount: 12 })],
    ["https://jonssupplements.co.uk", paddedShopifySnapshot({ rows: jonsRows, storeOrigin: "https://jonssupplements.co.uk", productCount: 224, variantCount: 844, availableCount: 581 })],
  ]);
  const fetchImpl = async (url) => {
    calls.push(new URL(url.href));
    return responseForSnapshot(snapshots.get(new URL(url.href).origin));
  };
  const plan = await buildRefreshPlan({ client: clientFromState(state), fetchImpl, now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(plan.status, "DRY_RUN_READY");
  assert.equal(plan.classified_rows.length, 35);
  assert.deepEqual(plan.classification_counts, { VERIFY_NO_CHANGE: 35 });
  assert.equal(plan.blockers.length, 0);
  assert.equal(calls.find((url) => url.origin === "https://jonssupplements.co.uk").searchParams.get("country"), "GB");
  assert.equal(calls.find((url) => url.origin === "https://fithouse.uk").searchParams.has("country"), false);
  assert.equal(calls.find((url) => url.origin === "https://www.discount-supplements.co.uk").searchParams.has("country"), false);
  assert.equal(plan.retailer_results.find((entry) => entry.retailer === "Jon's Supplements").source.market_country, "GB");
});

test("Jon's market availability collapse is SOURCE_DEGRADED before MASS_OOS", () => {
  const { jonsRows, state } = creatinePlanState();
  const scope = RETAILER_SCOPE["Jon's Supplements"];
  const collapsed = classifyRetailerScope({
    retailerName: "Jon's Supplements",
    scope,
    state,
    snapshot: paddedShopifySnapshot({ rows: jonsRows, storeOrigin: scope.storeUrl, productCount: 224, variantCount: 844, availableCount: 1, targetAvailable: false }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(collapsed.classification.reason, "SOURCE_DEGRADED");
  assert.equal(collapsed.classification.action, "BLOCK_SOURCE_ANOMALY");
  assert.equal(collapsed.classification.detail.in_stock_variant_count, 1);
  assert.equal(collapsed.classified_rows.length, 0);

  const genuineOos = classifyRetailerScope({
    retailerName: "Jon's Supplements",
    scope,
    state,
    snapshot: paddedShopifySnapshot({ rows: jonsRows, storeOrigin: scope.storeUrl, productCount: 224, variantCount: 844, availableCount: 581, targetAvailable: false }),
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(genuineOos.classification.reason, "MASS_OOS");
});

test("Jon's SOURCE_DEGRADED retry remains fail-closed even when retry is normal", async () => {
  const { fitRows, discountRows, jonsRows, state } = creatinePlanState();
  const normal = new Map([
    ["https://fithouse.uk", paddedShopifySnapshot({ rows: fitRows, storeOrigin: "https://fithouse.uk", productCount: 85, variantCount: 85, availableCount: 85 })],
    ["https://www.discount-supplements.co.uk", paddedShopifySnapshot({ rows: discountRows, storeOrigin: "https://www.discount-supplements.co.uk", productCount: 12, variantCount: 12, availableCount: 12 })],
    ["https://jonssupplements.co.uk", paddedShopifySnapshot({ rows: jonsRows, storeOrigin: "https://jonssupplements.co.uk", productCount: 224, variantCount: 844, availableCount: 581 })],
  ]);
  const collapsed = paddedShopifySnapshot({ rows: jonsRows, storeOrigin: "https://jonssupplements.co.uk", productCount: 224, variantCount: 844, availableCount: 1, targetAvailable: false });
  let jonsCalls = 0;
  const fetchImpl = async (url) => {
    const origin = new URL(url.href).origin;
    if (origin === "https://jonssupplements.co.uk") {
      jonsCalls += 1;
      return responseForSnapshot(jonsCalls === 1 ? collapsed : normal.get(origin));
    }
    return responseForSnapshot(normal.get(origin));
  };
  const plan = await buildRefreshPlan({ client: clientFromState(state), fetchImpl, now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(plan.status, "BLOCKED");
  assert.equal(plan.classified_rows.length, 30);
  assert.equal(plan.blockers[0].retailer, "Jon's Supplements");
  assert.equal(plan.blockers[0].classification.reason, "SOURCE_DEGRADED");
  assert.equal(plan.blockers[0].classification.detail.retry_state, "DRY_RUN_READY");
  assert.equal(jonsCalls, 2);
});

test("Jon's SOURCE_DEGRADED retry stays blocked when both responses collapse", async () => {
  const { fitRows, discountRows, jonsRows, state } = creatinePlanState();
  const collapsed = paddedShopifySnapshot({ rows: jonsRows, storeOrigin: "https://jonssupplements.co.uk", productCount: 224, variantCount: 844, availableCount: 1, targetAvailable: false });
  const snapshots = new Map([
    ["https://fithouse.uk", paddedShopifySnapshot({ rows: fitRows, storeOrigin: "https://fithouse.uk", productCount: 85, variantCount: 85, availableCount: 85 })],
    ["https://www.discount-supplements.co.uk", paddedShopifySnapshot({ rows: discountRows, storeOrigin: "https://www.discount-supplements.co.uk", productCount: 12, variantCount: 12, availableCount: 12 })],
    ["https://jonssupplements.co.uk", collapsed],
  ]);
  const plan = await buildRefreshPlan({ client: clientFromState(state), fetchImpl: async (url) => responseForSnapshot(snapshots.get(new URL(url.href).origin)), now: new Date("2026-07-19T03:17:00.000Z") });
  assert.equal(plan.status, "BLOCKED");
  assert.equal(plan.blockers[0].classification.reason, "SOURCE_DEGRADED");
  assert.equal(plan.blockers[0].classification.detail.retry_reason, "SOURCE_DEGRADED");
});

test("HTML challenge and missing target variant remain blocked without stock coercion", async () => {
  const { jonsRows, state } = creatinePlanState();
  const scope = RETAILER_SCOPE["Jon's Supplements"];
  await assert.rejects(
    buildRefreshPlan({
      client: clientFromState(stateFromRows([...retailerRows("Fit House", 1, "fit-house", RETAILER_SCOPE["Fit House"]), ...retailerRows("Discount Supplements", 2, "discount-supplements", RETAILER_SCOPE["Discount Supplements"]), ...jonsRows])),
      fetchImpl: async (url) => {
        const origin = new URL(url.href).origin;
        if (origin === "https://jonssupplements.co.uk") return { ok: true, headers: { get: () => "0" }, text: async () => "<html>challenge</html>" };
        const rows = origin === "https://fithouse.uk" ? retailerRows("Fit House", 1, "fit-house", RETAILER_SCOPE["Fit House"]) : retailerRows("Discount Supplements", 2, "discount-supplements", RETAILER_SCOPE["Discount Supplements"]);
        return responseForSnapshot(paddedShopifySnapshot({ rows, storeOrigin: origin, productCount: origin === "https://fithouse.uk" ? 85 : 12, variantCount: origin === "https://fithouse.uk" ? 85 : 12, availableCount: origin === "https://fithouse.uk" ? 85 : 12 }));
      },
      now: new Date("2026-07-19T03:17:00.000Z"),
    }),
    /Malformed Shopify products JSON/,
  );
  const missing = paddedShopifySnapshot({ rows: jonsRows.slice(1), storeOrigin: scope.storeUrl, productCount: 224, variantCount: 844, availableCount: 581 });
  const result = classifyRetailerScope({
    retailerName: "Jon's Supplements",
    scope,
    state,
    snapshot: missing,
    sourceCapturedAt: "2026-07-19T03:17:00.000Z",
    now: new Date("2026-07-19T03:17:00.000Z"),
  });
  assert.equal(result.classification.reason, "IDENTITY_DRIFT");
  assert.equal(result.source.in_stock_variant_count, 581);
});

test("apply updates only offers, mapping URLs and price history, and replay is idempotent", async () => {
  const refreshPlan = plan();
  const fake = fakeClientFromPlanRows(refreshPlan.classified_rows);
  const first = await applyRefreshPlan({ client: fake, plan: refreshPlan });
  assert.equal(first.status, "PASS");
  assert.deepEqual(first.count_delta, { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 1 });
  assert.equal(first.logical_deltas.price_changes, 1);
  assert.equal(first.logical_deltas.url_changes, 1);
  assert.equal(first.logical_deltas.last_checked_at_updates, 35);
  assert.equal(fake.db.offers.find((entry) => String(entry.id) === refreshPlan.classified_rows[0].offer_id).price, "11.00");
  assert.equal(fake.db.retailer_products.find((entry) => String(entry.id) === refreshPlan.classified_rows[1].retailer_product_id).external_url, plannedValues(refreshPlan.classified_rows[1]).url);
  const second = await applyRefreshPlan({ client: fake, plan: refreshPlan });
  assert.equal(second.status, "PASS");
  assert.equal(second.count_delta.price_history, 0);
  assert.equal(second.logical_deltas.last_checked_at_updates, 0);
  assert.equal(fake.db.price_history.length, 1);
});

test("workflow is scheduled, main-only, secret-backed and has no public trigger", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/creatine-offer-refresh.yml"), "utf8");
  assert.match(workflow, /cron:\s*"17 3 \* \* \*"/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /environment:\s*production-readonly/);
  assert.doesNotMatch(workflow, /pull_request|repository_dispatch|workflow_run/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /node scripts\/creatine-offer-refresh\.js --dry-run/);
  assert.match(workflow, /node scripts\/creatine-offer-refresh\.js --apply/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_SUPABASE_URL\s*\}\}/);
});

test("CLI mode parser remains narrow", () => {
  assert.deepEqual(parseArgs([]), { mode: "dry-run", writeArtifacts: true });
  assert.equal(parseArgs(["--apply"]).mode, "apply");
  assert.equal(parseArgs(["--summary", "--no-artifacts"]).writeArtifacts, false);
  assert.throws(() => parseArgs(["--retailer=all"]), /Unknown argument/);
});
