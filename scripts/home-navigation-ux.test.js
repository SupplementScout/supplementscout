const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app", "page.tsx"),
  "utf8"
);
const headerSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "HomeHeader.tsx"),
  "utf8"
);
const searchInputSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "SearchInput.tsx"),
  "utf8"
);

test("homepage renders one responsive header and one conditional mobile menu", () => {
  assert.equal((headerSource.match(/<header\b/g) || []).length, 1);
  assert.equal((headerSource.match(/<aside\b/g) || []).length, 1);
  assert.equal((pageSource.match(/<HomeHeader\b/g) || []).length, 1);
  assert.match(headerSource, /menuOpen && \(/);
  assert.match(headerSource, /onClick=\{\(\) => setMenuOpen\(true\)\}/);
  assert.match(headerSource, /aria-expanded=\{menuOpen\}/);
  assert.match(headerSource, /aria-controls="home-mobile-menu"/);
  assert.equal((headerSource.match(/id="home-mobile-menu"/g) || []).length, 1);
  assert.match(headerSource, /className="[^"]*md:hidden"/);
});

test("mobile menu supports Escape, focus management and complete cleanup", () => {
  assert.match(headerSource, /event\.key === "Escape"/);
  assert.match(headerSource, /event\.key !== "Tab"/);
  assert.match(headerSource, /document\.body\.style\.overflow = "hidden"/);
  assert.match(headerSource, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(headerSource, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(headerSource, /window\.removeEventListener\("keydown", onKeyDown\)/);
  assert.match(
    headerSource,
    /mobileViewport\.addEventListener\("change", onViewportChange\)/
  );
  assert.match(
    headerSource,
    /mobileViewport\.removeEventListener\("change", onViewportChange\)/
  );
  assert.match(headerSource, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(headerSource, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(
    headerSource,
    /function onViewportChange[\s\S]*restoreBodyOverflow\(\);[\s\S]*setMenuOpen\(false\)/
  );
  assert.match(
    headerSource,
    /href=\{item\.href\}[\s\S]*onClick=\{\(\) => \{[\s\S]*setMenuOpen\(false\);[\s\S]*menuButtonRef\.current\?\.focus\(\)/
  );
});

test("mobile menu contains only the four requested destinations", () => {
  for (const label of [
    "Search supplements",
    "Popular categories",
    "Shop by goal",
    "How it works",
  ]) {
    assert.match(headerSource, new RegExp(`label: "${label}"`));
  }

  const navigationItemsBlock = headerSource.match(
    /const navigationItems = \[([\s\S]*?)\];/
  )?.[1];
  assert.ok(navigationItemsBlock);
  assert.equal((navigationItemsBlock.match(/\{ label:/g) || []).length, 4);
});

test("hero reuses one search input with mobile-safe autocomplete", () => {
  assert.ok(pageSource.indexOf("<h1") < pageSource.indexOf("<SearchInput />"));
  assert.equal((pageSource.match(/<SearchInput\b/g) || []).length, 1);
  assert.equal((searchInputSource.match(/<form\b/g) || []).length, 1);
  assert.equal((searchInputSource.match(/id="search"/g) || []).length, 1);
  assert.equal(
    (searchInputSource.match(/id="search-suggestions"/g) || []).length,
    1
  );
  assert.match(searchInputSource, /min-h-14/);
  assert.match(searchInputSource, /max-h-\[min\(65vh,28rem\)\]/);
  assert.match(searchInputSource, /overflow-y-auto/);
  assert.match(searchInputSource, /data-suggestion-index=\{suggestionIndex\}/);
  assert.match(searchInputSource, /\.scrollIntoView\(\{ block: "nearest" \}\)/);
});

test("homepage loading state never renders zero-value statistics", () => {
  assert.match(pageSource, /useState<number \| null>\(null\)/);
  assert.match(pageSource, /isLoading && \(/);
  assert.match(pageSource, /animate-pulse/);
  assert.match(pageSource, /Loading site statistics/);
  assert.doesNotMatch(pageSource, /useState\(0\)/);
  assert.doesNotMatch(pageSource, /Daily price updates planned/);
  assert.match(pageSource, /latest recorded price check/);
  assert.match(pageSource, /\.from\("offers"\)/);
  assert.match(pageSource, /\.select\("last_checked_at"\)/);
  assert.match(pageSource, /\.limit\(1\)/);
  assert.match(pageSource, /latestCheckError\s*\?\s*null/);

  const blockingErrorCondition = pageSource.match(
    /if \(\s*(categoryError[\s\S]*?productsCountError)\s*\) \{\s*setLoadError/
  )?.[1];
  assert.ok(blockingErrorCondition);
  assert.doesNotMatch(blockingErrorCondition, /latestCheckError/);
});

test("popular searches use existing category and search routes", () => {
  for (const route of ["/creatine", "/magnesium", "/vitamin-d"]) {
    assert.match(pageSource, new RegExp(`href: "${route}"`));
  }

  for (const query of ["whey protein", "electrolytes"]) {
    assert.match(pageSource, new RegExp(`query: "${query}"`));
  }
});

test("Shop by goal uses six controlled existing destinations", () => {
  const goalBlock = pageSource.match(/const goalLinks = \[([\s\S]*?)\];/)?.[1];
  assert.ok(goalBlock);
  assert.equal((goalBlock.match(/\{\s*label:/g) || []).length, 6);

  for (const goal of [
    "Sleep",
    "Energy",
    "Recovery",
    "Hydration",
    "Muscle growth",
    "General health",
  ]) {
    assert.match(goalBlock, new RegExp(`label: "${goal}"`));
  }

  assert.match(goalBlock, /query: "recovery"/);
  assert.match(goalBlock, /query: "muscle gain"/);
  assert.match(goalBlock, /href: "\/hydration"/);
  assert.match(goalBlock, /href: "\/vitamins"/);
});

test("mobile category list is limited without changing category routes", () => {
  assert.match(pageSource, /MOBILE_CATEGORY_LIMIT = 7/);
  assert.match(pageSource, /index >= MOBILE_CATEGORY_LIMIT/);
  assert.match(pageSource, /"hidden md:block"/);
  assert.match(pageSource, /className="[^"]*md:hidden"/);
  assert.match(pageSource, /View all categories/);
  assert.match(pageSource, /aria-expanded=\{showAllCategories\}/);

  for (const route of [
    "/vitamins",
    "/creatine",
    "/magnesium",
    "/vitamin-d",
    "/omega-3",
    "/hydration",
    "/glucosamine",
  ]) {
    assert.match(pageSource, new RegExp(`href: "${route}"`));
  }
});
