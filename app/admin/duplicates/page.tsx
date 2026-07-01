import Link from "next/link";
import {
  type DuplicateLevel,
  findPossibleDuplicates,
} from "../../lib/duplicates";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

const levelStyles: Record<DuplicateLevel, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

function formatValue(value: string | number | null) {
  if (value === null || value === "") {
    return "Missing";
  }

  return value;
}

function ProductSummary({
  label,
  product,
}: {
  label: string;
  product: {
    id: string | number;
    name: string;
    slug: string | null;
    gtin: string | null;
    brand: string | null;
    category: string | null;
  };
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Product {label}
        </p>
        {product.slug ? (
          <Link
            href={`/product/${product.slug}`}
            className="text-sm font-medium text-zinc-950 underline underline-offset-4"
          >
            View product
          </Link>
        ) : (
          <span className="text-sm text-zinc-400">No product link</span>
        )}
      </div>

      <h2 className="text-lg font-semibold text-zinc-950">{product.name}</h2>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">ID</dt>
          <dd className="font-medium text-zinc-950">{product.id}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">GTIN</dt>
          <dd className="font-medium text-zinc-950">
            {formatValue(product.gtin)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Brand</dt>
          <dd className="font-medium text-zinc-950">
            {formatValue(product.brand)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Category</dt>
          <dd className="font-medium text-zinc-950">
            {formatValue(product.category)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Slug</dt>
          <dd className="break-all font-medium text-zinc-950">
            {formatValue(product.slug)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default async function DuplicateProductsPage() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, gtin, brand, category")
    .order("name");

  const duplicateMatches = findPossibleDuplicates(products || []);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Potential duplicate products
            </h1>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-950">
              {duplicateMatches.length}
            </span>{" "}
            possible pairs from{" "}
            <span className="font-semibold text-zinc-950">
              {products?.length || 0}
            </span>{" "}
            products
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Access is checked on the server for each request. The token is not
          stored in localStorage or cookies.
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load products: {error.message}
          </div>
        )}

        {!error && duplicateMatches.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
            No potential duplicates found.
          </div>
        )}

        <div className="mt-6 space-y-5">
          {duplicateMatches.map((match) => (
            <section
              key={`${match.productA.id}-${match.productB.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${levelStyles[match.level]}`}
                  >
                    {match.level}
                  </span>
                  <span className="text-sm font-medium text-zinc-600">
                    Score {Math.round(match.score * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ProductSummary label="A" product={match.productA} />
                <ProductSummary label="B" product={match.productB} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
