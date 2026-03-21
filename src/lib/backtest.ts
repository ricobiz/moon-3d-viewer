/**
 * Shared Backtest Engine
 * ======================
 * Imported by both /api/sandbox and /api/research.
 * Parses natural-language strategy descriptions into signal functions
 * and runs backtests against OHLCV candle arrays.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestTrade {
  openTime: number;
  closeTime: number;
  type: 'BUY' | 'SELL';
  openPrice: number;
  closePrice: number;
  profit: number;
  bars: number;
}

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  equityCurve: Array<{ time: number; equity: number; balance: number }>;
  trades: BacktestTrade[];
}

// Threshold above which a price is considered "large" (crypto/commodities/indices vs forex)
// Forex prices are < 10 (e.g., EUR/USD = 1.085), larger instruments are > 10
const LARGE_PRICE_THRESHOLD = 10;

/** Calculates EMA over the last `period` candles */
function ema(candles: Candle[], period: number): number {
  if (candles.length < period) return candles[candles.length - 1]?.close ?? 0;
  const k = 2 / (period + 1);
  let e = candles[candles.length - period].close;
  for (let i = candles.length - period + 1; i < candles.length; i++) {
    e = candles[i].close * k + e * (1 - k);
  }
  return e;
}

/** Calculates RSI over the last `period` candles */
function rsi(candles: Candle[], period = 14): number {
  const slice = candles.slice(-(period + 1));
  if (slice.length < 2) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i].close - slice[i - 1].close;
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Calculates standard deviation */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
}

type SignalFn = (candles: Candle[]) => 1 | -1 | 0;

/**
 * Parses a natural-language strategy description into a signal function.
 * Returns 1 (BUY), -1 (SELL), or 0 (HOLD) for a given candle window.
 *
 * Supported strategies:
 *  - RSI (oversold/overbought, configurable levels)
 *  - Moving average crossover (EMA/SMA, configurable periods)
 *  - MACD crossover
 *  - Bollinger Band breakout/reversal
 *  - Breakout above resistance / below support
 *  - Trend following (3-candle confirmation)
 *  - Mean reversion (Z-score)
 *  - Candlestick patterns (doji, hammer, engulfing)
 *  - Volume-weighted momentum
 *  - Combined RSI + MA (hybrid)
 */
