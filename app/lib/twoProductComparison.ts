import { cache } from "react";
import {
  emptyCategoryComparisonResult,
  normalizeCategoryComparison,
  type CategoryComparisonResult,
  type CategoryComparisonRow,
  type ComparisonNutritionVariant,
  type RawCategoryComparisonProduct,
  type RawComparisonOffer,
} from "./categoryComparison";
import { resolveCategoryComparisonVariants } from "./categoryComparisonVariants";
import { getEffectiveNutritionMetrics } from "./nutritionMetrics";
import { getKnownProductPrice } from "./pricing";
import { loadAppliedPreWorkoutFacts } from "./reviewedPreWorkoutFacts.server";
import type { AppliedPreWorkoutFacts } from "./reviewedPreWorkoutFacts";
import { supabase } from "./supabase";

const PRODUCT_PAGE_SIZE = 200;

export type TwoProductComparisonRow = CategoryComparisonRow & {
  exactPackLabel: string | null;
  exactVariantLabel: string | null;
  exactVariantId: string | null;
  preWorkoutFacts: AppliedPreWorkoutFacts | null;
};

export type TwoProductComparisonResult = Omit<CategoryComparisonResult, "rows"> & {
  rows: TwoProductComparisonRow[];
};

export type TwoProductSelection = {
  state: "empty" | "partial" | "duplicate" | "not_found" | "ready";
  left: TwoProductComparisonRow | null;
  right: TwoProductComparisonRow | null;
};

export type ComparisonPriceHistorySummary = {
  lowestDeliveredPrice: number;
  firstRecordedAt: string;
  lastRecordedAt: string;
  recordCount: number;
};

export type TwoProductPriceHistory = Record<
  string,
  ComparisonPriceHistorySummary | null
>;

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function positiveNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveInteger(value: number | string | null | undefined) {
  const parsed = positiveNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function formatMeasure(value: number, unit: string) {
  const display = Number.isInteger(value)
    ? value.toLocaleString("en-GB")
    : value.toLocaleString("en-GB", { maximumFractionDigits: 3 });
  return unit === "servings" ? `${display} servings` : `${display}${unit}`;
}

export function exactPackLabelFromVariant(
  variant: ComparisonNutritionVariant
) {
  const packCount = positiveInteger(variant?.pack_count);
  const sizeValue = positiveNumber(variant?.size_value);
  const sizeUnit = variant?.size_unit?.trim().toLowerCase() || "";
  if (
    variant?.is_active !== true ||
    packCount === null ||
    sizeValue === null ||
    !sizeUnit
  ) {
    return null;
  }
  const measure = formatMeasure(sizeValue, sizeUnit);
  return packCount === 1 ? measure : `${packCount} x ${measure}`;
}

function exactVariantId(offer: RawComparisonOffer) {
  const variant = relationOne(offer.product_variant);
  if (offer.variant_resolution !== "resolved") return null;
  if (variant?.id === null || variant?.id === undefined) return null;
  const id = String(variant.id);
  return /^[1-9][0-9]*$/.test(id) ? id : null;
}

function exactVariantLabel(variant: ComparisonNutritionVariant) {
  const pack = exactPackLabelFromVariant(variant);
  if (!pack) return null;
  const flavour = variant?.flavour_label?.trim();
  return flavour ? `${flavour} / ${pack}` : pack;
}

export function exactPackLabel(offer: RawComparisonOffer) {
  if (exactVariantId(offer) === null) return null;
  return exactPackLabelFromVariant(relationOne(offer.product_variant));
}

const PRESENTATION_PRIORITY = {
  LIVE: 0,
  OUT_OF_STOCK: 1,
  RECENT: 2,
  REVIEW: 3,
  UNVERIFIED: 4,
} as const;

function normalizationOptions(now?: Date) {
  return {
    isProductInScope: (product: RawCategoryComparisonProduct) =>
      product.is_active === true &&
      product.merged_into_product_id === null &&
      product.merged_at === null,
    isOfferInScope: (_product: RawCategoryComparisonProduct, offer: RawComparisonOffer) =>
      exactPackLabel(offer) !== null,
    resolveNutritionMetrics: getEffectiveNutritionMetrics,
    now,
  };
}

function selectedVariantCandidate(
  product: RawCategoryComparisonProduct,
  offers: RawComparisonOffer[],
  now?: Date
) {
  const row = normalizeCategoryComparison(
    [{ ...product, offers }],
    normalizationOptions(now)
  ).rows[0];
  const deliveredOffers = row?.offers.filter(
    (offer) => offer.deliveredPrice !== null
  ) || [];

  return {
    offers,
    row,
    deliveredOfferCount: deliveredOffers.length,
    lowestDelivered: deliveredOffers.length > 0
      ? Math.min(...deliveredOffers.map((offer) => offer.deliveredPrice!.totalPrice))
      : Number.POSITIVE_INFINITY,
    lowestProductPrice: row?.offers.length
      ? Math.min(...row.offers.map((offer) => offer.productPrice))
      : Number.POSITIVE_INFINITY,
  };
}

function selectOneExactVariantPerProduct(
  products: RawCategoryComparisonProduct[],
  now?: Date
) {
  return products.map((product) => {
    const groups = new Map<string, RawComparisonOffer[]>();
    for (const offer of product.offers || []) {
      const id = exactVariantId(offer);
      if (id === null || exactPackLabel(offer) === null) continue;
      groups.set(id, [...(groups.get(id) || []), offer]);
    }
    const selected = [...groups.entries()]
      .map(([id, offers]) => ({
        id,
        ...selectedVariantCandidate(product, offers, now),
      }))
      .sort(
        (left, right) =>
          (PRESENTATION_PRIORITY[left.row?.presentationState || "UNVERIFIED"] -
            PRESENTATION_PRIORITY[right.row?.presentationState || "UNVERIFIED"]) ||
          (right.row?.retailerCount || 0) - (left.row?.retailerCount || 0) ||
          (right.row?.offerCount || 0) - (left.row?.offerCount || 0) ||
          right.deliveredOfferCount - left.deliveredOfferCount ||
          (right.row?.observedRetailerCount || 0) -
            (left.row?.observedRetailerCount || 0) ||
          left.lowestDelivered - right.lowestDelivered ||
          left.lowestProductPrice - right.lowestProductPrice ||
          left.id.localeCompare(right.id)
      )[0];
    return { ...product, offers: selected?.offers || [] };
  });
}

export function normalizeTwoProductComparison(
  products: RawCategoryComparisonProduct[],
  options: { now?: Date } = {}
): Omit<TwoProductComparisonResult, "error"> {
  const normalized = normalizeCategoryComparison(
    selectOneExactVariantPerProduct(products, options.now),
    normalizationOptions(options.now)
  );

  return {
    ...normalized,
    rows: normalized.rows.map((row) => ({
      ...row,
      exactPackLabel: exactPackLabelFromVariant(row.referenceVariant),
      exactVariantLabel: exactVariantLabel(row.referenceVariant),
      exactVariantId: row.referenceVariant?.id === null || row.referenceVariant?.id === undefined
        ? null
        : String(row.referenceVariant.id),
      preWorkoutFacts: null,
    })),
  };
}

export function normalizeComparisonProductId(
  value: string | string[] | undefined
) {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value)
    ? value
    : null;
}

