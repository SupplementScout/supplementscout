const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const authorityPath = path.join(root, "app", "lib", "proteinTaxonomy.ts");

function loadTypeScriptModule(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const authority = loadTypeScriptModule(authorityPath);
const eligibility = loadTypeScriptModule(path.join(root, "app", "lib", "proteinEligibility.ts"));
const fixtures = require("./fixtures/protein-taxonomy/audited-candidates");

function stateCounts(dimension) {
  const counts = { INCLUDE_STRONG: 0, REVIEW_REQUIRED: 0, EXCLUDE_STRONG: 0 };
  for (const candidate of fixtures.auditedCandidates) {
    counts[authority.evaluateProteinTaxonomy(candidate)[dimension].state] += 1;
  }
  return counts;
}

function namesInState(dimension, state) {
  return fixtures.auditedCandidates
    .filter((candidate) => authority.evaluateProteinTaxonomy(candidate)[dimension].state === state)
    .map((candidate) => candidate.name)
    .sort();
}

test("closed audited fixtures reproduce all seven semantic dimensions", () => {
  assert.equal(fixtures.auditedCandidates.length, 144);
  assert.deepEqual(stateCounts("whey"), {
    INCLUDE_STRONG: 101,
    REVIEW_REQUIRED: 5,
    EXCLUDE_STRONG: 38,
  });
  assert.deepEqual(stateCounts("isolate"), {
    INCLUDE_STRONG: 25,
    REVIEW_REQUIRED: 6,
    EXCLUDE_STRONG: 113,
  });
  assert.deepEqual(stateCounts("vegan"), {
    INCLUDE_STRONG: 15,
    REVIEW_REQUIRED: 0,
    EXCLUDE_STRONG: 129,
  });
  assert.deepEqual(stateCounts("casein"), {
    INCLUDE_STRONG: 10,
    REVIEW_REQUIRED: 0,
    EXCLUDE_STRONG: 134,
  });
  assert.deepEqual(stateCounts("beef"), {
    INCLUDE_STRONG: 8,
    REVIEW_REQUIRED: 0,
    EXCLUDE_STRONG: 136,
  });
  assert.deepEqual(stateCounts("egg"), {
    INCLUDE_STRONG: 1,
    REVIEW_REQUIRED: 0,
    EXCLUDE_STRONG: 143,
  });
  assert.deepEqual(stateCounts("umbrella"), {
    INCLUDE_STRONG: 138,
    REVIEW_REQUIRED: 5,
    EXCLUDE_STRONG: 1,
  });
});

test("audited strong and review identities match the closed evidence sets", () => {
  const expected = [
    ["whey", "INCLUDE_STRONG", fixtures.WHEY_STRONG_NAMES],
    ["whey", "REVIEW_REQUIRED", fixtures.WHEY_REVIEW_NAMES],
    ["isolate", "INCLUDE_STRONG", fixtures.ISOLATE_STRONG_NAMES],
    ["isolate", "REVIEW_REQUIRED", fixtures.ISOLATE_REVIEW_NAMES],
    ["vegan", "INCLUDE_STRONG", fixtures.VEGAN_STRONG_NAMES],
    ["casein", "INCLUDE_STRONG", fixtures.CASEIN_STRONG_NAMES],
    ["beef", "INCLUDE_STRONG", fixtures.BEEF_STRONG_NAMES],
    ["egg", "INCLUDE_STRONG", fixtures.EGG_STRONG_NAMES],
    ["umbrella", "REVIEW_REQUIRED", fixtures.UMBRELLA_REVIEW_NAMES],
  ];
  for (const [dimension, state, names] of expected) {
    assert.deepEqual(namesInState(dimension, state), [...names].sort(), `${dimension} ${state}`);
  }
});

test("compound Whey aliases are generic and avoid nearby non-Whey words", () => {
  for (const name of [
    "Example ShadoWhey Concentrate 1kg",
    "Example VelosiWhey 1kg",
    "Example UltraWhey+ 1kg",
  ]) {
    assert.equal(authority.evaluateProteinTaxonomy({ name, product_format: "powder" }).whey.state, "INCLUDE_STRONG", name);
  }
  for (const name of [
    "Example Heavyweight Protein 1kg",
    "Example Gateway Protein 1kg",
    "Example Wheaten Protein 1kg",
  ]) {
    assert.equal(authority.evaluateProteinTaxonomy({ name, product_format: "powder" }).whey.state, "EXCLUDE_STRONG", name);
  }
});

test("isolate evidence requires a Whey source and plain Clear Whey fails closed", () => {
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Example 100% Isolate 900g",
    description: "Made from whey protein isolate.",
  }).isolate.state, "INCLUDE_STRONG");
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Example Clear Whey 900g",
  }).isolate.state, "REVIEW_REQUIRED");
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Example Beef Protein Isolate 900g",
  }).isolate.state, "EXCLUDE_STRONG");
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Example Collagen ISO 900g",
  }).isolate.state, "EXCLUDE_STRONG");
});

