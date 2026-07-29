"use client";

import { useEffect, useRef } from "react";
import {
  ANALYTICS_READY_EVENT,
  sendAnalyticsEvent,
} from "../lib/analytics";

export default function CategoryViewAnalytics({
  category,
  sourcePage,
}: {
  category: string;
  sourcePage: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    function send() {
      if (sent.current) return;
      sent.current = sendAnalyticsEvent("view_category", {
        category,
        source_page: sourcePage,
      });
    }

    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [category, sourcePage]);

  return null;
}
