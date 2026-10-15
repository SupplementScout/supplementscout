import type { RouteSearchParams } from "./indexabilityLifecycle";

export type CategoryControlSort =
  | "decision"
  | "delivered_total"
  | "verified_value"
  | "retailer_coverage";

export type CategoryControlFilter = "brand" | "retailer" | "format";

export type CategoryControlValues = {
  sort: CategoryControlSort;
  brand: string;
  retailer: string;
  format: string;
};

export type CategoryControlFacet = {
  value: string;
  label: string;
  count: number;
};

export type CategoryControlFacts = {
  id: string;
  brand: string | null;
  productFormat: string | null;
  retailers: Array<{ id: string; name: string }>;
  deliveredTotal: number | null;
  verifiedValue: number | null;
  retailerCount: number;
  offerCount: number;
};

export type CategoryControlView<T> = {
  rows: T[];
  controls: CategoryControlValues;
  facets: {
    brands: CategoryControlFacet[];
    retailers: CategoryControlFacet[];
    formats: CategoryControlFacet[];
  };
  sorts: CategoryControlSort[];
  totalCount: number;
  hasActiveFilters: boolean;
};

type SharedComparisonControlRow = {
  id: string;
  brand: string | null;
  productFormat: string | null;
  offers: Array<{ retailer: { id: string; name: string } | null }>;
  bestOffer: { deliveredPrice: { totalPrice: number } | null } | null;
  retailerCount: number;
  offerCount: number;
  costPer25gProtein: number | null;
};

type CreatineControlRow = {
  id: string;
  brand: string | null;
  productFormat: string | null;
  offers: Array<{
    retailer: { id: string; name: string | null } | null;
  }>;
  bestOffer: { deliveredPrice: { totalPrice: number } | null } | null;
  retailerCount: number;
  offerCount: number;
  verifiedCostPer5g: number | null;
};

export function sharedCategoryControlFacts(
  row: SharedComparisonControlRow,
  options: { verifiedProteinValue?: boolean } = {}
): CategoryControlFacts {
  return {
    id: row.id,
    brand: row.brand,
    productFormat: row.productFormat,
    retailers: row.offers.flatMap((offer) =>
      offer.retailer
        ? [{ id: offer.retailer.id, name: offer.retailer.name }]
        : []
    ),
    deliveredTotal: row.bestOffer?.deliveredPrice?.totalPrice ?? null,
    verifiedValue: options.verifiedProteinValue
      ? row.costPer25gProtein
      : null,
    retailerCount: row.retailerCount,
    offerCount: row.offerCount,
  };
}

export function creatineCategoryControlFacts(
  row: CreatineControlRow
): CategoryControlFacts {
  return {
    id: row.id,
    brand: row.brand,
    productFormat: row.productFormat,
    retailers: row.offers.flatMap((offer) =>
      offer.retailer?.name
        ? [{ id: offer.retailer.id, name: offer.retailer.name }]
        : []
    ),
    deliveredTotal: row.bestOffer?.deliveredPrice?.totalPrice ?? null,
    verifiedValue: row.verifiedCostPer5g,
    retailerCount: row.retailerCount,
    offerCount: row.offerCount,
  };
}

function singleParam(value: RouteSearchParams[string]) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function safeLabel(value: string | null) {
  const label = value?.trim() || "";
  return label.length <= 80 ? label : "";
}

function facetValues(
  values: Array<{ value: string; label: string }>,
  complete: boolean
) {
  if (!complete) return [];

  const counts = new Map<string, CategoryControlFacet>();
  for (const item of values) {
    const existing = counts.get(item.value);
    if (existing) existing.count += 1;
    else counts.set(item.value, { ...item, count: 1 });
  }

  return [...counts.values()].sort(
    (left, right) =>
      left.label.localeCompare(right.label, "en", { sensitivity: "base" }) ||
      left.value.localeCompare(right.value)
  );
}

function stableId(left: CategoryControlFacts, right: CategoryControlFacts) {
  return left.id.localeCompare(right.id, "en", { numeric: true });
}

function knownFirst(left: number | null, right: number | null) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
}

