import Link from "next/link";
import {
  type MergeOffer,
  type MergePlanItem,
  type MergePlanStatus,
  type MergeReadiness,
  type ProductMergeDetails,
  type RetailerProductMapping,
  getMergePreview,
} from "../../../lib/mergePreview";
import { MergeConfirmButton } from "./MergeConfirmButton";
import { MergeDecisionsForm } from "./MergeDecisionsForm";
import { requireAdminPage } from "../../../lib/adminAuth";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function parsePositiveBigint(value: string) {
  return /^[1-9]\d*$/.test(value) ? value : null;
}

function formatValue(value: string | number | boolean | null) {
  if (value === null || value === "") {
    return "Missing";
  }

  return String(value);
}

const statusStyles: Record<MergePlanStatus, string> = {
  safe: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

const readinessLabels: Record<MergeReadiness, string> = {
  blocked: "Blocked",
  review_required: "Review required",
  ready: "Ready",
  ready_with_decisions: "Ready to merge with decisions",
};

const compatibilityBlockerReason =
  "Merge requires administrator decisions and cannot use the simple merge path.";

function isDecisionCompatibilityBlocker(item: MergePlanItem) {
  return (
    item.id === "product-conflict-merge-requires-decisions" &&
    item.status === "blocked" &&
    item.subject === "Merge requires administrator decisions" &&
    item.reason === compatibilityBlockerReason
  );
}

function StatusBadge({ status }: { status: MergePlanStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
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

function MergeErrorMessage({ errorCode }: { errorCode: string }) {
  if (errorCode === "unsafe") {
    return (
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        Merge was not completed because the latest server-side preview is no
        longer safe.
      </div>
    );
  }

  if (errorCode === "failed") {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        Merge was not completed. Re-check the preview and try again.
      </div>
    );
  }

  return null;
}

function ProductLevelChecks({ items }: { items: MergePlanItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No product-level conflicts detected.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{item.subject}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-sm text-zinc-600">{item.reason}</p>
        </div>
      ))}
    </div>
  );
}

