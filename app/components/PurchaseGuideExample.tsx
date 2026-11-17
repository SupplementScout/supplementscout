import type { ReactNode } from "react";
import Link from "next/link";
import { GuidePriceBreakdown } from "./BuyingGuide";
import type { PurchaseGuideExample as Example } from "../lib/purchaseDecisionGuides";
import { formatCurrency } from "../lib/pricing";

export default function PurchaseGuideExample({ example, children, headingLevel = "h3" }: {
  example: Example; children?: ReactNode; headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;
  return <li className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
    <Heading className="text-xl font-bold text-zinc-950"><Link href={example.productUrl} className="underline">{example.label} ({example.packLabel})</Link></Heading>
    <p className="mt-2 text-sm">{example.kind}. Variant: {example.variantLabel}. One exact {example.packLabel} pack.</p>
    <p className="mt-4 font-semibold">{example.offer.retailer.name}</p>
    <GuidePriceBreakdown offer={example.offer} />
    {example.row.unitPricingVerified && example.row.pricePerKg !== null ?
      <p className="mt-4 text-sm">Delivered powder cost: <strong>{formatCurrency(example.row.pricePerKg)}/kg</strong>.</p> :
      <p className="mt-4 text-sm">A verified powder-weight unit price is not available for this exact pack.</p>}
    {children}
  </li>;
}
