'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import { RefreshCw, CandlestickChart, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'BTCUSDT', 'ETHUSDT', 'XAUUSD', 'USDCAD'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

// Generate realistic synthetic candles for demo
function generateDemoCandles(symbol: string, tf: string, count = 120): Candle[] {
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, AUDUSD: 0.6550,
    BTCUSDT: 68000, ETHUSDT: 3500, XAUUSD: 2320, USDCAD: 1.3600,
  };
  const base = basePrices[symbol] || 1.0;
  const volatility = base > 100 ? base * 0.004 : base * 0.0008;

  const tfMs: Record<string, number> = {
    M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400,
  };
  const tfSec = tfMs[tf] || 900;
  const now = Math.floor(Date.now() / 1000);

  const candles: Candle[] = [];
  let price = base;

  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * volatility;
    const close = Math.max(open * 0.9, open + change);
    const wickUp = Math.random() * volatility * 0.5;
    const wickDown = Math.random() * volatility * 0.5;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    candles.push({
      time: now - i * tfSec,
      open: parseFloat(open.toFixed(base > 100 ? 2 : 5)),
      high: parseFloat(high.toFixed(base > 100 ? 2 : 5)),
      low: parseFloat(low.toFixed(base > 100 ? 2 : 5)),
      close: parseFloat(close.toFixed(base > 100 ? 2 : 5)),
      volume: Math.floor(Math.random() * 2000 + 200),
    });
    price = close;
  }
  return candles;
}

// SVG Candlestick Chart Component
interface ChartTrade {
  id: string;
  type: 'BUY' | 'SELL';
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  lots: number;
  ticket: number;
}

