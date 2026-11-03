import CategoryCoverageLandingPage from "../components/CategoryCoverageLandingPage";
import {
  createCategoryCoverageLanding,
  type CategoryCoverageLandingConfig,
  type CategoryCoverageLandingPageProps,
} from "../lib/categoryCoverageLanding";

const config = {
  definitionKey: "testosterone-boosters",
  pagePath: "/testosterone-boosters",
  cacheVersion: "testosterone-boosters-category-v1",
  description:
    "Compare current UK retailer prices for products with a reviewed Testosterone Booster identity.",
  metadataProfile: "inherit-root-twitter",
  presentation: {
    pageTitle: "Compare Testosterone Booster Prices UK",
    searchQuery: "Testosterone Boosters",
    eyebrow: "Reviewed category coverage",
    intro:
      "SupplementScout uses reviewed product identity rules for this category. Ingredient-only products are not automatically treated as Testosterone Boosters.",
    secondaryCopy:
      "Current retailer availability and prices can change. Check the exact label, directions and retailer information before buying; this is a price comparison, not an effectiveness or suitability ranking.",
    sectionTitle: "Current Testosterone Booster products",
    emptyTitle: "No reviewed Testosterone Booster products available",
    emptyDescription:
      "No product currently meets the strong category membership rules.",
  },
} satisfies CategoryCoverageLandingConfig;

const landing = createCategoryCoverageLanding(config);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: CategoryCoverageLandingPageProps = {}) {
  return landing.generateMetadata(searchParams);
}

export default async function TestosteroneBoostersPage({
  searchParams,
}: CategoryCoverageLandingPageProps = {}) {
  const result = await landing.load(searchParams);

  return (
    <CategoryCoverageLandingPage
      pagePath={config.pagePath}
      presentation={config.presentation}
      result={result}
    />
  );
}
