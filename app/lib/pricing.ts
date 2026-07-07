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
    return null;
  }

  return toFinitePrice(value, { allowZero: true });
}

export function getKnownProductPrice(value: number | string | null) {
  return toFinitePrice(value);
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

export function getVerifiedPricePerLitre(
  deliveredPrice: DeliveredPrice | null,
  netVolumeMl: number | string | null,
  productFormat: string | null,
  verified: boolean | null
) {
  if (verified !== true || deliveredPrice === null) {
    return null;
  }

  if (!Number.isFinite(deliveredPrice.totalPrice) || deliveredPrice.totalPrice <= 0) {
    return null;
  }

  if (netVolumeMl === null || netVolumeMl === "") {
    return null;
  }

  const volumeMl = Number(netVolumeMl);

  if (!Number.isFinite(volumeMl) || volumeMl <= 0) {
    return null;
  }

  if (productFormat !== "liquid") {
    return null;
  }

  const pricePerLitre = deliveredPrice.totalPrice / (volumeMl / 1000);

  return Number.isFinite(pricePerLitre) && pricePerLitre > 0
    ? pricePerLitre
    : null;
}

export function getVerifiedCostPer25gProtein(
  deliveredPrice: DeliveredPrice | null,
  servingCountVerified: number | string | null,
  proteinPerServingG: number | string | null,
  unitPricingVerified: boolean | null,
  nutritionVerified: boolean | null
) {
  if (
    unitPricingVerified !== true ||
    nutritionVerified !== true ||
    deliveredPrice === null
  ) {
    return null;
  }

  if (!Number.isFinite(deliveredPrice.totalPrice) || deliveredPrice.totalPrice <= 0) {
    return null;
  }

  if (
    servingCountVerified === null ||
    servingCountVerified === "" ||
    proteinPerServingG === null ||
    proteinPerServingG === ""
  ) {
    return null;
  }

  const servings = Number(servingCountVerified);
  const proteinPerServing = Number(proteinPerServingG);

  if (
    !Number.isFinite(servings) ||
    servings <= 0 ||
    !Number.isFinite(proteinPerServing) ||
    proteinPerServing <= 0
  ) {
    return null;
  }

  const totalPackageProtein = proteinPerServing * servings;

  if (!Number.isFinite(totalPackageProtein) || totalPackageProtein <= 0) {
    return null;
  }

  const costPer25gProtein = (deliveredPrice.totalPrice / totalPackageProtein) * 25;

  return Number.isFinite(costPer25gProtein) && costPer25gProtein > 0
    ? costPer25gProtein
    : null;
}

export function getVerifiedCostPer5gCreatine(
  deliveredPrice: DeliveredPrice | null,
  servingCountVerified: number | string | null,
  creatinePerServingG: number | string | null,
  unitPricingVerified: boolean | null,
  nutritionVerified: boolean | null
) {
  if (
    unitPricingVerified !== true ||
    nutritionVerified !== true ||
    deliveredPrice === null
  ) {
    return null;
  }

  if (!Number.isFinite(deliveredPrice.totalPrice) || deliveredPrice.totalPrice <= 0) {
    return null;
  }

  if (
    servingCountVerified === null ||
    servingCountVerified === "" ||
    creatinePerServingG === null ||
    creatinePerServingG === ""
  ) {
    return null;
  }

  const servings = Number(servingCountVerified);
  const creatinePerServing = Number(creatinePerServingG);

  if (
    !Number.isFinite(servings) ||
    !Number.isInteger(servings) ||
    servings <= 0 ||
    !Number.isFinite(creatinePerServing) ||
    creatinePerServing <= 0
  ) {
    return null;
  }

  const totalPackageCreatine = creatinePerServing * servings;

  if (!Number.isFinite(totalPackageCreatine) || totalPackageCreatine <= 0) {
    return null;
  }

  const costPer5gCreatine = (deliveredPrice.totalPrice / totalPackageCreatine) * 5;

  return Number.isFinite(costPer5gCreatine) && costPer5gCreatine > 0
    ? costPer5gCreatine
    : null;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}
