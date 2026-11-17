import Link from "next/link";
import type { ReactNode } from "react";
import { GuidePriceBreakdown } from "./BuyingGuide";
import { formatCurrency } from "../lib/pricing";
import { hasProteinValue, type ProteinValueExample } from "../lib/proteinValueGuides";

export function ProteinGuideNutrition({ example, pairIncomplete = false }: { example: ProteinValueExample; pairIncomplete?: boolean }) {
  if (pairIncomplete) return <p>Cost per 25 g protein is withheld for this size comparison: both exact packs need approved nutrition. A verified record for the larger pack is not copied into the smaller one.</p>;
  if (!hasProteinValue(example)) return <p>Protein per serving, verified servings and cost per 25 g are not yet supported by approved nutrition for this exact variant. The recorded pack price remains usable; we do not fill the nutrition gap from another flavour or pack.</p>;
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
    <dt>Protein per serving</dt><dd>{example.row.proteinPerServingG} g</dd>
    <dt>Verified servings</dt><dd>{example.row.verifiedServingCount}</dd>
    <dt>Cost per 25 g protein</dt><dd className="font-bold">{formatCurrency(example.row.costPer25gProtein!)}</dd>
  </dl>;
}

export default function ProteinGuideExample({ example, children }: { example: ProteinValueExample; children: ReactNode }) {
  return <li className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
    <h3 className="text-xl font-bold text-zinc-950"><Link href={example.productUrl} className="underline">{example.label}</Link></h3>
    <p className="mt-2 text-sm">{example.proteinType}. Variant: {example.variantLabel}. Exact pack: {example.packLabel}, one pack.</p>
    <p className="mt-4 font-semibold">{example.offer.retailer.name}</p>
    <GuidePriceBreakdown offer={example.offer} />
    {example.row.pricePerKg !== null && <p className="mt-4 text-sm">Delivered cost per kilogram: <strong>{formatCurrency(example.row.pricePerKg)}/kg</strong>.</p>}
    <div className="mt-4 text-sm">{children}</div>
    <p className="mt-4 text-sm"><Link href={example.source} className="underline">Manufacturer ingredient and identity source</Link>. Classification evidence is separate from our approved nutrition records.</p>
  </li>;
}
