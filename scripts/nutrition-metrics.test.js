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

const {
  getEffectiveNutritionMetrics,
  hasVariantAlignedReviewedNutrition,
} = loadModule(
  "app/lib/nutritionMetrics.ts"
);
const {
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerServing,
} = loadModule("app/lib/pricing.ts");
const { hasCompleteAppliedPreWorkoutFacts, resolveAppliedPreWorkoutFacts } = loadModule(
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

function reviewedAlignedOverride(overrides = {}) {
  return {
    serving_count_verified: 51,
    serving_size_g: 35,
    protein_per_serving_g: 26,
    nutrition_verified: true,
    ...overrides,
  };
}

function materiallyDifferentVariant(override = reviewedAlignedOverride()) {
  return {
    size_value: 1800,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: override,
  };
}

function assertMaterialMismatchFailsClosed(override) {
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270 }),
    materiallyDifferentVariant(override)
  );

  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, null);
  assert.equal(result.serving_size_g, null);
  assert.equal(result.protein_per_serving_g, null);
  assert.equal(result.creatine_per_serving_g, null);
  assert.equal(result.nutrition_verified, false);
  return result;
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

test("exact matching structural pack preserves existing product metrics", () => {
  assert.deepEqual(
    getEffectiveNutritionMetrics(product(), {
      size_value: 2000,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: {},
    }),
    product()
  );
});

test("rounding-equivalent pack preserves reviewed serving facts only", () => {
  const result = getEffectiveNutritionMetrics(
    product({
      net_weight_g: 2010,
      serving_count_verified: 67,
      serving_size_g: 30,
      protein_per_serving_g: 21,
    }),
    {
      size_value: 2000,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: {
        serving_count_verified: 67,
        serving_size_g: 30,
      },
    }
  );
  const deliveredPrice = {
    productPrice: 35,
    shippingCost: 0,
    totalPrice: 35,
  };

  assert.equal(result.net_weight_g, 2000);
  assert.equal(result.serving_count_verified, 67);
  assert.equal(result.serving_size_g, 30);
  assert.equal(result.protein_per_serving_g, null);
  assert.equal(result.nutrition_verified, false);
  assert.equal(result.unit_pricing_verified, false);
  assert.equal(
    getVerifiedPricePerServing(deliveredPrice, result.serving_count_verified),
    35 / 67
  );
  assert.equal(
    getVerifiedCostPer25gProtein(
      deliveredPrice,
      result.serving_count_verified,
      result.protein_per_serving_g,
      result.unit_pricing_verified,
      result.nutrition_verified,
      result.net_weight_g,
      result.serving_size_g,
      result.product_format
    ),
    null
  );
});

test("rounding-equivalent pack comparison is symmetric", () => {
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2000 }),
    {
      size_value: 2010,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: {
        serving_count_verified: 67,
        serving_size_g: 30,
      },
    }
  );

  assert.equal(result.net_weight_g, 2010);
  assert.equal(result.serving_count_verified, 67);
  assert.equal(result.serving_size_g, 30);
  assert.equal(result.protein_per_serving_g, null);
  assert.equal(result.nutrition_verified, false);
  assert.equal(result.unit_pricing_verified, false);
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

test("variant-aligned reviewed count and serving facts reopen only exact variant metrics", () => {
  const variant = {
    size_value: 1800,
    size_unit: "g",
    product_format: "powder",
    nutrition_override: {
      serving_count_verified: 60,
      serving_size_g: 30,
      protein_per_serving_g: 24,
      nutrition_verified: true,
    },
  };
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270 }),
    variant
  );

  assert.equal(hasVariantAlignedReviewedNutrition(variant, variant.nutrition_override), true);
  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, 60);
  assert.equal(result.serving_size_g, 30);
  assert.equal(result.protein_per_serving_g, 24);
  assert.equal(result.nutrition_verified, true);
  assert.equal(result.unit_pricing_verified, false);
});

test("derived nutrition pack within existing structural tolerance is runtime ready", () => {
  const variant = materiallyDifferentVariant();
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270 }),
    variant
  );
  const deliveredPrice = { productPrice: 36, shippingCost: 0, totalPrice: 36 };

  assert.equal(51 * 35, 1785);
  assert.equal(1800 - 51 * 35, 15);
  assert.equal(Math.max(1, 1800 * 0.01), 18);
  assert.equal(hasVariantAlignedReviewedNutrition(variant, variant.nutrition_override), true);
  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, 51);
  assert.equal(result.serving_size_g, 35);
  assert.equal(result.protein_per_serving_g, 26);
  assert.equal(result.nutrition_verified, true);
  assert.equal(result.unit_pricing_verified, false);
  assert.equal(getVerifiedPricePerServing(deliveredPrice, result.serving_count_verified), 36 / 51);
  assert.equal(
    getVerifiedCostPer25gProtein(
      deliveredPrice,
      result.serving_count_verified,
      result.protein_per_serving_g,
      result.unit_pricing_verified,
      result.nutrition_verified,
      result.net_weight_g,
      result.serving_size_g,
      result.product_format
    ),
    (36 / (51 * 26)) * 25
  );
});