export function parseStrategy(strategyDesc: string): SignalFn {
  const desc = strategyDesc.toLowerCase();

  return (candles: Candle[]): 1 | -1 | 0 => {
    if (candles.length < 3) return 0;
    const c = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const prev2 = candles[candles.length - 3];

    // ── RSI ──────────────────────────────────────────────────────────────────
    if (desc.includes('rsi') || desc.includes('oversold') || desc.includes('overbought')) {
      const r = rsi(candles);
      const obLevel = desc.includes('80') ? 80 : desc.includes('75') ? 75 : 70;
      const osLevel = desc.includes('20') ? 20 : desc.includes('25') ? 25 : 30;
      if (r < osLevel) return 1;
      if (r > obLevel) return -1;
      return 0;
    }

    // ── MACD crossover ────────────────────────────────────────────────────────
    if (desc.includes('macd')) {
      if (candles.length < 27) return 0;
      const macd = ema(candles, 12) - ema(candles, 26);
      const prevMacd = ema(candles.slice(0, -1), 12) - ema(candles.slice(0, -1), 26);
      if (prevMacd < 0 && macd > 0) return 1;
      if (prevMacd > 0 && macd < 0) return -1;
      return 0;
    }

    // ── Moving Average / EMA crossover ───────────────────────────────────────
    if (
      desc.includes('ema') || desc.includes('sma') ||
      desc.includes('moving average') || desc.includes('ma cross') ||
      desc.includes('golden cross') || desc.includes('death cross') ||
      desc.includes('crossover')
    ) {
      const fast = desc.includes('5,') || desc.includes('5 ') ? 5
        : desc.includes('9') ? 9 : desc.includes('10') ? 10 : 9;
      const slow = desc.includes('50') ? 50 : desc.includes('26') ? 26 : desc.includes('20') ? 20 : 21;
      if (candles.length < slow + 2) return 0;
      const fNow = ema(candles, fast);
      const sNow = ema(candles, slow);
      const fPrev = ema(candles.slice(0, -1), fast);
      const sPrev = ema(candles.slice(0, -1), slow);
      if (fPrev <= sPrev && fNow > sNow) return 1;
      if (fPrev >= sPrev && fNow < sNow) return -1;
      return 0;
    }

    // ── Bollinger Bands ───────────────────────────────────────────────────────
    if (desc.includes('bollinger') || desc.includes('band')) {
      const period = desc.includes('10') ? 10 : 20;
      if (candles.length < period) return 0;
      const slice = candles.slice(-period);
      const mean = slice.reduce((s, x) => s + x.close, 0) / period;
      const sd = stddev(slice.map(x => x.close));
      const mult = desc.includes('1.5') ? 1.5 : desc.includes('2.5') ? 2.5 : 2;
      const upper = mean + mult * sd;
      const lower = mean - mult * sd;
      // Reversal mode (buy low band, sell high band)
      if (desc.includes('revers') || desc.includes('bounce')) {
        if (c.close < lower) return 1;
        if (c.close > upper) return -1;
      } else {
        // Breakout mode
        if (c.close > upper && prev.close <= upper) return 1;
        if (c.close < lower && prev.close >= lower) return -1;
      }
      return 0;
    }

    // ── Breakout above resistance / below support ─────────────────────────────
    if (desc.includes('breakout') || desc.includes('resistance') || desc.includes('support') || desc.includes('break above') || desc.includes('break below')) {
      const lookback = desc.includes('10') ? 10 : desc.includes('50') ? 50 : 20;
      if (candles.length < lookback + 1) return 0;
      const window = candles.slice(-lookback - 1, -1);
      const highest = Math.max(...window.map(x => x.high));
      const lowest = Math.min(...window.map(x => x.low));
      if (c.close > highest) return 1;
      if (c.close < lowest) return -1;
      return 0;
    }

    // ── Mean Reversion / Z-score ─────────────────────────────────────────────
    if (desc.includes('mean reversion') || desc.includes('reversion') || desc.includes('z-score') || desc.includes('zscore')) {
      const period = 20;
      if (candles.length < period) return 0;
      const slice = candles.slice(-period);
      const mean = slice.reduce((s, x) => s + x.close, 0) / period;
      const sd = stddev(slice.map(x => x.close)) || 1;
      const z = (c.close - mean) / sd;
      const threshold = desc.includes('1.5') ? 1.5 : desc.includes('3') ? 3 : 2;
      if (z < -threshold) return 1;
      if (z > threshold) return -1;
      return 0;
    }

    // ── Combined RSI + MA (hybrid) ────────────────────────────────────────────
    if (desc.includes('rsi') && (desc.includes('ma') || desc.includes('ema') || desc.includes('sma'))) {
      const r = rsi(candles);
      const fast = ema(candles, 9);
      const slow = ema(candles, 21);
      const prevFast = ema(candles.slice(0, -1), 9);
      const prevSlow = ema(candles.slice(0, -1), 21);
      const crossUp = prevFast <= prevSlow && fast > slow;
      const crossDown = prevFast >= prevSlow && fast < slow;
      if (crossUp && r < 55) return 1;
      if (crossDown && r > 45) return -1;
      return 0;
    }

    // ── Trend following / momentum ───────────────────────────────────────────
    if (desc.includes('trend') || desc.includes('momentum') || desc.includes('follow')) {
      const n = desc.includes('5') ? 5 : desc.includes('4') ? 4 : 3;
      const slice = candles.slice(-n);
      const allBull = slice.every(x => x.close > x.open);
      const allBear = slice.every(x => x.close < x.open);
      if (allBull) return 1;
      if (allBear) return -1;
      return 0;
    }

    // ── Volume-weighted momentum ─────────────────────────────────────────────
    if (desc.includes('volume') || desc.includes('vwap')) {
      const period = 10;
      const slice = candles.slice(-period);
      const vwap = slice.reduce((s, x) => s + x.close * x.volume, 0) / (slice.reduce((s, x) => s + x.volume, 0) || 1);
      if (c.close > vwap && c.close > prev.close) return 1;
      if (c.close < vwap && c.close < prev.close) return -1;
      return 0;
    }

    // ── Candlestick patterns ─────────────────────────────────────────────────
    if (desc.includes('candle') || desc.includes('pattern') || desc.includes('doji') || desc.includes('hammer') || desc.includes('engulf')) {
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const isDoji = range > 0 && body / range < 0.1;
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const isHammer = lowerWick > body * 2 && body > 0;
      const prevBearish = prev.close < prev.open;
      const prevBullish = prev.close > prev.open;
      const isBullEngulf = c.close > c.open && c.open < prev.close && c.close > prev.open && prevBearish;
      const isBearEngulf = c.close < c.open && c.open > prev.close && c.close < prev.open && prevBullish;
      if ((isHammer && prevBearish) || isBullEngulf) return 1;
      if (isBearEngulf) return -1;
      if (isDoji) return 0;
      return c.close > c.open ? 1 : -1;
    }

    // ── Price action: simple 2-candle momentum (default) ────────────────────
    const bullish = c.close > c.open && prev.close > prev.open;
    const bearish = c.close < c.open && prev.close < prev.open;
    if (bullish && c.close > prev2.high) return 1;
    if (bearish && c.close < prev2.low) return -1;
    return 0;
  };
}

