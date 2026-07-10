import Link from "next/link";
import type { Metadata } from "next";
import ProductResultCard from "../components/ProductResultCard";
import { getLandingProducts } from "../lib/products";

export const revalidate = 3600;

const omega3SearchTerms = [
  "omega",
  "omega 3",
  "omega-3",
  "fish oil",
  "cod liver oil",
  "krill oil",
  "flaxseed oil",
  "starflower oil",
  "evening primrose oil",
];

export const metadata: Metadata = {
  title: "Compare Omega 3 Supplements UK",
  description:
    "Compare Omega 3, fish oil and cod liver oil supplement prices from UK retailers. See product price, delivery cost and total delivered price with SupplementScout.",
  alternates: {
    canonical: "/omega-3",
  },
  openGraph: {
    title: "Compare Omega 3 Supplements UK | SupplementScout",
    description:
      "Compare Omega 3, fish oil and cod liver oil supplement prices from UK retailers. See product price, delivery cost and total delivered price with SupplementScout.",
    url: "/omega-3",
  },
  twitter: {
    card: "summary",
    title: "Compare Omega 3 Supplements UK | SupplementScout",
    description:
      "Compare Omega 3, fish oil and cod liver oil supplement prices from UK retailers. See product price, delivery cost and total delivered price with SupplementScout.",
  },
};

export default async function Omega3Page() {
  const { results, error } = await getLandingProducts(omega3SearchTerms, 24);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=omega%203"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search Omega 3
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Omega 3 supplements
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Omega 3 Supplements UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Find Omega 3 capsules, fish oil, cod liver oil and related formulas
            from UK supplement retailers. Compare product prices, delivery costs
            and total delivered prices in one place.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Omega 3 products are commonly sold as fish oil, cod liver oil, vegan
            omega, liquid omega or capsule formulas. Check product labels for
            the oil source, format, strength and ingredients before buying.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Product results
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Omega 3 supplement deals
            </h2>
          </div>
          <Link
            href="/search?q=omega%203"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
          >
            View all search results
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Products could not be loaded.</p>
            <p className="mt-1 text-sm">
              Please try the Omega 3 search page instead.
            </p>
          </div>
        )}

        {!error && results.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center sm:p-8">
            <h2 className="text-2xl font-bold">No Omega 3 deals found</h2>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
              No active Omega 3 products with in-stock delivered offers are
              available right now. Try the main search for broader results.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
            {results.map((product) => (
              <ProductResultCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How we compare prices</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout compares in-stock offers from UK retailers.
              Product price is the shelf price of the supplement. Delivery cost
              is the retailer delivery charge where known. Total delivered price
              combines the product price and delivery cost so you can compare
              offers more clearly.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Retailer availability can change, so check the retailer page
              before buying. Some retailer links may be affiliate links. This
              does not change the price you pay.{" "}
              <Link
                href="/affiliate-disclosure"
                className="font-semibold text-zinc-950 underline"
              >
                Read our affiliate disclosure
              </Link>
              .
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-2xl font-bold">Important note</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout is not medical advice. Always check product labels
              and consult a qualified professional if you are pregnant, taking
              medication, have a health condition or are unsure whether a
              supplement is suitable for you.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
