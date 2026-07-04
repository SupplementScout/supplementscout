const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function required(value, fieldName, rowNumber) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`Row ${rowNumber}: missing ${fieldName}`);
  }

  return cleaned;
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

  return fields;
}

async function findOrCreateRetailer(row, rowNumber) {
  const name = required(row.retailer_name, "retailer_name", rowNumber);
  const website = required(
    row.retailer_website,
    "retailer_website",
    rowNumber
  );

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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

async function findOrCreateProduct(row, rowNumber, retailerId) {
  const name = required(row.product_name, "product_name", rowNumber);
  const slug = required(row.slug, "slug", rowNumber);
  const offerUrl = required(row.url, "url", rowNumber);

  const { data: existingMapping, error: mappingFindError } = await supabase
    .from("retailer_products")
    .select("product_id")
    .eq("retailer_id", retailerId)
    .eq("external_url", offerUrl)
    .maybeSingle();

  if (mappingFindError) {
    throw mappingFindError;
  }

  if (existingMapping) {
    console.log(`Matched product by retailer mapping: ${name}`);
    return existingMapping.product_id;
  }

  const productData = {
    name,
    slug,
    gtin: String(row.gtin || "").trim() || null,
    brand: required(row.brand, "brand", rowNumber),
    category: required(row.category, "category", rowNumber),
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

  let existingProduct = null;

  const gtin = String(row.gtin || "").trim();

  if (gtin) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("gtin", gtin)
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
    const { error: updateError } = await supabase
      .from("products")
      .update(productData)
      .eq("id", existingProduct.id);

    if (updateError) {
      throw updateError;
    }

    const { error: mappingError } = await supabase
      .from("retailer_products")
      .upsert(
        {
          retailer_id: retailerId,
          product_id: existingProduct.id,
          external_name: name,
          external_slug: slug,
          external_gtin: gtin || null,
          external_url: offerUrl,
          match_method: gtin ? "gtin" : "slug",
          match_confidence: gtin ? 100 : 90,
          updated_at: new Date().toISOString(),
        },
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
    .insert({
      retailer_id: retailerId,
      product_id: newProduct.id,
      external_name: name,
      external_slug: slug,
      external_gtin: gtin || null,
      external_url: offerUrl,
      match_method: "new_product",
      match_confidence: 100,
    });

  if (mappingError) {
    throw mappingError;
  }

  console.log(`Created product: ${name}`);
  return newProduct.id;
}

async function createOrUpdateOffer(row, productId, retailerId, rowNumber) {
  const price = optionalNumber(
    required(row.price, "price", rowNumber)
  );

  const offerData = {
    product_id: productId,
    retailer_id: retailerId,
    price,
    shipping_cost: optionalNumber(row.shipping_cost),
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
    const oldShipping = Number(existingOffer.shipping_cost || 0);

    const newPrice = Number(offerData.price);
    const newShipping = Number(offerData.shipping_cost || 0);

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
          total_price: newPrice + newShipping,
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
      total_price:
        Number(offerData.price) + Number(offerData.shipping_cost || 0),
      checked_at: offerData.last_checked_at,
    });

  if (historyError) {
    throw historyError;
  }
  console.log(`Created offer: ${row.product_name} at ${row.retailer_name}`);
}

async function runImport() {
  const csvPath = path.join(process.cwd(), "products-import.csv");

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

  let successful = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;

    try {
      const retailerId = await findOrCreateRetailer(row, rowNumber);
      const productId = await findOrCreateProduct(
        row,
        rowNumber,
        retailerId
      );

      await createOrUpdateOffer(
        row,
        productId,
        retailerId,
        rowNumber
      );

      successful += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Row ${rowNumber} failed:`,
        error?.message || error
      );
    }
  }

  console.log("");
  console.log("Import finished.");
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runImport().catch((error) => {
  console.error("Import failed:", error?.message || error);
  process.exit(1);
});
