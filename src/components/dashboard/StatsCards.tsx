'use client';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart2, Shield } from 'lucide-react';
import { AccountInfo, Trade } from '@/lib/store';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';

interface Props {
  account: AccountInfo;
  trades: Trade[];
}

export default function StatsCards({ account, trades }: Props) {
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const winTrades = trades.filter(t => t.profit > 0).length;
  const winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;
  const marginLevel = account.marginLevel;
  const drawdown = account.equity < account.balance
    ? ((account.balance - account.equity) / account.balance) * 100
    : 0;

  const stats = [
    {
      label: 'Account Balance',
      value: formatCurrency(account.balance),
      sub: `${account.currency} • ${account.leverage}:1`,
      icon: DollarSign,
      color: 'blue',
      trend: null,
    },
    {
      label: 'Floating P&L',
      value: formatCurrency(Math.abs(totalProfit)),
      sub: `${trades.length} open trade${trades.length !== 1 ? 's' : ''}`,
      icon: totalProfit >= 0 ? TrendingUp : TrendingDown,
      color: totalProfit >= 0 ? 'green' : 'red',
      trend: totalProfit,
    },
    {
      label: 'Equity',
      value: formatCurrency(account.equity),
      sub: `Free: ${formatCurrency(account.freeMargin)}`,
      icon: Activity,
      color: account.equity >= account.balance ? 'green' : 'red',
      trend: account.equity - account.balance,
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      sub: `${winTrades}/${trades.length} winning`,
      icon: BarChart2,
      color: winRate >= 50 ? 'green' : 'yellow',
      trend: null,
    },
    {
      label: 'Margin Level',
      value: marginLevel > 0 ? `${marginLevel.toFixed(0)}%` : '—',
      sub: `Used: ${formatCurrency(account.margin)}`,
      icon: Shield,
      color: marginLevel > 200 ? 'green' : marginLevel > 100 ? 'yellow' : 'red',
      trend: null,
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-accent-blue/10', icon: 'text-accent-blue', text: 'text-accent-blue' },
    green: { bg: 'bg-accent-green/10', icon: 'text-accent-green', text: 'text-accent-green' },
    red: { bg: 'bg-accent-red/10', icon: 'text-accent-red', text: 'text-accent-red' },
    yellow: { bg: 'bg-accent-yellow/10', icon: 'text-accent-yellow', text: 'text-accent-yellow' },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map(({ label, value, sub, icon: Icon, color, trend }) => {
        const c = colorMap[color] || colorMap.blue;
        return (
          <div key={label} className="trading-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-medium">{label}</span>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
                <Icon className={cn('w-4 h-4', c.icon)} />
              </div>
            </div>
            <div>
              <div className={cn(
                'text-xl font-bold font-mono',
                trend !== null
                  ? (trend >= 0 ? 'text-accent-green' : 'text-accent-red')
                  : 'text-text-primary'
              )}>
                {trend !== null && trend !== 0 && (trend > 0 ? '+' : '-')}
                {value}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
