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

const aminoDefinition = getCategoryCoverageDefinition("amino-acids");
const hydrationDefinition = getCategoryCoverageDefinition("hydration");
const electrolytesDefinition = getCategoryCoverageDefinition("electrolytes");
const hydrationElectrolytesFixtures = require(
  "./fixtures/category-coverage/hydration-electrolytes"
);
const {
  fixtures: aminoFixtures,
  expectedIds: expectedAminoIds,
} = require("./fixtures/category-coverage/amino-acids");

const definition = getCategoryCoverageDefinition("testosterone-boosters");

const { fixtures, expectedIds } = require("./fixtures/category-coverage/testosterone-boosters");

const fatBurnersDefinition = getCategoryCoverageDefinition("fat-burners");
const {
  fixtures: fatFixtures,
  expectedIds: expectedFatIds,
} = require("./fixtures/category-coverage/fat-burners");

const collagenDefinition = getCategoryCoverageDefinition("collagen");
const {
  fixtures: collagenFixtures,
  expectedIds: expectedCollagenIds,
} = require("./fixtures/category-coverage/collagen");

const nootropicsDefinition = getCategoryCoverageDefinition("nootropics");
const {
  fixtures: nootropicsFixtures,
  expectedIds: expectedNootropicsIds,
} = require("./fixtures/category-coverage/nootropics");

test("Hydration is public while Electrolytes is one shared internal semantic definition", () => {
  assert.ok(hydrationDefinition);
  assert.equal(hydrationDefinition.publicLabel, "Hydration");
  assert.equal(hydrationDefinition.route, "/hydration");
  assert.ok(electrolytesDefinition);
  assert.equal(electrolytesDefinition.exposure, "internal");
  assert.equal(electrolytesDefinition.internalLabel, "Electrolytes");
  assert.equal(categoryCoverageDefinitionForLabel("Hydration").route, "/hydration");
  assert.equal(categoryCoverageDefinitionForLabel("Electrolytes"), null);
});

test("Hydration and Electrolytes fixtures preserve strong, review, exclusion and multi-membership boundaries", () => {
  for (const { product, expected } of hydrationElectrolytesFixtures) {
    assert.equal(
      evaluateCategoryCoverage(hydrationDefinition, product).classification,
      expected.hydration,
      `Hydration: ${product.name}`
    );
    assert.equal(
      evaluateCategoryCoverage(electrolytesDefinition, product).classification,
      expected.electrolytes,
      `Electrolytes: ${product.name}`
    );
  }
});

test("every Electrolytes strong fixture is also Hydration strong", () => {
  for (const { product } of hydrationElectrolytesFixtures) {
    const electrolyte = evaluateCategoryCoverage(
      electrolytesDefinition,
      product
    );
    if (electrolyte.classification === "INCLUDE_STRONG") {
      assert.equal(
        evaluateCategoryCoverage(hydrationDefinition, product).classification,
        "INCLUDE_STRONG",
        product.name
      );
    }
  }
});

test("Amino Acids definition exposes one shared route and the audited candidate vocabulary", () => {
  assert.ok(aminoDefinition);
  assert.equal(aminoDefinition.publicLabel, "Amino Acids");
  assert.equal(aminoDefinition.route, "/amino-acids");
  assert.deepEqual(aminoDefinition.canonicalCategoryAliases, ["Amino Acids"]);
  for (const query of [
    "amino", "BCAA", "EAA", "glutamine", "arginine", "AAKG",
    "beta alanine", "citrulline", "carnitine", "glycine", "taurine",
    "tyrosine", "leucine", "isoleucine", "valine", "lysine", "HMB",
    "intra workout",
  ]) {
    assert.ok(aminoDefinition.candidateQueries.includes(query), query);
  }
});

test("the 110 audited Amino fixtures reproduce the exact 99/7/4 contract", () => {
  assert.equal(aminoFixtures.length, 110);
  const actual = Object.fromEntries(
    Object.keys(expectedAminoIds).map((classification) => [classification, []])
  );

  for (const fixture of aminoFixtures) {
    const evaluation = evaluateCategoryCoverage(aminoDefinition, fixture);
    actual[evaluation.classification].push(fixture.id);
  }

  assert.deepEqual(actual, expectedAminoIds);
  assert.equal(actual.INCLUDE_STRONG.length, 99);
  assert.equal(actual.REVIEW_REQUIRED.length, 7);
  assert.equal(actual.EXCLUDE_STRONG.length, 4);
});

