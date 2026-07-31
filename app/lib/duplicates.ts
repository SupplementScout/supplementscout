export type DuplicateProduct = {
  id: number | string;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  product_format?: string | null;
  net_weight_g?: number | string | null;
  net_volume_ml?: number | string | null;
  unit_count?: number | string | null;
  unit_type?: string | null;
  servings?: number | string | null;
};

export type DuplicateAlias = {
  product_id: number | string;
  external_name: string | null;
  external_gtin?: string | null;
};

export type DuplicateLevel = "high" | "medium" | "low";
export type DuplicateKind =
  | "exact-product"
  | "product-family"
  | "possible-duplicate";

export type DuplicateMatch = {
  score: number;
  level: DuplicateLevel;
  kind: DuplicateKind;
  productA: DuplicateProduct;
  productB: DuplicateProduct;
};

export function getDuplicatePairKey(
  productAId: number | string,
  productBId: number | string
) {
  const [productA, productB] = getDuplicatePairIds(productAId, productBId);

  return `${productA}:${productB}`;
}

export function getDuplicatePairIds(
  productAId: number | string,
  productBId: number | string
) {
  const firstId = String(productAId);
  const secondId = String(productBId);
  const firstComesBeforeSecond =
    firstId.length === secondId.length
      ? firstId <= secondId
      : firstId.length < secondId.length;

  return firstComesBeforeSecond
    ? ([firstId, secondId] as const)
    : ([secondId, firstId] as const);
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

const brandFamilies = new Map([
  ["animal", "universal-animal"],
  ["universalnutrition", "universal-animal"],
  ["universalanimal", "universal-animal"],
  ["nxt", "nxt-nutrition"],
  ["nxtnutrition", "nxt-nutrition"],
  ["6paknutrition", "6pak-nutrition"],
  ["6packnutrition", "6pak-nutrition"],
]);

function compact(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeBrandFamily(value: string | null | undefined) {
  const key = compact(value);
  return brandFamilies.get(key) || key;
}

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
  minimumScore = 0.6,
  aliases: DuplicateAlias[] = []
) {
  const possibleDuplicates: DuplicateMatch[] = [];
  const aliasesByProduct = new Map<string, string[]>();
  const gtinsByProduct = new Map<string, Set<string>>();

  for (const product of products) {
    if (product.gtin) {
      gtinsByProduct.set(String(product.id), new Set([product.gtin]));
    }
  }

  for (const alias of aliases) {
    const productId = String(alias.product_id);
    if (alias.external_name) {
      const names = aliasesByProduct.get(productId) || [];
      names.push(alias.external_name);
      aliasesByProduct.set(productId, names);
    }
    if (alias.external_gtin) {
      const gtins = gtinsByProduct.get(productId) || new Set<string>();
      gtins.add(alias.external_gtin);
      gtinsByProduct.set(productId, gtins);
    }
  }

  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      const productA = products[i];
      const productB = products[j];

      const brandA = normalizeBrandFamily(productA.brand);
      const brandB = normalizeBrandFamily(productB.brand);

      if (!brandA || brandA !== brandB) {
        continue;
      }

      if (
        productA.product_format &&
        productB.product_format &&
        productA.product_format !== productB.product_format
      ) {
        continue;
      }

      const sizeA = extractSize(productA.name);
      const sizeB = extractSize(productB.name);
      const differentNamedSize =
        sizeA !== null && sizeB !== null && sizeA !== sizeB;
      const differentStructuredSize =
        (productA.net_weight_g != null &&
          productB.net_weight_g != null &&
          Number(productA.net_weight_g) !== Number(productB.net_weight_g)) ||
        (productA.net_volume_ml != null &&
          productB.net_volume_ml != null &&
          Number(productA.net_volume_ml) !== Number(productB.net_volume_ml)) ||
        (productA.unit_count != null &&
          productB.unit_count != null &&
          productA.unit_type === productB.unit_type &&
          Number(productA.unit_count) !== Number(productB.unit_count)) ||
        (productA.servings != null &&
          productB.servings != null &&
          Number(productA.servings) !== Number(productB.servings));
      const differentVariant = haveDifferentVariants(
        productA.name,
        productB.name
      );

      const namesA = [
        productA.name,
        ...(aliasesByProduct.get(String(productA.id)) || []),
      ];
      const namesB = [
        productB.name,
        ...(aliasesByProduct.get(String(productB.id)) || []),
      ];
      let score = 0;

      for (const nameA of namesA) {
        for (const nameB of namesB) {
          score = Math.max(score, similarity(nameA, nameB));
        }
      }

      const gtinsA = gtinsByProduct.get(String(productA.id)) || new Set();
      const gtinsB = gtinsByProduct.get(String(productB.id)) || new Set();
      const exactGtin = [...gtinsA].some((gtin) => gtinsB.has(gtin));

      if (exactGtin) {
        score = 1;
      }

      if (score >= minimumScore) {
        const kind: DuplicateKind = exactGtin
          ? "exact-product"
          : differentVariant || differentNamedSize || differentStructuredSize
            ? "product-family"
            : "possible-duplicate";
        possibleDuplicates.push({
          score,
          level: getDuplicateLevel(score),
          kind,
          productA,
          productB,
        });
      }
    }
  }

  return possibleDuplicates.sort((a, b) => b.score - a.score);
}
