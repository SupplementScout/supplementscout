import Link from "next/link";
import {
  type CatalogHealthFilters,
  type CatalogHealthIssueType,
  type CatalogHealthReport,
  type IssuePage,
} from "../lib/catalogHealth";

const issueLabels: Record<CatalogHealthIssueType, string> = {
  "zero-offers": "Zero in-stock offers",
  "one-offer": "One in-stock offer",
  "missing-data": "Missing data",
  "stale-offers": "Stale offers",
  categories: "Category quality",
};

const issueDescriptions: Record<CatalogHealthIssueType, string> = {
  "zero-offers": "Active products that cannot currently be compared.",
  "one-offer": "Active products with no retailer competition yet.",
  "missing-data": "Products missing identifiers, media, taxonomy, or verification.",
  "stale-offers": "Offers with no recent price check.",
  categories: "Active category counts and taxonomy flags.",
};

type SummaryTone = "neutral" | "critical" | "attention" | "healthy";
type HeaderCell = { label: string };
type BodyCell = { value: React.ReactNode; className?: string };

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatCurrency(value: number | string | null, missing = "Missing") {
  if (value === null || value === "") {
    return missing;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Invalid";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(number);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function statusStyles(status: CatalogHealthReport["status"]) {
  if (status === "Critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "Needs attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function buildHref(
  filters: CatalogHealthFilters,
  updates: Partial<Record<keyof CatalogHealthFilters, string | number>>
) {
  const params = new URLSearchParams();
  const next = { ...filters, ...updates };

  params.set("issue", String(next.issue));

  if (next.retailer) {
    params.set("retailer", String(next.retailer));
  }

  if (next.category) {
    params.set("category", String(next.category));
  }

  if (next.issue === "stale-offers") {
    params.set("staleAge", String(next.staleAge));
  }

  if (Number(next.page) > 1) {
    params.set("page", String(next.page));
  }

  return `/admin/catalog-health?${params.toString()}`;
}

function AdminNav({ active }: { active: "catalog-health" | "outbound-clicks" | "admin" }) {
  const links = [
    { href: "/admin", label: "Admin", key: "admin" },
    { href: "/admin/outbound-clicks", label: "Outbound clicks", key: "outbound-clicks" },
    { href: "/admin/catalog-health", label: "Catalog health", key: "catalog-health" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            active === link.key
              ? "border-zinc-950 bg-zinc-950 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: SummaryTone;
}) {
  const toneClass =
    tone === "critical"
      ? "text-red-700"
      : tone === "attention"
        ? "text-amber-700"
        : tone === "healthy"
          ? "text-emerald-700"
          : "text-zinc-950";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${toneClass}`}>
        {formatCount(value)}
      </p>
    </div>
  );
}

function FilterBar({ report }: { report: CatalogHealthReport }) {
  const { filters } = report;

  return (
    <form
      action="/admin/catalog-health"
      className="mt-6 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-medium text-zinc-700">
          Issue type
          <select
            name="issue"
            defaultValue={filters.issue}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            {Object.entries(issueLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          Retailer
          <select
            name="retailer"
            defaultValue={filters.retailer}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="">All retailers</option>
            {report.retailers.map((retailer) => (
              <option key={retailer.id} value={retailer.id}>
                {retailer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          Category
          <select
            name="category"
            defaultValue={filters.category}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="">All categories</option>
            {report.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          Stale age
          <select
            name="staleAge"
            defaultValue={filters.staleAge}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
          >
            <option value="7d">Older than 7 days or never</option>
            <option value="30d">Older than 30 days</option>
            <option value="never">Never checked</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-5 py-2 text-sm font-semibold text-white"
        >
          Apply filters
        </button>
        <Link
          href="/admin/catalog-health"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function IssueTabs({ filters }: { filters: CatalogHealthFilters }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {Object.entries(issueLabels).map(([issue, label]) => (
        <Link
          key={issue}
          href={buildHref(filters, { issue, page: 1 })}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            filters.issue === issue
              ? "border-zinc-950 bg-zinc-950 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function Pagination({
  filters,
  page,
  totalPages,
}: {
  filters: CatalogHealthFilters;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-200 p-4 text-sm">
      <span className="text-zinc-600">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={buildHref(filters, { page: Math.max(1, page - 1) })}
          className={`rounded-lg border px-3 py-2 font-semibold ${
            page <= 1
              ? "pointer-events-none border-zinc-200 text-zinc-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950"
          }`}
        >
          Previous
        </Link>
        <Link
          href={buildHref(filters, { page: Math.min(totalPages, page + 1) })}
          className={`rounded-lg border px-3 py-2 font-semibold ${
            page >= totalPages
              ? "pointer-events-none border-zinc-200 text-zinc-300"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-4 py-5 text-zinc-500" colSpan={colSpan}>
        No rows found for this view.
      </td>
    </tr>
  );
}

function IssueTable<T>({
  filters,
  issue,
  page,
  headers,
  rowKey,
  cells,
}: {
  filters: CatalogHealthFilters;
  issue: CatalogHealthIssueType;
  page: IssuePage<T>;
  headers: HeaderCell[];
  rowKey: (row: T) => string;
  cells: (row: T) => BodyCell[];
}) {
  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{issueLabels[issue]}</h2>
            <p className="mt-1 text-sm text-zinc-500">{issueDescriptions[issue]}</p>
          </div>
          <div className="text-sm font-semibold text-zinc-600">
            {formatCount(page.totalRows)} row{page.totalRows === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              {headers.map((header) => (
                <th key={header.label} className="px-4 py-3">
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {page.rows.map((row) => (
              <tr key={rowKey(row)}>
                {cells(row).map((cell, index) => (
                  <td
                    key={`${rowKey(row)}-${index}`}
                    className={cell.className || "px-4 py-3"}
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
            {page.rows.length === 0 && <EmptyRow colSpan={headers.length} />}
          </tbody>
        </table>
      </div>

      <Pagination filters={filters} page={page.page} totalPages={page.totalPages} />
    </section>
  );
}

function IssueSection({ report }: { report: CatalogHealthReport }) {
  const filters = report.filters;

  if (filters.issue === "one-offer") {
    return (
      <IssueTable
        filters={filters}
        issue="one-offer"
        page={report.oneOfferProducts}
        headers={[
          { label: "Product ID" },
          { label: "Product name" },
          { label: "Retailer" },
          { label: "Price" },
          { label: "Shipping" },
          { label: "Total delivered" },
          { label: "Last checked" },
        ]}
        rowKey={(row) => row.id}
        cells={(row) => [
          { value: row.id, className: "px-4 py-3 font-medium" },
          { value: row.name },
          { value: row.retailer },
          { value: formatCurrency(row.price) },
          { value: formatCurrency(row.shipping, "Unknown") },
          {
            value:
              row.totalDeliveredPrice === null
                ? "Unknown"
                : formatCurrency(row.totalDeliveredPrice),
          },
          { value: formatDate(row.lastChecked) },
        ]}
      />
    );
  }

  if (filters.issue === "missing-data") {
    return (
      <IssueTable
        filters={filters}
        issue="missing-data"
        page={report.missingDataProducts}
        headers={[
          { label: "Product ID" },
          { label: "Product name" },
          { label: "Missing GTIN" },
          { label: "Missing image" },
          { label: "Missing brand" },
          { label: "Missing category" },
          { label: "Missing verified data" },
        ]}
        rowKey={(row) => row.id}
        cells={(row) => [
          { value: row.id, className: "px-4 py-3 font-medium" },
          { value: row.name },
          { value: yesNo(row.missingGtin) },
          { value: yesNo(row.missingImage) },
          { value: yesNo(row.missingBrand) },
          { value: yesNo(row.missingCategory) },
          { value: yesNo(row.missingVerifiedUnitOrNutritionData) },
        ]}
      />
    );
  }

  if (filters.issue === "stale-offers") {
    return (
      <IssueTable
        filters={filters}
        issue="stale-offers"
        page={report.staleOffers}
        headers={[
          { label: "Offer ID" },
          { label: "Product" },
          { label: "Retailer" },
          { label: "Price" },
          { label: "In stock" },
          { label: "Last checked" },
          { label: "Age in days" },
        ]}
        rowKey={(row) => row.id}
        cells={(row) => [
          { value: row.id, className: "px-4 py-3 font-medium" },
          { value: row.product },
          { value: row.retailer },
          { value: formatCurrency(row.price) },
          { value: yesNo(row.inStock === true) },
          { value: formatDate(row.lastChecked) },
          { value: row.ageInDays === null ? "Never" : row.ageInDays },
        ]}
      />
    );
  }

  if (filters.issue === "categories") {
    return (
      <IssueTable
        filters={filters}
        issue="categories"
        page={report.categoryQuality}
        headers={[
          { label: "Category" },
          { label: "Active products" },
          { label: "Status" },
        ]}
        rowKey={(row) => row.category}
        cells={(row) => [
          { value: row.category, className: "px-4 py-3 font-medium" },
          { value: formatCount(row.count) },
          {
            value: (
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                  row.flagged
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {row.flagged ? "Needs attention" : "Healthy"}
              </span>
            ),
          },
        ]}
      />
    );
  }

  return (
    <IssueTable
      filters={filters}
      issue="zero-offers"
      page={report.zeroOfferProducts}
      headers={[
        { label: "Product ID" },
        { label: "Product name" },
        { label: "Brand" },
        { label: "Category" },
        { label: "Total offers" },
        { label: "Last offer check" },
        { label: "Public page" },
      ]}
      rowKey={(row) => row.id}
      cells={(row) => [
        { value: row.id, className: "px-4 py-3 font-medium" },
        { value: row.name },
        { value: row.brand || "Missing" },
        { value: row.category || "Missing" },
        { value: formatCount(row.totalOffers) },
        { value: formatDate(row.lastOfferCheck) },
        {
          value: (
            <Link
              href={`/product/${row.slug || row.id}`}
              className="font-medium text-zinc-950 underline underline-offset-4"
            >
              View
            </Link>
          ),
        },
      ]}
    />
  );
}

export function CatalogHealthDashboard({
  report,
  loadError,
}: {
  report: CatalogHealthReport | null;
  loadError: string;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Catalog health
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <AdminNav active="catalog-health" />
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
            {loadError}
          </div>
        )}

        {report && (
          <>
            <div
              className={`mt-6 rounded-lg border p-4 text-sm font-semibold ${statusStyles(
                report.status
              )}`}
            >
              Overall status: {report.status}
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Active unmerged products"
                value={report.summary.activeUnmergedProducts}
                tone="healthy"
              />
              <SummaryCard
                label="Zero in-stock offers"
                value={report.summary.productsWithZeroInStockOffers}
                tone="critical"
              />
              <SummaryCard
                label="Exactly one in-stock offer"
                value={report.summary.productsWithOneInStockOffer}
                tone="attention"
              />
              <SummaryCard
                label="Two or more in-stock offers"
                value={report.summary.productsWithTwoOrMoreInStockOffers}
                tone="healthy"
              />
              <SummaryCard
                label="Missing GTIN"
                value={report.summary.productsMissingGtin}
                tone="attention"
              />
              <SummaryCard
                label="Missing image"
                value={report.summary.productsMissingImage}
                tone="attention"
              />
              <SummaryCard
                label="Missing brand"
                value={report.summary.productsMissingBrand}
                tone="critical"
              />
              <SummaryCard
                label="Missing category"
                value={report.summary.productsMissingCategory}
                tone="critical"
              />
              <SummaryCard
                label="Products with stale offers"
                value={report.summary.productsWithPotentiallyStaleOffers}
                tone="attention"
              />
              <SummaryCard
                label="Retailers with zero in-stock offers"
                value={report.summary.retailersWithZeroInStockOffers}
                tone="attention"
              />
            </section>

            <section className="mt-4 grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Stale: older than 7 days"
                value={report.summary.staleOffersOlderThan7Days}
                tone="attention"
              />
              <SummaryCard
                label="Stale: older than 30 days"
                value={report.summary.staleOffersOlderThan30Days}
                tone="attention"
              />
              <SummaryCard
                label="Stale: never checked"
                value={report.summary.staleOffersNeverChecked}
                tone="critical"
              />
            </section>

            <FilterBar report={report} />
            <IssueTabs filters={report.filters} />
            <IssueSection report={report} />
          </>
        )}
      </div>
    </main>
  );
}
