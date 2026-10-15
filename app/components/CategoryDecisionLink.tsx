"use client";

import Link from "next/link";
import { sendAnalyticsEvent, type CategoryDecisionReasonType } from "../lib/analytics";

type SharedProps = {
  href: string;
  children: React.ReactNode;
  className: string;
  category: string;
  productId: string;
  position: number;
};

export function CategoryDecisionProductLink({
  href,
  children,
  className,
  category,
  productId,
  position,
  reasonType,
}: SharedProps & { reasonType: CategoryDecisionReasonType }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        sendAnalyticsEvent("select_category_decision_answer", {
          category,
          product_id: productId,
          reason_type: reasonType,
          position,
        })
      }
    >
      {children}
    </Link>
  );
}

export function CategoryDecisionCompareLink({
  href,
  children,
  className,
  category,
  productId,
  position,
}: SharedProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        sendAnalyticsEvent("add_product_to_comparison", {
          product_id: productId,
          category,
          source_page: "category_decision_answers",
          position,
        })
      }
    >
      {children}
    </Link>
  );
}
