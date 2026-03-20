'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import {
  Send, Bot, User, TrendingUp, TrendingDown, Minus,
  PlayCircle, RefreshCw, BarChart2, AlertTriangle, CheckCircle,
  Activity, Zap, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  backtestResult?: BacktestResult;
  councilDecision?: CouncilDecision;
  loading?: boolean;
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
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: { time: number; equity: number; balance: number }[];
  trades: { openTime: number; closeTime: number; type: string; openPrice: number; closePrice: number; profit: number }[];
}

interface ExpertVote {
  expert: { name: string; model: string; role: string; weight: number };
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  latencyMs: number;
}

interface CouncilDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  consensus: number;
  weightedConfidence: number;
  votes: ExpertVote[];
  dissent: string[];
  summary: string;
}

interface Expert {
  name: string;
  model: string;
  role: string;
  weight: number;
}

const SYSTEM_PROMPT = `You are an expert AI trading assistant. You help users:
1. Design, analyze, and refine trading strategies
2. Explain technical indicators and patterns
3. Run backtests on historical data (just say "BACKTEST: <strategy description>")
4. Get Council of Experts analysis (say "COUNCIL: <strategy>")
5. Answer questions about markets, risk, and trading psychology

When user asks to test a strategy, respond with "BACKTEST: <strategy>" on its own line.
When user wants multiple expert opinions, respond with "COUNCIL: <strategy>" on its own line.
Otherwise provide clear, actionable advice. Be concise but thorough.
Use $ for currency. Mention specific indicators when relevant.`;

