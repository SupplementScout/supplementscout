import type { Metadata } from "next";
import Link from "next/link";
import { HomeFeaturedComparison, HomeCurrentComparisons } from "./home-comparisons";
import "./home.css";
import ComparisonTransparencyLinks from "./components/ComparisonTransparencyLinks";
import HomeCategories from "./components/HomeCategories";
import HomeHeader from "./components/HomeHeader";
import SearchInput from "./components/SearchInput";
import SupplementScoutIcon from "./components/SupplementScoutIcon";
import {
  categoryBrowseHref,
  COMPARISON_CATEGORY_LINKS,
} from "./lib/categoryRoutes";
import { CATEGORY_COVERAGE_DEFINITIONS } from "./lib/categoryCoverage";
import { getHomepageData } from "./lib/homepageData";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const popularSearches = [
  { label: "Compare two products", href: "/compare" },
  { label: "Best prices today", href: "/deals" },
  { label: "Creatine", href: "/creatine" },
  { label: "Whey protein", href: "/whey-protein" },
  { label: "Whey isolate", href: "/whey-isolate" },
  { label: "Vegan protein", href: "/vegan-protein" },
  { label: "Mass gainer", href: "/mass-gainer" },
  { label: "Protein bars", href: "/protein-bars" },
  { label: "Multivitamins", href: "/multivitamins" },
  { label: "Pre Workout", href: "/pre-workout" },
  { label: "Amino Acids", href: "/amino-acids" },
  { label: "Applied Nutrition", href: "/brands/applied-nutrition" },
  { label: "Per4m", href: "/brands/per4m" },
  { label: "BioTech USA", href: "/brands/biotech-usa" },
  { label: "eBay UK prices", href: "/retailers/ebay-uk" },
  { label: "Magnesium", href: "/magnesium" },
  { label: "Vitamin D", href: "/vitamin-d" },
  { label: "Electrolytes", query: "electrolytes" },
];

const comparisonHighlights = [
  { icon: "receipt", label: "Real cost, not just price", description: "Product + known delivery, together." },
  { icon: "package", label: "Like-for-like comparisons", description: "The same variant. The same pack." },
  { icon: "calculator", label: "Find better value", description: "Verified unit costs where available." },
  { icon: "store", label: "Compare UK stores", description: "Check tracked retailers in one place." },
] as const;

const goalLinks = [
  {
    label: "Sleep",
    description: "Explore supplements commonly searched for sleep support.",
    href: "/magnesium",
  },
  {
    label: "Energy",
    description: "Browse products commonly searched for energy and training.",
    href: "/pre-workout",
  },
  {
    label: "Recovery",
    description: "Explore products commonly searched for recovery routines.",
    query: "recovery",
  },
  {
    label: "Hydration",
    description: "Compare electrolyte and hydration products.",
    href: "/hydration",
  },
  {
    label: "Muscle growth",
    description: "Compare current Whey Protein and Creatine products.",
    href: "/whey-protein",
  },
  {
    label: "General health",
    description: "Browse vitamins and everyday supplement categories.",
    href: "/vitamins",
  },
];

const landingCategories = COMPARISON_CATEGORY_LINKS;

