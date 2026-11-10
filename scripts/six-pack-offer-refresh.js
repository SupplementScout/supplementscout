const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { canonicalJson } = require("./lib/canonical-json");
const { buildGuardEvidence, classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { buildExistingOfferUpdatePlan } = require("./lib/retailer-offer-sync/existing-offer-plan");
const {
  readWooCommerceProductPage,
  isPermanentSourceError,
  sourceFailureDisposition,
  decodeHtmlEntities,
  parseWooCommerceProductPage,
  productIdFromHtml,
  WooCommerceSourceError,
} = require("./lib/woocommerce-product-page-reader");
const { buildVerifiedNoChangePlan } = require("./verified-no-change-offer-refresh");
const { writeDryRunArtifact } = require("./import-products");
const { commercialIdentity, liveIdentityDrift } = require("./six-pack-canary-builder");
const { assessVariantCompatibility, assertCataloguePolicyAllowsRecords, catalogueScopeBindings, reconcileApprovedCatalogueScope, normalizeFlavour, parsePackCount, parseSize, sizeKey } = require("./lib/feed-variant-guards");
const { isValidGtin } = require("./lib/gtin-promotion");
const {
  assertFreshBatchMatch,
  buildReviewedBatch,
  loadReviewedBatch,
} = require("./lib/six-pack-reviewed-owner-approval");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message, code = "REFRESH_BLOCKED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
}

function canonicalHash(value) {
  return sha256(canonicalJson(value));
}

const UNBUYABLE_PARENT_REASON = "UNBUYABLE_PARENT_VARIANTS_UNRESOLVED";
const UNBUYABLE_SIMPLE_REASON = "UNBUYABLE_SIMPLE_OFFER_UNRESOLVED";

function capturedSourceDocument(html, options, variationIds) {
  if (!options.sourceDocument) return null;
  const source = options.sourceDocument;
  return { request_url: source.request_url, response_url: source.response_url,
    http_status: source.http_status, content_type: source.content_type,
    body_complete: source.body_complete, html_sha256: source.html_sha256, html_bytes: source.html_bytes,
    product_id: String(options.productId),
    canonical_url: String(options.canonicalUrl), captured_at: options.capturedAt,
    ...(variationIds ? { variation_ids: variationIds } : {}), html: String(html) };
}

