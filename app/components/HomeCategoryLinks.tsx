"use client";

import { useState } from "react";

const MOBILE_CATEGORY_LIMIT = 7;

export default function HomeCategoryLinks({ items }: { items: { href: string; label: string }[] }) {
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
              !showAllCategories && index >= MOBILE_CATEGORY_LIMIT ? "hidden md:block" : ""
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
