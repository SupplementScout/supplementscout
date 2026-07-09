import Link from "next/link";
import type { ProductSearchResult } from "../lib/products";
import { formatCurrency } from "../lib/pricing";

function productHref(product: ProductSearchResult) {
  return `/product/${product.slug || product.id}`;
}

function safeBackgroundImage(value: string) {
  return `url("${value.replace(/["\\\n\r]/g, "")}")`;
}

function formatDeliveryCost(value: number) {
  return value === 0 ? "Free delivery" : formatCurrency(value);
}

function formatVerifiedServings(value: number | string | null) {
  if (value === null || value === "") {
    return null;
  }

  const servings = Number(value);

  return Number.isFinite(servings) && Number.isInteger(servings) && servings > 0
    ? servings.toLocaleString("en-GB")
    : null;
}

export default function ProductResultCard({
  product,
}: {
  product: ProductSearchResult;
}) {
  const { cheapestOffer } = product;
  const retailerName = cheapestOffer.retailer?.name || "Unknown retailer";
  const deliveredPrice = cheapestOffer.deliveredPrice;
  const verifiedServings = formatVerifiedServings(product.serving_count_verified);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-3 p-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4 sm:p-5 md:grid-cols-[148px_minmax(0,1fr)_250px] md:items-center md:gap-5">
        <Link
          href={productHref(product)}
          className="flex h-28 w-28 items-center justify-center rounded-lg border border-zinc-100 bg-zinc-50 p-2 sm:w-full md:h-36"
          aria-label={`View ${product.name}`}
        >
          {product.image ? (
            <div
              aria-label={product.name}
              role="img"
              className="h-full w-full bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: safeBackgroundImage(product.image) }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-3 text-center text-xs font-semibold text-zinc-500">
              No image
            </div>
          )}
        </Link>

        <div className="col-span-2 min-w-0 self-start sm:col-span-1 sm:self-center">
          <div className="flex flex-wrap gap-x-2 gap-y-1 break-words text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <span>{product.category || "Uncategorised"}</span>
            <span aria-hidden="true">/</span>
            <span>{product.brand || "Unknown brand"}</span>
          </div>

          <Link href={productHref(product)} className="block min-w-0 max-w-full">
            <h2 className="mt-1.5 max-w-full whitespace-normal break-words text-base font-bold leading-snug text-zinc-950 hover:underline sm:text-lg md:text-xl">
              {product.name}
            </h2>
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="break-words font-semibold text-zinc-800">
              {retailerName}
            </span>
            <span className="text-zinc-600">
              {product.availableOfferCount} in-stock offer
              {product.availableOfferCount === 1 ? "" : "s"}
            </span>
            {verifiedServings && (
              <span className="text-zinc-600">
                Verified servings: {verifiedServings}
              </span>
            )}
          </div>

          <Link
            href={productHref(product)}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 sm:hidden"
          >
            View product
          </Link>
        </div>

        <div className="col-start-2 row-start-1 min-w-0 sm:col-span-2 sm:col-start-auto sm:row-start-auto sm:border-t sm:border-zinc-200 sm:pt-4 md:col-span-1 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Best delivered price
          </p>
          <p className="mt-1 text-2xl font-extrabold leading-none text-zinc-950 sm:text-3xl md:text-2xl">
            {formatCurrency(deliveredPrice.totalPrice)}
          </p>
          <p className="mt-1 hidden text-sm font-medium text-zinc-700 sm:block">
            From {retailerName}
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
              <dt className="text-zinc-700">Product</dt>
              <dd className="font-semibold text-zinc-950">
                {formatCurrency(deliveredPrice.productPrice)}
              </dd>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
              <dt className="text-zinc-700">Delivery</dt>
              <dd className="font-semibold text-zinc-950">
                {formatDeliveryCost(deliveredPrice.shippingCost)}
              </dd>
            </div>
            {product.verifiedPricePerServing !== null && (
              <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Per serving</dt>
                <dd className="text-right font-semibold text-zinc-800">
                  {formatCurrency(product.verifiedPricePerServing)} per serving
                </dd>
              </div>
            )}
            {product.verifiedPricePerKg !== null && (
              <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Per kg</dt>
                <dd className="text-right font-semibold text-zinc-800">
                  {formatCurrency(product.verifiedPricePerKg)} per kg
                </dd>
              </div>
            )}
            {product.verifiedPricePerLitre !== null && (
              <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Per litre</dt>
                <dd className="text-right font-semibold text-zinc-800">
                  {formatCurrency(product.verifiedPricePerLitre)}/litre
                </dd>
              </div>
            )}
            {product.verifiedCostPer25gProtein !== null && (
              <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Protein</dt>
                <dd className="text-right font-semibold text-zinc-800">
                  {formatCurrency(product.verifiedCostPer25gProtein)} per 25 g protein
                </dd>
              </div>
            )}
            {product.verifiedCostPer5gCreatine !== null && (
              <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-2">
                <dt className="text-zinc-600">Creatine</dt>
                <dd className="text-right font-semibold text-zinc-800">
                  {formatCurrency(product.verifiedCostPer5gCreatine)} per 5 g creatine
                </dd>
              </div>
            )}
          </dl>

          <Link
            href={productHref(product)}
            className="mt-4 hidden min-h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 sm:flex"
          >
            View product
          </Link>
        </div>
      </div>
    </article>
  );
}
