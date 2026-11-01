const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const ROOT = process.cwd();

function compileModule(filename, mocks = {}) {
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
  const originalRequire = mod.require.bind(mod);
  mod.require = (request) =>
    Object.prototype.hasOwnProperty.call(mocks, request)
      ? mocks[request]
      : originalRequire(request);
  mod._compile(outputText, filename);
  return mod.exports;
}

const searchIntent = compileModule(path.join(ROOT, "app/lib/searchIntent.ts"));
const freshness = compileModule(path.join(ROOT, "app/lib/offerFreshness.ts"));
const pricing = compileModule(path.join(ROOT, "app/lib/pricing.ts"));
const enginePath = path.join(ROOT, "app/lib/decisionEngine.ts");
const engineSource = fs.readFileSync(enginePath, "utf8");
const productsSource = fs.readFileSync(
  path.join(ROOT, "app/lib/products.ts"),
  "utf8"
);
const engine = compileModule(enginePath, {
  "./offerFreshness": freshness,
  "./pricing": pricing,
  "./products": {
    SEARCH_RESULT_LOAD_LIMIT: 1000,
    searchProducts: async () => {
      throw new Error("Unexpected live search in unit test");
    },
  },
});
const NOW = new Date("2026-11-01T12:00:00.000Z");

function offer(overrides = {}) {
  const variantId = String(overrides.product_variant_id || "9001");
  const totalPrice = overrides.totalPrice ?? 20;
  const shippingCost = overrides.shippingCost ?? 0;
  return {
    id: String(overrides.id || `8${variantId}`),
    product_variant_id: variantId,
    price: totalPrice - shippingCost,
    shipping_cost: shippingCost,
    last_checked_at:
      overrides.last_checked_at || "2026-11-01T10:00:00.000Z",
    url: "https://retailer.example/product",
    in_stock: true,
    retailer: {
      id: String(overrides.retailerId || "7"),
      name: overrides.retailerName || "Example Retailer",
      slug: "example-retailer",
      logo: null,
    },
    product_variant: {
      id: variantId,
      display_name: overrides.variantLabel || `${overrides.servings || 100} servings`,
      flavour_label: null,
      size_value: 500,
      size_unit: "g",
      product_format: overrides.format || "powder",
      nutrition_override: null,
    },
    productPrice: totalPrice - shippingCost,
    deliveredPrice:
      overrides.unknownShipping === true
        ? null
        : { productPrice: totalPrice - shippingCost, shippingCost, totalPrice },
  };
}

function candidate(id, overrides = {}) {
  const variantId = String(overrides.variantId || `${9000 + Number(id)}`);
  const primaryOffer = offer({
    id: `${8000 + Number(id)}`,
    product_variant_id: variantId,
    totalPrice: overrides.totalPrice ?? 20,
    shippingCost: overrides.shippingCost ?? 0,
    last_checked_at: overrides.last_checked_at,
    retailerId: overrides.retailerId || "7",
    variantLabel: overrides.variantLabel || `${overrides.servings || 100} servings`,
    servings: overrides.servings || 100,
    unknownShipping: overrides.unknownShipping,
  });
  const extraOffers = Array.from({ length: overrides.extraOffers || 0 }, (_, index) =>
    offer({
      id: `${id}7${index}`,
      product_variant_id: variantId,
      totalPrice: (overrides.totalPrice ?? 20) + index + 1,
      retailerId: String(20 + index),
      last_checked_at: overrides.last_checked_at,
      variantLabel: overrides.variantLabel || `${overrides.servings || 100} servings`,
      servings: overrides.servings || 100,
    })
  );
  return {
    id: String(id),
    slug: `product-${id}`,
    name: overrides.name || `Product ${id}`,
    brand: overrides.brand || "Example",
    category: overrides.category || "Creatine",
    image: null,
    net_weight_g: 500,
    net_volume_ml: null,
    product_format: "powder",
    serving_size_g: 5,
    serving_size_ml: null,
    protein_per_serving_g: overrides.protein ?? null,
    creatine_per_serving_g: 5,
    serving_count_verified: overrides.servings ?? 100,
    nutrition_verified: true,
    unit_pricing_verified: true,
    cheapestOffer: primaryOffer,
    validOffers: [primaryOffer, ...extraOffers],
    availableOfferCount: 1 + extraOffers.length,
    availableRetailerCount: 1 + extraOffers.length,
    deliveryComparisonComplete: !overrides.unknownShipping,
    observedRetailerCount: 1 + extraOffers.length,
    observedRetailerKeys: ["example-retailer"],
    latestVerificationAt: primaryOffer.last_checked_at,
    presentationState: "LIVE",
    verifiedCostPer5gCreatine:
      overrides.costPer5g === undefined ? 0.2 : overrides.costPer5g,
    verifiedCostPer25gProtein:
      overrides.costPer25g === undefined ? null : overrides.costPer25g,
    verifiedPricePerKg: 40,
    verifiedPricePerLitre: null,
    verifiedPricePerServing:
      overrides.pricePerServing === undefined ? 0.5 : overrides.pricePerServing,
    relevanceScore: overrides.relevanceScore || 0,
    selectedVariantId:
      overrides.selectedVariantId === undefined
        ? variantId
        : overrides.selectedVariantId,
    selectedVariantLabel: primaryOffer.product_variant.display_name,
    caffeineFreeConfirmed: overrides.caffeineFreeConfirmed || false,
  };
}

