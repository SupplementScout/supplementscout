import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import PurchaseGuideExample from "../../components/PurchaseGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { CREATINE_PACK_GUIDE_PATH, CREATINE_PACK_TARGETS, creatinePackComparisons } from "../../lib/purchaseDecisionGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Creatine Pack Sizes: Is a Bigger Tub Better Value?";
const heading = "Should I buy a bigger tub of creatine?";
const description = "Compare matched unflavoured creatine pack sizes using current UK delivered prices, verified cost per kilogram and the extra upfront spend.";
const getCachedExamples = createLifecycleDataLoader(CREATINE_PACK_GUIDE_PATH, "creatine-pack-guide-examples-v1",
  () => getBuyingGuideProducts([...new Set(CREATINE_PACK_TARGETS.map(t => t.slug))]));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: CREATINE_PACK_GUIDE_PATH }, robots: getLifecycleRobots(CREATINE_PACK_GUIDE_PATH, params),
    openGraph: { title, description, url: CREATINE_PACK_GUIDE_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}
export function CreatinePackGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const pairs = creatinePackComparisons(result.rows, now);
  return <BuyingGuide title={heading} breadcrumb="Creatine pack-size value" structuredData={guideStructuredData(CREATINE_PACK_GUIDE_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>A bigger creatine tub is better value per kilogram only when its delivered unit price is lower.</strong> Compare the same unflavoured formula in two verified sizes, including shipping. A smaller tub&apos;s discount can outweigh the larger pack&apos;s size advantage; the extra upfront spend still matters.</p>
    <section aria-labelledby="matched-creatine">
      <h2 id="matched-creatine" className="text-2xl font-bold text-zinc-950">Same formula, two exact sizes</h2>
      <p className="mt-4">These are separate within-brand comparisons of unflavoured creatine monohydrate powders. Manufacturer sources list each formula and both sizes; exact catalogue variants bind each offer to its own pack. We do not substitute a flavoured blend, capsule, gummy, multipack or another brand.</p>
      {result.rows.length === 0 || pairs.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No complete current pair passes the same-formula, same-flavour, exact-pack, verified-weight and known-delivery checks. A remaining single price cannot establish a size saving. <Link href="/creatine" className="underline">Browse current creatine offers</Link> and use the method below.</p> :
        pairs.map(pair => <div key={pair.key} className="mt-8">
          <h3 className="text-xl font-bold text-zinc-950">{pair.small.label}: {pair.small.packLabel} vs {pair.large.packLabel}</h3>
          <p className="mt-3">The <Link href={pair.small.source} className="underline">manufacturer&apos;s unflavoured formula and pack-size source</Link> supports this matched family. Both cards are one pack; the parent product name alone is not the selected size.</p>
          <ul className="mt-5 grid gap-5 md:grid-cols-2">{[pair.small, pair.large].map(e => <PurchaseGuideExample key={String(e.variant.id)} example={e} headingLevel="h4" />)}</ul>
          <div className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">
            <h4 className="font-bold text-zinc-950">What changes with the larger tub?</h4>
            <p className="mt-3">{pair.small.packLabel}: {formatCurrency(pair.small.row.pricePerKg!)}/kg. {pair.large.packLabel}: {formatCurrency(pair.large.row.pricePerKg!)}/kg. {pair.unitWinner === "tie" ? "Their delivered unit prices are equal." : `The ${pair.unitWinner} pack has the lower powder cost per kilogram.`}</p>
            <p className="mt-3">Upfront difference: {pair.upfrontDifference === 0 ? "the same cash outlay" : `${formatCurrency(Math.abs(pair.upfrontDifference))} ${pair.upfrontDifference > 0 ? "more" : "less"} to pay for the larger pack`}. {pair.unitWinner !== "tie" && <>Unit difference: {formatCurrency(pair.unitDifference)} less/kg for the {pair.unitWinner} pack.</>}</p>
            <p className="mt-3 text-sm">Calculation: {formatCurrency(pair.small.offer.deliveredPrice!.totalPrice)} ÷ {(pair.small.row.netWeightG! / 1000).toLocaleString("en-GB")} kg; {formatCurrency(pair.large.offer.deliveredPrice!.totalPrice)} ÷ {(pair.large.row.netWeightG! / 1000).toLocaleString("en-GB")} kg. Differences use the unrounded unit costs; displayed money is rounded at the end.</p>
          </div>
        </div>)}
    </section>
    <section aria-labelledby="creatine-units">
      <h2 id="creatine-units" className="text-2xl font-bold text-zinc-950">Powder weight is not an approved creatine-dose calculation</h2>
      <p className="mt-4">Cost per kilogram divides one delivered pack price by its verified powder weight. These comparisons show powder-weight value, not a verified creatine-dose cost. A cost per 5 g of creatine requires approved ingredient and serving data for that exact variant; we do not calculate it from tub weight alone. Manufacturer formula evidence does not approve a nutrient quantity.</p>
      <p className="mt-4">The cards can show offers from different retailers. They do not prove a same-store bulk discount. Delivery applies to one recorded pack; your address, basket, membership or promotion may change the final total. Multiplying a one-pack delivered price does not establish the checkout cost of several tubs.</p>
    </section>
    <section aria-labelledby="creatine-choice">
      <h2 id="creatine-choice" className="text-2xl font-bold text-zinc-950">Choose the size in five steps</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6"><li>Keep the product family, formula and flavour the same.</li><li>Check the exact pack weight and whether the offer is for one tub.</li><li>Add known delivery to the product price, then compare verified cost per kilogram.</li><li>Check the extra cash needed and whether you expect to use the quantity, following the label&apos;s storage and expiry information.</li><li>Confirm stock and the retailer&apos;s checkout total. A bigger tub with a higher unit price offers no saving on powder weight.</li></ol>
      <p className="mt-4">For a wider choice, use the <Link href="/creatine" className="font-semibold underline">Creatine comparison</Link> or <Link href="/creatine#under-20" className="underline">creatine under £20 including delivery</Link> when your cash budget comes first. Read <Link href="/guides/supplement-prices-including-delivery" className="underline">the delivery-price guide</Link> or use <Link href="/compare" className="underline">the two-product comparison tool</Link> for your exact choices.</p>
      <p className="mt-4">Each incomplete, stale or unavailable pair is excluded. Unknown shipping is not treated as free, and this checked selection does not claim to rank every creatine offer.</p>
    </section>
  </BuyingGuide>;
}
export default async function Page() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, CREATINE_PACK_GUIDE_PATH);
  return <CreatinePackGuideContent result={result} />;
}
