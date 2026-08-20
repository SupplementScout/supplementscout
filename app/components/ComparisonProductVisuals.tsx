import Link from "next/link";

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
