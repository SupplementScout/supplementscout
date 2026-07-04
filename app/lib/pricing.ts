export type PriceInput = {
  price: number | string | null;
  shipping_cost: number | string | null;
};

export type DeliveredPrice = {
  productPrice: number;
  shippingCost: number;
  totalPrice: number;
};

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

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}
