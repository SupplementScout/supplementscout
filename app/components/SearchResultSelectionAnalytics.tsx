"use client";

import type { MouseEvent, ReactNode } from "react";
import { sendAnalyticsEvent } from "../lib/analytics";

export default function SearchResultSelectionAnalytics({
  children,
  productId,
  position,
}: {
  children: ReactNode;
  productId: string;
  position: number;
}) {
  function recordProductSelection(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a");
    if (!link?.getAttribute("href")?.startsWith("/product/")) return;

    sendAnalyticsEvent("select_search_result", {
      product_id: productId,
      position,
    });
  }

  return <div onClickCapture={recordProductSelection}>{children}</div>;
}
