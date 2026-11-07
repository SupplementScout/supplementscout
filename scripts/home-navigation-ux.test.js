const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app", "page.tsx"),
  "utf8"
);
const headerSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "HomeHeader.tsx"),
  "utf8"
);
const categoriesSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "HomeCategories.tsx"),
  "utf8"
);
const categoryRoutesSource = fs.readFileSync(
  path.join(process.cwd(), "app", "lib", "categoryRoutes.ts"),
  "utf8"
);
const categoryCoverageSource = fs.readFileSync(
  path.join(process.cwd(), "app", "lib", "categoryCoverage.ts"),
  "utf8"
);
const searchInputSource = fs.readFileSync(
  path.join(process.cwd(), "app", "components", "SearchInput.tsx"),
  "utf8"
);
const headerAst = ts.createSourceFile(
  "HomeHeader.tsx",
  headerSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

function collectAstNodes(root, predicate) {
  const matches = [];

  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }

  visit(root);
  return matches;
}

function isJsxElementNamed(node, tagName) {
  return (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(headerAst) === tagName
  );
}

test("homepage renders one responsive header and one conditional mobile menu", () => {
  assert.equal((headerSource.match(/<header\b/g) || []).length, 1);
  assert.equal((headerSource.match(/<aside\b/g) || []).length, 1);
  assert.equal((pageSource.match(/<HomeHeader\b/g) || []).length, 1);
  assert.match(headerSource, /menuOpen &&/);
  assert.match(headerSource, /onClick=\{\(\) => setMenuOpen\(true\)\}/);
  assert.match(headerSource, /aria-expanded=\{menuOpen\}/);
  assert.match(headerSource, /aria-controls="home-mobile-menu"/);
  assert.equal((headerSource.match(/id="home-mobile-menu"/g) || []).length, 1);
  assert.match(headerSource, /className="[^"]*md:hidden"/);
});

test("mobile dialog is portalled outside the backdrop-filtered header", () => {
  const portalCalls = collectAstNodes(
    headerAst,
    (node) =>
      ts.isCallExpression(node) &&
      node.expression.getText(headerAst) === "createPortal"
  );
  const headers = collectAstNodes(headerAst, (node) =>
    isJsxElementNamed(node, "header")
  );

  assert.equal(portalCalls.length, 1);
  assert.equal(portalCalls[0].arguments[1]?.getText(headerAst), "document.body");
  assert.equal(headers.length, 1);
  assert.equal(
    collectAstNodes(headers[0], (node) => isJsxElementNamed(node, "aside"))
      .length,
    0
  );
  assert.equal(
    collectAstNodes(portalCalls[0].arguments[0], (node) =>
      isJsxElementNamed(node, "aside")
    ).length,
    1
  );
  assert.match(headerSource, /typeof document !== "undefined"/);
  assert.match(headerSource, /backdrop-blur/);
});