test("Amino identity is category-agnostic, supports audited multi-membership and fails ambiguity closed", () => {
  const strong = [
    { name: "Example BCAA Formula", category: "Health Supplements" },
    { name: "Example EAA Hydration", category: "Hydration" },
    { name: "Creatine + Taurine", category: "Creatine" },
    { name: "Creatine + HMB", category: "Creatine" },
    { name: "L-Carnitine Liquid", category: "Weight Management" },
    { name: "Opaque Formula", category: "Amino Acids", description: "An essential amino acids and BCAA formula." },
  ];
  for (const product of strong) {
    assert.equal(
      evaluateCategoryCoverage(aminoDefinition, product).classification,
      "INCLUDE_STRONG",
      product.name
    );
  }

  const excluded = ["NAC 300mg", "5-HTP 200mg", "L-Glutathione 500mg"];
  for (const name of excluded) {
    assert.equal(
      evaluateCategoryCoverage(aminoDefinition, {
        name,
        category: "Amino Acids",
      }).classification,
      "EXCLUDE_STRONG",
      name
    );
  }

  const review = [
    { name: "Opaque Catalyst", category: "Amino Acids" },
    { name: "Intra-Workout Formula", category: "Amino Acids" },
    { name: "Hydro Amino 2-Pack", category: "Amino Acids" },
    { name: "Whey BCAA Bundle", category: "Whey Protein" },
    { name: "Caffeine + Taurine", category: "Energy Supplements" },
  ];
  for (const product of review) {
    assert.equal(
      evaluateCategoryCoverage(aminoDefinition, product).classification,
      "REVIEW_REQUIRED",
      product.name
    );
  }
});

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

test("Fat Burners definition exposes one shared route and audited candidate queries", () => {
  assert.ok(fatBurnersDefinition);
  assert.equal(fatBurnersDefinition.publicLabel, "Fat Burners");
  assert.equal(fatBurnersDefinition.route, "/fat-burners");
  assert.deepEqual(fatBurnersDefinition.canonicalCategoryAliases, ["Fat Burners"]);
  for (const query of [
    "fat burner",
    "fat burning",
    "fat loss",
    "thermogenic",
    "thermogenesis",
    "burner",
    "shred",
    "cuts",
    "ripper",
    "clenburexin",
    "oxyshred",
    "hydroxycut",
  ]) {
    assert.ok(fatBurnersDefinition.candidateQueries.includes(query), query);
  }
  assert.equal(getCategoryCoverageDefinition("weight-management"), undefined);
});

test("the 114 audited Fat fixtures reproduce the exact 21/77/16 contract", () => {
  assert.equal(fatFixtures.length, 114);
  const actual = Object.fromEntries(
    Object.keys(expectedFatIds).map((classification) => [classification, []])
  );

  for (const fixture of fatFixtures) {
    const evaluation = evaluateCategoryCoverage(fatBurnersDefinition, fixture);
    actual[evaluation.classification].push(fixture.id);
  }

  assert.deepEqual(actual, expectedFatIds);
  assert.equal(actual.INCLUDE_STRONG.length, 21);
  assert.equal(actual.EXCLUDE_STRONG.length, 77);
  assert.equal(actual.REVIEW_REQUIRED.length, 16);
});

test("Collagen definition exposes one shared route and broad candidate-only queries", () => {
  assert.ok(collagenDefinition);
  assert.equal(collagenDefinition.publicLabel, "Collagen");
  assert.equal(collagenDefinition.route, "/collagen");
  assert.deepEqual(collagenDefinition.canonicalCategoryAliases, ["Collagen"]);
  for (const query of [
    "Collagen",
    "collagen peptides",
    "marine collagen",
    "hydrolysed collagen",
    "hydrolyzed collagen",
    "collagen protein",
    "bovine collagen",
    "collagen powder",
    "multi collagen",
  ]) {
    assert.ok(collagenDefinition.candidateQueries.includes(query), query);
  }
});

