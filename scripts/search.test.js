const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadProductsModule(mockSupabase = {}) {
  const filename = path.join(process.cwd(), "app", "lib", "products.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && request === "./pricing") {
      return {
        getDeliveredPrice: () => ({
          productPrice: 10,
          shippingCost: 0,
          totalPrice: 10,
        }),
        getVerifiedCostPer5gCreatine: () => null,
        getVerifiedCostPer25gProtein: () => null,
        getVerifiedPricePerKg: () => null,
        getVerifiedPricePerLitre: () => null,
        getVerifiedPricePerServing: () => null,
      };
    }

    if (parent === mod && request === "./supabase") {
      return { supabase: mockSupabase };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

const { buildSearchQueryPlan, searchProducts, searchQueryVariants } =
  loadProductsModule({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        gt: () => query,
        or: () => query,
        order: () => query,
        range: () => ({
          data: [
            {
              id: 1,
              slug: "magnesium-citrate",
              name: "Magnesium Citrate",
              brand: "Example Brand",
              category: "Magnesium",
              description: null,
              image: null,
              net_weight_g: null,
              net_volume_ml: null,
              product_format: null,
              serving_size_ml: null,
              protein_per_serving_g: null,
              creatine_per_serving_g: null,
              serving_count_verified: null,
              nutrition_verified: null,
              unit_pricing_verified: null,
              offers: [
                {
                  id: 10,
                  price: 10,
                  shipping_cost: 0,
                  url: "https://example.com/product",
                  in_stock: true,
                  retailer: {
                    id: 20,
                    name: "Example Retailer",
                    slug: "example-retailer",
                    logo: null,
                  },
                },
              ],
            },
          ],
          error: null,
        }),
      };

      return query;
    },
  });

const { searchProducts: searchProductsWithNoResults } = loadProductsModule({
  from: () => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      gt: () => query,
      or: () => query,
      order: () => query,
      range: () => ({ data: [], error: null }),
    };

    return query;
  },
});

const suggestionProducts = [
  {
    id: 101,
    slug: "vitamin-d3-tablets-2000iu",
    name: "Vitamin D3 Tablets 2,000iu",
    brand: "Simply Supplements",
    category: "Vitamin D",
    offers: [{ id: 1001, in_stock: true, price: 6.69 }],
  },
  {
    id: 102,
    slug: "vitamin-d3-k2-4000iu",
    name: "Vitamin D3 4000iu & Vitamin K2 100mcg",
    brand: "Simply Supplements",
    category: "Vitamin D",
    offers: [{ id: 1002, in_stock: true, price: 13.99 }],
  },
  {
    id: 103,
    slug: "omega-3-capsules-500mg",
    name: "Omega 3 Capsules 500mg",
    brand: "Simply Supplements",
    category: "Omega 3",
    offers: [{ id: 1003, in_stock: true, price: 8.99 }],
  },
  {
    id: 104,
    slug: "magnesium-citrate-tablets-700mg",
    name: "Magnesium Citrate Tablets 700mg",
    brand: "Simply Supplements",
    category: "Magnesium",
    offers: [{ id: 1004, in_stock: true, price: 13.99 }],
  },
  {
    id: 105,
    slug: "critical-whey",
    name: "Applied Nutrition Critical Whey 2.27kg",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    offers: [{ id: 1005, in_stock: true, price: 39.99 }],
  },
  {
    id: 106,
    slug: "clear-whey",
    name: "Reflex Nutrition Clear Whey Isolate 510g",
    brand: "Reflex Nutrition",
    category: "Whey Protein",
    offers: [{ id: 1006, in_stock: true, price: 27.99 }],
  },
  {
    id: 107,
    slug: "immunoboost",
    name: "ImmunoBoost Tablets with Black Garlic - SimplyBest",
    brand: "Simply Supplements",
    category: "Health Supplements",
    offers: [{ id: 1007, in_stock: true, price: 14.99 }],
  },
  {
    id: 108,
    slug: null,
    name: "Vitamin D Hidden Draft",
    brand: "Private Brand",
    category: "Vitamin D",
    offers: [{ id: 1008, in_stock: true, price: 14.99 }],
  },
];

