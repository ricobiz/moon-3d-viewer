'use client';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import { useState, useRef, useCallback } from 'react';
import {
  FlaskConical, Play, Square, ChevronDown, ChevronUp, Plus, X,
  Brain, Database, TrendingUp, BarChart2, CheckCircle, Clock,
  AlertTriangle, Sparkles, Search, RefreshCw, BookOpen, Loader2,
  Star, Zap, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Instrument catalog (MetaTrader-style) ────────────────────────────────────
const INSTRUMENT_CATALOG: Record<string, Array<{ symbol: string; name: string }>> = {
  'Forex Majors': [
    { symbol: 'EURUSD', name: 'Euro / US Dollar' },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar' },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen' },
    { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc' },
    { symbol: 'AUDUSD', name: 'Australian Dollar / USD' },
    { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar' },
    { symbol: 'NZDUSD', name: 'New Zealand Dollar / USD' },
  ],
  'Forex Minors': [
    { symbol: 'EURGBP', name: 'Euro / British Pound' },
    { symbol: 'EURJPY', name: 'Euro / Japanese Yen' },
    { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen' },
    { symbol: 'EURAUD', name: 'Euro / Australian Dollar' },
    { symbol: 'EURCAD', name: 'Euro / Canadian Dollar' },
    { symbol: 'EURCHF', name: 'Euro / Swiss Franc' },
    { symbol: 'GBPAUD', name: 'British Pound / Australian Dollar' },
    { symbol: 'AUDCAD', name: 'Australian Dollar / Canadian Dollar' },
    { symbol: 'AUDNZD', name: 'AUD / New Zealand Dollar' },
    { symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen' },
    { symbol: 'GBPCAD', name: 'British Pound / Canadian Dollar' },
    { symbol: 'NZDCAD', name: 'New Zealand Dollar / CAD' },
    { symbol: 'NZDJPY', name: 'New Zealand Dollar / JPY' },
  ],
  'Commodities': [
    { symbol: 'XAUUSD', name: 'Gold / US Dollar' },
    { symbol: 'XAGUSD', name: 'Silver / US Dollar' },
    { symbol: 'USOIL', name: 'US Crude Oil (WTI)' },
  ],
  'Indices': [
    { symbol: 'SPX500', name: 'S&P 500 Index' },
    { symbol: 'NAS100', name: 'NASDAQ 100' },
    { symbol: 'DOW30', name: 'Dow Jones Industrial' },
    { symbol: 'UK100', name: 'FTSE 100' },
    { symbol: 'GER40', name: 'DAX 40' },
    { symbol: 'JPN225', name: 'Nikkei 225' },
  ],
  'Crypto': [
    { symbol: 'BTCUSDT', name: 'Bitcoin / USDT' },
    { symbol: 'ETHUSDT', name: 'Ethereum / USDT' },
    { symbol: 'BNBUSDT', name: 'Binance Coin / USDT' },
    { symbol: 'SOLUSDT', name: 'Solana / USDT' },
    { symbol: 'XRPUSDT', name: 'Ripple / USDT' },
    { symbol: 'ADAUSDT', name: 'Cardano / USDT' },
    { symbol: 'LTCUSDT', name: 'Litecoin / USDT' },
    { symbol: 'AVAXUSDT', name: 'Avalanche / USDT' },
    { symbol: 'DOTUSDT', name: 'Polkadot / USDT' },
  ],
};

const ALL_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const PRESET_STRATEGIES = [
  { id: 'rsi', label: 'RSI Reversal', desc: 'Buy when RSI drops below 30 (oversold), sell when RSI rises above 70 (overbought)' },
  { id: 'ma', label: 'MA Crossover', desc: 'Buy when 9 EMA crosses above 21 EMA (golden cross), sell on death cross' },
  { id: 'macd', label: 'MACD Cross', desc: 'Buy when MACD line crosses above zero, sell when it crosses below' },
  { id: 'breakout', label: 'Breakout', desc: 'Buy breakout above 20-candle high resistance, sell breakdown below low support' },
  { id: 'trend', label: 'Trend Follow', desc: 'Buy after 3 consecutive bullish candles confirming uptrend momentum' },
  { id: 'bollinger', label: 'Bollinger Reversal', desc: 'Buy bounce from lower Bollinger band (20, 2.0), sell at upper band' },
  { id: 'meanrev', label: 'Mean Reversion', desc: 'Mean reversion Z-score: buy when price is 2 standard deviations below mean' },
  { id: 'volume', label: 'Volume Momentum', desc: 'Buy when price closes above VWAP with increasing volume confirmation' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface ResearchState {
  running: boolean;
  progress: number;
  progressMsg: string;
  current: number;
  total: number;
  results: ComboResult[];
  insights: string;
  newStrategies: string[];
  topPatterns: string[];
  storedToQdrant: boolean;
  memoryStrategies: string[];
  log: Array<{ type: string; message: string; time: string }>;
  done: boolean;
  iterationLog: string[];
}

function scoreColor(score: number) {
  if (score >= 60) return 'text-accent-green';
  if (score >= 35) return 'text-accent-yellow';
  return 'text-accent-red';
}

function sourceLabel(src: string) {
  if (src === 'twelve_data') return '12D';
  if (src === 'synthetic') return '~SYN';
  return src.slice(0, 4).toUpperCase();
}

// ─── Watchlist Panel ──────────────────────────────────────────────────────────
function WatchlistPanel({
  selectedForResearch,
  onToggle,
}: {
  selectedForResearch: string[];
  onToggle: (symbol: string) => void;
}) {
  const { settings, updateSettings } = useStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const categories = ['All', ...Object.keys(INSTRUMENT_CATALOG)];

  const allInstruments = Object.entries(INSTRUMENT_CATALOG).flatMap(([cat, items]) =>
    items.map(item => ({ ...item, category: cat }))
  );

  const filtered = allInstruments.filter(inst => {
    const matchSearch = !search || inst.symbol.toLowerCase().includes(search.toLowerCase()) || inst.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || inst.category === activeCategory;
    const matchWatchlist = !watchlistOnly || settings.watchlist.includes(inst.symbol);
    return matchSearch && matchCat && matchWatchlist;
  });

  const toggleWatchlist = (symbol: string) => {
    const wl = settings.watchlist.includes(symbol)
      ? settings.watchlist.filter(s => s !== symbol)
      : [...settings.watchlist, symbol];
    updateSettings({ watchlist: wl });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-blue" />
          <span className="text-sm font-semibold text-text-primary">Market Watch</span>
          <span className="text-xs bg-accent-blue/10 text-accent-blue px-1.5 py-0.5 rounded">
            {settings.watchlist.length}
          </span>
        </div>
        <button
          onClick={() => setWatchlistOnly(v => !v)}
          className={cn('text-xs px-2 py-1 rounded transition-colors border',
            watchlistOnly ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30' : 'border-border text-text-muted hover:text-text-primary'
          )}
        >
          {watchlistOnly ? '★ Watchlist' : 'All'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          className="trading-input pl-7 text-xs py-1.5"
          placeholder="Search instruments..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-2 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors flex-shrink-0',
              activeCategory === cat ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
            )}
          >
            {cat === 'All' ? 'All' : cat.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Instrument list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {filtered.map(inst => {
          const inWatchlist = settings.watchlist.includes(inst.symbol);
          const inResearch = selectedForResearch.includes(inst.symbol);
          return (
            <div
              key={inst.symbol}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded group cursor-pointer transition-colors',
                inResearch ? 'bg-accent-blue/10 border border-accent-blue/20' : 'hover:bg-bg-hover'
              )}
              onClick={() => onToggle(inst.symbol)}
            >
              {/* Research checkbox */}
              <div className={cn(
                'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                inResearch ? 'bg-accent-blue border-accent-blue' : 'border-border'
              )}>
                {inResearch && <CheckCircle className="w-2.5 h-2.5 text-white" />}
              </div>
              {/* Symbol */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary leading-tight">{inst.symbol}</p>
                <p className="text-[10px] text-text-muted truncate leading-tight">{inst.name}</p>
              </div>
              {/* Watchlist star */}
              <button
                onClick={e => { e.stopPropagation(); toggleWatchlist(inst.symbol); }}
                className={cn('opacity-0 group-hover:opacity-100 transition-opacity',
                  inWatchlist && 'opacity-100'
                )}
              >
                <Star className={cn('w-3 h-3', inWatchlist ? 'text-accent-yellow fill-accent-yellow' : 'text-text-muted')} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No instruments found</p>
        )}
      </div>

      {/* Selected count */}
      {selectedForResearch.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-accent-blue text-center">
            {selectedForResearch.length} selected for research
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const { settings } = useStore();

  // Research config
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['EURUSD', 'BTCUSDT', 'XAUUSD']);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['H1', 'H4']);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['rsi', 'ma', 'trend', 'breakout']);
  const [customStrategy, setCustomStrategy] = useState('');
  const [slPips, setSlPips] = useState(50);
  const [tpPips, setTpPips] = useState(100);
  const [candleCount, setCandleCount] = useState(300);
  const [maxIterations, setMaxIterations] = useState(2);
  const [qdrantUrl, setQdrantUrl] = useState(settings.qdrantUrl || '');
  const [qdrantKey, setQdrantKey] = useState(settings.qdrantApiKey || '');
  const [embeddingModel, setEmbeddingModel] = useState(settings.embeddingModel || 'text-embedding-ada-002');
  const [showConfig, setShowConfig] = useState(true);

  // Research state
  const [state, setState] = useState<ResearchState>({
    running: false, progress: 0, progressMsg: 'Ready', current: 0, total: 0,
    results: [], insights: '', newStrategies: [], topPatterns: [], storedToQdrant: false,
    memoryStrategies: [], log: [], done: false, iterationLog: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  const toggleSymbol = useCallback((symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }, []);

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes(prev =>
      prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf]
    );
  };

  const toggleStrategy = (id: string) => {
    setSelectedStrategies(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const getStrategyDescs = () => {
    const presets = PRESET_STRATEGIES.filter(s => selectedStrategies.includes(s.id)).map(s => s.desc);
    const custom = customStrategy.trim() ? [customStrategy.trim()] : [];
    return [...presets, ...custom];
  };

  // Must match MAX_COMBOS_PER_ITERATION in /api/research/route.ts
  const MAX_COMBOS_PER_ITERATION = 40;
  const combosEstimate = Math.min(
    selectedSymbols.length * selectedTimeframes.length * getStrategyDescs().length * maxIterations,
    MAX_COMBOS_PER_ITERATION * maxIterations
  );

  const startResearch = async () => {
    const strategies = getStrategyDescs();
    if (selectedSymbols.length === 0 || selectedTimeframes.length === 0 || strategies.length === 0) return;

    setState(s => ({
      ...s, running: true, done: false, results: [], insights: '', newStrategies: [],
      topPatterns: [], storedToQdrant: false, memoryStrategies: [], log: [], iterationLog: [],
      progress: 0, progressMsg: 'Starting research...',
    }));
    setShowConfig(false);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: selectedSymbols,
          timeframes: selectedTimeframes,
          strategies,
          slPips, tpPips, candleCount, maxIterations,
          openrouterKey: settings.openrouterApiKey,
          openrouterModel: settings.openrouterModel,
          qdrantUrl, qdrantApiKey: qdrantKey, embeddingModel,
          twelveKey: settings.twelveDataKey,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error('Research API failed');

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            handleEvent(evt);
          } catch { /* malformed */ }
        }
      }

      setState(s => ({ ...s, running: false }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState(s => ({
          ...s, running: false, done: true,
          insights: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }));
      } else {
        setState(s => ({ ...s, running: false }));
      }
    }
  };

  const handleEvent = (evt: Record<string, unknown>) => {
    const now = new Date().toLocaleTimeString();
    setState(s => {
      const log = [...s.log.slice(-50), { type: evt.type as string, message: String(evt.message ?? evt.type), time: now }];

      switch (evt.type) {
        case 'iteration_start':
          return { ...s, log, iterationLog: [...s.iterationLog, `Iteration ${evt.iteration}/${evt.total}`] };

        case 'progress':
          return { ...s, log, progress: Number(evt.progress) || s.progress, progressMsg: String(evt.message), current: Number(evt.current) || s.current, total: Number(evt.total) || s.total };

        case 'result': {
          const r = evt.result as ComboResult;
          if (!r) return { ...s, log };
          const results = [...s.results, r].sort((a, b) => b.score - a.score);
          return { ...s, log, results };
        }

        case 'llm_analysis': {
          const a = evt.analysis as { insights?: string; newStrategies?: string[]; topPatterns?: string[] };
          return { ...s, log, insights: a?.insights || s.insights, newStrategies: a?.newStrategies || s.newStrategies, topPatterns: a?.topPatterns || s.topPatterns };
        }

        case 'qdrant_stored':
          return { ...s, log, storedToQdrant: true };

        case 'complete': {
          const c = evt as { topStrategies?: ComboResult[]; insights?: string; newStrategySuggestions?: string[]; topPatterns?: string[]; storedToQdrant?: boolean; memoryStrategies?: string[] };
          return {
            ...s, log, done: true, running: false,
            results: (c.topStrategies || s.results).sort((a, b) => b.score - a.score),
            insights: c.insights || s.insights,
            newStrategies: c.newStrategySuggestions || s.newStrategies,
            topPatterns: c.topPatterns || s.topPatterns,
            storedToQdrant: c.storedToQdrant || s.storedToQdrant,
            memoryStrategies: c.memoryStrategies || s.memoryStrategies,
            progress: 100, progressMsg: `Complete — ${s.results.length} combinations tested`,
          };
        }

        case 'error':
          return { ...s, log, running: false, done: true, insights: `Error: ${evt.message}` };

        default:
          return { ...s, log };
      }
    });
  };

  const stopResearch = () => {
    abortRef.current?.abort();
    readerRef.current?.cancel();
    setState(s => ({ ...s, running: false, progressMsg: 'Stopped by user' }));
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="AI Research Lab" />
      <div className="p-4 h-[calc(100vh-64px)] flex flex-col gap-4 overflow-hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent-purple" />
            <p className="text-xs text-text-secondary">
              Autonomous strategy discovery — tests {combosEstimate} combinations, learns with AI
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {settings.openrouterApiKey ? (
              <span className="text-xs flex items-center gap-1 text-accent-green"><CheckCircle className="w-3 h-3" />AI Ready</span>
            ) : (
              <span className="text-xs flex items-center gap-1 text-text-muted"><AlertTriangle className="w-3 h-3" />No AI key</span>
            )}
            {(qdrantUrl || settings.qdrantUrl) && (
              <span className="text-xs flex items-center gap-1 text-accent-blue"><Database className="w-3 h-3" />Qdrant</span>
            )}
            <button
              onClick={() => setShowConfig(v => !v)}
              className="btn-secondary flex items-center gap-1 text-xs"
            >
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showConfig ? 'Hide Config' : 'Show Config'}
            </button>
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Watchlist panel ── */}
          <div className="w-56 flex-shrink-0 trading-card flex flex-col overflow-hidden">
            <WatchlistPanel selectedForResearch={selectedSymbols} onToggle={toggleSymbol} />
          </div>

          {/* ── Center/Right: Config + Results ── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">

            {/* ── Config panel (collapsible) ── */}
            {showConfig && (
              <div className="trading-card space-y-4 flex-shrink-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                  {/* Timeframes */}
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-2">Timeframes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_TIMEFRAMES.map(tf => (
                        <button key={tf} onClick={() => toggleTimeframe(tf)}
                          className={cn('text-xs px-2.5 py-1 rounded border transition-colors',
                            selectedTimeframes.includes(tf)
                              ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue'
                              : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                          )}>
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Risk settings */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-muted mb-2">Risk Parameters</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-text-muted">SL pips</label>
                        <input type="number" className="trading-input text-xs" value={slPips} min={5} max={500}
                          onChange={e => setSlPips(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">TP pips</label>
                        <input type="number" className="trading-input text-xs" value={tpPips} min={5} max={1000}
                          onChange={e => setTpPips(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">Candles/test</label>
                        <input type="number" className="trading-input text-xs" value={candleCount} min={50} max={1000} step={50}
                          onChange={e => setCandleCount(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">AI Iterations</label>
                        <input type="number" className="trading-input text-xs" value={maxIterations} min={1} max={4}
                          onChange={e => setMaxIterations(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  {/* Vector Memory */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-accent-purple" />
                      <p className="text-xs font-medium text-text-muted">Vector Memory (Qdrant)</p>
                      <span className="text-[10px] bg-bg-tertiary text-text-muted px-1 rounded">optional</span>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">Qdrant URL</label>
                      <input className="trading-input text-xs" placeholder="https://your-cluster.cloud.qdrant.io"
                        value={qdrantUrl} onChange={e => setQdrantUrl(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">API Key</label>
                      <input type="password" className="trading-input text-xs" placeholder="Qdrant API key..."
                        value={qdrantKey} onChange={e => setQdrantKey(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">Embedding Model</label>
                      <input className="trading-input text-xs" placeholder="text-embedding-ada-002"
                        value={embeddingModel} onChange={e => setEmbeddingModel(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Strategies */}
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">Strategies to Test</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {PRESET_STRATEGIES.map(s => (
                      <button key={s.id} onClick={() => toggleStrategy(s.id)}
                        className={cn('p-2 rounded border text-left transition-colors',
                          selectedStrategies.includes(s.id)
                            ? 'bg-accent-green/5 border-accent-green/30 text-accent-green'
                            : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
                        )}>
                        <p className="text-xs font-medium">{s.label}</p>
                        <p className="text-[10px] leading-tight mt-0.5 opacity-70 line-clamp-2">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="trading-input text-xs flex-1" placeholder="Custom strategy: e.g. Buy when RSI < 40 AND price above EMA50..."
                      value={customStrategy} onChange={e => setCustomStrategy(e.target.value)} />
                    {customStrategy && (
                      <button onClick={() => setCustomStrategy('')} className="btn-secondary p-2">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected symbols chips */}
                {selectedSymbols.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-text-muted">Selected:</span>
                    {selectedSymbols.map(s => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 px-2 py-0.5 rounded-full">
                        {s}
                        <button onClick={() => toggleSymbol(s)} className="hover:text-accent-red transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Run button */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <button
                    onClick={state.running ? stopResearch : startResearch}
                    disabled={selectedSymbols.length === 0 || selectedTimeframes.length === 0 || getStrategyDescs().length === 0}
                    className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
                      state.running
                        ? 'bg-accent-red/10 border border-accent-red/30 text-accent-red hover:bg-accent-red/20'
                        : 'btn-primary'
                    )}
                  >
                    {state.running ? (
                      <><Square className="w-4 h-4" />Stop Research</>
                    ) : (
                      <><Play className="w-4 h-4" />Start AI Research</>
                    )}
                  </button>
                  <p className="text-xs text-text-muted">
                    ~{combosEstimate} combinations · {maxIterations} iteration{maxIterations > 1 ? 's' : ''}
                    {settings.openrouterApiKey ? ' · AI analysis' : ''}
                    {(qdrantUrl || settings.qdrantUrl) ? ' · Qdrant memory' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* ── Progress bar ── */}
            {(state.running || state.done) && (
              <div className="trading-card flex-shrink-0 space-y-2">
                <div className="flex items-center gap-2">
                  {state.running ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
                  ) : state.done ? (
                    <CheckCircle className="w-4 h-4 text-accent-green" />
                  ) : null}
                  <span className="text-xs text-text-primary">{state.progressMsg}</span>
                  {state.running && state.total > 0 && (
                    <span className="ml-auto text-xs text-text-muted">{state.current}/{state.total}</span>
                  )}
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all duration-300 rounded-full"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
                {state.iterationLog.length > 0 && (
                  <div className="flex gap-2">
                    {state.iterationLog.map((l, i) => (
                      <span key={i} className="text-[10px] bg-accent-purple/10 text-accent-purple border border-accent-purple/20 px-2 py-0.5 rounded-full">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Results table ── */}
            {state.results.length > 0 && (
              <div className="trading-card flex-shrink-0 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-accent-blue" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Strategy Rankings
                    <span className="ml-2 text-xs text-text-muted font-normal">({state.results.length} tested)</span>
                  </h3>
                  {state.storedToQdrant && (
                    <span className="ml-auto text-xs flex items-center gap-1 text-accent-purple">
                      <Database className="w-3 h-3" /> Saved to Qdrant
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="text-left pb-2 w-6">#</th>
                        <th className="text-left pb-2">Symbol</th>
                        <th className="text-left pb-2">TF</th>
                        <th className="text-left pb-2">Strategy</th>
                        <th className="text-right pb-2">WR%</th>
                        <th className="text-right pb-2">PF</th>
                        <th className="text-right pb-2">P&L</th>
                        <th className="text-right pb-2">DD%</th>
                        <th className="text-right pb-2">Sharpe</th>
                        <th className="text-right pb-2">Trades</th>
                        <th className="text-right pb-2">Score</th>
                        <th className="text-right pb-2">Src</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.results.slice(0, 30).map((r, i) => (
                        <tr key={i} className={cn(
                          'border-b border-border/50 hover:bg-bg-hover transition-colors',
                          i < 3 && 'bg-accent-green/3'
                        )}>
                          <td className="py-1.5 text-text-muted">{i + 1}</td>
                          <td className="py-1.5 font-medium text-text-primary">{r.symbol}</td>
                          <td className="py-1.5 text-text-muted">{r.timeframe}</td>
                          <td className="py-1.5 text-text-secondary max-w-32 truncate" title={r.strategy}>
                            {r.strategy.length > 28 ? r.strategy.slice(0, 25) + '...' : r.strategy}
                          </td>
                          <td className={cn('py-1.5 text-right', r.winRate >= 50 ? 'text-accent-green' : 'text-accent-red')}>
                            {r.winRate.toFixed(1)}%
                          </td>
                          <td className={cn('py-1.5 text-right', r.profitFactor >= 1.2 ? 'text-accent-green' : 'text-accent-red')}>
                            {r.profitFactor.toFixed(2)}
                          </td>
                          <td className={cn('py-1.5 text-right font-mono', r.netProfit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                            {r.netProfit >= 0 ? '+' : ''}{r.netProfit.toFixed(0)}
                          </td>
                          <td className={cn('py-1.5 text-right', r.maxDrawdown < 10 ? 'text-accent-green' : r.maxDrawdown < 20 ? 'text-accent-yellow' : 'text-accent-red')}>
                            {r.maxDrawdown.toFixed(1)}%
                          </td>
                          <td className={cn('py-1.5 text-right', r.sharpeRatio >= 1 ? 'text-accent-green' : 'text-text-muted')}>
                            {r.sharpeRatio.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-right text-text-muted">{r.totalTrades}</td>
                          <td className={cn('py-1.5 text-right font-bold', scoreColor(r.score))}>
                            {r.score.toFixed(0)}
                          </td>
                          <td className="py-1.5 text-right text-text-muted text-[10px]">{sourceLabel(r.source)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AI Insights ── */}
            {(state.insights || state.topPatterns.length > 0 || state.newStrategies.length > 0) && (
              <div className="trading-card flex-shrink-0 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent-yellow" />
                  <h3 className="text-sm font-semibold text-text-primary">AI Research Insights</h3>
                </div>

                {state.insights && (
                  <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
                    <p className="text-xs text-text-secondary leading-relaxed">{state.insights}</p>
                  </div>
                )}

                {state.topPatterns.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-2">Key Patterns Discovered</p>
                    <div className="space-y-1.5">
                      {state.topPatterns.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-accent-green mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-text-secondary">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {state.newStrategies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-accent-blue" />
                      AI-Generated Strategy Ideas
                    </p>
                    <div className="space-y-2">
                      {state.newStrategies.map((strat, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-bg-tertiary rounded-lg border border-border hover:border-accent-blue/30 transition-colors group">
                          <span className="text-accent-blue font-bold text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                          <p className="text-xs text-text-secondary flex-1">{strat}</p>
                          <button
                            onClick={() => { setCustomStrategy(strat); setShowConfig(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Use this strategy"
                          >
                            <Plus className="w-3.5 h-3.5 text-accent-blue" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">Click + to add a suggestion to custom strategy for next research run</p>
                  </div>
                )}

                {state.memoryStrategies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-accent-purple" />
                      Similar Strategies from Memory (Qdrant)
                    </p>
                    <div className="space-y-1">
                      {state.memoryStrategies.map((m, i) => (
                        <p key={i} className="text-xs text-text-secondary flex items-start gap-2">
                          <Eye className="w-3.5 h-3.5 text-accent-purple mt-0.5 flex-shrink-0" />
                          {m}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Activity log ── */}
            {state.log.length > 0 && (
              <details className="trading-card flex-shrink-0">
                <summary className="flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-text-primary select-none">
                  <Clock className="w-3.5 h-3.5" />
                  Activity Log ({state.log.length} events)
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                </summary>
                <div className="mt-3 max-h-48 overflow-y-auto space-y-0.5 font-mono">
                  {state.log.slice(-30).reverse().map((entry, i) => (
                    <div key={i} className={cn('text-[11px] flex gap-2',
                      entry.type === 'error' ? 'text-accent-red' :
                      entry.type === 'llm_thinking' ? 'text-accent-yellow' :
                      entry.type === 'complete' ? 'text-accent-green' :
                      'text-text-muted'
                    )}>
                      <span className="text-text-muted flex-shrink-0">{entry.time}</span>
                      <span>{entry.message}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* ── Empty state ── */}
            {!state.running && !state.done && state.results.length === 0 && (
              <div className="trading-card flex-shrink-0 text-center py-12 space-y-4">
                <Brain className="w-12 h-12 text-text-muted mx-auto opacity-30" />
                <div>
                  <p className="text-sm font-medium text-text-primary">AI Research Lab</p>
                  <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                    Select instruments from the watchlist, choose timeframes and strategies,
                    then click <strong className="text-text-primary">Start AI Research</strong>.
                    The engine will test every combination and rank results by performance score.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-xs text-text-muted max-w-xs mx-auto">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                    <span>Works without any API keys (synthetic data)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-accent-yellow" />
                    <span>Add OpenRouter key for AI insights & strategy generation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-accent-purple" />
                    <span>Add Qdrant key to store & retrieve strategy memory</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-accent-blue" />
                    <span>Multiple iterations: AI improves strategies each round</span>
                  </div>
                </div>
                <button onClick={() => setShowConfig(true)} className="btn-primary mx-auto flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Configure & Start
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
