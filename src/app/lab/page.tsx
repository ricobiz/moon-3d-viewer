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

// ─── Backtest price chart with trade markers ─────────────────────────────────
interface BtChartTrade {
  openTime: number; closeTime: number;
  type: string; openPrice: number; closePrice: number; profit: number;
}

function BacktestChart({ candles, trades }: { candles: { time: number; open: number; high: number; low: number; close: number }[]; trades: BtChartTrade[] }) {
  if (!candles.length) return null;

  // Show at most MAX_DISPLAY_CANDLES candles for readability
  const MAX_DISPLAY_CANDLES = 200;
  const shown = candles.length > MAX_DISPLAY_CANDLES ? candles.slice(candles.length - MAX_DISPLAY_CANDLES) : candles;
  const w = 780, h = 240;
  const padL = 6, padR = 56, padT = 16, padB = 28;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  // Price range including all trade levels
  const tradePrices = trades.flatMap(t => [t.openPrice, t.closePrice]);
  const minP = Math.min(...shown.map(c => c.low), ...tradePrices);
  const maxP = Math.max(...shown.map(c => c.high), ...tradePrices);
  const range = maxP - minP || 1;

  const py = (p: number) => padT + chartH - ((p - minP) / range) * chartH;
  const spacing = chartW / shown.length;
  const candleW = Math.max(1, Math.floor(spacing) - 1);
  const cx = (i: number) => padL + i * spacing + spacing / 2;

  // Map openTime → candle index for trade markers
  const timeToIdx: Record<number, number> = {};
  shown.forEach((c, i) => { timeToIdx[c.time] = i; });

  const isLarge = shown[0]?.close > 100;
  const fmt = (v: number) => isLarge ? v.toFixed(2) : v.toFixed(5);

  // Price grid labels
  const gridLines = 4;
  const gridArr = Array.from({ length: gridLines + 1 }, (_, i) => {
    const p = minP + (range * i) / gridLines;
    return { p, y: py(p) };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: h }}>
      {/* Grid */}
      {gridArr.map(({ y }, i) => (
        <line key={i} x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#1e2d3d" strokeWidth={0.5} strokeDasharray="4 4" />
      ))}

      {/* Candles */}
      {shown.map((c, i) => {
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#10b981' : '#ef4444';
        const bodyTop = py(Math.max(c.open, c.close));
        const bodyBot = py(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={cx(i)} y1={py(c.high)} x2={cx(i)} y2={py(c.low)} stroke={color} strokeWidth={1} />
            <rect x={cx(i) - Math.max(1, candleW / 2)} y={bodyTop}
              width={Math.max(1, candleW)} height={Math.max(1, bodyBot - bodyTop)}
              fill={color} opacity={0.85} />
          </g>
        );
      })}

      {/* Trade markers */}
      {trades.map((t, ti) => {
        const openIdx = timeToIdx[t.openTime];
        const closeIdx = timeToIdx[t.closeTime];
        if (openIdx === undefined && closeIdx === undefined) return null;

        const oi = openIdx ?? 0;
        const ci = closeIdx ?? shown.length - 1;
        const isBuy = t.type === 'BUY';
        const isWin = t.profit > 0;
        const entryY = py(t.openPrice);
        const exitY = py(t.closePrice);
        const entryX = cx(oi);
        const exitX = cx(ci);

        return (
          <g key={ti}>
            {/* Line from entry to exit */}
            <line x1={entryX} y1={entryY} x2={exitX} y2={exitY}
              stroke={isWin ? '#10b981' : '#ef4444'} strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
            {/* Entry arrow */}
            {isBuy
              ? <polygon points={`${entryX},${entryY - 4} ${entryX - 4},${entryY + 4} ${entryX + 4},${entryY + 4}`}
                  fill="#3b82f6" opacity={0.9} />
              : <polygon points={`${entryX},${entryY + 4} ${entryX - 4},${entryY - 4} ${entryX + 4},${entryY - 4}`}
                  fill="#f59e0b" opacity={0.9} />
            }
            {/* Exit dot */}
            <circle cx={exitX} cy={exitY} r={3}
              fill={isWin ? '#10b981' : '#ef4444'} stroke="#141d2b" strokeWidth={1} />
          </g>
        );
      })}

      {/* Y-axis price labels */}
      {gridArr.map(({ p, y }, i) => (
        <text key={i} x={padL + chartW + 4} y={y + 4} fill="#475569" fontSize={9} textAnchor="start">
          {fmt(p)}
        </text>
      ))}

      {/* Legend */}
      <g>
        <polygon points="6,10 2,18 10,18" fill="#3b82f6" opacity={0.9} />
        <text x={14} y={18} fill="#94a3b8" fontSize={9}>BUY entry</text>
        <polygon points="80,18 76,10 84,10" fill="#f59e0b" opacity={0.9} />
        <text x={88} y={18} fill="#94a3b8" fontSize={9}>SELL entry</text>
        <circle cx={162} cy={14} r={3} fill="#10b981" />
        <text x={168} y={18} fill="#94a3b8" fontSize={9}>Win exit</text>
        <circle cx={220} cy={14} r={3} fill="#ef4444" />
        <text x={226} y={18} fill="#94a3b8" fontSize={9}>Loss exit</text>
      </g>
    </svg>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, symbol, period, strategy, dataSource, candleCount, timeframe, candles }: {
  result: BacktestResult;
  symbol: string;
  period: string;
  strategy: string;
  dataSource: string;
  candleCount: number;
  timeframe: string;
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
}) {
  const [showAllTrades, setShowAllTrades] = useState(false);
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

  const isLarge = (candles[0]?.close || result.trades[0]?.openPrice || 1) > 100;
  const fmt = (v: number) => isLarge ? v.toFixed(2) : v.toFixed(5);
  const displayTrades = showAllTrades ? result.trades : result.trades.slice(-20);

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
            {symbol} · {period} ({timeframe}) · {candleCount} candles · {result.totalTrades} trades
            {' · '}{dataSource === 'synthetic' ? '⚠ Synthetic data' : `✓ Real data (${dataSource === 'twelve_data' ? 'Twelve Data' : 'Alpha Vantage'})`}
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

      {/* Price chart with trade markers */}
      {candles.length > 0 && result.trades.length > 0 && (
        <div className="trading-card">
          <h4 className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
            Price Chart with Trade Entries &amp; Exits
            <span className="ml-2 text-text-muted normal-case font-normal">
              (▲ BUY · ▼ SELL · ● exit)
            </span>
          </h4>
          <div className="overflow-x-auto">
            <BacktestChart candles={candles} trades={result.trades} />
          </div>
        </div>
      )}

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

      {/* Individual trade log */}
      {result.trades.length > 0 && (
        <div className="trading-card">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Trade Log <span className="ml-1 font-normal normal-case text-text-muted">({result.totalTrades} trades)</span>
            </h4>
            {result.trades.length > 20 && (
              <button
                onClick={() => setShowAllTrades(v => !v)}
                className="text-xs text-accent-blue hover:underline"
              >
                {showAllTrades ? 'Show last 20' : `Show all ${result.totalTrades}`}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full trade-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Open Time</th>
                  <th>Entry</th>
                  <th>Close Time</th>
                  <th>Exit</th>
                  <th>P&L</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {displayTrades.map((t, i) => {
                  const openDate = new Date(t.openTime * 1000);
                  const closeDate = new Date(t.closeTime * 1000);
                  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const isWin = t.profit > 0;
                  return (
                    <tr key={i} className="hover:bg-bg-hover/50 transition-colors">
                      <td className="font-mono text-text-muted text-xs">{result.trades.length - result.trades.indexOf(t)}</td>
                      <td>
                        <span className={cn(
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold',
                          t.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                        )}>
                          {t.type === 'BUY' ? '▲' : '▼'} {t.type}
                        </span>
                      </td>
                      <td className="text-text-muted text-xs whitespace-nowrap">{fmtDate(openDate)}</td>
                      <td className="font-mono text-text-secondary text-xs">{fmt(t.openPrice)}</td>
                      <td className="text-text-muted text-xs whitespace-nowrap">{fmtDate(closeDate)}</td>
                      <td className="font-mono text-text-secondary text-xs">{fmt(t.closePrice)}</td>
                      <td className={cn('font-mono font-bold text-sm', isWin ? 'text-accent-green' : 'text-accent-red')}>
                        {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                      </td>
                      <td>
                        <span className={cn(
                          'text-xs font-medium px-1.5 py-0.5 rounded',
                          isWin ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                        )}>
                          {isWin ? 'Win' : 'Loss'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                ⚠ These results use synthetic (simulated) data. For accurate backtesting, add a Twelve Data API key in Settings.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface BtCandle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

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
  const [btCandles, setBtCandles] = useState<BtCandle[]>([]);
  const [dataSource, setDataSource] = useState('');
  const [candleCount, setCandleCount] = useState(0);
  const [error, setError] = useState('');

  const strategyText = selectedPreset !== null ? PRESETS[selectedPreset].strategy : customStrategy;
  const period = PERIODS[periodIdx];

  const runBacktest = useCallback(async () => {
    if (!strategyText.trim()) return;
    setRunning(true);
    setError('');
    setResult(null);
    setBtCandles([]);

    try {
      // 1. Fetch candles — pass user's API keys so real data is used when available
      const params = new URLSearchParams({
        symbol,
        timeframe: period.tf,
        count: String(period.count),
      });
      if (settings.twelveDataKey) params.set('twelveKey', settings.twelveDataKey);
      if (settings.alphaVantageKey) params.set('avKey', settings.alphaVantageKey);

      const candleRes = await fetch(`/api/market?${params}`);
      const candleData = await candleRes.json();
      setDataSource(candleData.source || 'synthetic');
      setCandleCount(candleData.candles?.length || 0);

      if (!candleData.candles?.length) throw new Error('Could not fetch market data');

      setBtCandles(candleData.candles);

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
  }, [strategyText, symbol, period, slPips, tpPips, settings.twelveDataKey, settings.alphaVantageKey]);

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
              candleCount={candleCount}
              timeframe={period.tf}
              candles={btCandles}
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
                {dataSource === 'twelve_data' ? `✅ Twelve Data (real) — ${candleCount} candles` :
                 dataSource === 'alpha_vantage' ? `✅ Alpha Vantage (real) — ${candleCount} candles` :
                 dataSource === 'synthetic' ? `⚠ Synthetic (simulated) — ${candleCount} candles` :
                 'Synthetic data until you run a test'}
              </p>
              {!settings.twelveDataKey && (
                <p>
                  For real historical data, add a free Twelve Data API key in{' '}
                  <a href="/settings" className="text-accent-blue hover:underline">Settings → Real Market Data</a>
                  {' '}(800 req/day free · <a href="https://twelvedata.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">get key</a>).
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
