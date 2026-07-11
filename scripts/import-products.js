const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  analyzeFeedRows,
  assessVariantCompatibility,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  isAmbiguousFeedRow,
  isSafeCreateRowAmbiguous,
  isProductGtinVerified,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseSize,
  parseStrictBoolean,
  parseVariantIdentity,
} = require("./lib/feed-variant-guards");

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  quiet: true,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

function getSupabase() {
  if (supabase) {
    return supabase;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

function setSupabaseForTests(client) {
  supabase = client;
}

const CATEGORY_MAPPINGS = new Map([
  ["pre-workout", "Pre Workout"],
  ["pre workout", "Pre Workout"],
  ["creatine supplements", "Creatine"],
  ["amino acid supplements", "Amino Acids"],
]);

function required(value, fieldName, rowNumber) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`Row ${rowNumber}: missing ${fieldName}`);
  }

  return cleaned;
}

function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeCategory(value) {
  const cleaned = normalizeWhitespace(value);
  const mapped = CATEGORY_MAPPINGS.get(cleaned.toLowerCase());

  return mapped || cleaned;
}

function shouldLogCategoryNormalization(inputCategory, normalizedCategory) {
  return normalizedCategory !== normalizeWhitespace(inputCategory);
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    throw new Error(`Invalid number: ${value}`);
  }

  return number;
}

function parseFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return number;
}

function parseOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} must be a finite number`);
  }

  return number;
}

function getInputShippingValue(row) {
  if (
    rowHasColumn(row, "shipping_cost") &&
    row.shipping_cost !== null &&
    row.shipping_cost !== undefined &&
    row.shipping_cost !== ""
  ) {
    return row.shipping_cost;
  }

  if (rowHasColumn(row, "delivery_cost")) {
    return row.delivery_cost;
  }

  if (rowHasColumn(row, "shipping_cost")) {
    return row.shipping_cost;
  }

  return undefined;
}

function getRetailerProductUrl(row) {
  return (
    getDirectRetailerProductUrl(row) ||
    String(row.url || "").trim()
  );
}

function getDirectRetailerProductUrl(row) {
  return (
    String(row.merchant_deep_link || "").trim() ||
    String(row.external_url || "").trim() ||
    String(row.direct_url || "").trim()
  );
}

function getOfferUrl(row) {
  return (
    String(row.aw_deep_link || "").trim() ||
    String(row.affiliate_url || "").trim() ||
    String(row.url || "").trim()
  );
}

function isSimplySupplementsRow(row) {
  const merchantId = String(row.merchant_id || "").trim();
  const merchantName = String(row.merchant_name || row.retailer_name || "")
    .trim()
    .toLowerCase();

  return merchantId === "5959" || merchantName === "simply supplements";
}

function inferSimplySupplementsShipping(price) {
  return price >= 20 ? 0 : 1.99;
}

function normalizeShippingForImport(row, mode = "manual") {
  const shippingInput = getInputShippingValue(row);
  const parsedShipping = parseOptionalFiniteNumber(shippingInput, "shipping_cost");

  if (parsedShipping !== null) {
    if (parsedShipping < 0) {
      throw new Error("shipping_cost must be 0 or greater");
    }

    return {
      row: { ...row, shipping_cost: parsedShipping },
      shippingInferredFromPolicy: false,
    };
  }

  if (mode !== "feed" || !isSimplySupplementsRow(row)) {
    return {
      row: { ...row, shipping_cost: null },
      shippingInferredFromPolicy: false,
    };
  }

  const price = parseFiniteNumber(row.price, "price");

  if (price <= 0) {
    throw new Error("price must be greater than 0");
  }

  const inferredShipping = inferSimplySupplementsShipping(price);

  if (!Number.isFinite(inferredShipping) || inferredShipping < 0) {
    throw new Error("inferred shipping_cost must be a finite non-negative number");
  }

  return {
    row: { ...row, shipping_cost: inferredShipping },
    shippingInferredFromPolicy: true,
  };
}

function rowHasColumn(row, fieldName) {
  return Object.prototype.hasOwnProperty.call(row, fieldName);
}

function optionalPositiveNumber(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (number <= 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be greater than 0`);
  }

  return number;
}

function optionalNonNegativeNumber(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (number < 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be 0 or greater`);
  }

  return number;
}

function optionalPositiveInteger(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const number = optionalNumber(row[fieldName]);

  if (number === null) {
    return null;
  }

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be a positive integer`);
  }

  return number;
}