export function selectTwoProducts(
  rows: TwoProductComparisonRow[],
  leftId: string | null,
  rightId: string | null
): TwoProductSelection {
  if (!leftId && !rightId) return { state: "empty", left: null, right: null };
  const byId = new Map(rows.map((row) => [row.id, row]));
  const left = leftId ? byId.get(leftId) || null : null;
  const right = rightId ? byId.get(rightId) || null : null;
  if ((leftId && !left) || (rightId && !right)) {
    return { state: "not_found", left, right };
  }
  if (!left || !right) return { state: "partial", left, right };
  if (left.id === right.id) return { state: "duplicate", left, right };
  return { state: "ready", left, right };
}

async function attachAppliedPreWorkoutFacts(
  result: Omit<TwoProductComparisonResult, "error">
) {
  const variants = new Map<
    string,
    { id: string; product_id: string; nutrition_override: Record<string, unknown> | null }
  >();

  for (const row of result.rows) {
    if (row.category?.trim().toLowerCase() !== "pre workout") continue;
    const variant = row.referenceVariant;
    if (variant?.id === null || variant?.id === undefined) continue;
    const id = String(variant.id);
    variants.set(id, {
      id,
      product_id: String(variant.product_id || row.id),
      nutrition_override: variant.nutrition_override || null,
    });
  }

  const factsByVariantId = await loadAppliedPreWorkoutFacts([...variants.values()]);
  if (factsByVariantId.size === 0) return result;

  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      preWorkoutFacts: row.exactVariantId
        ? factsByVariantId.get(row.exactVariantId) || null
        : null,
    })),
  };
}

function compactTwoProductComparison(
  result: Omit<TwoProductComparisonResult, "error">
) {
  const compactOffer = (offer: TwoProductComparisonRow["offers"][number]) => ({
    ...offer,
    nutritionVariant: null,
  });

  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      referenceVariant: null,
      offers: row.offers.map(compactOffer),
      bestOffer: row.bestOffer ? compactOffer(row.bestOffer) : null,
    })),
  };
}

type RawPriceHistoryRow = {
  offer_id: number | string | null;
  total_price: number | string | null;
  checked_at: string | null;
};

