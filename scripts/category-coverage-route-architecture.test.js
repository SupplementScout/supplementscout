const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    instance._compile(output, filename);
    return instance.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const root = process.cwd();
const sharedHelperPath = path.join(
  root,
  "app/lib/categoryCoverageLanding.ts"
);
const sharedComponentPath = path.join(
  root,
  "app/components/CategoryCoverageLandingPage.tsx"
);
const routeContracts = [
  {
    route: "testosterone-boosters",
    definitionKey: "testosterone-boosters",
    cacheVersion: "testosterone-boosters-category-v1",
  },
  {
    route: "fat-burners",
    definitionKey: "fat-burners",
    cacheVersion: "fat-burners-category-v1",
  },
  {
    route: "collagen",
    definitionKey: "collagen",
    cacheVersion: "collagen-category-v1",
  },
  {
    route: "nootropics",
    definitionKey: "nootropics",
    cacheVersion: "nootropics-category-v1",
  },
];
const testosteroneFixtures = require("./fixtures/category-coverage/testosterone-boosters");
const fatFixtures = require("./fixtures/category-coverage/fat-burners");
const collagenFixtures = require("./fixtures/category-coverage/collagen");
const nootropicsFixtures = require("./fixtures/category-coverage/nootropics");

function config(overrides = {}) {
  return {
    definitionKey: "test-category",
    pagePath: "/test-category",
    cacheVersion: "test-category-v1",
    description: "Compare reviewed products.",
    metadataProfile: "explicit-category-twitter",
    presentation: {
      pageTitle: "Compare Test Products UK",
      searchQuery: "Test Products",
      eyebrow: "Reviewed category coverage",
      intro: "Reviewed identity copy.",
      secondaryCopy: "Availability can change.",
      sectionTitle: "Current Test products",
      emptyTitle: "No reviewed Test products available",
      emptyDescription: "No product meets the rules.",
    },
    ...overrides,
  };
}

