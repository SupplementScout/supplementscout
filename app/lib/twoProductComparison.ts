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
import { getDeliveredPrice } from "./pricing";
import { supabase } from "./supabase";

const PRODUCT_PAGE_SIZE = 200;

export type TwoProductComparisonRow = CategoryComparisonRow & {
  exactPackLabel: string | null;
  exactVariantLabel: string | null;
};

export type TwoProductComparisonResult = Omit<CategoryComparisonResult, "rows"> & {
  rows: TwoProductComparisonRow[];
};

export type TwoProductSelection = {
  state: "empty" | "partial" | "duplicate" | "not_found" | "ready";
  left: TwoProductComparisonRow | null;
  right: TwoProductComparisonRow | null;
};

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

function selectOneExactVariantPerProduct(
  products: RawCategoryComparisonProduct[]
) {
  return products.map((product) => {
    const groups = new Map<string, RawComparisonOffer[]>();
    for (const offer of product.offers || []) {
      const id = exactVariantId(offer);
      if (
        id === null ||
        exactPackLabel(offer) === null ||
        getDeliveredPrice(offer) === null
      ) {
        continue;
      }
      groups.set(id, [...(groups.get(id) || []), offer]);
    }
    const selected = [...groups.entries()]
      .map(([id, offers]) => ({
        id,
        offers,
        retailers: new Set(
          offers.map((offer) => {
            const retailer = relationOne(offer.retailer);
            return retailer?.id === null || retailer?.id === undefined
              ? ""
              : String(retailer.id);
          }).filter(Boolean)
        ).size,
        lowestDelivered: Math.min(
          ...offers.map(
            (offer) =>
              getDeliveredPrice(offer)?.totalPrice || Number.POSITIVE_INFINITY
          )
        ),
      }))
      .sort(
        (left, right) =>
          right.retailers - left.retailers ||
          right.offers.length - left.offers.length ||
          left.lowestDelivered - right.lowestDelivered ||
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
    selectOneExactVariantPerProduct(products),
    {
      isProductInScope: (product) =>
        product.is_active === true &&
        product.merged_into_product_id === null &&
        product.merged_at === null,
      isOfferInScope: (_product, offer) =>
        exactPackLabel(offer) !== null && getDeliveredPrice(offer) !== null,
      resolveNutritionMetrics: getEffectiveNutritionMetrics,
      now: options.now,
    }
  );

  return {
    ...normalized,
    rows: normalized.rows.map((row) => ({
      ...row,
      exactPackLabel: exactPackLabelFromVariant(row.referenceVariant),
      exactVariantLabel: exactVariantLabel(row.referenceVariant),
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

  return { ...normalizeTwoProductComparison(products), error: false };
}

export const getTwoProductComparison = cache(loadTwoProductComparison);
