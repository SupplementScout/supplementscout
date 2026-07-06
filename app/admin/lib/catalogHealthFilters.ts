export const CATALOG_HEALTH_ROW_GUARD_MESSAGE =
  "Catalog health report is too large to generate safely with the current read-only query path.";

export type CatalogHealthIssueType =
  | "zero-offers"
  | "one-offer"
  | "missing-data"
  | "stale-offers"
  | "categories";

export type CatalogHealthStaleAge = "7d" | "30d" | "never";

export type CatalogHealthFilters = {
  issue: CatalogHealthIssueType;
  retailer: string;
  category: string;
  staleAge: CatalogHealthStaleAge;
  page: number;
};

export function getCatalogHealthLoadErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes(CATALOG_HEALTH_ROW_GUARD_MESSAGE)
  ) {
    return `${CATALOG_HEALTH_ROW_GUARD_MESSAGE} A database view or RPC is needed before this report can safely cover the full catalog.`;
  }

  return "Unable to load catalog health.";
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function normalizePositivePage(value: string | string[] | undefined) {
  const page = firstParam(value);

  if (!/^[1-9][0-9]*$/.test(page)) {
    return 1;
  }

  const parsed = Number.parseInt(page, 10);

  return Number.isSafeInteger(parsed) ? parsed : 1;
}

export function normalizeCatalogHealthFilters(values: {
  issue?: string | string[];
  retailer?: string | string[];
  category?: string | string[];
  staleAge?: string | string[];
  page?: string | string[];
}): CatalogHealthFilters {
  const rawIssue = firstParam(values.issue);
  const issue: CatalogHealthIssueType =
    rawIssue === "one-offer" ||
    rawIssue === "missing-data" ||
    rawIssue === "stale-offers" ||
    rawIssue === "categories"
      ? rawIssue
      : "zero-offers";
  const rawStaleAge = firstParam(values.staleAge);
  const staleAge: CatalogHealthStaleAge =
    rawStaleAge === "30d" || rawStaleAge === "never" ? rawStaleAge : "7d";

  return {
    issue,
    retailer: firstParam(values.retailer).trim(),
    category: firstParam(values.category).trim().replace(/\s+/g, " "),
    staleAge,
    page: normalizePositivePage(values.page),
  };
}
