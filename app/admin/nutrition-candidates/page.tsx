import Link from "next/link";
import { requireAdminPage } from "../../lib/adminAuth";
import type {
  NutritionCandidateBatchItem,
  NutritionCandidateReport,
  NutritionCandidateRow,
  NutritionCandidateStatus,
} from "../lib/nutritionCandidates";
import {
  groupNutritionCandidatesByProduct,
  groupNutritionCandidatesByRun,
} from "../lib/nutritionCandidateRuns";
import { isBulkApprovableNutritionCandidate } from "../lib/nutritionCandidateReview";

export const dynamic = "force-dynamic";

const SECTION_LABELS: Record<NutritionCandidateStatus, string> = {
  pending: "Pending candidates",
  approved: "Approved candidates",
  rejected: "Rejected candidates",
};

const FIELD_UNITS: Record<string, string> = {
  net_weight_g: "g",
  net_volume_ml: "ml",
  serving_count_verified: "count",
  serving_size_g: "g",
  serving_size_ml: "ml",
  protein_per_serving_g: "g",
  creatine_per_serving_g: "g",
};

function BatchWorkItems({
  items,
  report,
}: {
  items: NutritionCandidateBatchItem[];
  report: NutritionCandidateReport;
}) {
  const candidateKeys = new Set(
    Object.values(report).flat().map((candidate) =>
      `${candidate.run_id}:${candidate.product_id}:${candidate.proposed_field}`)
  );
  const fetched = items.filter((item) => item.page_status === "FETCHED").length;
  return (
    <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 md:p-7">
      <div className="border-b border-blue-200 pb-5">
        <h2 className="text-xl font-bold">Batch work items: {items.length} products</h2>
        <p className="mt-2 text-sm text-blue-950">
          {fetched} official pages fetched · {items.length - fetched} unavailable. Entered values create pending candidates only; they still require separate approval.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        {items.map((item, itemIndex) => {
          const openFields = item.missing_fields.filter((field) =>
            !candidateKeys.has(`${item.run_id}:${item.product_id}:${field}`));
          const nextItem = items[itemIndex + 1];
          const returnTarget = nextItem
            ? `nutrition-work-item-${nextItem.id}`
            : "nutrition-candidate-review";
          return (
            <article id={`nutrition-work-item-${item.id}`} key={item.id} className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.brand}</p>
                  <h3 className="mt-1 text-lg font-bold">{item.product_name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">Product ID: {item.product_id}</p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  item.page_status === "FETCHED"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-950"
                }`}>
                  {item.page_status}
                </span>
              </div>
              <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-semibold text-blue-700 underline">
                Official manufacturer page: {item.source_domain}
              </a>
              {item.page_error ? <p className="mt-2 text-xs text-amber-900">{item.page_error}</p> : null}
              {item.manifest_note ? <p className="mt-2 text-xs leading-5 text-zinc-600">{item.manifest_note}</p> : null}
              {openFields.length ? (
                <form action={`/admin/nutrition-candidates/manual?run=${encodeURIComponent(item.run_id)}`} method="post" className="mt-5 border-t border-zinc-200 pt-4">
                  <input type="hidden" name="workItemId" value={item.id} />
                  <input type="hidden" name="runId" value={item.run_id} />
                  <input type="hidden" name="returnTo" value={returnTarget} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {openFields.map((field) => (
                      <label key={field} className="text-sm font-semibold text-zinc-700">
                        {field} ({FIELD_UNITS[field] || "value"})
                        <input
                          name={`value_${field}`}
                          type="number"
                          min={field === "serving_count_verified" ? "1" : "0.000001"}
                          step={field === "serving_count_verified" ? "1" : "any"}
                          className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono font-normal"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="mt-4 block text-sm font-semibold text-zinc-700">
                    Source note (optional)
                    <input name="sourceNote" maxLength={200} className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal" />
                  </label>
                  <button type="submit" className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                    Save entered values as pending candidates
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">Every requested field already has a candidate in this run.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CandidateCard({
  candidate,
  runFilter,
  returnTarget,
}: {
  candidate: NutritionCandidateRow;
  runFilter?: string;
  returnTarget: string;
}) {
  const warnings = candidate.warning_flags.length
    ? candidate.warning_flags.join(", ")
    : "None";
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {candidate.brand}
          </p>
          <h3 className="mt-1 text-lg font-bold">{candidate.product_name}</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Product ID: {candidate.product_id ?? "Needs mapping"}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500">
            Run: {candidate.run_id}
          </p>
        </div>
        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
          {candidate.confidence}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold text-zinc-500">Proposed fact</dt>
          <dd className="mt-1 font-mono text-zinc-950">
            {candidate.proposed_field} = {candidate.proposed_value} {candidate.proposed_unit}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Created</dt>
          <dd className="mt-1">{new Date(candidate.created_at).toLocaleString("en-GB")}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-zinc-500">Evidence</dt>
          <dd className="mt-1 rounded-lg bg-zinc-50 p-3 font-mono text-xs leading-5">
            {candidate.evidence_snippet}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Source</dt>
          <dd className="mt-1 break-all">
            <a
              href={candidate.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-700 underline"
            >
              {candidate.source_domain}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Warnings</dt>
          <dd className="mt-1">{warnings}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-zinc-500">Source locator</dt>
          <dd className="mt-1 break-all font-mono text-xs">{candidate.source_locator}</dd>
        </div>
      </dl>

      {candidate.status === "pending" ? (
        <form
          action={`/admin/nutrition-candidates/review${runFilter ? `?run=${encodeURIComponent(runFilter)}` : ""}`}
          method="post"
          className="mt-5 border-t border-zinc-200 pt-4"
        >
          <input type="hidden" name="id" value={candidate.id} />
          <input type="hidden" name="returnTo" value={returnTarget} />
          <label className="block text-sm font-semibold text-zinc-700">
            Approved value
            <input
              name="approvedValue"
              type="number"
              min="0.000001"
              step="any"
              defaultValue={candidate.proposed_value}
              required
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              This is the exact value used by the approved-plan. Correct the extracted proposal here when needed.
            </span>
          </label>
          <label className="block text-sm font-semibold text-zinc-700">
            Review note (optional)
            <input
              name="reviewNote"
              maxLength={1000}
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              name="status"
              value="approved"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Approve candidate
            </button>
            <button
              type="submit"
              name="status"
              value="rejected"
              formNoValidate
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Reject candidate
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-5 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
          Reviewed {candidate.reviewed_at
            ? new Date(candidate.reviewed_at).toLocaleString("en-GB")
            : "at an unknown time"}
          {candidate.approved_value
            ? ` · approved value ${candidate.approved_value} ${candidate.proposed_unit}`
            : ""}
          {candidate.review_note ? ` — ${candidate.review_note}` : ""}
        </div>
      )}
    </article>
  );
}

function BulkApproveProduct({
  candidates,
  productId,
  runId,
  returnTarget,
}: {
  candidates: NutritionCandidateRow[];
  productId: string | null;
  runId: string;
  returnTarget: string;
}) {
  const safeCandidates = candidates.filter(isBulkApprovableNutritionCandidate);
  if (!productId || safeCandidates.length < 2) return null;
  return (
    <form
      action={`/admin/nutrition-candidates/review-bulk?run=${encodeURIComponent(runId)}`}
      method="post"
      className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="returnTo" value={returnTarget} />
      {safeCandidates.map((candidate) => (
        <input key={candidate.id} type="hidden" name="candidateId" value={candidate.id} />
      ))}
      <p className="text-sm font-semibold text-emerald-950">
        {safeCandidates.length} safe proposed facts can be accepted together.
      </p>
      <p className="mt-1 text-xs leading-5 text-emerald-900">
        This accepts the displayed proposed values only. Conflicts, mismatches and corrected values stay in individual review.
      </p>
      <button
        type="submit"
        className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
      >
        Approve all safe facts for this product
      </button>
    </form>
  );
}

export default async function NutritionCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[]; run?: string | string[] }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const requestedRun = Array.isArray(params.run) ? params.run[0] : params.run;
  const runFilter = requestedRun && /^[A-Za-z0-9._:-]{1,200}$/.test(requestedRun)
    ? requestedRun
    : undefined;

  let report: NutritionCandidateReport | null = null;
  let batchItems: NutritionCandidateBatchItem[] = [];
  try {
    const { getNutritionCandidateBatchItems, getNutritionCandidateReport } = await import(
      "../lib/nutritionCandidates"
    );
    report = await getNutritionCandidateReport(runFilter);
    try {
      batchItems = await getNutritionCandidateBatchItems(runFilter);
    } catch {
      // Batch-item migration may be deploying while candidate review remains available.
    }
  } catch {
    // The migration may not be applied yet. Never expose service-role errors.
  }
  const runGroups = report ? groupNutritionCandidatesByRun(report) : [];

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-zinc-600 underline">
              Back to admin
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Nutrition candidate review
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Review numeric source evidence only. Approval records a review decision and never updates verified product data.
            </p>
          </div>
        </div>

        <form method="get" className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-zinc-700">
            Filter by run ID
            <input
              name="run"
              defaultValue={runFilter}
              maxLength={200}
              pattern="[A-Za-z0-9._:-]+"
              placeholder="NCR1-..."
              className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono font-normal"
            />
          </label>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-bold text-white">
            Filter
          </button>
          {runFilter ? (
            <Link href="/admin/nutrition-candidates" className="px-2 py-2 text-sm font-semibold underline">
              Clear
            </Link>
          ) : null}
        </form>

        {params.saved ? (
          <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            Candidate review saved.
          </p>
        ) : null}

        {report && batchItems.length ? <BatchWorkItems items={batchItems} report={report} /> : null}

        {!report ? (
          <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            Nutrition candidates are unavailable. Confirm that the private migration has been reviewed and applied.
          </p>
        ) : runGroups.length ? (
          <div id="nutrition-candidate-review" className="mt-8 scroll-mt-4 space-y-12">
            {runGroups.map((group, groupIndex) => (
              <section
                key={group.run_id}
                className="rounded-2xl border border-zinc-200 bg-zinc-100/60 p-5 md:p-7"
              >
                <div className="flex flex-col gap-3 border-b border-zinc-300 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-all font-mono text-xl font-bold">{group.run_id}</h2>
                      {!runFilter && groupIndex === 0 ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">
                          Latest batch
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {group.total} candidates · latest record {new Date(group.latest_created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  {!runFilter ? (
                    <Link
                      href={`/admin/nutrition-candidates?run=${encodeURIComponent(group.run_id)}`}
                      className="text-sm font-semibold text-zinc-700 underline"
                    >
                      Review only this batch
                    </Link>
                  ) : null}
                </div>

                {(["pending", "approved", "rejected"] as const).map((status) => (
                  <section key={status} className="mt-8">
                    <div className="flex items-end justify-between border-b border-zinc-200 pb-3">
                      <h3 className="text-xl font-bold">{SECTION_LABELS[status]}</h3>
                      <span className="text-sm font-semibold text-zinc-500">
                        {group.report[status].length}
                      </span>
                    </div>
                    {group.report[status].length ? (
                      <div className="mt-5 space-y-8">
                        {groupNutritionCandidatesByProduct(group.report[status]).map((productGroup, productIndex, productGroups) => {
                          const productAnchor = `nutrition-product-${productGroup.product_id ?? productGroup.candidates[0].id}`;
                          const nextProduct = productGroups[productIndex + 1];
                          const nextProductAnchor = nextProduct
                            ? `nutrition-product-${nextProduct.product_id ?? nextProduct.candidates[0].id}`
                            : "nutrition-candidate-review";
                          const candidateReturnTarget = productGroup.candidates.length === 1
                            ? nextProductAnchor
                            : productAnchor;
                          const bulkReturnTarget = productGroup.candidates.every(isBulkApprovableNutritionCandidate)
                            ? nextProductAnchor
                            : productAnchor;
                          return (
                          <section id={productAnchor} key={productGroup.key} className="scroll-mt-4">
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                              <h4 className="text-base font-bold text-zinc-900">
                                {productGroup.product_name}
                              </h4>
                              <span className="text-xs font-semibold text-zinc-500">
                                Product ID: {productGroup.product_id ?? "Needs mapping"} · {productGroup.candidates.length} facts
                              </span>
                            </div>
                            {status === "pending" ? (
                              <BulkApproveProduct
                                candidates={productGroup.candidates}
                                productId={productGroup.product_id}
                                runId={group.run_id}
                                returnTarget={bulkReturnTarget}
                              />
                            ) : null}
                            <div className="grid gap-4">
                              {productGroup.candidates.map((candidate) => (
                                <CandidateCard
                                  key={candidate.id}
                                  candidate={candidate}
                                  runFilter={group.run_id}
                                  returnTarget={candidateReturnTarget}
                                />
                              ))}
                            </div>
                          </section>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-500">No {status} candidates.</p>
                    )}
                  </section>
                ))}
              </section>
            ))}
          </div>
        ) : !batchItems.length ? (
          <p className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            No nutrition candidates found.
          </p>
        ) : null}
      </div>
    </main>
  );
}
