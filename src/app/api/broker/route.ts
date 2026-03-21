/**
 * Direct Exchange API — Bybit & Binance
 * =======================================
 * Enables phone-only / cloud-only trading without MT5 or a VPS.
 * The Next.js server (Railway/Vercel) calls the exchange directly.
 *
 * Supported exchanges:
 *   - Bybit  (spot + USDT perpetual futures)
 *   - Binance (spot + USDT-M futures)
 *
 * POST /api/broker
 * Body: { exchange, apiKey, apiSecret, action, ...params }
 *
 * Actions: status | positions | order | close | candles | tickers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// ─── Bybit v5 ─────────────────────────────────────────────────────────────────

const BYBIT_MAIN = 'https://api.bybit.com';
const BYBIT_TEST = 'https://api-testnet.bybit.com';

function bybitSign(secret: string, ts: string, apiKey: string, recvWindow: string, body: string) {
  const raw = ts + apiKey + recvWindow + body;
  return createHmac('sha256', secret).update(raw).digest('hex');
}

async function bybitRequest(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, unknown>,
  apiKey: string,
  apiSecret: string,
  testnet: boolean,
) {
  const base = testnet ? BYBIT_TEST : BYBIT_MAIN;
  const ts = Date.now().toString();
  const recvWindow = '10000';

  let url = `${base}${path}`;
  let bodyStr = '';

  if (method === 'GET') {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    if (qs) url += `?${qs}`;
    bodyStr = qs;
  } else {
    bodyStr = JSON.stringify(params);
  }

  const sign = bybitSign(apiSecret, ts, apiKey, recvWindow, method === 'GET' ? new URLSearchParams(params as Record<string, string>).toString() : bodyStr);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': ts,
    'X-BAPI-SIGN': sign,
    'X-BAPI-RECV-WINDOW': recvWindow,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? bodyStr : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
  const data = await res.json();
  if (data.retCode !== 0) throw new Error(`Bybit error ${data.retCode}: ${data.retMsg}`);
  return data.result;
}

async function bybitStatus(apiKey: string, apiSecret: string, testnet: boolean) {
  // Get UNIFIED account balance
  const result = await bybitRequest('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' }, apiKey, apiSecret, testnet);
  const list = result.list?.[0];
  const totalBalance = parseFloat(list?.totalWalletBalance || '0');
  const totalEquity = parseFloat(list?.totalEquity || '0');
  const unrealizedPnl = parseFloat(list?.totalUnrealisedPnl || '0');

  // Get coin balances for display
  const coins = (list?.coin || []).filter((c: { walletBalance: string }) => parseFloat(c.walletBalance) > 0);

  return {
    connected: true,
    type: 'bybit' as const,
    balance: totalBalance,
    equity: totalEquity,
    unrealizedPnl,
    currency: 'USDT',
    testnet,
    coins: coins.slice(0, 10),
  };
}

async function bybitPositions(apiKey: string, apiSecret: string, testnet: boolean) {
  const result = await bybitRequest('GET', '/v5/position/list', {
    category: 'linear',
    settleCoin: 'USDT',
    limit: '50',
  }, apiKey, apiSecret, testnet);

  return (result.list || [])
    .filter((p: { size: string }) => parseFloat(p.size) > 0)
    .map((p: {
      symbol: string; side: string; size: string; avgPrice: string; markPrice: string;
      unrealisedPnl: string; stopLoss: string; takeProfit: string; createdTime: string;
      positionIdx: number; leverage: string;
    }) => ({
      id: `${p.symbol}-${p.side}`,
      ticket: parseInt(p.createdTime) || 0,
      symbol: p.symbol,
      type: p.side === 'Buy' ? 'BUY' : 'SELL',
      lots: parseFloat(p.size),
      openPrice: parseFloat(p.avgPrice),
      currentPrice: parseFloat(p.markPrice),
      sl: parseFloat(p.stopLoss || '0'),
      tp: parseFloat(p.takeProfit || '0'),
      profit: parseFloat(p.unrealisedPnl),
      swap: 0,
      openTime: new Date(parseInt(p.createdTime)).toISOString(),
      comment: `Bybit ${p.leverage}x`,
      source: 'bybit',
    }));
}

async function bybitOrder(
  apiKey: string, apiSecret: string, testnet: boolean,
  symbol: string, side: string, qty: string, sl?: string, tp?: string, category = 'linear',
) {
  const params: Record<string, string> = {
    category,
    symbol,
    side: side === 'BUY' ? 'Buy' : 'Sell',
    orderType: 'Market',
    qty,
    timeInForce: 'GTC',
  };
  if (sl && parseFloat(sl) > 0) params.stopLoss = sl;
  if (tp && parseFloat(tp) > 0) params.takeProfit = tp;

  const result = await bybitRequest('POST', '/v5/order/create', params, apiKey, apiSecret, testnet);
  return { success: true, orderId: result.orderId, symbol, side, qty };
}

async function bybitClose(
  apiKey: string, apiSecret: string, testnet: boolean,
  symbol: string, side: string, qty: string, category = 'linear',
) {
  // Close = opposite side, reduceOnly
  const closeSide = side === 'BUY' ? 'Sell' : 'Buy';
  const result = await bybitRequest('POST', '/v5/order/create', {
    category,
    symbol,
    side: closeSide,
    orderType: 'Market',
    qty,
    reduceOnly: true,
    timeInForce: 'GTC',
  }, apiKey, apiSecret, testnet);
  return { success: true, orderId: result.orderId };
}

async function bybitCandles(
  apiKey: string, apiSecret: string, testnet: boolean,
  symbol: string, interval: string, limit: number, category = 'linear',
) {
  const intervalMap: Record<string, string> = {
    M1: '1', M3: '3', M5: '5', M15: '15', M30: '30',
    H1: '60', H2: '120', H4: '240', D1: 'D', W1: 'W',
  };
  const iv = intervalMap[interval] || '15';
  const result = await bybitRequest('GET', '/v5/market/kline', {
    category,
    symbol,
    interval: iv,
    limit: String(limit),
  }, apiKey, apiSecret, testnet);

  return (result.list || []).reverse().map((c: string[]) => ({
    time: Math.floor(parseInt(c[0]) / 1000),
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

async function bybitTickers(apiKey: string, apiSecret: string, testnet: boolean, category = 'linear') {
  const result = await bybitRequest('GET', '/v5/market/tickers', { category }, apiKey, apiSecret, testnet);
  return (result.list || []).slice(0, 50).map((t: {
    symbol: string; lastPrice: string; price24hPcnt: string; volume24h: string; bid1Price: string; ask1Price: string;
  }) => ({
    symbol: t.symbol,
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.price24hPcnt) * 100,
    volume: parseFloat(t.volume24h),
    bid: parseFloat(t.bid1Price),
    ask: parseFloat(t.ask1Price),
  }));
}

// ─── Binance ──────────────────────────────────────────────────────────────────

const BN_SPOT = 'https://api.binance.com';
const BN_FUTURES = 'https://fapi.binance.com';

function binanceSign(secret: string, queryString: string) {
  return createHmac('sha256', secret).update(queryString).digest('hex');
}

async function binanceRequest(
  method: 'GET' | 'POST' | 'DELETE',
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string,
) {
  const ts = Date.now().toString();
  const allParams = { ...params, timestamp: ts, recvWindow: '10000' };
  const qs = new URLSearchParams(allParams).toString();
  const sig = binanceSign(apiSecret, qs);
  const finalQs = `${qs}&signature=${sig}`;

  const url = method === 'GET' || method === 'DELETE'
    ? `${baseUrl}${path}?${finalQs}`
    : `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? finalQs : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Binance ${res.status}: ${err.msg || res.statusText}`);
  }
  return res.json();
}

async function binanceStatus(apiKey: string, apiSecret: string, futures: boolean) {
  const base = futures ? BN_FUTURES : BN_SPOT;
  const path = futures ? '/fapi/v2/account' : '/api/v3/account';
  const data = await binanceRequest('GET', base, path, {}, apiKey, apiSecret);

  if (futures) {
    return {
      connected: true,
      type: 'binance' as const,
      balance: parseFloat(data.totalWalletBalance || '0'),
      equity: parseFloat(data.totalMarginBalance || '0'),
      unrealizedPnl: parseFloat(data.totalUnrealizedProfit || '0'),
      currency: 'USDT',
      futures: true,
    };
  } else {
    const usdt = data.balances?.find((b: { asset: string; free: string }) => b.asset === 'USDT');
    return {
      connected: true,
      type: 'binance' as const,
      balance: parseFloat(usdt?.free || '0'),
      equity: parseFloat(usdt?.free || '0'),
      unrealizedPnl: 0,
      currency: 'USDT',
      futures: false,
    };
  }
}

async function binancePositions(apiKey: string, apiSecret: string, futures: boolean) {
  if (!futures) return [];
  const data = await binanceRequest('GET', BN_FUTURES, '/fapi/v2/positionRisk', {}, apiKey, apiSecret);
  return (data || [])
    .filter((p: { positionAmt: string }) => Math.abs(parseFloat(p.positionAmt)) > 0)
    .map((p: {
      symbol: string; positionAmt: string; entryPrice: string; markPrice: string;
      unRealizedProfit: string; liquidationPrice: string;
    }) => {
      const amt = parseFloat(p.positionAmt);
      return {
        id: p.symbol,
        ticket: 0,
        symbol: p.symbol,
        type: amt > 0 ? 'BUY' : 'SELL',
        lots: Math.abs(amt),
        openPrice: parseFloat(p.entryPrice),
        currentPrice: parseFloat(p.markPrice),
        sl: 0,
        tp: 0,
        profit: parseFloat(p.unRealizedProfit),
        swap: 0,
        openTime: new Date().toISOString(),
        comment: 'Binance Futures',
        source: 'binance',
      };
    });
}

async function binanceCandles(
  apiKey: string, apiSecret: string, futures: boolean,
  symbol: string, interval: string, limit: number,
) {
  const intervalMap: Record<string, string> = {
    M1: '1m', M3: '3m', M5: '5m', M15: '15m', M30: '30m',
    H1: '1h', H2: '2h', H4: '4h', D1: '1d', W1: '1w',
  };
  const iv = intervalMap[interval] || '15m';
  const base = futures ? BN_FUTURES : BN_SPOT;
  const path = futures ? '/fapi/v1/klines' : '/api/v3/klines';

  const data = await binanceRequest('GET', base, path, {
    symbol, interval: iv, limit: String(limit),
  }, apiKey, apiSecret);

  return data.map((c: (string | number)[]) => ({
    time: Math.floor(Number(c[0]) / 1000),
    open: parseFloat(String(c[1])),
    high: parseFloat(String(c[2])),
    low: parseFloat(String(c[3])),
    close: parseFloat(String(c[4])),
    volume: parseFloat(String(c[5])),
  }));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { exchange, apiKey, apiSecret, action } = body;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'API key and secret are required' }, { status: 400 });
  }

  try {
    // ── Bybit ──────────────────────────────────────────────────────────────
    if (exchange === 'bybit') {
      const testnet = !!body.testnet;
      const category = body.category || 'linear';

      switch (action) {
        case 'status': {
          const result = await bybitStatus(apiKey, apiSecret, testnet);
          return NextResponse.json(result);
        }
        case 'positions': {
          const positions = await bybitPositions(apiKey, apiSecret, testnet);
          return NextResponse.json({ positions });
        }
        case 'order': {
          const result = await bybitOrder(
            apiKey, apiSecret, testnet,
            body.symbol, body.side, String(body.qty),
            body.sl, body.tp, category,
          );
          return NextResponse.json(result);
        }
        case 'close': {
          const result = await bybitClose(
            apiKey, apiSecret, testnet,
            body.symbol, body.side, String(body.qty), category,
          );
          return NextResponse.json(result);
        }
        case 'candles': {
          const candles = await bybitCandles(
            apiKey, apiSecret, testnet,
            body.symbol, body.interval || 'M15', body.limit || 100, category,
          );
          return NextResponse.json({ candles, source: 'bybit' });
        }
        case 'tickers': {
          const tickers = await bybitTickers(apiKey, apiSecret, testnet, category);
          return NextResponse.json({ tickers });
        }
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    }

    // ── Binance ────────────────────────────────────────────────────────────
    if (exchange === 'binance') {
      const futures = body.futures !== false;

      switch (action) {
        case 'status': {
          const result = await binanceStatus(apiKey, apiSecret, futures);
          return NextResponse.json(result);
        }
        case 'positions': {
          const positions = await binancePositions(apiKey, apiSecret, futures);
          return NextResponse.json({ positions });
        }
        case 'candles': {
          const candles = await binanceCandles(
            apiKey, apiSecret, futures,
            body.symbol, body.interval || 'M15', body.limit || 100,
          );
          return NextResponse.json({ candles, source: 'binance' });
        }
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Unknown exchange. Use: bybit | binance' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'Direct Exchange API — supports Bybit and Binance. POST with { exchange, apiKey, apiSecret, action }',
    exchanges: ['bybit', 'binance'],
    actions: ['status', 'positions', 'order', 'close', 'candles', 'tickers'],
  });
}
