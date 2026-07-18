"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SearchInput from "./components/SearchInput";
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

const landingCategories = [
  { label: "Vitamins", href: "/vitamins" },
  { label: "Magnesium", href: "/magnesium" },
  { label: "Vitamin D", href: "/vitamin-d" },
  { label: "Omega 3", href: "/omega-3" },
  { label: "Glucosamine", href: "/glucosamine" },
];

const landingCategoryHrefs = new Map(
  landingCategories.map((category) => [
    category.label.toLowerCase(),
    category.href,
  ])
);

type CategoryProduct = {
  category: string | null;
};

function searchHref(query: string) {
  return {
    pathname: "/search",
    query: { q: query },
  };
}

function categoryHref(category: string) {
  return landingCategoryHrefs.get(category.toLowerCase()) || searchHref(category);
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retailerCount, setRetailerCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const browseCategories = [
    ...landingCategories.map((category) => category.label),
    ...categories.filter(
      (category) => !landingCategoryHrefs.has(category.toLowerCase())
    ),
  ];

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
    <main className="min-h-screen bg-white pb-[env(safe-area-inset-bottom)] text-zinc-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <div className="text-xl font-bold tracking-tight">SupplementScout</div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          <a href="#categories">Categories</a>
          <a href="#search">Search</a>
          <a href="#stats">Retailers</a>
        </nav>

        <Link
          href="/creatine"
          className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white"
        >
          Find Deals
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 text-center sm:px-6 sm:pb-20 sm:pt-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 sm:mb-5 sm:text-sm sm:tracking-[0.35em]">
          SupplementScout
        </p>

        <h1 className="mx-auto max-w-5xl text-4xl font-bold tracking-tight sm:text-7xl">
          The UK&apos;s Smart Supplement Search Engine
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:mt-6 sm:text-lg sm:leading-8">
          Compare supplement prices, ingredients, serving value and UK retailer
          offers in one place.
        </p>

        <SearchInput />

        {isLoading && <p className="mt-5 text-zinc-500 sm:mt-8">Loading site stats...</p>}

        {loadError && <p className="mt-5 text-red-600 sm:mt-8">{loadError}</p>}

        <div className="mt-5 flex flex-wrap justify-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:mt-8 sm:gap-3 sm:pb-0">
          {popularSearches.map((item) => (
            <Link
              key={item}
              href={item === "Creatine" ? "/creatine" : searchHref(item)}
              className="rounded-full border border-zinc-200 px-3.5 py-2 text-sm text-zinc-700 hover:border-zinc-950 sm:px-4"
            >
              {item}
            </Link>
          ))}
        </div>

        <div id="stats" className="mx-auto mt-8 grid max-w-4xl gap-3 sm:mt-16 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-zinc-200 p-4 sm:p-6">
            <div className="text-2xl font-bold sm:text-3xl">{productCount}</div>
            <p className="mt-1 text-sm text-zinc-600 sm:mt-2">products available</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 sm:p-6">
            <div className="text-2xl font-bold sm:text-3xl">{retailerCount}</div>
            <p className="mt-1 text-sm text-zinc-600 sm:mt-2">UK retailers</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 sm:p-6">
            <div className="text-2xl font-bold sm:text-3xl">Daily</div>
            <p className="mt-1 text-sm text-zinc-600 sm:mt-2">price updates planned</p>
          </div>
        </div>
      </section>

      <section id="categories" className="border-t border-zinc-100 bg-zinc-50 px-4 py-10 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Browse
          </p>
          <h2 className="mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl">Popular categories</h2>

          <div className="mt-5 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {browseCategories.map((item) => (
              <Link
                key={item}
                href={categoryHref(item)}
                className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:border-zinc-950 sm:rounded-3xl sm:p-8"
              >
                <h3 className="text-lg font-semibold sm:text-xl">{item}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 sm:mt-3">
                  Compare prices, sizes, servings and value across UK supplement
                  retailers.
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-10">
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
