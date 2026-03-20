'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketItem {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  category: 'forex' | 'crypto' | 'commodity';
}

const BASE_PRICES: MarketItem[] = [
  { symbol: 'EUR/USD', price: 1.08456, change: 0.00123, changePct: 0.11, category: 'forex' },
  { symbol: 'GBP/USD', price: 1.27420, change: -0.00230, changePct: -0.18, category: 'forex' },
  { symbol: 'USD/JPY', price: 149.820, change: 0.340, changePct: 0.23, category: 'forex' },
  { symbol: 'AUD/USD', price: 0.65340, change: -0.00089, changePct: -0.14, category: 'forex' },
  { symbol: 'BTC/USD', price: 66100.00, change: 1280.00, changePct: 1.97, category: 'crypto' },
  { symbol: 'ETH/USD', price: 3490.50, change: -45.20, changePct: -1.28, category: 'crypto' },
  { symbol: 'XAU/USD', price: 2305.30, change: -13.20, changePct: -0.57, category: 'commodity' },
];

const CATEGORY_COLORS: Record<string, string> = {
  forex: 'text-accent-blue',
  crypto: 'text-accent-purple',
  commodity: 'text-accent-yellow',
};

export default function MarketOverview() {
  const [prices, setPrices] = useState<MarketItem[]>(BASE_PRICES);
  const [flashMap, setFlashMap] = useState<Record<string, 'green' | 'red' | null>>({});

  // Simulate price movement
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(item => {
        const delta = (Math.random() - 0.5) * item.price * 0.0005;
        const newPrice = item.price + delta;
        const change = item.change + delta;
        const changePct = (change / (newPrice - change)) * 100;

        setFlashMap(f => ({ ...f, [item.symbol]: delta > 0 ? 'green' : 'red' }));
        setTimeout(() => setFlashMap(f => ({ ...f, [item.symbol]: null })), 400);

        return { ...item, price: newPrice, change, changePct };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="trading-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Market Watch</h3>
        <div className="flex items-center gap-1">
          <span className="status-dot active" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {prices.map((item) => (
          <div
            key={item.symbol}
            className={cn(
              'flex items-center justify-between px-2 py-2 rounded-lg transition-colors',
              flashMap[item.symbol] === 'green' ? 'flash-green' : '',
              flashMap[item.symbol] === 'red' ? 'flash-red' : '',
              'hover:bg-bg-hover cursor-pointer'
            )}
          >
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-semibold text-text-primary">{item.symbol}</p>
                <p className={cn('text-xs', CATEGORY_COLORS[item.category])}>
                  {item.category}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono font-semibold text-text-primary">
                {item.symbol.includes('JPY')
                  ? item.price.toFixed(3)
                  : item.category === 'crypto'
                  ? item.price.toFixed(2)
                  : item.price.toFixed(5)}
              </p>
              <div className={cn(
                'flex items-center gap-0.5 justify-end text-xs font-mono',
                item.changePct >= 0 ? 'text-accent-green' : 'text-accent-red'
              )}>
                {item.changePct >= 0
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />
                }
                {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
