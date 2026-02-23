"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { HorizBarChart, LineChart, DonutChart } from "./charts";
import { dbGetAll, dbPutAll, dbDelete, dbClear } from "@/lib/db";
import { processRawData, parseFile, parseCSVText } from "@/lib/parsing";
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
    <div className="bg-card rounded-2xl p-6 border border-border shadow-lg hover:shadow-xl transition-all duration-300 card-hover animate-fade-in">
      <div className="text-[10px] text-muted-foreground tracking-wider uppercase mb-4 font-semibold">
        거시경제 날씨 종합
      </div>
      <div className="flex items-center gap-5 mb-5">
        <div className="text-6xl animate-scale-in">{WEATHER_ICONS[wx]}</div>
        <div>
          <div className="text-[26px] font-bold text-card-foreground mb-1">{WEATHER_LABELS[wx]}</div>
          <div className="text-xs text-muted-foreground">
            {"종합 Z점수: "}{compositeZ.toFixed(2)}{" \u00B7 "}{activeIndicators.length}{"개 지표"}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {activeIndicators.map((m, idx) => {
          const z = calcZScore(m.value, m.mean, m.stddev);
          const w = weatherFromZScore(z, m.positiveIsGood);
          return (
            <div
              key={m.indicator}
              className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3 transition-all duration-300 hover:bg-muted hover:scale-[1.02] cursor-pointer animate-slide-in-right"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="min-w-0">
                <span className="text-xs text-secondary-foreground font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground ml-2.5">{m.region}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-card-foreground tabular-nums font-semibold">
                  {m.value}{m.unit}
                </span>
                <span className="text-[10px] text-muted-foreground">{"Z:"}{z.toFixed(2)}</span>
                <span className="text-lg">{WEATHER_ICONS[w]}</span>
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
function RetirementPlanner({ totalPortfolioValue }: { totalPortfolioValue: number }) {
  const currentYear = new Date().getFullYear();
  const [params, setParams] = useState({
    currentAssets: totalPortfolioValue || 50000000,
    annualContribution: 12000000,
    retirementYear: currentYear + 25,
    targetWithdrawal: 36000000,
    inflationRate: 0.025,
  });
  const [result, setResult] = useState<ReturnType<typeof simulateRetirement>>(null);

  useEffect(() => {
    setResult(simulateRetirement({ ...params, currentYear }));
  }, [params, currentYear]);

  useEffect(() => {
    if (totalPortfolioValue) setParams((p) => ({ ...p, currentAssets: totalPortfolioValue }));
  }, [totalPortfolioValue]);

  const set = (k: string, v: number) => setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {([
          ["현재 자산 (원)", "currentAssets"],
          ["연간 납입액 (원)", "annualContribution"],
          ["은퇴 목표 연도", "retirementYear"],
          ["연간 목표 인출액 (원)", "targetWithdrawal"],
        ] as const).map(([label, key], idx) => (
          <label key={key} className="flex flex-col gap-2 animate-slide-in-right" style={{ animationDelay: `${idx * 50}ms` }}>
            <span className="text-[10px] text-muted-foreground font-semibold tracking-wide">{label}</span>
            <input
              type="number"
              value={params[key]}
              onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
              className="bg-muted/70 border-2 border-input rounded-xl px-4 py-3 text-card-foreground text-sm w-full focus:border-primary/50 focus:bg-muted transition-all duration-300 hover:border-input/80"
            />
          </label>
        ))}
      </div>
      {result && (
        <div className="bg-gradient-to-br from-card via-card to-muted rounded-2xl p-5 shadow-lg border border-border/50 animate-scale-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
            {[
              { label: "목표 필요 자산", value: fmtWon(result.targetFV), color: "#60a5fa" },
              {
                label: "필요 연평균 수익률(CAGR)",
                value: `${(result.requiredCAGR * 100).toFixed(2)}%`,
                color: result.requiredCAGR > 0.07 ? "#f87171" : "#4ade80",
              },
              {
                label: "현재 달성률",
                value: `${Math.min(100, (params.currentAssets / result.targetFV) * 100).toFixed(1)}%`,
                color: params.currentAssets / result.targetFV >= 0.8 ? "#4ade80" : "#fbbf24",
              },
            ].map(({ label, value, color }, idx) => (
              <div key={label} className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border/30 hover:border-border transition-all duration-300 card-hover" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="text-[10px] text-muted-foreground mb-2 tracking-wide">{label}</div>
                <div className="text-xl font-bold transition-colors duration-300" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <LineChart data={result.trajectory.map((t) => ({ value: t.value }))} height={120} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-medium">
              <span>{currentYear}{"년"}</span>
              <span>{params.retirementYear}{"년"}</span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground/80 mt-3 text-center">
            {"\u203B 물가상승률 "}{(params.inflationRate * 100).toFixed(1)}{"% 가정 / 4% 인출 규칙"}
          </div>
        </div>
      )}
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
      } catch (e) {
        console.error("DB load error", e);
      }
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
      ? ph.map((h) => {
        const targetPct = pfl.targetWeights[h.ticker] || 0;
        const price = currentPrices[h.ticker] || h.avgCost;
        const curMV = h.qty * price;
        const curW = totalMV > 0 ? (curMV / totalMV) * 100 : 0;
        const diff = (totalMV * targetPct) / 100 - curMV;
        return { ...h, curW, targetW: targetPct, diff, diffQty: price > 0 ? Math.round(diff / price) : 0, action: diff > 0 ? "BUY" : "SELL" };
      }) : null;
    return { ...pfl, ph, totalCostP, totalMV, pnl, pnlPct: pnlPctVal, cagr, rebalanceResult };
  }).sort((a, b) => b.pnlPct - a.pnlPct), [portfolios, activeHoldings, currentPrices]);

  const activePortfolioStats = useMemo(() => allPortfolioStats.find((p) => p.id === activePortfolioId) || null, [allPortfolioStats, activePortfolioId]);

  const processData = useCallback((rawRows: unknown[][], acct: string) => {
    const { txs, unmapped } = processRawData(rawRows, tickerMap, acct);
    
    if (txs.length === 0) {
      setPasteMsg("업로드 실패: 데이터 형식을 인식할 수 없습니다. (헤더명 불일치)");
      setTimeout(() => setPasteMsg(""), 4000);
      return;
    }

    setUnmappedNames((prev) => {
      const ex = new Set(prev.map((u) => u.name));
      return [...prev, ...unmapped.filter((u) => !ex.has(u.name))];
    });
    setTransactions((prev) => {
      const newTxs = [...prev, ...txs];
      dbPutAll("transactions", txs).catch(console.error);
      return newTxs;
    });
    setPasteMsg(`${txs.length}건 추가 완료${unmapped.length ? ` (${unmapped.length}건 티커 미확인)` : ""}`);
    setTimeout(() => setPasteMsg(""), 4000);
  }, [tickerMap]);

  const handlePaste = useCallback(() => {
    const text = pasteText.trim();
    if (!text) return;
    const rows = parseCSVText(text, "\t");
    if (rows && rows.length > 0) { 
      processData(rows, pendingAccount || "붙여넣기"); 
      setPasteText(""); 
    } else {
      setPasteMsg("파싱 실패: 데이터를 인식할 수 없습니다.");
    }
  }, [pasteText, pendingAccount, processData]);

  const handleFileDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = ('dataTransfer' in e ? e.dataTransfer?.files?.[0] : (e.target as HTMLInputElement)?.files?.[0]);
    if (!file) return;

    if ('target' in e && e.target instanceof HTMLInputElement) {
      e.target.value = '';
    }

    const acct = pendingAccount || file.name.replace(/\.[^.]+$/, "");
    try {
      const d = await parseFile(file);
      processData(d.rows, acct);
    } catch (err) {
      setPasteMsg(`파일 파싱 실패: ${err}`);
      setTimeout(() => setPasteMsg(""), 4000);
    }
  }, [pendingAccount, processData]);

  const applyTickerMap = useCallback((name: string, ticker: string) => {
    const updated = { ...tickerMap, [name]: ticker };
    setTickerMap(updated);
    dbPutAll("tickerMap", Object.entries(updated).map(([n, t]) => ({ name: n, ticker: t }))).catch(console.error);
    setTransactions((prev) => {
      const up = prev.map((tx) => tx.name === name && !tx.ticker ? { ...tx, ticker } : tx);
      dbPutAll("transactions", up).catch(console.error);
      return up;
    });
    setUnmappedNames((prev) => prev.filter((u) => u.name !== name));
  }, [tickerMap]);

  const toggleCheckedTx = (id: number) => setCheckedTxIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filteredTxs = useMemo(() => {
    const base = txAccountFilter === "전체" ? transactions : transactions.filter((t) => t.account === txAccountFilter);
    return [...base].reverse();
  }, [transactions, txAccountFilter]);
  const toggleAllTx = () => checkedTxIds.size === filteredTxs.length ? setCheckedTxIds(new Set()) : setCheckedTxIds(new Set(filteredTxs.map((t) => t.id)));
  const deleteCheckedTx = async () => {
    if (!checkedTxIds.size || !confirm(`선택한 ${checkedTxIds.size}건을 삭제하시겠습니까?`)) return;
    setTransactions((prev) => {
      const next = prev.filter((t) => !checkedTxIds.has(t.id));
      dbClear("transactions").then(() => dbPutAll("transactions", next)).catch(console.error);
      return next;
    });
    setCheckedTxIds(new Set());
  };

  const sortedClosedByDate = useMemo(() => [...closedHoldings].sort((a, b) => (b.lastSellDate || "").localeCompare(a.lastSellDate || "")), [closedHoldings]);
  const tickerListAll = useMemo(() => {
    const q = tickerSearch.toLowerCase();
    const allItems = [
      ...activeHoldings.map((h) => ({ ...h, _active: true })),
      ...sortedClosedByDate.map((h) => ({ ...h, _active: false })),
    ];
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
    setPortfolioModal(false);
    setNewPortfolioName("");
    setPortfolioTickers(new Set());
    setPortfolioTargetWeights({});
  };

  const deletePortfolio = (id: string) => {
    const updated = portfolios.filter((p) => p.id !== id);
    setPortfolios(updated);
    dbDelete("portfolios", id).catch(console.error);
    if (activePortfolioId === id) setActivePortfolioId(null);
  };

  const assetClassBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    activeHoldings.forEach((h) => {
      const cls = h.assetClass || "KR_STOCK";
      if (!groups[cls]) groups[cls] = 0;
      groups[cls] += (currentPrices[h.ticker] || h.avgCost) * h.qty;
    });
    return Object.entries(groups).map(([cls, val]) => ({ label: ASSET_CLASS_LABEL[cls] || cls, value: val, color: ASSET_COLORS[cls] || "#888" }));
  }, [activeHoldings, currentPrices]);

  const portfolioFilteredHoldings = useMemo(() => pfCategoryFilter === "ALL" ? activeHoldings : activeHoldings.filter((h) => h.assetClass === pfCategoryFilter), [activeHoldings, pfCategoryFilter]);

  if (loadingDB)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-accent rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <span className="text-sm text-muted-foreground font-mono animate-pulse">데이터 로딩 중...</span>
        </div>
      </div>
    );

  return (
    <div className="bg-background min-h-screen text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border/50 px-6 flex items-center justify-between h-[60px] backdrop-blur-md bg-background/90 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4 animate-slide-in-right">
          <div className="w-8 h-8 bg-gradient-to-br from-primary via-accent to-primary rounded-xl flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 hover:scale-105 cursor-pointer">
            {"W"}
          </div>
          <span className="text-sm font-bold text-card-foreground tracking-widest bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">WAY TO PARADISE</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-xl px-4 py-2 text-xs text-primary font-semibold hover:from-primary/20 hover:to-accent/20 hover:border-primary/50 hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg animate-fade-in"
        >
          <Upload className="w-4 h-4" />
          파일 업로드
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="hidden" onChange={handleFileDrop} />
      </header>

      {/* Tabs */}
      <nav className="border-b border-border/50 px-4 flex overflow-x-auto bg-card/30 backdrop-blur-sm">
        {TABS.map((t, i) => {
          const Icon = TAB_ICONS[i];
          return (
            <button
              key={t}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs whitespace-nowrap tracking-wide transition-all duration-300 border-b-2 font-medium ${
                activeTab === i
                  ? "text-primary border-primary bg-primary/5 shadow-sm"
                  : "text-muted-foreground border-transparent hover:text-secondary-foreground hover:bg-muted/30"
              }`}
              onClick={() => setActiveTab(i)}
            >
              <Icon className="w-4 h-4" />
              {t}
            </button>
          );
        })}
      </nav>

      {/* Alerts */}
      {unmappedNames.length > 0 && (
        <div className="mx-6 mt-3 bg-gradient-to-r from-[#1a150a] to-[#1a100a] border-2 border-[#5c3d00] rounded-2xl px-4 py-3.5 shadow-lg animate-fade-in">
          <div className="text-xs text-warning mb-3 font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse"></span>
            {"티커 미매핑 종목 ("}{unmappedNames.length}{"건)"}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {unmappedNames.map((u) => (
              <div key={u.name} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2 hover:bg-muted/50 transition-all duration-300">
                <span className="text-xs text-secondary-foreground font-medium">{u.name}</span>
                <input
                  placeholder="티커"
                  value={u.ticker || ""}
                  onChange={(e) => setUnmappedNames((p) => p.map((x) => x.name === u.name ? { ...x, ticker: e.target.value } : x))}
                  className="bg-muted/70 border-2 border-input rounded-lg px-2.5 py-1 text-card-foreground text-xs w-28 focus:border-primary/50 transition-all duration-300"
                />
                <button
                  className="flex items-center gap-1.5 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-lg px-2.5 py-1 text-primary text-[10px] font-semibold hover:from-primary/30 hover:to-accent/30 hover:scale-105 transition-all duration-300"
                  onClick={() => applyTickerMap(u.name, u.ticker)}
                >
                  <Check className="w-3.5 h-3.5" />
                  적용
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {pasteMsg && (
        <div className={`mx-6 mt-2 rounded-xl px-4 py-3 text-xs border-2 shadow-md animate-scale-in font-medium ${
          pasteMsg.includes("완료")
            ? "bg-gradient-to-r from-[#0d1f12] to-[#0d1812] border-primary text-primary"
            : "bg-gradient-to-r from-[#1f0d0d] to-[#1a0d0d] border-[#7f1d1d] text-negative"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${pasteMsg.includes("완료") ? "bg-primary" : "bg-negative"} animate-pulse`}></span>
            {pasteMsg}
          </div>
        </div>
      )}

      <main className="p-6 overflow-x-hidden max-w-[1800px] mx-auto">

        {/* ========== DASHBOARD ========== */}
        {activeTab === 0 && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "총 평가금액", value: `\u20A9${fmt(totalMarketValue)}`, icon: "💰" },
                { label: "총 매입금액", value: `\u20A9${fmt(totalCost)}`, icon: "📊" },
                { label: "평가손익", value: `${totalUnrealizedPnL >= 0 ? "+" : ""}\u20A9${fmt(totalUnrealizedPnL)}`, sub: fmtPct(totalCost > 0 ? totalUnrealizedPnL / totalCost : 0), c: pnlColor(totalUnrealizedPnL), icon: "📈" },
                { label: "실현손익 누계", value: `${totalRealizedPnL >= 0 ? "+" : ""}\u20A9${fmt(totalRealizedPnL)}`, c: pnlColor(totalRealizedPnL), icon: "💵" },
              ].map(({ label, value, sub, c, icon }, idx) => (
                <div key={label} className="bg-gradient-to-br from-card to-card/50 rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-all duration-300 card-hover shadow-md hover:shadow-lg animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] text-muted-foreground tracking-wider uppercase font-semibold">{label}</div>
                    <span className="text-2xl opacity-50">{icon}</span>
                  </div>
                  <div className="text-xl font-bold break-all font-mono transition-colors duration-300" style={{ color: c || "#e8e8e8" }}>{value}</div>
                  {sub && <div className="text-xs mt-2 font-mono font-semibold" style={{ color: c }}>{sub}</div>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
              <div className="bg-gradient-to-br from-card via-card to-muted/30 rounded-2xl p-5 border border-border/50 shadow-lg min-w-0 animate-scale-in">
                <div className="text-[10px] text-muted-foreground mb-4 tracking-wider uppercase font-semibold flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  보유 종목
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-[10px]">
                        {["종목", "수량", "평균단가", "평가금액", "손익", "수익률"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeHoldings
                        .sort((a, b) => (currentPrices[b.ticker] || b.avgCost) * b.qty - (currentPrices[a.ticker] || a.avgCost) * a.qty)
                        .map((h, idx) => {
                          const price = currentPrices[h.ticker] || h.avgCost;
                          const mv = h.qty * price;
                          const pnl = mv - h.totalCost;
                          const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                          return (
                            <tr
                              key={h.ticker}
                              className="border-t border-border/30 hover:bg-primary/5 cursor-pointer transition-all duration-300 animate-fade-in"
                              style={{ animationDelay: `${idx * 30}ms` }}
                              onClick={() => { setSelectedTicker(h.ticker); setActiveTab(2); setTickerSearch(""); setTickerPage(0); }}
                            >
                              <td className="px-3 py-3">
                                <div className="font-semibold text-card-foreground text-xs">{displayName(h)}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums font-medium">{fmt(h.qty)}</td>
                              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{h.currency === "USD" ? "$" : "\u20A9"}{fmt(h.avgCost, 1)}</td>
                              <td className="px-3 py-3 text-right text-card-foreground tabular-nums font-semibold">{"\u20A9"}{fmt(mv)}</td>
                              <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}{"\u20A9"}{fmt(pnl)}</td>
                              <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {!activeHoldings.length && (
                    <div className="px-5 py-12 text-center">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30 animate-pulse" />
                      <div className="text-sm text-muted-foreground mb-2 font-medium">아직 거래 내역이 없습니다</div>
                      <div className="text-xs text-muted-foreground/60 leading-relaxed">
                        {"우측 "}<span className="text-primary font-semibold">데이터 입력</span>{" 패널에서"}<br />
                        {"HTS 화면을 복사/붙여넣기 하거나 파일을 드롭하세요"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-gradient-to-br from-card via-card/90 to-muted/30 rounded-2xl p-5 border border-border/50 shadow-lg animate-slide-in-right" style={{ animationDelay: "200ms" }}>
                  <div className="text-[10px] text-muted-foreground mb-3 tracking-wider uppercase font-semibold flex items-center gap-2">
                    <span className="w-1 h-4 bg-accent rounded-full"></span>
                    자산 배분
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <DonutChart segments={assetClassBreakdown} size={96} />
                    <div className="flex flex-col gap-1.5">
                      {assetClassBreakdown.map(({ label, value, color }) => (
                        <div key={label} className="flex items-center gap-2 text-xs hover:scale-105 transition-transform duration-200">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-md" style={{ background: color }} />
                          <span className="text-muted-foreground/90 font-medium">{label}</span>
                          <span className="text-card-foreground ml-auto tabular-nums font-semibold">
                            {totalMarketValue > 0 ? `${((value / totalMarketValue) * 100).toFixed(1)}%` : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5 shadow-lg animate-slide-in-right" style={{ animationDelay: "300ms" }}>
                  <div className="text-[10px] text-muted-foreground mb-3 tracking-wider uppercase font-semibold flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    데이터 입력
                  </div>
                  <label className="flex flex-col gap-2 mb-3">
                    <span className="text-[10px] text-muted-foreground font-medium">계좌명 (선택)</span>
                    <input
                      value={pendingAccount}
                      onChange={(e) => setPendingAccount(e.target.value)}
                      placeholder="예: MTS 위탁계좌"
                      className="bg-muted/70 border-2 border-input rounded-xl px-3 py-2 text-card-foreground text-xs focus:border-primary/50 focus:bg-muted transition-all duration-300"
                    />
                  </label>
                  <div
                    className="border-2 border-dashed border-input rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-primary/[0.03] hover:scale-[1.02]"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/[0.06]", "scale-[1.02]"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/[0.06]", "scale-[1.02]"); }}
                    onDrop={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/[0.06]", "scale-[1.02]"); handleFileDrop(e); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                    <div className="text-[10px] text-muted-foreground font-medium">xlsx / csv / tsv 드롭</div>
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"HTS Ctrl+C 후 붙여넣기\n(TSV / CSV 모두 지원)"}
                    className="mt-3 w-full h-[80px] bg-muted/70 border-2 border-border rounded-xl p-3 text-foreground text-xs resize-y focus:border-primary/50 focus:bg-muted transition-all duration-300"
                  />
                  <button
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/30 rounded-xl px-4 py-2.5 text-primary text-xs font-semibold hover:from-primary/30 hover:to-accent/30 hover:border-primary/50 hover:scale-[1.02] transition-all duration-300 shadow-md"
                    onClick={handlePaste}
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    파싱 및 적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TRANSACTIONS ========== */}
        {activeTab === 1 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex gap-1.5 flex-wrap flex-1">
                {allAccounts.map((a) => (
                  <button
                    key={a}
                    className={`px-3 py-1.5 rounded-lg text-[11px] border transition-all ${
                      txAccountFilter === a
                        ? "bg-[#0d2818] border-primary text-primary"
                        : "bg-card border-input text-muted-foreground/80 hover:bg-surface-elevated hover:text-card-foreground hover:border-input"
                    }`}
                    onClick={() => { setTxAccountFilter(a); setCheckedTxIds(new Set()); }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{filteredTxs.length}{"건"}</div>
              {checkedTxIds.size > 0 && (
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] border border-[#3a1a1a] text-negative bg-card hover:bg-[#2d0f0f] transition-colors"
                  onClick={deleteCheckedTx}
                >
                  <Trash2 className="w-3 h-3" />
                  {"선택 삭제 ("}{checkedTxIds.size}{")"}
                </button>
              )}
            </div>
            <div className="bg-card rounded-[14px] border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-card z-[2]">
                    <tr className="text-muted-foreground text-[10px]">
                      <th className="px-3.5 py-2.5 text-center border-b border-input w-8">
                        <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer" checked={checkedTxIds.size === filteredTxs.length && filteredTxs.length > 0} onChange={toggleAllTx} />
                      </th>
                      {["날짜", "계좌", "종목", "티커", "유형", "수량", "단가", "금액(원)", "수수료", "세금", "통화"].map((h) => (
                        <th key={h} className="px-2.5 py-2.5 text-right font-normal border-b border-input whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => {
                      const tc = TX_TYPE_COLORS[tx.txType] || { bg: "#1a1f2e", text: "#888" };
                      return (
                        <tr key={tx.id} className={`border-t border-border/50 transition-colors ${checkedTxIds.has(tx.id) ? "bg-[#0d1f12]" : "hover:bg-secondary/30"}`}>
                          <td className="px-3.5 py-2 text-center"><input type="checkbox" className="w-3.5 h-3.5 cursor-pointer" checked={checkedTxIds.has(tx.id)} onChange={() => toggleCheckedTx(tx.id)} /></td>
                          <td className="px-2.5 py-2 text-muted-foreground/80 whitespace-nowrap text-[11px] tabular-nums">{tx.date}</td>
                          <td className="px-2.5 py-2 text-muted-foreground text-[10px] whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">{tx.account || "\u2014"}</td>
                          <td className="px-2.5 py-2 text-secondary-foreground whitespace-nowrap">{tx.name}</td>
                          <td className="px-2.5 py-2 text-info font-mono">{tx.ticker || "\u2014"}</td>
                          <td className="px-2.5 py-2 text-right">
                            <span className="px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap" style={{ background: tc.bg, color: tc.text }}>{tx.txType}</span>
                          </td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{tx.qty ? fmt(tx.qty) : "\u2014"}</td>
                          <td className="px-2.5 py-2 text-right tabular-nums">{tx.price ? fmt(tx.price, 2) : "\u2014"}</td>
                          <td className="px-2.5 py-2 text-right text-card-foreground tabular-nums">{"\u20A9"}{fmt(tx.amountKRW)}</td>
                          <td className="px-2.5 py-2 text-right text-muted-foreground tabular-nums">{tx.fee ? fmt(tx.fee, 2) : "\u2014"}</td>
                          <td className="px-2.5 py-2 text-right text-muted-foreground tabular-nums">{tx.tax ? fmt(tx.tax, 2) : "\u2014"}</td>
                          <td className="px-2.5 py-2 text-right text-muted-foreground">{tx.currency}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredTxs.length && (
                  <div className="px-5 py-12 text-center">
                    <ClipboardPaste className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                    <div className="text-sm text-muted-foreground">
                      {txAccountFilter === "전체" ? "거래 내역이 없습니다" : `'${txAccountFilter}' 계좌의 거래 내역이 없습니다`}
                    </div>
                    <div className="text-[11px] text-muted-foreground/50 mt-1.5">대시보드 탭에서 데이터를 입력하세요</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== STOCK ANALYSIS ========== */}
        {activeTab === 2 && (
          <div className="flex gap-4">
            {/* Left sidebar: ticker list */}
            <div className="w-[200px] shrink-0 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={tickerSearch}
                  onChange={(e) => { setTickerSearch(e.target.value); setTickerPage(0); }}
                  placeholder="종목 검색..."
                  className="w-full bg-card border border-input rounded-lg pl-8 pr-3 py-2 text-card-foreground text-[11px] focus:border-primary/50 transition-colors"
                />
              </div>
              {tickerPageItems.filter((h) => h._active).length > 0 && (
                <div className="text-[10px] text-primary px-0.5 tracking-wide">{"\u25B8 보유중"}</div>
              )}
              {tickerPageItems.filter((h) => h._active).map((h) => (
                <button
                  key={h.ticker}
                  onClick={() => setSelectedTicker(h.ticker)}
                  className={`rounded-lg px-2.5 py-2 text-left cursor-pointer transition-all border ${
                    selectedTicker === h.ticker
                      ? "bg-[#0d2818] border-primary"
                      : "bg-card border-border hover:border-input"
                  }`}
                >
                  <div className={`text-xs font-semibold ${selectedTicker === h.ticker ? "text-primary" : "text-card-foreground"}`}>{displayName(h)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{ASSET_CLASS_LABEL[h.assetClass] || ""}</div>
                </button>
              ))}
              {!tickerSearch && tickerPageItems.filter((h) => !h._active).length > 0 && (
                <div className="text-[10px] text-muted-foreground/80 px-0.5 tracking-wide mt-1">{"\u25B8 청산 종목"}</div>
              )}
              {tickerPageItems.filter((h) => !h._active).map((h) => (
                <button
                  key={h.ticker}
                  onClick={() => setSelectedTicker(h.ticker)}
                  className={`rounded-lg px-2.5 py-2 text-left cursor-pointer transition-all border opacity-75 ${
                    selectedTicker === h.ticker
                      ? "bg-[#1a1020] border-chart-5"
                      : "bg-muted border-border hover:border-input"
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${selectedTicker === h.ticker ? "text-chart-5" : "text-muted-foreground/80"}`}>{displayName(h)}</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">{h.lastSellDate}{" 청산"}</div>
                </button>
              ))}
              {tickerListAll.length === 0 && (
                <div className="px-1 py-5 text-center">
                  <Search className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                  <div className="text-[11px] text-muted-foreground/50 leading-relaxed">{"거래 내역을 먼저"}<br />{"입력해 주세요"}</div>
                </div>
              )}
              {tickerPages > 1 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <button className="p-1.5 rounded-md bg-card border border-input text-muted-foreground hover:bg-surface-elevated disabled:opacity-30 transition-colors" disabled={tickerPage === 0} onClick={() => setTickerPage((p) => p - 1)}><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="text-[10px] text-muted-foreground flex-1 text-center tabular-nums">{tickerPage + 1}{"/"}{tickerPages}</span>
                  <button className="p-1.5 rounded-md bg-card border border-input text-muted-foreground hover:bg-surface-elevated disabled:opacity-30 transition-colors" disabled={tickerPage >= tickerPages - 1} onClick={() => setTickerPage((p) => p + 1)}><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            {/* Right: detail */}
            <div className="flex-1 min-w-0">
              {!selectedTicker && (
                <div className="text-muted-foreground/50 p-8 text-center text-sm">좌측에서 종목을 선택하세요</div>
              )}
              {selectedTicker && holdings[selectedTicker] && (() => {
                const h = holdings[selectedTicker];
                const price = currentPrices[h.ticker] || h.avgCost;
                const mv = h.qty * price;
                const pnl = mv - h.totalCost;
                const pnlPctVal = h.totalCost > 0 ? pnl / h.totalCost : 0;
                const txHistory = [...h.transactions].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
                let cumCost = 0;
                const histData = txHistory.map((tx) => {
                  if (tx.txType === TX_TYPE.BUY) cumCost += tx.amount;
                  else if (tx.txType === TX_TYPE.SELL) cumCost -= h.avgCost * tx.qty;
                  return { value: Math.max(0, cumCost) };
                });
                const prices = txHistory.filter((t) => t.price > 0).map((t) => t.price);
                const maxP = prices.length ? Math.max(...prices) : h.avgCost;
                const minP = prices.length ? Math.min(...prices) : h.avgCost;
                const mfe = h.avgCost > 0 ? (maxP - h.avgCost) / h.avgCost : 0;
                const mae = h.avgCost > 0 ? (minP - h.avgCost) / h.avgCost : 0;
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-card rounded-[14px] p-4 border border-border">
                      <div className="mb-0.5">
                        <span className="text-base font-bold text-card-foreground">{displayName(h)}</span>
                        {h.qty === 0 && <span className="text-[11px] text-chart-5 ml-2">청산</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-4">
                        {/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}{" \u00B7 "}{ASSET_CLASS_LABEL[h.assetClass] || ""}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: "보유수량", value: `${fmt(h.qty)}주` },
                          { label: "평균단가", value: `${h.currency === "USD" ? "$" : "\u20A9"}${fmt(h.avgCost, 1)}` },
                          { label: "매입금액", value: `\u20A9${fmt(h.totalCost)}` },
                          { label: "평가금액", value: `\u20A9${fmt(mv)}` },
                          { label: "평가손익", value: `${pnl >= 0 ? "+" : ""}\u20A9${fmt(pnl)}`, c: pnlColor(pnl) },
                          { label: "수익률", value: fmtPct(pnlPctVal), c: pnlColor(pnlPctVal) },
                          { label: "실현손익", value: `${h.realizedPnL >= 0 ? "+" : ""}\u20A9${fmt(h.realizedPnL)}`, c: pnlColor(h.realizedPnL) },
                          { label: "배당수령", value: `${h.currency === "USD" ? "$" : "\u20A9"}${fmt(h.dividends, 2)}` },
                        ].map(({ label, value, c }) => (
                          <div key={label} className="bg-muted rounded-[9px] px-3 py-2.5">
                            <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                            <div className="text-[13px] font-semibold tabular-nums" style={{ color: c || "#e8e8e8" }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3.5">
                      <div className="bg-card rounded-[14px] p-4 border border-border">
                        <div className="text-[10px] text-muted-foreground mb-2.5">MFE / MAE (거래 체결가 기준)</div>
                        <div className="flex gap-2.5">
                          <div className="flex-1 bg-[#0d2818] rounded-[9px] p-3 text-center">
                            <div className="text-[10px] text-muted-foreground mb-1">MFE 최대수익폭</div>
                            <div className="text-lg font-bold text-primary tabular-nums">+{(mfe * 100).toFixed(2)}%</div>
                            <div className="text-[9px] text-muted-foreground/80 tabular-nums">{h.currency === "USD" ? "$" : "\u20A9"}{fmt(maxP, 1)}</div>
                          </div>
                          <div className="flex-1 bg-[#2d0f0f] rounded-[9px] p-3 text-center">
                            <div className="text-[10px] text-muted-foreground mb-1">MAE 최대손실폭</div>
                            <div className="text-lg font-bold text-negative tabular-nums">{(mae * 100).toFixed(2)}%</div>
                            <div className="text-[9px] text-muted-foreground/80 tabular-nums">{h.currency === "USD" ? "$" : "\u20A9"}{fmt(minP, 1)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-card rounded-[14px] p-4 border border-border">
                        <div className="text-[10px] text-muted-foreground mb-2">투자금 추이</div>
                        <LineChart data={histData} height={80} />
                      </div>
                      <div className="bg-card rounded-[14px] p-4 border border-border">
                        <div className="text-[10px] text-muted-foreground mb-2.5">{"거래 이력 ("}{txHistory.length}{"건)"}</div>
                        <div className="max-h-[180px] overflow-y-auto">
                          {txHistory.map((tx, i) => {
                            const tc = TX_TYPE_COLORS[tx.txType] || { text: "#888" };
                            return (
                              <div key={i} className={`flex justify-between items-center py-1.5 gap-1.5 text-[11px] ${i ? "border-t border-border" : ""}`}>
                                <span className="text-muted-foreground/80 whitespace-nowrap text-[10px] tabular-nums">{tx.date}</span>
                                <span className="text-[10px]" style={{ color: tc.text }}>{tx.txType}</span>
                                <span className="text-muted-foreground/80 tabular-nums">{tx.qty > 0 ? `${fmt(tx.qty)}주` : ""}</span>
                                <span className="text-card-foreground tabular-nums">{"\u20A9"}{fmt(tx.amountKRW)}</span>
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

        {/* ========== PORTFOLIO ========== */}
        {activeTab === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground">포트폴리오</span>
              {portfolios.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all border ${
                    activePortfolioId === p.id
                      ? "bg-[#0d2818] border-primary"
                      : "bg-card border-border hover:border-input"
                  }`}
                  onClick={() => setActivePortfolioId(p.id)}
                >
                  <span className={`text-xs ${activePortfolioId === p.id ? "text-primary" : "text-secondary-foreground"}`}>{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.tickers.length}{"종목"}</span>
                  <button className="text-muted-foreground/50 hover:text-negative transition-colors" onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id); }}><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button
                className="flex items-center gap-1 bg-[#0d2818] border border-[#166534] rounded-lg px-3 py-1.5 text-primary text-xs hover:bg-[#145224] transition-colors"
                onClick={() => setPortfolioModal(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                포트폴리오 생성
              </button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[10px] text-muted-foreground">카테고리</span>
              <button
                className={`px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                  pfCategoryFilter === "ALL"
                    ? "border-secondary-foreground/50 text-secondary-foreground"
                    : "border-input text-muted-foreground/70 hover:border-secondary-foreground/30"
                }`}
                onClick={() => setPfCategoryFilter("ALL")}
              >
                전체
              </button>
              {PORTFOLIO_CATEGORIES.map((cat) => {
                const cnt = activeHoldings.filter((h) => h.assetClass === cat.key).length;
                if (!cnt) return null;
                return (
                  <button
                    key={cat.key}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                      pfCategoryFilter === cat.key
                        ? "border-current opacity-100"
                        : "border-input opacity-70 hover:opacity-90"
                    }`}
                    style={{ color: cat.color }}
                    onClick={() => setPfCategoryFilter(cat.key)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                    {cat.label}{" ("}{cnt}{")"}
                  </button>
                );
              })}
            </div>
            <div className="bg-card rounded-[14px] p-4 border border-border">
              <div className="text-[10px] text-muted-foreground mb-3 tracking-wider uppercase">{"보유 종목 현황 \u2014 현재 시세 입력"}</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-[10px] border-b border-input">
                      {["카테고리", "종목", "수량", "평균단가", "현재시세 (입력)", "평가금액", "손익", "수익률", "비중"].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-right font-normal whitespace-nowrap">{h}</th>
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
                      const cat = PORTFOLIO_CATEGORIES.find((c) => c.key === h.assetClass) || { label: "\u2014", color: "#888" };
                      return (
                        <tr key={h.ticker} className="border-t border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-2.5 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px]" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.label}</span>
                          </td>
                          <td className="px-2.5 py-2.5 whitespace-nowrap">
                            <div className="font-semibold text-card-foreground">{displayName(h)}</div>
                            <div className="text-[10px] text-muted-foreground">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div>
                          </td>
                          <td className="px-2.5 py-2.5 text-right tabular-nums">{fmt(h.qty)}</td>
                          <td className="px-2.5 py-2.5 text-right text-muted-foreground/80 tabular-nums">{h.currency === "USD" ? "$" : "\u20A9"}{fmt(h.avgCost, 1)}</td>
                          <td className="px-2.5 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-muted-foreground">{h.currency === "USD" ? "$" : "\u20A9"}</span>
                              <input
                                type="number"
                                value={currentPrices[h.ticker] || ""}
                                placeholder={String(Math.round(h.avgCost))}
                                onChange={(e) => setCurrentPrices((p) => ({ ...p, [h.ticker]: parseFloat(e.target.value) || 0 }))}
                                className="bg-muted border border-input rounded-md px-2 py-1 text-card-foreground text-xs w-[90px] text-right focus:border-primary/50 transition-colors tabular-nums"
                              />
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-right text-card-foreground tabular-nums">{"\u20A9"}{fmt(mv)}</td>
                          <td className="px-2.5 py-2.5 text-right tabular-nums" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}{"\u20A9"}{fmt(pnl)}</td>
                          <td className="px-2.5 py-2.5 text-right tabular-nums" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                          <td className="px-2.5 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-9 h-1 bg-secondary rounded-sm overflow-hidden">
                                <div className="h-full rounded-sm" style={{ width: `${Math.min(100, wt * 3)}%`, background: ASSET_COLORS[h.assetClass] || "#4ade80" }} />
                              </div>
                              <span className="text-[11px] tabular-nums">{wt.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!portfolioFilteredHoldings.length && (
                      <tr>
                        <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground/50 text-sm">
                          {pfCategoryFilter === "ALL" ? "보유 종목이 없습니다" : `'${ASSET_CLASS_LABEL[pfCategoryFilter]}' 카테고리에 보유 종목이 없습니다`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {activePortfolioStats && (
              <div className="bg-[#0d1420] rounded-[14px] p-4 border border-border">
                <div className="flex justify-between items-start mb-3.5">
                  <div>
                    <div className="text-[15px] font-bold text-card-foreground">{activePortfolioStats.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{activePortfolioStats.tickers.length}{"종목 \u00B7 "}{activePortfolioStats.createdAt?.slice(0, 10)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2.5 mb-3.5">
                  {[
                    { label: "포트폴리오 가치", value: `\u20A9${fmt(activePortfolioStats.totalMV)}` },
                    { label: "평가손익", value: `${activePortfolioStats.pnl >= 0 ? "+" : ""}\u20A9${fmt(activePortfolioStats.pnl)}`, c: pnlColor(activePortfolioStats.pnl) },
                    { label: "누적 수익률", value: fmtPct(activePortfolioStats.pnlPct), c: pnlColor(activePortfolioStats.pnlPct) },
                    { label: "연평균 CAGR", value: fmtPct(activePortfolioStats.cagr), c: pnlColor(activePortfolioStats.cagr) },
                  ].map(({ label, value, c }) => (
                    <div key={label} className="bg-card rounded-xl p-3">
                      <div className="text-[10px] text-muted-foreground mb-1.5">{label}</div>
                      <div className="text-[15px] font-bold tabular-nums" style={{ color: c || "#e8e8e8" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-muted-foreground text-[10px] border-b border-input">
                        {["종목", "수량", "평균단가", "평가금액", "손익", "수익률", "비중"].map((h) => <th key={h} className="px-2.5 py-1.5 text-right font-normal">{h}</th>)}
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
                          <tr key={h.ticker} className="border-t border-border">
                            <td className="px-2.5 py-2.5"><div className="font-semibold text-card-foreground">{displayName(h)}</div><div className="text-[10px] text-muted-foreground">{/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}</div></td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums">{fmt(h.qty)}</td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums">{h.currency === "USD" ? "$" : "\u20A9"}{fmt(h.avgCost, 1)}</td>
                            <td className="px-2.5 py-2.5 text-right text-card-foreground tabular-nums">{"\u20A9"}{fmt(mv)}</td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums" style={{ color: pnlColor(pnl) }}>{pnl >= 0 ? "+" : ""}{"\u20A9"}{fmt(pnl)}</td>
                            <td className="px-2.5 py-2.5 text-right tabular-nums" style={{ color: pnlColor(pnlPctVal) }}>{fmtPct(pnlPctVal)}</td>
                            <td className="px-2.5 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-10 h-1 bg-secondary rounded-sm overflow-hidden"><div className="h-full rounded-sm bg-primary" style={{ width: `${Math.min(100, wt)}%` }} /></div>
                                <span className="tabular-nums">{wt.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {activePortfolioStats.rebalanceResult && (
                  <div className="mt-4">
                    <div className="text-[10px] text-muted-foreground mb-2.5 tracking-wider uppercase">리밸런싱 지시</div>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="text-muted-foreground text-[10px] border-b border-input">
                          {["종목", "현재비중", "목표비중", "조정금액", "수량", "액션"].map((h) => <th key={h} className="px-2.5 py-1.5 text-right font-normal">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {activePortfolioStats.rebalanceResult.map((r: Holding & { curW: number; targetW: number; diff: number; diffQty: number; action: string }) => (
                          <tr key={r.ticker} className="border-t border-border">
                            <td className="px-2.5 py-2"><div className="font-semibold">{displayName(r)}</div></td>
                            <td className="px-2.5 py-2 text-right tabular-nums">{r.curW.toFixed(1)}%</td>
                            <td className="px-2.5 py-2 text-right text-muted-foreground/80 tabular-nums">{r.targetW}%</td>
                            <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: pnlColor(r.diff) }}>{r.diff >= 0 ? "+" : ""}{"\u20A9"}{fmt(r.diff)}</td>
                            <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: pnlColor(r.diff) }}>{r.diffQty >= 0 ? "+" : ""}{r.diffQty}</td>
                            <td className="px-2.5 py-2 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px]" style={{ background: r.action === "BUY" ? "#0d2818" : "#2d0f0f", color: r.action === "BUY" ? "#4ade80" : "#f87171" }}>{r.action}</span>
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

        {/* ========== MACRO ========== */}
        {activeTab === 4 && (
          <div className="flex flex-col gap-4">
            <MacroWeatherWidget activeIndicators={activeIndicators} />
            <div className="bg-card rounded-[14px] p-4 border border-border">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{"지표 선택 ("}{selectedMacroIds.size}{"개 활성)"}</span>
                {macroRegions.map((r) => (
                  <button
                    key={r}
                    className={`px-2.5 py-1 rounded-lg text-[10px] border transition-all ${
                      macroRegionFilter === r
                        ? "bg-[#0d2818] border-primary text-primary"
                        : "bg-card border-input text-muted-foreground/80 hover:bg-surface-elevated hover:text-card-foreground"
                    }`}
                    onClick={() => setMacroRegionFilter(r)}
                  >
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
                      className={`inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border cursor-pointer transition-all ${
                        isActive
                          ? "bg-[#0d2818] border-primary text-primary"
                          : "bg-card border-input text-muted-foreground/70 hover:border-primary/30 hover:text-secondary-foreground"
                      }`}
                      onClick={() => setSelectedMacroIds((prev) => { const n = new Set(prev); n.has(m.indicator) ? n.delete(m.indicator) : n.add(m.indicator); return n; })}
                      title={m.description}
                    >
                      <span className="text-sm">{WEATHER_ICONS[w]}</span>
                      <div>
                        <div className="text-[11px]">{m.label}</div>
                        <div className={`text-[10px] ${isActive ? "text-primary/60" : "text-muted-foreground"}`}>
                          {m.value}{m.unit}{" \u00B7 Z:"}{z.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {activeIndicators.length > 0 && (
              <div className="bg-card rounded-[14px] p-4 border border-border">
                <div className="text-[10px] text-muted-foreground mb-3.5 tracking-wider uppercase">선택 지표 Z-Score (가중치 적용, 호재 방향 기준)</div>
                <HorizBarChart
                  data={activeIndicators.map((m) => ({
                    label: m.label,
                    value: calcZScore(m.value, m.mean, m.stddev) * (m.positiveIsGood ? 1 : -1) * m.weight,
                  }))}
                />
                <div className="text-[10px] text-muted-foreground/50 mt-2.5">{"\u203B 양수(초록) = 시장에 호재 방향. 가중치 적용 Z점수."}</div>
              </div>
            )}
          </div>
        )}

        {/* ========== RETIREMENT ========== */}
        {activeTab === 5 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card rounded-2xl p-5 border border-border shadow-lg col-span-1 lg:col-span-2">
              <div className="text-[10px] text-muted-foreground mb-4 tracking-wider uppercase font-semibold flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full"></span>
                생애 재무 / 은퇴 시뮬레이션
              </div>
              <RetirementPlanner totalPortfolioValue={totalMarketValue} />
            </div>
            <div className="bg-card rounded-2xl p-5 border border-border shadow-lg">
              <div className="text-[10px] text-muted-foreground mb-4 tracking-wider uppercase font-semibold flex items-center gap-2">
                <span className="w-1 h-4 bg-accent rounded-full"></span>
                포트폴리오 수익률 TOP 5
              </div>
              {allPortfolioStats.length === 0 && <div className="text-muted-foreground/50 text-xs">포트폴리오를 먼저 생성해 주세요</div>}
              {allPortfolioStats.slice(0, 5).map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => { setActivePortfolioId(p.id); setActiveTab(3); }}
                  className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 mb-2.5 cursor-pointer border border-transparent hover:border-primary/30 transition-all duration-300 card-hover animate-fade-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-card-foreground truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{p.tickers.length}{"종목 \u00B7 CAGR "}{fmtPct(p.cagr)}</div>
                  </div>
                  <div className="shrink-0">
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden mb-1.5">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.abs(p.pnlPct) * 150)}%`, background: pnlColor(p.pnlPct) }} />
                    </div>
                    <div className="text-sm font-bold text-right tabular-nums" style={{ color: pnlColor(p.pnlPct) }}>{fmtPct(p.pnlPct)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-br from-card via-card/90 to-muted/30 rounded-2xl p-5 border border-border shadow-lg">
              <div className="text-[10px] text-muted-foreground mb-4 tracking-wider uppercase font-semibold flex items-center gap-2">
                <span className="w-1 h-4 bg-warning rounded-full"></span>
                운영 안내
              </div>
              <div className="flex flex-col gap-2.5 text-xs text-muted-foreground/80 leading-relaxed">
                {[
                  { label: "4% 인출 규칙", text: "은퇴 자산의 연 4%를 인출해도 30년 이상 유지 (Trinity Study)", color: "#4ade80" },
                  { label: "물가상승률 2.5%", text: "목표 인출액 실질 가치 환산 후 목표 자산 역산", color: "#fbbf24" },
                  { label: "CAGR 7% 초과 경고", text: "공격적 자산 배분 또는 납입액 증가 검토 권고", color: "#f87171" },
                  { label: "로컬 저장", text: "모든 데이터 IndexedDB 저장, 외부 서버 전송 없음", color: "#60a5fa" },
                ].map(({ label, text, color }, idx) => (
                  <div key={label} className="bg-muted/50 rounded-xl px-4 py-3 hover:bg-muted transition-all duration-300 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                    <span className="font-semibold" style={{ color }}>{label}</span>{": "}{text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Portfolio creation modal */}
      {portfolioModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setPortfolioModal(false)}
        >
          <div className="bg-card border border-input rounded-2xl p-5 w-full max-w-[540px] max-h-[82vh] overflow-y-auto">
            <div className="text-[15px] font-bold text-card-foreground mb-1">포트폴리오 생성</div>
            <div className="text-[11px] text-muted-foreground mb-4">종목을 선택하고 목표 비중(선택)을 설정하세요</div>
            <label className="flex flex-col gap-1.5 mb-4">
              <span className="text-[10px] text-muted-foreground">포트폴리오 이름</span>
              <input
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="예: 성장주 전략"
                className="bg-muted border border-input rounded-lg px-3 py-2 text-card-foreground text-sm focus:border-primary/50 transition-colors"
              />
            </label>
            {PORTFOLIO_CATEGORIES.map((cat) => {
              const catHoldings = activeHoldings.filter((h) => h.assetClass === cat.key);
              if (!catHoldings.length) return null;
              return (
                <div key={cat.key} className="mb-3">
                  <div className="text-[10px] mb-2 tracking-wide" style={{ color: cat.color }}>{"\u25B8 "}{cat.label}</div>
                  {catHoldings.map((h) => {
                    const isSel = portfolioTickers.has(h.ticker);
                    return (
                      <div
                        key={h.ticker}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1.5 transition-all border ${
                          isSel ? "bg-[#0d2818] border-[#166534]" : "bg-muted border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 cursor-pointer"
                          checked={isSel}
                          onChange={() => setPortfolioTickers((prev) => { const n = new Set(prev); n.has(h.ticker) ? n.delete(h.ticker) : n.add(h.ticker); return n; })}
                        />
                        <div className="flex-1">
                          <div className="text-xs text-card-foreground font-semibold">{displayName(h)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {/^\d{5,6}$/.test(h.ticker) ? h.ticker : h.name}{" \u00B7 "}{fmt(h.qty)}{"주 \u00B7 avg "}{h.currency === "USD" ? "$" : "\u20A9"}{fmt(h.avgCost, 1)}
                          </div>
                        </div>
                        {isSel && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="비중%"
                              min="0"
                              max="100"
                              value={portfolioTargetWeights[h.ticker] || ""}
                              onChange={(e) => setPortfolioTargetWeights((p) => ({ ...p, [h.ticker]: parseFloat(e.target.value) || 0 }))}
                              className="bg-card border border-input rounded-md px-2 py-1 text-card-foreground text-[11px] w-16 text-right focus:border-primary/50 transition-colors"
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex gap-2 justify-end mt-2">
              <button
                className="px-3 py-1.5 rounded-lg text-xs border border-input text-muted-foreground/80 bg-card hover:bg-surface-elevated transition-colors"
                onClick={() => setPortfolioModal(false)}
              >
                취소
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-xs border border-[#166534] text-primary bg-[#0d2818] hover:bg-[#145224] transition-colors disabled:opacity-30"
                onClick={savePortfolio}
                disabled={!newPortfolioName.trim() || !portfolioTickers.size}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}