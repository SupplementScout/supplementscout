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
