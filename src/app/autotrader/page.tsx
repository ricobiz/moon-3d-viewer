'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import {
  Bot, Play, Square, AlertTriangle, Activity, Settings2,
  ArrowUpRight, ArrowDownRight, Shield, Zap, RefreshCw,
  CheckCircle, XCircle, Clock, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'decision';
  message: string;
  action?: 'BUY' | 'SELL' | 'HOLD';
  confidence?: number;
}

interface AutoConfig {
  symbol: string;
  timeframe: string;
  strategy: string;
  model: string;
  lotSize: number;
  slPips: number;
  tpPips: number;
  maxTrades: number;
  confidenceThreshold: number;
  intervalSec: number;
}

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'BTCUSDT', 'ETHUSDT', 'XAUUSD', 'USDCAD'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4'];
const TF_INTERVALS: Record<string, number> = {
  M1: 30, M5: 60, M15: 120, M30: 240, H1: 600, H4: 1800,
};

function generateDemoCandles(symbol: string, count = 40) {
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850, GBPUSD: 1.2650, USDJPY: 149.50, AUDUSD: 0.6550,
    BTCUSDT: 68000, ETHUSDT: 3500, XAUUSD: 2320, USDCAD: 1.3600,
  };
  const base = basePrices[symbol] || 1.085;
  const volatility = base > 100 ? base * 0.003 : base * 0.0007;
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  const candles = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.4;
    const low = Math.min(open, close) - Math.random() * volatility * 0.4;
    candles.push({
      time: now - i * 900,
      open: parseFloat(open.toFixed(base > 100 ? 2 : 5)),
      high: parseFloat(high.toFixed(base > 100 ? 2 : 5)),
      low: parseFloat(low.toFixed(base > 100 ? 2 : 5)),
      close: parseFloat(close.toFixed(base > 100 ? 2 : 5)),
      volume: Math.floor(Math.random() * 1000 + 100),
    });
    price = close;
  }
  return candles;
}

