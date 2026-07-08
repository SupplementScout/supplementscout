import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description:
    "Learn how SupplementScout may earn affiliate commission and how we aim to keep supplement comparisons clear and transparent.",
  alternates: {
    canonical: "/affiliate-disclosure",
  },
};

const sections = [
  {
    title: "Affiliate links",
    body: "SupplementScout may earn commission when users click a retailer link and buy something. These links help support the platform and the work involved in maintaining supplement comparison data.",
  },
  {
    title: "Does this affect the price?",
    body: "No. Affiliate commission does not change the price the user pays. The retailer sets the product price, delivery cost and checkout terms.",
  },
  {
    title: "How rankings and comparisons work",
    body: "SupplementScout aims to present product and offer information clearly, including price, delivery cost, total delivered price, stock status and useful product metrics where available. Affiliate relationships may influence which retailers are available on the platform, but comparison information should remain clear to shoppers.",
  },
  {
    title: "Sponsored placements",
    body: "Sponsored placements may be added in the future. If they are used, they should be clearly labelled so users can distinguish them from standard comparison results.",
  },
  {
    title: "Editorial independence",
    body: "We aim to keep supplement comparison pages useful, practical and transparent. Commercial relationships should not prevent important information, such as stock status, delivery costs or total delivered prices, from being shown clearly.",
  },
  {
    title: "Medical and product advice disclaimer",
    body: "SupplementScout does not provide medical advice. Users should check product labels and consult a qualified professional if unsure, especially with health conditions, pregnancy, medication, or under-18 use.",
  },
  {
    title: "Contact",
    body: "For questions about SupplementScout, retailer links or disclosures, please contact the SupplementScout team through the contact details provided on the site.",
  },
];

export default function AffiliateDisclosurePage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          SupplementScout
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-700">
          <Link href="/about">About</Link>
          <Link href="/search">Search</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Transparency
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
          Affiliate Disclosure
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">
          This page explains how SupplementScout may earn money from retailer
          links and how we aim to keep supplement comparisons clear and useful.
        </p>

        <div className="mt-12 grid gap-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <h2 className="text-2xl font-bold text-zinc-950">
                {section.title}
              </h2>
              <p className="mt-4 leading-8 text-zinc-700">{section.body}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
