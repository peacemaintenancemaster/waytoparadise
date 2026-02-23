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
  currentAssets: number;
  annualContribution: number;
  retirementYear: number;
  targetWithdrawal: number;
  currentYear: number;
  inflationRate: number;
}

export interface RetirementResult {
  requiredCAGR: number;
  targetFV: number;
  trajectory: { year: number; value: number }[];
}

export function simulateRetirement(params: RetirementParams): RetirementResult | null {
  const { currentAssets, annualContribution, retirementYear, targetWithdrawal, currentYear, inflationRate } = params;
  const years = retirementYear - currentYear;
  if (years <= 0) return null;
  const targetFV = targetWithdrawal * 25 * Math.pow(1 + inflationRate, years);
  let lo = -0.2,
    hi = 0.6;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const r = mid === 0 ? 0 : (Math.pow(1 + mid, years) - 1) / mid;
    if (currentAssets * Math.pow(1 + mid, years) + annualContribution * r < targetFV) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const cagr = (lo + hi) / 2;
  const trajectory: { year: number; value: number }[] = [];
  for (let y = 0; y <= years; y++) {
    const r = cagr === 0 ? 0 : (Math.pow(1 + cagr, y) - 1) / cagr;
    trajectory.push({
      year: currentYear + y,
      value: currentAssets * Math.pow(1 + cagr, y) + annualContribution * r,
    });
  }
  return { requiredCAGR: cagr, targetFV, trajectory };
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
