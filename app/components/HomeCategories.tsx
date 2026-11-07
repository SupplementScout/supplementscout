"use client";

import { useState } from "react";
import Image from "next/image";

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
  const featuredCategories = [
    { href: "/whey-protein", label: "Protein", description: "Find your whey. Compare the value.", image: "protein" },
    { href: "/creatine", label: "Creatine", description: "Compare packs and verified unit costs.", image: "creatine" },
    { href: "/pre-workout", label: "Pre-workout", description: "Explore your next pre-workout.", image: "pre-workout" },
    { href: "/vitamins", label: "Vitamins & Health", description: "Everyday essentials, clearly compared.", image: "vitamins" },
  ];

  return (
    <section id="categories" className="home-categories px-5 sm:px-6" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
          Browse
        </p>
        <h2 id="categories-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
          Explore supplements
        </h2>

        <div className="home-category-featured">
          {featuredCategories.map((category) => {
            const item = items.find((item) => item.href === category.href);
            return item ? (
              <a key={item.href} href={item.href} className="home-category-card">
                <Image src={`/images/home/categories/${category.image}.webp`} width={480} height={320} sizes="(max-width: 639px) 160px, (max-width: 1023px) 240px, 210px" alt="" className="home-category-image" />
                <h3>{category.label}</h3>
                <p>{category.description}</p>
                <span className="home-category-arrow" aria-hidden="true">→</span>
              </a>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}

export function HomeCategoryLinks({ items }: { items: HomeCategoryLink[] }) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const featuredHrefs = new Set(["/whey-protein", "/creatine", "/pre-workout", "/vitamins"]);
  return (
    <section className="home-category-directory" aria-label="More supplement categories">
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
    </section>
  );
}
