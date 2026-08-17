const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const ROOT = process.cwd();
const methodologyPath = path.join(ROOT, "app", "how-we-compare", "page.tsx");
const freshnessPath = path.join(ROOT, "app", "data-freshness", "page.tsx");
const transparencyLinksPath = path.join(
  ROOT,
  "app",
  "components",
  "ComparisonTransparencyLinks.tsx"
);

function compileModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.hasOwn(mocks, request)) return mocks[request];
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

function Link({ href, children, ...props }) {
  return React.createElement(
    "a",
    { href: typeof href === "string" ? href : href.pathname, ...props },
    children
  );
}

function TransparencyLinks() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Link, { href: "/how-we-compare" }, "How we compare prices"),
    React.createElement(Link, { href: "/data-freshness" }, "Data freshness")
  );
}

function loadMethodologyPage() {
  return compileModule(methodologyPath, {
    "next/link": { __esModule: true, default: Link },
    "../components/ComparisonTransparencyLinks": {
      __esModule: true,
      default: TransparencyLinks,
    },
  });
}

function loadFreshnessPage() {
  return compileModule(freshnessPath, {
    "next/link": { __esModule: true, default: Link },
    "../components/ComparisonTransparencyLinks": {
      __esModule: true,
      default: TransparencyLinks,
    },
    "../lib/creatineLaunch": {
      CREATINE_LAUNCH_THRESHOLDS: { maximumOfferAgeDays: 24, maximumOfferAgeHours: 576 },
    },
  });
}

test("both transparency pages expose indexable canonical metadata", () => {
  const methodology = loadMethodologyPage().metadata;
  const freshness = loadFreshnessPage().metadata;

  assert.equal(methodology.alternates.canonical, "/how-we-compare");
  assert.deepEqual(methodology.robots, { index: true, follow: true });
  assert.equal(freshness.alternates.canonical, "/data-freshness");
  assert.deepEqual(freshness.robots, { index: true, follow: true });
});

test("structured data uses WebPage and breadcrumbs without invented entities", () => {
  const methodology = loadMethodologyPage().buildComparisonMethodologyStructuredData();
  const freshness = loadFreshnessPage().buildDataFreshnessStructuredData();

  for (const data of [methodology, freshness]) {
    assert.deepEqual(
      data["@graph"].map((item) => item["@type"]),
      ["WebPage", "BreadcrumbList"]
    );
    assert.doesNotMatch(JSON.stringify(data), /"@type":"(?:Product|Dataset|FAQPage)"/);
  }
});

test("methodology page explains delivered price, ranking and verified metrics", () => {
  const html = renderToStaticMarkup(
    React.createElement(loadMethodologyPage().default)
  );

  assert.match(html, /Known delivered total = product price \+ known delivery charge/);
  assert.match(html, /do not treat missing delivery as free/i);
  assert.match(html, /unknown delivery cannot outrank/i);
  assert.match(html, /not a ranking of effectiveness/i);
  assert.match(html, /cost per 25 g of protein or per 5 g of creatine/i);
  assert.match(html, /not a promise of continuous monitoring/i);
  assert.match(html, /application\/ld\+json/);
});

test("freshness page scopes the 24-day rule and avoids a false sitewide promise", () => {
  const html = renderToStaticMarkup(
    React.createElement(loadFreshnessPage().default)
  );

  assert.match(html, /checked within the last\s*24\s*days/i);
  assert.match(html, /Not every page uses the same gate/i);
  assert.match(html, /do not claim one fixed update schedule for every retailer/i);
  assert.match(html, /stale offers cannot take a place in a current comparison-page ranking/i);
  assert.match(html, /temporarily keep a comparison out of search results/i);
  assert.doesNotMatch(html, /\bnoindex\b|indexing gate/i);
  assert.match(html, /do not fill those gaps by estimation/i);
});