function OffersTransferPlanTable({ items }: { items: MergePlanItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No candidate offers.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Offer ID</th>
            <th className="py-2 pr-4">Retailer</th>
            <th className="py-2 pr-4">Price</th>
            <th className="py-2 pr-4">Shipping</th>
            <th className="py-2 pr-4">History</th>
            <th className="py-2 pr-4">URL</th>
            <th className="py-2 pr-4">Reason</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-100 align-top">
              <td className="py-3 pr-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="py-3 pr-4 font-medium">{item.offerId}</td>
              <td className="py-3 pr-4">{formatValue(item.retailer || null)}</td>
              <td className="py-3 pr-4">{formatValue(item.price ?? null)}</td>
              <td className="py-3 pr-4">
                {formatValue(item.shippingCost ?? null)}
              </td>
              <td className="py-3 pr-4">{item.priceHistoryCount || 0}</td>
              <td className="break-all py-3 pr-4">
                {formatValue(item.url || null)}
              </td>
              <td className="py-3 pr-4">{item.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetailerProductsTransferPlanTable({
  items,
}: {
  items: MergePlanItem[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No candidate mappings.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Mapping ID</th>
            <th className="py-2 pr-4">Retailer ID</th>
            <th className="py-2 pr-4">External URL</th>
            <th className="py-2 pr-4">External GTIN</th>
            <th className="py-2 pr-4">Reason</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-100 align-top">
              <td className="py-3 pr-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="py-3 pr-4 font-medium">{item.mappingId}</td>
              <td className="py-3 pr-4">{formatValue(item.retailerId ?? null)}</td>
              <td className="break-all py-3 pr-4">
                {formatValue(item.externalUrl || null)}
              </td>
              <td className="py-3 pr-4">
                {formatValue(item.externalGtin || null)}
              </td>
              <td className="py-3 pr-4">{item.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriceHistoryPlanTable({ items }: { items: MergePlanItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No candidate price history.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Offer ID</th>
            <th className="py-2 pr-4">Retailer</th>
            <th className="py-2 pr-4">Records</th>
            <th className="py-2 pr-4">Reason</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-100 align-top">
              <td className="py-3 pr-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="py-3 pr-4 font-medium">{item.offerId}</td>
              <td className="py-3 pr-4">{formatValue(item.retailer || null)}</td>
              <td className="py-3 pr-4">{item.priceHistoryCount || 0}</td>
              <td className="py-3 pr-4">{item.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    canonical?: string | string[];
    candidate?: string | string[];
    merge_error?: string | string[];
  }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const mergeError = firstParam(params.merge_error);
  const canonicalId = parsePositiveBigint(firstParam(params.canonical));
  const candidateId = parsePositiveBigint(firstParam(params.candidate));

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
    console.error("Unable to prepare merge preview.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return (
      <AdminError message="Unable to prepare merge preview." />
    );
  }

  if (!preview) {
    return <AdminError message="Both products must exist to show merge preview." />;
  }

  const hasSafeProductState =
    preview.canonical.product.is_active === true &&
    preview.candidate.product.is_active === true &&
    preview.canonical.product.merged_into_product_id === null &&
    preview.candidate.product.merged_into_product_id === null &&
    preview.canonical.product.merged_at === null &&
    preview.candidate.product.merged_at === null;
  const canMerge =
    preview.mergePlan.summary.blocked === 0 &&
    preview.mergePlan.summary.warning === 0 &&
    hasSafeProductState;
  const hasDecisionConflicts =
    preview.decisionConflicts.offerConflicts.length > 0 ||
    preview.decisionConflicts.retailerProductConflicts.length > 0;
  const hasRealBlockedItem = [
    ...preview.mergePlan.productConflicts,
    ...preview.mergePlan.offers,
    ...preview.mergePlan.retailerProducts,
    ...preview.mergePlan.priceHistory,
  ].some(
    (item) =>
      item.status === "blocked" && !isDecisionCompatibilityBlocker(item)
  );
  const canMergeWithDecisions =
    hasDecisionConflicts &&
    hasSafeProductState &&
    preview.mergePlan.summary.warning === 0 &&
    !hasRealBlockedItem;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-zinc-200 pb-6">
          <Link
            href="/admin/duplicates"
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
          <form action="/admin/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Review this server-side preview before merging. The merge action will
          recalculate safety checks before making changes.
        </div>

        <MergeErrorMessage errorCode={mergeError} />

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

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Merge plan</h2>
              <p className="mt-2 text-sm text-zinc-500">
                This is only a plan. No data will be inserted, updated, deleted,
                or merged from this page.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <p className="font-semibold">
                Final recommendation: {preview.mergePlan.recommendation}
              </p>
              <p className="mt-2 font-semibold">
                Status: {readinessLabels[preview.readiness]}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                  Safe {preview.mergePlan.summary.safe}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                  Warning {preview.mergePlan.summary.warning}
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-700">
                  Blocked {preview.mergePlan.summary.blocked}
                </span>
              </div>
              {canMerge && !hasDecisionConflicts && (
                <div className="mt-4 border-t border-zinc-200 pt-4">
                  <MergeConfirmButton
                    action="/admin/duplicates/merge"
                    canonicalId={String(preview.canonical.product.id)}
                    canonicalName={preview.canonical.product.name}
                    candidateId={String(preview.candidate.product.id)}
                    candidateName={preview.candidate.product.name}
                  />
                </div>
              )}
            </div>
          </div>

          {hasDecisionConflicts && (
            <MergeDecisionsForm
              action="/admin/duplicates/merge"
              canonicalId={String(preview.canonical.product.id)}
              candidateId={String(preview.candidate.product.id)}
              canMergeWithDecisions={canMergeWithDecisions}
              decisionConflicts={preview.decisionConflicts}
            />
          )}

          <div className="mt-6 space-y-8">
            <div>
              <h3 className="text-lg font-bold">Product-level checks</h3>
              <div className="mt-3">
                <ProductLevelChecks
                  items={preview.mergePlan.productConflicts}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold">Offers transfer plan</h3>
              <div className="mt-3">
                <OffersTransferPlanTable items={preview.mergePlan.offers} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold">
                Retailer products transfer plan
              </h3>
              <div className="mt-3">
                <RetailerProductsTransferPlanTable
                  items={preview.mergePlan.retailerProducts}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold">
                Price history preservation plan
              </h3>
              <div className="mt-3">
                <PriceHistoryPlanTable items={preview.mergePlan.priceHistory} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold">Future transaction order</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
                {preview.mergePlan.transactionOrder.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
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
