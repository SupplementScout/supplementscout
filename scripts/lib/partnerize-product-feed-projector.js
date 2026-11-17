const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { canonicalJson } = require("./canonical-json");

const REQUIRED_COLUMNS = Object.freeze([
  "sku", "mpn", "product_name", "brand", "color", "currency", "price", "condition", "product_url", "image_url",
  "category", "product_type", "availability", "shipping_cost", "gtin", "description", "additional_image", "sale_price",
  "unit_pricing_measure", "unit_pricing_base_measure", "unit_price",
]);
const IDENTITY_VERSION = "partnerize-source-identity-v1";
const IDENTITY_KEYS = Object.freeze(["contract_version", "sku", "mpn", "product_name", "brand", "color", "condition", "gtin", "unit_pricing_measure", "unit_pricing_base_measure", "merchant_url", "description_sha256"].sort());
const MAX_MINOR_UNITS = 999999999999n;
const digest = value => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
const invariant = (condition, code) => { if (!condition) throw new Error(code); };

function merchantLink(value, storeUrl) {
  try {
    invariant(typeof value === "string" && value === value.trim() && !/[\u0000-\u0020\u007f]/.test(value), "PARTNERIZE_PRODUCT_URL_INVALID");
    const source = new URL(value);
    const store = new URL(storeUrl);
    invariant(store.protocol === "https:" && source.protocol === "https:" && !source.username && !source.password && !source.hash, "PARTNERIZE_PRODUCT_URL_INVALID");
    let destination = source;
    if (source.origin !== store.origin) {
      invariant(source.origin === "https://prf.hn" && source.pathname.startsWith("/click/") && !source.search, "PARTNERIZE_PRODUCT_URL_INVALID");
      const marker = "/destination:";
      const at = source.pathname.indexOf(marker);
      invariant(at > 0 && source.pathname.indexOf(marker, at + marker.length) === -1, "PARTNERIZE_PRODUCT_URL_INVALID");
      const decoded = decodeURIComponent(source.pathname.slice(at + marker.length));
      invariant(!/[\u0000-\u0020\u007f]/.test(decoded), "PARTNERIZE_PRODUCT_URL_INVALID");
      destination = new URL(decoded);
    }
    invariant(destination.protocol === "https:" && destination.origin === store.origin && !destination.username && !destination.password && !destination.hash, "PARTNERIZE_PRODUCT_URL_INVALID");
    return { merchant_url: destination.href, affiliate_url: source.href };
  } catch {
    throw new Error("PARTNERIZE_PRODUCT_URL_INVALID");
  }
}

function minorUnits(value, currencySuffix, allowZero) {
  const pattern = currencySuffix ? /^(\d{1,10})(?:\.(\d{1,2}))? GBP$/ : /^(\d{1,10})(?:\.(\d{1,2}))?$/;
  const match = String(value).match(pattern);
  if (!match) return null;
  const result = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  return result > MAX_MINOR_UNITS || (!allowZero && result === 0n) ? null : result;
}

