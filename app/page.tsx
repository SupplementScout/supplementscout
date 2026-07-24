"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeHeader from "./components/HomeHeader";
import SearchInput from "./components/SearchInput";
import { supabase } from "./lib/supabase";

const MOBILE_CATEGORY_LIMIT = 7;

const popularSearches = [
  { label: "Creatine", href: "/creatine" },
  { label: "Whey protein", query: "whey protein" },
  { label: "Magnesium", href: "/magnesium" },
  { label: "Vitamin D", href: "/vitamin-d" },
  { label: "Electrolytes", query: "electrolytes" },
];

const goalLinks = [
  {
    label: "Sleep",
    description: "Explore supplements commonly searched for sleep support.",
    href: "/magnesium",
  },
  {
    label: "Energy",
    description: "Browse products commonly searched for energy and training.",
    query: "pre workout",
  },
  {
    label: "Recovery",
    description: "Explore products commonly searched for recovery routines.",
    query: "recovery",
  },
  {
    label: "Hydration",
    description: "Compare electrolyte and hydration products.",
    href: "/hydration",
  },
  {
    label: "Muscle growth",
    description: "Explore whey, creatine and mass-gainer searches.",
    query: "muscle gain",
  },
  {
    label: "General health",
    description: "Browse vitamins and everyday supplement categories.",
    href: "/vitamins",
  },
];

