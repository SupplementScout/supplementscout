import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import type { SearchMetadata } from "./products";

const MAX_LOGGED_QUERY_LENGTH = 200;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const PHONE_LIKE_PATTERN = /^\+?[\d\s().-]{7,}$/;
const PHONE_LIKE_SUBSTRING_PATTERN = /\+?\d[\d\s().-]{5,}\d/g;
const VERY_LONG_NUMBER_PATTERN = /\d{12,}/;

export type SearchResultsEventInput = {
  query: string;
  metadata: SearchMetadata;
  resultCount: number;
  log?: Pick<Console, "error">;
};

function normalizeForLogging(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isUnsafeSearchQuery(value: string) {
  if (EMAIL_PATTERN.test(value)) {
    return true;
  }

  if (VERY_LONG_NUMBER_PATTERN.test(value)) {
    return true;
  }

  const phoneLikeMatches = value.match(PHONE_LIKE_SUBSTRING_PATTERN) || [];

  if (phoneLikeMatches.some((match) => match.replace(/\D/g, "").length >= 7)) {
    return true;
  }

  const digitCount = value.replace(/\D/g, "").length;

  return PHONE_LIKE_PATTERN.test(value) && digitCount >= 7;
}

export function sanitizeSearchQueryForAnalytics(value: string) {
  const normalized = normalizeForLogging(value);

  if (!normalized || isUnsafeSearchQuery(normalized)) {
    return null;
  }

  return normalized.slice(0, MAX_LOGGED_QUERY_LENGTH);
}

function sanitizeOptionalSearchText(value: string | null) {
  if (!value) {
    return null;
  }

  return normalizeForLogging(value).slice(0, MAX_LOGGED_QUERY_LENGTH);
}

export async function logSearchResultsEvent(input: SearchResultsEventInput) {
  const query = sanitizeSearchQueryForAnalytics(input.query);

  if (!query) {
    return { logged: false, skipped: true, error: null };
  }

  let error: unknown;

  try {
    const result = await supabaseAdmin.from("search_events").insert({
      event_type: "search_results",
      source_page: "search_page",
      query,
      applied_query: sanitizeOptionalSearchText(input.metadata.appliedQuery),
      corrected_query: sanitizeOptionalSearchText(input.metadata.correctedQuery),
      result_count: Math.max(0, input.resultCount),
      match_status: input.metadata.matchStatus,
      search_mode: input.metadata.searchMode,
    });

    error = result.error;
  } catch (caughtError) {
    error = caughtError;
  }

  if (error) {
    input.log?.error("Failed to record search event", error);

    return { logged: false, skipped: false, error };
  }

  return { logged: true, skipped: false, error: null };
}
