const assert = require("node:assert/strict");
const test = require("node:test");

const {
  cataloguePolicyDecision,
  assertCataloguePolicyAllowsRecords,
  assessVariantCompatibility,
  normalizeFlavour,
  parseVariantIdentity,
  rowIdentityKey,
} = require("./feed-variant-guards");

test("owner melatonin exclusion covers every dose and has no reviewed 1mg exception", () => {
  for (const name of ["7Nutrition Melatonin 1mg 60 Capsules", "Soma Melatonin 4 mg", "Melatonin 0.3mg",
    "Melatonin 5mg Gummies", "Melatonin Sleep Blend", "Melatonina 1 mg",
    "Melatonin 1mg with melatonin-free herbs"]) {
    const row = { product_name: name, __reviewed_catalogue_identity: { approved: true } };
    assert.equal(cataloguePolicyDecision(row).state, "EXCLUDE");
    assert.equal(cataloguePolicyDecision(row).code, "EXCLUDE_MELATONIN");
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Melatonin 1mg", external_name: "Melatonin-free alias" }).state, "EXCLUDE");
});

test("owner policy excludes named research compounds without excluding ordinary nutrition peptides", () => {
  for (const name of ["SARMs", "Selective Androgen Receptor Modulators", "Research Peptides", "Pharmacological Peptide",
    "Ostarine MK-2866", "RAD-140", "BPC-157", "TB-500", "Selank", "Semax"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }).state, "EXCLUDE", name);
  }
  for (const name of ["Collagen Peptides", "CNP Peptide Whey Protein Blend", "L-Theanine 200mg", "Creatine 300g",
    "L-Tryptophan", "Pharma Grade EAA", "Ashwagandha", "Generic Nootropic", "Pre Workout 30 Servings", "Melatonin-free Sleep Blend"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }), null, name);
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Peptide complex" }).state, "DEFER");
  assert.equal(cataloguePolicyDecision({ product_name: "L-Tryptophan", description: "Supports endogenous melatonin production" }).state, "DEFER");
  assert.equal(cataloguePolicyDecision({ product_name: "Other title", evidence_name: "BPC-157" }).state, "EXCLUDE");
  assert.equal(cataloguePolicyDecision({ product_name: "Other title", evidence_format: "BPC-157" }).state, "DEFER");
});

test("existing Limitless owner DEFER survives spelling and canonical-title differences", () => {
  for (const name of ["Ultra Nutrio Limitless Nootropic 100 Capsules", "Limitlesss Nootropic Brain Booster 100 caps - Ultra Nutrio"]) {
    assert.equal(cataloguePolicyDecision({ product_name: name }).code, "DEFER_OWNER_NAMED_PRODUCT");
  }
  assert.equal(cataloguePolicyDecision({ product_name: "Ordinary Nootropic 100 Capsules" }), null);
});

test("revoked scope fails closed using names, aliases and variants without mutating or shrinking authority", () => {
  const records = [
    { product: { id: "random", name: "Melatonin 1mg" }, mapping: { id: "m1", external_name: "Other alias" }, offer: { id: "o1" } },
    { product: { id: "another", name: "Other canonical" }, mapping: { id: "m2", external_name: "Melatonin 4mg" }, offer: { id: "o2" } },
    { product: { id: "third", name: "Sleep Blend" }, variant: { display_name: "with Melatonin" }, mapping: { id: "m3" }, offer: { id: "o3" } },
    { product: { name: "Ultra Nutrio Limitless Nootropic" }, mapping: { id: "m4" }, offer: { id: "o4" } },
  ];
  const before = structuredClone(records);
  assert.throws(() => assertCataloguePolicyAllowsRecords(records), error => {
    assert.equal(error.code, "CATALOGUE_POLICY_SCOPE_BLOCKED");
    assert.equal(error.detail.blocked_records.length, 4);
    assert.equal(error.detail.automatic_scope_reduction, false);
    return true;
  });
  assert.deepEqual(records, before);
  assert.doesNotThrow(() => assertCataloguePolicyAllowsRecords([{ product: { name: "Collagen Peptides" } }]));
});

test("existing commercial and freshness plan entrypoints cannot recreate excluded or deferred authority", () => {
  const { buildExistingOfferUpdatePlan } = require("./retailer-offer-sync/existing-offer-plan");
  const { buildVerifiedNoChangePlan } = require("../verified-no-change-offer-refresh");
  for (const name of ["Melatonin 1mg", "BPC-157", "Ultra Nutrio Limitless Nootropic 100 Capsules"]) {
    const state = { product: { name }, mapping: { id: "any" }, offer: { id: "any" }, variant: { id: "any" } };
    assert.throws(() => buildExistingOfferUpdatePlan(state), error => error.code === "CATALOGUE_POLICY_SCOPE_BLOCKED");
    assert.throws(() => buildVerifiedNoChangePlan({ target: { product: state.product,
      retailer_product: state.mapping, product_variant: state.variant, offer: state.offer } }),
    error => error.code === "CATALOGUE_POLICY_SCOPE_BLOCKED");
  }
});

