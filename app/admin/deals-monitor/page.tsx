import Link from "next/link";
import { requireAdminPage } from "../../lib/adminAuth";
import {
  emptyPriceDropCandidateInventory,
  isPriceDropCandidateMonitorEnabled,
  loadPriceDropCandidateInventory,
} from "../../lib/dealsPriceIntelligence";
import { formatCurrency } from "../../lib/pricing";

export const dynamic = "force-dynamic";

function formatCapturedAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function DealsMonitorPage() {
  await requireAdminPage();
  const enabled = isPriceDropCandidateMonitorEnabled();
  const inventory = enabled
    ? await loadPriceDropCandidateInventory()
    : emptyPriceDropCandidateInventory(false);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">SEO-15 · read only</p>
            <h1 className="mt-2 text-3xl font-bold">Deals candidate monitor</h1>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600">
              This monitor uses the same verified price history as the public Deals page. It cannot change offers, product identities or retailer automation.
            </p>
          </div>
          <Link href="/admin" className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold hover:border-zinc-950">
            Back to admin
          </Link>
        </div>

        {!enabled && (
          <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Monitor prepared but not activated</h2>
            <p className="mt-2 leading-7 text-zinc-700">
              The database inventory must pass staging and production read-only controls before this monitor is enabled. The public price-drop section remains off.
            </p>
          </section>
        )}

        {enabled && inventory.error && (
          <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-6">
            <h2 className="text-xl font-bold">Candidate inventory is unavailable</h2>
            <p className="mt-2 leading-7 text-zinc-700">No result is being treated as zero. Check the read-only database boundary before taking any release decision.</p>
          </section>
        )}

        {enabled && inventory.available && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-sm font-semibold text-zinc-500">All verified candidates</p>
                <p className="mt-2 text-4xl font-bold">{inventory.candidateCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-800">Automatic public candidates</p>
                <p className="mt-2 text-4xl font-bold">{inventory.releasedCandidateCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-800">Waiting for retailer approval</p>
                <p className="mt-2 text-4xl font-bold">{inventory.awaitingRetailerApprovalCount}</p>
              </div>
            </section>

            <p className="mt-4 text-sm text-zinc-500">Read at {formatCapturedAt(inventory.capturedAt)}. The monitor stores nothing and performs zero database writes.</p>

            <section className="mt-6 space-y-4">
              {inventory.candidates.length === 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6">
                  <h2 className="text-xl font-bold">No offer qualifies right now</h2>
                  <p className="mt-2 text-zinc-600">The daily evidence collection continues. A genuine qualifying drop will appear here automatically.</p>
                </div>
              )}
              {inventory.candidates.map((candidate) => (
                <article key={candidate.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-500">{candidate.offer.retailer.name} · offer {candidate.offer.id}</p>
                      <h2 className="mt-1 text-xl font-bold">{candidate.name}</h2>
                      <p className="mt-1 text-sm text-zinc-600">{candidate.packLabel} · scope {candidate.approvedScope}</p>
                    </div>
                    <div className="lg:text-right">
                      <p className="font-semibold">{formatCurrency(candidate.previousDeliveredPrice)} → {formatCurrency(candidate.currentDeliveredPrice)}</p>
                      <p className="mt-1 text-sm text-emerald-800">{formatCurrency(candidate.savingAmount)} lower · {candidate.savingPercent}%</p>
                      <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${candidate.releaseEnabled ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                        {candidate.releaseEnabled ? "Automatic after public activation" : "Retailer approval required"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
