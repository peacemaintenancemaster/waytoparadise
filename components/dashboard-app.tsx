"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { HorizBarChart, LineChart, DonutChart, RetirementChart } from "./charts";
import { dbGetAll, dbPutAll, dbDelete, dbClear } from "@/lib/db";
import { processRawData, parseTSV, parseExcelFile } from "@/lib/parsing";
import { buildHoldings, calcZScore, weatherFromZScore, simulateRetirement, displayName, pnlColor, fmt, fmtPct, fmtWon } from "@/lib/accounting";
import {
  TABS, TICKER_PAGE_SIZE, PORTFOLIO_CATEGORIES,
  ALL_MACRO_INDICATORS, DEFAULT_SELECTED_MACRO,
  ASSET_CLASS_LABEL, ASSET_COLORS, TX_TYPE_COLORS,
  WEATHER_ICONS, WEATHER_LABELS, TX_TYPE,
  type Transaction, type Portfolio, type UnmappedName, type Holding,
} from "@/lib/constants";
import {
  Upload, Search, ChevronLeft, ChevronRight, X, Plus,
  Trash2, FileSpreadsheet, ClipboardPaste, BarChart3,
  TrendingUp, PieChart, Globe2, Landmark, Check,
} from "lucide-react";

const TAB_ICONS = [BarChart3, FileSpreadsheet, TrendingUp, PieChart, Globe2, Landmark];