test("reviewed shaker identity remains an accessory despite ml capacity", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "BioTech USA Wave Shaker 600ml",
      brand: "BioTech USA",
      size: "600",
      size_unit: "ml",
      flavour: "Blue",
      product_format: "accessory",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2364",
        size_value: "600",
        size_unit: "ml",
        product_format: "accessory",
      },
    },
    {
      name: "BioTech USA Wave Shaker 600ml",
      brand: "BioTech USA",
      product_format: null,
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack resin is a valid exact product format", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Good Guru Gold Shilajit Resin 30g",
      brand: "Good Guru",
      size: "30",
      size_unit: "g",
      product_format: "resin",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2379",
        size_value: "30",
        size_unit: "g",
        pack_count: "1",
        product_format: "resin",
      },
    },
    {
      name: "Good Guru Gold Shilajit Resin 30g",
      brand: "Good Guru",
      product_format: "resin",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack variant identity overrides pack wording in the product title", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Animal Pak 44 Packs",
      brand: "Animal",
      product_format: "pack",
      pack_count: "1",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2395",
        size_value: null,
        size_unit: null,
        pack_count: "1",
        product_format: "pack",
      },
    },
    {
      name: "Animal Pak 44 Packs",
      brand: "Animal",
      product_format: "pack",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("reviewed Six Pack multi-pack compares canonical size per unit", () => {
  const result = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition High Protein Shake 500ml",
      brand: "Applied Nutrition",
      size: "500 ml",
      product_format: "ready-to-drink",
      pack_count: "8",
      __reviewed_six_pack_family_identity: {
        canonical_product_variant_id: "2459",
        size_value: "500",
        size_unit: "ml",
        product_format: "ready-to-drink",
      },
    },
    {
      name: "Applied Nutrition High Protein Shake 500ml",
      brand: "Applied Nutrition",
      product_format: "ready-to-drink",
    }
  );
  assert.equal(result.compatible, true);
  assert.deepEqual(result.reasons, []);
});

test("gummies and sachets are explicit catalogue formats", () => {
  assert.equal(parseVariantIdentity({ product_format: "gummy" }).productFormat, "gummy");
  assert.equal(parseVariantIdentity({ product_format: "sachet" }).productFormat, "sachet");
});

test("explicit multi-word flavours keep their complete normalized identity", () => {
  const flavours = [
    "Fruit Burst",
    "Fruit Fusion",
    "Fruit Punch",
    "Fruit Salad",
    "Blue Raspberry",
    "Icy Blue Razz",
    "Cola Millions",
    "Pineapple Millions",
  ];

  assert.deepEqual(flavours.map(normalizeFlavour), [
    "fruit burst",
    "fruit fusion",
    "fruit punch",
    "fruit salad",
    "blue raspberry",
    "icy blue razz",
    "cola millions",
    "pineapple millions",
  ]);
  assert.equal(new Set(flavours.map(normalizeFlavour)).size, flavours.length);
});

test("external_options flavour takes priority in parsed variant identity", () => {
  const identity = parseVariantIdentity({
    product_name: "Applied Nutrition Pump Pre Workout 375g",
    external_options: JSON.stringify({ Size: "375g", Flavour: "Rainbow Unicorn" }),
    product_format: "powder",
  });

  assert.equal(identity.flavour, "rainbow unicorn");
  assert.equal(identity.size.value, "375");
  assert.equal(identity.size.unit, "g");
});

test("exact canonical variant size overrides an ambiguous numeric product title", () => {
  const product = {
    name: "Applied Nutrition Pump 3G Pre-Workout 375g",
    brand: "Applied Nutrition",
    product_format: "powder",
  };
  const canonicalVariant = {
    size_value: "375",
    size_unit: "g",
    pack_count: 1,
    product_format: "powder",
    is_active: true,
    is_default: false,
  };

  const compatible = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition Pump Pre Workout 375g",
      brand: "Applied Nutrition",
      size: "375 g",
      size_unit: "g",
      product_format: "powder",
      pack_count: "1",
    },
    product,
    canonicalVariant
  );
  assert.equal(compatible.compatible, true);
  assert.deepEqual(compatible.reasons, []);

  const wrongSize = assessVariantCompatibility(
    {
      product_name: "Applied Nutrition Pump Pre Workout 400g",
      brand: "Applied Nutrition",
      size: "400 g",
      size_unit: "g",
      product_format: "powder",
      pack_count: "1",
    },
    product,
    canonicalVariant
  );
  assert.equal(wrongSize.compatible, false);
  assert.ok(wrongSize.reasons.includes("size conflict"));
});

test("variant row identity is retailer-scoped and uses external_variant_id", () => {
  const base = {
    retailer_name: "Discount Supplements",
    retailer_website: "https://www.discount-supplements.co.uk",
    product_name: "Applied Nutrition Amino Fuel EAA 390g",
  };
  const fruitBurst = rowIdentityKey({
    ...base,
    external_variant_id: "variant-fruit-burst",
    flavour: "Fruit Burst",
  });
  const fruitSalad = rowIdentityKey({
    ...base,
    external_variant_id: "variant-fruit-salad",
    flavour: "Fruit Salad",
  });

  assert.notEqual(fruitBurst, fruitSalad);
  assert.match(fruitBurst, /external-variant\|discount supplements\|/);
  assert.match(fruitBurst, /\|variant-fruit-burst$/);
});
