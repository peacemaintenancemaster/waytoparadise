import { TX_TYPE, type Transaction, type Holding } from "./constants";
import { detectAssetClass } from "./parsing";

export function buildHoldings(transactions: Transaction[]): Record<string, Holding> {
  const holdings: Record<string, Holding> = {};
  [...transactions]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach((tx) => {
      const key = tx.ticker || tx.name;
      if (!key) return;
      if (!holdings[key]) {
        holdings[key] = {
          ticker: tx.ticker || key,
          name: tx.name || tx.ticker || "",
          currency: tx.currency,
          qty: 0,
          avgCost: 0,
          totalCost: 0,
          realizedPnL: 0,
          dividends: 0,
          fees: 0,
          fxRate: tx.fxRate || 1,
          assetClass: tx.assetClass || detectAssetClass(tx),
          transactions: [],
          lastSellDate: null,
        };
      }
      const h = holdings[key];
      h.transactions.push(tx);
      h.fees += tx.fee || 0;
      if (tx.txType === TX_TYPE.BUY) {
        h.totalCost += tx.amount + (tx.fee || 0);
        h.qty += tx.qty;
        h.avgCost = h.qty > 0 ? h.totalCost / h.qty : 0;
      } else if (tx.txType === TX_TYPE.SELL) {
        h.realizedPnL += tx.amount - (tx.fee || 0) - (tx.tax || 0) - h.avgCost * tx.qty;
        h.qty = Math.max(0, h.qty - tx.qty);
        h.totalCost = h.avgCost * h.qty;
        if (h.qty === 0) {
          h.avgCost = 0;
          h.totalCost = 0;
        }
        h.lastSellDate = tx.date;
      } else if (tx.txType === TX_TYPE.DIVIDEND) {
        h.dividends += tx.amount;
      } else if (tx.txType === TX_TYPE.FEE) {
        h.totalCost += tx.amount;
        if (h.qty > 0) h.avgCost = h.totalCost / h.qty;
      }
      h.fxRate = tx.fxRate || h.fxRate;
    });
  return holdings;
}

export function calcZScore(v: number, mean: number, sd: number): number {
  return sd === 0 ? 0 : (v - mean) / sd;
}

export function weatherFromZScore(z: number, positiveIsGood = true): string {
  const s = positiveIsGood ? z : -z;
  if (s > 1.5) return "sunny";
  if (s > 0.5) return "cloudy";
  if (s > -0.5) return "overcast";
  if (s > -1.5) return "rainy";
  return "storm";
}

export interface RetirementParams {
  birthYear: number;
  currentAssets: number;         // 만원
  monthlySaving: number;         // 만원/월
  savingIncreaseEveryN: number;  // N년마다
  savingIncreaseAmount: number;  // 만원 증액
  retirementYear: number;
  monthlyExpense: number;        // 은퇴 후 월 생활비 (만원, 현재가치)
  growthRateBefore: number;      // 은퇴 전 연 수익률 (0.08 etc)
  growthRateAfter: number;       // 은퇴 후 연 수익률 (0.04 etc)
  inflationRate: number;         // 0.025 etc
  currentYear: number;
}

export interface RetirementResult {
  depletionYear: number | null;  // null = 100세 이상 안전
  depletionAge: number | null;
  peakAssets: number;            // 최고 자산
  retirementAssets: number;      // 은퇴 시점 자산
  avgAnnualSaving: number;       // 은퇴 전 평균 연간 저축
  trajectory: { year: number; value: number; retired: boolean }[];
  isSafe: boolean;
}

export function simulateRetirement(params: RetirementParams): RetirementResult | null {
  const {
    birthYear, currentAssets, monthlySaving, savingIncreaseEveryN, savingIncreaseAmount,
    retirementYear, monthlyExpense, growthRateBefore, growthRateAfter,
    inflationRate, currentYear,
  } = params;

  const accumulationYears = retirementYear - currentYear;
  if (accumulationYears < 0) return null;

  const MAX_SIM_YEAR = birthYear + 120;
  const trajectory: { year: number; value: number; retired: boolean }[] = [];

  let assets = currentAssets; // 만원
  let depletionYear: number | null = null;

  // --- 은퇴 전: 저축 단계 ---
  for (let y = 0; y < accumulationYears; y++) {
    const yearsElapsed = y;
    // 저축 증액: N년마다 M만원 증액
    const increments = savingIncreaseEveryN > 0 ? Math.floor(yearsElapsed / savingIncreaseEveryN) : 0;
    const annualSaving = (monthlySaving + increments * savingIncreaseAmount) * 12;
    assets = assets * (1 + growthRateBefore) + annualSaving;
    trajectory.push({ year: currentYear + y + 1, value: Math.max(0, assets), retired: false });
  }

  const retirementAssets = assets;
  const accumulationPeriod = trajectory.filter(t => !t.retired);
  const avgAnnualSaving = accumulationPeriod.length > 0
    ? accumulationPeriod.reduce((s, _, i) => {
        const increments = savingIncreaseEveryN > 0 ? Math.floor(i / savingIncreaseEveryN) : 0;
        return s + (monthlySaving + increments * savingIncreaseAmount) * 12;
      }, 0) / accumulationPeriod.length
    : monthlySaving * 12;

  // --- 은퇴 후: 인출 단계 ---
  for (let y = 0; y <= MAX_SIM_YEAR - retirementYear; y++) {
    const yearsRetired = y;
    // 물가 반영 인출액 (현재가치 기준 월 생활비)
    const annualWithdrawal = monthlyExpense * 12 * Math.pow(1 + inflationRate, accumulationYears + yearsRetired);
    assets = assets * (1 + growthRateAfter) - annualWithdrawal;
    const year = retirementYear + y + 1;
    if (assets <= 0) {
      trajectory.push({ year, value: 0, retired: true });
      if (!depletionYear) depletionYear = year;
      break;
    }
    trajectory.push({ year, value: assets, retired: true });
    if (year > MAX_SIM_YEAR) break;
  }

  const peakAssets = Math.max(...trajectory.map(t => t.value));
  const isSafe = depletionYear === null;
  const depletionAge = depletionYear ? depletionYear - birthYear : null;

  return {
    depletionYear, depletionAge, peakAssets, retirementAssets,
    avgAnnualSaving, trajectory, isSafe,
  };
}

export function displayName(h: { ticker?: string | null; name?: string }): string {
  if (!h) return "";
  return /^\d{5,6}$/.test(h.ticker || "") ? h.name || "" : h.ticker || h.name || "";
}

export function pnlColor(v: number): string {
  return v >= 0 ? "#4ade80" : "#f87171";
}

export function fmt(n: number, d = 0): string {
  return Number(n || 0).toLocaleString("ko-KR", { maximumFractionDigits: d });
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

export function fmtWon(n: number): string {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  return `${Math.round(n / 1e4)}만`;
}
