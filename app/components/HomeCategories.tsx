"use client";

import Link from "next/link";
import { useState } from "react";

const MOBILE_CATEGORY_LIMIT = 7;

type HomeCategoryLink = {
  href: string;
  label: string;
};

export default function HomeCategories({
  items,
}: {
  items: HomeCategoryLink[];
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  return (
    <section id="categories" className="px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
          Browse
        </p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
          Popular categories
        </h2>

        <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {items.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm hover:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 sm:p-6 ${
                !showAllCategories && index >= MOBILE_CATEGORY_LIMIT
                  ? "hidden md:block"
                  : ""
              }`}
            >
              <h3 className="break-words text-lg font-semibold sm:text-xl">
                {item.label}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Compare prices, sizes, servings and value across UK supplement
                retailers.
              </p>
            </Link>
          ))}
        </div>

        {items.length > MOBILE_CATEGORY_LIMIT && (
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
  );
}
