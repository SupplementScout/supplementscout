import "server-only";

import { cache } from "react";
import { isOfferFresh } from "./offerFreshness";
import { getDeliveredPrice, type DeliveredPrice } from "./pricing";
import { supabaseAdmin } from "./supabaseAdmin";

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const ALLOWED_SIZE_UNITS = new Set(["g", "ml", "servings"]);

export const VERIFIED_PRICE_DROP_RULES = {
  minimumDropAmount: 2,
  minimumDropRatio: 0.1,
  minimumDistinctDates: 3,
  minimumElapsedDays: 14,
  requiredStablePriorDays: 7,
} as const;

export const DEALS_INDEX_GATE = {
  minimumProducts: 12,
  minimumOffers: 30,
  minimumRetailers: 4,
  minimumRetailersPerProduct: 2,
} as const;

type OneOrMany<T> = T | T[] | null;

type RawRetailer = { id: number | string; name: string | null; slug: string | null };
type RawProduct = {
  id: number | string;
  name: string | null;
  slug: string | null;
  brand: string | null;
  image: string | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
};
type RawVariant = {
  id: number | string;
  product_id: number | string | null;
  pack_count: number | string | null;
  size_value: number | string | null;
  size_unit: string | null;
  is_active: boolean | null;
};
type RawRetailerProduct = {
  id: number | string;
  product_id: number | string | null;
  product_variant_id: number | string | null;
  external_product_id: string | null;
  external_variant_id: string | null;
  product_variant: OneOrMany<RawVariant>;
};

export type RawDealsOffer = {
  id: number | string;
  product_id: number | string | null;
  retailer_id: number | string | null;
  retailer_product_id: number | string | null;
  price: number | string | null;
  shipping_cost: number | string | null;
  in_stock: boolean | null;
  last_checked_at: string | null;
  url: string | null;
  retailer: OneOrMany<RawRetailer>;
  product: OneOrMany<RawProduct>;
  retailer_product: OneOrMany<RawRetailerProduct>;
};

export type DealsOffer = {
  id: string;
  url: string;
  lastCheckedAt: string;
  productPrice: number;
  shippingCost: number;
  deliveredPrice: DeliveredPrice;
  retailer: { id: string; name: string; slug: string | null };
};

export type DealsRow = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  productUrl: string;
  variantId: string;
  packLabel: string;
  retailerCount: number;
  offerCount: number;
  lastCheckedAt: string;
  bestOffer: DealsOffer;
  offers: DealsOffer[];
};

export type DealsSummary = {
  visibleProducts: number;
  qualifyingOffers: number;
  freshRetailers: number;
  productsWithMultipleFreshRetailers: number;
  latestOfferCheckedAt: string | null;
};

export type DealsResult = {
  rows: DealsRow[];
  summary: DealsSummary;
  verifiedDrops: VerifiedPriceDropRow[];
  verifiedDropsEnabled: boolean;
  verifiedDropsError: boolean;
  error: boolean;
};

export type RawVerifiedPriceDropEvidence = {
  drop_observation_id: number | string | null;
  identity_series_id: number | string | null;
  offer_id: number | string | null;
  retailer_id: number | string | null;
  retailer_slug: string | null;
  retailer_name: string | null;
  product_name: string | null;
  product_slug: string | null;
  product_brand: string | null;
  product_image: string | null;
  product_active: boolean | null;
  product_merged_into_id: number | string | null;
  variant_active: boolean | null;
  pack_count: number | string | null;
  size_value: number | string | null;
  size_unit: string | null;
  offer_url: string | null;
  current_product_price: number | string | null;
  current_shipping_cost: number | string | null;
  current_total_price: number | string | null;
  current_in_stock: boolean | null;
  current_last_checked_at: string | null;
  previous_total_price: number | string | null;
  drop_total_price: number | string | null;
  drop_checked_at: string | null;
  drop_observation_date: string | null;
  drop_evidence_status: string | null;
  drop_anomaly_flags: unknown;
  first_proven_at: string | null;
  distinct_proven_dates: number | string | null;
  prior_stable_dates: number | string | null;
  prior_conflicts: number | string | null;
  subsequent_conflicts: number | string | null;
  offer_series_count: number | string | null;
  identity_matches: boolean | null;
  latest_matches: boolean | null;
  producer_enabled: boolean | null;
  producer_public_use: string | null;
  producer_approved_scope: string | null;
  release_enabled: boolean | null;
};