function optionalText(row, fieldName) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  return String(row[fieldName] || "").trim().toLowerCase() || null;
}

function parseBoolean(value) {
  return ["true", "1", "yes", "y"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function parseRequiredBoolean(value, fieldName) {
  const cleaned = String(value || "").trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(cleaned)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(cleaned)) {
    return false;
  }

  throw new Error(`${fieldName} must be a boolean`);
}

const CANONICAL_RETAILER_FEED_SIGNATURE_COLUMNS = [
  "external_product_id",
  "external_variant_id",
  "shipping_known",
];

const CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS = [
  "retailer_name",
  "retailer_website",
  "external_product_id",
  "external_variant_id",
  "product_name",
  "brand",
  "category",
  "slug",
  "external_url",
  "affiliate_url",
  "price",
  "shipping_known",
  "in_stock",
  "is_for_sale",
];

const CANONICAL_RETAILER_FEED_FORBIDDEN_COLUMNS = [
  "gtin",
  "product_gtin_verified",
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "unit_count",
  "unit_type",
  "unit_pricing_verified",
  "nutrition_verified",
];

function isCanonicalRetailerFeedRow(row) {
  return CANONICAL_RETAILER_FEED_SIGNATURE_COLUMNS.every((column) =>
    rowHasColumn(row, column)
  );
}

function normalizeCanonicalRetailerFeedRows(rows) {
  if (!rows.length || !isCanonicalRetailerFeedRow(rows[0])) {
    return rows;
  }

  const headerRow = rows[0];
  const missingColumns = CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS.filter(
    (column) => !rowHasColumn(headerRow, column)
  );
  const forbiddenColumns = CANONICAL_RETAILER_FEED_FORBIDDEN_COLUMNS.filter(
    (column) => rowHasColumn(headerRow, column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Canonical retailer feed missing required column(s): ${missingColumns.join(", ")}`
    );
  }

  if (forbiddenColumns.length > 0) {
    throw new Error(
      `Canonical retailer feed contains forbidden column(s): ${forbiddenColumns.join(", ")}`
    );
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;

    for (const column of CANONICAL_RETAILER_FEED_REQUIRED_COLUMNS) {
      required(row[column], column, rowNumber);
    }

    const shippingKnown = parseRequiredBoolean(row.shipping_known, "shipping_known");
    const shippingInput = String(row.shipping_cost ?? "").trim();
    let shippingCost = null;

    if (!shippingKnown && shippingInput) {
      throw new Error(
        `Row ${rowNumber}: shipping_cost must be blank when shipping_known is false`
      );
    }

    if (shippingKnown) {
      if (!shippingInput) {
        throw new Error(
          `Row ${rowNumber}: shipping_cost is required when shipping_known is true`
        );
      }

      shippingCost = parseFiniteNumber(shippingInput, "shipping_cost");

      if (shippingCost < 0) {
        throw new Error(`Row ${rowNumber}: shipping_cost must be 0 or greater`);
      }
    }

    const size = String(row.size ?? "").trim();
    const sizeUnit = String(row.size_unit ?? "").trim();
    const normalizedSize = size && sizeUnit ? `${size} ${sizeUnit}` : size;
    const packCount = String(row.pack_count ?? "").trim();
    const variantEvidence = [
      String(row.variant_name ?? "").trim(),
      packCount ? `pack of ${packCount}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      ...row,
      variant: variantEvidence,
      size: normalizedSize,
      shipping_cost: shippingCost,
      delivery_cost: undefined,
    };
  });
}

function optionalBoolean(row, fieldName, rowNumber) {
  if (!rowHasColumn(row, fieldName)) {
    return undefined;
  }

  const cleaned = String(row[fieldName] || "").trim().toLowerCase();

  if (!cleaned) {
    return false;
  }

  if (["true", "1", "yes", "y"].includes(cleaned)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(cleaned)) {
    return false;
  }

  throw new Error(`Row ${rowNumber}: ${fieldName} must be a boolean`);
}

