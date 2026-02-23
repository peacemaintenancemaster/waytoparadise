export const TX_TYPE = {
  BUY: "BUY",
  SELL: "SELL",
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  DIVIDEND: "DIVIDEND",
  TAX: "TAX",
  FEE: "FEE",
  MERGER_SPLIT: "MERGER_SPLIT",
  INTEREST: "INTEREST",
} as const;

export type TxType = (typeof TX_TYPE)[keyof typeof TX_TYPE];

export const ASSET_CLASS = {
  KR_STOCK: "KR_STOCK",
  KR_ETF: "KR_ETF",
  US_STOCK: "US_STOCK",
  US_ETF: "US_ETF",
  KR_BOND: "KR_BOND",
  GOLD: "GOLD",
  PENSION: "PENSION",
  CASH: "CASH",
} as const;

export type AssetClassType = (typeof ASSET_CLASS)[keyof typeof ASSET_CLASS];

export const ASSET_CLASS_LABEL: Record<string, string> = {
  KR_STOCK: "국내주식",
  KR_ETF: "국내ETF",
  US_STOCK: "해외주식",
  US_ETF: "해외ETF",
  KR_BOND: "채권",
  GOLD: "금현물",
  PENSION: "연금",
  CASH: "현금",
};

export const ASSET_COLORS: Record<string, string> = {
  KR_STOCK: "#60a5fa",
  KR_ETF: "#38bdf8",
  US_STOCK: "#34d399",
  US_ETF: "#2dd4bf",
  KR_BOND: "#fbbf24",
  GOLD: "#f59e0b",
  PENSION: "#a78bfa",
  CASH: "#9ca3af",
};

export const WEATHER_ICONS: Record<string, string> = {
  sunny: "\u2600\uFE0F",
  cloudy: "\u26C5",
  overcast: "\u2601\uFE0F",
  rainy: "\uD83C\uDF27\uFE0F",
  storm: "\u26C8\uFE0F",
};

export const WEATHER_LABELS: Record<string, string> = {
  sunny: "맑음",
  cloudy: "구름조금",
  overcast: "흐림",
  rainy: "비",
  storm: "뇌우",
};

export const TX_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  BUY: { bg: "#0d2818", text: "#4ade80" },
  SELL: { bg: "#2d0f0f", text: "#f87171" },
  DIVIDEND: { bg: "#1a1a0d", text: "#fbbf24" },
  FEE: { bg: "#18102a", text: "#a78bfa" },
  TAX: { bg: "#18102a", text: "#c084fc" },
  DEPOSIT: { bg: "#0d1f2d", text: "#38bdf8" },
  WITHDRAWAL: { bg: "#2a1500", text: "#fb923c" },
  INTEREST: { bg: "#0d1f2d", text: "#67e8f9" },
  MERGER_SPLIT: { bg: "#1a1020", text: "#e879f9" },
};

export const TABS = [
  "대시보드",
  "거래내역",
  "종목분석",
  "포트폴리오",
  "거시경제",
  "은퇴플랜",
];

export const PORTFOLIO_CATEGORIES = [
  { key: "KR_STOCK", label: "국내주식", color: "#60a5fa" },
  { key: "KR_ETF", label: "국내ETF", color: "#38bdf8" },
  { key: "US_STOCK", label: "해외주식", color: "#34d399" },
  { key: "US_ETF", label: "해외ETF", color: "#2dd4bf" },
  { key: "GOLD", label: "금현물", color: "#f59e0b" },
  { key: "KR_BOND", label: "채권", color: "#fbbf24" },
];

export interface MacroIndicator {
  indicator: string;
  label: string;
  value: number;
  mean: number;
  stddev: number;
  positiveIsGood: boolean;
  weight: number;
  unit: string;
  region: string;
  description: string;
}

