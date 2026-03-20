'use client';
import { useState } from 'react';
import {
  Download, Trash2, Power, PowerOff, Plus, Search,
  BrainCircuit, ChevronDown, ChevronUp, Clock, Check, Copy
} from 'lucide-react';
import { useStore, Strategy } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';

interface Props {
  onNew: () => void;
}

export default function StrategyList({ onNew }: Props) {
  const { strategies, updateStrategy, removeStrategy, addNotification } = useStore();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = strategies.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = (s: Strategy) => {
    updateStrategy(s.id, { isActive: !s.isActive });
    addNotification({
      type: 'info',
      title: s.isActive ? 'Strategy Paused' : 'Strategy Activated',
      message: `"${s.name}" is now ${s.isActive ? 'paused' : 'active'}`,
    });
  };

  const handleDownload = (s: Strategy) => {
    const blob = new Blob([s.mql5Code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.name.replace(/\s+/g, '_')}.mq5`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (s: Strategy) => {
    navigator.clipboard.writeText(s.mql5Code);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (s: Strategy) => {
    if (confirm(`Delete strategy "${s.name}"?`)) {
      removeStrategy(s.id);
      addNotification({ type: 'info', title: 'Strategy Deleted', message: `"${s.name}" has been removed` });
    }
  };

  if (strategies.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
        <BrainCircuit className="w-16 h-16 text-text-muted opacity-30" />
        <div>
          <p className="text-base font-medium text-text-secondary">No strategies yet</p>
          <p className="text-sm text-text-muted mt-1">Create your first AI-generated trading strategy</p>
        </div>
        <button onClick={onNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Strategy
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Search & Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="trading-input pl-9"
            placeholder="Search strategies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={onNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Strategy
        </button>
        <span className="text-xs text-text-muted">{filtered.length} strategies</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filtered.map((strategy) => (
          <div key={strategy.id} className="trading-card">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-text-primary">{strategy.name}</h3>
                  <span className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    strategy.isActive
                      ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                      : 'bg-bg-tertiary text-text-muted border border-border'
                  )}>
                    {strategy.isActive
                      ? <><span className="status-dot active w-1.5 h-1.5" />Active</>
                      : <><Clock className="w-2.5 h-2.5" />Idle</>
                    }
                  </span>
                  <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-tertiary rounded border border-border">
                    {strategy.symbol}
                  </span>
                  <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-tertiary rounded border border-border">
                    {strategy.timeframe}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1.5 line-clamp-2">{strategy.description}</p>
                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Created {formatDate(strategy.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(strategy)}
                  className={cn(
                    'p-1.5 rounded-lg border transition-colors',
                    strategy.isActive
                      ? 'bg-accent-red/10 border-accent-red/20 text-accent-red hover:bg-accent-red/20'
                      : 'bg-accent-green/10 border-accent-green/20 text-accent-green hover:bg-accent-green/20'
                  )}
                  title={strategy.isActive ? 'Pause strategy' : 'Activate strategy'}
                >
                  {strategy.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy(strategy)}
                  className="p-1.5 rounded-lg border border-border bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title="Copy MQL5 code"
                >
                  {copiedId === strategy.id ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDownload(strategy)}
                  className="p-1.5 rounded-lg border border-border bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title="Download .mq5 file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setExpandedId(expandedId === strategy.id ? null : strategy.id)}
                  className="p-1.5 rounded-lg border border-border bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title="View code"
                >
                  {expandedId === strategy.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(strategy)}
                  className="p-1.5 rounded-lg border border-accent-red/20 bg-accent-red/5 text-accent-red hover:bg-accent-red/10 transition-colors"
                  title="Delete strategy"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            {strategy.stats && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs font-mono">
                <span>Trades: <span className="text-text-primary font-semibold">{strategy.stats.totalTrades}</span></span>
                <span>Win Rate: <span className={strategy.stats.winRate >= 50 ? 'text-accent-green font-semibold' : 'text-accent-red font-semibold'}>{strategy.stats.winRate.toFixed(1)}%</span></span>
                <span>Total P&L: <span className={cn('font-semibold', strategy.stats.totalProfit >= 0 ? 'text-accent-green' : 'text-accent-red')}>{strategy.stats.totalProfit >= 0 ? '+' : ''}{strategy.stats.totalProfit.toFixed(2)}</span></span>
                <span>Max DD: <span className="text-accent-red font-semibold">{strategy.stats.maxDrawdown.toFixed(1)}%</span></span>
              </div>
            )}

            {/* Code View */}
            {expandedId === strategy.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <pre className="code-block text-xs text-text-secondary bg-bg-primary rounded-lg p-4 overflow-auto max-h-64">
                  <code>{strategy.mql5Code}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
