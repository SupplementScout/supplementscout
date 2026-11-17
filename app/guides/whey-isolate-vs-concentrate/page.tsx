import type { Metadata } from "next";
import Link from "next/link";
import { BuyingGuide } from "../../components/BuyingGuide";
import ProteinGuideExample, { ProteinGuideNutrition } from "../../components/ProteinGuideExample";
import { getBuyingGuideProducts } from "../../lib/buyingGuideData";
import { guideStructuredData, type GuideProductsResult } from "../../lib/buyingGuides";
import { DAIRY_INGREDIENT_SOURCE, WHEY_TYPE_GUIDE_PATH, WHEY_TYPE_TARGETS, wheyTypeExamples, hasProteinValue } from "../../lib/proteinValueGuides";
import { assertLifecycleDataAvailable, getLifecycleRobots, type RouteSearchParams } from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";

const title = "Whey Isolate vs Concentrate: Which Is Better Value in the UK?";
const heading = "Should I buy whey isolate or whey concentrate?";
const description = "Compare whey isolate and concentrate using checked exact-flavour examples, delivered prices and approved protein costs, with clear limits where nutrition is missing.";
const getCachedExamples = createLifecycleDataLoader(WHEY_TYPE_GUIDE_PATH, "whey-type-guide-examples-v1",
  () => getBuyingGuideProducts(WHEY_TYPE_TARGETS.map(t => t.slug)));
export const dynamic = "force-dynamic";
export const revalidate = 3600;
type Props = { searchParams?: Promise<RouteSearchParams> };
export async function generateMetadata({ searchParams }: Props = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return { title, description, alternates: { canonical: WHEY_TYPE_GUIDE_PATH }, robots: getLifecycleRobots(WHEY_TYPE_GUIDE_PATH, params),
    openGraph: { title, description, url: WHEY_TYPE_GUIDE_PATH, type: "website" }, twitter: { card: "summary", title, description } };
}

