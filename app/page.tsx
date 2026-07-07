"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

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

type CategoryProduct = {
  category: string | null;
};

function searchHref(query: string) {
  return {
    pathname: "/search",
    query: { q: query },
  };
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retailerCount, setRetailerCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setLoadError("");

      const [
        { data: categoryData, error: categoryError },
        { data: retailersData, error: retailersError },
        { count: productsCount, error: productsCountError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select("category")
          .eq("is_active", true)
          .is("merged_into_product_id", null)
          .is("merged_at", null)
          .order("category"),
        supabase.from("retailers").select("id"),
        supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .is("merged_into_product_id", null)
          .is("merged_at", null),
      ]);

      if (categoryError || retailersError || productsCountError) {
        setLoadError("Unable to load site stats. Please try again.");
        setIsLoading(false);
        return;
      }

      setProductCount(productsCount || 0);
      setRetailerCount(retailersData?.length || 0);
      setCategories(
        Array.from(
          new Set(
            ((categoryData || []) as CategoryProduct[])
              .map((product) => product.category)
              .filter((category): category is string => Boolean(category))
          )
        ).sort()
      );
      setIsLoading(false);
    }

    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-xl font-bold tracking-tight">SupplementScout</div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          <a href="#categories">Categories</a>
          <a href="#search">Search</a>
          <a href="#stats">Retailers</a>
        </nav>

        <Link
          href={searchHref("Creatine")}
          className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white"
        >
          Find Deals
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 text-center">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.35em] text-zinc-500">
          SupplementScout
        </p>

        <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight sm:text-7xl">
          The UK&apos;s Smart Supplement Search Engine
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Compare supplement prices, ingredients, serving value and UK retailer
          offers in one place.
        </p>

        <form
          id="search"
          action="/search"
          className="mx-auto mt-10 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-3 shadow-xl"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              name="q"
              className="min-h-16 flex-1 rounded-2xl border border-zinc-200 px-6 text-base outline-none focus:border-zinc-950"
              placeholder="Search supplements, brands or categories"
            />
            <button
              type="submit"
              className="min-h-16 rounded-2xl bg-zinc-950 px-10 font-semibold text-white"
            >
              Search
            </button>
          </div>
        </form>

        {isLoading && <p className="mt-8 text-zinc-500">Loading site stats...</p>}

        {loadError && <p className="mt-8 text-red-600">{loadError}</p>}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {popularSearches.map((item) => (
            <Link
              key={item}
              href={searchHref(item)}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-950"
            >
              {item}
            </Link>
          ))}
        </div>

        <div id="stats" className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
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

      <section id="categories" className="border-t border-zinc-100 bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Browse
          </p>
          <h2 className="mt-3 text-3xl font-bold">Popular categories</h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((item) => (
              <Link
                key={item}
                href={searchHref(item)}
                className="rounded-3xl border border-zinc-200 bg-white p-8 text-left shadow-sm hover:border-zinc-950"
              >
                <h3 className="text-xl font-semibold">{item}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  Compare prices, sizes, servings and value across UK supplement
                  retailers.
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-zinc-200 pt-8 text-sm text-zinc-500 sm:flex-row">
          <p>© 2026 SupplementScout</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-zinc-950">
              About
            </Link>
            <Link href="/affiliate-disclosure" className="hover:text-zinc-950">
              Affiliate Disclosure
            </Link>
            <Link href="/contact" className="hover:text-zinc-950">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
