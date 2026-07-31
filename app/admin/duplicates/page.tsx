import Link from "next/link";
import {
  type DuplicateLevel,
  findPossibleDuplicates,
  getDuplicatePairKey,
} from "../../lib/duplicates";
import {
  buildDuplicateReviews,
  type DuplicatePreflightStatus,
  type ProductReviewEvidence,
} from "../../lib/duplicateReview";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { requireAdminPage } from "../../lib/adminAuth";
import {
  type AdminDuplicateProduct as AdminProduct,
  loadAllActiveProducts,
  loadAllMappingsForProducts,
  loadAllProductAliases,
  loadAllVariantsForProducts,
} from "../lib/duplicateData";

export const dynamic = "force-dynamic";

const levelStyles: Record<DuplicateLevel, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const preflightStyles: Record<DuplicatePreflightStatus, string> = {
  blocked: "border-red-200 bg-red-50 text-red-700",
  review: "border-amber-200 bg-amber-50 text-amber-700",
  candidate: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

type IgnoredPair = {
  id: number | string;
  product_a_id: number | string;
  product_b_id: number | string;
  ignored_at: string | null;
  decision: "separate" | "deferred";
  note: string | null;
  updated_at: string | null;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Missing";
  }

  return value;
}

function ProductEvidence({ evidence }: { evidence: ProductReviewEvidence }) {
  return (
    <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-zinc-500">Active variants</dt>
        <dd className="font-semibold text-zinc-950">
          {evidence.activeVariants.length}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500">Retailer mappings</dt>
        <dd className="font-semibold text-zinc-950">{evidence.mappingCount}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Retailers</dt>
        <dd className="font-semibold text-zinc-950">
          {evidence.retailerNames.join(", ") || "None"}
        </dd>
      </div>
    </dl>
  );
}

