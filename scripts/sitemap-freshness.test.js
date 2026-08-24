const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");
const ts = require("typescript");

const sitemapSource = fs.readFileSync(
  path.join(process.cwd(), "app", "sitemap.ts"),
  "utf8"
);

function loadIndexabilityModule() {
  const filename = path.join(
    process.cwd(),
    "app",
    "lib",
    "sitemapIndexability.ts"
  );
  const source = fs.readFileSync(filename, "utf8");
  const outputText = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
}

test("catalogue sitemap is generated from current production data", () => {
  assert.match(sitemapSource, /export const dynamic = "force-dynamic";/);
  assert.match(sitemapSource, /\.eq\("is_active", true\)/);
  assert.match(sitemapSource, /\.is\("merged_into_product_id", null\)/);
  assert.match(sitemapSource, /\.not\("slug", "is", null\)/);
});

test("catalogue sitemap preserves canonical slug URLs", () => {
  assert.match(sitemapSource, /`\$\{siteUrl\}\/product\/\$\{product\.slug\}`/);
  assert.doesNotMatch(sitemapSource, /\/product\/\$\{product\.id\}/);
});

test("catalogue sitemap paginates beyond the Supabase 1000-row response limit", () => {
  assert.match(sitemapSource, /const SITEMAP_PAGE_SIZE = 1000;/);
  assert.match(sitemapSource, /for \(let from = 0; ; from \+= SITEMAP_PAGE_SIZE\)/);
  assert.match(
    sitemapSource,
    /\.range\(from, from \+ SITEMAP_PAGE_SIZE - 1\)/
  );
  assert.match(sitemapSource, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(sitemapSource, /if \(page\.length < SITEMAP_PAGE_SIZE\)/);
  assert.match(sitemapSource, /count: "exact"/);
  assert.match(sitemapSource, /products\.length !== expectedProductCount/);
  assert.match(sitemapSource, /Product sitemap data is incomplete/);
});

test("catalogue sitemap fails closed instead of publishing a partial product list", () => {
  assert.match(
    sitemapSource,
    /throw new Error\("Unable to load complete product sitemap data\."\);/
  );
  assert.doesNotMatch(sitemapSource, /console\.error\("Unable to load product pages for sitemap/);
});

test("product lastModified uses real product and offer evidence", () => {
  assert.match(
    sitemapSource,
    /\.select\("id, slug, created_at, offers\(last_checked_at\)", \{/
  );
  assert.match(sitemapSource, /Date\.parse\(value\)/);
  assert.match(sitemapSource, /new Date\(Math\.max\(\.\.\.timestamps\)\)\.toISOString\(\)/);
  assert.match(sitemapSource, /lastModified: productLastModified\(product\)/);
});

test("static pages omit lastModified until a truthful modification source exists", () => {
  assert.doesNotMatch(sitemapSource, /staticLastModified/);
});

test("readiness-gated noindex paths are excluded while ungated paths remain", () => {
  const { isSitemapPathIndexable } = loadIndexabilityModule();
  const readiness = new Map([
    ["/whey-protein", true],
    ["/whey-isolate", false],
    ["/mass-gainer", false],
    ["/protein-bars", true],
  ]);

  assert.equal(isSitemapPathIndexable("/whey-protein", readiness), true);
  assert.equal(isSitemapPathIndexable("/whey-isolate", readiness), false);
  assert.equal(isSitemapPathIndexable("/mass-gainer", readiness), false);
  assert.equal(isSitemapPathIndexable("/protein-bars", readiness), true);
  assert.equal(isSitemapPathIndexable("/about", readiness), true);
  assert.match(sitemapSource, /getSitemapIndexability\(\)/);
  assert.match(sitemapSource, /isSitemapPathIndexable\(path, indexability\)/);
});
