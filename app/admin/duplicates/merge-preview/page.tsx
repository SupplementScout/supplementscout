import Link from "next/link";
import {
  type MergeOffer,
  type ProductMergeDetails,
  type RetailerProductMapping,
  getMergePreview,
} from "../../../lib/mergePreview";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatValue(value: string | number | boolean | null) {
  if (value === null || value === "") {
    return "Missing";
  }

  return String(value);
}

function AdminError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-4xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <h1 className="text-2xl font-bold">Merge preview unavailable</h1>
        <p className="mt-3 text-sm">{message}</p>
      </div>
    </main>
  );
}

function ProductDetails({
  title,
  details,
}: {
  title: string;
  details: ProductMergeDetails;
}) {
  const product = details.product;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {title}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{product.name}</h2>
        </div>

        {product.slug ? (
          <Link
            href={`/product/${product.slug}`}
            className="text-sm font-semibold text-zinc-950 underline underline-offset-4"
          >
            View product
          </Link>
        ) : (
          <span className="text-sm text-zinc-400">No product link</span>
        )}
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">ID</dt>
          <dd className="font-medium">{product.id}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">GTIN</dt>
          <dd className="font-medium">{formatValue(product.gtin)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Brand</dt>
          <dd className="font-medium">{formatValue(product.brand)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Category</dt>
          <dd className="font-medium">{formatValue(product.category)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Servings</dt>
          <dd className="font-medium">{formatValue(product.servings)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Price</dt>
          <dd className="font-medium">{formatValue(product.price)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Slug</dt>
          <dd className="break-all font-medium">{formatValue(product.slug)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Image</dt>
          <dd className="break-all font-medium">{formatValue(product.image)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Description</dt>
          <dd className="mt-1 line-clamp-4 text-zinc-700">
            {formatValue(product.description)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-2xl font-bold">{details.offers.length}</p>
          <p className="text-sm text-zinc-500">offers</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-2xl font-bold">{details.priceHistoryCount}</p>
          <p className="text-sm text-zinc-500">price history records</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-2xl font-bold">{details.retailerProducts.length}</p>
          <p className="text-sm text-zinc-500">retailer mappings</p>
        </div>
      </div>
    </section>
  );
}

function OffersTable({ offers }: { offers: MergeOffer[] }) {
  if (offers.length === 0) {
    return <p className="text-sm text-zinc-500">No offers.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Retailer</th>
            <th className="py-2 pr-4">Price</th>
            <th className="py-2 pr-4">Shipping</th>
            <th className="py-2 pr-4">In stock</th>
            <th className="py-2 pr-4">URL</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} className="border-b border-zinc-100">
              <td className="py-3 pr-4 font-medium">{offer.id}</td>
              <td className="py-3 pr-4">
                {offer.retailer?.name || `Retailer ${offer.retailer_id}`}
              </td>
              <td className="py-3 pr-4">{formatValue(offer.price)}</td>
              <td className="py-3 pr-4">{formatValue(offer.shipping_cost)}</td>
              <td className="py-3 pr-4">{formatValue(offer.in_stock)}</td>
              <td className="break-all py-3 pr-4">{formatValue(offer.url)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetailerProductsTable({
  mappings,
}: {
  mappings: RetailerProductMapping[];
}) {
  if (mappings.length === 0) {
    return <p className="text-sm text-zinc-500">No retailer product mappings.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Retailer ID</th>
            <th className="py-2 pr-4">External name</th>
            <th className="py-2 pr-4">External slug</th>
            <th className="py-2 pr-4">External GTIN</th>
            <th className="py-2 pr-4">External URL</th>
            <th className="py-2 pr-4">Match</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping) => (
            <tr key={mapping.id} className="border-b border-zinc-100">
              <td className="py-3 pr-4 font-medium">{mapping.id}</td>
              <td className="py-3 pr-4">{mapping.retailer_id}</td>
              <td className="py-3 pr-4">{formatValue(mapping.external_name)}</td>
              <td className="break-all py-3 pr-4">
                {formatValue(mapping.external_slug)}
              </td>
              <td className="py-3 pr-4">{formatValue(mapping.external_gtin)}</td>
              <td className="break-all py-3 pr-4">
                {formatValue(mapping.external_url)}
              </td>
              <td className="py-3 pr-4">
                {formatValue(mapping.match_method)}{" "}
                {mapping.match_confidence !== null
                  ? `(${mapping.match_confidence})`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MergePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[];
    canonical?: string | string[];
    candidate?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const canonicalId = parsePositiveInteger(firstParam(params.canonical));
  const candidateId = parsePositiveInteger(firstParam(params.candidate));

  if (!canonicalId || !candidateId) {
    return (
      <AdminError message="canonical and candidate must be positive integers." />
    );
  }

  if (canonicalId === candidateId) {
    return (
      <AdminError message="canonical and candidate must be different products." />
    );
  }

  let preview;

  try {
    preview = await getMergePreview(canonicalId, candidateId);
  } catch (error) {
    return (
      <AdminError
        message={
          error instanceof Error
            ? error.message
            : "Unable to load merge preview."
        }
      />
    );
  }

  if (!preview) {
    return <AdminError message="Both products must exist to show merge preview." />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-zinc-200 pb-6">
          <Link
            href={`/admin/duplicates?token=${encodeURIComponent(token)}`}
            className="text-sm font-medium text-zinc-600 underline underline-offset-4"
          >
            Back to duplicates
          </Link>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Merge preview
          </h1>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Read-only preview — no changes will be made.
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <ProductDetails title="Canonical product" details={preview.canonical} />
          <ProductDetails title="Candidate product" details={preview.candidate} />
        </div>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-2xl font-bold">Conflicts</h2>

          {preview.conflicts.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No conflicts detected.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {preview.conflicts.map((conflict) => (
                <div
                  key={`${conflict.type}-${conflict.detail}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                >
                  <p className="font-semibold text-amber-950">
                    {conflict.label}
                  </p>
                  <p className="mt-1 text-sm text-amber-900">
                    {conflict.detail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold">Canonical offers</h2>
            <div className="mt-4">
              <OffersTable offers={preview.canonical.offers} />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold">Candidate offers</h2>
            <div className="mt-4">
              <OffersTable offers={preview.candidate.offers} />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold">Canonical retailer_products</h2>
            <div className="mt-4">
              <RetailerProductsTable
                mappings={preview.canonical.retailerProducts}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold">Candidate retailer_products</h2>
            <div className="mt-4">
              <RetailerProductsTable
                mappings={preview.candidate.retailerProducts}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
