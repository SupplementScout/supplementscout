"use client";

export default function LifecycleHubError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-zinc-900">
        <h1 className="text-2xl font-bold">Current data is temporarily unavailable</h1>
        <p className="mt-3 leading-7 text-zinc-700">
          We could not load a complete current result. Please try again shortly.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
