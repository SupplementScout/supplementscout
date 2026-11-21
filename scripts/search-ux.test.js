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
      jsx: ts.JsxEmit.ReactJSX,
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
    serving_count_verified: null,
    protein_per_serving_g: null,
    nutrition_verified: false,
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

test("search card intent evidence surfaces only the verified qualifying fact", () => {
  assert.deepEqual(
    presentation.searchResultIntentEvidence(
      valueProduct({
        protein_per_serving_g: 27,
        nutrition_verified: true,
        serving_count_verified: 40,
      }),
      { minProteinPerServingG: 25, minVerifiedServings: null }
    ),
    { label: "Protein per serving", value: "27 g protein per serving" }
  );
  assert.deepEqual(
    presentation.searchResultIntentEvidence(
      valueProduct({ serving_count_verified: 100 }),
      { minProteinPerServingG: null, minVerifiedServings: 100 }
    ),
    { label: "Verified servings", value: "100 verified servings" }
  );
  assert.equal(
    presentation.searchResultIntentEvidence(
      valueProduct({ protein_per_serving_g: 27, nutrition_verified: false }),
      { minProteinPerServingG: 25, minVerifiedServings: null }
    ),
    null
  );
});

test("mobile search card keeps identity before price and uses shared price presentation", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "ProductResultCard.tsx"),
    "utf8"
  );

  assert.ok(source.indexOf("<h2") < source.indexOf("pricePresentation?.label"));
  assert.match(source, /buildBestOfferPricePresentation\(cheapestOffer, \{/);
  assert.match(source, /deliveryComparisonComplete: product\.deliveryComparisonComplete/);
  assert.match(source, /searchResultIntentEvidence\(/);
  assert.match(source, /data-search-card=/);
  assert.match(source, /<Image[\s\S]*unoptimized[\s\S]*sizes=/);
  assert.match(source, /In stock/);
  assert.match(source, /View offers/);
  assert.match(source, /min-h-12/);
  assert.doesNotMatch(source, /line-clamp/);
});

test("visual polish uses one accessible shared icon and badge vocabulary", () => {
  const iconSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "SupplementScoutIcon.tsx"),
    "utf8"
  );
  const badgeSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "StatusBadge.tsx"),
    "utf8"
  );
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "ProductResultCard.tsx"),
    "utf8"
  );

  assert.doesNotMatch(iconSource, /^"use client"/);
  assert.match(iconSource, /stroke="currentColor"/);
  assert.match(iconSource, /strokeWidth="1\.75"/);
  assert.match(iconSource, /strokeLinecap="round"/);
  assert.match(iconSource, /aria-hidden="true"/);
  assert.match(iconSource, /size\?: 16 \| 18 \| 20 \| 24/);
  assert.match(badgeSource, /"availability" \| "comparison" \| "evidence" \| "neutral"/);
  assert.match(badgeSource, /className=\{`ss-badge/);
  assert.match(cardSource, /<StatusBadge tone="availability" icon="check">/);
  assert.match(cardSource, /<StatusBadge tone="neutral" icon="store">/);
});

test("search and landing queries do not require an offer row to expose a product", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "lib", "products.ts"),
    "utf8"
  );

  assert.doesNotMatch(source, /offers!inner\s*\(/);
  assert.match(source, /cheapestOffer: SearchOffer \| null/);
  assert.match(source, /filters\.retailer && matchingObservedOffers\.length === 0/);
});

test("search cards show a safe no-price state without a retailer breakdown", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "ProductResultCard.tsx"),
    "utf8"
  );

  assert.match(source, /OFFER_PRESENTATION_LABELS\[product\.presentationState\]/);
  assert.match(source, /No retailer price has been verified in the last 24 hours/);
  assert.match(source, /pricePresentation \? \(/);
  assert.match(source, /Image unavailable/);
  assert.doesNotMatch(source, /confirmed cheapest delivered/);
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
  assert.match(
    source,
    /router\.push\(searchUrl\(\{ query, sort, filters: draftFilters, intent \}\)\)/,
  );
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
  const intentSource = fs.readFileSync(
    path.join(process.cwd(), "app", "lib", "searchIntent.ts"),
    "utf8"
  );

  assert.match(source, /No filtered results found/);
  assert.match(source, /metadata\.correctedQuery/);
  assert.match(source, /intentPlan/);
  assert.match(intentSource, /maxDeliveredPrice/);
  assert.match(intentSource, /Delivered price/);
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
  assert.match(
    paginationSource,
    /searchUrl\(\{ query, sort, filters, intent, page/,
  );
  assert.match(paginationSource, /min-h-11/);
});

test("search stays noindex nofollow with one clean canonical", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "search", "page.tsx"),
    "utf8"
  );

  assert.match(source, /robots:\s*\{\s*index: false,\s*follow: false,/);
  assert.match(source, /alternates:\s*\{\s*canonical: "\/search",/);
});

test("search parameter links do not trigger background route prefetches", () => {
  for (const relativePath of [
    ["app", "components", "ActiveSearchFilters.tsx"],
    ["app", "components", "SearchFilters.tsx"],
    ["app", "components", "SearchPagination.tsx"],
    ["app", "search", "page.tsx"],
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), ...relativePath), "utf8");
    const searchLinks = source.match(/<Link[\s\S]*?(?:searchUrl\(|href=\{filter\.href\})[\s\S]*?>/g) || [];

    assert.ok(searchLinks.length > 0, relativePath.join("/"));
    for (const link of searchLinks) {
      assert.match(link, /prefetch=\{false\}/, relativePath.join("/"));
    }
  }
});

test("robots blocks only SERanking crawler while preserving public crawl access", () => {
  const robots = compileModule(path.join(process.cwd(), "app", "robots.ts")).default();

  assert.deepEqual(robots.rules, [
    { userAgent: "SERankingBacklinksBot", disallow: "/" },
    { userAgent: "*", allow: "/", disallow: ["/admin", "/go"] },
  ]);
  assert.equal(robots.sitemap, "https://www.supplementscout.co.uk/sitemap.xml");
});

// Exercise the real component's event handlers and effect cleanup with controlled
// hooks, timers and responses. Browser hydration/interaction is checked separately.
function searchInputHarness(t, initialQuery = "creatine") {
  const slots = [];
  const requests = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, (value) => {
        const next = typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) dirty = true;
        slots[index].value = next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: (factory) => { cursor++; return factory(); },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (url, options) => new Promise((resolve, reject) => {
    // Deliberately ignore abort here: even a late transport/body response must
    // not update the component after its request has become obsolete.
    requests.push({ url, signal: options.signal, resolve, reject });
  }));
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location = { href: "" };
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    activeElement: { getAttribute: () => "q" },
  } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  const Component = compileModule(path.join(process.cwd(), "app", "components", "SearchInput.tsx"), {
    react,
    "./SupplementScoutIcon": { default: () => null },
  }).default;
  function flush() {
    while (dirty) {
      dirty = false;
      cursor = 0;
      effects = [];
      tree = Component({ initialQuery });
      for (const effect of effects) effect();
    }
  }
  function find(predicate, node) {
    if (arguments.length === 1) node = tree;
    if (Array.isArray(node)) return node.flatMap((child) => find(predicate, child));
    if (!node || typeof node !== "object") return [];
    return [...(predicate(node) ? [node] : []), ...find(predicate, node.props?.children)];
  }
  const input = () => find((node) => node.type === "input")[0].props;
  const act = (callback) => { callback(); flush(); };
  async function settle() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    flush();
  }
  const response = (label) => ({ ok: true, json: async () => ({ correctedQuery: null, suggestions: [
    { id: label, type: "product", label, href: `/product/${label}`, score: 1, matchText: label },
  ] }) });
  t.after(() => {
    for (const slot of slots) slot?.cleanup?.();
    for (const [key, descriptor] of [["document", previousDocument], ["window", previousWindow]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  flush();
  return { requests, input, act, settle, response, location, find,
    focus: () => act(() => input().onFocus()),
    change: (value) => act(() => input().onChange({ target: { value } })),
    tick: (ms) => act(() => t.mock.timers.tick(ms)),
  };
}

test("autocomplete does not fetch initialQuery on mount or ordinary rerenders", (t) => {
  const h = searchInputHarness(t);
  h.tick(1000);
  h.change("creatine ");
  h.tick(1000);
  assert.equal(h.requests.length, 0);
});

test("autocomplete starts on focus and debounces rapid typing", async (t) => {
  const h = searchInputHarness(t);
  h.focus();
  h.tick(249);
  assert.equal(h.requests.length, 0);
  h.change("whey");
  h.tick(100);
  h.change("whey protein");
  h.tick(249);
  assert.equal(h.requests.length, 0);
  h.tick(1);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "/api/search-suggestions?q=whey%20protein");
  h.requests[0].resolve(h.response("whey"));
  await h.settle();
  assert.equal(h.input()["aria-expanded"], true);
});

test("autocomplete aborts obsolete requests and ignores late success and errors", async (t) => {
  const h = searchInputHarness(t);
  h.focus(); h.tick(250);
  const first = h.requests[0];
  h.change("whey"); h.tick(250);
  assert.equal(first.signal.aborted, true);
  const second = h.requests[1];
  h.change("magnesium"); h.tick(250);
  h.requests[2].resolve(h.response("magnesium"));
  await h.settle();
  first.resolve(h.response("obsolete"));
  second.reject(new Error("late network error"));
  await h.settle();
  assert.deepEqual(h.find((node) => node.props?.role === "option").map((node) => node.props.children), ["magnesium"]);
});

test("autocomplete ignores an aborted response whose JSON body completes late", async (t) => {
  const h = searchInputHarness(t);
  h.focus(); h.tick(250);
  let finishBody;
  h.requests[0].resolve({ ok: true, json: () => new Promise((resolve) => { finishBody = resolve; }) });
  await h.settle();
  h.change("whey"); h.tick(250);
  h.requests[1].resolve(h.response("whey"));
  await h.settle();
  finishBody(await h.response("obsolete").json());
  await h.settle();
  assert.deepEqual(h.find((node) => node.props?.role === "option").map((node) => node.props.children), ["whey"]);
});

test("autocomplete blur cancels work; refocus works; short queries stop requests", async (t) => {
  const h = searchInputHarness(t);
  h.focus(); h.tick(250);
  h.act(() => h.input().onBlur());
  assert.equal(h.requests[0].signal.aborted, true);
  h.requests[0].resolve(h.response("obsolete"));
  await h.settle(); h.tick(1000);
  assert.equal(h.input()["aria-expanded"], false);
  h.focus(); h.tick(250);
  assert.equal(h.requests.length, 2);
  h.change("a");
  assert.equal(h.requests[1].signal.aborted, true);
  h.tick(1000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.input()["aria-expanded"], false);
});

test("autocomplete whitespace edits preserve active work and keyboard navigation", async (t) => {
  const h = searchInputHarness(t);
  h.focus(); h.tick(250);
  h.change("creatine ");
  assert.equal(h.requests[0].signal.aborted, false);
  h.requests[0].resolve(h.response("creatine"));
  await h.settle(); h.tick(1000);
  assert.equal(h.requests.length, 1);
  let prevented = 0;
  const key = (value) => h.act(() => h.input().onKeyDown({ key: value, preventDefault: () => { prevented++; } }));
  key("ArrowDown"); key("Enter");
  assert.equal(prevented, 2);
  assert.equal(h.location.href, "/product/creatine");
  key("Escape");
  assert.equal(h.input()["aria-expanded"], false);
  key("ArrowUp");
  assert.equal(h.input()["aria-expanded"], true);
  const option = h.find((node) => node.props?.role === "option")[0];
  assert.equal(option.props.href, "/product/creatine");
  assert.equal(option.props["aria-selected"], true);
  assert.equal(h.find((node) => node.type === "form")[0].props.method, "get");
});
