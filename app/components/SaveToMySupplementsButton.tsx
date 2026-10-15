"use client";

import { useMemo, useState } from "react";
import { sendAnalyticsEvent } from "../lib/analytics";
import {
  notifyMySupplementsChanged,
  persistMySupplements,
  readMySupplements,
  upsertMySupplement,
  type MySupplementEntry,
  type MySupplementUnit,
} from "../lib/mySupplements";

type SaveProduct = {
  productId: string;
  slug: string | null;
  variantId: string;
  name: string;
  brand: string | null;
  category: string | null;
  pack: string | null;
  packAmount: number;
  packUnit: MySupplementUnit;
};

const UNIT_LABELS: Record<MySupplementUnit, string> = {
  unit: "units",
  gram: "grams",
  serving: "servings",
  pack: "packs",
};

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export default function SaveToMySupplementsButton({ product }: { product: SaveProduct }) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(String(product.packAmount));
  const [dailyUse, setDailyUse] = useState(product.packUnit === "pack" ? "0.033" : "1");
  const [countDate, setCountDate] = useState(today());
  const [lastPrice, setLastPrice] = useState("");
  const [message, setMessage] = useState("");
  const unitLabel = useMemo(() => UNIT_LABELS[product.packUnit], [product.packUnit]);

  function save() {
    const remainingAmount = Number(remaining);
    const dailyAmount = Number(dailyUse);
    const price = lastPrice.trim() === "" ? null : Number(lastPrice);
    const countDateTime = Date.parse(`${countDate}T12:00:00.000Z`);
    if (!Number.isFinite(remainingAmount) || remainingAmount < 0 || !Number.isFinite(dailyAmount) || dailyAmount <= 0 || !Number.isFinite(countDateTime) || (price !== null && (!Number.isFinite(price) || price <= 0))) {
      setMessage("Please check the amounts and price.");
      return;
    }

    const now = new Date().toISOString();
    const entry: MySupplementEntry = {
      productId: product.productId,
      slug: product.slug,
      variantId: product.variantId,
      display: { name: product.name, brand: product.brand, pack: product.pack },
      remaining: { amount: remainingAmount, unit: product.packUnit },
      dailyUse: { amount: dailyAmount, unit: product.packUnit },
      countDate: new Date(countDateTime).toISOString(),
      reorderBufferDays: 3,
      lastPricePaid: price,
      currency: "GBP",
      createdAt: now,
      updatedAt: now,
    };
    const current = readMySupplements(window.localStorage);
    const next = upsertMySupplement(current, entry);
    if (!persistMySupplements(window.localStorage, next)) {
      setMessage("We could not save this on this device.");
      return;
    }
    notifyMySupplementsChanged();
    sendAnalyticsEvent("save_supplement", {
      product_id: product.productId,
      ...(product.category ? { category: product.category } : {}),
      entry_point: "product",
    });
    setMessage("Saved on this device.");
    setOpen(false);
  }

  return (
    <section id="save-to-my-supplements" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-zinc-950">Keep track of this supplement</h2>
          <p className="mt-1 text-sm text-zinc-700">Saved only in this browser. No account needed.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-900">
          {open ? "Cancel" : "Save to My Supplements"}
        </button>
      </div>
      {open && (
        <div className="mt-4 grid gap-4 border-t border-emerald-200 pt-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-zinc-800">
            Amount left ({unitLabel})
            <input type="number" min="0" step="any" value={remaining} onChange={(event) => setRemaining(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3" />
          </label>
          <label className="text-sm font-semibold text-zinc-800">
            Used each day ({unitLabel})
            <input type="number" min="0.0001" step="any" value={dailyUse} onChange={(event) => setDailyUse(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3" />
          </label>
          <label className="text-sm font-semibold text-zinc-800">
            Counted on
            <input type="date" value={countDate} onChange={(event) => setCountDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3" />
          </label>
          <label className="text-sm font-semibold text-zinc-800">
            Last price paid (optional, GBP)
            <input type="number" min="0.01" step="0.01" value={lastPrice} onChange={(event) => setLastPrice(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3" />
          </label>
          <button type="button" onClick={save} className="min-h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800 sm:col-span-2">Save</button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm font-semibold text-zinc-800">{message}</p>}
    </section>
  );
}