export function buildCategoryControlView<T>(
  rows: T[],
  params: RouteSearchParams = {},
  getFacts: (row: T) => CategoryControlFacts,
  options: { verifiedValueSort?: boolean } = {}
): CategoryControlView<T> {
  const indexed = rows.map((row) => ({ row, facts: getFacts(row) }));
  const brandsComplete = indexed.every(({ facts }) => Boolean(safeLabel(facts.brand)));
  const formatsComplete = indexed.every(({ facts }) =>
    Boolean(safeLabel(facts.productFormat))
  );

  const brands = facetValues(
    indexed.map(({ facts }) => ({
      value: safeLabel(facts.brand).toLocaleLowerCase("en-GB"),
      label: safeLabel(facts.brand),
    })),
    brandsComplete
  );
  const formats = facetValues(
    indexed.map(({ facts }) => ({
      value: safeLabel(facts.productFormat).toLocaleLowerCase("en-GB"),
      label: safeLabel(facts.productFormat),
    })),
    formatsComplete
  );
  const retailers = facetValues(
    indexed.flatMap(({ facts }) => {
      const unique = new Map<string, string>();
      for (const retailer of facts.retailers) {
        const id = safeLabel(retailer.id);
        const name = safeLabel(retailer.name);
        if (id && name) unique.set(id, name);
      }
      return [...unique].map(([value, label]) => ({ value, label }));
    }),
    true
  );

  const allowedSorts: CategoryControlSort[] = [
    "decision",
    "delivered_total",
    ...(options.verifiedValueSort ? (["verified_value"] as const) : []),
    "retailer_coverage",
  ];
  const requestedSort = singleParam(params.sort) as CategoryControlSort;
  const requestedBrand = singleParam(params.brand).toLocaleLowerCase("en-GB");
  const requestedFormat = singleParam(params.format).toLocaleLowerCase("en-GB");
  const requestedRetailer = singleParam(params.retailer);
  const controls: CategoryControlValues = {
    sort: allowedSorts.includes(requestedSort) ? requestedSort : "decision",
    brand: brands.some((facet) => facet.value === requestedBrand)
      ? requestedBrand
      : "",
    retailer: retailers.some((facet) => facet.value === requestedRetailer)
      ? requestedRetailer
      : "",
    format: formats.some((facet) => facet.value === requestedFormat)
      ? requestedFormat
      : "",
  };

  const filtered = indexed.filter(({ facts }) => {
    if (
      controls.brand &&
      safeLabel(facts.brand).toLocaleLowerCase("en-GB") !== controls.brand
    ) {
      return false;
    }
    if (
      controls.format &&
      safeLabel(facts.productFormat).toLocaleLowerCase("en-GB") !== controls.format
    ) {
      return false;
    }
    return (
      !controls.retailer ||
      facts.retailers.some((retailer) => retailer.id === controls.retailer)
    );
  });

  if (controls.sort !== "decision") {
    filtered.sort((left, right) => {
      if (controls.sort === "delivered_total") {
        return (
          knownFirst(left.facts.deliveredTotal, right.facts.deliveredTotal) ||
          stableId(left.facts, right.facts)
        );
      }
      if (controls.sort === "verified_value") {
        return (
          knownFirst(left.facts.verifiedValue, right.facts.verifiedValue) ||
          stableId(left.facts, right.facts)
        );
      }
      return (
        right.facts.retailerCount - left.facts.retailerCount ||
        right.facts.offerCount - left.facts.offerCount ||
        knownFirst(left.facts.deliveredTotal, right.facts.deliveredTotal) ||
        stableId(left.facts, right.facts)
      );
    });
  }

  return {
    rows: filtered.map(({ row }) => row),
    controls,
    facets: { brands, retailers, formats },
    sorts: allowedSorts,
    totalCount: rows.length,
    hasActiveFilters: Boolean(
      controls.brand || controls.retailer || controls.format
    ),
  };
}

export function categoryControlUrl(
  basePath: string,
  controls: CategoryControlValues,
  updates: Partial<CategoryControlValues> = {}
) {
  const next = { ...controls, ...updates };
  const params = new URLSearchParams();
  if (next.sort !== "decision") params.set("sort", next.sort);
  if (next.brand) params.set("brand", next.brand);
  if (next.retailer) params.set("retailer", next.retailer);
  if (next.format) params.set("format", next.format);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
