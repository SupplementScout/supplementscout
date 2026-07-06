import "server-only";

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { OutboundClickReportPeriod } from "./outboundClicksReportPeriods";
export { normalizeOutboundClickReportPeriod } from "./outboundClicksReportPeriods";

export type OutboundClickSource =
  | "product_best_offer"
  | "product_offer_list";

const AGGREGATION_PAGE_SIZE = 1000;
// MVP safety guard: fail closed before all-time in-memory aggregation grows too large.
const MAX_AGGREGATION_ROWS = 100000;

export type OutboundClickRow = {
  id?: string | number;
  created_at: string;
  offer_id: string | number | null;
  product_id: string | number | null;
  retailer_id: string | number | null;
  destination_url: string;
  source_page: string;
};

export type NamedRecord = {
  id: string | number;
  name: string | null;
};

export type OutboundClicksReportDataSource = {
  countClicks: (sinceIso: string | null) => Promise<number>;
  fetchRecentClicks: (sinceIso: string | null) => Promise<OutboundClickRow[]>;
  fetchClicksForAggregationPage: (
    sinceIso: string | null,
    from: number,
    to: number
  ) => Promise<OutboundClickRow[]>;
  fetchProducts: (productIds: string[]) => Promise<NamedRecord[]>;
  fetchRetailers: (retailerIds: string[]) => Promise<NamedRecord[]>;
};

export type RecentOutboundClick = {
  createdAt: string;
  offerId: string | null;
  productId: string | null;
  productName: string;
  retailerId: string | null;
  retailerName: string;
  destinationUrl: string;
  sourcePage: string;
};

export type RankedClickTarget = {
  id: string | null;
  name: string;
  clicks: number;
};

export type OutboundClicksReport = {
  period: OutboundClickReportPeriod;
  periodSinceIso: string | null;
  summary: {
    today: number;
    last7Days: number;
    last30Days: number;
    total: number;
  };
  recentClicks: RecentOutboundClick[];
  topProducts: RankedClickTarget[];
  topRetailers: RankedClickTarget[];
  sourceCounts: Record<OutboundClickSource, number>;
};

