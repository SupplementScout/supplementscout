import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How SupplementScout uses website analytics and protects privacy.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    title: "How we use analytics",
    body: "SupplementScout uses Google Analytics 4 only after analytics consent is granted. It helps us understand broad website usage, comparison-page visits, searches by result count, filters and sorting, and retailer-offer clicks so we can improve the service.",
  },
  {
    title: "Information measured",
    body: "Analytics may measure page paths, device and browser categories, approximate region supplied by Google, interaction counts, product and retailer identifiers, product names, categories, offer prices and whether a link is an affiliate link. Our custom events are designed not to send names, email addresses, telephone numbers, postal addresses or raw user-entered search text.",
  },
  {
    title: "Your choice",
    body: "Analytics storage is denied until you choose. You can accept analytics, reject non-essential storage, or manage preferences. Advertising storage, ad user data and ad personalisation remain denied. You can withdraw analytics consent at any time using the Cookie settings button shown on every page.",
  },
  {
    title: "Other operational records",
    body: "SupplementScout separately records privacy-filtered search outcomes and outbound retailer redirects needed to operate and improve the comparison service. Retailer links must continue to work if analytics is unavailable.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">SupplementScout</Link>
        <nav className="flex gap-5 text-sm font-medium"><Link href="/cookies">Cookie Policy</Link><Link href="/contact">Contact</Link></nav>
      </header>
      <article className="mx-auto max-w-4xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Privacy</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">This page explains how SupplementScout uses consent-controlled analytics and operational data to improve supplement comparisons.</p>
        <div className="mt-10 space-y-5">
          {sections.map((section) => <section key={section.title} className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">{section.title}</h2><p className="mt-4 leading-8 text-zinc-700">{section.body}</p></section>)}
          <section className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">Questions and privacy requests</h2><p className="mt-4 leading-8 text-zinc-700">Use the existing <Link href="/contact" className="font-semibold underline">contact route</Link> for privacy questions or requests. This policy does not invent a legal entity address or unsupported retention period.</p></section>
        </div>
      </article>
    </main>
  );
}
