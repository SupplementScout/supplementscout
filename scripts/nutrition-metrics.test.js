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

const { getEffectiveNutritionMetrics } = loadModule(
  "app/lib/nutritionMetrics.ts"
);

function product(overrides = {}) {
  return {
    net_weight_g: 2000,
    serving_count_verified: 66,
    serving_size_g: 30,
    protein_per_serving_g: 24,
    creatine_per_serving_g: null,
    product_format: "powder",
    unit_pricing_verified: true,
    nutrition_verified: true,
    ...overrides,
  };
}

test("empty variant override preserves verified product metrics", () => {
  assert.deepEqual(
    getEffectiveNutritionMetrics(product(), {
      size_value: null,
      size_unit: null,
      product_format: null,
      nutrition_override: {},
    }),
    product()
  );
});

test("canonical gram variant size overrides a misleading product package size", () => {
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270 }),
    {
      size_value: 2000,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: {},
    }
  );

  assert.equal(result.net_weight_g, 2000);
  assert.equal(result.unit_pricing_verified, true);
});

test("verified variant nutrition overrides product-level values", () => {
  const result = getEffectiveNutritionMetrics(product(), {
    size_value: 1800,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: {
      serving_count_verified: 72,
      serving_size_g: 25,
      protein_per_serving_g: 22,
      unit_pricing_verified: true,
      nutrition_verified: true,
    },
  });

  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, 72);
  assert.equal(result.serving_size_g, 25);
  assert.equal(result.protein_per_serving_g, 22);
  assert.equal(result.unit_pricing_verified, true);
  assert.equal(result.nutrition_verified, true);
});

test("numeric variant override fails closed without matching verification flags", () => {
  const result = getEffectiveNutritionMetrics(product(), {
    nutrition_override: {
      serving_count_verified: 60,
      protein_per_serving_g: 25,
    },
  });

  assert.equal(result.serving_count_verified, 60);
  assert.equal(result.protein_per_serving_g, 25);
  assert.equal(result.unit_pricing_verified, false);
  assert.equal(result.nutrition_verified, false);
});

test("explicit false variant verification cannot inherit product verification", () => {
  const result = getEffectiveNutritionMetrics(product(), {
    nutrition_override: {
      nutrition_verified: false,
      unit_pricing_verified: false,
    },
  });

  assert.equal(result.unit_pricing_verified, false);
  assert.equal(result.nutrition_verified, false);
});