function BacktestCard({ result }: { result: BacktestResult }) {
  const isProfit = result.netProfit >= 0;
  return (
    <div className="mt-3 border border-border rounded-xl overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isProfit ? 'bg-accent-green/5 border-b border-accent-green/20' : 'bg-accent-red/5 border-b border-accent-red/20'
      )}>
        <div className="flex items-center gap-2">
          <BarChart2 className={cn('w-4 h-4', isProfit ? 'text-accent-green' : 'text-accent-red')} />
          <span className="text-sm font-semibold text-text-primary">Backtest Results</span>
        </div>
        <span className={cn('text-sm font-bold font-mono', isProfit ? 'text-accent-green' : 'text-accent-red')}>
          {isProfit ? '+' : ''}${result.netProfit.toFixed(2)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-0 border-b border-border">
        {[
          { label: 'Trades', value: result.totalTrades.toString() },
          { label: 'Win Rate', value: `${result.winRate.toFixed(1)}%`, color: result.winRate >= 50 ? 'green' : 'red' },
          { label: 'Profit Factor', value: result.profitFactor.toFixed(2), color: result.profitFactor >= 1 ? 'green' : 'red' },
          { label: 'Max DD', value: `-${result.maxDrawdown.toFixed(1)}%`, color: 'red' },
          { label: 'Sharpe', value: result.sharpeRatio.toFixed(2), color: result.sharpeRatio >= 1 ? 'green' : result.sharpeRatio >= 0 ? 'yellow' : 'red' },
          { label: 'Avg Win', value: `$${result.avgWin.toFixed(2)}`, color: 'green' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 border-r border-border last:border-0">
            <p className="text-[10px] text-text-muted">{label}</p>
            <p className={cn('text-sm font-bold font-mono',
              color === 'green' ? 'text-accent-green' :
              color === 'red' ? 'text-accent-red' :
              color === 'yellow' ? 'text-accent-yellow' :
              'text-text-primary'
            )}>{value}</p>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {result.equityCurve.length > 1 && (
        <div className="p-3">
          <p className="text-xs text-text-muted mb-2">Equity Curve</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.equityCurve} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 6, fontSize: 10 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
                />
                <Line dataKey="equity" stroke={isProfit ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function CouncilCard({ decision }: { decision: CouncilDecision }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3 border border-border rounded-xl overflow-hidden bg-bg-primary">
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        decision.action === 'BUY' ? 'bg-accent-green/5 border-b border-accent-green/20' :
        decision.action === 'SELL' ? 'bg-accent-red/5 border-b border-accent-red/20' :
        'bg-bg-tertiary border-b border-border'
      )}>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-purple" />
          <span className="text-sm font-semibold text-text-primary">Council Decision</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-bold',
            decision.action === 'BUY' ? 'text-accent-green' :
            decision.action === 'SELL' ? 'text-accent-red' : 'text-text-muted'
          )}>{decision.action}</span>
          <span className="text-xs text-text-muted">{decision.consensus}% consensus</span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-text-secondary">{decision.summary}</p>

        {/* Expert votes */}
        <div className="space-y-1.5">
          {decision.votes.map((v, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={cn(
                'px-1.5 py-0.5 rounded font-bold flex-shrink-0',
                v.action === 'BUY' ? 'bg-accent-green/10 text-accent-green' :
                v.action === 'SELL' ? 'bg-accent-red/10 text-accent-red' :
                'bg-bg-tertiary text-text-muted'
              )}>{v.action}</span>
              <div className="flex-1">
                <span className="font-medium text-text-primary">{v.expert.name}</span>
                <span className="text-text-muted ml-1">({v.confidence}%)</span>
                {expanded && <p className="text-text-muted mt-0.5">{v.reason}</p>}
                <span className="text-text-muted ml-2 text-[10px]">{v.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>

        {decision.dissent.length > 0 && expanded && (
          <div className="text-xs text-accent-yellow">
            <span className="font-medium">Dissent: </span>
            {decision.dissent.join('; ')}
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent-blue hover:underline flex items-center gap-1">
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Less' : 'More details'}
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { settings } = useStore();
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: `Hello! I'm your AI Trading Assistant. I can help you:

**Design & test strategies** — describe your idea and I'll analyze it
**Run backtests** — say "test this strategy: [description]" and I'll backtest it on historical data
**Council of Experts** — say "get expert opinions on: [strategy]" for multi-model analysis
**Analyze markets** — ask about indicators, patterns, risk management

Try: *"Test a strategy: buy when 3 consecutive bullish candles, sell when 3 consecutive bearish on EURUSD"*`,
    timestamp: new Date().toISOString(),
  }]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('H1');
  const [slPips, setSlPips] = useState(50);
  const [tpPips, setTpPips] = useState(100);
  const [experts, setExperts] = useState<Expert[]>([
    { name: 'Trend Analyst', model: 'anthropic/claude-3.5-sonnet', role: 'Technical trend analysis using moving averages and price action', weight: 3 },
    { name: 'Risk Manager', model: 'openai/gpt-4o-mini', role: 'Risk/reward assessment and money management', weight: 2 },
    { name: 'Pattern Trader', model: 'google/gemini-pro-1.5', role: 'Candlestick patterns and chart pattern recognition', weight: 2 },
  ]);
  const [showExperts, setShowExperts] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const newMsg: Message = { ...msg, id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, newMsg]);
    return newMsg.id;
  };

  const fetchCandles = useCallback(async (sym: string, tf: string): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> => {
    try {
      const res = await fetch(`/api/market?symbol=${sym}&timeframe=${tf}&count=200`);
      const data = await res.json();
      return data.candles || [];
    } catch {
      return [];
    }
  }, []);

  const runBacktest = useCallback(async (strategyDesc: string, sym: string, tf: string): Promise<BacktestResult | null> => {
    const candles = await fetchCandles(sym, tf);
    if (candles.length < 30) return null;

    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backtest',
          candles,
          strategy: strategyDesc,
          slPips,
          tpPips,
          initialBalance: 10000,
          lotSize: 0.01,
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [fetchCandles, slPips, tpPips]);

  const runCouncil = useCallback(async (strategyDesc: string, sym: string, tf: string): Promise<CouncilDecision | null> => {
    if (!settings.openrouterApiKey) return null;
    const candles = await fetchCandles(sym, tf);
    if (candles.length < 5) return null;

    try {
      const res = await fetch('/api/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candles,
          strategy: strategyDesc,
          symbol: sym,
          timeframe: tf,
          experts,
          apiKey: settings.openrouterApiKey,
          slPips,
          tpPips,
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [settings.openrouterApiKey, experts, fetchCandles, slPips, tpPips]);

  const chatWithAI = useCallback(async (userMessage: string, history: Message[]): Promise<string> => {
    const messagesForAPI = history.slice(-10).map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }));
    messagesForAPI.push({ role: 'user', content: userMessage });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-trading-bot.local',
        'X-Title': 'AI Trading Bot',
      },
      body: JSON.stringify({
        model: settings.openrouterModel || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messagesForAPI,
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response';
  }, [settings.openrouterApiKey, settings.openrouterModel]);

  const sendMessage = useCallback(async () => {
    const userText = input.trim();
    if (!userText || loading) return;
    if (!settings.openrouterApiKey) {
      addMsg({ role: 'assistant', content: 'Please set your OpenRouter API key in Settings first.' });
      return;
    }

    setInput('');
    addMsg({ role: 'user', content: userText });
    setLoading(true);

    const loadingId = addMsg({ role: 'assistant', content: '...', loading: true });

    try {
      // Get AI response
      const aiResponse = await chatWithAI(userText, messages);

      // Check if AI wants to run a backtest
      const backtestMatch = aiResponse.match(/BACKTEST:\s*(.+?)(?:\n|$)/i);
      const councilMatch = aiResponse.match(/COUNCIL:\s*(.+?)(?:\n|$)/i);

      let backtestResult: BacktestResult | undefined;
      let councilDecision: CouncilDecision | undefined;
      let displayText = aiResponse;

      if (backtestMatch) {
        const strategyToTest = backtestMatch[1].trim();
        displayText = aiResponse.replace(/BACKTEST:\s*.+/i, '').trim();
        displayText += `\n\nRunning backtest: **${strategyToTest}** on ${symbol} ${timeframe}...`;

        // Update message with loading state
        setMessages(prev => prev.map(m =>
          m.id === loadingId ? { ...m, content: displayText, loading: false } : m
        ));

        backtestResult = await runBacktest(strategyToTest, symbol, timeframe) || undefined;

        if (backtestResult) {
          const verdict = backtestResult.netProfit >= 0 && backtestResult.winRate >= 50
            ? `Strategy shows **positive results** with ${backtestResult.winRate.toFixed(1)}% win rate.`
            : `Strategy shows **challenging results**. Consider adjusting parameters.`;
          displayText += `\n\n${verdict}`;
        }
      } else if (councilMatch) {
        const strategyForCouncil = councilMatch[1].trim();
        displayText = aiResponse.replace(/COUNCIL:\s*.+/i, '').trim();
        displayText += `\n\nConsulting ${experts.length} expert AIs on "${strategyForCouncil}"...`;

        setMessages(prev => prev.map(m =>
          m.id === loadingId ? { ...m, content: displayText, loading: false } : m
        ));

        councilDecision = await runCouncil(strategyForCouncil, symbol, timeframe) || undefined;
      }

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: displayText, loading: false, backtestResult, councilDecision }
          : m
      ));
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: `Error: ${String(e)}`, loading: false }
          : m
      ));
    }

    setLoading(false);
  }, [input, loading, messages, settings, symbol, timeframe, experts, chatWithAI, runBacktest, runCouncil]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const QUICK_PROMPTS = [
    "Test RSI strategy: buy oversold (<30), sell overbought (>70)",
    "Get expert opinions on: EMA9 cross EMA21 trend strategy",
    "What's the best risk management approach for scalping?",
    "Test breakout strategy: buy above 20-candle high, sell below 20-candle low",
    "Explain the pros and cons of mean reversion vs trend following",
    "Design a strategy for BTCUSDT using momentum and volume",
  ];

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <Header title="AI Strategy Chat" />

      {/* Config bar */}
      <div className="border-b border-border px-4 py-2 flex flex-wrap items-center gap-3 bg-bg-secondary flex-shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <Activity className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-muted">Backtest on:</span>
          <select className="trading-input py-0.5 text-xs w-28"
            value={symbol} onChange={e => setSymbol(e.target.value)}>
            {['EURUSD','GBPUSD','USDJPY','BTCUSDT','ETHUSDT','XAUUSD'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="trading-input py-0.5 text-xs w-20"
            value={timeframe} onChange={e => setTimeframe(e.target.value)}>
            {['M1','M5','M15','M30','H1','H4','D1'].map(tf => (
              <option key={tf}>{tf}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">SL:</span>
          <input type="number" className="trading-input py-0.5 text-xs w-14" value={slPips}
            onChange={e => setSlPips(+e.target.value)} />
          <span className="text-text-muted">TP:</span>
          <input type="number" className="trading-input py-0.5 text-xs w-14" value={tpPips}
            onChange={e => setTpPips(+e.target.value)} />
          <span className="text-text-muted">pips</span>
        </div>

        <button onClick={() => setShowExperts(!showExperts)}
          className="flex items-center gap-1 text-xs text-accent-purple hover:underline ml-auto">
          <Zap className="w-3 h-3" />
          {experts.length} Experts
          <ChevronDown className={cn('w-3 h-3 transition-transform', showExperts && 'rotate-180')} />
        </button>
      </div>

      {/* Expert config panel */}
      {showExperts && (
        <div className="border-b border-border px-4 py-3 bg-bg-secondary flex-shrink-0">
          <p className="text-xs text-text-muted mb-2">Configure Council of Experts (used for COUNCIL commands):</p>
          <div className="space-y-2">
            {experts.map((expert, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className="trading-input text-xs w-28" value={expert.name}
                  placeholder="Name"
                  onChange={e => setExperts(prev => prev.map((ex, j) => j === i ? { ...ex, name: e.target.value } : ex))} />
                <input className="trading-input text-xs flex-1" value={expert.model}
                  placeholder="model ID"
                  onChange={e => setExperts(prev => prev.map((ex, j) => j === i ? { ...ex, model: e.target.value } : ex))} />
                <input type="number" className="trading-input text-xs w-14" value={expert.weight}
                  min={1} max={5}
                  onChange={e => setExperts(prev => prev.map((ex, j) => j === i ? { ...ex, weight: +e.target.value } : ex))} />
                <span className="text-xs text-text-muted">w</span>
                <button onClick={() => setExperts(prev => prev.filter((_, j) => j !== i))}
                  className="text-accent-red text-xs hover:underline">×</button>
              </div>
            ))}
            <button
              onClick={() => setExperts(prev => [...prev, { name: 'Expert', model: 'anthropic/claude-3.5-sonnet', role: 'General trading analysis', weight: 2 }])}
              className="text-xs text-accent-blue hover:underline"
            >+ Add Expert</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            {/* Avatar */}
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              msg.role === 'user' ? 'bg-accent-blue/20' : 'bg-accent-purple/20'
            )}>
              {msg.role === 'user'
                ? <User className="w-3.5 h-3.5 text-accent-blue" />
                : <Bot className="w-3.5 h-3.5 text-accent-purple" />}
            </div>

            {/* Bubble */}
            <div className={cn(
              'max-w-[80%] rounded-xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-accent-blue/10 border border-accent-blue/20'
                : 'bg-bg-secondary border border-border'
            )}>
              {msg.loading ? (
                <div className="flex items-center gap-1.5 text-text-muted">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                        .replace(/`(.+?)`/g, '<code class="bg-bg-primary px-1 rounded text-accent-blue text-xs">$1</code>')
                    }}
                  />
                  {msg.backtestResult && <BacktestCard result={msg.backtestResult} />}
                  {msg.councilDecision && <CouncilCard decision={msg.councilDecision} />}
                </>
              )}
              <p className="text-[10px] text-text-muted mt-1.5 text-right">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto flex-shrink-0">
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => setInput(p)}
            className="text-xs text-text-muted border border-border rounded-full px-3 py-1 hover:border-accent-blue hover:text-accent-blue whitespace-nowrap transition-colors flex-shrink-0">
            {p.slice(0, 40)}{p.length > 40 ? '...' : ''}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border flex gap-2 flex-shrink-0 bg-bg-secondary">
        <textarea
          className="flex-1 trading-input resize-none text-sm"
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about trading strategies, or say 'test strategy: ...' to backtest..."
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/80 disabled:opacity-40 transition-colors flex-shrink-0 self-end"
        >
          {loading
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
        </button>
      </div>

      {!settings.openrouterApiKey && (
        <div className="px-4 py-2 bg-accent-red/5 border-t border-accent-red/20 text-xs text-accent-red flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          OpenRouter API key required —{' '}
          <a href="/settings" className="underline">go to Settings</a>
        </div>
      )}
    </main>
  );
}
