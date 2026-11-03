import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CATEGORY_LANDING_PAGE_SIZE,
  buildCategoryLandingMetadata,
  categoryLandingPageHref,
  isCanonicalCategoryLandingPageParam,
  normalizeCategoryLandingPage,
} from "./categoryLandingPagination";
import {
  evaluateCategoryCoverage,
  getCategoryCoverageDefinition,
} from "./categoryCoverage";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "./indexabilityLifecycle";
import { createLifecycleDataLoader } from "./lifecycleDataCache";
import {
  getLandingProducts,
  type ProductSearchResult,
} from "./products";

export type CategoryCoverageLandingPresentationConfig = {
  pageTitle: string;
  searchQuery: string;
  eyebrow: string;
  intro: string;
  secondaryCopy: string;
  sectionTitle: string;
  emptyTitle: string;
  emptyDescription: string;
};

export type CategoryCoverageLandingConfig = {
  definitionKey: string;
  pagePath: string;
  cacheVersion: string;
  description: string;
  metadataProfile: "inherit-root-twitter" | "explicit-category-twitter";
  presentation: CategoryCoverageLandingPresentationConfig;
};

export type CategoryCoverageLandingPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export type CategoryCoverageLandingResult = {
  results: ProductSearchResult[];
  error: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

function lifecycleParamsForPagination(params: RouteSearchParams) {
  const keys = Object.keys(params);
  const hasOnlyCanonicalPage =
    keys.every((key) => key === "page") &&
    isCanonicalCategoryLandingPageParam(params.page);

  return hasOnlyCanonicalPage ? {} : params;
}

export function buildCategoryCoverageLandingMetadata(
  config: CategoryCoverageLandingConfig,
  page: number,
  params: RouteSearchParams
): Metadata {
  const baseMetadata = buildCategoryLandingMetadata({
    basePath: config.pagePath,
    description: config.description,
    page,
    title: config.presentation.pageTitle,
  });
  const robots = getLifecycleRobots(
    config.pagePath,
    lifecycleParamsForPagination(params)
  );

  if (config.metadataProfile === "explicit-category-twitter") {
    return { ...baseMetadata, robots };
  }

  return {
    title: baseMetadata.title,
    description: baseMetadata.description,
    alternates: baseMetadata.alternates,
    openGraph: {
      ...baseMetadata.openGraph,
      type: "website",
    },
    robots,
  };
}

export function createCategoryCoverageLanding(
  config: CategoryCoverageLandingConfig
) {
  const definition = getCategoryCoverageDefinition(config.definitionKey);

  if (!definition) {
    throw new Error(
      `${config.presentation.pageTitle} category coverage definition is missing.`
    );
  }
  const coverageDefinition = definition;

  async function loadProducts(page: number) {
    const result = await getLandingProducts(
      [...coverageDefinition.candidateQueries],
      CATEGORY_LANDING_PAGE_SIZE,
      {
        page,
        productFilter: (product) =>
          evaluateCategoryCoverage(coverageDefinition, product)
            .classification === "INCLUDE_STRONG",
      }
    );

    return { ...result, error: Boolean(result.error) };
  }

  const getCachedProducts = createLifecycleDataLoader(
    config.pagePath,
    config.cacheVersion,
    loadProducts
  );

  return {
    async generateMetadata(
      searchParams: Promise<RouteSearchParams> = Promise.resolve({})
    ) {
      const params = await searchParams;
      const page = normalizeCategoryLandingPage(params.page);

      return buildCategoryCoverageLandingMetadata(config, page, params);
    },

    async load(
      searchParams: Promise<RouteSearchParams> = Promise.resolve({})
    ): Promise<CategoryCoverageLandingResult> {
      const params = await searchParams;
      const pageParam = params.page;
      const requestedPage = normalizeCategoryLandingPage(pageParam);

      if (!isCanonicalCategoryLandingPageParam(pageParam)) {
        redirect(config.pagePath);
      }

      const result = await getCachedProducts(requestedPage);
      assertLifecycleDataAvailable(result, config.pagePath);

      if (result.page !== requestedPage) {
        redirect(categoryLandingPageHref(config.pagePath, result.page));
      }

      return result;
    },
  };
}
