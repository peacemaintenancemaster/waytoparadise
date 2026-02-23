import {
  TX_TYPE,
  ASSET_CLASS,
  KR_ETF_KEYWORDS,
  US_ETF_KEYWORDS,
  type TxType,
  type AssetClassType,
  type Transaction,
  type UnmappedName,
} from "./constants";

// ============================================================
// 숫자/날짜 파싱 유틸
// ============================================================
export function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  // ₩1,201 / $28.57 / "1,277.33" 같은 형태 모두 처리
  const s = String(v).replace(/[₩$,\s]/g, "").replace(/[^0-9.\-]/g, "");
  return parseFloat(s) || 0;
}

export function parseDate(v: unknown): string | null {
  if (!v) return null;
  // 2022/03/28, 2022-03-08, 20220308 모두 처리
  const s = String(v).replace(/[./]/g, "-");
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normalizeHeader(h: unknown): string {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
}

// ============================================================
// 거래 유형 매핑
// ============================================================
const TX_TYPE_MAP: Record<string, TxType> = {
  // 공통 매수
  매수: TX_TYPE.BUY,
  주식매수: TX_TYPE.BUY,
  장내매수: TX_TYPE.BUY,
  주식매수입고: TX_TYPE.BUY,
  교체매매매수: TX_TYPE.BUY,
  금현물매수입고: TX_TYPE.BUY,
  buy: TX_TYPE.BUY,
  // 공통 매도
  매도: TX_TYPE.SELL,
  주식매도: TX_TYPE.SELL,
  장내매도: TX_TYPE.SELL,
  채권만기상환출고: TX_TYPE.SELL,
  sell: TX_TYPE.SELL,
  // 키움 해외: 거래종류="매매", 적요명으로 구분
  매매: TX_TYPE.BUY, // 기본값; 적요명으로 재분류
  // 입금
  입금: TX_TYPE.DEPOSIT,
  현금입금: TX_TYPE.DEPOSIT,
  예수금입금: TX_TYPE.DEPOSIT,
  계좌대체입금: TX_TYPE.DEPOSIT,
  이체입금: TX_TYPE.DEPOSIT,
  이벤트입금: TX_TYPE.DEPOSIT,
  해외이벤트입금: TX_TYPE.DEPOSIT,
  상환금입금: TX_TYPE.DEPOSIT,
  환전정산입금: TX_TYPE.DEPOSIT,
  예탁금이용료입금: TX_TYPE.INTEREST,
  deposit: TX_TYPE.DEPOSIT,
  // 출금
  출금: TX_TYPE.WITHDRAWAL,
  현금출금: TX_TYPE.WITHDRAWAL,
  계좌대체출금: TX_TYPE.WITHDRAWAL,
  금현물매수출금: TX_TYPE.WITHDRAWAL,
  withdrawal: TX_TYPE.WITHDRAWAL,
  // 환전
  환전: TX_TYPE.FEE, // 환전은 FEE로 분류 (실손익 없음)
  원화주문외화매수: TX_TYPE.FEE,
  // 배당
  배당금: TX_TYPE.DIVIDEND,
  배당: TX_TYPE.DIVIDEND,
  dividend: TX_TYPE.DIVIDEND,
  // 이자
  이자: TX_TYPE.INTEREST,
  예탁금이용료: TX_TYPE.INTEREST,
  // 세금
  제세금: TX_TYPE.TAX,
  배당세: TX_TYPE.TAX,
  세금: TX_TYPE.TAX,
  // 수수료
  수수료: TX_TYPE.FEE,
  보관수수료: TX_TYPE.FEE,
  adr수수료: TX_TYPE.FEE,
  // 합병/분할
  합병: TX_TYPE.MERGER_SPLIT,
  액면병합: TX_TYPE.MERGER_SPLIT,
  분할: TX_TYPE.MERGER_SPLIT,
};

function mapTxType(raw: string, memo = ""): TxType {
  const n = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = memo.trim().toLowerCase().replace(/\s+/g, "");

  // 키움 해외: 거래종류="매매" + 적요명으로 매수/매도 구분
  if (n === "매매") {
    if (m.includes("매도")) return TX_TYPE.SELL;
    return TX_TYPE.BUY; // 기본 매수
  }

  // 직접 매칭
  if (TX_TYPE_MAP[n]) return TX_TYPE_MAP[n];

  // 부분 포함 매칭
  for (const [k, v] of Object.entries(TX_TYPE_MAP)) {
    if (n.includes(k) || k.includes(n)) return v;
  }

  return TX_TYPE.DEPOSIT;
}

// ============================================================
// 자산군 감지
// ============================================================
export function detectAssetClass(tx: Partial<Transaction>): AssetClassType {
  const name = (tx.name || "").toUpperCase();
  const ticker = (tx.ticker || "").toUpperCase();

  if ((tx.name || "").includes("채권") || (tx.name || "").includes("bond"))
    return ASSET_CLASS.KR_BOND;
  if (
    (tx.name || "").includes("금현물") ||
    (tx.name || "").includes("금 현물") ||
    (tx.name || "").toLowerCase().includes("gold")
  )
    return ASSET_CLASS.GOLD;

  if (tx.currency === "USD") {
    if (
      US_ETF_KEYWORDS.some((k) => name.includes(k) || ticker.includes(k)) ||
      (ticker.match(/^[A-Z]{2,5}$/) && name.includes("ETF"))
    )
      return ASSET_CLASS.US_ETF;
    return ASSET_CLASS.US_STOCK;
  }

  if (KR_ETF_KEYWORDS.some((k) => name.includes(k))) return ASSET_CLASS.KR_ETF;
  return ASSET_CLASS.KR_STOCK;
}

// ============================================================
// 헤더 → 필드 매핑 테이블
// ============================================================
const COL_ALIASES: Record<string, string> = {
  // 날짜
  거래일: "date", 거래일자: "date", 체결일: "date", 날짜: "date", 일자: "date",
  // 종목
  종목명: "name", 종목: "name", 상품명: "name", "종목/상품명": "name",
  // 티커
  종목코드: "ticker", 단축코드: "ticker", 티커: "ticker", symbol: "ticker",
  // 거래유형
  거래구분: "txTypeRaw", 거래유형: "txTypeRaw", 구분: "txTypeRaw", 유형: "txTypeRaw",
  거래종류: "txTypeRaw",
  // 적요(메모) - 키움해외에서 매수/매도 구분에 사용
  적요명: "memo", 적요: "memo",
  // 수량
  수량: "qty", 거래수량: "qty", 체결수량: "qty", 거래수량수량: "qty",
  "보유수량_증감": "qtyDelta",
  // 단가
  단가: "price", 거래단가: "price", 체결단가: "price", "거래단가/환율": "price",
  // 금액
  거래금액: "amount", 결제금액: "amount", 거래대금: "amount", 금액: "amount",
  "거래금액(외)": "amountFx", "정산금액(외)": "amountFx",
  입출금액: "amount",
  // 수수료/세금
  수수료: "fee", "수수료(외)": "fee", 세금: "tax", 제세금합: "tax", 세금합: "tax",
  // 환율
  환율: "fxRate", 적용환율: "fxRate", 당시환율: "fxRate",
  // 통화
  통화: "currency", 통화코드: "currency",
  // 원화환산
  원화금액: "amountKRW", 원화환산: "amountKRW",
  "거래자산의당시원화가치": "amountKRW",
  "거래자산의구매금액": "costKRW",
  // 참조번호
  원번호: "refId", 주문번호: "refId", 거래번호: "refId",
  // 계좌
  계좌: "account", 계좌명: "account", 계좌번호: "accountNo",
  // 거래소
  거래소: "exchange",
};

function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (COL_ALIASES[n]) {
      if (map[COL_ALIASES[n]] === undefined) map[COL_ALIASES[n]] = i;
      return;
    }
    for (const [alias, field] of Object.entries(COL_ALIASES)) {
      if (n === normalizeHeader(alias) || n.includes(normalizeHeader(alias))) {
        if (map[field] === undefined) map[field] = i;
      }
    }
  });
  return map;
}

