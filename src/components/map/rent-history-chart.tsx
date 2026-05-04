"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RentHistoryPoint } from "@/lib/data/districts";

interface ChartDatum {
  year: number;
  median: number;
  sampleSize: number | null;
}

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("de-DE");

export function RentHistoryChart({ history }: { history: RentHistoryPoint[] }) {
  const data: ChartDatum[] = useMemo(
    () =>
      history.map((p) => ({
        year: Number.parseInt(p.period_end.slice(0, 4), 10),
        median: p.value_median,
        sampleSize: p.sample_size,
      })),
    [history],
  );

  if (data.length < 2) return null;

  const first = data[0];
  const last = data[data.length - 1];
  const pctChange = ((last.median - first.median) / first.median) * 100;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          Verlauf {first.year}–{last.year}
        </span>
        <span
          className={
            pctChange >= 0
              ? "font-medium text-red-600"
              : "font-medium text-emerald-600"
          }
        >
          {pctChange >= 0 ? "+" : ""}
          {pctChange.toFixed(0)}%
        </span>
      </div>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="currentColor"
              className="text-border"
            />
            <XAxis
              dataKey="year"
              type="number"
              domain={[first.year, last.year]}
              ticks={[first.year, Math.round((first.year + last.year) / 2), last.year]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => `${v}€`}
              tickLine={false}
              axisLine={false}
              width={36}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <Tooltip
              cursor={{ strokeDasharray: "2 2", stroke: "#94a3b8" }}
              content={<RentTooltip />}
            />
            <Line
              type="monotone"
              dataKey="median"
              stroke="#dc2626"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#dc2626", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md">
      <div className="font-medium">{d.year}</div>
      <div className="tabular-nums">{EUR.format(d.median)} / m²</div>
      {d.sampleSize != null && (
        <div className="text-muted-foreground">
          n = {NUM.format(d.sampleSize)}
        </div>
      )}
    </div>
  );
}