test("mobile dialog is an opaque safe-area-aware full viewport layer", () => {
  const asideClassName = headerSource.match(
    /<aside[\s\S]*?className="([^"]+)"/
  )?.[1];

  assert.ok(asideClassName);
  for (const requiredClass of [
    "fixed",
    "inset-0",
    "z-[100]",
    "h-dvh",
    "w-full",
    "overflow-x-hidden",
    "overflow-y-auto",
    "overscroll-contain",
    "bg-white",
    "md:hidden",
  ]) {
    assert.ok(
      asideClassName.includes(requiredClass),
      `Expected mobile dialog class ${requiredClass}`
    );
  }

  assert.match(asideClassName, /env\(safe-area-inset-top\)/);
  assert.match(asideClassName, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(asideClassName, /max-w-|bg-white\//);
  assert.match(
    headerSource,
    /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-label="Mobile navigation"/
  );
  assert.match(headerSource, />\s*Close\s*<\/button>/);
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

test("mobile menu exposes the five working discovery and comparison destinations", () => {
  for (const label of [
    "Supplements",
    "Compare",
    "Best Deals",
    "Guides",
    "Help Me Choose",
  ]) {
    assert.match(headerSource, new RegExp(`label: "${label}"`));
  }

  const navigationItemsBlock = headerSource.match(
    /const navigationItems = \[([\s\S]*?)\];/
  )?.[1];
  assert.ok(navigationItemsBlock);
  assert.equal((navigationItemsBlock.match(/\{ label:/g) || []).length, 5);
  assert.equal(
    collectAstNodes(
      headerAst,
      (node) =>
        ts.isVariableDeclaration(node) &&
        node.name.getText(headerAst) === "navigationItems"
    ).length,
    1
  );
  assert.match(headerSource, /href="#search"/);
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

test("homepage initial HTML contract uses truthful server statistics", () => {
  assert.match(pageSource, /export default async function Home/);
  assert.match(pageSource, /await getHomepageData\(\)/);
  assert.doesNotMatch(pageSource, /useEffect|animate-pulse|Loading site statistics/);
  assert.doesNotMatch(pageSource, /Daily price updates planned/);
  assert.match(pageSource, /active catalogue products/);
  assert.match(pageSource, /UK retailers represented/);
  assert.match(pageSource, /latest recorded price check/);
  assert.match(pageSource, /Live catalogue statistics are temporarily unavailable/);
});

test("popular searches use existing category and search routes", () => {
  for (const route of [
    "/creatine",
    "/whey-protein",
    "/pre-workout",
    "/magnesium",
    "/vitamin-d",
  ]) {
    assert.match(pageSource, new RegExp(`href: "${route}"`));
  }

  assert.match(pageSource, /query: "electrolytes"/);
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
  assert.match(goalBlock, /href: "\/magnesium"/);
  assert.match(goalBlock, /href: "\/pre-workout"/);
  assert.match(goalBlock, /href: "\/hydration"/);
  assert.match(goalBlock, /href: "\/whey-protein"/);
  assert.match(goalBlock, /href: "\/vitamins"/);
});

test("mobile category list is limited without changing category routes", () => {
  assert.match(pageSource, /<HomeCategories items=\{categoryLinks\}/);
  assert.match(pageSource, /COMPARISON_CATEGORY_LINKS/);
  assert.match(pageSource, /categoryBrowseHref\(category\)/);
  assert.match(categoriesSource, /MOBILE_CATEGORY_LIMIT = 7/);
  assert.match(categoriesSource, /index >= MOBILE_CATEGORY_LIMIT/);
  assert.match(categoriesSource, /"hidden md:block"/);
  assert.match(categoriesSource, /className="[^"]*md:hidden"/);
  assert.match(categoriesSource, /View all categories/);
  assert.match(categoriesSource, /aria-expanded=\{showAllCategories\}/);

  for (const route of [
    "/vitamins",
    "/creatine",
    "/magnesium",
    "/vitamin-d",
    "/omega-3",
    "/hydration",
    "/glucosamine",
  ]) {
    assert.match(categoryRoutesSource, new RegExp(`href: "${route}"`));
  }
});

test("Testosterone Boosters homepage browsing uses the shared coverage route", () => {
  assert.match(categoryRoutesSource, /categoryCoverageDefinitionForLabel\(category\)\?\.route/);
  assert.match(
    categoryCoverageSource,
    /publicLabel: "Testosterone Boosters",[\s\S]*route: "\/testosterone-boosters"/
  );
  assert.doesNotMatch(categoryRoutesSource, /Testosterone Boosters/);
});

test("Fat Burners uses shared coverage while Weight Management keeps Search fallback", () => {
  assert.match(
    categoryCoverageSource,
    /publicLabel: "Fat Burners",[\s\S]*route: "\/fat-burners"/
  );
  assert.doesNotMatch(categoryRoutesSource, /Fat Burners/);
  assert.doesNotMatch(categoryRoutesSource, /Weight Management/);
});

test("Collagen uses shared coverage and homepage discovery appends missing semantic labels generically", () => {
  assert.match(
    categoryCoverageSource,
    /publicLabel: "Collagen",[\s\S]*route: "\/collagen"/
  );
  assert.doesNotMatch(categoryRoutesSource, /Collagen/);
  assert.match(pageSource, /CATEGORY_COVERAGE_DEFINITIONS/);
  assert.match(
    pageSource,
    /CATEGORY_COVERAGE_DEFINITIONS\.map\(\(definition\) => definition\.publicLabel\)/
  );
  assert.match(pageSource, /const seen = new Set<string>\(\)/);
  assert.match(pageSource, /category\.trim\(\)\.toLowerCase\(\)/);
  assert.match(pageSource, /homepageBrowseCategories\(categories\)/);
  assert.doesNotMatch(pageSource, /if\s*\([^)]*category[^)]*===\s*["']Collagen/);
});

test("Nootropics uses generic shared coverage discovery without route-specific homepage code", () => {
  assert.match(
    categoryCoverageSource,
    /publicLabel: "Nootropics",[\s\S]*route: "\/nootropics"/
  );
  assert.equal((categoryCoverageSource.match(/route: "\/nootropics"/g) || []).length, 1);
  assert.doesNotMatch(categoryRoutesSource, /Nootropics|\/nootropics/);
  assert.doesNotMatch(pageSource, /if\s*\([^)]*category[^)]*===\s*["']Nootropics/);
});

test("Amino Acids shared definition keeps one deduplicated homepage destination", () => {
  assert.match(
    categoryCoverageSource,
    /publicLabel: "Amino Acids",[\s\S]*route: "\/amino-acids"/
  );
  assert.equal((categoryCoverageSource.match(/route: "\/amino-acids"/g) || []).length, 1);
  assert.equal((categoryRoutesSource.match(/label: "Amino Acids", href: "\/amino-acids"/g) || []).length, 1);
  assert.match(pageSource, /const seen = new Set<string>\(\)/);
  assert.match(pageSource, /if \(!normalized \|\| seen\.has\(normalized\)\) return false/);
  assert.doesNotMatch(pageSource, /if\s*\([^)]*category[^)]*===\s*["']Amino Acids/);
});
