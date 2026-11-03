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

const fatBurnersDefinition = getCategoryCoverageDefinition("fat-burners");
const fatFixture = (id, name, category, description = "") => ({
  id,
  name,
  category,
  description,
});
const fatFixtures = [
  fatFixture(52, "ProSupps Dr Jekyll Stim Free Pre Workout 225g", "Pre Workout", "A thermogenic pre-workout."),
  fatFixture(76, "Boditronics Diet Whey 1.8kg", "Whey Protein"),
  fatFixture(77, "Boditronics Diet Whey 900g", "Whey Protein"),
  fatFixture(90, "Nutrex Lipo 6 Black Ultra Concentrate 60 Caps", "Health Supplements", "A revolutionary fat burner."),
  fatFixture(91, "Project AD Shredabull Untamed 2.0 50 Caps", "Health Supplements"),
  fatFixture(93, "JNX Sports The Ripper Fat Burner Powder 150g", "Weight Management"),
  fatFixture(94, "Mutant Carnitine Liquid 1500 473ml", "Health Supplements"),
  fatFixture(95, "Nutrex Lipo6 Black Keto 60 Capsules", "Health Supplements", "A ketogenic fat burner."),
  fatFixture(96, "Nutrex Lipo 6 Aqua Loss 80 Caps", "Health Supplements"),
  fatFixture(97, "5% Nutrition Rich Piana Keto aSalt 252g", "Health Supplements"),
  fatFixture(98, "7Nutrition MCT Oil 400ml", "Health Supplements"),
  fatFixture(99, "Nutrex Lipo6 CLA 45 Softgels", "Health Supplements"),
  fatFixture(100, "HR Labs Fever 40 Fat Burner 75 Caps", "Weight Management"),
  fatFixture(102, "PEScience Alphamine Thermogenic 244g", "Weight Management"),
  fatFixture(103, "PEScience Alphamine Thermogenic 60 Capsules", "Weight Management"),
  fatFixture(144, "Applied Nutrition Tornado Electric Shaker 400ml", "Accessories"),
  fatFixture(151, "Barebells Protein Bars", "Protein Bars"),
  fatFixture(153, "BioTech USA Mega Amino 3200 100 Tablets", "Amino Acids"),
  fatFixture(163, "Dorian Yates Black Bombs 60 Tablets", "Health Supplements", "One of the strongest fat burners."),
  fatFixture(177, "Finaflex Stimul8 180g", "Pre Workout", "A thermogenic high-stimulant pre-workout."),
  fatFixture(185, "GYM HIGH Slimming Protein 1000g", "Whey Protein"),
  fatFixture(239, "Ghost Burn Fat Burner 40 Servings", "Weight Management"),
  fatFixture(367, "GYM HIGH The Stacker 240g", "Health Supplements", "Nootropic, thermogenic, pre-workout and fat burner."),
  fatFixture(388, "Phoenix Fitness Speed Skipping Rope", "Accessories"),
  fatFixture(390, "GYM HIGH Vegan Plant-Based-Protein Blend 600g", "Health Supplements"),
  fatFixture(405, "GASP Stringer Vest Black", "Accessories"),
  fatFixture(407, "CNP Creatine Monohydrate 250g", "Creatine"),
  fatFixture(424, "NXT Nutrition Cream Of Rice 2kg", "Health Supplements"),
  fatFixture(428, "Trec L-Carnitine 3000 Liquid Apricot 500 ml", "Weight Management"),
  fatFixture(462, "Lean Mass Stack", "Health Supplements"),
  fatFixture(476, "GYM HIGH Performance T-Shirt", "Accessories"),
  fatFixture(497, "EHP Labs OxyShred Stim 60 Servings", "Health Supplements", "OxyShred thermogenic fat burner."),
  fatFixture(498, "EHP Labs OxyShred Non-Stim 60 Servings", "Health Supplements", "A non-stimulant fat burner."),
  fatFixture(501, "MuscleTech Hydroxycut Hardcore Super Elite 100 Vegan Capsules", "Health Supplements"),
  fatFixture(504, "EHP Labs Acetyl L-Carnitine 100g", "Weight Management"),
  fatFixture(507, "Animal Cuts Fat Burner 42 Packs", "Weight Management"),
  fatFixture(508, "GYM HIGH Shred Mode 60 Capsules", "Health Supplements", "Thermogenic fat burner with a fully listed formula."),
  fatFixture(519, "Olimp Nutrition MCT Oil - 400 ml", "Health Supplements"),
  fatFixture(522, "Olimp L-Carnitine 1500 Extreme 120 Capsules", "Weight Management"),
  fatFixture(527, "GYM HIGH L-Carnitine Liquid 500 ml", "Weight Management"),
  fatFixture(551, "Vitamin C 500mg Capsules", "Vitamins"),
  fatFixture(562, "Omega 3 for Kids 500mg", "Vitamins"),
  fatFixture(564, "Folic Acid 400mcg", "Vitamins"),
  fatFixture(566, "Potassium Chloride 1000mg", "Health Supplements"),
  fatFixture(567, "Biotin Tablets 10,000mcg", "Vitamins"),
  fatFixture(570, "Max Strength Glucosamine Sulphate 1858mg 2KCl", "Health Supplements"),
  fatFixture(572, "Glucosamine Sulphate 1,500mg Tablets", "Health Supplements"),
  fatFixture(575, "Glucosamine 1,000mg with Vitamin C Capsules", "Health Supplements"),
  fatFixture(576, "Glucosamine 1,500mg with Vitamin C", "Health Supplements"),
  fatFixture(581, "Glucosamine, Chondroitin & Calcium", "Health Supplements"),
  fatFixture(584, "Quick Release Glucosamine 65 Plus", "Health Supplements"),
  fatFixture(585, "Children's Chewable Multivitamins Orange Flavour", "Vitamins"),
  fatFixture(586, "Multivitamin Gummies", "Vitamins"),
  fatFixture(590, "L-Choline", "Vitamins"),
  fatFixture(591, "Conjugated Linoleic Acid (CLA) Capsules", "Health Supplements"),
  fatFixture(596, "Super Zinc Plus", "Vitamins"),
  fatFixture(599, "Magnesium Bisglycinate 1500mg", "Vitamins"),
  fatFixture(601, "Psyllium Husk Capsules 2250mg", "Health Supplements"),
  fatFixture(602, "Glucomannan Fibre Capsules 3000mg", "Health Supplements"),
  fatFixture(604, "Magnesium Citrate Tablets 700mg", "Vitamins"),
  fatFixture(606, "Alpha Lipoic Acid (ALA) Capsules 750mg", "Health Supplements"),
  fatFixture(609, "Hair Care Max for Men", "Health Supplements"),
  fatFixture(610, "Liquid Omega 3", "Vitamins"),
  fatFixture(611, "Bone Health Multivitamin", "Vitamins"),
  fatFixture(612, "Mature Woman Multivitamin", "Vitamins"),
  fatFixture(613, "Multivitamins for Mature Men", "Vitamins"),
  fatFixture(615, "Anti-Fatigue Multivitamin", "Vitamins"),
  fatFixture(616, "Starflower Oil Capsules 1000mg", "Health Supplements"),
  fatFixture(618, "Vitamin D Tablets 400iu", "Vitamins"),
  fatFixture(622, "Vitamin D3 4000iu & Vitamin K2 100mcg", "Vitamins"),
  fatFixture(627, "Magnesium Tablets 200mg", "Health Supplements"),
  fatFixture(629, "Chewable Vitamin C Tablets 1,000mg Orange Flavour", "Vitamins"),
  fatFixture(632, "Vitamin C 1000mg with Rosehip 800mg", "Vitamins"),
  fatFixture(633, "Marine Collagen Powder with Vitamin C", "Health Supplements"),
  fatFixture(635, "A to Z Multivitamins & Minerals", "Health Supplements"),
  fatFixture(637, "Iron 14mg", "Health Supplements"),
  fatFixture(638, "Floradix Liquid Iron Formula", "Health Supplements"),
  fatFixture(648, "Soya Isoflavones", "Vitamins"),
  fatFixture(652, "Sea Kelp Capsules 4200mg", "Health Supplements"),
  fatFixture(653, "Apple Cider Vinegar Gummies", "Health Supplements"),
  fatFixture(655, "L-Taurine 1200mg", "Amino Acids"),
  fatFixture(658, "Garlic Capsules 10,000mg", "Health Supplements"),
  fatFixture(662, "Vitamin B6 Tablets 50mg", "Vitamins"),
  fatFixture(664, "Vitamin B12 Tablets 500mcg", "Vitamins"),
  fatFixture(666, "Acetyl L-Carnitine Capsules 500mg", "Amino Acids"),
  fatFixture(668, "30 Day Detox & Colon Cleanse Plus", "Health Supplements"),
  fatFixture(669, "Cranberry Tablets 5,000mg", "Health Supplements"),
  fatFixture(670, "ImmunoBoost Tablets with Black Garlic", "Health Supplements"),
  fatFixture(751, "Applied Nutrition Diet Whey Protein 1.8kg", "Whey Protein"),
  fatFixture(752, "Applied Nutrition Diet Whey Protein 1kg", "Whey Protein"),
  fatFixture(891, "Conteh Sports Pre Shred 90 Caps", "Health Supplements"),
  fatFixture(1020, "7Nutrition L-CARNITINE 1000 - 120 vege caps", "Amino Acids"),
  fatFixture(1084, "Waist Slimming Sweat Belt", "Accessories"),
  fatFixture(1105, "Trec Nutrition Clenburexin 180 Capsules", "Fat Burners"),
  fatFixture(1122, "Trec Nutrition MCT Gold Oil 400ml", "Health Supplements"),
  fatFixture(1139, "Trec Nutrition Clenburexin 90 Capsules", "Fat Burners"),
  fatFixture(1177, "Applied Nutrition L-Carnitine 3000 Liquid 480ml", "Weight Management"),
  fatFixture(1186, "EHP Labs OXYSHRED Creatine Gummies 450g", "Creatine"),
  fatFixture(1233, "PhD Nutrition Diet Whey 1kg", "Whey Protein"),
  fatFixture(1234, "PhD Nutrition Diet Whey 2kg", "Whey Protein"),
  fatFixture(1302, "EHP Labs OxyShred Ultra Energy Drink RTD 12 x 355ml", "Energy Drinks"),
  fatFixture(1305, "Animal Cuts Powder 248g/265g", "Fat Burners"),
  fatFixture(1311, "EHP Labs OxyShred 80 Gummies 400g", "Fat Burners"),
  fatFixture(1313, "HUEL Ready-to Drink 8x500ml", "Weight Management"),
  fatFixture(1314, "Huel Lite Ready-to-Drink 8 x 500ml", "Weight Management"),
  fatFixture(1357, "AK-47 Burner 60 Capsules", "Fat Burners"),
  fatFixture(1358, "TWP Diced V2 Stim Fat Burner 60 Capsules", "Fat Burners"),
  fatFixture(1372, "TWP LFT V2 Pre Workout", "Pre Workout"),
  fatFixture(1381, "TWP Nutrition Pre Raw Pre Workout", "Pre Workout"),
  fatFixture(1382, "NutriFitt Symbiote Extreme High-Stim Pre-Workout", "Pre Workout"),
  fatFixture(1383, "TWP Nutrition All The Weight Up Mass Gainer 5kg", "Mass Gainer"),
  fatFixture(1417, "EHP Labs OxyShred Ultra Energy Drink RTD 355ml", "Energy Drinks"),
  fatFixture(1419, "EHP Labs OxyShred Infinity Energy Drink 355ml", "Energy Drinks"),
  fatFixture(1430, "Rich Piana All Day You Shred 325g", "Fat Burners"),
];

