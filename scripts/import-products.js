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
    external_url: offerUrl,
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
    image: String(row.image || "").trim() || null,
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

  return productPrice + shipping;
}

function validateFeedRowForWrites(row, rowNumber) {
  const errors = [];

  function capture(fn) {
    try {
      fn();
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  capture(() => required(row.retailer_name, "retailer_name", rowNumber));
  capture(() => required(row.product_name, "product_name", rowNumber));
  capture(() => required(row.slug, "slug", rowNumber));
  capture(() => required(row.url, "url", rowNumber));
  capture(() => required(row.brand, "brand", rowNumber));
  capture(() => required(row.category, "category", rowNumber));
  capture(() => parseRequiredBoolean(row.in_stock, "in_stock"));

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
  const offerUrl = required(row.url, "url", rowNumber);
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

    const productUpdateData = { ...productData };

    if (feedStyleRow && !productLevelGtin) {
      delete productUpdateData.gtin;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update(productUpdateData)
      .eq("id", existingProduct.id);

    if (updateError) {
      throw updateError;
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
    url: required(row.url, "url", rowNumber),
    in_stock: parseBoolean(row.in_stock),
    last_checked_at: new Date().toISOString(),
  };

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
    const newShipping =
      offerData.shipping_cost === null ||
      offerData.shipping_cost === undefined ||
      offerData.shipping_cost === ""
        ? null
        : Number(offerData.shipping_cost);

    const priceChanged =
      oldPrice !== newPrice || oldShipping !== newShipping;
    const { data: updatedOffer, error: updateError } = await supabase
      .from("offers")
      .update(offerData)
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
          price: offerData.price,
          shipping_cost: offerData.shipping_cost,
          total_price: priceHistoryTotal(offerData.price, offerData.shipping_cost),
          checked_at: offerData.last_checked_at,
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

async function resolveFeedRow(row, rowNumber) {
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
    ...validateFeedRowForWrites(shippingNormalizedRow, rowNumber),
    ...shippingErrors,
  ];
  const retailerName = String(shippingNormalizedRow.retailer_name || "").trim();
  const offerUrl = String(shippingNormalizedRow.url || "").trim();
  const retailer = retailerName
    ? await findRetailerBySlug(slugifyRetailerName(retailerName))
    : null;
  let mapping = null;
  let product = null;

  if (retailer) {
    mapping = await findRetailerMapping(retailer.id, offerUrl);

    if (mapping) {
      product = await findProductById(mapping.product_id);
    }
  }

  if (!product && String(shippingNormalizedRow.slug || "").trim()) {
    product = await findProductForFeedRow(shippingNormalizedRow);
  }

  return {
    row: shippingNormalizedRow,
    rowNumber,
    retailer,
    product,
    mapping,
    validationErrors,
    shippingInferredFromPolicy,
  };
}

async function preflightFeedRows(rows) {
  const resolvedRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    resolvedRows.push(await resolveFeedRow(rows[index], index + 2));
  }

  return analyzeFeedRows(resolvedRows);
}

async function writeApprovedFeedRow(preflightItem) {
  const { row, rowNumber, retailer, product } = preflightItem;
  const productData = buildProductData(row, rowNumber, "feed");
  const productUpdateData = { ...productData };
  const productLevelGtin = getProductLevelGtin(row, "feed");

  if (!productLevelGtin || product.gtin === productLevelGtin) {
    delete productUpdateData.gtin;
  }

  const supabase = getSupabase();

  // The feed preflight catches deterministic row issues before this point, but
  // these writes are not wrapped in one database transaction; unexpected
  // database or network failures can still interrupt an approved row.
  const { error: updateError } = await supabase
    .from("products")
    .update(productUpdateData)
    .eq("id", product.id);

  if (updateError) {
    throw updateError;
  }

  const { error: mappingError } = await supabase
    .from("retailer_products")
    .upsert(
      buildRetailerProductPayload({
        row,
        retailerId: retailer.id,
        productId: product.id,
        name: required(row.product_name, "product_name", rowNumber),
        slug: required(row.slug, "slug", rowNumber),
        offerUrl: required(row.url, "url", rowNumber),
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

  await createOrUpdateOffer(row, product.id, retailer.id, rowNumber);
}

async function runImportRows(rows, options = {}) {
  const mode = options.mode || "manual";
  const dryRun = Boolean(options.dryRun);

  if (mode === "feed") {
    const report = await preflightFeedRows(rows);

    console.log(formatPreflightReport(report));

    if (dryRun) {
      console.log("Dry run: no database writes performed.");
      return { successful: 0, failed: 0, skipped: rows.length, report };
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
      skipped: rows.length - successful - failed,
      report,
    };
  }

  let successful = 0;
  let failed = 0;

  if (dryRun) {
    console.log("Dry run: no database writes performed.");
    return { successful: 0, failed: 0, skipped: rows.length, report: null };
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

  return { successful, failed, skipped: 0, report: null };
}

function parseArgs(argv) {
  const options = {
    mode: "manual",
    dryRun: false,
    csvPath: path.join(process.cwd(), "products-import.csv"),
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
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
  getExternalGtin,
  getProductLevelGtin,
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
  normalizeShippingForImport,
  priceHistoryTotal,
  runImport,
  runImportRows,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
};
