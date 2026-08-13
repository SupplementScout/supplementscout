const { hash } = require("./retailer-snapshot/fingerprints");
const { isValidGtin, normalizeGtin } = require("./gtin-promotion");

const DECISIONS = Object.freeze(["AUTO_ELIGIBLE", "REVIEW", "REJECT", "NOT_FOUND"]);
const DEFAULT_POLICY = Object.freeze({
  marketplace_id: "EBAY_GB",
  delivery_country: "GB",
  currency: "GBP",
  minimum_feedback_percentage: 98,
  minimum_feedback_score: 100,
});
const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1";
const TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";
let tokenCache = null;

function clean(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return clean(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function finiteNumber(value) {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) ? number : null;
}

function money(value) {
  const amount = finiteNumber(value?.value);
  return amount === null ? null : { value: amount, currency: clean(value?.currency).toUpperCase() || null };
}

function aspectMap(item) {
  const result = new Map();
  for (const aspect of item.localizedAspects || []) {
    const name = normalized(aspect.name);
    if (name) result.set(name, clean(aspect.value));
  }
  return result;
}

function firstAspect(aspects, names) {
  for (const name of names) {
    if (aspects.has(name)) return aspects.get(name);
  }
  return null;
}

function returnedGtin(item, aspects) {
  const direct = normalizeGtin(item.gtin || "");
  if (isValidGtin(direct)) return direct;
  for (const key of ["gtin", "ean", "upc", "isbn"]) {
    const value = normalizeGtin(aspects.get(key));
    if (isValidGtin(value)) return value;
  }
  return null;
}

function semanticCheck(label, expected, returned, searchable, blockers, missing) {
  if (expected == null || clean(expected) === "" || normalized(expected) === "default") return;
  const wanted = normalized(expected);
  const actual = normalized(returned);
  if (actual) {
    if (actual.includes(wanted) || wanted.includes(actual)) return;
    blockers.push(`${label}_MISMATCH`);
    return;
  }
  if (!normalized(searchable).includes(wanted)) missing.push(`${label}_UNPROVEN`);
}

function sizeCheck(identity, aspects, searchable, blockers, missing) {
  if (identity.size_value == null || !identity.size_unit) return;
  const expected = `${identity.size_value}${normalized(identity.size_unit)}`.replace(/\s/g, "");
  const haystack = normalized(searchable).replace(/\s/g, "");
  const sizeAspect = firstAspect(aspects, ["size", "weight", "volume", "net weight"]);
  if (sizeAspect) {
    const actual = normalized(sizeAspect).replace(/\s/g, "");
    if (actual.includes(expected)) return;
    blockers.push("SIZE_MISMATCH");
  } else if (!haystack.includes(expected)) {
    missing.push("SIZE_UNPROVEN");
  }
}

function packCheck(identity, aspects, searchable, blockers, missing) {
  const expected = Number(identity.pack_count || 1);
  const value = firstAspect(aspects, ["unit quantity", "number in pack", "pack size"]);
  const explicit = value && finiteNumber(String(value).match(/\d+/)?.[0]);
  const titlePack = normalized(searchable).match(/(?:pack of|lot of|bundle of)\s+(\d+)|\b(\d+)\s*x\b/);
  const actual = explicit ?? finiteNumber(titlePack?.[1] || titlePack?.[2]);
  if (actual !== null && actual !== expected) blockers.push("UNIT_COUNT_MISMATCH");
  else if (expected > 1 && actual === null) missing.push("UNIT_COUNT_UNPROVEN");
}

function unitCountCheck(identity, aspects, searchable, blockers, missing) {
  const expected = finiteNumber(identity.unit_count);
  if (expected === null) return;
  const value = firstAspect(aspects, ["unit quantity", "number of capsules", "number of tablets", "count"]);
  const explicit = value && finiteNumber(String(value).match(/\d+/)?.[0]);
  const unit = normalized(identity.unit_type || "unit");
  const titleMatch = normalized(searchable).match(new RegExp(`\\b(\\d+)\\s*(?:${unit}s?|capsules?|tablets?|softgels?|servings?)\\b`));
  const actual = explicit ?? finiteNumber(titleMatch?.[1]);
  if (actual !== null && actual !== expected) blockers.push("UNIT_COUNT_MISMATCH");
  else if (actual === null) missing.push("UNIT_COUNT_UNPROVEN");
}

function shippingEvidence(item, currency) {
  const options = (item.shippingOptions || []).map((option) => ({
    cost: money(option.shippingCost),
    min_delivery_date: option.minEstimatedDeliveryDate || null,
    max_delivery_date: option.maxEstimatedDeliveryDate || null,
  })).filter((option) => option.cost && option.cost.currency === currency);
  options.sort((a, b) => a.cost.value - b.cost.value);
  return options[0] || null;
}

function evaluateItem(identity, item, policy = DEFAULT_POLICY) {
  const blockers = [];
  const review = [];
  const aspects = aspectMap(item);
  const title = clean(item.title);
  const searchable = `${title} ${[...aspects.values()].join(" ")}`;
  const gtin = returnedGtin(item, aspects);
  const marketplace = clean(item.listingMarketplaceId);
  const buyingOptions = item.buyingOptions || [];
  const condition = normalized(item.condition);
  const conditionId = clean(item.conditionId);

  if (!isValidGtin(identity.gtin)) blockers.push("CANONICAL_GTIN_INVALID");
  if (!gtin) review.push("RETURNED_GTIN_UNPROVEN");
  else if (gtin !== normalizeGtin(identity.gtin)) blockers.push("GTIN_MISMATCH");
  if (marketplace !== policy.marketplace_id) blockers.push("MARKETPLACE_MISMATCH");
  if (!buyingOptions.includes("FIXED_PRICE")) blockers.push("NOT_FIXED_PRICE");
  if (conditionId !== "1000" && condition !== "new") {
    if (/used|refurb|opened|damaged/.test(condition)) blockers.push("CONDITION_NOT_NEW");
    else review.push("NEW_CONDITION_UNPROVEN");
  }
  if (/\b(sample|sachet|bundle|damaged|opened|used|refurbished|empty container)\b/i.test(title)) {
    blockers.push("TITLE_HARD_BLOCKER");
  }

  semanticCheck("BRAND", identity.brand, item.brand || firstAspect(aspects, ["brand"]), searchable, blockers, review);
  semanticCheck("FLAVOUR", identity.flavour_label, firstAspect(aspects, ["flavour", "flavor"]), searchable, blockers, review);
  semanticCheck("FORMAT", identity.product_format, firstAspect(aspects, ["formulation", "form", "type"]), searchable, blockers, review);
  sizeCheck(identity, aspects, searchable, blockers, review);
  packCheck(identity, aspects, searchable, blockers, review);
  unitCountCheck(identity, aspects, searchable, blockers, review);

  const itemPrice = money(item.price);
  const shipping = itemPrice ? shippingEvidence(item, itemPrice.currency) : null;
  let delivered = null;
  if (!itemPrice || itemPrice.value <= 0) blockers.push("ITEM_PRICE_INVALID");
  else if (itemPrice.currency !== policy.currency) review.push("NON_GBP_PRICE");
  if (!shipping) review.push("UK_SHIPPING_UNKNOWN");
  else delivered = { value: Number((itemPrice.value + shipping.cost.value).toFixed(2)), currency: itemPrice.currency };

  const seller = item.seller || {};
  const feedbackPercentage = finiteNumber(seller.feedbackPercentage);
  const feedbackScore = finiteNumber(seller.feedbackScore);
  if (!clean(seller.username) || feedbackPercentage === null || feedbackScore === null) {
    review.push("SELLER_QUALITY_UNPROVEN");
  } else {
    if (feedbackPercentage < policy.minimum_feedback_percentage) review.push("SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD");
    if (feedbackScore < policy.minimum_feedback_score) review.push("SELLER_SCORE_BELOW_PROPOSED_THRESHOLD");
  }

  const decision = blockers.length ? "REJECT" : review.length ? "REVIEW" : "AUTO_ELIGIBLE";
  return {
    item_id: clean(item.itemId) || null,
    legacy_item_id: clean(item.legacyItemId) || null,
    title: title || null,
    marketplace_id: marketplace || null,
    condition: clean(item.condition) || null,
    condition_id: conditionId || null,
    buying_options: buyingOptions,
    seller: {
      username: clean(seller.username) || null,
      account_type: clean(seller.sellerAccountType) || null,
      feedback_percentage: feedbackPercentage,
      feedback_score: feedbackScore,
    },
    item_price: itemPrice,
    uk_shipping: shipping?.cost || null,
    delivered_price: delivered,
    returned_gtin: gtin,
    returned_brand: clean(item.brand || firstAspect(aspects, ["brand"])) || null,
    localized_aspects: Object.fromEntries(aspects),
    item_web_url: clean(item.itemWebUrl) || null,
    affiliate_url: clean(item.itemAffiliateWebUrl) || null,
    affiliate_ready: policy.affiliate_campaign_configured === true && Boolean(clean(item.itemAffiliateWebUrl)),
    match_tier: decision === "AUTO_ELIGIBLE" ? "A" : gtin ? "B" : "C",
    blockers: [...new Set(blockers)].sort(),
    review_reasons: [...new Set(review)].sort(),
    decision,
  };
}

function candidateOrder(a, b) {
  const rank = { AUTO_ELIGIBLE: 0, REVIEW: 1, REJECT: 2 };
  if (rank[a.decision] !== rank[b.decision]) return rank[a.decision] - rank[b.decision];
  const aPrice = a.delivered_price?.value ?? Number.POSITIVE_INFINITY;
  const bPrice = b.delivered_price?.value ?? Number.POSITIVE_INFINITY;
  if (aPrice !== bPrice) return aPrice - bPrice;
  if ((a.seller.feedback_score ?? -1) !== (b.seller.feedback_score ?? -1)) return (b.seller.feedback_score ?? -1) - (a.seller.feedback_score ?? -1);
  return clean(a.item_id).localeCompare(clean(b.item_id));
}

function evaluateIdentity(identity, items, policy = DEFAULT_POLICY) {
  const candidates = items.map((item) => evaluateItem(identity, item, policy)).sort(candidateOrder);
  const selected = candidates[0] || null;
  const decision = selected?.decision || "NOT_FOUND";
  return {
    ...identity,
    found: candidates.length > 0,
    raw_candidate_count: candidates.length,
    selected_offer: selected,
    candidate_evidence: candidates,
    rejected_candidates: candidates.filter((row) => row.decision === "REJECT"),
    decision,
    ebay_would_be_second_retailer: decision === "AUTO_ELIGIBLE" && identity.current_retailer_count === 1,
    ebay_is_lower_delivered_price: decision === "AUTO_ELIGIBLE" && identity.current_best_delivered_price != null && selected.delivered_price.value < identity.current_best_delivered_price,
  };
}

function buildReport(input, results, policy = DEFAULT_POLICY, metadata = {}) {
  const count = (decision) => results.filter((row) => row.decision === decision).length;
  const blockerCounts = {};
  for (const row of results) for (const code of [...(row.selected_offer?.blockers || []), ...(row.selected_offer?.review_reasons || [])]) blockerCounts[code] = (blockerCounts[code] || 0) + 1;
  const differences = results.filter((row) => row.decision === "AUTO_ELIGIBLE" && row.current_best_delivered_price != null)
    .map((row) => Number((row.selected_offer.delivered_price.value - row.current_best_delivered_price).toFixed(2))).sort((a, b) => a - b);
  const median = differences.length ? differences.length % 2 ? differences[(differences.length - 1) / 2] : Number(((differences[differences.length / 2 - 1] + differences[differences.length / 2]) / 2).toFixed(2)) : null;
  const report = {
    schema_version: 1,
    operation_type: "EBAY_BROWSE_API_PILOT",
    write_enabled: false,
    captured_at: metadata.captured_at || new Date().toISOString(),
    input_fingerprint: input.artifact_fingerprint,
    request_policy: policy,
    request_policy_fingerprint: hash("EBAY-BROWSE-POLICY:1", policy),
    affiliate_campaign_configured: metadata.affiliate_campaign_configured === true,
    summary: {
      checked: results.length,
      found: results.filter((row) => row.found).length,
      exact_gtin: results.filter((row) => row.selected_offer?.returned_gtin === row.gtin).length,
      fully_qualified: count("AUTO_ELIGIBLE"),
      safely_addable: count("AUTO_ELIGIBLE"),
      AUTO_ELIGIBLE: count("AUTO_ELIGIBLE"), REVIEW: count("REVIEW"), REJECT: count("REJECT"), NOT_FOUND: count("NOT_FOUND"),
      tier_a: results.filter((row) => row.selected_offer?.match_tier === "A").length,
      tier_b: results.filter((row) => row.selected_offer?.match_tier === "B").length,
      tier_c: results.filter((row) => row.selected_offer?.match_tier === "C").length,
      ebay_becomes_second_retailer: results.filter((row) => row.ebay_would_be_second_retailer).length,
      ebay_lowest_complete_delivered_price: results.filter((row) => row.ebay_is_lower_delivered_price).length,
      median_delivered_price_difference_gbp: median,
      products_still_single_retailer: results.filter((row) => row.current_retailer_count === 1 && !row.ebay_would_be_second_retailer).length,
      blocker_counts: blockerCounts,
      database_writes: 0,
    },
    rows: results,
    artifact_fingerprint: null,
  };
  report.artifact_fingerprint = hash("EBAY-BROWSE-REPORT:1", report);
  return report;
}

function assertConfig(env = process.env) {
  const missing = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_UK_DELIVERY_POSTCODE"].filter((key) => !clean(env[key]));
  if (missing.length) throw new Error(`Missing eBay pilot configuration: ${missing.join(", ")}`);
  const marketplace = clean(env.EBAY_MARKETPLACE_ID || "EBAY_GB");
  if (marketplace !== "EBAY_GB") throw new Error("EBAY_MARKETPLACE_ID must be EBAY_GB for this pilot");
  return {
    client_id: env.EBAY_CLIENT_ID,
    client_secret: env.EBAY_CLIENT_SECRET,
    marketplace_id: marketplace,
    postcode: env.EBAY_UK_DELIVERY_POSTCODE,
    campaign_id: clean(env.EBAY_EPN_CAMPAIGN_ID) || null,
  };
}

async function getApplicationToken(config, fetchImpl = fetch, now = Date.now()) {
  if (tokenCache && tokenCache.client_id === config.client_id && tokenCache.expires_at > now + 60_000) return tokenCache.token;
  const authorization = Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64");
  const response = await fetchImpl(OAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: TOKEN_SCOPE }),
  });
  if (!response.ok) throw new Error(`eBay OAuth failed with HTTP ${response.status}`);
  const body = await response.json();
  if (!clean(body.access_token) || !Number.isFinite(Number(body.expires_in))) throw new Error("eBay OAuth returned an invalid token response");
  tokenCache = { client_id: config.client_id, token: body.access_token, expires_at: now + Number(body.expires_in) * 1000 };
  return body.access_token;
}

