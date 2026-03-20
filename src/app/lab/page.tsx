'use client';
import { useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import {
  FlaskConical, Play, RefreshCw, TrendingUp, TrendingDown,
  Target, Award, AlertTriangle, CheckCircle, ChevronRight,
  BarChart2, Lightbulb, Zap, Clock, Info
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Preset strategies ────────────────────────────────────────────────────────
const PRESETS = [
  {
    name: 'RSI Reversal',
    icon: '📈',
    desc: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)',
    strategy: 'Buy when RSI goes below 30 (oversold), sell when RSI goes above 70 (overbought). Use 14-period RSI.',
  },
  {
    name: 'MA Crossover',
    icon: '📊',
    desc: 'Buy when fast MA crosses above slow MA (golden cross)',
    strategy: 'Buy when 9-period EMA crosses above 21-period EMA (golden cross). Sell on death cross (9 EMA below 21 EMA).',
  },
  {
    name: 'Trend Follow',
    icon: '🚀',
    desc: 'Buy after 3 green candles in a row, sell after 3 red candles',
    strategy: 'Buy when 3 consecutive bullish candles (close > open). Sell when 3 consecutive bearish candles.',
  },
  {
    name: 'Breakout',
    icon: '💥',
    desc: 'Buy breakout above 20-candle high, sell breakdown below low',
    strategy: 'Buy when price breaks above the highest high of the last 20 candles. Sell when price breaks below the lowest low of the last 20 candles.',
  },
  {
    name: 'Momentum',
    icon: '⚡',
    desc: 'Follow strong price moves with volume confirmation',
    strategy: 'Buy when price momentum is strongly bullish — close significantly above open with above-average volume. Sell on momentum shift.',
  },
  {
    name: 'Mean Reversion',
    icon: '🔄',
    desc: 'Bet on price returning to average after extreme moves',
    strategy: 'Buy when price is far below its 20-period moving average (oversold deviation). Sell when price is far above its 20-period MA.',
  },
];

const PAIRS = [
  { symbol: 'EURUSD', label: 'EUR/USD', category: 'Forex' },
  { symbol: 'GBPUSD', label: 'GBP/USD', category: 'Forex' },
  { symbol: 'USDJPY', label: 'USD/JPY', category: 'Forex' },
  { symbol: 'AUDUSD', label: 'AUD/USD', category: 'Forex' },
  { symbol: 'USDCAD', label: 'USD/CAD', category: 'Forex' },
  { symbol: 'BTCUSDT', label: 'BTC/USDT', category: 'Crypto' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT', category: 'Crypto' },
  { symbol: 'XAUUSD', label: 'XAU/USD (Gold)', category: 'Commodity' },
];

const PERIODS = [
  { label: '1 week', tf: 'M15', count: 672 },
  { label: '1 month', tf: 'H1', count: 720 },
  { label: '3 months', tf: 'H1', count: 2160 },
  { label: '6 months', tf: 'H4', count: 1080 },
  { label: '1 year', tf: 'D1', count: 365 },
];

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

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, symbol, period, strategy, dataSource }: {
  result: BacktestResult;
  symbol: string;
  period: string;
  strategy: string;
  dataSource: string;
}) {
  const isProfit = result.netProfit >= 0;
  const goodWinRate = result.winRate >= 50;
  const goodPF = result.profitFactor >= 1.2;

  // Build daily P&L from trades
  const dailyMap: Record<string, number> = {};
  result.trades.forEach(t => {
    const day = new Date(t.openTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyMap[day] = (dailyMap[day] || 0) + t.profit;
  });
  const dailyPnL = Object.entries(dailyMap).slice(-20).map(([day, profit]) => ({ day, profit: parseFloat(profit.toFixed(2)) }));

  const verdict = isProfit && goodWinRate && goodPF
    ? { text: 'Profitable Strategy', color: 'green', icon: CheckCircle }
    : isProfit
    ? { text: 'Slightly Profitable', color: 'yellow', icon: TrendingUp }
    : { text: 'Needs Improvement', color: 'red', icon: AlertTriangle };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Verdict banner */}
      <div className={cn(
        'rounded-xl p-4 border flex items-center gap-3',
        verdict.color === 'green' ? 'bg-accent-green/5 border-accent-green/20' :
        verdict.color === 'yellow' ? 'bg-accent-yellow/5 border-accent-yellow/20' :
        'bg-accent-red/5 border-accent-red/20'
      )}>
        <verdict.icon className={cn('w-6 h-6 flex-shrink-0',
          verdict.color === 'green' ? 'text-accent-green' :
          verdict.color === 'yellow' ? 'text-accent-yellow' : 'text-accent-red'
        )} />
        <div>
          <p className={cn('font-semibold', verdict.color === 'green' ? 'text-accent-green' : verdict.color === 'yellow' ? 'text-accent-yellow' : 'text-accent-red')}>
            {verdict.text}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {symbol} · {period} · {result.totalTrades} trades · {dataSource === 'synthetic' ? '⚠ Synthetic data' : '✓ Real data'}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className={cn('text-2xl font-bold font-mono', isProfit ? 'text-accent-green' : 'text-accent-red')}>
            {isProfit ? '+' : ''}${result.netProfit.toFixed(2)}
          </p>
          <p className="text-xs text-text-muted">on $10,000</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Win Rate', value: `${result.winRate.toFixed(1)}%`, good: goodWinRate },
          { label: 'Profit Factor', value: result.profitFactor.toFixed(2), good: goodPF },
          { label: 'Max Drawdown', value: `-${result.maxDrawdown.toFixed(1)}%`, good: result.maxDrawdown < 15 },
          { label: 'Sharpe Ratio', value: result.sharpeRatio.toFixed(2), good: result.sharpeRatio >= 1 },
          { label: 'Avg Win', value: `$${result.avgWin.toFixed(2)}`, good: true },
          { label: 'Avg Loss', value: `-$${result.avgLoss.toFixed(2)}`, good: result.avgWin > result.avgLoss },
        ].map(m => (
          <div key={m.label} className="trading-card py-3 text-center">
            <p className="text-[10px] text-text-muted mb-1">{m.label}</p>
            <p className={cn('text-base font-bold font-mono', m.good ? 'text-accent-green' : 'text-accent-red')}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity curve */}
        <div className="trading-card">
          <h4 className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">Equity Curve (account growth)</h4>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.equityCurve} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Account']}
                />
                <ReferenceLine y={10000} stroke="#475569" strokeDasharray="4 2" strokeWidth={1} />
                <Line dataKey="equity" stroke={isProfit ? '#10b981' : '#ef4444'}
                  strokeWidth={2} dot={false} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily P&L */}
        <div className="trading-card">
          <h4 className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">Daily P&L</h4>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPnL} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false}
                  interval={Math.floor(dailyPnL.length / 5)} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
                />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                  {dailyPnL.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI plain-language summary */}
      <div className="trading-card bg-accent-purple/3 border-accent-purple/20">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-accent-purple flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary leading-relaxed space-y-2">
            <p className="font-semibold text-text-primary">AI Summary</p>
            <p>
              Strategy <strong className="text-text-primary">&quot;{strategy.slice(0, 60)}{strategy.length > 60 ? '...' : ''}&quot;</strong> was tested on{' '}
              <strong className="text-text-primary">{symbol}</strong> over the last <strong className="text-text-primary">{period}</strong>.
            </p>
            <p>
              It opened <strong className="text-text-primary">{result.totalTrades} trades</strong>, of which{' '}
              <span className="text-accent-green font-semibold">{result.wins} won</span> and{' '}
              <span className="text-accent-red font-semibold">{result.losses} lost</span>{' '}
              ({result.winRate.toFixed(1)}% win rate).
              {goodWinRate ? ' Win rate is above 50% — that\'s good.' : ' Win rate is below 50% — needs improvement.'}
            </p>
            <p>
              Profit factor is <strong className="text-text-primary">{result.profitFactor.toFixed(2)}</strong>{' '}
              {goodPF ? '(> 1.2 — wins outweigh losses)' : '(< 1.2 — losses are too large relative to wins)'}.{' '}
              Maximum drawdown was <span className="text-accent-red">{result.maxDrawdown.toFixed(1)}%</span>{' '}
              {result.maxDrawdown < 10 ? '— acceptable risk level.' : result.maxDrawdown < 20 ? '— moderate risk.' : '— high risk, consider tighter stop losses.'}
            </p>
            {!isProfit && (
              <p className="text-accent-yellow">
                💡 Suggestions: try adjusting SL/TP ratio, or combine with a trend filter to avoid false signals.
              </p>
            )}
            {dataSource === 'synthetic' && (
              <p className="text-accent-yellow text-xs">
                ⚠ These results use synthetic (simulated) data. For accurate backtesting, connect a real data source in Settings.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LabPage() {
  const { settings } = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [symbol, setSymbol] = useState('EURUSD');
  const [periodIdx, setPeriodIdx] = useState(1); // 1 month default
  const [customStrategy, setCustomStrategy] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [slPips, setSlPips] = useState(50);
  const [tpPips, setTpPips] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [dataSource, setDataSource] = useState('');
  const [error, setError] = useState('');

  const strategyText = selectedPreset !== null ? PRESETS[selectedPreset].strategy : customStrategy;
  const period = PERIODS[periodIdx];

  const runBacktest = useCallback(async () => {
    if (!strategyText.trim()) return;
    setRunning(true);
    setError('');
    setResult(null);

    try {
      // 1. Fetch candles
      const candleRes = await fetch(`/api/market?symbol=${symbol}&timeframe=${period.tf}&count=${period.count}`);
      const candleData = await candleRes.json();
      setDataSource(candleData.source || 'synthetic');

      if (!candleData.candles?.length) throw new Error('Could not fetch market data');

      // 2. Run backtest
      const btRes = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backtest',
          candles: candleData.candles,
          strategy: strategyText,
          slPips,
          tpPips,
          initialBalance: 10000,
          lotSize: 0.01,
        }),
      });
      const btData = await btRes.json();
      if (btData.error) throw new Error(btData.error);

      setResult(btData);
      setStep(3);
    } catch (e) {
      setError(String(e));
    }
    setRunning(false);
  }, [strategyText, symbol, period, slPips, tpPips]);

  const hasApiKey = !!settings.openrouterApiKey;

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Strategy Lab" />
      <div className="p-4 max-w-4xl mx-auto space-y-4">

        {/* No-frills intro */}
        <div className="trading-card flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-accent-purple flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Test any strategy in seconds</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Choose a pair → pick a strategy → see AI-powered backtest results. No coding required.
            </p>
          </div>
        </div>

        {/* ── STEP 1: Pair + Period ── */}
        <div className={cn('trading-card space-y-4', step > 1 && 'border-accent-green/20')}>
          <div className="flex items-center gap-2">
            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
              step > 1 ? 'bg-accent-green text-white' : 'bg-accent-blue text-white'
            )}>
              {step > 1 ? '✓' : '1'}
            </span>
            <h3 className="text-sm font-semibold text-text-primary">Choose pair & period</h3>
            {step > 1 && (
              <button onClick={() => setStep(1)} className="ml-auto text-xs text-accent-blue hover:underline">Change</button>
            )}
          </div>

          {(step === 1) && (
            <div className="space-y-4">
              {/* Pairs grouped */}
              <div>
                <p className="text-xs text-text-muted mb-2">Trading pair</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAIRS.map(p => (
                    <button key={p.symbol}
                      onClick={() => setSymbol(p.symbol)}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-sm font-medium transition-colors text-left',
                        symbol === p.symbol
                          ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue'
                          : 'bg-bg-tertiary border-border text-text-secondary hover:border-border hover:text-text-primary'
                      )}
                    >
                      <span className="font-semibold">{p.label}</span>
                      <span className="text-[10px] text-text-muted block">{p.category}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Period */}
              <div>
                <p className="text-xs text-text-muted mb-2">Test period</p>
                <div className="flex flex-wrap gap-2">
                  {PERIODS.map((p, i) => (
                    <button key={i}
                      onClick={() => setPeriodIdx(i)}
                      className={cn(
                        'py-1.5 px-4 rounded-lg border text-sm font-medium transition-colors',
                        periodIdx === i
                          ? 'bg-accent-blue/10 border-accent-blue/40 text-accent-blue'
                          : 'bg-bg-tertiary border-border text-text-secondary hover:text-text-primary'
                      )}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* SL / TP */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Stop Loss (pips)</label>
                  <input type="number" className="trading-input w-24" value={slPips} min={5} step={5}
                    onChange={e => setSlPips(+e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Take Profit (pips)</label>
                  <input type="number" className="trading-input w-24" value={tpPips} min={5} step={5}
                    onChange={e => setTpPips(+e.target.value)} />
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent-blue text-white text-sm font-semibold hover:bg-accent-blue/80 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step > 1 && (
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{PAIRS.find(p => p.symbol === symbol)?.label}</span>
              {' · '}{PERIODS[periodIdx].label}
              {' · '} SL {slPips}p / TP {tpPips}p
            </p>
          )}
        </div>

        {/* ── STEP 2: Strategy ── */}
        {step >= 2 && (
          <div className={cn('trading-card space-y-4', step > 2 && 'border-accent-green/20')}>
            <div className="flex items-center gap-2">
              <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                step > 2 ? 'bg-accent-green text-white' : 'bg-accent-blue text-white'
              )}>
                {step > 2 ? '✓' : '2'}
              </span>
              <h3 className="text-sm font-semibold text-text-primary">Choose strategy</h3>
              {step > 2 && (
                <button onClick={() => setStep(2)} className="ml-auto text-xs text-accent-blue hover:underline">Change</button>
              )}
            </div>

            {step === 2 && (
              <div className="space-y-4">
                {/* Presets */}
                <div>
                  <p className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3 h-3" /> Quick presets
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESETS.map((p, i) => (
                      <button key={i}
                        onClick={() => { setSelectedPreset(i); setCustomStrategy(''); }}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-colors',
                          selectedPreset === i
                            ? 'bg-accent-blue/10 border-accent-blue/40'
                            : 'bg-bg-tertiary border-border hover:border-border hover:bg-bg-hover'
                        )}
                      >
                        <span className="text-lg">{p.icon}</span>
                        <p className={cn('text-xs font-semibold mt-1', selectedPreset === i ? 'text-accent-blue' : 'text-text-primary')}>
                          {p.name}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom */}
                <div>
                  <p className="text-xs text-text-muted mb-2">Or describe your own strategy in plain language:</p>
                  <textarea
                    className="trading-input resize-none text-sm"
                    rows={3}
                    placeholder="e.g. Buy when price breaks above the last 3 candles' high. Close when profit reaches 2x the risk."
                    value={customStrategy}
                    onChange={e => { setCustomStrategy(e.target.value); setSelectedPreset(null); }}
                  />
                </div>

                <button
                  onClick={runBacktest}
                  disabled={!strategyText.trim() || running}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent-green text-white text-sm font-bold hover:bg-accent-green/80 disabled:opacity-40 transition-colors"
                >
                  {running
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running backtest...</>
                    : <><Play className="w-4 h-4" /> Run Backtest</>
                  }
                </button>
              </div>
            )}

            {step > 2 && (
              <p className="text-sm text-text-secondary">
                {selectedPreset !== null ? PRESETS[selectedPreset].name : customStrategy.slice(0, 60) + (customStrategy.length > 60 ? '...' : '')}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-accent-red/5 border border-accent-red/20 rounded-lg text-sm text-accent-red flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Running indicator */}
        {running && (
          <div className="trading-card flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-accent-blue" />
            <div>
              <p className="text-sm font-medium text-text-primary">Fetching market data & running backtest...</p>
              <p className="text-xs text-text-muted">Testing {strategyText.slice(0, 50)}... on {PAIRS.find(p => p.symbol === symbol)?.label}</p>
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ── */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-accent-green text-white flex-shrink-0">3</span>
              <h3 className="text-sm font-semibold text-text-primary">Results</h3>
            </div>
            <ResultCard
              result={result}
              symbol={PAIRS.find(p => p.symbol === symbol)?.label || symbol}
              period={PERIODS[periodIdx].label}
              strategy={strategyText}
              dataSource={dataSource}
            />

            {/* Run again / try different */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setStep(1); setResult(null); setSelectedPreset(null); setCustomStrategy(''); }}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Start over
              </button>
              <button
                onClick={() => { setStep(2); setResult(null); }}
                className="btn-secondary flex items-center gap-2"
              >
                Try different strategy
              </button>
              <button
                onClick={() => { setPeriodIdx(p => (p + 1) % PERIODS.length); setResult(null); setStep(2); }}
                className="btn-secondary flex items-center gap-2"
              >
                <Clock className="w-4 h-4" /> Try different period
              </button>
            </div>
          </div>
        )}

        {/* Data source info */}
        <div className="p-3 bg-bg-secondary border border-border rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary space-y-1">
              <p>
                <strong className="text-text-primary">Data source: </strong>
                {dataSource === 'twelve_data' ? '✅ Twelve Data (real)' :
                 dataSource === 'alpha_vantage' ? '✅ Alpha Vantage (real)' :
                 dataSource ? '⚠ Synthetic (simulated)' :
                 'Synthetic until you run a test'}
              </p>
              <p>
                For real historical data, add a free API key in{' '}
                <a href="/settings" className="text-accent-blue hover:underline">Settings → Real Market Data</a>
                {' '}(Twelve Data: 800 req/day free).
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