export default function AutoTraderPage() {
  const { settings, trades, addNotification, mt5Connected } = useStore();
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<AutoConfig>({
    symbol: 'EURUSD',
    timeframe: 'M15',
    strategy: 'Buy when the last 3 candles are bullish (close > open) with increasing volume. Sell when the last 3 candles are bearish. Hold otherwise.',
    model: settings.openrouterModel || 'anthropic/claude-3.5-sonnet',
    lotSize: settings.defaultLotSize || 0.01,
    slPips: settings.defaultSlPips || 50,
    tpPips: settings.defaultTpPips || 100,
    maxTrades: settings.maxOpenTrades || 5,
    confidenceThreshold: 70,
    intervalSec: 120,
  });
  const [showConfig, setShowConfig] = useState(true);
  const [stats, setStats] = useState({ decisions: 0, executed: 0, skipped: 0, errors: 0 });
  const [currentDecision, setCurrentDecision] = useState<{ action: string; confidence: number; reason: string } | null>(null);
  const [nextRunIn, setNextRunIn] = useState(0);
  const [modifyTicket, setModifyTicket] = useState<number | null>(null);
  const [modifySl, setModifySl] = useState('');
  const [modifyTp, setModifyTp] = useState('');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string, extra?: Partial<LogEntry>) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).slice(2),
      time: new Date().toLocaleTimeString(),
      type,
      message,
      ...extra,
    };
    setLog(prev => [...prev.slice(-200), entry]);
  }, []);

  const scrollLog = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollLog(); }, [log, scrollLog]);

  const runOnce = useCallback(async () => {
    if (!settings.openrouterApiKey) {
      addLog('error', 'OpenRouter API key not set — go to Settings');
      return;
    }

    addLog('info', `Fetching candles: ${config.symbol} ${config.timeframe}`);

    // Fetch candles
    let candles;
    try {
      if (settings.mt5BridgeEnabled && mt5Connected) {
        const res = await fetch(`/api/mt5?action=candles&symbol=${config.symbol}&timeframe=${config.timeframe}&count=40`);
        const data = await res.json();
        candles = data.candles?.length ? data.candles : null;
      }
      if (!candles) {
        candles = generateDemoCandles(config.symbol);
        addLog('warning', 'MT5 not connected — using simulated candles');
      }
    } catch {
      candles = generateDemoCandles(config.symbol);
      addLog('warning', 'Candle fetch failed — using simulated candles');
    }

    const openOnSymbol = trades.filter(t => t.symbol === config.symbol).length;

    addLog('info', `Sending ${candles.length} candles to AI (${config.model.split('/').pop()})...`);

    try {
      const res = await fetch('/api/autotrader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candles,
          strategy: config.strategy,
          symbol: config.symbol,
          timeframe: config.timeframe,
          openTrades: openOnSymbol,
          slPips: config.slPips,
          tpPips: config.tpPips,
          apiKey: settings.openrouterApiKey,
          model: config.model,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const decision = await res.json();
      if (decision.error) throw new Error(decision.error);

      setCurrentDecision(decision);
      setStats(s => ({ ...s, decisions: s.decisions + 1 }));

      addLog('decision',
        `AI: ${decision.action} (${decision.confidence}%) — ${decision.reason}`,
        { action: decision.action, confidence: decision.confidence }
      );

      // Execute if confident enough and not HOLD
      if (decision.action !== 'HOLD' && decision.confidence >= config.confidenceThreshold) {
        // Check max trades limit
        if (openOnSymbol >= config.maxTrades) {
          addLog('warning', `Max trades limit (${config.maxTrades}) reached for ${config.symbol} — skipping`);
          setStats(s => ({ ...s, skipped: s.skipped + 1 }));
          return;
        }

        if (!settings.mt5BridgeEnabled || !mt5Connected) {
          addLog('warning', `Would execute ${decision.action} ${config.lotSize} ${config.symbol} — MT5 offline (demo)`);
          setStats(s => ({ ...s, skipped: s.skipped + 1 }));
          addNotification({
            type: 'info',
            title: `AI: ${decision.action} ${config.symbol}`,
            message: `Demo — ${decision.confidence}% confidence. Connect MT5 to execute.`,
          });
          return;
        }

        addLog('info', `Executing ${decision.action} ${config.lotSize} ${config.symbol} SL:${config.slPips}p TP:${config.tpPips}p`);
        try {
          const orderRes = await fetch('/api/mt5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'order',
              symbol: config.symbol,
              type: decision.action,
              lots: config.lotSize,
              slPips: config.slPips,
              tpPips: config.tpPips,
              comment: `AI AutoTrader ${config.confidenceThreshold}%`,
            }),
          });
          const orderData = await orderRes.json();
          if (orderData.success) {
            addLog('success', `Order placed! Ticket #${orderData.ticket} @ ${orderData.price}`);
            setStats(s => ({ ...s, executed: s.executed + 1 }));
            addNotification({
              type: 'success',
              title: `AI ${decision.action} Executed`,
              message: `${config.symbol} ${config.lotSize} lots — #${orderData.ticket}`,
            });
          } else {
            addLog('error', `Order failed: ${orderData.error}`);
            setStats(s => ({ ...s, errors: s.errors + 1 }));
          }
        } catch (e) {
          addLog('error', `Order error: ${e}`);
          setStats(s => ({ ...s, errors: s.errors + 1 }));
        }
      } else if (decision.action === 'HOLD') {
        addLog('info', `HOLD — no action taken`);
        setStats(s => ({ ...s, skipped: s.skipped + 1 }));
      } else {
        addLog('warning', `Low confidence (${decision.confidence}% < ${config.confidenceThreshold}%) — skipping`);
        setStats(s => ({ ...s, skipped: s.skipped + 1 }));
      }
    } catch (e) {
      addLog('error', `AI error: ${String(e)}`);
      setStats(s => ({ ...s, errors: s.errors + 1 }));
    }
  }, [settings, config, trades, mt5Connected, addLog, addNotification]);

  const startTrading = useCallback(() => {
    if (!settings.openrouterApiKey) {
      addNotification({ type: 'error', title: 'API Key Missing', message: 'Set your OpenRouter API key in Settings first' });
      return;
    }
    setIsRunning(true);
    setLog([]);
    setStats({ decisions: 0, executed: 0, skipped: 0, errors: 0 });
    addLog('success', `AutoTrader started — ${config.symbol} ${config.timeframe} every ${config.intervalSec}s`);
    addLog('info', `Strategy: "${config.strategy.slice(0, 80)}${config.strategy.length > 80 ? '...' : ''}"`);
    addLog('info', `SL: ${config.slPips} pips | TP: ${config.tpPips} pips | Min confidence: ${config.confidenceThreshold}%`);

    // Run immediately
    runOnce();

    // Schedule repeating
    const actualInterval = config.intervalSec * 1000;
    intervalRef.current = setInterval(runOnce, actualInterval);

    // Countdown
    let remaining = config.intervalSec;
    setNextRunIn(remaining);
    countdownRef.current = setInterval(() => {
      remaining--;
      setNextRunIn(remaining);
      if (remaining <= 0) remaining = config.intervalSec;
    }, 1000);
  }, [settings, config, runOnce, addLog, addNotification]);

  const stopTrading = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIsRunning(false);
    setNextRunIn(0);
    addLog('warning', 'AutoTrader stopped. Open positions remain with their SL/TP protection.');
    addNotification({ type: 'warning', title: 'AutoTrader Stopped', message: 'Existing positions are protected by SL/TP' });
  }, [addLog, addNotification]);

  const emergencyStop = useCallback(async () => {
    stopTrading();
    addLog('error', 'EMERGENCY STOP — closing all positions...');
    try {
      const res = await fetch('/api/mt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close-all' }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('success', `Emergency stop: closed ${data.closed} positions`);
        addNotification({ type: 'error', title: 'Emergency Stop', message: `Closed ${data.closed} positions` });
      } else {
        addLog('error', `Emergency stop failed: ${data.error}`);
      }
    } catch {
      addLog('error', 'Emergency stop: cannot reach MT5 bridge');
    }
  }, [stopTrading, addLog, addNotification]);

  const handleModify = useCallback(async () => {
    if (!modifyTicket) return;
    try {
      const res = await fetch('/api/mt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          ticket: modifyTicket,
          sl: parseFloat(modifySl) || 0,
          tp: parseFloat(modifyTp) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification({ type: 'success', title: 'Position Modified', message: `#${modifyTicket} SL/TP updated` });
        addLog('success', `Modified #${modifyTicket}: SL=${modifySl} TP=${modifyTp}`);
      } else {
        addNotification({ type: 'error', title: 'Modify Failed', message: data.error });
      }
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Cannot reach MT5 bridge' });
    }
    setModifyTicket(null);
  }, [modifyTicket, modifySl, modifyTp, addLog, addNotification]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const logTypeIcon = (type: LogEntry['type'], action?: string) => {
    if (type === 'success') return <CheckCircle className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />;
    if (type === 'error') return <XCircle className="w-3.5 h-3.5 text-accent-red flex-shrink-0" />;
    if (type === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0" />;
    if (type === 'decision') {
      if (action === 'BUY') return <ArrowUpRight className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />;
      if (action === 'SELL') return <ArrowDownRight className="w-3.5 h-3.5 text-accent-red flex-shrink-0" />;
      return <Bot className="w-3.5 h-3.5 text-accent-purple flex-shrink-0" />;
    }
    return <Activity className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />;
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="AI AutoTrader" />
      <div className="p-4 space-y-4">

        {/* Status bar */}
        <div className={cn(
          'trading-card flex flex-wrap items-center gap-4 py-3',
          isRunning && 'border-accent-green/30 bg-accent-green/3'
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-2.5 h-2.5 rounded-full',
              isRunning ? 'bg-accent-green animate-pulse' : 'bg-text-muted'
            )} />
            <span className={cn('text-sm font-semibold', isRunning ? 'text-accent-green' : 'text-text-muted')}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>

          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              Next in {nextRunIn}s
            </div>
          )}

          {/* Stats */}
          {[
            { label: 'Decisions', value: stats.decisions, color: 'blue' },
            { label: 'Executed', value: stats.executed, color: 'green' },
            { label: 'Skipped', value: stats.skipped, color: 'yellow' },
            { label: 'Errors', value: stats.errors, color: 'red' },
          ].map(s => (
            <div key={s.label} className="text-xs">
              <span className="text-text-muted">{s.label}: </span>
              <span className={cn('font-bold font-mono',
                s.color === 'green' ? 'text-accent-green' :
                s.color === 'red' ? 'text-accent-red' :
                s.color === 'yellow' ? 'text-accent-yellow' : 'text-accent-blue'
              )}>{s.value}</span>
            </div>
          ))}

          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={startTrading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-white text-sm font-bold hover:bg-accent-green/80 transition-colors"
              >
                <Play className="w-4 h-4" /> Start AutoTrader
              </button>
            ) : (
              <>
                <button
                  onClick={stopTrading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 text-sm font-bold hover:bg-accent-yellow/20 transition-colors"
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
                <button
                  onClick={emergencyStop}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-red text-white text-sm font-bold hover:bg-accent-red/80 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" /> Emergency Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Current AI decision */}
        {currentDecision && (
          <div className={cn(
            'p-3 rounded-lg border flex items-center gap-3',
            currentDecision.action === 'BUY' ? 'bg-accent-green/5 border-accent-green/20' :
            currentDecision.action === 'SELL' ? 'bg-accent-red/5 border-accent-red/20' :
            'bg-bg-tertiary border-border'
          )}>
            {currentDecision.action === 'BUY' ? <ArrowUpRight className="w-5 h-5 text-accent-green" /> :
             currentDecision.action === 'SELL' ? <ArrowDownRight className="w-5 h-5 text-accent-red" /> :
             <Bot className="w-5 h-5 text-text-muted" />}
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold',
                  currentDecision.action === 'BUY' ? 'text-accent-green' :
                  currentDecision.action === 'SELL' ? 'text-accent-red' : 'text-text-secondary'
                )}>{currentDecision.action}</span>
                <span className="text-xs text-text-muted">{currentDecision.confidence}% confidence</span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{currentDecision.reason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Config panel */}
          <div className="lg:col-span-1 space-y-4">

            {/* Configuration */}
            <div className="trading-card">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="w-full flex items-center justify-between mb-2"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-accent-blue" />
                  <span className="text-sm font-semibold text-text-primary">Configuration</span>
                </div>
                {showConfig ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </button>

              {showConfig && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Symbol</label>
                      <select className="trading-input" value={config.symbol}
                        onChange={e => setConfig(c => ({ ...c, symbol: e.target.value }))}>
                        {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Timeframe</label>
                      <select className="trading-input" value={config.timeframe}
                        onChange={e => setConfig(c => ({ ...c, timeframe: e.target.value, intervalSec: TF_INTERVALS[e.target.value] || 120 }))}>
                        {TIMEFRAMES.map(tf => <option key={tf}>{tf}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Strategy Description</label>
                    <textarea
                      className="trading-input resize-none text-xs"
                      rows={4}
                      value={config.strategy}
                      onChange={e => setConfig(c => ({ ...c, strategy: e.target.value }))}
                      placeholder="Describe your trading strategy in plain language..."
                    />
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">AI Model</label>
                    <input
                      className="trading-input text-xs"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      placeholder="anthropic/claude-3.5-sonnet"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Lot Size</label>
                      <input type="number" className="trading-input" value={config.lotSize} min={0.01} step={0.01}
                        onChange={e => setConfig(c => ({ ...c, lotSize: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">SL (pips)</label>
                      <input type="number" className="trading-input" value={config.slPips} min={1}
                        onChange={e => setConfig(c => ({ ...c, slPips: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">TP (pips)</label>
                      <input type="number" className="trading-input" value={config.tpPips} min={1}
                        onChange={e => setConfig(c => ({ ...c, tpPips: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Max Trades</label>
                      <input type="number" className="trading-input" value={config.maxTrades} min={1} max={50}
                        onChange={e => setConfig(c => ({ ...c, maxTrades: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Min Confidence %</label>
                      <input type="number" className="trading-input" value={config.confidenceThreshold} min={50} max={99}
                        onChange={e => setConfig(c => ({ ...c, confidenceThreshold: +e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Interval (sec)</label>
                      <input type="number" className="trading-input" value={config.intervalSec} min={10}
                        onChange={e => setConfig(c => ({ ...c, intervalSec: +e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Open Positions (with modify SL/TP) */}
            <div className="trading-card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-accent-blue" />
                <span className="text-sm font-semibold text-text-primary">Open Positions</span>
                <span className="text-xs text-text-muted ml-auto">{trades.length} open</span>
              </div>

              {trades.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-3">No open positions</p>
              ) : (
                <div className="space-y-2">
                  {trades.slice(0, 8).map(t => (
                    <div key={t.id} className="bg-bg-tertiary rounded-lg p-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'font-bold',
                            t.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'
                          )}>{t.type}</span>
                          <span className="font-semibold text-text-primary">{t.symbol}</span>
                          <span className="text-text-muted">#{t.ticket}</span>
                        </div>
                        <span className={cn('font-mono font-bold', t.profit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                          {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                        <span>SL: <span className="text-accent-red">{t.sl > 0 ? t.sl.toFixed(t.sl > 100 ? 2 : 5) : '—'}</span></span>
                        <span>TP: <span className="text-accent-green">{t.tp > 0 ? t.tp.toFixed(t.tp > 100 ? 2 : 5) : '—'}</span></span>
                        <button
                          onClick={() => {
                            setModifyTicket(t.ticket);
                            setModifySl(t.sl.toString());
                            setModifyTp(t.tp.toString());
                          }}
                          className="ml-auto text-accent-blue hover:underline"
                        >Edit SL/TP</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modify SL/TP panel */}
            {modifyTicket && (
              <div className="trading-card border-accent-blue/30 bg-accent-blue/3">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-accent-blue" />
                  <span className="text-sm font-semibold text-text-primary">Modify #{modifyTicket}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Stop Loss (price)</label>
                    <input type="number" step="0.00001" className="trading-input" value={modifySl}
                      onChange={e => setModifySl(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Take Profit (price)</label>
                    <input type="number" step="0.00001" className="trading-input" value={modifyTp}
                      onChange={e => setModifyTp(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleModify}
                      className="flex-1 btn-primary text-xs py-1.5">Apply</button>
                    <button onClick={() => setModifyTicket(null)}
                      className="flex-1 btn-secondary text-xs py-1.5">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Safety info */}
            <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary space-y-1">
                  <p className="font-medium text-accent-yellow">Safety features:</p>
                  <p>• SL/TP protect every position if disconnected</p>
                  <p>• Max trades limit prevents overtrading</p>
                  <p>• Min confidence threshold filters weak signals</p>
                  <p>• Emergency Stop closes all positions instantly</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity log */}
          <div className="lg:col-span-2 trading-card flex flex-col" style={{ minHeight: 500 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent-yellow" />
                <span className="text-sm font-semibold text-text-primary">Activity Log</span>
                {isRunning && <span className="flex items-center gap-1 text-xs text-accent-green">
                  <Activity className="w-3 h-3 animate-pulse" /> Live
                </span>}
              </div>
              <button onClick={() => setLog([])} className="text-xs text-text-muted hover:text-text-secondary">Clear</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs bg-bg-primary rounded-lg p-3" style={{ minHeight: 400, maxHeight: 600 }}>
              {log.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
                  <Bot className="w-8 h-8 opacity-30" />
                  <p>Press &quot;Start AutoTrader&quot; to begin</p>
                </div>
              ) : (
                log.map(entry => (
                  <div key={entry.id} className={cn(
                    'flex items-start gap-2 py-1 border-b border-border/30 last:border-0',
                  )}>
                    {logTypeIcon(entry.type, entry.action)}
                    <span className="text-text-muted flex-shrink-0">{entry.time}</span>
                    <span className={cn(
                      'flex-1 leading-relaxed',
                      entry.type === 'success' ? 'text-accent-green' :
                      entry.type === 'error' ? 'text-accent-red' :
                      entry.type === 'warning' ? 'text-accent-yellow' :
                      entry.type === 'decision' ? (
                        entry.action === 'BUY' ? 'text-accent-green font-semibold' :
                        entry.action === 'SELL' ? 'text-accent-red font-semibold' :
                        'text-accent-purple'
                      ) : 'text-text-secondary'
                    )}>
                      {entry.message}
                      {entry.confidence !== undefined && (
                        <span className="ml-1 text-text-muted text-[10px]">[{entry.confidence}%]</span>
                      )}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* No API key warning */}
        {!settings.openrouterApiKey && (
          <div className="p-4 bg-accent-red/5 border border-accent-red/20 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-accent-red font-semibold mb-1">
              <AlertTriangle className="w-4 h-4" /> OpenRouter API Key Required
            </div>
            <p className="text-xs text-text-secondary">
              Go to <a href="/settings" className="text-accent-blue hover:underline">Settings</a> and add your OpenRouter API key to use AI AutoTrader.
              Get a free key at <span className="text-accent-blue">openrouter.ai/keys</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