function homepageBrowseCategories(catalogueCategories: string[]) {
  const seen = new Set<string>();

  return [
    ...landingCategories.map((category) => category.label),
    ...catalogueCategories,
    ...CATEGORY_COVERAGE_DEFINITIONS.map((definition) => definition.publicLabel),
  ].filter((category) => {
    const normalized = category.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function searchHref(query: string) {
  return {
    pathname: "/search",
    query: { q: query },
  };
}

function itemHref(item: { href?: string; query?: string }) {
  return item.href || searchHref(item.query || "");
}

function checkedDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function Home() {
  const { categories, latestOfferCheckAt, productCount, retailerCount, comparisons } =
    await getHomepageData();
  const browseCategories = homepageBrowseCategories(categories);
  const categoryLinks = browseCategories.map((category) => ({
    href: categoryBrowseHref(category),
    label: category,
  }));
  const latestCheckDate = checkedDate(latestOfferCheckAt);
  const hasStatistics =
    productCount !== null || retailerCount !== null || latestCheckDate !== null;

  return (
    <main className="ss-home min-h-screen bg-[var(--ss-page)] pb-[env(safe-area-inset-bottom)] text-[var(--ss-ink)]">
      <HomeHeader />

      <section className="home-hero" aria-labelledby="home-heading">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><SupplementScoutIcon name="search" size={16} /> UK supplement price comparison</p>
          <h1 id="home-heading">Find the right supplement <span>at the right price.</span></h1>
          <p className="home-intro">Compare supplement prices from UK stores, including known delivery costs. Find the right product, then see what you&apos;ll really pay.</p>
          <ul className="home-trust" aria-label="Comparison features">
            <li><SupplementScoutIcon name="check" size={16} /> Real prices</li>
            <li><SupplementScoutIcon name="check" size={16} /> Known delivery included</li>
            <li><SupplementScoutIcon name="check" size={16} /> Same product, same size</li>
          </ul>
          <SearchInput />
          <div className="home-popular" aria-label="Popular searches">
            <span>Try:</span>
            <Link href="/creatine">Creatine</Link>
            <Link href="/whey-protein">Whey protein</Link>
            <Link href="/pre-workout">Pre-workout</Link>
          </div>
        </div>
        <HomeFeaturedComparison comparisons={comparisons} />
      </section>

      <section className="home-benefits" aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="sr-only">A clearer supplement comparison</h2>
        {comparisonHighlights.map((item) => (
          <div key={item.label} className="home-benefit">
            <SupplementScoutIcon name={item.icon} size={24} />
            <div><h3>{item.label}</h3><p>{item.description}</p></div>
          </div>
        ))}
      </section>

      <HomeCategories items={categoryLinks} />
      <HomeCurrentComparisons rows={comparisons.rows.slice(1)} />

      <section
        id="stats"
        aria-labelledby="stats-heading"
        className="home-section home-coverage"
      >
        <h2 id="stats-heading" className="sr-only">
          SupplementScout coverage and data freshness
        </h2>

        {hasStatistics ? (
          <div className="home-coverage-grid">
            {productCount !== null && (
              <div>
                <strong>
                  {productCount.toLocaleString("en-GB")}
                </strong>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2">
                  active catalogue products
                </p>
              </div>
            )}

            {retailerCount !== null && (
              <div>
                <strong>
                  {retailerCount.toLocaleString("en-GB")}
                </strong>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2">
                  UK retailers represented
                </p>
              </div>
            )}

            {latestCheckDate && latestOfferCheckAt && (
              <div>
                <strong>
                  <time dateTime={latestOfferCheckAt}>
                    {latestCheckDate}
                  </time>
                </strong>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2">
                  latest recorded price check
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-2xl border border-zinc-200 p-5 text-center text-sm text-zinc-600">
            Live catalogue statistics are temporarily unavailable.
          </p>
        )}
      </section>

      <section
        id="goals"
        aria-labelledby="goals-heading"
        className="home-discovery px-5 py-10 sm:px-6 sm:py-14"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Explore
          </p>
          <h2 id="goals-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
            Shop by goal
          </h2>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {goalLinks.map((goal) => (
              <Link
                key={goal.label}
                href={itemHref(goal)}
                className="ss-card ss-card-interactive p-5 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
              >
                <h3 className="text-lg font-semibold">{goal.label}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {goal.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="home-discovery border-t-0 px-5 py-10 sm:px-6 sm:py-14"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Clear comparisons
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-2 text-2xl font-bold sm:text-3xl"
          >
            Understand the price you compare
          </h2>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
            <div className="ss-card p-5">
              <span className="ss-icon-tile h-10 w-10"><SupplementScoutIcon name="receipt" size={20} /></span>
              <h3 className="mt-4 font-semibold">Product price</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                See the retailer&apos;s current product price.
              </p>
            </div>
            <div className="ss-card p-5">
              <span className="ss-icon-tile h-10 w-10"><SupplementScoutIcon name="truck" size={20} /></span>
              <h3 className="mt-4 font-semibold">Known delivery cost</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Delivered totals include shipping when the cost is known.
              </p>
            </div>
            <div className="ss-card p-5">
              <span className="ss-icon-tile h-10 w-10"><SupplementScoutIcon name="calculator" size={20} /></span>
              <h3 className="mt-4 font-semibold">Verified value metrics</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                See cost per serving or another verified unit when data is
                available.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <ComparisonTransparencyLinks />
          </div>
        </div>
      </section>

      <section className="home-section home-footer-links" aria-labelledby="popular-searches-heading">
        <h2 id="popular-searches-heading">Explore more comparisons</h2>
        <div>{popularSearches.map((item) => <Link key={item.label} href={itemHref(item)}>{item.label}</Link>)}</div>
        <p className="mt-3 text-sm text-slate-600">Need a starting point? <Link href="/help-me-choose" className="home-text-link">Help me choose</Link></p>
      </section>

      <footer className="px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-10 xl:pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-zinc-200 pt-8 text-sm text-zinc-500 sm:flex-row">
          <p>&copy; 2026 SupplementScout</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
            <Link href="/about" className="hover:text-zinc-950">
              About
            </Link>
            <Link href="/how-we-compare" className="hover:text-zinc-950">
              How we compare
            </Link>
            <Link href="/data-freshness" className="hover:text-zinc-950">
              Data freshness
            </Link>
            <Link href="/affiliate-disclosure" className="hover:text-zinc-950">
              Affiliate Disclosure
            </Link>
            <Link href="/privacy" className="hover:text-zinc-950">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-zinc-950">
              Cookies
            </Link>
            <Link href="/contact" className="hover:text-zinc-950">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
