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
            href="/admin/duplicates"
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-950"
          >
            <h2 className="text-xl font-bold">Duplicate products</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Review potential duplicate product records.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
