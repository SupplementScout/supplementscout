import Link from "next/link";

export default function ComparisonTransparencyLinks() {
  return (
    <>
      <Link href="/how-we-compare" className="font-semibold underline">
        How we compare prices
      </Link>
      <Link href="/data-freshness" className="font-semibold underline">
        Data freshness
      </Link>
    </>
  );
}
