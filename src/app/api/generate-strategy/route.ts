import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, apiKey, model, symbol, timeframe, riskPercent, lotSize } = body;

    if (!description || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: description, apiKey' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert MQL5 programmer and professional algorithmic trader. Your task is to generate complete, compilable, production-ready MQL5 Expert Advisor (EA) code for MetaTrader 5.

RULES:
1. Generate COMPLETE MQL5 code - from #property to OnDeinit()
2. Include proper error handling and logging with Print()
3. Include input parameters for all configurable values (EVERY magic number, threshold, period must be an input)
4. Include comprehensive risk management (stop loss, take profit, lot size, max trades)
5. Use only MetaTrader 5 compatible functions and syntax (MQL5, NOT MQL4)
6. Add detailed comments explaining the strategy logic
7. Use CTrade class for all trade operations
8. Include magic number as input parameter for trade identification
9. Handle spread conditions
10. Include OnInit() validation checks

The code must be a complete standalone Expert Advisor compilable in MetaTrader 5.
Start with the //+------------------------------------------------------------------+ header block.
Respond with ONLY the MQL5 code, no markdown, no explanations.`;

    const userMessage = `Create a complete MQL5 Expert Advisor based on this strategy:

${description}

Technical specifications:
- Primary Symbol: ${symbol || 'configurable via input parameter'}
- Primary Timeframe: ${timeframe || 'configurable via input parameter'}
- Risk per trade: ${riskPercent || 1}%
- Default lot size: ${lotSize || 0.01}

Requirements:
- All parameters must be exposed as input variables
- Include proper money management and position sizing
- Handle errors gracefully
- Include detailed logging
- Compatible with both Forex pairs and crypto (BTCUSDT etc)

Generate the complete MQL5 EA code now:`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-trading-bot.local',
        'X-Title': 'AI Trading Bot MQL5 Generator',
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.15,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch {}
      // Parse OpenRouter error message if JSON
      let errMsg = `OpenRouter error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errJson?.error || errMsg;
      } catch {}
      return NextResponse.json({ error: errMsg }, { status: 200 });
    }

    const data = await response.json();
    const code = data.choices[0]?.message?.content || '';

    // Extract strategy name
    const nameMatch = code.match(/#property\s+description\s+"([^"]+)"/);
    const nameMatch2 = description.match(/^(\w[\w\s]{2,30})/);
    const name = nameMatch?.[1] || (nameMatch2 ? nameMatch2[1].trim() : 'AI Strategy') + ' EA';

    return NextResponse.json({
      code,
      name,
      tokensUsed: data.usage?.total_tokens || 0,
      model: data.model,
    });
  } catch (error) {
    console.error('Strategy generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error during strategy generation' },
      { status: 500 }
    );
  }
}