function searchFixture(results, options = {}) {
  const calls = [];
  const search = async (...args) => {
    calls.push(args);
    return {
      results,
      facets: { categories: [], brands: [], retailers: [], caffeine: [] },
      totalCount: options.totalCount ?? results.length,
      unfilteredCount: options.totalCount ?? results.length,
      page: 1,
      pageSize: results.length,
      totalPages: 1,
      startResult: results.length ? 1 : 0,
      endResult: results.length,
      resultLimit: 1000,
      maxDeliveredPrice: null,
      intentPlan: null,
      valueMetricAvailable: true,
      metadata: {
        originalQuery: "",
        appliedQuery: "",
        correctedQuery: null,
        queryVariants: [],
        matchStatus: results.length ? "exact" : "none",
        searchMode: "standard_ilike",
      },
      error: options.error || null,
    };
  };
  return { calls, search };
}

function request(query, options = {}) {
  const plan = searchIntent.buildSearchIntentPlan(query);
  return engine.createDecisionRequest({
    intentPlan: plan,
    explicitPriority: options.explicitPriority,
    selectedProducts: options.selectedProducts,
  });
}

test("DecisionRequest composes SearchIntentPlan and explicit priority wins", () => {
  const inferred = request("cheap creatine");
  assert.equal(inferred.primaryPriority, "LOWEST_DELIVERED_PRICE");
  assert.equal(inferred.primaryPrioritySource, "query");
  assert.equal(inferred.intentPlan.textQuery, "creatine");

  const explicit = request("cheap creatine", {
    explicitPriority: "LOWEST_COST_PER_5G_CREATINE",
  });
  assert.equal(explicit.primaryPriority, "LOWEST_COST_PER_5G_CREATINE");
  assert.equal(explicit.primaryPrioritySource, "url");
  assert.equal(explicit.shortlistLimit, 3);
});
test("request A returns at most three exact variants ordered by delivered price", async () => {
  const fixture = searchFixture([
    candidate(4, { totalPrice: 14 }),
    candidate(2, { totalPrice: 12 }),
    candidate(1, { totalPrice: 11 }),
    candidate(3, { totalPrice: 13 }),
  ]);
  const result = await engine.runDecisionEngine(request("cheap creatine"), {
    search: fixture.search,
    now: NOW,
  });
  assert.equal(result.status, "ANSWERED");
  assert.equal(result.interpretedRequest.primaryPriority, "LOWEST_DELIVERED_PRICE");
  assert.deepEqual(result.shortlist.map(({ productId }) => productId), ["1", "2", "3"]);
  assert.ok(result.shortlist.every(({ productHref, variantId }) =>
    productHref.includes(`variant=${variantId}`)
  ));
  assert.equal(fixture.calls[0][4].pageSize, 1000);
});

