"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ANALYTICS_READY_EVENT, sendAnalyticsEvent, type AnalyticsEventMap } from "../lib/analytics";

export type ProductAnalyticsContext = {
  product_id: string;
  product_name: string;
  category?: string;
};

export function ProductViewAnalytics({
  product,
  variantId,
}: {
  product: ProductAnalyticsContext;
  variantId?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    function send() {
      if (sent.current) return;
      sent.current = sendAnalyticsEvent("view_product", {
        ...product,
        ...(variantId ? { variant_id: variantId } : {}),
      });
    }

    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [product, variantId]);

  return null;
}

export function RetailerOfferLink({
  href,
  event,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEventMap["retailer_offer_click"];
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className={className}
      onClick={() => {
        try {
          sendAnalyticsEvent("retailer_offer_click", event);
        } catch {
          // The existing /go redirect must always continue even if analytics fails.
        }
      }}
    >
      {children}
    </a>
  );
}
