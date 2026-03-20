/**
 * AI Council of Experts
 * ======================
 * Multiple AI models analyze the same market data independently,
 * then vote on a trading decision. The final decision is taken
 * by weighted majority (confidence-weighted).
 *
 * POST /api/council
 * {
 *   candles: Candle[],
 *   strategy: string,
 *   symbol: string,
 *   timeframe: string,
 *   experts: Expert[],      // { name, model, role, weight }
 *   apiKey: string,
 *   slPips: number,
 *   tpPips: number,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

export interface Expert {
  name: string;         // e.g. "Trend Analyst"
  model: string;        // OpenRouter model ID
  role: string;         // Their specialty description
  weight: number;       // Voting weight 1–5
}

export interface ExpertVote {
  expert: Expert;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  latencyMs: number;
}

export interface CouncilDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  consensus: number;        // 0–100 agreement level
  weightedConfidence: number;
  votes: ExpertVote[];
  dissent: string[];        // experts who disagreed
  summary: string;
}

const BASE_SYSTEM_PROMPT = (role: string) =>
  `You are a professional trading expert specialized in: ${role}.
Analyze the given OHLCV candlestick data and provide a trading signal.
Respond ONLY with valid JSON (no markdown):
{"action":"BUY"|"SELL"|"HOLD","confidence":<0-100>,"reason":"<one sentence>"}`;

async function queryExpert(
  expert: Expert,
  candles: { time: number; open: number; high: number; low: number; close: number; volume?: number }[],
  strategy: string,
  symbol: string,
  timeframe: string,
  apiKey: string,
  slPips: number,
  tpPips: number,
): Promise<ExpertVote> {
  const start = Date.now();
  const recent = candles.slice(-25);
  const lastPrice = recent[recent.length - 1]?.close || 0;
  const isLarge = lastPrice > 100;

  const candleSummary = recent.map((c, i) => {
    const dir = c.close >= c.open ? '▲' : '▼';
    return `${i + 1}. ${dir} O:${c.open.toFixed(isLarge ? 2 : 5)} H:${c.high.toFixed(isLarge ? 2 : 5)} L:${c.low.toFixed(isLarge ? 2 : 5)} C:${c.close.toFixed(isLarge ? 2 : 5)}`;
  }).join('\n');

  const userMsg = `Symbol: ${symbol} | TF: ${timeframe} | Price: ${lastPrice.toFixed(isLarge ? 2 : 5)}
Strategy Context: ${strategy}
SL: ${slPips} pips | TP: ${tpPips} pips

Last ${recent.length} candles:
${candleSummary}

Give your expert ${expert.role} analysis and signal.`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-trading-bot.local',
        'X-Title': 'AI Trading Bot Council',
      },
      body: JSON.stringify({
        model: expert.model,
        messages: [
          { role: 'system', content: BASE_SYSTEM_PROMPT(expert.role) },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.15,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${res.status}: ${errText.slice(0, 100)}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      expert,
      action: ['BUY', 'SELL', 'HOLD'].includes(parsed.action) ? parsed.action : 'HOLD',
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
      reason: String(parsed.reason || ''),
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      expert,
      action: 'HOLD',
      confidence: 0,
      reason: `Error: ${String(e).slice(0, 100)}`,
      latencyMs: Date.now() - start,
    };
  }
}

function tallyVotes(votes: ExpertVote[]): CouncilDecision {
  // Weighted vote tally
  const tally: Record<string, number> = { BUY: 0, SELL: 0, HOLD: 0 };
  let totalWeight = 0;

  for (const v of votes) {
    const w = v.expert.weight * (v.confidence / 100);
    tally[v.action] += w;
    totalWeight += v.expert.weight;
  }

  // Pick winner
  const winner = (Object.entries(tally) as [string, number][]).reduce(
    (best, [action, score]) => (score > best[1] ? [action, score] : best),
    ['HOLD', -1]
  )[0] as 'BUY' | 'SELL' | 'HOLD';

  const winnerVotes = votes.filter(v => v.action === winner);
  const dissenters = votes.filter(v => v.action !== winner && v.confidence > 40);

  const weightedConf = totalWeight > 0
    ? Math.round((tally[winner] / totalWeight) * 100)
    : 0;

  const agreementCount = votes.filter(v => v.action === winner).length;
  const consensus = Math.round((agreementCount / votes.length) * 100);

  return {
    action: winner,
    consensus,
    weightedConfidence: weightedConf,
    votes,
    dissent: dissenters.map(d => `${d.expert.name}: ${d.action} (${d.confidence}%) — ${d.reason}`),
    summary: `${winner} decision: ${agreementCount}/${votes.length} experts agree (${consensus}% consensus, ${weightedConf}% weighted confidence)`,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    candles,
    strategy = 'Trend following strategy',
    symbol = 'EURUSD',
    timeframe = 'M15',
    experts,
    apiKey,
    slPips = 50,
    tpPips = 100,
  } = body as {
    candles: { time: number; open: number; high: number; low: number; close: number }[];
    strategy: string;
    symbol: string;
    timeframe: string;
    experts: Expert[];
    apiKey: string;
    slPips: number;
    tpPips: number;
  };

  if (!apiKey) {
    return NextResponse.json({ error: 'OpenRouter API key required' }, { status: 400 });
  }
  if (!candles || candles.length < 5) {
    return NextResponse.json({ error: 'Need at least 5 candles' }, { status: 400 });
  }

  const expertList: Expert[] = experts?.length
    ? experts
    : [
        { name: 'Trend Analyst', model: 'anthropic/claude-3.5-sonnet', role: 'Technical trend analysis using moving averages and price action', weight: 3 },
        { name: 'Risk Manager', model: 'openai/gpt-4o-mini', role: 'Risk/reward assessment and money management', weight: 2 },
        { name: 'Pattern Trader', model: 'google/gemini-pro-1.5', role: 'Candlestick patterns and chart pattern recognition', weight: 2 },
      ];

  // Query all experts in parallel
  const votePromises = expertList.map(expert =>
    queryExpert(expert, candles, strategy, symbol, timeframe, apiKey, slPips, tpPips)
  );

  const votes = await Promise.all(votePromises);
  const decision = tallyVotes(votes);

  return NextResponse.json(decision);
}