for (const testCase of [
  {
    priority: "LOWEST_DELIVERED_PRICE",
    query: "creatine",
    winnerLabel: "Lowest delivered price",
    metricLabel: "Delivered price",
    values: [
      { totalPrice: 30 },
      { totalPrice: 10 },
      { totalPrice: 20 },
    ],
  },
  {
    priority: "LOWEST_PRICE_PER_SERVING",
    query: "creatine",
    winnerLabel: "Lowest cost per serving",
    metricLabel: "Cost per serving",
    values: [
      { pricePerServing: 0.6 },
      { pricePerServing: 0.4 },
      { pricePerServing: 0.5 },
    ],
  },
  {
    priority: "LOWEST_COST_PER_25G_PROTEIN",
    query: "whey",
    winnerLabel: "Lowest cost per 25 g protein",
    metricLabel: "Cost per 25 g protein",
    values: [
      { category: "Whey Protein", costPer25g: 0.6 },
      { category: "Whey Protein", costPer25g: 0.4 },
      { category: "Whey Protein", costPer25g: 0.5 },
    ],
  },
  {
    priority: "LOWEST_COST_PER_5G_CREATINE",
    query: "creatine",
    winnerLabel: "Lowest cost per 5 g creatine",
    metricLabel: "Cost per 5 g creatine",
    values: [
      { costPer5g: 0.6 },
      { costPer5g: 0.4 },
      { costPer5g: 0.5 },
    ],
  },
]) {
  test(`${testCase.priority} reserves its superlative reason for Pick 1`, async () => {
    const fixture = searchFixture(
      testCase.values.map((values, index) => candidate(index + 1, values))
    );
    const result = await engine.runDecisionEngine(
      request(testCase.query, { explicitPriority: testCase.priority }),
      { search: fixture.search, now: NOW }
    );

    assert.equal(result.status, "ANSWERED");
    assert.equal(result.shortlist[0].primaryReason.label, testCase.winnerLabel);
    assert.deepEqual(
      result.shortlist.slice(1).map(({ primaryReason }) => primaryReason.label),
      [testCase.metricLabel, testCase.metricLabel]
    );
    assert.ok(
      result.shortlist.slice(1).every(
        ({ primaryReason }) => !/\blowest\b/i.test(primaryReason.label)
      )
    );
  });
}

test("request B applies hard constraints and asks exactly one priority question", async () => {
  const decisionRequest = request("creatine under £20 with at least 100 servings");
  assert.equal(decisionRequest.intentPlan.filters.maxDeliveredPrice, 20);
  assert.equal(decisionRequest.intentPlan.filters.minVerifiedServings, 100);
  const fixture = searchFixture([candidate(1), candidate(2)]);
  const result = await engine.runDecisionEngine(decisionRequest, {
    search: fixture.search,
    now: NOW,
  });
  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.equal(result.clarification.question, "What matters most?");
  assert.deepEqual(
    result.clarification.choices.map(({ priority }) => priority),
    [
      "LOWEST_DELIVERED_PRICE",
      "LOWEST_PRICE_PER_SERVING",
      "LOWEST_COST_PER_5G_CREATINE",
    ]
  );
});

test("request C ranks only verified protein variants by price per serving", async () => {
  const fixture = searchFixture([
    candidate(1, {
      category: "Whey Protein",
      protein: 25,
      pricePerServing: 0.7,
      costPer25g: 0.7,
    }),
    candidate(2, {
      category: "Whey Protein",
      protein: 30,
      pricePerServing: 0.45,
      costPer25g: 0.38,
    }),
  ]);
  const decisionRequest = request(
    "whey with at least 25g protein and lowest price per serving"
  );
  assert.equal(decisionRequest.intentPlan.textQuery, "whey");
  assert.equal(decisionRequest.intentPlan.filters.minProteinPerServingG, 25);
  const result = await engine.runDecisionEngine(decisionRequest, {
    search: fixture.search,
    now: NOW,
  });
  assert.equal(result.status, "ANSWERED");
  assert.equal(result.interpretedRequest.primaryPriority, "LOWEST_PRICE_PER_SERVING");
  assert.deepEqual(result.shortlist.map(({ productId }) => productId), ["2", "1"]);
});

test("request D auto-resolves its only applicable priority without claiming a user choice", async () => {
  const decisionRequest = request(
    "pre workout under 200mg caffeine with citrulline"
  );
  const fixture = searchFixture([
    candidate(1, { category: "Pre Workout", pricePerServing: null }),
    candidate(2, { category: "Pre Workout", pricePerServing: null }),
  ]);
  const result = await engine.runDecisionEngine(decisionRequest, {
    search: fixture.search,
    now: NOW,
  });

  assert.equal(result.status, "ANSWERED");
  assert.equal(result.interpretedRequest.primaryPriority, "LOWEST_DELIVERED_PRICE");
  assert.equal(result.interpretedRequest.primaryPrioritySource, null);
  assert.equal(result.clarification, null);
});

