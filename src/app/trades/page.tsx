'use client';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import { ArrowUpRight, ArrowDownRight, X, RefreshCw, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';

const DEMO_TRADES = [
  { id: '1', ticket: 100001, symbol: 'EURUSD', type: 'BUY' as const, lots: 0.10, openPrice: 1.08234, currentPrice: 1.08456, sl: 1.07900, tp: 1.09000, profit: 22.20, swap: -0.50, openTime: new Date(Date.now() - 3600000).toISOString(), comment: 'RSI Strategy' },
  { id: '2', ticket: 100002, symbol: 'BTCUSDT', type: 'BUY' as const, lots: 0.01, openPrice: 65420.00, currentPrice: 66100.00, sl: 64000.00, tp: 68000.00, profit: 68.00, swap: 0, openTime: new Date(Date.now() - 7200000).toISOString(), comment: 'Trend Follow' },
  { id: '3', ticket: 100003, symbol: 'GBPUSD', type: 'SELL' as const, lots: 0.05, openPrice: 1.27650, currentPrice: 1.27420, sl: 1.28100, tp: 1.26800, profit: 11.50, swap: -0.20, openTime: new Date(Date.now() - 1800000).toISOString(), comment: 'MA Cross' },
  { id: '4', ticket: 100004, symbol: 'XAUUSD', type: 'BUY' as const, lots: 0.02, openPrice: 2318.50, currentPrice: 2305.30, sl: 2300.00, tp: 2350.00, profit: -26.40, swap: 0, openTime: new Date(Date.now() - 900000).toISOString(), comment: 'Gold Strategy' },
];

export default function TradesPage() {
  const { trades, accountInfo } = useStore();
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [closing, setClosing] = useState<string | null>(null);

  const displayTrades = trades.length > 0 ? trades : DEMO_TRADES;
  const filtered = displayTrades.filter(t =>
    filter === 'all' ? true : t.type === filter.toUpperCase()
  );

  const totalProfit = filtered.reduce((s, t) => s + t.profit, 0);
  const totalSwap = filtered.reduce((s, t) => s + (t.swap || 0), 0);
  const buyTrades = filtered.filter(t => t.type === 'BUY');
  const sellTrades = filtered.filter(t => t.type === 'SELL');

  const handleClose = async (tradeId: string, ticket: number) => {
    setClosing(tradeId);
    try {
      const res = await fetch('/api/mt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', ticket }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {}
    setTimeout(() => setClosing(null), 1000);
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Live Trades" />
      <div className="p-5 space-y-5">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Positions', value: displayTrades.length.toString(), icon: RefreshCw, color: 'blue' },
            { label: 'Total P&L', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}`, icon: totalProfit >= 0 ? TrendingUp : TrendingDown, color: totalProfit >= 0 ? 'green' : 'red' },
            { label: 'Buy Orders', value: buyTrades.length.toString(), icon: ArrowUpRight, color: 'green' },
            { label: 'Sell Orders', value: sellTrades.length.toString(), icon: ArrowDownRight, color: 'red' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="trading-card flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                color === 'blue' ? 'bg-accent-blue/10' : color === 'green' ? 'bg-accent-green/10' : 'bg-accent-red/10'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  color === 'blue' ? 'text-accent-blue' : color === 'green' ? 'text-accent-green' : 'text-accent-red'
                )} />
              </div>
              <div>
                <p className="text-xs text-text-muted">{label}</p>
                <p className={cn(
                  'text-lg font-bold font-mono',
                  label === 'Total P&L'
                    ? (totalProfit >= 0 ? 'text-accent-green' : 'text-accent-red')
                    : 'text-text-primary'
                )}>
                  {label === 'Total P&L' ? `$${value}` : value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter & Table */}
        <div className="trading-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              {(['all', 'buy', 'sell'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium capitalize transition-colors',
                    filter === f
                      ? (f === 'buy' ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                        : f === 'sell' ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                        : 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20')
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent'
                  )}
                >
                  {f === 'all' ? 'All Trades' : f === 'buy' ? '▲ Buy' : '▼ Sell'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Swap: <span className={totalSwap >= 0 ? 'text-accent-green' : 'text-accent-red'}>${totalSwap.toFixed(2)}</span></span>
              <span className="text-xs text-text-muted border-l border-border pl-2">Net P&L: <span className={cn('font-mono font-bold', (totalProfit + totalSwap) >= 0 ? 'text-accent-green' : 'text-accent-red')}>${(totalProfit + totalSwap).toFixed(2)}</span></span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No open positions
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full trade-table">
                <thead>
                  <tr>
                    <th>#Ticket</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Lots</th>
                    <th>Open Price</th>
                    <th>Current</th>
                    <th>Stop Loss</th>
                    <th>Take Profit</th>
                    <th>Swap</th>
                    <th>P&L</th>
                    <th>Opened</th>
                    <th>Comment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trade) => (
                    <tr key={trade.id} className="hover:bg-bg-hover/50 transition-colors">
                      <td className="font-mono text-text-muted text-xs">#{trade.ticket}</td>
                      <td className="font-semibold text-text-primary">{trade.symbol}</td>
                      <td>
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
                          trade.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                        )}>
                          {trade.type === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trade.type}
                        </span>
                      </td>
                      <td className="font-mono text-text-secondary">{trade.lots.toFixed(2)}</td>
                      <td className="font-mono text-text-secondary">{trade.openPrice >= 100 ? trade.openPrice.toFixed(2) : trade.openPrice.toFixed(5)}</td>
                      <td className={cn(
                        'font-mono font-medium',
                        trade.type === 'BUY'
                          ? (trade.currentPrice > trade.openPrice ? 'text-accent-green' : 'text-accent-red')
                          : (trade.currentPrice < trade.openPrice ? 'text-accent-green' : 'text-accent-red')
                      )}>
                        {trade.currentPrice >= 100 ? trade.currentPrice.toFixed(2) : trade.currentPrice.toFixed(5)}
                      </td>
                      <td className="font-mono text-xs text-accent-red">
                        {trade.sl > 0 ? (trade.sl >= 100 ? trade.sl.toFixed(2) : trade.sl.toFixed(5)) : '—'}
                      </td>
                      <td className="font-mono text-xs text-accent-green">
                        {trade.tp > 0 ? (trade.tp >= 100 ? trade.tp.toFixed(2) : trade.tp.toFixed(5)) : '—'}
                      </td>
                      <td className={cn('font-mono text-xs', trade.swap >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                        {(trade.swap || 0).toFixed(2)}
                      </td>
                      <td className={cn('font-mono font-bold', trade.profit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                      </td>
                      <td className="text-text-muted text-xs whitespace-nowrap">{formatDate(trade.openTime)}</td>
                      <td className="text-text-muted text-xs">{trade.comment || '—'}</td>
                      <td>
                        <button
                          onClick={() => handleClose(trade.id, trade.ticket)}
                          disabled={closing === trade.id}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors',
                            'bg-accent-red/5 border-accent-red/20 text-accent-red hover:bg-accent-red/15 disabled:opacity-50'
                          )}
                        >
                          <X className="w-3 h-3" />
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Order Panel */}
        <div className="trading-card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Order</h3>
          <QuickOrderPanel />
        </div>
      </div>
    </main>
  );
}

function QuickOrderPanel() {
  const { settings, addNotification } = useStore();
  const [symbol, setSymbol] = useState('EURUSD');
  const [lots, setLots] = useState(0.01);
  const [sl, setSl] = useState(50);
  const [tp, setTp] = useState(100);
  const [placing, setPlacing] = useState(false);

  const placeOrder = async (type: 'BUY' | 'SELL') => {
    if (!settings.mt5BridgeEnabled) {
      addNotification({ type: 'error', title: 'MT5 Not Connected', message: 'Enable MT5 bridge in Settings to place orders' });
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch('/api/mt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'order', symbol, type, lots, slPips: sl, tpPips: tp }),
      });
      const data = await res.json();
      if (data.success) {
        addNotification({ type: 'success', title: 'Order Placed', message: `${type} ${lots} ${symbol} — Ticket: #${data.ticket}` });
      } else {
        addNotification({ type: 'error', title: 'Order Failed', message: data.error || 'Unknown error' });
      }
    } catch {
      addNotification({ type: 'error', title: 'Connection Error', message: 'Cannot reach MT5 bridge' });
    }
    setPlacing(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="text-xs text-text-muted mb-1 block">Symbol</label>
        <select className="trading-input w-36" value={symbol} onChange={e => setSymbol(e.target.value)}>
          {['EURUSD','GBPUSD','USDJPY','AUDUSD','BTCUSDT','ETHUSDT','XAUUSD'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-text-muted mb-1 block">Lots</label>
        <input type="number" className="trading-input w-24" value={lots} min={0.01} step={0.01} onChange={e => setLots(+e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-text-muted mb-1 block">SL (pips)</label>
        <input type="number" className="trading-input w-24" value={sl} min={0} step={1} onChange={e => setSl(+e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-text-muted mb-1 block">TP (pips)</label>
        <input type="number" className="trading-input w-24" value={tp} min={0} step={1} onChange={e => setTp(+e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => placeOrder('BUY')}
          disabled={placing}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-accent-green text-white text-sm font-bold hover:bg-accent-green/80 disabled:opacity-50 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          BUY
        </button>
        <button
          onClick={() => placeOrder('SELL')}
          disabled={placing}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-accent-red text-white text-sm font-bold hover:bg-accent-red/80 disabled:opacity-50 transition-colors"
        >
          <ArrowDownRight className="w-4 h-4" />
          SELL
        </button>
      </div>
      {!settings.mt5BridgeEnabled && (
        <p className="text-xs text-accent-yellow">⚠ Enable MT5 bridge in Settings to trade</p>
      )}
    </div>
  );
}
