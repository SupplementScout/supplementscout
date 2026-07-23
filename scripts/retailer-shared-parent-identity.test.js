const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyReviewedCanonicalFeedCorrections,
} = require("./import-products");
const {
  attachSharedParentIdentityContracts,
  canonicalVariantSignature,
  sha256Canonical,
  validateSharedParentPeerCohort,
} = require("./lib/retailer-shared-parent-identity");
const {
  assessVariantCompatibility,
} = require("./lib/feed-variant-guards");

function plannedPeer(overrides = {}) {
  return {
    retailer_id: "3",
    external_product_id: "1",
    external_variant_id: "3",
    product_id: "7",
    product_variant_id: null,
    canonical_variant: {
      variant_key: "chocolate-2000g",
      display_name: "Chocolate / 2kg",
      flavour_code: "chocolate",
      flavour_label: "Chocolate",
      size_value: "2000",
      size_unit: "g",
      pack_count: "1",
      product_format: "powder",
    },
    external_sku: "SKU-3",
    external_gtin: "GTIN-3",
    external_options: { Flavour: "Chocolate" },
    external_url: "https://wheyokay.com/shared-parent.asp",
    legacy: false,
    ...overrides,
  };
}

test("shared-parent cohort accepts exact siblings and one compatible legacy peer", () => {
  const cohort = validateSharedParentPeerCohort([
    plannedPeer(),
    plannedPeer({
      external_variant_id: "4",
      external_sku: "SKU-4",
      external_gtin: "GTIN-4",
      external_options: { Flavour: "Vanilla" },
      canonical_variant: {
        ...plannedPeer().canonical_variant,
        variant_key: "vanilla-2000g",
        display_name: "Vanilla / 2kg",
        flavour_code: "vanilla",
        flavour_label: "Vanilla",
      },
    }),
    {
      retailer_id: "3",
      external_product_id: null,
      external_variant_id: null,
      product_id: "7",
      product_variant_id: "7",
      canonical_variant: null,
      external_sku: null,
      external_gtin: null,
      external_options: null,
      external_url: "https://wheyokay.com/shared-parent.asp",
      legacy: true,
    },
  ]);
  assert.equal(cohort.length, 3);
  assert.match(sha256Canonical(cohort), /^[0-9a-f]{64}$/);
});

test("shared-parent cohort blocks source, canonical, parent and legacy collisions", () => {
  const base = plannedPeer();
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      plannedPeer({ external_variant_id: "3", external_sku: "SKU-4" }),
    ]),
    /external variant ID collision/
  );
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      plannedPeer({ external_variant_id: "4", external_sku: "SKU-4" }),
    ]),
    /external GTIN collision/
  );
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      plannedPeer({
        external_variant_id: "4",
        external_sku: "SKU-4",
        external_gtin: "GTIN-4",
      }),
    ]),
    /canonical variant collision/
  );
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      plannedPeer({
        external_product_id: "2",
        external_variant_id: "4",
        external_sku: "SKU-4",
        external_gtin: "GTIN-4",
      }),
    ]),
    /external product ID drift/
  );
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      plannedPeer({
        product_id: "8",
        external_variant_id: "4",
        external_sku: "SKU-4",
        external_gtin: "GTIN-4",
      }),
    ]),
    /canonical product conflict/
  );
  assert.throws(
    () => validateSharedParentPeerCohort([
      base,
      {
        ...base,
        external_product_id: null,
        external_variant_id: null,
        product_variant_id: "7",
        canonical_variant: null,
        external_sku: null,
        external_gtin: null,
        external_options: null,
        legacy: true,
      },
      {
        ...base,
        external_product_id: null,
        external_variant_id: null,
        product_variant_id: "8",
        canonical_variant: null,
        external_sku: null,
        external_gtin: null,
        external_options: null,
        legacy: true,
      },
    ]),
    /multiple legacy/
  );
});

test("approved create-variant siblings receive one immutable full peer cohort", () => {
  const makeItem = (variantId, flavour) => ({
    mapping: null,
    sharedParentIdentityRequired: true,
    sharedParentUrlPeers: [],
    retailer: { id: 3 },
    product: { id: 7 },
    productVariant: {
      id: null,
      product_id: 7,
      planned_create: true,
      variant_key: `${flavour.toLowerCase()}-2000g`,
      display_name: `${flavour} / 2kg`,
      flavour_code: flavour.toLowerCase(),
      flavour_label: flavour,
      size_value: 2000,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
    },
    externalGtin: `GTIN-${variantId}`,
    row: {
      external_product_id: "1",
      external_variant_id: String(variantId),
      external_sku: `SKU-${variantId}`,
      external_options: JSON.stringify({ Flavour: flavour }),
      external_url: "https://wheyokay.com/shared-parent.asp",
    },
  });
  const items = [makeItem(3, "Chocolate"), makeItem(4, "Vanilla")];
  attachSharedParentIdentityContracts(items);
  for (const item of items) {
    const contract = item.sharedParentIdentityContract;
    assert.equal(contract.version, "1");
    assert.equal(contract.approved_url_peers.length, 2);
    assert.equal(
      contract.peer_set_fingerprint,
      sha256Canonical(contract.approved_url_peers)
    );
    assert.deepEqual(
      contract.incoming.canonical_variant,
      canonicalVariantSignature(item.productVariant)
    );
  }
  assert.equal(
    items[0].sharedParentIdentityContract.peer_set_fingerprint,
    items[1].sharedParentIdentityContract.peer_set_fingerprint
  );
});