function CandlestickSVG({ candles, width, height, trades = [] }: { candles: Candle[]; width: number; height: number; trades?: ChartTrade[] }) {
  if (!candles.length) return null;

  const padL = 10, padR = 60, padT = 20, padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const volH = 40;
  const priceH = chartH - volH - 8;

  const lows = candles.map(c => c.low);
  const highs = candles.map(c => c.high);

  // Extend price range to include trade levels
  const tradePrices = trades.flatMap(t => [
    t.openPrice, t.currentPrice,
    ...(t.sl > 0 ? [t.sl] : []),
    ...(t.tp > 0 ? [t.tp] : []),
  ]);
  const minPrice = Math.min(...lows, ...tradePrices);
  const maxPrice = Math.max(...highs, ...tradePrices);
  const priceRange = maxPrice - minPrice || 1;

  const maxVol = Math.max(...candles.map(c => c.volume));

  const candleW = Math.max(1, Math.floor(chartW / candles.length) - 1);
  const spacing = chartW / candles.length;

  const priceY = (p: number) => padT + priceH - ((p - minPrice) / priceRange) * priceH;
  const volY = (v: number) => padT + priceH + 8 + volH - (v / maxVol) * volH;
  const xPos = (i: number) => padL + i * spacing + spacing / 2;

  // Y-axis price labels
  const priceLabels = 5;
  const priceLabelArr = Array.from({ length: priceLabels }, (_, i) => {
    const p = minPrice + (priceRange * i) / (priceLabels - 1);
    return { price: p, y: priceY(p) };
  });

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const priceChange = lastCandle.close - firstCandle.open;
  const pricePct = (priceChange / firstCandle.open) * 100;
  const isUp = priceChange >= 0;

  return (
    <svg width={width} height={height} className="select-none">
      {/* Background grid */}
      {priceLabelArr.map(({ y }, i) => (
        <line key={i} x1={padL} y1={y} x2={padL + chartW} y2={y}
          stroke="#1e2d3d" strokeWidth={0.5} strokeDasharray="4 4" />
      ))}

      {/* Volume bars */}
      {candles.map((c, i) => {
        const x = xPos(i);
        const barH = ((c.volume / maxVol) * volH);
        const isGreen = c.close >= c.open;
        return (
          <rect key={`v${i}`}
            x={x - candleW / 2}
            y={volY(c.volume)}
            width={Math.max(1, candleW)}
            height={barH}
            fill={isGreen ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}
          />
        );
      })}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = xPos(i);
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#10b981' : '#ef4444';
        const bodyTop = priceY(Math.max(c.open, c.close));
        const bodyBot = priceY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);

        return (
          <g key={`c${i}`}>
            {/* Wick */}
            <line x1={x} y1={priceY(c.high)} x2={x} y2={priceY(c.low)}
              stroke={color} strokeWidth={1} />
            {/* Body */}
            <rect x={x - Math.max(1, candleW / 2)}
              y={bodyTop} width={Math.max(1, candleW)}
              height={bodyH}
              fill={isGreen ? '#10b981' : '#ef4444'}
              opacity={0.85}
            />
          </g>
        );
      })}

      {/* Current price line */}
      <line
        x1={padL} y1={priceY(lastCandle.close)}
        x2={padL + chartW} y2={priceY(lastCandle.close)}
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth={1}
        strokeDasharray="4 2"
        opacity={0.7}
      />

      {/* Price labels (Y axis) */}
      {priceLabelArr.map(({ price, y }, i) => (
        <text key={i} x={padL + chartW + 4} y={y + 4}
          fill="#475569" fontSize={10} textAnchor="start">
          {price > 100 ? price.toFixed(2) : price.toFixed(5)}
        </text>
      ))}

      {/* Current price label */}
      <rect x={padL + chartW + 2} y={priceY(lastCandle.close) - 8}
        width={56} height={16} fill={isUp ? '#10b981' : '#ef4444'} rx={3} />
      <text x={padL + chartW + 30} y={priceY(lastCandle.close) + 4}
        fill="white" fontSize={10} textAnchor="middle" fontWeight="bold">
        {lastCandle.close > 100 ? lastCandle.close.toFixed(2) : lastCandle.close.toFixed(5)}
      </text>

      {/* Time labels (X axis) - show ~6 */}
      {candles.filter((_, i) => i % Math.floor(candles.length / 6) === 0).map((c, idx) => {
        const realIdx = idx * Math.floor(candles.length / 6);
        const x = xPos(realIdx);
        const d = new Date(c.time * 1000);
        const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return (
          <text key={idx} x={x} y={padT + chartH + 14}
            fill="#475569" fontSize={10} textAnchor="middle">
            {label}
          </text>
        );
      })}

      {/* P&L badge */}
      <text x={padL + 8} y={padT + 16}
        fill={isUp ? '#10b981' : '#ef4444'}
        fontSize={12} fontWeight="bold">
        {isUp ? '+' : ''}{priceChange.toFixed(lastCandle.close > 100 ? 2 : 5)} ({pricePct >= 0 ? '+' : ''}{pricePct.toFixed(2)}%)
      </text>
    </svg>
  );
}