const landingCategories = [
  { label: "Vitamins", href: "/vitamins" },
  { label: "Creatine", href: "/creatine" },
  { label: "Magnesium", href: "/magnesium" },
  { label: "Vitamin D", href: "/vitamin-d" },
  { label: "Omega 3", href: "/omega-3" },
  { label: "Hydration", href: "/hydration" },
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

type LatestOfferCheck = {
  last_checked_at: string | null;
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

function itemHref(item: { href?: string; query?: string }) {
  return item.href || searchHref(item.query || "");
}

function checkedDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retailerCount, setRetailerCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const browseCategories = [
    ...landingCategories.map((category) => category.label),
    ...categories.filter(
      (category) => !landingCategoryHrefs.has(category.toLowerCase())
    ),
  ];
  const latestCheckDate = checkedDate(lastCheckedAt);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setLoadError("");

      const [
        { data: categoryData, error: categoryError },
        { data: retailersData, error: retailersError },
        { count: productsCount, error: productsCountError },
        { data: latestChecks, error: latestCheckError },
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
        supabase
          .from("offers")
          .select("last_checked_at")
          .not("last_checked_at", "is", null)
          .order("last_checked_at", { ascending: false })
          .limit(1),
      ]);

      if (
        categoryError ||
        retailersError ||
        productsCountError
      ) {
        setLoadError("Unable to load site stats. Please try again.");
        setIsLoading(false);
        return;
      }

      setProductCount(productsCount ?? null);
      setRetailerCount(retailersData?.length ?? null);
      setLastCheckedAt(
        latestCheckError
          ? null
          : ((latestChecks || []) as LatestOfferCheck[])[0]?.last_checked_at ||
              null
      );
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
      <HomeHeader />

      <section className="mx-auto max-w-7xl px-4 pb-8 pt-7 text-center sm:px-6 sm:pb-14 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 sm:text-sm">
          SupplementScout
        </p>

        <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:mt-5 sm:text-6xl">
          Compare supplements and real prices with delivery
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:mt-6 sm:text-lg sm:leading-8">
          Search UK supplements, compare product prices and known delivery costs,
          and see verified value metrics when available.
        </p>

        <SearchInput />

        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500">
          Delivered totals include known shipping costs.
        </p>
      </section>

      <section
        aria-labelledby="popular-searches-heading"
        className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12"
      >
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
          <h2 id="popular-searches-heading" className="text-base font-bold">
            Popular searches
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularSearches.map((item) => (
              <Link
                key={item.label}
                href={itemHref(item)}
                className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        id="stats"
        aria-labelledby="stats-heading"
        aria-busy={isLoading}
        className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-16"
      >
        <h2 id="stats-heading" className="sr-only">
          SupplementScout coverage and data freshness
        </h2>

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {["products", "retailers", "freshness"].map((item) => (
              <div
                key={item}
                className="min-h-28 animate-pulse rounded-2xl border border-zinc-200 p-5"
              >
                <div className="h-7 w-20 rounded bg-zinc-200" />
                <div className="mt-3 h-4 w-32 rounded bg-zinc-100" />
              </div>
            ))}
            <span className="sr-only">Loading site statistics</span>
          </div>
        )}

        {loadError && <p className="text-center text-sm text-red-600">{loadError}</p>}

        {!isLoading &&
          !loadError &&
          productCount !== null &&
          retailerCount !== null && (
            <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="rounded-2xl border border-zinc-200 p-5 sm:p-6">
                <div className="text-2xl font-bold sm:text-3xl">{productCount}</div>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2">
                  active products
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-5 sm:p-6">
                <div className="text-2xl font-bold sm:text-3xl">{retailerCount}</div>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2">UK retailers</p>
              </div>

              {latestCheckDate && (
                <div className="rounded-2xl border border-zinc-200 p-5 sm:p-6">
                  <div className="text-xl font-bold sm:text-2xl">
                    {latestCheckDate}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 sm:mt-2">
                    latest recorded price check
                  </p>
                </div>
              )}
            </div>
          )}
      </section>

      <section
        id="goals"
        aria-labelledby="goals-heading"
        className="border-y border-zinc-100 bg-zinc-50 px-4 py-10 sm:px-6 sm:py-16"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Explore
          </p>
          <h2 id="goals-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
            Shop by goal
          </h2>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {goalLinks.map((goal) => (
              <Link
                key={goal.label}
                href={itemHref(goal)}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
              >
                <h3 className="text-lg font-semibold">{goal.label}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {goal.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="categories" className="px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Browse
          </p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            Popular categories
          </h2>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {browseCategories.map((item, index) => (
              <Link
                key={item}
                href={categoryHref(item)}
                className={`rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 sm:p-6 ${
                  !showAllCategories && index >= MOBILE_CATEGORY_LIMIT
                    ? "hidden md:block"
                    : ""
                }`}
              >
                <h3 className="break-words text-lg font-semibold sm:text-xl">
                  {item}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Compare prices, sizes, servings and value across UK supplement
                  retailers.
                </p>
              </Link>
            ))}
          </div>

          {browseCategories.length > MOBILE_CATEGORY_LIMIT && (
            <button
              type="button"
              aria-expanded={showAllCategories}
              onClick={() => setShowAllCategories((current) => !current)}
              className="mt-5 min-h-12 w-full rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 md:hidden"
            >
              {showAllCategories ? "Show fewer categories" : "View all categories"}
            </button>
          )}
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="border-t border-zinc-100 bg-zinc-50 px-4 py-10 sm:px-6 sm:py-16"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
            Clear comparisons
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-2 text-2xl font-bold sm:text-3xl"
          >
            Understand the price you compare
          </h2>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl bg-white p-5">
              <h3 className="font-semibold">Product price</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                See the retailer&apos;s current product price.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <h3 className="font-semibold">Known delivery cost</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Delivered totals include shipping when the cost is known.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <h3 className="font-semibold">Verified value metrics</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                See cost per serving or another verified unit when data is
                available.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-zinc-200 pt-8 text-sm text-zinc-500 sm:flex-row">
          <p>&copy; 2026 SupplementScout</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-zinc-950">
              About
            </Link>
            <Link href="/affiliate-disclosure" className="hover:text-zinc-950">
              Affiliate Disclosure
            </Link>
            <Link href="/privacy" className="hover:text-zinc-950">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-zinc-950">
              Cookies
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
