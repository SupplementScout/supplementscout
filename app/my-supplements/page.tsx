import type { Metadata } from "next";
import Link from "next/link";
import MySupplementsManager from "../components/MySupplementsManager";

export const metadata: Metadata = {
  title: "My Supplements",
  description: "Keep a private, local list of supplements and estimate when to reorder.",
  alternates: { canonical: "/my-supplements" },
  robots: { index: false, follow: true },
};

export default function MySupplementsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600"><Link href="/" className="font-semibold underline">SupplementScout</Link> / My Supplements</nav>
        <p className="mt-8 text-sm font-bold uppercase tracking-wide text-emerald-800">Private on this device</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">My Supplements</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">See what you have left, when it may run out, when to reorder and what your routine may cost. No account is required.</p>
        <div className="mt-8"><MySupplementsManager /></div>
      </div>
    </main>
  );
}

