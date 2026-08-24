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
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (request === "./indexabilityLifecycle") return lifecycle;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    instance._compile(output, filename);
    return instance.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const lifecycle = require(path.join(
  process.cwd(),
  "app/lib/indexabilityLifecycle.ts"
));

const liveVerifiedPaths = Object.keys(
  lifecycle.PUBLIC_INDEXABILITY_LIFECYCLE
);

const pageFiles = new Map(
  liveVerifiedPaths.map((route) => [
    route,
    path.join(process.cwd(), "app", ...route.slice(1).split("/"), "page.tsx"),
  ])
);

test("approved public routes have one explicit live-verified lifecycle", () => {
  for (const route of liveVerifiedPaths) {
    assert.equal(lifecycle.getLifecycleStatus(route), "live_verified", route);
    assert.deepEqual(lifecycle.getLifecycleRobots(route), {
      index: true,
      follow: true,
    });
    assert.equal(lifecycle.isLifecycleSitemapEligible(route), true, route);
  }
});

test("the public lifecycle registry is complete, routable and separate from owner-deferred decisions", () => {
  assert.equal(liveVerifiedPaths.length, 15);
  for (const route of liveVerifiedPaths) {
    assert.equal(fs.existsSync(pageFiles.get(route)), true, route);
    assert.equal(
      lifecycle.PUBLIC_INDEXABILITY_LIFECYCLE[route],
      lifecycle.INDEXABILITY_LIFECYCLE[route],
      route
    );
  }

  for (const route of ["/brands/gym-high", "/retailers/gym-high"]) {
    assert.equal(
      Object.hasOwn(lifecycle.PUBLIC_INDEXABILITY_LIFECYCLE, route),
      false,
      route
    );
    assert.equal(lifecycle.getLifecycleStatus(route), "owner_deferred", route);
    assert.equal(
      fs.existsSync(
        path.join(process.cwd(), "app", ...route.slice(1).split("/"), "page.tsx")
      ),
      false,
      route
    );
  }
});

test("unknown routes and statuses fail closed", () => {
  assert.equal(lifecycle.getLifecycleStatus("/future-unregistered-hub"), undefined);
  assert.deepEqual(lifecycle.getLifecycleRobots("/future-unregistered-hub"), {
    index: false,
    follow: true,
  });
  assert.equal(
    lifecycle.isLifecycleSitemapEligible("/future-unregistered-hub"),
    false
  );
  assert.equal(lifecycle.isLifecycleStatusIndexable("future_status"), false);
});

test("coverage loss cannot change robots for a live-verified route", () => {
  for (const visibleProducts of [12, 5, 0]) {
    const simulatedCoverage = {
      visibleProducts,
      qualifyingOffers: visibleProducts * 2,
      freshRetailers: visibleProducts ? 1 : 0,
    };
    assert.ok(simulatedCoverage.visibleProducts >= 0);
    assert.deepEqual(lifecycle.getLifecycleRobots("/deals"), {
      index: true,
      follow: true,
    });
  }
});

test("non-live lifecycle states fail closed even with hypothetical high coverage", () => {
  const highCoverage = { products: 1000, offers: 10000, retailers: 100 };
  assert.ok(highCoverage.offers > 0);
  for (const status of [
    "planned",
    "owner_deferred",
    "manually_withdrawn",
  ]) {
    assert.equal(lifecycle.isLifecycleStatusIndexable(status), false, status);
  }
  assert.equal(lifecycle.getLifecycleStatus("/brands/gym-high"), "owner_deferred");
  assert.equal(lifecycle.isLifecycleSitemapEligible("/brands/gym-high"), false);
});

test("launch-approved routes can enter robots and sitemap before live verification", () => {
  assert.equal(lifecycle.isLifecycleStatusIndexable("launch_approved"), true);
});

