export type DuplicateProduct = {
  id: number | string;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
};

export type DuplicateLevel = "high" | "medium" | "low";

export type DuplicateMatch = {
  score: number;
  level: DuplicateLevel;
  productA: DuplicateProduct;
  productB: DuplicateProduct;
};

export function getDuplicatePairKey(
  productAId: number | string,
  productBId: number | string
) {
  const firstId = Number(productAId);
  const secondId = Number(productBId);
  const productA = Math.min(firstId, secondId);
  const productB = Math.max(firstId, secondId);

  return `${productA}:${productB}`;
}

const variantWords = [
  "stim",
  "non stim",
  "non-stim",
  "caffeine free",
  "zero caffeine",
  "vegan",
  "plant",
  "men",
  "mens",
  "women",
  "womens",
  "unisex",
  "bundle",
  "box",
  "pack",
  "stack",
  "black",
  "white",
  "red",
  "blue",
  "green",
  "grey",
  "gray",
  "yellow",
  "purple",
  "burgundy",
  "flame",
  "graphite",
  "sapphire",
  "chocolate",
  "vanilla",
  "strawberry",
  "banana",
  "raspberry",
  "caramel",
  "mango",
  "orange",
  "peach",
  "lemon",
  "lime",
  "apple",
  "cookie",
  "cookies",
  "peanut",
  "berry",
  "tropical",
  "dynamic",
  "probio",
  "casein",
  "whey",
  "cat",
  "pet",
  "batman",
  "supergirl",
  "single",
  "box of",
  "croissant",
  "leggings",
  "top",
  "sleeveless",
  "capsules",
  "tablet",
  "powder",
  "glow",
  "super",
  "ashwagandha",
  "zmattack",
  "astralagus",
];

export function normalizeName(name = "") {
  return name
    .toLowerCase()
    .replace(/\b(gym high|capsules|caps|powder|servings|serves)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSize(name = "") {
  const match = String(name)
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "kg" || unit === "l") {
    return value * 1000;
  }

  return value;
}

export function extractVariants(name = "") {
  const normalized = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ");

  return variantWords.filter((word) => normalized.includes(word));
}

export function haveDifferentVariants(nameA: string, nameB: string) {
  const variantsA = extractVariants(nameA);
  const variantsB = extractVariants(nameB);

  if (variantsA.length === 0 || variantsB.length === 0) {
    return false;
  }

  return variantsA.sort().join("|") !== variantsB.sort().join("|");
}

export function similarity(a: string, b: string) {
  const wordsA = new Set(normalizeName(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeName(b).split(" ").filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  const commonWords = [...wordsA].filter((word) => wordsB.has(word));
  const allWords = new Set([...wordsA, ...wordsB]);

  return commonWords.length / allWords.size;
}

export function getDuplicateLevel(score: number): DuplicateLevel {
  if (score >= 0.85) {
    return "high";
  }

  if (score >= 0.7) {
    return "medium";
  }

  return "low";
}

export function findPossibleDuplicates(
  products: DuplicateProduct[],
  minimumScore = 0.6
) {
  const possibleDuplicates: DuplicateMatch[] = [];

  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      const productA = products[i];
      const productB = products[j];

      if (
        String(productA.brand || "").toLowerCase() !==
        String(productB.brand || "").toLowerCase()
      ) {
        continue;
      }

      const sizeA = extractSize(productA.name);
      const sizeB = extractSize(productB.name);

      if (sizeA !== null && sizeB !== null && sizeA !== sizeB) {
        continue;
      }

      if (haveDifferentVariants(productA.name, productB.name)) {
        continue;
      }

      const score = similarity(productA.name, productB.name);

      if (score >= minimumScore) {
        possibleDuplicates.push({
          score,
          level: getDuplicateLevel(score),
          productA,
          productB,
        });
      }
    }
  }

  return possibleDuplicates.sort((a, b) => b.score - a.score);
}
