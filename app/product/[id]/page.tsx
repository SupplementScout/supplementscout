import PriceHistoryChart from "../../components/PriceHistoryChart";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { supabase } from "../../lib/supabase";

type ProductRouteProduct = {
  id: number;
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
  merged_into_product_id: number | null;
};

function isPositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

async function getProductByRouteParam(id: string, select: string) {
  const query = supabase.from("products").select(select);
  const result = isPositiveInteger(id)
    ? await query.eq("id", Number(id)).maybeSingle()
    : await query.eq("slug", id).maybeSingle();

  return {
    ...result,
    data: result.data as ProductRouteProduct | null,
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

  const description =
    product.description ||
    `Compare UK prices for ${product.name} by ${product.brand}. Find the lowest total price including delivery.`;

  return {
    title: `${product.name} Price Comparison`,
    description,
    alternates: {
      canonical: `/product/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} Price Comparison`,
      description,
      url: `https://www.supplementscout.co.uk/product/${product.slug}`,
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
    permanentRedirect(`/product/${product.merged_into_product_id}`);
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
  const pricePerServing =
    product.servings && Number(product.servings) > 0
      ? cheapestTotal / Number(product.servings)
      : null;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <a href="/" className="text-sm text-zinc-500 hover:text-black">
          ← Back to search
        </a>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div className="flex aspect-square items-center justify-center rounded-3xl bg-white shadow">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full rounded-3xl object-contain p-8"
              />
            ) : (
              <span className="text-zinc-400">Product Image</span>
            )}
          </div>

          <div>
            <p className="text-sm uppercase tracking-widest text-zinc-500">
              {product.category}
            </p>

            <h1 className="mt-3 text-5xl font-bold">{product.name}</h1>

            <p className="mt-3 text-lg text-zinc-500">{product.brand}</p>

            <div className="mt-8 rounded-3xl border bg-white p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Best UK Price</p>

                  <div className="mt-2 text-5xl font-bold">
                    £{cheapestTotal.toFixed(2)}
                  </div>
                  {lowestHistoricalPrice !== null && (
                    <p className="mt-2 text-sm text-zinc-500">
                      Lowest recorded price: £{lowestHistoricalPrice.toFixed(2)}
                    </p>
                  )}
                  {lowestPriceDate && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Recorded on{" "}
                      {new Date(lowestPriceDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {averageHistoricalPrice !== null && (
                    <p className="mt-1 text-sm text-zinc-500">
                      Average recorded price: £{averageHistoricalPrice.toFixed(2)}
                    </p>
                  )}
                  {averageDifferencePercent !== null && (
                    <p className="mt-1 text-sm font-medium">
                      {averageDifferencePercent <= 0
                        ? `${Math.abs(averageDifferencePercent).toFixed(1)}% below average`
                        : `${averageDifferencePercent.toFixed(1)}% above average`}
                    </p>
                  )}

                  {historyCount > 0 && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Based on {historyCount} price record{historyCount === 1 ? "" : "s"}
                    </p>
                  )}
                  {priceRating && (
                    <p className="mt-2 text-sm font-semibold">
                      Price rating: {priceRating}
                    </p>
                  )}
                  {cheapestOffer && (
                    <div className="mt-3 space-y-1 text-sm text-zinc-500">
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
                    href={cheapestOffer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-black px-8 py-4 font-semibold text-white"
                  >
                    View Deal
                  </a>
                ) : (
                  <button
                    disabled
                    className="cursor-not-allowed rounded-2xl bg-zinc-300 px-8 py-4 font-semibold text-zinc-600"
                  >
                    No offer available
                  </button>
                )}              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <div className="text-2xl font-bold">
                  {product.servings ?? "Unknown"}
                </div>
                <p className="text-sm text-zinc-500">Servings</p>
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <div className="text-2xl font-bold">
                  {pricePerServing !== null
                    ? `£${pricePerServing.toFixed(2)}`
                    : "Unknown"}
                </div>
                <p className="text-sm text-zinc-500">Per Serving</p>
              </div>
            </div>
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
                          href={offer.url}
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
