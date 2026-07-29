const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
}

const nextConfig = loadTypeScriptModule("next.config.ts");
const homepageSource = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
const homepageDataSource = fs.readFileSync(
  path.join(process.cwd(), "app/lib/homepageData.ts"),
  "utf8"
);
const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
const privacySource = fs.readFileSync(path.join(process.cwd(), "app/privacy/page.tsx"), "utf8");
const cookiesSource = fs.readFileSync(path.join(process.cwd(), "app/cookies/page.tsx"), "utf8");

test("homepage statistics are server-rendered independently of GA and consent", () => {
  assert.doesNotMatch(homepageSource, /^"use client"/);
  assert.doesNotMatch(homepageSource, /useEffect|useState|Loading site statistics|animate-pulse/);
  assert.match(homepageSource, /await getHomepageData\(\)/);
  assert.match(homepageSource, /productCount\.toLocaleString\("en-GB"\)/);
  assert.match(homepageSource, /retailerCount\.toLocaleString\("en-GB"\)/);
  assert.match(homepageSource, /<time dateTime=\{latestOfferCheckAt\}>/);
  assert.doesNotMatch(
    `${homepageSource}\n${homepageDataSource}`,
    /GA_MEASUREMENT|AnalyticsConsent|analytics consent/i
  );
});

test("homepage data uses exact counts, truthful freshness and independent failures", () => {
  assert.match(
    homepageDataSource,
    /\.from\("products"\)[\s\S]*count: "exact", head: true/
  );
  assert.match(
    homepageDataSource,
    /\.from\("retailers"\)[\s\S]*count: "exact", head: true/
  );
  assert.match(homepageDataSource, /\.from\("offers"\)/);
  assert.match(homepageDataSource, /\.select\("last_checked_at"\)/);
  assert.match(homepageDataSource, /\.limit\(1\)/);
  assert.match(homepageDataSource, /Promise\.allSettled/);
  assert.match(homepageDataSource, /settledValue\(productCount, null\)/);
  assert.match(homepageDataSource, /settledValue\(retailerCount, null\)/);
  assert.match(homepageDataSource, /settledValue\(latestOfferCheckAt, null\)/);
  assert.doesNotMatch(homepageSource, /productCount\s*\|\|\s*0|retailerCount\s*\|\|\s*0/);
});

test("homepage categories paginate beyond the database response ceiling", () => {
  assert.match(
    homepageDataSource,
    /for \(let from = 0; ; from \+= HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE\)/
  );
  assert.match(
    homepageDataSource,
    /\.range\(from, from \+ HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE - 1\)/
  );
  assert.match(homepageDataSource, /if \(rows\.length < HOMEPAGE_CATEGORY_FETCH_PAGE_SIZE\)/);
  assert.match(homepageDataSource, /unstable_cache/);
  assert.match(homepageDataSource, /revalidate: HOMEPAGE_REVALIDATE_SECONDS/);
});

test("CSP allows only the configured HTTPS Supabase origin", async () => {
  const productionOrigin = "https://project-ref.supabase.co";
  assert.equal(nextConfig.getAllowedHttpsOrigin(`${productionOrigin}/rest/v1`), productionOrigin);
  assert.equal(nextConfig.getAllowedHttpsOrigin("http://project-ref.supabase.co"), "");
  assert.equal(nextConfig.getAllowedHttpsOrigin("not-a-url"), "");

  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `${productionOrigin}/rest/v1`;
  delete require.cache[require.resolve(path.join(process.cwd(), "next.config.ts"))];
  const config = loadTypeScriptModule("next.config.ts").default;
  const headers = await config.headers();
  const csp = headers[0].headers.find((header) => header.key === "Content-Security-Policy").value;
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;

  assert.match(csp, /connect-src 'self' https:\/\/project-ref\.supabase\.co https:\/\/www\.google-analytics\.com/);
  assert.doesNotMatch(csp, /connect-src[^;]*\*/);
});

test("missing GA Measurement ID cannot wrap or suppress homepage statistics", () => {
  assert.match(layoutSource, /process\.env\.NEXT_PUBLIC_GA_MEASUREMENT_ID \|\| ""/);
  assert.match(layoutSource, /<AnalyticsConsent measurementId=\{measurementId\} enabled=\{analyticsEnabled\}/);
  assert.doesNotMatch(layoutSource, /analyticsEnabled\s*&&\s*\(?\s*\{children\}/);
});

test("privacy and cookie policy routes remain present", () => {
  assert.match(privacySource, /Privacy Policy/);
  assert.match(cookiesSource, /Cookie Policy/);
  assert.match(homepageSource, /href="\/privacy"/);
  assert.match(homepageSource, /href="\/cookies"/);
});
