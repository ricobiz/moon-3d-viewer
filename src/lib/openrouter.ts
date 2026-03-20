export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Best for complex strategies' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and efficient' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast GPT-4' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: 'Google flagship' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Open source, free tier' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'Fast and affordable' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', description: 'European AI' },
];

const STRATEGY_SYSTEM_PROMPT = `You are an expert MQL5 programmer and professional algorithmic trader. Your task is to generate complete, compilable, production-ready MQL5 Expert Advisor (EA) code for MetaTrader 5.

RULES:
1. Generate COMPLETE MQL5 code - from #property to OnDeinit()
2. Include proper error handling and logging
3. Include input parameters for all configurable values
4. Include risk management (stop loss, take profit, lot size)
5. Use only MetaTrader 5 compatible functions and syntax
6. Include comments explaining the strategy logic
7. Handle multiple symbols if needed
8. Include proper trade management (open, close, modify)
9. Use CTrade class for trade operations
10. Include magic number for trade identification

The code must be a standalone Expert Advisor that can be compiled and run directly in MetaTrader 5.

Respond with ONLY the MQL5 code, no explanations before or after. Start with //+------------------------------------------------------------------+`;

export async function generateStrategy(
  description: string,
  apiKey: string,
  model: string,
  additionalContext?: {
    symbol?: string;
    timeframe?: string;
    riskPercent?: number;
    lotSize?: number;
  }
): Promise<{ code: string; name: string; tokensUsed: number }> {
  const userMessage = `Create a complete MQL5 Expert Advisor based on this strategy description:

${description}

${additionalContext ? `
Additional parameters:
- Symbol: ${additionalContext.symbol || 'configurable via input'}
- Timeframe: ${additionalContext.timeframe || 'configurable via input'}
- Risk per trade: ${additionalContext.riskPercent || 1}%
- Default lot size: ${additionalContext.lotSize || 0.01}
` : ''}

Generate the complete MQL5 EA code now.`;

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
        { role: 'system', content: STRATEGY_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content || '';

  // Extract strategy name from code or description
  const nameMatch = content.match(/#property\s+description\s+"([^"]+)"/);
  const name = nameMatch ? nameMatch[1] : extractNameFromDescription(description);

  return {
    code: content,
    name,
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

export async function chatWithAI(
  messages: OpenRouterMessage[],
  apiKey: string,
  model: string
): Promise<string> {
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
      messages,
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

function extractNameFromDescription(description: string): string {
  const words = description.split(' ').slice(0, 4).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1) + ' EA';
}
