import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact SupplementScout | Product Data and Retailer Enquiries",
  description:
    "Contact SupplementScout about product data, incorrect prices, broken retailer links, retailer partnerships, affiliate enquiries and supplement comparison data.",
};

const contactTopics = [
  {
    title: "Product data issues",
    body: "Report incorrect prices, stock status, broken retailer links, wrong images, or incorrect product details.",
  },
  {
    title: "Retailer and brand enquiries",
    body: "Retailers, brands, and affiliate partners can contact SupplementScout about being listed or improving product data coverage.",
  },
  {
    title: "Affiliate and partnership enquiries",
    body: "Partners can contact SupplementScout about affiliate programmes, feeds, product data, or collaboration.",
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          SupplementScout
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-700">
          <Link href="/about">About</Link>
          <Link href="/affiliate-disclosure">Affiliate Disclosure</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Contact
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
          Contact SupplementScout
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">
          Use this page to contact SupplementScout about product data,
          incorrect prices, broken retailer links, retailer or brand
          partnerships, and affiliate enquiries.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {contactTopics.map((topic) => (
            <section
              key={topic.title}
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-zinc-950">{topic.title}</h2>
              <p className="mt-4 leading-7 text-zinc-700">{topic.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-5">
          <iframe
            src="https://tally.so/r/GxyqaQ"
            title="SupplementScout contact form"
            width="100%"
            height="820"
            frameBorder="0"
            loading="lazy"
            className="block min-h-[760px] w-full border-0 sm:min-h-[820px]"
          />
        </section>
      </section>
    </main>
  );
}