test("the 52 audited Collagen fixtures reproduce the exact 29/21/2 contract", () => {
  assert.equal(collagenFixtures.length, 52);
  const actual = Object.fromEntries(
    Object.keys(expectedCollagenIds).map((classification) => [classification, []])
  );

  for (const fixture of collagenFixtures) {
    const evaluation = evaluateCategoryCoverage(collagenDefinition, fixture);
    actual[evaluation.classification].push(fixture.id);
  }

  assert.deepEqual(actual, expectedCollagenIds);
  assert.equal(actual.INCLUDE_STRONG.length, 29);
  assert.equal(actual.EXCLUDE_STRONG.length, 21);
  assert.equal(actual.REVIEW_REQUIRED.length, 2);
});

test("Nootropics definition exposes one shared route and audited candidate queries", () => {
  assert.ok(nootropicsDefinition);
  assert.equal(nootropicsDefinition.publicLabel, "Nootropics");
  assert.equal(nootropicsDefinition.route, "/nootropics");
  assert.deepEqual(nootropicsDefinition.canonicalCategoryAliases, ["Nootropics"]);
  for (const query of [
    "Nootropics", "nootropic", "brain booster", "focus", "cognitive",
    "mental focus", "lion's mane", "bacopa", "alpha gpc", "tyrosine",
    "choline", "ginkgo", "ginseng", "rhodiola", "mushroom",
    "mushroom complex", "reishi",
  ]) {
    assert.ok(nootropicsDefinition.candidateQueries.includes(query), query);
  }
});

test("the 67 audited Nootropics fixtures reproduce the exact 13/33/21 contract", () => {
  assert.equal(nootropicsFixtures.length, 67);
  const actual = Object.fromEntries(
    Object.keys(expectedNootropicsIds).map((classification) => [classification, []])
  );

  for (const fixture of nootropicsFixtures) {
    const evaluation = evaluateCategoryCoverage(nootropicsDefinition, fixture);
    actual[evaluation.classification].push(fixture.id);
  }

  assert.deepEqual(actual, expectedNootropicsIds);
  assert.equal(actual.INCLUDE_STRONG.length, 13);
  assert.equal(actual.EXCLUDE_STRONG.length, 33);
  assert.equal(actual.REVIEW_REQUIRED.length, 21);
});

test("Nootropics Model A regressions preserve primary identity and fail closed", () => {
  const evaluations = new Map(
    nootropicsFixtures.map((fixture) => [
      fixture.id,
      evaluateCategoryCoverage(nootropicsDefinition, fixture),
    ])
  );

  for (const id of [22, 23, 235, 367, 436, 437, 443, 960, 978, 1114, 1361, 1397, 1401]) {
    assert.equal(evaluations.get(id).classification, "INCLUDE_STRONG", id);
  }
  assert.deepEqual(evaluations.get(481).reasonCodes, ["PUMP_PREWORKOUT_PRIMARY_IDENTITY"]);
  assert.deepEqual(evaluations.get(367).reasonCodes, ["EXPLICIT_NOOTROPIC_DESCRIPTION"]);
  assert.deepEqual(evaluations.get(1361).reasonCodes, ["FOCUS_IDENTITY_SUPPORTED_BY_EXACT_CATEGORY"]);
  assert.equal(evaluations.get(1130).confidence, "LOW");
  assert.equal(evaluations.get(1134).confidence, "LOW");

  assert.equal(
    evaluateCategoryCoverage(nootropicsDefinition, {
      name: "Example Focus Pre Workout",
      category: "Pre Workout",
      description: "Energy and cognitive performance.",
    }).classification,
    "EXCLUDE_STRONG"
  );
});

test("Collagen key identities include, exclude and fail closed exactly as audited", () => {
  const classifications = new Map(
    collagenFixtures.map((fixture) => [
      fixture.id,
      evaluateCategoryCoverage(collagenDefinition, fixture).classification,
    ])
  );

  for (const id of [435, 460, 461, 720, 721, 831, 864, 937, 986, 989, 1002, 1017, 1221, 1291, 1331, 1343]) {
    assert.equal(classifications.get(id), "INCLUDE_STRONG", id);
  }
  for (const id of [571, 612]) {
    assert.equal(classifications.get(id), "REVIEW_REQUIRED", id);
  }
  for (const id of [551, 565, 575, 586, 598, 640, 650, 660, 670]) {
    assert.equal(classifications.get(id), "EXCLUDE_STRONG", id);
  }

  assert.deepEqual(
    evaluateCategoryCoverage(collagenDefinition, collagenFixtures.find(({ id }) => id === 551)).reasonCodes,
    ["COLLAGEN_BENEFIT_COPY_ONLY"]
  );
  assert.deepEqual(
    evaluateCategoryCoverage(collagenDefinition, collagenFixtures.find(({ id }) => id === 571)).reasonCodes,
    ["DESCRIPTION_LEVEL_COLLAGEN_COMPONENT"]
  );
});