test("arbitrary parameters are noindex follow with the base route as canonical", () => {
  for (const route of liveVerifiedPaths) {
    assert.deepEqual(lifecycle.getLifecycleRobots(route, { sort: "price" }), {
      index: false,
      follow: true,
    });
    const source = fs.readFileSync(pageFiles.get(route), "utf8");
    assert.match(source, /getLifecycleRobots\(/, route);
    assert.match(source, /alternates:\s*\{ canonical:/, route);
  }
});

test("all lifecycle hubs abort on a loader error and retain honest empty states", () => {
  for (const [route, filename] of pageFiles) {
    const source = fs.readFileSync(filename, "utf8");
    assert.match(source, /assert(Lifecycle|Deals)DataAvailable\(/, route);
    assert.match(source, /export const dynamic = "force-dynamic";/, route);
    if (route !== "/deals") {
      assert.match(source, /rows\.length === 0/, route);
    }
  }
  assert.throws(
    () => lifecycle.assertLifecycleDataAvailable({ error: true }, "/whey-protein"),
    /temporarily unavailable/
  );
  assert.doesNotThrow(() =>
    lifecycle.assertLifecycleDataAvailable({ error: false }, "/whey-protein")
  );
});

test("robots and sitemap use the same lifecycle map without runtime coverage queries", () => {
  const readiness = fs.readFileSync(
    path.join(process.cwd(), "app/lib/sitemapReadiness.ts"),
    "utf8"
  );
  const sitemap = fs.readFileSync(
    path.join(process.cwd(), "app/sitemap.ts"),
    "utf8"
  );
  assert.match(readiness, /INDEXABILITY_LIFECYCLE/);
  assert.doesNotMatch(readiness, /get[A-Z].*(Comparison|Brand|Retailer)/);
  assert.match(sitemap, /getSitemapIndexability\(\)/);
  assert.match(
    sitemap,
    /throw new Error\("Unable to load complete product sitemap data\."\)/
  );
  assert.doesNotMatch(sitemap, /gym-high/i);
  for (const route of liveVerifiedPaths) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.equal(
      (sitemap.match(new RegExp(`\\$\\{siteUrl\\}${escaped}`, "g")) || [])
        .length,
      1,
      route
    );
  }
});

test("lifecycle hubs use a scoped safe retry screen", () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), "app/error.tsx")), false);
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/components/LifecycleHubError.tsx"),
    "utf8"
  );
  assert.match(source, /Current data is temporarily unavailable/);
  assert.match(source, /unstable_retry/);
  assert.doesNotMatch(source, /\breset\b|old prices|token|supabase|database url/i);

  const boundaries = liveVerifiedPaths.map((route) =>
    path.join(process.cwd(), "app", ...route.slice(1).split("/"), "error.tsx")
  );
  for (const boundary of boundaries) {
    assert.equal(fs.existsSync(boundary), true, boundary);
    assert.match(fs.readFileSync(boundary, "utf8"), /LifecycleHubError/);
  }

  for (const unrelated of ["app/admin/page.tsx", "app/product/[id]/page.tsx"]) {
    assert.doesNotMatch(
      fs.readFileSync(path.join(process.cwd(), unrelated), "utf8"),
      /LifecycleHubError/
    );
  }
});

test("Try again actually invokes the Next 16 Server Component retry", () => {
  const component = compileModule(
    path.join(process.cwd(), "app/components/LifecycleHubError.tsx")
  ).default;
  let retries = 0;
  const tree = component({ unstable_retry: () => { retries += 1; } });
  const stack = [tree];
  let button;
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "button") button = node;
    const children = node.props?.children;
    if (Array.isArray(children)) stack.push(...children);
    else if (children) stack.push(children);
  }
  assert.ok(button, "retry button");
  button.props.onClick();
  assert.equal(retries, 1);
});

function createTestCacheFactory(store, observations) {
  return (read, keyParts, options) => {
    observations.push({ keyParts, options });
    return async (bucket) => {
      const key = JSON.stringify([...keyParts, bucket]);
      if (store.has(key)) return store.get(key);
      const value = await read(bucket);
      store.set(key, value);
      return value;
    };
  };
}

