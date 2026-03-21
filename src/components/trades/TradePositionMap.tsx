'use client';
import { Trade } from '@/lib/store';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  trades: Trade[];
}

interface PositionBarProps {
  trade: Trade;
}

function PositionBar({ trade }: PositionBarProps) {
  const { type, openPrice, currentPrice, sl, tp, profit, symbol, lots } = trade;

  const hasSL = sl > 0;
  const hasTP = tp > 0;

  // Build scale min/max using all relevant levels
  const levels = [openPrice, currentPrice];
  if (hasSL) levels.push(sl);
  if (hasTP) levels.push(tp);

  const rawMin = Math.min(...levels);
  const rawMax = Math.max(...levels);
  const padding = (rawMax - rawMin) * 0.25 || openPrice * 0.001;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min;

  const pct = (v: number) => ((v - min) / range) * 100;

  const entryPct = pct(openPrice);
  const currentPct = pct(currentPrice);
  const slPct = hasSL ? pct(sl) : null;
  const tpPct = hasTP ? pct(tp) : null;

  const isBuy = type === 'BUY';
  const isProfit = profit >= 0;

  // Progress from entry toward TP (or SL if losing)
  const progressLeft = Math.min(entryPct, currentPct);
  const progressWidth = Math.abs(currentPct - entryPct);

  const fmt = (v: number) => v >= 100 ? v.toFixed(2) : v.toFixed(5);

  // Pip distance
  const pipValue = openPrice >= 100 ? 0.01 : 0.0001;
  const pips = Math.abs(currentPrice - openPrice) / pipValue;

  return (
    <div className="trading-card p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary text-sm">{symbol}</span>
          <span className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold',
            isBuy ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
          )}>
            {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {type}
          </span>
          <span className="text-xs text-text-muted">{lots.toFixed(2)} lot</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isProfit
            ? <TrendingUp className="w-3.5 h-3.5 text-accent-green" />
            : <TrendingDown className="w-3.5 h-3.5 text-accent-red" />
          }
          <span className={cn(
            'font-mono font-bold text-sm',
            isProfit ? 'text-accent-green' : 'text-accent-red'
          )}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)} USD
          </span>
          <span className="text-xs text-text-muted">
            ({pips.toFixed(1)} pips)
          </span>
        </div>
      </div>

      {/* Price bar visualization */}
      <div className="relative h-8 my-1">
        {/* Track */}
        <div className="absolute inset-y-0 left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-bg-tertiary rounded-full" />

        {/* SL zone */}
        {hasSL && slPct !== null && (
          <div
            className="absolute inset-y-0 top-1/2 -translate-y-1/2 h-2 bg-accent-red/20 rounded-l-full"
            style={{
              left: `${Math.min(slPct, entryPct)}%`,
              width: `${Math.abs(entryPct - slPct)}%`,
            }}
          />
        )}

        {/* TP zone */}
        {hasTP && tpPct !== null && (
          <div
            className="absolute inset-y-0 top-1/2 -translate-y-1/2 h-2 bg-accent-green/20 rounded-r-full"
            style={{
              left: `${Math.min(tpPct, entryPct)}%`,
              width: `${Math.abs(entryPct - tpPct)}%`,
            }}
          />
        )}

        {/* P&L progress bar */}
        <div
          className={cn(
            'absolute inset-y-0 top-1/2 -translate-y-1/2 h-2 rounded-full opacity-80',
            isProfit ? 'bg-accent-green' : 'bg-accent-red'
          )}
          style={{ left: `${progressLeft}%`, width: `${progressWidth}%` }}
        />

        {/* SL marker */}
        {hasSL && slPct !== null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${slPct}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-full bg-accent-red" />
          </div>
        )}

        {/* TP marker */}
        {hasTP && tpPct !== null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${tpPct}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-full bg-accent-green" />
          </div>
        )}

        {/* Entry price marker */}
        <div
          className="absolute top-0 bottom-0 flex flex-col items-center z-10"
          style={{ left: `${entryPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-full bg-accent-blue" />
          <div className="absolute -top-1 w-2 h-2 rounded-full bg-accent-blue border border-bg-primary" />
        </div>

        {/* Current price marker */}
        <div
          className={cn(
            'absolute top-0 bottom-0 z-20 flex flex-col items-center',
          )}
          style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
        >
          <div className={cn('w-0.5 h-full', isProfit ? 'bg-accent-green' : 'bg-accent-red')} />
          <div className={cn(
            'absolute -top-1 w-3 h-3 rounded-full border-2 border-bg-primary',
            isProfit ? 'bg-accent-green' : 'bg-accent-red'
          )} />
        </div>
      </div>

      {/* Price labels */}
      <div className="relative h-5 mt-1">
        {hasSL && slPct !== null && (
          <div
            className="absolute text-[9px] text-accent-red font-mono whitespace-nowrap"
            style={{
              left: `${slPct}%`,
              transform: 'translateX(-50%)',
              top: 0,
            }}
          >
            SL {fmt(sl)}
          </div>
        )}
        <div
          className="absolute text-[9px] text-accent-blue font-mono whitespace-nowrap"
          style={{
            left: `${entryPct}%`,
            transform: 'translateX(-50%)',
            top: 0,
          }}
        >
          In {fmt(openPrice)}
        </div>
        {hasTP && tpPct !== null && (
          <div
            className="absolute text-[9px] text-accent-green font-mono whitespace-nowrap"
            style={{
              left: `${tpPct}%`,
              transform: 'translateX(-50%)',
              top: 0,
            }}
          >
            TP {fmt(tp)}
          </div>
        )}
        <div
          className={cn(
            'absolute text-[9px] font-mono font-bold whitespace-nowrap',
            isProfit ? 'text-accent-green' : 'text-accent-red'
          )}
          style={{
            left: `${currentPct}%`,
            transform: 'translateX(-50%)',
            bottom: 0,
          }}
        >
          ▶ {fmt(currentPrice)}
        </div>
      </div>

      {/* Progress to TP/SL */}
      {(hasSL || hasTP) && (
        <div className="mt-3 flex items-center gap-3 text-xs">
          {hasTP && tpPct !== null && (
            <div className="flex items-center gap-1">
              <span className="text-text-muted">To TP:</span>
              <div className="w-16 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-green rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0,
                      isBuy
                        ? ((currentPrice - openPrice) / (tp - openPrice)) * 100
                        : ((openPrice - currentPrice) / (openPrice - tp)) * 100
                    ))}%`
                  }}
                />
              </div>
              <span className={cn('font-mono', isProfit ? 'text-accent-green' : 'text-text-muted')}>
                {Math.min(100, Math.max(0,
                  isBuy
                    ? ((currentPrice - openPrice) / (tp - openPrice)) * 100
                    : ((openPrice - currentPrice) / (openPrice - tp)) * 100
                )).toFixed(0)}%
              </span>
            </div>
          )}
          {hasSL && slPct !== null && (
            <div className="flex items-center gap-1">
              <span className="text-text-muted">Risk:</span>
              <div className="w-16 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-red rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0,
                      isBuy
                        ? ((openPrice - currentPrice) / (openPrice - sl)) * 100
                        : ((currentPrice - openPrice) / (sl - openPrice)) * 100
                    ))}%`
                  }}
                />
              </div>
              <span className="font-mono text-text-muted">
                {Math.min(100, Math.max(0,
                  isBuy
                    ? ((openPrice - currentPrice) / (openPrice - sl)) * 100
                    : ((currentPrice - openPrice) / (sl - openPrice)) * 100
                )).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="ml-auto text-text-muted">
            #{trade.ticket} · {trade.comment || 'Manual'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradePositionMap({ trades }: Props) {
  if (trades.length === 0) return null;

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Position Map</h3>
        <span className="text-xs text-text-muted">
          Entry <span className="inline-block w-2 h-2 rounded-full bg-accent-blue align-middle mx-0.5" />
          · Current <span className="inline-block w-2 h-2 rounded-full bg-accent-green align-middle mx-0.5" />
          · SL <span className="inline-block w-2 h-2 rounded-full bg-accent-red align-middle mx-0.5" />
          · TP <span className="inline-block w-2 h-2 rounded-full bg-accent-green align-middle mx-0.5" />
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {trades.map(trade => (
          <PositionBar key={trade.id} trade={trade} />
        ))}
      </div>
    </div>
  );
}
