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
import StatusBadge from "./StatusBadge";
import SupplementScoutIcon from "./SupplementScoutIcon";

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
      className="ss-card ss-card-interactive w-full min-w-0 overflow-hidden"
    >
      <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:p-5 md:grid-cols-[144px_minmax(0,1fr)_268px] md:items-center md:gap-6">
        <Link
          href={productHref(product)}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--ss-border)] bg-[var(--ss-surface-muted)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          aria-label={`View offers for ${product.name}`}
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              unoptimized
              sizes="(max-width: 639px) 104px, (max-width: 767px) 128px, 144px"
              className="object-contain p-2.5"
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
            <p className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-zinc-600">
              <SupplementScoutIcon name="package" size={16} className="mt-0.5 shrink-0 text-zinc-500" />
              <span>
                {[packageSize, verifiedServings ? `${verifiedServings} verified servings` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
          )}

          {cheapestOffer && (
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone="availability" icon="check">
                In stock
              </StatusBadge>
              <StatusBadge tone="neutral" icon="store">
                {availabilityLabel}
              </StatusBadge>
            </div>
          )}
        </div>

        <div className="col-span-2 min-w-0 border-t border-zinc-200 pt-4 md:col-span-1 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            {pricePresentation?.label || OFFER_PRESENTATION_LABELS[product.presentationState]}
          </p>

          {pricePresentation ? (
            <>
              <p className="mt-1.5 text-3xl font-extrabold leading-none tracking-[-0.035em] text-[var(--ss-ink)]">
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
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ss-ink)] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[var(--ss-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          >
            View offers
            <SupplementScoutIcon name="external-link" size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