export function summarizeComparisonPriceHistory(
  rows: RawPriceHistoryRow[]
): ComparisonPriceHistorySummary | null {
  const valid = rows
    .map((row) => ({
      price: getKnownProductPrice(row.total_price),
      checkedAt: row.checked_at,
      checkedAtTime: Date.parse(row.checked_at || ""),
    }))
    .filter(
      (row): row is { price: number; checkedAt: string; checkedAtTime: number } =>
        row.price !== null &&
        typeof row.checkedAt === "string" &&
        Number.isFinite(row.checkedAtTime)
    )
    .sort((left, right) => left.checkedAtTime - right.checkedAtTime);

  if (valid.length === 0) return null;

  return {
    lowestDeliveredPrice: Math.min(...valid.map((row) => row.price)),
    firstRecordedAt: valid[0].checkedAt,
    lastRecordedAt: valid.at(-1)!.checkedAt,
    recordCount: valid.length,
  };
}

export async function getTwoProductPriceHistory(
  rows: TwoProductComparisonRow[]
): Promise<TwoProductPriceHistory> {
  const result: TwoProductPriceHistory = Object.fromEntries(
    rows.map((row) => [row.id, null])
  );
  const productIdByOfferId = new Map(
    rows.flatMap((row) =>
      row.offers.map((offer) => [offer.id, row.id] as const)
    )
  );
  const offerIds = [...productIdByOfferId.keys()];
  if (offerIds.length === 0) return result;

  const { data, error } = await supabase
    .from("price_history")
    .select("offer_id,total_price,checked_at")
    .in("offer_id", offerIds)
    .order("checked_at", { ascending: true });

  if (error) {
    console.error("Unable to load selected comparison price history.");
    return result;
  }

  const historyByProductId = new Map<string, RawPriceHistoryRow[]>();
  for (const item of (data || []) as RawPriceHistoryRow[]) {
    const productId = item.offer_id === null
      ? null
      : productIdByOfferId.get(String(item.offer_id));
    if (!productId) continue;
    historyByProductId.set(productId, [
      ...(historyByProductId.get(productId) || []),
      item,
    ]);
  }

  for (const row of rows) {
    result[row.id] = summarizeComparisonPriceHistory(
      historyByProductId.get(row.id) || []
    );
  }

  return result;
}

async function loadTwoProductComparison(): Promise<TwoProductComparisonResult> {
  const products: RawCategoryComparisonProduct[] = [];
  let expectedCount: number | null = null;

  for (let from = 0; ; from += PRODUCT_PAGE_SIZE) {
    const { data, error, count } = await supabase
      .from("products")
      .select(`
        id, slug, name, brand, category, image, product_format,
        net_weight_g, net_volume_ml, unit_count, unit_type,
        serving_count_verified, serving_size_g, protein_per_serving_g,
        creatine_per_serving_g,
        unit_pricing_verified, nutrition_verified, is_active,
        merged_into_product_id, merged_at,
        offers (
          id, retailer_product_id, price, shipping_cost, in_stock,
          last_checked_at, url,
          retailer:retailers (id, name, slug)
        )
      `, { count: "exact" })
      .eq("is_active", true)
      .is("merged_into_product_id", null)
      .is("merged_at", null)
      .order("id", { ascending: true })
      .range(from, from + PRODUCT_PAGE_SIZE - 1);

    if (error || count === null) {
      console.error("Unable to load the complete two-product comparison catalogue.");
      return emptyCategoryComparisonResult() as TwoProductComparisonResult;
    }
    if (expectedCount === null) expectedCount = count;
    if (count !== expectedCount) {
      console.error("Two-product comparison catalogue changed during pagination.");
      return emptyCategoryComparisonResult() as TwoProductComparisonResult;
    }

    const page = (data || []) as RawCategoryComparisonProduct[];
    try {
      products.push(
        ...(await resolveCategoryComparisonVariants(page, {
          failOnError: true,
        }))
      );
    } catch {
      console.error("Unable to resolve exact variants for comparison.");
      return emptyCategoryComparisonResult() as TwoProductComparisonResult;
    }
    if (page.length < PRODUCT_PAGE_SIZE) break;
  }

  if (expectedCount === null || products.length !== expectedCount) {
    console.error("Two-product comparison catalogue is incomplete.");
    return emptyCategoryComparisonResult() as TwoProductComparisonResult;
  }

  const normalized = normalizeTwoProductComparison(products);
  const withPreWorkoutFacts = await attachAppliedPreWorkoutFacts(normalized);
  return {
    ...compactTwoProductComparison(withPreWorkoutFacts),
    error: false,
  };
}

export const getTwoProductComparison = cache(loadTwoProductComparison);
