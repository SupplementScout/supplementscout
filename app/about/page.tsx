import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About SupplementScout | UK Supplement Search Engine",
  description:
    "Learn what SupplementScout is and how it helps UK shoppers compare supplement prices, delivery costs and retailer offers.",
  alternates: {
    canonical: "/about",
  },
};

const comparisonItems = [
  "Product prices",
  "Delivery costs",
  "Total delivered prices",
  "Retailer availability",
  "Stock status",
  "Price per serving and product metrics where available",
];

const categories = [
  "protein powders",
  "creatine",
  "vitamins",
  "pre-workouts",
  "protein bars",
  "health supplements",
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          SupplementScout
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-700">
          <Link href="/search">Search</Link>
          <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          About
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
          The UK&apos;s Smart Supplement Search Engine
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">
          SupplementScout helps people in the UK search and compare supplements
          across multiple retailers. Instead of checking several shops manually,
          shoppers can see useful prices, retailer availability and product
          information in one place.
        </p>

        <div className="mt-12 grid gap-5">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">
              What is SupplementScout?
            </h2>
            <p className="mt-4 leading-8 text-zinc-700">
              SupplementScout is a supplement search and price comparison
              platform. We are not a retailer and we do not manufacture
              supplements. Our role is to help shoppers compare offers from UK
              retailers more easily.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">Why we built it</h2>
            <p className="mt-4 leading-8 text-zinc-700">
              Supplement shopping can be fragmented. Prices, delivery charges,
              serving sizes and stock status are often spread across different
              retailers. SupplementScout brings those details together so
              shoppers can make quicker, clearer comparisons.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">What we compare</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {comparisonItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800"
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-5 leading-8 text-zinc-700">
              We cover products such as {categories.join(", ")} and other
              supplement categories where reliable retailer data is available.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">
              How we help shoppers
            </h2>
            <p className="mt-4 leading-8 text-zinc-700">
              We focus on practical comparison details: the item price, delivery
              cost, total delivered price, retailer, availability and useful
              product metrics where we have enough data. This helps shoppers
              compare value beyond the headline shelf price.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">
              Our approach to transparency
            </h2>
            <p className="mt-4 leading-8 text-zinc-700">
              SupplementScout may earn commission from affiliate links. This
              does not increase the price paid by the user. If sponsored
              placements are added in the future, they should be clearly
              labelled.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-950">
              Important note: not medical advice
            </h2>
            <p className="mt-4 leading-8 text-zinc-700">
              SupplementScout provides product and price comparison information,
              not medical advice. Always check product labels and speak to a
              qualified professional if you are unsure whether a supplement is
              suitable for you.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