test("request E preserves caffeine-free intent while asking between applicable priorities", async () => {
  const decisionRequest = request("caffeine free pre workout");
  const fixture = searchFixture([
    candidate(1, { category: "Pre Workout", caffeineFreeConfirmed: true }),
    candidate(2, { category: "Pre Workout", caffeineFreeConfirmed: true }),
  ]);
  const result = await engine.runDecisionEngine(decisionRequest, {
    search: fixture.search,
    now: NOW,
  });

  assert.equal(result.status, "NEEDS_CLARIFICATION");
  assert.equal(result.clarification.kind, "PRIMARY_PRIORITY");
  assert.equal(decisionRequest.intentPlan.filters.caffeineFree, true);
});

test("serialized caffeine-free priority selection rebuilds the same DecisionRequest", () => {
  const originalPlan = searchIntent.buildSearchIntentPlan(
    "caffeine free pre workout"
  );
  const params = searchIntent.searchIntentParamsFromPlan(originalPlan);
  params.set("priority", "lowest_delivered_price");
  const explicit = searchIntent.normalizeSearchIntentUrlState({
    servings_min: params.get("servings_min") || undefined,
    protein_min_g: params.get("protein_min_g") || undefined,
    caffeine_max_mg: params.get("caffeine_max_mg") || undefined,
    format: params.get("format") || undefined,
    ingredient: params.getAll("ingredient"),
  });
  const reloadedPlan = searchIntent.buildSearchIntentPlan(
    params.get("q") || "",
    {
      explicit,
      caffeineFree: params.get("caffeine") === "free",
    }
  );
  const reloadedRequest = engine.createDecisionRequest({
    intentPlan: reloadedPlan,
    explicitPriority: engine.normalizeDecisionPriority(params.get("priority")),
  });

  assert.equal(params.get("q"), "pre workout");
  assert.equal(params.get("caffeine"), "free");
  assert.equal(reloadedRequest.intentPlan.filters.caffeineFree, true);
  assert.equal(reloadedRequest.primaryPriority, "LOWEST_DELIVERED_PRICE");
  assert.equal(reloadedRequest.primaryPrioritySource, "url");
});

test("request F is a DATA_GAP and request G is a SAFETY_BOUNDARY without search", async () => {
  let searchCalls = 0;
  const search = async () => {
    searchCalls += 1;
    throw new Error("Boundary requests must not search");
  };
  const dataGap = await engine.runDecisionEngine(request("protein low sugar"), { search });
  assert.equal(dataGap.status, "DATA_GAP");
  assert.equal(dataGap.shortlist.length, 0);
  assert.match(dataGap.message, /verified low sugar data/i);

  const safety = await engine.runDecisionEngine(
    request("something for a sensitive stomach"),
    { search }
  );
  assert.equal(safety.status, "SAFETY_BOUNDARY");
  assert.equal(safety.shortlist.length, 0);
  assert.equal(searchCalls, 0);
});

test("request H hands valid product context to Product Comparison and never guesses IDs", async () => {
  const missingContext = await engine.runDecisionEngine(
    request("better of these two products if my priority is cost per serving")
  );
  assert.equal(missingContext.status, "NEEDS_CLARIFICATION");
  assert.equal(missingContext.clarification.kind, "PRODUCT_CONTEXT");
  assert.equal(missingContext.clarification.actionHref, "/compare");

  const withContext = await engine.runDecisionEngine(
    request("better of these two products if my priority is cost per serving", {
      selectedProducts: [{ productId: "10" }, { productId: "20" }],
    })
  );
  assert.equal(withContext.status, "ANSWERED");
  assert.equal(withContext.comparisonHandoff.href, "/compare?left=10&right=20");
  assert.equal(withContext.shortlist.length, 0);
});

test("missing metrics, unknown shipping, stale offers and variant mismatches fail closed", async () => {
  const fixtures = [
    candidate(1, { pricePerServing: null }),
    candidate(2, { unknownShipping: true }),
    candidate(3, { last_checked_at: "2026-10-30T10:00:00.000Z" }),
    candidate(4, { selectedVariantId: "999999" }),
  ];
  const search = searchFixture(fixtures).search;
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search, now: NOW }
  );
  assert.equal(result.status, "DATA_GAP");
  assert.equal(result.shortlist.length, 0);
});

