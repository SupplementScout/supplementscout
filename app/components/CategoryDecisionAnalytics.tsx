"use client";

import { useEffect, useRef } from "react";
import {
  ANALYTICS_READY_EVENT,
  sendAnalyticsEvent,
  type CategoryDecisionReasonType,
} from "../lib/analytics";

export function CategoryDecisionViewAnalytics({
  category,
  answerCount,
  reasonTypes,
}: {
  category: string;
  answerCount: number;
  reasonTypes: CategoryDecisionReasonType[];
}) {
  const sent = useRef(false);
  const serializedReasons = reasonTypes.join("|");

  useEffect(() => {
    function send() {
      if (sent.current) return;
      sent.current = sendAnalyticsEvent("view_category_decision_answers", {
        category,
        answer_count: answerCount,
        reason_types: serializedReasons,
      });
    }

    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [answerCount, category, serializedReasons]);

  return null;
}