test("all explicit semantic routes are thin adapters over one shared landing architecture", () => {
  const helper = fs.readFileSync(sharedHelperPath, "utf8");
  const component = fs.readFileSync(sharedComponentPath, "utf8");

  assert.match(helper, /getCategoryCoverageDefinition\(config\.definitionKey\)/);
  assert.match(helper, /getLandingProducts\(/);
  assert.match(helper, /evaluateCategoryCoverage\(coverageDefinition, product\)/);
  assert.match(helper, /\.classification === "INCLUDE_STRONG"/);
  assert.match(helper, /createLifecycleDataLoader\(/);
  assert.match(helper, /async function loadProducts\(page: number\)/);
  assert.match(helper, /page,\s*productFilter:/);
  assert.match(helper, /getCachedProducts\(requestedPage\)/);
  assert.match(helper, /CategoryCoverageLandingPageProps/);
  assert.match(component, /CategoryLandingPagination/);
  assert.match(component, /rows\.map\(\(product\)/);
  assert.match(component, /<ProductResultCard/);
  assert.doesNotMatch(
    component,
    /from "\.\.\/lib\/categoryCoverage"|definitionKey|INCLUDE_STRONG/
  );

  for (const contract of routeContracts) {
    const source = fs.readFileSync(
      path.join(root, "app", contract.route, "page.tsx"),
      "utf8"
    );
    assert.match(source, /createCategoryCoverageLanding\(config\)/, contract.route);
    assert.match(source, /<CategoryCoverageLandingPage/, contract.route);
    assert.match(
      source,
      new RegExp(`definitionKey: "${contract.definitionKey}"`),
      contract.route
    );
    assert.match(
      source,
      new RegExp(`cacheVersion: "${contract.cacheVersion}"`),
      contract.route
    );
    assert.doesNotMatch(
      source,
      /getLandingProducts|evaluateCategoryCoverage|ProductResultCard|createLifecycleDataLoader|\.map\(\(product\)/,
      contract.route
    );
  }

  assert.equal(fs.existsSync(path.join(root, "app/[category]/page.tsx")), false);
  assert.equal(
    fs.existsSync(path.join(root, "app/categories/[slug]/page.tsx")),
    false
  );
});

test("shared loader owns strong-only filtering, cache identity and page arguments", async () => {
  const pagination = compileModule(
    path.join(root, "app/lib/categoryLandingPagination.ts")
  );
  const lifecycle = require(path.join(
    root,
    "app/lib/indexabilityLifecycle.ts"
  ));
  const calls = [];
  let cacheRegistration = null;
  let clamped = false;
  const definition = {
    key: "test-category",
    candidateQueries: ["broad one", "broad two"],
  };
  const landingModule = compileModule(sharedHelperPath, {
    "next/navigation": {
      redirect: (href) => {
        throw new Error(`REDIRECT:${href}`);
      },
    },
    "./categoryLandingPagination": pagination,
    "./categoryCoverage": {
      getCategoryCoverageDefinition: (key) =>
        key === definition.key ? definition : undefined,
      evaluateCategoryCoverage: (_definition, product) => ({
        classification:
          product.name === "Strong" ? "INCLUDE_STRONG" : "REVIEW_REQUIRED",
      }),
    },
    "./indexabilityLifecycle": lifecycle,
    "./lifecycleDataCache": {
      createLifecycleDataLoader: (pagePath, cacheVersion, load) => {
        cacheRegistration = { pagePath, cacheVersion };
        return load;
      },
    },
    "./products": {
      getLandingProducts: async (queries, pageSize, options) => {
        calls.push({ queries, pageSize, page: options.page });
        assert.equal(options.productFilter({ name: "Strong" }), true);
        assert.equal(options.productFilter({ name: "Review" }), false);
        return {
          results: [],
          error: null,
          page: clamped ? 1 : options.page,
          pageSize,
          totalCount: 29,
          totalPages: 2,
        };
      },
    },
  });
  const landing = landingModule.createCategoryCoverageLanding(config());

  const result = await landing.load(Promise.resolve({ page: "2" }));
  assert.deepEqual(cacheRegistration, {
    pagePath: "/test-category",
    cacheVersion: "test-category-v1",
  });
  assert.deepEqual(calls, [
    { queries: ["broad one", "broad two"], pageSize: 24, page: 2 },
  ]);
  assert.equal(result.page, 2);
  assert.equal(result.totalCount, 29);

  await assert.rejects(
    landing.load(Promise.resolve({ page: "1" })),
    /REDIRECT:\/test-category/
  );
  clamped = true;
  await assert.rejects(
    landing.load(Promise.resolve({ page: "2" })),
    /REDIRECT:\/test-category/
  );
});

test("audited strong counts use one 24-item pagination contract without duplication", () => {
  const pageSize = 24;
  const contracts = [
    {
      key: "testosterone",
      ids: testosteroneFixtures.expectedIds.INCLUDE_STRONG,
      pages: 1,
    },
    {
      key: "fat",
      ids: fatFixtures.expectedIds.INCLUDE_STRONG,
      pages: 1,
    },
    {
      key: "collagen",
      ids: collagenFixtures.expectedIds.INCLUDE_STRONG,
      pages: 2,
    },
    {
      key: "nootropics",
      ids: nootropicsFixtures.expectedIds.INCLUDE_STRONG,
      pages: 1,
    },
  ];

  for (const contract of contracts) {
    const pages = Array.from(
      { length: Math.ceil(contract.ids.length / pageSize) },
      (_, index) => contract.ids.slice(index * pageSize, (index + 1) * pageSize)
    );
    const union = new Set(pages.flat());
    assert.equal(pages.length, contract.pages, contract.key);
    assert.equal(union.size, contract.ids.length, contract.key);
  }

  assert.deepEqual(
    contracts[2].ids.slice(0, pageSize).length,
    24
  );
  assert.deepEqual(contracts[2].ids.slice(pageSize).length, 5);
});

test("shared metadata preserves each pre-refactor route profile exactly", () => {
  const pagination = compileModule(
    path.join(root, "app/lib/categoryLandingPagination.ts")
  );
  const lifecycle = require(path.join(
    root,
    "app/lib/indexabilityLifecycle.ts"
  ));
  const landingModule = compileModule(sharedHelperPath, {
    "next/navigation": { redirect: () => {} },
    "./categoryLandingPagination": pagination,
    "./categoryCoverage": {},
    "./indexabilityLifecycle": lifecycle,
    "./lifecycleDataCache": {},
    "./products": {},
  });
  const cases = [
    {
      config: config({
        pagePath: "/testosterone-boosters",
        description:
          "Compare current UK retailer prices for products with a reviewed Testosterone Booster identity.",
        metadataProfile: "inherit-root-twitter",
        presentation: {
          ...config().presentation,
          pageTitle: "Compare Testosterone Booster Prices UK",
        },
      }),
      title: "Compare Testosterone Booster Prices UK",
      ogTitle: "Compare Testosterone Booster Prices UK | SupplementScout",
    },
    {
      config: config({
        pagePath: "/fat-burners",
        description:
          "Compare current UK retailer prices for products with a reviewed Fat Burner identity.",
        metadataProfile: "inherit-root-twitter",
        presentation: {
          ...config().presentation,
          pageTitle: "Compare Fat Burner Prices UK",
        },
      }),
      title: "Compare Fat Burner Prices UK",
      ogTitle: "Compare Fat Burner Prices UK | SupplementScout",
    },
    {
      config: config({
        pagePath: "/nootropics",
        description:
          "Compare current UK retailer prices for products with a reviewed Nootropic identity.",
        metadataProfile: "inherit-root-twitter",
        presentation: {
          ...config().presentation,
          pageTitle: "Compare Nootropic Prices UK",
        },
      }),
      title: "Compare Nootropic Prices UK",
      ogTitle: "Compare Nootropic Prices UK | SupplementScout",
    },
  ];

  for (const current of cases) {
    const metadata = landingModule.buildCategoryCoverageLandingMetadata(
      current.config,
      1,
      {}
    );
    assert.equal(metadata.title, current.title);
    assert.equal(metadata.description, current.config.description);
    assert.equal(metadata.alternates.canonical, current.config.pagePath);
    assert.equal(metadata.openGraph.title, current.ogTitle);
    assert.equal(metadata.openGraph.description, current.config.description);
    assert.equal(metadata.openGraph.url, current.config.pagePath);
    assert.equal(metadata.openGraph.type, "website");
    assert.equal(Object.hasOwn(metadata, "twitter"), false);
    assert.deepEqual(metadata.robots, { index: false, follow: true });
  }

  const collagenConfig = config({
    definitionKey: "collagen",
    pagePath: "/collagen",
    cacheVersion: "collagen-category-v1",
    description:
      "Compare current UK retailer prices for products with a reviewed Collagen identity, including Collagen Peptides and Marine Collagen.",
    metadataProfile: "explicit-category-twitter",
    presentation: {
      ...config().presentation,
      pageTitle: "Compare Collagen Prices UK",
    },
  });
  const base = landingModule.buildCategoryCoverageLandingMetadata(
    collagenConfig,
    1,
    {}
  );
  const page2 = landingModule.buildCategoryCoverageLandingMetadata(
    collagenConfig,
    2,
    { page: "2" }
  );

  assert.equal(base.title, "Compare Collagen Prices UK");
  assert.equal(base.alternates.canonical, "/collagen");
  assert.equal(base.openGraph.type, undefined);
  assert.deepEqual(base.twitter, {
    card: "summary",
    title: "Compare Collagen Prices UK | SupplementScout",
    description: collagenConfig.description,
  });
  assert.equal(
    page2.title,
    `Compare Collagen Prices UK ${String.fromCharCode(0x2013)} Page 2`
  );
  assert.equal(page2.alternates.canonical, "/collagen?page=2");
  assert.equal(
    page2.openGraph.title,
    `Compare Collagen Prices UK ${String.fromCharCode(0x2013)} Page 2 | SupplementScout`
  );
  assert.equal(page2.openGraph.url, "/collagen?page=2");
  assert.equal(page2.twitter.title, page2.openGraph.title);
  assert.deepEqual(page2.robots, { index: false, follow: true });
});

test("framework-required route error files remain tiny identical adapters", () => {
  const sources = routeContracts.map((contract) =>
    fs
      .readFileSync(path.join(root, "app", contract.route, "error.tsx"), "utf8")
      .replaceAll("\r\n", "\n")
  );
  assert.equal(new Set(sources).size, 1);
  assert.match(sources[0], /LifecycleHubError/);
  assert.match(sources[0], /unstable_retry/);
});
