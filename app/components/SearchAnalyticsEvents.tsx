"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_READY_EVENT, sendAnalyticsEvent } from "../lib/analytics";

export default function SearchAnalyticsEvents({
  resultCount,
  hasFilters,
}: {
  resultCount: number;
  hasFilters: boolean;
}) {
  const sent = useRef(false);

  useEffect(() => {
    function send() {
      if (sent.current) return;
      const searchSent = sendAnalyticsEvent("search", {
        result_count: resultCount,
        has_filters: hasFilters,
        search_context: "site_search",
      });
      if (!searchSent) return;

      if (resultCount === 0) {
        sendAnalyticsEvent("no_results", {
          result_count: 0,
          has_filters: hasFilters,
          source_page: "search",
        });
      }
      sent.current = true;
    }

    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [hasFilters, resultCount]);

  return null;
}