export const ALL_MACRO_INDICATORS: MacroIndicator[] = [
  { indicator: "US_CPI", label: "미국 소비자물가지수(CPI)", value: 3.2, mean: 2.5, stddev: 1.2, positiveIsGood: false, weight: 1.5, unit: "%", region: "미국", description: "전년 대비 소비자물가 상승률" },
  { indicator: "US_CORE_CPI", label: "미국 근원CPI", value: 3.8, mean: 2.4, stddev: 0.9, positiveIsGood: false, weight: 1.3, unit: "%", region: "미국", description: "에너지/식품 제외 CPI" },
  { indicator: "US_UNEMP", label: "미국 실업률", value: 3.9, mean: 5.5, stddev: 1.8, positiveIsGood: false, weight: 1.2, unit: "%", region: "미국", description: "낮을수록 경기 호황" },
  { indicator: "US_NFP", label: "미국 비농업고용(NFP)", value: 236, mean: 180, stddev: 80, positiveIsGood: true, weight: 1.2, unit: "천명", region: "미국", description: "월간 신규 일자리 수" },
  { indicator: "VIX", label: "VIX 변동성지수", value: 18.4, mean: 20.0, stddev: 6.5, positiveIsGood: false, weight: 1.4, unit: "", region: "글로벌", description: "S&P500 내재변동성, 공포지수" },
  { indicator: "US_GDP", label: "미국 GDP 성장률", value: 2.8, mean: 2.2, stddev: 1.5, positiveIsGood: true, weight: 1.3, unit: "%", region: "미국", description: "전기 대비 연율 성장률" },
  { indicator: "US_PMI_MFG", label: "미국 ISM 제조업 PMI", value: 48.7, mean: 51.0, stddev: 3.5, positiveIsGood: true, weight: 1.0, unit: "", region: "미국", description: "50 초과 시 경기 확장" },
  { indicator: "US_PMI_SVC", label: "미국 ISM 서비스 PMI", value: 52.6, mean: 54.0, stddev: 3.0, positiveIsGood: true, weight: 0.9, unit: "", region: "미국", description: "서비스업 경기 체감" },
  { indicator: "US_PPI", label: "미국 생산자물가지수(PPI)", value: 2.1, mean: 1.8, stddev: 1.5, positiveIsGood: false, weight: 0.9, unit: "%", region: "미국", description: "기업 생산비용 압력 선행지표" },
  { indicator: "US_FED_RATE", label: "미국 기준금리(FFR)", value: 5.25, mean: 2.5, stddev: 2.0, positiveIsGood: false, weight: 1.5, unit: "%", region: "미국", description: "연준 금리, 고금리는 주식 역풍" },
  { indicator: "US_10Y", label: "미국 10년 국채금리", value: 4.3, mean: 3.0, stddev: 1.2, positiveIsGood: false, weight: 1.2, unit: "%", region: "미국", description: "장기금리, 할인율 기준" },
  { indicator: "US_YIELD_CURVE", label: "미국 장단기금리차(10Y-2Y)", value: -0.4, mean: 0.8, stddev: 0.9, positiveIsGood: true, weight: 1.3, unit: "%p", region: "미국", description: "음수(역전)는 경기침체 선행" },
  { indicator: "DXY", label: "달러인덱스(DXY)", value: 104.5, mean: 95.0, stddev: 7.0, positiveIsGood: false, weight: 1.0, unit: "", region: "글로벌", description: "달러 강세는 신흥국/원자재 역풍" },
  { indicator: "US_RETAIL", label: "미국 소매판매 증가율", value: 3.2, mean: 4.0, stddev: 3.0, positiveIsGood: true, weight: 0.9, unit: "%", region: "미국", description: "소비 경기 바로미터" },
  { indicator: "US_CONF_CONSUMER", label: "미국 소비자신뢰지수", value: 104.7, mean: 100.0, stddev: 12.0, positiveIsGood: true, weight: 0.8, unit: "", region: "미국", description: "100 이상이면 낙관적" },
  { indicator: "KR_CPI", label: "한국 소비자물가지수(CPI)", value: 2.9, mean: 2.2, stddev: 0.8, positiveIsGood: false, weight: 1.0, unit: "%", region: "한국", description: "한국 물가상승 압력" },
  { indicator: "KR_RATE", label: "한국 기준금리", value: 3.5, mean: 2.0, stddev: 1.2, positiveIsGood: false, weight: 1.0, unit: "%", region: "한국", description: "한국은행 기준금리" },
  { indicator: "KR_GDP", label: "한국 GDP 성장률", value: 2.4, mean: 2.8, stddev: 1.5, positiveIsGood: true, weight: 0.9, unit: "%", region: "한국", description: "연간 실질 성장률" },
  { indicator: "KR_EXPORT", label: "한국 수출 증가율", value: 5.3, mean: 4.0, stddev: 10.0, positiveIsGood: true, weight: 1.0, unit: "%", region: "한국", description: "전년 동월 대비 수출액" },
  { indicator: "USD_KRW", label: "원/달러 환율", value: 1340, mean: 1150, stddev: 120, positiveIsGood: false, weight: 0.8, unit: "원", region: "한국", description: "높을수록 수입물가 부담 증가" },
  { indicator: "CN_PMI", label: "중국 제조업 PMI", value: 49.2, mean: 50.5, stddev: 1.5, positiveIsGood: true, weight: 0.9, unit: "", region: "중국", description: "중국 경기 체감, 한국 수출 선행" },
  { indicator: "OIL_WTI", label: "WTI 원유가격", value: 78.5, mean: 70.0, stddev: 15.0, positiveIsGood: false, weight: 0.9, unit: "$/bbl", region: "글로벌", description: "에너지 비용, 물가 압력 연동" },
  { indicator: "GOLD_PRICE", label: "금 현물가격", value: 2320, mean: 1700, stddev: 300, positiveIsGood: true, weight: 0.7, unit: "$/oz", region: "글로벌", description: "안전자산 수요/달러 약세 지표" },
  { indicator: "SP500_PE", label: "S&P500 PER(12M Fwd)", value: 22.1, mean: 17.5, stddev: 4.0, positiveIsGood: false, weight: 1.0, unit: "배", region: "미국", description: "고PER은 밸류에이션 부담" },
  { indicator: "NASDAQ_PERF", label: "나스닥100 1개월 성과", value: 2.1, mean: 1.5, stddev: 5.5, positiveIsGood: true, weight: 0.7, unit: "%", region: "미국", description: "기술주 모멘텀" },
];

