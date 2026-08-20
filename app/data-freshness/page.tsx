import type { Metadata } from "next";
import Link from "next/link";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import { CREATINE_LAUNCH_THRESHOLDS } from "../lib/creatineLaunch";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/data-freshness";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Understand SupplementScout offer timestamps, the 24-hour comparison-page freshness rule, stale-data handling and price-history limitations.";

export const metadata: Metadata = {
  title: "Supplement Price Data Freshness",
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: pagePath },
  openGraph: {
    title: "Supplement Price Data Freshness | SupplementScout",
    description,
    url: pagePath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Supplement Price Data Freshness | SupplementScout",
    description,
  },
};

export function buildDataFreshnessStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "SupplementScout data freshness",
        description,
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Data freshness",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

export default function DataFreshnessPage() {
  const structuredData = buildDataFreshnessStructuredData();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          SupplementScout
        </Link>
        <nav className="flex flex-wrap justify-end gap-5 text-sm font-medium text-zinc-700">
          <Link href="/search">Search</Link>
          <Link href="/about">About</Link>
          <Link href="/how-we-compare">How we compare</Link>
        </nav>
      </header>

      <article className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:pt-14">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Data freshness</li>
          </ol>
        </nav>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Data freshness
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
          What our price-check timestamps mean
        </h1>
        <p className="mt-6 max-w-4xl text-lg leading-8 text-zinc-700">
          A check time records when an eligible retailer offer was last
          successfully processed and verified by the relevant data path. It is
          evidence of that check, not a guarantee that the retailer&apos;s price,
          delivery charge or stock is unchanged now.
        </p>

        <div className="mt-12 grid gap-6">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">The 24-hour comparison rule</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Current category comparison pages accept only qualifying offers
              checked within the last{" "}
              {CREATINE_LAUNCH_THRESHOLDS.maximumOfferAgeHours} hours. The offer
              must also be mapped to a reviewed product, in stock, have a valid
              positive product price, a usable retailer URL and an identified
              retailer. Older or incomplete offers are excluded from the
              current ranking until refreshed.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Not every page uses the same gate</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              The 24-hour rule protects the current rankings on selected
              comparison landing pages. Other site surfaces can show stored
              offers with their recorded check dates and should not be read as
              a claim that every offer was checked within 24 hours. Always use
              the visible timestamp and confirm the retailer&apos;s checkout.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">How retailer updates are processed</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              SupplementScout uses retailer data sources that are validated and
              mapped to existing canonical products and variants. Some approved
              scopes are refreshed automatically; others use controlled imports
              or reviews. Source-health, identity and change guards can stop an
              update before data is written.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              We do not claim one fixed update schedule for every retailer. The
              timestamp shown with an offer is the evidence to use.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">What happens when data is stale</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>Stale offers cannot take a place in a current comparison-page ranking.</li>
              <li>Missing delivery stays unknown and is never converted to free delivery.</li>
              <li>We may temporarily keep a comparison out of search results when current retailer coverage becomes too narrow.</li>
              <li>If current data cannot be loaded, we avoid presenting a partial result as a complete market comparison.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Price-history coverage</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Price history contains valid observations stored when supported
              imports and refreshes run. It is not a continuous record of every
              retailer price. Gaps can mean that a source was not processed, an
              offer was outside an approved scope or no qualifying history row
              was written. We do not fill those gaps by estimation.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Before buying</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Check the final product variant, price, delivery charge, stock and
              terms on the retailer&apos;s site. If SupplementScout shows an
              incorrect product or offer, send the page and retailer details so
              the mapping or source evidence can be reviewed.
            </p>
          </section>
        </div>

        <aside className="mt-10 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">Related information</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <ComparisonTransparencyLinks />
            <Link href="/contact" className="font-semibold underline">
              Report incorrect information
            </Link>
            <Link href="/affiliate-disclosure" className="font-semibold underline">
              Affiliate disclosure
            </Link>
          </div>
        </aside>
      </article>
    </main>
  );
}
