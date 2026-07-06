import Link from "next/link";
import { requireAdminPage } from "../../lib/adminAuth";
import { normalizeOutboundClickReportPeriod } from "../lib/outboundClicksReportPeriods";

export const dynamic = "force-dynamic";

type SearchParams = {
  period?: string | string[];
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatUtcTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function shortUrl(value: string) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}`;
    const trimmedPath = path.length > 42 ? `${path.slice(0, 39)}...` : path;

    return `${url.hostname}${trimmedPath}`;
  } catch {
    return value.length > 64 ? `${value.slice(0, 61)}...` : value;
  }
}

function isExternalHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function PeriodLink({
  period,
  activePeriod,
  label,
}: {
  period: "7d" | "30d" | "all";
  activePeriod: "7d" | "30d" | "all";
  label: string;
}) {
  const active = period === activePeriod;

  return (
    <Link
      href={`/admin/outbound-clicks?period=${period}`}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-zinc-950 bg-zinc-950 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
      }`}
    >
      {label}
    </Link>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
        {formatCount(value)}
      </p>
    </div>
  );
}

export default async function OutboundClicksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const period = normalizeOutboundClickReportPeriod(params.period);
  const { loadOutboundClicksReport } = await import("../lib/outboundClicksReport");

  let report: Awaited<ReturnType<typeof loadOutboundClicksReport>> | null = null;
  let loadError = false;

  try {
    report = await loadOutboundClicksReport({ period });
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
              Outbound clicks
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/duplicates"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
            >
              Duplicate products
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

        <div className="mt-6 flex flex-wrap gap-2">
          <PeriodLink period="7d" activePeriod={period} label="7 days" />
          <PeriodLink period="30d" activePeriod={period} label="30 days" />
          <PeriodLink period="all" activePeriod={period} label="All time" />
        </div>

        {loadError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load outbound click report.
          </div>
        )}

        {report && (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-4">
              <SummaryCard label="Clicks today" value={report.summary.today} />
              <SummaryCard
                label="Clicks last 7 days"
                value={report.summary.last7Days}
              />
              <SummaryCard
                label="Clicks last 30 days"
                value={report.summary.last30Days}
              />
              <SummaryCard label="Total clicks" value={report.summary.total} />
            </section>

            <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Recent clicks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Retailer</th>
                      <th className="px-4 py-3">Offer ID</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Destination</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {report.recentClicks.length === 0 ? (
                      <tr>
                        <td className="px-4 py-5 text-zinc-500" colSpan={6}>
                          No outbound clicks found for this period.
                        </td>
                      </tr>
                    ) : (
                      report.recentClicks.map((click) => (
                        <tr
                          key={`${click.createdAt}-${click.offerId || "missing"}-${click.destinationUrl}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatUtcTime(click.createdAt)} UTC
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {click.productName}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {click.retailerName}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {click.offerId || "Deleted offer"}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {click.sourcePage}
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            {isExternalHttpUrl(click.destinationUrl) ? (
                              <a
                                href={click.destinationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all font-medium text-zinc-950 underline underline-offset-4"
                              >
                                {shortUrl(click.destinationUrl)}
                              </a>
                            ) : (
                              <span className="break-all text-zinc-500">
                                {shortUrl(click.destinationUrl)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 p-5">
                  <h2 className="text-xl font-bold">Top products</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Product ID</th>
                        <th className="px-4 py-3">Clicks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {report.topProducts.map((product) => (
                        <tr key={product.id || "deleted-product"}>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {product.id || "Deleted product"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {formatCount(product.clicks)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 p-5">
                  <h2 className="text-xl font-bold">Top retailers</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Retailer</th>
                        <th className="px-4 py-3">Retailer ID</th>
                        <th className="px-4 py-3">Clicks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {report.topRetailers.map((retailer) => (
                        <tr key={retailer.id || "deleted-retailer"}>
                          <td className="px-4 py-3 font-medium text-zinc-950">
                            {retailer.name}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {retailer.id || "Deleted retailer"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {formatCount(retailer.clicks)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="mt-8 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-bold">Clicks by source</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-950">
                        product_best_offer
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCount(report.sourceCounts.product_best_offer)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-zinc-950">
                        product_offer_list
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCount(report.sourceCounts.product_offer_list)}
                      </td>
                    </tr>
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
