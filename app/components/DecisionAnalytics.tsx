"use client";

import Link from "next/link";
import { useEffect } from "react";
import { sendAnalyticsEvent } from "../lib/analytics";
import type {
  DecisionPriority,
  DecisionReasonType,
  DecisionStatus,
} from "../lib/decisionEngine";

export function DecisionViewAnalytics({
  status,
  priority,
  resultCount,
  reasonType,
  clarificationChoiceCount,
}: {
  status: DecisionStatus | null;
  priority: DecisionPriority | null;
  resultCount: number;
  reasonType: DecisionReasonType | null;
  clarificationChoiceCount: number;
}) {
  useEffect(() => {
    sendAnalyticsEvent("help_me_choose_started", {
      entry_point: "help_me_choose",
    });
  }, []);

  useEffect(() => {
    if (status === "ANSWERED" && priority && reasonType) {
      sendAnalyticsEvent("decision_results_viewed", {
        status,
        priority,
        result_count: resultCount,
        reason_type: reasonType,
      });
    }
    if (status === "NEEDS_CLARIFICATION") {
      sendAnalyticsEvent("decision_clarification_shown", {
        status,
        choice_count: clarificationChoiceCount,
      });
    }
  }, [clarificationChoiceCount, priority, reasonType, resultCount, status]);

  return null;
}
export function DecisionPriorityLink({
  href,
  priority,
  children,
}: {
  href: string;
  priority: DecisionPriority;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={() =>
        sendAnalyticsEvent("decision_priority_selected", { priority })
      }
      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--ss-border-strong)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--ss-ink)] transition-colors hover:border-[var(--ss-accent)] hover:text-[var(--ss-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
    >
      {children}
    </a>
  );
}
export function DecisionProductLink({
  href,
  productId,
  variantId,
  priority,
  position,
  children,
}: {
  href: string;
  productId: string;
  variantId: string;
  priority: DecisionPriority;
  position: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        sendAnalyticsEvent("decision_product_opened", {
          product_id: productId,
          variant_id: variantId,
          priority,
          position,
        })
      }
      className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ss-ink)] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--ss-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
    >
      {children}
    </Link>
  );
}
