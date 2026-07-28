const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assessVariantCompatibility,
  normalizeFlavour,
  parseVariantIdentity,
  rowIdentityKey,
} = require("./feed-variant-guards");

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