async function browseIdentity(identity, config, fetchImpl = fetch) {
  const token = await getApplicationToken(config, fetchImpl);
  const query = new URLSearchParams({
    gtin: identity.gtin,
    limit: "50",
    filter: "buyingOptions:{FIXED_PRICE},conditions:{NEW},deliveryCountry:GB",
  });
  const headers = { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": config.marketplace_id };
  const context = [`contextualLocation=country%3DGB%2Czip%3D${encodeURIComponent(config.postcode)}`];
  if (config.campaign_id) context.push(`affiliateCampaignId=${encodeURIComponent(config.campaign_id)}`);
  headers["X-EBAY-C-ENDUSERCTX"] = context.join(",");
  const response = await fetchImpl(`${BROWSE_URL}/item_summary/search?${query}`, { headers });
  if (!response.ok) throw new Error(`eBay Browse search failed with HTTP ${response.status} for product ${identity.product_id} variant ${identity.variant_id}`);
  const body = await response.json();
  const items = [];
  for (const summary of body.itemSummaries || []) {
    if (!clean(summary.itemHref)) { items.push(summary); continue; }
    const href = new URL(summary.itemHref);
    if (href.origin !== "https://api.ebay.com" || !href.pathname.startsWith("/buy/browse/v1/item/")) throw new Error("eBay returned an unsafe itemHref");
    const detailResponse = await fetchImpl(href.toString(), { headers });
    if (!detailResponse.ok) throw new Error(`eBay Browse item detail failed with HTTP ${detailResponse.status}`);
    items.push({ ...summary, ...(await detailResponse.json()) });
  }
  return items;
}

function resetTokenCache() { tokenCache = null; }

module.exports = { DECISIONS, DEFAULT_POLICY, assertConfig, browseIdentity, buildReport, evaluateIdentity, evaluateItem, getApplicationToken, resetTokenCache };
