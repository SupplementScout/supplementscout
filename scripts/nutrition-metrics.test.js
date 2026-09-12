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
const { resolveAppliedPreWorkoutFacts } = loadModule(
  "app/lib/reviewedPreWorkoutFacts.ts"
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

test("pack mismatch keeps exact weight but fails closed for serving nutrition", () => {
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
  assert.equal(result.serving_count_verified, null);
  assert.equal(result.serving_size_g, null);
  assert.equal(result.protein_per_serving_g, null);
  assert.equal(result.nutrition_verified, false);
});

test("verified variant nutrition overrides product-level values", () => {
  const result = getEffectiveNutritionMetrics(product(), {
    size_value: 1800,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: {
      net_weight_g: 1800,
      serving_count_verified: 72,
      serving_size_g: 25,
      protein_per_serving_g: 22,
      product_format: "powder",
      unit_pricing_verified: true,
      nutrition_verified: true,
      source_type: "manufacturer_product_page",
      source_url: "https://manufacturer.example/product",
      evidence: "Manufacturer states 72 servings at 25 g per serving.",
    },
  });

  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, 72);
  assert.equal(result.serving_size_g, 25);
  assert.equal(result.protein_per_serving_g, 22);
  assert.equal(result.unit_pricing_verified, true);
  assert.equal(result.nutrition_verified, true);
});

test("incomplete approved override cannot reopen mismatched pack metrics", () => {
  const result = getEffectiveNutritionMetrics(product(), {
    size_value: 1800,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: {
      net_weight_g: 1800,
      serving_count_verified: 72,
      serving_size_g: 25,
      protein_per_serving_g: 22,
      unit_pricing_verified: true,
      nutrition_verified: true,
    },
  });

  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, null);
  assert.equal(result.protein_per_serving_g, null);
  assert.equal(result.nutrition_verified, false);
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

function reviewedCandidate(overrides = {}) {
  return {
    product_id: "411",
    product_variant_id: "1047",
    proposed_field: "caffeine_per_serving_mg",
    proposed_value: null,
    proposed_unit: null,
    approved_value: null,
    status: "approved",
    information_state: "confirmed_absent",
    source_quantity_value: null,
    source_quantity_unit: null,
    quantity_basis: null,
    serving_basis_value: null,
    serving_basis_unit: null,
    serving_basis_text: null,
    ingredient_form: null,
    ingredient_ratio: null,
    warning_flags: ["BRAND_OWNER_ATTESTATION_REQUIRES_REVIEW"],
    source_locator: "json:brand-owner-attestation:caffeine_absent",
    ...overrides,
  };
}

test("applied pre-workout facts require an exact approved candidate match", () => {
  const override = {
    serving_size_g: 17,
    caffeine: { information_state: "confirmed_absent" },
    beta_alanine: {
      information_state: "present_with_amount",
      amount_per_serving_mg: 3200,
      source_quantity_value: 3200,
      source_quantity_unit: "mg",
      quantity_basis: "per_serving",
      serving_basis_value: 17,
      serving_basis_unit: "g",
      serving_basis_text: "2 scoops (17 g)",
    },
    citrulline: {
      information_state: "present_with_amount",
      amount_per_serving_mg: 3000,
      source_quantity_value: 3000,
      source_quantity_unit: "mg",
      quantity_basis: "per_serving",
      serving_basis_value: 17,
      serving_basis_unit: "g",
      serving_basis_text: "2 scoops (17 g)",
      ingredient_form: "l_citrulline",
    },
    creatine: { information_state: "confirmed_absent" },
  };
  const candidates = [
    reviewedCandidate({ proposed_field: "serving_size_g", proposed_value: 17, proposed_unit: "g", approved_value: 17, information_state: null, warning_flags: [], source_locator: "image:nutrition-facts" }),
    reviewedCandidate(),
    reviewedCandidate({ proposed_field: "beta_alanine_per_serving_mg", proposed_value: 3200, proposed_unit: "mg", approved_value: 3200, information_state: "present_with_amount", source_quantity_value: 3200, source_quantity_unit: "mg", quantity_basis: "per_serving", serving_basis_value: 17, serving_basis_unit: "g", serving_basis_text: "2 scoops (17 g)", warning_flags: [], source_locator: "image:nutrition-facts" }),
    reviewedCandidate({ proposed_field: "citrulline_per_serving_mg", proposed_value: 3000, proposed_unit: "mg", approved_value: 3000, information_state: "present_with_amount", source_quantity_value: 3000, source_quantity_unit: "mg", quantity_basis: "per_serving", serving_basis_value: 17, serving_basis_unit: "g", serving_basis_text: "2 scoops (17 g)", ingredient_form: "l_citrulline", warning_flags: [], source_locator: "image:nutrition-facts" }),
    reviewedCandidate({ proposed_field: "creatine_declared_form_per_serving_mg", source_locator: "json:brand-owner-attestation:creatine_absent" }),
  ];

  const result = resolveAppliedPreWorkoutFacts("411", "1047", override, candidates);
  assert.equal(result.facts.length, 5);
  assert.equal(result.caffeineFreeConfirmed, true);
  assert.deepEqual(
    result.facts.find((fact) => fact.key === "caffeine").sourceKinds,
    ["brand_owner_statement"]
  );
  assert.equal(
    result.facts.find((fact) => fact.key === "citrulline").ingredientForm,
    "l_citrulline"
  );

  assert.equal(resolveAppliedPreWorkoutFacts("411", "1047", override, []).facts.length, 0);
  assert.equal(
    resolveAppliedPreWorkoutFacts("411", "1047", override, candidates.map((candidate) => ({ ...candidate, product_variant_id: "726" }))).facts.length,
    0
  );
  assert.equal(
    resolveAppliedPreWorkoutFacts("411", "1047", override, candidates.map((candidate) => ({ ...candidate, status: "pending" }))).facts.length,
    0
  );
});

test("applied facts fail closed on drift and malformed ingredient forms", () => {
  const candidate = reviewedCandidate({
    product_id: "38",
    product_variant_id: "726",
    proposed_field: "citrulline_per_serving_mg",
    proposed_value: 5000,
    proposed_unit: "mg",
    approved_value: 5000,
    information_state: "present_with_amount",
    source_quantity_value: 5,
    source_quantity_unit: "g",
    quantity_basis: "per_serving",
    serving_basis_value: 15,
    serving_basis_unit: "g",
    serving_basis_text: "2 Scoops (15 g)",
    ingredient_form: "citrulline_malate",
    ingredient_ratio: "2:1",
    warning_flags: [],
    source_locator: "image:nutrition-facts",
  });
  const applied = {
    citrulline: {
      information_state: "present_with_amount",
      amount_per_serving_mg: 5000,
      source_quantity_value: 5,
      source_quantity_unit: "g",
      quantity_basis: "per_serving",
      serving_basis_value: 15,
      serving_basis_unit: "g",
      serving_basis_text: "2 Scoops (15 g)",
      ingredient_form: "citrulline_malate",
      ingredient_ratio: "2:1",
    },
  };

  assert.equal(resolveAppliedPreWorkoutFacts("38", "726", applied, [candidate]).facts.length, 1);
  assert.equal(resolveAppliedPreWorkoutFacts("38", "726", { citrulline: { ...applied.citrulline, amount_per_serving_mg: 4000 } }, [candidate]).facts.length, 0);
  assert.equal(resolveAppliedPreWorkoutFacts("38", "726", applied, [{ ...candidate, ingredient_form: "unknown_form" }]).facts.length, 0);
});
