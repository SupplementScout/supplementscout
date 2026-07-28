"use client";

import { useState } from "react";

type SearchProduct = {
  id: string;
  name: string;
  brand: string | null;
  variants: Array<{
    id: string;
    display_name: string | null;
  }>;
};

export default function CatalogSearch() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [status, setStatus] = useState("");

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setStatus("Enter at least 2 characters.");
      return;
    }
    setStatus("Searching...");
    try {
      const response = await fetch(
        `/admin/product-matching/catalog-search?q=${encodeURIComponent(trimmed)}`,
        { credentials: "same-origin" }
      );
      if (!response.ok) throw new Error("search failed");
      const result = (await response.json()) as { products?: SearchProduct[] };
      setProducts(result.products || []);
      setStatus(result.products?.length ? "" : "No catalog products found.");
    } catch {
      setProducts([]);
      setStatus("Unable to search the catalog.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-950">
        Search the entire catalog, including other retailer offer names
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
          placeholder="Example: Animal Flex 44 packs"
        />
        <button
          type="button"
          onClick={() => void search()}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>
      {status && <p className="mt-2 text-sm text-amber-900">{status}</p>}
      {products.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-amber-950">
            Exact existing product and variant
            <select
              name="manualBinding"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
            >
              <option value="">Select an exact variant</option>
              {products.flatMap((product) =>
                product.variants.map((variant) => (
                  <option
                    key={`${product.id}:${variant.id}`}
                    value={`${product.id}:${variant.id}`}
                  >
                    {product.name} — {variant.display_name || `Variant ${variant.id}`}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm font-medium text-amber-950">
            Existing product for a new flavour
            <select
              name="manualProduct"
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
            >
              <option value="">Select an existing product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.brand ? ` — ${product.brand}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