function buildRetailerProductPayload({
  row,
  retailerId,
  productId,
  name,
  slug,
  offerUrl,
  matchMethod,
  matchConfidence,
  includeUpdatedAt = false,
}) {
  const payload = {
    retailer_id: retailerId,
    product_id: productId,
    external_name: name,
    external_slug: slug,
    external_gtin: getExternalGtin(row),
    external_url: getRetailerProductUrl(row) || offerUrl,
    match_method: matchMethod,
    match_confidence: matchConfidence,
  };

  if (includeUpdatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  return payload;
}

function slugifyRetailerName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assignIfSupplied(target, fieldName, value) {
  if (value !== undefined) {
    target[fieldName] = value;
  }
}

function readNormalizedProductFields(row, rowNumber) {
  const fields = {};

  assignIfSupplied(
    fields,
    "net_weight_g",
    optionalPositiveNumber(row, "net_weight_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "net_volume_ml",
    optionalPositiveNumber(row, "net_volume_ml", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_count_verified",
    optionalPositiveInteger(row, "serving_count_verified", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_size_g",
    optionalPositiveNumber(row, "serving_size_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "serving_size_ml",
    optionalPositiveNumber(row, "serving_size_ml", rowNumber)
  );
  assignIfSupplied(
    fields,
    "protein_per_serving_g",
    optionalNonNegativeNumber(row, "protein_per_serving_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "creatine_per_serving_g",
    optionalNonNegativeNumber(row, "creatine_per_serving_g", rowNumber)
  );
  assignIfSupplied(
    fields,
    "unit_count",
    optionalPositiveInteger(row, "unit_count", rowNumber)
  );
  assignIfSupplied(fields, "unit_type", optionalText(row, "unit_type"));
  assignIfSupplied(
    fields,
    "product_format",
    optionalText(row, "product_format")
  );
  assignIfSupplied(
    fields,
    "unit_pricing_verified",
    optionalBoolean(row, "unit_pricing_verified", rowNumber)
  );
  assignIfSupplied(
    fields,
    "nutrition_verified",
    optionalBoolean(row, "nutrition_verified", rowNumber)
  );

  if (
    fields.serving_size_g !== undefined &&
    fields.serving_size_g !== null &&
    fields.protein_per_serving_g !== undefined &&
    fields.protein_per_serving_g !== null &&
    fields.protein_per_serving_g > fields.serving_size_g
  ) {
    throw new Error(
      `Row ${rowNumber}: protein_per_serving_g cannot exceed serving_size_g`
    );
  }

  if (
    fields.serving_size_g !== undefined &&
    fields.serving_size_g !== null &&
    fields.creatine_per_serving_g !== undefined &&
    fields.creatine_per_serving_g !== null &&
    fields.creatine_per_serving_g > fields.serving_size_g
  ) {
    throw new Error(
      `Row ${rowNumber}: creatine_per_serving_g cannot exceed serving_size_g`
    );
  }

  if (fields.product_format === "liquid") {
    if (fields.net_weight_g !== undefined && fields.net_weight_g !== null) {
      throw new Error(
        `Row ${rowNumber}: liquid products must use net_volume_ml instead of net_weight_g`
      );
    }

    if (fields.serving_size_g !== undefined && fields.serving_size_g !== null) {
      throw new Error(
        `Row ${rowNumber}: liquid products must use serving_size_ml instead of serving_size_g`
      );
    }
  } else {
    if (fields.net_volume_ml !== undefined && fields.net_volume_ml !== null) {
      throw new Error(`Row ${rowNumber}: net_volume_ml requires product_format liquid`);
    }

    if (fields.serving_size_ml !== undefined && fields.serving_size_ml !== null) {
      throw new Error(`Row ${rowNumber}: serving_size_ml requires product_format liquid`);
    }
  }

  return fields;
}

function buildProductData(row, rowNumber, mode = "manual") {
  const inputCategory = required(row.category, "category", rowNumber);
  const productData = {
    name: required(row.product_name, "product_name", rowNumber),
    slug: required(row.slug, "slug", rowNumber),
    gtin: getProductLevelGtin(row, mode),
    brand: required(row.brand, "brand", rowNumber),
    category: normalizeCategory(inputCategory),
    servings: extractServings(row),
    description:
      String(row.description || "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .replace("[EKM-AUTOGENERATED]", "")
        .trim() || null,
    image: String(row.image || row.merchant_image_url || "").trim() || null,
    price: optionalNumber(row.price),
    ...readNormalizedProductFields(row, rowNumber),
  };

  if (shouldLogCategoryNormalization(inputCategory, productData.category)) {
    console.log(
      `Category normalized: "${inputCategory}" -> "${productData.category}"`
    );
  }

  return productData;
}

const RETAILER_UPDATE_PROTECTED_PRODUCT_FIELDS = new Set([
  "gtin",
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "unit_count",
  "unit_type",
  "product_format",
  "unit_pricing_verified",
  "nutrition_verified",
]);

function buildExistingProductUpdateData(productData) {
  return Object.fromEntries(
    Object.entries(productData).filter(
      ([fieldName]) => !RETAILER_UPDATE_PROTECTED_PRODUCT_FIELDS.has(fieldName)
    )
  );
}

function priceHistoryTotal(price, shippingCost) {
  const productPrice = Number(price);

  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    return null;
  }

  if (shippingCost === null || shippingCost === undefined || shippingCost === "") {
    return null;
  }

  const shipping = Number(shippingCost);

  if (!Number.isFinite(shipping) || shipping < 0) {
    return null;
  }

  return Math.round((productPrice + shipping) * 100) / 100;
}

function validateFeedRowForWrites(row, rowNumber, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  const errors = [];

  function capture(fn) {
    try {
      fn();
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  capture(() => required(row.retailer_name, "retailer_name", rowNumber));
  if (safeCreate) {
    capture(() => required(row.retailer_website, "retailer_website", rowNumber));
    capture(() => required(row.image || row.merchant_image_url, "image", rowNumber));
    capture(() => required(getDirectRetailerProductUrl(row), "merchant_deep_link", rowNumber));
    capture(() => required(getOfferUrl(row), "aw_deep_link", rowNumber));
  }
  capture(() => required(row.product_name, "product_name", rowNumber));
  capture(() => required(row.slug, "slug", rowNumber));
  capture(() => required(getOfferUrl(row), "url", rowNumber));
  capture(() => required(row.brand, "brand", rowNumber));
  capture(() => required(row.category, "category", rowNumber));
  capture(() => {
    const inStock = parseRequiredBoolean(row.in_stock, "in_stock");

    if (safeCreate && !inStock) {
      throw new Error("in_stock must be true");
    }
  });
  if (safeCreate || rowHasColumn(row, "is_for_sale")) {
    capture(() => {
      if (safeCreate && !rowHasColumn(row, "is_for_sale")) {
        throw new Error("is_for_sale is required");
      }

      if (safeCreate && !parseRequiredBoolean(row.is_for_sale, "is_for_sale")) {
        throw new Error("is_for_sale must be true");
      }

      parseRequiredBoolean(row.is_for_sale, "is_for_sale");
    });
  }

  capture(() => {
    const price = parseFiniteNumber(row.price, "price");

    if (price <= 0) {
      throw new Error("price must be greater than 0");
    }
  });

  capture(() => {
    const shipping = parseOptionalFiniteNumber(
      getInputShippingValue(row),
      "shipping_cost"
    );

    if (shipping !== null && shipping < 0) {
      throw new Error("shipping_cost must be 0 or greater");
    }
  });

  capture(() => extractServings(row));
  capture(() => readNormalizedProductFields(row, rowNumber));

  return errors;
}

async function findOrCreateRetailer(row, rowNumber) {
  const supabase = getSupabase();
  const name = required(row.retailer_name, "retailer_name", rowNumber);
  const website = required(
    row.retailer_website,
    "retailer_website",
    rowNumber
  );

  const slug = slugifyRetailerName(name);

  const { data: existingRetailer, error: findError } = await supabase
    .from("retailers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existingRetailer) {
    return existingRetailer.id;
  }

  const { data: newRetailer, error: insertError } = await supabase
    .from("retailers")
    .insert({
      name,
      slug,
      website,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  console.log(`Created retailer: ${name}`);
  return newRetailer.id;
}
function extractServings(row) {
  const directServings = optionalNumber(row.servings);

  if (directServings !== null) {
    return directServings;
  }

  const text = `${row.product_name || ""} ${row.description || ""}`;

  const patterns = [
    /(\d+)\s*servings?/i,
    /(\d+)\s*serves?/i,
    /(\d+)\s*portions?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}
function normalizeProductName(name = "") {
  return name
    .toLowerCase()
    .replace(/\b(gym high|capsules|caps|powder|servings|serves)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findOrCreateProduct(row, rowNumber, retailerId, options = {}) {
  const supabase = getSupabase();
  const name = required(row.product_name, "product_name", rowNumber);
  const slug = required(row.slug, "slug", rowNumber);
  const offerUrl = required(getRetailerProductUrl(row), "url", rowNumber);
  const mode = options.mode || "manual";
  const productLevelGtin = getProductLevelGtin(row, mode);
  const feedStyleRow = mode === "feed";

  if (feedStyleRow && isAmbiguousFeedRow(row)) {
    throw new Error(
      `Row ${rowNumber}: ambiguous feed row skipped for "${name}": ambiguous variant identity`
    );
  }

  const { data: existingMapping, error: mappingFindError } = await supabase
    .from("retailer_products")
    .select("product_id, external_gtin")
    .eq("retailer_id", retailerId)
    .eq("external_url", offerUrl)
    .maybeSingle();

  if (mappingFindError) {
    throw mappingFindError;
  }

  if (existingMapping && !feedStyleRow) {
    console.log(`Matched product by retailer mapping: ${name}`);
    return existingMapping.product_id;
  }

  const productData = buildProductData(row, rowNumber, mode);

  let existingProduct = existingMapping
    ? { id: existingMapping.product_id }
    : null;

  if (productLevelGtin) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("gtin", productLevelGtin)
      .maybeSingle();

    if (error) {
      throw error;
    }

    existingProduct = data;
  }

  if (!existingProduct) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw error;
    }

    existingProduct = data;
  }



  if (existingProduct) {
    if (feedStyleRow) {
      const { data: existingProductDetails, error: existingProductDetailsError } =
        await supabase
          .from("products")
          .select("id, name, brand, category")
          .eq("id", existingProduct.id)
          .single();

      if (existingProductDetailsError) {
        throw existingProductDetailsError;
      }

      const compatibility = assessVariantCompatibility(row, existingProductDetails);

      if (!compatibility.compatible || compatibility.ambiguous) {
        throw new Error(
          `Row ${rowNumber}: ambiguous feed row skipped for "${name}": ${compatibility.reasons.join(", ") || "ambiguous variant identity"}`
        );
      }
    }

    if (!feedStyleRow) {
      const productUpdateData = buildExistingProductUpdateData(productData);

      const { error: updateError } = await supabase
        .from("products")
        .update(productUpdateData)
        .eq("id", existingProduct.id);

      if (updateError) {
        throw updateError;
      }
    }

    const { error: mappingError } = await supabase
      .from("retailer_products")
      .upsert(
        buildRetailerProductPayload({
          row,
          retailerId,
          productId: existingProduct.id,
          name,
          slug,
          offerUrl,
          matchMethod: productLevelGtin ? "gtin" : "slug",
          matchConfidence: productLevelGtin ? 100 : 90,
          includeUpdatedAt: true,
        }),
        {
          onConflict: "retailer_id,external_url",
        }
      );

    if (mappingError) {
      throw mappingError;
    }

    console.log(`Updated product: ${name}`);
    return existingProduct.id;
  }

  const normalizedName = normalizeProductName(name);

const { data: similarProducts, error: similarProductsError } = await supabase
  .from("products")
  .select("id, name, brand, category")
  .eq("brand", productData.brand)
  .eq("category", productData.category);

if (similarProductsError) {
  throw similarProductsError;
}

const possibleMatch = similarProducts?.find(
  (product) => normalizeProductName(product.name) === normalizedName
);

if (possibleMatch) {
  throw new Error(
    `Possible duplicate product found: "${name}" may match product ID ${possibleMatch.id} "${possibleMatch.name}". Review manually before importing.`
  );
}
  const { data: newProduct, error: insertError } = await supabase
    .from("products")
    .insert(productData)
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: mappingError } = await supabase
    .from("retailer_products")
    .insert(buildRetailerProductPayload({
      row,
      retailerId,
      productId: newProduct.id,
      name,
      slug,
      offerUrl,
      matchMethod: "new_product",
      matchConfidence: 100,
    }));

  if (mappingError) {
    throw mappingError;
  }

  console.log(`Created product: ${name}`);
  return newProduct.id;
}

async function createOrUpdateOffer(row, productId, retailerId, rowNumber) {
  const supabase = getSupabase();
  const price = optionalNumber(
    required(row.price, "price", rowNumber)
  );

  const offerData = {
    product_id: productId,
    retailer_id: retailerId,
    price,
    shipping_cost: optionalNumber(getInputShippingValue(row)),
    url: required(getOfferUrl(row), "url", rowNumber),
    in_stock: parseBoolean(row.in_stock),
    last_checked_at: new Date().toISOString(),
  };
  offerData.total_price = priceHistoryTotal(offerData.price, offerData.shipping_cost);

  const { data: existingOffers, error: findError } = await supabase
    .from("offers")
    .select("id, price, shipping_cost")
    .eq("product_id", productId)
    .eq("retailer_id", retailerId)
    .limit(1);

  if (findError) {
    throw findError;
  }

  const existingOffer = existingOffers?.[0];

  if (existingOffer) {
    const oldPrice = Number(existingOffer.price);
    const oldShipping =
      existingOffer.shipping_cost === null ||
      existingOffer.shipping_cost === undefined ||
      existingOffer.shipping_cost === ""
        ? null
        : Number(existingOffer.shipping_cost);

    const newPrice = Number(offerData.price);
    const incomingShipping =
      offerData.shipping_cost === null ||
      offerData.shipping_cost === undefined ||
      offerData.shipping_cost === ""
        ? null
        : Number(offerData.shipping_cost);
    const effectiveShipping =
      incomingShipping === null ? oldShipping : incomingShipping;
    const updateOfferData = {
      ...offerData,
      shipping_cost: effectiveShipping,
      total_price: priceHistoryTotal(offerData.price, effectiveShipping),
    };

    const priceChanged =
      oldPrice !== newPrice || oldShipping !== effectiveShipping;
    const { data: updatedOffer, error: updateError } = await supabase
      .from("offers")
      .update(updateOfferData)
      .eq("id", existingOffer.id)
      .select("id")
      .single();

    if (updateError) {
      throw updateError;
    }
    if (priceChanged) {
      const { error: historyError } = await supabase
        .from("price_history")
        .insert({
          offer_id: updatedOffer.id,
          price: updateOfferData.price,
          shipping_cost: updateOfferData.shipping_cost,
          total_price: updateOfferData.total_price,
          checked_at: updateOfferData.last_checked_at,
        });

      if (historyError) {
        throw historyError;
      }

      console.log(`Price changed: ${row.product_name} at ${row.retailer_name}`);
    }

    console.log(`Updated offer: ${row.product_name} at ${row.retailer_name}`);
    return;
  }

  const { data: newOffer, error: insertError } = await supabase
    .from("offers")
    .insert(offerData)
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }
  const { error: historyError } = await supabase
    .from("price_history")
    .insert({
      offer_id: newOffer.id,
      price: offerData.price,
      shipping_cost: offerData.shipping_cost,
      total_price: priceHistoryTotal(offerData.price, offerData.shipping_cost),
      checked_at: offerData.last_checked_at,
    });

  if (historyError) {
    throw historyError;
  }
  console.log(`Created offer: ${row.product_name} at ${row.retailer_name}`);
}

async function findExistingOfferForPreflight(productId, retailerId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("offers")
    .select("id, price, shipping_cost, total_price, in_stock, url")
    .eq("product_id", productId)
    .eq("retailer_id", retailerId)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

function buildOfferPlan(row, existingOffer) {
  if (!existingOffer) {
    return {
      action: "create",
      priceChanged: false,
      shippingChanged: false,
      stockChanged: false,
      urlChanged: false,
      createsPriceHistory: true,
    };
  }

  const incomingPrice = optionalNumber(row.price);
  const existingShipping = optionalNumber(existingOffer.shipping_cost);
  const incomingShipping = optionalNumber(getInputShippingValue(row));
  const effectiveShipping =
    incomingShipping === null ? existingShipping : incomingShipping;
  const priceChanged = Number(existingOffer.price) !== Number(incomingPrice);
  const shippingChanged = existingShipping !== effectiveShipping;
  const stockChanged = Boolean(existingOffer.in_stock) !== parseBoolean(row.in_stock);
  const urlChanged = String(existingOffer.url || "") !== getOfferUrl(row);

  return {
    action:
      priceChanged || shippingChanged || stockChanged || urlChanged
        ? "update"
        : "unchanged",
    priceChanged,
    shippingChanged,
    stockChanged,
    urlChanged,
    createsPriceHistory: priceChanged || shippingChanged,
  };
}

async function findRetailerBySlug(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("retailers")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function planRetailer(row) {
  const name = String(row.retailer_name || "").trim();

  if (!name) {
    return null;
  }

  return {
    name,
    slug: slugifyRetailerName(name),
    website: String(row.retailer_website || "").trim() || null,
  };
}

async function findProductById(productId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findProductForFeedRow(row) {
  const supabase = getSupabase();
  const productLevelGtin = getProductLevelGtin(row, "feed");

  if (productLevelGtin) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, category, gtin, slug")
      .eq("gtin", productLevelGtin)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug")
    .eq("slug", required(row.slug, "slug", 0))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findRetailerMapping(retailerId, offerUrl) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("retailer_products")
    .select("product_id, external_gtin")
    .eq("retailer_id", retailerId)
    .eq("external_url", offerUrl)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findSimilarProductConflict(row) {
  const supabase = getSupabase();
  const productData = buildProductData(row, 0, "feed");
  const normalizedName = normalizeProductName(productData.name);

  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, gtin, slug")
    .eq("brand", productData.brand)
    .eq("category", productData.category);

  if (error) {
    throw error;
  }

  return (
    data?.find((product) => normalizeProductName(product.name) === normalizedName) ||
    null
  );
}

function planProduct(row) {
  return {
    name: String(row.product_name || "").trim(),
    slug: String(row.slug || "").trim(),
  };
}

async function resolveFeedRow(row, rowNumber, options = {}) {
  const safeCreate = Boolean(options.safeCreate);
  let shippingNormalizedRow = row;
  let shippingInferredFromPolicy = false;
  const shippingErrors = [];

  try {
    const shippingResult = normalizeShippingForImport(row, "feed");
    shippingNormalizedRow = shippingResult.row;
    shippingInferredFromPolicy = shippingResult.shippingInferredFromPolicy;
  } catch (error) {
    shippingErrors.push(error?.message || String(error));
  }

  const validationErrors = [
    ...validateFeedRowForWrites(shippingNormalizedRow, rowNumber, { safeCreate }),
    ...shippingErrors,
  ];
  const retailerName = String(shippingNormalizedRow.retailer_name || "").trim();
  const offerUrl = getRetailerProductUrl(shippingNormalizedRow);
  const retailer = retailerName
    ? await findRetailerBySlug(slugifyRetailerName(retailerName))
    : null;
  let mapping = null;
  let product = null;
  let plannedRetailer = null;
  let plannedProduct = null;
  let existingOffer = null;

  if (retailer) {
    mapping = await findRetailerMapping(retailer.id, offerUrl);

    if (mapping) {
      product = await findProductById(mapping.product_id);
    }
  }

  if (!product && String(shippingNormalizedRow.slug || "").trim()) {
    product = await findProductForFeedRow(shippingNormalizedRow);
  }

  if (safeCreate && validationErrors.length === 0) {
    if (!retailer) {
      plannedRetailer = planRetailer(shippingNormalizedRow);
    }

    if (!product) {
      plannedProduct = planProduct(shippingNormalizedRow);

      if (!isSafeCreateRowAmbiguous(shippingNormalizedRow)) {
        const conflict = await findSimilarProductConflict(shippingNormalizedRow);

        if (conflict) {
          validationErrors.push(
            `possible duplicate product found: may match product ID ${conflict.id} "${conflict.name}"`
          );
        }
      }
    }
  }

  if (validationErrors.length === 0 && retailer?.id && product?.id) {
    existingOffer = await findExistingOfferForPreflight(product.id, retailer.id);
  }

  const offerPlan =
    validationErrors.length === 0
      ? buildOfferPlan(shippingNormalizedRow, existingOffer)
      : null;

  return {
    row: shippingNormalizedRow,
    rowNumber,
    retailer,
    product,
    mapping,
    plannedRetailer,
    plannedProduct,
    existingOffer,
    offerPlan,
    validationErrors,
    shippingInferredFromPolicy,
  };
}

async function preflightFeedRows(rows, options = {}) {
  const resolvedRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    resolvedRows.push(await resolveFeedRow(rows[index], index + 2, options));
  }

  return analyzeFeedRows(resolvedRows, options);
}

async function writeApprovedFeedRow(preflightItem) {
  const { row, rowNumber, retailer, product } = preflightItem;
  const productLevelGtin = getProductLevelGtin(row, "feed");
  let retailerId = retailer?.id;
  let productId = product?.id;

  const supabase = getSupabase();

  // The feed preflight catches deterministic row issues before this point, but
  // these writes are not wrapped in one database transaction; unexpected
  // database or network failures can still interrupt an approved row.
  if (!retailerId) {
    retailerId = await findOrCreateRetailer(row, rowNumber);
  }

  if (!productId) {
    const productData = buildProductData(row, rowNumber, "feed");
    const createProductData = { ...productData };

    if (!productLevelGtin) {
      delete createProductData.gtin;
    }

    const { data: newProduct, error: insertProductError } = await supabase
      .from("products")
      .insert(createProductData)
      .select("id")
      .single();

    if (insertProductError) {
      throw insertProductError;
    }

    productId = newProduct.id;
  }

  const { error: mappingError } = await supabase
    .from("retailer_products")
    .upsert(
      buildRetailerProductPayload({
        row,
        retailerId,
        productId,
        name: required(row.product_name, "product_name", rowNumber),
        slug: required(row.slug, "slug", rowNumber),
        offerUrl: required(getRetailerProductUrl(row), "url", rowNumber),
        matchMethod: productLevelGtin ? "gtin" : "slug",
        matchConfidence: productLevelGtin ? 100 : 90,
        includeUpdatedAt: true,
      }),
      {
        onConflict: "retailer_id,external_url",
      }
    );

  if (mappingError) {
    throw mappingError;
  }

  await createOrUpdateOffer(row, productId, retailerId, rowNumber);
}

async function runImportRows(rows, options = {}) {
  const mode = options.mode || "manual";
  const dryRun = Boolean(options.dryRun);
  const safeCreate = Boolean(options.safeCreate);

  if (mode === "feed") {
    rows = normalizeCanonicalRetailerFeedRows(rows);
  }

  if (mode === "feed") {
    const report = await preflightFeedRows(rows, { safeCreate });

    console.log(formatPreflightReport(report));

    if (dryRun) {
      console.log("Dry run: no database writes performed.");
      return {
        successful: 0,
        failed: 0,
        planned: report.approvedRows.length,
        skipped: rows.length - report.approvedRows.length,
        report,
      };
    }

    let successful = 0;
    let failed = 0;

    for (const item of report.approvedRows) {
      try {
        await writeApprovedFeedRow(item);
        successful += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `Row ${item.rowNumber} failed:`,
          error?.message || String(error)
        );
      }
    }

    return {
      successful,
      failed,
      planned: 0,
      skipped: rows.length - successful - failed,
      report,
    };
  }

  let successful = 0;
  let failed = 0;

  if (dryRun) {
    console.log("Dry run: no database writes performed.");
    return { successful: 0, failed: 0, planned: 0, skipped: rows.length, report: null };
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;

    try {
      const retailerId = await findOrCreateRetailer(row, rowNumber);
      const productId = await findOrCreateProduct(row, rowNumber, retailerId);

      if (!dryRun) {
        await createOrUpdateOffer(row, productId, retailerId, rowNumber);
      }

      successful += 1;
    } catch (error) {
      failed += 1;
      console.error(`Row ${rowNumber} failed:`, error?.message || error);
    }
  }

  return { successful, failed, planned: 0, skipped: 0, report: null };
}

function parseArgs(argv) {
  const options = {
    mode: "manual",
    dryRun: false,
    safeCreate: false,
    csvPath: path.join(process.cwd(), "products-import.csv"),
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--safe-create") {
      options.safeCreate = true;
    } else if (arg === "--mode=feed") {
      options.mode = "feed";
    } else if (arg === "--mode=manual") {
      options.mode = "manual";
    } else if (arg.startsWith("--mode=")) {
      throw new Error(`Unsupported import mode: ${arg.slice("--mode=".length)}`);
    } else if (arg.startsWith("--csv=")) {
      options.csvPath = path.resolve(process.cwd(), arg.slice("--csv=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.safeCreate && options.mode !== "feed") {
    throw new Error("--safe-create is only supported with --mode=feed");
  }

  return options;
}

async function runImport(options = parseArgs(process.argv.slice(2))) {
  const csvPath = options.csvPath;

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Found ${rows.length} CSV row(s).`);
  const result = await runImportRows(rows, options);

  console.log("");
  console.log("Import finished.");
  console.log(`Successful: ${result.successful}`);
  if (options.dryRun && result.planned > 0) {
    console.log(`Approved rows planned: ${result.planned}`);
  }
  console.log(`Skipped for review: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);

  if (result.failed > 0) {
    process.exitCode = 1;
  }

  return result;
}

if (require.main === module) {
  runImport().catch((error) => {
    console.error("Import failed:", error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  assessVariantCompatibility,
  buildRetailerProductPayload,
  formatPreflightReport,
  findOrCreateProduct,
  getExternalGtin,
  getProductLevelGtin,
  getOfferUrl,
  getRetailerProductUrl,
  isAmbiguousFeedRow,
  isProductGtinVerified,
  parseArgs,
  parseFlavour,
  parsePackCount,
  parseProductFormat,
  parseStrictBoolean,
  parseSize,
  parseVariantIdentity,
  preflightFeedRows,
  normalizeCategory,
  normalizeCanonicalRetailerFeedRows,
  normalizeShippingForImport,
  priceHistoryTotal,
  runImport,
  runImportRows,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
};
