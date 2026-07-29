import type { Metadata } from "next";

export const CATEGORY_LANDING_PAGE_SIZE = 24;

type CategoryLandingMetadataInput = {
  basePath: string;
  description: string;
  page: number;
  title: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeCategoryLandingPage(
  value: string | string[] | undefined
) {
  const normalized = firstValue(value);

  if (!normalized || !/^[1-9]\d*$/.test(normalized)) {
    return 1;
  }

  const page = Number(normalized);
  return Number.isSafeInteger(page) ? page : 1;
}

export function isCanonicalCategoryLandingPageParam(
  value: string | string[] | undefined
) {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value) || !/^[2-9]\d*$/.test(value)) {
    return false;
  }

  return Number.isSafeInteger(Number(value));
}

export function categoryLandingPageHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

export function buildCategoryLandingMetadata({
  basePath,
  description,
  page,
  title,
}: CategoryLandingMetadataInput): Metadata {
  const pageTitle = page > 1 ? `${title} – Page ${page}` : title;
  const canonical = categoryLandingPageHref(basePath, page);

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${pageTitle} | SupplementScout`,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary",
      title: `${pageTitle} | SupplementScout`,
      description,
    },
  };
}
