const { parse } = require("csv-parse/sync");

const TEN_REPS_COLUMNS = Object.freeze([
  "product_id", "variant_id", "product_name", "brand", "category", "variant_name", "flavour", "size", "sku", "ean",
  "price", "sale_price", "current_price", "stock_status", "product_url", "image_url", "last_updated",
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function exactPrice(value) {
  const text = String(value || "").trim();
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(text) || BigInt(text.replace(".", "").padEnd(text.includes(".") ? text.length + (2 - text.split(".")[1].length) : text.length + 2, "0")) <= 0n) {
    fail("RA004_CANONICAL_PRICE_INVALID", "10 Reps canonical connector found an invalid current price");
  }
  const [whole, fraction = ""] = text.split(".");
  return { source: text, minor: `${BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0")}` };
}

function variantLabel(row) {
  return String(row.variant_name || row.flavour || row.size || "") || null;
}

function connectTenRepsCsv(bytes, { storeUrl, capturedAt }) {
  if (!Buffer.isBuffer(bytes)) fail("RA004_CANONICAL_BYTES_REQUIRED", "10 Reps canonical connector requires raw CSV bytes");
  if (!Number.isFinite(Date.parse(capturedAt)) || !String(capturedAt).endsWith("Z")) fail("RA004_CANONICAL_TIMESTAMP_INVALID", "10 Reps capture timestamp must be UTC");
  const rows = parse(bytes, { columns: true, skip_empty_lines: true, bom: true });
  if (!rows.length) fail("RA004_CANONICAL_EMPTY", "10 Reps canonical CSV is empty");
  if (JSON.stringify(Object.keys(rows[0])) !== JSON.stringify(TEN_REPS_COLUMNS)) fail("RA004_CANONICAL_HEADERS", "10 Reps canonical CSV must have the exact 17-column contract");
  const store = new URL(storeUrl);
  const seen = new Set();
  const evidenceRows = [];
  const rawRecords = rows.map((row, index) => {
    const productId = String(row.product_id || "").trim();
    const variantId = String(row.variant_id || "").trim();
    if (!/^\d+$/.test(productId) || !/^\d+$/.test(variantId) || seen.has(variantId)) fail("RA004_CANONICAL_IDENTITY_INVALID", "10 Reps canonical connector found an invalid or duplicate identity");
    seen.add(variantId);
    const url = new URL(row.product_url);
    if (url.protocol !== "https:" || url.origin !== store.origin || url.username || url.password || url.hash) fail("RA004_CANONICAL_URL_INVALID", "10 Reps canonical connector found a URL outside the retailer origin");
    const stock = { instock: "IN_STOCK", outofstock: "OUT_OF_STOCK", onbackorder: "OUT_OF_STOCK" }[row.stock_status];
    if (!stock) fail("RA004_CANONICAL_STOCK_INVALID", "10 Reps canonical connector found an unknown stock status");
    const price = exactPrice(row.current_price);
    const lastUpdated = String(row.last_updated || "").trim();
    if (lastUpdated && (!Number.isFinite(Date.parse(lastUpdated)) || !lastUpdated.endsWith("Z"))) fail("RA004_CANONICAL_TIMESTAMP_INVALID", "10 Reps canonical connector found an invalid UTC source timestamp");
    const evidence = Object.freeze({
      row_number: index + 2, product_id: productId, variant_id: variantId,
      product_name: String(row.product_name || ""), brand: String(row.brand || ""),
      variant_name: String(row.variant_name || ""), flavour: String(row.flavour || ""), size: String(row.size || ""),
      sku: String(row.sku || "").trim(), ean: String(row.ean || "").trim(),
      current_price: price.source, price_minor: price.minor, stock_status: String(row.stock_status), product_url: url.href,
      last_updated: lastUpdated || capturedAt,
    });
    evidenceRows.push(evidence);
    return Object.freeze({
      source_record_id: variantId,
      external_product_id: productId,
      external_variant_id: variantId,
      sku: evidence.sku || null,
      gtin: evidence.ean || null,
      product_name: evidence.product_name || null,
      brand: evidence.brand || null,
      variant: variantLabel(evidence),
      source_url: url.href,
      price: price.source,
      currency: "GBP",
      availability: stock,
    });
  });
  return Object.freeze({ requiredColumns: TEN_REPS_COLUMNS, rawRecords: Object.freeze(rawRecords), evidenceRows: Object.freeze(evidenceRows) });
}

module.exports = { TEN_REPS_COLUMNS, connectTenRepsCsv };
