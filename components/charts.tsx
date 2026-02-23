"use client";

export function HorizBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d, i) => {
        const pct = (Math.abs(d.value) / max) * 100;
        const isNeg = d.value < 0;
        return (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className="text-[11px] text-muted-foreground min-w-[160px] max-w-[160px] truncate text-right shrink-0"
              title={d.label}
            >
              {d.label}
            </div>
            <div className="flex-1 bg-muted rounded-[4px] h-5 overflow-hidden relative">
              <div
                className="absolute h-full transition-[width] duration-400 ease-out"
                style={{
                  left: isNeg ? `${50 - pct / 2}%` : "50%",
                  width: `${pct / 2}%`,
                  background: isNeg ? "#f87171" : "#4ade80",
                  borderRadius: isNeg ? "4px 0 0 4px" : "0 4px 4px 0",
                }}
              />
              <div className="absolute left-1/2 top-0 w-px h-full bg-border" />
            </div>
            <div
              className="text-[11px] min-w-[44px] text-right tabular-nums"
              style={{ color: isNeg ? "#f87171" : "#4ade80" }}
            >
              {d.value.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({ data, height = 100 }: { data: { value: number }[]; height?: number }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pts = data
    .map(
      (d, i) =>
        `${(i / (data.length - 1)) * 100},${100 - ((d.value - minV) / range) * 80 - 10}`
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,90 ${pts} 100,90`} fill="url(#lineGrad)" stroke="none" />
      <polyline
        points={pts}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DonutChart({
  segments,
  size = 96,
}: {
  segments: { value: number; color: string; label?: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  if (total === 0)
    return (
      <div
        className="rounded-full bg-secondary"
        style={{ width: size, height: size }}
      />
    );
  const r = 40;
  const cx = 50;
  const cy = 50;
  let cum = -Math.PI / 2;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {segments.map((sg, i) => {
        const angle = (sg.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(cum);
        const y1 = cy + r * Math.sin(cum);
        cum += angle;
        const x2 = cx + r * Math.cos(cum);
        const y2 = cy + r * Math.sin(cum);
        return (
          <path
            key={i}
            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} Z`}
            fill={sg.color}
            opacity={0.85}
            className="transition-opacity hover:opacity-100"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={24} fill="#0a0d14" />
    </svg>
  );
}
