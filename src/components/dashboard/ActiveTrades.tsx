'use client';
import { ArrowUpRight, ArrowDownRight, X, MoreHorizontal } from 'lucide-react';
import { Trade } from '@/lib/store';
import { cn, formatCurrency, formatDate, getOrderTypeColor } from '@/lib/utils';

interface Props {
  trades: Trade[];
}

export default function ActiveTrades({ trades }: Props) {
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Open Positions</h3>
          <span className="text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 rounded-full px-2 py-0.5">
            {trades.length}
          </span>
        </div>
        <div className={cn(
          'text-sm font-mono font-bold',
          totalProfit >= 0 ? 'text-accent-green' : 'text-accent-red'
        )}>
          {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USD
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-sm">
          No open positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full trade-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Lots</th>
                <th>Open Price</th>
                <th>Current</th>
                <th>SL / TP</th>
                <th>P&L</th>
                <th>Opened</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="font-medium text-text-primary">{trade.symbol}</td>
                  <td>
                    <div className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold',
                      trade.type === 'BUY'
                        ? 'bg-accent-green/10 text-accent-green'
                        : 'bg-accent-red/10 text-accent-red'
                    )}>
                      {trade.type === 'BUY'
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownRight className="w-3 h-3" />
                      }
                      {trade.type}
                    </div>
                  </td>
                  <td className="font-mono text-text-secondary">{trade.lots.toFixed(2)}</td>
                  <td className="font-mono text-text-secondary">{trade.openPrice.toFixed(5)}</td>
                  <td className={cn(
                    'font-mono font-medium',
                    trade.type === 'BUY'
                      ? (trade.currentPrice > trade.openPrice ? 'text-accent-green' : 'text-accent-red')
                      : (trade.currentPrice < trade.openPrice ? 'text-accent-green' : 'text-accent-red')
                  )}>
                    {trade.currentPrice.toFixed(5)}
                  </td>
                  <td className="font-mono text-xs">
                    <span className="text-accent-red">{trade.sl > 0 ? trade.sl.toFixed(5) : '—'}</span>
                    <span className="text-text-muted mx-1">/</span>
                    <span className="text-accent-green">{trade.tp > 0 ? trade.tp.toFixed(5) : '—'}</span>
                  </td>
                  <td className={cn(
                    'font-mono font-bold',
                    trade.profit >= 0 ? 'text-accent-green' : 'text-accent-red'
                  )}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </td>
                  <td className="text-text-muted text-xs whitespace-nowrap">
                    {formatDate(trade.openTime)}
                  </td>
                  <td>
                    <button className="p-1 text-text-muted hover:text-accent-red rounded transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
