import type { Metadata } from "next";
import Link from "next/link";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/how-we-compare";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Learn how SupplementScout compares supplement prices, delivery costs, retailer coverage, price history and verified value metrics.";

export const metadata: Metadata = {
  title: "How We Compare Supplement Prices",
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: pagePath },
  openGraph: {
    title: "How We Compare Supplement Prices | SupplementScout",
    description,
    url: pagePath,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "How We Compare Supplement Prices | SupplementScout",
    description,
  },
};

export function buildComparisonMethodologyStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "How SupplementScout compares supplement prices",
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
            name: "How we compare",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

export default function ComparisonMethodologyPage() {
  const structuredData = buildComparisonMethodologyStructuredData();

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
          <Link href="/data-freshness">Data freshness</Link>
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
            <li aria-current="page">How we compare</li>
          </ol>
        </nav>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Comparison methodology
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
          How SupplementScout compares supplement prices
        </h1>
        <p className="mt-6 max-w-4xl text-lg leading-8 text-zinc-700">
          We compare offers mapped to the same reviewed product or variant. We
          prefer a known delivered total over a cheaper-looking product price
          with unknown delivery, and we show value calculations only when the
          fields needed for that calculation have been verified.
        </p>

        <div className="mt-12 grid gap-6">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Delivered price</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              A known delivered total is the product price plus the known
              delivery charge. Free delivery is counted as £0 only when the
              retailer data explicitly records it. If delivery is missing, the
              total stays unknown: we do not treat missing delivery as free.
            </p>
            <div className="mt-5 rounded-2xl bg-zinc-50 p-5 text-center font-semibold text-zinc-900">
              Known delivered total = product price + known delivery charge
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Product and variant identity</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Retailer listings are mapped to SupplementScout&apos;s canonical
              products and variants. Pack sizes, flavours and formulations stay
              separate when they represent different buying choices. We do not
              combine listings just because their names look similar.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">How results are ordered</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Within one product, eligible offers with known delivery are
              ordered by delivered total. An offer with unknown delivery cannot
              outrank an offer with a complete delivered price. On category
              comparison pages, products with broader current retailer coverage
              appear first before offer count and verified data completeness.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This is a price-and-coverage order, not a ranking of effectiveness,
              formulation quality, safety or suitability.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Verified value metrics</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Price per kilogram, litre, capsule, tablet or serving is shown
              only when the package or serving evidence required by that metric
              is valid. Nutrition-based calculations, such as cost per 25 g of
              protein or per 5 g of creatine, additionally require verified
              nutrition and unit-pricing evidence. The known delivered total is
              used, not only the shelf price.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              If any required field is missing or unverified, the metric is
              hidden or marked not yet verified rather than estimated from a
              name, pack image or retailer description.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Price history</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Product charts use valid recorded delivered-price observations
              linked to that product&apos;s offers. When several valid totals exist
              on one day, the chart uses the lowest recorded total for that day.
              History is evidence of checks stored by SupplementScout, not a
              promise of continuous monitoring or the lowest price across the
              entire UK market.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Sources and limitations</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>Offer data comes from retailer sources mapped to reviewed catalogue records.</li>
              <li>Retailer coverage is not the whole UK market and varies by product.</li>
              <li>Prices, delivery terms and stock can change after the recorded check.</li>
              <li>The retailer&apos;s checkout is the final source for the amount paid.</li>
              <li>SupplementScout compares shopping information and does not provide medical advice.</li>
            </ul>
          </section>
        </div>

        <aside className="mt-10 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">Continue reading</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <ComparisonTransparencyLinks />
            <Link href="/affiliate-disclosure" className="font-semibold underline">
              Affiliate disclosure
            </Link>
            <Link href="/contact" className="font-semibold underline">
              Report incorrect information
            </Link>
          </div>
        </aside>
      </article>
    </main>
  );
}