test("NOCCO RTD correction is limited to the four evidence-backed EKM variants", () => {
  const base = {
    retailer_name: "Whey Okay",
    external_product_id: "1788",
    brand: "NOCCO",
    product_name: "Nocco BCAA Drink 330ml",
    size: "330",
    size_unit: "ml",
    description: "Carbonated Water. Pre and post workout drink.",
    product_format: "powder",
  };
  for (const external_variant_id of ["1790", "1791", "1792", "1796"]) {
    assert.equal(
      applyReviewedCanonicalFeedCorrections({
        ...base,
        external_variant_id,
      }).product_format,
      "liquid"
    );
  }
  assert.equal(
    applyReviewedCanonicalFeedCorrections({
      ...base,
      external_variant_id: "1793",
    }).product_format,
    "powder"
  );
  assert.equal(
    applyReviewedCanonicalFeedCorrections({
      ...base,
      external_product_id: "9999",
      external_variant_id: "1790",
    }).product_format,
    "powder"
  );
  assert.equal(
    applyReviewedCanonicalFeedCorrections({
      ...base,
      external_variant_id: "1790",
      product_format: "liquid",
    }).product_format,
    "liquid"
  );
});

test("reviewed Whey Okay format identities are closed to exact source keys and evidence", () => {
  const base = {
    retailer_name: "Whey Okay",
    external_product_id: "855",
    external_variant_id: "857",
    external_sku: "SKU-857",
    external_gtin: "GTIN-857",
    product_name: "Optimum Nutrition Protein Crisp Bar 10x65g",
    size: "65 g",
    size_unit: "g",
    product_format: "snack",
  };
  assert.equal(
    applyReviewedCanonicalFeedCorrections(base)
      .__reviewed_whey_okay_format_identity.contract,
    "whey-okay-format-groups-2026-07-23"
  );
  for (const changed of [
    { external_variant_id: "9999" },
    { product_format: "bar" },
    { size: "60 g" },
    { product_name: "Different product" },
    { retailer_name: "Different retailer" },
  ]) {
    assert.equal(
      applyReviewedCanonicalFeedCorrections({ ...base, ...changed })
        .__reviewed_whey_okay_format_identity,
      undefined
    );
  }
  assert.equal(
    applyReviewedCanonicalFeedCorrections({
      ...base,
      external_variant_id: "9999",
      __reviewed_whey_okay_format_identity: { contract: "untrusted" },
    }).__reviewed_whey_okay_format_identity,
    undefined
  );
});

test("reviewed Whey Okay format identity uses exact structured evidence only after canonical format is set", () => {
  const row = applyReviewedCanonicalFeedCorrections({
    retailer_name: "Whey Okay",
    external_product_id: "1952",
    external_variant_id: "1954",
    external_sku: "5999076253777",
    external_gtin: "5999076253777",
    product_name: "BioTech USA Black Blood NOX+ 330g",
    brand: "BioTech USA",
    flavour: "Blueberry-Lime",
    size: "330 g",
    size_unit: "g",
    pack_count: "1",
    product_format: "powder",
    description:
      "Serving size 9.5g. Mix two servings with water to make a ready-to-drink product.",
  });
  assert.deepEqual(
    assessVariantCompatibility(row, {
      name: "BioTech USA Black Blood NOX+ 330g",
      brand: "BioTech USA",
      product_format: "powder",
    }).reasons,
    []
  );
  assert.deepEqual(
    assessVariantCompatibility(row, {
      name: "BioTech USA Black Blood NOX+ 330g",
      brand: "BioTech USA",
      product_format: null,
    }).reasons,
    ["format conflict"]
  );

  const multipack = applyReviewedCanonicalFeedCorrections({
    retailer_name: "Whey Okay",
    external_product_id: "1005",
    external_variant_id: "1009",
    external_sku: "722252387486",
    external_gtin: "722252387486",
    product_name: "Clif Bar Energy Bar 12x68g",
    brand: "Clif Bar",
    flavour: "Chocolate Chip",
    size: "68 g",
    size_unit: "g",
    pack_count: "12",
    product_format: "snack",
  });
  assert.deepEqual(
    assessVariantCompatibility(multipack, {
      name: "Clif Bar Energy Bar 12x68g",
      brand: "Clif Bar",
      product_format: "snack",
    }).reasons,
    []
  );
});
