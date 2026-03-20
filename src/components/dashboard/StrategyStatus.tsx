'use client';
import Link from 'next/link';
import { BrainCircuit, Plus, Power, Clock } from 'lucide-react';
import { Strategy } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Props {
  strategies: Strategy[];
}

export default function StrategyStatus({ strategies }: Props) {
  const activeStrategies = strategies.filter(s => s.isActive);

  return (
    <div className="trading-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">AI Strategies</h3>
        <Link
          href="/strategies"
          className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          New
        </Link>
      </div>

      {strategies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <BrainCircuit className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary font-medium">No strategies yet</p>
          <p className="text-xs text-text-muted mt-1 mb-4">
            Describe your strategy in plain language and AI will generate MQL5 code
          </p>
          <Link href="/strategies" className="btn-primary text-xs py-1.5">
            Create Strategy
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {strategies.slice(0, 6).map((strategy) => (
            <Link
              key={strategy.id}
              href="/strategies"
              className="block p-3 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{strategy.name}</p>
                  <p className="text-xs text-text-muted truncate mt-0.5">{strategy.symbol} • {strategy.timeframe}</p>
                </div>
                <div className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                  strategy.isActive
                    ? 'bg-accent-green/10 text-accent-green'
                    : 'bg-bg-card text-text-muted'
                )}>
                  {strategy.isActive
                    ? <Power className="w-2.5 h-2.5" />
                    : <Clock className="w-2.5 h-2.5" />
                  }
                  {strategy.isActive ? 'Active' : 'Idle'}
                </div>
              </div>
              {strategy.stats && (
                <div className="flex items-center gap-3 mt-2 text-xs text-text-muted font-mono">
                  <span>WR: <span className={strategy.stats.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'}>{strategy.stats.winRate.toFixed(0)}%</span></span>
                  <span>P&L: <span className={strategy.stats.totalProfit >= 0 ? 'text-accent-green' : 'text-accent-red'}>{strategy.stats.totalProfit >= 0 ? '+' : ''}{strategy.stats.totalProfit.toFixed(2)}</span></span>
                </div>
              )}
            </Link>
          ))}

          {strategies.length > 6 && (
            <Link href="/strategies" className="block text-xs text-center text-text-muted hover:text-accent-blue py-2 transition-colors">
              +{strategies.length - 6} more strategies
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
