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

const decision = compileModule(
  path.join(process.cwd(), "app", "lib", "categoryDecision.ts")
);

function candidate(overrides = {}) {
  return {
    id: "1",
    name: "Example product",
    brand: "Example brand",
    productUrl: "/product/example",
    deliveredTotal: 20,
    verifiedValue: 1.5,
    valueBasis: "cost_per_25g_protein",
    retailerCount: 2,
    offerCount: 2,
    lastCheckedAt: "2026-10-15T10:00:00.000Z",
    ...overrides,
  };
}

test("selects three truthful answers when three different products win", () => {
  const answers = decision.selectCategoryDecisionAnswers([
    candidate({ id: "1", deliveredTotal: 10, verifiedValue: 2, retailerCount: 2 }),
    candidate({ id: "2", deliveredTotal: 20, verifiedValue: 1, retailerCount: 2 }),
    candidate({ id: "3", deliveredTotal: 30, verifiedValue: 3, retailerCount: 4 }),
  ]);

  assert.deepEqual(answers.map((answer) => answer.id), ["1", "2", "3"]);
  assert.deepEqual(
    answers.map((answer) => answer.reasons[0].type),
    ["lowest_delivered_total", "best_verified_value", "broadest_retailer_coverage"]
  );
});

test("collapses duplicate winners instead of inventing second place", () => {
  const answers = decision.selectCategoryDecisionAnswers([
    candidate({ id: "1", deliveredTotal: 10, verifiedValue: 1, retailerCount: 4, offerCount: 5 }),
    candidate({ id: "2", deliveredTotal: 20, verifiedValue: 2, retailerCount: 2 }),
  ]);

  assert.equal(answers.length, 1);
  assert.deepEqual(
    answers[0].reasons.map((reason) => reason.type),
    ["lowest_delivered_total", "best_verified_value", "broadest_retailer_coverage"]
  );
});

test("unknown delivery and missing verified value cannot win", () => {
  const answers = decision.selectCategoryDecisionAnswers([
    candidate({ id: "1", deliveredTotal: null, verifiedValue: null, retailerCount: 1 }),
    candidate({ id: "2", deliveredTotal: 18, verifiedValue: null, valueBasis: null, retailerCount: 1 }),
  ]);

  assert.equal(answers.length, 1);
  assert.equal(answers[0].id, "2");
  assert.deepEqual(answers[0].reasons.map((reason) => reason.type), ["lowest_delivered_total"]);
});

test("ties use offer count, known delivery and stable product identity", () => {
  const answers = decision.selectCategoryDecisionAnswers([
    candidate({ id: "10", deliveredTotal: 12, verifiedValue: 1, retailerCount: 3, offerCount: 4 }),
    candidate({ id: "2", deliveredTotal: 12, verifiedValue: 1, retailerCount: 3, offerCount: 5 }),
    candidate({ id: "1", deliveredTotal: 12, verifiedValue: 1, retailerCount: 3, offerCount: 5 }),
  ]);

  assert.equal(answers[0].id, "1");
  assert.deepEqual(
    answers[0].reasons.map((reason) => reason.type),
    ["lowest_delivered_total", "best_verified_value", "broadest_retailer_coverage"]
  );
});

test("current-row adapters keep stale or unavailable rows ineligible", () => {
  const rows = [
    {
      id: "stale",
      name: "Stale product",
      brand: null,
      productUrl: "/product/stale",
      bestOffer: null,
      retailerCount: 0,
      offerCount: 0,
      lastCheckedAt: "2026-10-01T10:00:00.000Z",
      costPer25gProtein: null,
    },
    {
      id: "live",
      name: "Live product",
      brand: null,
      productUrl: "/product/live",
      bestOffer: { deliveredPrice: { totalPrice: 21 } },
      retailerCount: 1,
      offerCount: 1,
      lastCheckedAt: "2026-10-15T10:00:00.000Z",
      costPer25gProtein: 1.2,
    },
  ];

  const candidates = decision.categoryDecisionCandidates(rows, {
    valueBasis: "cost_per_25g_protein",
  });
  const answers = decision.selectCategoryDecisionAnswers(candidates);

  assert.equal(candidates[0].deliveredTotal, null);
  assert.deepEqual(answers.map((answer) => answer.id), ["live"]);
  assert.deepEqual(
    answers[0].reasons.map((reason) => reason.type),
    ["lowest_delivered_total", "best_verified_value"]
  );
});

test("only approved route families enable a verified value basis", () => {
  for (const route of ["whey-protein", "whey-isolate", "vegan-protein"]) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );
    assert.match(source, /valueBasis:\s*"cost_per_25g_protein"/);
  }

  const creatine = fs.readFileSync(
    path.join(process.cwd(), "app", "creatine", "page.tsx"),
    "utf8"
  );
  assert.match(creatine, /creatineDecisionCandidates\(result\.rows\)/);

  for (const route of [
    "protein-bars",
    "mass-gainer",
    "hydration",
    "pre-workout",
    "amino-acids",
    "multivitamins",
  ]) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );
    assert.match(source, /categoryDecisionCandidates\(result\.rows\)/);
    assert.doesNotMatch(source, /valueBasis:\s*"cost_per_25g_protein"/);
  }
});

test("decision actions retain accessible names and reuse the existing compare route", () => {
  const panel = fs.readFileSync(
    path.join(process.cwd(), "app", "components", "CategoryDecisionPanel.tsx"),
    "utf8"
  );
  assert.match(panel, />\s*See product\s*</);
  assert.match(panel, />\s*Add to comparison\s*</);
  assert.match(panel, /\/compare\?left=\$\{encodeURIComponent\(answer\.id\)\}/);
  assert.doesNotMatch(panel, /best product|most popular|recommended for/i);
});
