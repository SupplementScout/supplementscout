export type OfferScalar = number | string | null;

export type ProductOfferVariant = {
  id: number | string;
  variant_key: string | null;
  display_name: string | null;
  flavour_label: string | null;
  size_value: OfferScalar;
  size_unit: string | null;
  is_default: boolean | null;
};

export type ProductOfferRetailer = {
  id: number | string;
  name: string | null;
  slug: string | null;
  website: string | null;
  logo: string | null;
};

export type ProductOffer = {
  id: number | string;
  retailer_id: number | string | null;
  product_variant_id: number | string;
  price: OfferScalar;
  shipping_cost: OfferScalar;
  total_price: OfferScalar;
  in_stock: boolean | null;
  url: string | null;
  last_checked_at: string | null;
  retailer: ProductOfferRetailer | null;
  product_variant: ProductOfferVariant | null;
  external_options: Record<string, unknown> | null;
};

export type ProductOfferGroup = {
  retailerKey: string;
  retailer: ProductOfferRetailer | null;
  offers: ProductOffer[];
  hasSharedPricing: boolean;
  lowestProductPrice: number | null;
  lowestDeliveredTotal: number | null;
};

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: OfferScalar, allowZero = false) {
  if (value === null || value === "") return null;

  const number = Number(value);
  const minimum = allowZero ? 0 : 0.01;

  return Number.isFinite(number) && number >= minimum ? number : null;
}

function optionValue(options: Record<string, unknown> | null, key: string) {
  if (!options) return "";

  const entry = Object.entries(options).find(
    ([optionKey]) => optionKey.trim().toLowerCase() === key
  );

  return trimmed(entry?.[1]);
}

function variantSize(variant: ProductOfferVariant | null) {
  if (!variant || variant.size_value === null || variant.size_value === "") {
    return "";
  }

  const unit = trimmed(variant.size_unit);

  return `${variant.size_value}${unit ? ` ${unit}` : ""}`;
}

function offerSizeLabel(offer: ProductOffer) {
  return variantSize(offer.product_variant) ||
    optionValue(offer.external_options, "size");
}

export function getOfferVariantLabel(offer: ProductOffer) {
  const variant = offer.product_variant;

  if (variant?.is_default === true) return null;

  const displayName = trimmed(variant?.display_name);
  if (displayName && displayName.toLowerCase() !== "default") {
    return displayName;
  }

  const flavour = trimmed(variant?.flavour_label);
  const size = variantSize(variant);
  if (flavour || size) return [flavour, size].filter(Boolean).join(" / ");

  const optionFlavour = optionValue(offer.external_options, "flavour");
  const optionSize = optionValue(offer.external_options, "size");
  const optionLabel = [optionFlavour, optionSize].filter(Boolean).join(" / ");

  return optionLabel || null;
}

export function getOfferDeliveredTotal(offer: ProductOffer) {
  const productPrice = finiteNumber(offer.price);
  const shipping = finiteNumber(offer.shipping_cost, true);

  return productPrice === null || shipping === null
    ? null
    : productPrice + shipping;
}

function compareOffers(left: ProductOffer, right: ProductOffer) {
  const deliveredLeft = getOfferDeliveredTotal(left) ?? Number.POSITIVE_INFINITY;
  const deliveredRight = getOfferDeliveredTotal(right) ?? Number.POSITIVE_INFINITY;
  const labelLeft = getOfferVariantLabel(left) || "";
  const labelRight = getOfferVariantLabel(right) || "";

  return deliveredLeft - deliveredRight ||
    labelLeft.localeCompare(labelRight, "en", { sensitivity: "base" }) ||
    String(left.id).localeCompare(String(right.id));
}

function normalizedLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function duplicateLabelIndexes(labels: string[]) {
  const buckets = new Map<string, number[]>();

  labels.forEach((label, index) => {
    const key = normalizedLabel(label);
    const indexes = buckets.get(key) || [];
    indexes.push(index);
    buckets.set(key, indexes);
  });

  return Array.from(buckets.values()).filter((indexes) => indexes.length > 1);
}

function includesLabelPart(label: string, part: string) {
  return normalizedLabel(label).includes(normalizedLabel(part));
}

function moneyLabel(value: number) {
  return `£${value.toFixed(2)}`;
}

