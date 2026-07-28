type ProductName = {
  id: number | string;
  name: string;
};

type RetailerAlias = {
  product_id: number | string;
  external_name: string | null;
};

export type PotentialDuplicate = {
  productId: string;
  productName: string;
  matchedName: string;
  similarity: number;
};

export function normalizeProductMatchText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:caps|capsule)\b/g, "capsules")
    .replace(/\b(?:tabs|tablet)\b/g, "tablets")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productNameSimilarity(left: string, right: string) {
  const leftTokens = normalizeProductMatchText(left).split(" ").filter(Boolean);
  const rightTokens = normalizeProductMatchText(right).split(" ").filter(Boolean);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const available = new Map<string, number>();
  for (const token of rightTokens) {
    available.set(token, (available.get(token) || 0) + 1);
  }
  let intersection = 0;
  for (const token of leftTokens) {
    const count = available.get(token) || 0;
    if (!count) continue;
    intersection += 1;
    available.set(token, count - 1);
  }
  return (2 * intersection) / (leftTokens.length + rightTokens.length);
}

export function findPotentialDuplicate(
  sourceName: string,
  products: ProductName[],
  aliases: RetailerAlias[],
  minimumSimilarity = 0.64
) {
  const productMap = new Map(
    products.map((product) => [String(product.id), product])
  );
  const names = [
    ...products.map((product) => ({
      productId: String(product.id),
      value: product.name,
    })),
    ...aliases
      .filter((alias) => alias.external_name && productMap.has(String(alias.product_id)))
      .map((alias) => ({
        productId: String(alias.product_id),
        value: String(alias.external_name),
      })),
  ];
  let best: PotentialDuplicate | null = null;
  for (const name of names) {
    const similarity = productNameSimilarity(sourceName, name.value);
    if (similarity < minimumSimilarity || similarity <= (best?.similarity || 0)) {
      continue;
    }
    const product = productMap.get(name.productId);
    if (!product) continue;
    best = {
      productId: name.productId,
      productName: product.name,
      matchedName: name.value,
      similarity,
    };
  }
  return best;
}
