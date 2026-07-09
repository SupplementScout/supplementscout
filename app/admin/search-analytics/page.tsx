import Link from "next/link";
import { requireAdminPage } from "../../lib/adminAuth";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatAverage(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUtcTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-4 py-5 text-zinc-500" colSpan={colSpan}>
        No rows found for this section.
      </td>
    </tr>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
    >
      {label}
    </Link>
  );
}

function TextCell({ value }: { value: string | number | null }) {
  return <>{value === null || value === "" ? "None" : value}</>;
}

export default async function SearchAnalyticsPage() {
  await requireAdminPage();

  const { loadSearchAnalyticsReport } = await import(
    "../lib/searchAnalyticsReport"
  );

  let report: Awaited<ReturnType<typeof loadSearchAnalyticsReport>> | null = null;
  let loadError = false;

  try {
    report = await loadSearchAnalyticsReport();
  } catch {
    loadError = true;
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
              Search analytics
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <AdminLink href="/admin" label="Admin" />
              <AdminLink href="/admin/outbound-clicks" label="Outbound clicks" />
              <AdminLink href="/admin/catalog-health" label="Catalog health" />
              <AdminLink href="/admin/duplicates" label="Duplicate products" />
            </div>
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

        {loadError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load search analytics report.
          </div>
        )}

        {report && (
          <>
            <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Recent searches</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Created at</th>
                      <th className="px-4 py-3">Query</th>
                      <th className="px-4 py-3">Applied query</th>
                      <th className="px-4 py-3">Corrected query</th>
                      <th className="px-4 py-3">Result count</th>
                      <th className="px-4 py-3">Match status</th>
                      <th className="px-4 py-3">Search mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.recentSearches.length === 0 ? (
                      <EmptyRow colSpan={7} />
                    ) : (
                      report.recentSearches.map((search) => (
                        <tr key={search.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatUtcTime(search.createdAt)} UTC
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {search.query}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <TextCell value={search.appliedQuery} />
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <TextCell value={search.correctedQuery} />
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <TextCell value={search.resultCount} />
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <TextCell value={search.matchStatus} />
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            <TextCell value={search.searchMode} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Zero-result searches</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Query</th>
                      <th className="px-4 py-3">Searches</th>
                      <th className="px-4 py-3">Last searched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.zeroResultSearches.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      report.zeroResultSearches.map((search) => (
                        <tr key={search.query}>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {search.query}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {formatCount(search.searches)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatUtcTime(search.lastSearchedAt)} UTC
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Corrected searches</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Query</th>
                      <th className="px-4 py-3">Corrected query</th>
                      <th className="px-4 py-3">Searches</th>
                      <th className="px-4 py-3">Last searched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.correctedSearches.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      report.correctedSearches.map((search) => (
                        <tr key={`${search.query}-${search.correctedQuery}`}>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {search.query}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {search.correctedQuery}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {formatCount(search.searches)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatUtcTime(search.lastSearchedAt)} UTC
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Top searches</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Query</th>
                      <th className="px-4 py-3">Searches</th>
                      <th className="px-4 py-3">Average result count</th>
                      <th className="px-4 py-3">Last searched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.topSearches.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      report.topSearches.map((search) => (
                        <tr key={search.query}>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {search.query}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {formatCount(search.searches)}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {formatAverage(search.averageResultCount)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatUtcTime(search.lastSearchedAt)} UTC
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
