"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_READY_EVENT, sendAnalyticsEvent } from "../lib/analytics";

export default function ComparisonCompletionAnalytics({
  leftProductId,
  rightProductId,
}: {
  leftProductId: string;
  rightProductId: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    function send() {
      if (sent.current) return;
      sent.current = sendAnalyticsEvent("complete_two_product_comparison", {
        left_product_id: leftProductId,
        right_product_id: rightProductId,
        source_page: "two_product_comparison",
      });
    }

    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [leftProductId, rightProductId]);

  return null;
}
