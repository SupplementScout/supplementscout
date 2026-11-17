import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide, GuidePriceBreakdown } from "../../components/BuyingGuide";
import { guideStructuredData } from "../../lib/buyingGuides";
import { CAFFEINE_FREE_PATH, caffeineFreeExamples, type CaffeineFreeGuideResult } from "../../lib/caffeineFreeGuide";
import { getCaffeineFreeGuideData } from "../../lib/caffeineFreeGuideData";
import { nutritionSourceKindLabel } from "../../lib/reviewedPreWorkoutFacts";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";

const title = "Caffeine-Free Pre-Workout UK: How to Check and Compare";
const heading = "How can I find and compare a pre-workout without caffeine?";
const description = "Compare checked caffeine-free pre-workout variants using approved confirmed-absence facts, exact flavours and packs, current UK prices and known delivery.";
const getCachedCaffeineFreeData = createLifecycleDataLoader(CAFFEINE_FREE_PATH, "caffeine-free-examples-v1", getCaffeineFreeGuideData);
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: CAFFEINE_FREE_PATH }, robots: getLifecycleRobots(CAFFEINE_FREE_PATH, params),
    openGraph: { title, description, url: CAFFEINE_FREE_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}

export function CaffeineFreeGuideContent({ result, now }: { result: CaffeineFreeGuideResult; now?: Date }) {
  const examples = caffeineFreeExamples(result, now);
  return (
    <BuyingGuide title={heading} breadcrumb="Caffeine-free pre-workout" structuredData={guideStructuredData(CAFFEINE_FREE_PATH, heading, description)}>
      <p className="text-lg leading-8 text-zinc-800"><strong>Start with a reviewed fact that explicitly confirms caffeine is absent for the exact variant, then compare fresh prices including delivery.</strong> Missing caffeine information, an empty field or a product name containing &ldquo;non-stim&rdquo; does not establish caffeine-free status.</p>
      <p>The checked examples below use approved caffeine facts already applied to their own flavours and packs. This guide explains that evidence and the purchase cost; it does not assess effectiveness, medical suitability or whether every other stimulant is absent.</p>
      <section aria-labelledby="confirmed-options">
        <h2 id="confirmed-options" className="text-2xl font-bold text-zinc-950">Exact variants with confirmed caffeine absence</h2>
        <p className="mt-4">We follow Applied Nutrition ABE Pump 500g Tigers Blood and Nutrend Pump Pre-Workout 225g Bubble Gum. Each must retain its own confirmed-absence evidence and a fresh in-stock offer with known delivery. This is a checked selection, not all UK caffeine-free pre-workouts.</p>
        {result.rows.length === 0 || examples.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No current selected example passes both evidence and offer checks. We have not turned an unknown caffeine value into a caffeine-free claim. <Link href="/search?q=pre%20workout&caffeine=free" className="font-semibold underline">Check the existing confirmed caffeine-free search</Link> for other current variants.</p> : (
          <ul className="mt-5 grid gap-5 md:grid-cols-2">{examples.map((example) => (
            <li key={String(example.variant.id)} className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-white p-5 sm:p-6">
              <h3 className="text-xl font-bold text-zinc-950"><Link href={example.productUrl} className="underline">{example.row.name}</Link></h3>
              <p className="mt-2 text-sm">Variant: {example.variantLabel}. Pack: {example.packLabel}.</p>
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-bold text-emerald-900">Caffeine: confirmed absent</p><p className="mt-2">Reviewed source: {example.caffeine.sourceKinds.map(nutritionSourceKindLabel).join(" + ")}.</p><p className="mt-2">This fact is bound to this exact variant; it does not verify the entire formulation.</p></div>
              <p className="mt-4 font-semibold">{example.offer.retailer.name}</p><GuidePriceBreakdown offer={example.offer} />
              <p className="mt-4 text-sm">Use the product page to check the recorded ingredient facts and retailer options. Another pack or flavour needs its own evidence and price.</p>
            </li>
          ))}</ul>
        )}
      </section>
      <section aria-labelledby="evidence-differences">
        <h2 id="evidence-differences" className="text-2xl font-bold text-zinc-950">Confirmed absent is different from not recorded</h2>
        <ul className="mt-4 list-disc space-y-3 pl-6"><li><strong>Confirmed absent:</strong> the reviewed source and applied fact explicitly establish absence for the selected variant.</li><li><strong>Present, with or without a disclosed amount:</strong> this does not qualify as caffeine-free.</li><li><strong>No information or conflicting information:</strong> caffeine status remains unresolved. We do not convert that gap into zero.</li></ul>
        <p className="mt-4">A raw numeric zero or &ldquo;stimulant-free&rdquo; marketing phrase is not enough on its own. We require the existing approved fact to match the value applied to the exact variant. An approved candidate that has not been applied does not qualify either.</p>
      </section>
      <section aria-labelledby="compare-caffeine-free">
        <h2 id="compare-caffeine-free" className="text-2xl font-bold text-zinc-950">Compare the purchase after checking the evidence</h2>
        <p className="mt-4">Match flavour, formulation, pack size and pack count before comparing. Then check item price, known delivery, delivered total, stock and the offer&apos;s check time. The examples contain different pack weights and formulas; the cheaper pack is not a score for ingredient quality or performance.</p>
        <p className="mt-4">Caffeine absence does not tell you the amounts or suitability of other ingredients. Ingredient quantities should be used only where their own reviewed records support them. Check the current full label and serving directions rather than inferring a dose from a product name or pack weight.</p>
      </section>
      <section aria-labelledby="caffeine-free-next-step">
        <h2 id="caffeine-free-next-step" className="text-2xl font-bold text-zinc-950">Find other checked variants</h2>
        <p className="mt-4">Use <Link href="/search?q=pre%20workout&caffeine=free" className="font-semibold underline">the confirmed caffeine-free search filter</Link> to explore the wider catalogue, or open <Link href="/pre-workout" className="font-semibold underline">the pre-workout comparison</Link> for current offers. <Link href="/help-me-choose" className="font-semibold underline">Help Me Choose</Link> can narrow a purchase shortlist.</p>
        <p className="mt-4">Read <Link href="/how-we-compare" className="font-semibold underline">how we compare prices</Link>, <Link href="/data-freshness" className="font-semibold underline">our freshness rules</Link> and <Link href="/guides/supplement-prices-including-delivery" className="font-semibold underline">why delivery changes the total</Link>. Unknown delivery is not free; confirm the final amount for your address and basket. Stale or unavailable offers are excluded, even when the caffeine fact remains verified.</p>
      </section>
    </BuyingGuide>
  );
}
export default async function CaffeineFreeGuide() {
  const result = await getCachedCaffeineFreeData(); assertLifecycleDataAvailable(result, CAFFEINE_FREE_PATH);
  return <CaffeineFreeGuideContent result={result} />;
}