test("variant-aligned path always uses the exact structural pack identity", () => {
  const variant = materiallyDifferentVariant(reviewedAlignedOverride({
    net_weight_g: 2270,
  }));
  const result = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270 }),
    variant
  );

  assert.equal(hasVariantAlignedReviewedNutrition(variant, variant.nutrition_override), true);
  assert.equal(result.net_weight_g, 1800);
  assert.equal(result.serving_count_verified, 51);
  assert.equal(result.protein_per_serving_g, 26);
});

test("material mismatch without a variant override remains fail closed", () => {
  assertMaterialMismatchFailsClosed({});
});

test("variant-aligned contract requires a serving count", () => {
  const override = reviewedAlignedOverride();
  delete override.serving_count_verified;
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract requires a serving size", () => {
  const override = reviewedAlignedOverride();
  delete override.serving_size_g;
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract requires explicit nutrition verification", () => {
  for (const nutritionVerified of [false, null, undefined]) {
    const override = reviewedAlignedOverride({ nutrition_verified: nutritionVerified });
    assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
    assertMaterialMismatchFailsClosed(override);
  }
});

test("variant-aligned contract requires an exact reviewed nutrient", () => {
  const override = reviewedAlignedOverride();
  delete override.protein_per_serving_g;
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract rejects an implied pack outside structural tolerance", () => {
  const override = reviewedAlignedOverride({ serving_size_g: 40 });
  assert.equal(51 * 40, 2040);
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract rejects protein exceeding the serving size", () => {
  const override = reviewedAlignedOverride({ protein_per_serving_g: 36 });
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract rejects creatine exceeding the serving size", () => {
  const override = reviewedAlignedOverride({
    protein_per_serving_g: 26,
    creatine_per_serving_g: 36,
  });
  assert.equal(hasVariantAlignedReviewedNutrition(materiallyDifferentVariant(override), override), false);
  assertMaterialMismatchFailsClosed(override);
});

test("variant-aligned contract requires an exact structural gram pack", () => {
  const override = reviewedAlignedOverride();
  assert.equal(hasVariantAlignedReviewedNutrition({ nutrition_override: override }, override), false);
  assert.equal(hasVariantAlignedReviewedNutrition({
    size_value: 1800,
    size_unit: "ml",
    nutrition_override: override,
  }, override), false);
});

test("material mismatch does not leak absent parent nutrition into the variant", () => {
  const proteinOnly = materiallyDifferentVariant(reviewedAlignedOverride());
  const proteinResult = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270, creatine_per_serving_g: 5 }),
    proteinOnly
  );
  assert.equal(proteinResult.protein_per_serving_g, 26);
  assert.equal(proteinResult.creatine_per_serving_g, null);

  const creatineOnlyOverride = reviewedAlignedOverride({
    creatine_per_serving_g: 5,
  });
  delete creatineOnlyOverride.protein_per_serving_g;
  const creatineOnly = materiallyDifferentVariant(creatineOnlyOverride);
  const creatineResult = getEffectiveNutritionMetrics(
    product({ net_weight_g: 2270, protein_per_serving_g: 24 }),
    creatineOnly
  );
  assert.equal(hasVariantAlignedReviewedNutrition(creatineOnly, creatineOnlyOverride), true);
  assert.equal(creatineResult.protein_per_serving_g, null);
  assert.equal(creatineResult.creatine_per_serving_g, 5);
  assert.equal(creatineResult.nutrition_verified, true);
});