test("Vegan source labels preserve the generic animal-conflict guard", () => {
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Example Vegan Protein 1kg",
    product_format: "powder",
  }).vegan.state, "INCLUDE_STRONG");
  const conflicted = authority.evaluateProteinTaxonomy({
    name: "Example Vegan Protein 1kg",
    product_format: "powder",
    sourceLabels: ["Retail feed label: Vegan Whey Protein"],
  }).vegan;
  assert.equal(conflicted.state, "EXCLUDE_STRONG");
  assert.ok(conflicted.reasonCodes.includes("ANIMAL_SOURCE_CONFLICT"));
});

test("active canonical eligibility remains separate from semantic membership", () => {
  const semantic = authority.evaluateProteinTaxonomy({ name: "Example Whey Protein 1kg" });
  assert.equal(semantic.whey.state, "INCLUDE_STRONG");
  assert.equal(eligibility.isProteinCandidateEligible({ is_active: false, merged_into_product_id: null, merged_at: null }), false);
  assert.equal(eligibility.isProteinCandidateEligible({ is_active: true, merged_into_product_id: 42, merged_at: null }), false);
  assert.equal(eligibility.isProteinCandidateEligible({ is_active: true, merged_into_product_id: null, merged_at: null }), true);
});

test("legacy reviewed Whey compatibility debt is exactly eight and cannot expand silently", () => {
  assert.deepEqual(authority.LEGACY_REVIEWED_WHEY_BLEND_NAMES, [
    "bsn syntha-6 edge 1.87kg",
    "grenade hydra 6 protein 1.8kg",
    "pescience select protein 1.8kg",
    "pescience select protein 905g",
    "rule1 r1 protein 2.2kg",
    "rule1 r1 protein 29 servings",
    "trained by jp performance protein 1kg",
    "trained by jp performance protein 2kg",
  ]);
  for (const name of authority.LEGACY_REVIEWED_WHEY_BLEND_NAMES) {
    const result = authority.evaluateProteinTaxonomy({ name, category: "Whey Protein", product_format: "powder" }).whey;
    assert.equal(result.state, "INCLUDE_STRONG", name);
    assert.ok(result.reasonCodes.includes("LEGACY_REVIEWED_WHEY_BLEND"), name);
  }
  assert.equal(authority.evaluateProteinTaxonomy({
    name: "Unreviewed Performance Protein 1kg",
    category: "Whey Protein",
    product_format: "powder",
  }).whey.state, "REVIEW_REQUIRED");
});

test("semantic authority is pure and no unapproved protein route exists", () => {
  const source = fs.readFileSync(authorityPath, "utf8");
  assert.doesNotMatch(source, /supabase|react|retailer|product[_ ]?id|\bslug\b|\bbrand\b/i);
  for (const route of ["protein-powder", "casein-protein", "beef-protein", "egg-protein", "clear-whey"]) {
    assert.equal(fs.existsSync(path.join(root, "app", route, "page.tsx")), false, route);
  }
});
