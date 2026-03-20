import { NextRequest, NextResponse } from 'next/server';

export interface Candle {
  time: number;   // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface AutotraderDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0–100
  reason: string;
  suggestedSl?: number; // price level (optional)
  suggestedTp?: number; // price level (optional)
}

const DECISION_SYSTEM_PROMPT = `You are an expert algorithmic trading analyst AI.
You receive OHLCV candlestick data and a strategy description, then decide whether to BUY, SELL, or HOLD.

Rules:
- Analyze the given candles strictly following the stated strategy.
- Be conservative: only signal BUY or SELL when you are confident (confidence >= 65).
- If uncertain or no clear signal, respond HOLD.
- If there are already open positions in the same direction, prefer HOLD (avoid overtrading).
- Always respond with ONLY valid JSON, nothing else.

Response format (JSON only, no markdown):
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <integer 0-100>,
  "reason": "<one concise sentence explaining the decision>"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candles,
      strategy,
      symbol,
      timeframe,
      openTrades,
      slPips,
      tpPips,
      apiKey,
      model,
    } = body as {
      candles: Candle[];
      strategy: string;
      symbol: string;
      timeframe: string;
      openTrades: number;
      slPips: number;
      tpPips: number;
      apiKey: string;
      model: string;
    };

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key required' }, { status: 400 });
    }

    if (!candles || candles.length < 3) {
      return NextResponse.json({ error: 'Insufficient candle data' }, { status: 400 });
    }

    // Build candle summary for the last 30 candles (or fewer)
    const recent = candles.slice(-30);
    const lastCandle = recent[recent.length - 1];

    const candleSummary = recent.map((c, i) => {
      const dir = c.close >= c.open ? '▲' : '▼';
      const body = Math.abs(c.close - c.open);
      return `${i + 1}. ${dir} O:${c.open.toFixed(5)} H:${c.high.toFixed(5)} L:${c.low.toFixed(5)} C:${c.close.toFixed(5)} (body:${body.toFixed(5)})`;
    }).join('\n');

    const userMessage = `Symbol: ${symbol}  |  Timeframe: ${timeframe}
Strategy: ${strategy}
Currently open trades on this symbol: ${openTrades}
SL: ${slPips} pips  |  TP: ${tpPips} pips
Last price: ${lastCandle.close.toFixed(5)}

Last ${recent.length} candles (oldest → newest):
${candleSummary}

Analyze these candles using the strategy and respond with your decision in JSON.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-trading-bot.local',
        'X-Title': 'AI Trading Bot',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DECISION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter error ${response.status}: ${errText}` }, { status: 502 });
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let decision: AutotraderDecision;
    try {
      // Strip markdown code blocks if present
      const cleaned = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      decision = {
        action: ['BUY', 'SELL', 'HOLD'].includes(parsed.action) ? parsed.action : 'HOLD',
        confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
        reason: String(parsed.reason || 'No reason provided'),
      };
    } catch {
      // Fallback: try to extract action from text
      const actionMatch = content.match(/\b(BUY|SELL|HOLD)\b/);
      decision = {
        action: (actionMatch?.[1] as 'BUY' | 'SELL' | 'HOLD') || 'HOLD',
        confidence: 50,
        reason: content.slice(0, 200),
      };
    }

    return NextResponse.json(decision);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