test("numeric variant override fails closed without matching verification flags", () => {
  const result = assertMaterialMismatchFailsClosed({
    serving_count_verified: 60,
    serving_size_g: 30,
    protein_per_serving_g: 25,
  });

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

test("generic same-pack reviewed nutrition remains runtime ready", () => {
  const result = getEffectiveNutritionMetrics(
    product({
      net_weight_g: 1870,
      serving_count_verified: 48,
      serving_size_g: 39,
      protein_per_serving_g: 24,
    }),
    {
      size_value: 1870,
      size_unit: "g",
      product_format: "powder",
      nutrition_override: {
        serving_count_verified: 48,
        serving_size_g: 39,
        protein_per_serving_g: 24,
        nutrition_verified: true,
      },
    }
  );

  assert.equal(result.net_weight_g, 1870);
  assert.equal(result.serving_count_verified, 48);
  assert.equal(result.serving_size_g, 39);
  assert.equal(result.protein_per_serving_g, 24);
  assert.equal(result.nutrition_verified, true);
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
  assert.equal(hasCompleteAppliedPreWorkoutFacts(result), true);
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

test("applied pre-workout facts preserve a reviewed liquid serving in ml", () => {
  const override = {
    serving_size_ml: 40,
    caffeine: { information_state: "confirmed_absent" },
    beta_alanine: { information_state: "confirmed_absent" },
    citrulline: {
      information_state: "present_with_amount",
      amount_per_serving_mg: 5000,
      source_quantity_value: 5000,
      source_quantity_unit: "mg",
      quantity_basis: "per_serving",
      serving_basis_value: 40,
      serving_basis_unit: "ml",
      serving_basis_text: "1 serving (40 ml)",
      ingredient_form: "l_citrulline",
    },
    creatine: { information_state: "confirmed_absent" },
  };
  const candidates = [
    reviewedCandidate({ proposed_field: "serving_size_ml", proposed_value: 40, proposed_unit: "ml", approved_value: 40, information_state: null, warning_flags: [], source_locator: "image:supplement-facts" }),
    reviewedCandidate(),
    reviewedCandidate({ proposed_field: "beta_alanine_per_serving_mg", source_locator: "image:supplement-facts" }),
    reviewedCandidate({ proposed_field: "citrulline_per_serving_mg", proposed_value: 5000, proposed_unit: "mg", approved_value: 5000, information_state: "present_with_amount", source_quantity_value: 5000, source_quantity_unit: "mg", quantity_basis: "per_serving", serving_basis_value: 40, serving_basis_unit: "ml", serving_basis_text: "1 serving (40 ml)", ingredient_form: "l_citrulline", warning_flags: [], source_locator: "image:supplement-facts" }),
    reviewedCandidate({ proposed_field: "creatine_declared_form_per_serving_mg", source_locator: "image:supplement-facts" }),
  ];

  const result = resolveAppliedPreWorkoutFacts("411", "1047", override, candidates);
  assert.equal(result.facts.length, 5);
  assert.deepEqual(
    result.facts.find((fact) => fact.key === "serving_size_ml"),
    {
      key: "serving_size_ml",
      informationState: null,
      amountPerServingMg: null,
      servingSizeValue: 40,
      servingSizeUnit: "ml",
      servingBasisText: "1 serving (40 ml)",
      ingredientForm: null,
      ingredientRatio: null,
      sourceKinds: ["product_label"],
    }
  );
  assert.equal(result.facts.find((fact) => fact.key === "citrulline").servingSizeUnit, "ml");
  assert.equal(resolveAppliedPreWorkoutFacts("411", "1047", { ...override, serving_size_g: 40 }, [
    ...candidates,
    reviewedCandidate({ proposed_field: "serving_size_g", proposed_value: 40, proposed_unit: "g", approved_value: 40, information_state: null }),
  ]).facts.some((fact) => fact.key.startsWith("serving_size_")), false);
  assert.equal(hasCompleteAppliedPreWorkoutFacts(resolveAppliedPreWorkoutFacts(
    "411", "1047", { ...override, serving_size_g: 40 }, [
      ...candidates,
      reviewedCandidate({ proposed_field: "serving_size_g", proposed_value: 40, proposed_unit: "g", approved_value: 40, information_state: null }),
    ]
  )), false);
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

test("applied creatine components require exact approvals and remain separate declared masses", () => {
  const candidate = (form, value) => reviewedCandidate({
    product_id: "520", product_variant_id: "1025",
    proposed_field: "creatine_component_per_serving_mg",
    proposed_value: value, proposed_unit: "mg", approved_value: value,
    information_state: "present_with_amount", source_quantity_value: value,
    source_quantity_unit: "mg", quantity_basis: "per_serving",
    serving_basis_value: 6, serving_basis_unit: "g", serving_basis_text: "1 scoop (6 g)",
    ingredient_form: form, ingredient_ratio: null, warning_flags: [],
    source_locator: "html:active-ingredients", source_url: "https://olimpsport.ae/products/redweiler-480-g/",
    source_file_sha256: "d".repeat(64),
    source_archive_uri: "supabase-storage://nutrition-sources/test-only/olimp/redweiler.html",
  });
  const candidates = [candidate("creatine_monohydrate", 750), candidate("creatine_malate", 350)];
  const components = candidates.map((row) => ({
    information_state: "present_with_amount", amount_per_serving_mg: Number(row.approved_value),
    source_quantity_value: Number(row.source_quantity_value), source_quantity_unit: "mg",
    quantity_basis: "per_serving", serving_basis_text: "1 scoop (6 g)",
    serving_basis_value: 6, serving_basis_unit: "g", ingredient_form: row.ingredient_form,
    amount_subject: "declared_ingredient_form",
  }));
  const result = resolveAppliedPreWorkoutFacts("520", "1025", { creatine_components: components }, candidates);
  assert.deepEqual(result.facts.map((fact) => [fact.key, fact.ingredientForm, fact.amountPerServingMg]), [
    ["creatine_component", "creatine_monohydrate", 750],
    ["creatine_component", "creatine_malate", 350],
  ]);
  assert.equal(resolveAppliedPreWorkoutFacts("520", "1025", {
    creatine: components[0], creatine_components: components,
  }, candidates).facts.length, 0);
});