test("Fat key regressions include, exclude and fail closed exactly as audited", () => {
  const classifications = new Map(
    fatFixtures.map((fixture) => [
      fixture.id,
      evaluateCategoryCoverage(fatBurnersDefinition, fixture).classification,
    ])
  );

  for (const id of [93, 507, 508, 1105, 1139, 1357, 1430]) {
    assert.equal(classifications.get(id), "INCLUDE_STRONG", id);
  }
  for (const id of [91, 428, 519, 527, 891, 1122]) {
    assert.equal(classifications.get(id), "REVIEW_REQUIRED", id);
  }
  for (const id of [52, 76, 77, 1186, 1233, 1234, 1302, 1313, 1314, 1417, 1419]) {
    assert.equal(classifications.get(id), "EXCLUDE_STRONG", id);
  }

  const hybrid = evaluateCategoryCoverage(fatBurnersDefinition, fatFixtures.find(({ id }) => id === 367));
  assert.equal(hybrid.classification, "INCLUDE_STRONG");
  assert.equal(
    evaluateCategoryCoverage(fatBurnersDefinition, {
      name: "Generic Caffeine Pre Workout",
      category: "Pre Workout",
      description: "Energy and thermogenesis support.",
    }).classification,
    "EXCLUDE_STRONG"
  );
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
  assert.equal(
    categoryCoverageDefinitionForLabel(" Fat Burners ").route,
    "/fat-burners"
  );
  assert.equal(categoryCoverageDefinitionForLabel("Weight Management"), null);
  assert.equal(categoryCoverageDefinitionForLabel(" collagen ").route, "/collagen");
  assert.equal(categoryCoverageDefinitionForLabel(" NOOTROPICS ").route, "/nootropics");
  assert.equal(categoryCoverageDefinitionForLabel("Nootropic"), null);
  assert.equal(categoryCoverageDefinitionForLabel(" amino acids ").route, "/amino-acids");
  assert.equal(categoryCoverageDefinitionForLabel("Amino Acid"), null);
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
  for (const { id } of fatFixtures) {
    assert.doesNotMatch(source, new RegExp(`\\b${id}\\b`), String(id));
  }
  for (const { id } of collagenFixtures) {
    assert.doesNotMatch(source, new RegExp(`\\b${id}\\b`), String(id));
  }
  for (const { id } of nootropicsFixtures) {
    assert.doesNotMatch(source, new RegExp(`\\b${id}\\b`), String(id));
  }
  for (const { id } of aminoFixtures) {
    assert.doesNotMatch(source, new RegExp(`\\b${id}\\b`), String(id));
  }
  assert.doesNotMatch(
    source,
    /All Day You May|The Grind|No Code|Muscle Martini|Mutant GEAAR|Caffeine \+ Taurine/i
  );
});

test("semantic routes delegate retrieval and rendering to shared infrastructure", () => {
  const helper = fs.readFileSync(
    path.join(process.cwd(), "app/lib/categoryCoverageLanding.ts"),
    "utf8"
  );
  const component = fs.readFileSync(
    path.join(process.cwd(), "app/components/CategoryCoverageLandingPage.tsx"),
    "utf8"
  );

  assert.match(helper, /getLandingProducts\(/);
  assert.match(helper, /CATEGORY_LANDING_PAGE_SIZE/);
  assert.match(helper, /createLifecycleDataLoader\(/);
  assert.match(helper, /assertLifecycleDataAvailable\(/);
  assert.match(helper, /evaluateCategoryCoverage\(coverageDefinition, product\)/);
  assert.match(helper, /"INCLUDE_STRONG"/);
  assert.match(component, /<ProductResultCard key=\{product\.id\} product=\{product\}/);

  for (const route of ["testosterone-boosters", "fat-burners", "collagen", "nootropics"]) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", route, "page.tsx"),
      "utf8"
    );
    assert.match(source, /createCategoryCoverageLanding\(config\)/, route);
    assert.match(source, /<CategoryCoverageLandingPage/, route);
    assert.doesNotMatch(
      source,
      /getLandingProducts|evaluateCategoryCoverage|ProductResultCard/,
      route
    );
  }
});