/**
 * Runs a backtest simulation on the provided candles.
 * One position at a time. Closes on SL/TP or at end of data.
 */
export function runBacktest(
  candles: Candle[],
  strategy: string,
  slPips: number,
  tpPips: number,
  initialBalance: number,
  lotSize: number,
): BacktestResult {
  const signal = parseStrategy(strategy);
  const basePrice = candles[0]?.close || 1;
  const pipValue = basePrice > LARGE_PRICE_THRESHOLD ? basePrice * 0.0001 : 0.0001;

  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdown = 0;
  const equityCurve: BacktestResult['equityCurve'] = [
    { time: candles[0]?.time || 0, equity: initialBalance, balance: initialBalance },
  ];
  const trades: BacktestTrade[] = [];

  let openPos: { type: 'BUY' | 'SELL'; openPrice: number; openTime: number; sl: number; tp: number } | null = null;

  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const window = candles.slice(0, i + 1);

    // Check SL / TP
    if (openPos) {
      let closePrice: number | null = null;
      if (openPos.type === 'BUY') {
        if (openPos.sl > 0 && c.low <= openPos.sl) closePrice = openPos.sl;
        else if (openPos.tp > 0 && c.high >= openPos.tp) closePrice = openPos.tp;
      } else {
        if (openPos.sl > 0 && c.high >= openPos.sl) closePrice = openPos.sl;
        else if (openPos.tp > 0 && c.low <= openPos.tp) closePrice = openPos.tp;
      }

      if (closePrice !== null) {
        const priceDiff = openPos.type === 'BUY'
          ? closePrice - openPos.openPrice
          : openPos.openPrice - closePrice;
        const profit = (priceDiff / pipValue) * lotSize * 10;
        balance += profit;
        peakBalance = Math.max(peakBalance, balance);
        maxDrawdown = Math.max(maxDrawdown, (peakBalance - balance) / peakBalance * 100);
        trades.push({ openTime: openPos.openTime, closeTime: c.time, type: openPos.type, openPrice: openPos.openPrice, closePrice, profit, bars: i });
        openPos = null;
        equityCurve.push({ time: c.time, equity: balance, balance });
      }
    }

    // Open new position
    if (!openPos) {
      const sig = signal(window);
      if (sig !== 0) {
        const price = c.close;
        openPos = {
          type: sig === 1 ? 'BUY' : 'SELL',
          openPrice: price,
          openTime: c.time,
          sl: slPips > 0 ? (sig === 1 ? price - slPips * pipValue : price + slPips * pipValue) : 0,
          tp: tpPips > 0 ? (sig === 1 ? price + tpPips * pipValue : price - tpPips * pipValue) : 0,
        };
      }
    }
  }

  // Close remaining position at last candle
  if (openPos && candles.length > 0) {
    const last = candles[candles.length - 1];
    const priceDiff = openPos.type === 'BUY'
      ? last.close - openPos.openPrice
      : openPos.openPrice - last.close;
    const profit = (priceDiff / pipValue) * lotSize * 10;
    balance += profit;
    trades.push({ openTime: openPos.openTime, closeTime: last.time, type: openPos.type, openPrice: openPos.openPrice, closePrice: last.close, profit, bars: candles.length });
    equityCurve.push({ time: last.time, equity: balance, balance });
  }

  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit < 0);
  const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const netProfit = balance - initialBalance;

  const returns = trades.map(t => t.profit / initialBalance);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const stdRet = stddev(returns) || 1;
  const sharpe = (avgReturn / stdRet) * Math.sqrt(252);

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    netProfit,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    maxDrawdown,
    maxDrawdownPct: maxDrawdown,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    sharpeRatio: parseFloat(sharpe.toFixed(2)),
    equityCurve: equityCurve.slice(0, 500),
    trades: trades.slice(-50),
  };
}
