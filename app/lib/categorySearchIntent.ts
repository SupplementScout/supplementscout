import { categoryCoverageDefinitionForLabel } from "./categoryCoverage";
import {
  PUBLIC_INDEXABILITY_LIFECYCLE,
  type RouteSearchParams,
} from "./indexabilityLifecycle";

export const CATEGORY_SEARCH_RAW_MODE_PARAM = "search_mode";
export const CATEGORY_SEARCH_RAW_MODE_VALUE = "raw";

export type ExactCategorySearchIntent = {
  href: string;
  definitionKey: string;
};

function normalizeExactCategoryLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function resolveExactCategorySearchIntent(
  params: RouteSearchParams
): ExactCategorySearchIntent | null {
  const activeKeys = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

  if (
    activeKeys.some((key) => key !== "q") ||
    typeof params.q !== "string"
  ) {
    return null;
  }

  const query = normalizeExactCategoryLabel(params.q);
  if (!query) return null;

  const definition = categoryCoverageDefinitionForLabel(query);
  if (
    !definition ||
    !Object.hasOwn(PUBLIC_INDEXABILITY_LIFECYCLE, definition.route)
  ) {
    return null;
  }

  return {
    href: definition.route,
    definitionKey: definition.key,
  };
}

export function categoryCoverageRawSearchHref(query: string) {
  const params = new URLSearchParams({
    q: query,
    [CATEGORY_SEARCH_RAW_MODE_PARAM]: CATEGORY_SEARCH_RAW_MODE_VALUE,
  });

  return `/search?${params.toString()}`;
}
