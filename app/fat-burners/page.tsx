import CategoryCoverageLandingPage from "../components/CategoryCoverageLandingPage";
import {
  createCategoryCoverageLanding,
  type CategoryCoverageLandingConfig,
  type CategoryCoverageLandingPageProps,
} from "../lib/categoryCoverageLanding";

const config = {
  definitionKey: "fat-burners",
  pagePath: "/fat-burners",
  cacheVersion: "fat-burners-category-v1",
  description:
    "Compare current UK retailer prices for products with a reviewed Fat Burner identity.",
  metadataProfile: "inherit-root-twitter",
  presentation: {
    pageTitle: "Compare Fat Burner Prices UK",
    searchQuery: "Fat Burners",
    eyebrow: "Reviewed category coverage",
    intro:
      "SupplementScout uses reviewed product identity rules for this category. Products based only on ingredients such as L-Carnitine, CLA or MCT are not automatically treated as Fat Burners.",
    secondaryCopy:
      "Current retailer availability and prices can change. Check the exact label, directions and retailer information before buying; this is a price comparison, not an effectiveness or suitability ranking.",
    sectionTitle: "Current Fat Burner products",
    emptyTitle: "No reviewed Fat Burner products available",
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

export default async function FatBurnersPage({
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
