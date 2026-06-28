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

function parseBoolean(value) {
  return ["true", "1", "yes", "y"].includes(
    String(value || "").trim().toLowerCase()
  );
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

async function findOrCreateProduct(row, rowNumber) {
  const name = required(row.product_name, "product_name", rowNumber);
  const slug = required(row.slug, "slug", rowNumber);

  const productData = {
    name,
    slug,
    brand: required(row.brand, "brand", rowNumber),
    category: required(row.category, "category", rowNumber),
    servings: optionalNumber(row.servings),
    description: String(row.description || "").trim() || null,
    image: String(row.image || "").trim() || null,
    price: optionalNumber(row.price),
  };

  const { data: existingProduct, error: findError } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existingProduct) {
    const { error: updateError } = await supabase
      .from("products")
      .update(productData)
      .eq("id", existingProduct.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated product: ${name}`);
    return existingProduct.id;
  }

  const { data: newProduct, error: insertError } = await supabase
    .from("products")
    .insert(productData)
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
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
    .select("id")
    .eq("product_id", productId)
    .eq("retailer_id", retailerId)
    .limit(1);

  if (findError) {
    throw findError;
  }

  const existingOffer = existingOffers?.[0];

  if (existingOffer) {
    const { error: updateError } = await supabase
      .from("offers")
      .update(offerData)
      .eq("id", existingOffer.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated offer: ${row.product_name} at ${row.retailer_name}`);
    return;
  }

  const { error: insertError } = await supabase
    .from("offers")
    .insert(offerData);

  if (insertError) {
    throw insertError;
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
      const productId = await findOrCreateProduct(row, rowNumber);

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