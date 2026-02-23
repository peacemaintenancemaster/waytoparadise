"use client";

import { useEffect, useState } from "react";

export function HorizBarChart({ data }: { data: { label: string; value: number }[] }) {
  const [animated, setAnimated] = useState(false);
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => {
        const pct = (Math.abs(d.value) / max) * 100;
        const isNeg = d.value < 0;
        return (
          <div 
            key={i} 
            className="flex items-center gap-2.5 animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div
              className="text-[11px] text-muted-foreground min-w-[160px] max-w-[160px] truncate text-right shrink-0 hover:text-secondary-foreground transition-colors"
              title={d.label}
            >
              {d.label}
            </div>
            <div className="flex-1 bg-muted rounded-lg h-6 overflow-hidden relative shadow-inner">
              <div
                className="absolute h-full transition-all duration-700 ease-out"
                style={{
                  left: isNeg ? `${50 - (animated ? pct / 2 : 0)}%` : "50%",
                  width: `${animated ? pct / 2 : 0}%`,
                  background: isNeg 
                    ? "linear-gradient(90deg, #f87171 0%, #ef4444 100%)" 
                    : "linear-gradient(90deg, #4ade80 0%, #22c55e 100%)",
                  borderRadius: isNeg ? "6px 0 0 6px" : "0 6px 6px 0",
                  boxShadow: isNeg 
                    ? "0 0 10px rgba(248, 113, 113, 0.3)" 
                    : "0 0 10px rgba(74, 222, 128, 0.3)",
                }}
              />
              <div className="absolute left-1/2 top-0 w-[2px] h-full bg-border/50" />
            </div>
            <div
              className="text-[11px] min-w-[50px] text-right tabular-nums font-semibold"
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
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

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
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <polyline 
        points={`0,90 ${pts} 100,90`} 
        fill="url(#lineGrad)" 
        stroke="none"
        style={{
          opacity: animated ? 1 : 0,
          transition: "opacity 0.6s ease-out",
        }}
      />
      <polyline
        points={pts}
        fill="none"
        stroke="url(#lineStroke)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        filter="url(#glow)"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: animated ? "none" : "1000",
          strokeDashoffset: animated ? "0" : "1000",
          transition: "stroke-dashoffset 1.2s ease-out",
        }}
      />
      {/* Data points */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.value - minV) / range) * 80 - 10;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.5"
            fill="#4ade80"
            className="transition-all duration-300 hover:r-3"
            style={{
              opacity: animated ? 0.8 : 0,
              transition: `opacity 0.4s ease-out ${i * 50}ms`,
            }}
          />
        );
      })}
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
  const [animated, setAnimated] = useState(false);
  const total = segments.reduce((s, sg) => s + sg.value, 0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (total === 0)
    return (
      <div
        className="rounded-full bg-secondary relative overflow-hidden"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 skeleton" />
      </div>
    );

  const r = 40;
  const cx = 50;
  const cy = 50;
  let cum = -Math.PI / 2;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="transform-gpu">
      <defs>
        {segments.map((sg, i) => (
          <filter key={`glow-${i}`} id={`segment-glow-${i}`}>
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        ))}
      </defs>
      {segments.map((sg, i) => {
        const angle = (sg.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(cum);
        const y1 = cy + r * Math.sin(cum);
        cum += angle;
        const x2 = cx + r * Math.cos(cum);
        const y2 = cy + r * Math.sin(cum);
        const largeArc = angle > Math.PI ? 1 : 0;
        
        return (
          <g key={i}>
            <path
              d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
              fill={sg.color}
              opacity={animated ? 0.9 : 0}
              filter={`url(#segment-glow-${i})`}
              className="transition-all duration-300 hover:opacity-100 cursor-pointer"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: animated ? "scale(1)" : "scale(0.8)",
                transition: `all 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${i * 100}ms`,
              }}
            >
              <title>{sg.label || `${((sg.value / total) * 100).toFixed(1)}%`}</title>
            </path>
          </g>
        );
      })}
      {/* Center hole with gradient */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={26} 
        fill="url(#centerGrad)" 
        className="transition-all duration-300"
      />
      <defs>
        <radialGradient id="centerGrad">
          <stop offset="0%" stopColor="#0a0d14" />
          <stop offset="100%" stopColor="#1a1f2e" />
        </radialGradient>
      </defs>
    </svg>
  );
}
