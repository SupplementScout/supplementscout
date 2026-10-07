import Link from "next/link";
import {
  reviewQueuePageHref,
  type ReviewQueueDisplay,
  type ReviewQueueFilters,
  type ReviewQueueWorkBucket,
  type ReviewQueueWorkSummary,
} from "../lib/automationReviewQueue";

const BUCKETS: Array<{ key: Exclude<ReviewQueueWorkBucket, "ALL">; label: string; description: string; tone: string }> = [
  { key: "DECIDE", label: "Do Twojej decyzji", description: "Sprawdź i zdecyduj", tone: "border-emerald-300 bg-emerald-50 text-emerald-950" },
  { key: "EXECUTE", label: "Zatwierdzone do wykonania", description: "Drugi, zabezpieczony krok", tone: "border-violet-300 bg-violet-50 text-violet-950" },
  { key: "PROCESSING", label: "System teraz wykonuje", description: "Nie musisz nic robić", tone: "border-sky-300 bg-sky-50 text-sky-950" },
  { key: "TECHNICAL", label: "Zostaw technikowi", description: "Nie wymaga Twojej decyzji", tone: "border-amber-300 bg-amber-50 text-amber-950" },
  { key: "COMPLETED", label: "Zakończone", description: "Historia decyzji", tone: "border-zinc-300 bg-zinc-100 text-zinc-950" },
];

function bucketCount(summary: ReviewQueueWorkSummary, bucket: Exclude<ReviewQueueWorkBucket, "ALL">) {
  return summary[bucket.toLocaleLowerCase("en-GB") as "decide" | "execute" | "processing" | "technical" | "completed"];
}

function href(filters: ReviewQueueFilters, changes: Partial<ReviewQueueFilters>) {
  return reviewQueuePageHref({ ...filters, status: "ALL", ...changes }, 1);
}

export function ReviewQueueDashboard({ summary, filters, activeBucket }: { summary: ReviewQueueWorkSummary; filters: ReviewQueueFilters; activeBucket: ReviewQueueWorkBucket }) {
  return <>
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="work-status-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Stan pracy</p><h2 id="work-status-heading" className="mt-1 text-2xl font-bold">Pozostało Ci {summary.ownerRemaining} {summary.ownerRemaining === 1 ? "krok" : "kroków"}</h2><p className="mt-1 text-sm text-zinc-600">Dzisiaj przekazane do wykonania: {summary.submittedToday}. Zakończone decyzje: {summary.completedToday}. Wygaśnięcie dowodu nie liczy się jako Twoja wykonana praca.</p></div>
        <p className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">Łącznie w bieżącej kolejce: {summary.total}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {BUCKETS.map((item) => <Link key={item.key} href={href(filters, { bucket: item.key, display: item.key === "DECIDE" || item.key === "EXECUTE" ? "WORK" : "LIST", query: "", retailer: "" })} className={`rounded-xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow ${item.tone} ${activeBucket === item.key ? "ring-2 ring-zinc-950 ring-offset-2" : ""}`}>
          <span className="block text-3xl font-black">{bucketCount(summary, item.key)}</span><span className="mt-1 block font-bold">{item.label}</span><span className="mt-1 block text-xs opacity-75">{item.description}</span>
        </Link>)}
      </div>
    </section>

    <section className="mt-4 overflow-hidden rounded-xl border bg-white">
      <div className="border-b px-4 py-3"><h2 className="font-bold">Postęp według sprzedawcy</h2><p className="text-sm text-zinc-600">Kliknij sprzedawcę, aby zobaczyć tylko jego pozostałe decyzje.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-50 text-zinc-600"><tr><th className="px-4 py-3">Sprzedawca</th><th className="px-4 py-3">Do decyzji</th><th className="px-4 py-3">Do wykonania</th><th className="px-4 py-3">System</th><th className="px-4 py-3">Techniczne</th><th className="px-4 py-3">Zakończone</th></tr></thead><tbody className="divide-y">{summary.retailers.map((row) => <tr key={row.retailer}><td className="px-4 py-3 font-bold"><Link className="underline decoration-zinc-300 underline-offset-4" href={href(filters, { retailer: row.retailer, bucket: row.decide ? "DECIDE" : row.execute ? "EXECUTE" : "ALL", display: row.decide || row.execute ? "WORK" : "LIST", query: "" })}>{row.retailer}</Link></td><td className="px-4 py-3 font-semibold text-emerald-800">{row.decide}</td><td className="px-4 py-3 font-semibold text-violet-800">{row.execute}</td><td className="px-4 py-3 text-sky-800">{row.processing}</td><td className="px-4 py-3 text-amber-800">{row.technical}</td><td className="px-4 py-3 text-zinc-600">{row.completed}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}

export function ReviewQueueSearch({ filters, retailers }: { filters: ReviewQueueFilters; retailers: string[] }) {
  return <form className="mt-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.45fr)_auto]">
    <input type="hidden" name="queue" value="ALL" /><input type="hidden" name="display" value="LIST" /><input type="hidden" name="status" value="ALL" /><input type="hidden" name="scope" value="ALL" />
    <label className="text-sm font-semibold">Szukaj w bieżącej kolejce<input name="q" defaultValue={filters.query} placeholder="Produkt, sprzedawca, numer oferty lub kolejki" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
    <label className="text-sm font-semibold">Sprzedawca<select name="retailer" defaultValue={filters.retailer} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Wszyscy sprzedawcy</option>{retailers.map((item) => <option key={item}>{item}</option>)}</select></label>
    <button className="self-end rounded-lg bg-zinc-950 px-5 py-2 font-semibold text-white">Szukaj</button>
    <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-3"><input type="checkbox" name="history" value="1" defaultChecked={filters.history} />Pokaż również starsze, zastąpione wersje z historii</label>
  </form>;
}

export function ReviewQueueViewSwitch({ filters, display }: { filters: ReviewQueueFilters; display: ReviewQueueDisplay }) {
  return <div className="flex rounded-lg border bg-white p-1 text-sm font-semibold"><Link href={href(filters, { display: "WORK" })} className={`rounded-md px-3 py-2 ${display === "WORK" ? "bg-zinc-950 text-white" : "text-zinc-700"}`}>Jedna pozycja</Link><Link href={href(filters, { display: "LIST" })} className={`rounded-md px-3 py-2 ${display === "LIST" ? "bg-zinc-950 text-white" : "text-zinc-700"}`}>Lista</Link></div>;
}
