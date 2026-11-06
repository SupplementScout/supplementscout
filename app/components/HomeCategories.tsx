"use client";

import { useState } from "react";
import SupplementScoutIcon from "./SupplementScoutIcon";

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
  const featuredCategories = [
    { href: "/whey-protein", description: "Whey protein across UK retailers." },
    { href: "/creatine", description: "Compare packs and verified unit costs." },
    { href: "/pre-workout", description: "Compare pre-workout packs and prices." },
    { href: "/vitamins", description: "Vitamins and everyday health essentials." },
  ];
  const featuredHrefs = new Set(featuredCategories.map((item) => item.href));

  return (
    <section id="categories" className="home-categories px-5 sm:px-6" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
          Browse
        </p>
        <h2 id="categories-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
          Popular categories
        </h2>

        <div className="home-category-featured">
          {featuredCategories.map((category) => {
            const item = items.find((item) => item.href === category.href);
            return item ? (
              <a key={item.href} href={item.href} className="home-category-card">
                <SupplementScoutIcon name={item.href === "/vitamins" ? "shield" : "package"} size={24} />
                <h3>{item.label}</h3>
                <p>{category.description}</p>
                <span>Compare prices <span aria-hidden="true">→</span></span>
              </a>
            ) : null;
          })}
        </div>

        <div className="home-category-links">
          {items.filter((item) => !featuredHrefs.has(item.href)).map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className={`text-left focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2 ${
                !showAllCategories && index >= MOBILE_CATEGORY_LIMIT
                  ? "hidden md:block"
                  : ""
              }`}
            >
              {item.label}
            </a>
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
