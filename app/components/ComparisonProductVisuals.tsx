import Link from "next/link";
import type { CategoryComparisonRow } from "../lib/categoryComparison";
import { OFFER_PRESENTATION_LABELS } from "../lib/offerFreshness";

function safeBackgroundImage(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `url("${url.href.replace(/["\\\n\r]/g, "")}")`;
  } catch {
    return null;
  }
}

function formatCheckedAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function ComparisonProductThumbnail({
  image,
  name,
  productUrl,
}: {
  image: string | null;
  name: string;
  productUrl: string;
}) {
  const backgroundImage = safeBackgroundImage(image);

  return (
    <Link
      href={productUrl}
      aria-label={`View ${name}`}
      className="flex h-24 w-24 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-2 sm:h-28 sm:w-28 lg:h-32 lg:w-32"
    >
      {backgroundImage ? (
        <span
          aria-label={`${name} product image`}
          role="img"
          className="h-full w-full bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-2 text-center text-xs font-semibold text-zinc-500">
          No image
        </span>
      )}
    </Link>
  );
}

export function OfferCheckedBadge({ checkedAt }: { checkedAt: string | null }) {
  const formatted = formatCheckedAt(checkedAt);

  if (!formatted) {
    return <p className="mt-2 text-xs text-zinc-500">Check time unavailable</p>;
  }

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />
      Offer checked {formatted}
    </p>
  );
}

export function UnavailableComparisonProductCard({
  row,
  position,
}: {
  row: CategoryComparisonRow;
  position?: number;
}) {
  const checkedAt = formatCheckedAt(row.lastCheckedAt);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 lg:grid-cols-[128px_minmax(0,1fr)_20rem] lg:items-center lg:gap-5">
        <ComparisonProductThumbnail image={row.image} name={row.name} productUrl={row.productUrl} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {position ? `${position}. ` : ""}{row.brand || "Brand not stated"}
          </p>
          <Link href={row.productUrl} className="block">
            <h3 className="mt-2 break-words text-xl font-bold hover:underline">{row.name}</h3>
          </Link>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {OFFER_PRESENTATION_LABELS[row.presentationState]}
            {checkedAt ? `; latest verification ${checkedAt}` : ""}.
            {row.observedRetailerCount > 0
              ? ` Evidence from ${row.observedRetailerCount} retailer${row.observedRetailerCount === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-sm font-semibold text-zinc-800">No price is currently eligible for ranking.</p>
          <p className="mt-2 text-sm text-zinc-600">Old prices and retailer purchase links remain hidden until a new check qualifies.</p>
          <Link href={row.productUrl} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
            View product
          </Link>
        </div>
      </div>
    </article>
  );
}
