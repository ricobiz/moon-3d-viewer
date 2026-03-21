/**
 * AI Research Engine API
 * =======================
 * Autonomously tests strategy × symbol × timeframe combinations,
 * uses an LLM (OpenRouter) to analyze patterns and generate new strategies,
 * and optionally stores findings in Qdrant vector memory.
 *
 * POST /api/research
 * Streams Server-Sent Events (SSE) with progress updates.
 *
 * Body:
 *   symbols        string[]   e.g. ['EURUSD', 'BTCUSDT']
 *   timeframes     string[]   e.g. ['M15', 'H1', 'H4']
 *   strategies     string[]   strategy descriptions
 *   slPips         number     stop-loss pips (default 50)
 *   tpPips         number     take-profit pips (default 100)
 *   initialBalance number     (default 10000)
 *   lotSize        number     (default 0.01)
 *   candleCount    number     candles per test (default 300)
 *   maxIterations  number     LLM refinement iterations 1-5 (default 2)
 *   openrouterKey  string     optional — enables LLM analysis
 *   openrouterModel string    e.g. 'anthropic/claude-3.5-sonnet'
 *   qdrantUrl      string     optional Qdrant HTTP endpoint
 *   qdrantApiKey   string     optional Qdrant API key
 *   embeddingModel string     embedding model id (default 'text-embedding-ada-002')
 *   twelveKey      string     optional TwelveData API key
 *   avKey          string     optional Alpha Vantage API key
 */

import { NextRequest } from 'next/server';
import { runBacktest, Candle } from '@/lib/backtest';

// ─── Market data (inline to avoid cross-route imports) ────────────────────────

const TF_TWELVE: Record<string, string> = {
  M1: '1min', M5: '5min', M15: '15min', M30: '30min',
  H1: '1h', H4: '4h', D1: '1day', W1: '1week',
};

const BASE_PRICES: Record<string, number> = {
  EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, USDCHF: 0.9050,
  AUDUSD: 0.6550, USDCAD: 1.3600, NZDUSD: 0.6120,
  EURGBP: 0.8580, EURJPY: 162.50, GBPJPY: 189.20, EURAUD: 1.6550,
  EURCAD: 1.4720, EURCHF: 0.9560, GBPAUD: 1.9680, AUDCAD: 0.8920,
  AUDNZD: 1.0710, AUDCHF: 0.5950, CADCHF: 0.6640, CADJPY: 109.90,
  GBPCAD: 1.7210, GBPCHF: 1.1320, GBPNZD: 2.1030, NZDCAD: 0.8320,
  NZDCHF: 0.5550, NZDJPY: 91.50,
  XAUUSD: 2320, XAGUSD: 27.50, USOIL: 78.50,
  SPX500: 5200, NAS100: 18200, DOW30: 38900, UK100: 7850, GER40: 18100, JPN225: 38200,
  BTCUSDT: 68000, ETHUSDT: 3500, BNBUSDT: 580, SOLUSDT: 145, XRPUSDT: 0.52,
  ADAUSDT: 0.45, DOGEUSDT: 0.135, LTCUSDT: 78, AVAXUSDT: 35, DOTUSDT: 7.8,
};

async function fetchCandles(symbol: string, tf: string, count: number, twelveKey?: string): Promise<{ candles: Candle[]; source: string }> {
  const interval = TF_TWELVE[tf] || '15min';
  const keyParam = twelveKey ? `&apikey=${twelveKey}` : '';
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${count}&format=JSON${keyParam}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.values && Array.isArray(data.values) && data.values.length > 0) {
        const candles: Candle[] = data.values.reverse().map((v: {
          datetime: string; open: string; high: string; low: string; close: string; volume?: string;
        }) => ({
          time: Math.floor(new Date(v.datetime).getTime() / 1000),
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
          volume: parseInt(v.volume || '0'),
        }));
        return { candles, source: 'twelve_data' };
      }
    }
  } catch { /* fall through */ }

  // Synthetic fallback
  const base = BASE_PRICES[symbol] || 1.0;
  const volatility = base > 100 ? base * 0.004 : base * 0.0008;
  const tfSec: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800 };
  const step = tfSec[tf] || 900;
  const now = Math.floor(Date.now() / 1000);
  let price = base;
  const candles: Candle[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * volatility;
    const close = Math.max(open * 0.5, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * 0.4;
    const low = Math.min(open, close) - Math.random() * volatility * 0.4;
    candles.push({
      time: now - i * step,
      open: parseFloat(open.toFixed(base > 100 ? 2 : 5)),
      high: parseFloat(high.toFixed(base > 100 ? 2 : 5)),
      low: parseFloat(low.toFixed(base > 100 ? 2 : 5)),
      close: parseFloat(close.toFixed(base > 100 ? 2 : 5)),
      volume: Math.floor(Math.random() * 2000 + 100),
    });
    price = close;
  }
  return { candles, source: 'synthetic' };
}

