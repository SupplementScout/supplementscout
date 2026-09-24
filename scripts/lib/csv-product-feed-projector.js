const { parse } = require("csv-parse/sync");

const REQUIRED_COLUMNS = Object.freeze([
  "product_id", "variant_id", "product_name", "brand", "category", "variant_name", "flavour", "size", "sku", "ean",
  "price", "sale_price", "current_price", "stock_status", "product_url", "image_url", "last_updated",
]);

function invariant(value, message) { if (!value) throw new Error(message); }
function money(value) {
  invariant(/^\d+(?:\.\d{1,2})?$/.test(String(value || "").trim()) && Number(value) > 0, "CSV feed contains an invalid current price");
  return Number(value).toFixed(2);
}

function projectCsvRows(bytes, { storeUrl, capturedAt }) {
  const parsed = parse(bytes, { columns: true, skip_empty_lines: true, bom: true });
  invariant(parsed.length > 0, "CSV feed is empty");
  invariant(JSON.stringify(Object.keys(parsed[0])) === JSON.stringify(REQUIRED_COLUMNS), "CSV feed columns changed");
  const store = new URL(storeUrl), seen = new Set();
  const evidenceRows = [];
  const sourceVariants = parsed.map((row, index) => {
    const externalProductId = String(row.product_id || "").trim();
    const externalVariantId = String(row.variant_id || externalProductId).trim();
    invariant(/^\d+$/.test(externalProductId) && /^\d+$/.test(externalVariantId) && !seen.has(externalVariantId), "CSV feed contains an invalid or duplicate source identity");
    seen.add(externalVariantId);
    const url = new URL(row.product_url);
    invariant(url.protocol === "https:" && url.origin === store.origin && !url.username && !url.password && !url.hash, "CSV feed contains a product URL outside the retailer origin");
    invariant(["instock", "outofstock", "onbackorder"].includes(row.stock_status), "CSV feed contains an unknown stock status");
    evidenceRows.push(Object.freeze({
      row_number: index + 2,
      product_id: externalProductId,
      variant_id: externalVariantId,
      product_name: String(row.product_name || ""),
      brand: String(row.brand || ""),
      category: String(row.category || ""),
      variant_name: String(row.variant_name || ""),
      flavour: String(row.flavour || ""),
      size: String(row.size || ""),
      sku: String(row.sku || "").trim(),
      ean: String(row.ean || "").trim(),
      price: String(row.price || "").trim(),
      sale_price: String(row.sale_price || "").trim(),
      current_price: String(row.current_price || "").trim(),
      stock_status: String(row.stock_status || ""),
      product_url: url.href,
      image_url: String(row.image_url || ""),
      last_updated: String(row.last_updated || "").trim(),
    }));
    return {
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: String(row.sku || "").trim() || null,
      product_handle: url.pathname.replace(/^\/+|\/+$/g, "") || null,
      price: money(row.current_price),
      in_stock: row.stock_status === "instock",
      url: url.href,
      external_url: url.href,
      source_updated_at: String(row.last_updated || "").trim() || capturedAt,
    };
  });
  const products = [...new Set(sourceVariants.map(row => row.external_product_id))].map(id => ({
    external_product_id: id,
    variants: sourceVariants.filter(row => row.external_product_id === id).map(row => ({ external_variant_id: row.external_variant_id })),
  }));
  return { products, sourceVariants, evidenceRows: Object.freeze(evidenceRows) };
}

module.exports = { REQUIRED_COLUMNS, projectCsvRows };
