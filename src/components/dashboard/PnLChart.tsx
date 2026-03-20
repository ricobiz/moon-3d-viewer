'use client';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const PERIODS = ['7D', '14D', '30D', 'ALL'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
        <p className="text-text-muted mb-1.5">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className={cn('font-mono', entry.name === 'equity' ? 'text-accent-blue' : 'text-accent-green')}>
            {entry.name === 'equity' ? 'Equity' : 'Balance'}: ${entry.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PnLChart() {
  const [period, setPeriod] = useState('30D');
  const { equityHistory } = useStore();

  const periodMap: Record<string, number> = { '7D': 7, '14D': 14, '30D': 30, 'ALL': 999 };
  const data = equityHistory.slice(-(periodMap[period] || 30));
  const firstEquity = data[0]?.equity || 10000;
  const lastEquity = data[data.length - 1]?.equity || 10000;
  const change = lastEquity - firstEquity;
  const changePct = ((change / firstEquity) * 100);
  const isPositive = change >= 0;

  return (
    <div className="trading-card h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Equity Curve</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-text-primary">
              ${lastEquity.toFixed(2)}
            </span>
            <span className={cn('text-sm font-mono font-medium', isPositive ? 'text-accent-green' : 'text-accent-red')}>
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                period === p
                  ? 'bg-accent-blue text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0" style={{ minHeight: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#475569', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={firstEquity} stroke="#1e2d3d" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#balanceGrad)"
              dot={false}
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#equityGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-accent-blue rounded" />
          <span className="text-xs text-text-muted">Equity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-accent-green rounded border-t-2 border-dashed border-accent-green" style={{ borderStyle: 'dashed' }} />
          <span className="text-xs text-text-muted">Balance</span>
        </div>
      </div>
    </div>
  );
}
