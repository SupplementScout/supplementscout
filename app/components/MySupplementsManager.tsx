"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ANALYTICS_READY_EVENT, sendAnalyticsEvent, type AnalyticsEventMap } from "../lib/analytics";
import {
  applyMySupplementsImport,
  exportMySupplements,
  mySupplementKey,
  notifyMySupplementsChanged,
  persistMySupplements,
  previewMySupplementsImport,
  readMySupplements,
  removeMySupplement,
  type MySupplementEntry,
  type MySupplementsDocument,
  type MySupplementsImportPreview,
} from "../lib/mySupplements";
import { calculateMySupplementSchedule, calculateRecurringCost } from "../lib/mySupplementsCalculations";

type CurrentSnapshot = {
  key: string;
  productId: string;
  variantId: string;
  exactMatch: boolean;
  canonicalPath: string | null;
  name: string | null;
  brand: string | null;
  packLabel: string | null;
  packAmount: number | null;
  packUnit: MySupplementEntry["dailyUse"]["unit"] | null;
  presentation: "LIVE" | "RECENT" | "OUT_OF_STOCK" | "UNVERIFIED" | "REVIEW";
  currentPrice: {
    productPrice: number;
    shippingCost: number;
    deliveredTotal: number;
    retailerName: string;
    retailerCount: number;
    checkedAt: string;
  } | null;
};