// ============================================================
// 행 → Transaction 변환
// ============================================================
function rowsToTransactions(
  rows: unknown[][],
  colMap: Record<string, number>,
  tickerMapCache: Record<string, string>,
  accountLabel: string,
  unmapped: UnmappedName[]
): Transaction[] {
  const result: Transaction[] = [];

  rows.forEach((row) => {
    const get = (f: string): unknown =>
      colMap[f] !== undefined ? row[colMap[f]] : undefined;

    const rawName = String(get("name") || "").trim();
    const rawTicker = String(get("ticker") || "").trim().toUpperCase();
    const txTypeRaw = String(get("txTypeRaw") || "").trim();
    const memo = String(get("memo") || "").trim();
    const date = parseDate(get("date"));
    const currency = String(get("currency") || "KRW").trim().toUpperCase() || "KRW";
    const refId = String(get("refId") || "").trim();
    const exchange = String(get("exchange") || "").trim();

    // 수량: 키움 해외는 "거래수량" 또는 "보유수량_증감" 사용
    let qty = parseNumber(get("qty"));
    if (qty === 0) qty = Math.abs(parseNumber(get("qtyDelta")));

    const price = parseNumber(get("price"));
    const fee = parseNumber(get("fee"));
    const tax = parseNumber(get("tax"));

    // 금액 처리: 키움 해외는 거래금액이 0이고 "거래금액(외)"에 USD 금액 있음
    let amount = parseNumber(get("amount"));
    const amountFx = parseNumber(get("amountFx"));

    // fxRate: 키움해외 "당시환율"
    let fxRate = parseNumber(get("fxRate")) || 1;
    // ₩1,217 형태 이미 parseNumber로 처리됨

    // amountKRW
    let amountKRW = parseNumber(get("amountKRW"));

    // ------- 키움 해외 특수 처리 -------
    // 키움 해외: 거래금액=0, 외화금액(amountFx)에 USD 금액, 당시환율 있음
    if (currency === "USD" && amount === 0 && amountFx > 0) {
      amount = amountFx;
    }
    if (amount === 0 && qty > 0 && price > 0) {
      amount = qty * price;
    }
    // KRW 환산: 외화금액 × 환율
    if (amountKRW === 0 && amount > 0 && currency === "USD" && fxRate > 1) {
      amountKRW = amount * fxRate;
    }
    if (amountKRW === 0) amountKRW = amount;

    // ------- 미래에셋 금현물 특수 처리 -------
    // 금현물매수입고 + 금현물매수출금이 쌍으로 옴
    // 매수출금은 실제 현금 지출 → WITHDRAWAL로 처리 (건너뜀, 매수입고만 BUY로)
    const lowerRaw = txTypeRaw.toLowerCase().replace(/\s/g, "");
    if (lowerRaw.includes("매수출금") || lowerRaw.includes("계좌대체")) {
      // 현금 이동 행은 건너뜀 (매수는 입고 행으로만 처리)
      return;
    }

    // 빈 행 스킵
    if (!date && !rawName && !txTypeRaw) return;
    // 매수/매도가 아닌데 종목명 없으면 스킵 (입출금 등)
    const txType = mapTxType(txTypeRaw, memo);
    if (([TX_TYPE.DEPOSIT, TX_TYPE.WITHDRAWAL, TX_TYPE.FEE, TX_TYPE.INTEREST] as TxType[]).includes(txType) && !rawName && !rawTicker) return;

    // 티커 확정
    let ticker = rawTicker || null;
    if (!ticker && rawName && tickerMapCache[rawName]) {
      ticker = tickerMapCache[rawName];
    }

    // 미매핑 수집 (BUY/SELL/DIVIDEND이고 티커 없는 종목)
    if (rawName && !ticker && ([TX_TYPE.BUY, TX_TYPE.SELL, TX_TYPE.DIVIDEND] as TxType[]).includes(txType)) {
      if (!unmapped.find((u) => u.name === rawName)) {
        unmapped.push({ name: rawName, ticker: "" });
      }
    }

    // 자산군 판정용 임시 객체
    const partialTx = { name: rawName, ticker, currency, txType };

    const tx: Transaction = {
      id: 0, // placeholder; 재할당됨
      date,
      name: rawName,
      ticker,
      txType,
      txTypeRaw,
      qty,
      price,
      amount,
      amountKRW,
      fee,
      tax,
      fxRate,
      currency,
      refId,
      account: accountLabel,
      assetClass: detectAssetClass(partialTx),
    };

    result.push(tx);
  });

  return result;
}

