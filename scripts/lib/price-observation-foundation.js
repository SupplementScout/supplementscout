const crypto = require("node:crypto");
const { canonicalJson, normalizeDecimalString } = require("./canonical-json");

const IDENTITY_VERSION = 1;
const RECORDER_VERSION = 1;
const CURRENCY = "GBP";
const OBSERVATION_KINDS = Object.freeze([
  "offer_created",
  "delivered_price_changed",
  "daily_confirmation",
]);

const PRODUCER_CONTRACTS = Object.freeze([
  Object.freeze({ retailerId: "7", slug: "simply-supplements", source: "retailer_offer_mixed_batch", approvedScope: "approved-120", technicallyCapable: true, enabled: false, publicUse: "eligible-after-separate-approval", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "9", slug: "fit-house", source: "retailer_offer_mixed_batch", approvedScope: "approved-286", technicallyCapable: true, enabled: false, publicUse: "eligible-after-separate-approval", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "10", slug: "jon-s-supplements", source: "retailer_offer_mixed_batch", approvedScope: "reviewed-current-sync", technicallyCapable: true, enabled: false, publicUse: "eligible-after-separate-approval", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "3", slug: "whey-okay", source: "retailer_offer_mixed_batch", approvedScope: "approved-586-only", technicallyCapable: true, enabled: false, publicUse: "eligible-after-separate-approval", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "1", slug: "gym-high", source: "gym-high-reviewed-full-catalogue-v1", approvedScope: "reviewed-66", technicallyCapable: true, enabled: false, publicUse: "owner-deferred", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "11", slug: "6-pack-supplements", source: "retailer_offer_mixed_batch", approvedScope: "blocked-pending-mass-oos-review", technicallyCapable: false, enabled: false, publicUse: "blocked", termsMode: "standard-single-purchase-only" }),
  Object.freeze({ retailerId: "12", slug: "ebay-uk", source: "ebay-existing-offer-refresh-exact-237-v1", approvedScope: "blocked-pending-237-continuity", technicallyCapable: false, enabled: false, publicUse: "blocked", termsMode: "standard-single-purchase-only" }),
]);

function idString(value, label) {
  const text = typeof value === "bigint" ? value.toString() : String(value ?? "");
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} must be a positive integer ID`);
  return text;
}

function nullableText(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value);
}

function positiveDecimal(value, label) {
  let text;
  try { text = normalizeDecimalString(value, label); } catch { throw new Error(`${label} must be a positive decimal`); }
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) || Number(text) <= 0) {
    throw new Error(`${label} must be a positive decimal`);
  }
  return text;
}

function nonNegativeDecimal(value, label) {
  let text;
  try { text = normalizeDecimalString(value, label); } catch { throw new Error(`${label} must be a non-negative decimal`); }
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) || Number(text) < 0) {
    throw new Error(`${label} must be a non-negative decimal`);
  }
  return text;
}

function buildIdentityFingerprintInput(input) {
  const packCount = positiveDecimal(input.packCount, "packCount");
  const sizeValue = positiveDecimal(input.sizeValue, "sizeValue");
  const sizeUnit = nullableText(input.sizeUnit);
  if (!sizeUnit) throw new Error("sizeUnit is required");
  return {
    identity_version: IDENTITY_VERSION,
    offer_id: idString(input.offerId, "offerId"),
    retailer_id: idString(input.retailerId, "retailerId"),
    retailer_product_id: idString(input.retailerProductId, "retailerProductId"),
    product_id: idString(input.productId, "productId"),
    product_variant_id: idString(input.productVariantId, "productVariantId"),
    external_product_id: nullableText(input.externalProductId),
    external_variant_id: nullableText(input.externalVariantId),
    flavour: nullableText(input.flavour),
    size_value: sizeValue,
    size_unit: sizeUnit,
    pack_count: packCount,
    product_format: nullableText(input.productFormat),
    unit_count: input.unitCount == null ? null : idString(input.unitCount, "unitCount"),
    unit_type: nullableText(input.unitType),
    gtin: nullableText(input.gtin),
    retailer_source: nullableText(input.retailerSource),
    currency: CURRENCY,
  };
}

function identityFingerprint(input) {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(buildIdentityFingerprintInput(input)), "utf8")
    .digest("hex");
}

function validateObservationMoney({ price, shippingCost, totalPrice, currency = CURRENCY }) {
  if (currency !== CURRENCY) throw new Error("identity-proven observations require GBP");
  const product = positiveDecimal(price, "price");
  const shipping = nonNegativeDecimal(shippingCost, "shippingCost");
  const total = positiveDecimal(totalPrice, "totalPrice");
  if (Math.round((Number(product) + Number(shipping)) * 100) !== Math.round(Number(total) * 100)) {
    throw new Error("delivered total must equal product price plus shipping");
  }
  return { price: product, shippingCost: shipping, totalPrice: total, currency };
}

function estimateObservationVolume(offerCount, days) {
  if (!Number.isInteger(offerCount) || offerCount < 0 || !Number.isInteger(days) || days < 0) {
    throw new Error("offerCount and days must be non-negative integers");
  }
  return offerCount * days;
}

module.exports = {
  CURRENCY,
  IDENTITY_VERSION,
  OBSERVATION_KINDS,
  PRODUCER_CONTRACTS,
  RECORDER_VERSION,
  buildIdentityFingerprintInput,
  estimateObservationVolume,
  identityFingerprint,
  validateObservationMoney,
};
