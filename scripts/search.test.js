const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");

function loadProductsModule() {
  const filename = path.join(process.cwd(), "app", "lib", "products.ts");
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
    if (parent === mod && request === "./pricing") {
      return {
        getDeliveredPrice: () => null,
        getVerifiedCostPer5gCreatine: () => null,
        getVerifiedCostPer25gProtein: () => null,
        getVerifiedPricePerKg: () => null,
        getVerifiedPricePerLitre: () => null,
        getVerifiedPricePerServing: () => null,
      };
    }

    if (parent === mod && request === "./supabase") {
      return { supabase: {} };
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

const { searchQueryVariants } = loadProductsModule();

const cases = [
  ["creatin", ["creatin", "creatine"]],
  ["creatine", ["creatine"]],
  ["magnesum", ["magnesum", "magnesium"]],
  ["magnesium", ["magnesium"]],
  ["vit d", ["vit d", "vitamin d"]],
  ["vit d k2", ["vit d k2", "vitamin d k2", "vitamin d%k2", "vitamin d3%k2"]],
  ["vitamin d", ["vitamin d"]],
  ["vitamin d k2", ["vitamin d k2", "vitamin d%k2", "vitamin d3%k2"]],
  ["vitamin d3 k2", ["vitamin d3 k2", "vitamin d3%k2"]],
  ["d3 k2", ["d3 k2", "d3%k2", "vitamin d3%k2"]],
  ["omega3", ["omega3", "omega 3"]],
  ["omega 3", ["omega 3"]],
  ["glucosamin", ["glucosamin", "glucosamine"]],
  ["glucosamine", ["glucosamine"]],
  ["whey protien", ["whey protien", "whey protein"]],
  ["whey protein", ["whey protein"]],
  ["simply supliments", ["simply supliments", "simply supplements"]],
  ["Simply Supplements", ["Simply Supplements", "simply supplements"]],
];

test("search query variants include conservative typo and shortcut corrections", () => {
  for (const [query, expected] of cases) {
    assert.deepEqual(searchQueryVariants(query), expected, query);
  }
});

test("search query variants normalize extra whitespace and deduplicate variants", () => {
  assert.deepEqual(searchQueryVariants("  whey   protien  "), [
    "  whey   protien  ",
    "whey protien",
    "whey protein",
  ]);
  assert.deepEqual(searchQueryVariants("  magnesium  "), [
    "  magnesium  ",
    "magnesium",
  ]);
});
