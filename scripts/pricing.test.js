const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadPricingModule() {
  const filename = path.join(process.cwd(), "app", "lib", "pricing.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);

  return mod.exports;
}

const {
  getDeliveredPrice,
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
} = loadPricingModule();

test("500 ml liquid at 24.98 returns 49.96 per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, 500, "liquid", true),
    49.96
  );
});

test("liquid does not return price per kg", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(getVerifiedPricePerKg(deliveredPrice, 500, "liquid", true), null);
});

test("unverified liquid returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, 500, "liquid", false),
    null
  );
});

test("liquid with missing volume returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, null, "liquid", true),
    null
  );
});

test("liquid with zero or negative volume returns no price per litre", () => {
  const deliveredPrice = getDeliveredPrice({ price: 24.98, shipping_cost: 0 });

  assert.equal(getVerifiedPricePerLitre(deliveredPrice, 0, "liquid", true), null);
  assert.equal(
    getVerifiedPricePerLitre(deliveredPrice, -500, "liquid", true),
    null
  );
});
