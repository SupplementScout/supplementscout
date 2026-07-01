"use client";
import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";



const popularSearches = [
  "Whey Protein",
  "Creatine",
  "Pre Workout",
  "Omega 3",
  "Vitamin D",
  "Collagen",
  "Ashwagandha",
  "Mass Gainer",
];





const priceDrops = [
  {
    name: "Optimum Nutrition Gold Standard Whey",
    oldPrice: "£59.99",
    newPrice: "£47.99",
  },
  {
    name: "Applied Nutrition Creatine Monohydrate",
    oldPrice: "£24.99",
    newPrice: "£18.99",
  },
  {
    name: "Per4m Whey Protein",
    oldPrice: "£39.99",
    newPrice: "£32.99",
  },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState("");
const [retailerCount, setRetailerCount] = useState(0);
const [productCount, setProductCount] = useState(0);

useEffect(() => {
  async function loadData() {
    setIsLoading(true);
    setLoadError("");

    const [
      { data: productsData, error: productsError },
      { data: retailersData, error: retailersError },
      { count: productsCount, error: productsCountError },
    ] = await Promise.all([
      supabase
  .from("products")
  .select(`
    *,
    offers (
      price,
      shipping_cost,
      in_stock
    )
  `)
  .eq("is_active", true)
  .order("name")
  .limit(50),
      supabase.from("retailers").select("id"),
      supabase
  .from("products")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true),
    ]);

    console.log("PRODUCTS ERROR:", productsError);
console.log("RETAILERS ERROR:", retailersError);
    if (productsError || retailersError) {
      setLoadError("Unable to load products. Please try again.");
      setIsLoading(false);
      return;
    }

    setProducts(productsData || []);
    setProductCount(productsCount || 0);
    setRetailerCount(retailersData?.length || 0);
    setIsLoading(false);
  }

  loadData();
}, []);
useEffect(() => {
  const timer = setTimeout(async () => {
    const query = search.trim();

    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        offers (
          price,
          shipping_cost,
          in_stock
        )
      `)
      .eq("is_active", true)
      .or(
        `name.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`
      )
      .order("name")
      .limit(50);

    if (error) {
      console.log("SEARCH ERROR:", error);
      setSearchResults([]);
    } else {
      setSearchResults(data || []);
    }

    setIsSearching(false);
  }, 400);

  return () => clearTimeout(timer);
}, [search]);

  const filteredProducts =
  search.trim().length >= 2 ? searchResults : products;
function getLowestPrice(product: any) {
  const availableOffers =
    product.offers?.filter((offer: any) => offer.in_stock) || [];

  if (availableOffers.length === 0) {
    return Number(product.price);
  }

  return Math.min(
    ...availableOffers.map(
      (offer: any) =>
        Number(offer.price) + Number(offer.shipping_cost || 0)
    )
  );
}

const categories = Array.from(
  new Set(
    products
      .map((product) => product.category)
      .filter(Boolean)
  )
).sort();
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-xl font-bold tracking-tight">SupplementScout</div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          <a href="#">Categories</a>
          <a href="#">Price Drops</a>
          <a href="#">Retailers</a>
          <a href="#">AI Search</a>
        </nav>

        <button className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white">
          Get Alerts
        </button>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 text-center">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500">
          SupplementScout
        </p>

        <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight sm:text-7xl">
          The UK&apos;s Smart Supplement Search Engine
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Compare supplement prices, ingredients, serving value and UK retailer offers in one place.
        </p>

        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-16 flex-1 rounded-2xl border border-zinc-200 px-6 text-base outline-none focus:border-zinc-950"
              placeholder="Search supplements, brands or ask AI..."
            />
            <button className="min-h-16 rounded-2xl bg-zinc-950 px-10 font-semibold text-white">
              Search
            </button>
          </div>
        </div>
{isLoading && (
  <p className="mt-8 text-zinc-500">Loading products...</p>
)}

{loadError && (
  <p className="mt-8 text-red-600">{loadError}</p>
)}
        {search && (
          <div className="mx-auto mt-8 max-w-3xl space-y-3 text-left">
            {filteredProducts.map((product) => (
              <a
  key={product.name}
  href={`/product/${product.slug}`}
  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-950"
>
  <div>
    <h3 className="font-semibold">{product.name}</h3>
    <p className="mt-1 text-sm text-zinc-500">
      {product.category} · {product.brand}
    </p>
  </div>
  <div>
  <p className="text-lg font-bold">
    From £{getLowestPrice(product).toFixed(2)}
  </p>

  <p className="mt-1 text-sm text-zinc-500">
    {product.offers?.filter((offer: any) => offer.in_stock).length || 0} offers
  </p>
</div>
</a>
            ))}

            {!isLoading && !loadError && filteredProducts.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center text-zinc-500">
                No products found.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {popularSearches.map((item) => (
            <button
              key={item}
              onClick={() => setSearch(item)}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-950"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 p-6">
            <div className="text-3xl font-bold">{productCount}</div>
            <p className="mt-2 text-sm text-zinc-600">products available</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-6">
            <div className="text-3xl font-bold">{retailerCount}</div>
            <p className="mt-2 text-sm text-zinc-600">UK retailers</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-6">
            <div className="text-3xl font-bold">Daily</div>
            <p className="mt-2 text-sm text-zinc-600">price updates planned</p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-100 bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Browse
          </p>
          <h2 className="mt-3 text-3xl font-bold">Popular categories</h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((item) => (
  <button
    key={item}
    onClick={() => {
      setSearch(item);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    className="rounded-3xl border border-zinc-200 bg-white p-8 text-left shadow-sm hover:border-zinc-950"
  >
                <h3 className="text-xl font-semibold">{item}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Compare prices, sizes, servings and value across UK supplement retailers.
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-zinc-200 pt-8 text-sm text-zinc-500 sm:flex-row">
          <p>© 2026 SupplementScout</p>
          <p>The UK&apos;s Smart Supplement Search Engine</p>
        </div>
      </footer>
    </main>
  );
}