const { getSearchSuggestions } = loadProductsModule({
  from: () => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      not: () => query,
      gt: () => query,
      or: () => query,
      order: () => query,
      range: () => ({ data: suggestionProducts, error: null }),
    };

    return query;
  },
});

const cases = [
  ["creatin", ["creatin", "creatine"]],
  ["creatine", ["creatine"]],
  ["magnesum", ["magnesum", "magnesium"]],
  ["magnesium", ["magnesium"]],
  ["vit d", ["vit d", "vitamin d"]],
  ["vit d k2", ["vit d k2", "vitamin d k2", "vitamin d%k2", "vitamin d3%k2"]],
  ["vitamin d", ["vitamin d"]],
  ["vitamin d k2", ["vitamin d k2", "vitamin d%k2", "vitamin d3%k2"]],
  ["vitamin d3 k2", ["vitamin d3 k2", "vitamin d3%k2"]],
  ["d3 k2", ["d3 k2", "d3%k2", "vitamin d3%k2"]],
  ["omega3", ["omega3", "omega 3"]],
  ["omega 3", ["omega 3"]],
  ["glucosamin", ["glucosamin", "glucosamine"]],
  ["glucosamine", ["glucosamine"]],
  ["whey protien", ["whey protien", "whey protein"]],
  ["whey protein", ["whey protein"]],
  ["simply supliments", ["simply supliments", "simply supplements"]],
  ["Simply Supplements", ["Simply Supplements", "simply supplements"]],
];

test("search query variants include conservative typo and shortcut corrections", () => {
  for (const [query, expected] of cases) {
    assert.deepEqual(searchQueryVariants(query), expected, query);
  }
});

test("search query variants normalize extra whitespace and deduplicate variants", () => {
  assert.deepEqual(searchQueryVariants("  whey   protien  "), [
    "  whey   protien  ",
    "whey protien",
    "whey protein",
  ]);
  assert.deepEqual(searchQueryVariants("  magnesium  "), [
    "  magnesium  ",
    "magnesium",
  ]);
});

test("search query variants include conservative glucosamine dosage variants", () => {
  assert.deepEqual(searchQueryVariants("glucosamine sulphate 1000mg"), [
    "glucosamine sulphate 1000mg",
    "glucosamine sulphate 1 000mg",
    "glucosamine%sulphate%1000mg",
    "glucosamine%sulphate%1%000mg",
  ]);
  assert.deepEqual(searchQueryVariants("glucosamine sulphate 1,000mg"), [
    "glucosamine sulphate 1,000mg",
    "glucosamine sulphate 1 000mg",
    "glucosamine sulphate 1000mg",
    "glucosamine%sulphate%1%000mg",
    "glucosamine%sulphate%1000mg",
  ]);
  assert.deepEqual(searchQueryVariants("glucosamine 1000mg"), [
    "glucosamine 1000mg",
    "glucosamine 1 000mg",
    "glucosamine%1000mg",
    "glucosamine%1%000mg",
  ]);
  assert.deepEqual(searchQueryVariants("glucosamine 1,000mg"), [
    "glucosamine 1,000mg",
    "glucosamine 1 000mg",
    "glucosamine 1000mg",
    "glucosamine%1%000mg",
    "glucosamine%1000mg",
  ]);
  assert.deepEqual(searchQueryVariants("glucosamine sulphate tablets"), [
    "glucosamine sulphate tablets",
    "glucosamine%sulphate%tablets",
  ]);
});

test("search query variants normalize sulfate spelling conservatively", () => {
  assert.deepEqual(searchQueryVariants("glucosamine sulfate 1000mg"), [
    "glucosamine sulfate 1000mg",
    "glucosamine sulphate 1000mg",
    "glucosamine sulfate 1 000mg",
    "glucosamine sulphate 1 000mg",
    "glucosamine%sulfate%1000mg",
    "glucosamine%sulphate%1000mg",
    "glucosamine%sulfate%1%000mg",
    "glucosamine%sulphate%1%000mg",
  ]);
});

