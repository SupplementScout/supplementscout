const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadModule(relativePath) {
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

const {
  isOfferFresh,
  MAXIMUM_CURRENT_OFFER_AGE_DAYS,
  MAXIMUM_CURRENT_OFFER_AGE_HOURS,
} = loadModule("app/lib/offerFreshness.ts");
const now = new Date("2026-08-01T12:00:00.000Z");

test("shared current-offer window is exactly 24 hours and fails closed", () => {
  assert.equal(MAXIMUM_CURRENT_OFFER_AGE_DAYS, 1);
  assert.equal(MAXIMUM_CURRENT_OFFER_AGE_HOURS, 24);
  assert.equal(isOfferFresh("2026-07-31T12:00:00.000Z", now), true);
  assert.equal(isOfferFresh("2026-07-31T11:59:59.999Z", now), false);
  assert.equal(isOfferFresh("2026-08-01T12:00:00.001Z", now), false);
  assert.equal(isOfferFresh(null, now), false);
  assert.equal(isOfferFresh("invalid", now), false);
});

test("public product and search paths use the shared freshness gate", () => {
  const productPage = fs.readFileSync(path.join(process.cwd(), "app/product/[id]/page.tsx"), "utf8");
  const products = fs.readFileSync(path.join(process.cwd(), "app/lib/products.ts"), "utf8");
  const groups = fs.readFileSync(path.join(process.cwd(), "app/lib/productOfferGroups.ts"), "utf8");

  assert.match(productPage, /filter\(\(offer\) => isOfferFresh\(offer\.last_checked_at\)\)/);
  assert.match(products, /isOfferFresh\(offer\.last_checked_at/);
  assert.match(groups, /isOfferFresh\(offer\.last_checked_at, now\)/);
  assert.ok((products.match(/last_checked_at,/g) || []).length >= 3);
});

test("comparison pages share product thumbnails and the dated red offer badge", () => {
  const visuals = fs.readFileSync(
    path.join(process.cwd(), "app/components/ComparisonProductVisuals.tsx"),
    "utf8"
  );
  const cardPages = [
    "app/pre-workout/page.tsx",
    "app/whey-protein/page.tsx",
    "app/amino-acids/page.tsx",
    "app/hydration/page.tsx",
    "app/whey-isolate/page.tsx",
    "app/vegan-protein/page.tsx",
    "app/mass-gainer/page.tsx",
    "app/multivitamins/page.tsx",
    "app/brands/applied-nutrition/page.tsx",
  ];

  assert.match(visuals, /ComparisonProductThumbnail/);
  assert.match(visuals, /role="img"/);
  assert.match(visuals, /No image/);
  assert.match(visuals, /Offer checked \{formatted\}/);
  assert.match(visuals, /border-red-200 bg-red-50/);
  assert.match(visuals, /url\.protocol !== "https:"/);

  for (const page of cardPages) {
    const source = fs.readFileSync(path.join(process.cwd(), page), "utf8");
    assert.match(source, /<ComparisonProductThumbnail/);
    assert.match(source, /<OfferCheckedBadge/);
  }

  const creatine = fs.readFileSync(
    path.join(process.cwd(), "app/creatine/page.tsx"),
    "utf8"
  );
  assert.match(creatine, /<ProductIdentity row=\{row\}/);
  assert.match(creatine, /<OfferCheckedBadge/);
});
