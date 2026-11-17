import type { ReactNode } from "react";
import Link from "next/link";
import { GuidePriceBreakdown } from "./BuyingGuide";
import type { BudgetPurchaseExample } from "../lib/budgetPurchaseGuides";

export default function BudgetGuideExample({ example, children }: { example: BudgetPurchaseExample; children: ReactNode }) {
  return <li className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
    <h3 className="text-xl font-bold leading-7 text-zinc-950"><Link href={example.productUrl} className="underline">{example.label}</Link></h3>
    <p className="mt-2 text-sm">Brand: {example.row.brand}. Variant: {example.variantLabel}. One exact {example.packLabel} pack.</p>
    <p className="mt-4 font-semibold">{example.offer.retailer.name}</p>
    <GuidePriceBreakdown offer={example.offer} />
    {children}
  </li>;
}