function money(value) {
  return value === null ? null : `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function sourceIdentity(row, merchantUrl) {
  return {
    contract_version: IDENTITY_VERSION,
    ...Object.fromEntries(["sku", "mpn", "product_name", "brand", "color", "condition", "gtin", "unit_pricing_measure", "unit_pricing_base_measure"].map(key => [key, row[key]])),
    merchant_url: merchantUrl,
    description_sha256: digest(row.description),
  };
}

function reviewedIdentityIndex(reviewedIdentities) {
  invariant(Array.isArray(reviewedIdentities), "PARTNERIZE_REVIEWED_IDENTITIES_INVALID");
  const result = new Map();
  for (const item of reviewedIdentities) {
    invariant(item && typeof item.sku === "string" && item.identity?.sku === item.sku
      && JSON.stringify(Object.keys(item).sort()) === JSON.stringify(["identity", "sha256", "sku"])
      && JSON.stringify(Object.keys(item.identity).sort()) === JSON.stringify(IDENTITY_KEYS)
      && Object.values(item.identity).every(value => typeof value === "string")
      && item.identity.contract_version === IDENTITY_VERSION && /^[0-9a-f]{64}$/.test(item.sha256 || "")
      && digest(item.identity) === item.sha256 && !result.has(item.sku), "PARTNERIZE_REVIEWED_IDENTITIES_INVALID");
    result.set(item.sku, item);
  }
  return result;
}

function projectPartnerizeRows(bytes, { storeUrl, reviewedIdentities = [] }) {
  const reviewed = reviewedIdentityIndex(reviewedIdentities);
  let parsed;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = parse(bytes, { columns: true, delimiter: "|", quote: false, bom: true, skip_empty_lines: true });
  } catch {
    throw new Error("PARTNERIZE_FEED_ENCODING_OR_SCHEMA_INVALID");
  }
  invariant(parsed.length > 0, "PARTNERIZE_FEED_EMPTY");
  invariant(JSON.stringify(Object.keys(parsed[0])) === JSON.stringify(REQUIRED_COLUMNS), "PARTNERIZE_FEED_COLUMNS_CHANGED");
  const store = new URL(storeUrl);
  invariant(store.protocol === "https:" && store.pathname === "/" && !store.username && !store.password && !store.hash && !store.search, "PARTNERIZE_STORE_ORIGIN_INVALID");
  const seen = new Set();
  const evidenceRows = parsed.map(row => Object.freeze({ ...row }));
  const sourceVariants = evidenceRows.map(row => {
    invariant(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(row.sku) && !seen.has(row.sku), "PARTNERIZE_SOURCE_IDENTITY_INVALID_OR_DUPLICATE");
    seen.add(row.sku);
    const errors = [];
    let link = { merchant_url: null, affiliate_url: null };
    try { link = merchantLink(row.product_url, storeUrl); } catch { errors.push("PRODUCT_URL_INVALID"); }
    if (row.currency !== "GBP") errors.push("CURRENCY_NOT_GBP");
    const regular = minorUnits(row.price, true, false);
    const sale = row.sale_price === "" ? null : minorUnits(row.sale_price, true, false);
    const shipping = minorUnits(row.shipping_cost, false, true);
    if (regular === null) errors.push("PRICE_INVALID");
    if (row.sale_price !== "" && (sale === null || regular === null || sale > regular)) errors.push("SALE_PRICE_INVALID");
    if (shipping === null) errors.push("SHIPPING_UNKNOWN_OR_INVALID");
    const stock = row.availability === "in stock" ? true : row.availability === "out of stock" ? false : null;
    if (stock === null) errors.push("AVAILABILITY_UNKNOWN");
    const selected = row.currency !== "GBP" || errors.includes("SALE_PRICE_INVALID") ? null : sale ?? regular;
    const total = selected !== null && shipping !== null ? selected + shipping : null;
    if (total !== null && total > MAX_MINOR_UNITS) errors.push("TOTAL_PRICE_INVALID");
    const identity = sourceIdentity(row, link.merchant_url);
    const identityHash = digest(identity);
    const expected = reviewed.get(row.sku);
    const changed = expected ? Object.keys(identity).filter(key => identity[key] !== expected.identity[key]) : [];
    const validation = {
      status: errors.length ? "INVALID" : "VALID",
      errors,
      identity_status: !expected ? "UNREVIEWED" : changed.length ? "DRIFT" : "VERIFIED",
      expected_identity_sha256: expected?.sha256 || null,
      observed_identity_sha256: identityHash,
      changed_identity_fields: changed,
    };
    return {
      external_product_id: row.sku, external_variant_id: row.sku, external_sku: row.sku, external_gtin: row.gtin,
      product_handle: link.merchant_url ? new URL(link.merchant_url).pathname.replace(/^\/+|\/+$/g, "") : null,
      price: money(selected), shipping_cost: money(shipping), total_price: money(total !== null && total <= MAX_MINOR_UNITS ? total : null), in_stock: stock,
      url: link.merchant_url, external_url: link.merchant_url, affiliate_url: link.affiliate_url,
      source_updated_at: null, source_identity: identity, source_validation: validation,
    };
  });
  return {
    products: sourceVariants.map(row => ({ external_product_id: row.external_product_id, variants: [{ external_variant_id: row.external_variant_id }] })),
    sourceVariants,
    evidenceRows: Object.freeze(evidenceRows),
    raw_source_fingerprint: digest(bytes),
    semantic_source_fingerprint: digest(sourceVariants),
  };
}

module.exports = { REQUIRED_COLUMNS, IDENTITY_VERSION, digest, merchantLink, projectPartnerizeRows };
