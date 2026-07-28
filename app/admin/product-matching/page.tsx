import Link from "next/link";
import { requireAdminPage } from "../../lib/adminAuth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import CatalogSearch from "./CatalogSearch";

export const dynamic = "force-dynamic";

type Candidate = {
  product_id?: string;
  name?: string;
  brand?: string | null;
  score?: number;
  name_similarity?: number;
  size_match?: boolean | null;
  format_match?: boolean | null;
};

type ReviewRow = {
  id: number | string;
  snapshot_id: string;
  review_item_id: string;
  source_record_id: string;
  retailer: string;
  product_title: string;
  variant_title: string | null;
  primary_status: string;
  reason_codes: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  canonical_candidates: Candidate[];
  source_sku: string | null;
  source_gtin: string | null;
  source_weight: string | null;
  source_price: number | string | null;
  source_url: string | null;
  suggested_action: string;
  decision: string;
  selected_canonical_product_id: number | string | null;
  selected_canonical_variant_id: number | string | null;
  selected_family_seed_review_item_id: number | string | null;
  proposed_family_name: string | null;
  proposed_variant_name: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  consumed_at: string | null;
  source_row_fingerprint: string;
  updated_at: string;
};

type Product = {
  id: number | string;
  name: string;
  brand: string | null;
  is_active: boolean | null;
  merged_into_product_id: number | string | null;
};

