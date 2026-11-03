import CategoryCoverageLandingPage from "../components/CategoryCoverageLandingPage";
import {
  createCategoryCoverageLanding,
  type CategoryCoverageLandingConfig,
  type CategoryCoverageLandingPageProps,
} from "../lib/categoryCoverageLanding";

const config = {
  definitionKey: "collagen",
  pagePath: "/collagen",
  cacheVersion: "collagen-category-v1",
  description:
    "Compare current UK retailer prices for products with a reviewed Collagen identity, including Collagen Peptides and Marine Collagen.",
  metadataProfile: "explicit-category-twitter",
  presentation: {
    pageTitle: "Compare Collagen Prices UK",
    searchQuery: "Collagen",
    eyebrow: "Reviewed category coverage",
    intro:
      "SupplementScout uses reviewed product identity rules for this category. Collagen Peptides and Marine Collagen are included when Collagen is a primary or named co-primary product identity.",
    secondaryCopy:
      "Products that only mention Collagen formation or synthesis are not included. Current retailer availability and prices can change; this is price comparison, not effectiveness or suitability advice.",
    sectionTitle: "Current Collagen products",
    emptyTitle: "No reviewed Collagen products available",
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

export default async function CollagenPage({
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
