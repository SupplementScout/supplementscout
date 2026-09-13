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
    source_url: "https://manufacturer.example/products/pre-workout",
    source_file_sha256: "a".repeat(64),
    source_archive_uri: "supabase-storage://nutrition-sources/test-only/pre-workout/source.html",
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

test("applied pre-workout facts preserve retailer source provenance", () => {
  const override = {
    caffeine: {
      information_state: "present_with_amount",
      amount_per_serving_mg: 200,
      source_quantity_value: 200,
      source_quantity_unit: "mg",
      quantity_basis: "per_serving",
      serving_basis_value: 13,
      serving_basis_unit: "g",
      serving_basis_text: "1 serving (13 g)",
    },
  };
  const candidate = reviewedCandidate({
    proposed_field: "caffeine_per_serving_mg",
    proposed_value: 200,
    proposed_unit: "mg",
    approved_value: 200,
    information_state: "present_with_amount",
    source_quantity_value: 200,
    source_quantity_unit: "mg",
    quantity_basis: "per_serving",
    serving_basis_value: 13,
    serving_basis_unit: "g",
    serving_basis_text: "1 serving (13 g)",
    warning_flags: ["RETAILER_SOURCE"],
    source_locator: "html:retailer-product.html#active-table/caffeine",
    source_type: "retailer_product_page",
  });

  const result = resolveAppliedPreWorkoutFacts("411", "1047", override, [candidate]);
  assert.deepEqual(result.facts[0].sourceKinds, ["retailer_source"]);
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

test("applied citrulline components require one exact reviewed mixture context", () => {
  const serving = "1 slightly heaped scoop (approximately 17 g)";
  const candidate = (overrides) => reviewedCandidate({
    product_id: "1250",
    product_variant_id: "3672",
    proposed_field: "citrulline_component_per_serving_mg",
    proposed_value: 2500,
    proposed_unit: "mg",
    approved_value: 2500,
    information_state: "present_with_amount",
    source_quantity_value: 2.5,
    source_quantity_unit: "g",
    quantity_basis: "per_serving",
    serving_basis_value: 17,
    serving_basis_unit: "g",
    serving_basis_text: serving,
    ingredient_form: "citrulline_malate",
    ingredient_ratio: null,
    warning_flags: [],
    source_locator: "image:active-ingredients",
    source_url: "https://www.bulk.com/uk/products/dope-pre-workout/bble-dope",
    source_file_sha256: "b".repeat(64),
    source_archive_uri: "supabase-storage://nutrition-sources/test-only/bulk/dope.html",
    ...overrides,
  });
  const candidates = [
    candidate({}),
    candidate({
      proposed_value: 500,
      approved_value: 500,
      source_quantity_value: 500,
      source_quantity_unit: "mg",
      ingredient_form: "l_citrulline",
    }),
  ];
  const components = candidates.map((row) => ({
    information_state: "present_with_amount",
    amount_per_serving_mg: Number(row.approved_value),
    source_quantity_value: Number(row.source_quantity_value),
    source_quantity_unit: row.source_quantity_unit,
    quantity_basis: "per_serving",
    serving_basis_text: row.serving_basis_text,
    serving_basis_value: 17,
    serving_basis_unit: "g",
    ingredient_form: row.ingredient_form,
  }));
  const result = resolveAppliedPreWorkoutFacts("1250", "3672", {
    serving_size_g: 17,
    citrulline_components: components,
  }, candidates);
  assert.deepEqual(result.facts.map((fact) => [fact.key, fact.ingredientForm, fact.amountPerServingMg]), [
    ["citrulline_component", "citrulline_malate", 2500],
    ["citrulline_component", "l_citrulline", 500],
  ]);
  assert.equal(result.facts.every((fact) => fact.servingBasisText === serving), true);
  assert.equal(JSON.stringify(result).includes("supabase-storage"), false);

  assert.equal(resolveAppliedPreWorkoutFacts("1250", "3672", {
    citrulline_components: components,
  }, [candidates[0], { ...candidates[1], serving_basis_text: "1 scoop (18 g)" }]).facts.length, 0);
  assert.equal(resolveAppliedPreWorkoutFacts("1250", "3672", {
    citrulline_components: components,
  }, [candidates[0], { ...candidates[1], source_file_sha256: "c".repeat(64) }]).facts.length, 0);
  assert.equal(resolveAppliedPreWorkoutFacts("1250", "3672", {
    citrulline: components[0],
    citrulline_components: components,
  }, candidates).facts.length, 0);
});
