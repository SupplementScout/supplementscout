import Link from "next/link";
import type { ReactNode } from "react";
import { OfferCheckedBadge } from "./ComparisonProductVisuals";
import ComparisonTransparencyLinks from "./ComparisonTransparencyLinks";
import type { GuideOffer } from "../lib/buyingGuides";
import { formatCurrency } from "../lib/pricing";

export function BuyingGuide({ title, breadcrumb, structuredData, children }: {
  title: string; breadcrumb: string; structuredData: unknown; children: ReactNode;
}) {
  return (
    <main className="min-w-0 min-h-screen bg-[var(--ss-page)] text-[var(--ss-ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight">SupplementScout</Link>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/search" className="underline underline-offset-4">Search supplements</Link>
          <Link href="/how-we-compare" className="underline underline-offset-4">Our method</Link>
        </nav>
      </header>
      <article className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="text-sm leading-6 text-zinc-600">
          <ol className="flex flex-wrap gap-2"><li><Link href="/" className="underline">Home</Link></li><li aria-hidden="true">/</li><li aria-current="page">{breadcrumb}</li></ol>
        </nav>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-[var(--ss-accent)]">Buying guide</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        <div className="mt-6 space-y-10 text-base leading-7 text-zinc-700">{children}</div>
        <footer className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--ss-border)] pt-6 text-sm">
          <ComparisonTransparencyLinks />
        </footer>
      </article>
    </main>
  );
}

export function GuidePriceBreakdown({ offer }: { offer: GuideOffer }) {
  if (!offer.deliveredPrice) return null;
  return (
    <div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt>Product price</dt><dd className="font-semibold">{formatCurrency(offer.productPrice)}</dd>
        <dt>Delivery</dt><dd>{formatCurrency(offer.deliveredPrice.shippingCost)}</dd>
        <dt>Delivered total</dt><dd className="font-bold text-[var(--ss-accent-strong)]">{formatCurrency(offer.deliveredPrice.totalPrice)}</dd>
      </dl>
      <OfferCheckedBadge checkedAt={offer.lastCheckedAt} />
      <time dateTime={offer.lastCheckedAt} className="sr-only" aria-hidden="true">{offer.lastCheckedAt}</time>
    </div>
  );
}
