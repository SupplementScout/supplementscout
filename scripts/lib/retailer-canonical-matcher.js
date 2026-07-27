const {
  normalizeFlavour,
  parsePackCount,
  parseProductFormat,
  parseSize,
} = require("./feed-variant-guards");

function text(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return text(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:caps|capsule)\b/g, "capsules")
    .replace(/\b(?:tabs|tablet)\b/g, "tablets")
    .replace(/\b(?:flavor)\b/g, "flavour")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value) {
  return normalized(value).replace(/[^a-z0-9]+/g, "");
}

function tokens(value) {
  return normalized(value).split(" ").filter(Boolean);
}

function signature(value) {
  return [...tokens(value)].sort().join("|");
}

function dice(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.length || !b.length) return 0;
  const available = new Map();
  for (const token of b) available.set(token, (available.get(token) || 0) + 1);
  let intersection = 0;
  for (const token of a) {
    const count = available.get(token) || 0;
    if (!count) continue;
    intersection += 1;
    available.set(token, count - 1);
  }
  return (2 * intersection) / (a.length + b.length);
}

function sameDecimal(left, right) {
  if (left == null || right == null || left === "" || right === "") return null;
  return Number(left) === Number(right);
}

function sourceEvidence(record) {
  const optionEntries = Object.entries(record.external_options || {});
  const flavourOption = optionEntries.find(([name]) =>
    ["flavour", "flavours", "flavor", "flavors"].includes(normalized(name))
  )?.[1];
  const sizeOption = optionEntries.find(([name]) =>
    ["size", "weight", "pack size"].includes(normalized(name))
  )?.[1];
  const combined = [record.variant_name, record.product_name, sizeOption].filter(Boolean).join(" ");
  return {
    flavour: normalizeFlavour(flavourOption) || null,
    size: parseSize(combined),
    pack_count: parsePackCount(combined),
    product_format: parseProductFormat(combined),
  };
}

function canonicalVariantEvidence(variant, product) {
  const parsedSize = parseSize([variant.display_name, product.name].filter(Boolean).join(" "));
  return {
    flavour: normalizeFlavour(variant.flavour_label || variant.flavour_code) || null,
    size: variant.size_value != null && variant.size_unit
      ? { value: String(variant.size_value), unit: String(variant.size_unit) }
      : parsedSize,
    pack_count: variant.pack_count == null ? parsePackCount(variant.display_name) : Number(variant.pack_count),
    product_format: variant.product_format || product.product_format || parseProductFormat(product.name),
  };
}

function compatibleEvidence(source, target) {
  const conflicts = [];
  if (source.flavour && target.flavour && source.flavour !== target.flavour) conflicts.push("flavour");
  if (source.size && target.size) {
    if (source.size.unit !== target.size.unit || !sameDecimal(source.size.value, target.size.value)) conflicts.push("size");
  }
  if (source.pack_count && target.pack_count && Number(source.pack_count) !== Number(target.pack_count)) conflicts.push("pack_count");
  if (source.product_format && target.product_format && source.product_format !== target.product_format) conflicts.push("product_format");
  return { compatible: conflicts.length === 0, conflicts };
}

function productCandidates(record, products) {
  const sourceName = record.product_name;
  const sourceBrand = compact(record.brand);
  return products
    .map((product) => {
      const brandMatch = sourceBrand && compact(product.brand)
        ? sourceBrand === compact(product.brand)
        : null;
      const exactName = normalized(sourceName) === normalized(product.name);
      const exactSignature = signature(sourceName) === signature(product.name);
      const similarity = dice(sourceName, product.name);
      const sourceSize = parseSize(sourceName);
      const targetSize = parseSize(product.name);
      const sizeMatch = sourceSize && targetSize
        ? sourceSize.unit === targetSize.unit && sameDecimal(sourceSize.value, targetSize.value)
        : null;
      const sourceFormat = parseProductFormat(sourceName);
      const targetFormat = product.product_format || parseProductFormat(product.name);
      const formatMatch = sourceFormat && targetFormat ? sourceFormat === targetFormat : null;
      const score =
        (exactName ? 100 : exactSignature ? 96 : similarity * 80) +
        (brandMatch === true ? 8 : brandMatch === false ? -25 : 0) +
        (sizeMatch === true ? 5 : sizeMatch === false ? -20 : 0) +
        (formatMatch === true ? 3 : formatMatch === false ? -10 : 0);
      return {
        product,
        score,
        exact_name: exactName,
        exact_signature: exactSignature,
        name_similarity: similarity,
        brand_match: brandMatch,
        size_match: sizeMatch,
        format_match: formatMatch,
      };
    })
    .filter((candidate) => candidate.score >= 45)
    .sort((left, right) => right.score - left.score || Number(left.product.id) - Number(right.product.id));
}

function exactGtinProduct(record, productsByGtin) {
  if (!record.external_gtin) return null;
  const candidates = productsByGtin.get(String(record.external_gtin)) || [];
  return candidates.length === 1 ? candidates[0] : null;
}

