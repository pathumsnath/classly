"use client";

import { useState } from "react";
import { Card } from "@/components/card";

export interface TrendPoint {
  month: string;
  value: number;
}

const WIDTH = 320;
const HEIGHT = 120;
const PAD_X = 8;
const PAD_TOP = 26;
const PAD_BOTTOM = 24;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function monthLabelFull(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// A single-series "how has this moved over time" at a glance — used for
// both a tutor's own net payable and the institute's overall collected
// income, so no legend: the card title already names what's plotted.
export function IncomeTrendChart({ data, title = "Income trend" }: { data: TrendPoint[]; title?: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value), 0);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = PAD_X + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
    const y = PAD_TOP + plotHeight - ((d.value - min) / range) * plotHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(HEIGHT - PAD_BOTTOM).toFixed(1)} L ${points[0].x.toFixed(1)} ${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

  const active = hoverIndex !== null ? points[hoverIndex] : null;
  const last = points[points.length - 1];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
  }

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          role="img"
          aria-label={`${title} from ${monthLabelFull(data[0].month)} to ${monthLabelFull(data[data.length - 1].month)}, ranging from LKR ${min.toLocaleString()} to LKR ${max.toLocaleString()}`}
        >
          <line
            x1={PAD_X}
            y1={HEIGHT - PAD_BOTTOM}
            x2={WIDTH - PAD_X}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="#f3f4f6"
            strokeWidth={1}
          />

          <path d={areaPath} fill="#4f46e5" fillOpacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <text
              key={p.month}
              x={p.x}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-gray-400"
              fontSize={9}
            >
              {monthLabel(p.month)}
            </text>
          ))}

          <text x={last.x} y={last.y - 10} textAnchor="end" className="fill-gray-900 font-semibold" fontSize={11}>
            LKR {last.value.toLocaleString()}
          </text>
          <circle cx={last.x} cy={last.y} r={4} fill="#4f46e5" stroke="white" strokeWidth={2} />

          {active && (
            <>
              <line x1={active.x} y1={PAD_TOP} x2={active.x} y2={HEIGHT - PAD_BOTTOM} stroke="#e5e7eb" strokeWidth={1} />
              <circle cx={active.x} cy={active.y} r={4} fill="#4f46e5" stroke="white" strokeWidth={2} />
            </>
          )}

          <rect
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${(active.x / WIDTH) * 100}%` }}
          >
            <p className="font-semibold text-gray-900">LKR {active.value.toLocaleString()}</p>
            <p className="text-gray-500">{monthLabelFull(active.month)}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
