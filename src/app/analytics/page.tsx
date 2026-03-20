'use client';
import Header from '@/components/layout/Header';
import { useStore } from '@/lib/store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Award, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SAMPLE_MONTHLY = [
  { month: 'Oct', profit: 312, trades: 28 },
  { month: 'Nov', profit: -89, trades: 22 },
  { month: 'Dec', profit: 567, trades: 35 },
  { month: 'Jan', profit: 234, trades: 19 },
  { month: 'Feb', profit: -143, trades: 24 },
  { month: 'Mar', profit: 891, trades: 41 },
];

const PAIR_DATA = [
  { name: 'EURUSD', profit: 421, trades: 45, winRate: 62 },
  { name: 'GBPUSD', profit: -89, trades: 28, winRate: 43 },
  { name: 'BTCUSDT', profit: 782, trades: 33, winRate: 70 },
  { name: 'XAUUSD', profit: 234, trades: 21, winRate: 57 },
  { name: 'USDJPY', profit: -45, trades: 15, winRate: 40 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export default function AnalyticsPage() {
  const { equityHistory } = useStore();

  const winData = [
    { name: 'Wins', value: 134, color: '#10b981' },
    { name: 'Losses', value: 81, color: '#ef4444' },
    { name: 'Break-even', value: 7, color: '#475569' },
  ];

  const stats = [
    { label: 'Total Return', value: '+18.7%', sub: 'Since start', positive: true, icon: TrendingUp },
    { label: 'Win Rate', value: '62.3%', sub: '134 / 215 trades', positive: true, icon: Target },
    { label: 'Profit Factor', value: '1.84', sub: 'Gross P / Gross L', positive: true, icon: Award },
    { label: 'Max Drawdown', value: '-8.2%', sub: 'Peak to trough', positive: false, icon: TrendingDown },
    { label: 'Avg Win', value: '$47.20', sub: 'Per winning trade', positive: true, icon: BarChart2 },
    { label: 'Avg Loss', value: '$-28.40', sub: 'Per losing trade', positive: false, icon: BarChart2 },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <Header title="Analytics" />
      <div className="p-5 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map(({ label, value, sub, positive, icon: Icon }) => (
            <div key={label} className="trading-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', positive ? 'text-accent-green' : 'text-accent-red')} />
                <span className="text-xs text-text-muted">{label}</span>
              </div>
              <p className={cn('text-lg font-bold font-mono', positive ? 'text-accent-green' : 'text-accent-red')}>
                {value}
              </p>
              <p className="text-xs text-text-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Monthly P&L */}
          <div className="lg:col-span-2 trading-card">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Monthly P&L</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SAMPLE_MONTHLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(v: number) => [`$${v}`, 'P&L']}
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {SAMPLE_MONTHLY.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Win/Loss Pie */}
          <div className="trading-card">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Trade Outcomes</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winData}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {winData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#141d2b', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Performance by Symbol */}
        <div className="trading-card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Performance by Symbol</h3>
          <div className="overflow-x-auto">
            <table className="w-full trade-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Total P&L</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {PAIR_DATA.map((row) => (
                  <tr key={row.name} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="font-semibold text-text-primary">{row.name}</td>
                    <td className="font-mono text-text-secondary">{row.trades}</td>
                    <td>
                      <span className={cn(
                        'font-mono font-bold',
                        row.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'
                      )}>
                        {row.winRate}%
                      </span>
                    </td>
                    <td className={cn(
                      'font-mono font-bold',
                      row.profit >= 0 ? 'text-accent-green' : 'text-accent-red'
                    )}>
                      {row.profit >= 0 ? '+' : ''}${row.profit}
                    </td>
                    <td>
                      <div className="w-full bg-bg-tertiary rounded-full h-1.5 max-w-24">
                        <div
                          className={cn('h-full rounded-full', row.profit >= 0 ? 'bg-accent-green' : 'bg-accent-red')}
                          style={{ width: `${Math.min(100, Math.abs(row.winRate))}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
