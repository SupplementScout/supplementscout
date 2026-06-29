"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PriceHistoryPoint = {
  date: string;
  price: number;
};

export default function PriceHistoryChart({
  data,
}: {
  data: PriceHistoryPoint[];
}) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-zinc-500">
        More price records are needed to show a chart.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis
            tickFormatter={(value) => `£${Number(value).toFixed(0)}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value) => [
              `£${Number(value).toFixed(2)}`,
              "Total price",
            ]}
          />
          <Line
            type="monotone"
            dataKey="price"
            strokeWidth={3}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}