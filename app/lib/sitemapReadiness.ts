import {
  evaluateAminoAcidsIndexability,
  getAminoAcidsComparison,
} from "./aminoAcidsComparison";
import {
  evaluateAppliedNutritionIndexability,
  getAppliedNutritionBrand,
} from "./appliedNutritionBrand";
import {
  evaluateBioTechUSAIndexability,
  getBioTechUSABrand,
} from "./bioTechUSABrand";
import { evaluateEbayUKIndexability, getEbayUKRetailer } from "./ebayUKRetailer";
import {
  evaluateHydrationIndexability,
  getHydrationComparison,
} from "./hydrationComparison";
import {
  evaluateMassGainerIndexability,
  getMassGainerComparison,
} from "./massGainerComparison";
import {
  evaluateMultivitaminsIndexability,
  getMultivitaminsComparison,
} from "./multivitaminsComparison";
import {
  evaluatePer4mIndexability,
  getPer4mBrand,
} from "./per4mBrand";
import {
  evaluatePreWorkoutIndexability,
  getPreWorkoutComparison,
} from "./preWorkoutComparison";
import {
  evaluateProteinBarsIndexability,
  getProteinBarsComparison,
} from "./proteinBarsComparison";
import {
  evaluateVeganProteinIndexability,
  getVeganProteinComparison,
} from "./veganProteinComparison";
import { evaluateWheyIndexability, getWheyComparison } from "./wheyComparison";
import {
  evaluateWheyIsolateIndexability,
  getWheyIsolateComparison,
} from "./wheyIsolateComparison";

type ReadinessCheck = { path: string; check: () => Promise<boolean> };

function categoryCheck<S>(
  load: () => Promise<{ error: boolean; summary: S }>,
  evaluate: (summary: S, valid: boolean) => { indexable: boolean }
) {
  return async () => {
    const result = await load();
    return !result.error && evaluate(result.summary, true).indexable;
  };
}

const checks: ReadinessCheck[] = [
  {
    path: "/hydration",
    check: categoryCheck(getHydrationComparison, evaluateHydrationIndexability),
  },
  {
    path: "/whey-protein",
    check: categoryCheck(getWheyComparison, evaluateWheyIndexability),
  },
  {
    path: "/whey-isolate",
    check: categoryCheck(
      getWheyIsolateComparison,
      evaluateWheyIsolateIndexability
    ),
  },
  {
    path: "/vegan-protein",
    check: categoryCheck(
      getVeganProteinComparison,
      evaluateVeganProteinIndexability
    ),
  },
  {
    path: "/mass-gainer",
    check: categoryCheck(getMassGainerComparison, evaluateMassGainerIndexability),
  },
  {
    path: "/protein-bars",
    check: categoryCheck(
      getProteinBarsComparison,
      evaluateProteinBarsIndexability
    ),
  },
  {
    path: "/multivitamins",
    check: categoryCheck(
      getMultivitaminsComparison,
      evaluateMultivitaminsIndexability
    ),
  },
  {
    path: "/pre-workout",
    check: categoryCheck(getPreWorkoutComparison, evaluatePreWorkoutIndexability),
  },
  {
    path: "/amino-acids",
    check: categoryCheck(getAminoAcidsComparison, evaluateAminoAcidsIndexability),
  },
  {
    path: "/brands/applied-nutrition",
    check: async () => {
      const result = await getAppliedNutritionBrand();
      return (
        !result.error &&
        evaluateAppliedNutritionIndexability(result, true).indexable
      );
    },
  },
  {
    path: "/brands/per4m",
    check: async () => {
      const result = await getPer4mBrand();
      return !result.error && evaluatePer4mIndexability(result, true).indexable;
    },
  },
  {
    path: "/brands/biotech-usa",
    check: async () => {
      const result = await getBioTechUSABrand();
      return (
        !result.error && evaluateBioTechUSAIndexability(result, true).indexable
      );
    },
  },
  {
    path: "/retailers/ebay-uk",
    check: async () => {
      const result = await getEbayUKRetailer();
      return !result.error && evaluateEbayUKIndexability(result, true).indexable;
    },
  },
];

export async function getSitemapIndexability() {
  const outcomes = await Promise.allSettled(checks.map((entry) => entry.check()));
  return new Map(
    checks.map((entry, index) => [
      entry.path,
      outcomes[index].status === "fulfilled" && outcomes[index].value,
    ])
  );
}
