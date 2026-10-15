import type { MySupplementUnit } from "./mySupplements";

export type MySupplementPack = {
  packAmount: number;
  packUnit: MySupplementUnit;
  packLabel: string | null;
};

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function selectMySupplementPack(input: {
  unitCount: unknown;
  unitType: string | null;
  netWeightG: unknown;
  servingCount: unknown;
  unitPricingVerified: boolean | null;
  variantLabel: string | null;
}): MySupplementPack {
  const unitCount = positiveNumber(input.unitCount);
  const unitType = input.unitType?.trim().toLowerCase() || "";
  if (input.unitPricingVerified === true && unitCount !== null && ["capsule", "tablet"].includes(unitType)) {
    return { packAmount: unitCount, packUnit: "unit", packLabel: `${unitCount} ${unitType}${unitCount === 1 ? "" : "s"}` };
  }
  const weight = positiveNumber(input.netWeightG);
  if (input.unitPricingVerified === true && weight !== null) {
    return { packAmount: weight, packUnit: "gram", packLabel: `${weight} g` };
  }
  const servings = positiveNumber(input.servingCount);
  if (input.unitPricingVerified === true && servings !== null) {
    return { packAmount: servings, packUnit: "serving", packLabel: `${servings} servings` };
  }
  return { packAmount: 1, packUnit: "pack", packLabel: input.variantLabel };
}

