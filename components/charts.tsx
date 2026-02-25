"use client";

export function RetirementChart({
  data,
  retirementYear,
  depletionYear,
  height = 220,
}: {
  data: { year: number; value: number; retired: boolean }[];
  retirementYear: number;
  depletionYear: number | null;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const vals = data.map((d) => d.value);
  const years = data.map((d) => d.year);
  const minY = years[0];
  const maxY = years[years.length - 1];
  const maxV = Math.max(...vals, 1);

  const xPct = (year: number) => ((year - minY) / (maxY - minY)) * 100;
  const yPct = (val: number) => 100 - (val / maxV) * 85 - 5;

  const pts = data.map((d) => `${xPct(d.year)},${yPct(d.value)}`).join(" ");
  const areaPath = `M${xPct(minY)},${yPct(0)} ${pts} L${xPct(maxY)},${yPct(0)} Z`;

  // Y axis labels (억 단위)
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxV / tickCount) * i);
  // X axis labels: every 7 years roughly
  const totalYears = maxY - minY;
  const xStep = Math.max(7, Math.floor(totalYears / 7));
  const xTicks: number[] = [];
  for (let y = minY; y <= maxY; y += xStep) xTicks.push(y);

  const retXPct = xPct(retirementYear);
  const deplXPct = depletionYear ? xPct(depletionYear) : null;

  return (
    <div style={{ height }} className="relative w-full select-none">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill="url(#retGrad)" stroke="none" />
        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke="#f87171"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {/* Retirement vertical line */}
        <line
          x1={`${retXPct}`} y1="0" x2={`${retXPct}`} y2="100"
          stroke="#4ade80" strokeWidth="1" strokeDasharray="2,2"
          vectorEffect="non-scaling-stroke"
        />
        {/* Depletion vertical line */}
        {deplXPct !== null && (
          <line
            x1={`${deplXPct}`} y1="0" x2={`${deplXPct}`} y2="100"
            stroke="#f87171" strokeWidth="1" strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between pointer-events-none" style={{ width: 40 }}>
        {[...yTicks].reverse().map((v, i) => (
          <span key={i} className="text-[9px] text-muted-foreground tabular-nums leading-none">
            {v >= 1e8 ? `${(v / 1e8).toFixed(0)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : "0"}
          </span>
        ))}
      </div>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-10 right-0 flex justify-between pointer-events-none">
        {xTicks.map((y) => (
          <span
            key={y}
            className="text-[9px] text-muted-foreground tabular-nums"
            style={{ position: "absolute", left: `${((y - minY) / (maxY - minY)) * 100}%`, transform: "translateX(-50%)" }}
          >
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}

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