export type RawPriceDropCandidateInventory = {
  schema_version: number | string | null;
  kind: string | null;
  captured_at: string | null;
  database_writes: number | string | null;
  candidates: unknown;
};

export type VerifiedPriceDropRow = {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  productUrl: string;
  packLabel: string;
  previousDeliveredPrice: number;
  currentDeliveredPrice: number;
  savingAmount: number;
  savingPercent: number;
  droppedAt: string;
  lastCheckedAt: string;
  evidenceDays: number;
  offer: DealsOffer;
};

export type VerifiedPriceDropCandidateRow = VerifiedPriceDropRow & {
  releaseEnabled: boolean;
  approvedScope: string;
};

export type PriceDropCandidateInventory = {
  available: boolean;
  error: boolean;
  capturedAt: string | null;
  candidateCount: number;
  releasedCandidateCount: number;
  awaitingRetailerApprovalCount: number;
  candidates: VerifiedPriceDropCandidateRow[];
};

function toVerifiedPriceDropRow(candidate: VerifiedPriceDropCandidateRow): VerifiedPriceDropRow {
  return {
    id: candidate.id,
    name: candidate.name,
    brand: candidate.brand,
    image: candidate.image,
    productUrl: candidate.productUrl,
    packLabel: candidate.packLabel,
    previousDeliveredPrice: candidate.previousDeliveredPrice,
    currentDeliveredPrice: candidate.currentDeliveredPrice,
    savingAmount: candidate.savingAmount,
    savingPercent: candidate.savingPercent,
    droppedAt: candidate.droppedAt,
    lastCheckedAt: candidate.lastCheckedAt,
    evidenceDays: candidate.evidenceDays,
    offer: candidate.offer,
  };
}

type NormalizedOffer = DealsOffer & {
  product: RawProduct & { id: string; name: string; slug: string };
  variant: RawVariant & { id: string; pack_count: number; size_value: number; size_unit: string };
};

function one<T>(value: OneOrMany<T>): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
}

