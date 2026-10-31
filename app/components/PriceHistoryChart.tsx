import { formatCurrency } from "../lib/pricing";

type PriceHistoryPoint = {
  date: string;
  price: number;
};

function trendLabel(data: PriceHistoryPoint[]) {
  if (data.length < 2) return "More records needed";

  const first = data[0].price;
  const last = data.at(-1)?.price ?? first;
  const difference = last - first;

  if (Math.abs(difference) < 0.005) return "No recorded change";
  return `${formatCurrency(Math.abs(difference))} ${difference > 0 ? "higher" : "lower"}`;
}

export default function PriceHistoryChart({
  data,
  currentPrice,
}: {
  data: PriceHistoryPoint[];
  currentPrice: number | null;
}) {
  const validData = data.filter(
    (point) => Number.isFinite(point.price) && point.price > 0
  );
  const prices = validData.map((point) => point.price);
  const lowest = prices.length > 0 ? Math.min(...prices) : null;
  const firstDate = validData[0]?.date || null;
  const lastDate = validData.at(-1)?.date || null;
  const chartWidth = 640;
  const chartHeight = 180;
  const horizontalPadding = 20;
  const verticalPadding = 18;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const priceRange = Math.max(maxPrice - minPrice, 1);
  const chartPoints = validData.map((point, index) => {
    const x = validData.length === 1
      ? chartWidth / 2
      : horizontalPadding +
        (index / (validData.length - 1)) * (chartWidth - horizontalPadding * 2);
    const y = verticalPadding +
      ((maxPrice - point.price) / priceRange) *
        (chartHeight - verticalPadding * 2);
    return { ...point, x, y };
  });
  const path = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-[var(--ss-surface-muted)] p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Current delivered price
          </dt>
          <dd className="mt-1 text-xl font-bold text-[var(--ss-ink)]">
            {currentPrice === null ? "Unavailable" : formatCurrency(currentPrice)}
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--ss-surface-muted)] p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Lowest recorded
          </dt>
          <dd className="mt-1 text-xl font-bold text-[var(--ss-ink)]">
            {lowest === null ? "Unavailable" : formatCurrency(lowest)}
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--ss-surface-muted)] p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            Recorded trend
          </dt>
          <dd className="mt-1 text-base font-bold text-[var(--ss-ink)]">
            {trendLabel(validData)}
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--ss-surface-muted)] p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            History period
          </dt>
          <dd className="mt-1 text-base font-bold text-[var(--ss-ink)]">
            {firstDate && lastDate ? `${firstDate}–${lastDate}` : "Not available"}
          </dd>
        </div>
      </dl>

      {chartPoints.length >= 2 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-labelledby="price-history-title price-history-description"
            className="h-auto w-full"
          >
            <title id="price-history-title">Recorded delivered price history</title>
            <desc id="price-history-description">
              {`${validData.length} daily price records from ${firstDate} to ${lastDate}.`}
            </desc>
            {[0.25, 0.5, 0.75].map((position) => (
              <line
                key={position}
                x1={horizontalPadding}
                x2={chartWidth - horizontalPadding}
                y1={chartHeight * position}
                y2={chartHeight * position}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
            ))}
            <path
              d={path}
              fill="none"
              stroke="var(--ss-accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {chartPoints.map((point) => (
              <circle
                key={`${point.date}-${point.price}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="var(--ss-accent)"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${point.date}: ${formatCurrency(point.price)}`}</title>
              </circle>
            ))}
          </svg>
          <div className="mt-2 flex justify-between text-xs font-medium text-zinc-500">
            <span>{firstDate}</span>
            <span>{lastDate}</span>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
          More price records are needed to draw a history chart.
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Price history uses recorded delivered totals where both product price and delivery were known.
      </p>
    </div>
  );
}
