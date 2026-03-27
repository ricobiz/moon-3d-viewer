/**
 * Paper Trading Sandbox API
 * =========================
 * In-memory sandbox for backtesting and paper trading.
 * No MT5 required — runs entirely on the server.
 *
 * POST /api/sandbox
 * Actions:
 *   backtest     — run strategy on historical candles
 *   paper_open   — open virtual position
 *   paper_close  — close virtual position
 *   paper_status — get virtual account status
 *   paper_reset  — reset virtual account
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest } from '@/lib/backtest';

// In-memory paper trading account (resets on server restart)
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
    paperAccounts.set(userId, { balance: 10000, positions: [], closedTrades: [] });
  }
  return paperAccounts.get(userId)!;
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
    return NextResponse.json({
      balance: account.balance,
      floatingPnL: 0,
      equity: account.balance,
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
