import { formatCurrency } from "./pricing";
import type { ProductSearchResult } from "./products";

type SearchValueInput = Pick<
  ProductSearchResult,
  | "verifiedCostPer5gCreatine"
  | "verifiedCostPer25gProtein"
  | "verifiedPricePerKg"
  | "verifiedPricePerLitre"
  | "verifiedPricePerServing"
>;

export type SearchValueMetric = {
  label: string;
  value: string;
};

function metric(label: string, value: number | null, suffix: string) {
  return value === null
    ? null
    : {
        label,
        value: `${formatCurrency(value)} ${suffix}`,
      };
}

export function primarySearchValueMetric(
  product: SearchValueInput
): SearchValueMetric | null {
  return (
    metric(
      "Protein value",
      product.verifiedCostPer25gProtein,
      "per 25 g protein"
    ) ||
    metric(
      "Creatine value",
      product.verifiedCostPer5gCreatine,
      "per 5 g creatine"
    ) ||
    metric("Per serving", product.verifiedPricePerServing, "per serving") ||
    metric("Weight value", product.verifiedPricePerKg, "per kg") ||
    metric("Volume value", product.verifiedPricePerLitre, "per litre")
  );
}

function positiveNumber(value: number | string | null) {
  if (value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function searchResultSize(
  product: Pick<ProductSearchResult, "net_weight_g" | "net_volume_ml">
) {
  const weight = positiveNumber(product.net_weight_g);

  if (weight !== null) {
    return weight >= 1000
      ? `${compactNumber(weight / 1000)} kg`
      : `${compactNumber(weight)} g`;
  }

  const volume = positiveNumber(product.net_volume_ml);

  if (volume !== null) {
    return volume >= 1000
      ? `${compactNumber(volume / 1000)} L`
      : `${compactNumber(volume)} ml`;
  }

  return null;
}
