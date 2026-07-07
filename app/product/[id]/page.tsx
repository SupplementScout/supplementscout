import PriceHistoryChart from "../../components/PriceHistoryChart";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  formatCurrency,
  getDeliveredPrice,
  getVerifiedCostPer5gCreatine,
  getVerifiedCostPer25gProtein,
  getVerifiedPricePerKg,
  getVerifiedPricePerLitre,
  getVerifiedPricePerServing,
} from "../../lib/pricing";
import { supabase } from "../../lib/supabase";

type ProductRouteProduct = {
  id: string;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  servings: number | null;
  description: string | null;
  image: string | null;
  price: number | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
  net_weight_g: number | string | null;
  net_volume_ml: number | string | null;
  product_format: string | null;
  serving_size_ml: number | string | null;
  protein_per_serving_g: number | string | null;
  creatine_per_serving_g: number | string | null;
  serving_count_verified: number | string | null;
  nutrition_verified: boolean | null;
  unit_pricing_verified: boolean | null;
};

function isProductIdValue(value: string) {
  return /^[1-9][0-9]*$/.test(value);
}

async function getProductByRouteParam(id: string, select: string) {
  const query = supabase.from("products").select(select);
  const result = isProductIdValue(id)
    ? await query.eq("id", id).maybeSingle()
    : await query.eq("slug", id).maybeSingle();
  const product = result.data as (ProductRouteProduct & { id?: number | string }) | null;

  return {
    ...result,
    data: product ? { ...product, id: String(product.id) } : null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const { data: product } = await getProductByRouteParam(
    id,
    "name, slug, brand, category, description, image"
  );

  if (!product) {
    return {
      title: "Product Not Found",
      description: "This product could not be found on SupplementScout.",
    };
  }

  const brandText = product.brand ? ` by ${product.brand}` : "";
  const description =
    product.description ||
    `Compare UK prices for ${product.name}${brandText}. Find the lowest total price including delivery.`;
  const productUrl = product.slug ? `/product/${product.slug}` : `/product/${id}`;

  return {
    title: product.name,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title: `${product.name} | SupplementScout`,
      description,
      url: productUrl,
      type: "website",
      images: product.image
        ? [
          {
            url: product.image,
            alt: product.name,
          },
        ]
        : [],
    },
    twitter: {
      card: product.image ? "summary_large_image" : "summary",
      title: `${product.name} | SupplementScout`,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: product, error } = await getProductByRouteParam(id, "*");
  if (error || !product) {
    notFound();
  }
  if (product.is_active === false && product.merged_into_product_id !== null) {
    permanentRedirect(`/product/${String(product.merged_into_product_id)}`);
  }
  if (product.is_active === false) {
    notFound();
  }
  const { data: offers } = await supabase
    .from("offers")
    .select(`
    *,
    retailer:retailers (
      id,
      name,
      slug,
      website,
      logo
    )
  `)
    .eq("product_id", product.id)
    .eq("in_stock", true)
    .order("price", { ascending: true });

  const offerIds = offers?.map((offer) => offer.id) || [];

  let lowestHistoricalPrice: number | null = null;
  let averageHistoricalPrice: number | null = null;
  let historyCount = 0;
  let lowestPriceDate: string | null = null;
  let chartData: { date: string; price: number }[] = [];

  if (offerIds.length > 0) {
    const { data: history } = await supabase
      .from("price_history")
      .select("total_price, checked_at, offer_id")
      .in("offer_id", offerIds)
      .order("checked_at", { ascending: true });

    const validHistory =
      history?.filter(
        (item) => !Number.isNaN(Number(item.total_price))
      ) || [];

    const dailyBestMap = new Map<
      string,
      { checkedAt: string; price: number }
    >();

    for (const item of validHistory) {
      const price = Number(item.total_price);
      const dateKey = new Date(item.checked_at)
        .toISOString()
        .split("T")[0];

      const existing = dailyBestMap.get(dateKey);

      if (!existing || price < existing.price) {
        dailyBestMap.set(dateKey, {
          checkedAt: item.checked_at,
          price,
        });
      }
    }

    const dailyHistory = Array.from(dailyBestMap.values()).sort(
      (a, b) =>
        new Date(a.checkedAt).getTime() -
        new Date(b.checkedAt).getTime()
    );

    const historicalPrices = dailyHistory.map((item) => item.price);

    lowestHistoricalPrice =
      historicalPrices.length > 0
        ? Math.min(...historicalPrices)
        : null;

    if (lowestHistoricalPrice !== null) {
      const lowestRecord = dailyHistory.find(
        (item) => item.price === lowestHistoricalPrice
      );

      lowestPriceDate = lowestRecord?.checkedAt || null;
    }

    averageHistoricalPrice =
      historicalPrices.length > 0
        ? historicalPrices.reduce((sum, price) => sum + price, 0) /
        historicalPrices.length
        : null;

    historyCount = historicalPrices.length;

    chartData = dailyHistory.map((item) => ({
      date: new Date(item.checkedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      price: item.price,
    }));
  }

  const sortedOffers = [...(offers || [])].sort((a, b) => {
    const totalA =
      Number(a.price) + Number(a.shipping_cost || 0);

    const totalB =
      Number(b.price) + Number(b.shipping_cost || 0);

    return totalA - totalB;
  });
  const cheapestOffer = sortedOffers[0] || null;


  const cheapestTotal = cheapestOffer
    ? Number(cheapestOffer.price) +
    Number(cheapestOffer.shipping_cost || 0)
    : Number(product.price);

  let priceRating: string | null = null;

  if (lowestHistoricalPrice !== null && cheapestTotal > 0) {
    const differencePercent =
      ((cheapestTotal - lowestHistoricalPrice) / lowestHistoricalPrice) * 100;

    if (differencePercent <= 0) {
      priceRating = "Lowest recorded price";
    } else if (differencePercent <= 5) {
      priceRating = "Good price";
    } else if (differencePercent <= 15) {
      priceRating = "Average price";
    } else {
      priceRating = "High price";
    }

  }
  let averageDifferencePercent: number | null = null;

  if (averageHistoricalPrice !== null && averageHistoricalPrice > 0) {
    averageDifferencePercent =
      ((cheapestTotal - averageHistoricalPrice) / averageHistoricalPrice) * 100;
  }
  const cheapestValidDeliveredPrice =
    sortedOffers
      .map((offer) => getDeliveredPrice(offer))
      .filter((price): price is NonNullable<typeof price> => price !== null)
      .sort((left, right) => left.totalPrice - right.totalPrice)[0] || null;
  const verifiedPricePerServing = getVerifiedPricePerServing(
    cheapestValidDeliveredPrice,
    product.serving_count_verified,
    product.unit_pricing_verified
  );
  const verifiedPricePerKg = getVerifiedPricePerKg(
    cheapestValidDeliveredPrice,
    product.net_weight_g,
    product.product_format,
    product.unit_pricing_verified
  );
  const verifiedPricePerLitre = getVerifiedPricePerLitre(
    cheapestValidDeliveredPrice,
    product.net_volume_ml,
    product.product_format,
    product.unit_pricing_verified
  );
  const verifiedCostPer25gProtein = getVerifiedCostPer25gProtein(
    cheapestValidDeliveredPrice,
    product.serving_count_verified,
    product.protein_per_serving_g,
    product.unit_pricing_verified,
    product.nutrition_verified
  );
  const verifiedCostPer5gCreatine = getVerifiedCostPer5gCreatine(
    cheapestValidDeliveredPrice,
    product.serving_count_verified,
    product.creatine_per_serving_g,
    product.unit_pricing_verified,
    product.nutrition_verified
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-12">
        <Link href="/" className="text-sm font-medium text-[#4B5563] hover:text-[#111827]">
          ← Back to search
        </Link>

        <div className="mt-5 grid gap-5 lg:mt-8 lg:grid-cols-2 lg:gap-10">
          <div className="flex h-[340px] min-w-0 items-center justify-center overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:h-[400px] sm:p-6 lg:aspect-square lg:h-auto lg:p-0 lg:shadow">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="max-h-[260px] min-w-0 max-w-full rounded-3xl object-contain sm:max-h-[300px] lg:h-full lg:max-h-none lg:p-8"
              />
            ) : (
              <span className="text-[#6B7280]">Product Image</span>
            )}
          </div>

          <div className="w-[calc(100vw-2rem)] min-w-0 sm:w-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] sm:text-sm">
              {product.category}
            </p>

            <h1 className="mt-2 min-w-0 max-w-full text-[38px] font-extrabold leading-[1.08] text-[#111827] [overflow-wrap:anywhere] sm:mt-3 sm:text-5xl lg:text-5xl">
              {product.name}
            </h1>

            <p className="mt-2 text-base font-medium text-[#4B5563] sm:mt-3 sm:text-lg">
              {product.brand}
            </p>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:mt-7 sm:p-6 lg:mt-8 lg:rounded-3xl lg:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#4B5563]">Best UK Price</p>

                  <div className="mt-1 text-[56px] font-extrabold leading-none text-[#111827] sm:text-6xl lg:text-5xl">
                    £{cheapestTotal.toFixed(2)}
                  </div>
                  {lowestHistoricalPrice !== null && (
                    <p className="mt-2 text-sm font-medium text-[#4B5563]">
                      Lowest recorded price: £{lowestHistoricalPrice.toFixed(2)}
                    </p>
                  )}
                  {lowestPriceDate && (
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Recorded on{" "}
                      {new Date(lowestPriceDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {averageHistoricalPrice !== null && (
                    <p className="mt-1 text-sm text-[#4B5563]">
                      Average recorded price: £{averageHistoricalPrice.toFixed(2)}
                    </p>
                  )}
                  {averageDifferencePercent !== null && (
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {averageDifferencePercent <= 0
                        ? `${Math.abs(averageDifferencePercent).toFixed(1)}% below average`
                        : `${averageDifferencePercent.toFixed(1)}% above average`}
                    </p>
                  )}

                  {historyCount > 0 && (
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Based on {historyCount} price record{historyCount === 1 ? "" : "s"}
                    </p>
                  )}
                  {priceRating && (
                    <p className="mt-2 text-sm font-semibold text-[#111827]">
                      Price rating: {priceRating}
                    </p>
                  )}
                  {cheapestOffer && (
                    <div className="mt-3 space-y-1 text-sm font-medium text-[#4B5563]">
                      <p>
                        Product: £{Number(cheapestOffer.price).toFixed(2)}
                      </p>
                      <p>
                        Delivery: £{Number(cheapestOffer.shipping_cost || 0).toFixed(2)}
                      </p>
                      <p>
                        Sold by {cheapestOffer.retailer?.name || "Unknown retailer"}
                      </p>
                    </div>
                  )}

                </div>

                {cheapestOffer ? (
                  <a
                    href={`/go/${String(cheapestOffer.id)}?source=product_best_offer`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-black px-8 py-4 font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
                  >
                    View Deal
                  </a>
                ) : (
                  <button
                    disabled
                    className="min-h-12 w-full cursor-not-allowed rounded-2xl bg-zinc-300 px-8 py-4 font-semibold text-[#4B5563] sm:w-auto"
                  >
                    No offer available
                  </button>
                )}              </div>
            </div>

            {(verifiedPricePerServing !== null ||
              verifiedPricePerKg !== null ||
              verifiedPricePerLitre !== null ||
              verifiedCostPer25gProtein !== null ||
              verifiedCostPer5gCreatine !== null) && (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:mt-7 sm:p-5 lg:mt-8">
                {verifiedPricePerServing !== null && (
                  <>
                <div className="text-xl font-extrabold leading-tight text-[#111827] sm:text-2xl">
                  £{verifiedPricePerServing.toFixed(2)} per serving
                </div>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Verified price per serving
                </p>
                  </>
                )}
                {verifiedPricePerKg !== null && (
                  <div className={verifiedPricePerServing !== null ? "mt-3 border-t border-zinc-200 pt-3" : ""}>
                    <div className="text-xl font-extrabold leading-tight text-[#111827] sm:text-2xl">
                      {formatCurrency(verifiedPricePerKg)} per kg
                    </div>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Verified price per kilogram
                    </p>
                  </div>
                )}
                {verifiedPricePerLitre !== null && (
                  <div
                    className={
                      verifiedPricePerServing !== null || verifiedPricePerKg !== null
                        ? "mt-3 border-t border-zinc-200 pt-3"
                        : ""
                    }
                  >
                    <div className="text-xl font-extrabold leading-tight text-[#111827] sm:text-2xl">
                      {formatCurrency(verifiedPricePerLitre)}/litre
                    </div>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Verified price per litre
                    </p>
                  </div>
                )}
                {verifiedCostPer25gProtein !== null && (
                  <div
                    className={
                      verifiedPricePerServing !== null ||
                      verifiedPricePerKg !== null ||
                      verifiedPricePerLitre !== null
                        ? "mt-3 border-t border-zinc-200 pt-3"
                        : ""
                    }
                  >
                    <div className="text-xl font-extrabold leading-tight text-[#111827] sm:text-2xl">
                      {formatCurrency(verifiedCostPer25gProtein)} per 25 g protein
                    </div>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Verified cost per 25 g protein
                    </p>
                  </div>
                )}
                {verifiedCostPer5gCreatine !== null && (
                  <div
                    className={
                      verifiedPricePerServing !== null ||
                      verifiedPricePerKg !== null ||
                      verifiedPricePerLitre !== null ||
                      verifiedCostPer25gProtein !== null
                        ? "mt-3 border-t border-zinc-200 pt-3"
                        : ""
                    }
                  >
                    <div className="text-xl font-extrabold leading-tight text-[#111827] sm:text-2xl">
                      {formatCurrency(verifiedCostPer5gCreatine)} per 5 g creatine
                    </div>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Verified cost per 5 g creatine
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-8 rounded-3xl border bg-white p-8">
              <h2 className="text-2xl font-bold">Price history</h2>

              <div className="mt-6">
                <PriceHistoryChart data={chartData} />
              </div>
            </div>
            <div className="mt-8 rounded-3xl border bg-white p-8">
              <h2 className="text-2xl font-bold">All offers</h2>

              <div className="mt-6 space-y-3">
                {offers && offers.length > 0 ? (
                  sortedOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          {offer.retailer?.name || "Unknown retailer"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {offer.in_stock ? "In stock" : "Out of stock"}
                        </p>
                        {offer.last_checked_at && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Price checked:{" "}
                            {new Date(offer.last_checked_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-zinc-500">
                            Product: £{Number(offer.price).toFixed(2)}
                          </p>

                          <p className="text-sm text-zinc-500">
                            Delivery: £{Number(offer.shipping_cost || 0).toFixed(2)}
                          </p>

                          <p className="mt-1 text-2xl font-bold">
                            £{(
                              Number(offer.price) +
                              Number(offer.shipping_cost || 0)
                            ).toFixed(2)}
                          </p>
                        </div>

                        <a
                          href={`/go/${String(offer.id)}?source=product_offer_list`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
                        >
                          View deal
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500">No offers available.</p>
                )}
              </div>
            </div>
            <div className="mt-8 rounded-3xl border bg-white p-8">
              <h2 className="text-2xl font-bold">Product Summary</h2>

              <p className="mt-4 leading-8 text-zinc-600">
                {product.description || "No product description available."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
