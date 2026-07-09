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

function createRequest(url, userAgent) {
  const request = new Request(url, {
    headers: {
      "user-agent": userAgent,
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
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
    },
  ]);
});

test("robots disallows admin and go paths", () => {
  const robots = compileTypeScriptModule(
    path.join(process.cwd(), "app", "robots.ts")
  ).default();

  assert.deepEqual(robots.rules.disallow, ["/admin", "/go"]);
});
