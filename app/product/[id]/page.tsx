import { notFound } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", id)
    .single();
    const { data: offers } = await supabase
  .from("offers")
  .select("*")
  .eq("product_id", product?.id)
  .eq("in_stock", true)
  .order("price", { ascending: true });

  if (error || !product) {
    notFound();
  }

  const pricePerServing =
    product.servings && product.servings > 0
      ? Number(product.price) / product.servings
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
                    £{Number(product.price).toFixed(2)}
                  </div>

                  <p className="mt-2 text-sm text-zinc-500">
                    Sold by {product.retailer}
                  </p>
                </div>

                {offers && offers.length > 0 ? (
  <a
    href={offers[0].url}
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-2xl bg-black px-8 py-4 font-semibold text-white"
  >
    View Deal
  </a>
) : (
  <button
    disabled
    className="rounded-2xl bg-zinc-300 px-8 py-4 font-semibold text-zinc-600"
  >
    No offers
  </button>
)}
              </div>
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
  <h2 className="text-2xl font-bold">All offers</h2>

  <div className="mt-6 space-y-3">
    {offers && offers.length > 0 ? (
      offers.map((offer) => (
        <div
          key={offer.id}
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold">{offer.retailer}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {offer.in_stock ? "In stock" : "Out of stock"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold">
              £{Number(offer.price).toFixed(2)}
            </p>

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