function compareIds(left: string, right: string) {
  return left.length - right.length || left.localeCompare(right);
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sameId(left: unknown, right: unknown) {
  return left !== null && right !== null && String(left) === String(right);
}

function validUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function wholeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function emptyFlags(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

export function isVerifiedPriceDropsEnabled(env = process.env) {
  return env.SEO15_STAGE3_ENABLED === "true";
}

export function isPriceDropCandidateMonitorEnabled(env = process.env) {
  return env.SEO15_STAGE3_MONITOR_ENABLED === "true";
}

export function normalizePriceDropCandidates(
  evidence: RawVerifiedPriceDropEvidence[],
  now = new Date()
): VerifiedPriceDropCandidateRow[] {
  const rows = evidence.flatMap((raw) => {
    const offerId = positiveId(raw.offer_id);
    const seriesId = positiveId(raw.identity_series_id);
    const observationId = positiveId(raw.drop_observation_id);
    const retailerId = positiveId(raw.retailer_id);
    const productPrice = positiveNumber(raw.current_product_price);
    const shippingCost = nonNegativeNumber(raw.current_shipping_cost);
    const currentTotal = positiveNumber(raw.current_total_price);
    const previousTotal = positiveNumber(raw.previous_total_price);
    const dropTotal = positiveNumber(raw.drop_total_price);
    const packCount = positiveInteger(raw.pack_count);
    const sizeValue = positiveNumber(raw.size_value);
    const sizeUnit = raw.size_unit?.trim().toLowerCase() || "";
    const distinctDates = wholeNumber(raw.distinct_proven_dates);
    const priorStableDates = wholeNumber(raw.prior_stable_dates);
    const priorConflicts = wholeNumber(raw.prior_conflicts);
    const subsequentConflicts = wholeNumber(raw.subsequent_conflicts);
    const offerSeriesCount = wholeNumber(raw.offer_series_count);
    const firstProvenAt = Date.parse(raw.first_proven_at || "");
    const droppedAt = Date.parse(raw.drop_checked_at || "");
    const lastCheckedAt = Date.parse(raw.current_last_checked_at || "");
    const decrease = previousTotal !== null && dropTotal !== null ? previousTotal - dropTotal : 0;
    const decreaseRatio = previousTotal ? decrease / previousTotal : 0;
    const elapsedDays = Number.isFinite(firstProvenAt)
      ? Math.floor((now.getTime() - firstProvenAt) / 86_400_000)
      : -1;
    const deliveredPrice = productPrice !== null && shippingCost !== null
      ? getDeliveredPrice({ price: productPrice, shipping_cost: shippingCost })
      : null;

    if (
      !offerId || !seriesId || !observationId || !retailerId ||
      raw.producer_enabled !== true || raw.producer_public_use !== "eligible-after-separate-approval" ||
      raw.identity_matches !== true || raw.latest_matches !== true ||
      raw.product_active !== true || raw.product_merged_into_id !== null || raw.variant_active !== true ||
      raw.current_in_stock !== true || !isOfferFresh(raw.current_last_checked_at, now) ||
      productPrice === null || shippingCost === null || !deliveredPrice ||
      currentTotal === null || dropTotal === null || previousTotal === null ||
      deliveredPrice.totalPrice !== currentTotal || currentTotal !== dropTotal ||
      decrease < VERIFIED_PRICE_DROP_RULES.minimumDropAmount ||
      decreaseRatio < VERIFIED_PRICE_DROP_RULES.minimumDropRatio ||
      distinctDates === null || distinctDates < VERIFIED_PRICE_DROP_RULES.minimumDistinctDates ||
      elapsedDays < VERIFIED_PRICE_DROP_RULES.minimumElapsedDays ||
      priorStableDates !== VERIFIED_PRICE_DROP_RULES.requiredStablePriorDays ||
      priorConflicts !== 0 || subsequentConflicts !== 0 || offerSeriesCount !== 1 ||
      raw.drop_evidence_status !== "proven" || !emptyFlags(raw.drop_anomaly_flags) ||
      !Number.isFinite(droppedAt) || !Number.isFinite(lastCheckedAt) || droppedAt > lastCheckedAt ||
      !packCount || !sizeValue || !ALLOWED_SIZE_UNITS.has(sizeUnit) ||
      !raw.product_name?.trim() || !raw.product_slug?.trim() || !raw.retailer_name?.trim() ||
      !raw.retailer_slug?.trim() || !raw.producer_approved_scope?.trim() ||
      !validUrl(raw.offer_url)
    ) {
      return [];
    }

    return [{
      id: `${seriesId}:${observationId}`,
      name: raw.product_name.trim(),
      brand: raw.product_brand?.trim() || null,
      image: raw.product_image,
      productUrl: `/product/${raw.product_slug.trim()}`,
      packLabel: formatDealsPackLabel({ pack_count: packCount, size_value: sizeValue, size_unit: sizeUnit }),
      previousDeliveredPrice: previousTotal,
      currentDeliveredPrice: currentTotal,
      savingAmount: Number(decrease.toFixed(2)),
      savingPercent: Number((decreaseRatio * 100).toFixed(1)),
      droppedAt: raw.drop_checked_at!,
      lastCheckedAt: raw.current_last_checked_at!,
      evidenceDays: elapsedDays,
      releaseEnabled: raw.release_enabled === true,
      approvedScope: raw.producer_approved_scope.trim(),
      offer: {
        id: offerId,
        url: raw.offer_url!,
        lastCheckedAt: raw.current_last_checked_at!,
        productPrice,
        shippingCost,
        deliveredPrice,
        retailer: { id: retailerId, name: raw.retailer_name.trim(), slug: raw.retailer_slug },
      },
    } satisfies VerifiedPriceDropCandidateRow];
  });

  return rows.sort((a, b) =>
    b.savingPercent - a.savingPercent || b.savingAmount - a.savingAmount || compareIds(a.offer.id, b.offer.id)
  );
}

export function normalizeVerifiedPriceDrops(
  evidence: RawVerifiedPriceDropEvidence[],
  now = new Date()
): VerifiedPriceDropRow[] {
  return normalizePriceDropCandidates(evidence, now)
    .filter((row) => row.releaseEnabled)
    .map(toVerifiedPriceDropRow);
}

export function normalizePriceDropCandidateInventory(
  raw: RawPriceDropCandidateInventory,
  now = new Date()
): PriceDropCandidateInventory {
  const capturedAt = typeof raw.captured_at === "string" && Number.isFinite(Date.parse(raw.captured_at))
    ? raw.captured_at
    : null;
  if (
    Number(raw.schema_version) !== 1 ||
    raw.kind !== "seo15-stage3-candidate-inventory" ||
    Number(raw.database_writes) !== 0 ||
    !capturedAt ||
    !Array.isArray(raw.candidates)
  ) {
    return emptyPriceDropCandidateInventory(true);
  }
  const candidates = normalizePriceDropCandidates(raw.candidates as RawVerifiedPriceDropEvidence[], now);
  const releasedCandidateCount = candidates.filter((row) => row.releaseEnabled).length;
  return {
    available: true,
    error: false,
    capturedAt,
    candidateCount: candidates.length,
    releasedCandidateCount,
    awaitingRetailerApprovalCount: candidates.length - releasedCandidateCount,
    candidates,
  };
}

export function emptyPriceDropCandidateInventory(error = false): PriceDropCandidateInventory {
  return {
    available: false,
    error,
    capturedAt: null,
    candidateCount: 0,
    releasedCandidateCount: 0,
    awaitingRetailerApprovalCount: 0,
    candidates: [],
  };
}

function normalizeOffer(raw: RawDealsOffer, now: Date): NormalizedOffer | null {
  const product = one(raw.product);
  const retailer = one(raw.retailer);
  const retailerProduct = one(raw.retailer_product);
  const variant = one(retailerProduct?.product_variant || null);
  const deliveredPrice = getDeliveredPrice(raw);
  const offerId = positiveId(raw.id);
  const productId = positiveId(product?.id);
  const retailerId = positiveId(retailer?.id);
  const variantId = positiveId(variant?.id);
  const packCount = positiveInteger(variant?.pack_count);
  const sizeValue = positiveNumber(variant?.size_value);
  const sizeUnit = variant?.size_unit?.trim().toLowerCase() || "";

  if (
    raw.in_stock !== true ||
    !isOfferFresh(raw.last_checked_at, now) ||
    !deliveredPrice ||
    !offerId ||
    !productId ||
    !retailerId ||
    !variantId ||
    !packCount ||
    !sizeValue ||
    !ALLOWED_SIZE_UNITS.has(sizeUnit) ||
    !product ||
    product.is_active !== true ||
    product.merged_into_product_id !== null ||
    !product.name?.trim() ||
    !product.slug?.trim() ||
    !retailer?.name?.trim() ||
    !retailerProduct ||
    variant?.is_active !== true ||
    !retailerProduct.external_product_id?.trim() ||
    !retailerProduct.external_variant_id?.trim() ||
    !sameId(raw.product_id, product.id) ||
    !sameId(retailerProduct.product_id, product.id) ||
    !sameId(retailerProduct.product_variant_id, variant.id) ||
    !sameId(variant.product_id, product.id) ||
    !validUrl(raw.url)
  ) {
    return null;
  }

  return {
    id: offerId,
    url: raw.url!,
    lastCheckedAt: raw.last_checked_at!,
    productPrice: deliveredPrice.productPrice,
    shippingCost: deliveredPrice.shippingCost,
    deliveredPrice,
    retailer: { id: retailerId, name: retailer.name!.trim(), slug: retailer.slug },
    product: { ...product, id: productId, name: product.name.trim(), slug: product.slug.trim() },
    variant: { ...variant, id: variantId, pack_count: packCount, size_value: sizeValue, size_unit: sizeUnit },
  };
}

export function formatDealsPackLabel(variant: Pick<RawVariant, "pack_count" | "size_value" | "size_unit">) {
  const pack = Number(variant.pack_count);
  const size = Number(variant.size_value);
  const unit = variant.size_unit?.toLowerCase() || "";
  const sizeText = Number.isInteger(size) ? String(size) : String(Number(size.toFixed(2)));
  return pack === 1 ? `${sizeText}${unit}` : `${pack} × ${sizeText}${unit}`;
}

export function normalizeDeals(rawOffers: RawDealsOffer[], now = new Date()): DealsRow[] {
  const groups = new Map<string, NormalizedOffer[]>();
  for (const raw of rawOffers) {
    const offer = normalizeOffer(raw, now);
    if (!offer) continue;
    const key = `${offer.product.id}:${offer.variant.id}`;
    groups.set(key, [...(groups.get(key) || []), offer]);
  }

  const candidateRows = [...groups.values()].flatMap((offers) => {
    const bestByRetailer = new Map<string, NormalizedOffer>();
    for (const offer of offers) {
      const current = bestByRetailer.get(offer.retailer.id);
      if (!current || offer.deliveredPrice.totalPrice < current.deliveredPrice.totalPrice ||
          (offer.deliveredPrice.totalPrice === current.deliveredPrice.totalPrice && compareIds(offer.id, current.id) < 0)) {
        bestByRetailer.set(offer.retailer.id, offer);
      }
    }
    const selected = [...bestByRetailer.values()].sort((a, b) =>
      a.deliveredPrice.totalPrice - b.deliveredPrice.totalPrice || compareIds(a.id, b.id)
    );
    if (selected.length < DEALS_INDEX_GATE.minimumRetailersPerProduct) return [];
    const first = selected[0];
    const latest = selected.reduce((value, offer) =>
      Date.parse(offer.lastCheckedAt) > Date.parse(value) ? offer.lastCheckedAt : value,
      first.lastCheckedAt
    );
    const publicOffers: DealsOffer[] = selected.map((offer) => ({
      id: offer.id,
      url: offer.url,
      lastCheckedAt: offer.lastCheckedAt,
      productPrice: offer.productPrice,
      shippingCost: offer.shippingCost,
      deliveredPrice: offer.deliveredPrice,
      retailer: offer.retailer,
    }));
    return [{
      id: first.product.id,
      name: first.product.name,
      brand: first.product.brand,
      image: first.product.image,
      productUrl: `/product/${first.product.slug}`,
      variantId: first.variant.id,
      packLabel: formatDealsPackLabel(first.variant),
      retailerCount: publicOffers.length,
      offerCount: publicOffers.length,
      lastCheckedAt: latest,
      bestOffer: publicOffers[0],
      offers: publicOffers,
    } satisfies DealsRow];
  });

  const bestVariantByProduct = new Map<string, DealsRow>();
  for (const row of candidateRows) {
    const current = bestVariantByProduct.get(row.id);
    if (!current || row.retailerCount > current.retailerCount ||
        (row.retailerCount === current.retailerCount && row.bestOffer.deliveredPrice.totalPrice < current.bestOffer.deliveredPrice.totalPrice) ||
        (row.retailerCount === current.retailerCount && row.bestOffer.deliveredPrice.totalPrice === current.bestOffer.deliveredPrice.totalPrice && compareIds(row.variantId, current.variantId) < 0)) {
      bestVariantByProduct.set(row.id, row);
    }
  }

  return [...bestVariantByProduct.values()].sort((a, b) =>
    b.retailerCount - a.retailerCount || a.bestOffer.deliveredPrice.totalPrice - b.bestOffer.deliveredPrice.totalPrice || compareIds(a.id, b.id)
  );
}

function summarize(rows: DealsRow[]): DealsSummary {
  const offers = rows.flatMap((row) => row.offers);
  const checked = offers.map((offer) => offer.lastCheckedAt).filter((value) => Number.isFinite(Date.parse(value)));
  return {
    visibleProducts: rows.length,
    qualifyingOffers: offers.length,
    freshRetailers: new Set(offers.map((offer) => offer.retailer.id)).size,
    productsWithMultipleFreshRetailers: rows.filter((row) => row.retailerCount >= 2).length,
    latestOfferCheckedAt: checked.length ? checked.sort((a, b) => Date.parse(b) - Date.parse(a))[0] : null,
  };
}

function summarizeQualifyingRawOffers(
  rawOffers: RawDealsOffer[],
  rows: DealsRow[],
  now = new Date()
): DealsSummary {
  const normalized = rawOffers
    .map((offer) => normalizeOffer(offer, now))
    .filter((offer): offer is NormalizedOffer => Boolean(offer));
  const retailersByVariant = new Map<string, Set<string>>();
  for (const offer of normalized) {
    const key = `${offer.product.id}:${offer.variant.id}`;
    const retailers = retailersByVariant.get(key) || new Set<string>();
    retailers.add(offer.retailer.id);
    retailersByVariant.set(key, retailers);
  }
  const offers = normalized.filter((offer) =>
    (retailersByVariant.get(`${offer.product.id}:${offer.variant.id}`)?.size || 0) >=
    DEALS_INDEX_GATE.minimumRetailersPerProduct
  );
  const checked = offers
    .map((offer) => offer.lastCheckedAt)
    .filter((value) => Number.isFinite(Date.parse(value)));
  return {
    visibleProducts: rows.length,
    qualifyingOffers: offers.length,
    freshRetailers: new Set(offers.map((offer) => offer.retailer.id)).size,
    productsWithMultipleFreshRetailers: rows.filter((row) => row.retailerCount >= 2).length,
    latestOfferCheckedAt: checked.length
      ? checked.sort((a, b) => Date.parse(b) - Date.parse(a))[0]
      : null,
  };
}

export function buildDealsResult(
  rawOffers: RawDealsOffer[],
  now = new Date()
): DealsResult {
  const rows = normalizeDeals(rawOffers, now);
  return {
    rows,
    summary: summarizeQualifyingRawOffers(rawOffers, rows, now),
    verifiedDrops: [],
    verifiedDropsEnabled: false,
    verifiedDropsError: false,
    error: false,
  };
}

export function evaluateDealsIndexability(summary: DealsSummary, valid: boolean) {
  const reasons: string[] = [];
  if (!valid) reasons.push("query-error");
  if (summary.visibleProducts < DEALS_INDEX_GATE.minimumProducts) reasons.push("insufficient-products");
  if (summary.qualifyingOffers < DEALS_INDEX_GATE.minimumOffers) reasons.push("insufficient-offers");
  if (summary.freshRetailers < DEALS_INDEX_GATE.minimumRetailers) reasons.push("insufficient-retailers");
  if (summary.productsWithMultipleFreshRetailers !== summary.visibleProducts) reasons.push("single-retailer-product");
  return { indexable: reasons.length === 0, reasons };
}

export function emptyDealsResult(error = false): DealsResult {
  const rows: DealsRow[] = [];
  return {
    rows,
    summary: summarize(rows),
    verifiedDrops: [],
    verifiedDropsEnabled: false,
    verifiedDropsError: false,
    error,
  };
}

export async function loadPriceDropCandidateInventory(now = new Date()) {
  const { data, error } = await supabaseAdmin.rpc("get_seo15_stage3_candidate_inventory");
  if (error || !data || Array.isArray(data) || typeof data !== "object") {
    return emptyPriceDropCandidateInventory(true);
  }
  return normalizePriceDropCandidateInventory(data as RawPriceDropCandidateInventory, now);
}

async function loadDeals(): Promise<DealsResult> {
  const verifiedDropsEnabled = isVerifiedPriceDropsEnabled();
  const verifiedDropsPromise = verifiedDropsEnabled
    ? loadPriceDropCandidateInventory()
    : Promise.resolve(emptyPriceDropCandidateInventory(false));
  const rawOffers: RawDealsOffer[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        id, product_id, retailer_id, retailer_product_id, price, shipping_cost,
        in_stock, last_checked_at, url,
        retailer:retailers!offers_retailer_id_fkey (id, name, slug),
        product:products!offers_product_id_fkey (id, name, slug, brand, image, is_active, merged_into_product_id),
        retailer_product:retailer_products!offers_retailer_product_identity_fkey (
          id, product_id, product_variant_id, external_product_id, external_variant_id,
          product_variant:product_variants!retailer_products_variant_product_fkey (
            id, product_id, pack_count, size_value, size_unit, is_active
          )
        )
      `)
      .eq("in_stock", true)
      .gt("price", 0)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return emptyDealsResult(true);
    const records = (data || []) as unknown as RawDealsOffer[];
    rawOffers.push(...records);
    if (records.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) return emptyDealsResult(true);
  }
  const current = buildDealsResult(rawOffers);
  const historical = await verifiedDropsPromise;
  return {
    ...current,
    verifiedDrops: historical.candidates
      .filter((row) => row.releaseEnabled)
      .map(toVerifiedPriceDropRow),
    verifiedDropsEnabled,
    verifiedDropsError: historical.error,
  };
}

export const getDeals = cache(loadDeals);
