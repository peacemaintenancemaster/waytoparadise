// app/api/price/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    // 서버 대 서버 통신이라 CORS 에러가 발생하지 않습니다.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Yahoo' }, { status: res.status });
    }

    const data = await res.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (price) {
      return NextResponse.json({ price });
    } else {
      return NextResponse.json({ error: 'Price not found in data' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}