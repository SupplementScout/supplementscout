const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

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
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
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

const presentation = compileModule(
  path.join(process.cwd(), "app", "lib", "searchResultPresentation.ts"),
  {
    "./pricing": {
      formatCurrency: (value) => `£${Number(value).toFixed(2)}`,
    },
    "./products": {},
  }
);

function valueProduct(overrides = {}) {
  return {
    name: "Example supplement",
    category: "Supplements",
    verifiedCostPer5gCreatine: null,
    verifiedCostPer25gProtein: null,
    verifiedPricePerKg: null,
    verifiedPricePerLitre: null,
    verifiedPricePerServing: null,
    ...overrides,
  };
}

test("search cards select one business-relevant value metric", () => {
  assert.deepEqual(
    presentation.primarySearchValueMetric(
      valueProduct({
        name: "Whey Protein",
        verifiedCostPer25gProtein: 0.82,
        verifiedPricePerServing: 1.1,
        verifiedPricePerKg: 23,
      })
    ),
    { label: "Protein value", value: "£0.82 per 25 g protein" }
  );
  assert.deepEqual(
    presentation.primarySearchValueMetric(
      valueProduct({
        name: "Creatine Monohydrate",
        verifiedCostPer5gCreatine: 0.19,
        verifiedPricePerServing: 0.25,
      })
    ),
    { label: "Creatine value", value: "£0.19 per 5 g creatine" }
  );
  assert.deepEqual(
    presentation.primarySearchValueMetric(
      valueProduct({ verifiedPricePerServing: 0.4, verifiedPricePerKg: 20 })
    ),
    { label: "Per serving", value: "£0.40 per serving" }
  );
  assert.equal(presentation.primarySearchValueMetric(valueProduct()), null);
});

test("search card package size is compact and absent without data", () => {
  assert.equal(
    presentation.searchResultSize({ net_weight_g: 2000, net_volume_ml: null }),
    "2 kg"
  );
  assert.equal(
    presentation.searchResultSize({ net_weight_g: null, net_volume_ml: 500 }),
    "500 ml"
  );
  assert.equal(
    presentation.searchResultSize({ net_weight_g: null, net_volume_ml: null }),
    null
  );
});

test("mobile search card keeps identity before price and uses shared price presentation", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "ProductResultCard.tsx"),
    "utf8"
  );

  assert.ok(source.indexOf("<h2") < source.indexOf("pricePresentation.label"));
  assert.match(source, /buildBestOfferPricePresentation\(cheapestOffer\)/);
  assert.match(source, /primarySearchValueMetric\(product\)/);
  assert.match(source, /className="min-w-0 md:hidden"/);
  assert.match(source, /searchMobileFirst \? "flex" : "hidden sm:flex"/);
  assert.match(source, /className="md:hidden"[\s\S]*\{valueMetric &&/);
  assert.match(source, /searchMobileFirst \? "hidden md:block" : ""/);
  assert.match(source, /verifiedPricePerServing[\s\S]*verifiedPricePerKg[\s\S]*verifiedPricePerLitre/);
  assert.match(source, /min-h-11/);
  assert.doesNotMatch(source, /line-clamp/);
});

test("sort applies immediately, preserves URL state and has no Apply button", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "SearchSort.tsx"),
    "utf8"
  );

  assert.match(source, /onChange=/);
  assert.match(source, /sendAnalyticsEvent\("sort_used"/);
  assert.match(source, /router\.push\([\s\S]*searchUrl/);
  assert.match(source, /updates: \{ sort: value \}/);
  assert.doesNotMatch(source, />\s*Apply\s*</);
});

test("one mobile filter panel supports close, staged clear and Show results", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "SearchFilters.tsx"),
    "utf8"
  );

  assert.equal((source.match(/<aside\b/g) || []).length, 1);
  assert.match(source, /role=\{isOpen \? "dialog" : undefined\}/);
  assert.match(source, /Close filters/);
  assert.match(source, /Clear filters/);
  assert.match(source, /Show results/);
  assert.match(source, /Show more/);
  assert.match(source, /MOBILE_OPTION_LIMIT = 6/);
  assert.match(source, /MOBILE_FILTER_QUERY = "\(max-width: 1023px\)"/);
  assert.match(source, /mobileViewport\.addEventListener\("change", onViewportChange\)/);
  assert.match(source, /mobileViewport\.removeEventListener\("change", onViewportChange\)/);
  assert.match(source, /restoreBodyOverflow\(\)/);
  assert.match(source, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(source, /router\.push\(searchUrl\(\{ query, sort, filters: draftFilters \}\)\)/);
  assert.match(source, /sendAnalyticsEvent\("filter_used"/);
});

test("results layout renders one sort control and one filter panel", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "SearchResultsLayout.tsx"),
    "utf8"
  );

  assert.equal((source.match(/<SearchSort\b/g) || []).length, 1);
  assert.equal((source.match(/<SearchFilters\b/g) || []).length, 1);
  assert.match(source, /totalCount > 0 &&/);
  assert.match(source, /aria-expanded=\{filtersOpen\}/);
});

test("no-results state preserves query, suggestions and filter clearing", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "search", "page.tsx"),
    "utf8"
  );

  assert.match(source, /No filtered results found/);
  assert.match(source, /metadata\.correctedQuery/);
  assert.match(source, /popularSearchSuggestions\.map/);
  assert.match(source, /Clear filters/);
  assert.match(source, /initialQuery=\{query\}/);
});

test("filter and sort changes reset pagination while pagination preserves state", () => {
  const urlSource = fs.readFileSync(
    path.join(process.cwd(), "app", "lib", "searchUrl.ts"),
    "utf8"
  );
  const paginationSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "SearchPagination.tsx"),
    "utf8"
  );

  assert.match(urlSource, /page = 1/);
  assert.match(urlSource, /if \(page > 1\)/);
  assert.match(paginationSource, /searchUrl\(\{ query, sort, filters, page/);
  assert.match(paginationSource, /min-h-11/);
});
