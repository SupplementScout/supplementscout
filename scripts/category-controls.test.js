const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function compileModule(filename) {
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

const controls = compileModule(
  path.join(process.cwd(), "app", "lib", "categoryControls.ts")
);

function row(overrides = {}) {
  return {
    id: "1",
    brand: "Alpha",
    productFormat: "Powder",
    retailers: [{ id: "10", name: "Shop One" }],
    deliveredTotal: 20,
    verifiedValue: 1.5,
    retailerCount: 1,
    offerCount: 1,
    ...overrides,
  };
}

test("category controls filter on the server and keep deterministic sorting", () => {
  const rows = [
    row({ id: "3", brand: "Beta", deliveredTotal: null, retailerCount: 3 }),
    row({ id: "2", deliveredTotal: 12, retailerCount: 2 }),
    row({ id: "1", deliveredTotal: 12, retailerCount: 2 }),
  ];
  const view = controls.buildCategoryControlView(
    rows,
    { brand: "alpha", sort: "delivered_total" },
    (item) => item,
    { verifiedValueSort: true }
  );

  assert.deepEqual(view.rows.map((item) => item.id), ["1", "2"]);
  assert.equal(view.controls.brand, "alpha");
  assert.equal(view.controls.sort, "delivered_total");
  assert.equal(view.totalCount, 3);
  assert.equal(view.hasActiveFilters, true);
});

test("unknown parameters fail closed to the clean decision view", () => {
  const view = controls.buildCategoryControlView(
    [row()],
    { brand: "missing", retailer: "999", format: "capsule", sort: "popular" },
    (item) => item
  );

  assert.deepEqual(view.controls, {
    sort: "decision",
    brand: "",
    retailer: "",
    format: "",
  });
  assert.equal(controls.categoryControlUrl("/whey-protein", view.controls), "/whey-protein");
});

test("verified-value sorting exists only when the route explicitly enables it", () => {
  const rows = [row({ id: "1", verifiedValue: null }), row({ id: "2", verifiedValue: 1 })];
  const omitted = controls.buildCategoryControlView(
    rows,
    { sort: "verified_value" },
    (item) => item
  );
  const enabled = controls.buildCategoryControlView(
    rows,
    { sort: "verified_value" },
    (item) => item,
    { verifiedValueSort: true }
  );

  assert.equal(omitted.controls.sort, "decision");
  assert.deepEqual(enabled.rows.map((item) => item.id), ["2", "1"]);
});

test("incomplete brand or format evidence suppresses that filter", () => {
  const view = controls.buildCategoryControlView(
    [row(), row({ id: "2", brand: null, productFormat: null })],
    {},
    (item) => item
  );

  assert.deepEqual(view.facets.brands, []);
  assert.deepEqual(view.facets.formats, []);
  assert.equal(view.facets.retailers.length, 1);
});

test("all ten category routes reuse one controls owner and only approved value routes enable value sorting", () => {
  const routes = [
    "whey-protein",
    "whey-isolate",
    "vegan-protein",
    "creatine",
    "protein-bars",
    "mass-gainer",
    "hydration",
    "pre-workout",
    "amino-acids",
    "multivitamins",
  ];

  for (const route of routes) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );
    assert.match(source, /buildCategoryControlView/);
    assert.match(source, /CategoryComparisonControls/);
    assert.match(source, /getLifecycleRobots\(pagePath, params\)/);
  }

  for (const route of ["whey-protein", "whey-isolate", "vegan-protein", "creatine"]) {
    const source = fs.readFileSync(path.join(process.cwd(), "app", route, "page.tsx"), "utf8");
    assert.match(source, /verifiedValueSort:\s*true/);
  }

  for (const route of ["protein-bars", "mass-gainer", "hydration", "pre-workout", "amino-acids", "multivitamins"]) {
    const source = fs.readFileSync(path.join(process.cwd(), "app", route, "page.tsx"), "utf8");
    assert.doesNotMatch(source, /verifiedValueSort:\s*true/);
  }
});
