import Image from "next/image";
import Link from "next/link";
import type { ProductSearchResult } from "../lib/products";
import {
  buildBestOfferPricePresentation,
  formatOfferCheckedDate,
} from "../lib/productOfferPresentation";
import { OFFER_PRESENTATION_LABELS } from "../lib/offerFreshness";
import {
  primarySearchValueMetric,
  searchResultSize,
} from "../lib/searchResultPresentation";

function productHref(product: ProductSearchResult) {
  const base = `/product/${product.slug || product.id}`;
  return product.selectedVariantId
    ? `${base}?variant=${encodeURIComponent(product.selectedVariantId)}`
    : base;
}

function formatVerifiedServings(value: number | string | null) {
  if (value === null || value === "") return null;

  const servings = Number(value);
  return Number.isFinite(servings) && Number.isInteger(servings) && servings > 0
    ? servings.toLocaleString("en-GB")
    : null;
}

export default function ProductResultCard({
  product,
  searchMobileFirst = false,
}: {
  product: ProductSearchResult;
  searchMobileFirst?: boolean;
}) {
  const { cheapestOffer } = product;
  const retailerName = cheapestOffer?.retailer?.name || null;
  const pricePresentation = cheapestOffer
    ? buildBestOfferPricePresentation(cheapestOffer, {
        deliveryComparisonComplete: product.deliveryComparisonComplete,
      })
    : null;
  const valueMetric = primarySearchValueMetric(product);
  const packageSize = searchResultSize(product);
  const verifiedServings = formatVerifiedServings(product.serving_count_verified);
  const verificationDate = formatOfferCheckedDate(product.latestVerificationAt);
  const availabilityLabel = product.availableRetailerCount > 0
    ? `${product.availableRetailerCount} retailer${
        product.availableRetailerCount === 1 ? "" : "s"
      }`
    : `${product.availableOfferCount} offer${
        product.availableOfferCount === 1 ? "" : "s"
      }`;

  return (
    <article
      data-search-card={searchMobileFirst ? "primary" : undefined}
      className="w-full min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)]"
    >
      <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-5 md:grid-cols-[132px_minmax(0,1fr)_260px] md:items-center md:gap-6">
        <Link
          href={productHref(product)}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-100 bg-[var(--ss-surface-muted)] p-2 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          aria-label={`View offers for ${product.name}`}
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              unoptimized
              sizes="(max-width: 639px) 96px, (max-width: 767px) 120px, 132px"
              className="object-contain p-2"
            />
          ) : (
            <span className="px-2 text-center text-xs font-semibold text-zinc-500">
              Image unavailable
            </span>
          )}
        </Link>

        <div className="min-w-0 self-start md:self-center">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {product.brand && <span className="break-words">{product.brand}</span>}
            {product.brand && product.category && <span aria-hidden="true">·</span>}
            {product.category && <span className="break-words">{product.category}</span>}
          </div>

          <Link href={productHref(product)} className="block min-w-0">
            <h2 className="mt-1.5 break-words text-lg font-bold leading-snug text-[var(--ss-ink)] hover:underline sm:text-xl">
              {product.name}
            </h2>
          </Link>

          {(packageSize || verifiedServings) && (
            <p className="mt-1.5 text-sm text-zinc-600">
              {[packageSize, verifiedServings ? `${verifiedServings} verified servings` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {cheapestOffer && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                In stock
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">
                {availabilityLabel}
              </span>
            </div>
          )}
        </div>

        <div className="col-span-2 min-w-0 border-t border-zinc-200 pt-4 md:col-span-1 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            {pricePresentation?.label || OFFER_PRESENTATION_LABELS[product.presentationState]}
          </p>

          {pricePresentation ? (
            <>
              <p className="mt-1 text-3xl font-extrabold leading-none tracking-tight text-[var(--ss-ink)]">
                {pricePresentation.primaryPrice}
              </p>
              <p className="mt-2 text-sm font-medium leading-5 text-zinc-700">
                {pricePresentation.breakdown}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600">
                {retailerName && <span className="font-semibold text-zinc-800">{retailerName}</span>}
                <span>{availabilityLabel}</span>
              </div>
              {valueMetric && (
                <div className="mt-3 border-t border-zinc-200 pt-3 text-sm">
                  <p className="text-zinc-500">{valueMetric.label}</p>
                  <p className="font-semibold text-zinc-900">{valueMetric.value}</p>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {product.presentationState === "RECENT"
                ? `Previously in stock${verificationDate ? ` on ${verificationDate}` : ""}; the old price is not shown as current.`
                : product.presentationState === "OUT_OF_STOCK"
                  ? `A retailer check${verificationDate ? ` on ${verificationDate}` : ""} confirmed this product is out of stock.`
                  : `No retailer price has been verified in the last 24 hours${verificationDate ? `; latest check ${verificationDate}` : ""}.`}
            </p>
          )}

          <Link
            href={productHref(product)}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ss-ink)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          >
            View offers
          </Link>
        </div>
      </div>
    </article>
  );
}
