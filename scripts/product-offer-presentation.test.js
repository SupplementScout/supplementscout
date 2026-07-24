const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function compileModule(filename, mocks = {}) {
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

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

const pricing = compileModule(
  path.join(process.cwd(), "app", "lib", "pricing.ts")
);
const {
  buildBestOfferPricePresentation,
  calculateDeliveredSavings,
  formatOfferCheckedDate,
} = compileModule(
  path.join(process.cwd(), "app", "lib", "productOfferPresentation.ts"),
  { "./pricing": pricing }
);

test("paid delivery shows full delivered total and explicit breakdown", () => {
  const summary = buildBestOfferPricePresentation({
    price: 20,
    shipping_cost: 3.99,
  });

  assert.equal(summary.label, "Best delivered price");
  assert.equal(summary.primaryPrice, "£23.99");
  assert.equal(summary.breakdown, "£20.00 product + £3.99 delivery");
});

test("free delivery is stated without displaying a misleading zero charge", () => {
  assert.deepEqual(
    buildBestOfferPricePresentation({
      price: "62.14",
      shipping_cost: 0,
    }),
    {
      label: "Best delivered price",
      primaryPrice: "£62.14",
      breakdown: "£62.14 product + free delivery",
    }
  );
});

test("unknown delivery never labels product-only price as delivered", () => {
  const summary = buildBestOfferPricePresentation({
    price: 19.99,
    shipping_cost: null,
  });

  assert.equal(summary.label, "Lowest product price");
  assert.equal(summary.primaryPrice, "£19.99");
  assert.equal(summary.breakdown, "£19.99 product + delivery cost unknown");
  assert.notEqual(summary.label, "Best delivered price");
});

test("missing product and delivery values have an explicit unavailable state", () => {
  assert.deepEqual(
    buildBestOfferPricePresentation({
      price: null,
      shipping_cost: null,
    }),
    {
      label: "Price unavailable",
      primaryPrice: "Price unavailable",
      breakdown: "Product price and delivery cost unavailable",
    }
  );
});

test("checked date is stable in UK format and invalid values stay hidden", () => {
  assert.equal(
    formatOfferCheckedDate("2026-07-24T08:05:00Z"),
    "24 July 2026"
  );
  assert.equal(formatOfferCheckedDate(null), null);
  assert.equal(formatOfferCheckedDate("not-a-date"), null);
});

test("saving compares only two complete delivered totals", () => {
  assert.equal(calculateDeliveredSavings(23.99, 28.49), 4.5);
  assert.equal(calculateDeliveredSavings(23.99, null), null);
  assert.equal(calculateDeliveredSavings(null, 28.49), null);
  assert.equal(calculateDeliveredSavings(23.99, 23.99), null);
  assert.equal(calculateDeliveredSavings(23.99, 20), null);
});
