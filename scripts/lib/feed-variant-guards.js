function parseStrictBoolean(value) {
  return ["true", "1", "yes", "y"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function isProductGtinVerified(row) {
  return parseStrictBoolean(row.product_gtin_verified);
}

function getExternalGtin(row) {
  return String(row.gtin || row.external_gtin || "").trim() || null;
}

function getProductLevelGtin(row, mode = "manual") {
  const gtin = getExternalGtin(row);

  if (!gtin) {
    return null;
  }

  if (mode === "feed" && !isProductGtinVerified(row)) {
    return null;
  }

  return gtin;
}

function normalizeComparableText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMultipack(value = "") {
  const text = String(value).toLowerCase();
  const match = text.match(
    /\b(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|mg|mcg|iu|l|ml)\b/
  );

  if (!match) {
    return null;
  }

  return {
    count: Number(match[1]),
    perUnitSize: parseSize(`${match[2]}${match[3]}`),
  };
}

function parseSize(value = "") {
  const text = String(value).toLowerCase();
  const multipack = parseMultipack(text);

  if (multipack) {
    return {
      ...multipack.perUnitSize,
      perUnit: true,
    };
  }

  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|mcg|iu|l|ml)\b/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(",", "."));
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (unit === "kg") {
    return { value: amount * 1000, unit: "g", dimension: "mass" };
  }

  if (unit === "mg") {
    return { value: amount / 1000, unit: "g", dimension: "mass" };
  }

  if (unit === "mcg") {
    return { value: amount / 1000000, unit: "g", dimension: "mass" };
  }

  if (unit === "iu") {
    return { value: amount, unit: "iu", dimension: "potency" };
  }

  if (unit === "l") {
    return { value: amount * 1000, unit: "ml", dimension: "volume" };
  }

  return {
    value: amount,
    unit,
    dimension: unit === "ml" ? "volume" : "mass",
  };
}

function parsePackCount(value = "") {
  const text = String(value).toLowerCase();
  const multipack = parseMultipack(text);

  if (multipack) {
    return multipack.count;
  }

  const packOfMatch = text.match(/\bpack\s+of\s+(\d+)\b/);

  if (packOfMatch) {
    return Number(packOfMatch[1]);
  }

  const countMatch = text.match(/\b(\d+)\s*(bars?|packs?|packets?|sachets?)\b/);

  if (countMatch) {
    return Number(countMatch[1]);
  }

  if (/\b(single|1)\s*(bar|pack|packet|sachet)\b/.test(text)) {
    return 1;
  }

  return null;
}

function parseProductFormat(value = "") {
  const text = String(value).toLowerCase();

  if (/\b(capsules?|caps?)\b/.test(text)) {
    return "capsule";
  }

  if (/\b(tablets?|tabs?)\b/.test(text)) {
    return "tablet";
  }

  if (/\bmultivitamins?\b/.test(text)) {
    return "tablet";
  }

  if (/\b(liquid|ready\s*to\s*drink|ready-to-drink|drink|shot|ml|litre|liter)\b/.test(text)) {
    return "liquid";
  }

  if (/\b(bars?|protein bars?)\b/.test(text)) {
    return "bar";
  }

  if (/\b(powder|whey|protein|isolate|casein|mass gainer|pre workout|creatine)\b/.test(text)) {
    return "powder";
  }

  return null;
}

function parseFlavour(value = "") {
  const text = String(value).toLowerCase();
  const flavours = [
    "cookies and cream",
    "cookies & cream",
    "salted caramel",
    "chocolate",
    "vanilla",
    "strawberry",
    "banana",
    "caramel",
    "peanut",
    "coconut",
    "mango",
    "raspberry",
    "orange",
    "lemon",
    "lime",
    "cola",
    "unflavoured",
    "berry",
  ];

  return flavours.find((flavour) => text.includes(flavour)) || null;
}

function parseVariantIdentity(rowOrName) {
  const text =
    typeof rowOrName === "string"
      ? rowOrName
      : [
          rowOrName.product_name,
          rowOrName.external_name,
          rowOrName.name,
          rowOrName.description,
          rowOrName.variant,
          rowOrName.flavour,
          rowOrName.flavor,
          rowOrName.size,
          rowOrName.product_format,
          rowOrName.unit_type,
          rowOrName.evidence_name,
          rowOrName.evidence_size,
          rowOrName.evidence_format,
        ]
          .filter(Boolean)
          .join(" ");

  return {
    flavour: parseFlavour(text),
    size: parseSize(text),
    packCount: parsePackCount(text),
    productFormat: parseProductFormat(text),
  };
}

function sizeKey(size) {
  if (!size) {
    return null;
  }

  const unitScope = size.perUnit ? "per-unit" : "total";
  return `${size.dimension}:${Math.round(size.value * 1000) / 1000}:${size.unit}:${unitScope}`;
}