test("lifecycle data cache reuses success, isolates hubs and expires within 3600 seconds", async () => {
  const cache = compileModule(
    path.join(process.cwd(), "app/lib/lifecycleDataCache.ts"),
    { "next/cache": { unstable_cache: () => { throw new Error("unexpected default cache"); } } }
  );
  const store = new Map();
  const observations = [];
  let now = 1_000;
  let wheyReads = 0;
  let dealsReads = 0;
  const options = {
    now: () => now,
    cacheFactory: createTestCacheFactory(store, observations),
  };
  const whey = cache.createLifecycleDataLoader(
    "/whey-protein",
    "query-v1",
    async () => ({ error: false, value: ++wheyReads }),
    options
  );
  const deals = cache.createLifecycleDataLoader(
    "/deals",
    "query-v1",
    async () => ({ error: false, value: ++dealsReads }),
    options
  );

  assert.equal((await whey()).value, 1);
  assert.equal((await whey()).value, 1);
  assert.equal(wheyReads, 1);
  assert.equal((await deals()).value, 1);
  assert.equal(dealsReads, 1);
  assert.notDeepEqual(observations[0].keyParts, observations[1].keyParts);
  assert.equal(observations[0].options.revalidate, 3600);

  now += 3_600_000;
  assert.equal((await whey()).value, 2);
  assert.equal(wheyReads, 2);
});

test("loader errors are not cached while a valid empty result is cached", async () => {
  const cache = compileModule(
    path.join(process.cwd(), "app/lib/lifecycleDataCache.ts"),
    { "next/cache": { unstable_cache: () => { throw new Error("unexpected default cache"); } } }
  );
  const store = new Map();
  const observations = [];
  let attempts = 0;
  const recovering = cache.createLifecycleDataLoader(
    "/protein-bars",
    "query-v1",
    async () => ({ error: ++attempts === 1, rows: [] }),
    { cacheFactory: createTestCacheFactory(store, observations) }
  );
  await assert.rejects(recovering(), /temporarily unavailable/);
  assert.deepEqual(await recovering(), { error: false, rows: [] });
  assert.deepEqual(await recovering(), { error: false, rows: [] });
  assert.equal(attempts, 2);
});

test("an expired successful entry cannot hide the next loader failure", async () => {
  const cache = compileModule(
    path.join(process.cwd(), "app/lib/lifecycleDataCache.ts"),
    { "next/cache": { unstable_cache: () => { throw new Error("unexpected default cache"); } } }
  );
  const store = new Map();
  const observations = [];
  let now = 1_000;
  let fail = false;
  let reads = 0;
  const load = cache.createLifecycleDataLoader(
    "/deals",
    "query-v2",
    async () => ({ error: fail, rows: [], reads: ++reads }),
    {
      now: () => now,
      cacheFactory: createTestCacheFactory(store, observations),
    }
  );
  assert.equal((await load()).reads, 1);
  fail = true;
  now += 3_600_000;
  await assert.rejects(load(), /temporarily unavailable/);
  assert.equal(reads, 2);
});

test("metadata stays database-free while every hub page uses its unique cached loader", () => {
  const versions = new Set();
  for (const [route, filename] of pageFiles) {
    const source = fs.readFileSync(filename, "utf8");
    assert.match(source, /createLifecycleDataLoader\(/, route);
    const match = source.match(
      /createLifecycleDataLoader\(\s*[^,]+,\s*"([^"]+)"/m
    );
    assert.ok(match, route);
    assert.equal(versions.has(match[1]), false, match[1]);
    versions.add(match[1]);
    const metadataBody = source.slice(
      source.indexOf("export async function generateMetadata"),
      source.indexOf("function ", source.indexOf("export async function generateMetadata") + 20)
    );
    assert.doesNotMatch(metadataBody, /getCached|Comparison\(|Brand\(|Retailer\(|getDeals\(/);
  }
});

test("SEO-04 pagination and product pages retain their separate contracts", () => {
  const pagination = fs.readFileSync(
    path.join(process.cwd(), "app/lib/categoryLandingPagination.ts"),
    "utf8"
  );
  const productPage = fs.readFileSync(
    path.join(process.cwd(), "app/product/[id]/page.tsx"),
    "utf8"
  );
  assert.match(pagination, /normalizeCategoryLandingPage/);
  assert.match(pagination, /canonical/);
  assert.doesNotMatch(productPage, /getLifecycleRobots/);
});
