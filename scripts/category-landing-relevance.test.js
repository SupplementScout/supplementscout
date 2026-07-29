const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");
const ts = require("typescript");

const routeCategories = new Map([
  ["glucosamine", "glucosamine"],
  ["magnesium", "magnesium"],
  ["omega-3", "omega-3"],
  ["vitamin-d", "vitamin-d"],
  ["vitamins", "vitamins"],
]);

for (const [route, category] of routeCategories) {
  test(`${route} uses the shared reviewed landing relevance gate`, () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );

    assert.match(source, /isReviewedLandingProductMatch/);
    assert.match(
      source,
      new RegExp(
        `productFilter:\\s*\\(product\\)\\s*=>\\s*[\\s\\S]*isReviewedLandingProductMatch\\("${category}", product\\)`
      )
    );
  });

  test(`${route} uses shared crawlable category pagination`, () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );

    assert.match(source, /searchParams:\s*Promise<\{\s*page\?:/);
    assert.match(source, /buildCategoryLandingMetadata/);
    assert.match(source, /CategoryLandingPagination/);
    assert.match(source, /page:\s*requestedPage/);
    assert.match(source, /page !== requestedPage/);
  });
}

test("reviewed landing source queries do not fetch known excluded identities", () => {
  const glucosamine = fs.readFileSync(
    path.join(process.cwd(), "app", "glucosamine", "page.tsx"),
    "utf8"
  );
  const omega3 = fs.readFileSync(
    path.join(process.cwd(), "app", "omega-3", "page.tsx"),
    "utf8"
  );

  assert.doesNotMatch(glucosamine, /"joint support"|"joint care"|"collagen"/);
  assert.doesNotMatch(omega3, /"starflower oil"|"evening primrose oil"/);
});

function loadPaginationModule() {
  const filename = path.join(
    process.cwd(),
    "app",
    "lib",
    "categoryLandingPagination.ts"
  );
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
  mod._compile(outputText, filename);

  return mod.exports;
}

const {
  buildCategoryLandingMetadata,
  categoryLandingPageHref,
  isCanonicalCategoryLandingPageParam,
  normalizeCategoryLandingPage,
} = loadPaginationModule();

test("category pagination normalizes invalid and duplicate page parameters", () => {
  assert.equal(normalizeCategoryLandingPage(undefined), 1);
  assert.equal(normalizeCategoryLandingPage("2"), 2);
  assert.equal(normalizeCategoryLandingPage("0"), 1);
  assert.equal(normalizeCategoryLandingPage("02"), 1);
  assert.equal(normalizeCategoryLandingPage(["2", "3"]), 2);

  assert.equal(isCanonicalCategoryLandingPageParam(undefined), true);
  assert.equal(isCanonicalCategoryLandingPageParam("2"), true);
  assert.equal(isCanonicalCategoryLandingPageParam("1"), false);
  assert.equal(isCanonicalCategoryLandingPageParam("02"), false);
  assert.equal(isCanonicalCategoryLandingPageParam(["2", "3"]), false);
});

test("category pagination emits stable URLs and distinct metadata", () => {
  assert.equal(categoryLandingPageHref("/vitamins", 1), "/vitamins");
  assert.equal(categoryLandingPageHref("/vitamins", 3), "/vitamins?page=3");

  const metadata = buildCategoryLandingMetadata({
    basePath: "/vitamins",
    description: "Compare vitamins.",
    page: 3,
    title: "Compare Vitamins UK",
  });

  assert.equal(metadata.title, "Compare Vitamins UK – Page 3");
  assert.equal(metadata.alternates.canonical, "/vitamins?page=3");
  assert.equal(metadata.openGraph.url, "/vitamins?page=3");
});

test("landing data retrieval walks every database page before slicing results", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "lib", "products.ts"),
    "utf8"
  );

  assert.match(
    source,
    /for \(let from = 0; ; from \+= SEARCH_RESULT_LOAD_LIMIT\)/
  );
  assert.match(
    source,
    /\.range\(from, from \+ SEARCH_RESULT_LOAD_LIMIT - 1\)/
  );
  assert.match(source, /matchingResults\.slice\(startIndex, startIndex \+ pageSize\)/);
});
