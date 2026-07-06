import Link from "next/link";
import type { ProductSearchResult } from "../lib/products";
import { formatCurrency } from "../lib/pricing";

function productHref(product: ProductSearchResult) {
  return `/product/${product.slug || product.id}`;
}

function safeBackgroundImage(value: string) {
  return `url("${value.replace(/["\\\n\r]/g, "")}")`;
}

export default function ProductResultCard({
  product,
}: {
  product: ProductSearchResult;
}) {
  const { cheapestOffer } = product;
  const retailerName = cheapestOffer.retailer?.name || "Unknown retailer";

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[180px_1fr]">
        <Link
          href={productHref(product)}
          className="flex min-h-44 items-center justify-center bg-zinc-50 p-4"
        >
          {product.image ? (
            <div
              aria-label={product.name}
              role="img"
              className="h-36 w-36 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: safeBackgroundImage(product.image) }}
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-4 text-center text-sm font-medium text-zinc-400">
              No image
            </div>
          )}
        </Link>

        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span>{product.category || "Uncategorised"}</span>
              <span aria-hidden="true">/</span>
              <span>{product.brand || "Unknown brand"}</span>
            </div>

            <Link href={productHref(product)}>
              <h2 className="mt-2 text-xl font-bold leading-snug text-zinc-950 hover:underline">
                {product.name}
              </h2>
            </Link>

            <p className="mt-3 text-sm text-zinc-600">
              Cheapest at <span className="font-semibold">{retailerName}</span>
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {product.availableOfferCount} in-stock offer
              {product.availableOfferCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:min-w-56">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-6">
                <dt className="text-zinc-500">Product</dt>
                <dd className="font-medium">
                  {formatCurrency(cheapestOffer.deliveredPrice.productPrice)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-6">
                <dt className="text-zinc-500">Shipping</dt>
                <dd className="font-medium">
                  {formatCurrency(cheapestOffer.deliveredPrice.shippingCost)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                <dt className="font-semibold text-zinc-700">Total</dt>
                <dd className="text-2xl font-bold">
                  {formatCurrency(cheapestOffer.deliveredPrice.totalPrice)}
                </dd>
              </div>
              {product.verifiedPricePerServing !== null && (
                <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                  <dt className="text-zinc-500">Per serving</dt>
                  <dd className="text-right font-semibold">
                    {formatCurrency(product.verifiedPricePerServing)} per serving
                  </dd>
                </div>
              )}
              {product.verifiedPricePerKg !== null && (
                <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                  <dt className="text-zinc-500">Per kg</dt>
                  <dd className="text-right font-semibold">
                    {formatCurrency(product.verifiedPricePerKg)} per kg
                  </dd>
                </div>
              )}
              {product.verifiedPricePerLitre !== null && (
                <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                  <dt className="text-zinc-500">Per litre</dt>
                  <dd className="text-right font-semibold">
                    {formatCurrency(product.verifiedPricePerLitre)}/litre
                  </dd>
                </div>
              )}
              {product.verifiedCostPer25gProtein !== null && (
                <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                  <dt className="text-zinc-500">Protein</dt>
                  <dd className="text-right font-semibold">
                    {formatCurrency(product.verifiedCostPer25gProtein)} per 25 g protein
                  </dd>
                </div>
              )}
              {product.verifiedCostPer5gCreatine !== null && (
                <div className="flex items-center justify-between gap-6 border-t border-zinc-200 pt-2">
                  <dt className="text-zinc-500">Creatine</dt>
                  <dd className="text-right font-semibold">
                    {formatCurrency(product.verifiedCostPer5gCreatine)} per 5 g creatine
                  </dd>
                </div>
              )}
            </dl>

            <Link
              href={productHref(product)}
              className="mt-4 block rounded-lg bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              View product
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
