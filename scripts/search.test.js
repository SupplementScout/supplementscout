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