export function getUtcDayStart(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function getPeriodSinceIso(
  period: OutboundClickReportPeriod,
  now: Date
) {
  if (period === "all") {
    return null;
  }

  const days = period === "7d" ? 7 : 30;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toIdString(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function uniqueIds(rows: OutboundClickRow[], key: "product_id" | "retailer_id") {
  return Array.from(
    new Set(
      rows
        .map((row) => toIdString(row[key]))
        .filter((value): value is string => value !== null)
    )
  );
}

function nameMap(records: NamedRecord[]) {
  return new Map(
    records.map((record) => [String(record.id), record.name || null])
  );
}

function productName(productId: string | null, products: Map<string, string | null>) {
  if (!productId) {
    return "Deleted product";
  }

  return products.get(productId) || `Product ${productId}`;
}

function retailerName(
  retailerId: string | null,
  retailers: Map<string, string | null>
) {
  if (!retailerId) {
    return "Deleted retailer";
  }

  return retailers.get(retailerId) || `Retailer ${retailerId}`;
}

function rankedTargets(
  rows: OutboundClickRow[],
  idKey: "product_id" | "retailer_id",
  names: Map<string, string | null>,
  deletedName: string,
  fallbackPrefix: string
): RankedClickTarget[] {
  const counts = new Map<string, { id: string | null; clicks: number }>();

  for (const row of rows) {
    const id = toIdString(row[idKey]);
    const key = id || "__deleted__";
    const current = counts.get(key);

    counts.set(key, {
      id,
      clicks: (current?.clicks || 0) + 1,
    });
  }

  return Array.from(counts.values())
    .map((item) => ({
      id: item.id,
      name: item.id
        ? names.get(item.id) || `${fallbackPrefix} ${item.id}`
        : deletedName,
      clicks: item.clicks,
    }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    )
    .slice(0, 10);
}

function sourceCounts(rows: OutboundClickRow[]) {
  const counts: Record<OutboundClickSource, number> = {
    product_best_offer: 0,
    product_offer_list: 0,
  };

  for (const row of rows) {
    if (
      row.source_page === "product_best_offer" ||
      row.source_page === "product_offer_list"
    ) {
      counts[row.source_page] += 1;
    }
  }

  return counts;
}

async function fetchAllAggregationRows(input: {
  sinceIso: string | null;
  dataSource: OutboundClicksReportDataSource;
}) {
  const rows: OutboundClickRow[] = [];

  for (let from = 0; ; from += AGGREGATION_PAGE_SIZE) {
    const to = from + AGGREGATION_PAGE_SIZE - 1;
    let batch: OutboundClickRow[];

    try {
      batch = await input.dataSource.fetchClicksForAggregationPage(
        input.sinceIso,
        from,
        to
      );
    } catch (error) {
      console.error("Unable to load outbound click report: aggregate clicks.", {
        error,
      });
      throw new Error("Unable to load outbound click report.");
    }

    rows.push(...batch);

    if (rows.length > MAX_AGGREGATION_ROWS) {
      console.error("Unable to load outbound click report: aggregation row guard.", {
        maxAggregationRows: MAX_AGGREGATION_ROWS,
      });
      throw new Error("Unable to load outbound click report.");
    }

    if (batch.length < AGGREGATION_PAGE_SIZE) {
      return rows;
    }
  }
}

export async function getOutboundClicksReport(input: {
  period: OutboundClickReportPeriod;
  now?: Date;
  dataSource: OutboundClicksReportDataSource;
}): Promise<OutboundClicksReport> {
  const now = input.now || new Date();
  const todaySinceIso = getUtcDayStart(now).toISOString();
  const last7DaysSinceIso = getPeriodSinceIso("7d", now);
  const last30DaysSinceIso = getPeriodSinceIso("30d", now);
  const periodSinceIso = getPeriodSinceIso(input.period, now);

  const [
    today,
    last7Days,
    last30Days,
    total,
    recentRows,
  ] = await Promise.all([
    input.dataSource.countClicks(todaySinceIso),
    input.dataSource.countClicks(last7DaysSinceIso),
    input.dataSource.countClicks(last30DaysSinceIso),
    input.dataSource.countClicks(null),
    input.dataSource.fetchRecentClicks(periodSinceIso),
  ]);
  const aggregationRows = await fetchAllAggregationRows({
    sinceIso: periodSinceIso,
    dataSource: input.dataSource,
  });

  const productIds = uniqueIds([...recentRows, ...aggregationRows], "product_id");
  const retailerIds = uniqueIds([...recentRows, ...aggregationRows], "retailer_id");
  const [products, retailers] = await Promise.all([
    productIds.length > 0 ? input.dataSource.fetchProducts(productIds) : [],
    retailerIds.length > 0 ? input.dataSource.fetchRetailers(retailerIds) : [],
  ]);
  const productsById = nameMap(products);
  const retailersById = nameMap(retailers);
  const recentClicks = [...recentRows]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 50)
    .map((row) => {
      const productId = toIdString(row.product_id);
      const retailerId = toIdString(row.retailer_id);

      return {
        createdAt: row.created_at,
        offerId: toIdString(row.offer_id),
        productId,
        productName: productName(productId, productsById),
        retailerId,
        retailerName: retailerName(retailerId, retailersById),
        destinationUrl: row.destination_url,
        sourcePage: row.source_page,
      };
    });

  return {
    period: input.period,
    periodSinceIso,
    summary: {
      today,
      last7Days,
      last30Days,
      total,
    },
    recentClicks,
    topProducts: rankedTargets(
      aggregationRows,
      "product_id",
      productsById,
      "Deleted product",
      "Product"
    ),
    topRetailers: rankedTargets(
      aggregationRows,
      "retailer_id",
      retailersById,
      "Deleted retailer",
      "Retailer"
    ),
    sourceCounts: sourceCounts(aggregationRows),
  };
}

function withSince<T extends { gte: (column: string, value: string) => T }>(
  query: T,
  sinceIso: string | null
) {
  return sinceIso ? query.gte("created_at", sinceIso) : query;
}

async function requireNoError<T>(
  subject: string,
  result: { data: T | null; error: unknown; count?: number | null }
) {
  if (result.error) {
    console.error(`Unable to load outbound click report: ${subject}.`, {
      error: result.error,
    });
    throw new Error("Unable to load outbound click report.");
  }

  return result;
}

function createSupabaseOutboundClicksDataSource(): OutboundClicksReportDataSource {
  return {
    async countClicks(sinceIso) {
      const result = await requireNoError(
        "count clicks",
        await withSince(
          supabaseAdmin
            .from("outbound_clicks")
            .select("id", { count: "exact", head: true }),
          sinceIso
        )
      );

      return result.count || 0;
    },
    async fetchRecentClicks(sinceIso) {
      const result = await requireNoError(
        "recent clicks",
        await withSince(
          supabaseAdmin
            .from("outbound_clicks")
            .select(
              "created_at, offer_id, product_id, retailer_id, destination_url, source_page"
            )
            .order("created_at", { ascending: false })
            .limit(50),
          sinceIso
        )
      );

      return (result.data || []) as OutboundClickRow[];
    },
    async fetchClicksForAggregationPage(sinceIso, from, to) {
      const result = await requireNoError(
        "aggregate clicks",
        await withSince(
          supabaseAdmin
            .from("outbound_clicks")
            .select(
              "id, created_at, offer_id, product_id, retailer_id, destination_url, source_page"
            )
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
          sinceIso
        )
      );

      return (result.data || []) as OutboundClickRow[];
    },
    async fetchProducts(productIds) {
      const result = await requireNoError(
        "product names",
        await supabaseAdmin
          .from("products")
          .select("id, name")
          .in("id", productIds)
      );

      return (result.data || []) as NamedRecord[];
    },
    async fetchRetailers(retailerIds) {
      const result = await requireNoError(
        "retailer names",
        await supabaseAdmin
          .from("retailers")
          .select("id, name")
          .in("id", retailerIds)
      );

      return (result.data || []) as NamedRecord[];
    },
  };
}

export async function loadOutboundClicksReport(input: {
  period: OutboundClickReportPeriod;
  now?: Date;
}) {
  return getOutboundClicksReport({
    period: input.period,
    now: input.now,
    dataSource: createSupabaseOutboundClicksDataSource(),
  });
}
