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

test("shared current-offer window is exactly 24 days and fails closed", () => {
  assert.equal(MAXIMUM_CURRENT_OFFER_AGE_DAYS, 24);
  assert.equal(MAXIMUM_CURRENT_OFFER_AGE_HOURS, 576);
  assert.equal(isOfferFresh("2026-07-08T12:00:00.000Z", now), true);
  assert.equal(isOfferFresh("2026-07-08T11:59:59.999Z", now), false);
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