function selectProduct(record, products, productsByGtin) {
  const gtin = exactGtinProduct(record, productsByGtin);
  if (gtin) return { state: "EXACT_GTIN", product: gtin, candidates: [] };
  const candidates = productCandidates(record, products);
  const exact = candidates.filter((candidate) =>
    candidate.exact_name ||
    (candidate.exact_signature && candidate.brand_match !== false)
  );
  if (exact.length === 1) return { state: "EXACT_NAME", product: exact[0].product, candidates };
  const top = candidates[0];
  const second = candidates[1];
  if (
    top &&
    top.brand_match === true &&
    top.name_similarity >= 0.92 &&
    top.size_match !== false &&
    top.format_match !== false &&
    (!second || top.score - second.score >= 12)
  ) return { state: "HIGH_CONFIDENCE_REVIEW", product: top.product, candidates };
  return { state: candidates.length ? "AMBIGUOUS_REVIEW" : "NEW_PRODUCT_REVIEW", product: null, candidates };
}

function selectVariant(record, product, variants, sourceSiblingCount) {
  const active = variants.filter((variant) =>
    String(variant.product_id) === String(product.id) && variant.is_active !== false
  );
  const source = sourceEvidence(record);
  const evaluated = active.map((variant) => {
    const target = canonicalVariantEvidence(variant, product);
    const compatibility = compatibleEvidence(source, target);
    const flavourExact = source.flavour && target.flavour ? source.flavour === target.flavour : null;
    const sizeExact = source.size && target.size
      ? source.size.unit === target.size.unit && sameDecimal(source.size.value, target.size.value)
      : null;
    return { variant, target, ...compatibility, flavour_exact: flavourExact, size_exact: sizeExact };
  });
  let candidates = evaluated.filter((candidate) => candidate.compatible);
  if (source.flavour) candidates = candidates.filter((candidate) => candidate.flavour_exact === true);
  if (source.size && candidates.some((candidate) => candidate.size_exact === true)) {
    candidates = candidates.filter((candidate) => candidate.size_exact === true);
  }
  if (record.source_type === "variation" && sourceSiblingCount > 1) {
    candidates = candidates.filter((candidate) =>
      !candidate.variant.is_default &&
      (source.flavour ? candidate.flavour_exact === true : source.size ? candidate.size_exact === true : false)
    );
  }
  if (candidates.length === 1) return { state: "EXACT_VARIANT", variant: candidates[0].variant, evidence: source, candidates: evaluated };
  if (record.source_type === "simple" && active.length === 1 && evaluated[0]?.compatible) {
    return { state: "EXACT_SINGLE_VARIANT", variant: active[0], evidence: source, candidates: evaluated };
  }
  return {
    state: active.length ? "VARIANT_REVIEW" : "NEW_VARIANT_REVIEW",
    variant: null,
    evidence: source,
    candidates: evaluated,
  };
}

function matchRetailerRecords(records, canonical) {
  const products = (canonical.products || []).filter((product) =>
    product.is_active !== false && product.merged_into_product_id == null
  );
  const variants = canonical.variants || canonical.product_variants || [];
  const productsByGtin = new Map();
  for (const product of products) {
    if (!product.gtin) continue;
    const key = String(product.gtin);
    const group = productsByGtin.get(key) || [];
    group.push(product);
    productsByGtin.set(key, group);
  }
  const siblingCounts = new Map();
  for (const record of records) {
    siblingCounts.set(record.external_product_id, (siblingCounts.get(record.external_product_id) || 0) + 1);
  }
  return records.map((record) => {
    if (record.policy_state !== "ELIGIBLE") {
      return { record, status: record.policy_state, reason: record.policy_code, product: null, variant: null, product_match: null, variant_match: null };
    }
    const productMatch = selectProduct(record, products, productsByGtin);
    if (!productMatch.product) {
      return {
        record,
        status: productMatch.state,
        reason: productMatch.state,
        product: null,
        variant: null,
        product_match: productMatch,
        variant_match: null,
      };
    }
    const variantMatch = selectVariant(
      record,
      productMatch.product,
      variants,
      siblingCounts.get(record.external_product_id) || 1
    );
    const productSafe = ["EXACT_GTIN", "EXACT_NAME"].includes(productMatch.state);
    const variantSafe = ["EXACT_VARIANT", "EXACT_SINGLE_VARIANT"].includes(variantMatch.state);
    return {
      record,
      status: productSafe && variantSafe ? "SAFE_EXISTING_VARIANT" : productSafe ? variantMatch.state : productMatch.state,
      reason: productSafe && variantSafe ? `${productMatch.state}+${variantMatch.state}` : productSafe ? variantMatch.state : productMatch.state,
      product: productMatch.product,
      variant: variantMatch.variant,
      product_match: productMatch,
      variant_match: variantMatch,
    };
  });
}

function enforceUniqueCanonicalTargets(matches) {
  const groups = new Map();
  for (const match of matches) {
    if (match.status !== "SAFE_EXISTING_VARIANT" || !match.product || !match.variant) continue;
    const key = `${match.product.id}:${match.variant.id}`;
    const group = groups.get(key) || [];
    group.push(match);
    groups.set(key, group);
  }
  const collisions = new Set(
    [...groups.values()]
      .filter((group) => group.length > 1)
      .flatMap((group) => group.map((match) => match.record.source_record_id))
  );
  return matches.map((match) => collisions.has(match.record.source_record_id)
    ? {
        ...match,
        status: "CANONICAL_TARGET_COLLISION",
        reason: "Multiple retailer records resolve to one canonical variant",
        variant: null,
      }
    : match
  );
}

module.exports = {
  canonicalVariantEvidence,
  compatibleEvidence,
  dice,
  enforceUniqueCanonicalTargets,
  matchRetailerRecords,
  normalized,
  productCandidates,
  selectProduct,
  selectVariant,
  signature,
  sourceEvidence,
};
