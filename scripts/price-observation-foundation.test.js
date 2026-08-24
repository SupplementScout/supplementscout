const assert = require("node:assert/strict");
const test = require("node:test");
const {
  OBSERVATION_KINDS,
  PRODUCER_CONTRACTS,
  buildIdentityFingerprintInput,
  estimateObservationVolume,
  identityFingerprint,
  validateObservationMoney,
} = require("./lib/price-observation-foundation");

function identity(overrides = {}) {
  return {
    offerId: "9007199254740993",
    retailerId: "7",
    retailerProductId: "9007199254740995",
    productId: "9007199254740997",
    productVariantId: "9007199254740999",
    externalProductId: "shop-100",
    externalVariantId: "variant-200",
    flavour: "Chocolate",
    sizeValue: "1000",
    sizeUnit: "g",
    packCount: "1",
    productFormat: "powder",
    unitCount: null,
    unitType: null,
    gtin: "05000000000001",
    retailerSource: "simply-supplements",
    ...overrides,
  };
}

test("identity fingerprint is deterministic, canonical and bigint-safe", () => {
  const first = identityFingerprint(identity());
  const reordered = identityFingerprint({
    productVariantId: "9007199254740999",
    offerId: 9007199254740993n,
    retailerProductId: 9007199254740995n,
    retailerId: 7n,
    productId: 9007199254740997n,
    externalVariantId: "variant-200",
    externalProductId: "shop-100",
    packCount: "1.0",
    sizeUnit: "g",
    sizeValue: "1000.0",
    flavour: "Chocolate",
    productFormat: "powder",
    gtin: "05000000000001",
    retailerSource: "simply-supplements",
  });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, reordered);
  assert.equal(buildIdentityFingerprintInput(identity()).offer_id, "9007199254740993");
});

test("critical identity, variant and pack changes start a new series", () => {
  const baseline = identityFingerprint(identity());
  for (const changed of [
    { offerId: "9007199254741001" },
    { productVariantId: "9007199254741003" },
    { retailerProductId: "9007199254741005" },
    { externalVariantId: "variant-201" },
    { sizeValue: "908" },
    { sizeUnit: "ml" },
    { packCount: "2" },
    { unitCount: "12", unitType: "bar" },
  ]) assert.notEqual(identityFingerprint(identity(changed)), baseline);
});

test("money and currency evidence fail closed", () => {
  assert.deepEqual(validateObservationMoney({ price: "20.00", shippingCost: "3.99", totalPrice: "23.99" }), {
    price: "20", shippingCost: "3.99", totalPrice: "23.99", currency: "GBP",
  });
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: null, totalPrice: "20" }), /shippingCost/);
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: "0", totalPrice: "19.99" }), /delivered total/);
  assert.throws(() => validateObservationMoney({ price: "20", shippingCost: "0", totalPrice: "20", currency: "EUR" }), /GBP/);
  assert.throws(() => validateObservationMoney({ price: "NaN", shippingCost: "0", totalPrice: "20" }), /price/);
});

test("producer contracts are disabled by default and retain reviewed boundaries", () => {
  assert.deepEqual(OBSERVATION_KINDS, ["offer_created", "delivered_price_changed", "daily_confirmation"]);
  assert.equal(PRODUCER_CONTRACTS.every((contract) => contract.enabled === false), true);
  assert.equal(PRODUCER_CONTRACTS.every((contract) => contract.termsMode === "standard-single-purchase-only"), true);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "gym-high").publicUse, "owner-deferred");
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "6-pack-supplements").technicallyCapable, false);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "ebay-uk").technicallyCapable, false);
  assert.equal(PRODUCER_CONTRACTS.find((contract) => contract.slug === "whey-okay").approvedScope, "approved-586-only");
});

test("daily volume estimates are bounded by one confirmation per offer", () => {
  assert.equal(estimateObservationVolume(2761, 30), 82_830);
  assert.equal(estimateObservationVolume(1564, 30), 46_920);
  assert.equal(estimateObservationVolume(1498, 365), 546_770);
  assert.equal(estimateObservationVolume(2761, 365), 1_007_765);
  assert.throws(() => estimateObservationVolume(1.5, 30), /integers/);
});