test("ties use delivered price, coverage, name and stable IDs without a score", async () => {
  const fixture = searchFixture([
    candidate(10, { name: "Zulu", totalPrice: 20, pricePerServing: 0.5 }),
    candidate(2, {
      name: "Alpha",
      totalPrice: 20,
      pricePerServing: 0.5,
      extraOffers: 1,
    }),
    candidate(1, { name: "Alpha", totalPrice: 20, pricePerServing: 0.5 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.deepEqual(result.shortlist.map(({ productId }) => productId), ["2", "1", "10"]);
  assert.doesNotMatch(engineSource, /scout.?score|weighted.?score|hidden.?score/i);
});

test("shortlists are never padded and trade-offs remain structured", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20, pricePerServing: 0.4, servings: 50 }),
    candidate(2, { totalPrice: 15, pricePerServing: 0.5, servings: 100 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.equal(result.shortlist.length, 2);
  assert.deepEqual(
    result.shortlist[0].tradeOffs.map(({ type }) => type),
    ["higher_upfront_price", "fewer_servings"]
  );
  assert.equal(typeof result.shortlist[0].tradeOffs[0].value, "number");
});

test("equal penny prices do not create a higher-price trade-off", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20, pricePerServing: 0.5 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.ok(
    result.shortlist.every(({ tradeOffs }) =>
      tradeOffs.every(({ type }) => type !== "higher_upfront_price")
    )
  );
});

test("floating noise within one penny does not create a monetary trade-off", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20.0000001, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20.0000002, pricePerServing: 0.5 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.ok(
    result.shortlist.every(({ tradeOffs }) =>
      tradeOffs.every(({ type }) => type !== "higher_upfront_price")
    )
  );
});

test("one penny creates a truthful one-penny higher-price trade-off", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20.01, pricePerServing: 0.5 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  const tradeOff = result.shortlist[1].tradeOffs.find(
    ({ type }) => type === "higher_upfront_price"
  );
  assert.deepEqual(tradeOff, {
    type: "higher_upfront_price",
    comparedToProductId: "1",
    value: 20.01,
    comparedValue: 20,
  });
  assert.equal(Number((tradeOff.value - tradeOff.comparedValue).toFixed(2)), 0.01);
});

test("sub-penny values that display as the same price remain tied", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20.004, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20.003, pricePerServing: 0.5 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.ok(
    result.shortlist.every(({ tradeOffs }) =>
      tradeOffs.every(({ type }) => type !== "higher_upfront_price")
    )
  );
});

test("equal-penny cheapest selection keeps the stable product-ID tie-break", async () => {
  const fixture = searchFixture([
    candidate(20, { totalPrice: 20.003, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20.004, pricePerServing: 0.5 }),
    candidate(9, { totalPrice: 20.02, pricePerServing: 0.6 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  const monetaryTradeOff = result.shortlist[2].tradeOffs.find(
    ({ type }) => type === "higher_upfront_price"
  );
  assert.equal(monetaryTradeOff.comparedToProductId, "2");
  assert.equal(
    Number((monetaryTradeOff.value - monetaryTradeOff.comparedValue).toFixed(2)),
    0.02
  );
});

test("non-price trade-offs remain available for equal-price products", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20, pricePerServing: 0.4 }),
    candidate(2, { totalPrice: 20, pricePerServing: 0.5, extraOffers: 1 }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.deepEqual(
    result.shortlist[0].tradeOffs.map(({ type }) => type),
    ["fewer_retailers"]
  );
});

test("trade-offs remain capped at two when three disadvantages apply", async () => {
  const fixture = searchFixture([
    candidate(1, { totalPrice: 20, pricePerServing: 0.4, servings: 50 }),
    candidate(2, {
      totalPrice: 15,
      pricePerServing: 0.5,
      servings: 100,
      extraOffers: 1,
    }),
  ]);
  const result = await engine.runDecisionEngine(
    request("creatine price per serving"),
    { search: fixture.search, now: NOW }
  );
  assert.deepEqual(
    result.shortlist[0].tradeOffs.map(({ type }) => type),
    ["higher_upfront_price", "fewer_servings"]
  );
  assert.ok(result.shortlist.every(({ tradeOffs }) => tradeOffs.length <= 2));
});

test("shared search extension remains bounded and carries exact offer freshness", () => {
  assert.match(productsSource, /pageSize\?: number/);
  assert.match(productsSource, /Math\.min\(\s*SEARCH_RESULT_LOAD_LIMIT/);
  assert.match(productsSource, /last_checked_at: offer\.last_checked_at/);
});