// ============================================================
// 중복 제거
// ============================================================
function deduplicateTransactions(txs: Transaction[]): Transaction[] {
  const used = new Set<number>();
  const merged: Transaction[] = [];
  txs.forEach((tx, i) => {
    if (used.has(i)) return;
    let twin: Transaction | null = null;
    let twinIdx = -1;
    for (let j = i + 1; j < txs.length; j++) {
      if (used.has(j)) continue;
      const t = txs[j];
      if (
        t.date === tx.date &&
        t.name === tx.name &&
        Math.abs(t.amount - tx.amount) < 1 &&
        tx.refId && t.refId && tx.refId === t.refId
      ) {
        twin = t; twinIdx = j; break;
      }
    }
    if (twin && twinIdx >= 0) {
      const master = ([TX_TYPE.BUY, TX_TYPE.SELL] as TxType[]).includes(tx.txType) ? tx : twin;
      const slave = master === tx ? twin : tx;
      merged.push({ ...master, fee: master.fee + slave.fee, tax: master.tax + slave.tax });
      used.add(i); used.add(twinIdx);
    } else {
      merged.push(tx); used.add(i);
    }
  });
  return merged;
}

// ============================================================
// 공개 API: processRawData
// 인수: rawRows = [headers행, ...data행들] (2D 배열)
// ============================================================
export function processRawData(
  rawRows: unknown[][],
  tickerMapCache: Record<string, string>,
  accountLabel: string
): { txs: Transaction[]; unmapped: UnmappedName[] } {
  if (!rawRows || rawRows.length < 2) return { txs: [], unmapped: [] };

  const headers = rawRows[0].map(String);
  const dataRows = rawRows.slice(1).filter((r) => r.some((v) => v != null && v !== ""));
  const colMap = mapColumns(headers);
  const unmapped: UnmappedName[] = [];

  let txs = rowsToTransactions(dataRows, colMap, tickerMapCache, accountLabel, unmapped);
  txs = deduplicateTransactions(txs);
  // id 재할당 (타임스탬프 기반 임시 id → 실제 DB insert 전 정리)
  txs = txs.map((tx, i) => ({ ...tx, id: Date.now() + i } as Transaction));

  return { txs, unmapped };
}