function ProductSummary({
  label,
  product,
  evidence,
}: {
  label: string;
  product: AdminProduct;
  evidence?: ProductReviewEvidence;
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
        <div>
          <dt className="text-zinc-500">Format</dt>
          <dd className="font-medium text-zinc-950">
            {formatValue(product.product_format)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Structured size</dt>
          <dd className="font-medium text-zinc-950">
            {product.net_weight_g !== null
              ? `${product.net_weight_g} g`
              : product.net_volume_ml !== null
                ? `${product.net_volume_ml} ml`
                : product.unit_count !== null
                  ? `${product.unit_count} ${product.unit_type || "units"}`
                  : "Missing"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Slug</dt>
          <dd className="break-all font-medium text-zinc-950">
            {formatValue(product.slug)}
          </dd>
        </div>
      </dl>
      {evidence && <ProductEvidence evidence={evidence} />}
    </div>
  );
}

export default async function DuplicateProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    merged?: string | string[];
    canonical?: string | string[];
    candidate?: string | string[];
    saved?: string | string[];
    level?: string | string[];
    kind?: string | string[];
    q?: string | string[];
    count?: string | string[];
  }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const merged = firstParam(params.merged);
  const canonical = firstParam(params.canonical);
  const candidate = firstParam(params.candidate);
  const saved = firstParam(params.saved);
  const selectedLevel = firstParam(params.level);
  const selectedKind = firstParam(params.kind);
  const searchQuery = firstParam(params.q).trim().toLowerCase();
  const savedCount = firstParam(params.count);

  const [
    { data: products, error },
    { data: productAliases, error: productAliasesError },
    { data: ignoredPairsData, error: ignoredPairsError },
  ] = await Promise.all([
    loadAllActiveProducts(),
    loadAllProductAliases(),
    supabaseAdmin
      .from("ignored_duplicate_product_pairs")
      .select(
        "id, product_a_id, product_b_id, ignored_at, decision, note, updated_at"
      )
      .order("updated_at", { ascending: false }),
  ]);

  const ignoredPairs: IgnoredPair[] = ignoredPairsData || [];

  const ignoredProductIds = Array.from(
    new Set(
      ignoredPairs.flatMap((pair) => [
        String(pair.product_a_id),
        String(pair.product_b_id),
      ])
    )
  );

  const { data: ignoredProductsData, error: ignoredProductsError } =
    !ignoredPairsError && ignoredProductIds.length > 0
      ? await supabaseAdmin
          .from("products")
          .select(
            "id, name, slug, gtin, brand, category, product_format, net_weight_g, net_volume_ml, unit_count, unit_type, servings, is_active, merged_into_product_id"
          )
          .eq("is_active", true)
          .in("id", ignoredProductIds)
      : { data: [], error: null };

  const ignoredProducts: AdminProduct[] = ignoredProductsData || [];
  const ignoredProductMap = new Map(
    ignoredProducts.map((product) => [String(product.id), product])
  );

  const decidedPairKeys = new Set(
    ignoredPairs.map((pair) =>
      getDuplicatePairKey(pair.product_a_id, pair.product_b_id)
    )
  );

  const allDuplicateMatches = findPossibleDuplicates(
    products || [],
    0.6,
    productAliases || []
  );
  const allDuplicateMatchByPair = new Map(
    allDuplicateMatches.map((match) => [
      getDuplicatePairKey(match.productA.id, match.productB.id),
      match,
    ])
  );

  const duplicateMatches = ignoredPairsError
    ? allDuplicateMatches
    : allDuplicateMatches.filter(
        (match) =>
          !decidedPairKeys.has(
            getDuplicatePairKey(match.productA.id, match.productB.id)
          )
      );
  const reviewProductIds = Array.from(
    new Set(
      duplicateMatches.flatMap((match) => [
        String(match.productA.id),
        String(match.productB.id),
      ])
    )
  );
  const [
    { data: variantsData, error: variantsError },
    { data: mappingsData, error: mappingsError },
  ] =
    reviewProductIds.length > 0
      ? await Promise.all([
          loadAllVariantsForProducts(reviewProductIds),
          loadAllMappingsForProducts(reviewProductIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  const duplicateReviews = buildDuplicateReviews(
    duplicateMatches,
    variantsData || [],
    mappingsData || [],
    !variantsError && !mappingsError
  );
  const filteredReviews = duplicateReviews.filter((review) => {
    const levelMatches =
      !selectedLevel ||
      selectedLevel === "all" ||
      review.level === selectedLevel;
    const kindMatches =
      !selectedKind ||
      selectedKind === "all" ||
      review.kind === selectedKind;
    const haystack = [
      review.productA.name,
      review.productB.name,
      review.productA.brand,
      review.productB.brand,
      review.productA.id,
      review.productB.id,
    ]
      .join(" ")
      .toLowerCase();

    return (
      levelMatches &&
      kindMatches &&
      (!searchQuery || haystack.includes(searchQuery))
    );
  });
  const deferredPairs = ignoredPairs.filter(
    (pair) => pair.decision === "deferred"
  );
  const separatePairs = ignoredPairs.filter(
    (pair) => pair.decision === "separate"
  );

  if (error) {
    console.error("Unable to load duplicate products.", {
      errorName: error.name,
    });
  }

  if (ignoredPairsError) {
    console.error("Unable to load ignored duplicate pairs.", {
      errorName: ignoredPairsError.name,
    });
  }

  if (productAliasesError) {
    console.error("Unable to load retailer product aliases.", {
      errorName: productAliasesError.name,
    });
  }

  if (ignoredProductsError) {
    console.error("Unable to load ignored duplicate product details.", {
      errorName: ignoredProductsError.name,
    });
  }

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

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-950">
                {filteredReviews.length}
              </span>{" "}
              open pairs from{" "}
              <span className="font-semibold text-zinc-950">
                {products?.length || 0}
              </span>{" "}
              products
            </div>
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
            >
              Admin
            </Link>
            <Link
              href="/admin/catalog-health"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
            >
              Catalog health
            </Link>
            <Link
              href="/admin/outbound-clicks"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
            >
              Outbound clicks
            </Link>
            <form action="/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This is a decision assistant, not an automatic merge engine. A pair
          can be merged only after the separate server-side merge preview and
          database checks succeed.
        </div>

        {saved === "separate" && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Decision saved: keep the products separate.
          </div>
        )}
        {saved === "deferred" && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            Pair moved to the deferred review queue.
          </div>
        )}
        {saved === "restored" && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Decision removed. The pair is open for review again.
          </div>
        )}
        {saved.startsWith("batch-") && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Saved {savedCount || "selected"} batch decisions:{" "}
            {saved === "batch-separate" ? "keep separate" : "deferred"}.
          </div>
        )}

        {merged === "1" && canonical && candidate && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Candidate product {candidate} was merged into canonical product{" "}
            {canonical}.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load duplicate products.
          </div>
        )}

        {ignoredPairsError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Unable to load ignored duplicate pairs, so all detected pairs are
            shown.
          </div>
        )}

        {productAliasesError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Retailer aliases could not be loaded, so duplicate detection is
            running with canonical names only.
          </div>
        )}

        {ignoredProductsError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Unable to load product details for ignored pairs.
          </div>
        )}

        {(variantsError || mappingsError) && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Safety evidence is incomplete. Merge recommendations are
            unavailable until variants and retailer mappings can be loaded.
          </div>
        )}

        <form
          action="/admin/duplicates"
          method="get"
          className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_180px_220px_auto]"
        >
          <label className="text-sm font-medium text-zinc-700">
            Search name, brand or ID
            <input
              type="search"
              name="q"
              defaultValue={firstParam(params.q)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950"
              placeholder="e.g. Beta-Alanine"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Review type
            <select
              name="kind"
              defaultValue={selectedKind || "all"}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950"
            >
              <option value="all">All types</option>
              <option value="exact-product">Same exact product</option>
              <option value="product-family">Flavour / size family</option>
              <option value="possible-duplicate">Possible duplicate</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Similarity level
            <select
              name="level"
              defaultValue={selectedLevel || "all"}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-950"
            >
              <option value="all">All levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Filter
          </button>
        </form>

        {!error && filteredReviews.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
            No open pairs match these filters.
          </div>
        )}

        {filteredReviews.length > 0 && (
          <form
            id="duplicate-batch-form"
            action="/admin/duplicates/batch"
            method="post"
            className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
          >
            <p className="mr-auto text-sm font-medium text-blue-900">
              Select pairs below, then save one reviewed decision for the
              batch.
            </p>
            <button
              type="submit"
              name="decision"
              value="separate"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Keep selected separate
            </button>
            <button
              type="submit"
              name="decision"
              value="deferred"
              className="rounded-lg border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Defer selected
            </button>
          </form>
        )}

        <div className="mt-6 space-y-5">
          {filteredReviews.map((match) => (
            <section
              key={`${match.productA.id}-${match.productB.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                    <input
                      form="duplicate-batch-form"
                      type="checkbox"
                      name="pair"
                      value={`${match.productA.id}:${match.productB.id}`}
                      className="size-4"
                    />
                    Select
                  </label>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${levelStyles[match.level]}`}
                  >
                    {match.level}
                  </span>
                  <span className="text-sm font-medium text-zinc-600">
                    Score {Math.round(match.score * 100)}%
                  </span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                    {match.kind === "exact-product"
                      ? "Same exact product"
                      : match.kind === "product-family"
                        ? "Possible size/flavour family"
                        : "Possible duplicate"}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${preflightStyles[match.preflightStatus]}`}
                  >
                    {match.preflightStatus === "blocked"
                      ? "Merge blocked"
                      : match.preflightStatus === "review"
                        ? "Review required"
                        : "Merge candidate"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <form
                    action="/admin/duplicates/ignore"
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
                      Keep separate
                    </button>
                  </form>

                  <form action="/admin/duplicates/defer" method="post">
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
                      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:border-blue-700"
                    >
                      Defer
                    </button>
                  </form>

                  <Link
                    href={`/admin/duplicates/merge-preview?canonical=${match.productA.id}&candidate=${match.productB.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                  >
                    Preview: keep A
                  </Link>

                  <Link
                    href={`/admin/duplicates/merge-preview?canonical=${match.productB.id}&candidate=${match.productA.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                  >
                    Preview: keep B
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ProductSummary
                  label="A"
                  product={match.productA as AdminProduct}
                  evidence={match.productAEvidence}
                />
                <ProductSummary
                  label="B"
                  product={match.productB as AdminProduct}
                  evidence={match.productBEvidence}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="font-semibold text-emerald-800">
                    Matching evidence
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-800">
                    {match.positiveSignals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-800">Needs review</h3>
                  {match.cautions.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                      {match.cautions.map((caution) => (
                        <li key={caution}>{caution}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-amber-800">No cautions.</p>
                  )}
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="font-semibold text-red-800">
                    Merge blockers
                  </h3>
                  {match.blockers.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
                      {match.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-red-800">
                      No queue-level blockers. Full preview is still required.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 border-t border-zinc-200 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Decision memory
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Deferred and separate pairs
              </h2>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              <span className="font-semibold text-zinc-950">
                {deferredPairs.length}
              </span>{" "}
              deferred ·{" "}
              <span className="font-semibold text-zinc-950">
                {separatePairs.length}
              </span>{" "}
              separate
            </div>
          </div>

          {ignoredPairsError && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
              Saved review decisions are unavailable.
            </div>
          )}

          {!ignoredPairsError && ignoredPairs.length === 0 && (
            <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
              No saved pair decisions yet.
            </div>
          )}

          <div className="mt-6 space-y-5">
            {ignoredPairs.map((pair) => {
              const productA = ignoredProductMap.get(String(pair.product_a_id));
              const productB = ignoredProductMap.get(String(pair.product_b_id));
              const detectedMatch = allDuplicateMatchByPair.get(
                getDuplicatePairKey(pair.product_a_id, pair.product_b_id)
              );

              return (
                <section
                  key={pair.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                          pair.decision === "deferred"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        {pair.decision === "deferred"
                          ? "Deferred"
                          : "Keep separate"}
                      </span>
                      <p className="mt-3 text-sm font-medium text-zinc-600">
                        Updated{" "}
                        {pair.updated_at
                          ? new Date(pair.updated_at).toLocaleString("en-GB")
                          : pair.ignored_at
                            ? new Date(pair.ignored_at).toLocaleString("en-GB")
                        : "unknown time"}
                      </p>
                      {pair.note && (
                        <p className="mt-2 text-sm text-zinc-700">
                          Note: {pair.note}
                        </p>
                      )}
                      {pair.decision === "separate" &&
                        detectedMatch?.kind === "product-family" && (
                          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                            Recheck this older decision: the improved audit sees
                            a possible flavour, size or colour family.
                          </p>
                        )}
                    </div>

                    <form
                      action="/admin/duplicates/restore"
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
                        Reopen
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
