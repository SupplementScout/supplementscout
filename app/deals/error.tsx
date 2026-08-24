"use client";

import Link from "next/link";

export default function DealsError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-16 text-zinc-950 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Temporary data problem</p>
        <h1 className="mt-3 text-3xl font-bold">Current prices are temporarily unavailable</h1>
        <p className="mt-4 leading-7 text-zinc-700">
          We have not substituted old, partial or uncertain prices. Please try again shortly.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-semibold">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