const UNIT_LABELS = { unit: "units", gram: "grams", serving: "servings", pack: "packs" } as const;

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function date(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function itemCountBand(count: number): "0" | "1" | "2_5" | "6_15" | "16_30" {
  if (count === 0) return "0";
  if (count === 1) return "1";
  if (count <= 5) return "2_5";
  if (count <= 15) return "6_15";
  return "16_30";
}

export default function MySupplementsManager() {
  const [document, setDocument] = useState<MySupplementsDocument>({ version: 1, items: [] });
  const [current, setCurrent] = useState<CurrentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [importPreview, setImportPreview] = useState<MySupplementsImportPreview | null>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const viewAnalyticsSent = useRef(false);
  const viewAnalyticsPayload = useRef<AnalyticsEventMap["view_my_supplements"] | null>(null);
  const returnAnalyticsAge = useRef<{ ageMs: number; itemCountBand: "1" | "2_5" | "6_15" | "16_30" } | null>(null);
  const returnAnalyticsSent = useRef(new Set<"return_to_my_supplements" | "return_to_my_supplements_7d" | "return_to_my_supplements_30d">());

  useEffect(() => {
    function sendView() {
      if (!viewAnalyticsSent.current && viewAnalyticsPayload.current) {
        viewAnalyticsSent.current = sendAnalyticsEvent("view_my_supplements", viewAnalyticsPayload.current);
      }
      const returnState = returnAnalyticsAge.current;
      if (!returnState) return;
      const thresholds = [
        ["return_to_my_supplements", 6 * 60 * 60 * 1000],
        ["return_to_my_supplements_7d", 7 * 24 * 60 * 60 * 1000],
        ["return_to_my_supplements_30d", 30 * 24 * 60 * 60 * 1000],
      ] as const;
      for (const [name, minimumAge] of thresholds) {
        if (returnState.ageMs < minimumAge || returnAnalyticsSent.current.has(name)) continue;
        if (sendAnalyticsEvent(name, { item_count_band: returnState.itemCountBand })) {
          returnAnalyticsSent.current.add(name);
        }
      }
    }
    const timer = window.setTimeout(() => {
      const saved = readMySupplements(window.localStorage);
      setDocument(saved);
      const oldestSavedAge = saved.items.reduce((age, item) => {
        const createdAt = Date.parse(item.createdAt);
        return Number.isFinite(createdAt) ? Math.max(age, Date.now() - createdAt) : age;
      }, 0);
      const isReturnVisit = oldestSavedAge > 6 * 60 * 60 * 1000;
      const countBand = itemCountBand(saved.items.length);
      viewAnalyticsPayload.current = {
        item_count_band: countBand,
        reconciliation_state: saved.items.length === 0 ? "empty" : "checking",
        is_return_visit: isReturnVisit,
      };
      returnAnalyticsAge.current = saved.items.length > 0
        ? { ageMs: oldestSavedAge, itemCountBand: countBand as "1" | "2_5" | "6_15" | "16_30" }
        : null;
      sendView();
    }, 0);
    window.addEventListener(ANALYTICS_READY_EVENT, sendView);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(ANALYTICS_READY_EVENT, sendView);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (document.items.length === 0) {
        setCurrent([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch("/api/my-supplements/current", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: document.items.map(({ productId, variantId }) => ({ productId, variantId })) }),
        });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.items)) throw new Error("unavailable");
        if (!cancelled) setCurrent(body.items);
      } catch {
        if (!cancelled) setMessage("Current prices are temporarily unavailable. Your saved list is still safe on this device.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [document.items]);

  const currentByKey = useMemo(() => new Map(current.map((item) => [item.key, item])), [current]);

  function commit(next: MySupplementsDocument) {
    if (!persistMySupplements(window.localStorage, next)) {
      setMessage("We could not save that change on this device.");
      return false;
    }
    setDocument(next);
    notifyMySupplementsChanged();
    setMessage("Saved on this device.");
    return true;
  }

  function update(item: MySupplementEntry, patch: Partial<MySupplementEntry>, field: "remaining" | "daily_use" | "reorder_buffer" | "last_price") {
    const nextItem = { ...item, ...patch, updatedAt: new Date().toISOString() };
    const items = document.items.map((existing) => mySupplementKey(existing) === mySupplementKey(item) ? nextItem : existing);
    if (commit({ version: 1, items })) sendAnalyticsEvent("update_supply_estimate", { calculation_state: field });
  }

  function remove(item: MySupplementEntry) {
    const next = removeMySupplement(document, mySupplementKey(item));
    if (commit(next)) sendAnalyticsEvent("remove_saved_supplement", { product_id: item.productId, source_page: "my_supplements" });
  }

  function downloadExport() {
    const blob = new Blob([exportMySupplements(document)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = href;
    anchor.download = "supplementscout-my-supplements.json";
    anchor.click();
    URL.revokeObjectURL(href);
    setShowExportPreview(false);
    sendAnalyticsEvent("export_my_supplements", { item_count_band: itemCountBand(document.items.length), result: "downloaded" });
  }

  async function readImport(file: File | undefined) {
    if (!file) return;
    if (file.size > 100_000) {
      setMessage("That file is too large.");
      return;
    }
    const preview = previewMySupplementsImport(await file.text(), document);
    setImportPreview(preview);
    setMessage(preview ? "Import checked. Choose merge or replace." : "That file is not a valid SupplementScout export. Nothing was changed.");
    if (importInput.current) importInput.current.value = "";
  }

  function applyImport(mode: "merge" | "replace") {
    if (!importPreview) return;
    const next = applyMySupplementsImport(document, importPreview.document, mode);
    if (!next) {
      setMessage("Merge would exceed the 30-product limit. Nothing was changed.");
      return;
    }
    if (commit(next)) {
      sendAnalyticsEvent("import_my_supplements", { mode, item_count_band: itemCountBand(importPreview.incomingCount), result: "applied" });
      setImportPreview(null);
    }
  }

  async function share() {
    const urls = document.items.map((item) => `${window.location.origin}/product/${item.slug || item.productId}?variant=${encodeURIComponent(item.variantId)}`);
    const text = `Products from my SupplementScout list:\n${urls.join("\n")}`;
    const canUseWebShare = typeof navigator.share === "function";
    try {
      if (canUseWebShare) await navigator.share({ title: "My SupplementScout products", text });
      else await navigator.clipboard.writeText(text);
      sendAnalyticsEvent("share_my_supplements", { item_count_band: itemCountBand(document.items.length) });
      setMessage(canUseWebShare ? "Share window opened." : "Product links copied. Quantities and prices were not included.");
    } catch {
      setMessage("Sharing was cancelled.");
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-800">{document.items.length} of 30 saved</p>
            <p className="mt-1 text-sm text-zinc-600">This list stays in this browser. It is not a medical plan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowExportPreview(true)} disabled={document.items.length === 0} className="min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-bold disabled:opacity-40">Export backup</button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-zinc-300 px-4 text-sm font-bold">
              Import backup
              <input ref={importInput} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => readImport(event.target.files?.[0])} />
            </label>
            <button type="button" onClick={share} disabled={document.items.length === 0} className="min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white disabled:opacity-40">Share product links</button>
          </div>
        </div>
        {showExportPreview && (
          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="font-bold">Export preview</p>
            <p className="mt-1 text-sm text-zinc-700">The file contains {document.items.length} saved products, exact variant IDs, amounts, daily use, dates and prices you entered. It contains no account or health information.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={downloadExport} className="min-h-11 rounded-lg bg-zinc-950 px-4 text-sm font-bold text-white">Download JSON</button>
              <button type="button" onClick={() => setShowExportPreview(false)} className="min-h-11 px-3 text-sm font-bold">Cancel</button>
            </div>
          </div>
        )}
        {importPreview && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-bold">Import preview</p>
            <p className="mt-1 text-sm text-zinc-700">{importPreview.incomingCount} products: {importPreview.newCount} new, {importPreview.replacementCount} already on this device.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => applyImport("merge")} className="min-h-11 rounded-lg bg-zinc-950 px-4 text-sm font-bold text-white">Merge lists</button>
              <button type="button" onClick={() => applyImport("replace")} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 text-sm font-bold text-red-800">Replace my list</button>
              <button type="button" onClick={() => setImportPreview(null)} className="min-h-11 px-3 text-sm font-bold">Cancel</button>
            </div>
          </div>
        )}
        {message && <p role="status" className="mt-4 text-sm font-semibold text-zinc-700">{message}</p>}
      </section>

      {document.items.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <h2 className="text-2xl font-bold">Your list is empty</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-600">Open a product, choose its exact variant, then press “Save to My Supplements”.</p>
          <Link href="/search" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-5 font-bold text-white">Find a supplement</Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-5">
          {document.items.map((item) => {
            const live = currentByKey.get(mySupplementKey(item));
            const schedule = calculateMySupplementSchedule(item);
            const price = item.lastPricePaid ?? live?.currentPrice?.deliveredTotal ?? null;
            const cost = calculateRecurringCost({ packAmount: live?.packAmount ?? null, packUnit: live?.packUnit ?? null, dailyAmount: item.dailyUse.amount, dailyUnit: item.dailyUse.unit, price });
            return (
              <article key={mySupplementKey(item)} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{item.display.brand || "Brand not stated"}</p>
                    <h2 className="mt-1 break-words text-xl font-bold text-zinc-950">{live?.name || item.display.name}</h2>
                    <p className="mt-1 text-sm text-zinc-600">{live?.packLabel || item.display.pack || `Exact variant ${item.variantId}`}</p>
                    {live?.canonicalPath && <Link href={live.canonicalPath} className="mt-3 inline-block text-sm font-bold underline">View exact product</Link>}
                  </div>
                  <button type="button" onClick={() => remove(item)} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-800">Remove</button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase text-zinc-500">Runs out</p><p className="mt-1 font-bold">{schedule ? date(schedule.runOutAt) : "Check amounts"}</p></div>
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase text-zinc-500">Reorder by</p><p className="mt-1 font-bold">{schedule ? date(schedule.reorderAt) : "Check amounts"}</p></div>
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase text-zinc-500">Current delivered price</p><p className="mt-1 font-bold">{live?.currentPrice ? money(live.currentPrice.deliveredTotal) : loading ? "Checking…" : "Not currently verified"}</p>{live?.currentPrice && <p className="mt-1 text-xs text-zinc-600">{live.currentPrice.retailerName}; checked {date(live.currentPrice.checkedAt)}</p>}</div>
                  <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase text-zinc-500">Estimated monthly cost</p><p className="mt-1 font-bold">{cost ? money(cost.monthly) : "Needs verified pack data"}</p>{cost && <p className="mt-1 text-xs text-zinc-600">{money(cost.daily)}/day · {money(cost.yearly)}/year · using {item.lastPricePaid !== null ? "your last price" : "the current delivered price"}</p>}</div>
                </div>

                {item.lastPricePaid !== null && live?.currentPrice && live.currentPrice.deliveredTotal < item.lastPricePaid && (
                  <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">The current exact-variant delivered price is {money(item.lastPricePaid - live.currentPrice.deliveredTotal)} lower than the price you entered.</p>
                )}

                {!live?.exactMatch && !loading && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">We could not confirm this exact saved variant. No current price is shown.</p>}
                <div className="mt-5 grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-semibold">Amount left ({UNIT_LABELS[item.remaining.unit]})<input key={`${item.updatedAt}-remaining`} type="number" min="0" step="any" defaultValue={item.remaining.amount} onBlur={(event) => update(item, { remaining: { ...item.remaining, amount: Number(event.target.value) }, countDate: new Date().toISOString() }, "remaining")} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3" /></label>
                  <label className="text-sm font-semibold">Used each day<input key={`${item.updatedAt}-daily`} type="number" min="0.0001" step="any" defaultValue={item.dailyUse.amount} onBlur={(event) => update(item, { dailyUse: { ...item.dailyUse, amount: Number(event.target.value) } }, "daily_use")} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3" /></label>
                  <label className="text-sm font-semibold">Reorder warning (days)<input key={`${item.updatedAt}-buffer`} type="number" min="0" max="90" step="1" defaultValue={item.reorderBufferDays} onBlur={(event) => update(item, { reorderBufferDays: Number(event.target.value) }, "reorder_buffer")} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3" /></label>
                  <label className="text-sm font-semibold">Last price paid (GBP)<input key={`${item.updatedAt}-price`} type="number" min="0.01" step="0.01" defaultValue={item.lastPricePaid ?? ""} onBlur={(event) => update(item, { lastPricePaid: event.target.value === "" ? null : Number(event.target.value) }, "last_price")} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3" /></label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

