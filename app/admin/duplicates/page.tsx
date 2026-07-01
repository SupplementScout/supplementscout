import Link from "next/link";
import {
  type DuplicateLevel,
  findPossibleDuplicates,
  getDuplicatePairKey,
} from "../../lib/duplicates";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

const levelStyles: Record<DuplicateLevel, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

type AdminProduct = {
  id: number | string;
  name: string;
  slug: string | null;
  gtin: string | null;
  brand: string | null;
  category: string | null;
  is_active?: boolean | null;
  merged_into_product_id?: number | string | null;
};

type IgnoredPair = {
  id: number | string;
  product_a_id: number | string;
  product_b_id: number | string;
  ignored_at: string | null;
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
  product: AdminProduct;
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

export default async function DuplicateProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: tokenParam } = await searchParams;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam || "";

  const [
    { data: products, error },
    { data: ignoredPairsData, error: ignoredPairsError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, gtin, brand, category, is_active, merged_into_product_id"
      )
      .eq("is_active", true)
      .order("name"),
    supabaseAdmin
      .from("ignored_duplicate_product_pairs")
      .select("id, product_a_id, product_b_id, ignored_at"),
  ]);

  const ignoredPairs: IgnoredPair[] = ignoredPairsData || [];

  const ignoredProductIds = Array.from(
    new Set(
      ignoredPairs.flatMap((pair) => [
        Number(pair.product_a_id),
        Number(pair.product_b_id),
      ])
    )
  );

  const { data: ignoredProductsData, error: ignoredProductsError } =
    !ignoredPairsError && ignoredProductIds.length > 0
      ? await supabaseAdmin
          .from("products")
          .select(
            "id, name, slug, gtin, brand, category, is_active, merged_into_product_id"
          )
          .eq("is_active", true)
          .in("id", ignoredProductIds)
      : { data: [], error: null };

  const ignoredProducts: AdminProduct[] = ignoredProductsData || [];
  const ignoredProductMap = new Map(
    ignoredProducts.map((product) => [Number(product.id), product])
  );

  const ignoredPairKeys = new Set(
    ignoredPairs.map((pair) =>
      getDuplicatePairKey(pair.product_a_id, pair.product_b_id)
    )
  );

  const allDuplicateMatches = findPossibleDuplicates(products || []);

  const duplicateMatches = ignoredPairsError
    ? allDuplicateMatches
    : allDuplicateMatches.filter(
        (match) =>
          !ignoredPairKeys.has(
            getDuplicatePairKey(match.productA.id, match.productB.id)
          )
      );

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

        {ignoredPairsError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Unable to load ignored pairs, so all detected pairs are shown:{" "}
            {ignoredPairsError.message}
          </div>
        )}

        {ignoredProductsError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Unable to load product details for ignored pairs:{" "}
            {ignoredProductsError.message}
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

                <div className="flex flex-wrap gap-2">
                  <form
                    action={`/admin/duplicates/ignore?token=${encodeURIComponent(token)}`}
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="productAId"
                      value={match.productA.id}
                    />
                    <input
                      type="hidden"
                      name="productBId"
                      value={match.productB.id}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                    >
                      Ignore
                    </button>
                  </form>

                  <Link
                    href={`/admin/duplicates/merge-preview?token=${encodeURIComponent(token)}&canonical=${match.productA.id}&candidate=${match.productB.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                  >
                    Preview: keep A
                  </Link>

                  <Link
                    href={`/admin/duplicates/merge-preview?token=${encodeURIComponent(token)}&canonical=${match.productB.id}&candidate=${match.productA.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                  >
                    Preview: keep B
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ProductSummary label="A" product={match.productA} />
                <ProductSummary label="B" product={match.productB} />
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 border-t border-zinc-200 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Ignored
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Ignored pairs
              </h2>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-950">
                {ignoredPairs.length}
              </span>{" "}
              ignored pairs
            </div>
          </div>

          {ignoredPairsError && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
              Ignored pairs are unavailable.
            </div>
          )}

          {!ignoredPairsError && ignoredPairs.length === 0 && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
              No ignored pairs yet.
            </div>
          )}

          <div className="mt-6 space-y-5">
            {ignoredPairs.map((pair) => {
              const productA = ignoredProductMap.get(Number(pair.product_a_id));
              const productB = ignoredProductMap.get(Number(pair.product_b_id));

              return (
                <section
                  key={pair.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-600">
                      Ignored at{" "}
                      {pair.ignored_at
                        ? new Date(pair.ignored_at).toLocaleString("en-GB")
                        : "unknown time"}
                    </p>

                    <form
                      action={`/admin/duplicates/restore?token=${encodeURIComponent(token)}`}
                      method="post"
                    >
                      <input
                        type="hidden"
                        name="productAId"
                        value={pair.product_a_id}
                      />
                      <input
                        type="hidden"
                        name="productBId"
                        value={pair.product_b_id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                      >
                        Restore
                      </button>
                    </form>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {productA ? (
                      <ProductSummary label="A" product={productA} />
                    ) : (
                      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                        Product A details unavailable. ID {pair.product_a_id}
                      </div>
                    )}

                    {productB ? (
                      <ProductSummary label="B" product={productB} />
                    ) : (
                      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
                        Product B details unavailable. ID {pair.product_b_id}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
