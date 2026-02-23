import * as XLSX from "xlsx";
import {
  TX_TYPE,
  ASSET_CLASS,
  KR_ETF_KEYWORDS,
  US_ETF_KEYWORDS,
  type Transaction,
  type AssetClassType,
  type UnmappedName,
} from "./constants";

const COL_ALIASES: Record<string, string> = {
  "거래일": "date", "거래일자": "date", "체결일": "date", "날짜": "date", "일자": "date",
  "종목명": "name", "종목": "name", "상품명": "name", "종목/상품명": "name",
  "종목코드": "ticker", "단축코드": "ticker", "티커": "ticker", "symbol": "ticker",
  "거래구분": "txTypeRaw", "거래유형": "txTypeRaw", "구분": "txTypeRaw", "유형": "txTypeRaw",
  "수량": "qty", "거래수량": "qty", "체결수량": "qty",
  "단가": "price", "거래단가": "price", "체결단가": "price",
  "거래금액": "amount", "결제금액": "amount", "거래대금": "amount", "금액": "amount",
  "수수료": "fee", "세금": "tax",
  "환율": "fxRate", "적용환율": "fxRate",
  "통화": "currency",
  "원화금액": "amountKRW", "원화환산": "amountKRW",
  "원번호": "refId", "주문번호": "refId",
  "계좌": "account", "계좌명": "account", "계좌번호": "accountNo",
};

const TX_TYPE_MAP: Record<string, string> = {
  "매수": TX_TYPE.BUY, "주식매수": TX_TYPE.BUY, "장내매수": TX_TYPE.BUY,
  "주식매수입고": TX_TYPE.BUY, "교체매매매수": TX_TYPE.BUY, "buy": TX_TYPE.BUY,
  "매도": TX_TYPE.SELL, "주식매도": TX_TYPE.SELL, "장내매도": TX_TYPE.SELL, "sell": TX_TYPE.SELL,
  "주식매수출금": TX_TYPE.BUY,
  "입금": TX_TYPE.DEPOSIT, "현금입금": TX_TYPE.DEPOSIT, "예수금입금": TX_TYPE.DEPOSIT, "deposit": TX_TYPE.DEPOSIT,
  "출금": TX_TYPE.WITHDRAWAL, "현금출금": TX_TYPE.WITHDRAWAL, "withdrawal": TX_TYPE.WITHDRAWAL,
  "배당금": TX_TYPE.DIVIDEND, "배당": TX_TYPE.DIVIDEND, "dividend": TX_TYPE.DIVIDEND,
  "이자": TX_TYPE.INTEREST, "예탁금이용료": TX_TYPE.INTEREST,
  "제세금": TX_TYPE.TAX, "배당세": TX_TYPE.TAX, "세금": TX_TYPE.TAX,
  "수수료": TX_TYPE.FEE, "보관수수료": TX_TYPE.FEE, "adr수수료": TX_TYPE.FEE,
  "합병": TX_TYPE.MERGER_SPLIT, "액면병합": TX_TYPE.MERGER_SPLIT, "분할": TX_TYPE.MERGER_SPLIT,
  "채권만기상환출고": TX_TYPE.SELL, "상환금입금": TX_TYPE.DEPOSIT,
};

function normalizeHeader(h: string): string {
  return (h || "").toString().trim().toLowerCase().replace(/\s+/g, "");
}

function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  return parseFloat(String(v).replace(/[,\s]/g, "")) || 0;
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).replace(/[./\s]/g, "-");
  const m = s.match(/(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (COL_ALIASES[n]) {
      map[COL_ALIASES[n]] = i;
      return;
    }
    for (const [alias, field] of Object.entries(COL_ALIASES)) {
      if (n.includes(alias) || alias.includes(n)) {
        if (map[field] === undefined) map[field] = i;
      }
    }
  });
  return map;
}

function mapTxType(raw: string): string {
  if (!raw) return TX_TYPE.DEPOSIT;
  const n = raw.trim().toLowerCase().replace(/\s+/g, "");
  for (const [k, v] of Object.entries(TX_TYPE_MAP)) {
    if (n.includes(k.toLowerCase())) return v;
  }
  return TX_TYPE.DEPOSIT;
}

export function detectAssetClass(tx: { name?: string; ticker?: string; currency?: string }): AssetClassType {
  const name = (tx.name || "").toUpperCase();
  const ticker = (tx.ticker || "").toUpperCase();
  if ((tx.name || "").includes("채권") || (tx.name || "").includes("bond")) return ASSET_CLASS.KR_BOND;
  if ((tx.name || "").includes("금현물") || (tx.name || "").includes("금 현물")) return ASSET_CLASS.GOLD;
  if (tx.currency === "USD") {
    if (US_ETF_KEYWORDS.some((k) => name.includes(k) || ticker.includes(k))) return ASSET_CLASS.US_ETF;
    if (ticker.match(/^[A-Z]{3,5}$/) && (name.includes("ETF") || name.includes("FUND"))) return ASSET_CLASS.US_ETF;
    return ASSET_CLASS.US_STOCK;
  }
  if (KR_ETF_KEYWORDS.some((k) => name.includes(k))) return ASSET_CLASS.KR_ETF;
  return ASSET_CLASS.KR_STOCK;
}

