const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.resolve(".env.local"), quiet: true });

const OUT = path.resolve("tmp/market-coverage");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function fetchAll(table, columns = "*") {
  const rows = [];
  let expectedCount = null;
  for (let from = 0; ; from += 1000) {
    const { data, error, count } = await supabase
      .from(table)
      .select(columns, { count: "exact" })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!Array.isArray(data) || !Number.isInteger(count)) throw new Error(`${table}: incomplete Supabase response`);
    expectedCount ??= count;
    if (count !== expectedCount) throw new Error(`${table}: row count changed during audit`);
    rows.push(...data);
    if (data.length < 1000) {
      if (rows.length !== expectedCount) throw new Error(`${table}: expected ${expectedCount} rows, received ${rows.length}`);
      return rows;
    }
  }
}

const n = (value) => value === null || value === "" ? null : Number(value);
const round = (value, digits = 2) => value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const pct = (part, total) => total ? round(part * 100 / total, 1) : 0;
const key = (value) => String(value);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const delivered = (offer) => {
  const price = n(offer.price), shipping = n(offer.shipping_cost);
  return Number.isFinite(price) && price > 0 && Number.isFinite(shipping) && shipping >= 0 ? price + shipping : null;
};
const isPublicOffer = (offer, activeIds) => activeIds.has(key(offer.product_id)) && offer.in_stock === true && n(offer.price) > 0 && delivered(offer) !== null;
const group = (rows, getKey) => rows.reduce((map, row) => {
  const k = getKey(row);
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(row);
  return map;
}, new Map());
const latest = (values) => values.filter(Boolean).sort().at(-1) || null;
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const mdCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const mdTable = (columns, rows) => [
  `| ${columns.join(" | ")} |`,
  `|${columns.map(() => "---").join("|")}|`,
  ...rows.map((row) => `| ${row.map(mdCell).join(" | ")} |`),
].join("\n");

function qualityNotes(product, offers) {
  const notes = [];
  if (!product.brand) notes.push("missing brand");
  if (!product.category) notes.push("missing category");
  if (!product.image) notes.push("missing image");
  if (product.unit_pricing_verified !== true) notes.push("unit pricing unverified");
  if (product.serving_count_verified == null) notes.push("serving count unverified");
  if (offers.some((offer) => !offer.last_checked_at)) notes.push("offer never checked");
  return notes.length ? notes.join("; ") : "good";
}

function scorePriority(row, brandCounts, categoryCounts, historyCount, clicks) {
  const brandPopularity = (brandCounts.get(row.brand || "Unknown") || 0) / Math.max(...brandCounts.values());
  const categoryPopularity = (categoryCounts.get(row.category || "Unknown") || 0) / Math.max(...categoryCounts.values());
  const quality = [row.brand, row.category, row.image, row.product_format].filter(Boolean).length / 4;
  const verified = [row.serving_count_verified != null, row.unit_count != null, row.net_weight_g != null || row.net_volume_ml != null, row.unit_pricing_verified === true].filter(Boolean).length / 4;
  const highPrice = Math.min((row.lowest_delivered_price || 0) / 100, 1);
  const history = Math.min((historyCount || 0) / 5, 1);
  const activity = Math.min((clicks || 0) / 10, 1);
  return round(100 * (0.2 * brandPopularity + 0.15 * categoryPopularity + 0.15 * quality + 0.2 * verified + 0.1 * highPrice + 0.1 * history + 0.1 * activity), 1);
}

