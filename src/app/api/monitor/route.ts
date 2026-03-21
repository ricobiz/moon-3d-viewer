/**
 * AI Portfolio Monitor
 * ====================
 * Continuously analyzes the current trading state — open positions,
 * recent closed trades, equity curve, session stats — and returns
 * a human-readable assessment plus a recommended action so the
 * AutoTrader can adapt its strategy in real time.
 *
 * POST /api/monitor
 * Body: {
 *   positions       Trade[]          — current open positions
 *   closedTrades    ClosedTrade[]    — recent closed trades (last 20)
 *   equity          number           — current account equity
 *   balance         number           — current account balance
 *   netPnL          number           — floating P&L on open positions
 *   strategy        string           — active strategy description
 *   symbol          string           — primary symbol
 *   timeframe       string
 *   sessionStats    { decisions, executed, wins, losses, errors }
 *   apiKey          string           — OpenRouter API key
 *   model           string           — OpenRouter model id
 * }
 *
 * Response: {
 *   riskLevel       'low' | 'medium' | 'high' | 'critical'
 *   assessment      string           — 2-3 sentence situation summary
 *   recommendation  string           — concrete next step
 *   action          'continue' | 'tighten_sl' | 'reduce_size' | 'pause' | 'close_worst' | 'switch_strategy'
 *   urgency         'low' | 'medium' | 'high'
 *   indicators      string[]         — 3-5 key observations
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  openTime: string;
}

interface ClosedTrade {
  ticket?: number;
  symbol?: string;
  type?: 'BUY' | 'SELL';
  profit: number;
  closeTime?: string;
}

interface SessionStats {
  decisions: number;
  executed: number;
  wins: number;
  losses: number;
  errors: number;
}

interface MonitorResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  assessment: string;
  recommendation: string;
  action: 'continue' | 'tighten_sl' | 'reduce_size' | 'pause' | 'close_worst' | 'switch_strategy';
  urgency: 'low' | 'medium' | 'high';
  indicators: string[];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    positions = [] as Position[],
    closedTrades = [] as ClosedTrade[],
    equity = 0,
    balance = 0,
    netPnL = 0,
    strategy = '',
    symbol = '',
    timeframe = '',
    sessionStats = {} as SessionStats,
    apiKey = '',
    model = 'anthropic/claude-3.5-sonnet',
  } = body;

  if (!apiKey) {
    // Return rule-based fallback when no API key provided
    return NextResponse.json(buildRuleBasedAssessment(
      positions, closedTrades, equity, balance, netPnL, sessionStats
    ));
  }

  // Build context for the LLM
  const positionsSummary = positions.length === 0
    ? 'No open positions.'
    : positions.map((p: Position) =>
        `#${p.ticket} ${p.type} ${p.lots}L ${p.symbol} @ ${p.openPrice} | P&L: ${p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)} | SL:${p.sl > 0 ? p.sl : 'none'} TP:${p.tp > 0 ? p.tp : 'none'}`
      ).join('\n');

  const recentTrades = closedTrades.slice(-10);
  const tradesSummary = recentTrades.length === 0
    ? 'No recent closed trades.'
    : recentTrades.map((t: ClosedTrade) =>
        `${t.type ?? '?'} ${t.symbol ?? symbol} P&L: ${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`
      ).join(', ');

  const winRate = (sessionStats.wins + sessionStats.losses) > 0
    ? Math.round((sessionStats.wins / (sessionStats.wins + sessionStats.losses)) * 100)
    : null;

  const drawdownPct = balance > 0 ? ((balance - equity) / balance * 100) : 0;

  const prompt = `You are an expert algorithmic trading risk manager analyzing a live trading session.

## Current State
- Symbol: ${symbol} | Timeframe: ${timeframe}
- Account: Balance=${balance.toFixed(2)} | Equity=${equity.toFixed(2)} | Floating P&L=${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}
- Drawdown: ${drawdownPct.toFixed(2)}%

## Open Positions (${positions.length})
${positionsSummary}

## Recent Closed Trades (last 10)
${tradesSummary}

## Session Statistics
- Decisions: ${sessionStats.decisions} | Executed: ${sessionStats.executed} | Wins: ${sessionStats.wins} | Losses: ${sessionStats.losses} | Errors: ${sessionStats.errors}
${winRate !== null ? `- Win Rate: ${winRate}%` : ''}

## Active Strategy
${strategy.slice(0, 300)}

## Your Tasks
1. Assess risk level (low/medium/high/critical)
2. Summarize the current situation in 2-3 sentences
3. Provide a concrete recommendation
4. Choose the best action: continue | tighten_sl | reduce_size | pause | close_worst | switch_strategy
5. List 3-5 key observations as bullet points

Respond ONLY with valid JSON (no markdown):
{
  "riskLevel": "low|medium|high|critical",
  "assessment": "...",
  "recommendation": "...",
  "action": "continue|tighten_sl|reduce_size|pause|close_worst|switch_strategy",
  "urgency": "low|medium|high",
  "indicators": ["observation 1", "observation 2", "observation 3"]
}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://moon-3d-viewer.railway.app',
        'X-Title': 'AI Trading Portfolio Monitor',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response (handle markdown fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as MonitorResponse;
      return NextResponse.json(parsed);
    }
  } catch {
    // Fall through to rule-based fallback
  }

  return NextResponse.json(
    buildRuleBasedAssessment(positions, closedTrades, equity, balance, netPnL, sessionStats)
  );
}

/** Rule-based fallback assessment (no API key / LLM failed) */
function buildRuleBasedAssessment(
  positions: Position[],
  closedTrades: ClosedTrade[],
  equity: number,
  balance: number,
  netPnL: number,
  stats: SessionStats,
): MonitorResponse {
  const drawdown = balance > 0 ? (balance - equity) / balance * 100 : 0;
  const recent = closedTrades.slice(-10);
  const losses = recent.filter(t => t.profit < 0).length;
  const wins = recent.filter(t => t.profit > 0).length;
  const consecutiveLosses = (() => {
    let count = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].profit < 0) count++;
      else break;
    }
    return count;
  })();

  const riskLevel: MonitorResponse['riskLevel'] =
    drawdown > 10 || consecutiveLosses >= 4 ? 'critical' :
    drawdown > 5 || consecutiveLosses >= 3 ? 'high' :
    drawdown > 2 || consecutiveLosses >= 2 ? 'medium' : 'low';

  const action: MonitorResponse['action'] =
    riskLevel === 'critical' ? 'pause' :
    riskLevel === 'high' ? 'tighten_sl' :
    riskLevel === 'medium' ? 'reduce_size' : 'continue';

  const indicators: string[] = [
    `${positions.length} open position${positions.length !== 1 ? 's' : ''}, floating P&L: ${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}`,
    `Drawdown: ${drawdown.toFixed(1)}%`,
    `Recent: ${wins} wins / ${losses} losses`,
  ];
  if (consecutiveLosses >= 2) indicators.push(`⚠️ ${consecutiveLosses} consecutive losses detected`);
  if (stats.errors > 0) indicators.push(`${stats.errors} API error${stats.errors > 1 ? 's' : ''} this session`);

  return {
    riskLevel,
    urgency: riskLevel === 'critical' ? 'high' : riskLevel === 'high' ? 'medium' : 'low',
    assessment: `Currently ${positions.length} open position(s) with ${netPnL >= 0 ? 'positive' : 'negative'} floating P&L of ${netPnL.toFixed(2)}. Drawdown is ${drawdown.toFixed(1)}%.${consecutiveLosses >= 2 ? ` Warning: ${consecutiveLosses} consecutive losses.` : ''}`,
    recommendation: action === 'pause'
      ? 'High risk detected. Consider pausing the strategy and reviewing positions manually.'
      : action === 'tighten_sl'
      ? 'Drawdown is elevated. Tighten stop-losses on open positions to protect capital.'
      : action === 'reduce_size'
      ? 'Moderate drawdown. Consider reducing lot size for the next trade.'
      : 'Session is within normal parameters. Continue with current strategy.',
    action,
    indicators,
  };
}

export async function GET() {
  return NextResponse.json({
    info: 'AI Portfolio Monitor — POST with positions, closedTrades, equity, balance, strategy, apiKey, model',
  });
}