// Recognize only the retained unavailable-parent template. A parent display
// price/stock is consistency evidence, never a commercial fact for a child.
function productDocumentIdentity(html, options) {
  const attr = (tag, name) => {
    const entries = [...tag.matchAll(new RegExp(`(?:^|\\s)${name}=(["'])([^"']*)\\1`, "gi"))];
    return entries.length === 1 ? entries[0][2] : undefined;
  };
  const text = (value) => decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/&pound;/gi, "£").replace(/\s+/g, " ").trim();
  try {
    const canonical = new URL(options.canonicalUrl), id = String(options.productId);
    if (canonical.origin !== config.retailer.website || canonical.search || canonical.hash
      || canonical.username || canonical.password || !/^\/product\/[^/]+\/$/.test(canonical.pathname)) return null;
    const clean = html.replace(/<!--[\s\S]*?-->/g, "");
    for (const tag of ["html", "head", "body", "main"]) {
      if ([...clean.matchAll(new RegExp(`<${tag}(?:\\s|>)`, "gi"))].length !== 1
        || [...clean.matchAll(new RegExp(`</${tag}\\s*>`, "gi"))].length !== 1) return null;
    }
    if (!/^\s*<!doctype html>/i.test(clean) || !/<\/body\s*>\s*<\/html\s*>\s*$/i.test(clean)) return null;
    const body = clean.match(/<body\b[^>]*>/i)[0], main = clean.match(/<main\b([^>]*)>([\s\S]*?)<\/main>/i);
    if (attr(main[0].slice(0, main[0].indexOf(">") + 1), "id") !== "main"
      || canonicalJson(attr(body, "class")?.match(/\bpostid-\d+\b/g)) !== canonicalJson([`postid-${id}`])
      || productIdFromHtml(clean) !== id) return null;
    const productTags = [...main[2].matchAll(/<div\b[^>]*\bid=["']product-\d+["'][^>]*>/gi)];
    const types = attr(productTags[0]?.[0] || "", "class")?.match(/\bproduct-type-[a-z-]+\b/g) || [];
    const productType = types.length === 1 ? types[0].slice("product-type-".length) : null;
    if (productTags.length !== 1 || attr(productTags[0][0], "id") !== `product-${id}`
      || !["variable", "simple"].includes(productType)) return null;
    const head = clean.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1];
    const links = [...head.matchAll(/<link\b[^>]*>/gi)].filter((m) => attr(m[0], "rel") === "canonical");
    if (links.length !== 1 || attr(links[0][0], "href") !== canonical.href) return null;
    const headings = [...main[2].matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    if (headings.length !== 1) return null;
    return { canonical, clean, main, productTags, productType, head, headings, attr, text };
  } catch { return null; }
}

function unbuyableParentName(html, options) {
  try {
    const frame = productDocumentIdentity(html, options);
    if (!frame) return null;
    const { canonical, clean, main, productTags, productType, head, headings, attr, text } = frame;
    if (!/\boutofstock\b/.test(attr(productTags[0][0], "class"))
      || /\binstock\b/.test(attr(productTags[0][0], "class"))) return null;
    const meta = (name) => [...head.matchAll(/<meta\b[^>]*>/gi)].filter((m) => attr(m[0], "name") === name);
    const metaValue = (name) => { const entries = meta(name); return entries.length === 1 ? text(attr(entries[0][0], "content") || "") : null; };
    const sections = [...main[2].matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)], hero = sections[0];
    if (sections.length !== 2 || !/\bcontainer-page\b/.test(hero[1]) || !/\bgrid\b/.test(hero[1])
      || headings.length !== 1 || !hero[2].includes(headings[0][0])
      || !/\bdata-source-summary(?:\s|>)/.test(hero[2])
      || !/aria-labelledby=["']source-description-title["']/.test(sections[1][1])) return null;
    const name = text(headings[0][1]);
    const stock = [...hero[2].matchAll(/<div data-product-stock>\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*<\/div>\s*<p\b[^>]*>([^<]*)<\/p>/g)];
    const priceAt = hero[2].indexOf("<div data-product-price>");
    const priceHtml = hero[2].slice(priceAt, stock[0]?.index);
    const prices = [...priceHtml.matchAll(/<bdi>([\s\S]*?)<\/bdi>/g)];
    if (!name || stock.length !== 1 || text(stock[0][1]) !== "Out of stock"
      || text(stock[0][2]) !== "Not available to buy online" || priceAt < 0
      || [...main[2].matchAll(/data-product-price/g)].length !== 1
      || [...main[2].matchAll(/data-product-stock/g)].length !== 1
      || prices.length !== 1 || !/^£\d+\.\d{2}$/.test(text(prices[0][1]).replace(/\s/g, ""))
      || metaValue("twitter:data1") !== text(prices[0][1]).replace(/\s/g, "")
      || metaValue("twitter:data2") !== "Out of stock"
      || /<(?:form|select|input)\b|type=["']submit|add-to-cart|data-product[_-]id|\battribute_|itemprop=["'](?:price|availability)/i.test(main[2])) return null;
    const commercialMeta = [...clean.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:product:|og:price|price|availability)[^>]*>/gi)];
    if (commercialMeta.length) {
      // Variable-parent policy is unchanged. Simple's two public price tags may
      // corroborate the display only; they never establish an executable offer.
      if (productType !== "simple" || commercialMeta.length !== 2) return null;
      const values = commercialMeta.map(([tag]) => ({ key: attr(tag, "property"), value: attr(tag, "content"), name: attr(tag, "name") }));
      const amount = text(prices[0][1]).replace(/\s/g, "").slice(1);
      if (values.some((v) => v.name !== undefined)
        || values.filter((v) => v.key === "product:price:amount" && v.value === amount).length !== 1
        || values.filter((v) => v.key === "product:price:currency" && v.value === "GBP").length !== 1) return null;
    }
    // Reject alternative or broken payloads, including data outside the hero.
    if (/product-variations|data-product[_-]variations|buyBox\(|data-vari(?:ation|ant)[_-]id|["'](?:variation|variant)_ids?["']\s*:|["'](?:variations|variants)["']\s*:|\b(?:variations|variants|variation_id|variant_id)\s*[:=]/i.test(clean)) return null;
    const graphs = [];
    for (const m of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const type = attr(m[1], "type");
      if (type === "application/ld+json") graphs.push(JSON.parse(m[2]));
      if (type === "application/json") {
        if (!["sixpack-store-api", "sixpack-wishlist", "sixpack-rewards"].includes(attr(m[1], "id"))) return null;
        JSON.parse(m[2]);
      }
    }
    if (graphs.length !== 1 || !Array.isArray(graphs[0]["@graph"]) || graphs[0]["@graph"].length !== 5) return null;
    const nodes = [];
    const visit = (v) => { if (!v || typeof v !== "object") return; if (!Array.isArray(v)) nodes.push(v); Object.values(v).forEach(visit); };
    visit(graphs[0]);
    const nonCommercialTypes = ["Organization", "OnlineStore", "Store", "WebSite", "ItemPage", "BreadcrumbList",
      "ImageObject", "PostalAddress", "PropertyValue", "GeoCoordinates", "OpeningHoursSpecification", "SearchAction", "EntryPoint", "ListItem"];
    if (nodes.some((n) => Object.keys(n).some((k) => /^(?:offers|hasVariant|sku|productId|price|priceCurrency|availability|variations?|variants?|variation_id|variant_id)$/i.test(k))
      || ([n["@type"]].flat().includes("PropertyValue") && n.propertyID !== "Companies House")
      || (n["@type"] !== undefined && [n["@type"]].flat().some((t) => !nonCommercialTypes.includes(t))))) return null;
    const graph = graphs[0]["@graph"], find = (type) => graph.filter((n) => [n["@type"]].flat().includes(type));
    if (["Organization", "Store", "WebSite", "ItemPage", "BreadcrumbList"].some((type) => find(type).length !== 1)) return null;
    const page = find("ItemPage")[0], breadcrumb = find("BreadcrumbList")[0], items = breadcrumb.itemListElement;
    if (page["@id"] !== canonical.href + "#webpage" || page.url !== canonical.href || page.name !== name
      || page.mainEntity !== undefined || page.isPartOf?.["@id"] !== canonical.origin + "/#website"
      || page.breadcrumb?.["@id"] !== canonical.href + "#breadcrumb"
      || breadcrumb["@id"] !== canonical.href + "#breadcrumb" || !Array.isArray(items) || !items.length
      || items.some((item, i) => item.position !== i + 1)
      || items.at(-1).name !== name || items.at(-1).item !== canonical.href) return null;
    return { name, product_type: productType };
  } catch { return null; }
}

function parseSixPackProductPage(html, options) {
  try {
  const scripts = [...String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => /(?:^|\s)id\s*=\s*["']product-variations["']/i.test(match[1]));
  if (!scripts.length) {
    try { return parseWooCommerceProductPage(html, options); }
    catch (error) {
      const identity = error instanceof WooCommerceSourceError && error.code === "SOURCE_SCHEMA_MISMATCH"
        && error.message === "Expected one matching Product JSON-LD block, found 0"
        && options.sourceDocument && unbuyableParentName(String(html), options);
      if (!identity) throw error;
      throw new WooCommerceSourceError("SOURCE_SCHEMA_MISMATCH", "6 Pack unavailable parent has no variant commercial data", {
        reason_code: identity.product_type === "simple" ? UNBUYABLE_SIMPLE_REASON : UNBUYABLE_PARENT_REASON,
        product_id: String(options.productId), product_name: identity.name,
        source_document: capturedSourceDocument(html, options),
      });
    }
  }
  const sourceFail = (message, code = "SOURCE_SCHEMA_MISMATCH", detail = {}) => {
    throw new WooCommerceSourceError(code, message, detail);
  };
  const schema = (condition, message) => {
    if (!condition) sourceFail(message);
  };
  const json = (value) => {
    try { return JSON.parse(value); } catch { sourceFail("Invalid 6 Pack variation JSON"); }
  };
  schema(scripts.length === 1 && /(?:^|\s)type\s*=\s*["']application\/json["']/i.test(scripts[0][1]),
    "Expected one 6 Pack variation data block");
  const payload = json(scripts[0][2]);
  const boxes = [...String(html).matchAll(/\bx-data\s*=\s*(["'])([\s\S]*?)\1/gi)]
    .map((match) => decodeHtmlEntities(match[2]).match(/^buyBox\((\{[\s\S]*\})\)$/))
    .filter(Boolean).map((match) => json(match[1]))
    .filter((box) => box && box.dataId === "product-variations");
  const productId = String(options.productId || "");
  if (!/^[1-9]\d*$/.test(productId) || productIdFromHtml(html) !== productId
      || boxes.length !== 1 || String(boxes[0].productId) !== productId) {
    sourceFail("6 Pack variation data is not bound to the expected product", "SOURCE_IDENTITY_DRIFT");
  }
  const headings = [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const productName = headings.length === 1
    ? decodeHtmlEntities(headings[0][1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    : null;
  schema(productName && productName === boxes[0].name, "6 Pack product heading and buy box disagree");
  schema(payload && Array.isArray(payload.attributes) && payload.attributes.length > 0
    && Array.isArray(payload.variations) && payload.variations.length > 0, "Incomplete 6 Pack variation data");
  const attributes = new Map();
  for (const attribute of payload.attributes) {
    schema(attribute && /^attribute_[a-z0-9_-]+$/.test(attribute.name)
      && !attributes.has(attribute.name) && Array.isArray(attribute.options) && attribute.options.length > 0,
    "Invalid or duplicate 6 Pack variation attribute");
    const values = attribute.options.map((option) => option?.value);
    schema(values.every((value) => typeof value === "string" && value.trim())
      && new Set(values).size === values.length, "Invalid 6 Pack attribute options");
    attributes.set(attribute.name, new Set(values));
  }
  const ids = new Set();
  const combinations = new Set();
  const wildcardVariations = [];
  const wildcardAttributes = new Set();
  const completeAttributes = (value) => value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === attributes.size
    && [...attributes.keys()].every((name) => typeof value[name] === "string" && value[name].trim());
  const corroborateVariant = (row, wildcard = false) => {
    if (!wildcard) {
      // Dropdowns may omit complete options beyond the selected default. Neither
      // the selection nor a JSON-LD node alone establishes a variant's identity.
      schema(completeAttributes(payload.selected) && payload.variations.filter((variant) =>
        completeAttributes(variant?.attributes)
        && canonicalJson(variant.attributes) === canonicalJson(payload.selected)).length === 1,
      "6 Pack selected option is not a unique explicit selection");
      schema(completeAttributes(row.attributes) && payload.variations.filter((variant) =>
        completeAttributes(variant?.attributes)
        && canonicalJson(variant.attributes) === canonicalJson(row.attributes)).length === 1,
      "Undeclared 6 Pack option is not a unique explicit variant");
    }
    let canonical;
    try { canonical = new URL(options.canonicalUrl); } catch { sourceFail("Invalid 6 Pack canonical URL"); }
    schema(canonical.origin === "https://6pack-supplements.co.uk" && /^\/product\/[^/]+\/$/.test(canonical.pathname)
      && !canonical.search && !canonical.hash && !canonical.username && !canonical.password,
    "Selected 6 Pack variant requires an exact product URL");
    const nodes = [];
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (!Array.isArray(value)) nodes.push(value);
      for (const child of Object.values(value)) if (child && typeof child === "object") visit(child);
    };
    for (const script of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/(?:^|\s)type\s*=\s*["']application\/ld\+json["']/i.test(script[1])) visit(json(script[2]));
    }
    const hasType = (node, type) => node["@type"] === type || (Array.isArray(node["@type"]) && node["@type"].includes(type));
    const parentId = `${canonical.href}#product`;
    const variantId = `${canonical.href}#variant-${row.id}`;
    const groups = nodes.filter((node) => hasType(node, "ProductGroup") && node["@id"] === parentId);
    const products = nodes.filter((node) => hasType(node, "Product")
      && (node["@id"] === variantId || node.sku === String(row.id)));
    schema(groups.length === 1 && groups[0].url === canonical.href && groups[0].name === productName
      && Array.isArray(groups[0].hasVariant) && products.length === 1
      && groups[0].hasVariant.includes(products[0]) && products[0]["@id"] === variantId
      && (!wildcard || groups[0].hasVariant.length === payload.variations.length), "Selected 6 Pack variant JSON-LD identity is ambiguous or unbound");
    const product = products[0];
    const concreteAttributeCount = Object.values(row.attributes).filter((value) => value !== "").length;
    const matchesUrl = (value) => {
      if (typeof value !== "string") return false;
      let url;
      try { url = new URL(value); } catch { return false; }
      const pairs = [...url.searchParams];
      return url.origin === canonical.origin && url.pathname === canonical.pathname && !url.hash
        && !url.username && !url.password && pairs.length === concreteAttributeCount
        && new Set(pairs.map(([name]) => name)).size === concreteAttributeCount
        && pairs.every(([name]) => row.attributes[name] !== "")
        && pairs.every(([name, value]) => row.attributes[name] === value);
    };
    const offer = product.offers;
    schema(product.isVariantOf?.["@id"] === parentId && product.sku === String(row.id)
      && matchesUrl(product.url) && offer?.["@type"] === "Offer" && matchesUrl(offer.url)
      && offer.priceCurrency === "GBP" && typeof offer.price === "string" && /^\d+\.\d{2}$/.test(offer.price)
      && offer.price === row.price.toFixed(2)
      && (row.in_stock ? ["https://schema.org/InStock", "https://schema.org/LimitedAvailability"].includes(offer.availability)
        : offer.availability === "https://schema.org/OutOfStock"),
    "Selected 6 Pack variant JSON-LD contradicts its buy box");
  };
  const variations = payload.variations.map((row) => {
    schema(row && Number.isSafeInteger(row.id) && row.id > 0, "Invalid 6 Pack variation ID");
    const id = String(row.id);
    if (ids.has(id)) sourceFail(`Duplicate live variation ID ${id}`, "DUPLICATE_SOURCE_IDENTITY");
    ids.add(id);
    schema(typeof row.price === "number" && Number.isFinite(row.price) && Number(row.price.toFixed(2)) > 0
      && typeof row.in_stock === "boolean" && Number.isSafeInteger(row.max_qty) && row.max_qty >= 0
      && (!row.in_stock || row.max_qty > 0), "Invalid 6 Pack variation price, stock or quantity");
    // WooCommerce's empty string means Any attribute, not a concrete option.
    // Recognize it without assigning its price/stock to a fixed sales unit.
    schema(row.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes)
      && Object.keys(row.attributes).length === attributes.size
      && [...attributes.keys()].every((name) => typeof row.attributes[name] === "string"
        && (row.attributes[name] === "" || row.attributes[name].trim())),
    "6 Pack variation attribute keys are incomplete");
    const wildcards = [...attributes.keys()].filter((name) => row.attributes[name] === "");
    if (wildcards.length) {
      wildcardVariations.push(id);
      wildcards.forEach((name) => wildcardAttributes.add(name));
    }
    // The theme can omit complete variants from dropdowns. Require exact same-page corroboration.
    if (![...attributes].every(([name, values]) => row.attributes[name] === "" || values.has(row.attributes[name]))) corroborateVariant(row);
    const combination = canonicalJson(row.attributes);
    if (combinations.has(combination)) sourceFail("Duplicate 6 Pack variation options", "DUPLICATE_SOURCE_IDENTITY");
    combinations.add(combination);
    return {
      external_variant_id: id,
      attributes: row.attributes,
      price: row.price.toFixed(2),
      in_stock: row.in_stock,
      // The storefront lists these variants in its buy box, with an explicit cart quantity limit.
      active: true,
      purchasable: row.max_qty > 0,
    };
  });
  if (wildcardVariations.length) {
    if (options.sourceDocument) {
      for (const row of payload.variations) {
        if (Object.values(row.attributes).some((value) => value === "")) corroborateVariant(row, true);
      }
    }
    sourceFail("6 Pack wildcard variations require unambiguous sales-unit price and stock evidence",
      "SOURCE_SCHEMA_MISMATCH", {
        reason_code: "WILDCARD_COMMERCIAL_UNIT_UNRESOLVED",
        product_id: productId,
        variation_ids: wildcardVariations,
        wildcard_attributes: [...wildcardAttributes],
        ...(options.sourceDocument ? { source_document: capturedSourceDocument(html, options,
          variations.map((row) => row.external_variant_id)) } : {}),
      });
  }
  return {
    schema_version: 1,
    external_product_id: productId,
    canonical_url: String(options.canonicalUrl || ""),
    captured_at: options.capturedAt || new Date().toISOString(),
    product_name: productName,
    product_offer: null,
    variations,
    html_sha256: sha256(html),
    html_bytes: Buffer.byteLength(html),
  };
  } catch (error) {
    // Reuse the bounded public document contract for parser diagnostics. Only a
    // typed parser error after the existing HTTP reader supplies provenance can
    // carry HTML; no network/unknown exception is promoted or serialized here.
    if (error instanceof WooCommerceSourceError && error.code === "SOURCE_SCHEMA_MISMATCH"
      && options.sourceDocument && !error.detail?.source_document) {
      error.detail = { ...error.detail, product_id: String(options.productId),
        source_document: capturedSourceDocument(html, options) };
    }
    throw error;
  }
}

function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}

function shippingForPrice(price) {
  const policy = config.shipping_policy;
  const threshold = Number(policy.free_shipping_threshold);
  const below = Number(policy.below_threshold);
  const atOrAbove = Number(policy.at_or_above_threshold);
  if (
    policy.status !== "VERIFIED" ||
    policy.currency !== "GBP" ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(below) ||
    !Number.isFinite(atOrAbove)
  ) fail("Verified shipping policy is incomplete", "SHIPPING_POLICY_DRIFT");
  return money(Number(price) < threshold ? below : atOrAbove);
}

function parseArgs(argv) {
  const out = {};
  const allowed = new Set(["target", "artifact", "report", "require-no-change", "reviewed-mass-oos", "reviewed-batch", "isolate-unsafe"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || !allowed.has(match[1]) || out[match[1]] !== undefined) fail(`Invalid argument ${argument}`, "INVALID_ARGUMENT");
    out[match[1]] = match[2];
  }
  if (out.target !== "production") fail("Required --target=production", "INVALID_ARGUMENT");
  for (const key of ["artifact", "report"]) {
    if (!out[key]) fail(`Required --${key}=<tmp path>`, "INVALID_ARGUMENT");
    out[key] = path.resolve(out[key]);
    const relative = path.relative(path.join(ROOT, "tmp"), out[key]);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${key} must be inside repository tmp`, "INVALID_ARGUMENT");
  }
  out.requireNoChange = out["require-no-change"] === "true";
  if (out["require-no-change"] !== undefined && !["true", "false"].includes(out["require-no-change"])) {
    fail("--require-no-change must be true|false", "INVALID_ARGUMENT");
  }
  out.reviewedMassOosSelector = out["reviewed-mass-oos"] || null;
  out.reviewedBatchFingerprint = out["reviewed-batch"] || null;
  if (out.reviewedMassOosSelector && out.reviewedBatchFingerprint) fail("Reviewed selectors are mutually exclusive", "INVALID_ARGUMENT");
  out.isolateUnsafe = out["isolate-unsafe"] === "true";
  if (out["isolate-unsafe"] !== undefined && !["true", "false"].includes(out["isolate-unsafe"])) {
    fail("--isolate-unsafe must be true|false", "INVALID_ARGUMENT");
  }
  if (
    out["reviewed-mass-oos"] !== undefined &&
    out["reviewed-mass-oos"] !== config.automation.reviewed_mass_oos_selector
  ) fail("Unknown reviewed MASS_OOS selector", "INVALID_ARGUMENT");
  return out;
}

function isolateAggregateChanges(classification, policy, guardScope) {
  if (!["MASS_OOS", "MASS_CHANGE", "MASS_PRICE"].includes(classification.reason)) return classification;
  const safeRows = [];
  const quarantinedRows = [...(classification.quarantined_rows || [])];
  for (const row of classification.rows || []) {
    if (row.action === "VERIFY_NO_CHANGE") {
      safeRows.push(row);
      continue;
    }
    quarantinedRows.push({
      ...row,
      original_action: row.action,
      action: "BLOCK_SOURCE_ANOMALY",
      reason: classification.reason,
      changed_fields: { ...row.changed_fields, blocked: true },
    });
  }
  const guardEvidence = buildGuardEvidence(safeRows, policy, guardScope);
  if (guardEvidence.guards.some((guard) => guard.result !== "PASS")) {
    fail("Isolated executable plans still violate aggregate guardrails", "ISOLATION_GUARD_FAILED");
  }
  return {
    ...classification,
    state: "DRY_RUN_READY_WITH_REVIEW",
    action: "PASS_WITH_REVIEW",
    reason: null,
    rows: safeRows,
    quarantined_rows: quarantinedRows,
    full_scope_guard_evidence: classification.guard_evidence,
    guard_evidence: guardEvidence,
  };
}

function isolateDefaultVariantConflicts(classification, records, policy, guardScope, allowIsolation) {
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const conflictingOfferIds = new Set((classification.rows || [])
    .filter((row) => row.action !== "VERIFY_NO_CHANGE")
    .filter((row) => {
      const record = recordByOffer.get(String(row.offer_id));
      if (!record?.variant?.is_default) return false;
      return (record.active_variants || [record.variant]).some(
        (variant) => variant.is_active === true && variant.is_default !== true && String(variant.id) !== String(record.variant.id)
      );
    })
    .map((row) => String(row.offer_id)));
  if (conflictingOfferIds.size === 0) return classification;
  if (!allowIsolation) {
    fail("Changed default-variant plans conflict with active non-default variants", "DEFAULT_VARIANT_CONFLICT");
  }
  const safeRows = [];
  const quarantinedRows = [...(classification.quarantined_rows || [])];
  for (const row of classification.rows || []) {
    if (!conflictingOfferIds.has(String(row.offer_id))) {
      safeRows.push(row);
      continue;
    }
    quarantinedRows.push({
      ...row,
      original_action: row.action,
      action: "BLOCK_VARIANT_CONFLICT",
      reason: "DEFAULT_VARIANT_CONFLICT",
      changed_fields: { ...row.changed_fields, blocked: true },
    });
  }
  const guardEvidence = buildGuardEvidence(safeRows, policy, guardScope);
  if (guardEvidence.guards.some((guard) => guard.result !== "PASS")) {
    fail("Variant-conflict isolation still violates aggregate guardrails", "ISOLATION_GUARD_FAILED");
  }
  return {
    ...classification,
    state: "DRY_RUN_READY_WITH_REVIEW",
    action: "PASS_WITH_REVIEW",
    reason: null,
    rows: safeRows,
    quarantined_rows: quarantinedRows,
    full_scope_guard_evidence: classification.full_scope_guard_evidence || classification.guard_evidence,
    guard_evidence: guardEvidence,
  };
}

function authorizeReviewedOwnerBatch(classification, records, sourceRows, approvedManifest, reviewedBatch, capturedAt) {
  if (!reviewedBatch) return { classification, review: null };
  const batch = reviewedBatch.batch;
  if (batch.manifest_sha256 !== approvedManifest.sha256) fail("Reviewed batch approved-manifest SHA mismatch", "MANIFEST_DRIFT");
  if (classification.state !== "BLOCKED" || classification.reason !== "MASS_OOS") fail("Reviewed batch can override only MASS_OOS", "REVIEWED_BATCH_GUARD_INVALID");
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const sourceByVariant = new Map(sourceRows.map((row) => [String(row.external_variant_id), row]));
  const changed = classification.rows.filter((row) => row.action !== "VERIFY_NO_CHANGE").sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  if (changed.length !== batch.rows.length || canonicalJson(changed.map((row) => String(row.offer_id))) !== canonicalJson(batch.offer_ids)) fail("Reviewed batch changed-row scope drift", "REVIEWED_BATCH_LIVE_DRIFT");
  const freshRows = batch.rows.map((approvedRow) => {
    const record = recordByOffer.get(String(approvedRow.offer_id));
    const source = sourceByVariant.get(String(approvedRow.external_variant_id));
    const classified = changed.find((row) => String(row.offer_id) === String(approvedRow.offer_id));
    if (!record || !source || !classified) fail("Reviewed batch identity is missing from fresh capture", "REVIEWED_BATCH_LIVE_DRIFT");
    if (
      String(record.product.id) !== String(approvedRow.product_id) ||
      String(record.variant.id) !== String(approvedRow.product_variant_id) ||
      String(record.mapping.id) !== String(approvedRow.retailer_product_id) ||
      String(record.mapping.external_product_id) !== String(approvedRow.external_product_id) ||
      String(record.mapping.external_variant_id) !== String(approvedRow.external_variant_id) ||
      record.mapping.external_url !== approvedRow.after.url ||
      classified.action !== approvedRow.operation_type
    ) fail("Reviewed batch product, variant, mapping, URL or action drift", "REVIEWED_BATCH_LIVE_DRIFT");
    return {
      ...approvedRow,
      before: {
        price: money(record.offer.price), shipping_cost: money(record.offer.shipping_cost), total_price: money(record.offer.total_price),
        in_stock: Boolean(record.offer.in_stock), url: record.offer.url, last_checked_at: record.offer.last_checked_at,
      },
      after: {
        price: money(source.price), shipping_cost: money(source.shipping_cost), total_price: money(source.total_price),
        in_stock: Boolean(source.in_stock), url: source.url, last_checked_at: capturedAt,
      },
      source_captured_at: capturedAt,
    };
  });
  const fresh = buildReviewedBatch({
    rows: freshRows, implementationCommitSha: batch.implementation_commit_sha, manifestSha256: batch.manifest_sha256,
    sourceCapturedAt: capturedAt, expiresAt: new Date(Date.parse(capturedAt) + 24 * 60 * 60 * 1000).toISOString(),
  });
  assertFreshBatchMatch(batch, fresh);
  return {
    classification: { ...classification, state: "DRY_RUN_READY", action: "REVIEWED_OWNER_APPROVAL", reason: null, rows: changed, quarantined_rows: [] },
    review: { reviewed_batch_fingerprint: batch.reviewed_batch_fingerprint, row_count: batch.rows.length, source_semantic_fingerprint: batch.source_semantic_fingerprint, approved_guard: batch.approved_guard },
  };
}

function loadApprovedManifest() {
  const manifestPath = path.join(ROOT, config.automation.manifest_path);
  const bytes = fs.readFileSync(manifestPath);
  const actual = sha256(bytes);
  if (actual !== config.automation.manifest_sha256) fail("Approved manifest SHA mismatch", "MANIFEST_DRIFT");
  const manifest = JSON.parse(bytes);
  const rows = manifest.rows || [];
  if (
    manifest.approved !== true ||
    manifest.retailer?.id !== config.automation.retailer_id ||
    manifest.retailer?.slug !== config.retailer.slug ||
    manifest.approved_mapping_count !== config.automation.approved_mapping_count ||
    rows.length !== config.automation.approved_mapping_count ||
    new Set(rows.map((row) => row.mapping_id)).size !== rows.length ||
    new Set(rows.map((row) => row.offer_id)).size !== rows.length ||
    new Set(rows.map((row) => row.external_variant_id)).size !== rows.length
  ) fail("Approved manifest identity mismatch", "MANIFEST_DRIFT");
  return { manifest, sha256: actual };
}

function loadReviewedMassOosManifest(selector, approvedManifest) {
  if (!selector) return null;
  if (selector !== config.automation.reviewed_mass_oos_selector) {
    fail("Unknown reviewed MASS_OOS selector", "REVIEWED_MASS_OOS_SELECTOR_MISMATCH");
  }
  const manifestPath = path.join(ROOT, config.automation.reviewed_mass_oos_manifest_path);
  const bytes = fs.readFileSync(manifestPath);
  const actual = sha256(bytes);
  if (actual !== config.automation.reviewed_mass_oos_manifest_sha256) {
    fail("Reviewed MASS_OOS manifest SHA mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  }
  const manifest = JSON.parse(bytes);
  const topKeys = [
    "schema_version", "kind", "selector", "retailer_id", "retailer_slug",
    "target_environment", "authorized_by", "authorized_at", "source_capture_evidence",
    "source_semantic_fingerprint", "source_semantic_rows", "row_count", "rows",
  ].sort();
  if (
    canonicalJson(Object.keys(manifest).sort()) !== canonicalJson(topKeys) ||
    manifest.schema_version !== 1 ||
    manifest.kind !== "six-pack-reviewed-mass-oos-v1" ||
    manifest.selector !== selector ||
    manifest.retailer_id !== config.automation.retailer_id ||
    manifest.retailer_slug !== config.retailer.slug ||
    manifest.target_environment !== "PRODUCTION" ||
    typeof manifest.authorized_by !== "string" ||
    !manifest.authorized_by.startsWith("owner-instruction-") ||
    !Number.isFinite(Date.parse(manifest.authorized_at)) ||
    !/^[0-9a-f]{64}$/.test(manifest.source_semantic_fingerprint || "")
  ) fail("Reviewed MASS_OOS manifest contract mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  if (
    !Array.isArray(manifest.source_capture_evidence) ||
    manifest.source_capture_evidence.length !== 2 ||
    manifest.source_capture_evidence.some((capture) => (
      canonicalJson(Object.keys(capture).sort()) !== canonicalJson(["captured_at", "html_sha256"].sort()) ||
      !Number.isFinite(Date.parse(capture.captured_at)) ||
      !/^[0-9a-f]{64}$/.test(capture.html_sha256 || "")
    )) ||
    manifest.source_capture_evidence[0].html_sha256 !== manifest.source_capture_evidence[1].html_sha256 ||
    Date.parse(manifest.source_capture_evidence[0].captured_at) >= Date.parse(manifest.source_capture_evidence[1].captured_at)
  ) fail("Reviewed MASS_OOS requires two ordered matching source captures", "REVIEWED_MASS_OOS_EVIDENCE_DRIFT");
  if (
    !Array.isArray(manifest.source_semantic_rows) ||
    manifest.source_semantic_rows.length !== 2 ||
    canonicalHash(manifest.source_semantic_rows) !== manifest.source_semantic_fingerprint ||
    !Array.isArray(manifest.rows) ||
    manifest.row_count !== 2 ||
    manifest.rows.length !== manifest.row_count
  ) fail("Reviewed MASS_OOS source or row count mismatch", "REVIEWED_MASS_OOS_MANIFEST_DRIFT");
  const rowKeys = [
    "offer_id", "mapping_id", "external_product_id", "external_variant_id",
    "canonical_product_id", "canonical_variant_id", "display_name", "action",
    "old_price", "new_price", "old_stock", "new_stock",
  ].sort();
  for (const row of manifest.rows) {
    const binding = approvedManifest.rows.find((candidate) => candidate.offer_id === row.offer_id);
    if (
      canonicalJson(Object.keys(row).sort()) !== canonicalJson(rowKeys) ||
      row.action !== "UPDATE_STOCK" ||
      row.old_stock !== true || row.new_stock !== false ||
      money(row.old_price) !== "41.99" || money(row.new_price) !== "41.99" ||
      !binding || binding.mapping_id !== row.mapping_id ||
      binding.external_product_id !== row.external_product_id ||
      binding.external_variant_id !== row.external_variant_id ||
      binding.canonical_product_id !== row.canonical_product_id ||
      binding.canonical_variant_id !== row.canonical_variant_id
    ) fail("Reviewed MASS_OOS row escaped the approved binding", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  }
  if (
    new Set(manifest.rows.map((row) => row.offer_id)).size !== 2 ||
    manifest.rows.some((row, index) => index > 0 && Number(manifest.rows[index - 1].offer_id) >= Number(row.offer_id))
  ) fail("Reviewed MASS_OOS rows must be unique and ordered", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  return { manifest, sha256: actual };
}

function reviewedSourceSemanticRows(liveByProduct, reviewed) {
  return reviewed.manifest.source_semantic_rows.map((expected) => {
    const live = liveByProduct.get(expected.external_product_id);
    const matches = (live?.variations || []).filter(
      (variation) => String(variation.external_variant_id) === expected.external_variant_id
    );
    if (matches.length !== 1) fail("Reviewed MASS_OOS live source identity drift", "REVIEWED_MASS_OOS_SOURCE_DRIFT");
    const variation = matches[0];
    return {
      external_product_id: expected.external_product_id,
      external_variant_id: String(variation.external_variant_id),
      attributes: variation.attributes || {},
      price: money(variation.price),
      in_stock: Boolean(variation.in_stock),
      purchasable: Boolean(variation.purchasable),
      active: Boolean(variation.active),
      sku: variation.sku || null,
      canonical_url: live.canonical_url,
    };
  });
}

function authorizeReviewedMassOos(classification, records, liveByProduct, reviewed) {
  if (!reviewed) return { classification, review: null };
  if (classification.state !== "BLOCKED" || classification.reason !== "MASS_OOS") {
    fail("Reviewed MASS_OOS selector is not applicable to this classification", "REVIEWED_MASS_OOS_NOT_APPLICABLE");
  }
  const semanticRows = reviewedSourceSemanticRows(liveByProduct, reviewed);
  const semanticFingerprint = canonicalHash(semanticRows);
  if (
    semanticFingerprint !== reviewed.manifest.source_semantic_fingerprint ||
    canonicalJson(semanticRows) !== canonicalJson(reviewed.manifest.source_semantic_rows)
  ) fail("Reviewed MASS_OOS live semantic source drift", "REVIEWED_MASS_OOS_SOURCE_DRIFT");
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const changedRows = classification.rows
    .filter((row) => row.action !== "VERIFY_NO_CHANGE")
    .map((row) => {
      const record = recordByOffer.get(String(row.offer_id));
      if (!record) fail("Reviewed MASS_OOS canonical record missing", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
      return {
        offer_id: String(row.offer_id),
        mapping_id: String(row.retailer_product_id),
        external_product_id: String(row.external_product_id),
        external_variant_id: String(row.external_variant_id),
        canonical_product_id: String(record.product.id),
        canonical_variant_id: String(record.variant.id),
        display_name: record.variant.display_name,
        action: row.action,
        old_price: money(row.target.price),
        new_price: money(row.source.price),
        old_stock: Boolean(row.target.in_stock),
        new_stock: Boolean(row.source.in_stock),
      };
    })
    .sort((left, right) => Number(left.offer_id) - Number(right.offer_id));
  if (canonicalJson(changedRows) !== canonicalJson(reviewed.manifest.rows)) {
    fail("Reviewed MASS_OOS changed row scope drift", "REVIEWED_MASS_OOS_SCOPE_DRIFT");
  }
  return {
    classification: {
      ...classification,
      state: "DRY_RUN_READY",
      reason: null,
      action: "REVIEWED_MASS_OOS",
    },
    review: {
      selector: reviewed.manifest.selector,
      manifest_sha256: reviewed.sha256,
      authorized_by: reviewed.manifest.authorized_by,
      authorized_at: reviewed.manifest.authorized_at,
      row_count: reviewed.manifest.row_count,
      source_semantic_fingerprint: semanticFingerprint,
    },
  };
}

async function exactRows(client, table, ids, columns) {
  const { data, error } = await client.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

async function readState(manifest, dependencies = {}) {
  if (dependencies.state) return dependencies.state;
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname.split(".")[0] !== PROJECT_REF) fail("Production read credential mismatch", "TARGET_MISMATCH");
  const client = dependencies.client || createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const physicalBindings = manifest.historical_withdrawn_rows ? catalogueScopeBindings(manifest) : manifest.rows;
  const productIds = [...new Set(physicalBindings.map((row) => row.canonical_product_id))];
  const variantIds = [...new Set(physicalBindings.map((row) => row.canonical_variant_id))];
  const [retailersResult, mappingsResult, offersResult, products, variants, activeVariantsResult] = await Promise.all([
    client.from("retailers").select("id,name,slug,website").eq("id", manifest.retailer.id),
    client.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,updated_at").eq("retailer_id", manifest.retailer.id),
    client.from("offers").select("id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at").eq("retailer_id", manifest.retailer.id),
    exactRows(client, "products", productIds, "id,name,brand,is_active,merged_into_product_id,product_format" + (manifest.historical_withdrawn_rows ? ",owner_withdrawal_state,owner_withdrawal_reason,owner_withdrawn_at" : "")),
    exactRows(client, "product_variants", variantIds, "id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default,gtin"),
    client.from("product_variants").select("id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default").in("product_id", productIds).eq("is_active", true),
  ]);
  for (const result of [retailersResult, mappingsResult, offersResult, activeVariantsResult]) if (result.error) throw result.error;
  if (retailersResult.data.length !== 1) fail("Retailer identity missing or duplicated", "STATE_DRIFT");
  const retailer = retailersResult.data[0];
  if (retailer.slug !== config.retailer.slug || retailer.website !== config.retailer.website) fail("Retailer identity drift", "STATE_DRIFT");
  if (mappingsResult.data.length !== physicalBindings.length || offersResult.data.length !== physicalBindings.length) {
    fail("Approved manifest no longer covers the full retailer scope", "SCOPE_DRIFT");
  }
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const mappingById = new Map(mappingsResult.data.map((row) => [String(row.id), row]));
  const offerById = new Map(offersResult.data.map((row) => [String(row.id), row]));
  const activeVariantsByProduct = new Map();
  for (const row of activeVariantsResult.data || []) {
    const key = String(row.product_id);
    if (!activeVariantsByProduct.has(key)) activeVariantsByProduct.set(key, []);
    activeVariantsByProduct.get(key).push(row);
  }
  const records = physicalBindings.map((binding) => {
    const mapping = mappingById.get(binding.mapping_id);
    const offer = offerById.get(binding.offer_id);
    const product = productById.get(binding.canonical_product_id);
    const variant = variantById.get(binding.canonical_variant_id);
    if (
      !mapping || !offer || !product || !variant ||
      String(mapping.external_product_id) !== binding.external_product_id ||
      String(mapping.external_variant_id) !== binding.external_variant_id ||
      String(mapping.product_id) !== binding.canonical_product_id ||
      String(mapping.product_variant_id) !== binding.canonical_variant_id ||
      String(offer.retailer_product_id) !== binding.mapping_id ||
      String(offer.product_id) !== binding.canonical_product_id ||
      String(offer.product_variant_id) !== binding.canonical_variant_id ||
      (!manifest.historical_withdrawn_rows && (product.is_active !== true || product.merged_into_product_id != null || variant.is_active !== true))
    ) fail(`Approved binding drift for ${binding.external_variant_id}`, "STATE_DRIFT");
    const { brand, ...planProduct } = product, { gtin, ...planVariant } = variant;
    return { product: planProduct, variant: planVariant, identity_evidence: { brand, gtin },
      active_variants: activeVariantsByProduct.get(String(product.id)) || [planVariant], retailer, mapping, offer };
  });
  return { records };
}

// Reuse existing checks for exact selected-pack evidence. Incomplete evidence
// can enter only the existing classifier quarantine, without commercial identity.
function normalizationIdentityEvidence(error, record, live, capturedAt, isolateConflict = false) {
  const detail = error?.detail, p = live?.source_provenance;
  if (!(error instanceof WooCommerceSourceError) || error.code !== "SOURCE_IDENTITY_DRIFT"
    || detail?.stage !== "SOURCE_NORMALIZATION"
    || !(detail.identity?.code === "CSV_LIVE_IDENTITY_DRIFT"
      || (isolateConflict && detail.reason_code === "INVALID_APPROVED_GTIN"))
    || detail.mapping_id !== String(record.mapping.id) || detail.offer_id !== String(record.offer.id)
    || detail.product_id !== String(record.mapping.external_product_id)
    || detail.external_variant_id !== String(record.mapping.external_variant_id)
    || String(live.external_product_id) !== detail.product_id || !p
    || live.technical_document_identity?.product_id !== detail.product_id
    || live.technical_document_identity?.canonical_url !== live.canonical_url
    || live.technical_document_identity?.html_sha256 !== live.html_sha256
    || p.http_status !== 200 || p.body_complete !== true || !p.content_type?.startsWith("text/html")
    || !/^[a-f0-9]{64}$/.test(live.html_sha256 || "") || p.html_sha256 !== live.html_sha256
    || p.html_bytes !== live.html_bytes || !(p.html_bytes > 0 && p.html_bytes <= 2_000_000)
    || live.captured_at !== capturedAt || !Number.isFinite(Date.parse(capturedAt))
    || Date.parse(capturedAt) > Date.now()
    || Date.now() - Date.parse(capturedAt) > config.guardrails.source_freshness_hours * 3_600_000) return null;
  let url;
  try { url = new URL(live.canonical_url); } catch { return null; }
  const request = new URL("/", config.retailer.website); request.searchParams.set("p", detail.product_id);
  if (url.origin !== config.retailer.website || url.username || url.password || url.search || url.hash
    || !/^\/product\/[^/]+\/$/.test(url.pathname) || (!isolateConflict && url.href !== record.mapping.external_url)
    || p.response_url !== url.href || ![request.href, url.href].includes(p.request_url)) return null;
  const candidates = detail.product_id === detail.external_variant_id ? [live.product_offer]
    : (live.variations || []).filter(v => String(v.external_variant_id) === detail.external_variant_id);
  const offer = candidates[0];
  if (candidates.length !== 1 || !offer || !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0
    || typeof offer.in_stock !== "boolean" || (offer.currency && offer.currency !== "GBP")) return null;
  // The same verified document/tuple may prove a conflict without proving the
  // trade item. Retain it only as noncommercial review; never fix identifiers,
  // equate names, or pass a source row to the classifier/planner.
  if (isolateConflict) return {
    product_id: detail.product_id, external_variant_id: detail.external_variant_id,
    mapping_id: detail.mapping_id, offer_id: detail.offer_id, disposition: "SOURCE_IDENTITY_CONFLICT",
    identity: { ...detail.identity, reason_code: detail.reason_code || detail.identity.code,
      expected_gtin: record.mapping.external_gtin || record.identity_evidence?.gtin || record.variant.gtin || null,
      observed_gtin: offer.gtin || offer.gtin13 || null,
      expected_name: record.mapping.external_name || record.product.name, observed_name: live.product_name,
      commercial_identity: "UNVERIFIED", name_equivalence_verified: false, authority: "MANUAL_REVIEW_ONLY" },
    original_error: { code: error.code, detail },
    expected_url: record.mapping.external_url, observed_url: live.canonical_url,
    source_provenance: p,
  };
  const expectedGtin = record.mapping.external_gtin || record.identity_evidence?.gtin || record.variant.gtin;
  const observedGtin = offer.gtin || offer.gtin13;
  if ((expectedGtin && !isValidGtin(expectedGtin)) || (observedGtin && !isValidGtin(observedGtin))) return null;
  let identifiersComplete = true;
  for (const [expected, observed] of [[record.mapping.external_sku, offer.sku], [expectedGtin, observedGtin]]) {
    if (expected != null && String(expected).trim()) {
      if (observed == null || !String(observed).trim()) identifiersComplete = false;
      else if (String(expected).trim() !== String(observed).trim()) return null;
    }
  }
  const approvedName = record.mapping.external_name || record.product.name;
  const hardReasons = ["brand conflict", "size conflict", "pack-count conflict", "format conflict"];
  const approvedOptions = record.mapping.external_options || {};
  const expectedFlavour = normalizeFlavour(approvedOptions["Retailer Flavour"] || approvedOptions.Flavour || approvedOptions.Flavor);
  const selectedFlavour = normalizeFlavour(offer.attributes?.attribute_flavour || offer.attributes?.attribute_flavor);
  const canonicalFlavour = normalizeFlavour(record.variant.flavour_label);
  const approvedFlavour = normalizeFlavour(approvedOptions.Flavour || approvedOptions.Flavor);
  if (expectedFlavour && selectedFlavour && expectedFlavour !== selectedFlavour) return null;
  const approvedSize = parseSize(approvedName), parentSize = parseSize(live.product_name);
  const selectedPack = parsePackCount(offer.attributes?.attribute_size || "");
  const parentPack = parsePackCount(live.product_name);
  // Project the explicit selected box into the existing name-token parser;
  // quantities are checked separately below, without summing per-item mass.
  const selectedName = `${live.product_name} box of ${selectedPack} x ${parentSize?.value}${parentSize?.unit}`;
  const selectedCompatibility = assessVariantCompatibility({ product_name: live.product_name, brand: live.brand,
    size: parentSize ? `${parentSize.value}${parentSize.unit}` : "", variant: offer.attributes?.attribute_size || "",
    flavour: selectedFlavour }, { ...record.product, name: approvedName, brand: record.identity_evidence?.brand || record.product.brand }, record.variant);
  const selectedPackBound = detail.product_id !== detail.external_variant_id
    && approvedSize?.perUnit === true && selectedPack > 1 && selectedPack === parsePackCount(approvedName)
    && selectedPack === Number(record.variant.pack_count) && (parentPack == null || parentPack === selectedPack)
    && expectedFlavour && selectedFlavour === expectedFlavour
    && canonicalFlavour && canonicalFlavour === approvedFlavour
    && sizeKey({ ...approvedSize, perUnit: false }) === sizeKey(parentSize)
    && JSON.stringify(commercialIdentity(approvedName).name_tokens) === JSON.stringify(commercialIdentity(selectedName).name_tokens)
    && !selectedCompatibility.reasons.some(reason => hardReasons.includes(reason));
  // An unchanged approved slug is a document binding, not package evidence.
  // The exact URL/provenance guards above still apply; missing commercial
  // evidence below grants only manual review, never equivalence or writes.
  if (selectedPackBound && identifiersComplete) return { identity: { commercial_identity: "VERIFIED_SELECTED_MULTIPACK" },
    compatibility: selectedCompatibility };
  const compatibility = selectedPackBound ? selectedCompatibility : assessVariantCompatibility({ product_name: live.product_name, brand: live.brand },
    { ...record.product, brand: record.identity_evidence?.brand || record.product.brand,
      name: approvedName });
  if (compatibility.reasons.some(reason => hardReasons.includes(reason))
    || detail.identity.csv_capsule_qualifiers || detail.identity.live_capsule_qualifiers) return null;
  return { product_id: detail.product_id, external_variant_id: detail.external_variant_id,
    mapping_id: detail.mapping_id, offer_id: detail.offer_id, disposition: "SOURCE_IDENTITY_UNVERIFIED",
    identity: { ...detail.identity, commercial_identity: "UNVERIFIED", authority: "MANUAL_REVIEW_ONLY" },
    source_provenance: p, compatibility };
}

function normalizationReviewFor(error, record, live, capturedAt) {
  const evidence = normalizationIdentityEvidence(error, record, live, capturedAt);
  return evidence?.identity.commercial_identity === "UNVERIFIED" ? evidence
    : normalizationIdentityEvidence(error, record, live, capturedAt, true);
}

function liveSourceFor(record, live) {
  const externalProductId = String(record.mapping.external_product_id);
  const externalVariantId = String(record.mapping.external_variant_id);
  const contractError = (message, code, evidence = {}) => {
    // Only these proven post-capture contract checks create a permanent source
    // error. Arbitrary Error.code values and infrastructure exceptions stay untrusted.
    return new WooCommerceSourceError(code, message, {
      stage: "SOURCE_NORMALIZATION", product_id: externalProductId,
      external_variant_id: externalVariantId, mapping_id: String(record.mapping.id),
      offer_id: String(record.offer.id), ...evidence,
    });
  };
  const approvedGtin = record.mapping.external_gtin || record.identity_evidence?.gtin || record.variant.gtin;
  if (approvedGtin && !isValidGtin(approvedGtin)) throw contractError("Approved GTIN checksum is invalid", "SOURCE_IDENTITY_DRIFT", {
    reason_code: "INVALID_APPROVED_GTIN",
  });
  let offer;
  if (String(live.external_product_id) !== externalProductId) {
    throw contractError("Live parent differs from the approved binding", "SOURCE_IDENTITY_DRIFT", {
      observed_product_id: String(live.external_product_id),
    });
  }
  if (externalProductId === externalVariantId) {
    if (!live.product_offer) throw contractError(`Simple live offer missing for ${externalProductId}`, "SOURCE_SCHEMA_MISMATCH");
    offer = { ...live.product_offer, active: true, purchasable: true };
  } else {
    offer = live.variations.find((row) => row.external_variant_id === externalVariantId);
    if (!offer) throw contractError(`Live variation ${externalVariantId} missing`, "SOURCE_IDENTITY_DRIFT");
  }
  const identityDrift = liveIdentityDrift(
    {
      source_record_id: externalVariantId,
      product_name: record.mapping.external_name || record.product.name,
    },
    live
  );
  if (identityDrift) {
    const error = contractError(`Live commercial identity drift for ${externalVariantId}`, "SOURCE_IDENTITY_DRIFT", { identity: identityDrift });
    if (normalizationIdentityEvidence(error, record, live, live.captured_at)?.identity.commercial_identity !== "VERIFIED_SELECTED_MULTIPACK") throw error;
  }
  if (!offer.active || !offer.purchasable) {
    const shippingCost = shippingForPrice(offer.price);
    return {
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: record.mapping.external_sku || null,
      product_handle: new URL(live.canonical_url).pathname,
      price: money(offer.price),
      shipping_cost: shippingCost,
      total_price: money(Number(offer.price) + Number(shippingCost)),
      in_stock: false,
      url: live.canonical_url,
    };
  }
  const shippingCost = shippingForPrice(offer.price);
  return {
    external_product_id: externalProductId,
    external_variant_id: externalVariantId,
    external_sku: record.mapping.external_sku || null,
    product_handle: new URL(live.canonical_url).pathname,
    price: money(offer.price),
    shipping_cost: shippingCost,
    total_price: money(Number(offer.price) + Number(shippingCost)),
    in_stock: Boolean(offer.in_stock),
    url: live.canonical_url,
  };
}

function targetFor(record) {
  return {
    offer_id: String(record.offer.id),
    retailer_product_id: String(record.mapping.id),
    external_product_id: String(record.mapping.external_product_id),
    external_variant_id: String(record.mapping.external_variant_id),
    external_sku: record.mapping.external_sku || null,
    price: money(record.offer.price),
    shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price),
    in_stock: Boolean(record.offer.in_stock),
    url: record.offer.url,
    external_url: record.mapping.external_url,
    last_checked_at: record.offer.last_checked_at,
  };
}

function sourceErrorEvidence(error, productId) {
  const detail = error?.detail && typeof error.detail === "object" ? error.detail : {};
  const safeToken = (value, fallback = null) => (
    typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : fallback
  );
  const requestUrl = new URL("/", config.retailer.website);
  requestUrl.searchParams.set("p", String(productId));
  const lastAttempt = Number(detail.last_attempt);
  const httpStatus = Number(detail.http_status);
  const evidence = {
    error_code: safeToken(error?.code, "SOURCE_UNAVAILABLE"),
    error_type: safeToken(detail.error_type, "Error"),
    network_code: safeToken(detail.network_code),
    timeout: detail.timeout === true,
    last_attempt: Number.isInteger(lastAttempt) && lastAttempt >= 1 && lastAttempt <= 5 ? lastAttempt : null,
    request_url: requestUrl.href,
    product_id: String(productId),
    http_status: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
  };
  const issue = wildcardSourceIssue(error, productId);
  if (issue) evidence.sales_unit_binding = {
    reason_code: issue.reason_code,
    variation_ids: issue.variation_ids,
    wildcard_attributes: issue.wildcard_attributes,
  };
  return evidence;
}

function productSourceIssue(error, productId, reason, accepts) {
  // One typed cause-chain contract for the existing product-isolation path.
  for (let cause = error, depth = 0; cause && depth < 8; cause = cause.cause, depth += 1) {
    const issue = cause.detail;
    if (cause instanceof WooCommerceSourceError && cause.code === "SOURCE_SCHEMA_MISMATCH"
      && issue?.reason_code === reason && issue.product_id === String(productId) && accepts(issue)) return issue;
  }
  return null;
}

function wildcardSourceIssue(error, productId) {
  return productSourceIssue(error, productId, "WILDCARD_COMMERCIAL_UNIT_UNRESOLVED", (issue) =>
    Array.isArray(issue.variation_ids) && issue.variation_ids.length > 0
    && issue.variation_ids.every((id) => typeof id === "string" && /^[1-9]\d*$/.test(id))
    && Array.isArray(issue.wildcard_attributes) && issue.wildcard_attributes.length > 0
    && issue.wildcard_attributes.every((name) => typeof name === "string" && /^attribute_[a-z0-9_-]+$/.test(name)));
}

function unbuyableSourceIssue(error, productId) {
  const accepts = (issue) => typeof issue.product_name === "string" && issue.product_name.trim();
  return productSourceIssue(error, productId, UNBUYABLE_PARENT_REASON, accepts)
    || productSourceIssue(error, productId, UNBUYABLE_SIMPLE_REASON, accepts);
}

function verifiedSourceDocument(error, productId, capturedAt, requireCompleteHtml = true) {
  let document;
  for (let cause = error, depth = 0; cause && depth < 8; cause = cause.cause, depth += 1) {
    if (cause instanceof WooCommerceSourceError && cause.code === "SOURCE_SCHEMA_MISMATCH"
      && cause.detail?.source_document) { document = cause.detail.source_document; break; }
  }
  const transport = error?.detail;
  const timestamp = Date.parse(capturedAt);
  if (!(error instanceof WooCommerceSourceError) || error.code !== "SOURCE_SCHEMA_MISMATCH"
    || transport?.product_id !== String(productId) || transport.error_type !== "WooCommerceSourceError"
    || transport.timeout !== false || transport.network_code !== null
    || transport.http_status !== null || !Number.isInteger(transport.last_attempt)
    || transport.last_attempt < 1 || transport.last_attempt > 5
    || !document || document.product_id !== String(productId) || document.captured_at !== capturedAt
    || document.http_status !== 200 || document.body_complete !== true
    || document.request_url !== transport.request_url || document.response_url !== document.canonical_url
    || typeof document.content_type !== "string" || !document.content_type.startsWith("text/html")
    || !Number.isFinite(timestamp) || timestamp > Date.now()
    || Date.now() - timestamp > config.guardrails.source_freshness_hours * 3_600_000
    || typeof document.html !== "string" || document.html_bytes > 2_000_000
    || (requireCompleteHtml && (!/<html(?:\s|>)/i.test(document.html)
      || !/<\/body\s*>\s*<\/html\s*>\s*$/i.test(document.html)))
    || document.html_bytes !== Buffer.byteLength(document.html) || document.html_sha256 !== sha256(document.html)) return null;
  let request, canonical;
  try { request = new URL(document.request_url); canonical = new URL(document.canonical_url); } catch { return null; }
  if (canonical.origin !== config.retailer.website || canonical.username || canonical.password
    || canonical.search || canonical.hash || !/^\/product\/[^/]+\/$/.test(canonical.pathname)
    || request.origin !== config.retailer.website || request.username || request.password || request.hash
    || !(request.href === document.canonical_url || (request.pathname === "/"
      && [...request.searchParams].length === 1 && request.searchParams.get("p") === String(productId)))) return null;
  return document;
}

function approvedSourceFailureDisposition(error, productId, approved, capturedAt, records = []) {
  const ordinary = sourceFailureDisposition(error, productId);
  if (ordinary.scope === "PRODUCT") return ordinary;
  const wildcard = wildcardSourceIssue(error, productId);
  const issue = wildcard || unbuyableSourceIssue(error, productId);
  const document = verifiedSourceDocument(error, productId, capturedAt);
  if (approved.sha256 !== config.automation.manifest_sha256 || !issue || !document
    || canonicalJson(document) !== canonicalJson(issue.source_document)) return ordinary;
  const simple = issue.reason_code === UNBUYABLE_SIMPLE_REASON;
  const transport = error.detail;
  const rows = approved.manifest.rows.filter((row) => row.external_product_id === String(productId));
  const expected = rows.map((row) => row.external_variant_id).sort();
  if (!expected.length || (simple ? rows.length !== 1 || expected[0] !== String(productId) : expected.includes(String(productId)))
    || approved.manifest.rows.some((row) => row.external_product_id !== String(productId)
      && rows.some((isolated) => isolated.canonical_variant_id === row.canonical_variant_id))) return ordinary;
  if (wildcard) {
    // Preserve the exact #504 qualification; no additional wildcard shape is accepted.
    if (canonicalJson(issue.wildcard_attributes) !== canonicalJson(["attribute_size"])
      || canonicalJson([...issue.variation_ids].sort()) !== canonicalJson(expected)
      || !Array.isArray(document.variation_ids)
      || canonicalJson([...document.variation_ids].sort()) !== canonicalJson(expected)) return ordinary;
  } else {
    // Missing child facts establish review scope only. A variable parent may
    // retain an unverified name when the complete document, canonical URL and
    // every immutable approved binding agree. Simple qualification is unchanged.
    const children = records.filter((record) => String(record.mapping.external_product_id) === String(productId));
    if (transport.last_attempt !== 1 || canonicalHash(approved.manifest) !== canonicalHash(loadApprovedManifest().manifest)
      || children.length !== expected.length || new Set(expected).size !== expected.length
      || rows.some((row) => {
        const matching = children.filter((record) => String(record.mapping.id) === row.mapping_id
          && String(record.offer.id) === row.offer_id && String(record.mapping.external_variant_id) === row.external_variant_id
          && String(record.product.id) === row.canonical_product_id && String(record.variant.id) === row.canonical_variant_id);
        const expectedIdentity = simple && matching.length === 1 ? commercialIdentity(matching[0].mapping.external_name) : null;
        const observedIdentity = simple ? commercialIdentity(issue.product_name) : null;
        const nameMatches = simple ? expectedIdentity?.tokens.length > 0 && expectedIdentity.name_tokens.length > 0
          && canonicalJson(expectedIdentity.tokens) === canonicalJson(observedIdentity.tokens)
          && canonicalJson(expectedIdentity.name_tokens) === canonicalJson(observedIdentity.name_tokens)
          : matching[0]?.mapping.external_name === issue.product_name;
        return matching.length !== 1 || (simple && !nameMatches)
          || String(matching[0].mapping.product_id) !== row.canonical_product_id
          || String(matching[0].mapping.product_variant_id) !== row.canonical_variant_id
          || String(matching[0].offer.product_id) !== row.canonical_product_id
          || String(matching[0].offer.product_variant_id) !== row.canonical_variant_id
          || String(matching[0].offer.retailer_product_id) !== row.mapping_id
          || String(matching[0].variant.product_id) !== row.canonical_product_id
          || String(matching[0].mapping.retailer_id) !== String(approved.manifest.retailer.id)
          || String(matching[0].offer.retailer_id) !== String(approved.manifest.retailer.id)
          || matching[0].mapping.external_url !== document.canonical_url;
      })) return ordinary;
  }
  let reproduced;
  try {
    parseSixPackProductPage(document.html, { productId: String(productId), canonicalUrl: document.canonical_url,
      capturedAt, sourceDocument: document });
  } catch (failure) { reproduced = failure; }
  if (!(reproduced instanceof WooCommerceSourceError) || reproduced.code !== "SOURCE_SCHEMA_MISMATCH"
    || canonicalJson(reproduced.detail) !== canonicalJson(issue)) return ordinary;
  return { scope: "PRODUCT", reason: issue.reason_code, manifest_sha256: approved.sha256,
    approved_variation_ids: expected, source_document: document,
    ...(simple ? { identity: { expected_name: records.find((r) => String(r.mapping.id) === rows[0].mapping_id).mapping.external_name,
      observed_name: issue.product_name, observed_capsule_qualifiers: commercialIdentity(issue.product_name).capsule_qualifiers,
      authority: "MANUAL_REVIEW_ONLY" } } : !wildcard && rows.some((row) =>
      records.find((r) => String(r.mapping.id) === row.mapping_id).mapping.external_name !== issue.product_name)
      ? { identity: { expected_names: [...new Set(records.filter((r) => String(r.mapping.external_product_id) === String(productId))
        .map((r) => r.mapping.external_name))], observed_name: issue.product_name,
        technical_parent_binding: "VERIFIED", commercial_identity: "UNVERIFIED",
        name_equivalence_verified: false, authority: "MANUAL_REVIEW_ONLY" } } : {}) };
}

function canContinueSourceDiagnosis(error, productId, capturedAt, records) {
  const document = verifiedSourceDocument(error, productId, capturedAt);
  if (!document || error.detail.last_attempt !== 1) return false;
  const frame = productDocumentIdentity(document.html, { productId, canonicalUrl: document.canonical_url });
  if (!frame) return false;
  const observed = commercialIdentity(frame.text(frame.headings[0][1]));
  const children = records.filter((r) => String(r.mapping.external_product_id) === String(productId));
  return children.length > 0 && observed.name_tokens.length > 0 && children.every((r) => {
    const expected = commercialIdentity(r.mapping.external_name);
    return canonicalJson(expected.tokens) === canonicalJson(observed.tokens)
      && canonicalJson(expected.name_tokens) === canonicalJson(observed.name_tokens);
  });
}

function sourceCaptureEvidence(approved, liveByProduct, isolatedSourceFailures, fatalSourceFailures) {
  const products = [...new Set(approved.manifest.rows.map((r) => r.external_product_id))].map((id) => {
    const memberships = [liveByProduct.has(id), isolatedSourceFailures.has(id), fatalSourceFailures.has(id)].filter(Boolean).length;
    if (memberships > 1) fail("Source evidence categories overlap", "SOURCE_COLLAPSE");
    const rows = approved.manifest.rows.filter((r) => r.external_product_id === id);
    return { external_product_id: id,
      category: liveByProduct.has(id) ? "PARSED" : isolatedSourceFailures.has(id) ? "ISOLATED"
        : fatalSourceFailures.has(id) ? "FATAL" : "NOT_REACHED",
      approved_variant_ids: rows.map((r) => r.external_variant_id), mapping_ids: rows.map((r) => r.mapping_id),
      offer_ids: rows.map((r) => r.offer_id), mapping_count: rows.length };
  });
  const counts = Object.fromEntries(["PARSED", "ISOLATED", "FATAL", "NOT_REACHED"].map((category) => [category,
    { products: products.filter((p) => p.category === category).length,
      mappings: products.filter((p) => p.category === category).reduce((sum, p) => sum + p.mapping_count, 0) }]));
  const pages = [...liveByProduct.values()];
  return {
    source_capture_complete: counts.NOT_REACHED.products === 0, source_snapshot_complete: false,
    attempted_product_page_count: products.length - counts.NOT_REACHED.products,
    parsed_product_page_count: counts.PARSED.products, isolated_product_page_count: counts.ISOLATED.products,
    fatal_product_page_count: counts.FATAL.products, not_reached_product_page_count: counts.NOT_REACHED.products,
    source_coverage: { counts, products, mappings: approved.manifest.rows.map((row) => ({ ...row,
      category: products.find((p) => p.external_product_id === row.external_product_id).category })) },
    parsed_source_variant_count: pages.every((p) => Array.isArray(p.variations))
      ? pages.reduce((sum, p) => sum + p.variations.length + (p.product_offer ? 1 : 0), 0) : null,
    source_pages: pages.map((p) => ({ external_product_id: p.external_product_id, canonical_url: p.canonical_url,
      captured_at: p.captured_at || null, html_sha256: p.html_sha256 || null, html_bytes: p.html_bytes ?? null,
      ...(p.source_provenance ? { provenance: p.source_provenance } : {}) })),
    source_failure_count: isolatedSourceFailures.size + fatalSourceFailures.size,
    source_failures: [...isolatedSourceFailures.values()], source_errors: [...fatalSourceFailures.values()],
  };
}

function writeSourceFailureReport({
  approved,
  capturedAt,
  error,
  fetchedProductPageCount,
  options,
  productId,
  postCapture,
  capture,
}) {
  const sourceError = sourceErrorEvidence(error, productId);
  const report = {
    schema_version: 1,
    kind: "six-pack-approved-offer-refresh-dry-run",
    result: "BLOCK",
    target_project_ref: PROJECT_REF,
    manifest_sha256: approved.sha256,
    source_captured_at: capturedAt,
    approved_mapping_count: approved.manifest.rows.length,
    executable_plan_count: 0,
    executed_plan_count: 0,
    review_row_count: 0,
    blocked_row_count: approved.manifest.rows.length,
    fetched_product_page_count: fetchedProductPageCount,
    classification_state: "SOURCE_READ_FAILED",
    error_stage: "SOURCE_CAPTURE",
    block_reason: sourceError.error_code,
    source_error: sourceError,
    action_counts: {},
    database_writes: 0,
    ...(capture ? sourceCaptureEvidence(approved, capture.liveByProduct, capture.isolatedSourceFailures,
      capture.fatalSourceFailures) : {}),
    ...(capture ? { capture_stopped_by: capture.stoppedBy || null } : {}),
  };
  if (postCapture) {
    const { liveByProduct, sourceFailures, errors, normalizationComplete, normalizationReviews = [] } = postCapture;
    const pages = [...liveByProduct.values()];
    // Retain existing parsed reader output, not another source capture. Never
    // invent the missing input when the bounded evidence budget is exceeded.
    let normalizationInputs = null, inputRetention = "UNSERIALIZABLE_PARSED_INPUT";
    try {
      const inputBytes = Buffer.byteLength(canonicalJson(pages));
      inputRetention = inputBytes <= 2_000_000 ? "COMPLETE_PARSED_INPUT" : "EVIDENCE_BUDGET_EXCEEDED";
      if (inputBytes <= 2_000_000) normalizationInputs = pages;
    } catch { /* Diagnostic retention must never mask the original failure. */ }
    const variantsKnown = pages.every((page) => Array.isArray(page.variations));
    Object.assign(report, {
      classification_state: error.detail?.stage === "SOURCE_COVERAGE" ? "SOURCE_COVERAGE_FAILED" : "SOURCE_NORMALIZATION_FAILED",
      error_stage: error.detail?.stage === "SOURCE_COVERAGE" ? "SOURCE_COVERAGE" : "SOURCE_NORMALIZATION",
      source_capture_complete: true,
      source_snapshot_complete: false,
      normalization_complete: normalizationComplete,
      attempted_product_page_count: new Set(approved.manifest.rows.map((row) => row.external_product_id)).size,
      parsed_source_variant_count: variantsKnown ? pages.reduce((count, page) =>
        count + page.variations.length + (page.product_offer ? 1 : 0), 0) : null,
      source_failure_count: sourceFailures.length,
      source_failures: sourceFailures,
      source_pages: pages.map((page) => ({
        external_product_id: page.external_product_id, canonical_url: page.canonical_url,
        captured_at: page.captured_at || null, html_sha256: page.html_sha256 || null,
        html_bytes: page.html_bytes ?? null,
        ...(page.source_provenance ? { provenance: page.source_provenance } : {}),
      })),
      post_capture_errors: errors,
      normalization_review_rows: normalizationReviews,
      normalization_inputs: normalizationInputs,
      normalization_inputs_retention: inputRetention,
      source_error: errors.find((failure) => failure.permanent) || errors[0],
    });
  }
  fs.mkdirSync(path.dirname(options.report), { recursive: true });
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function verificationRecord(record, source, snapshotFingerprint, capturedAt) {
  const mapping = { ...record.mapping };
  delete mapping.updated_at;
  return {
    source_snapshot_sha256: snapshotFingerprint,
    source_captured_at: capturedAt,
    source: {
      external_product_id: String(source.external_product_id),
      external_variant_id: String(source.external_variant_id),
      price: money(source.price),
      in_stock: Boolean(source.in_stock),
      url: source.url,
    },
    target: {
      product: { ...record.product, id: String(record.product.id), merged_into_product_id: record.product.merged_into_product_id == null ? null : String(record.product.merged_into_product_id) },
      retailer: { ...record.retailer, id: String(record.retailer.id) },
      product_variant: { ...record.variant, id: String(record.variant.id), product_id: String(record.variant.product_id), size_value: record.variant.size_value == null ? null : String(record.variant.size_value), pack_count: record.variant.pack_count == null ? null : String(record.variant.pack_count) },
      retailer_product: { ...mapping, id: String(mapping.id), retailer_id: String(mapping.retailer_id), product_id: String(mapping.product_id), product_variant_id: String(mapping.product_variant_id), match_confidence: mapping.match_confidence == null ? null : String(mapping.match_confidence) },
      offer: { ...record.offer, id: String(record.offer.id), product_id: String(record.offer.product_id), retailer_id: String(record.offer.retailer_id), product_variant_id: String(record.offer.product_variant_id), retailer_product_id: String(record.offer.retailer_product_id), price: money(record.offer.price), shipping_cost: money(record.offer.shipping_cost), total_price: money(record.offer.total_price) },
    },
  };
}

function buildArtifactRows(records, sourceRows, classification, snapshotFingerprint, capturedAt) {
  const recordByOffer = new Map(records.map((record) => [String(record.offer.id), record]));
  const sourceByVariant = new Map(sourceRows.map((source) => [String(source.external_variant_id), source]));
  return classification.rows.map((classified, index) => {
    const record = recordByOffer.get(String(classified.offer_id));
    const source = sourceByVariant.get(String(classified.external_variant_id));
    let built;
    if (classified.action === "VERIFY_NO_CHANGE") {
      built = buildVerifiedNoChangePlan(
        verificationRecord(record, source, snapshotFingerprint, capturedAt),
        {
          targetEnvironment: "PRODUCTION",
          targetProjectRef: PROJECT_REF,
          sourceSnapshotSha256s: new Set([snapshotFingerprint]),
          now: new Date(capturedAt),
        }
      );
    } else {
      built = buildExistingOfferUpdatePlan({
        product: record.product,
        variant: record.variant,
        retailer: record.retailer,
        mapping: record.mapping,
        offer: record.offer,
        source,
        sourceCapturedAt: capturedAt,
        sourceSnapshotFingerprint: snapshotFingerprint,
      });
      if (
        built.changed.price !== classified.changed_fields.price ||
        built.changed.stock !== classified.changed_fields.stock ||
        built.changed.url !== classified.changed_fields.url
      ) fail("Classifier and atomic plan disagree", "PLAN_DRIFT");
    }
    return {
      row: built.record,
      rowNumber: index + 2,
      importPlan: built.plan,
      offerPlan: { action: classified.action, createsPriceHistory: built.plan.price_history.action === "create" },
    };
  });
}

async function run(options, dependencies = {}) {
  const approved = loadApprovedManifest();
  const reviewed = loadReviewedMassOosManifest(options.reviewedMassOosSelector, approved.manifest);
  const reviewedOwner = options.reviewedBatchFingerprint
    ? loadReviewedBatch(options.reviewedBatchFingerprint, dependencies.reviewedBatchOptions || {})
    : null;
  const physicalState = await readState(approved.manifest, dependencies);
  const state = { ...physicalState, ...reconcileApprovedCatalogueScope(approved.manifest, physicalState.records) };
  assertCataloguePolicyAllowsRecords(state.records);
  const capturedAt = new Date().toISOString();
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({
    storeUrl: config.retailer.website,
    productId,
    capturedAt,
    maximumAttempts: 5,
    retryBaseDelayMs: 1_000,
    parseProductPage: (html, context) => ({ ...parseSixPackProductPage(html, context),
      source_provenance: context.sourceDocument,
      technical_document_identity: productDocumentIdentity(html, context)
        ? { product_id: String(context.productId), canonical_url: context.canonicalUrl, html_sha256: sha256(html) } : null }),
  }));
  const liveByProduct = new Map();
  const isolatedSourceFailures = new Map();
  const fatalSourceFailures = new Map();
  let firstFatalError, retainedFatalHtmlBytes = 0;
  const productIds = [...new Set(state.records.map((record) => String(record.mapping.external_product_id)))];
  const capture = { liveByProduct, isolatedSourceFailures, fatalSourceFailures };
  for (const [index, productId] of productIds.entries()) {
    if (!dependencies.readLive && index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    try {
      liveByProduct.set(productId, await readLive(productId, { capturedAt }));
    } catch (error) {
      const disposition = approvedSourceFailureDisposition(error, productId, approved, capturedAt, state.records);
      if (options.isolateUnsafe === true && disposition.scope === "PRODUCT" && !reviewed && !reviewedOwner) {
        isolatedSourceFailures.set(productId, {
          ...sourceErrorEvidence(error, productId),
          disposition: disposition.reason,
          manifest_sha256: approved.sha256,
          approved_variation_ids: approved.manifest.rows.filter((r) => r.external_product_id === productId).map((r) => r.external_variant_id),
          mapping_ids: approved.manifest.rows.filter((r) => r.external_product_id === productId).map((r) => r.mapping_id),
          affected_mapping_count: approved.manifest.rows.filter((r) => r.external_product_id === productId).length,
          ...(disposition.identity ? { identity: disposition.identity } : {}),
          ...(disposition.source_document ? { source_document: disposition.source_document,
            manifest_sha256: disposition.manifest_sha256, approved_variation_ids: disposition.approved_variation_ids } : {}),
        });
      } else {
        const document = verifiedSourceDocument(error, productId, capturedAt, false);
        let retainedDocument;
        if (document) {
          const retainHtml = retainedFatalHtmlBytes + document.html_bytes <= 2_000_000;
          retainedFatalHtmlBytes += retainHtml ? document.html_bytes : 0;
          retainedDocument = { ...document, ...(retainHtml ? {} : { html: undefined, html_retention: "REPORT_BUDGET_EXCEEDED" }) };
        }
        const continuable = canContinueSourceDiagnosis(error, productId, capturedAt, state.records);
        fatalSourceFailures.set(productId, { ...sourceErrorEvidence(error, productId),
          diagnostic_continuation_allowed: continuable,
          ...(retainedDocument ? { source_document: retainedDocument } : {}) });
        firstFatalError ||= error;
        if (continuable) continue; // Same bounded loop, no refetch and no review promotion.
        // An earlier proved schema BLOCK remains sufficient to stop outer retry;
        // the later transient/unknown failure is still recorded as such.
        const terminalError = isPermanentSourceError(firstFatalError) ? firstFatalError : error;
        capture.stoppedBy = sourceErrorEvidence(error, productId);
        writeSourceFailureReport({
          approved,
          capturedAt,
          error: terminalError,
          fetchedProductPageCount: liveByProduct.size,
          options,
          productId: terminalError === firstFatalError ? [...fatalSourceFailures.keys()][0] : productId,
          capture,
        });
        throw terminalError;
      }
    }
  }
  if (firstFatalError) {
    writeSourceFailureReport({ approved, capturedAt, error: firstFatalError, fetchedProductPageCount: liveByProduct.size,
      options, productId: [...fatalSourceFailures.keys()][0], capture });
    throw firstFatalError; // Never classify or seal any plan if capture has a fatal row.
  }
  const sourceRows = [], normalizationErrors = [], normalizationReviews = [];
  let firstNormalizationError, firstUnknownNormalizationError;
  const sourceFailures = [...isolatedSourceFailures.values()].sort((left, right) => (
    Number(left.product_id) - Number(right.product_id)
  ));
  const reportNormalizationFailure = (error, normalizationComplete) => writeSourceFailureReport({
    approved, capturedAt, error, fetchedProductPageCount: liveByProduct.size, options,
    productId: normalizationErrors[0]?.product_id,
    postCapture: { liveByProduct, sourceFailures, errors: normalizationErrors, normalizationComplete, normalizationReviews },
    capture,
  });
  for (const record of state.records) {
    const live = liveByProduct.get(String(record.mapping.external_product_id));
    if (!live) continue; // Only already-qualified product isolation can omit a page.
    try { sourceRows.push(liveSourceFor(record, live)); }
    catch (error) {
      const review = options.isolateUnsafe && !reviewed && !reviewedOwner
        ? normalizationReviewFor(error, record, live, capturedAt) : null;
      if (review) { normalizationReviews.push(review); continue; }
      if (!isPermanentSourceError(error)) {
        // Retain available context without promoting an unknown exception to a
        // permanent identity failure or exposing its arbitrary message.
        normalizationErrors.push({ ...sourceErrorEvidence(error, record.mapping.external_product_id),
          stage: "SOURCE_NORMALIZATION", external_variant_id: String(record.mapping.external_variant_id),
          mapping_id: String(record.mapping.id), offer_id: String(record.offer.id), permanent: false });
        firstUnknownNormalizationError ||= error;
        continue;
      }
      firstNormalizationError ||= error;
      normalizationErrors.push({ error_code: error.code, ...error.detail, permanent: true });
    }
  }
  if (firstNormalizationError || firstUnknownNormalizationError) {
    // Any independently proved conflict is sufficient to BLOCK without refetch.
    // Unknown rows remain explicitly untrusted, and do not hide later conflicts.
    const error = firstNormalizationError || firstUnknownNormalizationError;
    reportNormalizationFailure(error, !firstUnknownNormalizationError);
    throw error;
  }
  const isolatedRowCount = state.records.filter((record) => (
    isolatedSourceFailures.has(String(record.mapping.external_product_id))
  )).length;
  if (
    sourceRows.length + isolatedRowCount + normalizationReviews.length !== approved.manifest.rows.length ||
    new Set(sourceRows.map((row) => row.external_variant_id)).size !== sourceRows.length
  ) {
    const error = new WooCommerceSourceError("SOURCE_COLLAPSE", "Approved source coverage is incomplete or duplicated", {
      stage: "SOURCE_COVERAGE", product_id: null, external_variant_id: null, mapping_id: null,
      normalized_row_count: sourceRows.length, isolated_row_count: isolatedRowCount,
      normalization_review_row_count: normalizationReviews.length,
      unique_normalized_variant_count: new Set(sourceRows.map((row) => row.external_variant_id)).size,
    });
    normalizationErrors.push({ error_code: error.code, ...error.detail, permanent: true });
    reportNormalizationFailure(error, true);
    throw error;
  }
  const snapshotFingerprint = sha256({
    captured_at: capturedAt,
    pages: [...liveByProduct.values()].map((row) => ({
      external_product_id: row.external_product_id,
      canonical_url: row.canonical_url,
      html_sha256: row.html_sha256,
    })).sort((left, right) => Number(left.external_product_id) - Number(right.external_product_id)),
    rows: sourceRows,
    source_failures: sourceFailures,
    ...(normalizationReviews.length ? { normalization_reviews: normalizationReviews } : {}),
  });
  const guardScope = { name: "SIX_PACK_APPROVED_MANIFEST", retailer: config.retailer.name };
  const policy = {
    ...config.guardrails,
    required_matched_offers: approved.manifest.rows.length,
    full_snapshot_minimum_source_count_ratio: config.source.minimum_count_ratio,
    store_url: config.retailer.website,
    source_url_mode: "provided",
    allowed_url_hosts: ["6pack-supplements.co.uk"],
    ignore_source_sku: true,
  };
  const initialClassification = classifyExistingOffers({
    targets: state.records.map(targetFor),
    sourceVariants: sourceRows,
    policy,
    guardScope,
    sourceCapturedAt: capturedAt,
    now: new Date(capturedAt),
    sourceProductCount: liveByProduct.size,
    previousSourceProductCount: config.automation.approved_product_page_count,
    quarantineUnsafeRows: options.isolateUnsafe === true,
  });
  const massOosAuthorization = authorizeReviewedMassOos(
    initialClassification,
    state.records,
    liveByProduct,
    reviewed
  );
  const ownerAuthorization = authorizeReviewedOwnerBatch(
    massOosAuthorization.classification, state.records, sourceRows, approved, reviewedOwner, capturedAt
  );
  let classification = options.isolateUnsafe && !reviewedOwner
    ? isolateAggregateChanges(ownerAuthorization.classification, policy, guardScope)
    : ownerAuthorization.classification;
  classification = isolateDefaultVariantConflicts(
    classification,
    state.records,
    policy,
    guardScope,
    options.isolateUnsafe && !reviewedOwner
  );
  const sourceByVariant = new Map(sourceRows.map((row) => [String(row.external_variant_id), row]));
  const sourceFailureByProduct = new Map(sourceFailures.map((failure) => [failure.product_id,
    failure.source_document ? { ...failure, source_document: { ...failure.source_document, html: undefined } } : failure]));
  const normalizationReviewByOffer = new Map(normalizationReviews.map(row => [row.offer_id, row]));
  const targetByOffer = new Map(state.records.map((record) => [String(record.offer.id), targetFor(record)]));
  const reviewRows = (classification.quarantined_rows || []).map((row) => {
    const source = sourceByVariant.get(String(row.external_variant_id));
    const sourceFailure = normalizationReviewByOffer.get(String(row.offer_id)) || sourceFailureByProduct.get(String(row.external_product_id)) || null;
    const target = targetByOffer.get(String(row.offer_id));
    if (!target || (!source && row.reason !== "SOURCE_VARIANT_MISSING")) {
      fail("Review row escaped the approved source/target scope", "REVIEW_SCOPE_DRIFT");
    }
    return {
      offer_id: String(row.offer_id),
      mapping_id: String(row.retailer_product_id),
      external_product_id: String(row.external_product_id),
      external_variant_id: String(row.external_variant_id),
      reason: normalizationReviewByOffer.has(String(row.offer_id)) ? "IDENTITY_CONFLICT" : row.reason,
      source_failure: sourceFailure,
      original_action: row.original_action || null,
      changed_fields: row.changed_fields,
      current_offer: {
        price: money(target.price),
        shipping_cost: money(target.shipping_cost),
        total_price: money(target.total_price),
        in_stock: Boolean(target.in_stock),
        url: target.url,
        last_checked_at: target.last_checked_at,
      },
      proposed_offer: source ? {
        price: money(source.price),
        shipping_cost: money(source.shipping_cost),
        total_price: money(source.total_price),
        in_stock: Boolean(source.in_stock),
        url: source.url,
        source_captured_at: row.source_captured_at,
      } : null,
    };
  });
  const accepted = ["DRY_RUN_READY", "DRY_RUN_READY_WITH_REVIEW"].includes(classification.state);
  const reconciledCount = (classification.rows || []).length + reviewRows.length;
  const report = {
    schema_version: 1,
    kind: "six-pack-approved-offer-refresh-dry-run",
    result: accepted ? (reviewRows.length ? "PASS_WITH_REVIEW" : "PASS") : "BLOCK",
    target_project_ref: PROJECT_REF,
    ...(state.scope_partition ? { catalogue_scope: state.scope_partition } : {}),
    manifest_sha256: approved.sha256,
    source_snapshot_fingerprint: snapshotFingerprint,
    source_captured_at: capturedAt,
    approved_mapping_count: approved.manifest.rows.length,
    executable_plan_count: accepted ? (classification.rows || []).length : 0,
    executed_plan_count: 0,
    review_row_count: reviewRows.length,
    blocked_row_count: accepted ? 0 : approved.manifest.rows.length - reviewRows.length,
    fetched_product_page_count: liveByProduct.size,
    ...sourceCaptureEvidence(approved, liveByProduct, isolatedSourceFailures, fatalSourceFailures),
    source_snapshot_complete: true,
    attempted_product_page_count: productIds.length,
    source_failure_count: sourceFailures.length,
    source_failures: sourceFailures,
    normalization_review_rows: normalizationReviews,
    classification_state: classification.state,
    block_reason: classification.reason || null,
    guard_evidence: classification.guard_evidence || null,
    full_scope_guard_evidence: classification.full_scope_guard_evidence || classification.guard_evidence || null,
    reviewed_mass_oos: massOosAuthorization.review,
    reviewed_owner_approval: ownerAuthorization.review,
    review_rows: reviewRows,
    action_counts: (classification.rows || []).reduce((counts, row) => {
      counts[row.action] = (counts[row.action] || 0) + 1;
      return counts;
    }, {}),
    database_writes: 0,
  };
  fs.mkdirSync(path.dirname(options.report), { recursive: true });
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  if (
    !accepted ||
    (!options.isolateUnsafe && !reviewedOwner && classification.rows.length !== approved.manifest.rows.length) ||
    (reviewedOwner && classification.rows.length !== reviewedOwner.batch.rows.length) ||
    (options.isolateUnsafe && !reviewedOwner && reconciledCount !== approved.manifest.rows.length)
  ) {
    fail(`Classifier blocked: ${classification.reason || classification.state}`, classification.reason || "CLASSIFIER_BLOCKED");
  }
  if (options.requireNoChange && classification.rows.some((row) => row.action !== "VERIFY_NO_CHANGE")) {
    report.result = "BLOCK";
    report.block_reason = "IDEMPOTENCY_FAILED";
    fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
    fail("Post-apply source/state is not idempotent", "IDEMPOTENCY_FAILED");
  }
  const approvedRows = buildArtifactRows(state.records, sourceRows, classification, snapshotFingerprint, capturedAt);
  const sourceRecords = approvedRows.map((row) => row.row);
  const result = {
    successful: 0,
    failed: 0,
    planned: approvedRows.length,
    skipped: 0,
    report: { approvedRows, blockedRows: [] },
    rowLevelOffers: approvedRows.map((row) => ({ rowNumber: row.rowNumber, slug: row.row.target.product.name, offerAction: row.offerPlan.action })),
    successfulRows: [],
    failedRows: [],
    blockedRows: [],
  };
  const artifact = writeDryRunArtifact(sourceRecords, result, {
    artifactPath: options.artifact,
    runId: reviewedOwner
      ? `six-pack-reviewed-owner-${reviewedOwner.batch.reviewed_batch_fingerprint}-${Date.now()}`
      : reviewed
      ? `six-pack-reviewed-mass-oos-${reviewed.sha256}-${Date.now()}`
      : `six-pack-refresh-${Date.now()}`,
    createdAt: capturedAt,
    sourceContent: canonicalJson({ snapshot_fingerprint: snapshotFingerprint, rows: sourceRows, source_failures: sourceFailures,
      ...(normalizationReviews.length ? { normalization_reviews: normalizationReviews } : {}) }),
    sourceFileName: "six-pack-live-approved-scope.json",
    environmentMarker: "production",
  });
  report.artifact_sha256 = artifact.artifactSha256;
  report.artifact_path = path.relative(ROOT, artifact.artifactPath);
  fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  return { report, artifact };
}

function main(options = parseArgs(process.argv.slice(2)), dependencies) {
  return run(options, dependencies)
    .then(({ report }) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(`${error.code || "ERROR"}: ${error.message}`);
      // Deterministic source or owner-policy blocks cannot improve by rereading.
      process.exitCode = isPermanentSourceError(error) || ["CATALOGUE_POLICY_SCOPE_BLOCKED", "CATALOGUE_SCOPE_NOT_ACTIVATED"].includes(error.code) ? 2 : 1;
    });
}

if (require.main === module) main();

module.exports = {
  approvedSourceFailureDisposition,
  authorizeReviewedOwnerBatch,
  authorizeReviewedMassOos,
  buildArtifactRows,
  canonicalHash,
  isolateAggregateChanges,
  isolateDefaultVariantConflicts,
  liveSourceFor,
  normalizationReviewFor,
  loadApprovedManifest,
  loadReviewedMassOosManifest,
  money,
  main,
  parseArgs,
  parseSixPackProductPage,
  reviewedSourceSemanticRows,
  run,
  shippingForPrice,
  targetFor,
  verificationRecord,
  writeSourceFailureReport,
};
