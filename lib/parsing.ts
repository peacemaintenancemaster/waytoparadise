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

const COL_ALIASES: Record<string, string[]> = {
  "date": ["거래일자", "거래일", "체결일", "날짜", "일자"],
  "name": ["종목명", "종목", "상품명", "종목/상품명"],
  "ticker": ["종목코드", "단축코드", "티커", "symbol"],
  "txTypeRaw": ["적요명", "거래구분", "거래유형", "구분", "유형", "거래종류"], 
  "qty": ["거래수량", "체결수량", "수량"],
  "price": ["거래단가/환율", "거래단가", "체결단가", "단가"],
  "amount": ["정산금액(외)", "정산금액", "외화거래금액", "결제금액", "거래대금", "거래금액", "외화입출금액", "금액"],
  "fee": ["수수료(외)", "수수료"],
  "tax": ["제세금합", "세금합", "제세금", "세금", "외국납부세액"],
  "fxRate": ["적용환율", "당시환율", "환율"],
  "currency": ["통화코드", "통화"],
  "amountKRW": ["원화금액", "원화환산", "당시원화가치"],
  "refId": ["원번호", "주문번호", "거래번호"],
  "account": ["계좌명", "계좌번호", "계좌"],
};

const GLOBAL_FALLBACK_MAP: Record<string, string> = {
  "은현물아이셰어즈ETF": "SLV",
  "기가클라우드테크놀로지": "GCT",
  "애플": "AAPL",
  "테슬라": "TSLA",
  "마이크로소프트": "MSFT",
  "엔비디아": "NVDA",
  "아마존닷컴": "AMZN",
  "알파벳 A": "GOOGL",
  "알파벳 C": "GOOG",
  "메타 플랫폼스": "META",
  "넷플릭스": "NFLX",
  "INVESCO QQQ TRUST SR 1": "QQQ",
  "SPDR S&P 500 ETF TRUST": "SPY",
  "VANGUARD S&P 500 ETF": "VOO",
  "ISHARES CORE S&P 500 ETF": "IVV",
  "PROSHARES ULTRAPRO QQQ": "TQQQ",
  "DIREXION DAILY SEMICONDUCTOR BULL 3X": "SOXL",
  "SCHWAB US DIVIDEND EQUITY ETF": "SCHD",
};

const TX_TYPE_MAP: Record<string, string> = {
  "주식매수출금": "IGNORE", "금현물매수출금": "IGNORE",
  "주식매도입금": "IGNORE", "금현물매도입금": "IGNORE",
  "채권매수출금": "IGNORE", "장외채권매수출금": "IGNORE", "장내채권매수출금": "IGNORE",
  "채권매도입금": "IGNORE", "장외채권매도입금": "IGNORE", "장내채권매도입금": "IGNORE",
  
  "매수": TX_TYPE.BUY, "주식매수": TX_TYPE.BUY, "장내매수": TX_TYPE.BUY,
  "주식매수입고": TX_TYPE.BUY, "교체매매매수": TX_TYPE.BUY, "buy": TX_TYPE.BUY,
  "금현물매수입고": TX_TYPE.BUY,
  "채권매수": TX_TYPE.BUY, "장외채권매수": TX_TYPE.BUY, "장내채권매수": TX_TYPE.BUY,
  
  "매도": TX_TYPE.SELL, "주식매도": TX_TYPE.SELL, "장내매도": TX_TYPE.SELL, "sell": TX_TYPE.SELL,
  "주식매도출고": TX_TYPE.SELL, "금현물매도출고": TX_TYPE.SELL, 
  "채권매도": TX_TYPE.SELL, "장외채권매도": TX_TYPE.SELL, "장내채권매도": TX_TYPE.SELL,
  "채권만기상환출고": TX_TYPE.SELL, "만기상환": TX_TYPE.SELL, "원금상환": TX_TYPE.SELL,
  
  "입금": TX_TYPE.DEPOSIT, "현금입금": TX_TYPE.DEPOSIT, "예수금입금": TX_TYPE.DEPOSIT, "deposit": TX_TYPE.DEPOSIT,
  "이체입금": TX_TYPE.DEPOSIT, "계좌대체입금": TX_TYPE.DEPOSIT, "해외이벤트입금": TX_TYPE.DEPOSIT, "상환금입금": TX_TYPE.DEPOSIT,
  
  "출금": TX_TYPE.WITHDRAWAL, "현금출금": TX_TYPE.WITHDRAWAL, "withdrawal": TX_TYPE.WITHDRAWAL, "계좌대체출금": TX_TYPE.WITHDRAWAL,
  
  "배당금": TX_TYPE.DIVIDEND, "배당": TX_TYPE.DIVIDEND, "dividend": TX_TYPE.DIVIDEND,
  "이자": TX_TYPE.INTEREST, "예탁금이용료": TX_TYPE.INTEREST, "채권이자": TX_TYPE.INTEREST, "이표금": TX_TYPE.INTEREST,
  
  "제세금": TX_TYPE.TAX, "배당세": TX_TYPE.TAX, "세금": TX_TYPE.TAX, "배당세출금": TX_TYPE.TAX, "이자과세": TX_TYPE.TAX,
  "수수료": TX_TYPE.FEE, "보관수수료": TX_TYPE.FEE, "adr수수료": TX_TYPE.FEE,
  
  "합병": TX_TYPE.MERGER_SPLIT, "액면병합": TX_TYPE.MERGER_SPLIT, "분할": TX_TYPE.MERGER_SPLIT,
};

