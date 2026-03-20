/**
 * Paper Trading Sandbox API
 * =========================
 * In-memory sandbox for backtesting and paper trading.
 * No MT5 required — runs entirely on the server.
 *
 * POST /api/sandbox
 * Actions:
 *   backtest  — run strategy on historical candles
 *   paper_open  — open virtual position
 *   paper_close — close virtual position
 *   paper_status — get virtual account status
 *   paper_reset — reset virtual account
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory paper trading account (resets on server restart)
// For persistence, use a DB or KV store (e.g. Vercel KV, Railway Redis)
interface PaperPosition {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  sl: number;
  tp: number;
  openTime: string;
  comment: string;
}

interface PaperAccount {
  balance: number;
  positions: PaperPosition[];
  closedTrades: Array<PaperPosition & { closePrice: number; profit: number; closeTime: string }>;
}

// Global state (in-memory, resets on cold start)
const paperAccounts: Map<string, PaperAccount> = new Map();

function getAccount(userId = 'default'): PaperAccount {
  if (!paperAccounts.has(userId)) {
    paperAccounts.set(userId, {
      balance: 10000,
      positions: [],
      closedTrades: [],
    });
  }
  return paperAccounts.get(userId)!;
}

// ─── Backtest Engine ──────────────────────────────────────────────────────────

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  equityCurve: Array<{ time: number; equity: number; balance: number }>;
  trades: Array<{
    openTime: number; closeTime: number;
    type: 'BUY' | 'SELL'; openPrice: number; closePrice: number;
    profit: number; bars: number;
  }>;
}

// Simple rule-based strategy parser for sandbox
// Interprets strategy descriptions into signal functions
function parseStrategy(strategyDesc: string) {
  const desc = strategyDesc.toLowerCase();

  // Returns -1 (sell), 0 (hold), 1 (buy) based on candle array
  return (candles: Candle[]): -1 | 0 | 1 => {
    if (candles.length < 3) return 0;
    const c = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const prev2 = candles[candles.length - 3];

    // RSI-style: look for overbought/oversold mentions
    if (desc.includes('rsi') || desc.includes('oversold') || desc.includes('overbought')) {
      // Simulate RSI: count red vs green over last 14
      const period = Math.min(14, candles.length);
      let gains = 0, losses = 0;
      for (let i = candles.length - period; i < candles.length; i++) {
        const diff = candles[i].close - candles[i].open;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const rs = losses === 0 ? 100 : gains / losses;
      const rsi = 100 - 100 / (1 + rs);
      if (rsi < 30) return 1;
      if (rsi > 70) return -1;
      return 0;
    }

    // Moving average crossover
    if (desc.includes('moving average') || desc.includes('ma cross') || desc.includes('ema') || desc.includes('sma')) {
      const shortPeriod = 9;
      const longPeriod = 21;
      if (candles.length < longPeriod + 1) return 0;
      const shortMA = candles.slice(-shortPeriod).reduce((s, c) => s + c.close, 0) / shortPeriod;
      const prevShortMA = candles.slice(-shortPeriod - 1, -1).reduce((s, c) => s + c.close, 0) / shortPeriod;
      const longMA = candles.slice(-longPeriod).reduce((s, c) => s + c.close, 0) / longPeriod;
      const prevLongMA = candles.slice(-longPeriod - 1, -1).reduce((s, c) => s + c.close, 0) / longPeriod;

      if (shortMA > longMA && prevShortMA <= prevLongMA) return 1; // Golden cross
      if (shortMA < longMA && prevShortMA >= prevLongMA) return -1; // Death cross
      return 0;
    }

    // Breakout strategy
    if (desc.includes('breakout') || desc.includes('resistance') || desc.includes('support')) {
      const lookback = Math.min(20, candles.length - 1);
      const highs = candles.slice(-lookback - 1, -1).map(c => c.high);
      const lows = candles.slice(-lookback - 1, -1).map(c => c.low);
      const resistance = Math.max(...highs);
      const support = Math.min(...lows);
      if (c.close > resistance) return 1;
      if (c.close < support) return -1;
      return 0;
    }

    // Trend following / momentum
    if (desc.includes('trend') || desc.includes('momentum') || desc.includes('bullish') || desc.includes('bearish')) {
      const bullish = c.close > c.open && prev.close > prev.open && prev2.close > prev2.open;
      const bearish = c.close < c.open && prev.close < prev.open && prev2.close < prev2.open;
      if (bullish) return 1;
      if (bearish) return -1;
      return 0;
    }

    // Candlestick patterns
    if (desc.includes('candle') || desc.includes('pattern') || desc.includes('doji') || desc.includes('hammer')) {
      const body = Math.abs(c.close - c.open);
      const wick = c.high - c.low;
      const isDoji = body < wick * 0.1;
      const isHammer = c.low < Math.min(c.open, c.close) - body * 2 && body > 0;
      if (isHammer && prev.close < prev.open) return 1;
      if (isDoji) return 0;
      return c.close > c.open ? 1 : -1;
    }

    // Default: simple 3-candle confirmation
    const bullish = c.close > c.open && prev.close > prev.open;
    const bearish = c.close < c.open && prev.close < prev.open;
    if (bullish) return 1;
    if (bearish) return -1;
    return 0;
  };
}

function runBacktest(
  candles: Candle[],
  strategy: string,
  slPips: number,
  tpPips: number,
  initialBalance: number,
  lotSize: number,
): BacktestResult {
  const signal = parseStrategy(strategy);
  const isLarge = (candles[0]?.close || 1) > 100;
  const pipValue = isLarge ? 1 : 0.0001;

  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  const equityCurve: BacktestResult['equityCurve'] = [{ time: candles[0]?.time || 0, equity: initialBalance, balance: initialBalance }];
  const trades: BacktestResult['trades'] = [];

  let openPos: { type: 'BUY' | 'SELL'; openPrice: number; openTime: number; sl: number; tp: number } | null = null;

  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const window = candles.slice(0, i + 1);

    // Check if open position hit SL or TP
    if (openPos) {
      let closePrice: number | null = null;
      if (openPos.type === 'BUY') {
        if (c.low <= openPos.sl && openPos.sl > 0) closePrice = openPos.sl;
        else if (c.high >= openPos.tp && openPos.tp > 0) closePrice = openPos.tp;
      } else {
        if (c.high >= openPos.sl && openPos.sl > 0) closePrice = openPos.sl;
        else if (c.low <= openPos.tp && openPos.tp > 0) closePrice = openPos.tp;
      }

      if (closePrice !== null) {
        const priceDiff = openPos.type === 'BUY' ? closePrice - openPos.openPrice : openPos.openPrice - closePrice;
        const profit = (priceDiff / pipValue) * lotSize * 10;
        balance += profit;
        peakBalance = Math.max(peakBalance, balance);
        const dd = (peakBalance - balance) / peakBalance * 100;
        maxDrawdown = Math.max(maxDrawdown, dd);

        trades.push({
          openTime: openPos.openTime,
          closeTime: c.time,
          type: openPos.type,
          openPrice: openPos.openPrice,
          closePrice,
          profit,
          bars: i,
        });
        openPos = null;
        equityCurve.push({ time: c.time, equity: balance, balance });
      }
    }

    // Generate signal if no position
    if (!openPos) {
      const sig = signal(window);
      if (sig !== 0) {
        const price = c.close;
        const slPrice = sig === 1
          ? price - slPips * pipValue * 10
          : price + slPips * pipValue * 10;
        const tpPrice = sig === 1
          ? price + tpPips * pipValue * 10
          : price - tpPips * pipValue * 10;
        openPos = {
          type: sig === 1 ? 'BUY' : 'SELL',
          openPrice: price,
          openTime: c.time,
          sl: slPips > 0 ? slPrice : 0,
          tp: tpPips > 0 ? tpPrice : 0,
        };
      }
    }
  }

  // Close any remaining position at last price
  if (openPos && candles.length > 0) {
    const last = candles[candles.length - 1];
    const closePrice = last.close;
    const priceDiff = openPos.type === 'BUY'
      ? closePrice - openPos.openPrice
      : openPos.openPrice - closePrice;
    const profit = (priceDiff / pipValue) * lotSize * 10;
    balance += profit;
    trades.push({
      openTime: openPos.openTime, closeTime: last.time,
      type: openPos.type, openPrice: openPos.openPrice, closePrice,
      profit, bars: candles.length,
    });
    equityCurve.push({ time: last.time, equity: balance, balance });
  }

  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit < 0);
  const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const netProfit = balance - initialBalance;

  // Sharpe ratio approximation
  const returns = trades.map(t => t.profit / initialBalance);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const stdReturn = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1));
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    maxDrawdown,
    maxDrawdownPct: maxDrawdown,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    sharpeRatio: parseFloat(sharpe.toFixed(2)),
    equityCurve: equityCurve.slice(0, 500),
    trades: trades.slice(-50),
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, userId = 'default' } = body;
  const account = getAccount(userId);

  if (action === 'backtest') {
    const { candles, strategy, slPips = 50, tpPips = 100, initialBalance = 10000, lotSize = 0.01 } = body;
    if (!candles || candles.length < 30) {
      return NextResponse.json({ error: 'Need at least 30 candles for backtest' }, { status: 400 });
    }
    const result = runBacktest(candles, strategy || 'trend', slPips, tpPips, initialBalance, lotSize);
    return NextResponse.json(result);
  }

  if (action === 'paper_open') {
    const { symbol, type, lots = 0.01, openPrice, sl = 0, tp = 0, comment = 'Paper Trade' } = body;
    const pos: PaperPosition = {
      id: Math.random().toString(36).slice(2),
      symbol, type, lots, openPrice, sl, tp,
      openTime: new Date().toISOString(), comment,
    };
    account.positions.push(pos);
    return NextResponse.json({ success: true, position: pos });
  }

  if (action === 'paper_close') {
    const { positionId, closePrice } = body;
    const idx = account.positions.findIndex(p => p.id === positionId);
    if (idx === -1) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

    const pos = account.positions[idx];
    const isLarge = pos.openPrice > 100;
    const pipValue = isLarge ? 1 : 0.0001;
    const priceDiff = pos.type === 'BUY' ? closePrice - pos.openPrice : pos.openPrice - closePrice;
    const profit = (priceDiff / pipValue) * pos.lots * 10;

    account.balance += profit;
    account.closedTrades.push({ ...pos, closePrice, profit, closeTime: new Date().toISOString() });
    account.positions.splice(idx, 1);

    return NextResponse.json({ success: true, profit });
  }

  if (action === 'paper_status') {
    const floatingPnL = account.positions.reduce((s, p) => {
      // In paper trading we don't have live prices, just show last known
      return s;
    }, 0);

    return NextResponse.json({
      balance: account.balance,
      floatingPnL,
      equity: account.balance + floatingPnL,
      openPositions: account.positions,
      closedTrades: account.closedTrades.slice(-50),
      totalTrades: account.closedTrades.length,
      netProfit: account.balance - 10000,
    });
  }

  if (action === 'paper_reset') {
    paperAccounts.set(userId, { balance: 10000, positions: [], closedTrades: [] });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function GET() {
  return NextResponse.json({
    info: 'Sandbox API — supports: backtest, paper_open, paper_close, paper_status, paper_reset',
  });
}
