import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Fetch the full list of models from OpenRouter API.
// The endpoint is public — no auth required to list models.
export async function GET() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': 'https://ai-trading-bot.local',
        'X-Title': 'AI Trading Bot',
      },
      next: { revalidate: 300 }, // cache 5 minutes
    });

    if (!res.ok) {
      throw new Error(`OpenRouter responded with ${res.status}`);
    }

    const data = await res.json();

    // data.data is array of model objects
    const models = (data.data || []).map((m: {
      id: string;
      name: string;
      description?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      top_provider?: { context_length?: number };
    }) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description || '',
      contextLength: m.context_length || m.top_provider?.context_length || 0,
      pricing: {
        prompt: m.pricing?.prompt ? parseFloat(m.pricing.prompt) : 0,
        completion: m.pricing?.completion ? parseFloat(m.pricing.completion) : 0,
      },
    }));

    // Sort: free models first, then by name
    models.sort((a: { pricing: { prompt: number }; name: string }, b: { pricing: { prompt: number }; name: string }) => {
      if (a.pricing.prompt === 0 && b.pricing.prompt !== 0) return -1;
      if (a.pricing.prompt !== 0 && b.pricing.prompt === 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ models, count: models.length });
  } catch (err) {
    return NextResponse.json(
      { error: String(err), models: [] },
      { status: 500 }
    );
  }
}