function productFamilyKey(value = "") {
  return normalizeComparableText(value)
    .replace(/\b\d+\s*x\s*\d+(?:[.,]\d+)?\s*(kg|g|mg|mcg|iu|l|ml)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|mg|mcg|iu|l|ml)\b/g, " ")
    .replace(/\b(pack\s+of\s+\d+|\d+\s*(bars?|packs?|packets?|sachets?))\b/g, " ")
    .replace(/\b(chocolate|vanilla|strawberry|banana|cookies and cream|cookies cream|salted caramel|caramel|peanut|coconut|mango|berry|raspberry|orange|lemon|lime|cola|unflavoured)\b/g, " ")
    .replace(/\b(single|bars?|packs?|packets?|sachets?|capsules?|caps?|tablets?|tabs?|powder|liquid|ready to drink)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function valuesConflict(left, right) {
  return left !== null && right !== null && left !== right;
}

function assessVariantCompatibility(row, product) {
  const rowIdentity = parseVariantIdentity(row);
  const productIdentity = parseVariantIdentity(product.name || "");
  const reasons = [];
  const warnings = [];

  if (
    normalizeComparableText(row.brand) &&
    normalizeComparableText(product.brand) &&
    normalizeComparableText(row.brand) !== normalizeComparableText(product.brand)
  ) {
    reasons.push("brand conflict");
  }

  const rowFamily = productFamilyKey(row.product_name || row.external_name || row.name || "");
  const productFamily = productFamilyKey(product.name || "");

  if (!rowFamily || !productFamily) {
    reasons.push("ambiguous product family");
  } else if (rowFamily !== productFamily) {
    reasons.push("product family conflict");
  }

  if (valuesConflict(sizeKey(rowIdentity.size), sizeKey(productIdentity.size))) {
    reasons.push("size conflict");
  } else if (!rowIdentity.size || !productIdentity.size) {
    warnings.push("incomplete size evidence");
  }

  if (valuesConflict(rowIdentity.packCount, productIdentity.packCount)) {
    reasons.push("pack-count conflict");
  } else if (rowIdentity.packCount === null || productIdentity.packCount === null) {
    warnings.push("incomplete pack-count evidence");
  }

  if (valuesConflict(rowIdentity.productFormat, productIdentity.productFormat)) {
    reasons.push("format conflict");
  } else if (!rowIdentity.productFormat || !productIdentity.productFormat) {
    warnings.push("incomplete format evidence");
  }

  return {
    compatible: reasons.length === 0,
    ambiguous: !rowFamily || !productFamily,
    reasons,
    warnings,
    rowIdentity,
    productIdentity,
  };
}

function rowIdentityKey(row) {
  const identity = parseVariantIdentity(row);

  return [
    productFamilyKey(row.product_name || row.external_name || row.name || ""),
    identity.flavour || "unknown-flavour",
    sizeKey(identity.size) || "unknown-size",
    identity.packCount === null ? "unknown-pack" : identity.packCount,
    identity.productFormat || "unknown-format",
    getExternalGtin(row) || "unknown-gtin",
    normalizeComparableText(row.url || ""),
  ].join("|");
}

function isAmbiguousFeedRow(row) {
  const identity = parseVariantIdentity(row);
  const family = productFamilyKey(row.product_name || row.external_name || row.name || "");

  return (
    !family ||
    identity.productFormat === null ||
    (identity.size === null && identity.packCount === null)
  );
}

function isSafeCreateRowAmbiguous(row) {
  const identity = parseVariantIdentity(row);
  const family = productFamilyKey(row.product_name || row.external_name || row.name || "");

  return !family || identity.productFormat === null;
}

const SAFE_CREATE_ALLOWED_CATEGORIES = new Set([
  "Vitamins",
  "Health Supplements",
  "Amino Acids",
  "Creatine",
]);

const EXCLUDED_SAFE_CREATE_PATTERNS = [
  /\bcbd\b/i,
  /\bhemp\b/i,
  /\bpet\b/i,
  /\bdog\b/i,
  /\bcat\b/i,
  /\bpuppy\b/i,
  /\bkitten\b/i,
  /\bmedical\s*tests?\b/i,
  /\btest\s*kits?\b/i,
  /\bmassage\b/i,
  /\btopical\b/i,
  /\bcream\b/i,
  /\blotion\b/i,
  /\bgel\b/i,
];

function getSafeCreateExclusionReasons(row) {
  const category = String(row.category || "").trim();

  if (!SAFE_CREATE_ALLOWED_CATEGORIES.has(category)) {
    return ["category is not allowed for safe-create"];
  }

  const text = [
    row.product_name,
    row.external_name,
    row.name,
    row.category,
    row.raw_category,
    row.merchant_category,
    row.description,
  ]
    .filter(Boolean)
    .join(" ");

  for (const pattern of EXCLUDED_SAFE_CREATE_PATTERNS) {
    if (pattern.test(text)) {
      return ["excluded product type"];
    }
  }

  return [];
}

function createPreflightReport() {
  return {
    approvedRows: [],
    deduplicatedRows: [],
    invalidRows: [],
    unmatchedRows: [],
    ambiguousRows: [],
    collisionGroups: [],
    gtinConflicts: [],
    externalGtinConflicts: [],
    sizeConflicts: [],
    packCountConflicts: [],
    formatConflicts: [],
    productGtinBlocked: [],
    externalGtinStoredOrUpdated: [],
    shippingInferredFromPolicy: [],
    incompleteEvidenceRows: [],
    exclusions: [],
    newRetailersToCreate: [],
    newProductsToCreate: [],
    retailerProductsToCreate: [],
    offersToCreate: [],
    priceHistoryRowsToCreate: [],
  };
}

function addConflictByReason(report, item, reasons) {
  if (reasons.some((reason) => reason.includes("size"))) {
    report.sizeConflicts.push(item);
  }

  if (reasons.some((reason) => reason.includes("pack"))) {
    report.packCountConflicts.push(item);
  }

  if (reasons.some((reason) => reason.includes("format"))) {
    report.formatConflicts.push(item);
  }
}

function analyzeFeedRows(resolvedRows, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  const report = createPreflightReport();
  const approvedCandidates = [];
  const dedupeKeys = new Map();
  const plannedRetailerSlugs = new Set();

  for (const item of resolvedRows) {
    const { row, rowNumber, retailer, product, mapping, validationErrors = [] } = item;
    const productName = String(row.product_name || "").trim();
    const externalGtin = getExternalGtin(row);
    const productLevelGtin = getProductLevelGtin(row, "feed");

    if (dedupeKeys.has(rowIdentityKey(row))) {
      report.deduplicatedRows.push({
        rowNumber,
        productName,
        duplicateOfRowNumber: dedupeKeys.get(rowIdentityKey(row)),
      });
      continue;
    }

    dedupeKeys.set(rowIdentityKey(row), rowNumber);

    if (validationErrors.length > 0) {
      report.invalidRows.push({ rowNumber, productName, reasons: validationErrors });
      continue;
    }

    if (safeCreate) {
      const exclusionReasons = getSafeCreateExclusionReasons(row);

      if (exclusionReasons.length > 0) {
        report.exclusions.push({ rowNumber, productName, reasons: exclusionReasons });
        continue;
      }
    }

    if (!retailer || !product) {
      if (!safeCreate) {
        report.unmatchedRows.push({ rowNumber, productName });
        continue;
      }

      if ((!retailer && !item.plannedRetailer) || (!product && !item.plannedProduct)) {
        report.unmatchedRows.push({
          rowNumber,
          productName,
          reasons: [
            !retailer && !item.plannedRetailer ? "missing retailer" : null,
            !product && !item.plannedProduct ? "missing product" : null,
          ].filter(Boolean),
        });
        continue;
      }
    }

    if (item.plannedProduct ? isSafeCreateRowAmbiguous(row) : isAmbiguousFeedRow(row)) {
      report.ambiguousRows.push({
        rowNumber,
        productName,
        reason: "ambiguous variant identity",
      });
      continue;
    }

    const compatibility = item.plannedProduct
      ? { compatible: true, ambiguous: false, warnings: [] }
      : assessVariantCompatibility(row, product);

    if (!compatibility.compatible || compatibility.ambiguous) {
      const conflict = {
        rowNumber,
        productName,
        productId: product.id,
        reasons: compatibility.reasons.length
          ? compatibility.reasons
          : ["ambiguous variant identity"],
      };

      report.ambiguousRows.push(conflict);
      addConflictByReason(report, conflict, conflict.reasons);
      continue;
    }

    if (compatibility.warnings.length > 0) {
      report.incompleteEvidenceRows.push({
        rowNumber,
        productName,
        productId: product.id,
        warnings: compatibility.warnings,
      });
    }

    if (productLevelGtin) {
      if (product?.gtin && product.gtin !== productLevelGtin) {
        report.gtinConflicts.push({
          rowNumber,
          productName,
          productId: product.id,
          existingGtin: product.gtin,
          candidateGtin: productLevelGtin,
        });
        continue;
      }
    }

    if (externalGtin) {
      if (mapping?.external_gtin && mapping.external_gtin !== externalGtin) {
        report.externalGtinConflicts.push({
          rowNumber,
          productName,
          productId: product.id,
          retailerId: retailer.id,
          existingExternalGtin: mapping.external_gtin,
          candidateExternalGtin: externalGtin,
        });
        continue;
      }

    }

    approvedCandidates.push({
      ...item,
      productLevelGtin,
      externalGtin,
      variantKey: rowIdentityKey(row),
      collisionKey: `${retailer?.id || item.plannedRetailer?.slug}:${product?.id || item.plannedProduct?.slug}`,
    });
  }

  const groups = new Map();

  for (const item of approvedCandidates) {
    const group = groups.get(item.collisionKey) || [];
    group.push(item);
    groups.set(item.collisionKey, group);
  }

  const collisionRowNumbers = new Set();

  for (const [collisionKey, group] of groups) {
    const variantKeys = new Set(group.map((item) => item.variantKey));

    if (variantKeys.size <= 1) {
      continue;
    }

    group.forEach((item) => collisionRowNumbers.add(item.rowNumber));
    report.collisionGroups.push({
      collisionKey,
      retailerId: group[0].retailer?.id || null,
      productId: group[0].product?.id || null,
      rows: group.map((item) => ({
        rowNumber: item.rowNumber,
        productName: String(item.row.product_name || "").trim(),
      })),
      reason:
        "multiple feed variants map to one product and retailer; offers has unique(product_id, retailer_id)",
    });
  }

  report.approvedRows = approvedCandidates.filter(
    (item) => !collisionRowNumbers.has(item.rowNumber)
  );

  for (const item of report.approvedRows) {
    const productName = String(item.row.product_name || "").trim();

    if (item.plannedRetailer && !plannedRetailerSlugs.has(item.plannedRetailer.slug)) {
      plannedRetailerSlugs.add(item.plannedRetailer.slug);
      report.newRetailersToCreate.push({
        rowNumber: item.rowNumber,
        name: item.plannedRetailer.name,
        slug: item.plannedRetailer.slug,
      });
    }

    if (item.plannedProduct) {
      report.newProductsToCreate.push({
        rowNumber: item.rowNumber,
        productName,
        slug: item.plannedProduct.slug,
      });
    }

    if (!item.mapping) {
      report.retailerProductsToCreate.push({
        rowNumber: item.rowNumber,
        productName,
      });
    }

    report.offersToCreate.push({
      rowNumber: item.rowNumber,
      productName,
    });

    report.priceHistoryRowsToCreate.push({
      rowNumber: item.rowNumber,
      productName,
    });

    if (!item.productLevelGtin && item.externalGtin) {
      report.productGtinBlocked.push({
        rowNumber: item.rowNumber,
        productName,
        gtin: item.externalGtin,
      });
    }

    if (item.externalGtin) {
      report.externalGtinStoredOrUpdated.push({
        rowNumber: item.rowNumber,
        productName,
        gtin: item.externalGtin,
      });
    }

    if (item.shippingInferredFromPolicy) {
      report.shippingInferredFromPolicy.push({
        rowNumber: item.rowNumber,
        productName,
        shippingCost: item.row.shipping_cost,
        reason: "shipping inferred from retailer policy",
      });
    }
  }

  return report;
}

function formatPreflightReport(report) {
  return [
    "Import safety report",
    `  approved rows: ${report.approvedRows.length}`,
    `  deduplicated identical rows: ${report.deduplicatedRows.length}`,
    `  invalid rows: ${report.invalidRows.length}`,
    `  unmatched rows: ${report.unmatchedRows.length}`,
    `  exclusions: ${report.exclusions.length}`,
    `  ambiguous rows: ${report.ambiguousRows.length}`,
    `  collision groups: ${report.collisionGroups.length}`,
    `  GTIN conflicts: ${report.gtinConflicts.length}`,
    `  external GTIN conflicts: ${report.externalGtinConflicts.length}`,
    `  size conflicts: ${report.sizeConflicts.length}`,
    `  pack-count conflicts: ${report.packCountConflicts.length}`,
    `  format conflicts: ${report.formatConflicts.length}`,
    `  product GTIN blocked: ${report.productGtinBlocked.length}`,
    `  external GTIN stored or updated: ${report.externalGtinStoredOrUpdated.length}`,
    `  shipping inferred from retailer policy: ${report.shippingInferredFromPolicy.length}`,
    `  new retailers would be created: ${report.newRetailersToCreate.length}`,
    `  new products would be created: ${report.newProductsToCreate.length}`,
    `  retailer_products would be created: ${report.retailerProductsToCreate.length}`,
    `  offers would be created: ${report.offersToCreate.length}`,
    `  price_history rows would be created: ${report.priceHistoryRowsToCreate.length}`,
  ].join("\n");
}

module.exports = {
  analyzeFeedRows,
  assessVariantCompatibility,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  getSafeCreateExclusionReasons,
  isAmbiguousFeedRow,
  isSafeCreateRowAmbiguous,
  isProductGtinVerified,
  normalizeComparableText,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseSize,
  parseStrictBoolean,
  parseVariantIdentity,
  productFamilyKey,
  rowIdentityKey,
  sizeKey,
};