export function WheyTypeGuideContent({ result, now }: { result: GuideProductsResult; now?: Date }) {
  const examples = wheyTypeExamples(result.rows, now);
  const bothProteinVerified = examples.length === 2 && examples.every(hasProteinValue);
  return <BuyingGuide title={heading} breadcrumb="Whey isolate vs concentrate" structuredData={guideStructuredData(WHEY_TYPE_GUIDE_PATH, heading, description)}>
    <p className="text-lg leading-8 text-zinc-800"><strong>Neither whey isolate nor concentrate is automatically better value.</strong> Compare the delivered price of the exact flavour and pack, then the cost of 25 g of protein where approved nutrition supports it. A lower pack price can simply buy less powder.</p>
    <section aria-labelledby="whey-difference">
      <h2 id="whey-difference" className="text-2xl font-bold text-zinc-950">What do isolate and concentrate mean?</h2>
      <p className="mt-4">Both are whey-derived dairy ingredients. Concentrate is made by separating non-protein components from whey; isolate removes enough of those components to reach a higher protein concentration. The <Link href={DAIRY_INGREDIENT_SOURCE} className="underline">American Dairy Products Institute&apos;s ingredient definitions</Link> explain the distinction. These describe ingredients, not the final nutrition of every flavoured tub.</p>
      <p className="mt-4">Read the ingredients as well as the product name. A whey isolate/concentrate blend is a blend, not an example of either single whey source. Flavourings and other ingredients affect the finished powder, so an isolate name does not establish a particular protein percentage or lactose amount for your serving.</p>
    </section>
    <section aria-labelledby="whey-examples">
      <h2 id="whey-examples" className="text-2xl font-bold text-zinc-950">Checked isolate and concentrate examples</h2>
      <p className="mt-4">These are two different formulations and pack sizes, both Vanilla. Their manufacturer ingredient lists identify isolate for Applied Nutrition ISO-XP and concentrate for 7Nutrition Whey Protein 80. We do not assign those types from a loose name match or rank them for effectiveness.</p>
      {result.rows.length === 0 || examples.length === 0 ? <p className="mt-5 rounded-2xl border border-[var(--ss-border)] bg-white p-5">No current selected example passes the exact-variant and offer checks. The explanation remains useful; <Link href="/whey-protein" className="underline">check current whey offers</Link> rather than using an old price.</p> : <ul className="mt-5 grid gap-5 md:grid-cols-2">{examples.map(e => <ProteinGuideExample key={String(e.variant.id)} example={e}><ProteinGuideNutrition example={e} /></ProteinGuideExample>)}</ul>}
      <p className="mt-5">{bothProteinVerified ? "Both exact examples have approved protein data, so their displayed costs per 25 g can be compared for these offers. This is a price comparison, not a quality score." : "This selection cannot establish a winner per 25 g of protein while either exact variant lacks approved nutrition. Where one figure is available it is shown on its own; a missing figure is not a poor-value score."}</p>
    </section>
    <section aria-labelledby="whey-value">
      <h2 id="whey-value" className="text-2xl font-bold text-zinc-950">Does a higher pack price mean worse value?</h2>
      <p className="mt-4">No. Check how much powder the pack contains before judging the cash price. Delivered cost per kilogram compares powder weight; it does not measure the amount of protein. Cost per 25 g uses the pack&apos;s approved serving count and protein per serving. Different flavours can have different amounts.</p>
      <p className="mt-4">Use <Link href="/guides/cost-per-25g-protein" className="font-semibold underline">the cost-per-25g method</Link> when both records qualify. It can identify a cheaper verified protein purchase, but neither ingredient type is guaranteed to win. Keep missing values blank and include delivery in the amount paid.</p>
    </section>
    <section aria-labelledby="whey-choice">
      <h2 id="whey-choice" className="text-2xl font-bold text-zinc-950">When might you prefer one?</h2>
      <p className="mt-4">If a lower upfront spend matters most, choose an acceptable pack within your delivered budget rather than assuming a larger tub is affordable. If protein unit value matters most, compare the verified protein costs. If you have a particular ingredient requirement, read the exact current label before using price to decide.</p>
      <p className="mt-4">Both examples are milk-derived. This guide does not establish lactose-free status, allergy suitability, easier digestion, faster absorption or better muscle-building results. A type name alone cannot answer those questions. Check the finished product&apos;s ingredients, nutrition and allergen information.</p>
    </section>
    <section aria-labelledby="whey-checklist">
      <h2 id="whey-checklist" className="text-2xl font-bold text-zinc-950">Before choosing a product</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-6"><li>Match the exact flavour, formula, pack size and pack count.</li><li>Check the named whey ingredients; keep ambiguous blends separate.</li><li>Add known delivery and check stock and the offer timestamp.</li><li>Compare approved protein unit costs where both records support them.</li><li>Confirm the retailer&apos;s current checkout total and label.</li></ol>
      <p className="mt-4">Explore the broader <Link href="/whey-protein" className="underline">Whey Protein comparison</Link>, narrower <Link href="/whey-isolate" className="underline">Whey Isolate comparison</Link>, <Link href="/compare" className="underline">two-product comparison</Link> or <Link href="/help-me-choose" className="underline">Help Me Choose</Link>. Those tools cover shopping choices; this guide explains the ingredient-type and value decision.</p>
      <p className="mt-4">Only current in-stock offers with known delivery appear here. Missing shipping is not free, and a different address, basket threshold or promotion can change the final amount. Our <Link href="/how-we-compare" className="underline">method</Link> and <Link href="/data-freshness" className="underline">freshness rules</Link> explain the checks.</p>
    </section>
  </BuyingGuide>;
}
export default async function WheyTypeGuide() {
  const result = await getCachedExamples(); assertLifecycleDataAvailable(result, WHEY_TYPE_GUIDE_PATH);
  return <WheyTypeGuideContent result={result} />;
}