type Variant = {
  id: number | string;
  product_id: number | string;
  display_name: string | null;
  variant_key: string;
  flavour_label: string | null;
  size_value: number | string | null;
  size_unit: string | null;
  is_active: boolean | null;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formatValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "Missing" : value;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function decisionLabel(decision: string) {
  const labels: Record<string, string> = {
    PENDING: "Needs your decision",
    APPROVE_EXISTING_VARIANT: "Use existing product",
    APPROVE_NEW_VARIANT_SEED: "Create a new variant",
    APPROVE_NEW_PRODUCT: "Create a new product",
    APPROVE_NEW_FAMILY_SEED: "Create a new product family",
    DEFER_POLICY: "Deferred",
    MARK_OOS: "Out of stock",
    REJECT_IDENTITY: "Rejected",
    REQUEST_NEW_SOURCE: "More source data required",
    SUPERSEDE: "Superseded",
  };
  return labels[decision] || decision;
}

function variantLabel(variant: Variant) {
  const size =
    variant.size_value !== null && variant.size_unit
      ? ` · ${variant.size_value}${variant.size_unit}`
      : "";
  const flavour = variant.flavour_label ? ` · ${variant.flavour_label}` : "";
  return `${variant.display_name || variant.variant_key}${size}${flavour}`;
}

export default async function ProductMatchingPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    retailer?: string | string[];
    q?: string | string[];
    saved?: string | string[];
  }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const status = firstParam(params.status) || "open";
  const retailerFilter = firstParam(params.retailer);
  const query = firstParam(params.q).trim().toLowerCase();
  const saved = firstParam(params.saved);
  const { data, error } = await supabaseAdmin
    .from("product_match_review_queue")
    .select(
      "id, snapshot_id, review_item_id, source_record_id, retailer, product_title, variant_title, primary_status, reason_codes, confidence, canonical_candidates, source_sku, source_gtin, source_weight, source_price, source_url, suggested_action, decision, selected_canonical_product_id, selected_canonical_variant_id, selected_family_seed_review_item_id, proposed_family_name, proposed_variant_name, reviewer_notes, reviewed_at, consumed_at, source_row_fingerprint, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(1000);
  const rows = (data || []) as ReviewRow[];
  const retailers = Array.from(new Set(rows.map((row) => row.retailer))).sort();
  const openCount = rows.filter((row) => row.decision === "PENDING").length;
  const deferredCount = rows.filter(
    (row) => row.decision === "DEFER_POLICY"
  ).length;
  const decidedCount = rows.length - openCount - deferredCount;
  const filtered = rows
    .filter((row) => {
      const statusMatches =
        status === "all" ||
        (status === "open" && row.decision === "PENDING") ||
        (status === "deferred" && row.decision === "DEFER_POLICY") ||
        (status === "decided" &&
          row.decision !== "PENDING" &&
          row.decision !== "DEFER_POLICY");
      const retailerMatches =
        !retailerFilter || row.retailer === retailerFilter;
      const haystack = [
        row.product_title,
        row.variant_title,
        row.source_sku,
        row.source_gtin,
        row.source_record_id,
      ]
        .join(" ")
        .toLowerCase();
      return statusMatches && retailerMatches && (!query || haystack.includes(query));
    })
    .slice(0, 200);
  const candidateProductIds = Array.from(
    new Set(
      filtered.flatMap((row) =>
        row.canonical_candidates
          .map((candidate) => candidate.product_id)
          .filter((id): id is string => Boolean(id))
      )
    )
  );
  const [{ data: productsData }, { data: variantsData }] =
    candidateProductIds.length > 0
      ? await Promise.all([
          supabaseAdmin
            .from("products")
            .select("id, name, brand, is_active, merged_into_product_id")
            .in("id", candidateProductIds),
          supabaseAdmin
            .from("product_variants")
            .select(
              "id, product_id, display_name, variant_key, flavour_label, size_value, size_unit, is_active"
            )
            .in("product_id", candidateProductIds)
            .eq("is_active", true),
        ])
      : [
          { data: [] as Product[] },
          { data: [] as Variant[] },
        ];
  const products = (productsData || []) as Product[];
  const variants = (variantsData || []) as Variant[];
  const productMap = new Map(
    products.map((product) => [String(product.id), product])
  );
  const familySeeds = rows.filter(
    (row) =>
      row.decision === "APPROVE_NEW_FAMILY_SEED" &&
      !row.consumed_at &&
      row.proposed_family_name
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              New retailer product decisions
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              These are matcher suggestions only. Saving a decision does not
              change the public catalogue, create a product, or move an offer.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold"
          >
            Admin
          </Link>
        </header>

        {saved === "decision" && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Decision saved. It is waiting for the separate checked adapter run.
          </div>
        )}
        {saved === "reopened" && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Decision reopened. No catalogue data was changed.
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load the product decision queue.
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-2xl font-bold">{openCount}</p>
            <p className="text-sm text-zinc-500">needs your decision</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-2xl font-bold text-blue-800">{deferredCount}</p>
            <p className="text-sm text-blue-700">deferred</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-800">{decidedCount}</p>
            <p className="text-sm text-emerald-700">decisions saved</p>
          </div>
        </section>

        <form
          action="/admin/product-matching"
          method="get"
          className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_180px_220px_auto]"
        >
          <label className="text-sm font-medium">
            Search
            <input
              type="search"
              name="q"
              defaultValue={firstParam(params.q)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={status}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="open">Needs decision</option>
              <option value="deferred">Deferred</option>
              <option value="decided">Decided</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Retailer
            <select
              name="retailer"
              defaultValue={retailerFilter}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">All retailers</option>
              {retailers.map((retailer) => (
                <option key={retailer} value={retailer}>
                  {retailer}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Filter
          </button>
        </form>

        <div className="mt-6 space-y-5">
          {filtered.map((row) => {
            const sourceUrl = safeExternalUrl(row.source_url);
            const candidateIds = new Set(
              row.canonical_candidates
                .map((candidate) => candidate.product_id)
                .filter(Boolean)
            );
            const candidateVariants = variants.filter((variant) =>
              candidateIds.has(String(variant.product_id))
            );
            const canUseExisting = candidateVariants.some((variant) => {
              const product = productMap.get(String(variant.product_id));
              return (
                product?.is_active === true &&
                product.merged_into_product_id === null
              );
            });
            const candidateProducts = products.filter(
              (product) =>
                candidateIds.has(String(product.id)) &&
                product.is_active === true &&
                product.merged_into_product_id === null
            );
            const availableFamilySeeds = familySeeds.filter(
              (seed) =>
                seed.snapshot_id === row.snapshot_id &&
                seed.retailer === row.retailer &&
                String(seed.id) !== String(row.id)
            );

            return (
              <article
                key={row.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-500">
                      {row.retailer} · source {row.source_record_id}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">
                      {row.product_title}
                    </h2>
                    {row.variant_title &&
                      row.variant_title !== row.product_title && (
                        <p className="mt-1 text-sm text-zinc-600">
                          Variant: {row.variant_title}
                        </p>
                      )}
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-semibold">
                    {decisionLabel(row.decision)}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
                  <div>
                    <dt className="text-zinc-500">Price</dt>
                    <dd className="font-semibold">
                      {row.source_price === null
                        ? "Missing"
                        : `£${row.source_price}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Weight / size</dt>
                    <dd className="font-semibold">{formatValue(row.source_weight)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">SKU</dt>
                    <dd className="font-semibold">{formatValue(row.source_sku)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">GTIN</dt>
                    <dd className="font-semibold">{formatValue(row.source_gtin)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Matcher result</dt>
                    <dd className="font-semibold">{row.primary_status}</dd>
                  </div>
                </dl>

                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
                  >
                    View retailer product
                  </a>
                )}

                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="font-semibold">Suggested existing products</h3>
                  {row.canonical_candidates.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-600">
                      No credible existing product candidate was found.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {row.canonical_candidates.map((candidate) => (
                        <li key={candidate.product_id}>
                          <span className="font-semibold">
                            {candidate.name || `Product ${candidate.product_id}`}
                          </span>{" "}
                          · score{" "}
                          {candidate.score === undefined
                            ? "unknown"
                            : Math.round(candidate.score)}
                          {candidate.size_match === false
                            ? " · different size"
                            : ""}
                          {candidate.format_match === false
                            ? " · different format"
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {row.decision === "PENDING" ? (
                  <form
                    action="/admin/product-matching/decision"
                    method="post"
                    className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      type="hidden"
                      name="sourceFingerprint"
                      value={row.source_row_fingerprint}
                    />
                    <label className="block text-sm font-medium text-blue-950">
                      Existing product and variant
                      <select
                        name="binding"
                        defaultValue=""
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                      >
                        <option value="">Select only if it is the same product</option>
                        {candidateVariants.map((variant) => {
                          const product = productMap.get(
                            String(variant.product_id)
                          );
                          if (
                            !product ||
                            product.is_active !== true ||
                            product.merged_into_product_id !== null
                          ) {
                            return null;
                          }
                          return (
                            <option
                              key={variant.id}
                              value={`${product.id}:${variant.id}`}
                            >
                              {product.name} — {variantLabel(variant)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="mt-3 block text-sm font-medium text-blue-950">
                      Existing product for a new flavour or variant
                      <select
                        name="candidateProduct"
                        defaultValue=""
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                      >
                        <option value="">
                          Select when the product exists but this flavour does not
                        </option>
                        {candidateProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 block text-sm font-medium text-blue-950">
                      New family already started in this review
                      <select
                        name="familySeed"
                        defaultValue=""
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                      >
                        <option value="">
                          Select to add this row as another flavour
                        </option>
                        {availableFamilySeeds.map((seed) => (
                          <option key={seed.id} value={seed.id}>
                            {seed.proposed_family_name} — source{" "}
                            {seed.source_record_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-medium text-blue-950">
                        New family name
                        <input
                          type="text"
                          name="familyName"
                          maxLength={300}
                          className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                          placeholder="Example: Callowfit Sauce 300ml"
                        />
                      </label>
                      <label className="block text-sm font-medium text-blue-950">
                        Flavour or variant name
                        <input
                          type="text"
                          name="variantName"
                          maxLength={200}
                          className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                          placeholder="Example: Curry Mango"
                        />
                      </label>
                    </div>
                    <CatalogSearch />
                    <label className="mt-3 block text-sm font-medium text-blue-950">
                      Optional note
                      <input
                        type="text"
                        name="notes"
                        maxLength={1000}
                        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2"
                        placeholder="Why this decision is correct"
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_EXISTING_VARIANT"
                        disabled={!canUseExisting}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
                      >
                        Use selected existing product
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_EXISTING_VARIANT_MANUAL"
                        className="rounded-lg border border-amber-700 bg-white px-4 py-2 text-sm font-semibold text-amber-900"
                      >
                        Use catalog-search variant
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_NEW_PRODUCT"
                        className="rounded-lg border border-blue-700 bg-white px-4 py-2 text-sm font-semibold text-blue-800"
                      >
                        Treat as a new product
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_NEW_VARIANT_SEED_EXISTING"
                        disabled={candidateProducts.length === 0}
                        className="rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      >
                        Add flavour to selected existing product
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_NEW_VARIANT_SEED_EXISTING_MANUAL"
                        className="rounded-lg border border-amber-700 bg-white px-4 py-2 text-sm font-semibold text-amber-900"
                      >
                        Add flavour to catalog-search product
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_NEW_FAMILY_SEED"
                        className="rounded-lg border border-violet-700 bg-white px-4 py-2 text-sm font-semibold text-violet-800"
                      >
                        Start one new product family
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVE_NEW_VARIANT_SEED_FAMILY"
                        disabled={availableFamilySeeds.length === 0}
                        className="rounded-lg border border-violet-700 bg-white px-4 py-2 text-sm font-semibold text-violet-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      >
                        Add flavour to selected new family
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="DEFER_POLICY"
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold"
                      >
                        Decide later
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="REJECT_IDENTITY"
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        Reject / exclude
                      </button>
                    </div>
                    <label className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      <input
                        type="checkbox"
                        name="confirmNewProduct"
                        value="yes"
                        className="mt-1"
                      />
                      <span>
                        I searched the full catalog and confirm this is still a
                        separate new product. This confirmation is used only by
                        the new-product and new-family actions.
                      </span>
                    </label>
                  </form>
                ) : (
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
                    <p className="font-semibold">{decisionLabel(row.decision)}</p>
                    <p className="mt-1 text-zinc-600">
                      Saved{" "}
                      {row.reviewed_at
                        ? new Date(row.reviewed_at).toLocaleString("en-GB")
                        : "at an unknown time"}
                      . Public catalogue changes: none.
                    </p>
                    {row.reviewer_notes && (
                      <p className="mt-2">Note: {row.reviewer_notes}</p>
                    )}
                    {row.proposed_family_name && (
                      <p className="mt-2">
                        Family: {row.proposed_family_name}
                        {row.proposed_variant_name
                          ? ` · variant: ${row.proposed_variant_name}`
                          : ""}
                      </p>
                    )}
                    {!row.proposed_family_name &&
                      row.proposed_variant_name &&
                      row.selected_canonical_product_id && (
                        <p className="mt-2">
                          Existing product {row.selected_canonical_product_id} ·
                          new variant: {row.proposed_variant_name}
                        </p>
                      )}
                    {!row.consumed_at && (
                      <form
                        action="/admin/product-matching/reopen"
                        method="post"
                        className="mt-3"
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-semibold"
                        >
                          Reopen decision
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {!error && filtered.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-zinc-600">
            No review items match these filters.
          </div>
        )}
      </div>
    </main>
  );
}
