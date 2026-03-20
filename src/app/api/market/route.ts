/**
 * Market Data API
 * ================
 * Fetches OHLCV candles from free providers (no MT5 required).
 * Works when deployed on Railway — no local bridge needed.
 *
 * Providers (tried in order):
 *  1. Twelve Data (free tier: 800 req/day, no key needed for basic)
 *  2. Alpha Vantage (free: 25 req/day, set ALPHA_VANTAGE_KEY env var)
 *  3. Synthetic demo data (always works as fallback)
 *
 * GET /api/market?symbol=EURUSD&timeframe=M15&count=100
 */

import { NextRequest, NextResponse } from 'next/server';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Twelve Data timeframe map
const TF_TWELVE: Record<string, string> = {
  M1: '1min', M5: '5min', M15: '15min', M30: '30min',
  H1: '1h', H4: '4h', D1: '1day', W1: '1week',
};

// Alpha Vantage interval map (for FX intraday)
const TF_AV: Record<string, string> = {
  M1: '1min', M5: '5min', M15: '15min', M30: '30min', H1: '60min',
};

async function fetchTwelveData(symbol: string, tf: string, count: number, apiKey?: string): Promise<Candle[] | null> {
  const interval = TF_TWELVE[tf] || '15min';
  const keyParam = apiKey ? `&apikey=${apiKey}` : '';
  // Twelve Data free endpoint — rate limited but no key required for basic
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${count}&format=JSON${keyParam}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.values || !Array.isArray(data.values)) return null;

    return data.values.reverse().map((v: {
      datetime: string; open: string; high: string; low: string; close: string; volume?: string;
    }) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume || '0'),
    }));
  } catch {
    return null;
  }
}

async function fetchAlphaVantage(symbol: string, tf: string, count: number, apiKey?: string): Promise<Candle[] | null> {
  const key = apiKey || process.env.ALPHA_VANTAGE_KEY || 'demo';
  const interval = TF_AV[tf];

  // Only forex pairs have FX_INTRADAY; for D1+ use FX_DAILY
  const isFx = /^[A-Z]{6}$/.test(symbol);
  const fromCur = symbol.slice(0, 3);
  const toCur = symbol.slice(3, 6);

  let url: string;
  let dataKey: string;

  if (isFx && interval) {
    url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${fromCur}&to_symbol=${toCur}&interval=${interval}&outputsize=full&apikey=${key}`;
    dataKey = `Time Series FX (${interval})`;
  } else if (isFx && (tf === 'D1' || tf === 'W1')) {
    url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${fromCur}&to_symbol=${toCur}&outputsize=full&apikey=${key}`;
    dataKey = 'Time Series FX (Daily)';
  } else {
    // Crypto or stock
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${key}`;
    dataKey = 'Time Series (Daily)';
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const series = data[dataKey];
    if (!series) return null;

    const entries = Object.entries(series).slice(0, count);
    return entries.reverse().map(([datetime, v]) => {
      const vals = v as Record<string, string>;
      const keys = Object.keys(vals);
      return {
        time: Math.floor(new Date(datetime).getTime() / 1000),
        open: parseFloat(vals[keys[0]]),
        high: parseFloat(vals[keys[1]]),
        low: parseFloat(vals[keys[2]]),
        close: parseFloat(vals[keys[3]]),
        volume: parseInt(vals[keys[4]] || '0'),
      };
    });
  } catch {
    return null;
  }
}

function generateSyntheticCandles(symbol: string, tf: string, count: number): Candle[] {
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, AUDUSD: 0.6550,
    BTCUSDT: 68000, ETHUSDT: 3500, XAUUSD: 2320, USDCAD: 1.3600,
    USDCHF: 0.9050, NZDUSD: 0.6120, EURGBP: 0.8580, EURJPY: 162.50,
  };
  const tfMs: Record<string, number> = {
    M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800,
  };

  const base = basePrices[symbol] || 1.0;
  const volatility = base > 100 ? base * 0.004 : base * 0.0008;
  const tfSec = tfMs[tf] || 900;
  const now = Math.floor(Date.now() / 1000);
  let price = base;
  const candles: Candle[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * volatility;
    const close = Math.max(open * 0.8, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * 0.4;
    const low = Math.min(open, close) - Math.random() * volatility * 0.4;
    candles.push({
      time: now - i * tfSec,
      open: parseFloat(open.toFixed(base > 100 ? 2 : 5)),
      high: parseFloat(high.toFixed(base > 100 ? 2 : 5)),
      low: parseFloat(low.toFixed(base > 100 ? 2 : 5)),
      close: parseFloat(close.toFixed(base > 100 ? 2 : 5)),
      volume: Math.floor(Math.random() * 2000 + 100),
    });
    price = close;
  }
  return candles;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'EURUSD';
  const timeframe = searchParams.get('timeframe') || 'M15';
  const count = Math.min(500, parseInt(searchParams.get('count') || '100'));
  // Client-supplied API keys (from user Settings, passed as query params)
  const twelveKey = searchParams.get('twelveKey') || undefined;
  const avKey = searchParams.get('avKey') || undefined;

  // 1. Try Twelve Data
  const twelveCandles = await fetchTwelveData(symbol, timeframe, count, twelveKey);
  if (twelveCandles && twelveCandles.length > 0) {
    return NextResponse.json({ candles: twelveCandles, source: 'twelve_data', symbol, timeframe });
  }

  // 2. Try Alpha Vantage
  const avCandles = await fetchAlphaVantage(symbol, timeframe, count, avKey);
  if (avCandles && avCandles.length > 0) {
    return NextResponse.json({ candles: avCandles, source: 'alpha_vantage', symbol, timeframe });
  }

  // 3. Synthetic fallback
  const synthetic = generateSyntheticCandles(symbol, timeframe, count);
  return NextResponse.json({ candles: synthetic, source: 'synthetic', symbol, timeframe });
}