test("goal search variants map exact safe goals only", () => {
  assert.deepEqual(searchQueryVariants("muscle gain"), [
    "muscle gain",
    "whey protein",
    "creatine",
    "mass gainer",
  ]);
  assert.deepEqual(searchQueryVariants("strength"), [
    "strength",
    "creatine",
    "pre workout",
  ]);
  assert.deepEqual(searchQueryVariants("recovery"), [
    "recovery",
    "protein",
    "magnesium",
    "electrolytes",
  ]);
  assert.deepEqual(searchQueryVariants("joint support"), [
    "joint support",
    "glucosamine",
    "chondroitin",
    "collagen",
    "omega 3",
  ]);
  assert.deepEqual(searchQueryVariants("hydration"), [
    "hydration",
    "electrolytes",
  ]);
});

test("risky goal-like terms are not mapped", () => {
  for (const query of [
    "joint pain",
    "arthritis",
    "inflammation",
    "fat loss",
    "anxiety",
    "insomnia",
    "cold",
    "flu",
    "cure",
    "treat",
    "prevent",
  ]) {
    assert.deepEqual(searchQueryVariants(query), [query], query);
    assert.equal(buildSearchQueryPlan(query).searchMode, "standard_ilike", query);
  }
});

test("dosage variants are generated without unsafe comma variants", () => {
  for (const query of [
    "glucosamine sulphate 1000mg",
    "glucosamine sulphate 1500mg",
    "glucosamine sulphate 2000mg",
    "glucosamine sulphate 3000mg",
    "glucosamine sulphate 2000iu",
    "glucosamine sulphate 4000iu",
  ]) {
    const variants = searchQueryVariants(query);

    assert.equal(
      variants.some((variant) => variant.includes(",")),
      false,
      query
    );
    assert.ok(
      variants.some((variant) => variant.includes("%")),
      query
    );
  }
});

function variantMatchesText(variant, text) {
  const pattern = variant
    .split("%")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(pattern, "i").test(text);
}

test("generated glucosamine variants can match stored comma dosage product name", () => {
  const productName = "Glucosamine Sulphate 1,000mg - Tablets";

  for (const query of [
    "glucosamine sulphate 1000mg",
    "glucosamine sulphate 1,000mg",
    "glucosamine 1000mg",
    "glucosamine 1,000mg",
    "glucosamine sulphate tablets",
    "glucosamine sulfate 1000mg",
  ]) {
    assert.equal(
      searchQueryVariants(query).some((variant) =>
        variantMatchesText(variant, productName)
      ),
      true,
      query
    );
  }
});

test("searchProducts sanitizes raw user percent before building search filter", async () => {
  let searchFilter = "";
  const { searchProducts: searchProductsWithCapturedFilter } = loadProductsModule({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        gt: () => query,
        or: (filter) => {
          searchFilter = filter;

          return query;
        },
        order: () => query,
        range: () => ({ data: [], error: null }),
      };

      return query;
    },
  });

  await searchProductsWithCapturedFilter(
    "magnesium%citrate",
    "relevance"
  );

  assert.equal(searchFilter.includes("magnesium%citrate"), false);
  assert.equal(searchFilter.includes("magnesium citrate"), true);
});