// ─── Qdrant helpers ───────────────────────────────────────────────────────────

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: Record<string, unknown>;
}

async function qdrantEnsureCollection(url: string, apiKey: string, collection: string, vectorSize: number) {
  try {
    // Check if collection exists
    const checkRes = await fetch(`${url}/collections/${collection}`, {
      headers: { 'api-key': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (checkRes.status === 404) {
      await fetch(`${url}/collections/${collection}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({ vectors: { size: vectorSize, distance: 'Cosine' } }),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch { /* ignore */ }
}

async function qdrantUpsert(url: string, apiKey: string, collection: string, points: QdrantPoint[]) {
  try {
    await fetch(`${url}/collections/${collection}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ points }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* ignore */ }
}

async function qdrantSearch(url: string, apiKey: string, collection: string, vector: number[], limit = 5) {
  try {
    const res = await fetch(`${url}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ vector, limit, with_payload: true }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return (data.result || []) as Array<{ score: number; payload: Record<string, unknown> }>;
  } catch { return []; }
}

// ─── OpenRouter helpers ───────────────────────────────────────────────────────

async function getEmbedding(text: string, apiKey: string, model: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

interface LLMAnalysis {
  insights: string;
  newStrategies: string[];
  topPatterns: string[];
}

async function analyzeWithLLM(
  results: ComboResult[],
  iteration: number,
  apiKey: string,
  model: string,
  priorMemory?: string,
): Promise<LLMAnalysis> {
  const top = results.slice(0, 15);
  const bottom = results.slice(-5);
  const summary = top.map(r =>
    `${r.symbol} ${r.timeframe} | ${r.strategy} | WR=${r.winRate.toFixed(1)}% PF=${r.profitFactor.toFixed(2)} Sharpe=${r.sharpeRatio.toFixed(2)} Trades=${r.totalTrades} PnL=${r.netProfit.toFixed(2)}`
  ).join('\n');
  const worstSummary = bottom.map(r =>
    `${r.symbol} ${r.timeframe} | ${r.strategy} | WR=${r.winRate.toFixed(1)}% PF=${r.profitFactor.toFixed(2)}`
  ).join('\n');

  const prompt = `You are an expert quantitative trading researcher analyzing automated backtest results.

## Top Performing Combinations (Iteration ${iteration}):
${summary}

## Worst Performing (for contrast):
${worstSummary}

${priorMemory ? `## Prior Research Memory:\n${priorMemory}\n` : ''}

Tasks:
1. Identify patterns: which symbols/timeframes/strategies work best and why?
2. Generate exactly 5 NEW concrete strategy descriptions that might outperform the above. Be specific (e.g., mention indicator names, thresholds, candle counts). Make them genuinely different from existing ones.
3. List 3 key patterns/insights discovered.

Respond in valid JSON only:
{
  "insights": "2-3 sentence summary of key findings",
  "topPatterns": ["pattern 1", "pattern 2", "pattern 3"],
  "newStrategies": [
    "strategy description 1",
    "strategy description 2",
    "strategy description 3",
    "strategy description 4",
    "strategy description 5"
  ]
}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as LLMAnalysis;
    }
  } catch { /* fall through */ }

  return {
    insights: 'LLM analysis unavailable. Add an OpenRouter API key in Settings for AI-powered insights.',
    newStrategies: [],
    topPatterns: ['Add OpenRouter API key to enable pattern analysis'],
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ComboResult {
  symbol: string;
  timeframe: string;
  strategy: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  score: number;
  source: string;
  iteration: number;
}

function scoreResult(r: Omit<ComboResult, 'score'>): number {
  if (r.totalTrades < 3) return 0;
  // Normalize components to 0-100 range
  const wrScore = Math.min(r.winRate, 100) * 0.3;
  const pfScore = Math.min((r.profitFactor / 3) * 100, 100) * 0.3;
  const sharpeScore = Math.max(0, Math.min((r.sharpeRatio / 3) * 100, 100)) * 0.2;
  const tradesScore = Math.min((r.totalTrades / 30) * 100, 100) * 0.1;
  const ddPenalty = Math.min(r.maxDrawdown / 20, 1) * 10; // penalize > 20% drawdown
  return Math.max(0, wrScore + pfScore + sharpeScore + tradesScore - ddPenalty);
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const config = await request.json();
  const {
    symbols = ['EURUSD'],
    timeframes = ['H1'],
    strategies = ['trend following', 'RSI reversal', 'MA crossover'],
    slPips = 50,
    tpPips = 100,
    initialBalance = 10000,
    lotSize = 0.01,
    candleCount = 300,
    maxIterations = 2,
    openrouterKey = '',
    openrouterModel = 'anthropic/claude-3.5-sonnet',
    qdrantUrl = '',
    qdrantApiKey = '',
    embeddingModel = 'text-embedding-ada-002',
    twelveKey = '',
  } = config;

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (data: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch { /* stream closed */ }
  };

  // Run research asynchronously
  (async () => {
    try {
      const allResults: ComboResult[] = [];
      let currentStrategies = [...strategies];
  // Hard limit per iteration to prevent serverless function timeouts (~60s budget).
  // 40 combinations × ~1s each ≈ 40s, leaving room for LLM calls.
  const MAX_COMBOS_PER_ITERATION = 40;
      const iterations = Math.max(1, Math.min(maxIterations, 4));

      for (let iter = 1; iter <= iterations; iter++) {
        await send({ type: 'iteration_start', iteration: iter, total: iterations });

        const combos: Array<{ symbol: string; timeframe: string; strategy: string }> = [];
        for (const symbol of symbols.slice(0, 6)) {
          for (const tf of timeframes.slice(0, 4)) {
            for (const strat of currentStrategies.slice(0, 8)) {
              combos.push({ symbol, timeframe: tf, strategy: strat });
            }
          }
        }
        const limitedCombos = combos.slice(0, MAX_COMBOS_PER_ITERATION);
        const total = limitedCombos.length;

        await send({ type: 'progress', message: `Iteration ${iter}: testing ${total} combinations...`, progress: 0 });

        // Cache fetched candles to avoid redundant API calls
        const candleCache: Map<string, { candles: Candle[]; source: string }> = new Map();

        for (let ci = 0; ci < limitedCombos.length; ci++) {
          const { symbol, timeframe, strategy } = limitedCombos[ci];
          const pct = Math.round((ci / total) * 100);
          const shortStrat = strategy.length > 40 ? strategy.slice(0, 37) + '...' : strategy;
          await send({ type: 'progress', message: `[${iter}/${iterations}] ${symbol} ${timeframe} — ${shortStrat}`, progress: pct, current: ci + 1, total });

          const cacheKey = `${symbol}_${timeframe}`;
          if (!candleCache.has(cacheKey)) {
            const fetched = await fetchCandles(symbol, timeframe, candleCount, twelveKey || undefined);
            candleCache.set(cacheKey, fetched);
          }
          const { candles, source } = candleCache.get(cacheKey)!;

          if (candles.length < 30) {
            await send({ type: 'skip', message: `${symbol} ${timeframe}: insufficient data` });
            continue;
          }

          const bt = runBacktest(candles, strategy, slPips, tpPips, initialBalance, lotSize);
          const partial = { symbol, timeframe, strategy, ...bt, source, iteration: iter };
          const score = scoreResult(partial);
          const result: ComboResult = { ...partial, score };
          allResults.push(result);
          await send({ type: 'result', result: { ...result, equityCurve: undefined, trades: undefined } });
        }

        // Sort all results by score
        allResults.sort((a, b) => b.score - a.score);

        if (iter < iterations && openrouterKey) {
          await send({ type: 'llm_thinking', message: 'Analyzing results with AI...' });
          const analysis = await analyzeWithLLM(allResults, iter, openrouterKey, openrouterModel);
          await send({ type: 'llm_analysis', analysis });

          // Replace strategies for next iteration with LLM suggestions
          if (analysis.newStrategies.length > 0) {
            currentStrategies = [
              ...strategies.slice(0, 3), // keep best original
              ...analysis.newStrategies,
            ];
          }
        }
      }

      // Final LLM analysis
      let finalInsights = 'Research complete. Add an OpenRouter API key in Settings for AI analysis.';
      let finalNewStrategies: string[] = [];
      let topPatterns: string[] = [];

      if (openrouterKey && allResults.length > 0) {
        await send({ type: 'llm_thinking', message: 'Generating final AI insights...' });
        const final = await analyzeWithLLM(allResults, iterations, openrouterKey, openrouterModel);
        finalInsights = final.insights;
        finalNewStrategies = final.newStrategies;
        topPatterns = final.topPatterns;
        await send({ type: 'llm_analysis', analysis: final });
      }

      // Qdrant: store top strategies
      let storedToQdrant = false;
      if (qdrantUrl && qdrantApiKey && openrouterKey && allResults.length > 0) {
        await send({ type: 'qdrant_storing', message: 'Storing top strategies in Qdrant...' });
        const top10 = allResults.slice(0, 10);
        const points: QdrantPoint[] = [];
        for (let i = 0; i < top10.length; i++) {
          const r = top10[i];
          const text = `Strategy: ${r.strategy} | Symbol: ${r.symbol} | Timeframe: ${r.timeframe} | WinRate: ${r.winRate.toFixed(1)}% | ProfitFactor: ${r.profitFactor.toFixed(2)} | Sharpe: ${r.sharpeRatio.toFixed(2)} | Score: ${r.score.toFixed(1)}`;
          const vec = await getEmbedding(text, openrouterKey, embeddingModel);
          if (vec && vec.length > 0) {
            if (i === 0) await qdrantEnsureCollection(qdrantUrl, qdrantApiKey, 'trading_strategies', vec.length);
            points.push({
              id: Date.now() + i,
              vector: vec,
              payload: { symbol: r.symbol, timeframe: r.timeframe, strategy: r.strategy, winRate: r.winRate, profitFactor: r.profitFactor, sharpeRatio: r.sharpeRatio, score: r.score, savedAt: new Date().toISOString() },
            });
          }
        }
        if (points.length > 0) {
          await qdrantUpsert(qdrantUrl, qdrantApiKey, 'trading_strategies', points);
          storedToQdrant = true;
          await send({ type: 'qdrant_stored', count: points.length });
        }
      }

      // Retrieve similar strategies from Qdrant memory if available
      let memoryStrategies: string[] = [];
      if (qdrantUrl && qdrantApiKey && openrouterKey && allResults.length > 0) {
        const best = allResults[0];
        const queryText = `Best strategy for ${best.symbol} ${best.timeframe}`;
        const qVec = await getEmbedding(queryText, openrouterKey, embeddingModel);
        if (qVec) {
          const similar = await qdrantSearch(qdrantUrl, qdrantApiKey, 'trading_strategies', qVec);
          memoryStrategies = similar.map(s => `${s.payload.strategy} (${s.payload.symbol} ${s.payload.timeframe} WR:${(s.payload.winRate as number)?.toFixed(1)}%)`);
        }
      }

      const topStrategies = allResults.slice(0, 20);
      await send({
        type: 'complete',
        totalTested: allResults.length,
        topStrategies,
        insights: finalInsights,
        newStrategySuggestions: finalNewStrategies,
        topPatterns,
        storedToQdrant,
        memoryStrategies,
      });

    } catch (err) {
      await send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function GET() {
  return Response.json({
    info: 'AI Research Engine — POST with { symbols, timeframes, strategies, openrouterKey, qdrantUrl, ... }',
    stream: 'Server-Sent Events',
    events: ['iteration_start', 'progress', 'result', 'llm_thinking', 'llm_analysis', 'qdrant_storing', 'qdrant_stored', 'complete', 'error'],
  });
}
