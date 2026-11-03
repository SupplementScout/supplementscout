const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadCategoryCoverageModule() {
  const filename = path.join(process.cwd(), "app/lib/categoryCoverage.ts");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(output, filename);
  return instance.exports;
}

const {
  categoryCoverageDefinitionForLabel,
  evaluateCategoryCoverage,
  getCategoryCoverageDefinition,
} = loadCategoryCoverageModule();

const definition = getCategoryCoverageDefinition("testosterone-boosters");

const fixtures = [
  { id: 183, name: "BioTech USA Tribooster 60 Tablets", category: "Vitamins", description: "A strong testosterone booster formula." },
  { id: 184, name: "7Nutrition Volcano Testosterone 150 Capsules", category: "Vitamins", description: "Natural testosterone booster." },
  { id: 217, name: "Mutant Test 90 Capsules", category: "Vitamins", description: "Testosterone capsules and support formula." },
  { id: 225, name: "Olimp T-100 Ultimate Testosterone 120 Capsules", category: "Health Supplements", description: null },
  { id: 237, name: "TWP PCT Aftermath 2.0 120 Capsules", category: "Vitamins", description: "Post-cycle testosterone recovery support." },
  { id: 285, name: "USN 19-Anabol Testo 90 Capsules", category: "Health Supplements", description: "Support for low testosterone." },
  { id: 413, name: "GYM HIGH ZMB 60 Capsules", category: "Health Supplements", description: "Zinc and magnesium with testosterone support claims." },
  { id: 420, name: "Long Jack Tongkat Ali 60 caps", category: "Health Supplements", description: "Single botanical extract." },
  { id: 429, name: "GYM HIGH Testo Pro 180 Capsules", category: "Health Supplements", description: "Natural hormone support formula." },
  { id: 431, name: "Black Mamba Fadogia Agrestis 60 Capsules", category: "Health Supplements", description: "Supports healthy testosterone levels." },
  { id: 446, name: "Extreme Labs TT4 Tribulus Terrestris 90 Caps", category: "Health Supplements", description: "Tribulus supplement." },
  { id: 459, name: "Applied Nutrition Turk-X Turkesterone Plus", category: "Health Supplements", description: "Muscle growth and body recomposition support." },
  { id: 485, name: "Applied Nutrition Tongkat Ali 600mg 60 Capsules", category: "Health Supplements", description: "Vitality support." },
  { id: 499, name: "Olimp DAA Xtreme Prolact-Block 60 Tablets", category: "Health Supplements", description: "An advanced testosterone booster." },
  { id: 514, name: "Animal Stak 21 Packs", category: "Health Supplements", description: "Complete natural hormone support." },
  { id: 596, name: "Simply Supplements Super Zinc Plus", category: "Vitamins", description: "Zinc contributes to normal testosterone synthesis." },
  { id: 982, name: "Nordic Labs Long Jack Tongkat Ali 60 Capsules", category: "Health Supplements", description: null },
  { id: 983, name: "Nordic Labs TestX Pro Turkesterone 60 Capsules", category: "Health Supplements", description: null },
  { id: 992, name: "Osavi Tribulus Terrestris Saponins 200mg 180 Capsules", category: "Health Supplements", description: null },
  { id: 1111, name: "Ultra Nutrio Mr Test 100 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1124, name: "Nordic Labs Fadogia Agrestis 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1218, name: "Refined Nutrition Tribulus 60 Capsules", category: "Health Supplements", description: null },
  { id: 1363, name: "Chaos Crew Turk 10% Turkesterone 500mg", category: "Testosterone Boosters", description: null },
  { id: 1364, name: "Swole Lifestyle Fadogia Agrestis 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1365, name: "Swole Lifestyle Tongkat Ali 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1366, name: "USN Anabolic Turk Test 1200 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1387, name: "TWP Ashwagandha", category: "Health Supplements", description: "May provide testosterone benefits." },
  { id: 1436, name: "TWP Tongkat Ali", category: "Health Supplements", description: null },
];

const expectedIds = {
  INCLUDE_STRONG: [183, 184, 217, 225, 285, 429, 499, 514, 983, 1111, 1366],
  EXCLUDE_STRONG: [237, 413, 459, 596, 1363, 1387],
  REVIEW_REQUIRED: [420, 431, 446, 485, 982, 992, 1124, 1218, 1364, 1365, 1436],
};

test("Testosterone Boosters definition exposes the shared route and candidate-only queries", () => {
  assert.ok(definition);
  assert.equal(definition.publicLabel, "Testosterone Boosters");
  assert.equal(definition.route, "/testosterone-boosters");
  assert.deepEqual(definition.canonicalCategoryAliases, ["Testosterone Boosters"]);
  for (const query of [
    "testosterone",
    "testo",
    "testx",
    "tribooster",
    "hormone support",
    "anabol",
    "fadogia",
    "tongkat",
    "tribulus",
    "turkesterone",
  ]) {
    assert.ok(definition.candidateQueries.includes(query), query);
  }
});

test("the 28 audited fixtures reproduce the exact 11/6/11 contract", () => {
  assert.equal(fixtures.length, 28);
  const actual = Object.fromEntries(
    Object.keys(expectedIds).map((classification) => [classification, []])
  );

  for (const fixture of fixtures) {
    const evaluation = evaluateCategoryCoverage(definition, fixture);
    actual[evaluation.classification].push(fixture.id);
  }

  assert.deepEqual(actual, expectedIds);
});

test("reason codes and confidence are deterministic and exclusion wins", () => {
  const evaluations = new Map(
    fixtures.map((fixture) => [
      fixture.id,
      evaluateCategoryCoverage(definition, fixture),
    ])
  );

  assert.deepEqual(evaluations.get(183).reasonCodes, [
    "EXPLICIT_TESTOSTERONE_NAME",
    "EXPLICIT_TESTOSTERONE_BOOSTER_DESCRIPTION",
  ]);
  assert.deepEqual(evaluations.get(237).reasonCodes, ["POST_CYCLE_IDENTITY"]);
  assert.deepEqual(evaluations.get(1363).reasonCodes, [
    "STANDALONE_TURKESTERONE_IDENTITY",
  ]);
  assert.deepEqual(evaluations.get(1124).reasonCodes, [
    "AMBIGUOUS_INGREDIENT_IDENTITY",
    "AMBIGUOUS_CANONICAL_CATEGORY",
  ]);
  assert.equal(evaluations.get(183).confidence, "HIGH");
  assert.equal(evaluations.get(1363).confidence, "HIGH");
  assert.equal(evaluations.get(1124).confidence, "MEDIUM");

  const zincWithBoosterWords = evaluateCategoryCoverage(definition, {
    name: "Everyday Zinc Tablets",
    description: "A testosterone booster claim appears in marketing copy.",
  });
  assert.equal(zincWithBoosterWords.classification, "EXCLUDE_STRONG");
  assert.deepEqual(zincWithBoosterWords.reasonCodes, ["ORDINARY_ZINC_IDENTITY"]);
});

test("unrelated and ingredient-only products fail closed", () => {
  const negatives = [
    { name: "Creatine Monohydrate", description: "Supports training performance." },
    { name: "Whey Protein", description: "Protein powder." },
    { name: "Zinc Tablets", description: "Normal testosterone synthesis." },
    { name: "Ashwagandha", description: "Testosterone benefits." },
    { name: "Pre Workout", description: "Hormone support marketing copy." },
  ];

  for (const product of negatives) {
    const evaluation = evaluateCategoryCoverage(definition, product);
    assert.notEqual(evaluation.classification, "INCLUDE_STRONG", product.name);
  }

  assert.equal(
    evaluateCategoryCoverage(definition, negatives[0]).confidence,
    "LOW"
  );
});

test("exact label resolution is shared and aliases do not use fuzzy matching", () => {
  assert.equal(
    categoryCoverageDefinitionForLabel(" Testosterone Boosters ").route,
    "/testosterone-boosters"
  );
  assert.equal(categoryCoverageDefinitionForLabel("Testosterone Booster"), null);
});

test("existing five reviewed landing definitions preserve their name-only boundaries", () => {
  const cases = [
    ["glucosamine", "Glucosamine Sulphate", true],
    ["glucosamine", "Joint Support Collagen", false],
    ["magnesium", "ZMB Capsules", true],
    ["omega-3", "Omega 3 Fish Oil", true],
    ["omega-3", "Omega 3 Pet Oil", false],
    ["vitamin-d", "Vitamin D3 4000 IU", true],
    ["vitamins", "Vitamin C Tablets", true],
    ["vitamins", "Vitamin Whey Protein", false],
  ];

  for (const [key, name, included] of cases) {
    const currentDefinition = getCategoryCoverageDefinition(key);
    assert.equal(
      evaluateCategoryCoverage(currentDefinition, {
        name,
        description: included ? "irrelevant" : "vitamin magnesium testosterone booster",
      }).classification === "INCLUDE_STRONG",
      included,
      `${key}: ${name}`
    );
  }
});

test("runtime coverage module contains no product-ID, slug, brand or retailer exceptions", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/lib/categoryCoverage.ts"),
    "utf8"
  );
  assert.doesNotMatch(source, /\b(?:183|184|217|225|285|429|499|514|983|1111|1366)\b/);
  assert.doesNotMatch(source, /\b(?:productId|product_id|slug|retailer)\b/i);
  assert.doesNotMatch(source, /GYM HIGH|BioTech USA|Nordic Labs|Ultra Nutrio/i);
});

test("pilot route reuses shared retrieval, cache, lifecycle and card contracts", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/testosterone-boosters/page.tsx"),
    "utf8"
  );
  assert.match(source, /getLandingProducts\(/);
  assert.match(source, /CATEGORY_LANDING_PAGE_SIZE/);
  assert.match(source, /createLifecycleDataLoader\(/);
  assert.match(source, /testosterone-boosters-category-v1/);
  assert.match(source, /assertLifecycleDataAvailable\(/);
  assert.match(
    source,
    /evaluateCategoryCoverage\(testosteroneBoosterDefinition, product\)/
  );
  assert.match(source, /"INCLUDE_STRONG"/);
  assert.match(source, /<ProductResultCard key=\{product\.id\} product=\{product\}/);
});
