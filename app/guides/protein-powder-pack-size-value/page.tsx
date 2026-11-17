import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import ProteinGuideExample, { ProteinGuideNutrition } from "../../components/ProteinGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { PACK_VALUE_GUIDE_PATH, PACK_VALUE_TARGETS, ISO_XP_SOURCE, packValueComparison } from "../../lib/proteinValueGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import { formatCurrency } from "../../lib/pricing";

const title = "Does Buying a Bigger Protein Bag Actually Save Money?";
const heading = "Is a bigger protein pack better value after delivery?";
const description = "Compare matched UK protein pack sizes using real delivered prices and verified cost per kilogram. See the extra upfront spend and limits on protein-unit comparisons.";
const getCachedExamples = createLifecycleDataLoader(PACK_VALUE_GUIDE_PATH, "protein-pack-guide-examples-v1",
  () => getBuyingGuideProducts([...new Set(PACK_VALUE_TARGETS.map(t => t.slug))]));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: PACK_VALUE_GUIDE_PATH }, robots: getLifecycleRobots(PACK_VALUE_GUIDE_PATH, params),
    openGraph: { title, description, url: PACK_VALUE_GUIDE_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}

export function PackValueGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const pair = packValueComparison(result.rows, now);
  return <BuyingGuide title={heading} breadcrumb="Protein pack-size value" structuredData={guideStructuredData(PACK_VALUE_GUIDE_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>A bigger protein bag saves money per kilogram only when its delivered unit cost is lower.</strong> {pair ? <>In this checked ISO-XP Vanilla pair, {pair.small.packLabel} costs {formatCurrency(pair.small.row.pricePerKg!)}/kg and {pair.large.packLabel} costs {formatCurrency(pair.large.row.pricePerKg!)}/kg. The {pair.unitWinner === "tie" ? "two unit prices are equal" : `${pair.unitWinner} pack has the lower powder cost per kilogram`}.</> : "There is currently no complete matched pair in this checked selection; we do not substitute different flavours, formulas or expired offers."}</p>
    <section aria-labelledby="matched-packs">
      <h2 id="matched-packs" className="text-2xl font-bold text-zinc-950">Same ISO-XP Vanilla formula, two exact sizes</h2>
      <p className="mt-4">We compare one 450 g pack with one 1.8 kg pack of Applied Nutrition ISO-XP Vanilla whey isolate. The <Link href={ISO_XP_SOURCE} className="underline">manufacturer lists both sizes and the Vanilla ingredient formula</Link>. The catalogue&apos;s exact variant and pack records bind each offer to its own size; the parent product name alone is not the pack size.</p>
      {result.rows.length === 0 || !pair ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No complete current pair passes the same-formula, same-flavour, exact-pack, verified-weight and known-delivery checks. <Link href="/whey-protein" className="underline">Browse current protein offers</Link>; a single remaining price cannot establish a size saving.</p> : <>
        <ul className="mt-5 grid gap-5 md:grid-cols-2">{[pair.small, pair.large].map(e => <ProteinGuideExample key={String(e.variant.id)} example={e}><ProteinGuideNutrition example={e} pairIncomplete={!pair.bothProteinVerified} /></ProteinGuideExample>)}</ul>
        <div className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">
          <h3 className="font-bold text-zinc-950">What changes when you buy the larger pack?</h3>
          <p className="mt-3">Upfront difference: {pair.upfrontDifference === 0 ? "the same delivered outlay" : `${formatCurrency(Math.abs(pair.upfrontDifference))} ${pair.upfrontDifference > 0 ? "more" : "less"} to pay for the larger pack`}.</p>
          <p className="mt-3">Unit difference: {pair.unitWinner === "tie" ? "equal delivered cost per kilogram" : `${formatCurrency(pair.unitDifference)} less per kilogram for the ${pair.unitWinner} pack`}. Differences use the unrounded unit costs; the displayed money is rounded only at the end.</p>
          <p className="mt-3 text-sm">{formatCurrency(pair.small.offer.deliveredPrice!.totalPrice)} ÷ {(pair.small.row.netWeightG! / 1000).toLocaleString("en-GB")} kg = {formatCurrency(pair.small.row.pricePerKg!)}/kg. {formatCurrency(pair.large.offer.deliveredPrice!.totalPrice)} ÷ {(pair.large.row.netWeightG! / 1000).toLocaleString("en-GB")} kg = {formatCurrency(pair.large.row.pricePerKg!)}/kg.</p>
        </div>
      </>}
    </section>
    <section aria-labelledby="pack-metrics">
      <h2 id="pack-metrics" className="text-2xl font-bold text-zinc-950">Pack price, cost per kilogram and protein cost</h2>
      <p className="mt-4">Delivered pack price is the cash due for one recorded pack. Cost per kilogram divides that total by the verified total powder weight, including pack count. Cost per 25 g of protein asks a different question: how much the protein contained in the pack costs.</p>
      <p className="mt-4">We show a protein-unit comparison only when both exact packs have approved nutrition. If either record is missing, the comparison is withheld rather than copying the larger pack&apos;s data across. Read <Link href="/guides/cost-per-25g-protein" className="font-semibold underline">how the verified protein calculation works</Link>. A lower powder cost per kilogram alone is not proof of a lower protein cost for different formulations.</p>
    </section>
    <section aria-labelledby="pack-delivery">
      <h2 id="pack-delivery" className="text-2xl font-bold text-zinc-950">Delivery can change the result</h2>
      <p className="mt-4">Compare the complete purchase, not two headline item prices. The cards show different tracked retailers; they do not demonstrate a same-store bulk discount. Zero delivery is used only when recorded as zero. Unknown delivery cannot qualify a pack.</p>
      <p className="mt-4">These are one-pack offers on their recorded delivery basis. Your address, basket, membership or promotion may change the amount. Buying several smaller packs can also change shipping, so multiplying one delivered pack price does not establish a guaranteed basket saving. See <Link href="/guides/supplement-prices-including-delivery" className="underline">our delivered-price guide</Link>.</p>
    </section>
    <section aria-labelledby="pack-decision">
      <h2 id="pack-decision" className="text-2xl font-bold text-zinc-950">When is the larger pack worth buying?</h2>
      <p className="mt-4">It can make financial sense when the same formula and flavour have a lower delivered unit cost, you can use the quantity, and the upfront payment fits your budget. If the unit cost is higher or the extra quantity is unwanted, size alone gives no reason to spend more.</p>
      <p className="mt-4">A smaller pack may be the practical choice for a fixed cash limit, even when its unit cost is higher. Check <Link href="/guides/protein-powder-under-30" className="font-semibold underline">protein powders under £30 including delivery</Link>, or explore the broader <Link href="/whey-protein" className="underline">Whey Protein comparison</Link>. Confirm the flavour, formula, net weight, pack count, stock and checkout total before buying.</p>
      <p className="mt-4">Only fresh in-stock exact-variant offers appear. If one expires, loses verified weight or has unknown delivery, the pair is withheld. Our <Link href="/how-we-compare" className="underline">comparison method</Link> and <Link href="/data-freshness" className="underline">freshness rules</Link> explain these limits.</p>
    </section>
  </BuyingGuide>;
}
export default async function PackValueGuide() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, PACK_VALUE_GUIDE_PATH);
  return <PackValueGuideContent result={result} />;
}
