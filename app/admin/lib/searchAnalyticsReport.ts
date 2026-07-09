import "server-only";

import { supabaseAdmin } from "../../lib/supabaseAdmin";

const RECENT_SEARCH_LIMIT = 50;
const AGGREGATION_SOURCE_LIMIT = 5000;
const AGGREGATION_RESULT_LIMIT = 50;

export type SearchEventRow = {
  id?: string | number;
  created_at: string;
  query: string;
  applied_query: string | null;
  corrected_query: string | null;
  result_count: number | null;
  match_status: string | null;
  search_mode: string | null;
};

export type SearchAnalyticsDataSource = {
  fetchRecentSearchRows: () => Promise<SearchEventRow[]>;
  fetchSearchRowsForAggregation: () => Promise<SearchEventRow[]>;
};

export type RecentSearch = {
  id: string;
  createdAt: string;
  query: string;
  appliedQuery: string | null;
  correctedQuery: string | null;
  resultCount: number | null;
  matchStatus: string | null;
  searchMode: string | null;
};

export type RankedZeroResultSearch = {
  query: string;
  searches: number;
  lastSearchedAt: string;
};

export type RankedCorrectedSearch = {
  query: string;
  correctedQuery: string;
  searches: number;
  lastSearchedAt: string;
};

export type RankedTopSearch = {
  query: string;
  searches: number;
  averageResultCount: number;
  lastSearchedAt: string;
};

export type SearchAnalyticsReport = {
  recentSearches: RecentSearch[];
  zeroResultSearches: RankedZeroResultSearch[];
  correctedSearches: RankedCorrectedSearch[];
  topSearches: RankedTopSearch[];
};

function toIdString(value: string | number | undefined, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  return String(value);
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareRanked(
  left: { searches: number; lastSearchedAt: string; query: string },
  right: { searches: number; lastSearchedAt: string; query: string }
) {
  return (
    right.searches - left.searches ||
    toTimestamp(right.lastSearchedAt) - toTimestamp(left.lastSearchedAt) ||
    left.query.localeCompare(right.query, "en", { sensitivity: "base" })
  );
}

function limitRows<T>(rows: T[], limit = AGGREGATION_RESULT_LIMIT) {
  return rows.slice(0, limit);
}

export function mapRecentSearches(rows: SearchEventRow[]) {
  return rows.slice(0, RECENT_SEARCH_LIMIT).map((row, index) => ({
    id: toIdString(row.id, `${row.created_at}-${index}`),
    createdAt: row.created_at,
    query: row.query,
    appliedQuery: row.applied_query,
    correctedQuery: row.corrected_query,
    resultCount: row.result_count,
    matchStatus: row.match_status,
    searchMode: row.search_mode,
  }));
}

export function aggregateZeroResultSearches(rows: SearchEventRow[]) {
  const counts = new Map<string, RankedZeroResultSearch>();

  for (const row of rows) {
    if (row.match_status !== "none") {
      continue;
    }

    const current = counts.get(row.query);

    counts.set(row.query, {
      query: row.query,
      searches: (current?.searches || 0) + 1,
      lastSearchedAt:
        !current || toTimestamp(row.created_at) > toTimestamp(current.lastSearchedAt)
          ? row.created_at
          : current.lastSearchedAt,
    });
  }

  return limitRows(Array.from(counts.values()).sort(compareRanked));
}

export function aggregateCorrectedSearches(rows: SearchEventRow[]) {
  const counts = new Map<string, RankedCorrectedSearch>();

  for (const row of rows) {
    const correctedQuery = row.corrected_query || row.applied_query;

    if (row.match_status !== "corrected" || !correctedQuery) {
      continue;
    }

    const key = `${row.query}\u0000${correctedQuery}`;
    const current = counts.get(key);

    counts.set(key, {
      query: row.query,
      correctedQuery,
      searches: (current?.searches || 0) + 1,
      lastSearchedAt:
        !current || toTimestamp(row.created_at) > toTimestamp(current.lastSearchedAt)
          ? row.created_at
          : current.lastSearchedAt,
    });
  }

  return limitRows(Array.from(counts.values()).sort(compareRanked));
}

export function aggregateTopSearches(rows: SearchEventRow[]) {
  const counts = new Map<
    string,
    {
      query: string;
      searches: number;
      resultCountTotal: number;
      resultCountRows: number;
      lastSearchedAt: string;
    }
  >();

  for (const row of rows) {
    const current = counts.get(row.query);
    const hasResultCount = typeof row.result_count === "number";

    counts.set(row.query, {
      query: row.query,
      searches: (current?.searches || 0) + 1,
      resultCountTotal:
        (current?.resultCountTotal || 0) + (hasResultCount ? row.result_count || 0 : 0),
      resultCountRows: (current?.resultCountRows || 0) + (hasResultCount ? 1 : 0),
      lastSearchedAt:
        !current || toTimestamp(row.created_at) > toTimestamp(current.lastSearchedAt)
          ? row.created_at
          : current.lastSearchedAt,
    });
  }

  return limitRows(
    Array.from(counts.values())
      .map((row) => ({
        query: row.query,
        searches: row.searches,
        averageResultCount:
          row.resultCountRows > 0 ? row.resultCountTotal / row.resultCountRows : 0,
        lastSearchedAt: row.lastSearchedAt,
      }))
      .sort(compareRanked)
  );
}

export async function getSearchAnalyticsReport(input: {
  dataSource: SearchAnalyticsDataSource;
}): Promise<SearchAnalyticsReport> {
  const [recentRows, aggregationRows] = await Promise.all([
    input.dataSource.fetchRecentSearchRows(),
    input.dataSource.fetchSearchRowsForAggregation(),
  ]);

  return {
    recentSearches: mapRecentSearches(recentRows),
    zeroResultSearches: aggregateZeroResultSearches(aggregationRows),
    correctedSearches: aggregateCorrectedSearches(aggregationRows),
    topSearches: aggregateTopSearches(aggregationRows),
  };
}

async function requireNoError<T>(
  subject: string,
  result: { data: T | null; error: unknown }
) {
  if (result.error) {
    console.error(`Unable to load search analytics report: ${subject}.`, {
      error: result.error,
    });
    throw new Error("Unable to load search analytics report.");
  }

  return result;
}

function createSupabaseSearchAnalyticsDataSource(): SearchAnalyticsDataSource {
  return {
    async fetchRecentSearchRows() {
      const result = await requireNoError(
        "recent searches",
        await supabaseAdmin
          .from("search_events")
          .select(
            "id, created_at, query, applied_query, corrected_query, result_count, match_status, search_mode"
          )
          .eq("event_type", "search_results")
          .order("created_at", { ascending: false })
          .limit(RECENT_SEARCH_LIMIT)
      );

      return (result.data || []) as SearchEventRow[];
    },
    async fetchSearchRowsForAggregation() {
      const result = await requireNoError(
        "aggregate searches",
        await supabaseAdmin
          .from("search_events")
          .select(
            "id, created_at, query, applied_query, corrected_query, result_count, match_status, search_mode"
          )
          .eq("event_type", "search_results")
          .order("created_at", { ascending: false })
          .range(0, AGGREGATION_SOURCE_LIMIT - 1)
      );

      return (result.data || []) as SearchEventRow[];
    },
  };
}

export async function loadSearchAnalyticsReport() {
  return getSearchAnalyticsReport({
    dataSource: createSupabaseSearchAnalyticsDataSource(),
  });
}
