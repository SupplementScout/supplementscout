export type PriceInput = {
  price: number | string | null;
  shipping_cost: number | string | null;
};

export type DeliveredPrice = {
  productPrice: number;
  shippingCost: number;
  totalPrice: number;
};

const MASS_PRICED_PRODUCT_FORMATS = new Set(["powder", "food", "bar"]);

function toFinitePrice(value: number | string | null, options?: { allowZero: boolean }) {
  if (value === null || value === "") {
    return null;
  }

  const price = Number(value);
  const minimum = options?.allowZero ? 0 : 0.01;

  return Number.isFinite(price) && price >= minimum ? price : null;
}

function toShippingCost(value: number | string | null) {
  if (value === null || value === "") {
    return 0;
  }

  return toFinitePrice(value, { allowZero: true });
}

export function getDeliveredPrice(offer: PriceInput): DeliveredPrice | null {
  const productPrice = toFinitePrice(offer.price);

  if (productPrice === null) {
    return null;
  }

  const shippingCost = toShippingCost(offer.shipping_cost);

  if (shippingCost === null) {
    return null;
  }

  return {
    productPrice,
    shippingCost,
    totalPrice: productPrice + shippingCost,
  };
}

export function getVerifiedPricePerServing(
  deliveredPrice: DeliveredPrice | null,
  servingCount: number | string | null,
  verified: boolean | null
) {
  if (verified !== true || deliveredPrice === null) {
    return null;
  }

  if (servingCount === null || servingCount === "") {
    return null;
  }

  const servings = Number(servingCount);

  if (!Number.isFinite(servings) || !Number.isInteger(servings) || servings <= 0) {
    return null;
  }

  const pricePerServing = deliveredPrice.totalPrice / servings;

  return Number.isFinite(pricePerServing) && pricePerServing > 0
    ? pricePerServing
    : null;
}

export function getVerifiedPricePerKg(
  deliveredPrice: DeliveredPrice | null,
  netWeightG: number | string | null,
  productFormat: string | null,
  verified: boolean | null
) {
  if (verified !== true || deliveredPrice === null) {
    return null;
  }

  if (!Number.isFinite(deliveredPrice.totalPrice) || deliveredPrice.totalPrice <= 0) {
    return null;
  }

  if (netWeightG === null || netWeightG === "") {
    return null;
  }

  const weightG = Number(netWeightG);

  if (!Number.isFinite(weightG) || weightG <= 0) {
    return null;
  }

  if (!productFormat || !MASS_PRICED_PRODUCT_FORMATS.has(productFormat)) {
    return null;
  }

  const pricePerKg = deliveredPrice.totalPrice / (weightG / 1000);

  return Number.isFinite(pricePerKg) && pricePerKg > 0 ? pricePerKg : null;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}