// ============================================================
// MACRO WEATHER WIDGET
// ============================================================
function MacroWeatherWidget({ activeIndicators }: { activeIndicators: typeof ALL_MACRO_INDICATORS }) {
  if (!activeIndicators.length) return null;
  const scores = activeIndicators.map((m) => calcZScore(m.value, m.mean, m.stddev) * (m.positiveIsGood ? 1 : -1) * m.weight);
  const totalWeight = activeIndicators.reduce((s, m) => s + m.weight, 0);
  const compositeZ = scores.reduce((s, v) => s + v, 0) / (totalWeight || 1);
  const wx = weatherFromZScore(compositeZ, true);
  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
      <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-3">거시경제 날씨 종합</div>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-5xl">{WEATHER_ICONS[wx]}</div>
        <div>
          <div className="text-[22px] font-bold text-foreground">{WEATHER_LABELS[wx]}</div>
          <div className="text-[11px] text-muted-foreground">
            {"종합 Z점수: "}{compositeZ.toFixed(2)}{" · "}{activeIndicators.length}{"개 지표"}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {activeIndicators.map((m) => {
          const z = calcZScore(m.value, m.mean, m.stddev);
          const w = weatherFromZScore(z, m.positiveIsGood);
          return (
            <div key={m.indicator} className="flex items-center justify-between bg-secondary rounded-xl px-3 py-2 transition-colors hover:bg-muted">
              <div className="min-w-0">
                <span className="text-xs text-foreground font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{m.region}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-foreground tabular-nums font-mono">{m.value}{m.unit}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{"Z:"}{z.toFixed(2)}</span>
                <span className="text-base">{WEATHER_ICONS[w]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// RETIREMENT PLANNER
// ============================================================
function SliderRow({
  label, value, min, max, step, unit, display, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; display?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground/70">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-foreground font-mono">{display ?? value.toLocaleString("ko-KR")}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #22a862 0%, #22a862 ${((value - min) / (max - min)) * 100}%, #e4e7ed ${((value - min) / (max - min)) * 100}%, #e4e7ed 100%)`,
        }}
      />
    </div>
  );
}

function RetirementPlanner({ totalPortfolioValue }: { totalPortfolioValue: number }) {
  const currentYear = new Date().getFullYear();
  const [params, setParams] = useState({
    birthYear: 1998,
    currentAssets: Math.round((totalPortfolioValue || 100000000) / 10000),
    monthlySaving: 350,
    savingIncreaseEveryN: 5,
    savingIncreaseAmount: 50,
    retirementYear: 2050,
    monthlyExpense: 500,
    growthRateBefore: 0.08,
    growthRateAfter: 0.04,
    inflationRate: 0.025,
  });
  const set = (k: keyof typeof params, v: number) => setParams((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    if (totalPortfolioValue > 0)
      setParams((p) => ({ ...p, currentAssets: Math.max(p.currentAssets, Math.round(totalPortfolioValue / 10000)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPortfolioValue]);

  const result = useMemo(() => simulateRetirement({ ...params, currentYear }), [params, currentYear]);
  const currentAge = currentYear - params.birthYear;
  const retirementAge = params.retirementYear - params.birthYear;

  const saveJSON = () => {
    const blob = new Blob([JSON.stringify({ params, result: result ? { depletionYear: result.depletionYear, isSafe: result.isSafe } : null }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "retirement_plan.json"; a.click();
  };

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-foreground tracking-tight">낙원계산기 Pro</h2>
        <button
          onClick={saveJSON}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          저장하기
        </button>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {/* LEFT */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5 shadow-sm">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-3">기본 정보</div>
            <SliderRow label="출생 연도" value={params.birthYear} min={1960} max={2005} step={1} unit={`년생 (만 ${currentAge}세)`} display={String(params.birthYear)} onChange={(v) => set("birthYear", v)} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">자산 {"&"} 저축</div>
            <SliderRow label="현재 모은 자산" value={params.currentAssets} min={0} max={200000} step={500} unit="만원" onChange={(v) => set("currentAssets", v)} />
            <SliderRow label="매월 저축액" value={params.monthlySaving} min={0} max={2000} step={10} unit="만원" onChange={(v) => set("monthlySaving", v)} />
            <div>
              <div className="text-[11px] font-medium text-foreground/70 mb-2">저축 증액 플랜</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 flex items-center justify-center gap-1.5">
                  <input type="number" min={1} max={20} value={params.savingIncreaseEveryN} onChange={(e) => set("savingIncreaseEveryN", Number(e.target.value) || 1)} className="bg-transparent text-foreground text-sm font-semibold font-mono w-10 text-center focus:outline-none tabular-nums" />
                  <span className="text-[10px] text-muted-foreground">년 마다</span>
                </div>
                <span className="text-muted-foreground text-sm font-light">+</span>
                <div className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 flex items-center justify-between gap-1">
                  <input type="number" min={0} max={500} step={10} value={params.savingIncreaseAmount} onChange={(e) => set("savingIncreaseAmount", Number(e.target.value) || 0)} className="bg-transparent text-foreground text-sm font-semibold font-mono text-right w-full focus:outline-none tabular-nums" />
                  <span className="text-[10px] text-muted-foreground shrink-0">만원 증액</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">은퇴 {"&"} 생활</div>
            <SliderRow label="은퇴 목표 연도" value={params.retirementYear} min={currentYear + 1} max={2060} step={1} unit={`년 (만 ${retirementAge}세)`} display={String(params.retirementYear)} onChange={(v) => set("retirementYear", v)} />
            <SliderRow label="은퇴 후 월 생활비 (현재가치)" value={params.monthlyExpense} min={100} max={2000} step={50} unit="만원" onChange={(v) => set("monthlyExpense", v)} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">수익률 설정</div>
            <div className="grid grid-cols-2 gap-2">
              {([["은퇴 전 연 수익률", "growthRateBefore", 0.01, 0.20, 0.01], ["은퇴 후 연 수익률", "growthRateAfter", 0.01, 0.12, 0.01]] as const).map(([label, key, min, max, step]) => (
                <label key={key} className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <div className="bg-secondary border border-border rounded-xl px-3 py-2 flex items-center justify-between">
                    <input type="number" min={min * 100} max={max * 100} step={step * 100} value={(params[key] * 100).toFixed(1)} onChange={(e) => set(key, (parseFloat(e.target.value) || 0) / 100)} className="bg-transparent text-foreground text-sm font-semibold font-mono w-12 text-right focus:outline-none tabular-nums" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        {/* RIGHT */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
          {result && (
            <>
              <div className="flex justify-center">
                <div className="px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: result.isSafe ? "#dcfce7" : "#fee2e2", color: result.isSafe ? "#15803d" : "#dc2626", border: `1px solid ${result.isSafe ? "#bbf7d0" : "#fecaca"}` }}>
                  {result.isSafe ? "안전 (100세 이상)" : "위험 (자산 고갈)"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[11px] text-muted-foreground mb-1">자산 고갈 예상 시점</div>
                <div className="text-6xl font-black tabular-nums leading-none mb-1 font-mono" style={{ color: result.isSafe ? "#22a862" : "#e5534b" }}>
                  {result.isSafe ? (result.trajectory[result.trajectory.length - 1]?.year ?? "—") : result.depletionYear}{"년"}
                </div>
                <div className="text-xs text-muted-foreground">{"(만 "}{result.isSafe ? "100+" : result.depletionAge}{"세 시점)"}</div>
              </div>
              <div className="border-l-4 border-primary/50 pl-3 py-1 bg-accent/30 rounded-r-lg">
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {(params.retirementYear - currentYear)}{"년간 평균 "}
                  <span className="font-semibold text-foreground">{Math.round(result.avgAnnualSaving / 12).toLocaleString("ko-KR")}{"만원씩"}</span>
                  {" 저축하고, 매년 자산을 "}
                  <span className="font-semibold text-foreground">{(params.growthRateBefore * 100).toFixed(1)}{"% 씩"}</span>
                  {" 늘린 뒤 "}
                  <span className="font-semibold text-foreground">{params.retirementYear}{"년부터"}</span>
                  {" 안전하게 투자하면 "}
                  <span style={{ color: result.isSafe ? "#22a862" : "#e5534b" }} className="font-bold">
                    {result.isSafe ? `${result.trajectory[result.trajectory.length - 1]?.year ?? params.birthYear + 100}년(만 100+세 시점)` : `${result.depletionYear}년(만 ${result.depletionAge}세 시점)`}
                  </span>
                  {"에 자산이 고갈됩니다. 그땐 낙원에 있겠죠?"}
                </p>
              </div>
              <div className="flex-1 min-h-0 relative pl-10 pb-4">
                <RetirementChart data={result.trajectory} retirementYear={params.retirementYear} depletionYear={result.depletionYear} height={220} />
              </div>
              <div className="text-[10px] text-muted-foreground/60 text-center">
                {currentYear}{"년 기준 | 인플레이션 연 "}{(params.inflationRate * 100).toFixed(1)}{"% 반영 | 자산이 고갈될 때까지 시뮬레이션"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function DashboardApp() {
  const [activeTab, setActiveTab] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tickerMap, setTickerMap] = useState<Record<string, string>>({});
  const [unmappedNames, setUnmappedNames] = useState<UnmappedName[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const [pendingAccount, setPendingAccount] = useState("");
  const [loadingDB, setLoadingDB] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [tickerSearch, setTickerSearch] = useState("");
  const [tickerPage, setTickerPage] = useState(0);
  const [checkedTxIds, setCheckedTxIds] = useState<Set<number>>(new Set());
  const [txAccountFilter, setTxAccountFilter] = useState("전체");
  const [selectedMacroIds, setSelectedMacroIds] = useState<Set<string>>(new Set(DEFAULT_SELECTED_MACRO));
  const [macroRegionFilter, setMacroRegionFilter] = useState("전체");
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [portfolioModal, setPortfolioModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [portfolioTickers, setPortfolioTickers] = useState<Set<string>>(new Set());
  const [portfolioTargetWeights, setPortfolioTargetWeights] = useState<Record<string, number>>({});
  const [pfCategoryFilter, setPfCategoryFilter] = useState("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [txs, maps, pfls] = await Promise.all([
          dbGetAll<Transaction>("transactions"),
          dbGetAll<{ name: string; ticker: string }>("tickerMap"),
          dbGetAll<Portfolio>("portfolios"),
        ]);
        setTransactions(txs);
        const tm: Record<string, string> = {};
        maps.forEach((m) => { tm[m.name] = m.ticker; });
        setTickerMap(tm);
        if (pfls.length) setPortfolios(pfls);
      } catch (e) { console.error("DB load error", e); }
      setLoadingDB(false);
    })();
  }, []);

  const holdings = useMemo(() => buildHoldings(transactions), [transactions]);
  const activeHoldings = useMemo(() => Object.values(holdings).filter((h) => h.qty > 0), [holdings]);
  const closedHoldings = useMemo(() => Object.values(holdings).filter((h) => h.qty === 0 && h.realizedPnL !== 0), [holdings]);
  const allAccounts = useMemo(() => ["전체", ...new Set(transactions.map((t) => t.account).filter(Boolean))], [transactions]);
  const totalCost = useMemo(() => activeHoldings.reduce((s, h) => s + h.totalCost, 0), [activeHoldings]);
  const totalMarketValue = useMemo(() => activeHoldings.reduce((s, h) => s + (currentPrices[h.ticker] || h.avgCost) * h.qty, 0), [activeHoldings, currentPrices]);
  const totalUnrealizedPnL = totalMarketValue - totalCost;
  const totalRealizedPnL = useMemo(() => Object.values(holdings).reduce((s, h) => s + h.realizedPnL, 0), [holdings]);
  const activeIndicators = useMemo(() => ALL_MACRO_INDICATORS.filter((m) => selectedMacroIds.has(m.indicator)), [selectedMacroIds]);
  const macroRegions = useMemo(() => ["전체", ...new Set(ALL_MACRO_INDICATORS.map((m) => m.region))], []);
  const filteredMacroList = useMemo(() => macroRegionFilter === "전체" ? ALL_MACRO_INDICATORS : ALL_MACRO_INDICATORS.filter((m) => m.region === macroRegionFilter), [macroRegionFilter]);
  const allPortfolioStats = useMemo(() => portfolios.map((pfl) => {
    const phTickers = new Set(pfl.tickers);
    const ph = activeHoldings.filter((h) => phTickers.has(h.ticker));
    const totalCostP = ph.reduce((s, h) => s + h.totalCost, 0);
    const totalMV = ph.reduce((s, h) => s + (currentPrices[h.ticker] || h.avgCost) * h.qty, 0);
    const pnl = totalMV - totalCostP;
    const pnlPctVal = totalCostP > 0 ? pnl / totalCostP : 0;
    const allTxs = ph.flatMap((h) => h.transactions);
    const firstDate = allTxs.map((t) => t.date).filter(Boolean).sort()[0];
    const yearsSince = firstDate ? (Date.now() - new Date(firstDate).getTime()) / (365.25 * 24 * 3600 * 1000) : 1;
    const cagr = totalCostP > 0 && yearsSince > 0 ? Math.pow(Math.max(0.0001, totalMV / totalCostP), 1 / yearsSince) - 1 : 0;
    const rebalanceResult = pfl.targetWeights && Object.keys(pfl.targetWeights).length
      ? ph.map((h) => { const targetPct = pfl.targetWeights[h.ticker] || 0; const price = currentPrices[h.ticker] || h.avgCost; const curMV = h.qty * price; const curW = totalMV > 0 ? (curMV / totalMV) * 100 : 0; const diff = (totalMV * targetPct) / 100 - curMV; return { ...h, curW, targetW: targetPct, diff, diffQty: price > 0 ? Math.round(diff / price) : 0, action: diff > 0 ? "BUY" : "SELL" }; })
      : null;
    return { ...pfl, ph, totalCostP, totalMV, pnl, pnlPct: pnlPctVal, cagr, rebalanceResult };
  }).sort((a, b) => b.pnlPct - a.pnlPct), [portfolios, activeHoldings, currentPrices]);
  const activePortfolioStats = useMemo(() => allPortfolioStats.find((p) => p.id === activePortfolioId) || null, [allPortfolioStats, activePortfolioId]);

  const processData = useCallback((headers: string[], rows: unknown[][], acct: string) => {
    const { txs, unmapped } = processRawData(headers, rows, tickerMap, acct);
    setUnmappedNames((prev) => { const ex = new Set(prev.map((u) => u.name)); return [...prev, ...unmapped.filter((u) => !ex.has(u.name))]; });
    setTransactions((prev) => { const newTxs = [...prev, ...txs]; dbPutAll("transactions", txs).catch(console.error); return newTxs; });
    setPasteMsg(`${txs.length}건 추가 완료${unmapped.length ? ` (${unmapped.length}건 티커 미확인)` : ""}`);
    setTimeout(() => setPasteMsg(""), 4000);
  }, [tickerMap]);

  const handlePaste = useCallback(() => {
    const text = pasteText.trim();
    if (!text) return;
    const parsed = parseTSV(text);
    if (parsed) { processData(parsed.headers, parsed.rows, pendingAccount || "붙여넣기"); setPasteText(""); }
    else setPasteMsg("파싱 실패: 헤더 포함 TSV/CSV를 붙여넣어 주세요.");
  }, [pasteText, pendingAccount, processData]);

  const handleFileDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = ('dataTransfer' in e ? e.dataTransfer?.files?.[0] : (e.target as HTMLInputElement)?.files?.[0]);
    if (!file) return;
    const acct = pendingAccount || file.name.replace(/\.[^.]+$/, "");
    try {
      if (file.name.match(/\.(xlsx|xls)$/i)) { const d = await parseExcelFile(file); processData(d.headers, d.rows as unknown[][], acct); }
      else { const text = await file.text(); const p = parseTSV(text); if (p) processData(p.headers, p.rows, acct); else setPasteMsg("파일 파싱 실패"); }
    } catch (err) { setPasteMsg(`파일 오류: ${err}`); }
  }, [pendingAccount, processData]);

  const applyTickerMap = useCallback((name: string, ticker: string) => {
    const updated = { ...tickerMap, [name]: ticker };
    setTickerMap(updated);
    dbPutAll("tickerMap", Object.entries(updated).map(([n, t]) => ({ name: n, ticker: t }))).catch(console.error);
    setTransactions((prev) => { const up = prev.map((tx) => tx.name === name && !tx.ticker ? { ...tx, ticker } : tx); dbPutAll("transactions", up).catch(console.error); return up; });
    setUnmappedNames((prev) => prev.filter((u) => u.name !== name));
  }, [tickerMap]);

  const toggleCheckedTx = (id: number) => setCheckedTxIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filteredTxs = useMemo(() => { const base = txAccountFilter === "전체" ? transactions : transactions.filter((t) => t.account === txAccountFilter); return [...base].reverse(); }, [transactions, txAccountFilter]);
  const toggleAllTx = () => checkedTxIds.size === filteredTxs.length ? setCheckedTxIds(new Set()) : setCheckedTxIds(new Set(filteredTxs.map((t) => t.id)));
  const deleteCheckedTx = async () => {
    if (!checkedTxIds.size || !confirm(`선택한 ${checkedTxIds.size}건을 삭제하시겠습니까?`)) return;
    setTransactions((prev) => { const next = prev.filter((t) => !checkedTxIds.has(t.id)); dbClear("transactions").then(() => dbPutAll("transactions", next)).catch(console.error); return next; });
    setCheckedTxIds(new Set());
  };

  const sortedClosedByDate = useMemo(() => [...closedHoldings].sort((a, b) => (b.lastSellDate || "").localeCompare(a.lastSellDate || "")), [closedHoldings]);
  const tickerListAll = useMemo(() => {
    const q = tickerSearch.toLowerCase();
    const allItems = [...activeHoldings.map((h) => ({ ...h, _active: true })), ...sortedClosedByDate.map((h) => ({ ...h, _active: false }))];
    return q ? allItems.filter((h) => h.name?.toLowerCase().includes(q) || (h.ticker || "").toLowerCase().includes(q)) : allItems;
  }, [activeHoldings, sortedClosedByDate, tickerSearch]);
  const tickerPages = Math.ceil(tickerListAll.length / TICKER_PAGE_SIZE);
  const tickerPageItems = tickerListAll.slice(tickerPage * TICKER_PAGE_SIZE, (tickerPage + 1) * TICKER_PAGE_SIZE);

  const savePortfolio = () => {
    if (!newPortfolioName.trim() || !portfolioTickers.size) return;
    const pfl: Portfolio = { id: Date.now().toString(), name: newPortfolioName.trim(), tickers: [...portfolioTickers], targetWeights: portfolioTargetWeights, createdAt: new Date().toISOString() };
    const updated = [...portfolios, pfl];
    setPortfolios(updated);
    dbPutAll("portfolios", updated).catch(console.error);
    setPortfolioModal(false); setNewPortfolioName(""); setPortfolioTickers(new Set()); setPortfolioTargetWeights({});
  };
  const deletePortfolio = (id: string) => {
    const updated = portfolios.filter((p) => p.id !== id);
    setPortfolios(updated); dbDelete("portfolios", id).catch(console.error);
    if (activePortfolioId === id) setActivePortfolioId(null);
  };

  const assetClassBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    activeHoldings.forEach((h) => { const cls = h.assetClass || "KR_STOCK"; if (!groups[cls]) groups[cls] = 0; groups[cls] += (currentPrices[h.ticker] || h.avgCost) * h.qty; });
    return Object.entries(groups).map(([cls, val]) => ({ label: ASSET_CLASS_LABEL[cls] || cls, value: val, color: ASSET_COLORS[cls] || "#888" }));
  }, [activeHoldings, currentPrices]);
  const portfolioFilteredHoldings = useMemo(() => pfCategoryFilter === "ALL" ? activeHoldings : activeHoldings.filter((h) => h.assetClass === pfCategoryFilter), [activeHoldings, pfCategoryFilter]);

  if (loadingDB)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">데이터 로딩 중...</span>
        </div>
      </div>
    );

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm px-6 flex items-center justify-between h-[54px] sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-[13px] font-black text-primary-foreground shrink-0 shadow-sm">W</div>
          <span className="text-xs font-bold text-foreground tracking-widest">WAY TO PARADISE</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground/70 hover:text-foreground hover:bg-muted transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          파일 업로드
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="hidden" onChange={handleFileDrop} />
      </header>

      {/* ── Tabs ── */}
      <nav className="border-b border-border bg-card px-4 flex overflow-x-auto shadow-sm">
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[i];
          return (
            <button
              key={t}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs whitespace-nowrap tracking-wide transition-all border-b-2 font-medium ${
                activeTab === i
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              }`}
              onClick={() => setActiveTab(i)}
            >
              <Icon className="w-3.5 h-3.5" />
              {t}
            </button>
          );
        })}
      </nav>

      {/* ── Alerts ── */}
      {unmappedNames.length > 0 && (
        <div className="mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="text-[10px] text-amber-700 mb-2 font-semibold">티커 미매핑 종목 ({unmappedNames.length}건)</div>
          <div className="flex flex-wrap gap-2">
            {unmappedNames.map((u) => (
              <div key={u.name} className="flex items-center gap-1.5">
                <span className="text-xs text-amber-900/70">{u.name}</span>
                <input
                  placeholder="티커"
                  value={u.ticker || ""}
                  onChange={(e) => setUnmappedNames((p) => p.map((x) => x.name === u.name ? { ...x, ticker: e.target.value } : x))}
                  className="bg-white border border-amber-200 rounded-md px-2 py-0.5 text-foreground text-[11px] w-24 focus:border-primary/50 transition-colors"
                />
                <button
                  className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-0.5 text-primary text-[10px] hover:bg-primary/20 transition-colors"
                  onClick={() => applyTickerMap(u.name, u.ticker)}
                >
                  <Check className="w-3 h-3" />적용
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {pasteMsg && (
        <div className={`mx-6 mt-2 rounded-xl px-4 py-2.5 text-[11px] border font-medium ${
          pasteMsg.includes("완료") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {pasteMsg}
        </div>
      )}

      <main className="p-6">

        {/* ══ DASHBOARD ══ */}
        {activeTab === 0 && (
          <div className="flex flex-col gap-5">
            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "총 평가금액", value: `₩${fmt(totalMarketValue)}` },
                { label: "총 매입금액", value: `₩${fmt(totalCost)}` },
                { label: "평가손익", value: `${totalUnrealizedPnL >= 0 ? "+" : ""}₩${fmt(totalUnrealizedPnL)}`, sub: fmtPct(totalCost > 0 ? totalUnrealizedPnL / totalCost : 0), c: pnlColor(totalUnrealizedPnL) },
                { label: "실현손익 누계", value: `${totalRealizedPnL >= 0 ? "+" : ""}₩${fmt(totalRealizedPnL)}`, c: pnlColor(totalRealizedPnL) },
              ].map(({ label, value, sub, c }) => (
                <div key={label} className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-2">{label}</div>
                  <div className="text-lg font-bold tabular-nums font-mono" style={{ color: c || "#1a1d23" }}>{value}</div>
                  {sub && <div className="text-xs mt-1 font-mono font-semibold" style={{ color: c }}>{sub}</div>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_300px] gap-5">
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm min-w-0">
                <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-4">보유 종목</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-[10px] border-b border-border">
                        {["종목", "수량", "평균단가", "평가금액", "손익", "수익률"].map((h) => (
                          <th key={h} className="px-3 py-2 text-right font-semibold whitespace-nowrap tracking-wide first:text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeHoldings.sort((a, b) => (currentPrices[b.ticker] || b.avgCost) * b.qty - (currentPrices[a.ticker] || a.avgCost) * a.qty).map((h) => {
                        const price = currentPrices[h.ticker] || h.avgCost;
                        const mv = h.qty * price;
                        const pnl = mv - h.totalCost;
                        const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                        return (
                          <tr key={h.ticker} className="border-t border-border/60 hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => { setSelectedTicker(h.ticker); setActiveTab(2); setTickerSearch(""); setTickerPage(0); }}>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-foreground">{displayName(h)}</div>
                              <div className="text-[10px] text-muted-foreground">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono">{fmt(h.qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono">{h.currency === "USD" ? "$" : "₩"}{fmt(h.avgCost, 1)}</td>
                            <td className="px-3 py-2.5 text-right text-foreground tabular-nums font-mono">₩{fmt(mv)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}₩{fmt(pnl)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono font-semibold" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!activeHoldings.length && (
                    <div className="px-5 py-12 text-center">
                      <FileSpreadsheet className="w-9 h-9 mx-auto mb-3 text-muted-foreground/20" />
                      <div className="text-sm text-muted-foreground font-medium mb-1">아직 거래 내역이 없습니다</div>
                      <div className="text-[11px] text-muted-foreground/60 leading-relaxed">우측 <span className="text-primary font-medium">데이터 입력</span> 패널에서<br />HTS 화면을 복사/붙여넣기 하거나 파일을 드롭하세요</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                  <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-3">자산 배분</div>
                  <div className="flex items-center gap-4">
                    <DonutChart segments={assetClassBreakdown} size={84} />
                    <div className="flex flex-col gap-1.5">
                      {assetClassBreakdown.map(({ label, value, color }) => (
                        <div key={label} className="flex items-center gap-2 text-[11px]">
                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-foreground ml-auto tabular-nums font-mono font-medium">
                            {totalMarketValue > 0 ? `${((value / totalMarketValue) * 100).toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                  <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-3">데이터 입력</div>
                  <label className="flex flex-col gap-1 mb-3">
                    <span className="text-[10px] text-muted-foreground">계좌명 (선택)</span>
                    <input value={pendingAccount} onChange={(e) => setPendingAccount(e.target.value)} placeholder="예: MTS 위탁계좌" className="bg-secondary border border-border rounded-xl px-3 py-2 text-foreground text-[11px] focus:border-primary/60 transition-colors outline-none" />
                  </label>
                  <div
                    className="border-2 border-dashed border-border rounded-2xl p-4 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/30"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-accent/40"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-accent/40"); }}
                    onDrop={(e) => { e.currentTarget.classList.remove("border-primary", "bg-accent/40"); handleFileDrop(e); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/40" />
                    <div className="text-[10px] text-muted-foreground">xlsx / csv / tsv 드롭</div>
                  </div>
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"HTS Ctrl+C 후 붙여넣기\n(TSV / CSV 모두 지원)"} className="mt-3 w-full h-[68px] bg-secondary border border-border rounded-xl p-2.5 text-foreground text-[11px] resize-y focus:border-primary/60 transition-colors outline-none" />
                  <button className="mt-2 w-full flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors" onClick={handlePaste}>
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    파싱 및 적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {activeTab === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex gap-2 flex-wrap flex-1">
                {allAccounts.map((a) => (
                  <button key={a} className={`px-3 py-1.5 rounded-xl text-[11px] border font-medium transition-all ${txAccountFilter === a ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`} onClick={() => { setTxAccountFilter(a); setCheckedTxIds(new Set()); }}>
                    {a}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums font-mono">{filteredTxs.length}건</span>
              {checkedTxIds.size > 0 && (
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors font-medium" onClick={deleteCheckedTx}>
                  <Trash2 className="w-3 h-3" />선택 삭제 ({checkedTxIds.size})
                </button>
              )}
            </div>
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-card z-[2] border-b border-border">
                    <tr className="text-muted-foreground text-[10px]">
                      <th className="px-4 py-3 text-center w-8"><input type="checkbox" className="w-3.5 h-3.5 cursor-pointer" checked={checkedTxIds.size === filteredTxs.length && filteredTxs.length > 0} onChange={toggleAllTx} /></th>
                      {["날짜", "계좌", "종목", "티커", "유형", "수량", "단가", "금액(원)", "수수료", "세금", "통화"].map((h) => (
                        <th key={h} className="px-3 py-3 text-right font-semibold tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => {
                      const tc = TX_TYPE_COLORS[tx.txType] || { bg: "#f0f2f5", text: "#8c95a6" };
                      return (
                        <tr key={tx.id} className={`border-t border-border/50 transition-colors ${checkedTxIds.has(tx.id) ? "bg-accent/40" : "hover:bg-secondary/40"}`}>
                          <td className="px-4 py-2 text-center"><input type="checkbox" className="w-3.5 h-3.5 cursor-pointer" checked={checkedTxIds.has(tx.id)} onChange={() => toggleCheckedTx(tx.id)} /></td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-[11px] tabular-nums font-mono">{tx.date}</td>
                          <td className="px-3 py-2 text-muted-foreground text-[10px] whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">{tx.account || "—"}</td>
                          <td className="px-3 py-2 text-foreground/80 whitespace-nowrap font-medium">{tx.name}</td>
                          <td className="px-3 py-2 text-info font-mono font-semibold">{tx.ticker || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] whitespace-nowrap font-semibold" style={{ background: tc.bg, color: tc.text }}>{tx.txType}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-mono">{tx.qty ? fmt(tx.qty) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-mono">{tx.price ? fmt(tx.price, 2) : "—"}</td>
                          <td className="px-3 py-2 text-right text-foreground tabular-nums font-mono font-medium">₩{fmt(tx.amountKRW)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums font-mono">{tx.fee ? fmt(tx.fee, 2) : "—"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums font-mono">{tx.tax ? fmt(tx.tax, 2) : "—"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{tx.currency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredTxs.length && (
                  <div className="px-5 py-14 text-center">
                    <ClipboardPaste className="w-9 h-9 mx-auto mb-3 text-muted-foreground/20" />
                    <div className="text-sm text-muted-foreground font-medium">{txAccountFilter === "전체" ? "거래 내역이 없습니다" : `'${txAccountFilter}' 계좌의 거래 내역이 없습니다`}</div>
                    <div className="text-[11px] text-muted-foreground/50 mt-1.5">대시보드 탭에서 데이터를 입력하세요</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ STOCK ANALYSIS ══ */}
        {activeTab === 2 && (
          <div className="flex gap-5">
            <div className="w-[200px] shrink-0 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={tickerSearch} onChange={(e) => { setTickerSearch(e.target.value); setTickerPage(0); }} placeholder="종목 검색..." className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-foreground text-[11px] focus:border-primary/60 transition-colors outline-none shadow-sm" />
              </div>
              {tickerPageItems.filter((h) => h._active).length > 0 && (
                <div className="text-[10px] font-semibold text-primary px-1 tracking-wide">보유중</div>
              )}
              {tickerPageItems.filter((h) => h._active).map((h) => (
                <button key={h.ticker} onClick={() => setSelectedTicker(h.ticker)} className={`rounded-xl px-3 py-2.5 text-left cursor-pointer transition-all border shadow-sm ${selectedTicker === h.ticker ? "bg-primary/10 border-primary/40" : "bg-card border-border hover:border-primary/30 hover:bg-secondary/50"}`}>
                  <div className={`text-xs font-semibold ${selectedTicker === h.ticker ? "text-primary" : "text-foreground"}`}>{displayName(h)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{ASSET_CLASS_LABEL[h.assetClass] || ""}</div>
                </button>
              ))}
              {!tickerSearch && tickerPageItems.filter((h) => !h._active).length > 0 && (
                <div className="text-[10px] font-semibold text-muted-foreground/70 px-1 tracking-wide mt-1">청산 종목</div>
              )}
              {tickerPageItems.filter((h) => !h._active).map((h) => (
                <button key={h.ticker} onClick={() => setSelectedTicker(h.ticker)} className={`rounded-xl px-3 py-2.5 text-left cursor-pointer transition-all border opacity-70 ${selectedTicker === h.ticker ? "bg-secondary border-border" : "bg-card border-border/50 hover:border-border"}`}>
                  <div className="text-[11px] font-semibold text-muted-foreground">{displayName(h)}</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">{h.lastSellDate} 청산</div>
                </button>
              ))}
              {tickerListAll.length === 0 && (
                <div className="px-1 py-6 text-center">
                  <Search className="w-6 h-6 mx-auto mb-2 text-muted-foreground/20" />
                  <div className="text-[11px] text-muted-foreground/50 leading-relaxed">거래 내역을 먼저<br />입력해 주세요</div>
                </div>
              )}
              {tickerPages > 1 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <button className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-colors" disabled={tickerPage === 0} onClick={() => setTickerPage((p) => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="text-[10px] text-muted-foreground flex-1 text-center tabular-nums font-mono">{tickerPage + 1}/{tickerPages}</span>
                  <button className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-colors" disabled={tickerPage >= tickerPages - 1} onClick={() => setTickerPage((p) => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {!selectedTicker && (
                <div className="text-muted-foreground/40 p-10 text-center text-sm">좌측에서 종목을 선택하세요</div>
              )}
              {selectedTicker && holdings[selectedTicker] && (() => {
                const h = holdings[selectedTicker];
                const price = currentPrices[h.ticker] || h.avgCost;
                const mv = h.qty * price;
                const pnl = mv - h.totalCost;
                const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                const txHistory = [...h.transactions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
                let cumCost = 0;
                const histData = txHistory.map((tx) => { if (tx.txType === TX_TYPE.BUY) cumCost += tx.amount; else if (tx.txType === TX_TYPE.SELL) cumCost -= h.avgCost * tx.qty; return { value: Math.max(0, cumCost) }; });
                const prices = txHistory.filter((t) => t.price > 0).map((t) => t.price);
                const maxP = prices.length ? Math.max(...prices) : h.avgCost;
                const minP = prices.length ? Math.min(...prices) : h.avgCost;
                const mfe = h.avgCost > 0 ? (maxP - h.avgCost) / h.avgCost : 0;
                const mae = h.avgCost > 0 ? (minP - h.avgCost) / h.avgCost : 0;
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                      <div className="mb-1">
                        <span className="text-base font-bold text-foreground">{displayName(h)}</span>
                        {h.qty === 0 && <span className="text-[11px] text-muted-foreground ml-2 bg-secondary px-2 py-0.5 rounded-full">청산</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-4">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name} · {ASSET_CLASS_LABEL[h.assetClass] || ""}</div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: "보유수량", value: `${fmt(h.qty)}주` },
                          { label: "평균단가", value: `${h.currency === "USD" ? "$" : "₩"}${fmt(h.avgCost, 1)}` },
                          { label: "매입금액", value: `₩${fmt(h.totalCost)}` },
                          { label: "평가금액", value: `₩${fmt(mv)}` },
                          { label: "평가손익", value: `${pnl >= 0 ? "+" : ""}₩${fmt(pnl)}`, c: pnlColor(pnl) },
                          { label: "수익률", value: fmtPct(pnlPctVal), c: pnlColor(pnlPctVal) },
                          { label: "실현손익", value: `${h.realizedPnL >= 0 ? "+" : ""}₩${fmt(h.realizedPnL)}`, c: pnlColor(h.realizedPnL) },
                          { label: "배당수령", value: `${h.currency === "USD" ? "$" : "₩"}${fmt(h.dividends, 2)}` },
                        ].map(({ label, value, c }) => (
                          <div key={label} className="bg-secondary rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</div>
                            <div className="text-[13px] font-semibold tabular-nums font-mono" style={{ color: c || "#1a1d23" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-3 tracking-wide">MFE / MAE (거래 체결가 기준)</div>
                        <div className="flex gap-2.5">
                          <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-muted-foreground mb-1">MFE 최대수익폭</div>
                            <div className="text-lg font-bold text-positive tabular-nums font-mono">+{(mfe * 100).toFixed(2)}%</div>
                            <div className="text-[9px] text-muted-foreground/70 tabular-nums font-mono">{h.currency === "USD" ? "$" : "₩"}{fmt(maxP, 1)}</div>
                          </div>
                          <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                            <div className="text-[10px] text-muted-foreground mb-1">MAE 최대손실폭</div>
                            <div className="text-lg font-bold text-negative tabular-nums font-mono">{(mae * 100).toFixed(2)}%</div>
                            <div className="text-[9px] text-muted-foreground/70 tabular-nums font-mono">{h.currency === "USD" ? "$" : "₩"}{fmt(minP, 1)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-2.5 tracking-wide">투자금 추이</div>
                        <LineChart data={histData} height={80} />
                      </div>
                      <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-2.5 tracking-wide">거래 이력 ({txHistory.length}건)</div>
                        <div className="max-h-[180px] overflow-y-auto">
                          {txHistory.map((tx, i) => {
                            const tc = TX_TYPE_COLORS[tx.txType] || { text: "#8c95a6" };
                            return (
                              <div key={i} className={`flex justify-between items-center py-2 gap-2 text-[11px] ${i ? "border-t border-border/60" : ""}`}>
                                <span className="text-muted-foreground whitespace-nowrap text-[10px] tabular-nums font-mono">{tx.date}</span>
                                <span className="text-[10px] font-semibold" style={{ color: tc.text }}>{tx.txType}</span>
                                <span className="text-muted-foreground/70 tabular-nums font-mono">{tx.qty > 0 ? `${fmt(tx.qty)}주` : ""}</span>
                                <span className="text-foreground tabular-nums font-mono font-medium">₩{fmt(tx.amountKRW)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ══ PORTFOLIO ══ */}
        {activeTab === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">포트폴리오</span>
              {portfolios.map((p) => (
                <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all border shadow-sm ${activePortfolioId === p.id ? "bg-primary/10 border-primary/40" : "bg-card border-border hover:border-primary/30"}`} onClick={() => setActivePortfolioId(p.id)}>
                  <span className={`text-xs font-medium ${activePortfolioId === p.id ? "text-primary" : "text-foreground/80"}`}>{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.tickers.length}종목</span>
                  <button className="text-muted-foreground/40 hover:text-negative transition-colors" onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id); }}><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-semibold hover:brightness-105 transition-all shadow-sm" onClick={() => setPortfolioModal(true)}>
                <Plus className="w-3.5 h-3.5" />포트폴리오 생성
              </button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">카테고리</span>
              <button className={`px-3 py-1 rounded-full text-[10px] border font-medium transition-all ${pfCategoryFilter === "ALL" ? "bg-foreground text-card border-foreground" : "bg-card border-border text-muted-foreground hover:border-foreground/30"}`} onClick={() => setPfCategoryFilter("ALL")}>전체</button>
              {PORTFOLIO_CATEGORIES.map((cat) => {
                const cnt = activeHoldings.filter((h) => h.assetClass === cat.key).length;
                if (!cnt) return null;
                return (
                  <button key={cat.key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border font-medium transition-all ${pfCategoryFilter === cat.key ? "opacity-100" : "opacity-60 hover:opacity-80"}`} style={{ color: cat.color, borderColor: pfCategoryFilter === cat.key ? cat.color : "#e4e7ed", background: pfCategoryFilter === cat.key ? `${cat.color}15` : "" }} onClick={() => setPfCategoryFilter(cat.key)}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />{cat.label} ({cnt})
                  </button>
                );
              })}
            </div>
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-4">보유 종목 현황 — 현재 시세 입력</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-[10px] border-b border-border">
                      {["카테고리", "종목", "수량", "평균단가", "현재시세 (입력)", "평가금액", "손익", "수익률", "비중"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-right font-semibold tracking-wide whitespace-nowrap first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioFilteredHoldings.sort((a, b) => (currentPrices[b.ticker] || b.avgCost) * b.qty - (currentPrices[a.ticker] || a.avgCost) * a.qty).map((h) => {
                      const price = currentPrices[h.ticker] || h.avgCost;
                      const mv = h.qty * price;
                      const pnl = mv - h.totalCost;
                      const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                      const wt = totalMarketValue > 0 ? (mv / totalMarketValue) * 100 : 0;
                      const cat = PORTFOLIO_CATEGORIES.find((c) => c.key === h.assetClass) || { label: "—", color: "#8c95a6" };
                      return (
                        <tr key={h.ticker} className="border-t border-border/60 hover:bg-secondary/40 transition-colors">
                          <td className="px-3 py-3"><span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold" style={{ background: `${cat.color}18`, color: cat.color }}>{cat.label}</span></td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold text-foreground">{displayName(h)}</div>
                            <div className="text-[10px] text-muted-foreground">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-mono">{fmt(h.qty)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground tabular-nums font-mono">{h.currency === "USD" ? "$" : "₩"}{fmt(h.avgCost, 1)}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-muted-foreground">{h.currency === "USD" ? "$" : "₩"}</span>
                              <input type="number" value={currentPrices[h.ticker] || ""} placeholder={String(Math.round(h.avgCost))} onChange={(e) => setCurrentPrices((p) => ({ ...p, [h.ticker]: parseFloat(e.target.value) || 0 }))} className="bg-secondary border border-border rounded-xl px-2 py-1.5 text-foreground text-xs w-[90px] text-right focus:border-primary/60 transition-colors outline-none tabular-nums font-mono" />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-foreground tabular-nums font-mono font-medium">₩{fmt(mv)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-mono" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}₩{fmt(pnl)}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-mono font-semibold" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-9 h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, wt * 3)}%`, background: ASSET_COLORS[h.assetClass] || "#22a862" }} />
                              </div>
                              <span className="text-[11px] tabular-nums font-mono">{wt.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!portfolioFilteredHoldings.length && (
                      <tr><td colSpan={9} className="px-5 py-12 text-center text-muted-foreground/40 text-sm">{pfCategoryFilter === "ALL" ? "보유 종목이 없습니다" : `'${ASSET_CLASS_LABEL[pfCategoryFilter]}' 카테고리에 보유 종목이 없습니다`}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {activePortfolioStats && (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-base font-bold text-foreground">{activePortfolioStats.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{activePortfolioStats.tickers.length}종목 · {activePortfolioStats.createdAt?.slice(0, 10)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "포트폴리오 가치", value: `₩${fmt(activePortfolioStats.totalMV)}` },
                    { label: "평가손익", value: `${activePortfolioStats.pnl >= 0 ? "+" : ""}₩${fmt(activePortfolioStats.pnl)}`, c: pnlColor(activePortfolioStats.pnl) },
                    { label: "누적 수익률", value: fmtPct(activePortfolioStats.pnlPct), c: pnlColor(activePortfolioStats.pnlPct) },
                    { label: "연평균 CAGR", value: fmtPct(activePortfolioStats.cagr), c: pnlColor(activePortfolioStats.cagr) },
                  ].map(({ label, value, c }) => (
                    <div key={label} className="bg-secondary rounded-xl p-3.5">
                      <div className="text-[10px] text-muted-foreground font-medium mb-1.5">{label}</div>
                      <div className="text-[15px] font-bold tabular-nums font-mono" style={{ color: c || "#1a1d23" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-[10px] border-b border-border">
                        {["종목", "수량", "평균단가", "평가금액", "손익", "수익률", "비중"].map((h) => <th key={h} className="px-3 py-2 text-right font-semibold tracking-wide first:text-left">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {activePortfolioStats.ph.map((h: Holding) => {
                        const price = currentPrices[h.ticker] || h.avgCost;
                        const mv = h.qty * price;
                        const pnl = mv - h.totalCost;
                        const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                        const wt = activePortfolioStats.totalMV > 0 ? (mv / activePortfolioStats.totalMV) * 100 : 0;
                        return (
                          <tr key={h.ticker} className="border-t border-border/60 hover:bg-secondary/40 transition-colors">
                            <td className="px-3 py-2.5"><div className="font-semibold text-foreground">{displayName(h)}</div><div className="text-[10px] text-muted-foreground">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div></td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono">{fmt(h.qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono">{h.currency === "USD" ? "$" : "₩"}{fmt(h.avgCost, 1)}</td>
                            <td className="px-3 py-2.5 text-right text-foreground tabular-nums font-mono font-medium">₩{fmt(mv)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}₩{fmt(pnl)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono font-semibold" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-10 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, wt)}%` }} /></div>
                                <span className="tabular-nums font-mono">{wt.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {activePortfolioStats.rebalanceResult && (
                  <div className="mt-5">
                    <div className="text-[10px] font-semibold text-muted-foreground mb-3 tracking-widest uppercase">리밸런싱 지시</div>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="text-muted-foreground text-[10px] border-b border-border">
                          {["종목", "현재비중", "목표비중", "조정금액", "수량", "액션"].map((h) => <th key={h} className="px-3 py-2 text-right font-semibold tracking-wide first:text-left">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {activePortfolioStats.rebalanceResult.map((r: Holding & { curW: number; targetW: number; diff: number; diffQty: number; action: string }) => (
                          <tr key={r.ticker} className="border-t border-border/60 hover:bg-secondary/40 transition-colors">
                            <td className="px-3 py-2.5"><div className="font-semibold text-foreground">{displayName(r)}</div></td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono">{r.curW.toFixed(1)}%</td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums font-mono">{r.targetW}%</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono" style={{ color: pnlColor(r.diff) }}>{r.diff >= 0 ? "+" : ""}₩{fmt(r.diff)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-mono" style={{ color: pnlColor(r.diff) }}>{r.diffQty >= 0 ? "+" : ""}{r.diffQty}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: r.action === "BUY" ? "#dcfce7" : "#fee2e2", color: r.action === "BUY" ? "#15803d" : "#dc2626" }}>{r.action}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ MACRO ══ */}
        {activeTab === 4 && (
          <div className="flex flex-col gap-4">
            <MacroWeatherWidget activeIndicators={activeIndicators} />
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">지표 선택 ({selectedMacroIds.size}개 활성)</span>
                {macroRegions.map((r) => (
                  <button key={r} className={`px-3 py-1.5 rounded-xl text-[10px] border font-medium transition-all ${macroRegionFilter === r ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`} onClick={() => setMacroRegionFilter(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredMacroList.map((m) => {
                  const isActive = selectedMacroIds.has(m.indicator);
                  const z = calcZScore(m.value, m.mean, m.stddev);
                  const w = weatherFromZScore(z, m.positiveIsGood);
                  return (
                    <div
                      key={m.indicator}
                      className={`inline-flex items-start gap-1.5 px-3 py-2 rounded-xl text-[11px] border cursor-pointer transition-all ${isActive ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                      onClick={() => setSelectedMacroIds((prev) => { const n = new Set(prev); n.has(m.indicator) ? n.delete(m.indicator) : n.add(m.indicator); return n; })}
                      title={m.description}
                    >
                      <span className="text-sm">{WEATHER_ICONS[w]}</span>
                      <div>
                        <div className="text-[11px] font-medium">{m.label}</div>
                        <div className="text-[10px] opacity-70 font-mono">{m.value}{m.unit} · Z:{z.toFixed(1)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {activeIndicators.length > 0 && (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="text-[10px] font-semibold text-muted-foreground mb-4 tracking-widest uppercase">선택 지표 Z-Score (가중치 적용, 호재 방향 기준)</div>
                <HorizBarChart data={activeIndicators.map((m) => ({ label: m.label, value: calcZScore(m.value, m.mean, m.stddev) * (m.positiveIsGood ? 1 : -1) * m.weight }))} />
                <div className="text-[10px] text-muted-foreground/50 mt-3">※ 양수(초록) = 시장에 호재 방향. 가중치 적용 Z점수.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ RETIREMENT ══ */}
        {activeTab === 5 && (
          <div className="flex flex-col gap-5">
            <RetirementPlanner totalPortfolioValue={totalMarketValue} />
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-4">포트폴리오 수익률 TOP 5</div>
                {allPortfolioStats.length === 0 && <div className="text-muted-foreground/40 text-xs">포트폴리오를 먼저 생성해 주세요</div>}
                {allPortfolioStats.slice(0, 5).map((p) => (
                  <div key={p.id} onClick={() => { setActivePortfolioId(p.id); setActiveTab(3); }} className="flex items-center gap-3 bg-secondary rounded-xl px-3.5 py-3 mb-2 cursor-pointer border border-transparent hover:border-border transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.tickers.length}종목 · CAGR {fmtPct(p.cagr)}</div>
                    </div>
                    <div className="shrink-0">
                      <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(p.pnlPct) * 150)}%`, background: pnlColor(p.pnlPct) }} />
                      </div>
                      <div className="text-[13px] font-bold text-right tabular-nums font-mono" style={{ color: pnlColor(p.pnlPct) }}>{fmtPct(p.pnlPct)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-4">운영 안내</div>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground/80 leading-relaxed">
                  {[
                    { label: "저축 증액 플랜", text: "N년마다 M만원씩 저축액을 높여 복리 효과를 극대화합니다", color: "#22a862" },
                    { label: "물가상승률 2.5%", text: "은퇴 후 월 생활비를 물가 반영 실질가치로 자동 환산합니다", color: "#f59e0b" },
                    { label: "은퇴 후 수익률", text: "보수적 운용 가정, 안전 인출률 4% Rule 기반 설계 권장", color: "#3b82f6" },
                    { label: "로컬 저장", text: "모든 데이터 IndexedDB 저장, 외부 서버 전송 없음", color: "#8b5cf6" },
                  ].map(({ label, text, color }) => (
                    <div key={label} className="bg-secondary rounded-xl px-3.5 py-3">
                      <span className="font-semibold" style={{ color }}>{label}</span>
                      <span className="text-foreground/60">: {text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Portfolio modal ── */}
      {portfolioModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setPortfolioModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-[540px] max-h-[82vh] overflow-y-auto shadow-xl">
            <div className="text-base font-bold text-foreground mb-1">포트폴리오 생성</div>
            <div className="text-[11px] text-muted-foreground mb-5">종목을 선택하고 목표 비중(선택)을 설정하세요</div>
            <label className="flex flex-col gap-1.5 mb-5">
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">포트폴리오 이름</span>
              <input value={newPortfolioName} onChange={(e) => setNewPortfolioName(e.target.value)} placeholder="예: 성장주 전략" className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:border-primary/60 transition-colors outline-none" />
            </label>
            {PORTFOLIO_CATEGORIES.map((cat) => {
              const catHoldings = activeHoldings.filter((h) => h.assetClass === cat.key);
              if (!catHoldings.length) return null;
              return (
                <div key={cat.key} className="mb-4">
                  <div className="text-[10px] font-semibold mb-2 tracking-wide" style={{ color: cat.color }}>{cat.label}</div>
                  {catHoldings.map((h) => {
                    const isSel = portfolioTickers.has(h.ticker);
                    return (
                      <div key={h.ticker} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1.5 transition-all border ${isSel ? "bg-primary/8 border-primary/30" : "bg-secondary border-transparent hover:border-border"}`}>
                        <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer" checked={isSel} onChange={() => setPortfolioTickers((prev) => { const n = new Set(prev); n.has(h.ticker) ? n.delete(h.ticker) : n.add(h.ticker); return n; })} />
                        <div className="flex-1">
                          <div className="text-xs text-foreground font-semibold">{displayName(h)}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name} · {fmt(h.qty)}주 · avg {h.currency === "USD" ? "$" : "₩"}{fmt(h.avgCost, 1)}</div>
                        </div>
                        {isSel && (
                          <div className="flex items-center gap-1">
                            <input type="number" placeholder="비중%" min="0" max="100" value={portfolioTargetWeights[h.ticker] || ""} onChange={(e) => setPortfolioTargetWeights((p) => ({ ...p, [h.ticker]: parseFloat(e.target.value) || 0 }))} className="bg-card border border-border rounded-lg px-2 py-1 text-foreground text-[11px] w-16 text-right focus:border-primary/60 transition-colors outline-none font-mono" />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex gap-2 justify-end mt-3">
              <button className="px-4 py-2 rounded-xl text-xs border border-border text-muted-foreground bg-secondary hover:bg-muted transition-colors font-medium" onClick={() => setPortfolioModal(false)}>취소</button>
              <button className="px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground hover:brightness-105 transition-all disabled:opacity-30 font-semibold shadow-sm" onClick={savePortfolio} disabled={!newPortfolioName.trim() || !portfolioTickers.size}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