export default function ChartPage() {
  const { settings, mt5Connected } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 460 });
  const [symbol, setSymbol] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('M15');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [tooltip, setTooltip] = useState<Candle | null>(null);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      if (settings.mt5BridgeEnabled && mt5Connected) {
        const res = await fetch(`/api/mt5?action=candles&symbol=${symbol}&timeframe=${timeframe}&count=120`);
        const data = await res.json();
        if (data.candles?.length) {
          setCandles(data.candles);
          setLastUpdate(new Date().toLocaleTimeString());
          return;
        }
      }
      // Demo candles
      setCandles(generateDemoCandles(symbol, timeframe));
      setLastUpdate(new Date().toLocaleTimeString() + ' (demo)');
    } catch {
      setCandles(generateDemoCandles(symbol, timeframe));
      setLastUpdate(new Date().toLocaleTimeString() + ' (demo)');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, settings.mt5BridgeEnabled, mt5Connected]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDims({ width: Math.floor(width), height: Math.max(320, Math.floor(width * 0.5)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initial load & on symbol/tf change
  useEffect(() => { fetchCandles(); }, [fetchCandles]);

  // Live polling
  useEffect(() => {
    if (!isLive) return;
    const tfMs: Record<string, number> = { M1: 10000, M5: 20000, M15: 30000, M30: 60000, H1: 120000, H4: 300000, D1: 600000 };
    const interval = setInterval(fetchCandles, tfMs[timeframe] || 30000);
    return () => clearInterval(interval);
  }, [isLive, fetchCandles, timeframe]);

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const priceUp = lastCandle && prevCandle ? lastCandle.close >= prevCandle.close : true;
  const displayCandle = tooltip || lastCandle;

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Price Chart" />
      <div className="p-4 space-y-4">

        {/* Controls */}
        <div className="trading-card">
          <div className="flex flex-wrap items-center gap-3">
            {/* Symbol */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Symbol</label>
              <select className="trading-input w-32" value={symbol} onChange={e => setSymbol(e.target.value)}>
                {SYMBOLS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Timeframe */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Timeframe</label>
              <div className="flex gap-1">
                {TIMEFRAMES.map(tf => (
                  <button key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors border',
                      timeframe === tf
                        ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                        : 'text-text-muted hover:text-text-primary border-transparent hover:border-border'
                    )}
                  >{tf}</button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* Live toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                isLive
                  ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                  : 'text-text-muted border-border hover:text-text-primary'
              )}
            >
              <Activity className={cn('w-3 h-3', isLive && 'animate-pulse')} />
              {isLive ? 'Live' : 'Live Off'}
            </button>

            {/* Refresh */}
            <button
              onClick={fetchCandles}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* OHLCV info bar */}
          {displayCandle && (
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs font-mono">
              <span className="font-bold text-text-primary">{symbol}</span>
              <span className="text-text-muted">{timeframe}</span>
              <span>O: <span className="text-text-secondary">{displayCandle.open > 100 ? displayCandle.open.toFixed(2) : displayCandle.open.toFixed(5)}</span></span>
              <span>H: <span className="text-accent-green">{displayCandle.high > 100 ? displayCandle.high.toFixed(2) : displayCandle.high.toFixed(5)}</span></span>
              <span>L: <span className="text-accent-red">{displayCandle.low > 100 ? displayCandle.low.toFixed(2) : displayCandle.low.toFixed(5)}</span></span>
              <span>C: <span className={displayCandle.close >= displayCandle.open ? 'text-accent-green font-bold' : 'text-accent-red font-bold'}>
                {displayCandle.close > 100 ? displayCandle.close.toFixed(2) : displayCandle.close.toFixed(5)}
              </span></span>
              <span className="text-text-muted">Vol: {displayCandle.volume?.toLocaleString()}</span>
              <span className="ml-auto flex items-center gap-1 text-text-muted">
                {priceUp ? <TrendingUp className="w-3 h-3 text-accent-green" /> : <TrendingDown className="w-3 h-3 text-accent-red" />}
                Updated: {lastUpdate}
              </span>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="trading-card p-0 overflow-hidden" ref={containerRef}>
          {loading && !candles.length ? (
            <div className="flex items-center justify-center h-64 text-text-muted text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading candles...
            </div>
          ) : candles.length > 0 ? (
            <div className="relative">
              <CandlestickSVG candles={candles} width={dims.width} height={dims.height} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted text-sm gap-2">
              <CandlestickChart className="w-8 h-8 opacity-30" />
              <p>No candle data</p>
              <button onClick={fetchCandles} className="btn-secondary text-xs">Retry</button>
            </div>
          )}
        </div>

        {/* Info: broker connection */}
        {!mt5Connected && (
          <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg text-xs text-text-secondary">
            <strong className="text-accent-yellow">Demo mode</strong> — showing simulated candles.
            Connect MT5 bridge in{' '}
            <a href="/settings" className="text-accent-blue hover:underline">Settings</a>{' '}
            to see real market data.
          </div>
        )}
      </div>
    </main>
  );
}