test("commercial comparison copy explains coverage without internal SEO jargon", () => {
  const comparisonPages = [
    "amino-acids",
    "hydration",
    "mass-gainer",
    "multivitamins",
    "pre-workout",
    "vegan-protein",
    "whey-isolate",
    "whey-protein",
  ];

  for (const route of comparisonPages) {
    const source = fs.readFileSync(
      path.join(ROOT, "app", route, "page.tsx"),
      "utf8"
    );
    assert.doesNotMatch(
      source,
      /Indexing quality gate|becomes noindex|marked not to be indexed|indexability coverage gate|structured data has no major errors/i,
      `${route} exposes internal SEO terminology in shopper-facing copy`
    );
  }
});

test("published explanations remain bound to the implemented pricing and freshness rules", () => {
  const pricing = fs.readFileSync(path.join(ROOT, "app", "lib", "pricing.ts"), "utf8");
  const freshness = fs.readFileSync(
    path.join(ROOT, "app", "lib", "creatineLaunch.ts"),
    "utf8"
  );
  const categoryComparison = fs.readFileSync(
    path.join(ROOT, "app", "lib", "categoryComparison.ts"),
    "utf8"
  );

  assert.match(pricing, /productPrice \+ shippingCost/);
  assert.match(pricing, /if \(shippingCost === null\)/);
  assert.match(freshness, /maximumOfferAgeHours:\s*MAXIMUM_CURRENT_OFFER_AGE_HOURS/);
  const sharedFreshness = fs.readFileSync(
    path.join(process.cwd(), "app", "lib", "offerFreshness.ts"),
    "utf8",
  );
  assert.match(sharedFreshness, /MAXIMUM_CURRENT_OFFER_AGE_DAYS\s*=\s*24/);
  assert.match(sharedFreshness, /MAXIMUM_CURRENT_OFFER_AGE_DAYS \* 24/);
  assert.match(categoryComparison, /isOfferFresh:[\s\S]*?=\s*isCreatineOfferFresh/);
  assert.match(categoryComparison, /!isOfferFresh\(offer\.last_checked_at, now\)/);
  assert.match(categoryComparison, /Number\.POSITIVE_INFINITY/);
});

test("the pages are static server content without a second data mechanism", () => {
  for (const filename of [methodologyPath, freshnessPath]) {
    const source = fs.readFileSync(filename, "utf8");
    assert.doesNotMatch(source, /["']use client["']/);
    assert.doesNotMatch(source, /supabase|fetch\s*\(|price_history/i);
  }
});

test("sitemap and priority pages expose both transparency routes", () => {
  const sitemap = fs.readFileSync(path.join(ROOT, "app", "sitemap.ts"), "utf8");
  const sharedLinks = fs.readFileSync(transparencyLinksPath, "utf8");
  const priorityPages = [
    path.join(ROOT, "app", "page.tsx"),
    path.join(ROOT, "app", "whey-protein", "page.tsx"),
    path.join(ROOT, "app", "pre-workout", "page.tsx"),
    path.join(ROOT, "app", "creatine", "page.tsx"),
    path.join(ROOT, "app", "hydration", "page.tsx"),
  ];

  assert.equal((sitemap.match(/`\$\{siteUrl\}\/how-we-compare`/g) || []).length, 1);
  assert.equal((sitemap.match(/`\$\{siteUrl\}\/data-freshness`/g) || []).length, 1);
  assert.match(sharedLinks, /href="\/how-we-compare"/);
  assert.match(sharedLinks, /href="\/data-freshness"/);
  for (const filename of priorityPages) {
    assert.match(
      fs.readFileSync(filename, "utf8"),
      /ComparisonTransparencyLinks/
    );
  }
});

test("homepage and About provide additional crawlable discovery", () => {
  const home = fs.readFileSync(path.join(ROOT, "app", "page.tsx"), "utf8");
  const about = fs.readFileSync(path.join(ROOT, "app", "about", "page.tsx"), "utf8");

  assert.match(home, /href="\/how-we-compare"/);
  assert.match(home, /href="\/data-freshness"/);
  assert.match(about, /href="\/how-we-compare"/);
  assert.match(about, /href="\/data-freshness"/);
});
