import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How SupplementScout uses necessary storage and consent-controlled Google Analytics.",
  alternates: { canonical: "/cookies" },
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">SupplementScout</Link>
        <nav className="flex gap-5 text-sm font-medium"><Link href="/privacy">Privacy Policy</Link><Link href="/contact">Contact</Link></nav>
      </header>
      <article className="mx-auto max-w-4xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">Cookies</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Cookie Policy</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-700">SupplementScout separates strictly necessary preference storage from optional analytics.</p>
        <div className="mt-10 space-y-5">
          <section className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">Strictly necessary preference storage</h2><p className="mt-4 leading-8 text-zinc-700">Local browser storage remembers whether you accepted or rejected analytics. This prevents the site from repeatedly asking for the same choice and does not enable advertising.</p></section>
          <section className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">Google Analytics</h2><p className="mt-4 leading-8 text-zinc-700">The Google tag is not loaded unless analytics is accepted. When accepted, GA4 may set analytics cookies to distinguish visits and measure page views and non-personal interactions. Advertising storage, ad user data and ad personalisation remain denied.</p></section>
          <section className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">Rejecting or withdrawing consent</h2><p className="mt-4 leading-8 text-zinc-700">Choose Reject non-essential in the initial banner to keep analytics disabled. To change or withdraw a saved choice, select Cookie settings at the bottom of any page, switch Google Analytics off and save. Future custom analytics events are then blocked and known GA cookies are removed where the browser permits.</p></section>
          <section className="rounded-3xl border border-zinc-200 p-6 sm:p-8"><h2 className="text-2xl font-bold">Questions</h2><p className="mt-4 leading-8 text-zinc-700">For questions about cookies or analytics, use the <Link href="/contact" className="font-semibold underline">SupplementScout contact route</Link>.</p></section>
        </div>
      </article>
    </main>
  );
}