function rowsToTransactions(
  rows: unknown[][],
  colMap: Record<string, number>,
  unmapped: UnmappedName[],
  accountLabel: string
): Partial<Transaction>[] {
  const result: Partial<Transaction>[] = [];
  rows.forEach((row) => {
    const get = (f: string) => colMap[f] !== undefined ? row[colMap[f]] : undefined;
    const name = (get("name") || "").toString().trim();
    const ticker = (get("ticker") || "").toString().trim().toUpperCase();
    const txTypeRaw = (get("txTypeRaw") || "").toString().trim();
    const date = parseDate(get("date"));
    const qty = parseNumber(get("qty"));
    const price = parseNumber(get("price"));
    const amount = parseNumber(get("amount"));
    const fee = parseNumber(get("fee"));
    const tax = parseNumber(get("tax"));
    const fxRate = parseNumber(get("fxRate")) || 1;
    const currency = (get("currency") || "KRW").toString().trim().toUpperCase();
    const refId = (get("refId") || "").toString().trim();
    const accountFromRow = (get("account") || "").toString().trim();
    if (!date && !name && !txTypeRaw) return;
    const txType = mapTxType(txTypeRaw);
    const finalAmount = amount || qty * price;
    const amountKRW = currency === "USD" ? (parseNumber(get("amountKRW")) || finalAmount * fxRate) : finalAmount;
    const tx = {
      date, name, ticker: ticker || null, txType, txTypeRaw, qty, price,
      amount: finalAmount, amountKRW, fee, tax, fxRate, currency, refId,
      account: accountFromRow || accountLabel || "기본계좌",
    };
    if (name && !ticker && [TX_TYPE.BUY, TX_TYPE.SELL, TX_TYPE.DIVIDEND].includes(txType)) {
      if (!unmapped.find((u) => u.name === name)) unmapped.push({ name, ticker: "" });
    }
    result.push(tx);
  });
  return result;
}

function deduplicateTransactions(txs: Partial<Transaction>[]): Partial<Transaction>[] {
  const used = new Set<number>();
  const merged: Partial<Transaction>[] = [];
  txs.forEach((tx, i) => {
    if (used.has(i)) return;
    let twin: Partial<Transaction> | null = null;
    let twinIdx = -1;
    for (let j = i + 1; j < txs.length; j++) {
      if (used.has(j)) continue;
      const t = txs[j];
      if (
        t.date === tx.date && t.name === tx.name &&
        Math.abs((t.amount || 0) - (tx.amount || 0)) < 1 &&
        tx.refId && t.refId && tx.refId === t.refId
      ) {
        twin = t;
        twinIdx = j;
        break;
      }
    }
    if (twin) {
      const master = [TX_TYPE.BUY, TX_TYPE.SELL].includes(tx.txType!) ? tx : twin;
      const slave = master === tx ? twin : tx;
      merged.push({ ...master, fee: (master.fee || 0) + (slave.fee || 0), tax: (master.tax || 0) + (slave.tax || 0) });
      used.add(i);
      used.add(twinIdx);
    } else {
      merged.push(tx);
      used.add(i);
    }
  });
  return merged;
}

export function processRawData(
  headers: string[],
  rows: unknown[][],
  tickerMapCache: Record<string, string>,
  accountLabel: string
): { txs: Transaction[]; unmapped: UnmappedName[] } {
  const colMap = mapColumns(headers);
  const unmapped: UnmappedName[] = [];
  let txs = rowsToTransactions(rows, colMap, unmapped, accountLabel);
  txs = txs.map((tx) => {
    if (!tx.ticker && tx.name && tickerMapCache[tx.name!])
      return { ...tx, ticker: tickerMapCache[tx.name!] };
    return tx;
  });
  txs = deduplicateTransactions(txs);
  txs = txs.map((tx, i) => ({
    ...tx,
    id: Date.now() + i,
    assetClass: detectAssetClass(tx as { name?: string; ticker?: string; currency?: string }),
  }));
  return { txs: txs as Transaction[], unmapped };
}

export function parseTSV(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const firstLine = lines[0];
  const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : null;
  if (!sep) return null;
  return {
    headers: firstLine.split(sep),
    rows: lines.slice(1).map((l) => l.split(sep)),
  };
}

export function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: unknown[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        if (data.length < 2) {
          reject("Empty sheet");
          return;
        }
        resolve({ headers: data[0].map(String), rows: data.slice(1) });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
