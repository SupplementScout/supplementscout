const { canonicalJson, normalizeDecimalString } = require("./canonical-json");

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

function normalizeFlavour(value = "") {
  if (value === null || value === undefined) {
    return null;
  }
  return normalizeComparableText(value) || null;
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

  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|mcg|iu|l|ml|servings?|serves?)\b/);

  if (!match) {
    return null;
  }

  const amount = normalizeDecimalString(match[1].replace(",", "."), "size");
  const unit = match[2];

  if (amount === "0" || amount.startsWith("-")) {
    return null;
  }

  if (unit === "kg") {
    return { value: normalizeDecimalString(`${amount}e3`, "size"), unit: "g", dimension: "mass" };
  }

  if (unit === "mg") {
    return { value: normalizeDecimalString(`${amount}e-3`, "size"), unit: "g", dimension: "mass" };
  }

  if (unit === "mcg") {
    return { value: normalizeDecimalString(`${amount}e-6`, "size"), unit: "g", dimension: "mass" };
  }

  if (unit === "iu") {
    return { value: amount, unit: "iu", dimension: "potency" };
  }

  if (unit === "serving" || unit === "servings" || unit === "serve" || unit === "serves") {
    return { value: amount, unit: "servings", dimension: "count" };
  }

  if (unit === "l") {
    return { value: normalizeDecimalString(`${amount}e3`, "size"), unit: "ml", dimension: "volume" };
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

  if (/\bsoft\s*gels?\b/.test(text)) {
    return "softgel";
  }

  if (/\b(capsules?|caps?)\b/.test(text)) {
    return "capsule";
  }

  if (/\b(tablets?|tabs?)\b/.test(text)) {
    return "tablet";
  }

  if (/\bmultivitamins?\b/.test(text)) {
    return "tablet";
  }

  if (
    /\b(liquid|ready\s*to\s*drink|ready[-_\s]*to[-_\s]*drink|drink|shot|litre|liter)\b/.test(text) ||
    /\b\d+(?:[.,]\d+)?\s*ml\b/.test(text)
  ) {
    return "liquid";
  }

  if (/\b(bars?|protein bars?)\b/.test(text)) {
    return "bar";
  }

  if (/\bsnacks?\b/.test(text)) {
    return "snack";
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
  let explicitFlavour = null;
  if (typeof rowOrName !== "string") {
    let externalOptions = rowOrName.external_options;
    if (typeof externalOptions === "string" && externalOptions.trim()) {
      try {
        externalOptions = JSON.parse(externalOptions);
      } catch {
        externalOptions = null;
      }
    }
    if (externalOptions && typeof externalOptions === "object" && !Array.isArray(externalOptions)) {
      const option = Object.entries(externalOptions).find(([name]) =>
        ["flavour", "flavor"].includes(String(name).trim().toLowerCase())
      );
      explicitFlavour = normalizeFlavour(option?.[1]);
    }
    explicitFlavour ||= normalizeFlavour(rowOrName.flavour || rowOrName.flavor);
  }
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
          rowOrName.size_unit,
          rowOrName.product_format,
          rowOrName.unit_type,
          rowOrName.evidence_name,
          rowOrName.evidence_size,
          rowOrName.evidence_format,
        ]
          .filter(Boolean)
          .join(" ");

  return {
    flavour: explicitFlavour || parseFlavour(text),
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
  return `${size.dimension}:${normalizeDecimalString(size.value, "size")}:${size.unit}:${unitScope}`;
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

function explicitProductFormat(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  return parseProductFormat(value);
}

function productFormatEvidenceText(rowOrName) {
  if (typeof rowOrName === "string") return rowOrName;
  return [
    rowOrName.product_name,
    rowOrName.external_name,
    rowOrName.name,
    rowOrName.description,
    rowOrName.variant,
    rowOrName.flavour,
    rowOrName.flavor,
    rowOrName.size,
    rowOrName.size_unit,
    rowOrName.unit_type,
    rowOrName.evidence_name,
    rowOrName.evidence_size,
    rowOrName.evidence_format,
  ]
    .filter(Boolean)
    .join(" ");
}

function parseClearProductFormatEvidence(value = "") {
  const text = String(value).toLowerCase();

  if (/\bsoft\s*gels?\b/.test(text)) return "softgel";
  if (/\b(capsules?|caps?)\b/.test(text)) return "capsule";
  if (/\b(tablets?|tabs?)\b/.test(text)) return "tablet";
  if (/\bmultivitamins?\b/.test(text)) return "tablet";
  if (
    /\b(liquid|ready\s*to\s*drink|ready[-_\s]*to[-_\s]*drink|drink|shot|litre|liter)\b/.test(text) ||
    /\b\d+(?:[.,]\d+)?\s*ml\b/.test(text)
  ) {
    return "liquid";
  }
  if (/\b(bars?|protein bars?)\b/.test(text)) return "bar";
  if (/\bsnacks?\b/.test(text)) return "snack";
  if (/\bpowder\b/.test(text)) return "powder";

  return null;
}

function assessVariantCompatibility(row, product) {
  const rowExplicitFormat = explicitProductFormat(row.product_format);
  const productStoredFormat = explicitProductFormat(product.product_format);
  const reviewedIdentity = row.__reviewed_whey_okay_format_identity;
  const reviewedPackCount = reviewedIdentity
    ? parsePackCount(row.pack_count ? `pack of ${row.pack_count}` : "")
    : null;
  const reviewedSize = reviewedIdentity ? parseSize(row.size || "") : null;
  if (reviewedSize && reviewedPackCount > 1) reviewedSize.perUnit = true;
  const rowIdentity = reviewedIdentity
    ? {
        flavour: normalizeFlavour(row.flavour || ""),
        size: reviewedSize,
        packCount: reviewedPackCount,
        productFormat: rowExplicitFormat,
      }
    : parseVariantIdentity(row);
  const productIdentity = {
    ...parseVariantIdentity(product.name || ""),
    productFormat: reviewedIdentity
      ? productStoredFormat
      : productStoredFormat ||
        parseVariantIdentity(product.name || "").productFormat,
  };
  const rowTitleFormat = parseClearProductFormatEvidence(productFormatEvidenceText(row));
  const productTitleFormat = parseClearProductFormatEvidence(product.name || "");
  const rowFallbackFormat = rowIdentity.productFormat;
  const productFallbackFormat = parseVariantIdentity(product.name || "").productFormat;
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

  const rowFormatInvalid =
    row.product_format !== undefined &&
    row.product_format !== null &&
    String(row.product_format).trim() !== "" &&
    !rowExplicitFormat;
  const productFormatInvalid =
    product.product_format !== undefined &&
    product.product_format !== null &&
    String(product.product_format).trim() !== "" &&
    !productStoredFormat;

  if (rowFormatInvalid || productFormatInvalid) {
    reasons.push("format conflict");
  }
  if (!reviewedIdentity && valuesConflict(rowExplicitFormat, rowTitleFormat)) {
    reasons.push("format conflict");
  }
  if (!reviewedIdentity && valuesConflict(productStoredFormat, productTitleFormat)) {
    reasons.push("format conflict");
  }
  if (valuesConflict(rowExplicitFormat, productStoredFormat)) {
    reasons.push("format conflict");
  }
  if (reviewedIdentity && !productStoredFormat) {
    reasons.push("format conflict");
  }

  if (!reasons.includes("format conflict")) {
    const rowFormat =
      rowExplicitFormat ||
      (productStoredFormat ? rowTitleFormat : rowFallbackFormat);
    const productFormat =
      productStoredFormat ||
      (rowExplicitFormat ? productTitleFormat : productFallbackFormat);

    if (valuesConflict(rowFormat, productFormat)) {
      reasons.push("format conflict");
    } else if (!rowFormat || !productFormat) {
      warnings.push("incomplete format evidence");
    }
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
  const externalVariantId = String(row.external_variant_id || "").trim();
  if (externalVariantId) {
    const retailerIdentity = String(row.retailer_id || "").trim() || [
      normalizeComparableText(row.retailer_name || ""),
      normalizeComparableText(row.retailer_website || ""),
    ].join("|");
    return `external-variant|${retailerIdentity}|${externalVariantId}`;
  }

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

function rowDedupeSignature(row) {
  const normalized = JSON.parse(JSON.stringify(row));
  if (typeof normalized.external_options === "string" && normalized.external_options.trim()) {
    try {
      normalized.external_options = JSON.parse(normalized.external_options);
    } catch {
      // Invalid JSON is rejected by the importer; preserve it here for drift detection.
    }
  }
  return canonicalJson(normalized);
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

const REVIEWED_SAFE_CREATE_FAMILIES = [
  {
    categories: ["Whey Protein"],
    pattern: /\befectiv\s+whey\s+protein\b/i,
  },
  {
    categories: ["Whey Protein"],
    pattern: /\bgrass[-\s]*fed\s+whey\s+protein\s+isolate\b|\bwhey\s+(protein\s+)?isolate\b/i,
  },
  {
    categories: ["Whey Protein"],
    pattern: /\bmountain\s+joe'?s\s+shake\s+a\s+whey\b/i,
  },
  {
    categories: ["Whey Protein"],
    pattern: /\begg\s+white\s+protein\b/i,
  },
  {
    categories: ["Pre Workout"],
    pattern: /\bpitbull\s+pump\b|\bmega\s+pump\s+elite\b|\bpump\s+pre[-\s]*workout\b/i,
  },
  {
    categories: ["Pre Workout"],
    pattern: /\bdefib\s+original\b|\bmvpre\s+365\b|\bhypermax'?d\s+out\b|\bpharma\s+grade\s+pre\b/i,
  },
  {
    categories: ["Amino Acids"],
    pattern: /\bessential\s+gains\s+eaa\b/i,
  },
  {
    categories: ["Health Supplements"],
    pattern: /\bgreens\b/i,
  },
  {
    allowCreamWord: true,
    categories: ["Health Supplements"],
    pattern: /\bcream\s+of\s+rice\b/i,
  },
  {
    allowCreamWord: true,
    categories: ["Health Supplements"],
    pattern: /\bcream\s+of\s+oats\b/i,
  },
  {
    categories: ["Health Supplements"],
    pattern: /\bprotein\s+pancakes?\b/i,
  },
  {
    allowedFormats: ["bar"],
    categories: ["Protein Bars"],
    pattern: /\bper4m\s+protein\s+bars\s+box\s+of\s+12\s+x\s+62g\b/i,
  },
  {
    allowCreamWord: true,
    categories: ["Whey Protein"],
    pattern: /\b(?:per4m\s+plant\s+protein\s+2kg|strom\s+sports\s+velosiwhey\s+1\.2kg|strom\s+sports\s+nihpro\s+hydrolysed\s+protein\s+isolate\s+40\s+servings|strom\s+sports\s+velosiwhey\s+iso\s+1kg)\b/i,
  },
  {
    categories: ["Pre Workout"],
    pattern: /\b(?:time\s+4\s+pre\s+workout\s+professional\s+300g|conteh\s+sports\s+conviction\s+elite\s+pre-workout\s+375g|cnp\s+professional\s+full\s+tilt\s+v2\s+stim\s+pre\s+workout\s+570g|conteh\s+sports\s+the\s+pump\s+414g|efectiv\s+nutrition\s+legacy\s+pre-workout\s+380g)\b/i,
  },
  {
    categories: ["Pre Workout"],
    pattern: /\bcellucor\s+c4\s+ripped\s+180g\b/i,
  },
  {
    allowedFormats: ["bar"],
    categories: ["Protein Bars"],
    pattern: /\bcnp\s+prodough\s+protein\s+bars\s+box\s+of\s+12\s+x\s+60g\b/i,
  },
  {
    allowCreamWord: true,
    categories: ["Whey Protein"],
    pattern: /\btime\s+4\s+whey\s+protein\s+professional\s+1\.8kg\b/i,
  },
  {
    allowCreamWord: true,
    categories: ["Whey Protein"],
    pattern: /\btrained\s+by\s+jp\s+performance\s+protein\s+(?:1kg|2kg)\b/i,
  },
];

const SAFE_CREATE_CREAM_EXCLUSION_PATTERN = /\bcream\b/i;

const PROHIBITED_CATALOGUE_TYPE_PATTERNS = [
  /\b(?:sarms?|ostarine|mk[-\s]?2866|ligandrol|lgd[-\s]?4033|testolone|rad[-\s]?140|andarine|s[-\s]?4|cardarine|gw[-\s]?501516|ibutamoren|mk[-\s]?677|yk[-\s]?11|acp[-\s]?105|s[-\s]?23|sr[-\s]?9009)\b/i,
  /\b(?:bpc[-\s]?157|tb[-\s]?500|cjc[-\s]?1295|ipamorelin|ghrp[-\s]?[246]|hexarelin|sermorelin|tesamorelin|melanotan|retatrutide)\b/i,
  /\boptimised\s+research\s+labs\s+(?:vi-ron|de-bol|20-hydrox|deep-sleep\s+rem-08|an-var|pct-ex|zma-ex|t5-xs)\b/i,
];

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
  /\b(bundle|stack|with\s+free|plus\s+free|bbe|dated|best\s+before)\b/i,
  /\bmassage\b/i,
  /\btopical\b/i,
  SAFE_CREATE_CREAM_EXCLUSION_PATTERN,
  /\blotion\b/i,
  /\bgel\b/i,
];

function safeCreateEvidenceText(row) {
  return [
    row.product_name,
    row.external_name,
    row.name,
    row.category,
    row.raw_category,
    row.merchant_category,
    row.description,
    row.evidence_name,
    row.evidence_size,
    row.evidence_format,
    row.product_format,
    row.size,
    row.size_unit,
    row.servings ? `${row.servings} servings` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function getProhibitedCatalogueTypeReason(row) {
  const text = safeCreateEvidenceText(row);
  return PROHIBITED_CATALOGUE_TYPE_PATTERNS.some((pattern) => pattern.test(text))
    ? "prohibited catalogue type: SARM or peptide"
    : null;
}

function reviewedSafeCreateFamily(row) {
  const category = String(row.category || "").trim();
  const text = safeCreateEvidenceText(row);
  const family = REVIEWED_SAFE_CREATE_FAMILIES.find((candidate) =>
    candidate.categories.includes(category) && candidate.pattern.test(text)
  );

  if (!family) {
    return null;
  }

  return {
    ...family,
    hasClearCountOrSize: Boolean(parseSize(text)),
    hasSupportedFormat: (family.allowedFormats || ["powder"]).includes(
      explicitProductFormat(row.product_format) || parseProductFormat(text)
    ),
  };
}

function getSafeCreateExclusionReasons(row) {
  const prohibitedReason = getProhibitedCatalogueTypeReason(row);
  if (prohibitedReason) {
    return [prohibitedReason];
  }

  const category = String(row.category || "").trim();
  const reviewedFamily = reviewedSafeCreateFamily(row);

  if (!SAFE_CREATE_ALLOWED_CATEGORIES.has(category) && !reviewedFamily) {
    return ["category is not allowed for safe-create"];
  }

  if (reviewedFamily && !reviewedFamily.hasSupportedFormat) {
    return ["unsupported reviewed product format"];
  }

  if (reviewedFamily && !reviewedFamily.hasClearCountOrSize) {
    return ["reviewed safe-create requires clear size or serving count"];
  }

  const text = safeCreateEvidenceText(row);

  for (const pattern of EXCLUDED_SAFE_CREATE_PATTERNS) {
    if (
      pattern === SAFE_CREATE_CREAM_EXCLUSION_PATTERN &&
      reviewedFamily?.allowCreamWord
    ) {
      continue;
    }

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
    productVariantsToCreate: [],
    retailerProductsToCreate: [],
    retailerProductsToUpdate: [],
    retailerProductsUnchanged: [],
    blockedRows: [],
    offersToCreate: [],
    offersToUpdate: [],
    offersUnchanged: [],
    priceHistoryRowsToCreate: [],
    priceChanges: [],
    shippingChanges: [],
    stockOnlyChanges: [],
    urlOnlyChanges: [],
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

function changedFieldReport(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const previous = before?.[field] ?? null;
    const next = after?.[field] ?? null;
    if (canonicalJson(previous) !== canonicalJson(next)) {
      changes[field] = { before: previous, after: next };
    }
  }
  return changes;
}

function analyzeFeedRows(resolvedRows, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  const planBuilder = options.planBuilder;
  const report = createPreflightReport();
  const approvedCandidates = [];
  const dedupeKeys = new Map();
  const conflictingDedupeRowNumbers = new Set();
  const plannedRetailerSlugs = new Set();
  const plannedProductSlugs = new Set();
  const block = (entry) => {
    report.blockedRows.push(entry);
    return entry;
  };

  for (const item of resolvedRows) {
    const { row, rowNumber, retailer, product, mapping, validationErrors = [] } = item;
    const productName = String(row.product_name || "").trim();
    const externalGtin = getExternalGtin(row);
    const productLevelGtin = getProductLevelGtin(row, "feed");

    const dedupeKey = rowIdentityKey(row);
    const dedupeSignature = rowDedupeSignature(row);
    const duplicate = dedupeKeys.get(dedupeKey);
    if (duplicate) {
      if (duplicate.signature !== dedupeSignature) {
        const conflicts = [{
          rowNumber,
          productName,
          reason: "duplicate variant identity has conflicting source row data",
          duplicateOfRowNumber: duplicate.rowNumber,
        }, {
          rowNumber: duplicate.rowNumber,
          productName: duplicate.productName,
          reason: "duplicate variant identity has conflicting source row data",
          duplicateOfRowNumber: rowNumber,
        }].filter((conflict) => !conflictingDedupeRowNumbers.has(conflict.rowNumber));
        for (const conflict of conflicts) {
          conflictingDedupeRowNumbers.add(conflict.rowNumber);
          report.invalidRows.push(conflict);
          report.blockedRows.push(conflict);
        }
      } else {
        report.deduplicatedRows.push({
          rowNumber,
          productName,
          duplicateOfRowNumber: duplicate.rowNumber,
        });
      }
      continue;
    }

    dedupeKeys.set(dedupeKey, {
      rowNumber,
      productName,
      signature: dedupeSignature,
    });

    if (item.variantResolutionError) {
      const blocked = {
        rowNumber,
        productName,
        reason: item.variantResolutionError,
      };
      report.ambiguousRows.push(blocked);
      report.blockedRows.push(blocked);
      continue;
    }

    if (validationErrors.length > 0) {
      report.invalidRows.push({ rowNumber, productName, reasons: validationErrors });
      report.blockedRows.push({ rowNumber, productName, reasons: validationErrors });
      continue;
    }

    if (safeCreate && !item.productVariant?.planned_create) {
      const exclusionReasons = getSafeCreateExclusionReasons(row);

      if (exclusionReasons.length > 0) {
        report.exclusions.push(block({ rowNumber, productName, reasons: exclusionReasons }));
        continue;
      }
    }

    if (!retailer || !product) {
      if (!safeCreate) {
        report.unmatchedRows.push(block({ rowNumber, productName, reason: "unmatched retailer or product" }));
        continue;
      }

      if ((!retailer && !item.plannedRetailer) || (!product && !item.plannedProduct)) {
        report.unmatchedRows.push(block({
          rowNumber,
          productName,
          reasons: [
            !retailer && !item.plannedRetailer ? "missing retailer" : null,
            !product && !item.plannedProduct ? "missing product" : null,
          ].filter(Boolean),
        }));
        continue;
      }
    }

    const unresolvedIdentityIsAmbiguous = item.plannedProduct
      ? isSafeCreateRowAmbiguous(row)
      : !item.productVariant && isAmbiguousFeedRow(row);
    if (unresolvedIdentityIsAmbiguous) {
      report.ambiguousRows.push(block({
        rowNumber,
        productName,
        reason: "ambiguous variant identity",
      }));
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
      block(conflict);
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
        report.gtinConflicts.push(block({
          rowNumber,
          productName,
          productId: product.id,
          existingGtin: product.gtin,
          candidateGtin: productLevelGtin,
        }));
        continue;
      }
    }

    if (externalGtin) {
      if (mapping?.external_gtin && mapping.external_gtin !== externalGtin) {
        report.externalGtinConflicts.push(block({
          rowNumber,
          productName,
          productId: product.id,
          retailerId: retailer.id,
          existingExternalGtin: mapping.external_gtin,
          candidateExternalGtin: externalGtin,
        }));
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

    const externalVariantIds = group.map((item) =>
      String(item.row.external_variant_id || "").trim()
    );
    const canonicalVariantIds = group.map((item) => item.productVariant?.id || null);
    const plannedVariantKeys = group.map((item) =>
      item.productVariant?.planned_create
        ? `${item.productVariant.product_id}:${item.productVariant.variant_key}`
        : null
    );
    const hasDistinctResolvedVariants =
      externalVariantIds.every(Boolean) &&
      canonicalVariantIds
        .map((id, index) => id || plannedVariantKeys[index])
        .every(Boolean) &&
      new Set(externalVariantIds).size === group.length &&
      new Set(canonicalVariantIds.map((id, index) => id || plannedVariantKeys[index])).size === group.length;

    if (hasDistinctResolvedVariants) {
      continue;
    }

    group.forEach((item) => collisionRowNumbers.add(item.rowNumber));
    group.forEach((item) => block({
      rowNumber: item.rowNumber,
      productName: String(item.row.product_name || "").trim(),
      reason: "multiple unresolved feed variants share one retailer-product identity",
    }));
    report.collisionGroups.push({
      collisionKey,
      retailerId: group[0].retailer?.id || null,
      productId: group[0].product?.id || null,
      rows: group.map((item) => ({
        rowNumber: item.rowNumber,
        productName: String(item.row.product_name || "").trim(),
      })),
      reason:
        "multiple unresolved feed variants share one retailer-product identity",
    });
  }

  report.approvedRows = approvedCandidates.filter(
    (item) =>
      !collisionRowNumbers.has(item.rowNumber) &&
      !conflictingDedupeRowNumbers.has(item.rowNumber)
  );

  if (options.prepareApprovedRows) {
    options.prepareApprovedRows(report.approvedRows);
  }

  if (planBuilder) {
    for (const item of report.approvedRows) {
      item.importPlan = planBuilder(item);
    }
  }

  for (const item of report.approvedRows) {
    const productName = String(item.row.product_name || "").trim();
    const retailerProductFields = [
      "external_product_id", "external_variant_id", "external_sku",
      "external_options", "external_gtin", "external_url", "product_variant_id",
    ];
    const retailerProductAfter = item.importPlan?.retailer_product.values || {};
    const retailerProductReportItem = {
      rowNumber: item.rowNumber,
      productName,
      changes: changedFieldReport(
        item.mapping,
        retailerProductAfter,
        retailerProductFields
      ),
    };

    if (item.plannedRetailer && !plannedRetailerSlugs.has(item.plannedRetailer.slug)) {
      plannedRetailerSlugs.add(item.plannedRetailer.slug);
      report.newRetailersToCreate.push({
        rowNumber: item.rowNumber,
        name: item.plannedRetailer.name,
        slug: item.plannedRetailer.slug,
      });
    }

    if (item.plannedProduct && !plannedProductSlugs.has(item.plannedProduct.slug)) {
      plannedProductSlugs.add(item.plannedProduct.slug);
      report.newProductsToCreate.push({
        rowNumber: item.rowNumber,
        productName,
        slug: item.plannedProduct.slug,
      });
    }

    if (["create_variant", "create_reviewed_variant"].includes(item.importPlan?.product_variant.action)) {
      report.productVariantsToCreate.push({
        rowNumber: item.rowNumber,
        productName,
        productId: item.product?.id || null,
        productSlug: item.plannedProduct?.slug || null,
        values: item.importPlan.product_variant.values,
      });
    }

    if (item.importPlan?.retailer_product.action === "create") {
      report.retailerProductsToCreate.push(retailerProductReportItem);
    } else if (item.importPlan?.retailer_product.action === "update") {
      report.retailerProductsToUpdate.push(retailerProductReportItem);
    } else {
      report.retailerProductsUnchanged.push(retailerProductReportItem);
    }

    const offerAfter = {
      ...(item.importPlan?.offer.values || {}),
      product_variant_id: item.productVariant?.id || null,
      retailer_product_id: item.mapping?.id || null,
    };
    const offerReportItem = {
      rowNumber: item.rowNumber,
      productName,
      changes: changedFieldReport(item.existingOffer, offerAfter, [
        "price", "shipping_cost", "total_price", "in_stock", "url",
        "product_variant_id", "retailer_product_id",
      ]),
    };
    const offerPlan = item.offerPlan || {
      action: "create",
      priceChanged: false,
      shippingChanged: false,
      stockChanged: false,
      urlChanged: false,
      createsPriceHistory: true,
    };

    if (offerPlan.action === "create") {
      report.offersToCreate.push(offerReportItem);
    } else if (offerPlan.action === "update") {
      report.offersToUpdate.push(offerReportItem);
    } else {
      report.offersUnchanged.push(offerReportItem);
    }

    if (offerPlan.createsPriceHistory) {
      report.priceHistoryRowsToCreate.push(offerReportItem);
    }

    if (offerPlan.priceChanged) {
      report.priceChanges.push(offerReportItem);
    }

    if (offerPlan.shippingChanged) {
      report.shippingChanges.push(offerReportItem);
    }

    if (
      offerPlan.stockChanged &&
      !offerPlan.priceChanged &&
      !offerPlan.shippingChanged &&
      !offerPlan.urlChanged
    ) {
      report.stockOnlyChanges.push(offerReportItem);
    }

    if (
      offerPlan.urlChanged &&
      !offerPlan.priceChanged &&
      !offerPlan.shippingChanged &&
      !offerPlan.stockChanged
    ) {
      report.urlOnlyChanges.push(offerReportItem);
    }

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

  const resolvedByRow = new Map(
    resolvedRows.map((item) => [item.rowNumber, item.row])
  );
  report.blockedRows = report.blockedRows.map((entry) => {
    const row = resolvedByRow.get(entry.rowNumber) || {};
    return {
      ...entry,
      block_reason:
        entry.block_reason || entry.reason || (entry.reasons || []).join("; "),
      context: {
        rowNumber: entry.rowNumber,
        productName: entry.productName || String(row.product_name || "").trim(),
        slug: String(row.slug || "").trim() || null,
        external_product_id: String(row.external_product_id || "").trim() || null,
        external_variant_id: String(row.external_variant_id || "").trim() || null,
        external_url: String(row.external_url || row.url || "").trim() || null,
      },
    };
  });

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
    `  product_variants would be created: ${report.productVariantsToCreate.length}`,
    `  retailer_products would be created: ${report.retailerProductsToCreate.length}`,
    `  retailer_products would be updated: ${report.retailerProductsToUpdate.length}`,
    `  retailer_products unchanged: ${report.retailerProductsUnchanged.length}`,
    `  blocked rows: ${report.blockedRows.length}`,
    `  offers would be created: ${report.offersToCreate.length}`,
    `  offers would be updated: ${report.offersToUpdate.length}`,
    `  offers unchanged: ${report.offersUnchanged.length}`,
    `  price_history rows would be created: ${report.priceHistoryRowsToCreate.length}`,
    `  price changes: ${report.priceChanges.length}`,
    `  shipping changes: ${report.shippingChanges.length}`,
    `  stock-only changes: ${report.stockOnlyChanges.length}`,
    `  URL-only changes: ${report.urlOnlyChanges.length}`,
  ].join("\n");
}

module.exports = {
  analyzeFeedRows,
  assessVariantCompatibility,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  getProhibitedCatalogueTypeReason,
  getSafeCreateExclusionReasons,
  isAmbiguousFeedRow,
  isSafeCreateRowAmbiguous,
  isProductGtinVerified,
  normalizeComparableText,
  normalizeFlavour,
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
