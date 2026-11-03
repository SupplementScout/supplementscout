import CategoryCoverageLandingPage from "../components/CategoryCoverageLandingPage";
import {
  createCategoryCoverageLanding,
  type CategoryCoverageLandingConfig,
  type CategoryCoverageLandingPageProps,
} from "../lib/categoryCoverageLanding";

const config = {
  definitionKey: "nootropics",
  pagePath: "/nootropics",
  cacheVersion: "nootropics-category-v1",
  description:
    "Compare current UK retailer prices for products with a reviewed Nootropic identity.",
  metadataProfile: "inherit-root-twitter",
  presentation: {
    pageTitle: "Compare Nootropic Prices UK",
    searchQuery: "Nootropics",
    eyebrow: "Reviewed category coverage",
    intro:
      "SupplementScout uses reviewed product identity rules for this category. Standalone cognitive ingredients and ordinary focus claims are not automatically treated as Nootropics.",
    secondaryCopy:
      "Current retailer availability and prices can change. Check the exact label, directions and retailer information before buying; this is a price comparison, not an effectiveness or suitability ranking.",
    sectionTitle: "Current Nootropic products",
    emptyTitle: "No reviewed Nootropic products available",
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

export default async function NootropicsPage({
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
