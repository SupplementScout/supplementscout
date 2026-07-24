import {
  formatCurrency,
  getDeliveredPrice,
  getKnownProductPrice,
  type PriceInput,
} from "./pricing";

export type BestOfferPricePresentation = {
  label: "Best delivered price" | "Lowest product price" | "Price unavailable";
  primaryPrice: string;
  breakdown: string;
};

export function buildBestOfferPricePresentation(
  offer: PriceInput
): BestOfferPricePresentation {
  const deliveredPrice = getDeliveredPrice(offer);

  if (deliveredPrice) {
    return {
      label: "Best delivered price",
      primaryPrice: formatCurrency(deliveredPrice.totalPrice),
      breakdown:
        deliveredPrice.shippingCost === 0
          ? `${formatCurrency(deliveredPrice.productPrice)} product + free delivery`
          : `${formatCurrency(deliveredPrice.productPrice)} product + ${formatCurrency(deliveredPrice.shippingCost)} delivery`,
    };
  }

  const productPrice = getKnownProductPrice(offer.price);

  if (productPrice !== null) {
    return {
      label: "Lowest product price",
      primaryPrice: formatCurrency(productPrice),
      breakdown: `${formatCurrency(productPrice)} product + delivery cost unknown`,
    };
  }

  return {
    label: "Price unavailable",
    primaryPrice: "Price unavailable",
    breakdown: "Product price and delivery cost unavailable",
  };
}

export function formatOfferCheckedDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function calculateDeliveredSavings(
  bestDeliveredTotal: number | null,
  nextDeliveredTotal: number | null
) {
  if (
    bestDeliveredTotal === null ||
    nextDeliveredTotal === null ||
    !Number.isFinite(bestDeliveredTotal) ||
    !Number.isFinite(nextDeliveredTotal) ||
    bestDeliveredTotal <= 0 ||
    nextDeliveredTotal <= bestDeliveredTotal
  ) {
    return null;
  }

  return Number((nextDeliveredTotal - bestDeliveredTotal).toFixed(2));
}