// ============================================================
// 공개 API: parseCSVText
// TSV / CSV 텍스트를 2D 배열로 변환
// ============================================================
export function parseCSVText(text: string, sep?: string): unknown[][] | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  // 구분자 자동 감지
  const firstLine = lines[0];
  const delimiter = sep || (firstLine.includes("\t") ? "\t" : firstLine.includes(",") ? "," : null);
  if (!delimiter) return null;

  // CSV 따옴표 파싱 (미래에셋 금 파일에 "₩76,121" 같은 값 있음)
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === delimiter && !inQuote) {
        result.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  return lines.map((l) => splitLine(l));
}

// ============================================================
// 공개 API: parseFile
// File 객체를 받아 2D 배열로 변환 (xlsx / csv / tsv)
// ============================================================
export async function parseFile(file: File): Promise<{ rows: unknown[][] }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);

  if (isExcel) {
    // xlsx는 동적 import (Next.js 번들링)
    const XLSX = await import("xlsx");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target!.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
          if (data.length < 2) { reject(new Error("빈 시트")); return; }
          resolve({ rows: data });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // CSV / TSV
  const text = await file.text();

  // 인코딩 깨짐 감지 후 EUC-KR 재시도
  if (text.includes("â€") || text.includes("\uFFFD")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const decoded = e.target!.result as string;
          const rows = parseCSVText(decoded, ",") || parseCSVText(decoded, "\t");
          if (!rows) { reject(new Error("파싱 실패")); return; }
          resolve({ rows });
        } catch (err) { reject(err); }
      };
      reader.readAsText(file, "EUC-KR");
    });
  }

  const rows = parseCSVText(text, ",") || parseCSVText(text, "\t");
  if (!rows) throw new Error("구분자를 인식할 수 없습니다");
  return { rows };
}