const expectedFatIds = {
  INCLUDE_STRONG: [90, 93, 95, 100, 102, 103, 163, 239, 367, 497, 498, 501, 507, 508, 1105, 1139, 1305, 1311, 1357, 1358, 1430],
  EXCLUDE_STRONG: [52, 76, 77, 96, 97, 144, 151, 153, 177, 185, 388, 390, 405, 407, 424, 462, 476, 551, 562, 564, 566, 567, 570, 572, 575, 576, 581, 584, 585, 586, 590, 596, 599, 601, 604, 606, 609, 610, 611, 612, 613, 615, 616, 618, 622, 627, 629, 632, 633, 635, 637, 638, 648, 652, 653, 655, 658, 662, 664, 668, 669, 670, 751, 752, 1084, 1186, 1233, 1234, 1302, 1313, 1314, 1372, 1381, 1382, 1383, 1417, 1419],
  REVIEW_REQUIRED: [91, 94, 98, 99, 428, 504, 519, 522, 527, 591, 602, 666, 891, 1020, 1122, 1177],
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

  const fatSource = fs.readFileSync(
    path.join(process.cwd(), "app/fat-burners/page.tsx"),
    "utf8"
  );
  assert.match(fatSource, /getLandingProducts\(/);
  assert.match(fatSource, /CATEGORY_LANDING_PAGE_SIZE/);
  assert.match(fatSource, /createLifecycleDataLoader\(/);
  assert.match(fatSource, /fat-burners-category-v1/);
  assert.match(fatSource, /assertLifecycleDataAvailable\(/);
  assert.match(
    fatSource,
    /evaluateCategoryCoverage\(fatBurnersDefinition, product\)/
  );
  assert.match(fatSource, /"INCLUDE_STRONG"/);
  assert.match(fatSource, /<ProductResultCard key=\{product\.id\} product=\{product\}/);
});
