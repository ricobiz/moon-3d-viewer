'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import {
  History, RefreshCw, TrendingUp, TrendingDown, Award, Target,
  ArrowUpRight, ArrowDownRight, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Deal {
  ticket: number;
  order: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: string;
  comment: string;
}

// Demo data generator
function generateDemoDeals(): Deal[] {
  const symbols = ['EURUSD', 'GBPUSD', 'BTCUSDT', 'XAUUSD', 'USDJPY', 'ETHUSDT'];
  const deals: Deal[] = [];
  const now = Date.now();

  for (let i = 89; i >= 0; i--) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const profit = (Math.random() - 0.42) * 120;
    deals.push({
      ticket: 200000 + i,
      order: 300000 + i,
      symbol,
      type,
      volume: parseFloat((Math.random() * 0.2 + 0.01).toFixed(2)),
      price: symbol === 'BTCUSDT' ? 65000 + Math.random() * 5000 :
             symbol === 'XAUUSD' ? 2300 + Math.random() * 50 :
             1 + Math.random() * 0.3,
      profit: parseFloat(profit.toFixed(2)),
      commission: parseFloat((Math.random() * -2).toFixed(2)),
      swap: parseFloat((Math.random() * -1).toFixed(2)),
      time: new Date(now - i * 86400000 / 3 + Math.random() * 50000000).toISOString(),
      comment: ['RSI Strategy', 'MA Cross', 'Trend Follow', 'AI AutoTrader', 'Manual'][Math.floor(Math.random() * 5)],
    });
  }
  return deals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function calcStats(deals: Deal[]) {
  const wins = deals.filter(d => d.profit > 0);
  const losses = deals.filter(d => d.profit < 0);
  const totalProfit = deals.reduce((s, d) => s + d.profit + d.commission + d.swap, 0);
  const grossProfit = wins.reduce((s, d) => s + d.profit, 0);
  const grossLoss = Math.abs(losses.reduce((s, d) => s + d.profit, 0));
  const winRate = deals.length > 0 ? (wins.length / deals.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
  return { totalProfit, grossProfit, grossLoss, winRate, avgWin, avgLoss, profitFactor, wins: wins.length, losses: losses.length };
}

function buildEquityCurve(deals: Deal[]) {
  let equity = 0;
  return [...deals].reverse().map((d, i) => {
    equity += d.profit + d.commission + d.swap;
    return {
      i: i + 1,
      equity: parseFloat(equity.toFixed(2)),
      profit: d.profit,
    };
  });
}

function buildDailyPnL(deals: Deal[]) {
  const byDay: Record<string, number> = {};
  deals.forEach(d => {
    const day = new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    byDay[day] = (byDay[day] || 0) + d.profit;
  });
  return Object.entries(byDay).slice(-30).map(([day, profit]) => ({
    day,
    profit: parseFloat(profit.toFixed(2)),
  }));
}

function buildSymbolStats(deals: Deal[]) {
  const bySymbol: Record<string, { profit: number; trades: number; wins: number }> = {};
  deals.forEach(d => {
    if (!bySymbol[d.symbol]) bySymbol[d.symbol] = { profit: 0, trades: 0, wins: 0 };
    bySymbol[d.symbol].profit += d.profit;
    bySymbol[d.symbol].trades += 1;
    if (d.profit > 0) bySymbol[d.symbol].wins += 1;
  });
  return Object.entries(bySymbol).map(([symbol, s]) => ({
    symbol,
    profit: parseFloat(s.profit.toFixed(2)),
    trades: s.trades,
    winRate: Math.round((s.wins / s.trades) * 100),
  })).sort((a, b) => b.profit - a.profit);
}

export default function HistoryPage() {
  const { settings, mt5Connected } = useStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'profit' | 'symbol'>('time');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      if (settings.mt5BridgeEnabled && mt5Connected) {
        const res = await fetch(`/api/mt5?action=history&days=${days}`);
        const data = await res.json();
        if (data.deals?.length) {
          setDeals(data.deals);
          return;
        }
      }
      setDeals(generateDemoDeals());
    } catch {
      setDeals(generateDemoDeals());
    } finally {
      setLoading(false);
    }
  }, [days, settings.mt5BridgeEnabled, mt5Connected]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = deals.filter(d =>
    !filter || d.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    d.comment.toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'profit') return b.profit - a.profit;
    if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
    return new Date(b.time).getTime() - new Date(a.time).getTime();
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const stats = calcStats(deals);
  const equityCurve = buildEquityCurve(deals);
  const dailyPnL = buildDailyPnL(deals);
  const symbolStats = buildSymbolStats(deals);

  const isDemo = !mt5Connected || !settings.mt5BridgeEnabled;

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Trade History" />
      <div className="p-4 space-y-4">

        {/* Controls */}
        <div className="trading-card flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-text-muted" />
          <span className="text-xs text-text-muted">Period:</span>
          {[7, 30, 90, 365].map(d => (
            <button key={d}
              onClick={() => { setDays(d); setPage(0); }}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-colors border',
                days === d
                  ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                  : 'text-text-muted border-transparent hover:border-border hover:text-text-primary'
              )}
            >{d}d</button>
          ))}
          <div className="flex-1" />
          <input
            type="text"
            placeholder="Filter symbol / strategy..."
            className="trading-input w-48 text-xs"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
          />
          <button onClick={fetchHistory} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Deals', value: deals.length.toString(), color: 'blue', icon: History },
            { label: 'Net P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`, color: stats.totalProfit >= 0 ? 'green' : 'red', icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? 'green' : 'red', icon: Target },
            { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'green' : 'red', icon: Award },
            { label: 'Avg Win', value: `$${stats.avgWin.toFixed(2)}`, color: 'green', icon: ArrowUpRight },
            { label: 'Avg Loss', value: `-$${stats.avgLoss.toFixed(2)}`, color: 'red', icon: ArrowDownRight },
            { label: 'Wins / Losses', value: `${stats.wins} / ${stats.losses}`, color: 'blue', icon: Target },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="trading-card py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('w-3.5 h-3.5',
                  color === 'green' ? 'text-accent-green' :
                  color === 'red' ? 'text-accent-red' : 'text-accent-blue'
                )} />
                <span className="text-[10px] text-text-muted">{label}</span>
              </div>
              <p className={cn('text-sm font-bold font-mono',
                color === 'green' ? 'text-accent-green' :
                color === 'red' ? 'text-accent-red' : 'text-text-primary'
              )}>{value}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Equity curve */}
          <div className="trading-card">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Cumulative P&L Curve</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurve} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                  <XAxis dataKey="i" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `#${v}`} interval={Math.floor(equityCurve.length / 6)} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={v => `Trade #${v}`}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
                  />
                  <Line dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false}
                    type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily P&L */}
          <div className="trading-card">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Daily P&L</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyPnL} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}
                    interval={Math.floor(dailyPnL.length / 8)} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
                  />
                  <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                    {dailyPnL.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Symbol breakdown */}
        <div className="trading-card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Performance by Symbol</h3>
          <div className="overflow-x-auto">
            <table className="w-full trade-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Total P&L</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {symbolStats.map(row => (
                  <tr key={row.symbol} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="font-semibold text-text-primary">{row.symbol}</td>
                    <td className="font-mono text-text-secondary">{row.trades}</td>
                    <td>
                      <span className={cn('font-mono font-bold', row.winRate >= 50 ? 'text-accent-green' : 'text-accent-red')}>
                        {row.winRate}%
                      </span>
                    </td>
                    <td className={cn('font-mono font-bold', row.profit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                      {row.profit >= 0 ? '+' : ''}${row.profit}
                    </td>
                    <td>
                      <div className="w-24 bg-bg-tertiary rounded-full h-1.5">
                        <div
                          className={cn('h-full rounded-full', row.profit >= 0 ? 'bg-accent-green' : 'bg-accent-red')}
                          style={{ width: `${Math.min(100, row.winRate)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deals table */}
        <div className="trading-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Deal Log <span className="text-text-muted font-normal text-xs ml-1">({filtered.length} records)</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Sort:</span>
              {(['time', 'profit', 'symbol'] as const).map(s => (
                <button key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs border transition-colors capitalize',
                    sortBy === s
                      ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/30'
                      : 'text-text-muted border-transparent hover:border-border'
                  )}
                >{s}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-text-muted text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full trade-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Volume</th>
                    <th>Price</th>
                    <th>P&L</th>
                    <th>Commission</th>
                    <th>Swap</th>
                    <th>Net</th>
                    <th>Time</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(d => {
                    const net = d.profit + d.commission + d.swap;
                    return (
                      <tr key={d.ticket} className="hover:bg-bg-hover/50 transition-colors">
                        <td className="font-mono text-text-muted text-xs">#{d.ticket}</td>
                        <td className="font-semibold text-text-primary">{d.symbol}</td>
                        <td>
                          <span className={cn(
                            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold',
                            d.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
                          )}>
                            {d.type === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {d.type}
                          </span>
                        </td>
                        <td className="font-mono text-text-secondary">{d.volume.toFixed(2)}</td>
                        <td className="font-mono text-text-secondary text-xs">
                          {d.price > 100 ? d.price.toFixed(2) : d.price.toFixed(5)}
                        </td>
                        <td className={cn('font-mono font-bold', d.profit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                          {d.profit >= 0 ? '+' : ''}{d.profit.toFixed(2)}
                        </td>
                        <td className="font-mono text-text-muted text-xs">{d.commission.toFixed(2)}</td>
                        <td className="font-mono text-text-muted text-xs">{d.swap.toFixed(2)}</td>
                        <td className={cn('font-mono font-bold text-xs', net >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                          {net >= 0 ? '+' : ''}{net.toFixed(2)}
                        </td>
                        <td className="text-text-muted text-xs whitespace-nowrap">
                          {new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="text-text-muted text-xs">{d.comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">← Prev</button>
              <span className="text-xs text-text-muted">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {isDemo && (
          <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg text-xs text-text-secondary">
            <strong className="text-accent-yellow">Demo data</strong> — showing simulated trade history.
            Connect MT5 in <a href="/settings" className="text-accent-blue hover:underline">Settings</a> to see real history.
          </div>
        )}
      </div>
    </main>
  );
}
