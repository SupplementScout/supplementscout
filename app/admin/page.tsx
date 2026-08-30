import Link from "next/link";
import { requireAdminPage } from "../lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              SupplementScout admin
            </h1>
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

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/catalog-health"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Catalog health</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Review catalog, offer, stale-price, and taxonomy quality before imports.
            </p>
          </Link>
          <Link
            href="/admin/outbound-clicks"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Outbound clicks</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Review tracked retailer click activity.
            </p>
          </Link>
          <Link
            href="/admin/search-analytics"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Search analytics</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Review recent searches, zero-result terms, corrections, and top queries.
            </p>
          </Link>
          <Link
            href="/admin/duplicates"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Product matching review</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Review product identity evidence, defer uncertain pairs, and
              block unsafe merges.
            </p>
          </Link>
          <Link
            href="/admin/product-matching"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">
              New retailer product decisions
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Decide whether a retailer row uses an existing product, creates a
              new product, waits, or is excluded.
            </p>
          </Link>
          <Link
            href="/admin/nutrition-candidates"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Nutrition candidate review</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Approve or reject numeric source evidence without updating
              verified product data.
            </p>
          </Link>
          <Link href="/admin/automation-review" className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950">
            <h2 className="text-xl font-bold">Automation Review Queue</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Review isolated identity, commercial, mapping and source failures without direct catalogue writes.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
