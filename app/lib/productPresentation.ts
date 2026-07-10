export type ProductPresentationInput = {
  id: string | number;
  name: string;
  brand: string | null;
  category: string | null;
  product_format: string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  serving_count_verified: number | string | null;
  unit_count: number | string | null;
  unit_type: string | null;
  serving_size_g?: number | string | null;
  serving_size_ml?: number | string | null;
  protein_per_serving_g?: number | string | null;
  creatine_per_serving_g?: number | string | null;
  nutrition_verified?: boolean | null;
};

export type ProductKeyFact = {
  label: string;
  value: string;
};

const GYM_HIGH_WHEY_ID = "510";
const GYM_HIGH_WHEY_NAME = "GYM HIGH Whey Pro Synergy Dynamic 600g";
const GYM_HIGH_WHEY_SUMMARY =
  "GYM HIGH Whey Pro Synergy Dynamic is a 600 g protein powder made with 50% whey isolate and 50% micellar casein. It provides 20 servings and includes added probiotics.";

function cleanText(value: string | null | undefined) {
  return (value || "").trim();
}

function cleanBrand(value: string | null | undefined) {
  const brand = cleanText(value);

  return brand.toLowerCase() === "unknown" ? "" : brand;
}

function positiveNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 3 });
}

function formatWeight(value: number | string | null) {
  const grams = positiveNumber(value);

  if (grams === null) {
    return null;
  }

  return grams >= 1000
    ? `${formatNumber(grams / 1000)} kg`
    : `${formatNumber(grams)} g`;
}

function formatVolume(value: number | string | null) {
  const millilitres = positiveNumber(value);

  return millilitres === null ? null : `${formatNumber(millilitres)} ml`;
}

function pluralizeUnit(unitType: string, count: number) {
  const unit = unitType.toLowerCase().replace(/s$/, "");

  return count === 1 ? unit : `${unit}s`;
}

function formatUnitCount(
  countValue: number | string | null,
  unitTypeValue: string | null
) {
  const count = positiveNumber(countValue);
  const unitType = cleanText(unitTypeValue);

  if (count === null || !Number.isInteger(count) || !unitType) {
    return null;
  }

  return `${formatNumber(count)} ${pluralizeUnit(unitType, count)}`;
}

function formatProductFormat(value: string | null) {
  const format = cleanText(value).replace(/[_-]+/g, " ");

  return format
    ? format.replace(/\b\w/g, (character) => character.toUpperCase())
    : null;
}

function includesTerm(name: string, term: string) {
  return name.includes(term) || name.includes(`${term}s`);
}

function nonSupplementKind(name: string, category: string) {
  if (
    category === "accessories" ||
    /\b(?:shaker|bottle|jug|funnel|strap|belt|glove|wrap|sleeve|back\s*pack|bag|pill box|scoop|towel|grip)s?\b/.test(
      name
    )
  ) {
    return "accessory";
  }

  if (
    category.includes("clothing") ||
    category.includes("apparel") ||
    /\b(?:t-shirt|shirt|hoodie|shorts|leggings|vest|joggers|socks)\b/.test(name)
  ) {
    return "clothing item";
  }

  if (
    category === "protein bars" ||
    category.includes("food") ||
    /\b(?:cream of rice|pancakes?|oats?|peanut butter|syrup|sauce|spread|snack|cookies?|brownies?)\b/.test(
      name
    )
  ) {
    return name.includes("protein bar") ? "protein bar" : "food product";
  }

  return null;
}

function supplementKind(product: ProductPresentationInput) {
  const name = cleanText(product.name).toLowerCase();
  const format = cleanText(product.product_format).toLowerCase();
  const category = cleanText(product.category).toLowerCase();
  const nonSupplement = nonSupplementKind(name, category);

  if (nonSupplement) {
    return nonSupplement;
  }

  if (category === "whey protein" || category === "protein") {
    if (format === "powder" && !name.includes("protein") && !name.includes("powder")) {
      return "protein powder";
    }

    return name.includes("protein") ? "supplement" : "protein supplement";
  }

  if (category === "creatine") {
    if (format === "powder" && !name.includes("creatine") && !name.includes("powder")) {
      return "creatine powder";
    }

    return name.includes("creatine") ? "supplement" : "creatine supplement";
  }

  if (category === "pre workout") {
    if (format === "powder" && !name.includes("pre workout") && !name.includes("powder")) {
      return "pre-workout powder";
    }

    return name.includes("pre workout") ? "supplement" : "pre-workout supplement";
  }

  if (category === "vitamins") {
    if (format === "capsule") {
      return includesTerm(name, "capsule")
        ? "vitamin supplement"
        : "vitamin supplement in capsule form";
    }

    if (format === "tablet") {
      return includesTerm(name, "tablet")
        ? "vitamin supplement"
        : "vitamin supplement in tablet form";
    }

    return /\bvitamins?\b/.test(name) ? "supplement" : "vitamin supplement";
  }

  if (category === "health supplements") {
    if (format === "liquid") {
      return name.includes("liquid") ? "health supplement" : "liquid supplement";
    }

    if (!format) {
      return "health supplement";
    }
  }

  if (format === "capsule") {
    return includesTerm(name, "capsule") ? "supplement" : "capsule supplement";
  }

  if (format === "tablet") {
    return includesTerm(name, "tablet") ? "supplement" : "tablet supplement";
  }

  if (format === "powder") {
    return name.includes("powder") ? "supplement" : "powdered supplement";
  }

  if (format === "liquid") {
    return name.includes("liquid") ? "supplement" : "liquid supplement";
  }

  if (
    category === "amino acids" ||
    category === "mass gainer" ||
    category === "weight management"
  ) {
    const categoryLabel =
      category === "amino acids" ? "amino acid" : category;

    return name.includes(category) ? "supplement" : `${categoryLabel} supplement`;
  }

  return "supplement";
}