function normalizeHeader(h: any): string {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
}

function parseNumber(v: any): number {
  if (v == null || v === "") return 0;
  return parseFloat(String(v).replace(/[₩$,\s"]/g, "")) || 0;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).replace(/[./\s]/g, "-");
  const m = s.match(/(\d{4})-?(\d{1,2})-?(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headers.map(h => normalizeHeader(h));
  
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    let found = false;
    for (const alias of aliases) {
      const nAlias = normalizeHeader(alias);
      for (let i = 0; i < normalized.length; i++) {
        if (!normalized[i]) continue;
        if (normalized[i] === nAlias) {
          map[field] = i;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) continue;
    
    for (const alias of aliases) {
      const nAlias = normalizeHeader(alias);
      for (let i = 0; i < normalized.length; i++) {
        if (!normalized[i]) continue;
        if (normalized[i].includes(nAlias) || nAlias.includes(normalized[i])) {
          map[field] = i;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  return map;
}

function mapTxType(raw: string): string {
  if (!raw) return TX_TYPE.DEPOSIT;
  const n = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  const sortedKeys = Object.keys(TX_TYPE_MAP).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    if (n.includes(k.toLowerCase())) return TX_TYPE_MAP[k];
  }
  return TX_TYPE.DEPOSIT;
}

export function detectAssetClass(tx: any): AssetClassType {
  const name = String(tx.name || "").toUpperCase();
  const ticker = String(tx.ticker || "").toUpperCase();
  
  if (name.includes("금현물") || name.includes("금 현물")) return ASSET_CLASS.GOLD;
  if (tx.currency === "USD") {
    if (US_ETF_KEYWORDS.some((k) => name.includes(k) || ticker.includes(k))) return ASSET_CLASS.US_ETF;
    if (ticker.match(/^[A-Z]{3,5}$/) && (name.includes("ETF") || name.includes("FUND"))) return ASSET_CLASS.US_ETF;
    return ASSET_CLASS.US_STOCK;
  }
  if (KR_ETF_KEYWORDS.some((k) => name.includes(k))) return ASSET_CLASS.KR_ETF;
  return ASSET_CLASS.KR_STOCK;
}

function rowsToTransactions(
  rows: any[][],
  colMap: Record<string, number>,
  unmapped: UnmappedName[],
  accountLabel: string,
  tickerMapCache: Record<string, string>
): Partial<Transaction>[] {
  const result: Partial<Transaction>[] = [];
  rows.forEach((row) => {
    const get = (f: string) => colMap[f] !== undefined ? row[colMap[f]] : undefined;
    const name = String(get("name") || "").trim();
    const ticker = String(get("ticker") || "").trim().toUpperCase();
    const txTypeRaw = String(get("txTypeRaw") || "").trim();
    const date = parseDate(get("date"));
    const qty = parseNumber(get("qty"));
    const price = parseNumber(get("price"));
    const amount = parseNumber(get("amount"));
    const fee = parseNumber(get("fee"));
    const tax = parseNumber(get("tax"));
    const fxRate = parseNumber(get("fxRate")) || 1;
    const currency = String(get("currency") || "KRW").trim().toUpperCase();
    const refId = String(get("refId") || "").trim();
    
    if (!date && !name && !txTypeRaw) return;
    
    // 채권 관련 거래는 무조건 필터링 (건너뜀)
    const isBond = 
      name.includes("채권") || name.includes("BOND") || name.includes("캐피탈") || 
      name.includes("전단채") || name.includes("국고채") || name.includes("회사채") ||
      txTypeRaw.includes("채권");
    if (isBond) return;
    
    const txType = mapTxType(txTypeRaw);
    if (txType === "IGNORE") return; 
    
    const finalAmount = amount || qty * price;
    const amountKRW = currency === "USD" ? (parseNumber(get("amountKRW")) || finalAmount * fxRate) : finalAmount;
    
    const tx: Partial<Transaction> = {
      date, name, ticker: ticker || null, txType: txType as any, txTypeRaw, qty, price,
      amount: finalAmount, amountKRW, fee, tax, fxRate, currency, refId,
      // 중요: CSV의 상대방 은행(계좌)을 무시하고 파일명(accountLabel)을 최우선으로 적용
      account: accountLabel || "기본계좌", 
    };
    
    const isSpecialAsset = name.includes("금현물") || name.includes("금 현물") || txTypeRaw.includes("금현물");

    if (name && !ticker && !isSpecialAsset && ([TX_TYPE.BUY, TX_TYPE.SELL, TX_TYPE.DIVIDEND] as string[]).includes(txType as string)) {
      if (!tickerMapCache[name] && !GLOBAL_FALLBACK_MAP[name]) {
        if (!unmapped.find((u) => u.name === name)) unmapped.push({ name, ticker: "" });
      }
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
      const master = ([TX_TYPE.BUY, TX_TYPE.SELL] as string[]).includes(tx.txType as string) ? tx : twin;
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
  rawRows: any[][],
  tickerMapCache: Record<string, string>,
  accountLabel: string
): { txs: Transaction[]; unmapped: UnmappedName[] } {
  let bestIdx = -1;
  let maxMatches = 0;
  let colMap: Record<string, number> = {};

  const limit = Math.min(rawRows.length, 10);
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const headers = row.map(h => String(h));
    const map = mapColumns(headers);
    const matchCount = Object.keys(map).length;

    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestIdx = i;
      colMap = map;
    }
  }

  const unmapped: UnmappedName[] = [];
  
  if (bestIdx === -1 || maxMatches === 0) {
    return { txs: [], unmapped };
  }

  const dataRows = rawRows.slice(bestIdx + 1);
  let txs = rowsToTransactions(dataRows, colMap, unmapped, accountLabel, tickerMapCache);

  txs = txs.map((tx) => {
    if (!tx.ticker && tx.name) {
      if (tickerMapCache[tx.name]) {
        return { ...tx, ticker: tickerMapCache[tx.name] };
      } else if (GLOBAL_FALLBACK_MAP[tx.name]) {
        return { ...tx, ticker: GLOBAL_FALLBACK_MAP[tx.name] };
      }
    }
    return tx;
  });
  
  txs = deduplicateTransactions(txs);
  txs = txs.map((tx, i) => ({
    ...tx,
    id: Date.now() + i,
    assetClass: detectAssetClass(tx),
  }));
  
  return { txs: txs as Transaction[], unmapped };
}

export function parseCSVText(text: string, sep: string = ","): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  
  if (!text) return result;
  if (!text.includes(sep) && sep === "," && text.includes("\t")) {
    sep = "\t";
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; 
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === sep) {
        row.push(current);
        current = "";
      } else if (c === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        row.push(current);
        result.push(row);
        row = [];
        current = "";
        i++; 
      } else if (c === '\n' || c === '\r') {
        row.push(current);
        result.push(row);
        row = [];
        current = "";
      } else {
        current += c;
      }
    }
  }
  if (current || text[text.length - 1] === sep) {
    row.push(current);
  }
  if (row.length > 0) {
    result.push(row);
  }
  return result;
}

export function parseFile(file: File): Promise<{ rows: any[][] }> {
  return new Promise((resolve, reject) => {
    const isExcel = !!file.name.match(/\.(xlsx|xls)$/i);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
          if (data.length < 1) return reject("Empty sheet");
          resolve({ rows: data });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          let text = new TextDecoder("utf-8").decode(buffer);
          if (text.includes("\uFFFD")) {
            text = new TextDecoder("euc-kr").decode(buffer);
          }
          const sep = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
          const rows = parseCSVText(text, sep);
          resolve({ rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file); 
    }
  });
}