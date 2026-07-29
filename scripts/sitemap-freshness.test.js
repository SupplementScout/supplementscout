const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sitemapSource = fs.readFileSync(
  path.join(process.cwd(), "app", "sitemap.ts"),
  "utf8"
);

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
});

test("catalogue sitemap fails closed instead of publishing a partial product list", () => {
  assert.match(
    sitemapSource,
    /return \{ products: \[\] as SitemapProduct\[\], error \};/
  );
});