function buildVerifiedFactSentence(product: ProductPresentationInput) {
  const weight = formatWeight(product.net_weight_g);
  const volume = formatVolume(product.net_volume_ml);
  const size = weight || volume;
  const servings = positiveNumber(product.serving_count_verified);
  const unitCount = formatUnitCount(product.unit_count, product.unit_type);
  const contents: string[] = [];

  if (servings !== null && Number.isInteger(servings)) {
    contents.push(`${formatNumber(servings)} verified servings`);
  }

  if (unitCount && !(servings !== null && unitCount.startsWith(`${servings} `))) {
    contents.push(unitCount);
  }

  if (size && contents.length > 0) {
    return `This ${size} product contains ${contents.join(" and ")}.`;
  }

  if (size) {
    return `Its verified net ${weight ? "weight" : "volume"} is ${size}.`;
  }

  if (contents.length > 0) {
    return `It contains ${contents.join(" and ")}.`;
  }

  return null;
}

export function buildProductSummary(product: ProductPresentationInput) {
  if (
    String(product.id) === GYM_HIGH_WHEY_ID &&
    product.name === GYM_HIGH_WHEY_NAME
  ) {
    return GYM_HIGH_WHEY_SUMMARY;
  }

  const name = cleanText(product.name) || "This product";
  const brand = cleanBrand(product.brand);
  const kind = supplementKind(product);
  const nameIncludesBrand =
    brand.length > 0 && name.toLowerCase().includes(brand.toLowerCase());
  const brandAttribution = brand && !nameIncludesBrand ? ` from ${brand}` : "";
  const article = /^[aeiou]/i.test(kind) ? "an" : "a";
  const firstSentence = `${name} is ${article} ${kind}${brandAttribution}.`;
  const verifiedFacts = buildVerifiedFactSentence(product);

  return verifiedFacts ? `${firstSentence} ${verifiedFacts}` : firstSentence;
}

function truncateMetadataDescription(value: string, maxLength = 160) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const candidate = normalized.slice(0, maxLength);
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = (lastSpace > 0 ? candidate.slice(0, lastSpace) : normalized.slice(0, maxLength))
    .replace(/[\s,;:.-]+$/, "");

  return `${truncated}…`;
}

export function buildProductMetadataDescription(
  product: ProductPresentationInput
) {
  return truncateMetadataDescription(buildProductSummary(product));
}

export function buildProductKeyFacts(product: ProductPresentationInput) {
  const facts: ProductKeyFact[] = [];
  const brand = cleanBrand(product.brand);
  const category = cleanText(product.category);
  const format = formatProductFormat(product.product_format);
  const weight = formatWeight(product.net_weight_g);
  const volume = formatVolume(product.net_volume_ml);
  const servings = positiveNumber(product.serving_count_verified);
  const servingSizeG = positiveNumber(product.serving_size_g);
  const servingSizeMl = positiveNumber(product.serving_size_ml);
  const unitCount = formatUnitCount(product.unit_count, product.unit_type);

  if (brand) facts.push({ label: "Brand", value: brand });
  if (category) facts.push({ label: "Category", value: category });
  if (format) facts.push({ label: "Product format", value: format });
  if (weight) facts.push({ label: "Net weight", value: weight });
  if (volume) facts.push({ label: "Net volume", value: volume });
  if (servings !== null && Number.isInteger(servings)) {
    facts.push({
      label: "Verified servings",
      value: `${formatNumber(servings)} servings`,
    });
  }
  if (servingSizeG !== null) {
    facts.push({ label: "Serving size", value: `${formatNumber(servingSizeG)} g` });
  } else if (servingSizeMl !== null) {
    facts.push({ label: "Serving size", value: `${formatNumber(servingSizeMl)} ml` });
  }
  if (unitCount) facts.push({ label: "Unit count", value: unitCount });

  if (product.nutrition_verified === true) {
    const protein = positiveNumber(product.protein_per_serving_g);
    const creatine = positiveNumber(product.creatine_per_serving_g);

    if (protein !== null) {
      facts.push({
        label: "Protein per serving",
        value: `${formatNumber(protein)} g protein per serving`,
      });
    }
    if (creatine !== null) {
      facts.push({
        label: "Creatine per serving",
        value: `${formatNumber(creatine)} g creatine per serving`,
      });
    }
  }

  return facts;
}
