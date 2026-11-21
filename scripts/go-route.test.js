const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function compileTypeScriptModule(filename, mocks = {}) {
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

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  Module._load = function loadModule(request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

function loadOutboundModule() {
  return compileTypeScriptModule(
    path.join(process.cwd(), "app", "lib", "outboundClickRedirect.ts")
  );
}

function createMockSupabase() {
  const calls = {
    tables: [],
    insertedClicks: [],
  };
  const offer = {
    id: "123",
    product_id: "456",
    retailer_id: "789",
    url: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    in_stock: true,
  };
  const product = {
    id: "456",
    slug: "safe-product",
    is_active: true,
    merged_into_product_id: null,
  };

  return {
    calls,
    supabaseAdmin: {
      from(table) {
        calls.tables.push(table);

        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            if (table === "offers") {
              return { data: offer, error: null };
            }

            if (table === "products") {
              return { data: product, error: null };
            }

            return { data: null, error: new Error(`Unexpected table ${table}`) };
          },
          async insert(click) {
            calls.insertedClicks.push(click);

            return { error: null };
          },
        };
      },
    },
  };
}

function loadGoRouteModule(supabaseAdmin) {
  const outboundModule = loadOutboundModule();

  return compileTypeScriptModule(
    path.join(process.cwd(), "app", "go", "[offerId]", "route.ts"),
    {
      "next/server": {
        NextResponse: {
          redirect(url) {
            return new Response(null, {
              status: 307,
              headers: {
                Location: String(url),
              },
            });
          },
        },
      },
      "../../lib/outboundClickRedirect": outboundModule,
      "../../lib/supabaseAdmin": { supabaseAdmin },
    }
  );
}

function createRequest(url, userAgent, headers = {}) {
  const request = new Request(url, {
    headers: {
      "user-agent": userAgent,
      ...headers,
    },
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request;
}

test("bot User-Agent returns 204 without inserting or redirecting", async () => {
  const { calls, supabaseAdmin } = createMockSupabase();
  const { GET } = loadGoRouteModule(supabaseAdmin);
  const response = await GET(
    createRequest(
      "https://www.supplementscout.co.uk/go/123?source=product_best_offer",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    ),
    { params: Promise.resolve({ offerId: "123" }) }
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.deepEqual(calls.tables, []);
  assert.deepEqual(calls.insertedClicks, []);
});

test("normal User-Agent inserts outbound click and redirects", async () => {
  const { calls, supabaseAdmin } = createMockSupabase();
  const { GET } = loadGoRouteModule(supabaseAdmin);
  const response = await GET(
    createRequest(
      "https://www.supplementscout.co.uk/go/123?source=product_best_offer",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      {
        referer: "https://www.supplementscout.co.uk/product/safe-product",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      }
    ),
    { params: Promise.resolve({ offerId: "123" }) }
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959"
  );
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.deepEqual(calls.insertedClicks, [
    {
      offer_id: "123",
      product_id: "456",
      retailer_id: "789",
      destination_url:
        "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
      source_page: "product_best_offer",
      traffic_class: "likely_human",
      classification_reason: "browser_same_origin_navigation",
      client_family: "chrome",
      referrer_class: "same_origin_product",
      fetch_context: "same_origin_navigation",
      request_method: "GET",
    },
  ]);
});

test("HEAD returns 204 without database access or redirect", async () => {
  const { calls, supabaseAdmin } = createMockSupabase();
  const { HEAD } = loadGoRouteModule(supabaseAdmin);
  const response = await HEAD();

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.deepEqual(calls.tables, []);
  assert.deepEqual(calls.insertedClicks, []);
});

test("robots disallows admin and go paths", () => {
  const robots = compileTypeScriptModule(
    path.join(process.cwd(), "app", "robots.ts")
  ).default();
  const wildcardRule = robots.rules.find((rule) => rule.userAgent === "*");

  assert.deepEqual(wildcardRule?.disallow, ["/admin", "/go"]);
});

test("documented Meta crawler forms return before offer reads, click writes and redirects", async () => {
  const agents = [
    "meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    "meta-externalfetcher/1.1 (+/documentation/sharing/webmasters/web-crawlers)",
    "meta-webindexer/1.1", "meta-externalagent/1.1", "meta-externalfetcher/1.1",
    "  MeTa-WeBiNdExEr/1.1  ", "META-EXTERNALAGENT/1.1", "Meta-ExternalFetcher/1.1",
    "facebookexternalhit/1.1", "FacebookExternalHit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Googlebot/2.1", "bingbot/2.0",
  ];
  for (const agent of agents) {
    const { calls, supabaseAdmin } = createMockSupabase();
    const { GET } = loadGoRouteModule(supabaseAdmin);
    const response = await GET(createRequest("https://www.supplementscout.co.uk/go/123", agent), {
      params: Promise.resolve({ offerId: "123" }),
    });
    assert.equal(response.status, 204, agent);
    assert.equal(response.headers.get("location"), null, agent);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.deepEqual(calls.tables, [], agent);
    assert.deepEqual(calls.insertedClicks, [], agent);
  }
});

test("browser, in-app browser, missing and unusual agents retain existing click diagnostics", async () => {
  const cases = [
    ["Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36", "likely_human"],
    ["Mozilla/5.0 AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]", "likely_human"],
    [null, "likely_automated"], ["CustomMetaClient/1.0", "unknown"], ["curl/8.0", "likely_automated"],
  ];
  for (const [agent, classification] of cases) {
    const { calls, supabaseAdmin } = createMockSupabase();
    const { GET } = loadGoRouteModule(supabaseAdmin);
    const request = createRequest("https://www.supplementscout.co.uk/go/123?source=product_best_offer", agent || "", {
      referer: "https://www.supplementscout.co.uk/product/safe-product",
      "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
    });
    if (agent === null) request.headers.delete("user-agent");
    const response = await GET(request, { params: Promise.resolve({ offerId: "123" }) });
    assert.equal(response.status, 307, String(agent));
    assert.equal(response.headers.get("location"), "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959");
    assert.equal(calls.insertedClicks.length, 1);
    assert.equal(calls.insertedClicks[0].traffic_class, classification);
    assert.equal(calls.insertedClicks[0].source_page, "product_best_offer");
  }
});
