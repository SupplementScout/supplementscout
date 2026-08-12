const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(process.cwd(), "app", "vitamin-d", "page.tsx"),
  "utf8"
);

test("Vitamin D preserves its established metadata and primary intent", () => {
  assert.match(source, /const basePath = "\/vitamin-d"/);
  assert.match(source, /const pageTitle = "Compare Vitamin D Supplements UK"/);
  assert.match(
    source,
    /Compare Vitamin D supplement prices from UK retailers\./
  );
  assert.match(source, /<h1[^>]*>[\s\S]*Compare Vitamin D Supplements UK/);
  assert.equal((source.match(/<h1\b/g) || []).length, 1);
});

test("Vitamin D answers cost intent once using existing landing data", () => {
  assert.equal(
    (source.match(/How much does vitamin D cost in the UK\?/g) || []).length,
    1
  );
  assert.match(source, /page === 1/);
  assert.match(source, /results\[0\]\?\.cheapestOffer\?\.deliveredPrice\.totalPrice/);
  assert.match(source, /currently compares \{totalCount\} Vitamin D products/);
  assert.match(source, /formatCurrency\(lowestDeliveredPrice\)/);
  assert.match(source, /delivered cost per serving/);
});

test("Vitamin D keeps the existing product, pagination and internal-link paths", () => {
  assert.match(source, /<ProductResultCard key=\{product\.id\} product=\{product\}/);
  assert.match(source, /<CategoryLandingPagination/);
  assert.match(source, /href="\/search\?q=vitamin%20d"/);
  assert.doesNotMatch(source, /\/vitamin-d-cost/);
  assert.doesNotMatch(source, /FAQPage/);
});
