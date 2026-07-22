"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  googleConsentUpdate,
  isAnalyticsAvailable,
  persistAnalyticsConsent,
  readAnalyticsConsent,
  shouldTrackRoute,
  type AnalyticsConsentPreference,
} from "../lib/analyticsConsent";
import { ANALYTICS_READY_EVENT, flushAnalyticsQueue, sendAnalyticsEvent } from "../lib/analytics";

const CATEGORY_BY_PATH: Record<string, string> = {
  "/creatine": "Creatine",
  "/glucosamine": "Glucosamine",
  "/hydration": "Hydration",
  "/magnesium": "Magnesium",
  "/omega-3": "Omega 3",
  "/vitamin-d": "Vitamin D",
  "/vitamins": "Vitamins",
};

function clearAnalyticsCookies(measurementId: string) {
  const cookieNames = ["_ga", `_ga_${measurementId.replace(/^G-/, "").replace(/-/g, "_")}`];
  const domains = ["", "; domain=.supplementscout.co.uk"];

  for (const name of cookieNames) {
    for (const domain of domains) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domain}`;
    }
  }
}

function applyGoogleConsent(preference: AnalyticsConsentPreference) {
  window.dataLayer ||= [];
  window.gtag ||= function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.__supplementScoutAnalyticsConsent = preference === "accepted" ? "granted" : "denied";
  window.gtag("consent", "update", googleConsentUpdate(preference));
}

function RouteAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPageView = useRef<string | null>(null);
  const lastCategoryView = useRef<string | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (!window.gtag || !shouldTrackRoute(lastPageView.current, routeKey, enabled)) return;

    lastPageView.current = routeKey;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
    });

    const category = CATEGORY_BY_PATH[pathname];
    if (category && lastCategoryView.current !== pathname) {
      lastCategoryView.current = pathname;
      sendAnalyticsEvent("view_category", { category, source_page: pathname });
    }
  }, [enabled, pathname, routeKey]);

  return null;
}

export default function AnalyticsConsent({
  measurementId,
  enabled,
}: {
  measurementId: string;
  enabled: boolean;
}) {
  const analyticsAvailable = isAnalyticsAvailable(enabled, measurementId);
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<AnalyticsConsentPreference | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [analyticsSelected, setAnalyticsSelected] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readAnalyticsConsent(window.localStorage);
      setPreference(stored);
      setAnalyticsSelected(stored === "accepted");
      setMounted(true);

      if (stored) applyGoogleConsent(stored);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function savePreference(nextPreference: AnalyticsConsentPreference) {
    persistAnalyticsConsent(window.localStorage, nextPreference);
    applyGoogleConsent(nextPreference);
    setPreference(nextPreference);
    setAnalyticsSelected(nextPreference === "accepted");
    setManageOpen(false);

    if (nextPreference === "rejected") {
      window.__supplementScoutAnalyticsReady = false;
      window.__supplementScoutAnalyticsQueue = [];
      setAnalyticsReady(false);
      clearAnalyticsCookies(measurementId);
    }
  }

  function initialiseAnalytics() {
    if (!analyticsAvailable || preference !== "accepted" || window.__supplementScoutAnalyticsReady) return;

    applyGoogleConsent("accepted");
    window.gtag?.("js", new Date());
    window.gtag?.("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    window.__supplementScoutAnalyticsReady = true;
    flushAnalyticsQueue();
    setAnalyticsReady(true);
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  }

  const showInitialChoice = analyticsAvailable && mounted && preference === null && !manageOpen;

  return (
    <>
      {analyticsAvailable && preference === "accepted" && (
        <Script
          id="supplementscout-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={initialiseAnalytics}
          onReady={initialiseAnalytics}
        />
      )}

      <Suspense fallback={null}>
        <RouteAnalytics enabled={analyticsAvailable && preference === "accepted" && analyticsReady} />
      </Suspense>

      {showInitialChoice && (
        <section role="dialog" aria-label="Cookie choices" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-zinc-300 bg-white p-5 text-zinc-950 shadow-2xl sm:inset-x-6 sm:p-6">
          <h2 className="text-lg font-bold">Your cookie choices</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-700">We use strictly necessary storage for your cookie choice. With your permission, Google Analytics helps us understand which comparison pages and retailer offers are useful. Advertising storage stays disabled.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => savePreference("accepted")} className="min-h-11 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Accept all</button>
            <button type="button" onClick={() => savePreference("rejected")} className="min-h-11 rounded-xl border border-zinc-400 px-4 py-2 text-sm font-semibold">Reject non-essential</button>
            <button type="button" onClick={() => setManageOpen(true)} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold underline">Manage preferences</button>
          </div>
        </section>
      )}

      {analyticsAvailable && mounted && manageOpen && (
        <section role="dialog" aria-modal="true" aria-label="Cookie preferences" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 text-zinc-950 shadow-2xl sm:p-6">
            <h2 className="text-xl font-bold">Cookie preferences</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-700">Strictly necessary storage is always active so we can remember this choice. Analytics is optional and can be withdrawn at any time.</p>
            <label className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-zinc-300 p-4">
              <span><span className="block font-semibold">Google Analytics</span><span className="mt-1 block text-sm text-zinc-600">Measure page usage and non-personal comparison interactions.</span></span>
              <input type="checkbox" checked={analyticsSelected} onChange={(event) => setAnalyticsSelected(event.target.checked)} className="mt-1 h-5 w-5" />
            </label>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => savePreference(analyticsSelected ? "accepted" : "rejected")} className="min-h-11 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Save preferences</button>
              <button type="button" onClick={() => setManageOpen(false)} className="min-h-11 rounded-xl border border-zinc-400 px-4 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </section>
      )}

      {analyticsAvailable && mounted && !showInitialChoice && !manageOpen && (
        <button type="button" onClick={() => setManageOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-lg">Cookie settings</button>
      )}

      <span className="sr-only" data-consent-storage-key={ANALYTICS_CONSENT_STORAGE_KEY} />
    </>
  );
}