test("buildSearchQueryPlan returns corrected magnesium metadata", () => {
  assert.deepEqual(buildSearchQueryPlan("magnesum"), {
    originalQuery: "magnesum",
    appliedQuery: "magnesium",
    correctedQuery: "magnesium",
    queryVariants: ["magnesum", "magnesium"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("buildSearchQueryPlan returns corrected whey protein metadata", () => {
  assert.deepEqual(buildSearchQueryPlan("whey protien"), {
    originalQuery: "whey protien",
    appliedQuery: "whey protein",
    correctedQuery: "whey protein",
    queryVariants: ["whey protien", "whey protein"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("buildSearchQueryPlan returns corrected Simply Supplements metadata", () => {
  assert.deepEqual(buildSearchQueryPlan("simply supliments"), {
    originalQuery: "simply supliments",
    appliedQuery: "simply supplements",
    correctedQuery: "simply supplements",
    queryVariants: ["simply supliments", "simply supplements"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("buildSearchQueryPlan keeps vitamin d k2 as a special variant search", () => {
  assert.deepEqual(buildSearchQueryPlan("vitamin d k2"), {
    originalQuery: "vitamin d k2",
    appliedQuery: "vitamin d k2",
    correctedQuery: null,
    queryVariants: ["vitamin d k2", "vitamin d%k2", "vitamin d3%k2"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("buildSearchQueryPlan returns goal metadata for exact safe goals", () => {
  assert.deepEqual(buildSearchQueryPlan("muscle gain"), {
    originalQuery: "muscle gain",
    appliedQuery: "whey protein, creatine, mass gainer",
    correctedQuery: null,
    queryVariants: ["muscle gain", "whey protein", "creatine", "mass gainer"],
    matchStatus: "none",
    searchMode: "goal_mapped_ilike",
  });
  assert.deepEqual(buildSearchQueryPlan("strength"), {
    originalQuery: "strength",
    appliedQuery: "creatine, pre workout",
    correctedQuery: null,
    queryVariants: ["strength", "creatine", "pre workout"],
    matchStatus: "none",
    searchMode: "goal_mapped_ilike",
  });
  assert.deepEqual(buildSearchQueryPlan("recovery"), {
    originalQuery: "recovery",
    appliedQuery: "protein, magnesium, electrolytes",
    correctedQuery: null,
    queryVariants: ["recovery", "protein", "magnesium", "electrolytes"],
    matchStatus: "none",
    searchMode: "goal_mapped_ilike",
  });
  assert.deepEqual(buildSearchQueryPlan("joint support"), {
    originalQuery: "joint support",
    appliedQuery: "glucosamine, chondroitin, collagen, omega 3",
    correctedQuery: null,
    queryVariants: [
      "joint support",
      "glucosamine",
      "chondroitin",
      "collagen",
      "omega 3",
    ],
    matchStatus: "none",
    searchMode: "goal_mapped_ilike",
  });
  assert.deepEqual(buildSearchQueryPlan("hydration"), {
    originalQuery: "hydration",
    appliedQuery: "electrolytes",
    correctedQuery: null,
    queryVariants: ["hydration", "electrolytes"],
    matchStatus: "none",
    searchMode: "goal_mapped_ilike",
  });
});

test("buildSearchQueryPlan returns no correction for unknown searches", () => {
  assert.deepEqual(buildSearchQueryPlan("xyzrandom"), {
    originalQuery: "xyzrandom",
    appliedQuery: "xyzrandom",
    correctedQuery: null,
    queryVariants: ["xyzrandom"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("searchProducts returns corrected metadata when corrected results exist", async () => {
  const result = await searchProducts("magnesum", "relevance");

  assert.deepEqual(Object.keys(result.metadata), [
    "originalQuery",
    "appliedQuery",
    "correctedQuery",
    "queryVariants",
    "matchStatus",
    "searchMode",
  ]);
  assert.equal(result.totalCount, 1);
  assert.deepEqual(result.metadata, {
    originalQuery: "magnesum",
    appliedQuery: "magnesium",
    correctedQuery: "magnesium",
    queryVariants: ["magnesum", "magnesium"],
    matchStatus: "corrected",
    searchMode: "standard_ilike",
  });
});

test("searchProducts returns none metadata when no results exist", async () => {
  const result = await searchProductsWithNoResults("xyzrandom", "relevance");

  assert.equal(result.totalCount, 0);
  assert.deepEqual(result.metadata, {
    originalQuery: "xyzrandom",
    appliedQuery: "xyzrandom",
    correctedQuery: null,
    queryVariants: ["xyzrandom"],
    matchStatus: "none",
    searchMode: "standard_ilike",
  });
});

test("getSearchSuggestions returns empty suggestions below minimum query length", async () => {
  assert.deepEqual(await getSearchSuggestions("v"), {
    query: "v",
    appliedQuery: "v",
    correctedQuery: null,
    suggestions: [],
  });
});

test("getSearchSuggestions returns public-safe response shape", async () => {
  const result = await getSearchSuggestions("vit");

  assert.deepEqual(Object.keys(result), [
    "query",
    "appliedQuery",
    "correctedQuery",
    "suggestions",
  ]);
  assert.ok(result.suggestions.length > 0);

  for (const suggestion of result.suggestions) {
    assert.deepEqual(Object.keys(suggestion), [
      "id",
      "type",
      "label",
      "href",
      "matchText",
      "score",
    ]);
    assert.match(suggestion.href, /^\/(?:search(?:\?|$)|product\/)/);
    assert.equal(suggestion.href.startsWith("/go/"), false);
    assert.equal("url" in suggestion, false);
    assert.equal("gtin" in suggestion, false);
    assert.equal("offers" in suggestion, false);
  }
});

test("getSearchSuggestions understands magnesium typo correction", async () => {
  const result = await getSearchSuggestions("magnesum");
  const labels = result.suggestions.map((suggestion) => suggestion.label);

  assert.equal(result.appliedQuery, "magnesium");
  assert.equal(result.correctedQuery, "magnesium");
  assert.ok(labels.includes("Magnesium"));
  assert.ok(labels.includes("Magnesium Citrate Tablets 700mg"));
});

test("getSearchSuggestions understands omega3 alias correction", async () => {
  const result = await getSearchSuggestions("omega3");
  const labels = result.suggestions.map((suggestion) => suggestion.label);

  assert.equal(result.appliedQuery, "omega 3");
  assert.equal(result.correctedQuery, "omega 3");
  assert.ok(labels.includes("Omega 3"));
  assert.ok(labels.includes("Omega 3 Capsules 500mg"));
});

test("getSearchSuggestions understands whey protein typo correction", async () => {
  const result = await getSearchSuggestions("whey protien");
  const labels = result.suggestions.map((suggestion) => suggestion.label);

  assert.equal(result.appliedQuery, "whey protein");
  assert.equal(result.correctedQuery, "whey protein");
  assert.ok(labels.includes("Whey Protein"));
  assert.ok(labels.some((label) => label.includes("Whey")));
});

test("getSearchSuggestions understands Simply Supplements typo correction", async () => {
  const result = await getSearchSuggestions("simply supliments");
  const brandSuggestions = result.suggestions.filter(
    (suggestion) => suggestion.type === "brand"
  );
  const productSuggestions = result.suggestions.filter(
    (suggestion) => suggestion.type === "product"
  );

  assert.equal(result.appliedQuery, "simply supplements");
  assert.equal(result.correctedQuery, "simply supplements");
  assert.deepEqual(
    brandSuggestions.map((suggestion) => suggestion.label),
    ["Simply Supplements"]
  );
  assert.ok(productSuggestions.length > 0);
});

test("getSearchSuggestions supports vitamin d k2 wildcard variants", async () => {
  const result = await getSearchSuggestions("vitamin d k2");
  const labels = result.suggestions.map((suggestion) => suggestion.label);

  assert.equal(result.appliedQuery, "vitamin d k2");
  assert.equal(result.correctedQuery, null);
  assert.ok(labels.includes("Vitamin D3 4000iu & Vitamin K2 100mcg"));
});

test("getSearchSuggestions respects total limit", async () => {
  const result = await getSearchSuggestions("vit", 3);

  assert.equal(result.suggestions.length, 3);
});

test("getSearchSuggestions removes duplicate type and label suggestions", async () => {
  const result = await getSearchSuggestions("simply supliments");
  const keys = result.suggestions.map(
    (suggestion) => `${suggestion.type}:${suggestion.label.toLowerCase()}`
  );

  assert.deepEqual(keys, Array.from(new Set(keys)));
});