export function getGroupOfferDisplayLabels(offers: ProductOffer[]) {
  const sortedOffers = [...offers].sort(compareOffers);
  const labels = sortedOffers.map(
    (offer, index) => getOfferVariantLabel(offer) || `Option ${index + 1}`
  );

  for (const indexes of duplicateLabelIndexes(labels)) {
    const sizes = indexes.map((index) => offerSizeLabel(sortedOffers[index]));
    const distinctSizes = new Set(sizes.filter(Boolean).map(normalizedLabel));

    if (distinctSizes.size > 1) {
      indexes.forEach((index, duplicateIndex) => {
        const size = sizes[duplicateIndex];
        if (size && !includesLabelPart(labels[index], size)) {
          labels[index] = `${labels[index]} · ${size}`;
        }
      });
    }
  }

  for (const indexes of duplicateLabelIndexes(labels)) {
    const prices = indexes.map((index) => finiteNumber(sortedOffers[index].price));
    const distinctPrices = new Set(prices.filter((price): price is number => price !== null));
    const deliveredTotals = indexes.map((index) => getOfferDeliveredTotal(sortedOffers[index]));
    const distinctDeliveredTotals = new Set(
      deliveredTotals.filter((total): total is number => total !== null)
    );

    if (distinctPrices.size > 1) {
      indexes.forEach((index, duplicateIndex) => {
        const price = prices[duplicateIndex];
        if (price !== null) labels[index] = `${labels[index]} · ${moneyLabel(price)}`;
      });
    } else if (distinctDeliveredTotals.size > 1) {
      indexes.forEach((index, duplicateIndex) => {
        const total = deliveredTotals[duplicateIndex];
        if (total !== null) labels[index] = `${labels[index]} · ${moneyLabel(total)} delivered`;
      });
    }
  }

  for (const indexes of duplicateLabelIndexes(labels)) {
    indexes.forEach((index, duplicateIndex) => {
      labels[index] = `${labels[index]} · Option ${duplicateIndex + 1}`;
    });
  }

  return new Map(
    sortedOffers.map((offer, index) => [String(offer.id), labels[index]])
  );
}

export function getBestProductOffer(offers: ProductOffer[]) {
  return [...offers]
    .filter((offer) => offer.in_stock === true)
    .sort((left, right) => {
      const deliveredLeft = getOfferDeliveredTotal(left) ?? Number.POSITIVE_INFINITY;
      const deliveredRight = getOfferDeliveredTotal(right) ?? Number.POSITIVE_INFINITY;
      const priceLeft = finiteNumber(left.price) ?? Number.POSITIVE_INFINITY;
      const priceRight = finiteNumber(right.price) ?? Number.POSITIVE_INFINITY;

      return deliveredLeft - deliveredRight ||
        priceLeft - priceRight ||
        String(left.id).localeCompare(String(right.id));
    })[0] || null;
}

function pricingIdentity(offer: ProductOffer) {
  const numberOrNull = (value: OfferScalar, allowZero = false) => {
    const number = finiteNumber(value, allowZero);
    return number === null ? null : number;
  };

  return JSON.stringify([
    numberOrNull(offer.price),
    numberOrNull(offer.shipping_cost, true),
    numberOrNull(offer.total_price),
  ]);
}

export function groupProductOffers(offers: ProductOffer[]) {
  const groups = new Map<string, ProductOffer[]>();

  for (const offer of offers) {
    if (offer.in_stock !== true) continue;

    const retailerIdentity = offer.retailer?.id ?? offer.retailer_id;
    const retailerKey = retailerIdentity === null || retailerIdentity === undefined ||
      String(retailerIdentity).trim() === ""
      ? `missing-retailer:${String(offer.id)}`
      : String(retailerIdentity);
    const group = groups.get(retailerKey) || [];
    group.push(offer);
    groups.set(retailerKey, group);
  }

  return Array.from(groups, ([retailerKey, retailerOffers]) => {
    const sortedOffers = [...retailerOffers].sort(compareOffers);
    const productPrices = sortedOffers
      .map((offer) => finiteNumber(offer.price))
      .filter((price): price is number => price !== null);
    const deliveredTotals = sortedOffers
      .map(getOfferDeliveredTotal)
      .filter((total): total is number => total !== null);

    return {
      retailerKey,
      retailer: sortedOffers[0]?.retailer || null,
      offers: sortedOffers,
      hasSharedPricing:
        new Set(sortedOffers.map(pricingIdentity)).size === 1,
      lowestProductPrice:
        productPrices.length > 0 ? Math.min(...productPrices) : null,
      lowestDeliveredTotal:
        deliveredTotals.length > 0 ? Math.min(...deliveredTotals) : null,
    } satisfies ProductOfferGroup;
  }).sort(
    (left, right) =>
      (left.lowestDeliveredTotal ?? Number.POSITIVE_INFINITY) -
        (right.lowestDeliveredTotal ?? Number.POSITIVE_INFINITY) ||
      (left.retailer?.name || left.retailerKey).localeCompare(
        right.retailer?.name || right.retailerKey,
        "en",
        { sensitivity: "base" }
      ) ||
      left.retailerKey.localeCompare(right.retailerKey)
  );
}

export function selectGroupOffer(group: ProductOfferGroup, offerId?: string | null) {
  return group.offers.find((offer) => String(offer.id) === offerId) ||
    group.offers[0] ||
    null;
}

export function productOfferHref(
  offerId: number | string,
  source: "product_best_offer" | "product_offer_list"
) {
  return `/go/${String(offerId)}?source=${source}`;
}