(async () => {
  const [products, retailers, offers, retailerProducts, priceHistory, clicks] = await Promise.all([
    fetchAll("products"), fetchAll("retailers"), fetchAll("offers"),
    fetchAll("retailer_products"), fetchAll("price_history"), fetchAll("outbound_clicks"),
  ]);
  const activeProducts = products.filter((p) => p.is_active === true && p.merged_into_product_id == null && p.merged_at == null);
  const activeIds = new Set(activeProducts.map((p) => key(p.id)));
  const publicOffers = offers.filter((o) => isPublicOffer(o, activeIds));
  const publicByProduct = group(publicOffers, (o) => key(o.product_id));
  const allActiveProductOffers = offers.filter((o) => activeIds.has(key(o.product_id)));
  const allByRetailer = group(allActiveProductOffers, (o) => key(o.retailer_id));
  const publicByRetailer = group(publicOffers, (o) => key(o.retailer_id));
  const retailerById = new Map(retailers.map((r) => [key(r.id), r]));
  const historyByOffer = group(priceHistory, (h) => key(h.offer_id));
  const clicksByProduct = group(clicks, (c) => key(c.product_id));
  const offerCounts = activeProducts.map((p) => (publicByProduct.get(key(p.id)) || []).length);
  const distribution = [0, 1, 2, 3, 4].map((count) => ({ bucket: String(count), products: offerCounts.filter((n) => n === count).length }));
  distribution.push({ bucket: "5+", products: offerCounts.filter((n) => n >= 5).length });
  const brandCounts = new Map(), categoryCounts = new Map();
  for (const p of activeProducts) {
    brandCounts.set(p.brand || "Unknown", (brandCounts.get(p.brand || "Unknown") || 0) + 1);
    categoryCounts.set(p.category || "Unknown", (categoryCounts.get(p.category || "Unknown") || 0) + 1);
  }

  const productCoverage = activeProducts.map((product) => {
    const po = publicByProduct.get(key(product.id)) || [];
    const totals = po.map(delivered).filter((v) => v !== null);
    const lowest = totals.length ? Math.min(...totals) : null;
    const highest = totals.length ? Math.max(...totals) : null;
    const historyCount = po.reduce((sum, o) => sum + (historyByOffer.get(key(o.id)) || []).length, 0);
    return {
      product_id: key(product.id), product_name: product.name, slug: product.slug, brand: product.brand,
      category: product.category, image: product.image, product_format: product.product_format,
      serving_count_verified: product.serving_count_verified, unit_count: product.unit_count,
      net_weight_g: product.net_weight_g, net_volume_ml: product.net_volume_ml,
      unit_pricing_verified: product.unit_pricing_verified, nutrition_verified: product.nutrition_verified,
      active_offer_count: po.length,
      retailer_names: [...new Set(po.map((o) => retailerById.get(key(o.retailer_id))?.name || `Retailer ${o.retailer_id}`))].sort(),
      lowest_price: po.length ? Math.min(...po.map((o) => n(o.price))) : null,
      lowest_shipping: po.length ? Math.min(...po.map((o) => n(o.shipping_cost))) : null,
      lowest_delivered_price: round(lowest), highest_delivered_price: round(highest),
      delivered_price_spread: lowest === null ? null : round(highest - lowest),
      has_2_plus_offers: po.length >= 2, has_3_plus_offers: po.length >= 3,
      last_offer_check: latest(po.map((o) => o.last_checked_at)),
      price_history_rows: historyCount, outbound_clicks: (clicksByProduct.get(key(product.id)) || []).length,
      data_quality_notes: qualityNotes(product, po),
    };
  });
  const withOffers = productCoverage.filter((p) => p.active_offer_count > 0).sort((a, b) =>
    b.active_offer_count - a.active_offer_count || (b.delivered_price_spread || 0) - (a.delivered_price_spread || 0) || a.product_name.localeCompare(b.product_name));

  const aggregateDimension = (field) => [...group(productCoverage, (p) => p[field] || "Unknown")].map(([name, rows]) => {
    const counts = rows.map((r) => r.active_offer_count);
    const offers = counts.reduce((a, b) => a + b, 0);
    return { name, products: rows.length, products_0: counts.filter((n) => n === 0).length,
      products_1: counts.filter((n) => n === 1).length, products_2_plus: counts.filter((n) => n >= 2).length,
      products_3_plus: counts.filter((n) => n >= 3).length, offers,
      average_offers: round(offers / rows.length), coverage_2_plus_pct: pct(counts.filter((n) => n >= 2).length, rows.length),
      coverage_3_plus_pct: pct(counts.filter((n) => n >= 3).length, rows.length) };
  });
  const brands = aggregateDimension("brand");
  const categories = aggregateDimension("category");
  const bestBrands = [...brands].filter((b) => b.products >= 2).sort((a, b) => b.coverage_2_plus_pct - a.coverage_2_plus_pct || b.products - a.products).slice(0, 20);
  const weakMajorBrands = [...brands].filter((b) => b.products >= 3).sort((a, b) => b.products - a.products || a.coverage_2_plus_pct - b.coverage_2_plus_pct).slice(0, 20);
  const opportunityBrands = [...brands].map((b) => ({ ...b, opportunity_score: round(b.products_1 * (1 + b.products / activeProducts.length) + b.products_0 * 0.5, 1) })).sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 20);

  const retailerRows = retailers.map((retailer) => {
    const ro = publicByRetailer.get(key(retailer.id)) || [];
    const uniqueProducts = new Set(ro.map((o) => key(o.product_id)));
    let sole = 0, second = 0, thirdPlus = 0, cheapestPrice = 0, cheapestDelivered = 0;
    const relative = [];
    for (const o of ro) {
      const productOffers = publicByProduct.get(key(o.product_id)) || [];
      if (productOffers.length === 1) sole++;
      const ordered = [...productOffers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || Number(a.id) - Number(b.id));
      const position = ordered.findIndex((x) => key(x.id) === key(o.id)) + 1;
      if (position === 2) second++;
      if (position >= 3) thirdPlus++;
      const minPrice = Math.min(...productOffers.map((x) => n(x.price)));
      const minDelivered = Math.min(...productOffers.map(delivered));
      if (n(o.price) === minPrice) cheapestPrice++;
      if (delivered(o) === minDelivered) cheapestDelivered++;
      const competitors = productOffers.filter((x) => key(x.retailer_id) !== key(retailer.id)).map(delivered);
      if (competitors.length) relative.push((delivered(o) - Math.min(...competitors)) * 100 / Math.min(...competitors));
    }
    const all = allByRetailer.get(key(retailer.id)) || [];
    const checks = ro.map((o) => o.last_checked_at).filter(Boolean);
    return { retailer_id: key(retailer.id), retailer_name: retailer.name, active_public_offers: ro.length,
      unique_canonical_products: uniqueProducts.size, sole_offer_products: sole,
      second_offer_additions_by_created_at: second, third_plus_additions_by_created_at: thirdPlus,
      avg_pct_vs_cheapest_competitor: relative.length ? round(relative.reduce((a, b) => a + b, 0) / relative.length, 1) : null,
      cheapest_product_price_count: cheapestPrice, cheapest_delivered_price_count: cheapestDelivered,
      out_of_stock_offers: all.filter((o) => o.in_stock !== true).length,
      last_checked_at: latest(checks), never_checked_public_offers: ro.filter((o) => !o.last_checked_at).length,
      value_score: round(sole * 0.5 + second * 2 + thirdPlus * 1.5 + cheapestDelivered, 1) };
  }).sort((a, b) => b.value_score - a.value_score);
  const activeRetailerRows = retailerRows.filter((r) => r.active_public_offers > 0);

  const overlap = [];
  for (let i = 0; i < activeRetailerRows.length; i++) for (let j = i + 1; j < activeRetailerRows.length; j++) {
    const a = activeRetailerRows[i], b = activeRetailerRows[j];
    const aSet = new Set((publicByRetailer.get(a.retailer_id) || []).map((o) => key(o.product_id)));
    const bSet = new Set((publicByRetailer.get(b.retailer_id) || []).map((o) => key(o.product_id)));
    const common = [...aSet].filter((id) => bSet.has(id)).length;
    overlap.push({ retailer_a: a.retailer_name, retailer_b: b.retailer_name, common_products: common,
      only_a: aSet.size - common, only_b: bSet.size - common,
      overlap_smaller_pct: pct(common, Math.min(aSet.size, bSet.size)), overlap_larger_pct: pct(common, Math.max(aSet.size, bSet.size)) });
  }
  overlap.sort((a, b) => b.common_products - a.common_products || b.overlap_smaller_pct - a.overlap_smaller_pct);

  for (const row of productCoverage) row.priority_score = scorePriority(row, brandCounts, categoryCounts, row.price_history_rows, row.outbound_clicks);
  const oneOfferPriority = productCoverage.filter((p) => p.active_offer_count === 1).sort((a, b) => b.priority_score - a.priority_score).slice(0, 50);
  const twoOfferPriority = productCoverage.filter((p) => p.active_offer_count === 2).sort((a, b) => b.priority_score - a.priority_score).slice(0, 50);
  const largestSpreads = productCoverage.filter((p) => p.active_offer_count >= 2).sort((a, b) => b.delivered_price_spread - a.delivered_price_spread).slice(0, 30);
  const oneOfferGoodData = productCoverage.filter((p) => p.active_offer_count === 1 && p.serving_count_verified != null && p.unit_count != null && (p.net_weight_g != null || p.net_volume_ml != null) && p.product_format && p.unit_pricing_verified === true).sort((a, b) => b.priority_score - a.priority_score).slice(0, 30);
  const kpi = {
    total_active_products: activeProducts.length, total_active_public_offers: publicOffers.length,
    active_retailers: activeRetailerRows.length, products_with_0_offers: offerCounts.filter((x) => x === 0).length,
    products_with_1_offer: offerCounts.filter((x) => x === 1).length,
    products_with_2_plus_offers: offerCounts.filter((x) => x >= 2).length,
    products_with_3_plus_offers: offerCounts.filter((x) => x >= 3).length,
    products_with_4_plus_offers: offerCounts.filter((x) => x >= 4).length,
    percentage_with_1_plus: pct(offerCounts.filter((x) => x >= 1).length, activeProducts.length),
    percentage_with_2_plus: pct(offerCounts.filter((x) => x >= 2).length, activeProducts.length),
    percentage_with_3_plus: pct(offerCounts.filter((x) => x >= 3).length, activeProducts.length),
    percentage_with_4_plus: pct(offerCounts.filter((x) => x >= 4).length, activeProducts.length),
    average_offers_per_product: round(publicOffers.length / activeProducts.length), median_offers_per_product: median(offerCounts),
    maximum_offers_per_product: Math.max(...offerCounts),
  };
  const topCoveredBrand = [...brands].filter((b) => b.products >= 3).sort((a, b) => b.coverage_2_plus_pct - a.coverage_2_plus_pct || b.offers - a.offers)[0];
  const weakestMajorBrand = [...brands].filter((b) => b.products >= 5).sort((a, b) => a.coverage_2_plus_pct - b.coverage_2_plus_pct || b.products - a.products)[0];
  const topCategory = [...categories].filter((c) => c.products >= 3).sort((a, b) => b.coverage_2_plus_pct - a.coverage_2_plus_pct || b.offers - a.offers)[0];
  const weakCategory = [...categories].filter((c) => c.products >= 5).sort((a, b) => a.coverage_2_plus_pct - b.coverage_2_plus_pct || b.products - a.products)[0];
  Object.assign(kpi, { top_covered_brand: topCoveredBrand?.name, weakest_major_brand: weakestMajorBrand?.name,
    top_covered_category: topCategory?.name, weakest_major_category: weakCategory?.name,
    retailer_creating_most_second_offers: [...retailerRows].sort((a,b)=>b.second_offer_additions_by_created_at-a.second_offer_additions_by_created_at)[0]?.retailer_name,
    retailer_creating_most_third_plus_offers: [...retailerRows].sort((a,b)=>b.third_plus_additions_by_created_at-a.third_plus_additions_by_created_at)[0]?.retailer_name });
  const targets = [30, 60, 90].map((days, index) => {
    const factor = index + 1;
    const newProducts = [15, 35, 60][index];
    const targetProducts = activeProducts.length + newProducts;
    const twoPlus = Math.min(activeProducts.length, kpi.products_with_2_plus_offers + Math.round(kpi.products_with_1_offer * 0.12 * factor));
    const threePlus = Math.min(twoPlus, kpi.products_with_3_plus_offers + Math.round(kpi.products_with_2_plus_offers * 0.18 * factor));
    const targetOffers = publicOffers.length + newProducts + (twoPlus - kpi.products_with_2_plus_offers) + (threePlus - kpi.products_with_3_plus_offers);
    return { days, retailers: activeRetailerRows.length + factor, active_products: targetProducts,
      products_2_plus: twoPlus, products_3_plus: threePlus, average_offers_per_product: round(targetOffers / targetProducts),
      real_comparison_pct: pct(twoPlus, targetProducts) };
  });
  const businessVerdict = {
    current_position: "product catalogue with market-search capability; not yet a mature price comparison service",
    largest_coverage_problem: "Only 37 of 710 active products have 2+ public offers; 518 have exactly one.",
    next_retailer_recommendation: "No named retailer can be approved from repository evidence. Prioritise a broad UK multi-brand retailer covering Applied Nutrition, BioTech USA, Solgar, USN, Now Foods and Osavi.",
    strategy: "Increase overlap first while allowing selective new products.",
    work_mix: { overlap: "70%", new_products: "20%", data_quality: "10%" },
    next_small_step: "Obtain one candidate feed from a broad UK multi-brand retailer and run a read-only canonical match against the top-50 one-offer list before onboarding.",
  };
  const report = {
    generated_at: new Date().toISOString(), mode: "read-only production audit",
    visibility_definition: { product: "is_active=true, merged_into_product_id IS NULL, merged_at IS NULL",
      offer: "in_stock=true, price>0, shipping_cost is finite and >=0 (matches public delivered-price normalization)",
      retailer: "no is_active column exists; active means at least one public offer" },
    source_counts: { products: products.length, retailers: retailers.length, offers: offers.length, retailer_products: retailerProducts.length, price_history: priceHistory.length, outbound_clicks: clicks.length },
    kpi, distribution, product_coverage: withOffers, zero_offer_products: productCoverage.filter((p) => p.active_offer_count === 0),
    brands: { all: brands.sort((a,b)=>b.products-a.products), best_covered: bestBrands, weak_major: weakMajorBrands, highest_opportunity: opportunityBrands },
    categories: { all: categories.sort((a,b)=>b.products-a.products), best_covered: [...categories].sort((a,b)=>b.coverage_2_plus_pct-a.coverage_2_plus_pct), weakest: [...categories].sort((a,b)=>a.coverage_2_plus_pct-b.coverage_2_plus_pct), highest_opportunity: [...categories].sort((a,b)=>b.products_1-a.products_1) },
    retailers: retailerRows, overlap, priorities: { one_offer_top_50: oneOfferPriority, two_offer_top_50: twoOfferPriority, largest_spreads_top_30: largestSpreads, one_offer_good_data_top_30: oneOfferGoodData },
    future_retailer_data: { candidates: [], note: "No dataset for a not-yet-connected retailer was found. Existing repository feeds belong to current retailers; no speculative estimate made." },
    targets, business_verdict: businessVerdict, methodology_notes: [
      "Second/third+ retailer contribution is ordered by offers.created_at, then id; it is not a causal onboarding audit.",
      "Lowest shipping is independent of lowest product price; delivered metrics require known non-negative shipping.",
      "Priority score weights brand popularity 20%, category popularity 15%, product data quality 15%, verified metrics 20%, price 10%, history 10%, outbound clicks 10%.",
      "Targets are planning scenarios, not forecasts: each 30-day period adds one overlap-oriented retailer and converts 12% of current singletons toward 2+ coverage.",
    ],
  };

  const productColumns = ["product_id","product_name","slug","brand","category","active_offer_count","retailer_names","lowest_price","lowest_shipping","lowest_delivered_price","highest_delivered_price","delivered_price_spread","has_2_plus_offers","has_3_plus_offers","last_offer_check","data_quality_notes","priority_score"];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "market-coverage-report.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT, "product-coverage.csv"), [productColumns.join(","), ...withOffers.map((r) => productColumns.map((c) => csvCell(Array.isArray(r[c]) ? r[c].join("; ") : r[c])).join(","))].join("\n") + "\n");
  const compactProduct = (r) => [r.product_id, r.product_name, r.brand, r.category, r.active_offer_count, r.retailer_names.join(", "), r.lowest_delivered_price, r.delivered_price_spread, r.priority_score];
  const compactDimension = (r) => [r.name,r.products,r.products_0,r.products_1,r.products_2_plus,r.products_3_plus,r.offers,r.average_offers,r.coverage_2_plus_pct,r.coverage_3_plus_pct];
  const md = [
    "# SupplementScout market coverage audit", "", `Generated: ${report.generated_at}`, "",
    "## A. Executive summary", "", `Active canonical products: **${kpi.total_active_products}**; public offers: **${kpi.total_active_public_offers}**; active retailers: **${kpi.active_retailers}**.`,
    `Products with real comparison (2+): **${kpi.products_with_2_plus_offers} (${kpi.percentage_with_2_plus}%)**; 3+: **${kpi.products_with_3_plus_offers} (${kpi.percentage_with_3_plus}%)**.`, "",
    "## B. Main KPI", "", mdTable(["Metric","Value"], Object.entries(kpi).map(([a,b])=>[a,b])), "",
    "## C. Offer distribution", "", mdTable(["Offers","Products"], distribution.map(r=>[r.bucket,r.products])), "",
    "## D. Brands", "", "### Best covered", "", mdTable(["Brand","Products","0","1","2+","3+","Offers","Avg","2+ %","3+ %"], bestBrands.map(compactDimension)), "",
    "### Weak major brands", "", mdTable(["Brand","Products","0","1","2+","3+","Offers","Avg","2+ %","3+ %"], weakMajorBrands.map(compactDimension)), "",
    "### Highest overlap opportunity", "", mdTable(["Brand","Products","0","1","2+","3+","Offers","Avg","2+ %","3+ %"], opportunityBrands.map(compactDimension)), "",
    "## E. Categories", "", mdTable(["Category","Products","0","1","2+","3+","Offers","Avg","2+ %","3+ %"], categories.map(compactDimension)), "",
    "## F. Retailers", "", mdTable(["Retailer","Public offers","Products","Sole","Second","Third+","Avg % vs competitor","Cheapest delivered","OOS","Last checked","Value score"], retailerRows.map(r=>[r.retailer_name,r.active_public_offers,r.unique_canonical_products,r.sole_offer_products,r.second_offer_additions_by_created_at,r.third_plus_additions_by_created_at,r.avg_pct_vs_cheapest_competitor,r.cheapest_delivered_price_count,r.out_of_stock_offers,r.last_checked_at,r.value_score])), "",
    "## G. Retailer overlap", "", mdTable(["A","B","Common","Only A","Only B","Overlap smaller %","Overlap larger %"], overlap.map(r=>[r.retailer_a,r.retailer_b,r.common_products,r.only_a,r.only_b,r.overlap_smaller_pct,r.overlap_larger_pct])), "",
    "## H. Priority products", "", "### Top 50 with one offer", "", mdTable(["ID","Product","Brand","Category","Offers","Retailers","Lowest delivered","Spread","Score"], oneOfferPriority.map(compactProduct)), "",
    "### Top 50 with two offers", "", mdTable(["ID","Product","Brand","Category","Offers","Retailers","Lowest delivered","Spread","Score"], twoOfferPriority.map(compactProduct)), "",
    "### Top 30 delivered-price spreads", "", mdTable(["ID","Product","Brand","Category","Offers","Retailers","Lowest delivered","Spread","Score"], largestSpreads.map(compactProduct)), "",
    "### Top 30 one-offer products with complete verified pricing data", "", oneOfferGoodData.length ? mdTable(["ID","Product","Brand","Category","Offers","Retailers","Lowest delivered","Spread","Score"], oneOfferGoodData.map(compactProduct)) : "No products met every strict criterion.", "",
    "## I. Future retailer evidence", "", report.future_retailer_data.note, "",
    "## J. 30/60/90-day targets", "", mdTable(["Days","Retailers","Products","2+","3+","Avg offers","Comparison %"], targets.map(t=>[t.days,t.retailers,t.active_products,t.products_2_plus,t.products_3_plus,t.average_offers_per_product,t.real_comparison_pct])), "",
    "## K. Business verdict and next small step", "", mdTable(["Question","Answer"], [["Current position",businessVerdict.current_position],["Largest problem",businessVerdict.largest_coverage_problem],["Next retailer",businessVerdict.next_retailer_recommendation],["Strategy",businessVerdict.strategy],["Work mix",Object.entries(businessVerdict.work_mix).map(([k,v])=>`${k}: ${v}`).join(", ")],["Next small step",businessVerdict.next_small_step]]), "",
    "## Full product coverage table", "", mdTable(["ID","Product","Brand","Category","Offers","Retailers","Lowest delivered","Spread","Score"], withOffers.map(compactProduct)), "",
    "## Methodology notes", "", ...report.methodology_notes.map(n=>`- ${n}`), "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "market-coverage-report.md"), md);
  console.log(JSON.stringify({ kpi, top_retailers: retailerRows.slice(0,3), files: ["market-coverage-report.json","market-coverage-report.md","product-coverage.csv"] }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