export const DEFAULT_SELECTED_MACRO = [
  "US_CPI",
  "VIX",
  "US_UNEMP",
  "US_NFP",
  "US_GDP",
  "US_FED_RATE",
  "US_10Y",
  "DXY",
];

export const KR_ETF_KEYWORDS = [
  "KODEX", "TIGER", "KBSTAR", "HANARO", "ARIRANG",
  "KOSEF", "SOL", "ACE", "RISE", "TIMEFOLIO", "FOCUS",
];

export const US_ETF_KEYWORDS = [
  "ETF", "FUND", "SPDR", "ISHARES", "VANGUARD",
  "INVESCO", "PROSHARES",
];

export const TICKER_PAGE_SIZE = 12;

export interface Transaction {
  id: number;
  date: string | null;
  name: string;
  ticker: string | null;
  txType: TxType;
  txTypeRaw: string;
  qty: number;
  price: number;
  amount: number;
  amountKRW: number;
  fee: number;
  tax: number;
  fxRate: number;
  currency: string;
  refId: string;
  account: string;
  assetClass: AssetClassType;
}

export interface Holding {
  ticker: string;
  name: string;
  currency: string;
  qty: number;
  avgCost: number;
  totalCost: number;
  realizedPnL: number;
  dividends: number;
  fees: number;
  fxRate: number;
  assetClass: AssetClassType;
  transactions: Transaction[];
  lastSellDate: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  tickers: string[];
  targetWeights: Record<string, number>;
  createdAt: string;
}

export interface UnmappedName {
  name: string;
  ticker: string;
}
